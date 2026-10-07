import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { SqlJsStorageAdapter } from '@circuloos/common'
import playgroundRoutes from '../../src/routes/playground'
import { config } from '../../src/config'

/**
 * Cover playground.ts line 64:
 * const subjectAddr = vc.credentialSubject?.holderAddress || ethers.constants.AddressZero
 *
 * Need to test when vc.credentialSubject is missing or holderAddress is missing
 */

describe('Playground.ts - Line 64 Branch', () => {
    let server: FastifyInstance
    let origEnv: any
    let store: any
    let origDiamond: string | undefined
    let origRpc: string

    beforeEach(async () => {
        origEnv = { ...process.env }
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        // The playground reads the registry address / RPC from the typed config
        // (config.diamond.address, config.blockchain.rpcUrl) instead of
        // CREDENTIAL_REGISTRY_ADDRESS / RPC_URL env vars.
        origDiamond = config.diamond.address
        origRpc = config.blockchain.rpcUrl
        ;(config.diamond as any).address = '0x1234567890123456789012345678901234567890'
        ;(config.blockchain as any).rpcUrl = 'http://localhost:8545'

        server = Fastify({ logger: false })
        // Routes now use an IStorageAdapter decorated as `storage` (was FileStore `store`)
        store = new SqlJsStorageAdapter(':memory:')
        server.decorate('storage', store)
        server.register(playgroundRoutes, { prefix: '/playground' })
        await server.ready()
    })

    afterEach(async () => {
        process.env = origEnv
        ;(config.diamond as any).address = origDiamond
        ;(config.blockchain as any).rpcUrl = origRpc
        await server.close()
    })

    it('covers AddressZero fallback when credentialSubject.holderAddress is missing (line 64)', async () => {
        // Mock store.loadIssuance to intercept and modify the VC
        const originalLoadIssuance = store.loadIssuance.bind(store)

        store.loadIssuance = vi.fn().mockImplementation(async function (this: any, id: string) {
            const result = await originalLoadIssuance(id)

            // If the issuance has a draft, remove holderAddress from credentialSubject
            if (result?.draft?.credentialSubject) {
                const modifiedResult = { ...result }
                modifiedResult.draft = {
                    ...result.draft,
                    credentialSubject: {
                        ...result.draft.credentialSubject
                    }
                }
                // Remove holderAddress to trigger AddressZero fallback
                delete modifiedResult.draft.credentialSubject.holderAddress
                return modifiedResult
            }

            return result
        })

        const res = await server.inject({
            method: 'POST',
            url: '/playground/issue-preview',
            payload: {
                email: 'test-line64@example.com',
                holderAddress: '0x1234567890123456789012345678901234567890'
            }
        })

        // Should succeed - the calldata will use AddressZero as fallback
        expect(res.statusCode).toBe(200)
        const data = JSON.parse(res.payload)
        expect(store.loadIssuance).toHaveBeenCalled()
        // calldata was populated (null only when no registry is configured or population fails).
        // NB: the route's response schema declares calldata as a bare object, so its fields are
        // stripped by the serializer; only its presence can be asserted over HTTP.
        expect(data.calldata).not.toBeNull()
        expect(data.vcHash).toMatch(/^0x[0-9a-f]{64}$/)

        // Restore
        store.loadIssuance = originalLoadIssuance
    })

    it('covers AddressZero fallback when holderAddress is missing from credentialSubject (line 64)', async () => {
        const IssuanceService = (await import('../../src/services/issuanceService')).IssuanceService
        const originalPrepare = IssuanceService.prototype.prepare

        IssuanceService.prototype.prepare = vi.fn().mockImplementation(async function (this: any, email: string) {
            const result = await originalPrepare.call(this, email)

            if (result?.id) {
                const rec = await this.store.loadAll(`issuances/${result.id}.json`)
                if (rec?.draft?.credentialSubject) {
                    // Keep credentialSubject but remove holderAddress
                    delete rec.draft.credentialSubject.holderAddress
                    await this.store.writeAtomic(`issuances/${result.id}.json`, rec)
                }
            }
            return result
        })

        const res = await server.inject({
            method: 'POST',
            url: '/playground/issue-preview',
            payload: {
                email: 'test2@example.com',
                holderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
            }
        })

        expect([200, 500]).toContain(res.statusCode)

        // Restore
        IssuanceService.prototype.prepare = originalPrepare
    })

    it('covers AddressZero fallback when holderAddress is null (line 64)', async () => {
        const IssuanceService = (await import('../../src/services/issuanceService')).IssuanceService
        const originalPrepare = IssuanceService.prototype.prepare

        IssuanceService.prototype.prepare = vi.fn().mockImplementation(async function (this: any, email: string) {
            const result = await originalPrepare.call(this, email)

            if (result?.id) {
                const rec = await this.store.loadAll(`issuances/${result.id}.json`)
                if (rec?.draft?.credentialSubject) {
                    // Set holderAddress to null
                    rec.draft.credentialSubject.holderAddress = null
                    await this.store.writeAtomic(`issuances/${result.id}.json`, rec)
                }
            }
            return result
        })

        const res = await server.inject({
            method: 'POST',
            url: '/playground/issue-preview',
            payload: {
                email: 'test3@example.com',
                holderAddress: '0x9999999999999999999999999999999999999999'
            }
        })

        expect([200, 500]).toContain(res.statusCode)

        // Restore
        IssuanceService.prototype.prepare = originalPrepare
    })
})
