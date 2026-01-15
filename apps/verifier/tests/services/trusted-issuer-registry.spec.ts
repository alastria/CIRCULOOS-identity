import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { MockBuilder } from '../helpers/mock-builder.helper'
import { Contract, providers } from 'ethers'

// Mock ethers
vi.mock('ethers', () => {
    const ContractMock = vi.fn()
    ContractMock.prototype.on = vi.fn()
    ContractMock.prototype.removeAllListeners = vi.fn()
    ContractMock.prototype.queryFilter = vi.fn().mockResolvedValue([])
    ContractMock.prototype.filters = {
        IssuerAdded: vi.fn(),
        IssuerRemoved: vi.fn(),
    }

    const JsonRpcProviderMock = vi.fn()
    JsonRpcProviderMock.prototype.getBlockNumber = vi.fn().mockResolvedValue(100)
    JsonRpcProviderMock.prototype.lookupAddress = vi.fn().mockResolvedValue(null)

    return {
        Contract: ContractMock,
        providers: {
            JsonRpcProvider: JsonRpcProviderMock
        },
        utils: {
            getAddress: (addr: string) => addr,
            verifyTypedData: vi.fn()
        }
    }
})

describe('TrustedIssuerRegistryService', () => {
    let service: TrustedIssuerRegistryService
    let mockStore: any
    let mockClient: any

    beforeEach(() => {
        mockStore = MockBuilder.fileStore()
        mockClient = {
            provider: new providers.JsonRpcProvider(),
            address: '0xregistry',
            isTrustedIssuer: vi.fn().mockResolvedValue(true),
            contract: new Contract('0xregistry', [])
        }

        service = new TrustedIssuerRegistryService({
            store: mockStore,
            client: mockClient,
            startBlock: 0
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('starts and syncs successfully', async () => {
        mockStore.loadAll.mockResolvedValue({ issuers: {}, lastProcessedBlock: 0 })
        await service.start()
        expect(mockClient.contract.on).toHaveBeenCalledWith('IssuerAdded', expect.any(Function))
        expect(mockClient.contract.on).toHaveBeenCalledWith('IssuerRemoved', expect.any(Function))
    })

    it('stops and removes listeners', async () => {
        mockStore.loadAll.mockResolvedValue({ issuers: {}, lastProcessedBlock: 0 })
        await service.start()
        await service.stop()
        expect(mockClient.contract.removeAllListeners).toHaveBeenCalledWith('IssuerAdded')
        expect(mockClient.contract.removeAllListeners).toHaveBeenCalledWith('IssuerRemoved')
    })

    it('checks if issuer is trusted via client', async () => {
        await service.isTrustedIssuer('0xissuer')
        expect(mockClient.isTrustedIssuer).toHaveBeenCalledWith('0xissuer')
    })

    it('lists issuers from store', async () => {
        const mockState = {
            issuers: {
                '0xissuer': {
                    address: '0xissuer',
                    addedAtBlock: 1,
                    addedBy: '0xadmin',
                    addedTxHash: '0xhash'
                }
            },
            lastProcessedBlock: 10
        }
        mockStore.loadAll.mockResolvedValue(mockState)

        const issuers = await service.listIssuers()
        expect(issuers).toHaveLength(1)
        expect(issuers[0].address).toBe('0xissuer')
    })

    it('handles sync with new events', async () => {
        mockStore.loadAll.mockResolvedValue({ issuers: {}, lastProcessedBlock: 0 })

        // Mock queryFilter to return an event
        const mockEvent = {
            args: ['0xnewissuer', '0xadmin'],
            blockNumber: 5,
            transactionHash: '0xhash'
        }
        mockClient.contract.queryFilter.mockResolvedValueOnce([mockEvent]).mockResolvedValueOnce([]) // Added, then Removed

        await service.sync()

        expect(mockStore.writeAtomic).toHaveBeenCalled()
        const savedState = mockStore.writeAtomic.mock.calls[0][1]
        expect(savedState.issuers['0xnewissuer']).toBeDefined()
    })
})
