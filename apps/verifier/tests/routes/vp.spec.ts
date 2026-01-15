import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import vpRoutes from '../../src/routes/vp'
import { CredentialsFixture } from '../fixtures/credentials.fixture'
import { SignaturesFixture } from '../fixtures/signatures.fixture'

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

import { utils } from 'ethers'

describe('VP Route', () => {
    let server: any

    beforeEach(async () => {
        server = Fastify()
        await server.register(vpRoutes)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('verifies a valid VP', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: CredentialsFixture.validVP
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.ok).toBe(true)
        expect(body.holder).toBe(SignaturesFixture.holderAddress)
    })

    it('fails when required fields are missing', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: {}
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toContain('Missing required fields')
    })

    it('fails when VP is expired', async () => {
        const expiredVP = {
            ...CredentialsFixture.validVP,
            presentation: {
                ...CredentialsFixture.validVP.presentation,
                expirationDate: '2000-01-01T00:00:00Z'
            }
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: expiredVP
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('VP has expired')
    })

    it('fails when holder does not match signer', async () => {
        const mismatchVP = {
            ...CredentialsFixture.validVP,
            signer: '0xother'
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: mismatchVP
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('Holder address does not match signer')
    })

    it('fails when signature is invalid', async () => {
        (utils.verifyTypedData as any).mockReturnValue('0xother')

        const response = await server.inject({
            method: 'POST',
            url: '/verify-vp',
            payload: CredentialsFixture.validVP
        })

        expect(response.statusCode).toBe(401)
        expect(JSON.parse(response.payload).error).toBe('Invalid VP signature')
    })

    it('returns health check', async () => {
        const response = await server.inject({
            method: 'GET',
            url: '/verify-vp/health'
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.payload).ok).toBe(true)
    })
})
