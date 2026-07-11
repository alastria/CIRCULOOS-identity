"use client"

import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { decodeFunctionData, recoverMessageAddress, type Address, type Hex } from "viem"
import { ATTEST_FUNCTION, ATTESTED_EVENT, getAttestationRegistryAddress } from "@/lib/iot/attestation-registry"

export interface DeviceAttestation {
  eventHash: Hex
  ts: number
  txHash: Hex
  blockNumber: bigint
  /**
   * Verificación EIP-191 en cliente: se recompone la firma desde el calldata
   * de la propia tx `attest(eventHash, sig)` y se recupera la dirección
   * firmante — misma comprobación que hace el contrato con `ecrecover`, pero
   * hecha aquí sin confiar en que el contrato ya la validó.
   */
  verified: boolean
}

export function useDeviceAttestations(deviceAddress: string) {
  const publicClient = usePublicClient()
  const registryAddress = getAttestationRegistryAddress()

  return useQuery({
    queryKey: ["iot-device-attestations", registryAddress, deviceAddress],
    enabled: !!registryAddress && !!publicClient && !!deviceAddress,
    refetchInterval: 15_000,
    queryFn: async (): Promise<DeviceAttestation[]> => {
      if (!publicClient || !registryAddress) return []

      const logs = await publicClient.getLogs({
        address: registryAddress,
        event: ATTESTED_EVENT,
        args: { device: deviceAddress as Address },
        fromBlock: BigInt(0),
        toBlock: "latest",
      })

      const attestations = await Promise.all(
        logs.map(async (log): Promise<DeviceAttestation> => {
          const eventHash = log.args.eventHash as Hex
          const ts = Number(log.args.ts ?? BigInt(0))
          const txHash = log.transactionHash as Hex

          let verified = false
          try {
            const tx = await publicClient.getTransaction({ hash: txHash })
            const { args } = decodeFunctionData({ abi: [ATTEST_FUNCTION], data: tx.input })
            const [, sig] = args as [Hex, Hex]
            const recovered = await recoverMessageAddress({ message: { raw: eventHash }, signature: sig })
            verified = recovered.toLowerCase() === deviceAddress.toLowerCase()
          } catch {
            verified = false
          }

          return { eventHash, ts, txHash, blockNumber: log.blockNumber ?? BigInt(0), verified }
        })
      )

      return attestations.sort((a, b) => b.ts - a.ts)
    },
  })
}
