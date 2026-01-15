import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import issuersRoutes from '../../src/routes/issuers'
import { MockBuilder } from '../helpers/mock-builder.helper'

describe('Issuers Route', () => {
    let server: any
    let mockRegistry: any
    let mockSqlStore: any

    beforeEach(async () => {
        server = Fastify()
        mockRegistry = MockBuilder.trustedIssuerRegistryService()
        mockSqlStore = {
            listIssuers: vi.fn()
        }

        server.decorate('trustedIssuerRegistry', mockRegistry)
        server.decorate('sqlIssuerStore', mockSqlStore)

        await server.register(issuersRoutes, { prefix: '/issuers' })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('lists issuers from registry', async () => {
        const mockIssuers = [{ address: '0xissuer' }]
        mockRegistry.listIssuers.mockResolvedValue(mockIssuers)

        const response = await server.inject({
            method: 'GET',
            url: '/issuers'
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.ok).toBe(true)
        expect(body.issuers).toHaveLength(1)
        expect(body.issuers[0].address).toBe('0xissuer')
    })

    it('handles errors gracefully', async () => {
        mockRegistry.listIssuers.mockRejectedValue(new Error('Failed'))

        const response = await server.inject({
            method: 'GET',
            url: '/issuers'
        })

        expect(response.statusCode).toBe(500)
        expect(JSON.parse(response.payload).error).toBe('Internal Server Error')
    })

    it('returns db status when SQL store is available', async () => {
        mockSqlStore.list = vi.fn().mockReturnValue([{ address: '0xissuer1' }, { address: '0xissuer2' }])
        mockSqlStore.db = { name: '/tmp/test.db' }
        mockRegistry.sqlStore = mockSqlStore

        const response = await server.inject({
            method: 'GET',
            url: '/issuers/db-status'
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.ok).toBe(true)
        expect(body.db).toBe(true)
        expect(body.rows).toBe(2)
    })

    it('returns db false when SQL store is not available', async () => {
        mockRegistry.sqlStore = null

        const response = await server.inject({
            method: 'GET',
            url: '/issuers/db-status'
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.ok).toBe(true)
        expect(body.db).toBe(false)
    })

    it('refreshes issuers with force flag', async () => {
        mockRegistry.sync = vi.fn().mockResolvedValue(undefined)
        mockRegistry.listIssuers.mockResolvedValue([{ address: '0xrefreshed' }])

        const response = await server.inject({
            method: 'POST',
            url: '/issuers/refresh?force=true'
        })

        expect(response.statusCode).toBe(200)
        expect(mockRegistry.sync).toHaveBeenCalledWith(0)
        const body = JSON.parse(response.payload)
        expect(body.ok).toBe(true)
        expect(body.issuers).toHaveLength(1)
    })

    it('refreshes issuers with fromBlock parameter', async () => {
        mockRegistry.sync = vi.fn().mockResolvedValue(undefined)
        mockRegistry.listIssuers.mockResolvedValue([])

        const response = await server.inject({
            method: 'POST',
            url: '/issuers/refresh?fromBlock=100'
        })

        expect(response.statusCode).toBe(200)
        expect(mockRegistry.sync).toHaveBeenCalledWith(100)
    })

    it('returns 503 when registry not configured for refresh', async () => {
        const freshServer = Fastify()
        freshServer.decorate('trustedIssuerRegistry', null)
        await freshServer.register(issuersRoutes, { prefix: '/issuers' })

        const response = await freshServer.inject({
            method: 'POST',
            url: '/issuers/refresh'
        })

        expect(response.statusCode).toBe(503)
    })

    it('handles SQL store error gracefully in db-status', async () => {
        mockSqlStore.list = vi.fn().mockImplementation(() => {
            throw new Error('SQL error')
        })
        mockRegistry.sqlStore = mockSqlStore

        const response = await server.inject({
            method: 'GET',
            url: '/issuers/db-status'
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.payload).db).toBe(false)
    })
})
