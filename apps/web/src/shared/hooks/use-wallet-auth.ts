"use client"

import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi"
import { useCallback, useState } from "react"
import { apiClient } from "@/src/shared/api/api-client"
import { API_ENDPOINTS } from "@/src/shared/config/constants"
import { useAuthStore } from "@/src/shared/stores/auth-store"

/**
 * Hook for wallet authentication (SIWE - Sign In With Ethereum)
 */
export function useWalletAuth() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const { login, logout, isAuthenticated, role } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Sign in with SIWE signature
   */
  const signIn = useCallback(async () => {
    if (!address) {
      setError("Wallet not connected")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Get nonce from backend
      const nonceResponse = await apiClient.get<{ nonce: string }>(`${API_ENDPOINTS.AUTH_NONCE}?address=${address}`)

      // 2. Build SIWE message
      const message = `Welcome to Alastria VC/VP

Sign this message to authenticate.

Wallet: ${address}
Nonce: ${nonceResponse.data.nonce}
Date: ${new Date().toISOString()}`

      // 3. Sign message
      const signature = await signMessageAsync({ message })

      // 4. Send signature to backend
      const authResponse = await apiClient.post<{
        token: string
        role: "admin" | "issuer" | "holder"
      }>(API_ENDPOINTS.AUTH_LOGIN, {
        address,
        message,
        signature,
      })

      // 5. Save in store
      login(address, authResponse.data.token, authResponse.data.role)
      apiClient.setAuthToken(authResponse.data.token)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication error"
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [address, signMessageAsync, login])

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT)
    } catch {
      // Ignore logout errors
    } finally {
      apiClient.clearAuthToken()
      logout()
      disconnect()
    }
  }, [logout, disconnect])

  /**
   * Connect wallet
   */
  const connectWallet = useCallback(
    (connectorId?: string) => {
      const connector = connectorId ? connectors.find((c) => c.id === connectorId) : connectors[0]

      if (connector) {
        connect({ connector })
      }
    },
    [connect, connectors],
  )

  return {
    // State
    address,
    isConnected,
    isAuthenticated,
    isLoading,
    error,
    role,
    connectors,

    // Actions
    signIn,
    signOut,
    connectWallet,
    disconnect,
  }
}
