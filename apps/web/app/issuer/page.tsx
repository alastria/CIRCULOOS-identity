"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Plus, History, FileText, Send, Loader2, AlertCircle, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAccount, useSignTypedData, useSignMessage, useChainId, useSwitchChain } from "wagmi"
import { getEIP712Types, getCredentialType } from "@circuloos/common/eip712"

const CREDENTIAL_TYPES = [
  {
    id: "circuloos-marketplace",
    name: "Circuloos-marketplace",
    description: "Credencial de acceso al marketplace Circuloos",
  },
]

export default function IssuerNewPage() {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: "",
    wallet: "",
    companyName: "",
    credentialType: CREDENTIAL_TYPES[0].id,
  })

  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(formData.wallet)) {
        setError(t("issuer.new.errors.invalidWallet"))
        setIsLoading(false)
        return
      }

      if (!address) {
        setError(t("issuer.new.errors.walletRequired"))
        setIsLoading(false)
        return
      }

      // 1. Prepare (Create Draft) - Authentication handled by JWT cookie
      toast.info(t("issuer.new.preparing"))
      const prepareResponse = await api.issuer.prepare(
        formData.email,
        formData.wallet,
        formData.companyName
      )

      const { id, draftVc, domain } = prepareResponse

      // 2. Verify chainId matches before signing
      const expectedChainId = domain?.chainId || parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337", 10)

      if (activeChainId !== expectedChainId) {
        // console.warn(`[ChainId Mismatch] Active: ${activeChainId}, Expected: ${expectedChainId}`)

        // Get network name for better UX
        const networkName = expectedChainId === 31337
          ? "Hardhat Local"
          : expectedChainId === 2020
            ? "Alastria Red-T"
            : `Chain ${expectedChainId}`

        // Try to switch network automatically
        try {
          toast.info(t("issuer.new.switchingNetwork") || `Cambiando a red ${networkName}...`)
          await switchChain({ chainId: expectedChainId })
          // Wait a moment for the network switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (switchError: any) {
          // User rejected network switch or switch failed
          if (switchError.code === 4001) {
            throw new Error(
              t("issuer.new.errors.networkSwitchCancelled") ||
              "Cambio de red cancelado. Por favor, cambia a la red correcta manualmente."
            )
          } else {
            throw new Error(
              t("issuer.new.errors.networkMismatch") ||
              `Por favor, cambia tu wallet a la red ${networkName} (Chain ID: ${expectedChainId}).

Tu wallet está conectado a Chain ID: ${activeChainId}.

Para cambiar la red:
1. Abre MetaMask
2. Haz clic en el selector de red (arriba)
3. Selecciona "${networkName}"
4. Intenta de nuevo`
            )
          }
        }
      }

      // 3. Sign (Issuer Signature) - Using new schema system
      toast.info(t("issuer.new.signingPrompt"))

      // Get the beautiful schema for circuloos-marketplace
      const credentialType = 'circuloos-marketplace'
      const schema = getCredentialType(credentialType)

      if (!schema) {
        throw new Error(`Credential type ${credentialType} not found`)
      }

      // Build the message using the schema's message builder
      const { primaryType, types, messageBuilder } = schema.schema.issuance
      const message = messageBuilder(draftVc)

      // Sign with beautiful UX - user will see readable fields!
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType,
        message
      })

      // 3. Mint (Submit Signature & Send Email)
      const mintResponse = await api.issuer.mint(id, signature, address, domain)

      toast.success(t("issuer.new.success"), {
        description: t("issuer.new.credentialSignedAndSent", { email: formData.email, id: mintResponse.id }),
      })

      // Reset form
      setFormData({
        email: "",
        wallet: "",
        companyName: "",
        credentialType: CREDENTIAL_TYPES[0].id,
      })
    } catch (err: any) {
      // console.error(err)

      // Extract and format error message
      let errorMessage = err?.response?.data?.error || err?.message || t("issuer.new.error")

      // Check for specific error types for better user experience
      if (typeof errorMessage === 'string') {
        const lowerError = errorMessage.toLowerCase()

        // Chainid mismatch error (from viem)
        if (lowerError.includes('chainid') && lowerError.includes('must match')) {
          const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337", 10)
          const networkName = expectedChainId === 31337
            ? "Hardhat Local"
            : expectedChainId === 2020
              ? "Alastria Red-T"
              : `Chain ${expectedChainId}`

          // Try to extract the actual chain ID from the error message
          // Error format: 'Provided chainId "31337" must match the active chainId "137"'
          const match = lowerError.match(/active chainid "?(\d+)"?/)
          const realActiveChainId = match ? match[1] : activeChainId

          errorMessage = `Red Incorrecta

Tu wallet está conectado a la red equivocada.

Red requerida: ${networkName} (Chain ID: ${expectedChainId})
Red actual: Chain ID ${realActiveChainId}

Para cambiar la red en MetaMask:
1. Haz clic en el selector de red (arriba en MetaMask)
2. Selecciona "${networkName}"
3. Vuelve a intentar la emisión`
        }
        // User rejected signature
        else if (lowerError.includes('user rejected') || lowerError.includes('user denied')) {
          errorMessage = t("issuer.new.errors.signatureRejected") || "Firma cancelada por el usuario."
        }
      }

      setError(errorMessage)
      toast.error(t("issuer.new.error"), {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCredential = CREDENTIAL_TYPES.find((c) => c.id === formData.credentialType)

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background text-foreground">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">{t("issuer.title")}</h1>
          <p className="text-muted-foreground">{t("issuer.subtitle")}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8">
          <Button variant="default" className="gap-2">
            <Plus className="w-4 h-4" />
            {t("issuer.tabs.new")}
          </Button>
          <Button variant="outline" asChild className="gap-2 bg-transparent">
            <Link href="/issuer/history">
              <History className="w-4 h-4" />
              {t("issuer.tabs.history")}
            </Link>
          </Button>
        </div>

        {/* Issue Form */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileText className="w-5 h-5" />
              {t("issuer.new.title")}
            </CardTitle>
            <CardDescription>{t("issuer.new.formDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="credentialType">{t("issuer.new.form.credentialType")}</Label>
                <Select
                  value={formData.credentialType}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, credentialType: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("issuer.new.form.credentialTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCredential && (
                  <p className="text-sm text-muted-foreground">{selectedCredential.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {t("issuer.new.companyNameLabel")}
                  </span>
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder={t("issuer.new.form.companyNamePlaceholder")}
                  value={formData.companyName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("issuer.new.form.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("issuer.new.form.emailPlaceholder")}
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet">
                  {t("issuer.new.form.wallet")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wallet"
                  type="text"
                  placeholder={t("issuer.new.form.walletPlaceholder")}
                  value={formData.wallet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, wallet: e.target.value }))}
                  className="font-mono"
                  required
                  pattern="^0x[a-fA-F0-9]{40}$"
                  title={t("issuer.new.form.walletTooltip")}
                />
                <p className="text-xs text-muted-foreground">{t("issuer.new.walletRequiredNote")}</p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {error}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full gap-2" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("issuer.new.form.submit")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
