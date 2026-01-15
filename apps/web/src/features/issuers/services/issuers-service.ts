import { apiClient } from "@/src/shared/api/api-client"
import { API_ENDPOINTS } from "@/src/shared/config/constants"
import type {
  Issuer,
  IssuersListParams,
  IssuersListResponse,
  RegisterIssuerRequest,
  RegisterIssuerResponse,
} from "../types"

/**
 * Service Layer for Issuers
 */
export const issuersService = {
  /**
   * Get list of issuers
   */
  async list(params?: IssuersListParams): Promise<IssuersListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.limit) queryParams.set("limit", params.limit.toString())
    if (params?.status) queryParams.set("status", params.status)

    const query = queryParams.toString()
    const endpoint = `${API_ENDPOINTS.ISSUERS}${query ? `?${query}` : ""}`

    const response = await apiClient.get<IssuersListResponse>(endpoint)
    return response.data
  },

  /**
   * Get issuer by ID
   */
  async getById(id: string): Promise<Issuer> {
    const response = await apiClient.get<Issuer>(`${API_ENDPOINTS.ISSUERS}/${id}`)
    return response.data
  },

  /**
   * Register new issuer
   */
  async register(data: RegisterIssuerRequest): Promise<RegisterIssuerResponse> {
    const response = await apiClient.post<RegisterIssuerResponse>(API_ENDPOINTS.ISSUERS_REGISTER, data)
    return response.data
  },

  /**
   * Deactivate issuer
   */
  async deactivate(id: string): Promise<{ success: boolean; txHash: string }> {
    const response = await apiClient.patch<{ success: boolean; txHash: string }>(
      `${API_ENDPOINTS.ISSUERS}/${id}/deactivate`,
    )
    return response.data
  },
}
