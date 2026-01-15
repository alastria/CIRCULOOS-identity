/**
 * Global application constants
 *
 * NOTE: RPC and explorer URLs should come from environment variables.
 * These constants are only for chain ID and name reference.
 */

// Helper to get env vars
const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key]
  if (!value && !fallback && process.env.NODE_ENV === 'production') {
    console.error(`Missing environment variable: ${key}`)
  }
  return value || fallback || ''
}

// Alastria Networks - URLs from environment
export const ALASTRIA_CHAINS = {
  REDT_TESTNET: {
    id: 2020,
    name: "Alastria Red-T",
    rpcUrl: getEnv('NEXT_PUBLIC_ALASTRIA_RPC_URL'),
    blockExplorer: getEnv('NEXT_PUBLIC_ALASTRIA_EXPLORER_URL', 'https://alastria-explorer.io'),
  },
  REDB_MAINNET: {
    id: 2021,
    name: "Alastria Red-B",
    rpcUrl: getEnv('NEXT_PUBLIC_ALASTRIA_B_RPC_URL', getEnv('NEXT_PUBLIC_ALASTRIA_RPC_URL')),
    blockExplorer: getEnv('NEXT_PUBLIC_ALASTRIA_EXPLORER_URL', 'https://alastria-explorer.io'),
  },
} as const

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_NONCE: "/auth/nonce",
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",

  // Credentials
  CREDENTIALS: "/credentials",
  CREDENTIALS_ISSUE: "/credentials/issue",
  CREDENTIALS_VERIFY: "/credentials/verify",
  CREDENTIALS_REVOKE: "/credentials/revoke",

  // Issuers
  ISSUERS: "/issuers",
  ISSUERS_REGISTER: "/issuers/register",

  // Claims
  CLAIMS_VALIDATE: "/claims/validate",
  CLAIMS_FINALIZE: "/claims/finalize",
} as const

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "alastria_auth_token",
  WALLET_ADDRESS: "alastria_wallet_address",
  THEME: "alastria_theme",
  LOCALE: "alastria_locale",
} as const

// Time Constants
export const TIME = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 30 * 60 * 1000, // 30 minutes
  REFETCH_INTERVAL: 60 * 1000, // 1 minute
} as const
