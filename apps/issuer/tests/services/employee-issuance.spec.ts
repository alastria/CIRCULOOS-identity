/**
 * Issuing the employee credential through the real issuer flow (prepare → mint → finalize)
 * and referencing it from a marketplace credential. Plan A1.
 *
 * Real CredentialService/SecurityService and real EIP-712 signatures; only the trusted
 * issuer registry, the e-mail sender and storage are in-memory doubles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Wallet } from 'ethers'
import {
  getCredentialType,
  hashVC,
  verifyCredentialIssuance,
  EMPLOYEE_SCHEMA_ID,
  OrganizationValidationError,
} from '@circuloos/common'
import { IssuanceService } from '../../src/services/issuanceService'
import { holderWallet, otherWallet, CLAIM_DOMAIN } from '../helpers/holder-signature.helper'

vi.mock('../../src/services/registry.service', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    getTrustedRegistryAddress: vi.fn().mockReturnValue(CLAIM_DOMAIN.verifyingContract),
    isTrustedIssuer: vi.fn().mockResolvedValue(true),
    recordIssuance: vi.fn().mockResolvedValue(null),
  })),
}))
vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => ({ sendClaimInfo: vi.fn() })),
}))

const issuerWallet = new Wallet('0x' + 'a1'.repeat(32))
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

async function signWithSchema(wallet: Wallet, operation: 'issuance' | 'claim', schemaId: string, ...args: any[]) {
  const { types, messageBuilder } = getCredentialType(schemaId)!.schema[operation]
  const message = messageBuilder(...(args as [any, any, any]))
  const signature = await wallet._signTypedData(CLAIM_DOMAIN, types, message)
  return { signature, message }
}

describe('A1 — employee credential through the issuer', () => {
  let service: IssuanceService

  beforeEach(() => {
    service = new IssuanceService({ storage: memoryStorage() as any, hmacSecret: 'test-secret' })
  })

  async function issueEmployee(holder: Wallet = holderWallet) {
    const prepared = await service.prepare('ana@khoani.example', holder.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: { legalName: ' Khoani B&A S.L. ', taxID: 'es-b12345678', addressCountry: 'es' },
    })
    const { signature } = await signWithSchema(issuerWallet, 'issuance', EMPLOYEE_SCHEMA_ID, prepared.draftVc)
    const minted = await service.mint(prepared.id, signature, issuerWallet.address, CLAIM_DOMAIN)
    return { prepared, minted }
  }

  it('A1.1 prepare builds an employee draft with the normalised organisation', async () => {
    const { draftVc } = await service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: { legalName: ' Khoani B&A S.L. ', taxID: 'es-b12345678', addressCountry: 'es' },
    })
    expect(draftVc.type).toContain('CirculoosEmployeeCredential')
    expect(draftVc.credentialSubject.worksFor).toEqual({ '@type': 'Organization', ...ORG })
    expect(draftVc.credentialSubject.id.toLowerCase()).toContain(holderWallet.address.toLowerCase())
  })

  it('A1.1 mint verifies the issuer signature with the employee schema and embeds a proof that verifies', async () => {
    const { prepared, minted } = await issueEmployee()
    expect(minted).toBeTruthy()
    const issued = await (service as any).credential.loadVC(prepared.draftVc.id)
    expect(verifyCredentialIssuance(issued.proof.domain, issued, issued.proof.signature, EMPLOYEE_SCHEMA_ID)).toBe(
      issuerWallet.address,
    )
  })

  it('A1.1 mint rejects a signature made over the marketplace schema for an employee draft', async () => {
    const prepared = await service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: ORG,
    })
    const { signature } = await signWithSchema(issuerWallet, 'issuance', 'circuloos-marketplace', prepared.draftVc)
    await expect(service.mint(prepared.id, signature, issuerWallet.address, CLAIM_DOMAIN)).rejects.toThrow(
      /invalid issuer signature|signer mismatch/,
    )
  })

  it('A1.1 the holder claims it with the employee claim schema', async () => {
    const { prepared, minted } = await issueEmployee()
    const { signature, message } = await signWithSchema(
      holderWallet,
      'claim',
      EMPLOYEE_SCHEMA_ID,
      { issuerName: 'Alastria', worksFor: ORG },
      holderWallet.address,
      (minted as any).token,
    )
    const result = await service.finalize(prepared.id, {
      otp: (minted as any).otp,
      token: (minted as any).token,
      signature,
      signer: holderWallet.address,
      domain: CLAIM_DOMAIN,
      claimMessage: { ...message, timestamp: message.timestamp.toString() },
    })
    expect(result.vcId).toBe(prepared.draftVc.id)
  })

  it.each([
    ['without taxID', { legalName: 'Khoani B&A S.L.', addressCountry: 'ES' }, 'MISSING_TAX_ID'],
    ['with taxID "B12345678" (no country prefix)', { legalName: 'Khoani B&A S.L.', taxID: 'B12345678', addressCountry: 'ES' }, 'MISSING_COUNTRY_PREFIX'],
    ['without legalName', { taxID: 'ESB12345678', addressCountry: 'ES' }, 'MISSING_LEGAL_NAME'],
  ])('A1.3 prepare rejects an employee credential %s', async (_label, organization, code) => {
    const attempt = service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization,
    })
    await expect(attempt).rejects.toBeInstanceOf(OrganizationValidationError)
    await expect(attempt).rejects.toMatchObject({ code })
  })

  it('A1.3 custom claims cannot override the holder or the organisation', async () => {
    const { draftVc } = await service.prepare(
      'ana@khoani.example',
      holderWallet.address,
      undefined,
      { id: otherWallet.address, worksFor: { legalName: 'Otra', taxID: 'ESA87654321', addressCountry: 'ES' } },
      { credentialType: EMPLOYEE_SCHEMA_ID, organization: ORG },
    )
    expect(draftVc.credentialSubject.id.toLowerCase()).toContain(holderWallet.address.toLowerCase())
    expect(draftVc.credentialSubject.worksFor.taxID).toBe('ESB12345678')
  })

  it('A1.4 a marketplace credential references an issued employee credential by id and hash', async () => {
    const { prepared } = await issueEmployee()
    const employee = await (service as any).credential.loadVC(prepared.draftVc.id)

    const marketplace = await service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      employeeCredentialId: prepared.draftVc.id,
    })
    expect(marketplace.draftVc.type).toContain('CirculoosMarketplaceCredential')
    expect(marketplace.draftVc.credentialSubject.employeeCredential).toEqual({
      id: prepared.draftVc.id,
      credentialHash: hashVC(employee),
    })
  })

  it('A1.4 the reference is accepted after the employee credential was claimed (stored wrapped in a presentation)', async () => {
    const { prepared, minted } = await issueEmployee()
    const { signature, message } = await signWithSchema(holderWallet, 'claim', EMPLOYEE_SCHEMA_ID, { worksFor: ORG }, holderWallet.address, (minted as any).token)
    await service.finalize(prepared.id, {
      otp: (minted as any).otp,
      token: (minted as any).token,
      signature,
      signer: holderWallet.address,
      domain: CLAIM_DOMAIN,
      claimMessage: { ...message, timestamp: message.timestamp.toString() },
    })

    const marketplace = await service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      employeeCredentialId: prepared.draftVc.id,
    })
    expect(marketplace.draftVc.credentialSubject.employeeCredential.id).toBe(prepared.draftVc.id)
  })

  it('A1.4 the reference is rejected for another holder, an unknown id, or an unissued draft', async () => {
    const { prepared } = await issueEmployee(otherWallet)
    await expect(
      service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, { employeeCredentialId: prepared.draftVc.id }),
    ).rejects.toThrow(/different holder/)

    await expect(
      service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, { employeeCredentialId: 'urn:uuid:nope' }),
    ).rejects.toThrow(/not found/)

    const draftOnly = await service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: ORG,
    })
    await expect(
      service.prepare('ana@khoani.example', holderWallet.address, undefined, undefined, { employeeCredentialId: draftOnly.draftVc.id }),
    ).rejects.toThrow(/not found|not issued/)
  })
})
