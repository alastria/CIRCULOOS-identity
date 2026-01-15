import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual as any,
        loadConfig: () => ({
            storage: { dbPath: ':memory:' },
            email: { host: 'localhost', port: 1025 },
            issuer: { port: 3000 },
            http: { host: 'localhost' },
            nodeEnv: 'test',
            blockchain: { 
                rpcUrl: 'http://localhost:8545',
                chainId: 31337
            },
            swagger: { enabled: false }
        }),
        SqlJsStorageAdapter: class MockStorage {
            constructor() { }
            async init() { }
            async loadVC(id: string) { return this.vcs[id] || null }
            async saveVC(id: string, vc: any) { this.vcs[id] = vc }
            async loadIssuance(id: string) { return this.issuances[id] || null }
            async saveIssuance(id: string, data: any) { this.issuances[id] = data }
            vcs: Record<string, any> = {}
            issuances: Record<string, any> = {}
            get db() { return { exec: () => [] } }
        }
    }
})

vi.mock('../src/services/database', () => ({
    database: {
        saveNonce: vi.fn(),
        getNonce: vi.fn(),
        deleteNonce: vi.fn()
    }
}))

import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'

describe('Issuer Routes Integration', () => {
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

    describe('Health', () => {
        it('returns ok', async () => {
            const res = await server.inject({ method: 'GET', url: '/health' })
            expect(res.statusCode).toBe(200)
            expect(JSON.parse(res.payload)).toEqual({ ok: true })
        })
    })

    describe('VC Storage Routes', () => {
        it('returns error for non-existent issuance', async () => {
            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/issuances/bad-id' })
            expect(res.statusCode).toBe(404)
        })

        it('returns issuance if exists', async () => {
            const storage = (server as any).storage
            await storage.saveIssuance('test-id', { id: 'test-id', data: 'test' })

            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/issuances/test-id' })
            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.id).toBe('test-id')
        })

        it('handles json extension in issuance id', async () => {
            const storage = (server as any).storage
            await storage.saveIssuance('test-id', { id: 'test-id' })

            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/issuances/test-id.json' })
            expect(res.statusCode).toBe(200)
        })

        it('returns VC if exists', async () => {
            const storage = (server as any).storage
            await storage.saveVC('vc-1', { id: 'vc-1' })

            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/vcs/vc-1' })
            expect(res.statusCode).toBe(200)
        })

        it('returns 404 for non-existent VC', async () => {
            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/vcs/bad-vc' })
            expect(res.statusCode).toBe(404)
        })

        it('handles empty object from store as 404', async () => {
            const storage = (server as any).storage
            // SqlJsStorageAdapter doesn't support writing empty objects easily, but we can try to load non-existent
            // await storage.saveVC('empty', {}) 
            // Actually, let's just skip this test or adapt it. SqlJsStorageAdapter returns null if not found.
            // The route returns 404 if loadVC returns null.
            // So requesting a non-existent VC should return 404.
            // This test seems redundant with 'returns 404 for non-existent VC'
            // But let's keep it consistent with the previous behavior if possible.
            // If we save an empty object, loadVC might return it.
            await storage.saveVC('empty', {})
            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/vcs/empty' })
            expect(res.statusCode).toBe(404)
        })

        it('handles errors during VC load', async () => {
            const storage = (server as any).storage
            const originalLoadVC = storage.loadVC.bind(storage)
            storage.loadVC = async (id: string) => {
                if (id.includes('error')) throw new Error('Load error')
                return originalLoadVC(id)
            }

            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/vcs/error-vc' })
            expect(res.statusCode).toBe(500)

            storage.loadVC = originalLoadVC
        })

        it('handles empty issuance object as 404', async () => {
            const storage = (server as any).storage
            await storage.saveIssuance('empty', {})
            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/issuances/empty' })
            expect(res.statusCode).toBe(404)
        })

        it('handles errors during issuance load', async () => {
            const storage = (server as any).storage
            const originalLoadIssuance = storage.loadIssuance.bind(storage)
            storage.loadIssuance = async (id: string) => {
                if (id.includes('error')) throw new Error('Load error')
                return originalLoadIssuance(id)
            }

            const res = await server.inject({ method: 'GET', url: '/tmp-filestore/issuances/error-id' })
            expect(res.statusCode).toBe(500)

            storage.loadIssuance = originalLoadIssuance
        })
    })

    describe('Prepare Error Handling', () => {
        it('handles prepare errors', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: 'test@example.com',
                    holderAddress: 'invalid-address'
                }
            })
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.payload)).toHaveProperty('error')
        })
    })
})
