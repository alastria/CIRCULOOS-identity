/**
 * Constantes para leer AttestationRegistry.sol (piloto IoT, D1.5, repo
 * CIRCULOOS-iot-identity) directamente on-chain.
 *
 * El contrato no expone ninguna función de lectura (solo `attest(bytes32,
 * bytes)` y el evento `Attested`) — así que todo aquí se obtiene escaneando
 * el evento y decodificando el calldata de cada tx `attest(...)` para
 * verificar la firma EIP-191 en cliente (D1.11).
 *
 * Fuente de verdad: services/contracts/contracts/AttestationRegistry.sol en
 * el repo del piloto. Si el contrato cambia de firma, actualizar aquí.
 */
import type { Address } from "viem"

export const ATTESTED_EVENT = {
  type: "event",
  name: "Attested",
  inputs: [
    { name: "device", type: "address", indexed: true },
    { name: "eventHash", type: "bytes32", indexed: true },
    { name: "ts", type: "uint256", indexed: false },
  ],
} as const

export const ATTEST_FUNCTION = {
  type: "function",
  name: "attest",
  stateMutability: "nonpayable",
  inputs: [
    { name: "eventHash", type: "bytes32" },
    { name: "sig", type: "bytes" },
  ],
  outputs: [],
} as const

export function getAttestationRegistryAddress(): Address | undefined {
  return process.env.NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS as Address | undefined
}
