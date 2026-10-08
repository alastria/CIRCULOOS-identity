import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'

// The fixture server exposes an IStorageAdapter (sql.js, decorated as `storage` and the `store`
// alias); the file-store writeAtomic/loadAll API was replaced by saveVC/loadVC/saveIssuance/loadIssuance.
describe('Index.ts VC Routes', () => {
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

    describe('/tmp-filestore/vcs/:id route', () => {
        it('handles .json extension in id', async () => {
            const storage = (server as any).storage
            await storage.saveVC('test', { vc: { id: 'test-vc' } })

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/vcs/test.json'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.vc.id).toBe('test-vc')
        })

        it('logs error when VC load fails', async () => {
            const storage = (server as any).storage
            const originalLoadVC = storage.loadVC

            // Force an error
            storage.loadVC = async (id: string) => {
                if (id.includes('error-vc')) {
                    throw new Error('Forced error')
                }
                return originalLoadVC.call(storage, id)
            }

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/vcs/error-vc'
            })

            expect(res.statusCode).toBe(500)
            expect(JSON.parse(res.payload)).toEqual({ error: 'internal' })
            storage.loadVC = originalLoadVC
        })
    })

    describe('/tmp-filestore/issuances/:id route', () => {
        it('handles .json extension in id', async () => {
            const storage = (server as any).storage
            await storage.saveIssuance('test', { id: 'test-issuance' })

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/issuances/test.json'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.id).toBe('test-issuance')
        })

        it('logs error when issuance load fails', async () => {
            const storage = (server as any).storage
            const originalLoadIssuance = storage.loadIssuance

            storage.loadIssuance = async (id: string) => {
                if (id.includes('error-id')) {
                    throw new Error('Forced error')
                }
                return originalLoadIssuance.call(storage, id)
            }

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/issuances/error-id'
            })

            expect(res.statusCode).toBe(500)
            expect(JSON.parse(res.payload)).toEqual({ error: 'internal' })
            storage.loadIssuance = originalLoadIssuance
        })
    })
})
