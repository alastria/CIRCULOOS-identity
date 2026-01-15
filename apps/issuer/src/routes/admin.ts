import { FastifyPluginAsync } from 'fastify'
import { BlockchainSyncService } from '../services/blockchainSyncService'
import { SqlJsStorageAdapter } from '@circuloos/common'

const adminRoutes: FastifyPluginAsync = async (fastify, opts) => {
    const syncService = (fastify as any).blockchainSyncService as BlockchainSyncService
    const storage = (fastify as any).storage as SqlJsStorageAdapter

    // GET /admin/blockchain/stats
    fastify.get('/admin/blockchain/stats', {
        schema: {
            tags: ['admin'],
            description: 'Synchronized blockchain statistics'
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

    // GET /admin/blockchain/credentials
    fastify.get('/admin/blockchain/credentials', {
        schema: {
            tags: ['admin'],
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 50 },
                    offset: { type: 'number', default: 0 },
                    issuer: { type: 'string' },
                    subject: { type: 'string' },
                    revoked: { type: 'boolean' }
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

    // GET /admin/blockchain/issuers
    fastify.get('/admin/blockchain/issuers', {
        schema: {
            tags: ['admin'],
            querystring: {
                type: 'object',
                properties: {
                    active: { type: 'boolean' }
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

    // POST /admin/blockchain/sync
    fastify.post('/admin/blockchain/sync', {
        schema: {
            tags: ['admin'],
            body: {
                type: 'object',
                properties: {
                    fromBlock: { type: 'number' },
                    force: { type: 'boolean', default: false }
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

    // GET /admin/blockchain/sync/state
    fastify.get('/admin/blockchain/sync/state', {
        schema: {
            tags: ['admin']
        }
    }, async (request, reply) => {
        return syncService.getSyncState()
    })

    // POST /admin/issuers/prepare - Save pending issuer metadata before blockchain TX
    fastify.post('/admin/issuers/prepare', {
        schema: {
            tags: ['admin'],
            description: 'Save issuer metadata before blockchain registration. The metadata will be associated with the issuer when the IssuerAdded event is captured.',
            body: {
                type: 'object',
                required: ['address'],
                properties: {
                    address: { type: 'string', description: 'Wallet address of the issuer' },
                    name: { type: 'string', description: 'Display name of the issuer' },
                    email: { type: 'string', format: 'email', description: 'Contact email of the issuer' },
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

            console.log(`[Admin] Saved pending issuer metadata for ${address}: name=${name}, email=${email}`)

            return {
                success: true,
                message: 'Metadata saved. Proceed with blockchain transaction.',
                address: address.toLowerCase()
            }
        } catch (error: any) {
            console.error('[Admin] Error saving pending issuer metadata:', error)
            return reply.status(500).send({
                error: 'Failed to save metadata',
                message: error.message
            })
        }
    })
}

export default adminRoutes
