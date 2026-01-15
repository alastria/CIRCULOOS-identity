import { describe, it, expect, beforeEach } from 'vitest'
import { createSecureOTPService, OTPConfig } from '../src/auth/secureOTP'

describe('SecureOTPService', () => {
  let otpService: ReturnType<typeof createSecureOTPService>
  const config: OTPConfig = {
    secret: 'test-secret-minimum-32-characters-long',
    expirySeconds: 300,
    length: 6
  }

  beforeEach(() => {
    otpService = createSecureOTPService(config)
  })

  describe('generate', () => {
    it('should generate valid OTP with all required fields', async () => {
      const identifier = 'test@example.com'
      const result = await otpService.generate(identifier)

      expect(result).toHaveProperty('otp')
      expect(result).toHaveProperty('hash')
      expect(result).toHaveProperty('salt')
      expect(result).toHaveProperty('expiresAt')

      expect(result.otp).toMatch(/^\d{6}$/)
      expect(result.hash).toBeTruthy()
      expect(result.salt).toBeTruthy()
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should generate different OTPs for same identifier', async () => {
      const identifier = 'test@example.com'
      const result1 = await otpService.generate(identifier)
      const result2 = await otpService.generate(identifier)

      expect(result1.otp).not.toBe(result2.otp)
      expect(result1.hash).not.toBe(result2.hash)
      expect(result1.salt).not.toBe(result2.salt)
    })
  })

  describe('verify', () => {
    it('should verify valid OTP successfully', async () => {
      const identifier = 'test@example.com'
      const { otp, hash, salt, expiresAt } = await otpService.generate(identifier)

      const result = await otpService.verify(otp, hash, identifier, salt, expiresAt)

      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject invalid OTP', async () => {
      const identifier = 'test@example.com'
      const { hash, salt, expiresAt } = await otpService.generate(identifier)
      const wrongOtp = '000000'

      const result = await otpService.verify(wrongOtp, hash, identifier, salt, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid OTP')
      expect(result.attemptsRemaining).toBeDefined()
    })

    it('should reject expired OTP', async () => {
      const identifier = 'test@example.com'
      const { otp, hash, salt } = await otpService.generate(identifier)
      const expiredTime = Date.now() - 1000 // 1 second ago

      const result = await otpService.verify(otp, hash, identifier, salt, expiredTime)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('OTP has expired')
    })

    it('should enforce rate limiting after multiple failures', async () => {
      const identifier = 'test@example.com'
      const { hash, salt, expiresAt } = await otpService.generate(identifier)
      const wrongOtp = '000000'

      // Attempt 5 times (should fail)
      for (let i = 0; i < 5; i++) {
        await otpService.verify(wrongOtp, hash, identifier, salt, expiresAt)
      }

      // 6th attempt should be rate limited
      const result = await otpService.verify(wrongOtp, hash, identifier, salt, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Rate limit exceeded')
      expect(result.attemptsRemaining).toBe(0)
    })

    it('should reject invalid format', async () => {
      const identifier = 'test@example.com'
      const { hash, salt, expiresAt } = await otpService.generate(identifier)
      const invalidOtp = 'abc123'

      const result = await otpService.verify(invalidOtp, hash, identifier, salt, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid OTP format')
    })
  })

  describe('cleanup', () => {
    it('should cleanup expired rate limit entries', async () => {
      const identifier = 'test@example.com'
      const { hash, salt, expiresAt } = await otpService.generate(identifier)

      // Generate some failed attempts
      await otpService.verify('000000', hash, identifier, salt, expiresAt)

      // Cleanup should not throw
      expect(() => otpService.cleanup()).not.toThrow()
    })
  })
})
