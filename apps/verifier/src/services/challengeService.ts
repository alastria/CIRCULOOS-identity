import path from 'path'
import fs from 'fs'
import { randomBytes } from 'crypto'

let Database: any
try {
  Database = require('better-sqlite3')
} catch (err) {
  console.warn('[challengeService] better-sqlite3 not available, challenge features disabled')
}

export interface Challenge {
  challenge: string
  holderAddress: string
  expiresAt: number
  used: boolean
  usedAt?: number
  createdAt: number
}

export class ChallengeService {
  private db: any
  private challengeTtlSeconds: number
  private gcIntervalMs: number

  constructor(dbPath?: string, challengeTtlSeconds: number = 300, gcIntervalMs: number = 60 * 60 * 1000) {
    this.challengeTtlSeconds = challengeTtlSeconds
    this.gcIntervalMs = gcIntervalMs

    if (!Database) {
      console.warn('[ChallengeService] better-sqlite3 not available, using in-memory fallback')
      this.db = null
      return
    }

    const baseDir = dbPath ? path.dirname(dbPath) : './apps/verifier/tmp'
    const file = dbPath || path.join(baseDir, 'challenges.sqlite')

    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
    } catch (err) {
      // Directory might already exist
    }

    try {
      this.db = new Database(file)
      this.initTables()
      this.startCleanupInterval()
    } catch (err: any) {
      console.error('[ChallengeService] Failed to initialize database:', err.message)
      this.db = null
    }
  }

  private initTables(): void {
    if (!this.db) return

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS challenges (
        challenge TEXT PRIMARY KEY,
        holder_address TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        used_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_challenges_holder ON challenges(holder_address);
      CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expires_at);
      CREATE INDEX IF NOT EXISTS idx_challenges_used ON challenges(used);
    `)
  }

  /**
   * Generate a new challenge for a holder address
   * @param holderAddress The address of the holder requesting access
   * @returns Challenge object with challenge string and expiration
   */
  generateChallenge(holderAddress: string): { challenge: string; expiresAt: number } {
    if (!this.db) {
      // Fallback: generate challenge but can't validate (for development)
      const challenge = randomBytes(32).toString('hex')
      const expiresAt = Date.now() + (this.challengeTtlSeconds * 1000)
      return { challenge, expiresAt }
    }

    const challenge = randomBytes(32).toString('hex')
    const expiresAt = Math.floor(Date.now() / 1000) + this.challengeTtlSeconds

    const stmt = this.db.prepare(
      'INSERT INTO challenges (challenge, holder_address, expires_at) VALUES (?, ?, ?)'
    )
    stmt.run(challenge, holderAddress.toLowerCase(), expiresAt)

    return {
      challenge,
      expiresAt: expiresAt * 1000 // Return in milliseconds for consistency
    }
  }

  /**
   * Validate and consume a challenge
   * @param challenge The challenge string to validate
   * @param holderAddress The address that should have generated this challenge
   * @returns true if challenge is valid and was successfully consumed, false otherwise
   */
  validateAndConsume(challenge: string, holderAddress: string): boolean {
    if (!this.db) {
      // Fallback: always return true in development (not secure!)
      console.warn('[ChallengeService] Database not available, challenge validation disabled')
      return true
    }

    const now = Math.floor(Date.now() / 1000)
    const stmt = this.db.prepare(`
      SELECT * FROM challenges 
      WHERE challenge = ? 
        AND holder_address = ? 
        AND expires_at > ?
        AND used = 0
    `)

    const result = stmt.get(challenge, holderAddress.toLowerCase(), now) as any

    if (!result) {
      return false // Challenge not found, expired, or already used
    }

    // Mark as used
    const updateStmt = this.db.prepare(
      'UPDATE challenges SET used = 1, used_at = ? WHERE challenge = ?'
    )
    updateStmt.run(now, challenge)

    return true
  }

  /**
   * Check if a challenge is valid (without consuming it)
   * Useful for debugging or pre-validation
   */
  isValid(challenge: string, holderAddress: string): boolean {
    if (!this.db) return true // Fallback

    const now = Math.floor(Date.now() / 1000)
    const stmt = this.db.prepare(`
      SELECT 1 FROM challenges 
      WHERE challenge = ? 
        AND holder_address = ? 
        AND expires_at > ?
        AND used = 0
      LIMIT 1
    `)

    const result = stmt.get(challenge, holderAddress.toLowerCase(), now)
    return !!result
  }

  /**
   * Clean up expired challenges
   * Should be called periodically to prevent database bloat
   */
  cleanupExpired(): number {
    if (!this.db) return 0

    const now = Math.floor(Date.now() / 1000)
    const stmt = this.db.prepare('DELETE FROM challenges WHERE expires_at <= ?')
    const result = stmt.run(now)

    return result.changes || 0
  }

  /**
   * Start automatic cleanup interval
   * Runs every hour to clean up expired challenges
   */
  private startCleanupInterval(): void {
    if (!this.db) return

    // Clean up immediately
    this.cleanupExpired()

    // Then periodically
    setInterval(() => {
      const deleted = this.cleanupExpired()
      if (deleted > 0) {
        console.log(`[ChallengeService] Cleaned up ${deleted} expired challenges`)
      }
    }, this.gcIntervalMs)
  }

  /**
   * Get challenge statistics (for monitoring)
   */
  getStats(): { total: number; active: number; used: number; expired: number } {
    if (!this.db) {
      return { total: 0, active: 0, used: 0, expired: 0 }
    }

    const now = Math.floor(Date.now() / 1000)

    const total = this.db.prepare('SELECT COUNT(*) as count FROM challenges').get() as any
    const active = this.db.prepare(
      'SELECT COUNT(*) as count FROM challenges WHERE expires_at > ? AND used = 0'
    ).get(now) as any
    const used = this.db.prepare('SELECT COUNT(*) as count FROM challenges WHERE used = 1').get() as any
    const expired = this.db.prepare(
      'SELECT COUNT(*) as count FROM challenges WHERE expires_at <= ?'
    ).get(now) as any

    return {
      total: total?.count || 0,
      active: active?.count || 0,
      used: used?.count || 0,
      expired: expired?.count || 0
    }
  }
}

