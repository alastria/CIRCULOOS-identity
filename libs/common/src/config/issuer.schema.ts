import { z } from 'zod'
import * as crypto from 'crypto'

/**
 * Issuer Service Configuration Schema
 * Includes: issuer, security, email
 */
export const issuerSchema = z.object({
    // Issuer Configuration (optional - only needed for issuer service)
    issuer: z.object({
        did: z.string().optional(),
        privateKey: z.string().optional(),
        hmacSecret: z.string().optional(),
        port: z.number().int().positive().default(3001),
    }),

    // Security
    security: z.object({
        jwtSecret: z.string().optional(),
        jwtExpiry: z.string().default('1h'),
        otpExpirySeconds: z.number().int().positive().default(900), // 15 minutes
        nonceExpirySeconds: z.number().int().positive().default(300), // 5 minutes
        rateLimitEnabled: z.boolean().default(true),
        rateLimitMax: z.number().int().positive().default(100),
        rateLimitWindowMs: z.number().int().positive().default(900000), // 15 minutes
    }),

    // Email / SMTP - host is optional (EmailMock used if not set in dev)
    email: z.object({
        host: z.string().optional(),
        port: z.number().int().positive().default(1025),
        secure: z.boolean().default(false),
        user: z.string().optional(),
        pass: z.string().optional(),
        from: z.string().email().default('noreply@alastria.test'),
        fromName: z.string().default('Circuloos'),
    }),
})

export type IssuerConfig = z.infer<typeof issuerSchema>

/**
 * Generate a random secret for development (changes each restart)
 */
export function generateDevSecret(name: string): string {
    const secret = crypto.randomBytes(32).toString('hex')
    console.warn(`[Config] Using random ${name} for development (changes each restart)`)
    return secret
}

/**
 * Load issuer config from environment
 */
export function loadIssuerConfig(): Partial<IssuerConfig> {
    const isProduction = process.env.NODE_ENV === 'production'

    return {
        issuer: {
            did: process.env.ISSUER_DID,
            privateKey: process.env.DIAMOND_OWNER_PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
            hmacSecret: process.env.ISSUER_HMAC_SECRET || (isProduction ? undefined : generateDevSecret('ISSUER_HMAC_SECRET')),
            port: process.env.ISSUER_PORT ? Number(process.env.ISSUER_PORT) : 3001,
        },
        security: {
            jwtSecret: process.env.JWT_SECRET || (isProduction ? undefined : generateDevSecret('JWT_SECRET')),
            jwtExpiry: process.env.JWT_EXPIRY || '1h',
            otpExpirySeconds: process.env.OTP_EXPIRY_SECONDS ? Number(process.env.OTP_EXPIRY_SECONDS) : 900,
            nonceExpirySeconds: process.env.NONCE_EXPIRY_SECONDS ? Number(process.env.NONCE_EXPIRY_SECONDS) : 300,
            rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
            rateLimitMax: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 100,
            rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS ? Number(process.env.RATE_LIMIT_WINDOW_MS) : 900000,
        },
        email: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025,
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
            from: process.env.EMAIL_FROM || 'noreply@alastria.test',
            fromName: process.env.EMAIL_FROM_NAME || 'Circuloos',
        },
    }
}
