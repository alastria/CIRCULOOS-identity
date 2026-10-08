/**
 * Employee credential (CirculoosEmployeeCredential): the holder's organisation
 * (legal name + tax ID + country) is covered by the issuer's EIP-712 signature.
 * Plan A1 (CIRCULOOS_Credencial-Empresa_Plan_v1), plus fixes P1/P2 of docs/TEST_SUITE_REPAIR.md.
 */
import { describe, it, expect } from 'vitest'
import { Wallet } from 'ethers'
import {
  buildEmployeeVC,
  normalizeOrganization,
  OrganizationValidationError,
  EMPLOYEE_SCHEMA_ID,
} from '../src/employee'
import { signCredentialIssuance, verifyCredentialIssuance, getCredentialType } from '../src/eip712'
import { buildCredentialProof } from '../src/eip712'
import { verifySignedCredential } from '../src/verifier'
import { buildVC } from '../src/issuance'
import { hashVC } from '../src/hash'

const issuer = new Wallet('0x' + 'a1'.repeat(32))
const holder = new Wallet('0x' + 'b2'.repeat(32))
const other = new Wallet('0x' + 'c3'.repeat(32))
const domain = {
  name: 'TrustedIssuerRegistry',
  version: '1.0',
  chainId: 31337,
  verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}
const ORG = { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678', addressCountry: 'ES' }

const employeeVC = () => buildEmployeeVC({ holderAddress: holder.address, organization: ORG, issuer: `did:alastria:quorum:${issuer.address}` })
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o))

describe('A1.1 Employee credential carries the organisation, covered by the issuer signature', () => {
  it('builds a VC with worksFor { legalName, taxID, addressCountry } and a DID subject', () => {
    const vc = employeeVC()
    expect(vc.type).toContain('CirculoosEmployeeCredential')
    expect(vc.credentialSubject.id).toBe(`did:alastria:quorum:${holder.address}`)
    expect(vc.credentialSubject.worksFor).toEqual({ '@type': 'Organization', ...ORG })
  })

  it('is signed with the employee schema, whose message includes the organisation, holder and exact validity', async () => {
    const vc = employeeVC()
    const schema = getCredentialType(EMPLOYEE_SCHEMA_ID)!
    const message = schema.schema.issuance.messageBuilder(vc)
    expect(message.worksFor).toEqual(ORG)
    expect(message.holder.toLowerCase()).toBe(holder.address.toLowerCase())
    expect(message.validFrom).toBe(vc.validFrom)
    expect(message.validUntil).toBe(vc.validUntil)

    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, EMPLOYEE_SCHEMA_ID)
    expect(verifyCredentialIssuance(domain, vc, signature, EMPLOYEE_SCHEMA_ID)).toBe(issuer.address)
  })

  it('is auto-detected as the employee schema from its type', async () => {
    const vc = employeeVC()
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc)
    expect(verifyCredentialIssuance(domain, vc, signature, EMPLOYEE_SCHEMA_ID)).toBe(issuer.address)
  })
})

describe('A1.2 Altering the organisation (or holder, or validity) invalidates the credential', () => {
  const tamper: Array<[string, (vc: any) => void]> = [
    ['taxID', (vc) => (vc.credentialSubject.worksFor.taxID = 'ESA87654321')],
    ['legalName', (vc) => (vc.credentialSubject.worksFor.legalName = 'Otra Empresa S.A.')],
    ['addressCountry', (vc) => (vc.credentialSubject.worksFor.addressCountry = 'PT')],
    ['holder (credentialSubject.id)', (vc) => (vc.credentialSubject.id = `did:alastria:quorum:${other.address}`)],
    ['validUntil (same day)', (vc) => (vc.validUntil = vc.validUntil.replace(/T\d\d/, 'T23'))],
  ]

  it.each(tamper)('changing %s makes the issuer signature recover a different address', async (_field, mutate) => {
    const vc = employeeVC()
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, EMPLOYEE_SCHEMA_ID)
    const forged = clone(vc)
    mutate(forged)

    const recovered = verifyCredentialIssuance(domain, forged, signature, EMPLOYEE_SCHEMA_ID)
    expect(recovered?.toLowerCase()).not.toBe(issuer.address.toLowerCase())
  })

  it('a credentialSubject.holderAddress that disagrees with the subject id is rejected (no verification result)', async () => {
    const vc = employeeVC()
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, EMPLOYEE_SCHEMA_ID)
    const forged = clone(vc)
    forged.credentialSubject.holderAddress = other.address

    expect(verifyCredentialIssuance(domain, forged, signature, EMPLOYEE_SCHEMA_ID)).toBeNull()
  })

  it('verifySignedCredential reports the tampered credential as not ok', async () => {
    const vc = employeeVC()
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, EMPLOYEE_SCHEMA_ID)
    const proof = buildCredentialProof({ signature, signer: issuer.address, domain })
    const forged = clone(vc)
    forged.credentialSubject.worksFor.taxID = 'ESA87654321'

    expect(verifySignedCredential({ vc, issuerProof: proof } as any).issuer.ok).toBe(true)
    expect(verifySignedCredential({ vc: forged, issuerProof: proof } as any).issuer.ok).toBe(false)
  })
})

describe('A1.3 Organisation validation and normalisation', () => {
  const rejected: Array<[string, any, string]> = [
    ['without taxID', { legalName: 'Khoani B&A S.L.', addressCountry: 'ES' }, 'MISSING_TAX_ID'],
    ['with taxID "B12345678" (no country prefix)', { legalName: 'Khoani B&A S.L.', taxID: 'B12345678', addressCountry: 'ES' }, 'MISSING_COUNTRY_PREFIX'],
    ['without legalName', { taxID: 'ESB12345678', addressCountry: 'ES' }, 'MISSING_LEGAL_NAME'],
    ['without addressCountry', { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678' }, 'MISSING_COUNTRY'],
    ['with a taxID prefix from another country', { legalName: 'Khoani B&A S.L.', taxID: 'PTB12345678', addressCountry: 'ES' }, 'COUNTRY_MISMATCH'],
    ['with a malformed taxID', { legalName: 'Khoani B&A S.L.', taxID: 'ES$$', addressCountry: 'ES' }, 'INVALID_TAX_ID'],
  ]

  it.each(rejected)('rejects an organisation %s', (_label, org, code) => {
    expect(() => normalizeOrganization(org)).toThrow(OrganizationValidationError)
    try {
      normalizeOrganization(org)
    } catch (err: any) {
      expect(err.code).toBe(code)
    }
  })

  it('normalises the tax ID: uppercase, no separators', () => {
    expect(normalizeOrganization({ legalName: ' Khoani B&A S.L. ', taxID: 'es b-12.345.678', addressCountry: 'es' })).toEqual(ORG)
  })

  it('accepts the EU VAT prefix EL for Greece and the Swiss UID (CHE…)', () => {
    expect(normalizeOrganization({ legalName: 'Ελληνική Α.Ε.', taxID: 'EL123456789', addressCountry: 'GR' }).taxID).toBe('EL123456789')
    expect(normalizeOrganization({ legalName: 'SUPSI', taxID: 'CHE-123.456.789', addressCountry: 'CH' }).taxID).toBe('CHE123456789')
  })

  it('buildEmployeeVC refuses an invalid organisation', () => {
    expect(() => buildEmployeeVC({ holderAddress: holder.address, organization: { legalName: 'X', addressCountry: 'ES' } as any })).toThrow(OrganizationValidationError)
  })
})

describe('A1.4 Marketplace credential references the employee credential inside its signature', () => {
  const marketplaceVC = (employee: any) =>
    buildVC(
      {
        id: holder.address,
        employeeCredential: { id: employee.id, credentialHash: hashVC(employee) },
      },
      `did:alastria:quorum:${issuer.address}`,
      'CirculoosMarketplaceCredential',
    )

  it('the issuance message includes the employee credential id and hash', () => {
    const employee = employeeVC()
    const schema = getCredentialType('circuloos-marketplace')!
    const message = schema.schema.issuance.messageBuilder(marketplaceVC(employee))
    expect(message.employeeCredentialId).toBe(employee.id)
    expect(message.employeeCredentialHash).toBe(hashVC(employee))
  })

  it('changing the referenced hash invalidates the marketplace credential', async () => {
    const vc = marketplaceVC(employeeVC())
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, 'circuloos-marketplace')
    const forged = clone(vc)
    forged.credentialSubject.employeeCredential.credentialHash = '0x' + '00'.repeat(32)

    expect(verifyCredentialIssuance(domain, vc, signature, 'circuloos-marketplace')).toBe(issuer.address)
    expect(verifyCredentialIssuance(domain, forged, signature, 'circuloos-marketplace')?.toLowerCase()).not.toBe(
      issuer.address.toLowerCase(),
    )
  })
})

describe('P1 — the marketplace issuer signature covers the real subject', () => {
  it('changing credentialSubject.id invalidates the signature', async () => {
    const vc = buildVC({ id: holder.address }, `did:alastria:quorum:${issuer.address}`, 'CirculoosMarketplaceCredential')
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, 'circuloos-marketplace')
    const forged = clone(vc)
    forged.credentialSubject.id = `did:alastria:quorum:${other.address}`

    expect(verifyCredentialIssuance(domain, forged, signature, 'circuloos-marketplace')?.toLowerCase()).not.toBe(
      issuer.address.toLowerCase(),
    )
  })

  it('a holderAddress that disagrees with credentialSubject.id is rejected', async () => {
    const vc = buildVC({ id: holder.address }, `did:alastria:quorum:${issuer.address}`, 'CirculoosMarketplaceCredential')
    const signature = await signCredentialIssuance(issuer.privateKey, domain, vc, 'circuloos-marketplace')
    const forged = clone(vc)
    forged.credentialSubject.holderAddress = other.address

    expect(verifyCredentialIssuance(domain, forged, signature, 'circuloos-marketplace')).toBeNull()
  })
})

describe('P2 — W3C holder check compares addresses, not a DID with an address', () => {
  // Holder proofs are verified through their embedded typed data (proof.eip712 + proofValue).
  const AUTH_TYPES = { HolderAuthentication: [{ name: 'holder', type: 'address' }, { name: 'credentialId', type: 'string' }] }
  async function holderProof(signer: Wallet, vc: any) {
    const message = { holder: signer.address, credentialId: vc.id }
    const proofValue = await signer._signTypedData(domain, AUTH_TYPES, message)
    return {
      type: 'Eip712Signature2023',
      proofPurpose: 'authentication',
      verificationMethod: signer.address,
      proofValue,
      eip712: { domain, types: AUTH_TYPES, primaryType: 'HolderAuthentication', message },
    }
  }
  async function signed(holderSigner: Wallet) {
    const vc = employeeVC()
    const issuerSig = await signCredentialIssuance(issuer.privateKey, domain, vc, EMPLOYEE_SCHEMA_ID)
    return {
      vc,
      issuerProof: buildCredentialProof({ signature: issuerSig, signer: issuer.address, domain }),
      holderProof: await holderProof(holderSigner, vc),
    }
  }

  it('a holder proof from the subject is accepted when the subject id is a DID', async () => {
    const result = verifySignedCredential((await signed(holder)) as any, { requireW3CCompliance: true })
    expect(result.issuer.ok).toBe(true)
    expect(result.holder?.ok).toBe(true)
  })

  it('a holder proof from someone else is rejected', async () => {
    const result = verifySignedCredential((await signed(other)) as any, { requireW3CCompliance: true })
    expect(result.holder?.ok).toBe(false)
  })
})
