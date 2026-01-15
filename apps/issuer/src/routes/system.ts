import { FastifyPluginAsync } from 'fastify'
import { BlockchainSyncService } from '../services/blockchainSyncService'
import { SqlJsStorageAdapter } from '@circuloos/common'

/**
 * System Routes - /api/v1/system
 * 
 * Administrative and system management endpoints.
 * Includes blockchain sync status, trusted issuer management, and credential registry.
 */
const systemRoutes: FastifyPluginAsync = async (fastify, opts) => {
  const syncService = (fastify as any).blockchainSyncService as BlockchainSyncService
  const storage = (fastify as any).storage as SqlJsStorageAdapter

  // ============================================================================
  // GET /api/v1/system/blockchain/stats - Blockchain statistics
  // ============================================================================
  fastify.get('/blockchain/stats', {
    schema: {
      tags: ['system'],
      summary: 'Blockchain statistics',
      description: 'Get synchronized blockchain statistics including credential and issuer counts'
    }
  }, async (request, reply) => {
    const stats = await storage.getBlockchainStats()
    const syncState = syncService.getSyncState()

    return {
      credentials: {
        total: stats.totalCredentials,
        active: stats.activeCredentials,
        revoked: stats.revokedCredentials
      },
      issuers: {
        total: stats.totalIssuers,
        active: stats.activeIssuers
      },
      sync: {
        lastSyncedBlock: syncState.lastSyncedBlock,
        lastSyncTime: syncState.lastSyncTime,
        isSyncing: syncState.isSyncing
      }
    }
  })

  // ============================================================================
  // GET /api/v1/system/blockchain/credentials - List blockchain credentials
  // ============================================================================
  fastify.get('/blockchain/credentials', {
    schema: {
      tags: ['system'],
      summary: 'List blockchain credentials',
      description: 'Get paginated list of credentials registered on the blockchain',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50, description: 'Number of results per page' },
          offset: { type: 'number', default: 0, description: 'Number of results to skip' },
          issuer: { type: 'string', description: 'Filter by issuer DID/address' },
          subject: { type: 'string', description: 'Filter by subject DID/address' },
          revoked: { type: 'boolean', description: 'Filter by revocation status' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as any
    const credentials = await storage.getBlockchainCredentials({
      limit: query.limit,
      offset: query.offset,
      issuer: query.issuer,
      subject: query.subject,
      revoked: query.revoked
    })

    return {
      credentials,
      total: await storage.countBlockchainCredentials(query)
    }
  })

  // ============================================================================
  // GET /api/v1/system/blockchain/issuers - List trusted issuers
  // ============================================================================
  fastify.get('/blockchain/issuers', {
    schema: {
      tags: ['system'],
      summary: 'List trusted issuers',
      description: 'Get list of trusted issuers registered on the blockchain',
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean', description: 'Filter by active status' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as any
    const issuers = await storage.getTrustedIssuers({
      active: query.active
    })

    return { issuers }
  })

  // ============================================================================
  // POST /api/v1/system/blockchain/sync - Trigger blockchain sync
  // ============================================================================
  fastify.post('/blockchain/sync', {
    schema: {
      tags: ['system'],
      summary: 'Trigger blockchain sync',
      description: 'Manually trigger blockchain synchronization',
      body: {
        type: 'object',
        properties: {
          fromBlock: { type: 'number', description: 'Start block for sync (optional)' },
          force: { type: 'boolean', default: false, description: 'Force full resync' }
        }
      }
    }
  }, async (request, reply) => {
    const { fromBlock, force } = request.body as any

    if (force) {
      // Don't await if it takes too long, just trigger it
      syncService.initializeSync(fromBlock).catch(err => console.error('Force sync failed:', err))
    } else {
      await syncService.syncIncremental()
    }

    return { success: true, state: syncService.getSyncState() }
  })

  // ============================================================================
  // GET /api/v1/system/blockchain/sync/state - Get sync state
  // ============================================================================
  fastify.get('/blockchain/sync/state', {
    schema: {
      tags: ['system'],
      summary: 'Get sync state',
      description: 'Get current blockchain synchronization state'
    }
  }, async (request, reply) => {
    return syncService.getSyncState()
  })

  // ============================================================================
  // POST /api/v1/system/issuers/prepare - Prepare issuer metadata before TX
  // ============================================================================
  fastify.post('/issuers/prepare', {
    schema: {
      tags: ['system'],
      summary: 'Prepare issuer registration',
      description: 'Save issuer metadata before blockchain registration. The metadata will be associated with the issuer when the IssuerAdded event is captured.',
      body: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', description: 'Wallet address of the issuer' },
          name: { type: 'string', description: 'Display name of the issuer' },
          email: { type: 'string', description: 'Contact email of the issuer' },
          requestedBy: { type: 'string', description: 'Address of the admin requesting the registration' }
        }
      }
    }
  }, async (request, reply) => {
    const { address, name, email, requestedBy } = request.body as {
      address: string
      name?: string
      email?: string
      requestedBy?: string
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return reply.status(400).send({
        error: 'Invalid address format',
        message: 'Address must be a valid Ethereum address (0x...)'
      })
    }

    try {
      await storage.savePendingIssuerMetadata({
        address,
        name,
        email,
        requestedBy
      })

      console.log(`[System] Saved pending issuer metadata for ${address}: name=${name}, email=${email}`)

      return {
        success: true,
        message: 'Metadata saved. Proceed with blockchain transaction.',
        address: address.toLowerCase()
      }
    } catch (error: any) {
      console.error('[System] Error saving pending issuer metadata:', error)
      return reply.status(500).send({
        error: 'Failed to save metadata',
        message: error.message
      })
    }
  })

  // ============================================================================
  // GET /api/v1/system/health - Extended health check
  // ============================================================================
  fastify.get('/health', {
    schema: {
      tags: ['system'],
      summary: 'Extended health check',
      description: 'Get detailed health status of the issuer service'
    }
  }, async (request, reply) => {
    const syncState = syncService?.getSyncState()
    
    return {
      ok: true,
      service: 'issuer',
      timestamp: new Date().toISOString(),
      blockchain: syncState ? {
        connected: true,
        lastSyncedBlock: syncState.lastSyncedBlock,
        isSyncing: syncState.isSyncing
      } : {
        connected: false
      }
    }
  })
}

export default systemRoutes
