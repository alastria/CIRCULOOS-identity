"use client"

import { User, Copy, CheckCircle, ExternalLink, HelpCircle, Lock, Unlock, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import type { VCHolderAnalysis } from "@/lib/types/vc"

interface VCHolderSectionProps {
  holder: VCHolderAnalysis
  onVerifySignature: () => void
  signatureVerifying: boolean
}

export function VCHolderSection({ holder, onVerifySignature, signatureVerifying }: VCHolderSectionProps) {
  const { locale, t } = useI18n()
  const [copiedDid, setCopiedDid] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedDid(true)
    setTimeout(() => setCopiedDid(false), 2000)
  }

  const truncateAddress = (address: string) => {
    if (address.length <= 20) return address
    return `${address.slice(0, 10)}...${address.slice(-8)}`
  }

  const formatClaimValue = (value: unknown, type: string): string => {
    if (type === "boolean") return value ? t("vc.holder.yes") : t("vc.holder.no")
    if (type === "date") return new Date(value as string).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")
    if (type === "hash") return `${String(value).slice(0, 10)}...${String(value).slice(-8)}`
    if (type === "email" && !showSensitive) {
      const email = String(value)
      const [local, domain] = email.split("@")
      return `${local.slice(0, 2)}***@${domain}`
    }
    if (type === "object" || type === "array") return JSON.stringify(value, null, 2)
    return String(value)
  }

  const privacyProgress = holder.privacyLevel === "high" ? 100 : holder.privacyLevel === "medium" ? 60 : 30

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          {t("vc.holder.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Holder Identification */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.holder.identification")}</h4>

          {holder.did ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("vc.holder.didLabel")}</span>
                <Badge variant="outline" className="text-xs">
                  {holder.didType}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted/50 px-2 py-1 rounded font-mono truncate max-w-[300px]">
                  {truncateAddress(holder.did)}
                </code>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(holder.did!)}>
                  {copiedDid ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("vc.holder.unspecifiedIdentifier")}</p>
          )}

          {holder.ethereumAddress && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t("vc.holder.ethereumAddress")}</span>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted/50 px-2 py-1 rounded font-mono">
                  {truncateAddress(holder.ethereumAddress)}
                </code>
                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                  <a
                    href={`https://etherscan.io/address/${holder.ethereumAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {holder.name && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t("vc.holder.name")}</span>
              <p className="font-medium text-foreground">{holder.name}</p>
            </div>
          )}
        </div>

        {/* Claims */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.holder.claims")}</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowSensitive(!showSensitive)}>
              {showSensitive ? (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  {t("vc.holder.hide")}
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  {t("vc.holder.show")}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {holder.claims.map((claim, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border flex items-start justify-between gap-4",
                  claim.isProtected ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground capitalize">
                      {claim.key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    {claim.isProtected && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Lock className="h-3.5 w-3.5 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("vc.holder.protectedData")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {claim.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 font-mono break-all">
                    {formatClaimValue(claim.value, claim.type)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Level */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.holder.privacyLevel")}</h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {holder.privacyLevel === "high" && <Lock className="h-4 w-4 text-green-500" />}
                {holder.privacyLevel === "medium" && <Lock className="h-4 w-4 text-yellow-500" />}
                {holder.privacyLevel === "low" && <Unlock className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium text-foreground">
                  {holder.privacyLevel === "high" && t("vc.holder.highPrivacy")}
                  {holder.privacyLevel === "medium" && t("vc.holder.mediumPrivacy")}
                  {holder.privacyLevel === "low" && t("vc.holder.lowPrivacy")}
                </span>
              </div>
            </div>
            <Progress
              value={privacyProgress}
              className={cn(
                "h-2",
                holder.privacyLevel === "high" && "[&>div]:bg-green-500",
                holder.privacyLevel === "medium" && "[&>div]:bg-yellow-500",
                holder.privacyLevel === "low" && "[&>div]:bg-red-500",
              )}
            />
          </div>
        </div>

        {/* Holder Signature */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.holder.signatureSection")}</h4>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {holder.signatureValid === true && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-500 font-medium">{t("vc.holder.signedByHolder")}</span>
                </>
              )}
              {holder.signatureValid === false && (
                <>
                  <HelpCircle className="h-5 w-5 text-yellow-500" />
                  <span className="text-yellow-500 font-medium">{t("vc.holder.onlySignedByIssuer")}</span>
                </>
              )}
              {holder.signatureValid === null && (
                <>
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("vc.holder.signatureNotVerified")}</span>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onVerifySignature} disabled={signatureVerifying}>
              {signatureVerifying ? t("vc.holder.verifying") : t("vc.holder.verify")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
