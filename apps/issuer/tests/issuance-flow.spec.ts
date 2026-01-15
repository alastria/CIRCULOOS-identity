import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IssuanceService } from '../src/services/issuanceService'
import { IssuanceStatus } from '@circuloos/common'

// Mock dependencies
const mockStore = {
    loadIssuance: vi.fn(),
    saveIssuance: vi.fn(),
    loadVC: vi.fn(),
    saveVC: vi.fn()
}
const mockEmailSender = {
    send: vi.fn()
}
const mockRegistry = {
    getTrustedRegistryAddress: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
    isTrustedIssuer: vi.fn().mockResolvedValue(true),
    recordIssuance: vi.fn().mockResolvedValue({ txHash: '0x...', blockNumber: 1 })
}

// Mock SecurityService
const mockSecurityInstance = {
    generateOtpCode: vi.fn().mockReturnValue('123456'),
    hashOtp: vi.fn().mockReturnValue('hashed_otp'),
    createSessionToken: vi.fn().mockReturnValue('token'),
    getExpiryDate: vi.fn().mockReturnValue(Date.now() + 3600000),
    buildDomain: vi.fn().mockReturnValue({}),
    verifySessionToken: vi.fn(),
    verifyOtpCode: vi.fn(),
    verifySignature: vi.fn(),
}

vi.mock('../src/services/security.service', () => {
    return {
        SecurityService: vi.fn().mockImplementation(() => mockSecurityInstance)
    }
})

vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual as any,
        config: {
            ISSUER_DID: 'did:ethr:issuer',
            ISSUER_HMAC_SECRET: 'secret'
        },
        IssuanceStatus: {
            DRAFT: 'DRAFT',
            ISSUED: 'ISSUED',
            CLAIMED: 'CLAIMED'
        }
    }
})

describe('Issuance Flow State Transitions', () => {
    let service: IssuanceService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new IssuanceService({
            storage: mockStore,
            emailSender: mockEmailSender as any,
            hmacSecret: 'secret',
            trustedIssuerRegistry: mockRegistry as any
        })
    })

    it('should create issuance with DRAFT status', async () => {
        const result = await service.prepare('test@example.com', '0x1234567890123456789012345678901234567890')

        expect(result.id).toBeDefined()
        expect(mockStore.saveIssuance).toHaveBeenCalledWith(
            expect.stringContaining('issuance_'),
            expect.objectContaining({
                status: IssuanceStatus.DRAFT
            })
        )
    })

    it('should fail to mint if status is not DRAFT', async () => {
        mockStore.loadIssuance.mockResolvedValue({
            id: 'issuance_1',
            status: IssuanceStatus.ISSUED, // Already issued
            draft: { id: 'vc_1' },
            holderAddress: '0x1234567890123456789012345678901234567890'
        })

        await expect(service.mint('issuance_1', 'sig', 'signer')).rejects.toThrow('already issued')
    })

    it('should fail to finalize if status is not ISSUED', async () => {
        mockStore.loadIssuance.mockResolvedValue({
            id: 'issuance_1',
            status: IssuanceStatus.DRAFT, // Not yet issued
            draft: { id: 'vc_1' },
            holderAddress: '0x1234567890123456789012345678901234567890',
            otpHash: 'hash'
        })

        // Mock token verification to pass
        mockSecurityInstance.verifySessionToken.mockReturnValue({
            ok: true,
            payload: { id: 'issuance_1', holderAddress: '0x1234567890123456789012345678901234567890' }
        })

        await expect(service.finalize('issuance_1', { token: 'valid.token' })).rejects.toThrow('invalid status for finalize: DRAFT')
    })
})
