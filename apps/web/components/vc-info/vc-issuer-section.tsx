"use client"

import { Building2, ExternalLink, Copy, CheckCircle, XCircle, HelpCircle, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import type { VCIssuerAnalysis } from "@/lib/types/vc"

interface VCIssuerSectionProps {
  issuer: VCIssuerAnalysis
  onVerifySignature: () => void
  signatureVerifying: boolean
}

export function VCIssuerSection({ issuer, onVerifySignature, signatureVerifying }: VCIssuerSectionProps) {
  const { t } = useI18n()
  const [copiedDid, setCopiedDid] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  const copyToClipboard = async (text: string, type: "did" | "address") => {
    await navigator.clipboard.writeText(text)
    if (type === "did") {
      setCopiedDid(true)
      setTimeout(() => setCopiedDid(false), 2000)
    } else {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const truncateAddress = (address: string) => {
    if (address.length <= 20) return address
    return `${address.slice(0, 10)}...${address.slice(-8)}`
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Quién Emitió Esta Credencial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identification */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Identificación</h4>

          {/* DID */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">DID del Emisor</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Identificador Descentralizado - Una forma única e inmutable de identificar al emisor</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted/50 px-2 py-1 rounded font-mono truncate max-w-[300px]">
                {truncateAddress(issuer.did)}
              </code>
              <Badge variant="outline" className="text-xs">
                {issuer.didType}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => copyToClipboard(issuer.did, "did")}
              >
                {copiedDid ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Name */}
          {issuer.name && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <p className="font-medium text-foreground">{issuer.name}</p>
            </div>
          )}

          {/* Ethereum Address */}
          {issuer.ethereumAddress && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Dirección Ethereum</span>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted/50 px-2 py-1 rounded font-mono">
                  {truncateAddress(issuer.ethereumAddress)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyToClipboard(issuer.ethereumAddress!, "address")}
                >
                  {copiedAddress ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                  <a
                    href={`https://etherscan.io/address/${issuer.ethereumAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* ENS Name */}
          {issuer.ensName && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">ENS</span>
              <p className="font-medium text-foreground">{issuer.ensName}</p>
            </div>
          )}

          {/* URL */}
          {issuer.url && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Sitio Web</span>
              <a
                href={issuer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {issuer.url}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Trust Level */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Nivel de Confianza</h4>

          <div
            className={cn(
              "p-4 rounded-lg border flex items-start gap-3",
              issuer.trustLevel === "verified" && "bg-green-500/5 border-green-500/20",
              issuer.trustLevel === "unverified" && "bg-yellow-500/5 border-yellow-500/20",
              issuer.trustLevel === "unknown" && "bg-muted/30 border-border",
            )}
          >
            <Shield
              className={cn(
                "h-5 w-5 mt-0.5",
                issuer.trustLevel === "verified" && "text-green-500",
                issuer.trustLevel === "unverified" && "text-yellow-500",
                issuer.trustLevel === "unknown" && "text-muted-foreground",
              )}
            />
            <div>
              <p className="font-medium text-foreground">
                {issuer.trustLevel === "verified" && "Emisor Verificado en Blockchain"}
                {issuer.trustLevel === "unverified" && "Emisor No Verificado"}
                {issuer.trustLevel === "unknown" && "Estado Desconocido"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {issuer.trustLevel === "verified" && t("vc.issuer.verified")}
                {issuer.trustLevel === "unverified" && t("vc.issuer.unverified")}
                {issuer.trustLevel === "unknown" && t("vc.issuer.unknown")}
              </p>
            </div>
          </div>
        </div>

        {/* Signature Verification */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Firma del Emisor</h4>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {issuer.signatureValid === true && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-500 font-medium">Firma Válida</span>
                </>
              )}
              {issuer.signatureValid === false && (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-500 font-medium">Firma Inválida</span>
                </>
              )}
              {issuer.signatureValid === null && (
                <>
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">No verificada</span>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onVerifySignature} disabled={signatureVerifying}>
              {signatureVerifying ? "Verificando..." : "Verificar Firma"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
