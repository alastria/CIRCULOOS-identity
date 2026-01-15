import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

/**
 * Enhanced OTP Service with Security Best Practices
 * 
 * Features:
 * - Time-based OTP with sliding window
 * - HMAC-SHA256 for cryptographic integrity
 * - Rate limiting to prevent brute force
 * - Timing-safe comparison
 * - Configurable length and expiry
 */

export interface OTPConfig {
  secret: string
  expirySeconds: number
  length?: 6 | 8
  algorithm?: 'sha256' | 'sha512'
}

export interface OTPResult {
  otp: string
  hash: string
  expiresAt: number
  salt: string
}

export interface OTPVerificationResult {
  valid: boolean
  reason?: string
  attemptsRemaining?: number
}

export class SecureOTPService {
  private rateLimit: Map<string, { attempts: number[], blocked: boolean }> = new Map()
  private readonly maxAttempts = 5
  private readonly windowSeconds = 300 // 5 minutes
  private readonly blockDuration = 900000 // 15 minutes in ms

  constructor(private config: OTPConfig) {
    this.config.length = config.length || 6
    this.config.algorithm = config.algorithm || 'sha256'
  }

  /**
   * Generate a secure OTP with cryptographic binding
   */
  async generate(identifier: string): Promise<OTPResult> {
    const timestamp = Date.now()
    const salt = randomBytes(16).toString('hex')
    
    // Create unique data for this OTP
    const data = `${identifier}:${timestamp}:${salt}`
    const hmac = createHmac(this.config.algorithm!, this.config.secret)
    hmac.update(data)
    const hash = hmac.digest('hex')
    
    // Extract numeric OTP from hash (deterministic but unpredictable)
    const otp = this.extractNumericOTP(hash, this.config.length!)
    
    // Create storage hash (what we store and compare against)
    const storageHash = this.createStorageHash(otp, identifier, salt)
    
    return {
      otp,
      hash: storageHash,
      expiresAt: timestamp + (this.config.expirySeconds * 1000),
      salt
    }
  }

  /**
   * Verify OTP with rate limiting and timing-safe comparison
   */
  async verify(
    otp: string,
    expectedHash: string,
    identifier: string,
    salt: string,
    expiresAt: number
  ): Promise<OTPVerificationResult> {
    // Check if blocked
    if (this.isBlocked(identifier)) {
      return {
        valid: false,
        reason: 'Too many failed attempts. Please try again later.',
        attemptsRemaining: 0
      }
    }

    // Check expiration
    if (Date.now() > expiresAt) {
      return {
        valid: false,
        reason: 'OTP has expired'
      }
    }

    // Validate format
    if (!this.isValidFormat(otp)) {
      this.recordAttempt(identifier, false)
      return {
        valid: false,
        reason: 'Invalid OTP format'
      }
    }

    // Rate limit check
    const rateCheckResult = this.checkRateLimit(identifier)
    if (!rateCheckResult.allowed) {
      return {
        valid: false,
        reason: 'Rate limit exceeded',
        attemptsRemaining: rateCheckResult.remaining
      }
    }

    // Compute expected hash
    const computedHash = this.createStorageHash(otp, identifier, salt)
    
    // Timing-safe comparison to prevent timing attacks
    let isValid = false
    try {
      isValid = timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      )
    } catch (err) {
      // Hashes have different lengths - invalid
      isValid = false
    }

    // Record attempt
    this.recordAttempt(identifier, isValid)

    if (!isValid) {
      const remaining = this.maxAttempts - this.getAttemptCount(identifier)
      return {
        valid: false,
        reason: 'Invalid OTP',
        attemptsRemaining: Math.max(0, remaining)
      }
    }

    // Success - clear rate limit for this identifier
    this.clearRateLimit(identifier)

    return { valid: true }
  }

  /**
   * Extract numeric OTP from hash
   */
  private extractNumericOTP(hash: string, length: number): string {
    // Use multiple sections of hash for better distribution
    let otp = ''
    const step = Math.floor(hash.length / length)
    
    for (let i = 0; i < length; i++) {
      const offset = i * step
      const chunk = hash.substring(offset, offset + 4)
      const num = parseInt(chunk, 16) % 10
      otp += num
    }
    
    return otp.padStart(length, '0')
  }

  /**
   * Create storage hash (what we compare against)
   */
  private createStorageHash(otp: string, identifier: string, salt: string): string {
    const data = `${otp}:${identifier}:${salt}`
    const hmac = createHmac(this.config.algorithm!, this.config.secret)
    hmac.update(data)
    return hmac.digest('hex')
  }

  /**
   * Validate OTP format
   */
  private isValidFormat(otp: string): boolean {
    const regex = new RegExp(`^\\d{${this.config.length}}$`)
    return regex.test(otp)
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(identifier: string): { allowed: boolean, remaining: number } {
    const now = Date.now()
    const record = this.rateLimit.get(identifier)
    
    if (!record) {
      return { allowed: true, remaining: this.maxAttempts }
    }

    // Clean old attempts outside window
    const recentAttempts = record.attempts.filter(
      t => now - t < this.windowSeconds * 1000
    )
    
    const remaining = this.maxAttempts - recentAttempts.length
    
    if (recentAttempts.length >= this.maxAttempts) {
      // Block this identifier
      record.blocked = true
      setTimeout(() => this.clearRateLimit(identifier), this.blockDuration)
      return { allowed: false, remaining: 0 }
    }
    
    return { allowed: true, remaining }
  }

  /**
   * Record verification attempt
   */
  private recordAttempt(identifier: string, success: boolean): void {
    const now = Date.now()
    let record = this.rateLimit.get(identifier)
    
    if (!record) {
      record = { attempts: [], blocked: false }
      this.rateLimit.set(identifier, record)
    }

    if (!success) {
      record.attempts.push(now)
    }
  }

  /**
   * Get attempt count in current window
   */
  private getAttemptCount(identifier: string): number {
    const record = this.rateLimit.get(identifier)
    if (!record) return 0

    const now = Date.now()
    return record.attempts.filter(
      t => now - t < this.windowSeconds * 1000
    ).length
  }

  /**
   * Check if identifier is blocked
   */
  private isBlocked(identifier: string): boolean {
    const record = this.rateLimit.get(identifier)
    return record?.blocked || false
  }

  /**
   * Clear rate limit for identifier
   */
  private clearRateLimit(identifier: string): void {
    this.rateLimit.delete(identifier)
  }

  /**
   * Cleanup expired rate limit entries (call periodically)
   */
  public cleanup(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [identifier, record] of this.rateLimit.entries()) {
      const recentAttempts = record.attempts.filter(
        t => now - t < this.windowSeconds * 1000
      )
      
      if (recentAttempts.length === 0 && !record.blocked) {
        toDelete.push(identifier)
      }
    }

    toDelete.forEach(id => this.rateLimit.delete(id))
  }
}

/**
 * Factory function for easy instantiation
 */
export function createSecureOTPService(config: OTPConfig): SecureOTPService {
  return new SecureOTPService(config)
}

/**
 * Backward compatible functions (delegating to SecureOTPService)
 */
export function generateSecureOtp(
  identifier: string,
  secret: string,
  expirySeconds: number = 300,
  length: 6 | 8 = 6
): Promise<OTPResult> {
  const service = new SecureOTPService({ secret, expirySeconds, length })
  return service.generate(identifier)
}

export function verifySecureOtp(
  otp: string,
  expectedHash: string,
  identifier: string,
  salt: string,
  expiresAt: number,
  secret: string
): Promise<OTPVerificationResult> {
  const service = new SecureOTPService({ secret, expirySeconds: 300 })
  return service.verify(otp, expectedHash, identifier, salt, expiresAt)
}
