"use client"

import { useState, useEffect, useCallback } from "react"
import { Wallet, Download, FileText, Loader2, AlertCircle, CheckCircle2, Shield, Server, Cpu, RefreshCw, Upload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCirculoosSnap } from "@/hooks/use-circuloos-snap"
import { useI18n } from "@/lib/i18n/provider"
import { api } from "@/lib/api"
import { toast } from "sonner"
import Link from "next/link"
import { useAccount } from "wagmi"

interface Credential {
  id?: string
  type: string | string[]
  issuer: string | { id: string }
  issuanceDate?: string
  expirationDate?: string
  credentialSubject: any
  proof?: any
  hasProof?: boolean
}

export default function WalletPage() {
  const { t, locale } = useI18n()
  const { address, isConnected } = useAccount()
  const { isInstalled, installSnap, getCredentials, createPresentation, saveCredential, clearAllCredentials, isLoading: snapLoading } = useCirculoosSnap()

  // Separate state for each source
  const [snapCredentials, setSnapCredentials] = useState<Credential[]>([])
  const [backendCredentials, setBackendCredentials] = useState<Credential[]>([])
  const [loadingSnap, setLoadingSnap] = useState(false)
  const [loadingBackend, setLoadingBackend] = useState(false)
  const [savingToSnapId, setSavingToSnapId] = useState<string | null>(null)
  const [clearingSnap, setClearingSnap] = useState(false)

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [presentingId, setPresentingId] = useState<string | null>(null)
  const [isPresenting, setIsPresenting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePresentVP = async (vc: Credential, source: 'snap' | 'backend') => {
    if (!address || !vc.id) return

    setPresentingId(vc.id)
    setIsPresenting(true)

    try {
      if (source === 'snap') {
        // Generate VP using Snap
        toast.info("Generando Presentación Verificable (VP)...")
        const vp = await createPresentation([vc.id], address)

        if (!vp) {
          throw new Error("No se pudo generar la VP")
        }

        // Verify VP with Backend
        toast.info("Verificando VP con el servidor...")
        const result = await api.verifier.verifyVP(vp)

        if (result.ok) {
          toast.success("VP Verificada Correctamente", {
            description: `Titular: ${result.holder?.slice(0, 10)}...`
          })
        } else {
          throw new Error(result.error || "Error en la verificación")
        }
      } else {
        // For backend credentials, redirect to verify-presentation page
        toast.info("Redirigiendo a verificación de presentación...")
        window.location.href = `/verify-presentation?vc=${encodeURIComponent(btoa(JSON.stringify(vc)))}`
      }
    } catch (err: any) {
      // console.error("Error presenting VP:", err)
      toast.error("Error al presentar/verificar VP", {
        description: err.message
      })
    } finally {
      setIsPresenting(false)
      setPresentingId(null)
    }
  }

  // Load credentials from MetaMask Snap
  const loadSnapCredentials = useCallback(async () => {
    if (!isInstalled || !isConnected || !address) {
      setSnapCredentials([])
      return
    }

    setLoadingSnap(true)
    try {
      const creds = await getCredentials(undefined, address) as Credential[]
      setSnapCredentials(creds || [])
    } catch (err: any) {
      // console.error("Error loading snap credentials:", err)
      toast.error("Error cargando credenciales del Snap")
    } finally {
      setLoadingSnap(false)
    }
  }, [isInstalled, isConnected, address, getCredentials])

  // Load credentials from Backend
  const loadBackendCredentials = useCallback(async () => {
    if (!isConnected || !address) {
      setBackendCredentials([])
      return
    }

    setLoadingBackend(true)
    try {
      const data = await api.credentials.getMyCredentials()
      setBackendCredentials(data.credentials || [])
    } catch (err: any) {
      // console.error("Error loading backend credentials:", err)
      // Don't show error toast if it's just a 401 (not logged in)
      if (err?.response?.status !== 401) {
        toast.error("Error cargando credenciales del servidor")
      }
    } finally {
      setLoadingBackend(false)
    }
  }, [isConnected, address])

  useEffect(() => {
    if (isConnected && address) {
      loadBackendCredentials()
      if (isInstalled) {
        loadSnapCredentials()
      }
    } else {
      setSnapCredentials([])
      setBackendCredentials([])
    }
  }, [isInstalled, isConnected, address, loadSnapCredentials, loadBackendCredentials])

  const handleInstallSnap = async () => {
    const installed = await installSnap()
    if (installed) {
      await loadSnapCredentials()
    }
  }

  // Clear all credentials from the Snap
  const handleClearSnap = async () => {
    if (!confirm("¿Estás seguro? Esta acción eliminará TODAS las credenciales del MetaMask Snap y no se puede deshacer.")) {
      return
    }

    setClearingSnap(true)
    try {
      const result = await clearAllCredentials()
      if (result?.success) {
        setSnapCredentials([])
      }
    } catch (err: any) {
      // console.error("Error clearing snap:", err)
      toast.error("Error al limpiar el Snap")
    } finally {
      setClearingSnap(false)
    }
  }

  // Save a backend credential to the Snap
  const handleSaveToSnap = async (vc: Credential) => {
    const vcId = vc.id || "unknown"
    setSavingToSnapId(vcId)
    try {
      if (!isInstalled) {
        const installed = await installSnap()
        if (!installed) {
          toast.error("Necesitas instalar el MetaMask Snap primero")
          return
        }
      }

      // Need to get the full VC with proof from the backend
      const fullVC = await api.credentials.getCredential(vcId)

      if (!fullVC || !fullVC.proof) {
        toast.error("La credencial no tiene firma, no se puede guardar en Snap")
        return
      }

      const result = await saveCredential(fullVC)
      if (result) {
        toast.success("Credencial guardada en MetaMask Snap")
        // Refresh snap credentials
        await loadSnapCredentials()
      }
    } catch (err: any) {
      // console.error("Error saving to snap:", err)
      toast.error("Error al guardar en Snap", {
        description: err.message
      })
    } finally {
      setSavingToSnapId(null)
    }
  }

  const handleDownloadPDF = async (vc: Credential, source: 'snap' | 'backend') => {
    const vcId = vc.id || "unknown"
    setDownloadingId(vcId)
    try {
      if (!address) {
        toast.error("Debes conectar tu wallet para generar el PDF")
        return
      }

      let pdfBlob: Blob

      if (source === 'backend') {
        // For backend credentials, use the direct endpoint
        pdfBlob = await api.issuer.downloadPDF(vcId)
      } else {
        // For snap credentials, generate from VC JSON
        pdfBlob = await api.issuer.downloadPDFFromVC(vc, address)
      }

      // Create download link
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Credential_${vcId.slice(-8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("PDF descargado correctamente")
    } catch (err: any) {
      // console.error("Error downloading PDF:", err)
      const errorMessage = err?.response?.data?.error || err?.message || "Error al generar el PDF"
      toast.error(errorMessage)
    } finally {
      setDownloadingId(null)
    }
  }

  const getCredentialType = (vc: Credential) => {
    if (Array.isArray(vc.type)) {
      return vc.type.find(t => t !== 'VerifiableCredential') || vc.type[0] || "VerifiableCredential"
    }
    return vc.type || "VerifiableCredential"
  }

  const getIssuer = (vc: Credential) => {
    if (typeof vc.issuer === "string") {
      return vc.issuer
    }
    return vc.issuer?.id || "Unknown"
  }

  const formatDate = (dateStr?: string, localeOverride?: string) => {
    if (!dateStr) return "N/A"
    try {
      const loc = localeOverride || (locale === 'es' ? 'es-ES' : 'en-US')
      return new Date(dateStr).toLocaleDateString(loc, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const CredentialCard = ({ vc, index, source }: { vc: Credential, index: number, source: 'snap' | 'backend' }) => {
    const vcId = vc.id || `vc-${index}`
    const isDownloading = downloadingId === vcId
    const hasSignature = vc.proof || vc.hasProof

    return (
      <Card className="border-border/50 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {getCredentialType(vc)}
                </Badge>
                {hasSignature && (
                  <Badge className="bg-green-500/20 text-green-500 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("walletPage.credential.signed")}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {source === 'snap' ? <Cpu className="h-3 w-3 mr-1" /> : <Server className="h-3 w-3 mr-1" />}
                  {source === 'snap' ? 'Snap' : t("walletPage.tabs.server")}
                </Badge>
              </div>
              <CardTitle className="text-base">
                {getCredentialType(vc).replace(/([A-Z])/g, ' $1').trim()}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                ID: <code className="text-[10px]">{vcId.slice(0, 20)}...</code>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Credential Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">{t("walletPage.credential.issuer")}</p>
                <p className="font-medium truncate" title={getIssuer(vc)}>{getIssuer(vc)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("walletPage.credential.issuedAt")}</p>
                <p className="font-medium">{formatDate(vc.issuanceDate)}</p>
              </div>
              {vc.expirationDate && (
                <div>
                  <p className="text-muted-foreground">{t("walletPage.credential.expiresAt")}</p>
                  <p className="font-medium">{formatDate(vc.expirationDate)}</p>
                </div>
              )}
              {vc.credentialSubject?.email && (
                <div>
                  <p className="text-muted-foreground">{t("walletPage.credential.email")}</p>
                  <p className="font-medium truncate">{vc.credentialSubject.email}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t flex-wrap">
              <Button
                onClick={() => handlePresentVP(vc, source)}
                disabled={isPresenting}
                size="sm"
                className="gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs"
              >
                {isPresenting && presentingId === vcId ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {t("walletPage.credential.present")}
              </Button>
              <Button
                onClick={() => handleDownloadPDF(vc, source)}
                disabled={isDownloading}
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {t("walletPage.credential.pdf")}
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
              >
                <Link href={`/vc/info?vc=${encodeURIComponent(btoa(JSON.stringify(vc)))}`}>
                  <FileText className="h-3 w-3" />
                  {t("walletPage.credential.details")}
                </Link>
              </Button>
              {/* Show "Save to Snap" button only for backend credentials */}
              {source === 'backend' && (
                <Button
                  onClick={() => handleSaveToSnap(vc)}
                  disabled={savingToSnapId === vcId}
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                >
                  {savingToSnapId === vcId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {t("walletPage.credential.saveToSnap")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalCredentials = snapCredentials.length + backendCredentials.length

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Wallet className="h-8 w-8" />
            {t("walletPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("walletPage.subtitle")}
          </p>
        </div>

        {/* Wallet Connection Required */}
        {!isConnected && (
          <Card className="mb-8 border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t("walletPage.wallet.notConnected")}
              </CardTitle>
              <CardDescription>
                {t("walletPage.wallet.connectToView")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("walletPage.wallet.restrictedAccess")}</AlertTitle>
                <AlertDescription>
                  {t("walletPage.wallet.onlyYourCredentials")}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Connected Wallet Info */}
        {isConnected && address && (
          <Card className="mb-6 border-green-500/30 bg-green-500/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-600">{t("walletPage.wallet.connected")}</p>
                    <p className="text-xs text-muted-foreground font-mono">{address}</p>
                  </div>
                </div>
                <Badge variant="outline">
                  {totalCredentials} {totalCredentials !== 1 ? t("walletPage.wallet.credentialsPlural", { count: totalCredentials }) : t("walletPage.wallet.credentials", { count: totalCredentials })}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content with Tabs */}
        {isConnected && (
          <Tabs defaultValue="backend" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="backend" className="gap-2">
                <Server className="h-4 w-4" />
                {t("walletPage.tabs.server")} ({backendCredentials.length})
              </TabsTrigger>
              <TabsTrigger value="snap" className="gap-2">
                <Cpu className="h-4 w-4" />
                {t("walletPage.tabs.snap")} ({snapCredentials.length})
              </TabsTrigger>
            </TabsList>

            {/* Backend Credentials Tab */}
            <TabsContent value="backend" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("walletPage.server.description")}
                </p>
                <Button onClick={loadBackendCredentials} variant="outline" size="sm" disabled={loadingBackend}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingBackend ? 'animate-spin' : ''}`} />
                  {t("walletPage.server.refresh")}
                </Button>
              </div>

              {loadingBackend && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-4 text-muted-foreground">{t("walletPage.server.loading")}</span>
                </div>
              )}

              {!loadingBackend && backendCredentials.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">{t("walletPage.server.empty.title")}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t("walletPage.server.empty.description")}
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/issuer">{t("walletPage.server.empty.requestCredential")}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!loadingBackend && backendCredentials.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {backendCredentials.map((vc, index) => (
                    <CredentialCard key={vc.id || index} vc={vc} index={index} source="backend" />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Snap Credentials Tab */}
            <TabsContent value="snap" className="space-y-4">
              {!isInstalled ? (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      {t("walletPage.snap.notInstalled")}
                    </CardTitle>
                    <CardDescription>
                      {t("walletPage.snap.installDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleInstallSnap} disabled={snapLoading} className="gap-2">
                      {snapLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      {t("walletPage.snap.install")}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t("walletPage.snap.description")}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={loadSnapCredentials} variant="outline" size="sm" disabled={loadingSnap}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingSnap ? 'animate-spin' : ''}`} />
                        {t("walletPage.snap.refresh")}
                      </Button>
                      {snapCredentials.length > 0 && (
                        <Button
                          onClick={handleClearSnap}
                          variant="outline"
                          size="sm"
                          disabled={clearingSnap}
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        >
                          {clearingSnap ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          {t("walletPage.snap.clear")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {loadingSnap && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-4 text-muted-foreground">{t("walletPage.snap.loading")}</span>
                    </div>
                  )}

                  {!loadingSnap && snapCredentials.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center">
                        <Cpu className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">{t("walletPage.snap.empty.title")}</h3>
                        <p className="text-muted-foreground">
                          {t("walletPage.snap.empty.description")}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {!loadingSnap && snapCredentials.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {snapCredentials.map((vc, index) => (
                        <CredentialCard key={vc.id || index} vc={vc} index={index} source="snap" />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

