import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import vpRoutes from '../../src/routes/vp'

// Mock verifyVPSignature via ethers to pass signature check
vi.mock('ethers', () => ({
    utils: {
        verifyTypedData: vi.fn().mockReturnValue('0x123') // Matches signer
    }
}))

// Mock config to throw error when accessing trustedIssuers
vi.mock('../../src/config', () => ({
    config: {
        get trustedIssuers() {
            throw new Error('Config access error')
        }
    }
}))

describe('VP Routes - Error Coverage', () => {
    let server: FastifyInstance

    beforeEach(async () => {
        server = Fastify({ logger: false })
        server.register(vpRoutes)
        await server.ready()
    })

    afterEach(async () => {
        await server.close()
        vi.restoreAllMocks()
    })

    it('returns 500 on internal error during quick verification', async () => {
        const token = Buffer.from(JSON.stringify({
            presentation: { holder: '0x123', expirationDate: new Date(Date.now() + 10000).toISOString() },
            signer: '0x123',
            signature: '0xsig'
        })).toString('base64')

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(res.statusCode).toBe(500)
        const data = JSON.parse(res.payload)
        expect(data.ok).toBe(false)
        expect(data.error).toBe('internal_error')
    })
})
