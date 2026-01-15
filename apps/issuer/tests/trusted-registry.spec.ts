import { describe, expect, it, vi } from 'vitest'
import { IssuanceService } from '../src/services/issuanceService'
import { buildEip712Domain, signCredential } from '@circuloos/common'
import { Wallet } from 'ethers'

type MemoryStoreRecord = Record<string, any>

type MemoryStore = {
  data: Map<string, MemoryStoreRecord>
  writeAtomic: (key: string, value: MemoryStoreRecord) => Promise<void>
  loadAll: (key: string) => Promise<MemoryStoreRecord | undefined>
}

function createMemoryStore(): MemoryStore {
  const data = new Map<string, MemoryStoreRecord>()
  return {
    data,
    async writeAtomic(key: string, value: MemoryStoreRecord) {
      data.set(key, JSON.parse(JSON.stringify(value)))
    },
    async loadAll(key: string) {
      const value = data.get(key)
      return value ? JSON.parse(JSON.stringify(value)) : undefined
    },
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

    const svc = new IssuanceService({ store, hmacSecret: 'test-secret', trustedIssuerRegistry: registry as any })
    const { id } = await svc.prepare('user@example.test', holderWallet.address)
    const draftRecord = await store.loadAll(`issuances/${id}.json`)
    expect(draftRecord?.draft).toBeDefined()
    expect(draftRecord?.draft?.credentialSubject?.emailBinding).toBeDefined()

    const domain = buildEip712Domain('Circuloos', '1', 31337, registryAddress)
    const issuerWallet = Wallet.createRandom()
    const signature = await signCredential(issuerWallet.privateKey, domain, draftRecord!.draft)

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

    const svc = new IssuanceService({ store, hmacSecret: 'test-secret', trustedIssuerRegistry: registry as any })
    const { id } = await svc.prepare('user2@example.test', holderWallet.address)
    const draftRecord = await store.loadAll(`issuances/${id}.json`)
    expect(draftRecord?.draft).toBeDefined()

    const domain = buildEip712Domain('Circuloos', '1', 31337, registryAddress)
    const issuerWallet = Wallet.createRandom()
    const signature = await signCredential(issuerWallet.privateKey, domain, draftRecord!.draft)

    const result = await svc.mint(id, signature, issuerWallet.address, domain)
    expect(result.id).toBe(id)
    expect(result.issuer?.verificationMethod?.toLowerCase()).toBe(issuerWallet.address.toLowerCase())
    expect(registry.isTrustedIssuer).toHaveBeenCalledWith(issuerWallet.address)
  })
})
