import { loadConfig } from '@circuloos/common'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const appConfig = loadConfig()

export interface Config {
    env: string
    http: {
        host: string
        port: number
    }
    swagger: {
        enabled: boolean
    }
    blockchain: {
        rpcUrl: string
        chainId: number
    }
    trustedRegistry: {
        address?: string
        startBlock: number
        storagePath: string
        sql: {
            enabled: boolean
            dbPath?: string
            dbDir?: string
        }
    }
    credentialRegistry: {
        address?: string
        startBlock: number
    }
    revocationRegistry: {
        address?: string
    }
    filestore: {
        baseDir: string
    }
    trustedIssuers: string[]
    trustedHolders: string[]
    eip712VerifyingContract?: string
    challenge: {
        ttlSeconds: number
        gcIntervalMs: number
    }
    batch: {
        maxSize: number
        intervalMs: number
    }
    security: {
        rateLimitEnabled: boolean
        rateLimitMax: number
        rateLimitWindowMs: number
    }
    cors: {
        allowedOrigins: string | string[] | boolean
    }
    proxy: {
        trustedProxies: string[]
    }
}

const parseBool = (val: string | undefined, defaultValue: boolean): boolean => {
    if (!val) return defaultValue
    const lower = val.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
    if (lower === 'yes' || lower === 'on') return true
    if (lower === 'no' || lower === 'off') return false
    return defaultValue
}

// Determine SQL enabled state - enabled by default in non-production
const isSqlEnabled = (): boolean => {
    const envValue = appConfig.verifier.sqlDbEnabled
    if (envValue !== undefined) {
        return envValue
    }
    return appConfig.nodeEnv !== 'production'
}

// Parse CORS origins from config
const parseCorsOrigins = (): string | string[] | boolean => {
    const origins = appConfig.cors?.allowedOrigins
    if (!origins || origins.length === 0) {
        return appConfig.nodeEnv === 'development' ? true : false
    }
    if (origins.length === 1) {
        const single = origins[0]
        if (single === '*' || single === 'true') return true
        if (single === 'false' || single === 'none') return false
    }
    return origins
}

// Parse trusted proxies from config
const parseTrustedProxies = (): string[] => {
    const proxies = appConfig.verifier.trustedProxies
    if (!proxies) return []
    if (Array.isArray(proxies)) return proxies
    return proxies.split(',').map((s: string) => s.trim()).filter(Boolean)
}

export const config: Config = {
    env: appConfig.nodeEnv,
    http: {
        host: appConfig.http.host,
        port: appConfig.verifier.port,
    },
    swagger: {
        enabled: appConfig.swagger.enabled,
    },
    blockchain: {
        rpcUrl: appConfig.blockchain.rpcUrl,
        chainId: appConfig.blockchain.chainId,
    },
    trustedRegistry: {
        address: appConfig.verifier.trustedIssuerRegistryAddress || appConfig.diamond?.address,
        startBlock: appConfig.verifier.trustedRegistryStartBlock || 0,
        storagePath: appConfig.verifier.trustedRegistryStoragePath || 'trusted-issuers/state.json',
        sql: {
            enabled: isSqlEnabled(),
            dbPath: appConfig.verifier.sqlDbPath,
            dbDir: appConfig.verifier.sqlDbDir,
        },
    },
    credentialRegistry: {
        address: appConfig.verifier.credentialRegistryAddress || appConfig.diamond?.address,
        startBlock: appConfig.verifier.credentialRegistryStartBlock || 0,
    },
    revocationRegistry: {
        address: appConfig.verifier.revocationRegistryAddress || appConfig.diamond?.address,
    },
    filestore: {
        baseDir: appConfig.filestore.baseDir,
    },
    trustedIssuers: appConfig.verifier.trustedIssuers || [],
    trustedHolders: appConfig.verifier.trustedHolders || [],
    eip712VerifyingContract: appConfig.eip712.verifyingContract,
    challenge: {
        ttlSeconds: appConfig.verifier.challengeTtlSeconds || 300,
        gcIntervalMs: appConfig.verifier.challengeGcIntervalMs || 60 * 60 * 1000,
    },
    batch: {
        maxSize: appConfig.verifier.batchMaxSize || 500,
        intervalMs: appConfig.verifier.batchIntervalMs || 900000,
    },
    security: {
        rateLimitEnabled: appConfig.verifier.rateLimitEnabled ?? true,
        rateLimitMax: appConfig.verifier.rateLimitMax || 100,
        rateLimitWindowMs: appConfig.verifier.rateLimitWindowMs || 900000,
    },
    cors: {
        allowedOrigins: parseCorsOrigins(),
    },
    proxy: {
        trustedProxies: parseTrustedProxies(),
    },
}
