import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { ethers } from 'ethers'
import jwt from 'jsonwebtoken'

describe('Issuance Flow with Authentication', () => {
  let app: FastifyInstance
  let testWallet: ethers.Wallet
  let authToken: string
  let mockStorage: any
  let mockNonceService: any
  let mockIssuanceService: any

  beforeEach(async () => {
    testWallet = ethers.Wallet.createRandom()

    // Set up environment
    process.env.JWT_SECRET = 'test-jwt-secret-for-issuance-integration'
    process.env.DOMAIN = 'localhost'
    process.env.CHAIN_ID = '31337'
    process.env.NODE_ENV = 'test'

    // Generate auth token for testing
    authToken = jwt.sign(
      { wallet: testWallet.address.toLowerCase(), role: 'holder' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    // Mock services
    mockStorage = {
      loadIssuance: vi.fn(),
      saveIssuance: vi.fn(),
      loadVC: vi.fn(),
      saveVC: vi.fn(),
      listIssuances: vi.fn().mockResolvedValue([])
    }

    mockNonceService = {
      generateNonce: vi.fn(),
      getNonce: vi.fn(),
      markAsUsed: vi.fn()
    }

    mockIssuanceService = {
      prepare: vi.fn(),
      mint: vi.fn(),
      finalize: vi.fn(),
      getCredential: vi.fn(),
      listIssuances: vi.fn(),
      generatePDF: vi.fn()
    }

    // Create Fastify app
    app = Fastify()
    await app.register(cookie, {
      secret: process.env.JWT_SECRET,
      parseOptions: {}
    })

    // Import middleware
    const { authenticateJWT, verifyOwnership } = await import('../src/middleware/auth.middleware')

    // Register routes (simplified for testing)
    app.post('/issue/prepare', {
      preHandler: authenticateJWT
    }, async (request: any, reply) => {
      const { email, holderAddress } = request.body
      const userWallet = request.user?.wallet

      // Verify user is requesting credential for themselves
      if (holderAddress.toLowerCase() !== userWallet?.toLowerCase()) {
        return reply.code(403).send({ error: 'Can only request credentials for your own wallet' })
      }

      const result = await mockIssuanceService.prepare(email, holderAddress)
      return result
    })

    app.get('/issue/credentials/:id', {
      preHandler: authenticateJWT
    }, async (request: any, reply) => {
      const { id } = request.params
      const userWallet = request.user?.wallet

      const credential = await mockIssuanceService.getCredential(id)

      if (!credential) {
        return reply.code(404).send({ error: 'Credential not found' })
      }

      // Verify ownership
      if (credential.holderAddress.toLowerCase() !== userWallet?.toLowerCase()) {
        return reply.code(403).send({ error: 'Access denied: Not your credential' })
      }

      return credential
    })

    app.get('/issue/list', {
      preHandler: authenticateJWT
    }, async (request: any, reply) => {
      const userWallet = request.user?.wallet
      const credentials = await mockIssuanceService.listIssuances(userWallet)
      return { credentials }
    })

    app.get('/issue/pdf/:id', {
      preHandler: authenticateJWT
    }, async (request: any, reply) => {
      const { id } = request.params
      const userWallet = request.user?.wallet

      const credential = await mockIssuanceService.getCredential(id)

      if (!credential) {
        return reply.code(404).send({ error: 'Credential not found' })
      }

      // Verify ownership
      if (credential.holderAddress.toLowerCase() !== userWallet?.toLowerCase()) {
        return reply.code(403).send({ error: 'Access denied: Not your credential' })
      }

      const pdf = await mockIssuanceService.generatePDF(id)
      reply.type('application/pdf')
      return pdf
    })

    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  describe('Prepare Credential', () => {
    it('should allow authenticated user to prepare credential for themselves', async () => {
      mockIssuanceService.prepare.mockResolvedValue({
        id: 'issuance_123',
        token: 'session-token',
        otp: '123456',
        expiresAt: Date.now() + 3600000,
        holderAddress: testWallet.address,
        draftVc: { id: 'vc_123' }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/issue/prepare',
        cookies: {
          auth_token: authToken
        },
        payload: {
          email: 'test@example.com',
          holderAddress: testWallet.address
        }
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.id).toBe('issuance_123')
      expect(mockIssuanceService.prepare).toHaveBeenCalledWith(
        'test@example.com',
        testWallet.address
      )
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/issue/prepare',
        payload: {
          email: 'test@example.com',
          holderAddress: testWallet.address
        }
      })

      expect(response.statusCode).toBe(401)
      expect(mockIssuanceService.prepare).not.toHaveBeenCalled()
    })

    it('should prevent user from requesting credential for another wallet', async () => {
      const otherWallet = ethers.Wallet.createRandom()

      const response = await app.inject({
        method: 'POST',
        url: '/issue/prepare',
        cookies: {
          auth_token: authToken
        },
        payload: {
          email: 'test@example.com',
          holderAddress: otherWallet.address // Different wallet!
        }
      })

      expect(response.statusCode).toBe(403)
      const result = JSON.parse(response.body)
      expect(result.error).toBe('Can only request credentials for your own wallet')
      expect(mockIssuanceService.prepare).not.toHaveBeenCalled()
    })
  })

  describe('Get Credential', () => {
    it('should allow user to get their own credential', async () => {
      const credentialId = 'cred_123'
      mockIssuanceService.getCredential.mockResolvedValue({
        id: credentialId,
        holderAddress: testWallet.address,
        status: 'ISSUED',
        vc: { id: 'vc_123' }
      })

      const response = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${credentialId}`,
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.id).toBe(credentialId)
    })

    it('should prevent user from accessing another users credential', async () => {
      const otherWallet = ethers.Wallet.createRandom()
      const credentialId = 'cred_123'

      mockIssuanceService.getCredential.mockResolvedValue({
        id: credentialId,
        holderAddress: otherWallet.address, // Belongs to different user
        status: 'ISSUED',
        vc: { id: 'vc_123' }
      })

      const response = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${credentialId}`,
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(403)
      const result = JSON.parse(response.body)
      expect(result.error).toBe('Access denied: Not your credential')
    })

    it('should return 404 for non-existent credential', async () => {
      mockIssuanceService.getCredential.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/issue/credentials/nonexistent',
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/issue/credentials/cred_123'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('List Credentials', () => {
    it('should return only users own credentials', async () => {
      const userCredentials = [
        { id: 'cred_1', holderAddress: testWallet.address },
        { id: 'cred_2', holderAddress: testWallet.address }
      ]

      mockIssuanceService.listIssuances.mockResolvedValue(userCredentials)

      const response = await app.inject({
        method: 'GET',
        url: '/issue/list',
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.body)
      expect(result.credentials).toHaveLength(2)
      expect(mockIssuanceService.listIssuances).toHaveBeenCalledWith(
        testWallet.address.toLowerCase()
      )
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/issue/list'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PDF Generation', () => {
    it('should allow user to download PDF of their credential', async () => {
      const credentialId = 'cred_123'
      const mockPDF = Buffer.from('PDF content')

      mockIssuanceService.getCredential.mockResolvedValue({
        id: credentialId,
        holderAddress: testWallet.address,
        status: 'CLAIMED'
      })

      mockIssuanceService.generatePDF.mockResolvedValue(mockPDF)

      const response = await app.inject({
        method: 'GET',
        url: `/issue/pdf/${credentialId}`,
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('application/pdf')
      expect(response.rawPayload).toEqual(mockPDF)
    })

    it('should prevent user from downloading another users PDF', async () => {
      const otherWallet = ethers.Wallet.createRandom()
      const credentialId = 'cred_123'

      mockIssuanceService.getCredential.mockResolvedValue({
        id: credentialId,
        holderAddress: otherWallet.address, // Different user
        status: 'CLAIMED'
      })

      const response = await app.inject({
        method: 'GET',
        url: `/issue/pdf/${credentialId}`,
        cookies: {
          auth_token: authToken
        }
      })

      expect(response.statusCode).toBe(403)
      expect(mockIssuanceService.generatePDF).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated PDF download requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/issue/pdf/cred_123'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('Multi-User Isolation', () => {
    it('should ensure users can only access their own resources', async () => {
      const user1 = ethers.Wallet.createRandom()
      const user2 = ethers.Wallet.createRandom()

      const token1 = jwt.sign(
        { wallet: user1.address.toLowerCase(), role: 'holder' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      )

      const token2 = jwt.sign(
        { wallet: user2.address.toLowerCase(), role: 'holder' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      )

      // User 1 credential
      const cred1 = {
        id: 'cred_user1',
        holderAddress: user1.address,
        status: 'ISSUED'
      }

      // User 2 credential
      const cred2 = {
        id: 'cred_user2',
        holderAddress: user2.address,
        status: 'ISSUED'
      }

      // User 1 tries to access their own credential - SUCCESS
      mockIssuanceService.getCredential.mockResolvedValue(cred1)
      const response1 = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${cred1.id}`,
        cookies: { auth_token: token1 }
      })
      expect(response1.statusCode).toBe(200)

      // User 1 tries to access User 2's credential - DENIED
      mockIssuanceService.getCredential.mockResolvedValue(cred2)
      const response2 = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${cred2.id}`,
        cookies: { auth_token: token1 }
      })
      expect(response2.statusCode).toBe(403)

      // User 2 tries to access their own credential - SUCCESS
      const response3 = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${cred2.id}`,
        cookies: { auth_token: token2 }
      })
      expect(response3.statusCode).toBe(200)
    })
  })

  describe('Session Expiry', () => {
    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { wallet: testWallet.address.toLowerCase(), role: 'holder' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' } // Already expired
      )

      const response = await app.inject({
        method: 'GET',
        url: '/issue/list',
        cookies: {
          auth_token: expiredToken
        }
      })

      expect(response.statusCode).toBe(401)
      const result = JSON.parse(response.body)
      expect(result.error).toBe('Session expired or invalid')
    })
  })

  describe('Role-Based Access (Future)', () => {
    it('should support issuer role for administrative functions', async () => {
      const issuerWallet = ethers.Wallet.createRandom()
      const issuerToken = jwt.sign(
        { wallet: issuerWallet.address.toLowerCase(), role: 'issuer' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      )

      // An issuer might be able to prepare credentials for others
      // This is a placeholder for future role-based functionality
      const response = await app.inject({
        method: 'POST',
        url: '/issue/prepare',
        cookies: {
          auth_token: issuerToken
        },
        payload: {
          email: 'holder@example.com',
          holderAddress: testWallet.address // Different from issuer
        }
      })

      // Currently would be denied, but could be allowed for issuer role
      expect(response.statusCode).toBe(403)
    })
  })

  describe('Security Edge Cases', () => {
    it('should normalize addresses for case-insensitive comparison', async () => {
      const mixedCaseAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'
      const credential = {
        id: 'cred_123',
        holderAddress: mixedCaseAddress.toUpperCase(),
        status: 'ISSUED'
      }

      const tokenMixedCase = jwt.sign(
        { wallet: mixedCaseAddress.toLowerCase(), role: 'holder' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      )

      mockIssuanceService.getCredential.mockResolvedValue(credential)

      const response = await app.inject({
        method: 'GET',
        url: `/issue/credentials/${credential.id}`,
        cookies: {
          auth_token: tokenMixedCase
        }
      })

      expect(response.statusCode).toBe(200)
    })

    it('should handle malformed JWT gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/issue/list',
        cookies: {
          auth_token: 'not.a.valid.jwt.token'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
