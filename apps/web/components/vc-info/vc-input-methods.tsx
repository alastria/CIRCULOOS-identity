"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, Link, Wallet, QrCode, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { VCInputMethod } from "@/lib/types/vc"
import { useCirculoosSnap } from "@/hooks/use-circuloos-snap"
import { toast } from "sonner"

interface VCInputMethodsProps {
  onVCLoaded: (vcJson: string, method: VCInputMethod) => void
  isLoading: boolean
  error: string | null
}

export function VCInputMethods({ onVCLoaded, isLoading, error }: VCInputMethodsProps) {
  const [activeTab, setActiveTab] = useState<VCInputMethod>("upload")
  const [dragActive, setDragActive] = useState(false)
  const [pastedJson, setPastedJson] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [snapCredentials, setSnapCredentials] = useState<any[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("")
  const [loadingSnap, setLoadingSnap] = useState(false)

  const { isInstalled, installSnap, getCredentials } = useCirculoosSnap()

  // Handle file drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      return
    }
    setSelectedFile(file)
    const text = await file.text()
    onVCLoaded(text, "upload")
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handlePasteAnalyze = () => {
    if (pastedJson.trim()) {
      onVCLoaded(pastedJson, "paste")
    }
  }

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return
    try {
      const response = await fetch(urlInput)
      const text = await response.text()
      onVCLoaded(text, "url")
    } catch {
      onVCLoaded("", "url")
    }
  }

  const handleSnapImport = async () => {
    if (!isInstalled) {
      const installed = await installSnap()
      if (!installed) {
        toast.error("Por favor, instala el MetaMask Snap primero")
        return
      }
    }

    setLoadingSnap(true)
    try {
      const credentials = await getCredentials()

      if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
        toast.error("No se encontraron credenciales en tu MetaMask Snap")
        setLoadingSnap(false)
        return
      }

      // Store credentials for selection
      setSnapCredentials(credentials)

      // If only one credential, load it directly
      if (credentials.length === 1) {
        const vcJson = JSON.stringify(credentials[0], null, 2)
        onVCLoaded(vcJson, "snap")
        setLoadingSnap(false)
        return
      }

      // If multiple, user needs to select one
      setLoadingSnap(false)
    } catch (error: any) {
      console.error("Error loading credentials from snap:", error)
      toast.error(error?.message || "Error al cargar credenciales del snap")
      setLoadingSnap(false)
    }
  }

  const handleSelectCredential = () => {
    if (!selectedCredentialId) return

    const credential = snapCredentials.find((vc: any) => vc.id === selectedCredentialId)
    if (!credential) {
      toast.error("Credencial no encontrada")
      return
    }

    const vcJson = JSON.stringify(credential, null, 2)
    onVCLoaded(vcJson, "snap")
    setSelectedCredentialId("")
    setSnapCredentials([])
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as VCInputMethod)}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="upload" className="flex items-center gap-2 text-xs sm:text-sm py-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Archivo</span>
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2 text-xs sm:text-sm py-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Pegar</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2 text-xs sm:text-sm py-2">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">URL</span>
            </TabsTrigger>
            <TabsTrigger value="snap" className="flex items-center gap-2 text-xs sm:text-sm py-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Snap</span>
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2 text-xs sm:text-sm py-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                selectedFile && "border-green-500 bg-green-500/5",
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-foreground">Arrastra tu archivo JSON aquí</p>
                  <p className="text-sm text-muted-foreground">o haz click para seleccionar (máx. 10MB)</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Paste Tab */}
          <TabsContent value="paste" className="mt-4 space-y-4">
            <Textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder='{"@context": ["https://www.w3.org/2018/credentials/v1"], "type": ["VerifiableCredential"], ...}'
              className="min-h-[200px] font-mono text-sm bg-muted/30"
            />
            <Button onClick={handlePasteAnalyze} disabled={!pastedJson.trim() || isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Analizar Credencial
            </Button>
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://issuer.com/credentials/abc123.json"
                className="bg-muted/30"
              />
              <p className="text-xs text-muted-foreground">Introduce la URL pública donde está alojada la credencial</p>
            </div>
            <Button onClick={handleUrlLoad} disabled={!urlInput.trim() || isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link className="h-4 w-4 mr-2" />}
              Cargar desde URL
            </Button>
          </TabsContent>

          {/* Snap Tab */}
          <TabsContent value="snap" className="mt-4">
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F6851B]/10 flex items-center justify-center">
                <Wallet className="h-8 w-8 text-[#F6851B]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Importar desde MetaMask</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Conecta tu wallet y selecciona una credencial almacenada en el Snap
                </p>
              </div>

              {snapCredentials.length === 0 ? (
                <Button onClick={handleSnapImport} disabled={loadingSnap || isLoading} variant="outline">
                  {loadingSnap ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                  {loadingSnap ? "Cargando..." : "Conectar MetaMask"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una credencial" />
                    </SelectTrigger>
                    <SelectContent>
                      {snapCredentials.map((vc: any) => {
                        const vcType = Array.isArray(vc.type) ? vc.type[1] || vc.type[0] : vc.type
                        const vcId = vc.id || "sin-id"
                        return (
                          <SelectItem key={vcId} value={vcId}>
                            {vcType || "VerifiableCredential"} - {vcId.slice(0, 8)}...
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={handleSelectCredential} disabled={!selectedCredentialId || isLoading} className="flex-1">
                      {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Cargar Credencial
                    </Button>
                    <Button onClick={() => { setSnapCredentials([]); setSelectedCredentialId("") }} variant="outline">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Direct/QR Tab */}
          <TabsContent value="direct" className="mt-4">
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Link Directo o QR</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Usa un link con la VC embebida o escanea un código QR
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">/vc/info?vc=[base64_encoded_vc]</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Error al procesar</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
