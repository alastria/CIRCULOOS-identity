"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

/**
 * Get Snap ID from environment variable
 * REQUIRED: NEXT_PUBLIC_SNAP_ID must be set
 * - Development: local:http://localhost:8080
 * - Production: npm:@circuloos/snap
 */
const getSnapId = (): string => {
  const snapId = process.env.NEXT_PUBLIC_SNAP_ID

  if (!snapId) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ NEXT_PUBLIC_SNAP_ID is required in production')
      return ''
    }
    console.warn('⚠️ NEXT_PUBLIC_SNAP_ID not set. Set it in .env.local')
    return ''
  }

  return snapId
}

// Get snap ID dynamically (will be calculated when needed)
const getSnapIdValue = () => getSnapId()

interface SnapRpcRequest {
  method: string
  params?: unknown
}

export function useCirculoosSnap() {
  const { t } = useI18n()
  const [isInstalled, setIsInstalled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check if snap is already installed
  useEffect(() => {
    const checkSnap = async () => {
      if (typeof window === "undefined" || !window.ethereum) return

      try {
        const snaps = (await window.ethereum.request({
          method: "wallet_getSnaps",
        })) as Record<string, unknown>

        const snapId = getSnapIdValue()
        setIsInstalled(!!snaps[snapId])
      } catch {
        // MetaMask not available or snaps not supported
      }
    }

    checkSnap()
  }, [])

  const installSnap = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error(t("snap.notInstalled"))
      return false
    }

    setIsLoading(true)
    try {
      const snapId = getSnapIdValue()

      // Check if it's a local snap and verify the server is running
      if (snapId.startsWith('local:')) {
        const snapUrl = snapId.replace('local:', '')
        try {
          const response = await fetch(snapUrl, { method: 'HEAD', mode: 'no-cors' })
          // If we get here, the server is likely running (no-cors means we can't check status)
        } catch (fetchError) {
          // Server might not be ready yet, but we'll let MetaMask handle the error
          console.warn('Snap server may not be ready:', fetchError)
        }
      }

      await window.ethereum.request({
        method: "wallet_requestSnaps",
        params: {
          [snapId]: {},
        },
      })
      setIsInstalled(true)
      toast.success("MetaMask Snap installed successfully")
      return true
    } catch (error: any) {
      console.error("Error installing snap:", error)

      // Provide more helpful error messages
      if (error?.message?.includes('Failed to fetch') || error?.code === -32603) {
        const snapId = getSnapIdValue()
        if (snapId.startsWith('local:')) {
          toast.error(t("snap.serverNotAvailable"))
        } else {
          toast.error(t("snap.connectionError"))
        }
      } else {
        toast.error(error?.message || t("snap.installError"))
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const invokeSnap = useCallback(
    async (request: SnapRpcRequest) => {
      if (!isInstalled) {
        const installed = await installSnap()
        if (!installed) return null
      }

      try {
        const snapId = getSnapIdValue()
        const response = await window.ethereum?.request({
          method: "wallet_invokeSnap",
          params: {
            snapId,
            request,
          },
        })
        return response
      } catch (error) {
        console.error("Snap invocation error:", error)
        toast.error(t("snap.communicationError"))
        return null
      }
    },
    [isInstalled, installSnap, t],
  )

  // Updated to match snap's actual RPC method: save_vc
  const saveCredential = useCallback(
    async (vc: unknown) => {
      const result = await invokeSnap({
        method: "save_vc",
        params: { vc },
      })

      if (result) {
        toast.success("Credential saved to MetaMask Snap")
      }

      return result
    },
    [invokeSnap],
  )

  // Updated to match snap's actual RPC method: get_vcs
  // Now passes the connected wallet address for cryptographic filtering
  const getCredentials = useCallback(
    async (type?: string, holderAddress?: string) => {
      const params: { type?: string; holderAddress?: string } = {}
      if (type) params.type = type
      if (holderAddress) params.holderAddress = holderAddress

      return invokeSnap({
        method: "get_vcs",
        params: Object.keys(params).length > 0 ? params : undefined,
      })
    },
    [invokeSnap],
  )

  // New method to create Verifiable Presentations
  const createPresentation = useCallback(
    async (vcIds: string[], holderAddress: string, expiresInMinutes?: number) => {
      return invokeSnap({
        method: "create_vp",
        params: { vcIds, holderAddress, expiresInMinutes },
      })
    },
    [invokeSnap],
  )

  // Delete a specific credential
  const deleteCredential = useCallback(
    async (vcId: string) => {
      const result = await invokeSnap({
        method: "delete_vc",
        params: { vcId },
      })

      if (result) {
        toast.success("All credentials cleared from Snap")
      }

      return result
    },
    [invokeSnap],
  )

  // Clear all credentials from the Snap
  const clearAllCredentials = useCallback(
    async () => {
      const result = await invokeSnap({
        method: "clear_all",
      }) as { success: boolean; deletedCount: number } | null

      if (result?.success) {
        toast.success(`${result.deletedCount} credenciales eliminadas del Snap`)
      }

      return result
    },
    [invokeSnap],
  )

  return {
    isInstalled,
    isLoading,
    installSnap,
    saveCredential,
    getCredentials,
    createPresentation,
    deleteCredential,
    clearAllCredentials,
    invokeSnap,
  }
}

// Type declaration for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown }) => Promise<unknown>
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}
