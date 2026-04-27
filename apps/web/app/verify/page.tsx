"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  FileCheck,
  Upload,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  Hash,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { config } from "@/config"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

type VerificationStatus = "idle" | "analyzing" | "valid" | "invalid" | "revoked"

interface VerificationResult {
  status: "valid" | "invalid" | "revoked"
  credential?: {
    type: string
    issuer: string
    holder: string
    issuedAt: string
    expiresAt?: string
    hash: string
    attributes: Record<string, string>
  }
  error?: string
}

type VerificationPayload =
  | { kind: "credential"; data: any }
  | { kind: "presentation"; data: any }

function detectVerificationPayload(document: any): VerificationPayload {
  const types = Array.isArray(document?.type) ? document.type : [document?.type].filter(Boolean)

  if (document?.verifiableCredential || types.includes("VerifiablePresentation")) {
    return { kind: "presentation", data: document }
  }

  return { kind: "credential", data: document }
}

function normalizeVerificationPayload(input: any): VerificationPayload {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid credential JSON format")
  }

  if (input.presentation && typeof input.presentation === "object") {
    return detectVerificationPayload(input.presentation)
  }

  if (input.credential && typeof input.credential === "object") {
    return detectVerificationPayload(input.credential)
  }

  if (input.vc && typeof input.vc === "object") {
    return detectVerificationPayload(input.vc)
  }

  return detectVerificationPayload(input)
}

export default function VerifyPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [fileName, setFileName] = useState<string>("")

  const verifyCredential = useCallback(async (file: File) => {
    setStatus("analyzing")
    setFileName(file.name)
    setResult(null)

    try {
      // Read file content
      const text = await file.text()
      let parsedData: any

      // Parse JSON or extract from PDF
      if (file.type === "application/json") {
        parsedData = JSON.parse(text)
      } else if (file.type === "application/pdf") {
        // For PDF, we need to extract the JSON credential from metadata
        try {
          // Dynamic import to avoid SSR issues with pdf-lib
          const { PDFDocument } = await import('pdf-lib')
          const arrayBuffer = await file.arrayBuffer()
          const pdfDoc = await PDFDocument.load(arrayBuffer)

          // 1. Try to get from Subject (Base64 encoded) - Standard method
          const subject = pdfDoc.getSubject()
          if (subject) {
            try {
              // Try decoding as Base64 first (new format)
              // Handle browser-compatible base64 encoding from generator
              const decoded = decodeURIComponent(escape(atob(subject)))
              parsedData = JSON.parse(decoded)
            } catch (e) {
              // Fallback: Try parsing directly (legacy format)
              try {
                parsedData = JSON.parse(subject)
              } catch (e2) {
                // console.warn('Failed to parse PDF subject as JSON:', e2)
              }
            }
          }

          // 2. Fallback: Regex match on raw text (Legacy/Backup)
          if (!parsedData) {
            const match = text.match(/\{[\s\S]*"@context"[\s\S]*\}/)
            if (match) {
              parsedData = JSON.parse(match[0])
            }
          }

          if (!parsedData) {
            throw new Error("No credential data found in PDF metadata or content")
          }
        } catch (err) {
          // console.error('PDF Extraction Error:', err)
          throw new Error("Failed to extract credential from PDF. Ensure the file is a valid Alastria Credential.")
        }
      } else {
        throw new Error("Unsupported file format")
      }

      const verificationPayload = normalizeVerificationPayload(parsedData)
      const endpoint = verificationPayload.kind === "presentation" ? "/api/v1/verify/presentation" : "/api/v1/verify"
      const requestBody = verificationPayload.kind === "presentation"
        ? { presentation: verificationPayload.data }
        : { credential: verificationPayload.data }

      // Call verifier API
      const response = await fetch(`${config.verifierApiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const verifyResult = await response.json()

      if (!response.ok || !verifyResult.valid) {
        // Verification failed
        setResult({
          status: "invalid",
          error: verifyResult.error || "Verification failed"
        })
        setStatus("invalid")
        return
      }

      // Extract credential information
      const vc = verificationPayload.kind === "presentation"
        ? verificationPayload.data.verifiableCredential?.[0]
        : verificationPayload.data

      if (!vc) {
        throw new Error("No credential data found in uploaded document")
      }

      const credentialSubject = vc.credentialSubject || {}

      // Build attributes object (exclude special fields)
      const attributes: Record<string, string> = {}
      for (const [key, value] of Object.entries(credentialSubject)) {
        if (key !== 'id' && key !== 'holderAddress' && typeof value === 'string') {
          attributes[key] = value
        }
      }

      setResult({
        status: "valid",
        credential: {
          type: Array.isArray(vc.type) ? vc.type.find((t: string) => t !== 'VerifiableCredential') || vc.type[0] : vc.type,
          issuer: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Unknown',
          holder: credentialSubject.id || credentialSubject.holderAddress || 'Unknown',
          issuedAt: vc.issuanceDate || vc.validFrom || new Date().toISOString(),
          expiresAt: vc.expirationDate || vc.validUntil,
          hash: verifyResult.onchain?.vcHash || 'N/A',
          attributes
        }
      })
      setStatus("valid")
    } catch (error: any) {
      // console.error('Verification error:', error)
      setResult({
        status: "invalid",
        error: error.message || "Failed to verify credential"
      })
      setStatus("invalid")
    }
  }, [])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        verifyCredential(acceptedFiles[0])
      }
    },
    [verifyCredential],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/json": [".json"],
    },
    maxFiles: 1,
  })

  const resetVerification = () => {
    setStatus("idle")
    setResult(null)
    setFileName("")
  }

  const statusConfig = {
    valid: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      title: t("verify.result.valid.title"),
      description: t("verify.result.valid.description"),
    },
    invalid: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      title: t("verify.result.invalid.title"),
      description: t("verify.result.invalid.description"),
    },
    revoked: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      title: t("verify.result.revoked.title"),
      description: t("verify.result.revoked.description"),
    },
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <FileCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{t("verify.title")}</h1>
          <p className="text-lg text-muted-foreground">{t("verify.subtitle")}</p>
        </div>

        {/* Dropzone or Result */}
        {status === "idle" && (
          <Card className="glass glow-border animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <CardContent className="p-0">
              <div
                {...getRootProps()}
                className={cn(
                  "relative p-12 text-center cursor-pointer transition-all duration-300 rounded-xl",
                  "border-2 border-dashed",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/30",
                )}
              >
                <input {...getInputProps()} />
                <div className="space-y-4">
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-20 h-20 rounded-2xl transition-colors",
                      isDragActive ? "bg-primary/20" : "bg-secondary",
                    )}
                  >
                    <Upload
                      className={cn(
                        "w-10 h-10 transition-colors",
                        isDragActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1">{t("verify.dropzone.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("verify.dropzone.subtitle")}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t("verify.dropzone.formats")}
                  </Badge>
                </div>
              </div>

              {/* QR Scanner button */}
              <div className="flex items-center justify-center py-6 border-t border-border/50">
                <Button variant="ghost" className="gap-2">
                  <QrCode className="w-4 h-4" />
                  {t("verify.scanQR")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analyzing State */}
        {status === "analyzing" && (
          <Card className="glass glow-border animate-in fade-in duration-300">
            <CardContent className="py-16 text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <Loader2 className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">{t("verify.analyzing")}</p>
              <p className="text-sm text-muted-foreground mt-2">{fileName}</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {(status === "valid" || status === "invalid" || status === "revoked") && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Card */}
            <Card className={cn("glass border-2", statusConfig[status].border)}>
              <CardContent className="py-8 text-center">
                <div
                  className={cn(
                    "inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4",
                    statusConfig[status].bg,
                  )}
                >
                  {(() => {
                    const Icon = statusConfig[status].icon
                    return <Icon className={cn("w-10 h-10", statusConfig[status].color)} />
                  })()}
                </div>
                <h2 className={cn("text-2xl font-bold mb-2", statusConfig[status].color)}>
                  {statusConfig[status].title}
                </h2>
                <p className="text-muted-foreground">{statusConfig[status].description}</p>
              </CardContent>
            </Card>

            {/* Credential Details */}
            {result.credential && (
              <Card className="glass glow-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {result.credential.type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Details Grid */}
                  <div className="grid gap-4">
                    <DetailRow icon={Shield} label={t("verify.details.issuer")} value={result.credential.issuer} mono />
                    <DetailRow icon={User} label={t("verify.details.holder")} value={result.credential.holder} mono />
                    <DetailRow
                      icon={Calendar}
                      label={t("verify.details.issuedAt")}
                      value={new Date(result.credential.issuedAt).toLocaleDateString()}
                    />
                    {result.credential.expiresAt && (
                      <DetailRow
                        icon={Calendar}
                        label={t("verify.details.expiresAt")}
                        value={new Date(result.credential.expiresAt).toLocaleDateString()}
                      />
                    )}
                    <DetailRow icon={Hash} label={t("verify.details.hash")} value={result.credential.hash} mono />
                  </div>

                  {/* Attributes */}
                  {Object.keys(result.credential.attributes).length > 0 && (
                    <div className="pt-4 border-t border-border/50">
                      <h4 className="text-sm font-medium text-muted-foreground mb-4">{t("verify.attributes")}</h4>
                      <div className="grid gap-3">
                        {Object.entries(result.credential.attributes).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/50"
                          >
                            <span className="text-sm text-muted-foreground capitalize">{key}</span>
                            <span className="text-sm font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reset Button */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={resetVerification} className="gap-2 bg-transparent">
                <Upload className="w-4 h-4" />
                {t("verify.verifyAnother")}
              </Button>
            </div>
          </div>
        )}
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
