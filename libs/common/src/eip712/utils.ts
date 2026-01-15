/**
 * EIP-712 Utility Functions
 * Formatting and helper functions for better UX
 */

/**
 * Format ISO date to human-readable Spanish format
 */
export function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return ''

  try {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch (e) {
    return isoDate
  }
}

/**
 * Format timestamp to human-readable Spanish format
 */
export function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return timestamp.toString()
  }
}

/**
 * Get network name from chain ID
 */
export function getNetworkName(chainId: string | number): string {
  const networks: Record<string, string> = {
    '1': 'Ethereum Mainnet',
    '31337': 'Hardhat Local',
    '2020': 'Alastria Red-T',
    '83584648538': 'Alastria Red-T Testnet'
  }
  return networks[chainId.toString()] || `Red ${chainId}`
}

/**
 * Shorten address for display (0x1234...5678)
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2 + 2) return address
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`
}

/**
 * Extract issuer address from DID or string
 */
export function extractIssuerAddress(issuer: any): string {
  if (typeof issuer === 'string') {
    // If it's a DID, extract the address part
    if (issuer.startsWith('did:')) {
      const parts = issuer.split(':')
      // did:alastria:quorum:redt:0x1234...
      const addressPart = parts[parts.length - 1]
      if (addressPart.startsWith('0x')) {
        return addressPart
      }
    }
    return issuer
  }

  if (issuer?.id) {
    return extractIssuerAddress(issuer.id)
  }

  return ''
}

/**
 * Format issuer name (extract from DID or use default)
 */
export function formatIssuerName(issuer: any, defaultName: string = 'Emisor'): string {
  const issuerString = extractIssuerAddress(issuer)

  // If it's a DID, use a friendly name
  if (issuerString.startsWith('did:alastria')) {
    return defaultName
  }

  // If it's an address, shorten it
  if (issuerString.startsWith('0x')) {
    return shortenAddress(issuerString)
  }

  return issuerString || defaultName
}
