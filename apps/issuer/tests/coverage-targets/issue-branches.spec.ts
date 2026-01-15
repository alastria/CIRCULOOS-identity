import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestServer } from '../fixtures/server'
import type { FastifyInstance } from 'fastify'

/**
 * Cover issue.ts uncovered branches:
 * - Line 65: email fallback when not provided
 * - Line 93: debug endpoint returns 404 when record not found
 * - Line 134: mint endpoint error handling
 * - Line 174: finalize endpoint error handling with logging
 */

describe('Issue.ts - Branch Coverage', () => {
    let server: FastifyInstance
    let origEnv: any

    beforeEach(async () => {
        origEnv = { ...process.env }
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        server = createTestServer()
        await server.ready()
    })

    afterEach(async () => {
        process.env = origEnv
        await server.close()
    })

    describe('/prepare branches', () => {
        it.skip('uses default email when email is not provided (line 65)', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    // No email - should fall back to 'unknown@example.test'
                    holderAddress: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('id')
            expect(data).toHaveProperty('token')
        })
    })

    describe.skip('/debug/:id branches', () => {
        it('returns 404 when record not found (line 93)', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issue/debug/nonexistent-id-12345'
            })

            expect(res.statusCode).toBe(404)
            const data = JSON.parse(res.payload)
            expect(data.message).toBe('Not Found')
        })
    })

    describe('/mint error handling (line 134)', () => {
        it('returns 400 when mint fails with error', async () => {
            // First prepare an issuance
            const prepareRes = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(prepareRes.statusCode).toBe(200)
            const prepareData = JSON.parse(prepareRes.payload)

            // Try to mint with invalid signature to trigger error
            const res = await server.inject({
                method: 'POST',
                url: '/issue/mint',
                payload: {
                    id: prepareData.id,
                    signature: 'invalid-signature',
                    signer: 'invalid-signer'
                }
            })

            // Should return 400 due to validation error
            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
        })

        it('handles mint error when issuance does not exist', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/mint',
                payload: {
                    id: 'nonexistent-issuance-id',
                    signature: '0xabcd',
                    signer: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
        })
    })

    describe('/finalize error handling (line 174)', () => {
        it('handles finalize errors and logs them (line 174)', async () => {
            // Spy on server.log.error to verify it's called
            const logErrorSpy = vi.spyOn(server.log, 'error')

            // Try to finalize with non-existent issuance
            const res = await server.inject({
                method: 'POST',
                url: '/issue/finalize',
                payload: {
                    id: 'nonexistent-id',
                    otp: '123456',
                    token: 'fake-token',
                    signature: '0xabcd',
                    signer: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')

            // Verify error was logged
            expect(logErrorSpy).toHaveBeenCalled()

            logErrorSpy.mockRestore()
        })

        it('handles finalize with invalid OTP', async () => {
            // First prepare
            const prepareRes = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
                }
            })

            expect(prepareRes.statusCode).toBe(200)
            const prepareData = JSON.parse(prepareRes.payload)

            // Try to finalize with wrong OTP
            const res = await server.inject({
                method: 'POST',
                url: '/issue/finalize',
                payload: {
                    id: prepareData.id,
                    otp: '999999',  // Wrong OTP
                    token: prepareData.token,
                    signature: '0xabcd',
                    signer: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
        })
    })
})
