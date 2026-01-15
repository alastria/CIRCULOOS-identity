import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { MockBuilder } from '../helpers/mock-builder.helper'
import { IssuanceStatus } from '@circuloos/common'

/**
 * Surgical tests for exact uncovered lines in issuanceService.ts
 * Lines 195-196: missing holder address in token
 * Lines 214-215: token holder address mismatch with issuance record
 */

describe('IssuanceService - Final Coverage', () => {
    let service: IssuanceService
    let mocks: any

    beforeEach(() => {
        mocks = MockBuilder.serviceMocks()
        service = new IssuanceService({
            store: mocks.credential,
            emailSender: mocks.notification,
            trustedIssuerRegistry: mocks.registry
        } as any)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Lines 195-196: missing holder address in token', () => {
        it('throws when token payload has no holderAddress', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
                otpHash: 'hash',
                holderAddress: '0xholder',
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            // Token verification succeeds but payload has NO holderAddress
            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test' }  // Missing holderAddress! This hits line 194-195
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'token-without-holder'
            })).rejects.toThrow('invalid token: missing holder address binding')
        })
    })

    describe('Lines 214-215: token holder mismatch with issuance record', () => {
        it('throws when token holderAddress does not match stored issuance holderAddress', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
                otpHash: 'hash',
                holderAddress: '0xSTORED',  // Different from token! This hits line 213-214
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xTOKEN' }  // Different!
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'token-with-different-holder'
            })).rejects.toThrow('token holder address does not match issuance record')
        })
    })

    it('throws error when status is CLAIMED (line 219)', async () => {
        const mockIssuance = {
            id: 'test',
            draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
            otpHash: 'hash',
            holderAddress: '0xholder',
            issuerProof: {},
            status: IssuanceStatus.CLAIMED
        }

        vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
            ok: true,
            payload: { id: 'test', holderAddress: '0xholder' }
        })
        vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)

        await expect(service.finalize('test', {
            otp: '123456',
            token: 'valid-token'
        })).rejects.toThrow('already claimed')
    })

    it('throws error when OTP is invalid (line 225)', async () => {
        const mockIssuance = {
            id: 'test',
            draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
            otpHash: 'hash',
            holderAddress: '0xholder',
            issuerProof: {},
            status: IssuanceStatus.ISSUED
        }

        vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
            ok: true,
            payload: { id: 'test', holderAddress: '0xholder' }
        })
        vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
        vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(false) // Invalid OTP

        await expect(service.finalize('test', {
            otp: '123456',
            token: 'valid-token'
        })).rejects.toThrow('invalid otp')
    })
})
