import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

/**
 * Enhanced Token Service with JWT-like Security
 * 
 * Features:
 * - HMAC-based token generation
 * - Cryptographically secure random JTI
 * - Expiration enforcement
 * - Token binding to specific operations
 * - Replay attack prevention
 */

export interface TokenClaims {
  iss: string // Issuer DID
  sub: string // Subject (holder address or email)
  iat: number // Issued at (timestamp)
  exp: number // Expiration (timestamp)
  jti: string // JWT ID (unique token identifier)
  
  // Custom claims
  vcHash?: string
  issuanceId?: string
  holderAddress?: string
  operation?: 'prepare' | 'mint' | 'finalize' | 'verify'
  
  [key: string]: any
}

export interface TokenVerificationResult {
  valid: boolean
  claims?: TokenClaims
  reason?: string
}

export class SecureTokenService {
  private usedTokens: Map<string, number> = new Map() // jti -> expiration
  private readonly cleanupInterval = 3600000 // 1 hour

  constructor(private secret: string) {
    // Start periodic cleanup of expired tokens
    setInterval(() => this.cleanupExpiredTokens(), this.cleanupInterval)
  }

  /**
   * Issue a new token with claims
   */
  async issue(claims: Partial<TokenClaims>, expirySeconds: number = 300): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    
    const fullClaims: TokenClaims = {
      iss: claims.iss || process.env.ISSUER_DID || 'did:example:issuer',
      sub: claims.sub || 'unknown',
      iat: now,
      exp: now + expirySeconds,
      jti: this.generateJTI(),
      ...claims
    }

    // Create token payload (base64url encoded JSON)
    const payload = Buffer.from(JSON.stringify(fullClaims)).toString('base64url')
    
    // Create signature (HMAC-SHA256 of payload)
    const signature = this.signPayload(payload)
    
    // Token format: payload.signature
    return `${payload}.${signature}`
  }

  /**
   * Verify token and return claims
   */
  async verify(token: string): Promise<TokenVerificationResult> {
    try {
      // Parse token
      const parts = token.split('.')
      if (parts.length !== 2) {
        return { valid: false, reason: 'Invalid token format' }
      }

      const [payload, signature] = parts

      // Verify signature
      const expectedSignature = this.signPayload(payload)
      if (!this.timingSafeCompare(signature, expectedSignature)) {
        return { valid: false, reason: 'Invalid token signature' }
      }

      // Decode claims
      const claimsJson = Buffer.from(payload, 'base64url').toString('utf-8')
      const claims: TokenClaims = JSON.parse(claimsJson)

      // Validate expiration
      const now = Math.floor(Date.now() / 1000)
      if (claims.exp < now) {
        return { valid: false, reason: 'Token has expired' }
      }

      // Validate issued at (not in future)
      if (claims.iat > now + 60) { // Allow 60s clock skew
        return { valid: false, reason: 'Token issued in the future' }
      }

      // Check for replay attack
      if (this.isTokenUsed(claims.jti)) {
        return { valid: false, reason: 'Token already used (replay attack detected)' }
      }

      // Mark token as used
      this.markTokenUsed(claims.jti, claims.exp)

      return { valid: true, claims }
    } catch (err: any) {
      return { valid: false, reason: `Token verification failed: ${err?.message || 'Unknown error'}` }
    }
  }

  /**
   * Revoke a token by JTI
   */
  async revoke(jti: string): Promise<void> {
    // Mark as used with current timestamp
    this.usedTokens.set(jti, Math.floor(Date.now() / 1000))
  }

  /**
   * Generate cryptographically secure JTI
   */
  private generateJTI(): string {
    // Combine timestamp + random bytes for uniqueness
    const timestamp = Date.now().toString(36)
    const random = randomBytes(16).toString('hex')
    return `${timestamp}-${random}`
  }

  /**
   * Sign payload with HMAC-SHA256
   */
  private signPayload(payload: string): string {
    const hmac = createHmac('sha256', this.secret)
    hmac.update(payload)
    return hmac.digest('base64url')
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a)
      const bufB = Buffer.from(b)
      
      if (bufA.length !== bufB.length) {
        return false
      }
      
      return timingSafeEqual(bufA, bufB)
    } catch {
      return false
    }
  }

  /**
   * Check if token has been used
   */
  private isTokenUsed(jti: string): boolean {
    return this.usedTokens.has(jti)
  }

  /**
   * Mark token as used
   */
  private markTokenUsed(jti: string, expiration: number): void {
    this.usedTokens.set(jti, expiration)
  }

  /**
   * Cleanup expired tokens from used list
   */
  private cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000)
    const toDelete: string[] = []

    for (const [jti, exp] of this.usedTokens.entries()) {
      if (exp < now) {
        toDelete.push(jti)
      }
    }

    toDelete.forEach(jti => this.usedTokens.delete(jti))
    
    if (toDelete.length > 0) {
      console.log(`[SecureTokenService] Cleaned up ${toDelete.length} expired tokens`)
    }
  }

  /**
   * Get statistics
   */
  getStats(): { activeTokens: number, usedTokens: number } {
    return {
      activeTokens: this.usedTokens.size,
      usedTokens: this.usedTokens.size
    }
  }
}

/**
 * Factory function
 */
export function createSecureTokenService(secret: string): SecureTokenService {
  if (!secret || secret.length < 32) {
    throw new Error('Token secret must be at least 32 characters')
  }
  return new SecureTokenService(secret)
}
