import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// mock onchain helper and verifyCredential before importing the service
vi.mock('../src/onchain', () => ({
  createCredentialRegistry: (addr: string, signerOrProvider: any) => ({
    recordIssuance: async (vcHash: string, subject: string) => ({ wait: async () => ({ transactionHash: '0x01', blockNumber: 1 }) })
  })
}))
vi.mock('@circuloos/common', async () => {
  const actual = await vi.importActual<any>('@circuloos/common')
  return {
    ...actual,
    verifyCredential: () => '0xdead',
    config: {
      ...actual.config,
      get CREDENTIAL_REGISTRY_ADDRESS() { return process.env.CREDENTIAL_REGISTRY_ADDRESS },
      get RPC_URL() { return process.env.RPC_URL },
      get ISSUER_PRIVATE_KEY() { return process.env.ISSUER_PRIVATE_KEY }
    }
  }
})
import { IssuanceService } from '../src/services/issuanceService'
import { IssuanceStatus } from '@circuloos/common'
import * as ethers from 'ethers'

// small in-memory store compatible with the service
class MemoryStore {
  data: Record<string, any> = {}
  async writeAtomic(path: string, val: any) { this.data[path] = val }
  async loadAll(path: string) { return this.data[path] }
}

describe('issuer on-chain usage', () => {
  let origEnv: any

  beforeEach(() => {
    origEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = origEnv
    // clear mocks
    vi.resetAllMocks()
  })

  it('invokes CredentialRegistry.recordIssuance when env configured', async () => {
    // prepare environment for on-chain path
    process.env.CREDENTIAL_REGISTRY_ADDRESS = '0x000000000000000000000000000000000000dead'
    process.env.RPC_URL = 'http://localhost:8545'
    process.env.ISSUER_PRIVATE_KEY = '0x' + '11'.repeat(32)

    const store = new MemoryStore()
    // provide a factory that records calls so we can assert
    let recorded: { vcHash?: string, subject?: string } = {}
    const factory = (addr: string, signerOrProvider: any) => ({
      recordIssuance: async (vcHash: string, subject: string) => {
        recorded.vcHash = vcHash
        recorded.subject = subject
        return { wait: async () => ({ transactionHash: '0x01', blockNumber: 1 }) }
      }
    })
    const svc = new IssuanceService({ store, createCredentialRegistry: factory })

    // create a draft issuance in store (mimic prepare)
    const id = 'issuance_test'
    const holderAddress = '0x0000000000000000000000000000000000000000'
    const vc = { id: 'vc_test', credentialSubject: { holderAddress }, holderAddress }
    await store.writeAtomic(`issuances/${id}.json`, { id, draft: vc, holderAddress, otpHash: 'h', expiresAt: Date.now() + 10000, status: IssuanceStatus.DRAFT })

    // call mint which should trigger on-chain path using injected factory
    const res = await svc.mint(id, '0xdead', '0xdead')

    // ensure we wrote onchain metadata file or captured record
    const onchain = await store.loadAll(`vcs/${vc.id}.onchain.json`)
    expect(onchain?.txHash === '0x01' || !!recorded.vcHash).toBe(true)
  })
})
