import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { verifySignedCredential } from '@circuloos/common'
import { Wallet } from 'ethers'
import vpRoutes from '../../src/routes/vp'

// Mock config module to handle trustedIssuers
vi.mock('../../src/config', () => ({
    config: {
        trustedIssuers: ['0xissuer'],
        trustedHolders: []
    }
}))

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual,
        verifySignedCredential: vi.fn()
    }
})

// NO mock ethers (use real implementation for signing/verifying VP)

describe('VP Routes - VC Errors', () => {
    let server: FastifyInstance
    const wallet = Wallet.createRandom()

    beforeEach(async () => {
        server = Fastify({ logger: false })
        server.register(vpRoutes)
        await server.ready()
    })

    afterEach(async () => {
        await server.close()
        vi.restoreAllMocks()
    })

    async function createSignedVP() {
        const domain = {
            name: 'Circuloos VP',
            version: '1',
            chainId: 31337, 
            verifyingContract: '0x0000000000000000000000000000000000000000' 
        }

        const presentation = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            type: ["VerifiablePresentation"],
            verifiableCredential: [{ vc: { id: 'vc1' } }],
            holder: wallet.address,
            issuanceDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + 100000).toISOString()
        }

        const types = {
            Presentation: [
                { name: "holder", type: "address" },
                { name: "verifiableCredential", type: "string" },
                { name: "issuanceDate", type: "string" },
                { name: "expirationDate", type: "string" },
            ],
        }

        const value = {
            holder: presentation.holder,
            verifiableCredential: JSON.stringify(presentation.verifiableCredential),
            issuanceDate: presentation.issuanceDate,
            expirationDate: presentation.expirationDate,
        }

        // ethers v5 _signTypedData (or signTypedData in v6)
        const signature = await wallet._signTypedData(domain, types, value)

        return {
            presentation,
            signature,
            signer: wallet.address,
            domain
        }
    }

    it('returns 401 if VC validation fails in verify-vp', async () => {
        ;(verifySignedCredential as any).mockReturnValue({
            issuer: { ok: false, reason: 'VC signature invalid' }
        })

        const token = await createSignedVP()

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            body: token
        })

        expect(res.statusCode).toBe(401)
        expect(JSON.parse(res.payload).error).toBe('Invalid VC in presentation')
        expect(JSON.parse(res.payload).vcError).toBe('VC signature invalid')
    })

    it('returns 401 if verifySignedCredential throws in verify-vp', async () => {
        ;(verifySignedCredential as any).mockImplementation(() => {
            throw new Error('Critical VC error')
        })

        const token = await createSignedVP()

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            body: token
        })

        expect(res.statusCode).toBe(401)
        expect(JSON.parse(res.payload).error).toBe('Failed to verify VC')
        expect(JSON.parse(res.payload).vcError).toBe('Critical VC error')
    })

    it('returns 401 with string error if verifySignedCredential throws string', async () => {
        ;(verifySignedCredential as any).mockImplementation(() => {
            throw 'String error'
        })

        const token = await createSignedVP()

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            body: token
        })

        expect(res.statusCode).toBe(401)
        expect(JSON.parse(res.payload).vcError).toBe('String error')
    })

    it('returns 401 if VC validation fails in verify-vp/quick', async () => {
        ;(verifySignedCredential as any).mockReturnValue({
            issuer: { ok: false, reason: 'Invalid signature' }
        })

        const signedVP = await createSignedVP()
        const token = Buffer.from(JSON.stringify(signedVP)).toString('base64')

        const res = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(res.statusCode).toBe(401)
        expect(JSON.parse(res.payload).error).toBe('invalid_vc')
    })
})
