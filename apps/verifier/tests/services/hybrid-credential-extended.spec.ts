import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'
import { MockBuilder } from '../helpers/mock-builder.helper'

// Mock ethers
vi.mock('ethers', () => {
    const JsonRpcProviderMock = vi.fn()
    JsonRpcProviderMock.prototype.getBlockNumber = vi.fn().mockResolvedValue(100)
    JsonRpcProviderMock.prototype.getNetwork = vi.fn().mockResolvedValue({ chainId: 31337, name: 'test' })

    const ContractMock = vi.fn()
    ContractMock.prototype.queryFilter = vi.fn().mockResolvedValue([])
    ContractMock.prototype.filters = {
        CredentialIssued: vi.fn(),
        CredentialRevoked: vi.fn()
    }
    ContractMock.prototype.on = vi.fn()
    ContractMock.prototype.removeAllListeners = vi.fn()
    ContractMock.prototype.isIssued = vi.fn().mockResolvedValue(true)
    ContractMock.prototype.isRevoked = vi.fn().mockResolvedValue(false)

    return {
        ethers: {
            providers: {
                JsonRpcProvider: JsonRpcProviderMock
            },
            Contract: ContractMock,
            utils: {
                getAddress: (addr: string) => addr
            }
        }
    }
})

// Mock common
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual('@circuloos/common') as any
    return {
        ...actual,
        hashVC: vi.fn().mockReturnValue('0xhash123')
    }
})

describe('HybridCredentialService - Additional Coverage', () => {
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

        // Explicitly ensure no SQL store for FileStore fallback tests
        service.sqlStore = undefined
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('verifies W3C compliance with subject mismatch', async () => {
        mockStore.loadAll.mockResolvedValueOnce({
            vcHash: '0xhash123',
            subject: '0xdifferentsubject',
            issuer: '0xissuer',
            timestamp: Date.now()
        })

        const signedCredential = {
            vc: {
                credentialSubject: {
                    id: '0xholder'
                }
            }
        }

        const result = await service.verifyCredentialCompliance(signedCredential)

        expect(result.errors.length).toBeGreaterThan(0)
    })

    it('handles missing credentialSubject.id', async () => {
        const signedCredential = {
            vc: {}
        }

        const result = await service.verifyCredentialCompliance(signedCredential)

        expect(result.w3cCompliant).toBe(false)
        expect(result.errors).toContain('Missing W3C-compliant credentialSubject.id')
    })

    it('gets credentials by subject', async () => {
        mockStore.loadAll.mockResolvedValue({
            records: [
                { subject: '0xholder', vcHash: '0xhash1' },
                { subject: '0xother', vcHash: '0xhash2' }
            ],
            lastProcessedBlock: 100
        })

        const credentials = await service.getCredentialsBySubject('0xholder')

        expect(credentials).toHaveLength(1)
        expect(credentials[0].subject).toBe('0xholder')
    })

    it('gets credentials by issuer', async () => {
        mockStore.loadAll.mockResolvedValue({
            records: [
                { issuer: '0xissuer1', vcHash: '0xhash1' },
                { issuer: '0xissuer2', vcHash: '0xhash2' }
            ],
            lastProcessedBlock: 100
        })

        const credentials = await service.getCredentialsByIssuer('0xissuer1')

        expect(credentials).toHaveLength(1)
        expect(credentials[0].issuer).toBe('0xissuer1')
    })

    it('returns stats', async () => {
        mockStore.loadAll.mockResolvedValue({
            records: [{ vcHash: '0xhash1' }],
            lastProcessedBlock: 100
        })

        const stats = await service.getStats()

        expect(stats.totalCredentials).toBe(1)
        expect(stats.indexingStatus).toBeDefined()
    })

    it('stops service', async () => {
        await service.start()
        await service.stop()

        expect(service.listenersBound).toBe(false)
    })

    it('gets credential by hash from SQL store', async () => {
        const mockSqlStore = {
            getCredential: vi.fn().mockResolvedValue({ vcHash: '0xhash', issuer: '0xissuer' })
        }
        service.sqlStore = mockSqlStore

        const credential = await service.getCredentialByHash('0xhash')

        expect(credential).toBeTruthy()
        expect(credential.vcHash).toBe('0xhash')
        expect(mockSqlStore.getCredential).toHaveBeenCalledWith('0xhash')
    })

    it('falls back to FileStore when SQL store fails', async () => {
        const mockSqlStore = {
            getCredential: vi.fn().mockResolvedValue(null)
        }
        service.sqlStore = mockSqlStore
        mockStore.loadAll.mockResolvedValue({ vcHash: '0xhash', issuer: '0xissuer' })

        const credential = await service.getCredentialByHash('0xhash')

        expect(credential).toBeTruthy()
        expect(mockStore.loadAll).toHaveBeenCalled()
    })

    it('handles ENOENT error in getCredentialByHash', async () => {
        const error: any = new Error('File not found')
        error.code = 'ENOENT'
        mockStore.loadAll.mockRejectedValue(error)

        const credential = await service.getCredentialByHash('0xhash')

        expect(credential).toBeNull()
    })

    it('gets revocation by hash from SQL store', async () => {
        const mockSqlStore = {
            getRevocation: vi.fn().mockResolvedValue({ vcHash: '0xhash', revoker: '0xrevoker' })
        }
        service.sqlStore = mockSqlStore

        const revocation = await service.getRevocationByHash('0xhash')

        expect(revocation).toBeTruthy()
        expect(revocation.vcHash).toBe('0xhash')
    })

    it('handles errors in getRevocationByHash', async () => {
        mockStore.loadAll.mockRejectedValue(new Error('Unknown error'))

        const revocation = await service.getRevocationByHash('0xhash')

        expect(revocation).toBeNull()
    })

    it('gets credentials by subject from SQL store', async () => {
        const mockSqlStore = {
            listCredentials: vi.fn().mockResolvedValue([{ subject: '0xholder' }])
        }
        service.sqlStore = mockSqlStore

        const credentials = await service.getCredentialsBySubject('0xholder')

        expect(credentials).toHaveLength(1)
        expect(mockSqlStore.listCredentials).toHaveBeenCalledWith({ subject: '0xholder', includeRevoked: false })
    })

    it('gets credentials by issuer from SQL store', async () => {
        const mockSqlStore = {
            listCredentials: vi.fn().mockResolvedValue([{ issuer: '0xissuer' }])
        }
        service.sqlStore = mockSqlStore

        const credentials = await service.getCredentialsByIssuer('0xissuer')

        expect(credentials).toHaveLength(1)
        expect(mockSqlStore.listCredentials).toHaveBeenCalledWith({ issuer: '0xissuer', includeRevoked: false })
    })

    it('handles errors in getCredentialsBySubject', async () => {
        mockStore.loadAll.mockRejectedValue(new Error('Error'))

        const credentials = await service.getCredentialsBySubject('0xholder')

        expect(credentials).toEqual([])
    })

    it('handles errors in getCredentialsByIssuer', async () => {
        mockStore.loadAll.mockRejectedValue(new Error('Error'))

        const credentials = await service.getCredentialsByIssuer('0xissuer')

        expect(credentials).toEqual([])
    })

    it('verifies credential with revoked status', async () => {
        mockStore.loadAll
            .mockResolvedValueOnce({ vcHash: '0xhash', subject: '0xholder', issuer: '0xissuer' })
            .mockResolvedValueOnce({ vcHash: '0xhash', revoker: '0xrevoker' })

        const signedCredential = {
            vc: {
                credentialSubject: {
                    id: '0xholder'
                }
            }
        }

        const result = await service.verifyCredentialCompliance(signedCredential)

        expect(result.onChainStatus.revoked).toBe(true)
        expect(result.errors).toContain('Credential has been revoked on-chain')
    })
})
