import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CredentialService } from '../../src/services/credential.service'

// Mock dependencies
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual<any>('@circuloos/common')
    return {
        ...actual,
        buildVC: vi.fn((subject, issuer) => ({ id: 'vc-123', credentialSubject: subject, issuer })),
        buildEmailBinding: vi.fn(() => 'email-binding-hash'),
        buildCredentialProof: vi.fn(() => ({ proof: 'dummy' }))
    }
})

describe('CredentialService', () => {
    let service: CredentialService
    let mockStore: any

    beforeEach(() => {
        mockStore = {
            loadAll: vi.fn(),
            writeAtomic: vi.fn()
        }
        service = new CredentialService(mockStore)
    })

    it('loads issuance', async () => {
        const mockData = { id: 'issuance-1' }
        mockStore.loadAll.mockResolvedValue(mockData)

        const result = await service.loadIssuance('issuance-1')
        expect(result).toEqual(mockData)
        expect(mockStore.loadAll).toHaveBeenCalledWith('issuances/issuance-1.json')
    })

    it('returns null if issuance not found', async () => {
        mockStore.loadAll.mockResolvedValue(null)
        const result = await service.loadIssuance('issuance-1')
        expect(result).toBeNull()
    })

    it('saves issuance', async () => {
        const data = { id: 'issuance-1', foo: 'bar' }
        await service.saveIssuance('issuance-1', data)
        expect(mockStore.writeAtomic).toHaveBeenCalledWith('issuances/issuance-1.json', data)
    })

    it('loads VC', async () => {
        const mockVC = { id: 'vc-1', issuer: 'did:issuer', credentialSubject: { id: '0xholder' } }
        mockStore.loadAll.mockResolvedValue(mockVC)
        const result = await service.loadVC('vc-1')
        expect(result).toEqual(mockVC)
        expect(mockStore.loadAll).toHaveBeenCalledWith('vcs/vc-1.json')
    })

    it('returns null if VC not found', async () => {
        mockStore.loadAll.mockResolvedValue({})
        const result = await service.loadVC('vc-1')
        expect(result).toBeNull()
    })

    it('saves VC', async () => {
        const data: any = { vc: { id: 'vc-1' } }
        await service.saveVC('vc-1', data)
        expect(mockStore.writeAtomic).toHaveBeenCalledWith('vcs/vc-1.json', data)
    })

    it('creates draft VC', () => {
        const result = service.createDraftVC(
            '0xholder',
            'test@example.com',
            'did:issuer',
            'secret',
            'MyCompany',
            { custom: 'claim' }
        )

        expect(result.id).toContain('issuance_')
        expect(result.draftVc).toBeDefined()
        expect(result.draftVc.issuer).toBe('did:issuer')
        expect(result.draftVc.credentialSubject.id).toBe('0xholder')
        expect(result.draftVc.credentialSubject.email).toBe('test@example.com')
        // W3C VCDM v2.0: company mapped to worksFor (Schema.org)
        expect(result.draftVc.credentialSubject.worksFor).toEqual({ '@type': 'Organization', name: 'MyCompany' })
        expect(result.draftVc.credentialSubject.custom).toBe('claim')
    })

    it('builds proof', () => {
        const proof = service.buildProof('sig', 'signer', {}, 'assertionMethod')
        expect(proof).toEqual({ proof: 'dummy' })
    })
})
