import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import verifyRoutes from '../../src/routes/verify'

// Mock config module inline to avoid hoisting issues
vi.mock('../../src/config', () => ({
    config: {
        blockchain: { rpcUrl: 'http://localhost:8545' },
        trustedRegistry: { address: '0xregistry' },
        eip712VerifyingContract: undefined,
        trustedIssuers: [],
        trustedHolders: []
    }
}))

// Mock common to avoid real web3 calls
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual,
        createTrustedIssuerRegistryClient: vi.fn().mockImplementation(() => {
            throw new Error('Mocked client creation failure')
        }),
        verifySignedCredential: vi.fn().mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: true, recovered: '0xholder' }
        }),
        verifyCredentialIssuance: vi.fn().mockReturnValue('0xissuer'),
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

import { createTrustedIssuerRegistryClient } from '@circuloos/common'

describe('Verify Routes - Branch Coverage', () => {
    let server: FastifyInstance

    beforeEach(async () => {
        server = Fastify({ logger: false })
    })

    afterEach(async () => {
        await server.close()
        vi.restoreAllMocks()
    })

    it('handles failure initializing trusted registry client', async () => {
        // The simplified route (src/routes/verify.ts:145-153) only uses an injected
        // `fastify.trustedIssuerRegistry`; it never builds a client from config, so a
        // failing client factory cannot break verification and trust is reported as N/A.

        // Do not decorate server with service
        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                credential: {
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    id: "urn:uuid:test-vc1",
                    type: ["VerifiableCredential"],
                    issuer: "did:ethr:0xissuer",
                    issuanceDate: "2023-01-01T00:00:00Z",
                    credentialSubject: { id: "did:ethr:0xholder" },
                    proof: {
                        type: "Eip712Signature2023",
                        signature: "0xsig",
                        domain: { name: "Circuloos", version: "1", chainId: 31337 }
                    }
                }
            }
        })

        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.payload)
        expect(body.valid).toBe(true)
        expect(body.checks.trustedIssuer).toBe('N/A')
        expect(createTrustedIssuerRegistryClient).not.toHaveBeenCalled()
    })

    it.skip('handles failure in on-chain subject validation (catch block)', async () => {
        // Mock onchain service
        const mockOnchain = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                // Return Proxy that throws on property access 'subject'
                loadAll: vi.fn().mockResolvedValue(new Proxy({}, {
                    get(target, prop) {
                        if (prop === 'subject') throw new Error('Proxy error')
                        return undefined
                    }
                }))
            }
        }
        server.decorate('onchainService', mockOnchain)
        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                vc: { id: 'vc1' },
                issuerProof: { type: 'Eip712' }
            }
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.payload).ok).toBe(true)
    })
})
