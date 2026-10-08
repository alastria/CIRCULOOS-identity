import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'
import { config } from '../src/config'

describe('Playground Routes', () => {
    let server: FastifyInstance
    let origEnv: any
    // Playground routes read the typed config (config.nodeEnv / config.diamond.address)
    // instead of process.env.NODE_ENV / CREDENTIAL_REGISTRY_ADDRESS at request time.
    let origNodeEnv: string
    let origDiamond: string | undefined

    beforeEach(async () => {
        origEnv = { ...process.env }
        origNodeEnv = config.nodeEnv
        origDiamond = config.diamond.address
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        server = createTestServer()
        await server.ready()
    })

    afterEach(async () => {
        process.env = origEnv
        ;(config as any).nodeEnv = origNodeEnv
        ;(config.diamond as any).address = origDiamond
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
            ;(config as any).nodeEnv = 'production'
            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: { vc: { id: 'vc-1' } }
            })

            expect(res.statusCode).toBe(403)
            expect(JSON.parse(res.payload)).toEqual({ error: 'forbidden' })
        })

        it('returns error when vc missing', async () => {
            ;(config as any).nodeEnv = 'development'
            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: {}
            })

            expect(res.statusCode).toBe(400)
        })

        it('returns error when registry not configured', async () => {
            ;(config as any).nodeEnv = 'development'
            ;(config.diamond as any).address = undefined

            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: { vc: { id: 'vc-1', credentialSubject: {} } }
            })

            expect(res.statusCode).toBe(500)
        })
    })
})
