export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED" | "EXPIRED"

export type IssuanceStatus =
  | "DRAFT"
  | "PENDING_ISSUER_SIGNATURE"
  | "ISSUED"
  | "FINALIZED"
  | "EXPIRED"
  | "FAILED"
  | "REVOKED"

export interface Application {
  id: string
  email: string
  fullName: string
  organization?: string
  walletAddress: string
  reason?: string
  status: ApplicationStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  rejectionReason?: string
  issuanceId?: string
  ipAddress?: string
}

export interface Issuance {
  id: string
  applicationId?: string
  holderEmail: string
  holderAddress: string
  credentialType: string
  attributes: Record<string, string>
  status: IssuanceStatus
  claimToken?: string
  claimTokenUsed: boolean
  claimTokenUsedAt?: string
  otp?: string
  otpExpiresAt?: string
  otpAttempts: number
  createdAt: string
  issuedAt?: string
  finalizedAt?: string
  issuerSignature?: string
  holderSignature?: string
  credential?: unknown
}

export interface WhitelistEntry {
  id: string
  type: "EMAIL" | "DOMAIN" | "WALLET" | "ORGANIZATION"
  value: string
  addedBy: string
  addedAt: string
}
