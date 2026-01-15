// Simple in-memory database for nonces (authentication challenges)
// This avoids the better-sqlite3 Docker compilation issues

interface NonceRecord {
    nonce: string
    expires_at: number
}

// In-memory storage (resets on server restart, but that's acceptable for ephemeral nonces)
const nonceStore: Map<string, NonceRecord> = new Map()

export interface CredentialRecord {
    id: string
    holder_address: string
    data: string // JSON string
    created_at: number
}

export const database = {
    // Credentials (not used anymore - SqlJsStorageAdapter handles VCs)
    saveCredential(_id: string, _holderAddress: string, _data: object) {
        // No-op: credentials are stored via SqlJsStorageAdapter
    },

    getCredential(_id: string): CredentialRecord | undefined {
        // No-op: credentials are retrieved via SqlJsStorageAdapter
        return undefined
    },

    // Auth / Nonces (in-memory is fine for ephemeral challenges)
    saveNonce(address: string, nonce: string, expiresAt: number) {
        nonceStore.set(address.toLowerCase(), { nonce, expires_at: expiresAt })
    },

    getNonce(address: string): { nonce: string, expires_at: number } | undefined {
        return nonceStore.get(address.toLowerCase())
    },

    deleteNonce(address: string) {
        nonceStore.delete(address.toLowerCase())
    }
}
