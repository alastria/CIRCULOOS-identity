import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { MockBuilder, ServiceMockBuilder } from '../helpers/mock-builder.helper'
import { IssuanceStatus } from '@circuloos/common'
import { holderWallet, otherWallet, signClaim } from '../helpers/holder-signature.helper'

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
        // Constructor option renamed `store` -> `storage` (IStorageAdapter)
        service = new IssuanceService({
            storage: mocks.credential,
            emailSender: mocks.notification,
            trustedIssuerRegistry: mocks.registry
        } as any)
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
                token: 'valid.token' // '<payload>.<sig>' shape required by validateToken
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
                token: 'valid.token',
                signature: '0xsig'
                // Missing signer!
            })).rejects.toThrow('missing holder signature')
        })
    })

    describe('finalize - holder signature mismatch (enforceHolderMatch)', () => {
        // The holder signature is verified with ethers.verifyTypedData over the current
        // circuloos-marketplace claim schema (SecurityService.verifySignature is no longer used),
        // so a REAL signature from the token holder is needed to reach enforceHolderMatch.
        // Error text changed to 'holder signature mismatch: recovered=... expected=...'.
        const HOLDER = holderWallet.address
        const OTHER = otherWallet.address
        const domain = { name: 'test', version: '1', chainId: 1 }

        it('throws when recovered signer does not match credentialSubject.id', async () => {
            const issuance = {
                id: 'test',
                draft: {
                    id: 'vc-1',
                    credentialSubject: { id: OTHER }
                },
                otpHash: 'hash',
                holderAddress: HOLDER, // Match with token
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: HOLDER } // Match!
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(issuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue(domain as any)
            vi.spyOn(service['registry'], 'getTrustedRegistryAddress').mockReturnValue(undefined)

            // Signature recovers to the token holder but NOT credentialSubject.id
            const token = 'valid.token'
            const { signature, claimMessage } = await signClaim(holderWallet, token, domain)

            await expect(service.finalize('test', {
                otp: '123456',
                token,
                signature,
                signer: HOLDER, // Matches token holder
                claimMessage
            })).rejects.toThrow(`holder signature mismatch: recovered=${HOLDER} expected=${OTHER}`)
        })

        it('throws when recovered signer does not match holderAddress', async () => {
            const issuance = {
                id: 'test',
                draft: {
                    id: 'vc-1',
                    credentialSubject: { holderAddress: OTHER }
                },
                otpHash: 'hash',
                holderAddress: HOLDER, // This will be the actual holder
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: HOLDER } // Match token with holderAddress
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(issuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue(domain as any)
            vi.spyOn(service['registry'], 'getTrustedRegistryAddress').mockReturnValue(undefined)

            // Recovered signature matches signer but NOT credentialSubject.holderAddress
            const token = 'valid.token'
            const { signature, claimMessage } = await signClaim(holderWallet, token, domain)

            await expect(service.finalize('test', {
                otp: '123456',
                token,
                signature,
                signer: HOLDER,  // Matches token
                claimMessage
            })).rejects.toThrow(`holder signature mismatch: recovered=${HOLDER} expected=${OTHER}`)
        })
    })
})
