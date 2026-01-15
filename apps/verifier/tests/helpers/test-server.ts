import Fastify, { type FastifyInstance } from 'fastify'
import verifyRoutes from '../../src/routes/verify'
import vpRoutes from '../../src/routes/vp'
import { BatchService } from '../../src/services/batchService'
import { ChallengeService } from '../../src/services/challengeService'

export interface TestServerOptions {
  batchService?: {
    maxBatchSize: number
    batchIntervalMs: number
    dbPath: string
  } | null
  challengeService?: {
    dbPath?: string
    ttl?: number
  } | null
}

export async function buildTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })

  // Decorate services
  server.decorate('batchService', undefined)
  server.decorate('challengeService', undefined)

  // Initialize ChallengeService
  if (options.challengeService !== null) {
    const challengeConfig = options.challengeService || {}
    const challengeService = new ChallengeService(
      challengeConfig.dbPath,
      challengeConfig.ttl || 300
    )
    server.challengeService = challengeService as any
  }

  // Initialize BatchService
  if (options.batchService) {
    const batchService = new BatchService(options.batchService)
    server.batchService = batchService as any
  }

  // Register routes
  await server.register(vpRoutes, { prefix: '/' })

  await server.ready()

  return server
}
