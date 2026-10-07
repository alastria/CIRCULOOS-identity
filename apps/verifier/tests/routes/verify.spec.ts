import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import verifyRoutes from '../../src/routes/verify'
import { MockBuilder } from '../helpers/mock-builder.helper'
import { CredentialsFixture } from '../fixtures/credentials.fixture'
import { SignaturesFixture } from '../fixtures/signatures.fixture'

// Mock common
// NOTE: src/routes/verify.ts was rewritten as the simplified "user-friendly" API
// (registered in src/index.ts as `simplifiedVerifyRoutes`): POST /verify now takes
// `{ credential, checkOnChain }` (a W3C VC with embedded proof), verifies the issuer
// signature with `verifyCredentialIssuance` and answers 200 `{ valid, issuer, holder, checks, error }`.
// Request-shape errors are 400 and unexpected failures are caught and returned as 500.
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    return {
        ...actual,
        verifySignedCredential: vi.fn(),
        verifyCredentialIssuance: vi.fn(),
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

import { verifyCredentialIssuance, verifySignedCredential } from '@circuloos/common'

// In production the issuer sets proof.verificationMethod to the signer address
// (libs/common/src/eip712.ts), and the route compares it with the recovered address.
const credential = {
    ...CredentialsFixture.signedCredential,
    proof: {
        ...CredentialsFixture.signedCredential.proof,
        verificationMethod: SignaturesFixture.issuerAddress
    }
}

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
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        const body = JSON.parse(response.payload)
        if (response.statusCode !== 200) {
            console.log('Verify failed:', body)
        }
        expect(response.statusCode).toBe(200)
        expect(body.valid).toBe(true)
        expect(body.error).toBeUndefined()
        expect(body.issuer).toEqual({
            did: credential.issuer,
            address: SignaturesFixture.issuerAddress,
            signatureValid: true,
            trusted: true
        })
        expect(body.holder.did).toBe(credential.credentialSubject.id)
        expect(body.checks.signature).toBe('VALID')
        expect(body.checks.trustedIssuer).toBe('VALID')
        expect(verifyCredentialIssuance).toHaveBeenCalledWith(
            credential.proof.domain,
            credential,
            credential.proof.signature,
            'circuloos-marketplace'
        )
        expect(mockRegistry.isTrustedIssuer).toHaveBeenCalledWith(SignaturesFixture.issuerAddress)
    })

    it('fails when issuer proof is missing', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential: { ...credential, proof: undefined } }
        })

        expect(response.statusCode).toBe(400)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toContain('Invalid W3C VC')
        expect(verifyCredentialIssuance).not.toHaveBeenCalled()
    })

    it('fails when verification fails', async () => {
        // Signature cannot be recovered -> verification result (200) with valid=false
        (verifyCredentialIssuance as any).mockReturnValue(null)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.issuer.signatureValid).toBe(false)
        expect(body.checks.signature).toBe('INVALID')
        expect(body.error).toBe('Invalid signature or unknown credential type')
        // Without a recovered address the registry must not be consulted
        expect(mockRegistry.isTrustedIssuer).not.toHaveBeenCalled()
    })

    it('checks trusted issuer registry if available', async () => {
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
        mockRegistry.isTrustedIssuer.mockResolvedValue(false)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Issuer not in trusted registry')
        expect(body.checks.trustedIssuer).toBe('INVALID')
        expect(body.issuer.trusted).toBe(false)
        expect(mockRegistry.isTrustedIssuer).toHaveBeenCalledWith(SignaturesFixture.issuerAddress)
    })

    it('checks onchain service if available', async () => {
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
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
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(true)
        expect(body.checks.onChainStatus).toBe('VALID')
        expect(body.checks.notRevoked).toBe('VALID')
        expect(mockOnchainService.isIssued).toHaveBeenCalledWith('0xhash')
        expect(mockOnchainService.isRevoked).toHaveBeenCalledWith('0xhash')
    })

    it('fails when credential is not issued on chain', async () => {
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(false),
            isRevoked: vi.fn().mockResolvedValue(false)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Credential not recorded on-chain')
        expect(body.checks.onChainStatus).toBe('INVALID')
    })

    it('fails when credential is revoked on chain', async () => {
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(true)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Credential has been revoked')
        expect(body.checks.notRevoked).toBe('INVALID')
    })

    // OBSOLETE: on-chain subject/holder validation (onchainService.store.loadAll) was removed from POST /verify in the simplified route; src/routes/verify.ts:155-178 only checks isIssued/isRevoked
    it.skip('fails when holder does not match on-chain subject', async () => {
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
        // Upstream failures are caught by the route's try/catch and answered as 500 { valid: false, error }
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
        mockRegistry.isTrustedIssuer.mockResolvedValue(true)

        const mockOnchainService = {
            isIssued: vi.fn().mockRejectedValue(new Error('Network error')),
            isRevoked: vi.fn().mockResolvedValue(false)
        }
        server.decorate('onchainService', mockOnchainService)

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(500)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Network error')
    })

    it('handles registry query errors gracefully', async () => {
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
        mockRegistry.isTrustedIssuer.mockRejectedValue(new Error('Registry network error'))

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: { credential }
        })

        expect(response.statusCode).toBe(500)
        const body = JSON.parse(response.payload)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Registry network error')
    })

    it('handles subject validation errors gracefully', async () => {
        // The simplified route no longer reads the credential store for subject validation,
        // so a failing store cannot affect the verification result.
        (verifyCredentialIssuance as any).mockReturnValue(SignaturesFixture.issuerAddress)
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
            payload: { credential }
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.payload).valid).toBe(true)
        expect(mockOnchainService.store.loadAll).not.toHaveBeenCalled()
    })
})
