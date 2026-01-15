import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'

const MOCK_ISSUER = '0x1234567890123456789012345678901234567890'
const MOCK_SUBJECT = '0x2234567890123456789012345678901234567890'

// Mock ethers to force constructor error
vi.mock('ethers', () => {
    return {
        ethers: {
            providers: { JsonRpcProvider: vi.fn() },
            Contract: vi.fn().mockImplementation((address) => {
                if (address === 'invalid-address') throw new Error('Invalid address')
                return {}
            }),
            utils: { getAddress: (a: string) => a }
        }
    }
})

vi.mock('@circuloos/common', () => ({
    hashVC: vi.fn().mockReturnValue('0xhash')
}))

describe('HybridCredentialService Errors', () => {
  let service: HybridCredentialService
  let mockStore: any
  
  beforeEach(() => {
      mockStore = {
          loadAll: vi.fn(), // returns undefined by default
          writeAtomic: vi.fn(),
      }
      service = new HybridCredentialService({
          rpcUrl: 'http://localhost:8545',
          store: mockStore
      })
  })

  it('constructor handles invalid registry address gracefully', () => {
      const s = new HybridCredentialService({
          rpcUrl: 'http://localhost:8545',
          credentialRegistryAddress: 'invalid-address',
          revocationRegistryAddress: 'invalid-address',
          store: mockStore
      })
      expect(s.credentialRegistry).toBeUndefined()
      expect(s.revocationRegistry).toBeUndefined()
  })

  it('verifyCredentialCompliance handles on-chain errors', async () => {
      service.credentialRegistry = {
          isIssued: vi.fn().mockRejectedValue(new Error('Contract Error'))
      }
      
      const result = await service.verifyCredentialCompliance({
          vc: { credentialSubject: { id: 'did:ethr:0x123' } }
      })
      
      expect(result.errors.some(e => e.includes('On-chain verification failed'))).toBe(true)
  })

  it('getCredentialByHash handles ENOENT', async () => {
      const error: any = new Error('File not found')
      error.code = 'ENOENT'
      mockStore.loadAll.mockRejectedValue(error)
      
      const result = await service.getCredentialByHash('hash')
      expect(result).toBeNull()
  })

  it('getCredentialByHash handles other errors', async () => {
      mockStore.loadAll.mockRejectedValue(new Error('Other Error'))
      
      const result = await service.getCredentialByHash('hash')
      expect(result).toBeNull()
  })

  it('getCredentialsBySubject catches sqlStore errors', async () => {
      service.sqlStore = {
          listCredentials: vi.fn().mockRejectedValue(new Error('SQL Error'))
      }
      const result = await service.getCredentialsBySubject('subject')
      expect(result).toEqual([])
  })

  it('getCredentialsByIssuer catches sqlStore errors', async () => {
      service.sqlStore = {
          listCredentials: vi.fn().mockRejectedValue(new Error('SQL Error'))
      }
      const result = await service.getCredentialsByIssuer('issuer')
      expect(result).toEqual([])
  })
  
  it('getRevocationByHash handles ENOENT', async () => {
      const error: any = new Error('File not found')
      error.code = 'ENOENT'
      mockStore.loadAll.mockRejectedValue(error)
      
      const result = await service.getRevocationByHash('hash')
      expect(result).toBeNull()
  })

  it('getRevocationByHash handles other errors', async () => {
      mockStore.loadAll.mockRejectedValue(new Error('Other Error'))
      
      const result = await service.getRevocationByHash('hash')
      expect(result).toBeNull()
  })

  it('verifyCredentialCompliance reports not found when not issued', async () => {
      service.credentialRegistry = {
          isIssued: vi.fn().mockResolvedValue(false)
      }
      service.revocationRegistry = {
          isRevoked: vi.fn().mockResolvedValue(false)
      }
      // Ensure loadAll returns null (simulating not found in index)
      mockStore.loadAll.mockResolvedValue(null)
      
      const result = await service.verifyCredentialCompliance({
          vc: { credentialSubject: { id: 'did:ethr:0x123' } }
      })
      
      // Check if any error message contains our target string
      const found = result.errors.some(e => e.includes('Credential not found on-chain'))
      if (!found) {
          console.log('Errors found:', result.errors)
      }
      expect(found).toBe(true)
  })

  it('CredentialIssued listener handles SQL store failure', async () => {
      service.sqlStore = { saveCredentialRecord: vi.fn().mockRejectedValue(new Error('SQL Error')) }
      
      service.credentialRegistry = {
          on: vi.fn(),
          filters: { CredentialIssued: vi.fn() },
          removeAllListeners: vi.fn()
      }
      
      let callback: any
      service.credentialRegistry.on.mockImplementation((evt: any, cb: any) => { if(evt==='CredentialIssued') callback = cb })
      service.bindEventListeners()
      
      if (callback) {
          // Should not throw due to try-catch block around sqlStore call
          await callback('hash', MOCK_ISSUER, MOCK_SUBJECT, 123, { blockNumber: 1, transactionHash: 'tx' })
          expect(service.sqlStore.saveCredentialRecord).toHaveBeenCalled()
      }
  })

  it('CredentialRevoked listener handles SQL store failure', async () => {
      service.sqlStore = { saveRevocationRecord: vi.fn().mockRejectedValue(new Error('SQL Error')) }
      
      service.revocationRegistry = {
          on: vi.fn(),
          filters: { CredentialRevoked: vi.fn() },
          removeAllListeners: vi.fn()
      }
      
      let callback: any
      service.revocationRegistry.on.mockImplementation((evt: any, cb: any) => { if(evt==='CredentialRevoked') callback = cb })
      service.bindEventListeners()
      
      if (callback) {
          await callback('hash', '0x3234567890123456789012345678901234567890', 123, { blockNumber: 1, transactionHash: 'tx' })
          expect(service.sqlStore.saveRevocationRecord).toHaveBeenCalled()
      }
  })
})
