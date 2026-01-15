import { apiClient } from "@/src/shared/api/api-client"
import { API_ENDPOINTS } from "@/src/shared/config/constants"
import type {
  Credential,
  CredentialsListParams,
  CredentialsListResponse,
  IssueCredentialRequest,
  IssueCredentialResponse,
  RevokeCredentialRequest,
  VerifyCredentialRequest,
  VerifyCredentialResponse,
} from "../types"

/**
 * Service Layer for Credentials
 * Direct API calls
 */
export const credentialsService = {
  /**
   * Get list of credentials
   */
  async list(params?: CredentialsListParams): Promise<CredentialsListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.limit) queryParams.set("limit", params.limit.toString())
    if (params?.status) queryParams.set("status", params.status)
    if (params?.issuerId) queryParams.set("issuerId", params.issuerId)

    const query = queryParams.toString()
    const endpoint = `${API_ENDPOINTS.CREDENTIALS}${query ? `?${query}` : ""}`

    const response = await apiClient.get<CredentialsListResponse>(endpoint)
    return response.data
  },

  /**
   * Get credential by ID
   */
  async getById(id: string): Promise<Credential> {
    const response = await apiClient.get<Credential>(`${API_ENDPOINTS.CREDENTIALS}/${id}`)
    return response.data
  },

  /**
   * Issue new credential
   */
  async issue(data: IssueCredentialRequest): Promise<IssueCredentialResponse> {
    const response = await apiClient.post<IssueCredentialResponse>(API_ENDPOINTS.CREDENTIALS_ISSUE, data)
    return response.data
  },

  /**
   * Verify credential
   */
  async verify(data: VerifyCredentialRequest): Promise<VerifyCredentialResponse> {
    const response = await apiClient.post<VerifyCredentialResponse>(API_ENDPOINTS.CREDENTIALS_VERIFY, data)
    return response.data
  },

  /**
   * Revoke credential
   */
  async revoke(data: RevokeCredentialRequest): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>(API_ENDPOINTS.CREDENTIALS_REVOKE, data)
    return response.data
  },
}
