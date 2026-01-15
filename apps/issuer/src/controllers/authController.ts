import { FastifyRequest, FastifyReply } from 'fastify'
import { ethers } from 'ethers'
import jwt, { SignOptions } from 'jsonwebtoken'
import { NonceService } from '../services/nonce.service'
import { SqlJsStorageAdapter, createLogger } from '@circuloos/common'
import { BlockchainSyncService } from '../services/blockchainSyncService'
import { config } from '../config'

const logger = createLogger('auth')

// Parse JWT expiry string to seconds (e.g., '1h' -> 3600, '30m' -> 1800)
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 3600 // Default 1 hour
  const value = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return 3600
  }
}

// Cookie configuration for secure JWT storage
const getCookieOptions = () => {
  const jwtExpiry = config.security.jwtExpiry || '1h'
  const maxAge = parseExpiryToSeconds(jwtExpiry)
  return {
    httpOnly: true, // JavaScript cannot read it (Anti-XSS)
    secure: config.nodeEnv === 'production', // Only HTTPS in production
    sameSite: 'strict' as const, // Only sent on same domain (Anti-CSRF)
    path: '/',
    maxAge
  }
}

interface VerifySIWABody {
  address: string
  signature: string
  nonce: string
}

interface LogoutBody { }

export class AuthController {
  private nonceService: NonceService
  private storage: SqlJsStorageAdapter
  private syncService?: BlockchainSyncService

  constructor(nonceService: NonceService, storage: SqlJsStorageAdapter, syncService?: BlockchainSyncService) {
    this.nonceService = nonceService
    this.storage = storage
    this.syncService = syncService
  }

  setSyncService(syncService: BlockchainSyncService) {
    this.syncService = syncService
  }

  async verifySIWA(request: FastifyRequest<{ Body: VerifySIWABody }>, reply: FastifyReply) {
    const { address, signature, nonce } = request.body

    // Validate input
    if (!address || !signature || !nonce) {
      return reply.code(400).send({ error: 'Missing required fields: address, signature, nonce' })
    }

    // 1. Verify that the nonce exists and hasn't been used
    const storedNonce = await this.nonceService.getNonce(address, nonce)
    if (!storedNonce || storedNonce.used) {
      return reply.code(401).send({ error: 'Invalid or expired nonce' })
    }

    // 2. Reconstruct SIWE message (EIP-4361 Standard)
    // CRITICAL: Frontend must have signed THIS EXACT MESSAGE
    // Use environment variable to match frontend exactly
    const appUrl = config.appPublicUrl
    const domain = new URL(appUrl).host // Extract 'localhost:3000' from full URL
    const chainId = config.blockchain.chainId.toString()
    const issuedAt = storedNonce.createdAt.toISOString()

    const siweMessage = `${domain} wants you to sign in with your Ethereum account:
${address}

Quiero autenticarme en Alastria VC Platform

URI: ${appUrl}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`

    // 3. CRYPTOGRAPHY: Recover address from signature
    let recoveredAddress: string
    try {
      recoveredAddress = ethers.utils.verifyMessage(siweMessage, signature)
    } catch (err) {
      logger.error('Signature verification failed:', err)
      return reply.code(401).send({ error: 'Invalid signature format' })
    }

    // 4. THE GUARDIAN: Verify addresses match
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return reply.code(401).send({ error: 'Invalid signature or manipulated message' })
    }

    // 5. Mark nonce as used (anti-replay)
    await this.nonceService.markAsUsed(address, nonce)

    // 6. Determine role (issuer, holder, admin)
    const role = await this.determineRole(address)

    // 7. Generate JWT
    const jwtSecret = config.security.jwtSecret
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured')
      return reply.code(500).send({ error: 'Server configuration error' })
    }

    // JWT_EXPIRY supports: seconds as number, or time strings like '1h', '30m', '7d'
    const jwtExpiryEnv = config.security.jwtExpiry || '1h'
    // Parse to seconds if it's a number, otherwise use string format
    const expiresIn = /^\d+$/.test(jwtExpiryEnv) ? parseInt(jwtExpiryEnv, 10) : jwtExpiryEnv
    const token = jwt.sign(
      { wallet: address.toLowerCase(), role },
      jwtSecret,
      { expiresIn } as SignOptions
    )

    // 8. CRITICAL: Send JWT as HttpOnly Cookie (NOT in body)
    // Browser saves it automatically, JavaScript CANNOT read it
    reply.setCookie('auth_token', token, getCookieOptions())

    // 9. Respond without token in body (additional security)
    return {
      success: true,
      wallet: address.toLowerCase(),
      role
    }
  }

  async logout(request: FastifyRequest<{ Body: LogoutBody }>, reply: FastifyReply) {
    reply.clearCookie('auth_token', { path: '/' })
    return { success: true }
  }

  // Helper: Determine user role based on address
  // Queries SQLite3 database for trusted issuers (synced from blockchain events)
  private async determineRole(address: string): Promise<'holder' | 'issuer' | 'admin'> {
    const normalizedAddress = address.toLowerCase()

    // Get Diamond owner address (auto-derived from DIAMOND_OWNER_PRIVATE_KEY)
    const ownerPrivateKey = config.issuer.privateKey
    if (ownerPrivateKey) {
      try {
        const ownerWallet = new ethers.Wallet(ownerPrivateKey)
        const ownerAddress = ownerWallet.address.toLowerCase()

        // Check if Diamond owner (highest priority - auto admin)
        if (normalizedAddress === ownerAddress) {
          return 'admin'
        }
      } catch (err) {
        logger.warn('Failed to derive owner address from DIAMOND_OWNER_PRIVATE_KEY:', err)
      }
    }

    // Check if issuer (query SQLite3 - synced from blockchain events)
    let trustedIssuers = await this.storage.getTrustedIssuers({ active: true })
    let issuerAddresses = trustedIssuers.map((i: any) => i.address.toLowerCase())

    logger.info(`[Auth] Determining role for ${normalizedAddress}`)

    if (issuerAddresses.includes(normalizedAddress)) {
      logger.info(`[Auth] Address ${normalizedAddress} found in trusted issuers list -> ISSUER`)
      return 'issuer'
    }

    // RETRY LOGIC: If not found, force a blockchain sync and try again
    // This handles the case where a user was just added on-chain but sync hasn't run yet
    if (this.syncService) {
      logger.info(`[Auth] Address not found locally. Forcing blockchain sync...`)
      try {
        await this.syncService.syncIncremental()

        // Refresh list from DB
        trustedIssuers = await this.storage.getTrustedIssuers({ active: true })
        issuerAddresses = trustedIssuers.map((i: any) => i.address.toLowerCase())

        if (issuerAddresses.includes(normalizedAddress)) {
          logger.info(`[Auth] Address found after sync! -> ISSUER`)
          return 'issuer'
        }
      } catch (err) {
        logger.error('[Auth] Force sync failed:', err)
      }
    }

    logger.info(`[Auth] Address ${normalizedAddress} NOT found in trusted issuers list -> HOLDER`)
    // Default: holder
    return 'holder'
  }
}
