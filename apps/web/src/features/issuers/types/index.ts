/**
 * Types for the Issuers module
 */

export interface Issuer {
  id: string
  name: string
  email: string
  walletAddress: string
  did: string
  status: "active" | "inactive" | "pending"
  trustLevel: "basic" | "verified" | "trusted"
  createdAt: string
  updatedAt: string
}

export interface RegisterIssuerRequest {
  name: string
  email: string
  walletAddress: string
}

export interface RegisterIssuerResponse {
  issuer: Issuer
  txHash: string
}

export interface IssuersListParams {
  page?: number
  limit?: number
  status?: Issuer["status"]
}

export interface IssuersListResponse {
  issuers: Issuer[]
  total: number
  page: number
  totalPages: number
}
