import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { MockBuilder, ServiceMockBuilder } from '../helpers/mock-builder.helper'
import { IssuanceStatus } from '@circuloos/common'

/**
 * Tests to cover remaining service validation paths
 * - issuanceService.ts lines 224-225 (missing holder signature)
 * - issuanceService.ts lines 254-255 (holder signature mismatch)
 */

describe('IssuanceService Validation Coverage', () => {
    let service: IssuanceService
    let mocks: any

    beforeEach(() => {
        mocks = MockBuilder.serviceMocks()
        service = new IssuanceService({
            store: mocks.credential,
            emailSender: mocks.notification,
            trustedIssuerRegistry: mocks.registry
        } as any)
        // Wait, I should probably check how MockBuilder constructs mocks.
        // But for now, fixing the constructor call to pass a single object is key.
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('finalize - missing holder signature (lines 224-225)', () => {
        it('throws error when signature is missing', async () => {
            const mockIssuance = { ...MockBuilder.issuanceWithoutSignature('test'), status: IssuanceStatus.ISSUED }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'valid-token'
                // Missing signature and signer!
            })).rejects.toThrow('missing holder signature')
        })

        it('throws error when signer is missing but signature provided', async () => {
            const mockIssuance = { ...MockBuilder.issuanceWithoutSignature('test'), status: IssuanceStatus.ISSUED }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'valid-token',
                signature: '0xsig'
                // Missing signer!
            })).rejects.toThrow('missing holder signature')
        })
    })

    describe('finalize - holder signature mismatch (lines 254-255)', () => {
        it('throws when recovered signer does not match credentialSubject.id', async () => {
            const issuance = {
                id: 'test',
                draft: {
                    id: 'vc-1',
                    credentialSubject: { id: '0xexpected-holder' }
                },
                otpHash: 'hash',
                holderAddress: '0xactual-signer', // Match with token
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xactual-signer' } // Match!
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(issuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            // Signature recovery returns signer that matches token/holderAddress
            // but NOT credentialSubject.id
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xactual-signer')
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'test', version: '1', chainId: 1
            } as any)
            vi.spyOn(service['registry'], 'getTrustedRegistryAddress').mockReturnValue(undefined)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'valid-token',
                signature: '0xsig',
                signer: '0xactual-signer' // Matches token holder
            })).rejects.toThrow('holder signature does not match credentialSubject.id or holderAddress')
        })

        it('throws when recovered signer does not match holderAddress', async () => {
            const issuance = {
                id: 'test',
                draft: {
                    id: 'vc-1',
                    credentialSubject: { holderAddress: '0xexpected' }
                },
                otpHash: 'hash',
                holderAddress: '0xdifferent', // This will be the actual holder
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xdifferent' } // Match token with holderAddress
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(issuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            // Recovered signature matches signer but NOT credentialSubject.holderAddress
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xdifferent')
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'test', version: '1', chainId: 1
            } as any)
            vi.spyOn(service['registry'], 'getTrustedRegistryAddress').mockReturnValue(undefined)

            await expect(service.finalize('test', {
                otp: '123456',
                token: 'valid-token',
                signature: '0xsig',
                signer: '0xdifferent'  // Matches token
            })).rejects.toThrow('holder signature does not match')
        })
    })
})
