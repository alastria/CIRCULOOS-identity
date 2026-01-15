import { describe, it, expect, beforeEach } from 'vitest'
import { createSecureTokenService, TokenClaims } from '../src/auth/secureToken'

describe('SecureTokenService', () => {
  let tokenService: ReturnType<typeof createSecureTokenService>
  const secret = 'test-secret-minimum-32-characters-long'

  beforeEach(() => {
    tokenService = createSecureTokenService(secret)
  })

  describe('issue', () => {
    it('should issue valid token with claims', async () => {
      const claims: Partial<TokenClaims> = {
        sub: '0x1234567890123456789012345678901234567890',
        issuanceId: 'test-issuance-123',
        operation: 'prepare'
      }

      const token = await tokenService.issue(claims, 300)

      expect(token).toBeTruthy()
      expect(token).toContain('.')
      
      const parts = token.split('.')
      expect(parts).toHaveLength(2)
    })

    it('should include all required claims', async () => {
      const claims: Partial<TokenClaims> = {
        sub: '0x1234567890123456789012345678901234567890'
      }

      const token = await tokenService.issue(claims, 300)
      const result = await tokenService.verify(token)

      expect(result.valid).toBe(true)
      expect(result.claims).toHaveProperty('iss')
      expect(result.claims).toHaveProperty('sub')
      expect(result.claims).toHaveProperty('iat')
      expect(result.claims).toHaveProperty('exp')
      expect(result.claims).toHaveProperty('jti')
    })
  })

  describe('verify', () => {
    it('should verify valid token successfully', async () => {
      const claims: Partial<TokenClaims> = {
        sub: 'test-subject',
        operation: 'mint'
      }

      const token = await tokenService.issue(claims, 300)
      const result = await tokenService.verify(token)

      expect(result.valid).toBe(true)
      expect(result.claims).toBeDefined()
      expect(result.claims?.sub).toBe('test-subject')
      expect(result.claims?.operation).toBe('mint')
    })

    it('should reject token with invalid signature', async () => {
      const token = 'eyJzdWIiOiJ0ZXN0In0.invalid_signature'
      const result = await tokenService.verify(token)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('signature')
    })

    it('should reject malformed token', async () => {
      const token = 'not.a.valid.token.format'
      const result = await tokenService.verify(token)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('format')
    })

    it('should reject expired token', async () => {
      const claims: Partial<TokenClaims> = {
        sub: 'test-subject'
      }

      // Issue token with 1 second expiry
      const token = await tokenService.issue(claims, 1)

      // Wait for token to expire (2 seconds to ensure it's expired)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const result = await tokenService.verify(token)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('expired')
    })

    it('should detect replay attack (token used twice)', async () => {
      const claims: Partial<TokenClaims> = {
        sub: 'test-subject'
      }

      const token = await tokenService.issue(claims, 300)

      // First verification should succeed
      const result1 = await tokenService.verify(token)
      expect(result1.valid).toBe(true)

      // Second verification should fail (replay attack)
      const result2 = await tokenService.verify(token)
      expect(result2.valid).toBe(false)
      expect(result2.reason).toContain('already used')
    })
  })

  describe('revoke', () => {
    it('should revoke token by JTI', async () => {
      const claims: Partial<TokenClaims> = {
        sub: 'test-subject'
      }

      const token = await tokenService.issue(claims, 300)
      const result1 = await tokenService.verify(token)
      
      expect(result1.valid).toBe(true)
      const jti = result1.claims!.jti

      // Revoke token
      await tokenService.revoke(jti)

      // Try to use revoked token
      const token2 = await tokenService.issue({ sub: 'test', jti }, 300)
      const result2 = await tokenService.verify(token2)
      
      // Should fail because JTI is revoked
      expect(result2.valid).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return token statistics', async () => {
      const stats = tokenService.getStats()

      expect(stats).toHaveProperty('activeTokens')
      expect(stats).toHaveProperty('usedTokens')
      expect(typeof stats.activeTokens).toBe('number')
      expect(typeof stats.usedTokens).toBe('number')
    })
  })

  describe('constructor validation', () => {
    it('should reject short secret', () => {
      expect(() => createSecureTokenService('short')).toThrow('at least 32 characters')
    })

    it('should reject empty secret', () => {
      expect(() => createSecureTokenService('')).toThrow('at least 32 characters')
    })
  })
})
