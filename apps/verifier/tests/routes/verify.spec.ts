import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import verifyRoutes from '../../src/routes/verify'
import { MockBuilder } from '../helpers/mock-builder.helper'
import { CredentialsFixture } from '../fixtures/credentials.fixture'
import { SignaturesFixture } from '../fixtures/signatures.fixture'

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    return {
        ...actual,
        verifySignedCredential: vi.fn(),
        createTrustedIssuerRegistryClient: vi.fn().mockReturnValue({
            isTrustedIssuer: vi.fn().mockResolvedValue(true)
        }),
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

vi.mock('../../src/config', () => ({
    config: {
        trustedRegistry: { address: '0xregistry' },
        blockchain: { rpcUrl: 'http://localhost:8545' },
        trustedIssuers: [],
        trustedHolders: [],
        eip712VerifyingContract: '0xcontract'
    }
}))

import { verifySignedCredential } from '@circuloos/common'

describe('Verify Route', () => {
    let server: any
    let mockRegistry: any

    beforeEach(async () => {
        server = Fastify()
        mockRegistry = MockBuilder.trustedIssuerRegistryService()
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)
        server.decorate('trustedIssuerRegistry', mockRegistry)

        await server.register(verifyRoutes)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('verifies a valid signed credential', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: SignaturesFixture.issuerAddress },
            holder: { ok: true, recovered: SignaturesFixture.holderAddress }
        })

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        const body = JSON.parse(response.payload)
        if (response.statusCode !== 200) {
            console.log('Verify failed:', body)
        }
        expect(response.statusCode).toBe(200)
        expect(body.ok).toBe(true)
    })

    it('fails when issuer proof is missing', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { ...CredentialsFixture.signedCredential, proof: undefined }
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toContain('Invalid W3C VC')
    })

    it('fails when verification fails', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: false, reason: 'invalid signature' },
            holder: { ok: true }
        })

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).ok).toBe(false)
    })

    it('checks trusted issuer registry if available', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: SignaturesFixture.issuerAddress },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(false)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toBe('issuer not trusted on chain')
    })

    it('checks onchain service if available', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockResolvedValue(null)
            }
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(200)
        expect(mockOnchainService.isIssued).toHaveBeenCalled()
    })

    it('fails when credential is not issued on chain', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(false),
            isRevoked: vi.fn().mockResolvedValue(false)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toBe('credential not recorded on chain')
    })

    it('fails when credential is revoked on chain', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(true)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toBe('credential has been revoked on chain')
    })

    it('fails when holder does not match on-chain subject', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true, recovered: '0xholder' }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockResolvedValue({
                    subject: '0xdifferentsubject',
                    issuer: '0x1234567890123456789012345678901234567890'
                })
            }
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.payload).error).toBe('holder address does not match on-chain subject')
    })

    it('handles onchain service errors gracefully', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockRejectedValue(new Error('Network error')),
            isRevoked: vi.fn().mockResolvedValue(false)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(502)
        expect(JSON.parse(response.payload).error).toBe('failed to query onchain service')
    })

    it('handles registry query errors gracefully', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true }
        })
        mockRegistry.isTrustedIssuer.mockRejectedValue(new Error('Registry network error'))

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        expect(response.statusCode).toBe(502)
        expect(JSON.parse(response.payload).error).toBe('failed to query trusted issuer registry')
    })

    it('handles subject validation errors gracefully', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0x1234567890123456789012345678901234567890' },
            holder: { ok: true, recovered: '0xholder' }
        })
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockRejectedValue(new Error('Store error'))
            }
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: CredentialsFixture.signedCredential
        })

        // Should still succeed since subject validation error is caught
        expect(response.statusCode).toBe(200)
    })
})
