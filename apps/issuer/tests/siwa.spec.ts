import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fastify from 'fastify'
import { Wallet } from 'ethers'
import cookie from '@fastify/cookie'
import { NonceService } from '../src/services/nonce.service'
import { AuthController } from '../src/controllers/authController'
import { IssueController } from '../src/controllers/issueController'
import { SqlJsStorageAdapter } from '@circuloos/common'
import authRoutes from '../src/routes/auth'
import credentialsRoutes from '../src/routes/credentials'
import { authenticateJWT } from '../src/middleware/auth.middleware'

// Mock dependencies
const storage = new SqlJsStorageAdapter(':memory:')
const nonceService = new NonceService(storage)
const authController = new AuthController(nonceService, storage)
const mockIssuanceRepository = {
    listIssuances: async () => ({ issuances: [], total: 0 })
} as any

const issueController = new IssueController(
    {} as any, // issuanceService
    {} as any, // authService
    {} as any, // pdfService
    mockIssuanceRepository, // issuanceRepository
    storage,
    undefined,
    nonceService
)

describe('SIWA Authentication Flow', () => {
    let server: any
    let wallet: Wallet
    let authToken: string

    beforeAll(async () => {
        process.env.JWT_SECRET = 'test-secret'
        process.env.DOMAIN = 'localhost'
        process.env.CHAIN_ID = '2020'

        server = fastify()
        server.register(cookie, { secret: 'test-secret' })

        // Register auth routes
        server.register(authRoutes, {
            prefix: '/auth',
            issueController,
            authController
        })

        // Register credentials routes for list test
        server.register(credentialsRoutes, {
            prefix: '/credentials',
            issueController
        })

        await server.ready()
        wallet = Wallet.createRandom()
    })

    afterAll(async () => {
        await server.close()
    })

    it('should generate a nonce with issuedAt', async () => {
        const response = await server.inject({
            method: 'GET',
            url: `/auth/challenge/${wallet.address}`
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.nonce).toBeDefined()
        expect(body.issuedAt).toBeDefined()
    })

    it('should verify SIWA signature and set cookie', async () => {
        // 1. Get Challenge
        const challengeRes = await server.inject({
            method: 'GET',
            url: `/auth/challenge/${wallet.address}`
        })
        const { nonce, issuedAt } = JSON.parse(challengeRes.body)

        // 2. Sign Message
        const domain = 'localhost'
        const chainId = '2020'
        const siweMessage = `${domain} wants you to sign in with your Ethereum account:
${wallet.address}

Quiero autenticarme en Alastria VC Platform

URI: https://${domain}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`

        const signature = await wallet.signMessage(siweMessage)

        // 3. Verify
        const verifyRes = await server.inject({
            method: 'POST',
            url: '/auth/verify',
            payload: {
                address: wallet.address,
                signature,
                nonce
            }
        })

        expect(verifyRes.statusCode).toBe(200)
        expect(verifyRes.headers['set-cookie']).toBeDefined()

        const setCookie = verifyRes.headers['set-cookie']
        const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie

        expect(cookieHeader).toContain('auth_token=')
        expect(cookieHeader).toContain('HttpOnly')

        // Extract token for next tests
        authToken = cookieHeader.split(';')[0].split('=')[1]
    })

    it('should reject access to protected route without cookie', async () => {
        const response = await server.inject({
            method: 'GET',
            url: '/credentials'
        })

        expect(response.statusCode).toBe(401)
    })

    it('should allow access to protected route with cookie', async () => {
        console.log('Using authToken:', authToken)
        const response = await server.inject({
            method: 'GET',
            url: '/credentials',
            cookies: {
                auth_token: authToken
            }
        })

        console.log('Protected route response:', response.statusCode, response.body)
        expect(response.statusCode).toBe(200)
    })
})
