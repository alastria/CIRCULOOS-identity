import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HybridCredentialService } from '../src/services/hybridCredentialService'
import { TrustedIssuerRegistryService } from '../src/services/trustedIssuerRegistryService'
import { MockBuilder } from './helpers/mock-builder.helper'

// Mock ethers
vi.mock('ethers', () => {
    const JsonRpcProviderMock = vi.fn()
    JsonRpcProviderMock.prototype.getBlockNumber = vi.fn().mockResolvedValue(100)
    JsonRpcProviderMock.prototype.getNetwork = vi.fn().mockResolvedValue({ chainId: 31337, name: 'test' })
    JsonRpcProviderMock.prototype.lookupAddress = vi.fn().mockImplementation((addr: string) => {
        // Simulate ENS lookup - return null sometimes to trigger line 256-257
        return Promise.resolve(addr === '0x123' ? 'test.eth' : null)
    })

    const ContractMock = vi.fn()
    ContractMock.prototype.queryFilter = vi.fn().mockResolvedValue([])
    ContractMock.prototype.filters = {
        CredentialIssued: vi.fn(),
        CredentialRevoked: vi.fn(),
        IssuerAdded: vi.fn(),
        IssuerRemoved: vi.fn()
    }
    ContractMock.prototype.on = vi.fn()
    ContractMock.prototype.removeAllListeners = vi.fn()
    ContractMock.prototype.isIssued = vi.fn().mockResolvedValue(true)
    ContractMock.prototype.isRevoked = vi.fn().mockResolvedValue(false)
    ContractMock.prototype.isTrustedIssuer = vi.fn().mockResolvedValue(true)

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
        utils: {
            getAddress: (addr: string) => addr
        }
    }
})

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    return {
        ...actual,
        hashVC: vi.fn().mockReturnValue('0xhash')
    }
})

describe('Final Coverage Push - Comprehensive Tests', () => {
    describe('HybridCredentialService - FileStore Fallback', () => {
        let service: HybridCredentialService
        let mockStore: any

        beforeEach(() => {
            mockStore = MockBuilder.fileStore()
            service = new HybridCredentialService({
                rpcUrl: 'http://localhost:8545',
                credentialRegistryAddress: '0xcred',
                revocationRegistryAddress: '0xrev',
                store: mockStore,
                startBlock: 0
            })
            // No SQL store to force FileStore fallback
            service.sqlStore = undefined
        })

        afterEach(() => {
            vi.clearAllMocks()
        })

        it('uses FileStore fallback for getCredentials BySubject with actual filtering', async () => {
            // Mock getIndexState to return credential state
            mockStore.loadAll = vi.fn().mockResolvedValue({
                records: [
                    { subject: '0xALICE', vcHash: '0xhash1', issuer: '0xissuer1' },
                    { subject: '0xbob', vcHash: '0xhash2', issuer: '0xissuer2' },
                    { subject: '0xALICE', vcHash: '0xhash3', issuer: '0xissuer3' }
                ],
                lastProcessedBlock: 100
            })

            const results = await service.getCredentialsBySubject('0xalice')

            // Should filter case-insensitively
            expect(results).toHaveLength(2)
            expect(results.every((r: any) => r.subject.toLowerCase() === '0xalice')).toBe(true)
        })

        it('uses FileStore fallback for getCredentialsByIssuer with actual filtering', async () => {
            mockStore.loadAll = vi.fn().mockResolvedValue({
                records: [
                    { issuer: '0xISSUER1', vcHash: '0xhash1' },
                    { issuer: '0xissuer2', vcHash: '0xhash2' },
                    { issuer: '0xISSUER1', vcHash: '0xhash3' }
                ],
                lastProcessedBlock: 100
            })

            const results = await service.getCredentialsByIssuer('0xissuer1')

            // Should filter case-insensitively
            expect(results).toHaveLength(2)
            expect(results.every((r: any) => r.issuer.toLowerCase() === '0xissuer1')).toBe(true)
        })

        it('returns empty array when getCredentialsBySubject throws error', async () => {
            mockStore.loadAll = vi.fn().mockRejectedValue(new Error('Store error'))

            const results = await service.getCredentialsBySubject('0xholder')

            expect(results).toEqual([])
        })

        it('returns empty array when getCredentialsByIssuer throws error', async () => {
            mockStore.loadAll = vi.fn().mockRejectedValue(new Error('Store error'))

            const results = await service.getCredentialsByIssuer('0xissuer')

            expect(results).toEqual([])
        })
    })

    describe('TrustedIssuerRegistryService - SQL Store Path', () => {
        let service: TrustedIssuerRegistryService
        let mockStore: any
        let mockSqlStore: any

        beforeEach(() => {
            mockStore = MockBuilder.fileStore()
            mockSqlStore = {
                list: vi.fn().mockReturnValue([
                    { address: '0x123', name: 'Test Issuer', addedAtBlock: 1 }
                ])
            }

            service = new TrustedIssuerRegistryService({
                providerUrl: 'http://localhost:8545',
                registryAddress: '0xregistry',
                store: mockStore,
                startBlock: 0
            })
        })

        afterEach(() => {
            vi.clearAllMocks()
        })

        it('uses SQL store for listIssuers when available', async () => {
            // Set SQL store
            ; (service as any).sqlStore = mockSqlStore

            const result = await service.listIssuers({ includeRemoved: false })

            expect(mockSqlStore.list).toHaveBeenCalledWith(false)
            expect(result).toHaveLength(1)
            expect(result[0].address).toBe('0x123')
        })

        it('verifies service can be instantiated and has required methods', () => {
            // The safeLookup method is marked with istanbul ignore
            // We just verify the service is properly constructed
            expect(service).toBeDefined()
            expect(typeof service.start).toBe('function')
            expect(typeof service.stop).toBe('function')
            expect(typeof service.listIssuers).toBe('function')
        })
    })
})
