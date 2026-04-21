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

const statusConfig: Record<VCStatus, { icon: typeof Shield; color: string; bg: string }> = {
  active: { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10" },
  expiring: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  expired: { icon: ShieldX, color: "text-red-500", bg: "bg-red-500/10" },
  revoked: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-600/10" },
  draft: { icon: FileText, color: "text-muted-foreground", bg: "bg-muted/50" },
}

export function VCStatusHero({
  analysis,
  onVerifyBlockchain,
  onDownloadPdf,
  onShare,
  onToggleRaw,
  showRaw,
}: VCStatusHeroProps) {
  const { locale, t } = useI18n()
  const { status, raw, security, issuanceDate, expirationDate, daysUntilExpiration } = analysis
  const config = {
    ...statusConfig[status],
    label:
      status === "active"
        ? t("vc.statusHero.active")
        : status === "expiring"
          ? t("vc.statusHero.expiring")
          : status === "expired"
            ? t("vc.statusHero.expired")
            : status === "revoked"
              ? t("vc.statusHero.revoked")
              : t("vc.statusHero.draft"),
  }
  const StatusIcon = config.icon

  // Extract credential type
  const types = Array.isArray(raw.type) ? raw.type : [raw.type]
  const credentialType = types.find((t) => t !== "VerifiableCredential") || "VerifiableCredential"

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

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
          <span className="text-sm text-yellow-600">{t("vc.statusHero.expiringInDays", { count: daysUntilExpiration })}</span>
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
              <h2 className="text-2xl font-bold text-foreground">{t("vc.statusHero.verifiableCredential")}</h2>
              {raw.id && <p className="text-sm text-muted-foreground mt-1 font-mono truncate max-w-md">ID: {raw.id}</p>}
            </div>

            {/* Dates */}
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.statusHero.issued")}</p>
                <p className="font-medium text-foreground">{formatDate(issuanceDate)}</p>
                <p className="text-xs text-muted-foreground">{getRelativeTime(issuanceDate)}</p>
              </div>
              {expirationDate ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.statusHero.expires")}</p>
                  <p className="font-medium text-foreground">{formatDate(expirationDate)}</p>
                  {daysUntilExpiration !== null && daysUntilExpiration > 0 && (
                    <p className="text-xs text-muted-foreground">{t("vc.statusHero.inDays", { count: daysUntilExpiration })}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.statusHero.expires")}</p>
                  <Badge variant="secondary">{t("vc.statusHero.noExpiration")}</Badge>
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
                <p className="text-sm font-medium text-foreground">{t("vc.security.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {security.level === "very-high" && t("vc.security.veryHigh")}
                  {security.level === "high" && t("vc.security.high")}
                  {security.level === "medium" && t("vc.security.medium")}
                  {security.level === "low" && t("vc.security.low")}
                  {security.level === "untrusted" && t("vc.security.untrusted")}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button onClick={onVerifyBlockchain} className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("vc.statusHero.verifyBlockchain")}
            </Button>
            <Button onClick={onDownloadPdf} variant="outline" className="w-full bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              {t("vc.statusHero.downloadPdf")}
            </Button>
            <Button onClick={onShare} variant="outline" className="w-full bg-transparent">
              <Share2 className="h-4 w-4 mr-2" />
              {t("vc.statusHero.share")}
            </Button>
            <Button onClick={onToggleRaw} variant="ghost" className="w-full">
              <Code className="h-4 w-4 mr-2" />
              {showRaw ? t("vc.statusHero.hideJson") : t("vc.statusHero.showRawJson")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
