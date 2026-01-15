import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authenticateJWT, verifyOwnership, requireRole } from '../../src/middleware/auth.middleware'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn()
  }
}))

import jwt from 'jsonwebtoken'

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>
  let mockReply: Partial<FastifyReply>

  beforeEach(() => {
    mockRequest = {
      cookies: {}
    } as any

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis()
    }

    process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticateJWT', () => {
    it('should authenticate valid JWT from cookie', async () => {
      const validToken = 'valid-jwt-token'
      const decodedPayload = {
        wallet: '0x1234567890123456789012345678901234567890',
        role: 'holder' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      ;(mockRequest as any).cookies = { auth_token: validToken }

      vi.mocked(jwt.verify).mockReturnValue(decodedPayload as any)

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(jwt.verify).toHaveBeenCalledWith(validToken, 'test-secret-key-for-testing-purposes')
      expect(mockRequest.user).toEqual({
        wallet: decodedPayload.wallet.toLowerCase(),
        role: 'holder'
      })
      expect(mockReply.code).not.toHaveBeenCalled()
    })

    it('should normalize wallet address to lowercase', async () => {
      const validToken = 'valid-jwt-token'
      const decodedPayload = {
        wallet: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
        role: 'issuer' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      ;(mockRequest as any).cookies = { auth_token: validToken }

      vi.mocked(jwt.verify).mockReturnValue(decodedPayload as any)

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(mockRequest.user?.wallet).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    })

    it('should reject request when no token is present', async () => {
      ;(mockRequest as any).cookies = {}

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized: Session not found'
      })
      expect(mockRequest.user).toBeUndefined()
    })

    it('should reject request with invalid token', async () => {
      const invalidToken = 'invalid-jwt-token'
      ;(mockRequest as any).cookies = { auth_token: invalidToken }

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(mockReply.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/' })
      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Session expired or invalid'
      })
      expect(mockRequest.user).toBeUndefined()
    })

    it('should reject request with expired token', async () => {
      const expiredToken = 'expired-jwt-token'
      ;(mockRequest as any).cookies = { auth_token: expiredToken }

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(mockReply.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/' })
      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Session expired or invalid'
      })
    })

    it('should handle missing JWT_SECRET gracefully', async () => {
      delete process.env.JWT_SECRET

      const validToken = 'valid-jwt-token'
      ;(mockRequest as any).cookies = { auth_token: validToken }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

      expect(consoleErrorSpy).toHaveBeenCalledWith('JWT_SECRET is not configured')
      expect(mockReply.code).toHaveBeenCalledWith(500)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Server configuration error'
      })

      consoleErrorSpy.mockRestore()
      process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes'
    })

    it('should support different user roles', async () => {
      const roles: Array<'holder' | 'issuer' | 'admin'> = ['holder', 'issuer', 'admin']

      for (const role of roles) {
        const validToken = `valid-jwt-token-${role}`
        const decodedPayload = {
          wallet: '0x1234567890123456789012345678901234567890',
          role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        }

        ;(mockRequest as any).cookies = { auth_token: validToken }
        vi.mocked(jwt.verify).mockReturnValue(decodedPayload as any)

        await authenticateJWT(mockRequest as FastifyRequest, mockReply as FastifyReply)

        expect(mockRequest.user?.role).toBe(role)
        vi.clearAllMocks()
      }
    })
  })

  describe('verifyOwnership', () => {
    it('should allow access when wallet matches resource owner', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      mockRequest.user = {
        wallet: walletAddress,
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        walletAddress
      )

      expect(result).toBe(true)
      expect(mockReply.code).not.toHaveBeenCalled()
    })

    it('should normalize addresses for comparison', async () => {
      const walletAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'
      mockRequest.user = {
        wallet: walletAddress.toLowerCase(),
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        walletAddress.toUpperCase()
      )

      expect(result).toBe(true)
    })

    it('should handle DID format addresses', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890'
      const didAddress = `did:ethr:alastria:${ethAddress}`

      mockRequest.user = {
        wallet: ethAddress,
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        didAddress
      )

      expect(result).toBe(true)
    })

    it('should handle both addresses in DID format', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890'
      const userDid = `did:ethr:mainnet:${ethAddress}`
      const resourceDid = `did:ethr:alastria:${ethAddress}`

      mockRequest.user = {
        wallet: userDid,
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        resourceDid
      )

      expect(result).toBe(true)
    })

    it('should deny access when no user session exists', async () => {
      mockRequest.user = undefined

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        '0x1234567890123456789012345678901234567890'
      )

      expect(result).toBe(false)
      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized: No session found'
      })
    })

    it('should deny access when wallet does not match resource owner', async () => {
      const userWallet = '0x1234567890123456789012345678901234567890'
      const resourceOwner = '0x9999999999999999999999999999999999999999'

      mockRequest.user = {
        wallet: userWallet,
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        resourceOwner
      )

      expect(result).toBe(false)
      expect(mockReply.code).toHaveBeenCalledWith(403)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Access denied: Resource does not belong to authenticated wallet'
      })
    })
  })

  describe('requireRole', () => {
    it('should allow access when user has required role', async () => {
      mockRequest.user = {
        wallet: '0x1234567890123456789012345678901234567890',
        role: 'issuer'
      }

      const result = await requireRole(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        ['issuer']
      )

      expect(result).toBe(true)
      expect(mockReply.code).not.toHaveBeenCalled()
    })

    it('should allow access when user has one of multiple allowed roles', async () => {
      mockRequest.user = {
        wallet: '0x1234567890123456789012345678901234567890',
        role: 'holder'
      }

      const result = await requireRole(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        ['holder', 'issuer', 'admin']
      )

      expect(result).toBe(true)
    })

    it('should allow admin access to admin-only endpoints', async () => {
      mockRequest.user = {
        wallet: '0x1234567890123456789012345678901234567890',
        role: 'admin'
      }

      const result = await requireRole(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        ['admin']
      )

      expect(result).toBe(true)
    })

    it('should deny access when no user session exists', async () => {
      mockRequest.user = undefined

      const result = await requireRole(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        ['issuer']
      )

      expect(result).toBe(false)
      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized: No session found'
      })
    })

    it('should deny access when user role is not in allowed roles', async () => {
      mockRequest.user = {
        wallet: '0x1234567890123456789012345678901234567890',
        role: 'holder'
      }

      const result = await requireRole(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        ['issuer', 'admin']
      )

      expect(result).toBe(false)
      expect(mockReply.code).toHaveBeenCalledWith(403)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Access denied: Role 'holder' not allowed. Required: issuer, admin"
      })
    })

    it('should test all role combinations', async () => {
      const testCases: Array<{
        userRole: 'holder' | 'issuer' | 'admin'
        allowedRoles: Array<'holder' | 'issuer' | 'admin'>
        shouldPass: boolean
      }> = [
        { userRole: 'holder', allowedRoles: ['holder'], shouldPass: true },
        { userRole: 'holder', allowedRoles: ['issuer'], shouldPass: false },
        { userRole: 'holder', allowedRoles: ['admin'], shouldPass: false },
        { userRole: 'issuer', allowedRoles: ['holder'], shouldPass: false },
        { userRole: 'issuer', allowedRoles: ['issuer'], shouldPass: true },
        { userRole: 'issuer', allowedRoles: ['admin'], shouldPass: false },
        { userRole: 'admin', allowedRoles: ['holder'], shouldPass: false },
        { userRole: 'admin', allowedRoles: ['issuer'], shouldPass: false },
        { userRole: 'admin', allowedRoles: ['admin'], shouldPass: true },
        { userRole: 'holder', allowedRoles: ['holder', 'issuer'], shouldPass: true },
        { userRole: 'issuer', allowedRoles: ['holder', 'issuer'], shouldPass: true },
        { userRole: 'admin', allowedRoles: ['holder', 'issuer'], shouldPass: false }
      ]

      for (const testCase of testCases) {
        mockRequest.user = {
          wallet: '0x1234567890123456789012345678901234567890',
          role: testCase.userRole
        }

        const result = await requireRole(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply,
          testCase.allowedRoles
        )

        expect(result).toBe(testCase.shouldPass)
        vi.clearAllMocks()
      }
    })
  })

  describe('Address Normalization', () => {
    it('should normalize regular Ethereum addresses', async () => {
      const mixedCaseAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'
      mockRequest.user = {
        wallet: mixedCaseAddress.toLowerCase(),
        role: 'holder'
      }

      const result = await verifyOwnership(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        mixedCaseAddress
      )

      expect(result).toBe(true)
    })

    it('should extract address from DID format', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890'
      const testDids = [
        `did:ethr:${ethAddress}`,
        `did:ethr:mainnet:${ethAddress}`,
        `did:ethr:alastria:${ethAddress}`,
        `did:ethr:0x1:${ethAddress}`
      ]

      for (const didAddress of testDids) {
        mockRequest.user = {
          wallet: ethAddress,
          role: 'holder'
        }

        const result = await verifyOwnership(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply,
          didAddress
        )

        expect(result).toBe(true)
        vi.clearAllMocks()
      }
    })
  })
})
