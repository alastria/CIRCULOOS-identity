import { describe, expect, it, vi } from 'vitest'
import { IssuanceService } from '../src/services/issuanceService'
import { buildEip712Domain } from '@circuloos/common'
import { Wallet } from 'ethers'
import { signIssuance } from './helpers/holder-signature.helper'

type MemoryStoreRecord = Record<string, any>

// In-memory IStorageAdapter subset (the service no longer uses the file-store
// writeAtomic/loadAll API; it calls saveIssuance/loadIssuance/saveVC/loadVC)
type MemoryStore = {
  issuances: Map<string, MemoryStoreRecord>
  vcs: Map<string, MemoryStoreRecord>
  saveIssuance: (id: string, value: MemoryStoreRecord) => Promise<void>
  loadIssuance: (id: string) => Promise<MemoryStoreRecord | null>
  saveVC: (id: string, value: MemoryStoreRecord) => Promise<void>
  loadVC: (id: string) => Promise<MemoryStoreRecord | null>
}

function createMemoryStore(): MemoryStore {
  const issuances = new Map<string, MemoryStoreRecord>()
  const vcs = new Map<string, MemoryStoreRecord>()
  const clone = (v: any) => (v ? JSON.parse(JSON.stringify(v)) : null)
  return {
    issuances,
    vcs,
    async saveIssuance(id, value) { issuances.set(id, clone(value)) },
    async loadIssuance(id) { return clone(issuances.get(id)) },
    async saveVC(id, value) { vcs.set(id, clone(value)) },
    async loadVC(id) { return clone(vcs.get(id)) },
  }
}

describe('IssuanceService trusted issuer registry integration', () => {
  it('rejects minting when signer is not trusted', async () => {
    const store = createMemoryStore()
    const registryAddress = Wallet.createRandom().address
    const holderWallet = Wallet.createRandom()
    const registry = {
      address: registryAddress,
      provider: {} as any,
      contract: {} as any,
      isTrustedIssuer: vi.fn().mockResolvedValue(false),
    }

    const svc = new IssuanceService({ storage: store as any, hmacSecret: 'test-secret', trustedIssuerRegistry: registry as any })
    const { id } = await svc.prepare('user@example.test', holderWallet.address)
    const draftRecord = await store.loadIssuance(id)
    expect(draftRecord?.draft).toBeDefined()
    expect(draftRecord?.draft?.credentialSubject?.emailBinding).toBeDefined()

    const domain = buildEip712Domain('Circuloos', '1', 31337, registryAddress)
    const issuerWallet = Wallet.createRandom()
    // Signed with the current circuloos-marketplace issuance types (post 6a34ad5)
    const signature = await signIssuance(issuerWallet, domain, draftRecord!.draft)

    await expect(svc.mint(id, signature, issuerWallet.address, domain)).rejects.toThrow('issuer signer is not listed in the trusted issuer registry')
    expect(registry.isTrustedIssuer).toHaveBeenCalledWith(issuerWallet.address)
  })

  it('allows minting when signer is trusted', async () => {
    const store = createMemoryStore()
    const registryAddress = Wallet.createRandom().address
    const holderWallet = Wallet.createRandom()
    const registry = {
      address: registryAddress,
      provider: {} as any,
      contract: {} as any,
      isTrustedIssuer: vi.fn().mockResolvedValue(true),
    }

    const svc = new IssuanceService({ storage: store as any, hmacSecret: 'test-secret', trustedIssuerRegistry: registry as any })
    const { id } = await svc.prepare('user2@example.test', holderWallet.address)
    const draftRecord = await store.loadIssuance(id)
    expect(draftRecord?.draft).toBeDefined()

    const domain = buildEip712Domain('Circuloos', '1', 31337, registryAddress)
    const issuerWallet = Wallet.createRandom()
    // Signed with the current circuloos-marketplace issuance types (post 6a34ad5)
    const signature = await signIssuance(issuerWallet, domain, draftRecord!.draft)

    const result = await svc.mint(id, signature, issuerWallet.address, domain)
    expect(result.id).toBe(id)
    expect(result.issuer?.verificationMethod?.toLowerCase()).toBe(issuerWallet.address.toLowerCase())
    expect(registry.isTrustedIssuer).toHaveBeenCalledWith(issuerWallet.address)
  })
})
