"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { FileSearch, Loader2 } from "lucide-react"
import { VCInputMethods } from "@/components/vc-info/vc-input-methods"
import { VCStatusHero } from "@/components/vc-info/vc-status-hero"
import { VCIssuerSection } from "@/components/vc-info/vc-issuer-section"
import { VCHolderSection } from "@/components/vc-info/vc-holder-section"
import { VCSecurityScore } from "@/components/vc-info/vc-security-score"
import { VCTimeline } from "@/components/vc-info/vc-timeline"
import { VCProofsSection } from "@/components/vc-info/vc-proofs-section"
import { VCRawJson } from "@/components/vc-info/vc-raw-json"
import { parseVCJson, validateVC, analyzeVC } from "@/lib/utils/vc-parser"
import type { VCAnalysis, VCPageState, VCInputMethod } from "@/lib/types/vc"
import { useI18n } from "@/lib/i18n/provider"

function VCInfoContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [pageState, setPageState] = useState<VCPageState>("empty")
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<VCAnalysis | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)
  const [issuerSignatureVerifying, setIssuerSignatureVerifying] = useState(false)
  const [holderSignatureVerifying, setHolderSignatureVerifying] = useState(false)

  // Handle VC from URL parameter
  useEffect(() => {
    const vcParam = searchParams.get("vc")
    if (vcParam) {
      try {
        const decoded = atob(vcParam)
        handleVCLoaded(decoded, "direct")
      } catch {
        setError(t("vc.info.invalidParam"))
        setPageState("error")
      }
    }
  }, [searchParams])

  const handleVCLoaded = useCallback((vcJson: string, method: VCInputMethod) => {
    setError(null)
    setPageState("parsing")

    // Parse JSON
    const { vc, error: parseError } = parseVCJson(vcJson)
    if (parseError || !vc) {
      setError(parseError || t("vc.info.unknownParseError"))
      setPageState("error")
      return
    }

    setPageState("validating")

    // Validate structure
    const validation = validateVC(vc)
    if (!validation.isValid) {
      setError(t("vc.info.invalidStructure", { errors: validation.errors.join(", ") }))
      setPageState("error")
      return
    }

    setPageState("analyzing")

    // Full analysis
    try {
      const result = analyzeVC(vc)
      setAnalysis(result)
      setPageState("display")
    } catch (e) {
      setError(t("vc.info.analysisError"))
      setPageState("error")
    }
  }, [])

  const handleVerifyBlockchain = async () => {
    // Placeholder for blockchain verification
    // Placeholder for blockchain verification
    // console.log("Verifying on blockchain...")
    alert(t("common.notImplemented") || "Functionality not yet implemented")
  }

  const handleDownloadPdf = async () => {
    if (!analysis) return

    try {
      const { generateVCPDF } = await import('@/lib/utils/pdf-generator')

      const vcData = {
        id: analysis.raw.id,
        type: analysis.raw.type,
        issuer: analysis.raw.issuer,
        issuanceDate: analysis.raw.issuanceDate || (analysis.raw as any).validFrom || new Date().toISOString(),
        expirationDate: analysis.raw.expirationDate || (analysis.raw as any).validUntil,
        credentialSubject: analysis.raw.credentialSubject || {},
        proof: analysis.raw.proof,
      }

      const baseUrl = window.location.origin
      const pdfBytes = await generateVCPDF(vcData, baseUrl)

      // Create download link
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Credential_${vcData.id?.slice(-8) || 'export'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Show success message (you can use toast here if available)
      alert(t("claim.messages.pdfDownloaded") || "PDF descargado correctamente")
    } catch (error) {
      // console.error('Error generating PDF:', error)
      alert(t("claim.errors.signatureFailed") || "Error al generar el PDF")
    }
  }

  const handleShare = async () => {
    if (!analysis) return
    const vcBase64 = btoa(JSON.stringify(analysis.raw))
    const url = `${window.location.origin}/vc/info?vc=${vcBase64}`
    await navigator.clipboard.writeText(url)
    alert(t("vc.info.linkCopied"))
  }

  const handleVerifyIssuerSignature = async () => {
    setIssuerSignatureVerifying(true)
    // Placeholder for signature verification
    setTimeout(() => {
      if (analysis) {
        setAnalysis({
          ...analysis,
          issuer: { ...analysis.issuer, signatureValid: true },
        })
      }
      setIssuerSignatureVerifying(false)
    }, 1500)
  }

  const handleVerifyHolderSignature = async () => {
    setHolderSignatureVerifying(true)
    // Placeholder for signature verification
    setTimeout(() => {
      if (analysis) {
        setAnalysis({
          ...analysis,
          holder: { ...analysis.holder, signatureValid: true },
        })
      }
      setHolderSignatureVerifying(false)
    }, 1500)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSearch className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{t("vc.info.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("vc.info.subtitle")}
          </p>
        </div>

        {/* Input Methods - Always visible when empty or error */}
        {(pageState === "empty" || pageState === "error") && (
          <VCInputMethods onVCLoaded={handleVCLoaded} isLoading={false} error={error} />
        )}

        {/* Loading States */}
        {(pageState === "parsing" || pageState === "validating" || pageState === "analyzing") && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground">
              {pageState === "parsing" && t("vc.info.parsing")}
              {pageState === "validating" && t("vc.info.validating")}
              {pageState === "analyzing" && t("vc.info.analyzing")}
            </p>
          </div>
        )}

        {/* Display Mode */}
        {pageState === "display" && analysis && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => {
                setPageState("empty")
                setAnalysis(null)
                setError(null)
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("vc.info.analyzeAnother")}
            </button>

            {/* Status Hero */}
            <VCStatusHero
              analysis={analysis}
              onVerifyBlockchain={handleVerifyBlockchain}
              onDownloadPdf={handleDownloadPdf}
              onShare={handleShare}
              onToggleRaw={() => setShowRawJson(!showRawJson)}
              showRaw={showRawJson}
            />

            {/* Raw JSON (conditional) */}
            {showRawJson && <VCRawJson vc={analysis.raw} />}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <VCIssuerSection
                  issuer={analysis.issuer}
                  onVerifySignature={handleVerifyIssuerSignature}
                  signatureVerifying={issuerSignatureVerifying}
                />
                <VCHolderSection
                  holder={analysis.holder}
                  onVerifySignature={handleVerifyHolderSignature}
                  signatureVerifying={holderSignatureVerifying}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <VCSecurityScore security={analysis.security} />
                <VCTimeline events={analysis.timeline} />
              </div>
            </div>

            {/* Proofs Section - Full Width */}
            <VCProofsSection proofs={analysis.proofs} vcHash={analysis.hash} />
          </div>
        )}
      </div>
    </main>
  )
}

export default function VCInfoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
      }
    >
      <VCInfoContent />
    </Suspense>
  )
}
