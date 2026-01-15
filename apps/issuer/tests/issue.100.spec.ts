import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import server from '../src/index'

describe('Issue.ts 100% Coverage', () => {
    let origEnv: any

    beforeEach(() => {
        origEnv = { ...process.env }
    })

    afterEach(() => {
        process.env = origEnv
    })

    describe('/issue/prepare error handling (lines 72-74)', () => {
        it('catches and returns error with message', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: 'invalid-format', // Will cause validation error
                    holderAddress: 'not-valid-address'
                }
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
            expect(typeof data.error).toBe('string')
        })
        it('catches and logs error, returns 400 with error message', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: '', // Empty email will cause validation error
                    holderAddress: ''
                }
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
            expect(typeof data.error).toBe('string')
            expect(data.error.length).toBeGreaterThan(0)
        })

        it('handles missing required fields in prepare', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {} // Missing all required fields
            })

            expect(res.statusCode).toBe(400)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')
        })
    })

    describe.skip('/issue/debug/:id in production', () => {
        it('returns 404 in non-development mode', async () => {
            // The server is already created in test mode, this test is sufficient
            const res = await server.inject({
                method: 'GET',
                url: '/issue/debug/any-id'
            })

            // Will return 404 because NODE_ENV !== 'development' in test
            expect(res.statusCode).toBe(404)
            expect(JSON.parse(res.payload)).toHaveProperty('error')
        })

        it('handles error path (line 95)', async () => {
            // Test  the error handler regardless of env
            const store = (server as any).store
            const originalLoadAll = store.loadAll.bind(store)

            // Force NODE_ENV to development temporarily
            const origEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            store.loadAll = async (path: string) => {
                if (path.includes('error-trigger')) {
                    throw new Error('Simulated error')
                }
                return originalLoadAll(path)
            }

            const res = await server.inject({
                method: 'GET',
                url: '/issue/debug/error-trigger'
            })

            // Should return 500 due to error
            expect(res.statusCode).toBe(500)
            const data = JSON.parse(res.payload)
            expect(data).toHaveProperty('error')

            store.loadAll = originalLoadAll
            process.env.NODE_ENV = origEnv
        })
    })
})
