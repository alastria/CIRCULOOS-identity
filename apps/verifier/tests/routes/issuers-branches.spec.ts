import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import issuersRoutes from '../../src/routes/issuers'

/**
 * Target uncovered branches in issuers.ts:
 * - Line 8: when svc is not configured
 * - Line 13: when sqlStore exists with db.name
 * - Line 46: query processing with undefined request.query
 */

describe('Issuers Routes - Branch Coverage', () => {
    describe('when trustedIssuerRegistry is not configured', () => {
        let server: FastifyInstance

        beforeEach(async () => {
            server = Fastify({ logger: false })
            // DO NOT decorate with trustedIssuerRegistry - line 8 branch
            server.register(issuersRoutes, { prefix: '/issuers' })
            await server.ready()
        })

        afterEach(async () => {
            await server.close()
        })

        it('covers line 8: returns 503 when service not configured on /db-status', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issuers/db-status'
            })

            expect(res.statusCode).toBe(503)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(false)
            expect(data.error).toBe('trusted registry service not configured')
        })

        it('returns 503 when service not configured on /', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issuers/'
            })

            expect(res.statusCode).toBe(503)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(false)
            expect(data.error).toBe('trusted registry service not configured')
        })

        it('returns 503 when service not configured on /refresh', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh'
            })

            expect(res.statusCode).toBe(503)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(false)
            expect(data.error).toBe('trusted registry service not configured')
        })
    })

    describe('when trustedIssuerRegistry has sqlStore with db.name', () => {
        let server: FastifyInstance
        let mockService: any

        beforeEach(async () => {
            server = Fastify({ logger: false })

            // Create mock service with sqlStore and db.name to cover line 13
            mockService = {
                sqlStore: {
                    list: vi.fn().mockReturnValue([
                        { address: '0x123', name: 'Test Issuer' },
                        { address: '0x456', name: 'Another Issuer' }
                    ]),
                    db: {
                        name: '/path/to/test.db'
                    }
                },
                listIssuers: vi.fn().mockResolvedValue([]),
                sync: vi.fn().mockResolvedValue(undefined)
            }

            server.decorate('trustedIssuerRegistry', mockService)
            server.register(issuersRoutes, { prefix: '/issuers' })
            await server.ready()
        })

        afterEach(async () => {
            await server.close()
        })

        it('covers line 13: returns db info when sqlStore has db.name', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issuers/db-status'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(true)
            expect(data.db).toBe(true)
            expect(data.path).toBe('/path/to/test.db')
            expect(data.rows).toBe(2)
            expect(mockService.sqlStore.list).toHaveBeenCalledWith(true)
        })
    })

    describe('when sqlStore exists but db is null', () => {
        let server: FastifyInstance
        let mockService: any

        beforeEach(async () => {
            server = Fastify({ logger: false })

            // Create mock service with sqlStore but no db.name (optional chaining branch)
            mockService = {
                sqlStore: {
                    list: vi.fn().mockReturnValue([
                        { address: '0xabc', name: 'Issuer' }
                    ]),
                    db: null  // No db.name
                },
                listIssuers: vi.fn().mockResolvedValue([]),
                sync: vi.fn().mockResolvedValue(undefined)
            }

            server.decorate('trustedIssuerRegistry', mockService)
            server.register(issuersRoutes, { prefix: '/issuers' })
            await server.ready()
        })

        afterEach(async () => {
            await server.close()
        })

        it('returns db info with null path when db is not available', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issuers/db-status'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(true)
            expect(data.db).toBe(true)
            expect(data.path).toBe(null)
            expect(data.rows).toBe(1)
        })
    })

    describe('refresh endpoint query processing', () => {
        let server: FastifyInstance
        let mockService: any

        beforeEach(async () => {
            server = Fastify({ logger: false })

            mockService = {
                listIssuers: vi.fn().mockResolvedValue([{ address: '0x123' }]),
                sync: vi.fn().mockResolvedValue(undefined)
            }

            server.decorate('trustedIssuerRegistry', mockService)
            server.register(issuersRoutes, { prefix: '/issuers' })
            await server.ready()
        })

        afterEach(async () => {
            await server.close()
        })

        it('covers line 46-48: handles request with no query params', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh'
            })

            expect(res.statusCode).toBe(200)
            expect(mockService.sync).toHaveBeenCalledWith(undefined)
        })

        it('handles request with fromBlock query param', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh?fromBlock=100'
            })

            expect(res.statusCode).toBe(200)
            expect(mockService.sync).toHaveBeenCalledWith(100)
        })

        it('handles request with force=true query param', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh?force=true'
            })

            expect(res.statusCode).toBe(200)
            expect(mockService.sync).toHaveBeenCalledWith(0)
        })

        it('handles request with force=1 query param', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh?force=1'
            })

            expect(res.statusCode).toBe(200)
            expect(mockService.sync).toHaveBeenCalledWith(0)
        })

        it('handles request with both fromBlock and force params (force takes precedence)', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issuers/refresh?fromBlock=50&force=true'
            })

            expect(res.statusCode).toBe(200)
            expect(mockService.sync).toHaveBeenCalledWith(0)
        })
    })

    describe('when sqlStore.list throws an error', () => {
        let server: FastifyInstance
        let mockService: any

        beforeEach(async () => {
            server = Fastify({ logger: false })

            mockService = {
                sqlStore: {
                    list: vi.fn().mockImplementation(() => {
                        throw new Error('SQL error')
                    }),
                    db: { name: '/test.db' }
                },
                listIssuers: vi.fn().mockResolvedValue([]),
                sync: vi.fn().mockResolvedValue(undefined)
            }

            server.decorate('trustedIssuerRegistry', mockService)
            server.register(issuersRoutes, { prefix: '/issuers' })
            await server.ready()
        })

        afterEach(async () => {
            await server.close()
        })

        it('catches error and returns db: false', async () => {
            const res = await server.inject({
                method: 'GET',
                url: '/issuers/db-status'
            })

            expect(res.statusCode).toBe(200)
            const data = JSON.parse(res.payload)
            expect(data.ok).toBe(true)
            expect(data.db).toBe(false)
        })
    })
})
