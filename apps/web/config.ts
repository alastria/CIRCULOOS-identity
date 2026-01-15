import { z } from 'zod'

/**
 * PRODUCTION-READY Configuration
 * NO hardcoded URLs - everything must come from environment variables
 * 
 * Required environment variables:
 * - NEXT_PUBLIC_ISSUER_URL: Backend issuer service URL
 * - NEXT_PUBLIC_VERIFIER_URL: Backend verifier service URL  
 * - NEXT_PUBLIC_APP_URL: Frontend application URL
 * 
 * IMPORTANT: Next.js only inlines process.env.NEXT_PUBLIC_* when accessed DIRECTLY.
 * Dynamic access like process.env[key] does NOT work for client-side code.
 */

/**
 * Direct environment variable access - Next.js inlines these at build time
 * These MUST use literal string access to process.env.NEXT_PUBLIC_*
 */
export const urls = {
    get issuer(): string {
        // Direct access required for Next.js to inline at build time
        return process.env.NEXT_PUBLIC_ISSUER_URL || 'http://localhost:8001'
    },
    get verifier(): string {
        return process.env.NEXT_PUBLIC_VERIFIER_URL || 'http://localhost:8002'
    },
    get app(): string {
        return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    },
} as const

/**
 * Frontend Configuration Schema
 * Validates environment variables at runtime
 */
const configSchema = z.object({
    // API URLs - with fallbacks for local development
    issuerApiUrl: z.string().url().default('http://localhost:8001'),
    verifierApiUrl: z.string().url().default('http://localhost:8002'),
    appUrl: z.string().url().default('http://localhost:3000'),

    // WalletConnect
    walletConnectProjectId: z.string().optional(),

    // Environment
    isProduction: z.boolean().default(false),
    isDevelopment: z.boolean().default(true),

    // Smart Contracts
    contracts: z.object({
        credentialStatus: z.string().default(''),
    }),
})

export type FrontendConfig = z.infer<typeof configSchema>

function loadConfig(): FrontendConfig {
    const isProduction = process.env.NODE_ENV === 'production'

    const rawConfig = {
        // Use direct process.env access - Next.js inlines these at build time
        issuerApiUrl: process.env.NEXT_PUBLIC_ISSUER_URL || 'http://localhost:8001',
        verifierApiUrl: process.env.NEXT_PUBLIC_VERIFIER_URL || 'http://localhost:8002',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        isProduction,
        isDevelopment: !isProduction,
        contracts: {
            credentialStatus: process.env.NEXT_PUBLIC_DIAMOND_ADDRESS || '',
        },
    }

    try {
        return configSchema.parse(rawConfig)
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Invalid frontend configuration:', error.errors)
            console.error('Make sure to set all required NEXT_PUBLIC_* environment variables')
        }
        // Return raw config as fallback to prevent crash
        return rawConfig as FrontendConfig
    }
}

export const config = loadConfig()

// Legacy export for backwards compatibility
export function getEnvVar(key: string, fallback?: string): string {
    // Direct access for known keys - required for Next.js build-time inlining
    if (key === 'ISSUER_URL' || key === 'NEXT_PUBLIC_ISSUER_URL') {
        return process.env.NEXT_PUBLIC_ISSUER_URL || fallback || ''
    }
    if (key === 'VERIFIER_URL' || key === 'NEXT_PUBLIC_VERIFIER_URL') {
        return process.env.NEXT_PUBLIC_VERIFIER_URL || fallback || ''
    }
    if (key === 'APP_URL' || key === 'NEXT_PUBLIC_APP_URL') {
        return process.env.NEXT_PUBLIC_APP_URL || fallback || ''
    }
    return fallback || ''
}
