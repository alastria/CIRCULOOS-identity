import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'

describe('Playground Error Paths', () => {
    let server: FastifyInstance
    let origEnv: any

    beforeEach(async () => {
        origEnv = { ...process.env }
        server = createTestServer()
        await server.ready()
    })

    afterEach(async () => {
        process.env = origEnv
        await server.close()
    })

    describe('/issue-preview errors', () => {
        it('logs warning when calldata population fails', async () => {
            process.env.CREDENTIAL_REGISTRY_ADDRESS = 'invalid-address'
            process.env.RPC_URL = 'http://invalid-rpc-endpoint'

            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-preview',
                payload: {
                    email: 'test@example.com',
                    holderAddress: '0x1234567890123456789012345678901234567890'
                }
            })

            // Should still return 200 with calldata = null
            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.calldata).toBeNull()
        })
    })

    describe('/issue-anchor errors', () => {
        it('handles transaction failure gracefully', async () => {
            process.env.NODE_ENV = 'development'
            process.env.CREDENTIAL_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890'
            process.env.RPC_URL = 'http://localhost:9999' // Non-existent RPC
            process.env.ISSUER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

            const res = await server.inject({
                method: 'POST',
                url: '/playground/issue-anchor',
                payload: {
                    vc: {
                        id: 'vc-test',
                        credentialSubject: {
                            holderAddress: '0x1234567890123456789012345678901234567890'
                        }
                    }
                }
            })

            expect(res.statusCode).toBe(500)
            expect(JSON.parse(res.payload)).toHaveProperty('error')
        })
    })
})
