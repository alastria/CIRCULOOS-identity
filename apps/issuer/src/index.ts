import Fastify from "fastify"
import cors from "@fastify/cors"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import helmet from "@fastify/helmet"
import swagger from "@fastify/swagger"
import swaggerUI from "@fastify/swagger-ui"
import { SqlJsStorageAdapter, EmailMock, createSmtpEmailSender, createLogger } from '@circuloos/common'

// Initialize logger
const logger = createLogger('issuer')
import simplifiedIssueRoutes from './routes/simplified-issue'
import issueRoutes from './routes/issue'
import authRoutes from './routes/auth'
import credentialsRoutes from './routes/credentials'
import systemRoutes from './routes/system'
import playgroundRoutes from './routes/playground'
import {
  corsConfig,
  helmetConfig,
  rateLimitConfig,
  enforceHTTPS,
  getTrustedProxyConfig,
  logSecurityConfig,
  isRateLimitEnabled
} from './config/security'
import { globalErrorHandler } from './middleware/errorHandler'
import { config } from './config'

// Configure trusted proxies (for production behind load balancer)
const trustedProxies = getTrustedProxyConfig()
const server = Fastify({
  logger: true,
  trustProxy: trustedProxies || false,
  requestIdHeader: 'x-request-id', // For request tracking
  requestIdLogLabel: 'reqId'
})

// Register Global Error Handler
server.setErrorHandler(globalErrorHandler)





// ============================================================================
// Security Middleware (order matters!)
// ============================================================================

// 1. HTTPS Enforcement (production only)
server.addHook('onRequest', enforceHTTPS)

// 2. Security Headers (Helmet)
server.register(helmet, helmetConfig)

// 3. CORS
server.register(cors, corsConfig)

// 4. Cookies (for JWT authentication)
// SECURITY: JWT_SECRET is REQUIRED in production
const isProduction = config.nodeEnv === 'production'
const jwtSecret = config.security.jwtSecret

// Note: loadConfig() already validates that JWT_SECRET is present in production
// so we don't need to re-check here, but we can keep the logic simple.

// SECURITY: Generate a random secret for development to prevent predictable cookies
// config.security.jwtSecret handles the random generation for dev if missing
const cookieSecret = jwtSecret || (() => {
  // This fallback should only be reached if something is wrong with loadConfig
  // or if we are in a very strange state.
  const crypto = require('crypto')
  const devSecret = crypto.randomBytes(32).toString('hex')
  logger.warn('Using fallback random cookie secret (should have been handled by config service)')
  return devSecret
})()

server.register(cookie, {
  secret: cookieSecret,
  parseOptions: {}
})

// 5. Rate Limiting (per-user for authenticated, per-IP otherwise)
if (isRateLimitEnabled()) {
  server.register(rateLimit, rateLimitConfig)
} else {
  logger.warn('Rate limiting disabled (not recommended for production)')
}

// Log security configuration
logSecurityConfig()

// Swagger / OpenAPI (enable unless explicitly disabled)
if (config.swagger.enabled) {
  server.register(swagger, {
    openapi: {
      info: {
        title: "Circuloos Issuer API",
        description: "W3C Verifiable Credentials issuance service with EIP-712 signatures",
        version: "1.0.0",
      },
      tags: [
        { name: "health", description: "Service health" },
        { name: "auth", description: "Authentication (SIWA - Sign-In with Alastria)" },
        { name: "issue", description: "Credential issuance flow (prepare → mint → finalize)" },
        { name: "credentials", description: "Credential management (CRUD, PDF, QR, revoke)" },
        { name: "system", description: "System administration and blockchain sync" },
      ],
    },
  })
  server.register(swaggerUI, {
    routePrefix: "/api/v1/docs",
  })
}

// Initialize Storage with sql.js (pure JavaScript SQLite - works everywhere!)
const storage = new SqlJsStorageAdapter(
  config.storage.dbPath,
  {
    encryptionKey: config.storage.encryptionKey,
    indexPepper: config.storage.indexPepper
  }
)
logger.info('Using sql.js storage (pure JS SQLite)')

// Helper endpoints for legacy compatibility
server.get('/tmp-filestore/vcs/:id', {
  schema: {
    tags: ["storage"],
    params: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    response: {
      200: { type: "object", additionalProperties: true, description: "Signed VC JSON" },
      404: { type: "object", properties: { error: { type: "string" } } },
    },
  },
}, async (request, reply) => {
  const rawId = (request.params as any).id as string
  const id = rawId.replace('.json', '')
  try {
    const vc = await storage.loadVC(id)
    if (!vc) {
      return reply.code(404).send({ error: 'VC not found' })
    }
    return reply.code(200).send(vc)
  } catch (err: any) {
    request.log?.error?.(err)
    return reply.code(500).send({ error: 'internal' })
  }
})

// expose issuance drafts as well for the playground to fetch prepared drafts
server.get('/tmp-filestore/issuances/:id', {
  schema: {
    tags: ["storage"],
    params: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    response: {
      200: { type: "object", additionalProperties: true, description: "Issuance record JSON" },
      404: { type: "object", properties: { error: { type: "string" } } },
    },
  },
}, async (request, reply) => {
  const rawId = (request.params as any).id as string
  const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`
  try {
    const rec = await storage.loadIssuance(id.replace('.json', ''))
    if (!rec) {
      return reply.code(404).send({ error: 'not found' })
    }
    return reply.code(200).send(rec)
  } catch (err: any) {
    request.log?.error?.(err)
    return reply.code(500).send({ error: 'internal' })
  }
})

// Keep legacy /health endpoint for Docker healthcheck
server.get('/health', async () => ({ ok: true }))

// API v1 health endpoint
server.get('/api/v1/health', {
  schema: {
    tags: ["health"],
    response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
  },
}, async () => ({ ok: true }))

// attach storage and emailSender as decorations so routes can access them via opts
server.decorate('storage', storage)

// Email sender configuration
// PRODUCTION: Must use SMTP, fail if not configured
// DEVELOPMENT/TESTING: Use SMTP if configured (including mailpit), otherwise EmailMock
// Note: isProduction already declared above for JWT_SECRET check
// Consider SMTP configured if host is set (mailpit counts as SMTP for dev)
const hasSmtpConfig = !!config.email.host

if (isProduction && !hasSmtpConfig) {
  logger.fatal('PRODUCTION ERROR: SMTP_HOST must be configured in production')
  logger.fatal('Set SMTP_HOST, SMTP_PORT, and other SMTP variables in your .env')
  process.exit(1)
}

const emailSender = hasSmtpConfig && config.email.host
  ? createSmtpEmailSender({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    user: config.email.user,
    pass: config.email.pass,
    from: config.email.from,
  })
  : EmailMock

if (hasSmtpConfig && config.email.host) {
  logger.info(`Using SMTP: ${config.email.host}:${config.email.port}`)
} else {
  if (isProduction) {
    logger.fatal('EmailMock cannot be used in production')
    process.exit(1)
  }
  logger.info('Using EmailMock (development only - emails stored in memory)')
}

server.decorate('emailSender', emailSender)

// Initialize Trusted Issuer Registry Client
import { createTrustedIssuerRegistryClient } from '@circuloos/common'
import { ethers } from 'ethers'
import { IssuanceRepository } from './repositories/issuanceRepository'
import { IssueController } from './controllers/issueController'
import { IssuanceService } from './services/issuanceService'
import { authService } from './services/authService'
import { PDFService } from './services/pdf.service'
import { NonceService } from './services/nonce.service'
import { AuthController } from './controllers/authController'

const diamondAddress = config.diamond?.address
const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl)

const registryClient = diamondAddress ? createTrustedIssuerRegistryClient({
  address: diamondAddress,
  provider
}) : undefined

if (!registryClient) {
  logger.warn('DIAMOND_ADDRESS not set, Trusted Issuer Registry features will be disabled')
}

// Initialize Services and Controllers
const issuanceRepository = new IssuanceRepository(storage)
const issuanceService = new IssuanceService({
  storage,
  emailSender,
  trustedIssuerRegistry: registryClient,
  hmacSecret: config.issuer.hmacSecret,
  otpExpirySeconds: config.security.otpExpirySeconds
})
const pdfService = new PDFService()

// Initialize Nonce Service and Auth Controller
const nonceService = new NonceService(storage)
const authController = new AuthController(nonceService, storage)

const issueController = new IssueController(
  issuanceService,
  authService,
  pdfService,
  issuanceRepository,
  storage,
  registryClient,
  nonceService
)

// Start nonce garbage collection
nonceService.startGarbageCollection()
logger.info('Nonce garbage collection enabled (runs every hour)')

// Register API routes

// Auth routes - /api/v1/auth (challenge, verify, logout)
server.register(authRoutes, { prefix: '/api/v1/auth', authController, issueController } as any)
logger.info('Auth routes registered: /api/v1/auth')

// Issue routes - /api/v1/issue (prepare, mint, finalize, info)
server.register(issueRoutes, { prefix: '/api/v1/issue', issueController } as any)
logger.info('Issue routes registered: /api/v1/issue')

// Credentials routes - /api/v1/credentials (CRUD, status, revoke, pdf, qr)
server.register(credentialsRoutes, { prefix: '/api/v1/credentials', issueController } as any)
logger.info('Credentials routes registered: /api/v1/credentials')

// Legacy: simplified issue routes at /api/v1 (for backward compatibility)
// These will be deprecated in favor of the new modular routes
server.register(simplifiedIssueRoutes, { prefix: '/api/v1', issueController } as any)
logger.warn('Legacy routes registered: /api/v1/credentials (deprecated, use /api/v1/issue)')

// Playground routes only in development/testing (NEVER in production)
// Playground routes only in development/testing (NEVER in production)
// if (process.env.NODE_ENV !== 'production') {
//   server.register(playgroundRoutes, { prefix: '/api/v1/playground' })
// }

// Initialize Blockchain Sync Service
import { BlockchainSyncService } from './services/blockchainSyncService'
import { initTestingEnvironment } from './scripts/init-testing'
import { TrustedIssuerFacetAbi, CredentialStatusFacetAbi, DiamondLoupeFacetAbi } from '@circuloos/common'

if (config.diamond?.address && config.blockchain?.rpcUrl) {
  const syncService = new BlockchainSyncService(
    config.blockchain.rpcUrl,
    config.diamond.address,
    storage,
    {
      trustedIssuer: TrustedIssuerFacetAbi,
      credentialStatus: CredentialStatusFacetAbi,
      diamondLoupe: DiamondLoupeFacetAbi
    }
  )

  // Register service in Fastify
  server.decorate('blockchainSyncService', syncService)

  // Inject sync service into AuthController for on-demand sync during login
  authController.setSyncService(syncService)

  // Initialize sync on startup
  syncService.initializeSync().then(async () => {
    logger.info('Blockchain Sync Service initialized')

    // Auto-add owner as issuer in testing/dev environments
    if ((config.nodeEnv === 'development' || config.nodeEnv === 'test') && config.diamond?.address) {
      logger.info('Initializing testing environment...')
      const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl)
      await initTestingEnvironment(
        provider,
        config.diamond.address,
        TrustedIssuerFacetAbi,
        storage
      )
    }
  }).catch(err => logger.error('Blockchain sync failed', err))

  // Incremental sync
  // Default: Dev: 10 seconds, Prod: 5 minutes
  // Can be overridden with BLOCKCHAIN_SYNC_INTERVAL_MS env var
  const syncInterval = config.blockchain.syncIntervalMs

  setInterval(() => {
    syncService.syncIncremental().catch(err => logger.error('Incremental sync failed', err))
  }, syncInterval)

  // Register system routes - /api/v1/system (blockchain stats, sync, issuers)
  server.register(systemRoutes, { prefix: '/api/v1/system' })
  logger.info('System routes registered: /api/v1/system')
}

export const start = async () => {
  try {
    await server.listen({
      port: config.issuer.port,
      host: config.http.host,
    })
    logger.info(`Issuer Service started at http://${config.http.host}:${config.issuer.port}`)
    logger.info(`API Docs: http://${config.http.host}:${config.issuer.port}/api/v1/docs`)
  } catch (err) {
    logger.fatal('Failed to start server', err)
    process.exit(1)
  }
}

// Graceful Shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}. Shutting down gracefully...`)
    await server.close()
    logger.info('Server closed')
    process.exit(0)
  })
})

/* c8 ignore next */
if (require.main === module) start()

export default server
