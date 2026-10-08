/**
 * Shared helpers for the Red-B scripts (plan A4). Every on-chain write is signed by Web3Signer
 * (no private key in the environment), uses legacy transactions priced at the network's own
 * eth_gasPrice (0 on Red-B; ethers v5 would otherwise add a 1.5 gwei tip to EIP-1559 txs),
 * and runs only after the chain id has been checked.
 */
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { ethers, network } from 'hardhat'
import { utils } from 'ethers'
import { Web3SignerSigner } from './web3signer-signer'

/** Facets cut into the identity Diamond on Red-B (decision D6: no AttestationBatchFacet). */
export const FACETS = ['DiamondLoupeFacet', 'OwnershipFacet', 'TrustedIssuerFacet', 'CredentialStatusFacet', 'PausableFacet']

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export function addressList(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (!ethers.utils.isAddress(a)) throw new Error(`${name}: invalid address ${a}`)
      return ethers.utils.getAddress(a)
    })
}

/** Refuses to continue unless the connected chain is the expected one (2020 = Red-B). */
export async function assertChainId(): Promise<number> {
  const expected = Number(process.env.EXPECTED_CHAIN_ID || '2020')
  const { chainId } = await ethers.provider.getNetwork()
  if (chainId !== expected) {
    throw new Error(`Connected to chainId ${chainId} (network "${network.name}"), expected ${expected}. Aborting before any transaction.`)
  }
  return chainId
}

export function web3signer(address: string): Web3SignerSigner {
  return new Web3SignerSigner(requireEnv('WEB3SIGNER_URL'), address, ethers.provider)
}

/** Legacy transaction at the network's gas price (0 on Red-B). */
export async function txOverrides() {
  return { type: 0, gasPrice: await ethers.provider.getGasPrice() }
}

export function selectorsOf(iface: utils.Interface): string[] {
  return Object.keys(iface.functions).map((f) => iface.getSighash(f))
}

export function gitCommit(): { commit: string; dirty: boolean } {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0
    return { commit, dirty }
  } catch {
    return { commit: 'unknown', dirty: true }
  }
}

export interface Manifest {
  network: string
  chainId: number
  diamondAddress: string
  owner: string
  diamondCutFacet: string
  diamondInit: string
  facets: Record<string, { address: string; selectors: string[] }>
  git: { commit: string; dirty: boolean }
  deployedAt: string
  transactions: Array<{ step: string; hash: string; contract?: string }>
}

export function manifestPath(): string {
  return path.resolve(requireEnv('MANIFEST_PATH'))
}

export function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(manifestPath(), 'utf8'))
}

export function appendTransactions(entries: Manifest['transactions']) {
  const manifest = readManifest()
  manifest.transactions.push(...entries)
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2))
}
