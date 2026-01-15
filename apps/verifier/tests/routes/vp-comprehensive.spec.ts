import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import vpRoutes from '../../src/routes/vp'
import { CredentialsFixture } from '../fixtures/credentials.fixture'

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    return {
        ...actual,
        verifySignedCredential: vi.fn().mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true, recovered: '0xholder' }
        })
    }
})

// Mock ethers
vi.mock('ethers', () => {
    return {
        utils: {
            verifyTypedData: vi.fn().mockReturnValue('0xholder')
        }
    }
})

// Mock config
vi.mock('../../src/config', () => ({
    config: {
        trustedIssuers: []
    }
}))

import { verifySignedCredential } from '@circuloos/common'
import { utils } from 'ethers'

describe('VP Route - VC Verification Loop Coverage', () => {
    let server: any

    beforeEach(async () => {
        server = Fastify()
        await server.register(vpRoutes)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('verifies embedded VCs successfully', async () => {
        const vpWithVCs = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                verifiableCredential: [
                    { vc: { id: 'vc1' }, issuerProof: {} },
                    { vc: { id: 'vc2' }, issuerProof: {} }
                ]
            }
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: vpWithVCs
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.vcs).toHaveLength(2)
    })

    it('fails when embedded VC has invalid signature', async () => {
        (verifySignedCredential as any).mockReturnValueOnce({
            issuer: { ok: false, reason: 'invalid signature' }
        })

        const vpWithInvalidVC = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                verifiableCredential: [{ vc: { id: 'vc1' }, issuerProof: {} }]
            }
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: vpWithInvalidVC
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('Invalid VC in presentation')
    })

    it('handles VC verification errors', async () => {
        (verifySignedCredential as any).mockImplementationOnce(() => {
            throw new Error('Verification failed')
        })

        const vpWithVC = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                verifiableCredential: [{ vc: { id: 'vc1' }, issuerProof: {} }]
            }
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: vpWithVC
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('Failed to verify VC')
    })

    it('handles quick verification with missing auth header', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick'
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toContain('Authorization')
    })

    it('handles quick verification with invalid token format', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: 'Bearer invalid-token'
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('Invalid token format')
    })

    it('handles quick verification with expired VP', async () => {
        const expiredVP = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                expirationDate: '2000-01-01T00:00:00Z'
            }
        }
        const token = Buffer.from(JSON.stringify(expiredVP)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('expired')
    })

    it('handles quick verification with holder mismatch', async () => {
        const mismatchVP = {
            ...CredentialsFixture.validVP,
            signer: '0xother'
        }
        const token = Buffer.from(JSON.stringify(mismatchVP)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('holder_mismatch')
    })

    it('handles quick verification with invalid VP signature', async () => {
        (utils.verifyTypedData as any).mockReturnValueOnce('0xwrong')

        const token = Buffer.from(JSON.stringify(CredentialsFixture.validVP)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('invalid_signature')
    })

    it('handles quick verification with invalid embedded VC', async () => {
        (verifySignedCredential as any).mockReturnValueOnce({
            issuer: { ok: false }
        })

        const vpWithVC = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                verifiableCredential: [{ vc: { id: 'vc1' }, issuerProof: {} }]
            }
        }
        const token = Buffer.from(JSON.stringify(vpWithVC)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('invalid_vc')
    })

    it('handles quick verification internal errors', async () => {
        (utils.verifyTypedData as any).mockImplementationOnce(() => {
            throw new Error('Unexpected error')
        })

        const token = Buffer.from(JSON.stringify(CredentialsFixture.validVP)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('invalid_signature')
    })

    it('handles successful quick verification with headers', async () => {
        (utils.verifyTypedData as any).mockReturnValue('0xholder')
            ; (verifySignedCredential as any).mockReturnValue({
                issuer: { ok: true }
            })

        const vpWithExpiration = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                expirationDate: '2099-12-31T23:59:59Z',
                verifiableCredential: []
            }
        }
        const token = Buffer.from(JSON.stringify(vpWithExpiration)).toString('base64')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: `Bearer ${token}`
            }
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers['x-vp-holder']).toBe('0xholder')
        expect(response.headers['x-vp-valid-until']).toBe('2099-12-31T23:59:59Z')
    })

    it('handles quick verification with catch-all error', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp/quick',
            headers: {
                authorization: 'Bearer not-base64-!@#$%'
            }
        })

        expect(response.statusCode).toBe(401)
    })
})
