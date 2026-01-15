import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @circuloos/common with ISSUER_DID as undefined
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual<any>('@circuloos/common')
    return {
        ...actual,
        config: {
            ...actual.config,
            ISSUER_DID: undefined, // This will trigger the fallback
            TRUSTED_ISSUER_REGISTRY_ADDRESS: '0xtrusted',
            CREDENTIAL_REGISTRY_ADDRESS: '0xregistry',
            RPC_URL: 'http://rpc',
            ISSUER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
        }
    }
})

import { IssuanceService } from '../../src/services/issuanceService'

/**
 * Cover issuanceService.ts line 46:
 * const issuerDid = config.ISSUER_DID || 'did:example:issuer'
 *
 * Need to test when config.ISSUER_DID is falsy to hit the fallback
 */

describe('IssuanceService Line 46 - ISSUER_DID fallback', () => {
    let service: IssuanceService
    let mockStore: any

    beforeEach(() => {
        mockStore = {
            loadAll: vi.fn(),
            writeAtomic: vi.fn()
        }
        service = new IssuanceService({ store: mockStore })
    })

    it('uses fallback did:example:issuer when config.ISSUER_DID is undefined', async () => {

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
