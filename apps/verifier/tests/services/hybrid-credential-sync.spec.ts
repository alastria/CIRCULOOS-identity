import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'

const MOCK_ISSUER = '0x1234567890123456789012345678901234567890'
const MOCK_SUBJECT = '0x2234567890123456789012345678901234567890'
const MOCK_REVOKER = '0x3234567890123456789012345678901234567890'

describe('HybridCredentialService Sync Coverage', () => {
    let service: HybridCredentialService
    let mockStore: any
    let mockCredentialRegistry: any
    let mockRevocationRegistry: any

    beforeEach(() => {
        mockStore = {
            loadAll: vi.fn().mockResolvedValue({ lastProcessedBlock: 0, records: [] }),
            writeAtomic: vi.fn()
        }
        mockCredentialRegistry = {
            filters: { CredentialIssued: vi.fn() },
            queryFilter: vi.fn().mockResolvedValue([]),
            on: vi.fn(),
            removeAllListeners: vi.fn()
        }
        mockRevocationRegistry = {
            filters: { CredentialRevoked: vi.fn() },
            queryFilter: vi.fn().mockResolvedValue([]),
            on: vi.fn(),
            removeAllListeners: vi.fn()
        }

        service = new HybridCredentialService({
            rpcUrl: 'http://localhost:8545',
            store: mockStore
        })
        service.credentialRegistry = mockCredentialRegistry
        service.revocationRegistry = mockRevocationRegistry
        // Mock provider
        service.provider = {
            getBlockNumber: vi.fn().mockResolvedValue(100)
        }
    })

    it('syncCredentialEvents processes historical events', async () => {
        mockCredentialRegistry.queryFilter.mockResolvedValue([
            {
                args: ['0xhash', MOCK_ISSUER, MOCK_SUBJECT, 123],
                blockNumber: 50,
                transactionHash: '0xtx'
            }
        ])

        await service.syncCredentialEvents()

        expect(mockStore.writeAtomic).toHaveBeenCalledWith(
            'onchain/issued/0xhash.json',
            expect.objectContaining({ vcHash: '0xhash' })
        )
    })

    it('syncRevocationEvents processes historical events', async () => {
        mockRevocationRegistry.queryFilter.mockResolvedValue([
            {
                args: ['0xhash', MOCK_REVOKER, 123],
                blockNumber: 60,
                transactionHash: '0xtx'
            }
        ])

        await service.syncRevocationEvents()

        expect(mockStore.writeAtomic).toHaveBeenCalledWith(
            'onchain/revoked/0xhash.json',
            expect.objectContaining({ vcHash: '0xhash' })
        )
    })

    it('syncCredentialEvents resets start block if provider is behind', async () => {
        // Current state says block 200
        mockStore.loadAll.mockResolvedValue({ lastProcessedBlock: 200, records: [] })
        // Provider says block 100
        service.provider.getBlockNumber = vi.fn().mockResolvedValue(100)

        await service.syncCredentialEvents()

        // Should query from 0
        expect(mockCredentialRegistry.queryFilter).toHaveBeenCalledWith(undefined, 0, 100)
    })

    it('syncRevocationEvents resets start block if provider is behind', async () => {
        mockStore.loadAll.mockResolvedValue({ lastProcessedBlock: 200, records: [] })
        service.provider.getBlockNumber = vi.fn().mockResolvedValue(100)

        await service.syncRevocationEvents()

        expect(mockRevocationRegistry.queryFilter).toHaveBeenCalledWith(undefined, 0, 100)
    })
    
    it('syncCredentialEvents handles SQL store if present', async () => {
        service.sqlStore = {
            saveCredentialRecord: vi.fn().mockRejectedValue(new Error('SQL Error')) // Should catch
        }
        mockCredentialRegistry.queryFilter.mockResolvedValue([
            {
                args: ['0xhash', MOCK_ISSUER, MOCK_SUBJECT, 123],
                blockNumber: 50,
                transactionHash: '0xtx'
            }
        ])
        await service.syncCredentialEvents()
        expect(service.sqlStore.saveCredentialRecord).toHaveBeenCalled()
    })

    it('syncRevocationEvents handles SQL store if present', async () => {
        service.sqlStore = {
            saveRevocationRecord: vi.fn().mockRejectedValue(new Error('SQL Error')) // Should catch
        }
        mockRevocationRegistry.queryFilter.mockResolvedValue([
            {
                args: ['0xhash', MOCK_REVOKER, 123],
                blockNumber: 60,
                transactionHash: '0xtx'
            }
        ])
        await service.syncRevocationEvents()
        expect(service.sqlStore.saveRevocationRecord).toHaveBeenCalled()
    })
})
