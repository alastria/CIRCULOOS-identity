import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { FileStore } from '@circuloos/file-store'

vi.mock('@circuloos/file-store')

describe('TrustedIssuerRegistryService Errors', () => {
  let service: TrustedIssuerRegistryService
  let mockProvider: any
  let mockContract: any

  beforeEach(() => {
    mockProvider = {
        getBlockNumber: vi.fn().mockResolvedValue(10),
        lookupAddress: vi.fn().mockRejectedValue(new Error('ENS Error')),
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1 })
    }
    mockContract = {
        filters: {
            IssuerAdded: vi.fn(),
            IssuerRemoved: vi.fn(),
        },
        queryFilter: vi.fn().mockResolvedValue([]), 
        on: vi.fn(),
        removeAllListeners: vi.fn(),
        address: '0x123'
    }
    
    const mockClient = {
        provider: mockProvider,
        contract: mockContract,
        address: '0x123',
        isTrustedIssuer: vi.fn()
    }

    service = new TrustedIssuerRegistryService({
        client: mockClient as any,
        store: new FileStore('/tmp')
    })
  })

  it('safeLookup handles provider errors gracefully', async () => {
    mockContract.queryFilter.mockResolvedValueOnce([
        {
            args: ['0x1234567890123456789012345678901234567890', '0x1234567890123456789012345678901234567890'],
            blockNumber: 5,
            transactionHash: '0xtx'
        }
    ]) 

    await service.sync()
    
    expect(mockProvider.lookupAddress).toHaveBeenCalled()
    // Check we didn't crash
  })

  it('initializes with default store', () => {
      const s = new TrustedIssuerRegistryService({
          registryAddress: '0x123'
      })
      expect(s).toBeDefined()
  })

  it('stop returns early if not started', async () => {
      await service.stop()
      // Should not throw
  })

  it('handleAdded catches SQL errors', async () => {
      service.sqlStore = {
          saveIssuer: vi.fn().mockImplementation(() => { throw new Error('SQL') })
      }
      // Start to bind listeners
      await service.start()
      
      // Capture the callback passed to .on('IssuerAdded', cb)
      // mockContract.on is a mock function
      const calls = mockContract.on.mock.calls
      const addedCallback = calls.find((c: any[]) => c[0] === 'IssuerAdded')?.[1]
      
      if (addedCallback) {
          await addedCallback('0x1234567890123456789012345678901234567890', '0x1234567890123456789012345678901234567890', {
              blockNumber: 1,
              transactionHash: '0xtx'
          })
          expect(service.sqlStore.saveIssuer).toHaveBeenCalled()
      } else {
          throw new Error('Listener not registered')
      }
  })

  it('handleRemoved catches SQL errors', async () => {
      service.sqlStore = {
          removeIssuer: vi.fn().mockImplementation(() => { throw new Error('SQL') })
      }
      await service.start()
      const calls = mockContract.on.mock.calls
      const removedCallback = calls.find((c: any[]) => c[0] === 'IssuerRemoved')?.[1]
      
      if (removedCallback) {
          await removedCallback('0x1234567890123456789012345678901234567890', '0x1234567890123456789012345678901234567890', {
              blockNumber: 1,
              transactionHash: '0xtx'
          })
          expect(service.sqlStore.removeIssuer).toHaveBeenCalled()
      } else {
          throw new Error('Listener not registered')
      }
  })
})
