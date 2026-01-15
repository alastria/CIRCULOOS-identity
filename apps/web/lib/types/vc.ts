// Verifiable Credential Types based on W3C VCDM

export interface VCContext {
  url: string
  name: string
  description: string
  isStandard: boolean
}

export interface VCProof {
  type: string
  created: string
  proofPurpose: string
  verificationMethod: string
  signature?: string
  // EIP-712 specific
  eip712?: {
    domain: {
      name: string
      version: string
      chainId: number
      verifyingContract: string
    }
    types: Record<string, Array<{ name: string; type: string }>>
    primaryType: string
    message: Record<string, unknown>
  }
  // JWS specific
  jws?: string
}

export interface VCIssuer {
  id: string
  name?: string
  url?: string
  image?: string
  description?: string
  // Extracted
  ethereumAddress?: string
  ensName?: string
  didType?: string
}

export interface VCCredentialSubject {
  id?: string
  [key: string]: unknown
}

export interface VCEvidence {
  type: string
  id?: string
  verifier?: string
  verificationDate?: string
  description?: string
  documentPresence?: string
}

export interface VCTermsOfUse {
  type: string
  id?: string
  prohibition?: string[]
  obligation?: string[]
}

export interface VCCredentialStatus {
  type: string
  id: string
  statusListIndex?: string
  statusListCredential?: string
}

export interface VCRefreshService {
  type: string
  id: string
}

export interface VerifiableCredential {
  "@context": string | string[]
  id?: string
  type: string | string[]
  issuer: string | VCIssuer
  issuanceDate: string
  expirationDate?: string
  credentialSubject: VCCredentialSubject
  proof?: VCProof | VCProof[]
  evidence?: VCEvidence[]
  termsOfUse?: VCTermsOfUse[]
  credentialStatus?: VCCredentialStatus
  refreshService?: VCRefreshService
}

// Analysis Results
export type VCStatus = "active" | "expiring" | "expired" | "revoked" | "draft"

export interface VCValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  vcVersion: "1.0" | "1.1" | "2.0" | "unknown"
  proofType: string | null
}

export interface VCIssuerAnalysis {
  did: string
  didType: string
  name: string | null
  ethereumAddress: string | null
  ensName: string | null
  url: string | null
  image: string | null
  isTrusted: boolean
  trustLevel: "verified" | "unverified" | "unknown"
  signatureValid: boolean | null
}

export interface VCHolderAnalysis {
  did: string | null
  didType: string | null
  ethereumAddress: string | null
  ensName: string | null
  name: string | null
  claims: Array<{
    key: string
    value: unknown
    type: "string" | "number" | "boolean" | "date" | "url" | "email" | "hash" | "object" | "array"
    isProtected: boolean
  }>
  signatureValid: boolean | null
  privacyLevel: "low" | "medium" | "high"
}

export interface VCSecurityScore {
  score: number
  maxScore: number
  level: "untrusted" | "low" | "medium" | "high" | "very-high"
  checks: Array<{
    name: string
    passed: boolean
    points: number
    description: string
  }>
  recommendations: string[]
}

export interface VCBlockchainStatus {
  isRegistered: boolean
  isRevoked: boolean
  registrationDate: string | null
  revocationDate: string | null
  revokedBy: string | null
  transactionHash: string | null
  batchInfo: {
    batchId: number
    merkleRoot: string
    position: number
    ipfsCid: string | null
  } | null
}

export interface VCTimelineEvent {
  id: string
  type:
    | "created"
    | "signed-issuer"
    | "sent"
    | "signed-holder"
    | "registered"
    | "batched"
    | "revoked"
    | "expired"
    | "current"
  date: string | null
  actor: string | null
  description: string
  transactionHash?: string
}

export interface VCAnalysis {
  raw: VerifiableCredential
  validation: VCValidationResult
  status: VCStatus
  issuer: VCIssuerAnalysis
  holder: VCHolderAnalysis
  contexts: VCContext[]
  proofs: VCProof[]
  security: VCSecurityScore
  blockchain: VCBlockchainStatus | null
  timeline: VCTimelineEvent[]
  hash: string
  issuanceDate: Date
  expirationDate: Date | null
  daysUntilExpiration: number | null
}

export type VCInputMethod = "upload" | "paste" | "url" | "snap" | "direct"

export type VCPageState = "empty" | "parsing" | "validating" | "analyzing" | "display" | "error"
