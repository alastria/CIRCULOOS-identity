export type EIP712Domain = {
  name: string
  version: string
  chainId: number
  verifyingContract?: string
}

export type VC = {
  id: string
  issuer: string
  issuanceDate: string
  expirationDate?: string
  credentialSubject: {
    id?: string // W3C standard: DID or address of credential subject
    commitment?: {
      algorithm: string
      value: string
      description?: string
    }
    [key: string]: any
  }
  type?: string | string[]
  "@context"?: string | string[]
  proof: CredentialProof // W3C standard: proof is required
}

export type IssuanceAudit = {
  vcId: string
  issuedAt: string
  issuer: string
}

export enum CredentialType {
  VerifiableCredential = 'VerifiableCredential',
  IdentityCredential = 'IdentityCredential',
  EmployeeCredential = 'EmployeeCredential',
  StudentCredential = 'StudentCredential',
  // Schema-specific types (map to EIP-712 schemas)
  CirculoosMarketplaceCredential = 'CirculoosMarketplaceCredential',
}

/**
 * Mapping from W3C VC type to EIP-712 schema ID
 * Used for signature verification
 */
export const CredentialTypeToSchemaId: Record<string, string> = {
  'CirculoosMarketplaceCredential': 'circuloos-marketplace',
  'IdentityCredential': 'circuloos-marketplace', // Default for now
  'EmployeeCredential': 'employee-badge', // Future
  'StudentCredential': 'student-credential', // Future
}

export type CredentialProofPurpose = 'assertionMethod' | 'authentication'

export type CredentialProof = {
  type: 'Eip712Signature2023'
  proofPurpose: CredentialProofPurpose
  verificationMethod: string
  signature: string
  created: string
  domain: EIP712Domain
}

/**
 * @deprecated Legacy format - use VC with embedded proof instead
 * This type will be removed in a future version
 */
export type SignedCredential = {
  vc: VC
  issuerProof: CredentialProof
  holderProof?: CredentialProof
}

export type VP = {
  '@context': string | string[]
  type: string | string[]
  holder: string
  verifiableCredential: VC[] // W3C standard: array of VCs with embedded proofs
  proof?: CredentialProof // VP proof (optional for presentation)
}

export enum IssuanceStatus {
  DRAFT = 'DRAFT',
  PENDING_ISSUER_SIGNATURE = 'PENDING_ISSUER_SIGNATURE',
  ISSUED = 'ISSUED',
  CLAIMED = 'CLAIMED'
}

export type IssuanceRecord = {
  id: string
  otpHash: string
  createdAt: number
  expiresAt: number
  status: IssuanceStatus
  draft?: VC
  issuerProof?: CredentialProof
  holderProof?: CredentialProof
  holderAddress?: string
  tokenIssuedAt?: number
  lastClaimedAt?: number
  claimedByAddress?: string
  domain?: EIP712Domain
}
