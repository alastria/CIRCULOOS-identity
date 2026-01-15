"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
    FileCheck,
    Upload,
    QrCode,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    Shield,
    Calendar,
    Hash,
    User,
    Fingerprint,
    Wallet as WalletIcon,
    FileSignature
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAccount, useConnect, useSignTypedData } from "wagmi"
import { getCredentialType } from "@circuloos/common/eip712"
import { injected } from "wagmi/connectors"
import { toast } from "sonner"

type VerificationStatus = "idle" | "analyzing" | "signing" | "valid" | "invalid" | "revoked"

interface VerificationResult {
    status: "valid" | "invalid" | "revoked"
    holder?: string
    vcs?: any[]
    error?: string
    vpHash?: string
}

export default function VerifyPresentationPage() {
    const { t } = useI18n()
    const { address, isConnected } = useAccount()
    const { connect } = useConnect()
    const { signTypedDataAsync } = useSignTypedData()
    const [status, setStatus] = useState<VerificationStatus>("idle")
    const [result, setResult] = useState<VerificationResult | null>(null)
    const [fileName, setFileName] = useState<string>("")

    const verifyVP = useCallback(async (file: File) => {
        setStatus("analyzing")
        setFileName(file.name)
        setResult(null)

        try {
            // Read file content
            const text = await file.text()
            let vpData: any

            // Handle JSON files
            if (file.type === "application/json") {
                try {
                    vpData = JSON.parse(text)
                } catch (e) {
                    throw new Error("El archivo no es un JSON válido")
                }
            }
            // Handle PDF files - extract VC and generate VP with wallet signature
            else if (file.type === "application/pdf") {
                // First, check if wallet is connected
                if (!isConnected || !address) {
                    toast.error("Conecta tu wallet para generar la presentación verificable")
                    setStatus("idle")
                    return
                }

                try {
                    // Dynamic import to avoid SSR issues with pdf-lib
                    const { PDFDocument } = await import('pdf-lib')
                    const arrayBuffer = await file.arrayBuffer()
                    const pdfDoc = await PDFDocument.load(arrayBuffer)

                    // Extract VC from PDF metadata
                    const subject = pdfDoc.getSubject()
                    let vcData: any

                    if (subject) {
                        try {
                            // Try decoding as Base64 first (new format)
                            const decoded = decodeURIComponent(escape(atob(subject)))
                            vcData = JSON.parse(decoded)
                        } catch (e) {
                            // Fallback: Try parsing directly (legacy format)
                            try {
                                vcData = JSON.parse(subject)
                            } catch (e2) {
                                // console.warn('Failed to parse PDF subject as JSON:', e2)
                            }
                        }
                    }

                    // Fallback: Regex match on raw text (Legacy/Backup)
                    if (!vcData) {
                        const match = text.match(/\{[\s\S]*"@context"[\s\S]*\}/)
                        if (match) {
                            vcData = JSON.parse(match[0])
                        }
                    }

                    if (!vcData) {
                        throw new Error("No se pudo extraer la credencial del PDF")
                    }

                    // Now we need to generate a VP from this VC and sign it
                    // Prompt user to sign with their wallet
                    setStatus("signing")
                    toast.info("Por favor, firma la presentación en tu wallet...")

                    const presentation = {
                        "@context": [
                            "https://www.w3.org/2018/credentials/v1"
                        ],
                        type: ["VerifiablePresentation"],
                        verifiableCredential: [vcData],
                        holder: `did:${process.env.NEXT_PUBLIC_DID_METHOD || 'alastria'}:${process.env.NEXT_PUBLIC_DID_NETWORK || 'quorum'}:${address.toLowerCase()}`
                    }

                    // Use new schema system for beautiful UX
                    const credentialType = 'circuloos-marketplace'
                    const schema = getCredentialType(credentialType)

                    if (!schema) {
                        throw new Error(`Credential type ${credentialType} not found`)
                    }

                    const { primaryType, types, messageBuilder } = schema.schema.presentation

                    // Domain for presentation signature
                    const domain = {
                        name: "Alastria Verifiable Presentation",
                        version: "1",
                        chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "2020", 10),
                    }

                    // Build message using schema's message builder - beautiful UX!
                    const timestamp = Date.now()
                    const message = messageBuilder(vcData, address.toLowerCase(), undefined)

                    // Override timestamp to use the one we'll include in proof
                    // This ensures the verifier can reconstruct the exact same message
                    message.timestamp = BigInt(Math.floor(timestamp / 1000))

                    // Sign with MetaMask - User will see beautiful readable fields!
                    const signature = await signTypedDataAsync({
                        domain,
                        types,
                        primaryType,
                        message,
                    })

                    // Serialize the message for the verifier (convert BigInt to string)
                    const serializedMessage = Object.fromEntries(
                        Object.entries(message).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])
                    )

                    // Create a SignedVP structure that the verifier can process
                    vpData = {
                        presentation,
                        proof: {
                            type: "EthereumEip712Signature2021",
                            created: new Date(timestamp).toISOString(),
                            proofPurpose: "authentication",
                            verificationMethod: address.toLowerCase(),
                            eip712: {
                                domain,
                                types,
                                primaryType,
                                message: serializedMessage, // Include the actual signed message!
                            },
                            proofValue: signature,
                            timestamp: Math.floor(timestamp / 1000).toString(),
                        }
                    }

                    toast.success("Presentación firmada correctamente")
                    setStatus("analyzing")

                } catch (err: any) {
                    // console.error('PDF Extraction/Signing Error:', err)
                    if (err.message?.includes("User rejected")) {
                        toast.error("Firma cancelada por el usuario")
                        setStatus("idle")
                        return
                    }
                    throw new Error("Error al procesar el PDF. Asegúrate de que es una credencial válida.")
                }
            } else {
                throw new Error("Formato no soportado. Solo se aceptan archivos JSON o PDF")
            }

            // Call verifier API
            toast.info("Verificando con el servidor...")
            const verifyResult = await api.verifier.verifyVP(vpData)

            if (!verifyResult.ok) {
                // Verification failed
                setResult({
                    status: "invalid",
                    error: verifyResult.error || "Verificación fallida"
                })
                setStatus("invalid")
                return
            }

            setResult({
                status: "valid",
                holder: verifyResult.holder,
                vcs: verifyResult.vcs
            })
            setStatus("valid")
            toast.success("Presentación verificada correctamente")
        } catch (error: any) {
            // console.error('Verification error:', error)
            setResult({
                status: "invalid",
                error: error.message || "Error al verificar la presentación"
            })
            setStatus("invalid")
        }
    }, [address, isConnected, signTypedDataAsync])

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                verifyVP(acceptedFiles[0])
            }
        },
        [verifyVP],
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/json": [".json"],
            "application/pdf": [".pdf"],
        },
        maxFiles: 1,
    })

    const resetVerification = () => {
        setStatus("idle")
        setResult(null)
        setFileName("")
    }

    const statusConfig = {
        valid: {
            icon: CheckCircle2,
            color: "text-green-500",
            bg: "bg-green-500/10",
            border: "border-green-500/30",
            title: t("presentation.result.valid.title"),
            description: t("presentation.result.valid.description"),
        },
        invalid: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            border: "border-red-500/30",
            title: t("presentation.result.invalid.title"),
            description: t("presentation.result.invalid.description"),
        },
        revoked: {
            icon: AlertTriangle,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
            title: t("presentation.result.revoked.title"),
            description: t("presentation.result.revoked.description"),
        },
    }

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                {/* Header */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 mb-6">
                        <Shield className="w-8 h-8 text-purple-500" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4">{t("presentation.title")}</h1>
                    <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                        {t("presentation.subtitle")}
                    </p>
                </div>

                {/* How it works */}
                <Card className="glass mb-6 border-purple-500/20">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-purple-500">?</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-2">{t("presentation.howItWorks.title")}</p>
                                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                                    {/* SECURITY: Avoid dangerouslySetInnerHTML - render text safely */}
                                    <li>{t("presentation.howItWorks.step1Plain")}</li>
                                    <li>{t("presentation.howItWorks.step2Plain")}</li>
                                    <li>{t("presentation.howItWorks.step3Plain")}</li>
                                </ol>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Wallet Connection Prompt for PDF */}
                {!isConnected && (
                    <Card className="glass mb-6 border-amber-500/30 bg-amber-500/5">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <WalletIcon className="w-5 h-5 text-amber-500" />
                                    <div>
                                        <p className="text-sm font-medium">{t("presentation.wallet.connectFirst")}</p>
                                        <p className="text-xs text-muted-foreground">{t("presentation.wallet.requiredToSign")}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => connect({ connector: injected() })}
                                    variant="default"
                                    size="sm"
                                    className="gap-2"
                                >
                                    <WalletIcon className="w-4 h-4" />
                                    {t("presentation.wallet.connect")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Connected wallet indicator */}
                {isConnected && address && (
                    <Card className="glass mb-6 border-green-500/30 bg-green-500/5">
                        <CardContent className="py-3">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-green-600">{t("presentation.wallet.connected")}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{address}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Dropzone or Result */}
                {status === "idle" && (
                    <Card className="glass glow-border animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                        <CardContent className="p-0">
                            <div
                                {...getRootProps()}
                                className={cn(
                                    "relative p-12 text-center cursor-pointer transition-all duration-300 rounded-xl",
                                    "border-2 border-dashed",
                                    isDragActive
                                        ? "border-purple-500 bg-purple-500/5"
                                        : "border-border hover:border-purple-500/50 hover:bg-secondary/30",
                                )}
                            >
                                <input {...getInputProps()} />
                                <div className="space-y-4">
                                    <div
                                        className={cn(
                                            "inline-flex items-center justify-center w-20 h-20 rounded-2xl transition-colors",
                                            isDragActive ? "bg-purple-500/20" : "bg-secondary",
                                        )}
                                    >
                                        <Upload
                                            className={cn(
                                                "w-10 h-10 transition-colors",
                                                isDragActive ? "text-purple-500" : "text-muted-foreground",
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium mb-1">{t("presentation.dropzone.title")}</p>
                                        <p className="text-sm text-muted-foreground">{t("presentation.dropzone.subtitle")}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        <Badge variant="secondary" className="text-xs">
                                            📄 {t("presentation.dropzone.pdfFormat")}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                            {t("presentation.dropzone.jsonFormat")}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Analyzing State */}
                {status === "analyzing" && (
                    <Card className="glass glow-border animate-in fade-in duration-300">
                        <CardContent className="py-16 text-center">
                            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                                <Loader2 className="w-10 h-10 text-purple-500 animate-pulse" />
                            </div>
                            <p className="text-lg font-medium">{t("presentation.status.verifying")}</p>
                            <p className="text-sm text-muted-foreground mt-2">{t("presentation.status.verifyingSubtitle")}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Signing State */}
                {status === "signing" && (
                    <Card className="glass glow-border animate-in fade-in duration-300 border-amber-500/30">
                        <CardContent className="py-16 text-center">
                            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                                <FileSignature className="w-10 h-10 text-amber-500 animate-pulse" />
                            </div>
                            <p className="text-lg font-medium">{t("presentation.status.signingRequired")}</p>
                            <p className="text-sm text-muted-foreground mt-2">{t("presentation.status.signingSubtitle")}</p>
                            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 inline-block">
                                <p className="text-xs text-amber-600">💡 {t("presentation.status.signingTip")}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Result */}
                {(status === "valid" || status === "invalid" || status === "revoked") && result && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Status Card */}
                        <Card className={cn("glass border-2", statusConfig[status].border)}>
                            <CardContent className="py-8 text-center">
                                <div
                                    className={cn(
                                        "inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4",
                                        statusConfig[status].bg,
                                    )}
                                >
                                    {(() => {
                                        const Icon = statusConfig[status].icon
                                        return <Icon className={cn("w-10 h-10", statusConfig[status].color)} />
                                    })()}
                                </div>
                                <h2 className={cn("text-2xl font-bold mb-2", statusConfig[status].color)}>
                                    {statusConfig[status].title}
                                </h2>
                                <p className="text-muted-foreground">{statusConfig[status].description}</p>
                                {result.error && (
                                    <p className="text-sm text-red-500 mt-2 bg-red-500/10 p-2 rounded-lg inline-block">
                                        {result.error}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Credential Details */}
                        {result.holder && (
                            <Card className="glass glow-border">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Fingerprint className="w-5 h-5" />
                                        {t("presentation.identity.title")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Details Grid */}
                                    <div className="grid gap-4">
                                        <DetailRow icon={User} label={t("presentation.identity.holder")} value={result.holder} mono />
                                        {result.vpHash && (
                                            <DetailRow icon={Hash} label={t("presentation.identity.presentationHash")} value={result.vpHash} mono />
                                        )}
                                    </div>

                                    {/* Included Credentials */}
                                    {result.vcs && result.vcs.length > 0 && (
                                        <div className="pt-4 border-t border-border/50">
                                            <h4 className="text-sm font-medium text-muted-foreground mb-4">{t("presentation.identity.includedCredentials")} ({result.vcs.length})</h4>
                                            <div className="grid gap-3">
                                                {result.vcs.map((vc, index) => (
                                                    <div
                                                        key={index}
                                                        className="py-3 px-4 rounded-lg bg-secondary/50"
                                                    >
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <FileCheck className="w-4 h-4 text-green-500" />
                                                                <p className="text-sm font-medium">{t("presentation.identity.credentialNumber", { number: index + 1 })}</p>
                                                            </div>
                                                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                                                {t("presentation.identity.validBadge")}
                                                            </Badge>
                                                        </div>
                                                        <div className="ml-7 space-y-1">
                                                            {vc.id && (
                                                                <p className="text-xs text-muted-foreground">ID: {vc.id.slice(0, 30)}...</p>
                                                            )}
                                                            {vc.issuer && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    <span className="font-medium">{t("presentation.identity.issuer")}:</span>{" "}
                                                                    <span className="font-mono">{typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Unknown'}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Reset Button */}
                        <div className="flex justify-center">
                            <Button variant="outline" onClick={resetVerification} className="gap-2 bg-transparent">
                                <Upload className="w-4 h-4" />
                                {t("presentation.presentAnother")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function DetailRow({
    icon: Icon,
    label,
    value,
    mono = false,
}: {
    icon: React.ElementType
    label: string
    value: string
    mono?: boolean
}) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-sm font-medium break-all", mono && "font-mono text-xs")}>{value}</p>
            </div>
        </div>
    )
}
