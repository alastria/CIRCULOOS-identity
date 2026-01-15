'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { api } from '@/lib/api'
import { config } from '../config'

export function useAlastriaAuth() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'holder' | 'issuer' | 'admin' | null>(null)

  // Check if user is already authenticated (by trying a protected endpoint)
  useEffect(() => {
    const checkAuth = async () => {
      if (!isConnected || !address) {
        setIsAuthenticated(false)
        setUserRole(null)
        return
      }

      // In a real implementation, you might want to call a /auth/me endpoint
      // to check if the current session is valid
      // For now, we'll assume the user is authenticated if they have a connected wallet
    }

    checkAuth()
  }, [isConnected, address])

  const signIn = async () => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // 1. Get nonce and issuedAt from backend
      const { nonce, issuedAt } = await api.issuer.getAuthChallenge(address)

      // 2. Construct SIWE message (EIP-4361 Standard)
      // Use centralized config for consistency
      const appUrl = config.appUrl
      const domain = new URL(appUrl).host
      const chainId = '31337' // TODO: Add chainId to frontend config if needed, or fetch from wallet

      const siweMessage = `${domain} wants you to sign in with your Ethereum account:
${address}

Quiero autenticarme en Alastria VC Platform

URI: ${appUrl}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`

      // 3. Sign message (MetaMask will show nice UI)
      const signature = await signMessageAsync({ message: siweMessage })

      // 4. Verify SIWA (backend saves JWT in HttpOnly cookie automatically)
      const response = await api.issuer.verifySIWA(address, signature, nonce)

      // 5. Update state
      setIsAuthenticated(true)
      setUserRole(response.role as 'holder' | 'issuer' | 'admin')
      setIsAuthenticating(false)

      return response
    } catch (error: any) {
      console.error('SIWA authentication failed:', error)
      setAuthError(error.message || 'Authentication failed')
      setIsAuthenticated(false)
      setUserRole(null)
      setIsAuthenticating(false)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await api.issuer.logout()
      setIsAuthenticated(false)
      setUserRole(null)
      setAuthError(null)
    } catch (error: any) {
      console.error('Logout failed:', error)
      // Even if logout fails, clear local state
      setIsAuthenticated(false)
      setUserRole(null)
    }
  }

  return {
    signIn,
    signOut,
    isAuthenticated,
    isAuthenticating,
    authError,
    userRole,
    address,
    isConnected,
  }
}
