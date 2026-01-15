import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import vpRoutes from '../../src/routes/vp'

const MOCK_SIGNER = '0x1234567890123456789012345678901234567890'

// Mock config
vi.mock('../../src/config', () => ({
    config: {
        trustedIssuers: ['0xissuer'],
        trustedHolders: []
    }
}))

// Mock ethers to pass signature check
vi.mock('ethers', () => ({
    utils: {
        verifyTypedData: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890')
    }
}))

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual,
        verifySignedCredential: vi.fn().mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: true, recovered: '0xholder' }
        }),
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

describe('VP Routes - Quick Success', () => {
    let server: FastifyInstance

    beforeEach(async () => {
        server = Fastify({ logger: false })
        server.register(vpRoutes)
        await server.ready()
    })

    afterEach(async () => {
        await server.close()
    })

    it('successfully verifies a valid VP via quick endpoint', async () => {
        const expiration = new Date(Date.now() + 10000).toISOString()
        const vp = {
            presentation: { 
                holder: MOCK_SIGNER, 
                expirationDate: expiration,
                verifiableCredential: [{ vc: { id: '1' } }] 
            },
            signer: MOCK_SIGNER,
            signature: '0xsig'
        }

        const token = Buffer.from(JSON.stringify(vp)).toString('base64')

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(res.statusCode).toBe(200)
        const data = JSON.parse(res.payload)
        expect(data.ok).toBe(true)
        expect(data.holder).toBe(MOCK_SIGNER)
    })

    it('successfully verifies a valid VP without expiration date', async () => {
        const vp = {
            presentation: { 
                holder: MOCK_SIGNER, 
                // No expirationDate
                verifiableCredential: [{ vc: { id: '1' } }] 
            },
            signer: MOCK_SIGNER,
            signature: '0xsig'
        }

        const token = Buffer.from(JSON.stringify(vp)).toString('base64')

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(res.statusCode).toBe(200)
        expect(res.headers['x-vp-valid-until']).toBe('')
    })
})

