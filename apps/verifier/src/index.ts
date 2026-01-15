import Fastify, { type FastifyInstance } from "fastify"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import helmet from "@fastify/helmet"
import swagger from "@fastify/swagger"
import swaggerUI from "@fastify/swagger-ui"
import simplifiedVerifyRoutes from './routes/verify'
import vpRoutes from './routes/vp'
import issuersRoutes from './routes/issuers'
import playgroundRoutes from './routes/playground'
import hybridRoutes from './routes/hybrid'
import { SqliteAdapter } from '@circuloos/common'
import { config } from './config'
import { TrustedIssuerRegistryService } from './services/trustedIssuerRegistryService'
import { HybridCredentialService } from './services/hybridCredentialService'
import {
  corsConfig,
  helmetConfig,
  rateLimitConfig,
  enforceHTTPS,
  getTrustedProxyConfig,
  logSecurityConfig,
  isRateLimitEnabled
} from './config/security'
// Import it lazily inside onReady so the dev server can start even when the native
// binding is not available (we'll fall back to the FileStore implementation).

let trustedRegistryService: TrustedIssuerRegistryService | undefined

type TrustedRegistryEnabledServer = FastifyInstance & {
  trustedIssuerRegistry?: TrustedIssuerRegistryService
}
type OnchainEnabledServer = TrustedRegistryEnabledServer & {
  hybridCredentialService?: HybridCredentialService
  challengeService?: any
  batchService?: any
}

// Configure trusted proxies (for production behind load balancer)
const trustedProxies = getTrustedProxyConfig()
const server = Fastify({
  logger: true,
  trustProxy: trustedProxies || false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId'
}) as OnchainEnabledServer

// ============================================================================
// Security Middleware (order matters!)
// ============================================================================

// 1. HTTPS Enforcement (production only)
server.addHook('onRequest', enforceHTTPS)

// 2. Security Headers (Helmet)
server.register(helmet, helmetConfig)

// 3. CORS
server.register(cors, corsConfig)

// 4. Rate Limiting (per-user for authenticated, per-IP otherwise)
if (isRateLimitEnabled()) {
  server.register(rateLimit, rateLimitConfig)
} else {
  console.warn('⚠️  Rate limiting disabled (not recommended for production)')
}

// Log security configuration
logSecurityConfig()

// Swagger / OpenAPI
const swaggerEnabled = config.swagger.enabled
if (swaggerEnabled) {
  server.register(swagger, {
    openapi: {
      info: {
        title: "Circuloos Verifier API",
        description: "VC/VP verification endpoints and hybrid queries",
        version: "0.0.0",
      },
      tags: [
        { name: "health", description: "Service health" },
        { name: "verify", description: "Verify signed credentials" },
        { name: "vp", description: "Verify verifiable presentations" },
        { name: "hybrid", description: "Hybrid on-chain/off-chain queries" },
        { name: "issuers", description: "Trusted issuers registry" },
      ],
    },
  })
  server.register(swaggerUI, { routePrefix: "/api/v1/docs" })
}

// Keep legacy /health endpoint for Docker healthcheck
server.get('/health', async () => ({ ok: true }))

// API v1 health endpoint
server.get('/api/v1/health', {
  schema: { tags: ["health"], response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } } },
}, async () => ({ ok: true }))
// Only add the decorator if it doesn't already exist to avoid FST_ERR_DEC_ALREADY_PRESENT
if (typeof server.hasDecorator !== 'function' || !server.hasDecorator('trustedIssuerRegistry')) {
  server.decorate('trustedIssuerRegistry', undefined)
}
// decorate hybrid credential service
if (typeof server.hasDecorator !== 'function' || !server.hasDecorator('hybridCredentialService')) {
  server.decorate('hybridCredentialService', undefined)
}
// decorate challenge service
if (typeof server.hasDecorator !== 'function' || !server.hasDecorator('challengeService')) {
  server.decorate('challengeService', undefined)
}
// decorate batch service
if (typeof server.hasDecorator !== 'function' || !server.hasDecorator('batchService')) {
  server.decorate('batchService', undefined)
}

server.addHook('onReady', async () => {
  // evaluate env at onReady so parent process can set variables before child
  const trustedRegistryEnabled = Boolean(config.trustedRegistry.address)
  if (!trustedRegistryEnabled) return
  try {
    // enable sqlite store by default in development if not explicitly disabled
    const sqlEnabled = config.trustedRegistry.sql.enabled
    const dbPath = config.trustedRegistry.sql.dbPath

    // Build options and attempt to lazily instantiate SqlIssuerStore only when enabled.
    const serviceOpts: any = {
      registryAddress: config.trustedRegistry.address,
      providerUrl: config.blockchain.rpcUrl,
      startBlock: config.trustedRegistry.startBlock,
      storagePath: config.trustedRegistry.storagePath,
    }

    if (sqlEnabled) {
      try {
        // dynamic import so missing native bindings don't crash the process at module load
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { SqlIssuerStore } = await import('./services/sqlIssuerStore')
        serviceOpts.sqlStore = new SqlIssuerStore(dbPath)
      } catch (err) {
        server.log.warn({ err }, 'SqlIssuerStore not available; falling back to FileStore')
      }
    }

    server.log.info({ sqlEnabled, dbPath }, 'SqlIssuerStore config')
    // cast to any to avoid transient declaration mismatches between compiled d.ts and source during dev
    trustedRegistryService = new TrustedIssuerRegistryService(serviceOpts as any)
    await trustedRegistryService.start()
    server.trustedIssuerRegistry = trustedRegistryService
    server.log.info('trusted issuer registry service started')

    // instantiate hybrid credential service with enhanced features
    try {
      // Import SqlCredentialStore dynamically if SQL is enabled
      let hybridSqlStore = undefined
      if (sqlEnabled) {
        try {
          const { createSqlCredentialStore } = await import('./services/sqlCredentialStore')
          hybridSqlStore = createSqlCredentialStore(dbPath ? `${dbPath.replace('.sqlite', '')}-credentials.sqlite` : undefined)
        } catch (err) {
          server.log.warn({ err }, 'SqlCredentialStore not available for hybrid service; using FileStore only')
        }
      }

      const hybridService = new HybridCredentialService({
        rpcUrl: config.blockchain.rpcUrl,
        credentialRegistryAddress: config.credentialRegistry.address,
        revocationRegistryAddress: config.revocationRegistry.address,
        startBlock: config.credentialRegistry.startBlock,
        store: serviceOpts.store || new (await import('@circuloos/file-store')).FileStore(config.filestore.baseDir),
        sqlStore: hybridSqlStore,
      })

      await hybridService.start()
      server.hybridCredentialService = hybridService
      server.log.info('hybrid credential service started - W3C compliant on-chain + off-chain system active')
    } catch (err) {
      server.log.error({ err }, 'failed to start hybrid credential service')
    }

    // Initialize Challenge Service for anti-replay protection
    try {
      const { ChallengeService } = await import('./services/challengeService')
      const challengeTtl = config.challenge.ttlSeconds
      const gcIntervalMs = config.challenge.gcIntervalMs
      const dbPath = config.trustedRegistry.sql?.dbPath
      const challengeService = new ChallengeService(
        dbPath ? `${dbPath.replace('.sqlite', '')}-challenges.sqlite` : undefined,
        challengeTtl,
        gcIntervalMs
      )
      server.challengeService = challengeService
      server.log.info(`challenge service started (TTL: ${challengeTtl}s) - anti-replay protection enabled`)
    } catch (err) {
      server.log.warn({ err }, 'challenge service not available; anti-replay protection disabled')
    }

    // Initialize Batch Service for VP attestation batching
    try {
      const { BatchService } = await import('./services/batchService')
      const maxBatchSize = config.batch.maxSize
      const batchIntervalMs = config.batch.intervalMs
      const dbPath = config.trustedRegistry.sql?.dbPath
      const batchService = new BatchService({
        maxBatchSize,
        batchIntervalMs,
        dbPath: dbPath ? `${dbPath.replace('.sqlite', '')}-batches.sqlite` : 'batches.sqlite',
        // contractAddress and rpcUrl can be added later for on-chain submission
      })
      server.batchService = batchService
      server.log.info(`batch service started (max: ${maxBatchSize} VPs, interval: ${batchIntervalMs}ms) - VP batching enabled`)
    } catch (err) {
      server.log.warn({ err }, 'batch service not available; VP batching disabled')
    }
  } catch (err) {
    server.log.error({ err }, 'failed to start trusted issuer registry service')
  }
})

server.addHook('onClose', async () => {
  if (trustedRegistryService) await trustedRegistryService.stop()
  server.trustedIssuerRegistry = undefined

  if (server.hybridCredentialService) {
    await server.hybridCredentialService.stop()
    server.hybridCredentialService = undefined
  }

  if (server.batchService) {
    server.batchService.close()
    server.batchService = undefined
  }
})

// Register API routes
server.register(simplifiedVerifyRoutes, { prefix: '/api/v1' })
console.log('✅ API routes registered: /api/v1/verify')

// server.register(vpRoutes, { prefix: '/api/v1' })
// server.register(issuersRoutes, { prefix: '/api/v1/issuers' })
// server.register(playgroundRoutes, { prefix: '/api/v1/playground' })
// server.register(hybridRoutes, { prefix: '/api/v1/hybrid' })

const start = async () => {
  try {
    await server.listen({
      port: config.http.port,
      host: config.http.host,
    })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) start()

export default server
