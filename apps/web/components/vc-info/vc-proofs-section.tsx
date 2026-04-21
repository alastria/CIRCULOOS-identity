"use client"

import { Key, Copy, CheckCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState } from "react"
import { useI18n } from "@/lib/i18n/provider"
import type { VCProof } from "@/lib/types/vc"

interface VCProofsSectionProps {
  proofs: VCProof[]
  vcHash: string
}

export function VCProofsSection({ proofs, vcHash }: VCProofsSectionProps) {
  const { locale, t } = useI18n()
  const [expandedProofs, setExpandedProofs] = useState<number[]>([])
  const [copiedHash, setCopiedHash] = useState(false)

  const toggleProof = (index: number) => {
    setExpandedProofs((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const copyHash = async () => {
    await navigator.clipboard.writeText(vcHash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const truncate = (str: string, length = 20) => {
    if (str.length <= length) return str
    return `${str.slice(0, length / 2)}...${str.slice(-length / 2)}`
  }

  const getProofPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case "assertionMethod":
        return t("vc.proofs.assertionMethod")
      case "authentication":
        return t("vc.proofs.authentication")
      default:
        return purpose
    }
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5 text-primary" />
          {t("vc.proofs.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* VC Hash */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.proofs.hash")}</h4>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
            <code className="text-sm font-mono flex-1 truncate">{vcHash}</code>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={copyHash}>
              {copiedHash ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("vc.proofs.hashDescription")}</p>
        </div>

        {/* Proofs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t("vc.proofs.proofsLabel", { count: proofs.length })}</h4>

          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg">
              {t("vc.proofs.noProofs")}
            </p>
          ) : (
            <div className="space-y-3">
              {proofs.map((proof, index) => (
                <Collapsible key={index} open={expandedProofs.includes(index)} onOpenChange={() => toggleProof(index)}>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{proof.type || t("vc.proofs.unknownType")}</Badge>
                          <span className="text-sm text-foreground">{getProofPurposeLabel(proof.proofPurpose)}</span>
                        </div>
                        {expandedProofs.includes(index) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                        {/* Verification Method */}
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.proofs.verificationMethod")}</span>
                          <code className="block text-sm font-mono bg-muted/30 px-2 py-1 rounded truncate">
                            {proof.verificationMethod}
                          </code>
                        </div>

                        {/* Created */}
                        {proof.created && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.proofs.createdAt")}</span>
                            <p className="text-sm text-foreground">{new Date(proof.created).toLocaleString(locale === "es" ? "es-ES" : "en-US")}</p>
                          </div>
                        )}

                        {/* EIP-712 Details */}
                        {proof.eip712 && (
                          <div className="space-y-3">
                            <h5 className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.proofs.eip712Details")}</h5>

                            {/* Domain */}
                            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                              <p className="text-xs font-medium text-foreground">{t("vc.proofs.domain")}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">{t("vc.proofs.name")}:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.name}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{t("vc.proofs.version")}:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.version}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{t("vc.proofs.chainId")}:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.chainId}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">{t("vc.proofs.contract")}:</span>{" "}
                                  <a
                                    href={`https://etherscan.io/address/${proof.eip712.domain.verifyingContract}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    {truncate(proof.eip712.domain.verifyingContract)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Signature */}
                        {proof.signature && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">{t("vc.proofs.signature")}</span>
                            <code className="block text-xs font-mono bg-muted/30 px-2 py-1 rounded break-all max-h-20 overflow-y-auto">
                              {proof.signature}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              {t("vc.proofs.signatureLength", {
                                count: proof.signature.length,
                                bytes: Math.floor(proof.signature.length / 2),
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
