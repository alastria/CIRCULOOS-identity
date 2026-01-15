import { vi } from 'vitest'

/**
 * Modular mocks for service layer testing
 * Provides clean, reusable mock builders for common service scenarios
 */

export interface MockIssuance {
    id: string
    draft: any
    otpHash?: string
    holderAddress?: string
    issuerProof?: any
}

export interface MockVerificationResult {
    ok: boolean
    payload?: any
}

/**
 * Builder for creating mock issuance objects with various states
 */
export class IssuanceMockBuilder {
    private issuance: MockIssuance

    constructor(id: string = 'test-id') {
        this.issuance = {
            id,
            draft: {
                id: `vc-${id}`,
                credentialSubject: {}
            }
        }
    }

    withHolderAddress(address: string): this {
        this.issuance.holderAddress = address
        this.issuance.draft.credentialSubject.holderAddress = address
        return this
    }

    withHolderId(id: string): this {
        this.issuance.draft.credentialSubject.id = id
        return this
    }

    withOtpHash(hash: string): this {
        this.issuance.otpHash = hash
        return this
    }

    withIssuerProof(proof: any): this {
        this.issuance.issuerProof = proof
        return this
    }

    withoutHolderIdentification(): this {
        delete this.issuance.draft.credentialSubject.id
        delete this.issuance.draft.credentialSubject.holderAddress
        return this
    }

    build(): MockIssuance {
        return this.issuance
    }
}

/**
 * Builder for creating mock service dependencies
 */
export class ServiceMockBuilder {
    private mocks: any = {}

    mockSecurityService(overrides: Partial<any> = {}): this {
        this.mocks.security = {
            verifySessionToken: vi.fn().mockReturnValue({ ok: true, payload: { id: 'test' } }),
            verifyOtpCode: vi.fn().mockReturnValue(true),
            verifySignature: vi.fn().mockReturnValue('0xsigner'),
            buildDomain: vi.fn().mockReturnValue({ name: 'test', version: '1', chainId: 1 }),
            ...overrides
        }
        return this
    }

    mockCredentialService(overrides: Partial<any> = {}): this {
        this.mocks.credential = {
            loadIssuance: vi.fn().mockResolvedValue(null),
            loadVC: vi.fn().mockResolvedValue(null),
            buildProof: vi.fn().mockReturnValue({}),
            ...overrides
        }
        return this
    }

    mockRegistryService(overrides: Partial<any> = {}): this {
        this.mocks.registry = {
            getTrustedRegistryAddress: vi.fn().mockReturnValue(undefined),
            isTrustedIssuer: vi.fn().mockResolvedValue(true),
            recordIssuance: vi.fn().mockResolvedValue({ txHash: '0xabc' }),
            ...overrides
        }
        return this
    }

    mockNotificationService(overrides: Partial<any> = {}): this {
        this.mocks.notification = {
            sendOtp: vi.fn().mockResolvedValue(undefined),
            ...overrides
        }
        return this
    }

    build() {
        return this.mocks
    }
}

/**
 * Quick helper to create a mock issuance with missing signature
 */
export const createIssuanceWithoutSignature = (id: string = 'test') => {
    return new IssuanceMockBuilder(id)
        .withHolderAddress('0xholder')
        .withOtpHash('hash')
        .build()
}

/**
 * Quick helper to create a mock issuance with mismatched holder
 */
export const createIssuanceWithMismatchedHolder = (
    expectedHolder: string,
    actualHolder: string
) => {
    return new IssuanceMockBuilder('test')
        .withHolderId(expectedHolder)
        .withHolderAddress(actualHolder)
        .withOtpHash('hash')
        .build()
}

/**
 * Quick helper to create a mock issuance without holder identification
 */
export const createIssuanceWithoutHolderIdentification = () => {
    return new IssuanceMockBuilder('test')
        .withoutHolderIdentification()
        .withOtpHash('hash')
        .build()
}
