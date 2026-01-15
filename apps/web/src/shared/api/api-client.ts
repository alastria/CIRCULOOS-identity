import { urls } from "@/config"

/**
 * API Client - Fetch wrapper with automatic configuration
 *
 * SECURITY NOTE: Authentication is handled via HttpOnly cookies set by the backend.
 * This client does NOT store tokens in localStorage (which would be vulnerable to XSS).
 * All requests include `credentials: 'include'` to send the HttpOnly auth cookie.
 */

export interface ApiResponse<T = unknown> {
  data: T
  success: boolean
  message?: string
}

export interface ApiError {
  message: string
  code: string
  status: number
}

class ApiClientClass {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${urls.issuer}/api/v1`
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const error: ApiError = {
        message: errorData.message || `Error HTTP: ${response.status}`,
        code: errorData.code || "UNKNOWN_ERROR",
        status: response.status,
      }
      throw error
    }

    const data = await response.json()
    return {
      data,
      success: true,
    }
  }

  private buildHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...customHeaders,
    })
    // SECURITY: No longer setting Authorization header from localStorage
    // Authentication is handled via HttpOnly cookies
    return headers
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: this.buildHeaders(options?.headers),
      credentials: 'include', // SECURITY: Send HttpOnly cookies
      ...options,
    })
    return this.handleResponse<T>(response)
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.buildHeaders(options?.headers),
      credentials: 'include', // SECURITY: Send HttpOnly cookies
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    })
    return this.handleResponse<T>(response)
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: this.buildHeaders(options?.headers),
      credentials: 'include', // SECURITY: Send HttpOnly cookies
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    })
    return this.handleResponse<T>(response)
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PATCH",
      headers: this.buildHeaders(options?.headers),
      credentials: 'include', // SECURITY: Send HttpOnly cookies
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    })
    return this.handleResponse<T>(response)
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: this.buildHeaders(options?.headers),
      credentials: 'include', // SECURITY: Send HttpOnly cookies
      ...options,
    })
    return this.handleResponse<T>(response)
  }

  /**
   * @deprecated Authentication is now handled via HttpOnly cookies.
   * This method is kept for backward compatibility but does nothing.
   */
  setAuthToken(_token: string): void {
    console.warn('[DEPRECATED] setAuthToken is deprecated. Authentication uses HttpOnly cookies.')
  }

  /**
   * @deprecated Authentication is now handled via HttpOnly cookies.
   * To logout, call the /api/v1/auth/logout endpoint which clears the cookie.
   */
  clearAuthToken(): void {
    console.warn('[DEPRECATED] clearAuthToken is deprecated. Use /api/v1/auth/logout endpoint.')
  }
}

export const apiClient = new ApiClientClass()
