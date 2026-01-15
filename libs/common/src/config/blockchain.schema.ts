import { z } from 'zod'
import * as fs from 'fs'

/**
 * Blockchain Configuration Schema
 * Includes: blockchain, diamond, eip712
 */
export const blockchainSchema = z.object({
    // Blockchain - REQUIRED
    blockchain: z.object({
        rpcUrl: z.string().url({ message: 'RPC_URL must be a valid URL' }),
        chainId: z.number().int().positive(),
        syncIntervalMs: z.number().int().positive().default(10000),
    }),

    // Optional - Diamond/Registry addresses
    diamond: z.object({
        address: z.string().optional(),
    }).optional(),

    // EIP-712 domain configuration
    eip712: z.object({
        domainName: z.string().default('TrustedIssuerRegistry'),
        domainVersion: z.string().default('1.0'),
        verifyingContract: z.string().optional(),
    }),
})

export type BlockchainConfig = z.infer<typeof blockchainSchema>

/**
 * Read Diamond address and Chain ID from shared config file (Docker volume)
 * This allows services to get the Diamond address without env var propagation
 */
export function readSharedConfig(): { diamondAddress?: string, chainId?: number } | null {
    const sharedConfigPath = process.env.SHARED_CONFIG_PATH || '/shared/diamond-config.json'

    try {
        if (fs.existsSync(sharedConfigPath)) {
            const content = fs.readFileSync(sharedConfigPath, 'utf-8')
            const config = JSON.parse(content)
            return config
        }
    } catch (error) {
        // Silently ignore - shared config is optional (only exists in Docker)
    }

    return null
}

/**
 * Helper to resolve RPC URL from multiple possible env vars
 */
export function resolveRpcUrl(): string | undefined {
    return process.env.RPC_URL ||
        process.env.BLOCKCHAIN_RPC_URL ||
        process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL ||
        process.env.NEXT_PUBLIC_ALASTRIA_RPC_URL
}

/**
 * Helper to resolve Diamond Address from env vars or shared config
 */
export function resolveDiamondAddress(): string | undefined {
    // 1. Priority: Shared Config (Docker volume) - Dynamic & Truthful
    const sharedConfig = readSharedConfig()
    if (sharedConfig?.diamondAddress) {
        return sharedConfig.diamondAddress
    }

    // 2. Fallback: Environment Variables - Static
    return process.env.DIAMOND_ADDRESS || process.env.NEXT_PUBLIC_DIAMOND_ADDRESS
}

/**
 * Helper to resolve Chain ID from env vars or shared config
 */
export function resolveChainId(): number | undefined {
    // 1. Priority: Shared Config (Docker volume)
    const sharedConfig = readSharedConfig()
    if (sharedConfig?.chainId) {
        return Number(sharedConfig.chainId)
    }

    // 2. Fallback: Environment Variables
    return process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined
}

/**
 * Load blockchain config from environment
 */
export function loadBlockchainConfig(): Partial<BlockchainConfig> {
    const isProduction = process.env.NODE_ENV === 'production'

    return {
        blockchain: {
            rpcUrl: resolveRpcUrl() as string,
            chainId: resolveChainId() as number,
            syncIntervalMs: process.env.BLOCKCHAIN_SYNC_INTERVAL_MS
                ? Number(process.env.BLOCKCHAIN_SYNC_INTERVAL_MS)
                : (isProduction ? 300000 : 10000),
        },
        diamond: {
            address: resolveDiamondAddress(),
        },
        eip712: {
            domainName: process.env.EIP712_DOMAIN_NAME || process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME || 'TrustedIssuerRegistry',
            domainVersion: process.env.EIP712_DOMAIN_VERSION || process.env.NEXT_PUBLIC_EIP712_DOMAIN_VERSION || '1.0',
            verifyingContract: process.env.EIP712_VERIFYING_CONTRACT || resolveDiamondAddress(),
        },
    }
}
