import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import verifyRoutes from '../../src/routes/verify'
import { MockBuilder } from '../helpers/mock-builder.helper'

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

describe('Verify Route - W3C Support', () => {
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

    it('verifies a W3C VC with embedded proof', async () => {
        (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: true }
        })

        const w3cVc = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "id": "urn:uuid:123",
            "type": ["VerifiableCredential"],
            "issuer": "did:ethr:0xissuer",
            "credentialSubject": {
                "id": "did:ethr:0xsubject"
            },
            "proof": {
                "type": "EthereumEip712Signature2021",
                "proofValue": "0xsignature",
                "verificationMethod": "did:ethr:0xissuer#controller",
                "created": "2024-01-01T00:00:00Z",
                "proofPurpose": "assertionMethod",
                "domain": {
                    "name": "Test",
                    "version": "1",
                    "chainId": 1
                }
            }
        }

        const response = await server.inject({
            method: 'POST',
            url: '/verify',
            payload: w3cVc
        })

        const body = JSON.parse(response.payload)
        expect(response.statusCode).toBe(200)
        expect(body.ok).toBe(true)

        // Verify that verifySignedCredential was called with the normalized structure
        expect(verifySignedCredential).toHaveBeenCalledWith(
            expect.objectContaining({
                vc: expect.anything(),
                issuerProof: expect.anything()
            }),
            expect.anything()
        )
    })
})
