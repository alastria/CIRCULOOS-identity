import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { MockBuilder } from '../helpers/mock-builder.helper'

/**
 * Target uncovered branches in trustedIssuerRegistryService.ts:
 * - handleAdded event handler (lines 150-184)
 * - handleRemoved event handler (lines 186-222)
 *   - Branch when existing issuer found (lines 190-196)
 *   - Branch when no existing issuer (lines 197-206)
 *   - SQL store integration and error handling
 */

// Mock ethers
vi.mock('ethers', () => {
    const ContractMock = vi.fn().mockImplementation(() => {
        const emitter = {
            listeners: new Map(),
            queryFilter: vi.fn().mockResolvedValue([]),
            filters: {
                IssuerAdded: vi.fn(),
                IssuerRemoved: vi.fn()
            },
            on: vi.fn().mockImplementation(function(event, handler) {
                this.listeners.set(event, handler)
                return this
            }),
            removeAllListeners: vi.fn()
        }
        return emitter
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

describe('TrustedIssuerRegistryService - Event Handler Coverage', () => {
    let service: TrustedIssuerRegistryService
    let mockStore: any
    let mockSqlStore: any
    let contract: any

    beforeEach(async () => {
        vi.clearAllMocks()

        mockStore = MockBuilder.fileStore()
        mockSqlStore = {
            saveIssuer: vi.fn(),
            removeIssuer: vi.fn()
        }

        // Mock getState to return empty state initially
        mockStore.loadAll = vi.fn().mockResolvedValue({
            issuers: {},
            lastProcessedBlock: 0
        })

        service = new TrustedIssuerRegistryService({
            providerUrl: 'http://localhost:8545',
            registryAddress: '0xregistry',
            store: mockStore,
            startBlock: 0,
            sqlStore: mockSqlStore
        })

        const { ethers } = await import('ethers')
        contract = (service as any).contract
    })

    describe('IssuerAdded event handler', () => {
        it('handles IssuerAdded event and saves to SQL store', async () => {
            await service.start()

            const handler = contract.listeners.get('IssuerAdded')
            expect(handler).toBeDefined()

            const issuer = '0xnewissuer'
            const addedBy = '0xadmin'
            const event = {
                blockNumber: 101,
                transactionHash: '0xtxadd'
            }

            // Call handler and await
            await handler(issuer, addedBy, event)

            // Wait a tick for async operations
            await new Promise(resolve => setImmediate(resolve))

            // Verify SQL store was called
            expect(mockSqlStore.saveIssuer).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: issuer,
                    ensName: null,
                    addedAtBlock: 101,
                    addedBy: addedBy,
                    addedTxHash: '0xtxadd'
                })
            )

            // Verify file store was updated
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })

        it('handles IssuerAdded event when SQL store throws error', async () => {
            mockSqlStore.saveIssuer = vi.fn().mockImplementation(() => {
                throw new Error('SQL error')
            })

            await service.start()

            const handler = contract.listeners.get('IssuerAdded')
            const event = { blockNumber: 102, transactionHash: '0xtx' }

            // Should not throw, error is caught
            await expect(handler('0xissuer', '0xadmin', event)).resolves.not.toThrow()

            // File store should still be called
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })

        it('handles IssuerAdded event without SQL store', async () => {
            // Create service without SQL store
            const serviceNoSql = new TrustedIssuerRegistryService({
                providerUrl: 'http://localhost:8545',
                registryAddress: '0xregistry',
                store: mockStore,
                startBlock: 0
            })

            const contractNoSql = (serviceNoSql as any).contract

            await serviceNoSql.start()

            const handler = contractNoSql.listeners.get('IssuerAdded')
            const event = { blockNumber: 103, transactionHash: '0xtx' }

            await handler('0xissuer', '0xadmin', event)

            // SQL store should not be called
            expect(mockSqlStore.saveIssuer).not.toHaveBeenCalled()

            // File store should still be called
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })
    })

    describe('IssuerRemoved event handler - existing issuer', () => {
        it('handles IssuerRemoved event for existing issuer', async () => {
            // Mock state with existing issuer
            mockStore.loadAll = vi.fn().mockResolvedValue({
                issuers: {
                    '0xexisting': {
                        address: '0xexisting',
                        ensName: 'existing.eth',
                        addedAtBlock: 50,
                        addedBy: '0xadmin',
                        addedTxHash: '0xtxadd'
                    }
                },
                lastProcessedBlock: 100
            })

            await service.start()

            const handler = contract.listeners.get('IssuerRemoved')
            expect(handler).toBeDefined()

            const issuer = '0xexisting'
            const removedBy = '0xadmin'
            const event = {
                blockNumber: 105,
                transactionHash: '0xtxremove'
            }

            await handler(issuer, removedBy, event)

            // Wait for async operations
            await new Promise(resolve => setImmediate(resolve))

            // Verify SQL store was called
            expect(mockSqlStore.removeIssuer).toHaveBeenCalledWith(
                issuer,
                105,
                removedBy,
                '0xtxremove'
            )

            // Verify file store was updated
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })

        it('handles IssuerRemoved event when SQL store throws error', async () => {
            mockStore.loadAll = vi.fn().mockResolvedValue({
                issuers: {
                    '0xexisting': {
                        address: '0xexisting',
                        ensName: null,
                        addedAtBlock: 50,
                        addedBy: '0xadmin',
                        addedTxHash: '0xtx'
                    }
                },
                lastProcessedBlock: 100
            })

            mockSqlStore.removeIssuer = vi.fn().mockImplementation(() => {
                throw new Error('SQL error')
            })

            await service.start()

            const handler = contract.listeners.get('IssuerRemoved')
            const event = { blockNumber: 106, transactionHash: '0xtx' }

            // Should not throw
            await expect(handler('0xexisting', '0xadmin', event)).resolves.not.toThrow()

            // File store should still be called
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })
    })

    describe('IssuerRemoved event handler - non-existing issuer', () => {
        it('handles IssuerRemoved event for non-existing issuer (line 197-206)', async () => {
            // Mock state WITHOUT the issuer
            mockStore.loadAll = vi.fn().mockResolvedValue({
                issuers: {},
                lastProcessedBlock: 100
            })

            await service.start()

            const handler = contract.listeners.get('IssuerRemoved')

            const issuer = '0xnewremoved'
            const removedBy = '0xadmin'
            const event = {
                blockNumber: 107,
                transactionHash: '0xtxnewremove'
            }

            await handler(issuer, removedBy, event)

            // Wait for async operations
            await new Promise(resolve => setImmediate(resolve))

            // Verify file store was updated
            expect(mockStore.writeAtomic).toHaveBeenCalled()

            // Verify SQL store was called
            expect(mockSqlStore.removeIssuer).toHaveBeenCalledWith(
                issuer,
                107,
                removedBy,
                '0xtxnewremove'
            )
        })

        it('handles IssuerRemoved for non-existing issuer without SQL store', async () => {
            mockStore.loadAll = vi.fn().mockResolvedValue({
                issuers: {},
                lastProcessedBlock: 100
            })

            // Create service without SQL store
            const serviceNoSql = new TrustedIssuerRegistryService({
                providerUrl: 'http://localhost:8545',
                registryAddress: '0xregistry',
                store: mockStore,
                startBlock: 0
            })

            const contractNoSql = (serviceNoSql as any).contract

            await serviceNoSql.start()

            const handler = contractNoSql.listeners.get('IssuerRemoved')
            const event = { blockNumber: 108, transactionHash: '0xtx' }

            await handler('0xnonexist', '0xadmin', event)

            // SQL store should not be called
            expect(mockSqlStore.removeIssuer).not.toHaveBeenCalled()

            // File store should still be called
            expect(mockStore.writeAtomic).toHaveBeenCalled()
        })
    })

    it('does not register event listeners if already bound', async () => {
        await service.start()

        // Reset mock
        contract.on = vi.fn()

        // Call start again
        await service.start()

        // Should not register listeners again
        expect(contract.on).not.toHaveBeenCalled()
    })
})
