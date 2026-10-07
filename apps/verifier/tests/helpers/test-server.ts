import Fastify, { type FastifyInstance } from 'fastify'
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

/**
 * Close a better-sqlite3 handle if it is still open (idempotent).
 * Needed on Windows, where an open SQLite handle keeps the file locked (EBUSY on unlink).
 */
function closeDb(db: any): void {
  if (db && db.open) {
    db.close()
  }
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

  // Release SQLite handles and timers when the server is closed so that
  // tests can remove their temporary database files on every platform.
  server.addHook('onClose', async (instance) => {
    const batch: any = (instance as any).batchService
    if (batch) {
      batch.stop()
      closeDb(batch.db)
    }
    const challenge: any = (instance as any).challengeService
    if (challenge) {
      closeDb(challenge.db)
    }
  })

  // Register routes
  await server.register(vpRoutes, { prefix: '/' })

  await server.ready()

  return server
}
