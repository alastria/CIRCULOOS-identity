import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { MockBuilder } from '../helpers/mock-builder.helper'

/**
 * Target uncovered branches in trustedIssuerRegistryService.ts sync method:
 * - Lines 123-134: When IssuerRemoved event found during sync for non-existing issuer
 */

// Mock ethers
vi.mock('ethers', () => {
    const ContractMock = vi.fn().mockImplementation(() => {
        return {
            queryFilter: vi.fn().mockImplementation((filter: any) => {
                // Return different events based on filter
                if (filter === 'removedFilter') {
                    return Promise.resolve([{
                        args: ['0xnonexistent', '0xremover'],
                        blockNumber: 50,
                        transactionHash: '0xtxremove'
                    }])
                }
                // addedFilter returns empty
                return Promise.resolve([])
            }),
            filters: {
                IssuerAdded: vi.fn().mockReturnValue('addedFilter'),
                IssuerRemoved: vi.fn().mockReturnValue('removedFilter')
            },
            on: vi.fn(),
            removeAllListeners: vi.fn()
        }
    })

    const JsonRpcProviderMock = vi.fn().mockImplementation(() => ({
        getBlockNumber: vi.fn().mockResolvedValue(100),
        lookupAddress: vi.fn().mockResolvedValue(null)
    }))

    return {
        Contract: ContractMock,
        ethers: {
            providers: {
                JsonRpcProvider: JsonRpcProviderMock
            },
            Contract: ContractMock,
            utils: {
                getAddress: (addr: string) => addr
            }
        },
        providers: {
            JsonRpcProvider: JsonRpcProviderMock
        },
        utils: {
            getAddress: (addr: string) => addr
        }
    }
})

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    const { ethers } = await import('ethers')

    return {
        ...actual,
        createTrustedIssuerRegistryClient: vi.fn().mockImplementation((opts: any) => {
            const provider = new ethers.providers.JsonRpcProvider()
            const contract = new ethers.Contract()
            return {
                address: opts.address || '0xregistry',
                provider,
                contract,
                isTrustedIssuer: vi.fn().mockResolvedValue(true)
            }
        }),
        trustedIssuerRegistryAbi: []
    }
})

describe('TrustedIssuerRegistryService - Sync Method Coverage', () => {
    let service: TrustedIssuerRegistryService
    let mockStore: any

    beforeEach(async () => {
        vi.clearAllMocks()

        mockStore = MockBuilder.fileStore()

        // Mock getState to return empty state initially
        mockStore.loadAll = vi.fn().mockResolvedValue({
            issuers: {},
            lastProcessedBlock: 0
        })

        service = new TrustedIssuerRegistryService({
            providerUrl: 'http://localhost:8545',
            registryAddress: '0xregistry',
            store: mockStore,
            startBlock: 0
        })
    })

    it('covers lines 123-134: syncs IssuerRemoved event for non-existing issuer', async () => {
        // Sync will query blockchain events
        // Our mock returns a removed event for an issuer not in state
        await service.sync()

        // Verify state was saved
        expect(mockStore.writeAtomic).toHaveBeenCalled()

        // Get the saved state
        const saveCall = mockStore.writeAtomic.mock.calls.find((call: any) =>
            call[0].includes('trusted-issuers/state.json')
        )

        expect(saveCall).toBeDefined()

        const savedState = saveCall[1]
        const issuerKey = '0xnonexistent'.toLowerCase()

        // Should have created a record with addedAtBlock: 0
        expect(savedState.issuers[issuerKey]).toBeDefined()
        expect(savedState.issuers[issuerKey]).toMatchObject({
            address: '0xnonexistent',
            addedAtBlock: 0,
            addedTxHash: '',
            removedAtBlock: 50,
            removedBy: '0xremover',
            removedTxHash: '0xtxremove'
        })
    })

    it('syncs when provider is behind stored block', async () => {
        // Mock state with lastProcessedBlock ahead of provider
        mockStore.loadAll = vi.fn().mockResolvedValue({
            issuers: {},
            lastProcessedBlock: 200  // Ahead of provider's 100
        })

        // Mock provider to return lower block number
        const provider = (service as any).provider
        provider.getBlockNumber = vi.fn().mockResolvedValue(50)

        await service.sync()

        // Should resync from block 0
        // Verify contract queryFilter was called
        const contract = (service as any).contract
        expect(contract.queryFilter).toHaveBeenCalled()
    })

    it('syncs IssuerAdded and then IssuerRemoved for same issuer', async () => {
        const contract = (service as any).contract

        // Override queryFilter to return both added and removed events
        contract.queryFilter = vi.fn().mockImplementation((filter: any) => {
            if (filter === 'addedFilter') {
                return Promise.resolve([{
                    args: ['0xissuer', '0xadmin'],
                    blockNumber: 40,
                    transactionHash: '0xtxadd'
                }])
            }
            if (filter === 'removedFilter') {
                return Promise.resolve([{
                    args: ['0xissuer', '0xadmin'],
                    blockNumber: 60,
                    transactionHash: '0xtxremove'
                }])
            }
            return Promise.resolve([])
        })

        await service.sync()

        // Get saved state
        const saveCall = mockStore.writeAtomic.mock.calls.find((call: any) =>
            call[0].includes('trusted-issuers/state.json')
        )

        const savedState = saveCall[1]
        const issuerKey = '0xissuer'.toLowerCase()

        // Should have a record that was added then removed
        expect(savedState.issuers[issuerKey]).toMatchObject({
            address: '0xissuer',
            addedAtBlock: 40,
            addedBy: '0xadmin',
            addedTxHash: '0xtxadd',
            removedAtBlock: 60,
            removedBy: '0xadmin',
            removedTxHash: '0xtxremove'
        })
    })

    it('syncs from specific fromBlock parameter', async () => {
        const contract = (service as any).contract

        await service.sync(25)

        // Verify queryFilter was called with fromBlock=25
        expect(contract.queryFilter).toHaveBeenCalled()
        const firstCall = contract.queryFilter.mock.calls[0]
        expect(firstCall[1]).toBe(25)  // fromBlock
    })
})
