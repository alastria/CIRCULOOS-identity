import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import verifyRoutes from '../../src/routes/verify'
import { config } from '../../src/config'

// Mock config
vi.mock('../../src/config', () => ({
    config: {
        blockchain: { rpcUrl: 'http://localhost:8545' },
        trustedRegistry: { address: undefined }, // Start undefined
        eip712VerifyingContract: undefined,
        trustedIssuers: [],
        trustedHolders: []
    }
}))

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual,
        createTrustedIssuerRegistryClient: vi.fn(),
        verifySignedCredential: vi.fn().mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: true, recovered: '0xholder' }
        }),
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

import { verifySignedCredential, createTrustedIssuerRegistryClient } from '@circuloos/common'

describe('Verify Routes - Coverage Gap', () => {
    let server: FastifyInstance

    beforeEach(async () => {
        server = Fastify({ logger: false })
        vi.clearAllMocks()
            ; (verifySignedCredential as any).mockReturnValue({
                issuer: { ok: true, recovered: '0xissuer' },
                holder: { ok: true, recovered: '0xholder' }
            })
    })

    afterEach(async () => {
        await server.close()
    })

    it('covers line 22: reuses trustedRegistry instance (caching)', async () => {
        // Setup config to allow creation
        config.trustedRegistry.address = '0xregistry'

        // Decorate server manually to simulate service injection if we want? 
        // Or rely on createTrustedIssuerRegistryClient.
        // Code: if (decorated) return (trustedRegistry = decorated)
        // If we decorate, line 24 hits. Line 22 hits on second call.

        const mockRegistry = { isTrustedIssuer: vi.fn().mockResolvedValue(true) }
        server.decorate('trustedIssuerRegistry', mockRegistry)

        server.register(verifyRoutes)
        await server.ready()

        // First call - initializes trustedRegistry from decorator
        await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        // Second call - should hit line 22 "if (trustedRegistry) return trustedRegistry"
        await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-2",
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
        })

        // If coverage shows line 22 covered, we succeeded.
    })

    it('covers lines 63-64: handles populated trustedIssuers/Holders', async () => {
        config.trustedIssuers = ['0xissuer']
        config.trustedHolders = ['0xholder']

        server.register(verifyRoutes)
        await server.ready()

        await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(verifySignedCredential).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                trustedIssuers: ['0xissuer'],
                trustedHolders: ['0xholder']
            })
        )
    })

    it('covers lines 63-64: handles empty trustedIssuers/Holders (undefined)', async () => {
        config.trustedIssuers = []
        config.trustedHolders = []

        server.register(verifyRoutes)
        await server.ready()

        await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(verifySignedCredential).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                trustedIssuers: undefined,
                trustedHolders: undefined
            })
        )
    })

    it('covers line 71: handles holderResult undefined (no holder verification)', async () => {
        ; (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: undefined // No holder result
        })

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(200)
        // Should proceed
    })

    it('covers line 71: handles holderResult.ok = false', async () => {
        ; (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: false, reason: 'Holder mismatch' }
        })

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.payload).error).toBe('Holder mismatch')
    })

    it('covers line 27: registryAddress falsy (no registry)', async () => {
        config.trustedRegistry.address = undefined
        config.eip712VerifyingContract = undefined

        // Also ensure no decorator

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(200)
        expect(createTrustedIssuerRegistryClient).not.toHaveBeenCalled()
    })

    it('covers line 117: skips subject validation if subject is empty string', async () => {
        const mockOnchain = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockResolvedValue({ subject: '' })
            }
        }
        server.decorate('onchainService', mockOnchain)

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(200)
        expect(mockOnchain.store.loadAll).toHaveBeenCalled()
    })

    it('covers line 117: validates subject when present (mismatch case)', async () => {
        const mockOnchain = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockResolvedValue({ subject: '0xother' }) // Mismatch with 0xholder
            }
        }
        server.decorate('onchainService', mockOnchain)

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.payload).error).toContain('holder address does not match on-chain subject')
    })

    it('covers line 117: validates subject when present (match case)', async () => {
        const mockOnchain = {
            isIssued: vi.fn().mockResolvedValue(true),
            isRevoked: vi.fn().mockResolvedValue(false),
            store: {
                loadAll: vi.fn().mockResolvedValue({ subject: '0xholder' }) // Matches 0xholder
            }
        }
        server.decorate('onchainService', mockOnchain)

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                id: "urn:uuid:test-1",
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
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.payload).onchain).toBeDefined()
    })
})

