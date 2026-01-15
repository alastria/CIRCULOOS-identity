import { z } from 'zod'
import { baseSchema, loadBaseConfig } from './base.schema'
import { blockchainSchema, loadBlockchainConfig } from './blockchain.schema'
import { issuerSchema, loadIssuerConfig, generateDevSecret } from './issuer.schema'
import { verifierSchema, loadVerifierConfig } from './verifier.schema'
import { storageSchema, loadStorageConfig } from './storage.schema'

/**
 * Combined Application Configuration Schema
 * Merges all domain-specific schemas into one unified schema
 */
export const configSchema = baseSchema
    .merge(blockchainSchema)
    .merge(issuerSchema)
    .merge(verifierSchema)
    .merge(storageSchema)

export type AppConfig = z.infer<typeof configSchema>

/**
 * Validate required secrets in production
 */
function validateProductionSecrets(): void {
    const missingSecrets: string[] = []
    if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET')
    if (!process.env.VC_ENCRYPTION_KEY) missingSecrets.push('VC_ENCRYPTION_KEY')
    if (!process.env.VC_INDEX_PEPPER) missingSecrets.push('VC_INDEX_PEPPER')
    if (!process.env.ISSUER_HMAC_SECRET) missingSecrets.push('ISSUER_HMAC_SECRET')

    if (missingSecrets.length > 0) {
        console.error('PRODUCTION ERROR: Missing required secrets:', missingSecrets.join(', '))
        console.error('Generate with: openssl rand -hex 32')
        throw new Error(`Missing required secrets in production: ${missingSecrets.join(', ')}`)
    }
}

/**
 * Load and validate configuration from environment variables
 * @throws {z.ZodError} if configuration is invalid
 */
export function loadConfig(): AppConfig {
    const isProduction = process.env.NODE_ENV === 'production'

    // Validate required secrets in production
    if (isProduction) {
        validateProductionSecrets()
    }

    // Merge all partial configs from each domain
    const rawConfig = {
        ...loadBaseConfig(),
        ...loadBlockchainConfig(),
        ...loadIssuerConfig(),
        ...loadVerifierConfig(),
        ...loadStorageConfig(),
    }

    try {
        const config = configSchema.parse(rawConfig)

        // Log successful config load (only in dev to avoid leaking sensitive info)
        if (config.nodeEnv === 'development') {
            // console.log('✅ Configuration loaded successfully')
        }

        return config
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Configuration validation failed:')
            console.error(error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n'))
            throw new Error('Invalid configuration. Check environment variables.')
        }
        throw error
    }
}

/**
 * Get config for testing (bypasses environment variables)
 * NOTE: localhost URLs are ONLY acceptable here for unit tests
 */
export function getTestConfig(overrides?: Partial<AppConfig>): AppConfig {
    const defaultTestConfig: AppConfig = {
        // Base
        nodeEnv: 'test',
        logLevel: 'debug',
        http: { host: '0.0.0.0', port: 3001 },
        cors: { allowedOrigins: [], trustedProxies: [] },
        swagger: { enabled: false },
        adminAddresses: [],
        appPublicUrl: 'http://127.0.0.1:3000',
        downloadLinkBaseUrl: 'http://127.0.0.1:3001',

        // Blockchain
        blockchain: { rpcUrl: 'http://127.0.0.1:8545', chainId: 31337, syncIntervalMs: 1000 },
        diamond: { address: undefined },
        eip712: {
            domainName: 'TrustedIssuerRegistry',
            domainVersion: '1.0',
            verifyingContract: undefined,
        },

        // Issuer
        issuer: {
            did: 'did:ethr:0x1234567890123456789012345678901234567890',
            privateKey: '0x' + '1'.repeat(64),
            hmacSecret: 'test-hmac-secret-min-32-characters',
            port: 3001,
        },
        security: {
            jwtExpiry: '1h',
            otpExpirySeconds: 900,
            nonceExpirySeconds: 300,
            rateLimitEnabled: false,
            rateLimitMax: 100,
            rateLimitWindowMs: 900000,
            jwtSecret: 'test-jwt-secret'
        },
        email: {
            host: undefined,
            port: 1025,
            secure: false,
            from: 'test@example.com',
            fromName: 'Test'
        },

        // Verifier
        verifier: {
            port: 4001,
            trustedRegistryStartBlock: 0,
            credentialRegistryStartBlock: 0,
            trustedRegistryStoragePath: 'trusted-issuers/state.json',
            trustedIssuers: [],
            trustedHolders: [],
            challengeTtlSeconds: 300,
            challengeGcIntervalMs: 3600000,
            batchMaxSize: 500,
            batchIntervalMs: 900000,
            rateLimitEnabled: false,
            rateLimitMax: 100,
            rateLimitWindowMs: 900000,
        },

        // Storage
        storage: { dbPath: ':memory:' },
        filestore: { baseDir: './tmp-filestore-test' },
    }

    return { ...defaultTestConfig, ...overrides }
}
