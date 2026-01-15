import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { IssuanceStatus } from '@circuloos/common'

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

describe('IssuanceService Orchestrator', () => {
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

    describe('prepare', () => {
        it('orchestrates prepare flow successfully', async () => {
            const result = await service.prepare('test@example.com', '0x1234567890123456789012345678901234567890')

            expect(result.id).toBe('issuance-1')
            expect(result.otp).toBe('123456')
            expect(result.token).toBe('token-123')

            // Verify interactions
            expect(service['credential'].createDraftVC).toHaveBeenCalled()
            expect(service['security'].generateOtpCode).toHaveBeenCalled()
            expect(service['credential'].saveIssuance).toHaveBeenCalled()
            expect(service['notification'].sendClaimInfo).toHaveBeenCalled()
        })

        it('validates holder address', async () => {
            await expect(service.prepare('email', '')).rejects.toThrow('holderAddress is required')
            await expect(service.prepare('email', 'invalid')).rejects.toThrow('invalid holderAddress format')
        })

        it('uses fallback values when config is missing', async () => {
            // This test should trigger the fallback branches in lines 46-47
            // Pass empty email to trigger email fallback
            const result = await service.prepare('', '0x1234567890123456789012345678901234567890')

            expect(result).toHaveProperty('id')
            expect(result).toHaveProperty('otp')
            expect(result).toHaveProperty('token')
        })
    })

    describe('mint', () => {
        it('orchestrates mint flow successfully', async () => {
            // Setup mocks
            const mockIssuance = { id: 'issuance-1', draft: { id: 'vc-1' }, holderAddress: '0xholder', status: IssuanceStatus.DRAFT }
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue(mockIssuance)
            vi.mocked(service['security'].verifySignature).mockReturnValue('0xsigner')

            const result = await service.mint('issuance-1', '0xsig', '0xsigner')

            expect(result.id).toBe('issuance-1')
            expect(service['registry'].isTrustedIssuer).toHaveBeenCalledWith('0xsigner')
            expect(service['credential'].saveVC).toHaveBeenCalled() // Signed VC
            expect(service['registry'].recordIssuance).toHaveBeenCalled()
        })

        it('fails if issuance not found', async () => {
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue(null)
            await expect(service.mint('bad-id')).rejects.toThrow('not found')
        })

        it('fails if signature invalid', async () => {
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue({ id: '1', draft: {}, status: IssuanceStatus.DRAFT })
            vi.mocked(service['security'].verifySignature).mockReturnValue(null)
            // Ensure domain check passes so we reach signature check
            vi.mocked(service['security'].buildDomain).mockReturnValue({
                name: 'domain',
                version: '1',
                chainId: 1,
                verifyingContract: '0xtrusted'
            })
            await expect(service.mint('1', 'sig', 'signer')).rejects.toThrow('invalid issuer signature')
        })

        it('fails if draft is missing (line 98)', async () => {
            // Mock issuance record without a draft
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue({ id: '1', status: IssuanceStatus.DRAFT })
            await expect(service.mint('1', 'sig', 'signer')).rejects.toThrow('no draft to mint')
        })
    })

    describe('finalize', () => {
        it('orchestrates finalize flow successfully', async () => {
            const mockIssuance = {
                id: 'issuance-1',
                draft: { id: 'vc-1', credentialSubject: { id: '0xholder' } },
                otpHash: 'hash',
                holderAddress: '0xholder',
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.mocked(service['security'].verifySessionToken).mockReturnValue({ ok: true, payload: { id: 'issuance-1', holderAddress: '0xholder' } })
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue(mockIssuance)
            vi.mocked(service['security'].verifyOtpCode).mockReturnValue(true)
            vi.mocked(service['security'].verifySignature).mockReturnValue('0xholder')
            vi.mocked(service['credential'].loadVC).mockResolvedValue({
                id: 'vc-1',
                issuer: 'did:issuer',
                issuanceDate: '2023-01-01',
                credentialSubject: { id: '0xholder' },
                proof: {
                    type: 'Eip712Signature2023',
                    proofPurpose: 'assertionMethod',
                    verificationMethod: 'did:issuer#key-1',
                    signature: '0xsig',
                    created: '2023-01-01',
                    domain: { name: 'domain', version: '1', chainId: 1, verifyingContract: '0xtrusted' }
                }
            })

            // Create a valid token format (data.signature)
            const tokenData = Buffer.from(JSON.stringify({ id: 'issuance-1', holderAddress: '0xholder', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')
            const tokenSignature = 'a'.repeat(64) // 64 char hex signature
            const validToken = `${tokenData}.${tokenSignature}`

            const result = await service.finalize('issuance-1', {
                otp: '123456',
                token: validToken,
                signature: '0xsig',
                signer: '0xholder'
            })

            expect(result.vcId).toBe('vc-1')
            expect(service['credential'].saveVC).toHaveBeenCalled() // Finalized VC
        })

        it('sets credentialSubject.id if missing', async () => {
            const mockIssuance = {
                id: 'issuance-1',
                draft: { id: 'vc-1', credentialSubject: { holderAddress: '0xholder' } }, // Missing .id
                otpHash: 'hash',
                holderAddress: '0xholder',
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.mocked(service['security'].verifySessionToken).mockReturnValue({ ok: true, payload: { id: 'issuance-1', holderAddress: '0xholder' } })
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue(mockIssuance)
            vi.mocked(service['security'].verifyOtpCode).mockReturnValue(true)
            vi.mocked(service['security'].verifySignature).mockReturnValue('0xholder')
            vi.mocked(service['credential'].loadVC).mockResolvedValue({
                id: 'vc-1',
                issuer: 'did:issuer',
                issuanceDate: '2023-01-01',
                credentialSubject: { holderAddress: '0xholder' },
                proof: {
                    type: 'Eip712Signature2023',
                    proofPurpose: 'assertionMethod',
                    verificationMethod: 'vm',
                    signature: '0x',
                    created: '2023-01-01',
                    domain: { name: 'd', version: '1', chainId: 1 }
                }
            })

            // Create a valid token format
            const tokenData = Buffer.from(JSON.stringify({ id: 'issuance-1', holderAddress: '0xholder', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')
            const tokenSignature = 'a'.repeat(64)
            const validToken = `${tokenData}.${tokenSignature}`

            await service.finalize('issuance-1', { otp: '123456', token: validToken, signature: '0xsig', signer: '0xholder' })

            // Check that credentialSubject.id was set
            expect((mockIssuance.draft.credentialSubject as any).id).toBe('0xholder')
        })

        it('fails when holder signature does not match credentialSubject', async () => {
            const mockIssuance = {
                id: 'issuance-1',
                draft: { id: 'vc-1', credentialSubject: { id: '0xdifferent' } },
                otpHash: 'hash',
                holderAddress: '0xholder',
                issuerProof: {},
                status: IssuanceStatus.ISSUED
            }

            vi.mocked(service['security'].verifySessionToken).mockReturnValue({ ok: true, payload: { id: 'issuance-1', holderAddress: '0xholder' } })
            vi.mocked(service['credential'].loadIssuance).mockResolvedValue(mockIssuance)
            vi.mocked(service['security'].verifyOtpCode).mockReturnValue(true)
            vi.mocked(service['security'].verifySignature).mockReturnValue('0xwrong')
            vi.mocked(service['credential'].loadVC).mockResolvedValue(null)

            // Create a valid token format
            const tokenData = Buffer.from(JSON.stringify({ id: 'issuance-1', holderAddress: '0xholder', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')
            const tokenSignature = 'a'.repeat(64)
            const validToken = `${tokenData}.${tokenSignature}`

            await expect(service.finalize('issuance-1', {
                otp: '123456',
                token: validToken,
                signature: '0xsig',
                signer: '0xwrong'
            })).rejects.toThrow()
        })
    })
})
