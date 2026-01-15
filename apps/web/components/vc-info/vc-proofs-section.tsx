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
  const { t } = useI18n()
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
          Firmas y Pruebas Criptográficas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* VC Hash */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Hash de la Credencial</h4>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
            <code className="text-sm font-mono flex-1 truncate">{vcHash}</code>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={copyHash}>
              {copiedHash ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Huella digital única - cualquier cambio genera un hash diferente
          </p>
        </div>

        {/* Proofs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Pruebas ({proofs.length})
          </h4>

          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg">
              Esta credencial no tiene firmas (proof)
            </p>
          ) : (
            <div className="space-y-3">
              {proofs.map((proof, index) => (
                <Collapsible key={index} open={expandedProofs.includes(index)} onOpenChange={() => toggleProof(index)}>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{proof.type || "Unknown"}</Badge>
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
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            Método de Verificación
                          </span>
                          <code className="block text-sm font-mono bg-muted/30 px-2 py-1 rounded truncate">
                            {proof.verificationMethod}
                          </code>
                        </div>

                        {/* Created */}
                        {proof.created && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              Fecha de Creación
                            </span>
                            <p className="text-sm text-foreground">{new Date(proof.created).toLocaleString("es-ES")}</p>
                          </div>
                        )}

                        {/* EIP-712 Details */}
                        {proof.eip712 && (
                          <div className="space-y-3">
                            <h5 className="text-xs text-muted-foreground uppercase tracking-wide">Detalles EIP-712</h5>

                            {/* Domain */}
                            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                              <p className="text-xs font-medium text-foreground">Domain</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Name:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.name}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Version:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.version}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ChainId:</span>{" "}
                                  <span className="text-foreground">{proof.eip712.domain.chainId}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Contract:</span>{" "}
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
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Firma</span>
                            <code className="block text-xs font-mono bg-muted/30 px-2 py-1 rounded break-all max-h-20 overflow-y-auto">
                              {proof.signature}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              {proof.signature.length} caracteres ({Math.floor(proof.signature.length / 2)} bytes)
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
