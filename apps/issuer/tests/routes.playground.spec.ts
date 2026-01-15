import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'

describe('Playground Routes', () => {
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

    describe('/issue-preview', () => {
        it('creates draft and returns calldata', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-preview',
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0x1234567890123456789012345678901234567890',
                    companyName: 'TestCo'
                }
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(true)
            expect(data.vc).toBeDefined()
            expect(data.vcHash).toBeDefined()
        })

        it('returns calldata when CREDENTIAL_REGISTRY_ADDRESS configured', async () => {
            process.env.CREDENTIAL_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890'
            process.env.RPC_URL = 'http://localhost:8545'

            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-preview',
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0x1234567890123456789012345678901234567890'
                }
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('calldata')
        })
    })

    describe('/issue-anchor', () => {
        it('returns forbidden in production', async () => {
            process.env.NODE_ENV = 'production'
            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: { vc: { id: 'vc-1' } }
            })

            expect(res.statusCode).toBe(403)
        })

        it('returns error when vc missing', async () => {
            process.env.NODE_ENV = 'development'
            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: {}
            })

            expect(res.statusCode).toBe(400)
        })

        it('returns error when registry not configured', async () => {
            process.env.NODE_ENV = 'development'
            delete process.env.CREDENTIAL_REGISTRY_ADDRESS

            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: { vc: { id: 'vc-1', credentialSubject: {} } }
            })

            expect(res.statusCode).toBe(500)
        })
    })
})
