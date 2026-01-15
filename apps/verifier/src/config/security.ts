/**
 * Security Configuration
 *
 * Centralized security settings for the application
 * - CORS
 * - Helmet (security headers)
 * - Rate limiting
 * - HTTPS enforcement
 */

import type { FastifyHelmetOptions } from '@fastify/helmet'
import type { RateLimitPluginOptions } from '@fastify/rate-limit'
import type { FastifyRequest } from 'fastify'
import { config } from '../config'
import { createLogger } from '@circuloos/common'

const logger = createLogger('security-config')

// Type for CORS options (not exported from @fastify/cors)
type FastifyCorsOptions = {
  origin?: string[] | string | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void)
  credentials?: boolean
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  maxAge?: number
}

// ============================================================================
// Environment Detection
// ============================================================================

export const isProduction = config.env === 'production'
export const isDevelopment = config.env === 'development'
export const isTest = config.env === 'test'

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * Parse allowed origins from environment variable
 * Supports comma-separated list: "http://localhost:3000,https://app.example.com"
 */
function getAllowedOrigins(): string[] | string | boolean {
  // Use centralized CORS config
  return config.cors.allowedOrigins
}

export const corsConfig: FastifyCorsOptions = {
  origin: getAllowedOrigins(),
  credentials: true, // Allow cookies (required for JWT auth)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],
  maxAge: 86400 // 24 hours - how long browser can cache preflight response
}

// ============================================================================
// Helmet Configuration (Security Headers)
// ============================================================================

export const helmetConfig: FastifyHelmetOptions = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Swagger UI
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      ...(isProduction && { upgradeInsecureRequests: [] }), // Force HTTPS in production
    }
  },

  // HTTP Strict Transport Security (HSTS)
  // Tells browsers to only access site via HTTPS
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  } : false, // Disable in development (causes issues with localhost)

  // Don't allow site to be embedded in iframe (prevents clickjacking)
  frameguard: {
    action: 'deny'
  },

  // Prevent MIME type sniffing
  noSniff: true,

  // Disable X-Powered-By header (don't reveal we're using Fastify)
  hidePoweredBy: true,

  // Enable XSS filter in older browsers
  xssFilter: true,

  // Prevent browsers from caching sensitive pages
  dnsPrefetchControl: {
    allow: false
  },

  // Referrer Policy - don't leak referrer info
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

export const rateLimitConfig: RateLimitPluginOptions = {
  global: true, // Apply to all routes by default
  max: config.security.rateLimitMax,
  timeWindow: config.security.rateLimitWindowMs,

  // Custom key generator - allows rate limiting per user for authenticated endpoints
  keyGenerator: (request: FastifyRequest) => {
    // If user is authenticated, rate limit by user address
    const user = (request as any).user
    if (user?.address) {
      return `user:${user.address.toLowerCase()}`
    }

    // Otherwise, rate limit by IP
    const forwarded = request.headers['x-forwarded-for']
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : request.ip

    return `ip:${ip}`
  },

  errorResponseBuilder: (request, context) => {
    const retryAfter = Math.ceil(context.ttl / 1000)
    return {
      error: 'Too many requests. Please try again later.',
      statusCode: 429,
      retryAfter,
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    }
  },

  // Add rate limit info to response headers
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true
  }
}

// Helper to check if rate limiting should be enabled
export function isRateLimitEnabled(): boolean {
  return config.security.rateLimitEnabled
}

// Per-endpoint rate limit configurations
export const strictRateLimitConfig: Partial<RateLimitPluginOptions> = {
  max: 10, // Only 10 requests
  timeWindow: 60000, // Per minute
}

export const authRateLimitConfig: Partial<RateLimitPluginOptions> = {
  max: 5, // Only 5 login attempts
  timeWindow: 300000, // Per 5 minutes
}

// ============================================================================
// HTTPS Enforcement
// ============================================================================

export function enforceHTTPS(request: any, reply: any, done: () => void) {
  // Only enforce in production
  if (!isProduction) {
    return done()
  }

  // Check if request is HTTPS
  const isSecure = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https'

  if (!isSecure) {
    const httpsUrl = `https://${request.hostname}${request.url}`
    reply.code(301).redirect(httpsUrl)
    return
  }

  done()
}

// ============================================================================
// Trusted Proxy Configuration
// ============================================================================

/**
 * Configure trusted proxies for production (behind load balancer/CDN)
 * This is important for getting real client IP addresses
 */
export function getTrustedProxyConfig(): string[] | undefined {
  // Use centralized proxy config
  const proxies = config.proxy.trustedProxies
  if (!proxies || proxies.length === 0) {
    return undefined
  }
  return proxies
}

// ============================================================================
// Security Logging
// ============================================================================

export function logSecurityConfig() {
  logger.info('Security configuration loaded')
  console.log(`   Environment: ${config.env}`)
  console.log(`   HTTPS Enforced: ${isProduction}`)
  console.log(`   CORS Origins: ${Array.isArray(corsConfig.origin) ? corsConfig.origin.join(', ') : corsConfig.origin}`)
  console.log(`   Rate Limiting: ${config.security.rateLimitEnabled ? 'Enabled' : 'Disabled'}`)
  console.log(`   Rate Limit: ${rateLimitConfig.max} requests per ${Math.ceil((rateLimitConfig.timeWindow as number) / 60000)} minutes`)
  console.log(`   Helmet (Security Headers): Enabled`)
  console.log(`   HSTS: ${isProduction ? 'Enabled' : 'Disabled (development)'}`)
  console.log('')
}
