import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { FileStore } from '@circuloos/file-store'

vi.mock('@circuloos/file-store')

describe('TrustedIssuerRegistryService Function Coverage', () => {
  let service: TrustedIssuerRegistryService
  let mockStore: any

  beforeEach(() => {
    mockStore = {
        loadAll: vi.fn(),
        writeAtomic: vi.fn()
    }
    // Mock FileStore constructor to return our mockStore
    ;(FileStore as any).mockImplementation(() => mockStore)

    service = new TrustedIssuerRegistryService({
        registryAddress: '0x123'
    })
  })

  it('listIssuers executes sort and filter callbacks', async () => {
      // Mock state with multiple issuers
      const state = {
          issuers: {
              '0xb': { address: '0xB', addedAtBlock: 1 },
              '0xa': { address: '0xA', addedAtBlock: 1 },
              '0xc': { address: '0xC', addedAtBlock: 1, removedAtBlock: 2 }
          },
          lastProcessedBlock: 10
      }
      mockStore.loadAll.mockResolvedValue(state)

      // 1. Call without includeRemoved (triggers filter callback)
      const list1 = await service.listIssuers()
      expect(list1).toHaveLength(2)
      expect(list1[0].address).toBe('0xA') // Sorted
      expect(list1[1].address).toBe('0xB')

      // 2. Call with includeRemoved (triggers sort callback only)
      const list2 = await service.listIssuers({ includeRemoved: true })
      expect(list2).toHaveLength(3)
      expect(list2[0].address).toBe('0xA')
      expect(list2[1].address).toBe('0xB')
      expect(list2[2].address).toBe('0xC')
  })
})

