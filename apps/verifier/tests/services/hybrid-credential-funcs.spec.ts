import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'

describe('HybridCredentialService Function Coverage', () => {
    let service: HybridCredentialService
    let mockStore: any
    
    beforeEach(() => {
        mockStore = {
            loadAll: vi.fn(),
            writeAtomic: vi.fn(),
        }
        service = new HybridCredentialService({
            rpcUrl: 'http://localhost:8545',
            store: mockStore
        })
    })

    it('getIndexState catches loadAll errors (covers arrow func)', async () => {
        // Mock loadAll to throw
        mockStore.loadAll.mockRejectedValue(new Error('File error'))
        
        const state = await service.getIndexState('credential')
        // Should return default state
        expect(state.records).toEqual([])
    })

    it('verifyCredentialCompliance catches loadAll errors for issued check (covers arrow func)', async () => {
        // First loadAll call throws
        mockStore.loadAll.mockRejectedValueOnce(new Error('File error'))
        
        // Provide registries to avoid other errors
        service.credentialRegistry = { isIssued: vi.fn().mockResolvedValue(false) }
        service.revocationRegistry = { isRevoked: vi.fn().mockResolvedValue(false) }

        const result = await service.verifyCredentialCompliance({
            vc: { credentialSubject: { id: 'id' } }
        })
        
        // Should fall back to chain, no crash
        expect(result.onChainStatus.issued).toBe(false)
    })

    it('verifyCredentialCompliance catches loadAll errors for revoked check (covers arrow func)', async () => {
        // First loadAll succeeds (issued found)
        mockStore.loadAll.mockResolvedValueOnce({ subject: 'id' })
        
        // Second loadAll (revoked check) throws
        mockStore.loadAll.mockRejectedValueOnce(new Error('File error'))

        const result = await service.verifyCredentialCompliance({
            vc: { credentialSubject: { id: 'id' } }
        })
        
        // Should assume not revoked if file check fails (logic: if (revokedData) ... else not revoked)
        // Wait, code: const revokedData = await ...catch(()=>null). if (revokedData) ...
        // So if throws -> null -> not revoked.
        expect(result.onChainStatus.revoked).toBe(false)
    })
})

