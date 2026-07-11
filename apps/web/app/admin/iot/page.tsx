"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, RefreshCw, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIotDevices } from "@/hooks/use-iot-devices"

export default function AdminIotPage() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const { data: devices, isLoading, isError, refetch, isFetching } = useIotDevices()

  const registryConfigured = Boolean(process.env.NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS)

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const formatTs = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString() : "—")

  const filtered = (devices ?? []).filter(
    (d) =>
      d.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.alias ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!registryConfigured) {
    return (
      <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
        {t("admin.iot.messages.notConfigured")}
      </div>
    )
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t("admin.iot.title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("admin.iot.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={t("admin.iot.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white dark:bg-gray-900"
        />
      </div>

      {isError && <p className="text-sm text-red-600 dark:text-red-400">{t("admin.iot.messages.loadError")}</p>}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.table.alias")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.table.address")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.table.lastAttestation")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.table.status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((device) => (
              <tr key={device.address} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/admin/iot/${device.address}`} className="font-medium text-primary hover:underline">
                    {device.alias ?? shortenAddress(device.address)}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                    {shortenAddress(device.address)}
                  </code>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {formatTs(device.lastAttestationTs)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      device.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {device.status === "active" ? t("admin.iot.status.active") : t("admin.iot.status.stale")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.iot.messages.noDevices")}
          </div>
        )}
      </div>
    </div>
  )
}
