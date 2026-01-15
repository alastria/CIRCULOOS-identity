"use client"

import { useState } from "react"
import { Settings, ExternalLink, AlertTriangle } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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

// Get contract address from environment
const DIAMOND_CONTRACT = process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_ADDRESS || "Not configured"

export default function AdminConfigPage() {
  const { t } = useI18n()
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [pendingMaintenanceState, setPendingMaintenanceState] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMaintenanceToggle = (checked: boolean) => {
    setPendingMaintenanceState(checked)
    setShowMaintenanceDialog(true)
  }

  const confirmMaintenanceChange = async () => {
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 1500))
    setMaintenanceMode(pendingMaintenanceState)
    setIsSubmitting(false)
    setShowMaintenanceDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ajustes del sistema</p>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Modo Mantenimiento
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="maintenance" className="text-base font-medium text-gray-900 dark:text-white">
                Pausar emisión de credenciales
              </Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cuando está activo, no se podrán emitir nuevas credenciales. Las verificaciones seguirán funcionando.
              </p>
            </div>
            <Switch id="maintenance" checked={maintenanceMode} onCheckedChange={handleMaintenanceToggle} />
          </div>
          {maintenanceMode && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                El sistema está en modo mantenimiento. La emisión de credenciales está pausada.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Contract Info */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-medium text-gray-900 dark:text-white">Información del Contrato</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Dirección del Contrato Diamond
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                {DIAMOND_CONTRACT}
              </code>
              <a
                href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || ''}/address/${DIAMOND_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 hover:text-primary transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Red</Label>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{process.env.NEXT_PUBLIC_NETWORK_NAME || 'Blockchain Network'} (Chain ID: {process.env.NEXT_PUBLIC_CHAIN_ID || '2020'})</p>
          </div>
        </div>
      </div>

      {/* Maintenance Dialog */}
      <AlertDialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMaintenanceState ? "Activar Modo Mantenimiento" : "Desactivar Modo Mantenimiento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMaintenanceState
                ? t("admin.config.pauseDescription")
                : t("admin.config.resumeDescription")}
              <br />
              <br />
              {t("admin.config.signatureRequired")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMaintenanceChange} disabled={isSubmitting}>
              {isSubmitting ? "Firmando TX..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
