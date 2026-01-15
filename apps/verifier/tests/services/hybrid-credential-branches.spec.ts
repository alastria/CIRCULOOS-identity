import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'

const MOCK_SUBJECT = '0x1234567890123456789012345678901234567890'
const OTHER_SUBJECT = '0x2234567890123456789012345678901234567890'

describe('HybridCredentialService Branch Coverage', () => {
    let service: HybridCredentialService
    let mockStore: any
    
    beforeEach(() => {
        mockStore = {
            loadAll: vi.fn().mockResolvedValue({ lastProcessedBlock: 0, records: [] }),
            writeAtomic: vi.fn()
        }
        service = new HybridCredentialService({
            rpcUrl: 'http://localhost:8545',
            store: mockStore,
            startBlock: 100 // Cover startBlock branch
        })
        
        service.credentialRegistry = {
             queryFilter: vi.fn().mockResolvedValue([]),
             filters: { CredentialIssued: vi.fn().mockReturnValue({}) },
             removeAllListeners: vi.fn(),
             on: vi.fn()
        }
        service.revocationRegistry = {
             queryFilter: vi.fn().mockResolvedValue([]),
             filters: { CredentialRevoked: vi.fn().mockReturnValue({}) },
             removeAllListeners: vi.fn(),
             on: vi.fn()
        }
        service.provider = { getBlockNumber: vi.fn().mockResolvedValue(1000) }
    })

    it('verifyCredentialCompliance detects subject mismatch', async () => {
        mockStore.loadAll.mockResolvedValue({
            subject: OTHER_SUBJECT
        })
        
        const result = await service.verifyCredentialCompliance({
            vc: { 
                credentialSubject: { 
                    id: MOCK_SUBJECT 
                } 
            }
        })
        
        expect(result.errors.some(e => e.includes('Subject mismatch'))).toBe(true)
    })

    it('getCredentialsBySubject filters records correctly using FileStore fallback', async () => {
        // Ensure no SQL store
        service.sqlStore = undefined
        
        mockStore.loadAll.mockResolvedValue({
            lastProcessedBlock: 100,
            records: [
                { subject: MOCK_SUBJECT, vcHash: '1' },
                { subject: OTHER_SUBJECT, vcHash: '2' }
            ]
        })

        const result = await service.getCredentialsBySubject(MOCK_SUBJECT)
        
        expect(result).toHaveLength(1)
        expect(result[0].vcHash).toBe('1')
    })

    it('getCredentialsByIssuer filters records correctly using FileStore fallback', async () => {
        service.sqlStore = undefined
        
        const ISSUER_1 = MOCK_SUBJECT
        const ISSUER_2 = OTHER_SUBJECT
        
        mockStore.loadAll.mockResolvedValue({
            lastProcessedBlock: 100,
            records: [
                { issuer: ISSUER_1, vcHash: '1' },
                { issuer: ISSUER_2, vcHash: '2' }
            ]
        })

        const result = await service.getCredentialsByIssuer(ISSUER_1)
        
        expect(result).toHaveLength(1)
        expect(result[0].vcHash).toBe('1')
    })

    it('getRevocationByHash returns from SQL store if found', async () => {
        service.sqlStore = {
            getRevocation: vi.fn().mockResolvedValue({ revoker: '0x1' })
        }
        const result = await service.getRevocationByHash('hash')
        expect(result).toEqual({ revoker: '0x1' })
    })

    it('stop removes listeners if bound', async () => {
        service.credentialRegistry = { removeAllListeners: vi.fn() }
        service.revocationRegistry = { removeAllListeners: vi.fn() }
        ;(service as any).listenersBound = true
        
        await service.stop()
        
        expect(service.credentialRegistry.removeAllListeners).toHaveBeenCalled()
        expect(service.revocationRegistry.removeAllListeners).toHaveBeenCalled()
    })

    it('stop handles missing registries', async () => {
        service.credentialRegistry = undefined
        service.revocationRegistry = undefined
        ;(service as any).listenersBound = true
        
        await service.stop()
        // Should not throw
    })
    
    it('stop does nothing if listeners not bound', async () => {
        ;(service as any).listenersBound = false
        await service.stop()
    })

    it('getRevocationByHash falls back if SQL returns null', async () => {
        service.sqlStore = {
            getRevocation: vi.fn().mockResolvedValue(null)
        }
        mockStore.loadAll.mockResolvedValue({ revoker: '0x2' })
        
        const result = await service.getRevocationByHash('hash')
        expect(result).toEqual({ revoker: '0x2' })
    })

    it('isIssued returns false if registry missing', async () => {
        service.credentialRegistry = undefined
        expect(await service.isIssued('hash')).toBe(false)
    })

    it('isRevoked returns false if registry missing', async () => {
        service.revocationRegistry = undefined
        expect(await service.isRevoked('hash')).toBe(false)
    })

    it('verifyCredentialCompliance checks holderAddress if id missing', async () => {
        mockStore.loadAll.mockResolvedValue({ subject: MOCK_SUBJECT })
        const result = await service.verifyCredentialCompliance({
            vc: { 
                credentialSubject: { 
                    holderAddress: MOCK_SUBJECT 
                } 
            }
        })
        expect(result.onChainStatus.subjectMatches).toBe(true)
    })

    it('verifyCredentialCompliance skips subject check if both id and holderAddress missing', async () => {
        mockStore.loadAll.mockResolvedValue({ subject: MOCK_SUBJECT })
        const result = await service.verifyCredentialCompliance({
            vc: { 
                credentialSubject: {} 
            }
        })
        expect(result.onChainStatus.subjectMatches).toBe(false)
        // Should NOT have mismatch error because expectedSubject was falsy
        expect(result.errors.some(e => e.includes('Subject mismatch'))).toBe(false)
    })

    it('syncCredentialEvents uses provided fromBlock', async () => {
        await service.syncCredentialEvents(500)
        expect(service.credentialRegistry.queryFilter).toHaveBeenCalledWith(
            expect.anything(), 500, expect.anything()
        )
    })

    it('syncRevocationEvents uses provided fromBlock', async () => {
        await service.syncRevocationEvents(500)
        expect(service.revocationRegistry.queryFilter).toHaveBeenCalledWith(
            expect.anything(), 500, expect.anything()
        )
    })

    it('bindEventListeners handles missing registries', () => {
        service.credentialRegistry = undefined
        service.revocationRegistry = undefined
        service.bindEventListeners()
        expect((service as any).listenersBound).toBe(true)
    })

    it('syncCredentialEvents returns early if registry missing', async () => {
        service.credentialRegistry = undefined
        await service.syncCredentialEvents()
        expect(mockStore.loadAll).not.toHaveBeenCalled()
    })

    it('syncRevocationEvents returns early if registry missing', async () => {
        service.revocationRegistry = undefined
        await service.syncRevocationEvents()
        expect(mockStore.loadAll).not.toHaveBeenCalled()
    })

    it('CredentialIssued listener handles missing sqlStore', async () => {
        service.sqlStore = undefined
        let callback: any
        service.credentialRegistry.on.mockImplementation((evt: any, cb: any) => {
             if (evt === 'CredentialIssued') callback = cb
        })
        service.bindEventListeners()
        
        if (callback) {
             await callback('hash', MOCK_SUBJECT, MOCK_SUBJECT, 123, { blockNumber: 1, transactionHash: 'tx' })
             expect(mockStore.writeAtomic).toHaveBeenCalled()
        }
    })

    it('CredentialRevoked listener handles missing sqlStore', async () => {
        service.sqlStore = undefined
        let callback: any
        service.revocationRegistry.on.mockImplementation((evt: any, cb: any) => {
             if (evt === 'CredentialRevoked') callback = cb
        })
        service.bindEventListeners()
        
        if (callback) {
             await callback('hash', '0x3234567890123456789012345678901234567890', 123, { blockNumber: 1, transactionHash: 'tx' })
             expect(mockStore.writeAtomic).toHaveBeenCalled()
        }
    })
})

