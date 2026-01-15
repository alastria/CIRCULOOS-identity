import { z } from 'zod'

/**
 * Base Configuration Schema
 * Shared across all services: nodeEnv, logLevel, http
 */
export const baseSchema = z.object({
    // Node Environment
    nodeEnv: z.enum(['development', 'test', 'production']).default('development'),

    // Log Level
    logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // HTTP Server
    http: z.object({
        host: z.string().default('0.0.0.0'),
        port: z.number().int().positive().default(3001),
    }),

    // CORS
    cors: z.object({
        allowedOrigins: z.array(z.string()).default([]),
        trustedProxies: z.array(z.string()).optional(),
    }),

    // Swagger
    swagger: z.object({
        enabled: z.boolean().default(true),
    }),

    // Admin addresses
    adminAddresses: z.array(z.string()).default([]),

    // Download links & Public URL - REQUIRED in production
    appPublicUrl: z.string().url(),

    // Legacy support (can be removed later if unused)
    downloadLinkBaseUrl: z.string().url().optional(),
})

export type BaseConfig = z.infer<typeof baseSchema>

/**
 * Helper to parse comma-separated list
 */
export function parseCommaSeparatedList(value: string | undefined): string[] {
    if (!value) return []
    return value.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Helper to resolve App Public URL
 */
export function resolveAppPublicUrl(): string | undefined {
    return process.env.APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        process.env.DOWNLOAD_LINK_BASE_URL
}

/**
 * Load base config from environment
 */
export function loadBaseConfig(): Partial<BaseConfig> {
    return {
        nodeEnv: process.env.NODE_ENV as any,
        logLevel: process.env.LOG_LEVEL as any,
        http: {
            host: process.env.HTTP_HOST || '0.0.0.0',
            port: process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 3001,
        },
        cors: {
            allowedOrigins: parseCommaSeparatedList(process.env.CORS_ALLOWED_ORIGINS),
            trustedProxies: parseCommaSeparatedList(process.env.TRUSTED_PROXIES),
        },
        swagger: {
            enabled: process.env.SWAGGER_ENABLED !== 'false',
        },
        adminAddresses: parseCommaSeparatedList(process.env.ADMIN_ADDRESSES),
        appPublicUrl: resolveAppPublicUrl(),
        downloadLinkBaseUrl: process.env.DOWNLOAD_LINK_BASE_URL,
    }
}
