"use client"

import type React from "react"
import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Shield,
  Wallet,
  FileSignature,
  CheckCircle2,
  Loader2,
  Download,
  ArrowRight,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  ExternalLink,
  XCircle,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n/provider"
import { useClaimStore, type ClaimStep } from "@/lib/stores/claim-store"
import { useCirculoosSnap } from "@/hooks/use-circuloos-snap"
import { useAccount, useChainId, useConnect, useSignTypedData, useSwitchChain } from "wagmi"
import { injected } from "wagmi/connectors"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAlastriaAuth } from "@/hooks/use-alastria-auth"
import { getCredentialType } from "@circuloos/common/eip712"
import { normalizeAddress } from "@/lib/utils/did"

// MetaMask Fox SVG
const MetaMaskLogo = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M43.4 4L26.5 16.6L29.6 9.1L43.4 4Z" fill="#E17726" />
    <path d="M4.6 4L21.3 16.7L18.4 9.1L4.6 4Z" fill="#E27625" />
    <path d="M37.3 32.3L32.8 39.2L42.4 41.9L45.2 32.5L37.3 32.3Z" fill="#E27625" />
    <path d="M2.8 32.5L5.6 41.9L15.2 39.2L10.7 32.3L2.8 32.5Z" fill="#E27625" />
    <path d="M14.7 20.8L12 24.9L21.5 25.3L21.2 15L14.7 20.8Z" fill="#E27625" />
    <path d="M33.3 20.8L26.7 14.9L26.5 25.3L36 24.9L33.3 20.8Z" fill="#E27625" />
    <path d="M15.2 39.2L21 36.4L16 32.6L15.2 39.2Z" fill="#E27625" />
    <path d="M27 36.4L32.8 39.2L32 32.6L27 36.4Z" fill="#E27625" />
    <path d="M32.8 39.2L27 36.4L27.5 40.1L27.4 41.8L32.8 39.2Z" fill="#D5BFB2" />
    <path d="M15.2 39.2L20.6 41.8L20.5 40.1L21 36.4L15.2 39.2Z" fill="#D5BFB2" />
    <path d="M20.7 30.1L15.9 28.7L19.3 27.1L20.7 30.1Z" fill="#233447" />
    <path d="M27.3 30.1L28.7 27.1L32.2 28.7L27.3 30.1Z" fill="#233447" />
    <path d="M15.2 39.2L16 32.3L10.7 32.5L15.2 39.2Z" fill="#CC6228" />
    <path d="M32 32.3L32.8 39.2L37.3 32.5L32 32.3Z" fill="#CC6228" />
    <path d="M36 24.9L26.5 25.3L27.3 30.1L28.7 27.1L32.2 28.7L36 24.9Z" fill="#CC6228" />
    <path d="M15.9 28.7L19.3 27.1L20.7 30.1L21.5 25.3L12 24.9L15.9 28.7Z" fill="#CC6228" />
    <path d="M12 24.9L16 32.6L15.9 28.7L12 24.9Z" fill="#E27625" />
    <path d="M32.2 28.7L32 32.6L36 24.9L32.2 28.7Z" fill="#E27625" />
    <path d="M21.5 25.3L20.7 30.1L21.7 35.1L22 28.3L21.5 25.3Z" fill="#E27625" />
    <path d="M26.5 25.3L26 28.2L26.3 35.1L27.3 30.1L26.5 25.3Z" fill="#E27625" />
    <path d="M27.3 30.1L26.3 35.1L27 36.4L32 32.6L32.2 28.7L27.3 30.1Z" fill="#F5841F" />
    <path d="M15.9 28.7L16 32.6L21 36.4L21.7 35.1L20.7 30.1L15.9 28.7Z" fill="#F5841F" />
    <path
      d="M27.4 41.8L27.5 40.1L27 39.7H21L20.5 40.1L20.6 41.8L15.2 39.2L17 40.7L20.9 43.5H27.1L31 40.7L32.8 39.2L27.4 41.8Z"
      fill="#C0AC9D"
    />
    <path d="M27 36.4L26.3 35.1H21.7L21 36.4L20.5 40.1L21 39.7H27L27.5 40.1L27 36.4Z" fill="#161616" />
    <path
      d="M44.1 17.4L45.5 11.2L43.4 4L27 15.8L33.3 20.8L42.1 23.4L44.2 20.9L43.3 20.3L44.7 19L43.6 18.2L45 17.1L44.1 17.4Z"
      fill="#763E1A"
    />
    <path
      d="M2.5 11.2L3.9 17.4L3 17.1L4.4 18.2L3.3 19L4.7 20.3L3.8 20.9L5.9 23.4L14.7 20.8L21 15.8L4.6 4L2.5 11.2Z"
      fill="#763E1A"
    />
    <path d="M42.1 23.4L33.3 20.8L36 24.9L32 32.6L37.3 32.5L45.2 32.5L42.1 23.4Z" fill="#F5841F" />
    <path d="M14.7 20.8L5.9 23.4L2.8 32.5L10.7 32.5L16 32.6L12 24.9L14.7 20.8Z" fill="#F5841F" />
    <path
      d="M26.5 25.3L27 15.8L29.6 9.1H18.4L21 15.8L21.5 25.3L21.7 28.3L21.7 35.1H26.3L26.3 28.3L26.5 25.3Z"
      fill="#F5841F"
    />
  </svg>
)

export default function ClaimPage() {
  const params = useParams()
  // Get token from URL params
  // Next.js may auto-decode URL params, but we handle both cases
  const rawToken = params.token as string
  let token = rawToken || ""

  // Try to decode if it looks encoded (contains %)
  // But be careful: Next.js might have already decoded it
  if (token && token.includes('%')) {
    try {
      token = decodeURIComponent(token)
    } catch (e) {
      // If decoding fails, use original token (might already be decoded)
      // console.warn('Token decoding failed, using as-is:', e)
    }
  }

  const { t } = useI18n()
  const activeChainId = useChainId()
  const { address, isConnected } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()
  const { saveCredential, isInstalled, installSnap } = useCirculoosSnap()
  const { signIn, isAuthenticating, isAuthenticated } = useAlastriaAuth()

  const {
    step,
    setStep,
    setToken,
    otp,
    setOtp,
    validateOtp,
    resendOtp,
    isLoading,
    error,
    credentialPreview,
    setCredentialPreview,
    claimedCredential,
    setClaimedCredential,
    setLoading,
    setError,
    otpAttempts,
    maxOtpAttempts,
  } = useClaimStore()

  // Get the expected chainId from backend domain or use environment variable
  // The chainId comes from NEXT_PUBLIC_DEFAULT_CHAIN_ID or NEXT_PUBLIC_CHAIN_ID env var
  // Use useMemo to avoid initialization issues
  // Use process.env directly to avoid validation errors on import
  const expectedChainId = useMemo(() => {
    // First, try to use the chainId from backend domain (most authoritative)
    if (credentialPreview?.attributes?.domain?.chainId) {
      return credentialPreview.attributes.domain.chainId
    }

    // Otherwise, use environment variable (REQUIRED)
    // Try NEXT_PUBLIC_CHAIN_ID first (more specific), then NEXT_PUBLIC_DEFAULT_CHAIN_ID
    const envChainId = process.env.NEXT_PUBLIC_CHAIN_ID || process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID
    if (envChainId) {
      const parsed = Number.parseInt(String(envChainId), 10)
      if (!isNaN(parsed)) {
        return parsed
      }
    }

    // No fallback - env var must be set
    // console.error('NEXT_PUBLIC_DEFAULT_CHAIN_ID or NEXT_PUBLIC_CHAIN_ID must be set')
    return 0
  }, [credentialPreview?.attributes?.domain?.chainId])

  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null) // Timestamp from backend (in seconds)
  const [walletMismatch, setWalletMismatch] = useState(false)

  // Validate token on mount
  useEffect(() => {
    if (token) {
      // Validate token format before using it
      if (!isValidTokenFormat(token)) {
        setError(t("claim.errors.invalidToken"))
        setStep("invalid")
        return
      }
      setToken(token)
      validateToken()
    } else {
      setError(t("claim.errors.invalidToken"))
      setStep("invalid")
    }
  }, [token])

  // Helper function to validate token format
  const isValidTokenFormat = (token: string): boolean => {
    if (!token || typeof token !== 'string') return false
    // Token should be in format: base64data.hexsignature
    const parts = token.split('.')
    if (parts.length !== 2) return false
    // Check if parts are not empty
    if (!parts[0] || !parts[1]) return false
    // Check if signature is hex (64 chars for sha256)
    if (!/^[a-f0-9]{64}$/i.test(parts[1])) return false
    return true
  }

  const validateToken = async () => {
    setStep("loading")
    setError(null)
    try {
      // Ensure token is properly formatted before sending
      const cleanToken = token.trim()
      if (!isValidTokenFormat(cleanToken)) {
        setError(t("claim.errors.invalidToken"))
        setStep("invalid")
        return
      }

      // Call backend to validate token and get credential info
      const tokenInfo = await api.issuer.getTokenInfo(cleanToken)

      if (!tokenInfo.valid) {
        setError(t("claim.errors.invalidToken"))
        setStep("invalid")
        return
      }

      // Check if already claimed
      if (tokenInfo.status === 'CLAIMED') {
        setError(t("claim.errors.alreadyClaimed"))
        setStep("invalid")
        return
      }

      // Check if not yet issued (needs mint first)
      if (tokenInfo.status === 'DRAFT') {
        setError(t("claim.errors.notIssued"))
        setStep("invalid")
        return
      }

      // Store the issuance ID for finalize
      // The token contains the ID, but we also get it from the API response
      setCredentialPreview({
        type: tokenInfo.credentialType || "VerifiableCredential",
        issuer: tokenInfo.issuer || "Alastria Issuer",
        holderAddress: tokenInfo.holderAddress,
        attributes: {
          status: tokenInfo.status,
          // expiresAt comes in milliseconds from backend, convert to ISO string
          expiresAt: tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : undefined,
          issuanceId: tokenInfo.id, // Store ID for finalize
          domain: tokenInfo.domain, // Store domain from backend
        },
        issuedAt: new Date().toISOString(),
      })

      // Store OTP expiration timestamp from backend (persistent, doesn't reset on refresh)
      // Backend returns timestamp in milliseconds, convert to seconds for timer
      if (tokenInfo.expiresAt) {
        setOtpExpiresAt(Math.floor(tokenInfo.expiresAt / 1000))
      }

      // Start with wallet connection step
      setStep("connect")
    } catch (err: any) {
      // console.error('Token validation error:', err)
      setError(err?.response?.data?.error || err?.message || t("claim.errors.tokenValidationError"))
      setStep("invalid")
    }
  }

  // OTP countdown timer - uses backend expiresAt (persistent, doesn't reset on refresh)
  const [otpTimeLeft, setOtpTimeLeft] = useState(0)

  useEffect(() => {
    if (step === "validate" && otpExpiresAt) {
      // Calculate time left from backend timestamp (in seconds)
      // This ensures the timer is persistent and doesn't reset on page refresh
      const updateTimeLeft = () => {
        const now = Math.floor(Date.now() / 1000) // Current time in seconds
        const timeLeft = Math.max(0, otpExpiresAt - now)
        setOtpTimeLeft(timeLeft)

        // If expired, show error
        if (timeLeft === 0 && step === "validate") {
          setError(t("claim.errors.expiredToken"))
          setStep("invalid")
        }
      }

      // Update immediately
      updateTimeLeft()

      // Update every second
      const timer = setInterval(updateTimeLeft, 1000)
      return () => clearInterval(timer)
    } else if (!otpExpiresAt && step === "validate") {
      // If no expiresAt, set to 0 (shouldn't happen, but handle gracefully)
      setOtpTimeLeft(0)
    }
  }, [step, otpExpiresAt, t, setError, setStep])

  // Check wallet match when connected
  useEffect(() => {
    if (isConnected && address && credentialPreview) {
      const matches = address.toLowerCase() === credentialPreview.holderAddress.toLowerCase()
      setWalletMismatch(!matches)

      // When wallet is connected and matches, authenticate with SIWA
      if (matches && step === "connect" && !isAuthenticated && !isAuthenticating) {
        // Authenticate automatically
        handleAuthenticate()
      }
    }
  }, [isConnected, address, credentialPreview, step, isAuthenticated, isAuthenticating])

  // Handle SIWA authentication after wallet connection
  const handleAuthenticate = async () => {
    if (!address) return

    try {
      setLoading(true)
      await signIn()
      // After successful authentication, move to OTP validation
      setStep("validate")
      toast.success("Autenticación exitosa")
    } catch (error: any) {
      // console.error("Authentication error:", error)
      setError(error.message || "Error al autenticar. Por favor, intenta de nuevo.")
      toast.error("Error al autenticar")
    } finally {
      setLoading(false)
    }
  }

  const handleOtpComplete = async (value: string) => {
    setOtp(value)
    if (value.length === 6) {
      await validateOtp()
    }
  }

  const handleResendOtp = async () => {
    const success = await resendOtp()
    if (success) {
      // When OTP is resent, we need to get new expiresAt from backend
      // For now, we'll refresh token info to get new expiration
      try {
        const tokenInfo = await api.issuer.getTokenInfo(token)
        if (tokenInfo.expiresAt) {
          // Backend returns timestamp in milliseconds, convert to seconds for timer
          setOtpExpiresAt(Math.floor(tokenInfo.expiresAt / 1000))
        }
      } catch (err) {
        // console.error("Error refreshing token info:", err)
      }
      toast.success(t("claim.messages.otpResent"))
    } else {
      toast.error(t("claim.errors.resendFailed"))
    }
  }

  const handleSign = async () => {
    if (!address) return

    setLoading(true)
    setError(null)
    setStep("claiming")

    try {
      // CRITICAL: Check if user is on the correct network
      // The backend expects chainId 2020 (Alastria), so we must use that for the domain
      // But MetaMask requires the active chainId to match the domain chainId
      if (activeChainId !== expectedChainId) {
        // console.warn(`[WARN] ChainId mismatch: Active=${activeChainId}, Expected=${expectedChainId}. Switching network...`)
        try {
          await switchChain({ chainId: expectedChainId })
          // Wait a moment for the network switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (switchError: any) {
          // User rejected network switch or switch failed
          if (switchError.code === 4001) {
            setError(t("claim.errors.networkSwitchCancelled") || "Network switch cancelled. Please switch to Alastria network manually.")
          } else {
            // Get network name from environment or default based on chainId
            const networkName = expectedChainId === 31337
              ? (process.env.NEXT_PUBLIC_NETWORK_NAME || "Hardhat Local")
              : (process.env.NEXT_PUBLIC_NETWORK_NAME || "Alastria Red-T")
            setError(t("claim.errors.networkSwitchFailed") || `Please switch your wallet to ${networkName} network (Chain ID: ${expectedChainId})`)
          }
          setStep("sign")
          setLoading(false)
          return
        }
      }

      // Get domain from backend (stored in credentialPreview) or use default
      const backendDomain = credentialPreview?.attributes?.domain as any

      // Use domain from backend with its original chainId (2020)
      // DO NOT change the chainId - it must match what the backend expects
      let domain: any
      if (backendDomain && typeof backendDomain === 'object' && backendDomain.name && backendDomain.version) {
        // Use backend domain as-is - it has the correct chainId (2020)
        domain = backendDomain
        // console.log('[DEBUG] Using backend domain with chainId:', domain.chainId)
      } else {
        // Backend domain is missing or incomplete - build complete domain
        // Use same defaults as backend (from config)
        const domainName = process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME || "TrustedIssuerRegistry"
        const domainVersion = process.env.NEXT_PUBLIC_EIP712_DOMAIN_VERSION || "1.0"
        const verifyingContract = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS || process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT

        domain = {
          name: domainName,
          version: domainVersion,
          chainId: expectedChainId, // Use expected chainId (2020), not active chainId
        }

        // Add verifyingContract if available (normalize to plain address)
        if (verifyingContract) {
          domain.verifyingContract = normalizeAddress(verifyingContract)
        }

        // console.warn(`[WARN] Backend domain missing or incomplete. Built domain:`, domain)
      }

      // console.log('[DEBUG] Finalize - Domain:', JSON.stringify(domain))
      // console.log('[DEBUG] Finalize - Active ChainId:', activeChainId)
      // console.log('[DEBUG] Finalize - Expected ChainId:', expectedChainId)
      // console.log('[DEBUG] Finalize - Backend Domain:', JSON.stringify(backendDomain))

      // Use new schema system for beautiful UX
      const credentialType = 'circuloos-marketplace'
      const schema = getCredentialType(credentialType)

      if (!schema) {
        throw new Error(`Credential type ${credentialType} not found`)
      }

      // Build message using schema's message builder
      const timestamp = Date.now()
      const { primaryType, types, messageBuilder } = schema.schema.claim
      const message = messageBuilder(credentialPreview, address, token)

      // console.log('[DEBUG] Claim message:', message)

      // Request signature with beautiful UX!
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType,
        message,
      })

      // Get the issuance ID from credential preview (stored during token validation)
      const issuanceId = credentialPreview?.attributes?.issuanceId
      if (!issuanceId) {
        throw new Error(t("claim.errors.issuanceIdNotFound"))
      }

      // Ensure token is valid before finalizing
      const cleanToken = token.trim()
      if (!isValidTokenFormat(cleanToken)) {
        throw new Error(t("claim.errors.invalidToken"))
      }

      // Serialize the message for sending to backend
      // Convert BigInt to string for JSON serialization
      const serializableMessage = JSON.parse(JSON.stringify(message, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))

      // console.log('[DEBUG] Finalize Request:', {
      //   issuanceId,
      //   token: cleanToken.substring(0, 20) + '...',
      //   otp: '***',
      //   signature: signature.substring(0, 20) + '...',
      //   signer: address,
      //   timestamp: timestamp.toString(),
      //   domain,
      //   claimMessage: serializableMessage
      // })

      // Call real backend API with the correct issuance ID
      // Note: Backend validates OTP here, so if OTP is wrong, it will throw an error
      // Send the claim message so backend can verify with the exact same data
      const result = await api.issuer.finalize(
        issuanceId,
        cleanToken,
        otp,
        signature,
        address,
        domain,
        timestamp.toString(), // Send timestamp for signature verification
        serializableMessage // Send the exact message that was signed (serialized)
      )

      // Backend returns { vcId, holder }. We need to fetch the full VC.
      // Since we don't have the signature headers ready for the GET /credentials/:id endpoint
      // (it requires a specific auth signature), we might need to update the backend
      // to return the full VC on finalize, or we mock the preview for now.

      // For now, we construct a "claimed" object to show success
      const credential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "Credential"],
        id: result.vcId, // Use the vcId returned from backend
        issuer: "did:ethr:issuer",
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: result.holder.verificationMethod,
        },
        proof: {
          type: "EcdsaSecp256k1Signature2019",
          created: new Date().toISOString(),
          proofPurpose: "assertionMethod",
          verificationMethod: result.holder.verificationMethod,
          proofValue: signature,
        },
      }

      setClaimedCredential(credential as any)
      setStep("success")
      toast.success(t("claim.success.title"))
    } catch (err: unknown) {
      // console.error("Signing error:", err)

      // Extract error message safely
      let errorMessage = t("claim.errors.signatureFailed")
      let isOtpError = false
      let shouldGoBackToValidate = false

      if (err && typeof err === 'object') {
        const error = err as any

        // Check if it's a user rejection (MetaMask)
        if (error.code === 4001 || error.message?.includes("User rejected")) {
          errorMessage = t("claim.errors.signatureCancelled")
        }
        // Check if it's a backend error (API response)
        else if (error.response?.data?.error) {
          const backendError = error.response.data.error
          // console.error("Backend error:", backendError)

          if (typeof backendError === 'string') {
            // Check if it's an OTP error
            const lowerError = backendError.toLowerCase()
            if (lowerError.includes("otp") || lowerError.includes("invalid otp") || lowerError.includes("código")) {
              errorMessage = t("claim.errors.invalidOTP")
              isOtpError = true
              shouldGoBackToValidate = true
              // Increment OTP attempts
              const currentAttempts = otpAttempts
              if (currentAttempts < maxOtpAttempts) {
                // The store will handle this, but we need to update it
                setError(errorMessage)
              }
            }
            // Check if it's an invalid token error
            else if (lowerError.includes("invalid token") || lowerError.includes("token")) {
              errorMessage = t("claim.errors.invalidToken")
              // Go back to validate step to re-validate token
              shouldGoBackToValidate = true
            }
            // Check if it's a signature error
            else if (lowerError.includes("signature") || lowerError.includes("signer")) {
              errorMessage = backendError // Show the specific signature error
            }
            // Check if it's a status error
            else if (lowerError.includes("status") || lowerError.includes("not found") || lowerError.includes("expired")) {
              errorMessage = backendError // Show the specific status error
            }
            else {
              // Show the backend error message directly for better debugging
              errorMessage = backendError
            }
          } else if (typeof backendError === 'object') {
            // If backendError is an object, try to extract message
            errorMessage = backendError.message || JSON.stringify(backendError) || t("claim.errors.signatureFailed")
          } else {
            errorMessage = t("claim.errors.signatureFailed")
          }
        }
        // Check if it's an axios error with message
        else if (error.message) {
          const lowerMessage = error.message.toLowerCase()
          if (lowerMessage.includes("otp") || lowerMessage.includes("invalid otp")) {
            errorMessage = t("claim.errors.invalidOTP")
            isOtpError = true
            shouldGoBackToValidate = true
          } else {
            errorMessage = error.message
          }
        }
      } else if (typeof err === 'string') {
        const lowerErr = err.toLowerCase()
        if (lowerErr.includes("otp") || lowerErr.includes("invalid otp")) {
          errorMessage = t("claim.errors.invalidOTP")
          isOtpError = true
          shouldGoBackToValidate = true
        } else {
          errorMessage = err
        }
      }

      // Ensure errorMessage is always a string
      const safeErrorMessage = typeof errorMessage === 'string' ? errorMessage : t("claim.errors.signatureFailed")

      // If it's an OTP error, go back to validate step
      if (shouldGoBackToValidate) {
        setStep("validate")
        // Clear OTP input to allow retry
        setOtp("")
        // Increment OTP attempts in store
        setError(safeErrorMessage, true)
        toast.error(safeErrorMessage)
      } else {
        setStep("sign")
        setError(safeErrorMessage, false)
        toast.error(safeErrorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadJSON = () => {
    if (!claimedCredential) return

    const blob = new Blob([JSON.stringify(claimedCredential, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `credential_${token.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t("claim.messages.credentialDownloaded"))
  }

  const handleDownloadPDF = async () => {
    if (!claimedCredential || !credentialPreview) {
      toast.error(t("claim.errors.issuanceIdNotFound"))
      return
    }

    try {
      setLoading(true)

      // Get VC ID from credential or issuance ID
      const vcId = claimedCredential.id || credentialPreview?.attributes?.issuanceId
      if (!vcId) {
        throw new Error(t("claim.errors.issuanceIdNotFound"))
      }

      // Download PDF from backend
      const pdfBlob = await api.issuer.downloadPDF(vcId)

      // Create download link
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Credential_${vcId.slice(-8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(t("claim.messages.pdfDownloaded"))
    } catch (err: any) {
      // console.error("PDF download error:", err)
      toast.error(err?.response?.data?.error || err?.message || t("claim.errors.signatureFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToSnap = async () => {
    if (!claimedCredential) {
      toast.error("No credential to save")
      return
    }

    try {
      if (!isInstalled) {
        const installed = await installSnap()
        if (!installed) return
      }

      await saveCredential(claimedCredential)
      // Toast success is shown by the hook
    } catch (error) {
      // console.error('Error saving to snap:', error)
      toast.error("Failed to save credential to MetaMask")
    }
  }



  const formatTime = (seconds: number) => {
    // Ensure seconds is a valid number and not negative
    const validSeconds = Math.max(0, Math.floor(seconds))
    const mins = Math.floor(validSeconds / 60)
    const secs = validSeconds % 60

    // Format as "X minutos" or "X minutos y Y segundos" for better readability
    if (mins === 0) {
      return secs === 0 ? t("claim.otp.expired") : `${secs} ${secs === 1 ? t("claim.otp.second") : t("claim.otp.seconds")}`
    }
    if (secs === 0) {
      return `${mins} ${mins === 1 ? t("claim.otp.minute") : t("claim.otp.minutes")}`
    }
    return `${mins} ${mins === 1 ? t("claim.otp.minute") : t("claim.otp.minutes")} ${t("claim.otp.and")} ${secs} ${secs === 1 ? t("claim.otp.second") : t("claim.otp.seconds")}`
  }

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const steps: { key: ClaimStep; label: string; icon: React.ElementType }[] = [
    { key: "connect", label: t("claim.steps.connect.title"), icon: Wallet },
    { key: "validate", label: t("claim.steps.validate.title"), icon: Shield },
    { key: "sign", label: t("claim.steps.sign.title"), icon: FileSignature },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validando tu enlace de claim...</p>
        </div>
      </div>
    )
  }

  // Invalid token state
  if (step === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("claim.invalid.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("claim.invalid.description")}</p>

            <div className="bg-secondary/50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium mb-2">{t("claim.invalid.reasons.title")}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>{t("claim.invalid.reasons.expired")}</li>
                <li>{t("claim.invalid.reasons.alreadyClaimed")}</li>
                <li>{t("claim.invalid.reasons.incorrect")}</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/">{t("common.backToHome")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired token state
  if (step === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("claim.expired.title")}</h2>
            <p className="text-muted-foreground mb-6">
              {t("claim.expired.description")}
            </p>
            <Button asChild variant="outline" className="w-full bg-transparent">
              <Link href="/">{t("common.backToHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already claimed state
  if (step === "already_claimed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("claim.alreadyClaimed.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("claim.alreadyClaimed.description")}</p>
            <div className="space-y-3">
              <Button className="w-full gap-2" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4" />
                {t("claim.success.downloadAgain")}
              </Button>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/">{t("common.backToHome")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Claiming state
  if (step === "claiming") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("claim.claiming.title")}</h2>
            <p className="text-muted-foreground">{t("claim.claiming.description")}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">{t("claim.title")}</h1>
          <p className="text-muted-foreground">{t("claim.subtitle")}</p>
        </div>

        {/* Progress Steps */}
        {step !== "success" && (
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                        index < currentStepIndex && "bg-green-500 text-white",
                        index === currentStepIndex && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        index > currentStepIndex && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {index < currentStepIndex ? <CheckCircle2 className="w-6 h-6" /> : <s.icon className="w-6 h-6" />}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium",
                        index <= currentStepIndex ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-4 transition-colors duration-300",
                        index < currentStepIndex ? "bg-green-500" : "bg-border",
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Content */}
        <Card className="glass glow-border">
          {/* Step 1: Validate OTP */}
          {step === "validate" && (
            <>
              <CardHeader className="text-center">
                <CardTitle>{t("claim.otp.title")}</CardTitle>
                <CardDescription>{t("claim.otp.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={handleOtpComplete} disabled={isLoading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {/* OTP Timer and Attempts */}
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{t("claim.otp.expiresIn")} {formatTime(otpTimeLeft)}</span>
                  </div>
                  {otpAttempts > 0 && (
                    <div className="text-yellow-500">{maxOtpAttempts - otpAttempts} {t("claim.otp.attemptsLeft")}</div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("claim.errors.invalidOTP")}</AlertTitle>
                    <AlertDescription>
                      {typeof error === 'string'
                        ? (error.startsWith("claim.") ? t(error) : error)
                        : String(error)}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full gap-2"
                    onClick={() => validateOtp()}
                    disabled={otp.length !== 6 || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {t("claim.otp.verifyCode")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={handleResendOtp}
                    disabled={isLoading || otpTimeLeft > 14 * 60}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("claim.otp.resend")}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 1: Connect Wallet */}
          {step === "connect" && (
            <>
              <CardHeader className="text-center">
                <CardTitle>{t("claim.wallet.title")}</CardTitle>
                <CardDescription>{t("claim.wallet.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <MetaMaskLogo />
                </div>

                {/* Expected wallet info */}
                {credentialPreview && (
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">{t("claim.wallet.credentialFor")}</p>
                    <code className="text-sm font-mono">{truncateAddress(credentialPreview.holderAddress)}</code>
                  </div>
                )}

                {/* Wallet mismatch warning */}
                {walletMismatch && isConnected && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("claim.wallet.incorrectWallet")}</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>
                        {t("claim.wallet.credentialFor")}{" "}
                        <code className="text-xs">{truncateAddress(credentialPreview?.holderAddress || "")}</code>
                      </p>
                      <p>
                        {t("claim.wallet.connectedWallet")} <code className="text-xs">{truncateAddress(address || "")}</code>
                      </p>
                      <p className="mt-2">{t("claim.wallet.pleaseConnectCorrect")}</p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Authenticating state */}
                {isAuthenticating && isConnected && !walletMismatch && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Autenticando...</AlertTitle>
                    <AlertDescription>
                      Por favor firma el mensaje en tu wallet para autenticarte
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {typeof error === 'string'
                        ? (error.startsWith("claim.") ? t(error) : error)
                        : String(error)}
                    </AlertDescription>
                  </Alert>
                )}

                <Button className="w-full gap-2" size="lg" onClick={() => connect({ connector: injected() })} disabled={isConnecting || isAuthenticating}>
                  {isConnecting || isAuthenticating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      {isConnected ? t("claim.wallet.changeWallet") : t("claim.wallet.connect")}
                    </>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 3: Preview and Sign */}
          {step === "sign" && credentialPreview && (
            <>
              <CardHeader className="text-center">
                <CardTitle>{t("claim.preview.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Credential Preview */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {credentialPreview.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{truncateAddress(address || "")}</span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(credentialPreview.attributes).map(([key, value]) => {
                      // Skip domain and issuanceId as they are handled separately
                      if (key === "domain" || key === "issuanceId") return null

                      // Ensure value is always a string for rendering
                      let displayValue = value === null || value === undefined
                        ? ""
                        : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)

                      // Format dates properly
                      if (key === "expiresAt" && displayValue) {
                        try {
                          const date = new Date(displayValue)
                          if (!isNaN(date.getTime())) {
                            displayValue = date.toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric"
                            })
                          }
                        } catch (e) {
                          // Keep original value if date parsing fails
                        }
                      }

                      // Translate status values
                      if (key === "status" && displayValue) {
                        const statusKey = `claim.preview.status.${displayValue.toUpperCase()}`
                        const translatedStatus = t(statusKey)
                        displayValue = translatedStatus !== statusKey ? translatedStatus : displayValue
                      }

                      // Translate attribute labels
                      const labelKey = `claim.preview.attributes.${key}`
                      const translatedLabel = t(labelKey)
                      const displayLabel = translatedLabel !== labelKey ? translatedLabel : key.replace(/([A-Z])/g, " $1").trim()

                      return (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground capitalize">
                            {displayLabel}
                          </span>
                          <span className="text-sm font-medium">{displayValue}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-4 border-t border-border/50 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="w-3 h-3" />
                      <span>{t("claim.preview.issuedBy")} {credentialPreview.issuer}</span>
                    </div>
                    {credentialPreview.expiresAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>
                          {t("claim.preview.validUntil")} {new Date(credentialPreview.expiresAt).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Network warning */}
                {isConnected && activeChainId !== expectedChainId && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("claim.errors.networkSwitchFailed") || "Red incorrecta"}</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>
                        {t("claim.wallet.connectedWallet")} Chain ID: {activeChainId}
                      </p>
                      <p>
                        {t("claim.preview.requiredNetwork") || "Red requerida"}: {expectedChainId === 31337
                          ? (process.env.NEXT_PUBLIC_NETWORK_NAME || "Hardhat Local")
                          : (process.env.NEXT_PUBLIC_NETWORK_NAME || "Alastria Red-T")} (Chain ID: {expectedChainId})
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            await switchChain({ chainId: expectedChainId })
                          } catch (err: any) {
                            if (err.code !== 4001) {
                              toast.error(err.message || t("claim.errors.networkSwitchFailed"))
                            }
                          }
                        }}
                        disabled={isSwitchingChain}
                      >
                        {isSwitchingChain ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            {t("claim.wallet.switchingNetwork") || "Cambiando..."}
                          </>
                        ) : (
                          t("claim.wallet.switchNetwork") || "Cambiar a Red Alastria"
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Signature info */}
                <div className="bg-secondary/30 rounded-xl p-4 flex items-start gap-3">
                  <FileSignature className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t("claim.preview.signatureTitle")}</p>
                    <p className="text-muted-foreground">
                      {t("claim.preview.signatureInfo")}
                    </p>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {typeof error === 'string'
                        ? (error.startsWith("claim.") ? t(error) : error)
                        : String(error)}
                    </AlertDescription>
                  </Alert>
                )}

                <Button className="w-full gap-2" size="lg" onClick={handleSign} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileSignature className="w-5 h-5" />
                      {t("claim.preview.signAndClaim")}
                    </>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* Success State */}
          {step === "success" && (
            <CardContent className="py-12">
              <div className="text-center space-y-6">
                <div className="w-24 h-24 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">{t("claim.success.title")}</h2>
                  <p className="text-muted-foreground">{t("claim.success.description")}</p>
                </div>

                {/* Credential summary */}
                <div className="bg-secondary/50 rounded-xl p-4 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary">{credentialPreview?.type}</Badge>
                    <div className="flex items-center gap-1 text-green-500 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t("claim.success.signed")}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t("claim.success.issuer")}:</span>
                      <span className="ml-2">{credentialPreview?.issuer}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("claim.success.holder")}:</span>
                      <span className="ml-2 font-mono text-xs">{truncateAddress(address || "")}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={handleDownloadJSON} disabled={isLoading}>
                    <Download className="w-4 h-4" />
                    {t("claim.success.downloadJSON")}
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={handleDownloadPDF} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {t("claim.success.downloadPDF")}
                  </Button>
                </div>

                {/*
                <Button className="w-full gap-2" style={{ backgroundColor: "#F6851B" }} onClick={handleSaveToSnap}>
                  <Wallet className="w-4 h-4" />
                  {t("claim.success.saveToSnap")}
                </Button>
                */}

                <div className="flex items-center justify-center pt-4 border-t">
                  <Button variant="outline" className="gap-2 w-full" asChild>
                    <Link href="/verify">
                      <ExternalLink className="w-4 h-4" />
                      {t("claim.success.verify")}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
