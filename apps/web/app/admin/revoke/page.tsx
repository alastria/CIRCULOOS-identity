"use client"

import { useState } from "react"
import { Search, AlertTriangle, FileCheck, User, Calendar, Hash, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { toast } from "sonner"
import { config } from "@/config"
import { useWriteContract } from "wagmi"

// ABI for CredentialStatusFacet
const CREDENTIAL_STATUS_ABI = [
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "vcHash",
        "type": "bytes32"
      }
    ],
    "name": "revokeCredential",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

interface CredentialResult {
  id: string
  holderAddress: string
  status: string
  createdAt: number
  updatedAt: number
}

export default function AdminRevokePage() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<CredentialResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const { writeContractAsync } = useWriteContract()

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setNotFound(false)
    setResult(null)

    try {
      // Search for credential in issuer backend
      const response = await fetch(`${config.issuerApiUrl}/issue/list?limit=1000&offset=0`)

      if (!response.ok) {
        throw new Error('Failed to search credentials')
      }

      const data = await response.json()
      const found = data.issuances?.find((issuance: any) =>
        issuance.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issuance.holderAddress.toLowerCase().includes(searchQuery.toLowerCase())
      )

      if (found) {
        setResult(found)
      } else {
        setNotFound(true)
      }
    } catch (error) {
      // console.error('Search error:', error)
      toast.error('Failed to search credentials')
      setNotFound(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleRevoke = async () => {
    if (!result) return
    setIsRevoking(true)
    try {
      // Call smart contract to revoke credential
      await writeContractAsync({
        address: config.contracts.credentialStatus as `0x${string}`,
        abi: CREDENTIAL_STATUS_ABI,
        functionName: 'revokeCredential',
        args: [result.id as `0x${string}`], // Assuming ID is the hash
      })

      toast.success('Transacción de revocación enviada')
      setShowRevokeDialog(false)
      if (result) {
        setResult({ ...result, status: "REVOKED" })
      }
    } catch (error) {
      // console.error('Revoke error:', error)
      toast.error('Error al revocar credencial en blockchain')
    } finally {
      setIsRevoking(false)
    }
  }

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Revocar Credencial</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Busca y revoca credenciales si es necesario</p>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder={t("admin.revoke.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-11 h-12 text-base bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
          <Button size="lg" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              "Buscar"
            )}
          </Button>
        </div>
      </div>

      {/* Not Found */}
      {notFound && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No se encontró la credencial</h3>
          <p className="text-gray-500 dark:text-gray-400">Intenta buscar con otro ID o dirección del holder</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">Credencial Encontrada</h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${result.status === "CLAIMED"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                : result.status === "REVOKED"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
            >
              {result.status}
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</p>
                  <p className="font-mono font-medium text-gray-900 dark:text-white text-sm">{result.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Titular</p>
                  <code className="text-xs text-gray-900 dark:text-white">{shortenAddress(result.holderAddress)}</code>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creada</p>
                  <p className="text-sm text-gray-900 dark:text-white">{new Date(result.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileCheck className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actualizada</p>
                  <p className="text-sm text-gray-900 dark:text-white">{new Date(result.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {result.status !== "REVOKED" && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
              <Button variant="destructive" className="gap-2" onClick={() => setShowRevokeDialog(true)}>
                <AlertTriangle className="w-4 h-4" />
                Revocar Credencial
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Revoke Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Revocar Credencial
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de revocar la credencial <strong>{result?.id}</strong>. Esta acción es irreversible y se
              registrará en la blockchain.
              <br />
              <br />
              Se requerirá tu firma de MetaMask para confirmar la transacción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleRevoke} disabled={isRevoking}>
              {isRevoking ? "Revocando..." : "Confirmar Revocación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
