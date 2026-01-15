"use client"

import {
  type Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  FileText,
  Download,
  Share2,
  Code,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import type { VCAnalysis, VCStatus } from "@/lib/types/vc"

interface VCStatusHeroProps {
  analysis: VCAnalysis
  onVerifyBlockchain: () => void
  onDownloadPdf: () => void
  onShare: () => void
  onToggleRaw: () => void
  showRaw: boolean
}

const statusConfig: Record<VCStatus, { icon: typeof Shield; label: string; color: string; bg: string }> = {
  active: { icon: ShieldCheck, label: "Activa", color: "text-green-500", bg: "bg-green-500/10" },
  expiring: { icon: Clock, label: "Por Expirar", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  expired: { icon: ShieldX, label: "Expirada", color: "text-red-500", bg: "bg-red-500/10" },
  revoked: { icon: ShieldAlert, label: "Revocada", color: "text-red-600", bg: "bg-red-600/10" },
  draft: { icon: FileText, label: "Borrador", color: "text-muted-foreground", bg: "bg-muted/50" },
}

export function VCStatusHero({
  analysis,
  onVerifyBlockchain,
  onDownloadPdf,
  onShare,
  onToggleRaw,
  showRaw,
}: VCStatusHeroProps) {
  const { status, raw, security, issuanceDate, expirationDate, daysUntilExpiration } = analysis
  const config = statusConfig[status]
  const StatusIcon = config.icon

  // Extract credential type
  const types = Array.isArray(raw.type) ? raw.type : [raw.type]
  const credentialType = types.find((t) => t !== "VerifiableCredential") || "VerifiableCredential"

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const { t } = useI18n()
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return t("vc.status.today")
    if (diffDays === 1) return t("vc.status.daysAgo").replace("{count}", "1")
    if (diffDays < 30) return t("vc.status.daysAgo_plural").replace("{count}", String(diffDays))
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return months === 1 ? t("vc.status.monthsAgo").replace("{count}", "1") : t("vc.status.monthsAgo_plural").replace("{count}", String(months))
    }
    const years = Math.floor(diffDays / 365)
    return years === 1 ? t("vc.status.yearsAgo").replace("{count}", "1") : t("vc.status.yearsAgo_plural").replace("{count}", String(years))
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Status Banner */}
      <div className={cn("px-6 py-3 flex items-center gap-3", config.bg)}>
        <StatusIcon className={cn("h-5 w-5", config.color)} />
        <span className={cn("font-semibold", config.color)}>{config.label}</span>
        {status === "expiring" && daysUntilExpiration !== null && (
          <span className="text-sm text-yellow-600">(expira en {daysUntilExpiration} días)</span>
        )}
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Main Info */}
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-2">
                {credentialType}
              </Badge>
              <h2 className="text-2xl font-bold text-foreground">Credencial Verificable</h2>
              {raw.id && <p className="text-sm text-muted-foreground mt-1 font-mono truncate max-w-md">ID: {raw.id}</p>}
            </div>

            {/* Dates */}
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Emitida</p>
                <p className="font-medium text-foreground">{formatDate(issuanceDate)}</p>
                <p className="text-xs text-muted-foreground">{getRelativeTime(issuanceDate)}</p>
              </div>
              {expirationDate ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expira</p>
                  <p className="font-medium text-foreground">{formatDate(expirationDate)}</p>
                  {daysUntilExpiration !== null && daysUntilExpiration > 0 && (
                    <p className="text-xs text-muted-foreground">en {daysUntilExpiration} días</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expira</p>
                  <Badge variant="secondary">Sin expiración</Badge>
                </div>
              )}
            </div>

            {/* Security Score Preview */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold",
                  security.level === "very-high" && "bg-green-500/20 text-green-500",
                  security.level === "high" && "bg-green-500/20 text-green-500",
                  security.level === "medium" && "bg-yellow-500/20 text-yellow-500",
                  security.level === "low" && "bg-orange-500/20 text-orange-500",
                  security.level === "untrusted" && "bg-red-500/20 text-red-500",
                )}
              >
                {security.score}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Puntuación de Seguridad</p>
                <p className="text-xs text-muted-foreground">
                  {security.level === "very-high" && "Muy Confiable"}
                  {security.level === "high" && "Confiable"}
                  {security.level === "medium" && "Confianza Media"}
                  {security.level === "low" && "Baja Confianza"}
                  {security.level === "untrusted" && "No Confiable"}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button onClick={onVerifyBlockchain} className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Verificar en Blockchain
            </Button>
            <Button onClick={onDownloadPdf} variant="outline" className="w-full bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={onShare} variant="outline" className="w-full bg-transparent">
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
            <Button onClick={onToggleRaw} variant="ghost" className="w-full">
              <Code className="h-4 w-4 mr-2" />
              {showRaw ? "Ocultar JSON" : "Ver JSON Raw"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
