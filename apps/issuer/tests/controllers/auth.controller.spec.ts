import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthController } from '../../src/controllers/authController'
import { NonceService } from '../../src/services/nonce.service'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    utils: {
      verifyMessage: vi.fn()
    }
  }
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn()
  }
}))

import { ethers } from 'ethers'
import jwt from 'jsonwebtoken'

describe('AuthController', () => {
  let authController: AuthController
  let mockNonceService: any
  let mockRequest: Partial<FastifyRequest>
  let mockReply: Partial<FastifyReply>

  beforeEach(() => {
    // Mock NonceService
    mockNonceService = {
      getNonce: vi.fn(),
      markAsUsed: vi.fn()
    }

    authController = new AuthController(mockNonceService as NonceService)

    // Mock Fastify request and reply
    mockRequest = {
      body: {}
    }

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis()
    }

    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes'
    process.env.DOMAIN = 'localhost'
    process.env.CHAIN_ID = '31337'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Test data used across multiple describe blocks
  const validAddress = '0x1234567890123456789012345678901234567890'
  const validNonce = 'abcd1234567890abcdef'
  const validSignature = '0xsignature123'

  describe('verifySIWA', () => {

    it('should successfully verify SIWA and return JWT in cookie', async () => {
      const createdAt = new Date()
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      // Mock ethers signature verification
      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(validAddress)

      // Mock JWT generation
      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any)

      const result = await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      // Verify nonce was checked
      expect(mockNonceService.getNonce).toHaveBeenCalledWith(validAddress, validNonce)

      // Verify signature was verified
      expect(ethers.utils.verifyMessage).toHaveBeenCalled()

      // Verify nonce was marked as used
      expect(mockNonceService.markAsUsed).toHaveBeenCalledWith(validAddress, validNonce)

      // Verify JWT was created
      expect(jwt.sign).toHaveBeenCalledWith(
        { wallet: validAddress.toLowerCase(), role: 'holder' },
        'test-secret-key-for-testing-purposes',
        { expiresIn: '1h' }
      )

      // Verify cookie was set
      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'auth_token',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 3600
        })
      )

      // Verify response
      expect(result).toEqual({
        success: true,
        wallet: validAddress.toLowerCase(),
        role: 'holder'
      })
    })

    it('should reject request with missing fields', async () => {
      mockRequest.body = {
        address: validAddress
        // missing signature and nonce
      }

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(400)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing required fields: address, signature, nonce'
      })
    })

    it('should reject request with non-existent nonce', async () => {
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue(null)

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired nonce'
      })
      expect(mockNonceService.markAsUsed).not.toHaveBeenCalled()
    })

    it('should reject request with already used nonce', async () => {
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: true, // Already used
        createdAt: new Date()
      })

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired nonce'
      })
      expect(mockNonceService.markAsUsed).not.toHaveBeenCalled()
    })

    it('should reject request with invalid signature format', async () => {
      const createdAt = new Date()
      mockRequest.body = {
        address: validAddress,
        signature: 'invalid-signature',
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      // Mock ethers to throw error
      vi.mocked(ethers.utils.verifyMessage).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid signature format'
      })
      expect(mockNonceService.markAsUsed).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should reject request when recovered address does not match', async () => {
      const createdAt = new Date()
      const differentAddress = '0x9999999999999999999999999999999999999999'

      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      // Mock ethers to return different address
      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(differentAddress)

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(401)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid signature or manipulated message'
      })
      expect(mockNonceService.markAsUsed).not.toHaveBeenCalled()
    })

    it('should handle missing JWT_SECRET gracefully', async () => {
      const createdAt = new Date()
      delete process.env.JWT_SECRET

      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(validAddress)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.code).toHaveBeenCalledWith(500)
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Server configuration error'
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith('JWT_SECRET is not configured')

      consoleErrorSpy.mockRestore()
      process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes'
    })

    it('should use correct SIWE message format (EIP-4361)', async () => {
      const createdAt = new Date('2024-01-01T12:00:00Z')
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(validAddress)
      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any)

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      // Verify the SIWE message format
      expect(ethers.utils.verifyMessage).toHaveBeenCalledWith(
        expect.stringContaining('localhost wants you to sign in with your Ethereum account:'),
        validSignature
      )
      expect(ethers.utils.verifyMessage).toHaveBeenCalledWith(
        expect.stringContaining('Quiero autenticarme en Alastria VC Platform'),
        validSignature
      )
      expect(ethers.utils.verifyMessage).toHaveBeenCalledWith(
        expect.stringContaining(`Nonce: ${validNonce}`),
        validSignature
      )
      expect(ethers.utils.verifyMessage).toHaveBeenCalledWith(
        expect.stringContaining('Chain ID: 31337'),
        validSignature
      )
    })

    it('should normalize address to lowercase', async () => {
      const createdAt = new Date()
      const mixedCaseAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'

      mockRequest.body = {
        address: mixedCaseAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: mixedCaseAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(mixedCaseAddress.toUpperCase())
      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any)

      const result = await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(result).toEqual({
        success: true,
        wallet: mixedCaseAddress.toLowerCase(),
        role: 'holder'
      })

      expect(jwt.sign).toHaveBeenCalledWith(
        { wallet: mixedCaseAddress.toLowerCase(), role: 'holder' },
        expect.any(String),
        expect.any(Object)
      )
    })
  })

  describe('logout', () => {
    it('should clear auth cookie and return success', async () => {
      mockRequest.body = {}

      const result = await authController.logout(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/' })
      expect(result).toEqual({ success: true })
    })
  })

  describe('Cookie Options', () => {
    it('should set secure cookie in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const createdAt = new Date()
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(validAddress)
      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any)

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'auth_token',
        'mock-jwt-token',
        expect.objectContaining({
          secure: true, // Should be true in production
          httpOnly: true,
          sameSite: 'strict'
        })
      )

      // Restore environment
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should not set secure cookie in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const createdAt = new Date()
      mockRequest.body = {
        address: validAddress,
        signature: validSignature,
        nonce: validNonce
      }

      mockNonceService.getNonce.mockResolvedValue({
        address: validAddress,
        nonce: validNonce,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        used: false,
        createdAt
      })

      vi.mocked(ethers.utils.verifyMessage).mockReturnValue(validAddress)
      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any)

      await authController.verifySIWA(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      )

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'auth_token',
        'mock-jwt-token',
        expect.objectContaining({
          secure: false, // Should be false in development
          httpOnly: true,
          sameSite: 'strict'
        })
      )

      // Restore environment
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv
      } else {
        delete process.env.NODE_ENV
      }
    })
  })
})
