import {
    IssuanceMockBuilder,
    ServiceMockBuilder,
    createIssuanceWithoutSignature,
    createIssuanceWithMismatchedHolder,
    createIssuanceWithoutHolderIdentification
} from '../fixtures/mocks/service.mocks'
import {
    MockTransaction,
    MockTransactionReceipt,
    MockContract,
    createEthersMocks
} from '../fixtures/mocks/ethers.mock'

/**
 * Centralized mock builders for test scenarios
 * Provides consistent, reusable mock objects across test files
 */

export class MockBuilder {
    /**
     * Create a standard issuance mock with all required fields
     */
    static standardIssuance(id: string = 'test-id') {
        return new IssuanceMockBuilder(id)
            .withHolderAddress('0x1234567890123456789012345678901234567890')
            .withHolderId('did:example:holder')
            .withOtpHash('hashed-otp')
            .withIssuerProof({ signature: '0xproof' })
            .build()
    }

    /**
     * Create an issuance missing the holder signature
     */
    static issuanceWithoutSignature(id: string = 'test-id') {
        return createIssuanceWithoutSignature(id)
    }

    /**
     * Create an issuance with mismatched holder addresses
     */
    static issuanceWithMismatchedHolder(expectedHolder: string, actualHolder: string) {
        return createIssuanceWithMismatchedHolder(expectedHolder, actualHolder)
    }

    /**
     * Create an issuance without any holder identification
     */
    static issuanceWithoutHolderInfo() {
        return createIssuanceWithoutHolderIdentification()
    }

    /**
     * Create a complete set of service mocks
     */
    static serviceMocks(overrides: any = {}) {
        return new ServiceMockBuilder()
            .mockSecurityService(overrides.security)
            .mockCredentialService(overrides.credential)
            .mockRegistryService(overrides.registry)
            .mockNotificationService(overrides.notification)
            .build()
    }

    /**
     * Create a successful transaction receipt
     */
    static transactionReceipt(txHash: string = '0xsuccesstx') {
        return new MockTransactionReceipt(txHash)
    }

    /**
     * Create a successful transaction
     */
    static transaction(hash: string = '0xtx') {
        return new MockTransaction(hash)
    }

    /**
     * Create ethers mocks for blockchain interaction
     */
    static ethersMocks() {
        return createEthersMocks()
    }

    /**
     * Create a mock contract instance
     */
    static contract(address: string = '0x1234567890123456789012345678901234567890') {
        return new MockContract(address)
    }
}

/**
 * Re-export commonly used builders for convenience
 */
export {
    IssuanceMockBuilder,
    ServiceMockBuilder,
    createEthersMocks
}
