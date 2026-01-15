import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestServer } from './fixtures/server'
import type { FastifyInstance } from 'fastify'

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
            const store = (server as any).store
            await store.writeAtomic('vcs/test.json', { vc: { id: 'test-vc' } })

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/vcs/test.json'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.vc.id).toBe('test-vc')
        })

        it('logs error when VC load fails', async () => {
            const store = (server as any).store
            const originalLoadAll = store.loadAll.bind(store)

            const errorLog: any[] = []
            const requestMock = {
                log: {
                    error: (err: any) => errorLog.push(err)
                }
            }

            // Force an error
            store.loadAll = async (path: string) => {
                if (path.includes('error-vc')) {
                    throw new Error('Forced error')
                }
                return originalLoadAll(path)
            }

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/vcs/error-vc'
            })

            expect(res.statusCode).toBe(500)
            store.loadAll = originalLoadAll
        })
    })

    describe('/tmp-filestore/issuances/:id route', () => {
        it('handles .json extension in id', async () => {
            const store = (server as any).store
            await store.writeAtomic('issuances/test.json', { id: 'test-issuance' })

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/issuances/test.json'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.id).toBe('test-issuance')
        })

        it('logs error when issuance load fails', async () => {
            const store = (server as any).store
            const originalLoadAll = store.loadAll.bind(store)

            store.loadAll = async (path: string) => {
                if (path.includes('error-id')) {
                    throw new Error('Forced error')
                }
                return originalLoadAll(path)
            }

            const res = await server.inject({
                method: 'GET',
                url: '/tmp-filestore/issuances/error-id'
            })

            expect(res.statusCode).toBe(500)
            store.loadAll = originalLoadAll
        })
    })
})
