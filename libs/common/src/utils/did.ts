export class DIDUtils {
    /**
     * Normalizes a DID or address to a lowercase Ethereum address.
     * Supports:
     * - 0x... (Ethereum address)
     * - did:ethr:0x...
     * - did:ethr:network:0x...
     * - did:alastria:network:0x...
     * - did:pkh:eip155:network:0x...
     * 
     * @param didOrAddress The DID or address to normalize
     * @returns The lowercase Ethereum address or the original string if parsing fails
     */
    static normalizeAddress(didOrAddress: string): string {
        if (!didOrAddress) return ''

        const lower = didOrAddress.toLowerCase().trim()

        // Already an address
        if (lower.startsWith('0x') && lower.length === 42) {
            return lower
        }

        // Handle DID formats
        if (lower.startsWith('did:')) {
            const parts = lower.split(':')

            // Look for the part that looks like an Ethereum address (starts with 0x and length 42)
            for (const part of parts) {
                if (part.startsWith('0x') && part.length === 42) {
                    return part
                }
            }

            // Fallback for did:ethr:0x... where the last part is the address
            if (lower.startsWith('did:ethr:') || lower.startsWith('did:alastria:')) {
                const lastPart = parts[parts.length - 1]
                if (lastPart.startsWith('0x') && lastPart.length === 42) {
                    return lastPart
                }
            }
        }

        return lower
    }

    /**
     * Extracts the DID method from a DID string.
     * @param did The DID string
     * @returns The method (e.g., 'ethr', 'alastria') or 'unknown'
     */
    static getDIDMethod(did: string): string {
        if (!did || !did.startsWith('did:')) return 'unknown'
        const parts = did.split(':')
        if (parts.length < 2) return 'unknown'
        return parts[1].toLowerCase()
    }

    /**
     * Checks if a string is a valid DID.
     * @param did The string to check
     * @returns True if it looks like a DID
     */
    static isDID(did: string): boolean {
        return typeof did === 'string' && did.startsWith('did:')
    }
}
