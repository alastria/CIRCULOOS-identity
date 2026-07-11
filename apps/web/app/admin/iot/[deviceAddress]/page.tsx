"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { useDeviceAttestations } from "@/hooks/use-device-attestations"

const PAGE_SIZE = 10

export default function IotDeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceAddress: string }>
}) {
  const { deviceAddress } = use(params)
  const { t } = useI18n()
  const [page, setPage] = useState(0)
  const { data: attestations, isLoading, isError } = useDeviceAttestations(deviceAddress)

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL

  const total = attestations?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = (attestations ?? []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/iot"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("admin.iot.detail.back")}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white font-mono">
          {shortenAddress(deviceAddress)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("admin.iot.detail.subtitle").replace("{count}", String(total))}
        </p>
      </div>

      {isError && <p className="text-sm text-red-600 dark:text-red-400">{t("admin.iot.messages.loadError")}</p>}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.detail.table.timestamp")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.detail.table.eventHash")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.detail.table.tx")}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("admin.iot.detail.table.verification")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageItems.map((a) => (
              <tr key={a.txHash} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {new Date(a.ts * 1000).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                    {shortenAddress(a.eventHash)}
                  </code>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                      {shortenAddress(a.txHash)}
                    </code>
                    {explorerBase && (
                      <a
                        href={`${explorerBase}/tx/${a.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-primary"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {a.verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" /> {t("admin.iot.detail.verified")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 text-xs font-medium">
                      <XCircle className="w-4 h-4" /> {t("admin.iot.detail.notVerified")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageItems.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.iot.detail.noAttestations")}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            {t("admin.iot.detail.prev")}
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            {t("admin.iot.detail.next")}
          </Button>
        </div>
      )}
    </div>
  )
}
