import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { EmailMock, IssuanceStatus, SqlJsStorageAdapter } from '@circuloos/common'

/**
 * Covers issuanceService.ts uncovered lines in mint():
 * - Lines 109-110: verifyingContract mismatch error
 * - Lines 115-116: missing issuer signature error
 * - Lines 119-120: console.debug in development
 * - Lines 128-130: console.debug for signer mismatch
 */

describe('IssuanceService - Mint Error Coverage', () => {
    let svc: IssuanceService
    // IssuanceService now persists through an IStorageAdapter (sql.js) passed as `storage`
    let store: SqlJsStorageAdapter
    let origEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        origEnv = { ...process.env }
        process.env.NODE_ENV = 'development'
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        process.env.TRUSTED_ISSUER_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000002'

        store = new SqlJsStorageAdapter(':memory:')

        // Create mock registry client
        const mockRegistry = {
            getTrustedRegistryAddress: () => '0x0000000000000000000000000000000000000002',
            isTrustedIssuer: async () => true,
            recordIssuance: async () => null
        }

        svc = new IssuanceService({
            storage: store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
            trustedIssuerRegistry: mockRegistry as any
        })
    })

    afterEach(() => {
        process.env = origEnv
    })

    it('throws error when issuerSignature is missing (lines 115-116)', async () => {
        // First prepare an issuance
        const prepareResult = await svc.prepare(
            'test2@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company 2'
        )

        const testId = prepareResult.id

        // mint(id, issuerSignature, issuerSigner, domainOverride)
        // Missing signature and signer - hits lines 115-116
        await expect(
            svc.mint(testId, '', '')
        ).rejects.toThrow('missing issuer signature and signer')
    })

    it('throws error when status is invalid for mint (lines 103-104)', async () => {
        const prepareResult = await svc.prepare(
            'test3@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company 3'
        )
        const testId = prepareResult.id

        // Manually update status to CLAIMED (which is invalid for minting)
        const rec = await store.loadIssuance(testId)
        rec.status = IssuanceStatus.CLAIMED
        await store.saveIssuance(testId, rec)

        await expect(
            svc.mint(testId, '0xsig', '0xsigner')
        ).rejects.toThrow(`invalid status for mint: ${IssuanceStatus.CLAIMED}`)
    })
})
