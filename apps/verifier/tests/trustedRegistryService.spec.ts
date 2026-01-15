import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TrustedIssuerRegistryService } from '../src/services/trustedIssuerRegistryService'
import type { TrustedIssuerRegistryClient } from '@circuloos/common'
import { utils } from 'ethers'

type MockEvent = {
  args: [string, string]
  blockNumber: number
  transactionHash: string
}

class MockContract {
  addedEvents: MockEvent[] = []
  removedEvents: MockEvent[] = []
  listeners: Record<string, Function[]> = {}

  filters = {
    IssuerAdded: () => ({ type: 'added' }),
    IssuerRemoved: () => ({ type: 'removed' }),
  }

  queryFilter(filter: { type: string }) {
    if (filter.type === 'added') return this.addedEvents
    if (filter.type === 'removed') return this.removedEvents
    return []
  }

  on(event: string, handler: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(handler)
  }

  removeAllListeners(event: string) {
    this.listeners[event] = []
  }
}

class MockProvider {
  blockNumber = 5
  async getBlockNumber() {
    return this.blockNumber
  }
  async lookupAddress(address: string) {
    return `ens-${address.slice(2, 6)}.example`
  }
}

describe('TrustedIssuerRegistryService', () => {
  let store: { data: Record<string, any>; writeAtomic: any; loadAll: any }
  let contract: MockContract
  let provider: MockProvider
  let client: TrustedIssuerRegistryClient

  beforeEach(() => {
    store = {
      data: {},
      async writeAtomic(key: string, value: any) {
        this.data[key] = JSON.parse(JSON.stringify(value))
      },
      async loadAll(key: string) {
        return this.data[key] ? JSON.parse(JSON.stringify(this.data[key])) : {}
      },
    }
    contract = new MockContract()
    provider = new MockProvider()
    client = {
      address: utils.getAddress('0x1234000000000000000000000000000000000000'),
      provider: provider as any,
      contract: contract as any,
      async isTrustedIssuer() {
        return true
      },
    }
  })

  it('syncs added issuers and lists them', async () => {
    contract.addedEvents.push({
      args: [utils.getAddress('0xaabb000000000000000000000000000000000000'), utils.getAddress('0xccdd000000000000000000000000000000000000')],
      blockNumber: 3,
      transactionHash: '0xadd',
    })

    const service = new TrustedIssuerRegistryService({ client, store: store as any, storagePath: 'state.json' })
    await service.sync(0)

    const issuers = await service.listIssuers()
    expect(issuers).toHaveLength(1)
    expect(issuers[0].address).toBe(utils.getAddress('0xaabb000000000000000000000000000000000000'))
    expect(issuers[0].ensName).toMatch(/^ens-/)
    expect(issuers[0].addedBy).toBe(utils.getAddress('0xccdd000000000000000000000000000000000000'))
  })

  it('marks issuer as removed when removal event is processed', async () => {
    const issuerAddr = utils.getAddress('0xaabb000000000000000000000000000000000000')
    contract.addedEvents.push({
      args: [issuerAddr, utils.getAddress('0xccdd000000000000000000000000000000000000')],
      blockNumber: 3,
      transactionHash: '0xadd',
    })
    contract.removedEvents.push({
      args: [issuerAddr, utils.getAddress('0xeeff000000000000000000000000000000000000')],
      blockNumber: 6,
      transactionHash: '0xrmv',
    })

    provider.blockNumber = 10

    const service = new TrustedIssuerRegistryService({ client, store: store as any, storagePath: 'state.json' })
    await service.sync(0)

    const active = await service.listIssuers()
    expect(active).toHaveLength(0)

    const withRemoved = await service.listIssuers({ includeRemoved: true })
    expect(withRemoved).toHaveLength(1)
    expect(withRemoved[0].removedAtBlock).toBe(6)
  })

  it('reacts to live events via listeners', async () => {
    const service = new TrustedIssuerRegistryService({ client, store: store as any, storagePath: 'state.json' })
    await service.start()

    const handler = contract.listeners['IssuerAdded']?.[0]
    expect(handler).toBeDefined()
    await handler(
      utils.getAddress('0x1111000000000000000000000000000000000000'),
      utils.getAddress('0x2222000000000000000000000000000000000000'),
      { blockNumber: 12, transactionHash: '0xlive' },
    )

    const issuers = await service.listIssuers()
    expect(issuers).toHaveLength(1)
    expect(issuers[0].address).toBe(utils.getAddress('0x1111000000000000000000000000000000000000'))
  })
})
