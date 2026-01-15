import { vi } from 'vitest'

/**
 * Mock for Ethers.js transaction and provider interactions
 * Used to test transaction success paths without real RPC
 */

export class MockTransactionReceipt {
    transactionHash: string
    blockNumber: number
    status: number

    constructor(txHash: string = '0xmocktxhash') {
        this.transactionHash = txHash
        this.blockNumber = 123456
        this.status = 1 // Success
    }
}

export class MockTransaction {
    hash: string

    constructor(hash: string = '0xmocktx') {
        this.hash = hash
    }

    async wait(): Promise<MockTransactionReceipt> {
        return new MockTransactionReceipt(this.hash)
    }
}

export class MockContract {
    address: string

    constructor(address: string) {
        this.address = address
    }

    async recordIssuance(vcHash: string, holderAddress: string): Promise<MockTransaction> {
        return new MockTransaction(`0xtx_${vcHash.slice(0, 10)}`)
    }
}

/**
 * Mock ethers provider with successful RPC connection
 */
export class MockProvider {
    async getNetwork() {
        return { chainId: 31337, name: 'localhost' }
    }

    async getBlockNumber() {
        return 123456
    }
}

/**
 * Mock ethers wallet/signer
 */
export class MockSigner {
    address: string

    constructor(privateKey?: string) {
        this.address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // Hardhat default
    }

    async getAddress() {
        return this.address
    }

    connect(provider: any) {
        return this
    }
}

/**
 * Factory to create ethers mocks
 */
export const createEthersMocks = () => {
    const provider = new MockProvider()
    const signer = new MockSigner()
    const contract = new MockContract('0x1234567890123456789012345678901234567890')

    return {
        provider,
        signer,
        contract,
        MockContract,
        MockTransaction,
        MockTransactionReceipt
    }
}

/**
 * Helper to mock successful ethers.Contract constructor
 */
export const mockEthersContract = (contractAddress: string) => {
    return vi.fn(() => new MockContract(contractAddress))
}

/**
 * Helper to mock successful JsonRpcProvider
 */
export const mockEthersProvider = () => {
    return vi.fn(() => new MockProvider())
}

/**
 * Helper to mock successful Wallet
 */
export const mockEthersWallet = () => {
    return vi.fn(() => new MockSigner())
}
