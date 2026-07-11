"use client"

import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { ATTESTED_EVENT, getAttestationRegistryAddress } from "@/lib/iot/attestation-registry"

export interface IotDeviceSummary {
  address: string
  alias?: string
  lastAttestationTs: number
  attestationCount: number
  status: "active" | "stale"
}

// Sin nueva attestation en este margen → "sin actividad reciente" (no hay
// estado "revocado" real todavía: eso llega con DIDControllerFacet en F2).
const STALE_THRESHOLD_MS = 5 * 60 * 1000

async function fetchDeviceAliases(): Promise<Map<string, string>> {
  const url = process.env.NEXT_PUBLIC_IOT_MOCK_ISSUER_URL
  if (!url) return new Map()
  try {
    const res = await fetch(`${url}/devices`)
    if (!res.ok) return new Map()
    const body = (await res.json()) as { devices: Array<{ deviceId: string; address: string }> }
    return new Map(body.devices.map((d) => [d.address.toLowerCase(), d.deviceId]))
  } catch {
    // mock-issuer no disponible: el listado sigue funcionando solo con addresses.
    return new Map()
  }
}

export function useIotDevices() {
  const publicClient = usePublicClient()
  const registryAddress = getAttestationRegistryAddress()

  return useQuery({
    queryKey: ["iot-devices", registryAddress],
    enabled: !!registryAddress && !!publicClient,
    refetchInterval: 15_000,
    queryFn: async (): Promise<IotDeviceSummary[]> => {
      if (!publicClient || !registryAddress) return []

      const [logs, aliases] = await Promise.all([
        publicClient.getLogs({
          address: registryAddress,
          event: ATTESTED_EVENT,
          fromBlock: BigInt(0),
          toBlock: "latest",
        }),
        fetchDeviceAliases(),
      ])

      const counts = new Map<string, number>()
      const lastTs = new Map<string, number>()
      for (const log of logs) {
        const device = (log.args.device as string).toLowerCase()
        const ts = Number(log.args.ts ?? BigInt(0))
        counts.set(device, (counts.get(device) ?? 0) + 1)
        if (!lastTs.has(device) || ts > lastTs.get(device)!) {
          lastTs.set(device, ts)
        }
      }

      const now = Date.now()
      return Array.from(counts.keys())
        .map((address) => {
          const ts = lastTs.get(address) ?? 0
          return {
            address,
            alias: aliases.get(address),
            lastAttestationTs: ts,
            attestationCount: counts.get(address) ?? 0,
            status: (now - ts * 1000 > STALE_THRESHOLD_MS ? "stale" : "active") as IotDeviceSummary["status"],
          }
        })
        .sort((a, b) => b.lastAttestationTs - a.lastAttestationTs)
    },
  })
}
