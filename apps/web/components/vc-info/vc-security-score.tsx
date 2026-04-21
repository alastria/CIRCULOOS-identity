"use client"

import { Shield, CheckCircle, XCircle, AlertTriangle, Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import type { VCSecurityScore as VCSecurityScoreType } from "@/lib/types/vc"

interface VCSecurityScoreProps {
  security: VCSecurityScoreType
}

export function VCSecurityScore({ security }: VCSecurityScoreProps) {
  const { t } = useI18n()
  const { score, maxScore, level, checks, recommendations } = security

  const getCheckLabel = (name: string) => {
    const translationMap: Record<string, string> = {
      "Firmada por Emisor": "vc.security.checkLabels.issuerSigned",
      "Firmada por Holder": "vc.security.checkLabels.holderSigned",
      "Emisor en Registry": "vc.security.checkLabels.issuerInRegistry",
      "No Expirada": "vc.security.checkLabels.notExpired",
      Expirada: "vc.security.checkLabels.expired",
      "Tiene Evidencia": "vc.security.checkLabels.hasEvidence",
      "Estructura Válida": "vc.security.checkLabels.validStructure",
    }

    return translationMap[name] ? t(translationMap[name]) : name
  }

  const getCheckDescription = (description: string) => {
    const translationMap: Record<string, string> = {
      "La credencial tiene firma del emisor": "vc.security.checkDescriptions.issuerSigned",
      "Falta firma del emisor": "vc.security.checkDescriptions.issuerMissingSignature",
      "El holder ha firmado la credencial": "vc.security.checkDescriptions.holderSigned",
      "El holder no ha firmado": "vc.security.checkDescriptions.holderNotSigned",
      "Emisor verificado en blockchain": "vc.security.checkDescriptions.issuerVerified",
      "Emisor no está en registry público": "vc.security.checkDescriptions.issuerNotVerified",
      "La credencial no ha expirado": "vc.security.checkDescriptions.notExpired",
      "La credencial ha expirado": "vc.security.checkDescriptions.expired",
      "Incluye evidencia de verificación": "vc.security.checkDescriptions.hasEvidence",
      "No incluye evidencia": "vc.security.checkDescriptions.noEvidence",
      "Cumple con estándar W3C": "vc.security.checkDescriptions.validStructure",
      "Errores en estructura": "vc.security.checkDescriptions.invalidStructure",
    }

    return translationMap[description] ? t(translationMap[description]) : description
  }

  const levelConfig = {
    "very-high": {
      label: t("vc.security.veryHigh"),
      color: "text-green-500",
      bg: "bg-green-500",
      progressClass: "[&>div]:bg-green-500",
    },
    high: { label: t("vc.security.high"), color: "text-green-500", bg: "bg-green-500", progressClass: "[&>div]:bg-green-500" },
    medium: {
      label: t("vc.security.medium"),
      color: "text-yellow-500",
      bg: "bg-yellow-500",
      progressClass: "[&>div]:bg-yellow-500",
    },
    low: {
      label: t("vc.security.low"),
      color: "text-orange-500",
      bg: "bg-orange-500",
      progressClass: "[&>div]:bg-orange-500",
    },
    untrusted: { label: t("vc.security.untrusted"), color: "text-red-500", bg: "bg-red-500", progressClass: "[&>div]:bg-red-500" },
  }

  const config = levelConfig[level]

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          {t("vc.security.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="flex items-center gap-6">
          <div
            className={cn(
              "h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold border-4",
              level === "very-high" && "border-green-500 text-green-500",
              level === "high" && "border-green-500 text-green-500",
              level === "medium" && "border-yellow-500 text-yellow-500",
              level === "low" && "border-orange-500 text-orange-500",
              level === "untrusted" && "border-red-500 text-red-500",
            )}
          >
            {score}
          </div>
          <div className="flex-1 space-y-2">
            <p className={cn("text-xl font-semibold", config.color)}>{config.label}</p>
            <Progress value={score} className={cn("h-3", config.progressClass)} />
            <p className="text-sm text-muted-foreground">{t("vc.security.scorePoints", { score, maxScore })}</p>
          </div>
        </div>

        {/* Checks */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.security.checks")}</h4>
          <div className="space-y-2">
            {checks.map((check, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  check.passed ? "bg-green-500/5" : "bg-muted/30",
                )}
              >
                {check.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{getCheckLabel(check.name)}</p>
                  <p className="text-xs text-muted-foreground">{getCheckDescription(check.description)}</p>
                </div>
                <span className={cn("text-sm font-mono", check.passed ? "text-green-500" : "text-muted-foreground")}>
                  {check.points > 0 ? `+${check.points}` : check.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              {t("vc.security.recommendations")}
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
