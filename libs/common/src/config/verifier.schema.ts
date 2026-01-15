import { z } from 'zod'

/**
 * Verifier Service Configuration Schema
 * Contains all verifier-specific settings
 */
export const verifierSchema = z.object({
    verifier: z.object({
        // Server Settings
        port: z.number().int().positive().default(4001),

        // Registry Addresses (optional - fallback to diamond address)
        trustedIssuerRegistryAddress: z.string().optional(),
        credentialRegistryAddress: z.string().optional(),
        revocationRegistryAddress: z.string().optional(),

        // Registry Indexing
        trustedRegistryStartBlock: z.number().int().nonnegative().default(0),
        credentialRegistryStartBlock: z.number().int().nonnegative().default(0),
        trustedRegistryStoragePath: z.string().default('trusted-issuers/state.json'),

        // SQL Database Settings
        sqlDbEnabled: z.boolean().optional(),
        sqlDbPath: z.string().optional(),
        sqlDbDir: z.string().optional(),

        // Trusted Entities
        trustedIssuers: z.array(z.string()).default([]),
        trustedHolders: z.array(z.string()).default([]),

        // Challenge Service Settings
        challengeTtlSeconds: z.number().int().positive().default(300),
        challengeGcIntervalMs: z.number().int().positive().default(60 * 60 * 1000),

        // Batch Service Settings
        batchMaxSize: z.number().int().positive().default(500),
        batchIntervalMs: z.number().int().positive().default(900000),

        // Security / Rate Limiting
        rateLimitEnabled: z.boolean().default(true),
        rateLimitMax: z.number().int().positive().default(100),
        rateLimitWindowMs: z.number().int().positive().default(900000),

        // Proxy Settings
        trustedProxies: z.union([z.string(), z.array(z.string())]).optional(),
    }),
})

export type VerifierConfig = z.infer<typeof verifierSchema>

/**
 * Load verifier config from environment
 */
export function loadVerifierConfig(): Partial<VerifierConfig> {
    const parseList = (val: string | undefined): string[] => {
        if (!val) return []
        return val.split(',').map(s => s.trim()).filter(Boolean)
    }

    const parseBool = (val: string | undefined, def: boolean): boolean | undefined => {
        if (val === undefined) return undefined
        const lower = val.toLowerCase()
        if (lower === 'true' || lower === '1') return true
        if (lower === 'false' || lower === '0') return false
        return def
    }

    return {
        verifier: {
            port: process.env.VERIFIER_PORT ? Number(process.env.VERIFIER_PORT) : 4001,

            // Registry Addresses
            trustedIssuerRegistryAddress: process.env.TRUSTED_ISSUER_REGISTRY_ADDRESS,
            credentialRegistryAddress: process.env.CREDENTIAL_REGISTRY_ADDRESS,
            revocationRegistryAddress: process.env.REVOCATION_REGISTRY_ADDRESS,

            // Registry Indexing
            trustedRegistryStartBlock: Number(process.env.TRUSTED_REGISTRY_START_BLOCK || 0),
            credentialRegistryStartBlock: Number(process.env.CREDENTIAL_REGISTRY_START_BLOCK || 0),
            trustedRegistryStoragePath: process.env.TRUSTED_REGISTRY_STORAGE_PATH || 'trusted-issuers/state.json',

            // SQL Settings
            sqlDbEnabled: parseBool(process.env.TRUSTED_ISSUER_SQL_DB_ENABLED, false),
            sqlDbPath: process.env.TRUSTED_ISSUER_SQL_DB_PATH,
            sqlDbDir: process.env.TRUSTED_ISSUER_SQL_DB_DIR,

            // Trusted Entities
            trustedIssuers: parseList(process.env.TRUSTED_ISSUERS),
            trustedHolders: parseList(process.env.TRUSTED_HOLDERS),

            // Challenge Service
            challengeTtlSeconds: Number(process.env.CHALLENGE_TTL_SECONDS || 300),
            challengeGcIntervalMs: Number(process.env.CHALLENGE_GC_INTERVAL_MS || 60 * 60 * 1000),

            // Batch Service
            batchMaxSize: Number(process.env.BATCH_MAX_SIZE || 500),
            batchIntervalMs: Number(process.env.BATCH_INTERVAL_MS || 900000),

            // Security
            rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
            rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
            rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),

            // Proxy
            trustedProxies: process.env.TRUSTED_PROXIES,
        },
    }
}
