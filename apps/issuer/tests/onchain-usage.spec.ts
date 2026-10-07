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
  }
})
import { IssuanceService } from '../src/services/issuanceService'
import { IssuanceStatus } from '@circuloos/common'
import { config } from '../src/config'

// small in-memory IStorageAdapter subset compatible with the service
// (file-store writeAtomic/loadAll API replaced by saveIssuance/loadIssuance/saveVC/loadVC)
class MemoryStore {
  issuances: Record<string, any> = {}
  vcs: Record<string, any> = {}
  async saveIssuance(id: string, val: any) { this.issuances[id] = val }
  async loadIssuance(id: string) { return this.issuances[id] ?? null }
  async saveVC(id: string, val: any) { this.vcs[id] = val }
  async loadVC(id: string) { return this.vcs[id] ?? null }
}

describe('issuer on-chain usage', () => {
  // On-chain settings now come from the typed config (config.diamond.address,
  // config.blockchain.rpcUrl, config.issuer.privateKey) read at call time by RegistryService.
  let origDiamond: string | undefined
  let origRpc: string
  let origKey: string | undefined

  beforeEach(() => {
    origDiamond = config.diamond.address
    origRpc = config.blockchain.rpcUrl
    origKey = config.issuer.privateKey
  })

  afterEach(() => {
    ;(config.diamond as any).address = origDiamond
    ;(config.blockchain as any).rpcUrl = origRpc
    ;(config.issuer as any).privateKey = origKey
    // clear mocks
    vi.resetAllMocks()
  })

  it('invokes CredentialRegistry.recordIssuance when env configured', async () => {
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
    const svc = new IssuanceService({ storage: store as any, createCredentialRegistry: factory })

    // prepare configuration for on-chain path (after construction so no live trusted-issuer
    // registry client is created; recordIssuance reads config when it runs)
    ;(config.diamond as any).address = '0x000000000000000000000000000000000000dead'
    ;(config.blockchain as any).rpcUrl = 'http://localhost:8545'
    ;(config.issuer as any).privateKey = '0x' + '11'.repeat(32)

    // create a draft issuance in store (mimic prepare)
    const id = 'issuance_test'
    const holderAddress = '0x0000000000000000000000000000000000000000'
    const vc = { id: 'vc_test', credentialSubject: { holderAddress }, holderAddress }
    await store.saveIssuance(id, { id, draft: vc, holderAddress, otpHash: 'h', expiresAt: Date.now() + 10000, status: IssuanceStatus.DRAFT })

    // call mint which should trigger on-chain path using injected factory
    const res = await svc.mint(id, '0xdead', '0xdead')

    // ensure we wrote onchain metadata file or captured record
    const onchain = await store.loadVC(`${vc.id}.onchain`)
    expect(onchain).toEqual({ txHash: '0x01', blockNumber: 1 })
    expect(recorded.vcHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(recorded.subject).toBe(holderAddress)
    expect(res.id).toBe(id)
  })
})
