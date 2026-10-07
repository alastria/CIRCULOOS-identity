import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestServer } from '../fixtures/server'
import type { FastifyInstance } from 'fastify'
import { authCookies } from '../helpers/auth-cookie.helper'

/**
 * Surgical tests to cover exact remaining lines in issue.ts
 * Lines 72-74: error logging in prepare route
 */

describe('Issue Routes - Final Coverage', () => {
    let server: FastifyInstance
    let origEnv: NodeJS.ProcessEnv

    beforeEach(async () => {
        origEnv = { ...process.env }
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        server = createTestServer()
        await server.ready()
    })

    afterEach(async () => {
        process.env = origEnv
        await server.close()
        vi.restoreAllMocks()
    })

    describe('Lines 72-74: error logging in /prepare', () => {
        it('logs error via server.log.error when prepare fails', async () => {
            const logErrorSpy = vi.spyOn(server.log, 'error')

            // Mock storage.saveIssuance (IStorageAdapter; was FileStore.writeAtomic) to throw during prepare
            const storage = (server as any).storage
            const originalSaveIssuance = storage.saveIssuance
            storage.saveIssuance = vi.fn().mockRejectedValue(new Error('Storage failure'))

            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                // /issue/prepare is behind authenticateJWT
                cookies: authCookies('0x9999999999999999999999999999999999999999', 'issuer'),
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0x1234567890123456789012345678901234567890'
                }
            })

            // Restore original
            expect(storage.saveIssuance).toHaveBeenCalled()
            storage.saveIssuance = originalSaveIssuance

            expect(res.statusCode).toBe(400)

            // Verify server.log.error was called (line 72)
            expect(logErrorSpy).toHaveBeenCalled()

            // Verify error message is returned (line 73)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('Storage failure')
        })

    })
})
