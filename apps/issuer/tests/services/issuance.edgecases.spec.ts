import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { IssuanceStatus } from '@circuloos/common'
import { logger } from '../../src/logger'
import { config } from '../../src/config'
import { holderWallet, otherWallet, CLAIM_DOMAIN, signClaim } from '../helpers/holder-signature.helper'

// Mock config
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common')
    return {
        ...actual as any,
        loadConfig: () => ({
            storage: { dbPath: ':memory:' },
            email: { host: 'localhost', port: 1025 },
            issuer: { port: 3000 },
            http: { host: 'localhost' },
            nodeEnv: 'test',
            blockchain: { 
                rpcUrl: 'http://localhost:8545',
                chainId: 31337
            },
            swagger: { enabled: false }
        }),
    }
})

// Mock all sub-services
vi.mock('../../src/services/security.service', () => ({
    SecurityService: vi.fn().mockImplementation(() => ({
        generateOtpCode: vi.fn().mockReturnValue('123456'),
        hashOtp: vi.fn().mockReturnValue('hashed-otp'),
        createSessionToken: vi.fn().mockReturnValue('token-123'),
        getExpiryDate: vi.fn().mockReturnValue(Date.now() + 1000),
        buildDomain: vi.fn().mockReturnValue({ name: 'domain', version: '1', chainId: 1, verifyingContract: '0xtrusted' }),
        verifySignature: vi.fn(),
        verifySessionToken: vi.fn(),
        verifyOtpCode: vi.fn()
    }))
}))

vi.mock('../../src/services/credential.service', () => ({
    CredentialService: vi.fn().mockImplementation(() => ({
        createDraftVC: vi.fn().mockReturnValue({ id: 'issuance-1', draftVc: { id: 'vc-1' } }),
        saveIssuance: vi.fn(),
        loadIssuance: vi.fn(),
        loadVC: vi.fn(),
        saveVC: vi.fn(),
        buildProof: vi.fn().mockReturnValue({ proof: 'dummy' }),
        embedProof: vi.fn().mockImplementation((vc, proof) => ({ ...vc, proof }))
    }))
}))

vi.mock('../../src/services/registry.service', () => ({
    RegistryService: vi.fn().mockImplementation(() => ({
        getTrustedRegistryAddress: vi.fn().mockReturnValue('0xtrusted'),
        isTrustedIssuer: vi.fn().mockResolvedValue(true),
        recordIssuance: vi.fn().mockResolvedValue({ txHash: '0xtx', blockNumber: 1 })
    }))
}))

vi.mock('../../src/services/notification.service', () => ({
    NotificationService: vi.fn().mockImplementation(() => ({
        sendClaimInfo: vi.fn()
    }))
}))

// Helper to create valid token format
function createValidToken(payload: { id: string; holderAddress: string; exp?: number }): string {
    const exp = payload.exp || Math.floor(Date.now() / 1000) + 3600
    const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64')
    const signature = 'a'.repeat(64) // 64 char hex signature
    return `${data}.${signature}`
}

describe('IssuanceService Edge Cases', () => {
    let service: IssuanceService
    let mockStore: any

    beforeEach(() => {
        mockStore = {
            loadIssuance: vi.fn(),
            saveIssuance: vi.fn(),
            loadVC: vi.fn(),
            saveVC: vi.fn()
        }
        service = new IssuanceService({
            storage: mockStore,
            emailSender: { send: vi.fn() } as any,
            hmacSecret: 'test-secret',
            otpExpirySeconds: 3600
        })
    })

    describe('finalize edge cases', () => {
        // Holder signatures are now verified with ethers.verifyTypedData against the
        // `circuloos-marketplace` claim schema (not SecurityService.verifySignature), so
        // fixtures are real signatures over the current claim types (see holder-signature.helper).
        const HOLDER = holderWallet.address

        function issuedRecord(extra: Record<string, any> = {}) {
            return {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: HOLDER } },
                otpHash: 'hash',
                holderAddress: HOLDER,
                domain: CLAIM_DOMAIN,
                issuerProof: {},
                status: IssuanceStatus.ISSUED,
                ...extra,
            }
        }

        function stubTokenAndOtp(rec: any) {
            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: HOLDER }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(rec)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
        }

        it('logs a warning and throws when the holder signature cannot be verified', async () => {
            const warnSpy = vi.spyOn(logger, 'warn')
            stubTokenAndOtp(issuedRecord())
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature: 'sig', // not a valid EIP-712 signature
                signer: HOLDER
            })).rejects.toThrow('invalid signature')

            expect(warnSpy).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) }),
                'Schema registry verification failed, trying legacy'
            )
            warnSpy.mockRestore()
        })

        it('logs debug info when signer mismatch', async () => {
            const debugSpy = vi.spyOn(logger, 'debug')
            stubTokenAndOtp(issuedRecord())
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            // Signed by a different key than the declared signer
            const { signature, claimMessage } = await signClaim(otherWallet, validToken, CLAIM_DOMAIN, HOLDER)
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })).rejects.toThrow('signature signer mismatch')

            expect(debugSpy).toHaveBeenCalledWith(
                { recovered: otherWallet.address, expected: HOLDER },
                'Finalize signer mismatch'
            )
            debugSpy.mockRestore()
        })

        it('throws error when VC has no holder identification', async () => {
            stubTokenAndOtp(issuedRecord({ draft: { id: 'vc-1', credentialSubject: {} } })) // No id or holderAddress!
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            const { signature, claimMessage } = await signClaim(holderWallet, validToken)
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })).rejects.toThrow('credential missing holder identification')
        })

        it('re-throws custom error message from validation', async () => {
            // Valid holder signature, but the credential subject belongs to someone else
            stubTokenAndOtp(issuedRecord({ draft: { id: 'vc-1', credentialSubject: { id: otherWallet.address } } }))
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            const { signature, claimMessage } = await signClaim(holderWallet, validToken)
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })).rejects.toThrow('holder signature mismatch')
        })

        it('handles error without .message property in finalize (enforceHolderMatch catch)', async () => {
            // Create a mock VC with a credentialSubject that throws when accessed
            const rec = issuedRecord({
                draft: {
                    id: 'vc-1',
                    get credentialSubject() {
                        // Throw a plain value without .message property
                        throw 42
                    }
                },
            })
            delete (rec as any).issuerProof
            stubTokenAndOtp(rec)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            // claimMessage provided so the VC subject is first touched in enforceHolderMatch
            const { signature, claimMessage } = await signClaim(holderWallet, validToken)
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })).rejects.toThrow('42')
        })

        it('throws error when issuerProof is missing in both VC and rec', async () => {
            const rec = issuedRecord()
            delete (rec as any).issuerProof // NO issuerProof
            stubTokenAndOtp(rec)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null) // No existing VC
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            const { signature, claimMessage } = await signClaim(holderWallet, validToken)
            await expect(service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })).rejects.toThrow('missing issuer proof')
        })

        it('uses rec.issuerProof when existing VC is null', async () => {
            const issuerProof = { type: 'proof', signature: '0xproof' }
            stubTokenAndOtp(issuedRecord({ issuerProof }))
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null) // existing is null
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            const { signature, claimMessage } = await signClaim(holderWallet, validToken)
            const result = await service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage
            })

            expect(result.vcId).toBe('vc-1')
            const [, savedVp] = vi.mocked(service['credential'].saveVC).mock.calls[0] as any[]
            expect(savedVp.verifiableCredential[0].proof).toEqual(issuerProof)
        })

        it('uses clientDomain from otpOrObj when provided', async () => {
            stubTokenAndOtp(issuedRecord({ issuerProof: { type: 'proof', signature: '0xproof' } }))
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            // Pass domain as part of otpOrObj (differs from the stored one)
            const clientDomain = { name: 'custom', version: '1', chainId: 1, verifyingContract: '0x000000000000000000000000000000000000abcd' }
            const validToken = createValidToken({ id: 'test', holderAddress: HOLDER })
            const { signature, claimMessage } = await signClaim(holderWallet, validToken, clientDomain)
            const result = await service.finalize('test', {
                otp: '123',
                token: validToken,
                signature,
                signer: HOLDER,
                claimMessage,
                domain: clientDomain
            } as any)

            expect(result.vcId).toBe('vc-1')
            expect(service['credential'].buildProof).toHaveBeenCalledWith(signature, HOLDER, clientDomain, 'authentication')
        })

        // OBSOLETE: finalize() no longer wraps console.debug in a try/catch; debug output goes
        // through the pino logger (src/logger.ts; logger.debug calls in src/services/issuanceService.ts:341-383).
        // Nothing left to cover (code as imported in a7732d4).
        it.skip('covers line 231: catch block in console.debug', async () => {
            // Mock console.debug to throw an error
            const originalDebug = console.debug
            console.debug = vi.fn(() => {
                throw new Error('debug failed')
            })
            process.env.NODE_ENV = 'development'

            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
                otpHash: 'hash',
                holderAddress: '0xholder',
                issuerProof: { type: 'proof', signature: '0xproof' },
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xholder')
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const validToken = createValidToken({ id: 'test', holderAddress: '0xholder' })
            const result = await service.finalize('test', {
                otp: '123',
                token: validToken,
                signature: 'sig',
                signer: '0xholder'
            })

            expect(result.vcId).toBe('vc-1')

            // Restore
            console.debug = originalDebug
        })
    })

    describe('mint edge cases', () => {
        it('covers line 108: getTrustedRegistryAddress returns null', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                holderAddress: '0xholder',
                status: IssuanceStatus.DRAFT
            }

            // Mock getTrustedRegistryAddress to return null for the optional chaining
            const originalGetAddress = service['registry'].getTrustedRegistryAddress
            vi.spyOn(service['registry'], 'getTrustedRegistryAddress').mockReturnValue(null as any)

            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xsigner')
            vi.spyOn(service['registry'], 'isTrustedIssuer').mockResolvedValue(true)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['registry'], 'recordIssuance').mockResolvedValue({
                txHash: '0xtx',
                blockNumber: 1
            })
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)

            // This should succeed without throwing because getTrustedRegistryAddress returns null
            const result = await service.mint('test', '0xsig', '0xsigner')

            expect(result.id).toBe('test')

            // Restore
            service['registry'].getTrustedRegistryAddress = originalGetAddress
        })

        it('logs debug info on issuer signer mismatch', async () => {
            // Debug output moved from console.debug (dev only) to the pino logger
            const debugSpy = vi.spyOn(logger, 'debug')

            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                holderAddress: '0xholder',
                status: IssuanceStatus.DRAFT
            }

            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            // Return mismatched signer to trigger the debug log
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xwrong')

            await expect(service.mint('test', '0xsig', '0xright')).rejects.toThrow('issuer signer mismatch')
            expect(debugSpy).toHaveBeenCalledWith({ recovered: '0xwrong', expected: '0xright' }, 'Signer mismatch')

            debugSpy.mockRestore()
        })

        it('covers line 119: catch block in console.debug', async () => {
            const originalDebug = console.debug
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            // Mock console.debug to throw
            console.debug = vi.fn(() => {
                throw new Error('debug failed')
            })

            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                holderAddress: '0xholder',
                status: IssuanceStatus.DRAFT
            }

            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xsigner')
            vi.spyOn(service['registry'], 'isTrustedIssuer').mockResolvedValue(true)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['registry'], 'recordIssuance').mockResolvedValue({ txHash: '0xtx', blockNumber: 1 })
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['security'], 'generateOtpCode').mockReturnValue('123456')
            vi.spyOn(service['security'], 'hashOtp').mockReturnValue('hash')
            vi.spyOn(service['security'], 'createSessionToken').mockReturnValue('token')

            // Should not throw even though console.debug throws
            const result = await service.mint('test', '0xsig', '0xsigner')
            expect(result.id).toBe('test')

            console.debug = originalDebug
            process.env.NODE_ENV = originalEnv
        })

        it('covers line 144: throws when issuance record missing holderAddress', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                // Missing holderAddress
                status: IssuanceStatus.DRAFT
            }

            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xsigner')
            vi.spyOn(service['registry'], 'isTrustedIssuer').mockResolvedValue(true)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['registry'], 'recordIssuance').mockResolvedValue({ txHash: '0xtx', blockNumber: 1 })

            await expect(service.mint('test', '0xsig', '0xsigner')).rejects.toThrow('issuance record missing holderAddress')
        })

        it('covers line 169: does not expose OTP in production', async () => {
            // exposeOtp now reads the typed config (config.nodeEnv, resolved once at import)
            // instead of process.env.NODE_ENV at call time
            const originalEnv = config.nodeEnv
            ;(config as any).nodeEnv = 'production'

            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                holderAddress: '0xholder',
                status: IssuanceStatus.DRAFT
            }

            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'buildDomain').mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            vi.spyOn(service['security'], 'verifySignature').mockReturnValue('0xsigner')
            vi.spyOn(service['registry'], 'isTrustedIssuer').mockResolvedValue(true)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({
                verificationMethod: 'did:issuer#key-1'
            } as any)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['registry'], 'recordIssuance').mockResolvedValue({ txHash: '0xtx', blockNumber: 1 })
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['security'], 'generateOtpCode').mockReturnValue('123456')
            vi.spyOn(service['security'], 'hashOtp').mockReturnValue('hash')
            vi.spyOn(service['security'], 'createSessionToken').mockReturnValue('token')

            const result = await service.mint('test', '0xsig', '0xsigner')

            // In production, OTP should be undefined
            ;(config as any).nodeEnv = originalEnv
            expect(result.otp).toBeUndefined()
        })
    })

    describe('finalize validation branches', () => {
        it('covers line 187: throws when providedToken is missing', async () => {
            await expect(service.finalize('test', {
                otp: '123',
                token: '', // Empty token
                signature: 'sig',
                signer: '0xholder'
            })).rejects.toThrow('missing token')
        })

        it('covers line 205: throws when issuance is expired', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
                otpHash: 'hash',
                holderAddress: '0xholder',
                expiresAt: Date.now() - 10000, // Expired
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)

            await expect(service.finalize('test', {
                otp: '123',
                token: createValidToken({ id: 'test', holderAddress: '0xholder' }),
                signature: 'sig',
                signer: '0xholder'
            })).rejects.toThrow('expired')
        })

        it('covers line 205: does not throw when expiresAt is undefined', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1', credentialSubject: { id: holderWallet.address } },
                otpHash: 'hash',
                holderAddress: holderWallet.address,
                domain: CLAIM_DOMAIN, // stored domain used to verify the real holder signature
                issuerProof: { type: 'proof' },
                // No expiresAt field
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: holderWallet.address }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)
            vi.spyOn(service['security'], 'verifyOtpCode').mockReturnValue(true)
            vi.spyOn(service['credential'], 'loadVC').mockResolvedValue(null)
            vi.spyOn(service['credential'], 'saveVC').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'saveIssuance').mockResolvedValue(undefined)
            vi.spyOn(service['credential'], 'buildProof').mockReturnValue({} as any)

            const token = createValidToken({ id: 'test', holderAddress: holderWallet.address })
            const { signature, claimMessage } = await signClaim(holderWallet, token)
            const result = await service.finalize('test', {
                otp: '123',
                token,
                signature,
                signer: holderWallet.address,
                claimMessage
            })

            expect(result.vcId).toBe('vc-1')
        })

        it('covers line 179: handles string otpOrObj parameter', async () => {
            // This tests the branch where otpOrObj is a string instead of an object
            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: false,
                payload: null
            })

            // Pass a plain string as otpOrObj - should fail because we need token
            await expect(service.finalize('test', '123456')).rejects.toThrow('missing token')
        })

        it('covers line 204: throws when issuance record not found', async () => {
            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(null)

            await expect(service.finalize('test', {
                otp: '123',
                token: createValidToken({ id: 'test', holderAddress: '0xholder' }),
                signature: 'sig',
                signer: '0xholder'
            })).rejects.toThrow('not found')
        })

        it('covers line 208: throws when otp is missing', async () => {
            const mockIssuance = {
                id: 'test',
                draft: { id: 'vc-1' },
                otpHash: 'hash',
                holderAddress: '0xholder',
                status: IssuanceStatus.ISSUED
            }

            vi.spyOn(service['security'], 'verifySessionToken').mockReturnValue({
                ok: true,
                payload: { id: 'test', holderAddress: '0xholder' }
            })
            vi.spyOn(service['credential'], 'loadIssuance').mockResolvedValue(mockIssuance)

            await expect(service.finalize('test', {
                // No otp field
                token: createValidToken({ id: 'test', holderAddress: '0xholder' }),
                signature: 'sig',
                signer: '0xholder'
            })).rejects.toThrow('missing otp')
        })
    })
})
