// Configuration for development/admin wallets
// Get from environment or allow empty for production safety
const configuredAdmins = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(',').map(a => a.trim()) || []
const configuredIssuers = process.env.NEXT_PUBLIC_AUTHORIZED_ISSUERS?.split(',').map(a => a.trim()) || []

// Export for compatibility
export const AUTHORIZED_ISSUERS = configuredIssuers
export const AUTHORIZED_ADMINS = configuredAdmins

export function isAuthorizedIssuer(address: string | undefined): boolean {
  if (!address) return false
  return configuredIssuers.some((authorized) => authorized.toLowerCase() === address.toLowerCase())
}

export function isAuthorizedAdmin(address: string | undefined): boolean {
  if (!address) return false
  return configuredAdmins.some((authorized) => authorized.toLowerCase() === address.toLowerCase())
}

// Helper to get required env var
function getRequiredEnv(key: string, fallback?: string): string {
  const value = process.env[key]
  if (!value) {
    if (fallback !== undefined) return fallback
    if (process.env.NODE_ENV === 'production') {
      // console.error(`Missing required environment variable: ${key}`)
    }
    return ''
  }
  return value
}

// Alastria T Network (Testnet) - Custom chain definition
// In production, all these MUST be set via environment variables
export const alastriaT = {
  id: parseInt(getRequiredEnv('NEXT_PUBLIC_CHAIN_ID', '2020')),
  name: getRequiredEnv('NEXT_PUBLIC_NETWORK_NAME', 'Alastria T Network'),
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [getRequiredEnv('NEXT_PUBLIC_RPC_URL', 'http://localhost:8545')] },
  },
  blockExplorers: {
    default: {
      name: getRequiredEnv('NEXT_PUBLIC_EXPLORER_NAME', 'Block Explorer'),
      url: getRequiredEnv('NEXT_PUBLIC_EXPLORER_URL', 'http://localhost:8545'),
    },
  },
}
