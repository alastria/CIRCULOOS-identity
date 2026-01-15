import { IssuanceStatus } from './types'

export function buildIssuanceDraft(id: string, otpHash: string, expiresAt: number) {
  return {
    id,
    otpHash,
    createdAt: Date.now(),
    expiresAt,
    status: IssuanceStatus.DRAFT
  }
}

import { CredentialType } from './types'

export function buildVC(subject: Record<string, any>, issuer?: string, type: CredentialType | string = CredentialType.VerifiableCredential) {
  const baseTypes = Array.isArray(type) ? type : [CredentialType.VerifiableCredential, type].filter(Boolean)

  // Ensure we have IdentityCredential if not present
  if (!baseTypes.includes('IdentityCredential')) {
    baseTypes.push('IdentityCredential')
  }

  // Ensure W3C compliance: subject id must be a DID
  let subjectId = subject.id || subject.holderAddress
  if (subjectId && !subjectId.startsWith('did:')) {
    // Assume it's an Ethereum address if it starts with 0x
    if (subjectId.startsWith('0x')) {
      const didMethod = process.env.DID_METHOD || 'alastria'
      const didNetwork = process.env.DID_NETWORK || 'quorum'
      subjectId = `did:${didMethod}:${didNetwork}:${subjectId}`
    } else {
      subjectId = `urn:uuid:${subjectId}`
    }
  }

  const credentialSubject = {
    ...subject,
    id: subjectId
  }

  // Remove holderAddress from subject if it's redundant with id, but keep it if needed for other purposes
  // Ideally, we map 'company' to 'worksFor' here if possible, or let the caller handle it.
  // For now, we'll keep custom fields but ensure context covers them or we accept they are "custom".

  // W3C v2.0: Use validFrom/validUntil instead of issuanceDate/expirationDate
  const now = new Date()
  const validFrom = now.toISOString()
  const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString() // Default 1 year validity

  const didMethod = process.env.DID_METHOD || 'alastria'
  const didNetwork = process.env.DID_NETWORK || 'quorum'
  const defaultIssuerDid = process.env.ISSUER_DID || `did:${didMethod}:${didNetwork}:issuer`

  const vc: any = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://schema.org',
      'https://w3id.org/security/suites/eip712signature/2023/v1'
    ],
    id: `urn:uuid:${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // Ensure URN UUID format
    type: Array.from(new Set(baseTypes)),
    issuer: issuer || defaultIssuerDid,
    validFrom,
    validUntil,
    credentialSubject,
  }

  return vc
}
