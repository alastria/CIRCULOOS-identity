import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { config } from '../../src/config'

/**
 * Cover the ISSUER_DID fallback in IssuanceService.prepare():
 * issuerDid || 'did:example:issuer'  (issuerDid = config.issuer.did)
 *
 * The DID now comes from the issuer typed config (src/config -> loadConfig()), not from the
 * legacy flat `config.ISSUER_DID` of @circuloos/common, so the test clears config.issuer.did.
 */

describe('IssuanceService Line 46 - ISSUER_DID fallback', () => {
    let service: IssuanceService
    let mockStore: any
    let originalDid: string | undefined

    beforeEach(() => {
        originalDid = config.issuer.did
        ;(config.issuer as any).did = undefined // trigger the fallback
        // IStorageAdapter API (constructor option renamed store -> storage)
        mockStore = {
            loadIssuance: vi.fn(),
            saveIssuance: vi.fn(),
            loadVC: vi.fn(),
            saveVC: vi.fn()
        }
        service = new IssuanceService({ storage: mockStore })
    })

    afterEach(() => {
        ;(config.issuer as any).did = originalDid
    })

    it('uses fallback did:example:issuer when config.issuer.did is undefined', async () => {

        // Mock the dependencies
        vi.spyOn(service['credential'], 'createDraftVC').mockReturnValue({
            id: 'test-id',
            draftVc: { id: 'vc-1', issuer: 'did:example:issuer' }
        })
        vi.spyOn(service['security'], 'generateOtpCode').mockReturnValue('123456')
        vi.spyOn(service['security'], 'hashOtp').mockReturnValue('hash')
        vi.spyOn(service['security'], 'createSessionToken').mockReturnValue('token')
        vi.spyOn(service['security'], 'getExpiryDate').mockReturnValue(Date.now() + 1000)
        vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
        vi.spyOn(service['notification'], 'sendClaimInfo').mockResolvedValue(undefined)

        const result = await service.prepare('test@example.com', '0x1234567890123456789012345678901234567890')

        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('otp')
        expect(result).toHaveProperty('token')

        // Verify createDraftVC was called with the fallback issuerDid
        expect(service['credential'].createDraftVC).toHaveBeenCalled()
        const createDraftVCCall = vi.mocked(service['credential'].createDraftVC).mock.calls[0]
        expect(createDraftVCCall[2]).toBe('did:example:issuer') // issuerDid parameter should be the fallback
    })
})
