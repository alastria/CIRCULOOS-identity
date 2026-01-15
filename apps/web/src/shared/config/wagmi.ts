"use client"

import { http, createConfig } from "wagmi"
import { defineChain } from "viem"
import { injected, walletConnect } from "wagmi/connectors"

/**
 * Chain Configuration with Environment Variables
 * 
 * Environment variables:
 * - NEXT_PUBLIC_RPC_URL: RPC endpoint (default: http://localhost:8545)
 * - NEXT_PUBLIC_CHAIN_ID: Chain ID (default: 31337 for Hardhat)
 * - NEXT_PUBLIC_NETWORK_NAME: Network name (default: "Hardhat Local")
 * - NEXT_PUBLIC_APP_URL: Application URL (default: http://localhost:3000)
 * - NEXT_PUBLIC_BLOCK_EXPLORER_URL: Block explorer URL (optional)
 * - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: WalletConnect project ID (optional)
 */

// ============================================================================
// Environment Configuration
// ============================================================================

const isDev = process.env.NODE_ENV !== 'production'

// Helper to get env var with fallback
function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback
}

// Core configuration from environment
const config = {
  rpcUrl: getEnv('NEXT_PUBLIC_RPC_URL', 'http://localhost:8545'),
  chainId: parseInt(getEnv('NEXT_PUBLIC_CHAIN_ID', '31337'), 10),
  networkName: getEnv('NEXT_PUBLIC_NETWORK_NAME', 'Hardhat Local'),
  appUrl: getEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  blockExplorerUrl: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || '',
}

// ============================================================================
// Chain Definitions
// ============================================================================

/**
 * Primary chain - configured via environment variables
 * 
 * Development (Docker): Hardhat Local (chainId: 31337, RPC: http://localhost:8545)
 * Production: Alastria Red-T (chainId: 2020) or custom network
 */
export const primaryChain = defineChain({
  id: config.chainId,
  name: config.networkName,
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.rpcUrl],
    },
  },
  blockExplorers: config.blockExplorerUrl ? {
    default: {
      name: "Block Explorer",
      url: config.blockExplorerUrl,
    },
  } : undefined,
  testnet: isDev || config.chainId === 31337 || config.chainId === 2020,
})

/**
 * Hardhat Local - Always available for development
 * chainId: 31337, RPC: http://localhost:8545
 */
export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [getEnv('NEXT_PUBLIC_HARDHAT_RPC_URL', 'http://localhost:8545')],
    },
  },
  testnet: true,
})

/**
 * Alastria Red-T (Testnet) - chainId: 2020
 */
export const alastriaRedT = defineChain({
  id: 2020,
  name: "Alastria Red-T",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [getEnv('NEXT_PUBLIC_ALASTRIA_RPC_URL', config.rpcUrl)],
    },
  },
  blockExplorers: config.blockExplorerUrl ? {
    default: {
      name: "Alastria Explorer",
      url: config.blockExplorerUrl,
    },
  } : undefined,
  testnet: true,
})

/**
 * Alastria Red-B (Mainnet) - chainId: 2021
 */
export const alastriaRedB = defineChain({
  id: 2021,
  name: "Alastria Red-B",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [getEnv('NEXT_PUBLIC_ALASTRIA_B_RPC_URL', config.rpcUrl)],
    },
  },
  blockExplorers: config.blockExplorerUrl ? {
    default: {
      name: "Alastria Explorer",
      url: config.blockExplorerUrl,
    },
  } : undefined,
  testnet: false,
})



// Legacy exports for compatibility
export { primaryChain as alastriaT }

// ============================================================================
// Wagmi Config Factory
// ============================================================================

export function createWagmiConfig(projectId?: string) {
  // Determine which chains to include based on environment
  // In development: primary chain (Hardhat) + Alastria networks
  // In production: only configured networks
  const chains = isDev
    ? [primaryChain, hardhatLocal, alastriaRedT, alastriaRedB] as const
    : [primaryChain, alastriaRedT, alastriaRedB] as const

  // Build connectors - always include injected (MetaMask, etc.)
  const connectors: any[] = [injected()]

  // Add WalletConnect if project ID is provided
  if (projectId && projectId.trim() && projectId !== 'public') {
    connectors.push(
      walletConnect({
        projectId: projectId.trim(),
        metadata: {
          name: "Circuloos VC/VP",
          description: "Verifiable Credentials Platform",
          url: config.appUrl,
          icons: ["/favicon_alastria.png"],
        },
      })
    )
  }

  return createConfig({
    chains,
    connectors,
    transports: {
      [primaryChain.id]: http(),
      [hardhatLocal.id]: http(),
      [alastriaRedT.id]: http(),
      [alastriaRedB.id]: http(),
    },
    ssr: true,
  })
}

// Export config for debugging
export const chainConfig = config
