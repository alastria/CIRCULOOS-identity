import { z } from 'zod'
import * as crypto from 'crypto'

/**
 * Storage Configuration Schema
 * Includes: storage, filestore
 */
export const storageSchema = z.object({
    // Storage
    storage: z.object({
        dbPath: z.string().default('./data/alastria.db'),
        // Encryption key for VCs - REQUIRED in production
        encryptionKey: z.string().optional(),
        // Index pepper for hashing - REQUIRED in production
        indexPepper: z.string().optional(),
    }),

    // Filestore
    filestore: z.object({
        baseDir: z.string().default('./tmp-filestore'),
    }),
})

export type StorageConfig = z.infer<typeof storageSchema>

/**
 * Generate a random secret for development (changes each restart)
 */
function generateDevSecret(name: string): string {
    const secret = crypto.randomBytes(32).toString('hex')
    console.warn(`[Config] Using random ${name} for development (changes each restart)`)
    return secret
}

/**
 * Load storage config from environment
 */
export function loadStorageConfig(): Partial<StorageConfig> {
    const isProduction = process.env.NODE_ENV === 'production'

    return {
        storage: {
            dbPath: process.env.DB_PATH || './data/alastria.db',
            encryptionKey: process.env.VC_ENCRYPTION_KEY || (isProduction ? undefined : generateDevSecret('VC_ENCRYPTION_KEY')),
            indexPepper: process.env.VC_INDEX_PEPPER || (isProduction ? undefined : generateDevSecret('VC_INDEX_PEPPER')),
        },
        filestore: {
            baseDir: process.env.FILESTORE_BASE_DIR || process.env.FILESTORE_TMP_DIR || './tmp-filestore',
        },
    }
}
