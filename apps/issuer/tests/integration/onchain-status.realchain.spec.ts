/**
 * Plan A2 against a REAL local Hardhat node with the identity Diamond:
 *   A2.1 only a trusted issuer can issue;
 *   A2.2 issuance is recorded on-chain (fix P11) and revocation is applied on-chain,
 *        only by the credential's issuer (fix P13).
 * Every rejection asserts the on-chain state did not change.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Wallet } from 'ethers'
import {
  createTrustedIssuerRegistryClient,
  getCredentialType,
  hashVC,
  EMPLOYEE_SCHEMA_ID,
  REVOCATION_TYPES,
  buildRevocationMessage,
} from '@circuloos/common'
import { IssuanceService, RevocationError } from '../../src/services/issuanceService'
import { devWallet, startLocalIdentityChain, type LocalIdentityChain } from './local-chain'

vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => ({ sendClaimInfo: vi.fn() })),
}))

const backendKey = devWallet(1) // the issuer backend's on-chain signer (records and revokes)
const alastria = devWallet(2) // trusted human issuer (signs credentials in the browser)
const untrusted = devWallet(3)
const holder = devWallet(4)
const ORG = { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678', addressCountry: 'ES' }

function memoryStorage() {
  const issuances = new Map<string, any>()
  const vcs = new Map<string, any>()
  return {
    loadIssuance: async (id: string) => issuances.get(id) ?? null,
    saveIssuance: async (id: string, data: any) => void issuances.set(id, data),
    loadVC: async (id: string) => vcs.get(id) ?? null,
    saveVC: async (id: string, vc: any) => void vcs.set(id, vc),
  }
}

describe('A2 — trusted issuance and on-chain revocation (real local chain)', () => {
  let chain: LocalIdentityChain
  let service: IssuanceService

  beforeAll(async () => {
    chain = await startLocalIdentityChain()
    await (await chain.diamond.addTrustedIssuer(alastria.address)).wait()
    service = new IssuanceService({
      storage: memoryStorage() as any,
      hmacSecret: 'test-secret',
      trustedIssuerRegistry: createTrustedIssuerRegistryClient({ address: chain.diamondAddress, rpcUrl: chain.rpcUrl }),
      onchain: { diamondAddress: chain.diamondAddress, rpcUrl: chain.rpcUrl, signerKey: backendKey.privateKey },
    })
  }, 120_000)

  afterAll(async () => {
    await chain?.stop()
  })

  async function prepareEmployee() {
    return service.prepare('ana@khoani.example', holder.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: ORG,
    })
  }

  async function issueEmployee(signer: Wallet = alastria) {
    const prepared = await prepareEmployee()
    const { types, messageBuilder } = getCredentialType(EMPLOYEE_SCHEMA_ID)!.schema.issuance
    const signature = await signer._signTypedData(prepared.domain, types, messageBuilder(prepared.draftVc))
    await service.mint(prepared.id, signature, signer.address, prepared.domain)
    return prepared
  }

  async function revocationRequest(signer: Wallet, prepared: any, reason = 'revoked_by_issuer') {
    const signature = await signer._signTypedData(prepared.domain, REVOCATION_TYPES, buildRevocationMessage(prepared.draftVc.id, reason))
    return { reason, signature, signerAddress: signer.address }
  }

  it('A2.1 a wallet that is not a trusted issuer cannot issue, and nothing is recorded on-chain', async () => {
    const prepared = await prepareEmployee()
    const { types, messageBuilder } = getCredentialType(EMPLOYEE_SCHEMA_ID)!.schema.issuance
    const signature = await untrusted._signTypedData(prepared.domain, types, messageBuilder(prepared.draftVc))

    await expect(service.mint(prepared.id, signature, untrusted.address, prepared.domain)).rejects.toThrow(
      /not listed in the trusted issuer registry/,
    )
    expect(await chain.diamond.isIssued(hashVC(prepared.draftVc))).toBe(false)
    expect((await (service as any).credential.loadIssuance(prepared.id)).status).not.toBe('ISSUED')
  })

  it('A2.2/P11 a trusted issuance is recorded on-chain for the holder address', async () => {
    const prepared = await issueEmployee()
    const credentialHash = hashVC(prepared.draftVc)

    expect(await chain.diamond.isIssued(credentialHash)).toBe(true)
    const [event] = await chain.diamond.queryFilter(chain.diamond.filters.CredentialIssued(credentialHash))
    expect(event.args!.subject.toLowerCase()).toBe(holder.address.toLowerCase())
    expect(event.args!.issuer.toLowerCase()).toBe(backendKey.address.toLowerCase())

    const rec = await (service as any).credential.loadIssuance(prepared.id)
    expect(rec.onchain).toMatchObject({ status: 'recorded', credentialHash })
  })

  it('A2.2 the issuer revokes it and the chain marks it revoked', async () => {
    const prepared = await issueEmployee()
    const credentialHash = hashVC(prepared.draftVc)

    const result = await service.revoke(prepared.id, {
      wallet: alastria.address,
      role: 'issuer',
      ...(await revocationRequest(alastria, prepared)),
    })

    expect(result.revoked).toBe(true)
    expect(result.onchain?.txHash).toMatch(/^0x/)
    expect(await chain.diamond.isRevoked(credentialHash)).toBe(true)
    expect((await (service as any).credential.loadIssuance(prepared.id)).status).toBe('REVOKED')
  })

  it.each([
    ['a holder (role holder)', () => holder, 'holder', 'FORBIDDEN'],
    ['another trusted issuer who did not sign it', () => untrusted, 'issuer', 'FORBIDDEN'],
  ])('P13 %s cannot revoke, and the chain is unchanged', async (_label, who, role, code) => {
    const prepared = await issueEmployee()
    const signer = who()

    await expect(
      service.revoke(prepared.id, { wallet: signer.address, role: role as any, ...(await revocationRequest(signer, prepared)) }),
    ).rejects.toMatchObject({ code })
    expect(await chain.diamond.isRevoked(hashVC(prepared.draftVc))).toBe(false)
  })

  it('P13 a revocation request signed by someone else than the authenticated issuer is rejected', async () => {
    const prepared = await issueEmployee()
    const forged = await revocationRequest(untrusted, prepared)

    await expect(
      service.revoke(prepared.id, { wallet: alastria.address, role: 'issuer', ...forged, signerAddress: alastria.address }),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' })
    expect(await chain.diamond.isRevoked(hashVC(prepared.draftVc))).toBe(false)
  })

  it('an admin may revoke any credential; revoking twice is a clear error', async () => {
    const prepared = await issueEmployee()
    const admin = devWallet(5)
    await service.revoke(prepared.id, { wallet: admin.address, role: 'admin', ...(await revocationRequest(admin, prepared)) })
    expect(await chain.diamond.isRevoked(hashVC(prepared.draftVc))).toBe(true)

    await expect(
      service.revoke(prepared.id, { wallet: admin.address, role: 'admin', ...(await revocationRequest(admin, prepared)) }),
    ).rejects.toMatchObject({ code: 'ALREADY_REVOKED' })
  })

  it('a draft that was never issued cannot be revoked', async () => {
    const prepared = await prepareEmployee()
    await expect(
      service.revoke(prepared.id, { wallet: alastria.address, role: 'issuer', ...(await revocationRequest(alastria, prepared)) }),
    ).rejects.toBeInstanceOf(RevocationError)
  })
})
