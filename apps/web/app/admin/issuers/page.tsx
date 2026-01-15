"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Search, UserX, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useDiamondTrustedIssuer } from "@/hooks/use-diamond-trusted-issuer"

interface Issuer {
  address: string
  name?: string
  email?: string
  addedBy?: string
  blockNumber?: number
  txHash?: string
  timestamp?: string
  isActive: boolean
}

export default function AdminIssuersPage() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [issuers, setIssuers] = useState<Issuer[]>([])
  const [formData, setFormData] = useState({ name: "", email: "", wallet: "" })
  const [issuerToDeactivate, setIssuerToDeactivate] = useState<Issuer | null>(null)

  // Diamond contract interaction
  const {
    addTrustedIssuer,
    removeTrustedIssuer,
    isPending,
    isConfirming,
    isConfirmed,
    error: txError,
    reset: resetTx,
    hash
  } = useDiamondTrustedIssuer()

  // Load issuers from backend (synced from blockchain events)
  const loadIssuers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.admin.getTrustedIssuers(true) // Only active issuers

      // The API returns { issuers: [...] }
      const issuersList = data.issuers || []

      // Map to our interface - backend provides blockchain-synced data
      setIssuers(issuersList.map((issuer: any) => ({
        address: issuer.address,
        name: issuer.name || `Issuer ${issuer.address.slice(0, 8)}...`,
        email: issuer.email,
        addedBy: issuer.addedBy,
        blockNumber: issuer.blockNumber,
        txHash: issuer.txHash,
        timestamp: issuer.timestamp,
        isActive: issuer.isActive ?? true
      })))
    } catch (error) {
      // console.error('Error loading issuers:', error)
      toast.error(t("admin.issuers.messages.loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadIssuers()
  }, [loadIssuers])

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success(t("admin.issuers.messages.confirmed"))
      setIsDialogOpen(false)
      setFormData({ name: "", email: "", wallet: "" })
      setIssuerToDeactivate(null)
      resetTx()

      // Reload issuers after a delay to allow blockchain sync
      setTimeout(() => {
        loadIssuers()
      }, 3000)
    }
  }, [isConfirmed, hash, t, resetTx, loadIssuers])

  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      const errorMessage = (txError as any)?.shortMessage || txError.message || t("admin.issuers.messages.registerError")
      toast.error(errorMessage)
      resetTx()
    }
  }, [txError, t, resetTx])

  const filteredIssuers = issuers.filter(
    (issuer) =>
      (issuer.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      issuer.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issuer.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async () => {
    try {
      // Validate wallet address
      if (!formData.wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
        toast.error("Invalid wallet address")
        return
      }

      // Step 1: Save metadata to backend BEFORE blockchain TX
      // This way when the IssuerAdded event is captured, the backend can associate
      // the name and email with the issuer address
      try {
        await api.admin.prepareIssuer({
          address: formData.wallet,
          name: formData.name,
          email: formData.email,
          // requestedBy could be the connected admin wallet address
        })
      } catch (prepareError) {
        // Don't block the TX if metadata fails - issuer can still be added without name/email
      }

      // Step 2: Call smart contract to register issuer
      // The backend will capture the IssuerAdded event and store in DB with metadata
      await addTrustedIssuer(formData.wallet as `0x${string}`)

      toast.success(t("admin.issuers.messages.registered"))

      // Note: Dialog will close when transaction is confirmed (via useEffect above)
    } catch (error: any) {
      // console.error('Error registering issuer:', error)
      // Error is handled in useEffect above
    }
  }

  const handleDeactivate = async () => {
    if (!issuerToDeactivate) return

    try {
      // Call smart contract to remove issuer
      // The backend will capture the IssuerRemoved event and update DB
      await removeTrustedIssuer(issuerToDeactivate.address as `0x${string}`)

      toast.success(t("admin.issuers.messages.deactivated"))

      // Dialog will close when confirmed (via useEffect)
    } catch (error: any) {
      // console.error('Error deactivating issuer:', error)
      // Error is handled in useEffect above
    }
  }

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const isSubmitting = isPending || isConfirming

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("admin.issuers.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("admin.issuers.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadIssuers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!isSubmitting) {
              setIsDialogOpen(open)
              if (!open) {
                setFormData({ name: "", email: "", wallet: "" })
                resetTx()
              }
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.issuers.newIssuer")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("admin.issuers.dialog.title")}</DialogTitle>
                <DialogDescription>{t("admin.issuers.dialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("admin.issuers.dialog.nameLabel")}</Label>
                  <Input
                    id="name"
                    placeholder={t("admin.issuers.dialog.namePlaceholder")}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("admin.issuers.dialog.emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("admin.issuers.dialog.emailPlaceholder")}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet">{t("admin.issuers.dialog.walletLabel")}</Label>
                  <Input
                    id="wallet"
                    placeholder={t("admin.issuers.dialog.addressPlaceholder")}
                    className="font-mono text-sm"
                    value={formData.wallet}
                    onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
                {isConfirming && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {t("admin.issuers.pendingSync")}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  {t("admin.issuers.dialog.cancel")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.wallet}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("admin.issuers.dialog.signing")}
                    </>
                  ) : (
                    t("admin.issuers.dialog.submit")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={t("admin.issuers.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white dark:bg-gray-900"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.issuers.table.name")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.issuers.table.walletAddress")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.issuers.table.status")}
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.issuers.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredIssuers.map((issuer) => (
              <tr key={issuer.address} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{issuer.name}</p>
                    {issuer.email && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{issuer.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                      {shortenAddress(issuer.address)}
                    </code>
                    <a
                      href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || ''}/address/${issuer.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-primary"
                      title={t("admin.issuers.viewOnExplorer")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${issuer.isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                  >
                    {issuer.isActive ? t("admin.issuers.status.active") : t("admin.issuers.status.inactive")}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setIssuerToDeactivate(issuer)}
                        disabled={isSubmitting}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.issuers.deactivate.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("admin.issuers.deactivate.description").replace("{name}", issuer.name || shortenAddress(issuer.address))}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>
                          {t("admin.issuers.deactivate.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={handleDeactivate}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.issuers.dialog.signing")}
                            </>
                          ) : (
                            t("admin.issuers.deactivate.confirm")
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredIssuers.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.issuers.messages.noIssuers")}
          </div>
        )}
      </div>
    </div>
  )
}
