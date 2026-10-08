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

import { verifyCredentialIssuance } from '@circuloos/common'

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
        // Since commit 6a34ad5 the route accepts W3C `proof.proofValue` as the signature
        // when `proof.signature` is absent (src/routes/verify.ts:96).
        const issuerAddress = '0x1234567890123456789012345678901234567890'
        ;(verifyCredentialIssuance as any).mockReturnValue(issuerAddress)

        const w3cVc = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "id": "urn:uuid:123",
            "type": ["VerifiableCredential"],
            "issuer": `did:ethr:${issuerAddress}`,
            "credentialSubject": {
                "id": "did:ethr:0xsubject"
            },
            "proof": {
                "type": "EthereumEip712Signature2021",
                "proofValue": "0xsignature",
                "verificationMethod": issuerAddress,
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
            payload: { credential: w3cVc }
        })

        const body = JSON.parse(response.payload)
        expect(response.statusCode).toBe(200)
        expect(body.valid).toBe(true)
        expect(body.issuer.address).toBe(issuerAddress)
        expect(body.checks.signature).toBe('VALID')

        // The embedded W3C proof is used as-is: domain + proofValue are passed to the verifier
        expect(verifyCredentialIssuance).toHaveBeenCalledWith(
            w3cVc.proof.domain,
            expect.objectContaining({
                id: w3cVc.id,
                proof: expect.objectContaining({ proofValue: '0xsignature' })
            }),
            '0xsignature',
            expect.any(String)
        )
    })
})
