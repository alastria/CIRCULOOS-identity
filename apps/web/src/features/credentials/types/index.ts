/**
 * Types for the Credentials module
 */

export interface Credential {
  id: string
  type: string[]
  issuer: {
    id: string
    name: string
    address: string
  }
  holder: {
    id: string
    address: string
  }
  credentialSubject: Record<string, unknown>
  issuanceDate: string
  expirationDate?: string
  status: "active" | "revoked" | "expired" | "pending"
  proof?: CredentialProof
}

export interface CredentialProof {
  type: string
  created: string
  proofPurpose: string
  verificationMethod: string
  jws?: string
  eip712?: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
  }
}

export interface IssueCredentialRequest {
  recipientEmail: string
  recipientWallet: string
  credentialType: string
  companyName: string
  claims?: Record<string, unknown>
}

export interface IssueCredentialResponse {
  credential: Credential
  claimToken: string
  claimUrl: string
}

export interface VerifyCredentialRequest {
  credential: Credential | string
}

export interface VerifyCredentialResponse {
  valid: boolean
  checks: {
    signature: boolean
    expiration: boolean
    revocation: boolean
    issuerTrust: boolean
  }
  errors?: string[]
}

export interface RevokeCredentialRequest {
  credentialId: string
  reason?: string
}

export interface CredentialsListParams {
  page?: number
  limit?: number
  status?: Credential["status"]
  issuerId?: string
}

export interface CredentialsListResponse {
  credentials: Credential[]
  total: number
  page: number
  totalPages: number
}
