/**
 * Employee credential (CirculoosEmployeeCredential)
 *
 * Source of truth for "this person works for this organisation". The organisation
 * is identified by its legal name + tax ID + country (schema.org vocabulary), and all
 * three are covered by the issuer's EIP-712 signature (see eip712/types/circuloos-employee.ts).
 * No organisation DID registry is involved: the tax ID is the stable identifier.
 */

export const EMPLOYEE_SCHEMA_ID = 'circuloos-employee'
export const EMPLOYEE_VC_TYPE = 'CirculoosEmployeeCredential'

export type OrganizationValidationCode =
  | 'MISSING_LEGAL_NAME'
  | 'MISSING_TAX_ID'
  | 'MISSING_COUNTRY'
  | 'INVALID_COUNTRY'
  | 'MISSING_COUNTRY_PREFIX'
  | 'COUNTRY_MISMATCH'
  | 'INVALID_TAX_ID'

const MESSAGES: Record<OrganizationValidationCode, string> = {
  MISSING_LEGAL_NAME: 'organization legal name is required',
  MISSING_TAX_ID: 'organization tax ID is required',
  MISSING_COUNTRY: 'organization country is required',
  INVALID_COUNTRY: 'organization country must be an ISO 3166-1 alpha-2 code',
  MISSING_COUNTRY_PREFIX: 'organization tax ID must start with its country prefix (e.g. ESB12345678)',
  COUNTRY_MISMATCH: 'organization tax ID prefix does not match its country',
  INVALID_TAX_ID: 'organization tax ID has an invalid format',
}

export class OrganizationValidationError extends Error {
  constructor(public readonly code: OrganizationValidationCode) {
    super(MESSAGES[code])
    this.name = 'OrganizationValidationError'
  }
}

export interface Organization {
  legalName: string
  /** Country prefix + national identifier, uppercase, no separators: ESB12345678, IT01234567890, CHE123456789. */
  taxID: string
  /** ISO 3166-1 alpha-2. */
  addressCountry: string
}

/**
 * Tax-ID prefixes that differ from the ISO country code: the EU VAT prefix for Greece
 * is EL, and XI is Northern Ireland (GB). The Swiss UID (CHE…) already starts with CH.
 */
const PREFIX_TO_COUNTRY: Record<string, string> = { EL: 'GR', XI: 'GB' }

/** Validates and normalises an organisation. Throws OrganizationValidationError. */
export function normalizeOrganization(input: Partial<Organization> | undefined | null): Organization {
  const legalName = (input?.legalName ?? '').trim()
  if (!legalName) throw new OrganizationValidationError('MISSING_LEGAL_NAME')

  const rawTaxId = (input?.taxID ?? '').trim()
  if (!rawTaxId) throw new OrganizationValidationError('MISSING_TAX_ID')

  const addressCountry = (input?.addressCountry ?? '').trim().toUpperCase()
  if (!addressCountry) throw new OrganizationValidationError('MISSING_COUNTRY')
  if (!/^[A-Z]{2}$/.test(addressCountry)) throw new OrganizationValidationError('INVALID_COUNTRY')

  const taxID = rawTaxId.toUpperCase().replace(/[\s.\-/]/g, '')
  if (!/^[A-Z]{2}/.test(taxID)) throw new OrganizationValidationError('MISSING_COUNTRY_PREFIX')

  const prefix = taxID.slice(0, 2)
  if ((PREFIX_TO_COUNTRY[prefix] ?? prefix) !== addressCountry) {
    throw new OrganizationValidationError('COUNTRY_MISMATCH')
  }
  if (!/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(taxID)) throw new OrganizationValidationError('INVALID_TAX_ID')

  return { legalName, taxID, addressCountry }
}

export interface BuildEmployeeVCParams {
  holderAddress: string
  organization: Partial<Organization>
  issuer?: string
  /** Extra subject claims (e.g. email/emailBinding for the claim flow). Cannot override `id` or `worksFor`. */
  extraClaims?: Record<string, any>
  validFrom?: Date
  validityDays?: number
}

function holderDid(address: string): string {
  if (address.startsWith('did:')) return address
  const didMethod = process.env.DID_METHOD || 'alastria'
  const didNetwork = process.env.DID_NETWORK || 'quorum'
  return `did:${didMethod}:${didNetwork}:${address}`
}

/** Builds an unsigned employee VC (W3C VCDM 2.0). The organisation is validated and normalised. */
export function buildEmployeeVC(params: BuildEmployeeVCParams) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(params.holderAddress)) {
    throw new Error('holderAddress must be an Ethereum address')
  }
  const organization = normalizeOrganization(params.organization)

  const validFrom = params.validFrom ?? new Date()
  const validUntil = new Date(validFrom.getTime() + (params.validityDays ?? 365) * 24 * 60 * 60 * 1000)

  const didMethod = process.env.DID_METHOD || 'alastria'
  const didNetwork = process.env.DID_NETWORK || 'quorum'

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://schema.org',
      'https://w3id.org/security/suites/eip712signature/2023/v1',
    ],
    id: `urn:uuid:${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
    type: ['VerifiableCredential', EMPLOYEE_VC_TYPE],
    issuer: params.issuer || process.env.ISSUER_DID || `did:${didMethod}:${didNetwork}:issuer`,
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    credentialSubject: {
      ...(params.extraClaims || {}),
      id: holderDid(params.holderAddress),
      worksFor: { '@type': 'Organization', ...organization },
    },
  }
}
