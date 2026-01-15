/**
 * DID Utilities for frontend
 * Extracts Ethereum addresses from DID strings
 */

/**
 * Normalize a DID or raw address to a plain Ethereum address
 * @param didOrAddress - Either a DID string (e.g., "did:alastria:quorum:0x...") or a raw address
 * @returns Plain Ethereum address (0x...)
 */
export function normalizeAddress(didOrAddress: string): string {
    if (!didOrAddress) {
        throw new Error('Address or DID is required')
    }

    const trimmed = didOrAddress.trim()

    // If it's already a plain address, return it
    if (trimmed.match(/^0x[a-fA-F0-9]{40}$/)) {
        return trimmed
    }

    // Handle DID format: did:alastria:network:0x... or did:ethr:0x...
    if (trimmed.startsWith('did:')) {
        // Extract address from DID
        const match = trimmed.match(/(?:0x)?([a-fA-F0-9]{40})/)
        if (match && match[1]) {
            return `0x${match[1]}`
        }
        throw new Error(`Invalid DID format: ${trimmed}`)
    }

    // If it doesn't start with 0x but looks like hex, add prefix
    if (trimmed.match(/^[a-fA-F0-9]{40}$/)) {
        return `0x${trimmed}`
    }

    throw new Error(`Invalid address format: ${trimmed}`)
}
