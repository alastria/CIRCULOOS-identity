"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useAccount } from "wagmi"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Calendar,
  Hash,
  User,
  Building2,
  ExternalLink,
  Lock,
  Eye,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { config } from "@/config"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

type VerificationState = "loading" | "verifying" | "valid" | "invalid" | "error"

interface VerificationResult {
  valid: boolean
  issuer?: {
    did: string
    address: string
    signatureValid: boolean
    trusted: boolean
  }
  holder?: {
    did: string
  }
  checks?: {
    signature: string
    notExpired: string
    notRevoked: string
    trustedIssuer: string
    onChainStatus: string
  }
  error?: string
}

interface CredentialData {
  id: string
  type: string | string[]
  issuer: string | { id: string }
  issuanceDate?: string
  validFrom?: string
  expirationDate?: string
  validUntil?: string
  credentialSubject: any
  proof?: any
}

export default function VerifyCredentialPage() {
  const { t } = useI18n()
  const params = useParams()
  const credentialId = params.id as string
  const { address, isConnected } = useAccount()

  const [state, setState] = useState<VerificationState>("loading")
  const [credential, setCredential] = useState<CredentialData | null>(null)
  const [fullCredential, setFullCredential] = useState<CredentialData | null>(null)
  const [verification, setVerification] = useState<VerificationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [isLoadingFull, setIsLoadingFull] = useState(false)
  const [fullAccessError, setFullAccessError] = useState<string>("")
  const [showFullDetails, setShowFullDetails] = useState(false)

  // Check if current user is the holder
  const isHolder = (() => {
    if (!address || !credential) return false
    const holderDid = credential.credentialSubject?.id || ""
    return holderDid.toLowerCase().includes(address.toLowerCase())
  })()

  useEffect(() => {
    if (credentialId) {
      fetchAndVerify(credentialId)
    }
  }, [credentialId])

  // Auto-fetch full details when holder connects
  useEffect(() => {
    if (isConnected && isHolder && !fullCredential && !isLoadingFull) {
      fetchFullCredential()
    }
  }, [isConnected, isHolder, fullCredential])

  const fetchAndVerify = async (id: string) => {
    setState("loading")
    setErrorMessage("")

    try {
      // 1. Fetch the PUBLIC credential (redacted - no personal data)
      const credResponse = await fetch(
        `${config.issuerApiUrl}/api/v1/credentials/${encodeURIComponent(id)}/public`
      )

      if (!credResponse.ok) {
        const err = await credResponse.json().catch(() => ({}))
        throw new Error(err.error || t("vc.verify.credentialNotFound"))
      }

      const vc = await credResponse.json()
      setCredential(vc)

      // 2. Verify the credential with the verifier backend
      setState("verifying")

      const verifyResponse = await fetch(`${config.verifierApiUrl}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: vc }),
      })

      const result = await verifyResponse.json()
      setVerification(result)

      setState(result.valid ? "valid" : "invalid")
    } catch (err: any) {
      console.error("Verification error:", err)
      setErrorMessage(err.message || t("vc.verify.verificationFailed"))
      setState("error")
    }
  }

  const fetchFullCredential = async () => {
    if (!isConnected) return

    setIsLoadingFull(true)
    setFullAccessError("")

    try {
      // Use authenticated API call
      const response = await api.credentials.getCredentialFull(credentialId)
      setFullCredential(response)
      setShowFullDetails(true)
    } catch (err: any) {
      console.error("Failed to fetch full credential:", err)
      setFullAccessError(err.response?.data?.error || err.message || t("vc.verify.accessDenied"))
    } finally {
      setIsLoadingFull(false)
    }
  }

  const getCredentialType = () => {
    if (!credential) return "Credential"
    const types = Array.isArray(credential.type) ? credential.type : [credential.type]
    return types.find((t) => t !== "VerifiableCredential") || types[0]
  }

  const getIssuerDid = () => {
    if (!credential) return ""
    return typeof credential.issuer === "string" ? credential.issuer : credential.issuer?.id || ""
  }

  const getHolderDid = () => {
    return credential?.credentialSubject?.id || credential?.credentialSubject?.holderAddress || ""
  }

  const getIssuanceDate = () => {
    const date = credential?.issuanceDate || credential?.validFrom
    return date ? new Date(date).toLocaleDateString() : "-"
  }

  const getExpirationDate = () => {
    const date = credential?.expirationDate || credential?.validUntil
    return date ? new Date(date).toLocaleDateString() : t("vc.verify.noExpiration")
  }

  // Get personal attributes from full credential
  const getPersonalAttributes = () => {
    const vc = fullCredential || credential
    if (!vc?.credentialSubject) return []

    return Object.entries(vc.credentialSubject)
      .filter(([key]) => key !== "id" && key !== "holderAddress")
  }

  const hasPersonalAttributes = getPersonalAttributes().length > 0

  const statusConfig = {
    valid: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      title: t("vc.verify.status.valid"),
      description: t("vc.verify.status.validDesc"),
    },
    invalid: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      title: t("vc.verify.status.invalid"),
      description: verification?.error || t("vc.verify.status.invalidDesc"),
    },
    error: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      title: t("vc.verify.status.error"),
      description: errorMessage || t("vc.verify.status.errorDesc"),
    },
  }

  // Loading state
  if (state === "loading" || state === "verifying") {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card className="glass glow-border animate-in fade-in duration-300">
            <CardContent className="py-16 text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <Loader2 className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">
                {state === "loading" ? t("vc.verify.loading") : t("vc.verify.verifying")}
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-mono break-all max-w-md mx-auto">
                {credentialId.length > 50 ? `${credentialId.slice(0, 25)}...${credentialId.slice(-25)}` : credentialId}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error state
  if (state === "error") {
    const errorConfig = statusConfig.error
    const Icon = errorConfig.icon
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card className={cn("glass border-2", errorConfig.border)}>
            <CardContent className="py-12 text-center">
              <div className={cn("inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4", errorConfig.bg)}>
                <Icon className={cn("w-10 h-10", errorConfig.color)} />
              </div>
              <h2 className={cn("text-2xl font-bold mb-2", errorConfig.color)}>{errorConfig.title}</h2>
              <p className="text-muted-foreground max-w-md mx-auto">{errorConfig.description}</p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => fetchAndVerify(credentialId)}
              >
                {t("vc.verify.retry")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Valid or Invalid state
  const statusInfo = statusConfig[state as "valid" | "invalid"]
  const StatusIcon = statusInfo.icon

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Status Card */}
        <Card className={cn("glass border-2", statusInfo.border)}>
          <CardContent className="py-8 text-center">
            <div className={cn("inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4", statusInfo.bg)}>
              <StatusIcon className={cn("w-10 h-10", statusInfo.color)} />
            </div>
            <h2 className={cn("text-2xl font-bold mb-2", statusInfo.color)}>{statusInfo.title}</h2>
            <p className="text-muted-foreground">{statusInfo.description}</p>
          </CardContent>
        </Card>

        {/* Credential Details */}
        {credential && (
          <Card className="glass glow-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {getCredentialType()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Public Details Grid - Always visible */}
              <div className="grid gap-4">
                <DetailRow icon={Building2} label={t("vc.verify.issuer")} value={getIssuerDid()} mono />
                <DetailRow icon={User} label={t("vc.verify.holder")} value={getHolderDid()} mono />
                <DetailRow icon={Calendar} label={t("vc.verify.issuedAt")} value={getIssuanceDate()} />
                <DetailRow icon={Calendar} label={t("vc.verify.expiresAt")} value={getExpirationDate()} />
                {credential.id && (
                  <DetailRow icon={Hash} label={t("vc.verify.credentialId")} value={credential.id} mono />
                )}
              </div>

              {/* Verification Checks */}
              {verification?.checks && (
                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">{t("vc.verify.checks")}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <CheckBadge label={t("vc.verify.check.signature")} status={verification.checks.signature} />
                    <CheckBadge label={t("vc.verify.check.notExpired")} status={verification.checks.notExpired} />
                    <CheckBadge label={t("vc.verify.check.notRevoked")} status={verification.checks.notRevoked} />
                    <CheckBadge label={t("vc.verify.check.trustedIssuer")} status={verification.checks.trustedIssuer} />
                    <CheckBadge label={t("vc.verify.check.onChain")} status={verification.checks.onChainStatus} />
                  </div>
                </div>
              )}

              {/* Personal Attributes Section - Protected */}
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {fullCredential ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {t("vc.verify.personalData")}
                  </h4>
                  {fullCredential && (
                    <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                      {t("vc.verify.holderAccess")}
                    </Badge>
                  )}
                </div>

                {/* Show full attributes if holder is authenticated */}
                {fullCredential && hasPersonalAttributes ? (
                  <div className="grid gap-3">
                    {getPersonalAttributes().map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/50"
                      >
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-sm font-medium">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Protected message - needs authentication */
                  <div className="rounded-lg border border-dashed border-border/50 bg-secondary/20 p-6 text-center">
                    <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("vc.verify.personalDataProtected")}
                    </p>

                    {!isConnected ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t("vc.verify.connectToViewDetails")}
                        </p>
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a href="/wallet">
                            <Wallet className="w-4 h-4" />
                            {t("vc.verify.connectWallet")}
                          </a>
                        </Button>
                      </div>
                    ) : isHolder ? (
                      <div className="space-y-2">
                        {fullAccessError && (
                          <p className="text-xs text-red-500 mb-2">{fullAccessError}</p>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={fetchFullCredential}
                          disabled={isLoadingFull}
                        >
                          {isLoadingFull ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          {t("vc.verify.viewMyDetails")}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("vc.verify.onlyHolderCanView")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" className="gap-2 bg-transparent" asChild>
            <a href="/verify">
              <ExternalLink className="w-4 h-4" />
              {t("vc.verify.verifyAnother")}
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={cn("text-sm font-medium break-all", mono && "font-mono text-xs")}>{value}</p>
      </div>
    </div>
  )
}

function CheckBadge({ label, status }: { label: string; status: string }) {
  const isValid = status === "VALID"
  const isNA = status === "N/A"

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge
        variant={isNA ? "secondary" : isValid ? "default" : "destructive"}
        className={cn("text-xs", isValid && "bg-green-500/20 text-green-500 hover:bg-green-500/30")}
      >
        {status}
      </Badge>
    </div>
  )
}
