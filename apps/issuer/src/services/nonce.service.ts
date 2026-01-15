import crypto from 'crypto'
import { SqlJsStorageAdapter } from '@circuloos/common'

// Nonce expiry in milliseconds (default: 15 minutes)
import { config } from '../config'

const NONCE_EXPIRY_MS = (config.security.nonceExpirySeconds || 300) * 1000
// GC interval: 1 hour (default)
const NONCE_GC_INTERVAL_MS = 60 * 60 * 1000

export class NonceService {
  private storage: SqlJsStorageAdapter
  private gcInterval?: NodeJS.Timeout

  constructor(storage: SqlJsStorageAdapter) {
    this.storage = storage
  }

  // Start garbage collection interval
  startGarbageCollection(): void {
    if (config.nodeEnv === 'test') return

    this.gcInterval = setInterval(async () => {
      try {
        const deleted = await this.storage.cleanupExpiredNonces()
        if (deleted > 0) {
          // console.log(`[Nonce GC] Cleaned up ${deleted} expired/used nonces`)
        }
      } catch (error) {
        // console.error('[Nonce GC] Error during cleanup:', error)
      }
    }, NONCE_GC_INTERVAL_MS)
  }

  // Stop garbage collection interval
  stopGarbageCollection(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = undefined
    }
  }

  // Generate a unique nonce for an address
  async generateNonce(address: string): Promise<{ nonce: string; expiresAt: Date; createdAt: Date }> {
    const nonce = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS)

    await this.storage.saveNonce(address, nonce, expiresAt.getTime())

    // Return createdAt truncated to seconds (to match DB storage precision)
    // This ensures the timestamp signed by frontend matches the one reconstructed by backend
    const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000)

    return { nonce, expiresAt, createdAt }
  }

  // Get a nonce (only if not used and not expired)
  async getNonce(address: string, nonce: string): Promise<{ nonce: string; createdAt: Date; used: boolean } | null> {
    const result = await this.storage.getNonce(address, nonce)

    if (!result) return null

    return {
      nonce: result.nonce,
      createdAt: result.createdAt,
      used: result.used
    }
  }

  // Mark nonce as used (anti-replay)
  async markAsUsed(address: string, nonce: string): Promise<void> {
    await this.storage.markNonceAsUsed(address, nonce)
  }

  // Delete a specific nonce
  async deleteNonce(address: string, nonce: string): Promise<void> {
    await this.storage.deleteNonce(address, nonce)
  }

  // Manually trigger garbage collection
  async cleanupExpiredNonces(): Promise<number> {
    return await this.storage.cleanupExpiredNonces()
  }
}
