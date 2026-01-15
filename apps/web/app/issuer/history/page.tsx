"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, History, Download, MoreHorizontal, Eye, Ban, FileText, Clock, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "sonner"
import { config } from "@/config"

type CredentialStatus = "DRAFT" | "ISSUED" | "CLAIMED" | "REVOKED"

interface IssuedCredential {
  id: string
  status: CredentialStatus
  holderAddress: string
  createdAt: number
  updatedAt: number
  expiresAt: number
}

export default function IssuerHistoryPage() {
  const { t } = useI18n()
  const [credentials, setCredentials] = useState<IssuedCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<IssuedCredential | null>(null)

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const response = await fetch(`${config.issuerApiUrl}/issue/list?limit=100&offset=0`)

        if (!response.ok) {
          throw new Error('Failed to fetch credentials')
        }

        const data = await response.json()
        setCredentials(data.issuances || [])
      } catch (error) {
        // console.error('Error fetching credentials:', error)
        toast.error('Failed to load credentials')
      } finally {
        setLoading(false)
      }
    }

    fetchCredentials()
  }, [])

  const stats = {
    total: credentials.length,
    pending: credentials.filter((c) => c.status === "DRAFT" || c.status === "ISSUED").length,
    claimed: credentials.filter((c) => c.status === "CLAIMED").length,
    revoked: credentials.filter((c) => c.status === "REVOKED").length,
  }

  const handleRevoke = async () => {
    if (!selectedCredential) return

    // Simulate revocation
    // await new Promise((resolve) => setTimeout(resolve, 1000))
    // toast.success(t("issuer.history.messages.revoked"))
    toast.error("Revocation not yet implemented")
    setRevokeDialogOpen(false)
    setSelectedCredential(null)
  }

  const handleExportCSV = () => {
    const csv = [
      ["Email", "Fecha", "Estado", "Hash", "Tipo"],
      ...credentials.map((c) => [c.holderAddress || '', new Date(c.createdAt).toISOString(), c.status, c.id, 'VC']),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "credenciales.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("issuer.history.messages.csvExported"))
  }

  const statusConfig: Record<
    CredentialStatus,
    { icon: React.ElementType; label: string; variant: "default" | "secondary" | "destructive" }
  > = {
    DRAFT: { icon: Clock, label: t("issuer.history.status.pending"), variant: "secondary" },
    ISSUED: { icon: Clock, label: "Issued", variant: "secondary" },
    CLAIMED: { icon: CheckCircle2, label: t("issuer.history.status.claimed"), variant: "default" },
    REVOKED: { icon: XCircle, label: t("issuer.history.status.revoked"), variant: "destructive" },
  }

  // Fallback for unknown statuses
  const fallbackStatus = { icon: Clock, label: "Unknown", variant: "secondary" as const }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("issuer.title")}</h1>
          <p className="text-muted-foreground">{t("issuer.subtitle")}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8">
          <Button variant="outline" asChild className="gap-2 bg-transparent">
            <Link href="/issuer">
              <Plus className="w-4 h-4" />
              {t("issuer.tabs.new")}
            </Link>
          </Button>
          <Button variant="default" className="gap-2">
            <History className="w-4 h-4" />
            {t("issuer.tabs.history")}
          </Button>
        </div>

        {/* Stats Cards - Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="glass glow-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">{t("issuer.history.stats.total")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass glow-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">{t("issuer.history.stats.pending")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass glow-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.claimed}</p>
                  <p className="text-sm text-muted-foreground">{t("issuer.history.stats.claimed")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass glow-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.revoked}</p>
                  <p className="text-sm text-muted-foreground">{t("issuer.history.stats.revoked")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credentials Table */}
        <Card className="glass glow-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("issuer.history.title")}</CardTitle>
              <CardDescription>{t("issuer.history.subtitle")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              {t("issuer.history.exportCSV")}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>{t("issuer.history.table.email")}</TableHead>
                    <TableHead>{t("issuer.history.table.date")}</TableHead>
                    <TableHead>{t("issuer.history.table.status")}</TableHead>
                    <TableHead>{t("issuer.history.table.hash")}</TableHead>
                    <TableHead className="text-right">{t("issuer.history.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((credential) => {
                    const status = statusConfig[credential.status] || fallbackStatus
                    const displayAddress = credential.holderAddress ? `${credential.holderAddress.slice(0, 6)}...${credential.holderAddress.slice(-4)}` : 'N/A'
                    return (
                      <TableRow key={credential.id} className="group">
                        <TableCell className="font-medium font-mono text-xs">{displayAddress}</TableCell>
                        <TableCell>{new Date(credential.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <status.icon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{credential.id.slice(0, 20)}...</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2">
                                <Eye className="w-4 h-4" />
                                {t("issuer.history.actions.view")}
                              </DropdownMenuItem>
                              {credential.status !== "REVOKED" && (
                                <DropdownMenuItem
                                  className="gap-2 text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setSelectedCredential(credential)
                                    setRevokeDialogOpen(true)
                                  }}
                                >
                                  <Ban className="w-4 h-4" />
                                  {t("issuer.history.actions.revoke")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("issuer.history.revokeConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("issuer.history.revokeConfirm.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("issuer.history.revokeConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
