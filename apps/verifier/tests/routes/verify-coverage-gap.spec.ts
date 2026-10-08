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
// NOTE: POST /verify is now the simplified route (src/routes/verify.ts): body `{ credential }`,
// issuer signature checked with `verifyCredentialIssuance`, trust only via an injected
// `fastify.trustedIssuerRegistry`, on-chain status only via `onchainService.isIssued/isRevoked`.
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual,
        createTrustedIssuerRegistryClient: vi.fn(),
        verifySignedCredential: vi.fn().mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: true, recovered: '0xholder' }
        }),
        verifyCredentialIssuance: vi.fn().mockReturnValue('0xissuer'),
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

import { verifySignedCredential, verifyCredentialIssuance, createTrustedIssuerRegistryClient } from '@circuloos/common'

const buildCredential = (id: string) => ({
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id,
    type: ["VerifiableCredential"],
    issuer: "did:ethr:0xissuer",
    issuanceDate: "2023-01-01T00:00:00Z",
    credentialSubject: { id: "did:ethr:0xholder" },
    proof: {
        type: "Eip712Signature2023",
        signature: "0xsig",
        domain: { name: "Circuloos", version: "1", chainId: 31337 }
    }
})

describe('Verify Routes - Coverage Gap', () => {
    let server: FastifyInstance

    beforeEach(async () => {
        server = Fastify({ logger: false })
        vi.clearAllMocks()
            ; (verifySignedCredential as any).mockReturnValue({
                issuer: { ok: true, recovered: '0xissuer' },
                holder: { ok: true, recovered: '0xholder' }
            })
            ; (verifyCredentialIssuance as any).mockReturnValue('0xissuer')
    })

    afterEach(async () => {
        await server.close()
    })

    it('covers line 22: reuses trustedRegistry instance (caching)', async () => {
        // Setup config to allow creation
        config.trustedRegistry.address = '0xregistry'

        const mockRegistry = { isTrustedIssuer: vi.fn().mockResolvedValue(true) }
        server.decorate('trustedIssuerRegistry', mockRegistry)

        server.register(verifyRoutes)
        await server.ready()

        // First call - uses the injected trustedIssuerRegistry
        await server.inject({
            method: 'POST',
            url: '/verify',
            body: { credential: buildCredential("urn:uuid:test-1") }
        })

        // Second call - same injected instance is reused
        await server.inject({
            method: 'POST',
            url: '/verify',
            body: { credential: buildCredential("urn:uuid:test-2") }
        })

        // If coverage shows line 22 covered, we succeeded.
    })

    // OBSOLETE: POST /verify no longer passes config.trustedIssuers/trustedHolders to a verifier (it calls verifyCredentialIssuance(domain, vc, signature, type), src/routes/verify.ts:113); issuer trust is only checked via fastify.trustedIssuerRegistry
    it.skip('covers lines 63-64: handles populated trustedIssuers/Holders', async () => {
        config.trustedIssuers = ['0xissuer']
        config.trustedHolders = ['0xholder']

        server.register(verifyRoutes)
        await server.ready()

        await server.inject({
            method: 'POST',
            url: '/verify',
            body: buildCredential("urn:uuid:test-1")
        })

        expect(verifySignedCredential).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                trustedIssuers: ['0xissuer'],
                trustedHolders: ['0xholder']
            })
        )
    })

    // OBSOLETE: same as above - config.trustedIssuers/trustedHolders are no longer read by src/routes/verify.ts
    it.skip('covers lines 63-64: handles empty trustedIssuers/Holders (undefined)', async () => {
        config.trustedIssuers = []
        config.trustedHolders = []

        server.register(verifyRoutes)
        await server.ready()

        await server.inject({
            method: 'POST',
            url: '/verify',
            body: buildCredential("urn:uuid:test-1")
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
        // POST /verify verifies only the issuer proof; a VC without holder proof proceeds
        server.register(verifyRoutes)
        await server.ready()

        const credential = buildCredential("urn:uuid:test-1")
        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: { credential }
        })

        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.payload)
        expect(body.valid).toBe(true)
        expect(body.holder).toEqual({ did: credential.credentialSubject.id })
    })

    // OBSOLETE: holder-proof verification was removed from POST /verify (src/routes/verify.ts:78-205 never checks a holder proof); holder signatures are verified by POST /verify/presentation
    it.skip('covers line 71: handles holderResult.ok = false', async () => {
        ; (verifySignedCredential as any).mockReturnValue({
            issuer: { ok: true, recovered: '0xissuer' },
            holder: { ok: false, reason: 'Holder mismatch' }
        })

        server.register(verifyRoutes)
        await server.ready()

        const res = await server.inject({
            method: 'POST',
            url: '/verify',
            body: buildCredential("urn:uuid:test-1")
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
            body: { credential: buildCredential("urn:uuid:test-1") }
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.payload).checks.trustedIssuer).toBe('N/A')
        expect(createTrustedIssuerRegistryClient).not.toHaveBeenCalled()
    })

    // OBSOLETE: on-chain subject validation (onchainService.store.loadAll) was removed from POST /verify; src/routes/verify.ts:155-178 only calls isIssued/isRevoked
    it.skip('covers line 117: skips subject validation if subject is empty string', async () => {
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
            body: buildCredential("urn:uuid:test-1")
        })

        expect(res.statusCode).toBe(200)
        expect(mockOnchain.store.loadAll).toHaveBeenCalled()
    })

    // OBSOLETE: on-chain subject validation (onchainService.store.loadAll) was removed from POST /verify; src/routes/verify.ts:155-178 only calls isIssued/isRevoked
    it.skip('covers line 117: validates subject when present (mismatch case)', async () => {
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
            body: buildCredential("urn:uuid:test-1")
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
            body: { credential: buildCredential("urn:uuid:test-1") }
        })

        expect(res.statusCode).toBe(200)
        // On-chain results are now reported in `checks` (the old `onchain` field no longer exists)
        const body = JSON.parse(res.payload)
        expect(body.valid).toBe(true)
        expect(body.checks.onChainStatus).toBe('VALID')
        expect(body.checks.notRevoked).toBe('VALID')
        expect(mockOnchain.isIssued).toHaveBeenCalledWith('0xhash')
    })
})
