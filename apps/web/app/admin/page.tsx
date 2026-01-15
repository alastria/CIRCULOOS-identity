"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileCheck, Users, Wifi, WifiOff, Clock, RefreshCw, Database, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface ActivityItem {
  id: string
  message: string
  time: string
}

export default function AdminDashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch Blockchain Stats
  const { data: stats, refetch: refetchStats, error: statsError } = useQuery({
    queryKey: ['admin', 'blockchain', 'stats'],
    queryFn: () => api.admin.getBlockchainStats(),
    refetchInterval: 30000 // Refresh every 30s
  })

  // Fetch Sync State
  const { data: sync, refetch: refetchSync } = useQuery({
    queryKey: ['admin', 'blockchain', 'sync'],
    queryFn: () => api.admin.getSyncState(),
    refetchInterval: 10000 // Refresh every 10s
  })

  // Fetch Recent Activity (Credentials)
  const { data: recentCreds, refetch: refetchActivity } = useQuery({
    queryKey: ['admin', 'blockchain', 'credentials'],
    queryFn: () => api.admin.getBlockchainCredentials({ limit: 5 }),
    refetchInterval: 30000
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchStats(), refetchSync(), refetchActivity()])
    setIsRefreshing(false)
    toast.success('Dashboard actualizado')
  }

  const handleSync = async () => {
    try {
      await api.admin.syncBlockchain(undefined, true)
      toast.success('Sincronización forzada iniciada')
      refetchSync()
    } catch (error) {
      // console.error('Sync error:', error)
      toast.error('Error al iniciar sincronización')
    }
  }

  const systemStatus = statsError ? "offline" : (sync?.isSyncing ? "maintenance" : "online")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vista general del sistema y sincronización blockchain</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={handleSync}
          >
            <Database className="w-4 h-4" />
            Sincronizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {sync && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Sincronización Blockchain: {sync.isSyncing ? 'En Progreso...' : 'Al día'}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Último bloque: {sync.lastSyncedBlock} • Actualizado: {new Date(sync.lastSyncTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Credenciales Totales */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.credentials?.total || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Credenciales</p>
            </div>
          </div>
        </div>

        {/* Revocadas */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.credentials?.revoked || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Revocadas</p>
            </div>
          </div>
        </div>

        {/* Emisores Activos */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.issuers?.active || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Emisores Activos</p>
            </div>
          </div>
        </div>

        {/* Estado del Sistema */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${systemStatus === "online"
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : systemStatus === "maintenance"
                  ? "bg-amber-50 dark:bg-amber-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
                }`}
            >
              {systemStatus === "online" ? (
                <Wifi className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff
                  className={`w-6 h-6 ${systemStatus === "maintenance"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                    }`}
                />
              )}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                {systemStatus === "online" ? "Online" : systemStatus === "maintenance" ? "Sincronizando" : "Offline"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Actividad Reciente en Blockchain</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {recentCreds?.credentials?.length > 0 ? (
            recentCreds.credentials.map((item: any) => (
              <div key={item.credential_hash} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.is_revoked ? 'Credencial Revocada' : 'Credencial Emitida'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    Hash: {item.credential_hash.slice(0, 10)}... • Bloque: {item.block_number}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(item.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
              No hay actividad reciente registrada
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
