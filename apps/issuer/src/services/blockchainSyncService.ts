import { ethers } from 'ethers'
import { SqlJsStorageAdapter, createLogger } from '@circuloos/common'

const logger = createLogger('blockchain-sync')

interface DiamondFacets {
    trustedIssuer: ethers.Contract
    credentialStatus: ethers.Contract
    diamondLoupe: ethers.Contract
}

interface SyncState {
    lastSyncedBlock: number
    isSyncing: boolean
    lastSyncTime: Date
}

export class BlockchainSyncService {
    private provider: ethers.providers.Provider
    private diamondAddress: string
    private facets: DiamondFacets
    private syncState: SyncState
    private storage: SqlJsStorageAdapter

    constructor(
        rpcUrl: string,
        diamondAddress: string,
        storage: SqlJsStorageAdapter,
        abis: {
            trustedIssuer: any[]
            credentialStatus: any[]
            diamondLoupe: any[]
        }
    ) {
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
        this.diamondAddress = diamondAddress
        this.storage = storage

        // Create contract instances for each facet
        this.facets = {
            trustedIssuer: new ethers.Contract(diamondAddress, abis.trustedIssuer, this.provider),
            credentialStatus: new ethers.Contract(diamondAddress, abis.credentialStatus, this.provider),
            diamondLoupe: new ethers.Contract(diamondAddress, abis.diamondLoupe, this.provider)
        }

        this.syncState = {
            lastSyncedBlock: 0,
            isSyncing: false,
            lastSyncTime: new Date()
        }
    }

    /**
     * Initialize sync from a specific block
     */
    async initializeSync(startBlock?: number): Promise<void> {
        // Get last synced block from DB
        const lastBlock = await this.storage.getLastSyncedBlock()
        const fromBlock = startBlock || lastBlock || 0

        // Get current block
        const currentBlock = await this.provider.getBlockNumber()

        logger.info(`[Sync] Initializing from block ${fromBlock} to ${currentBlock}`)

        // Historical sync
        await this.syncHistoricalEvents(fromBlock, currentBlock)

        // Start real-time listeners
        await this.startEventListeners(currentBlock)

        this.syncState.lastSyncedBlock = currentBlock
        this.syncState.lastSyncTime = new Date()
    }

    /**
     * Sync historical events
     */
    private async syncHistoricalEvents(fromBlock: number, toBlock: number): Promise<void> {
        this.syncState.isSyncing = true

        try {
            // Sync CredentialIssued events
            await this.syncCredentialIssuedEvents(fromBlock, toBlock)

            // Sync CredentialRevoked events
            await this.syncCredentialRevokedEvents(fromBlock, toBlock)

            // Sync IssuerAdded events
            await this.syncTrustedIssuerAddedEvents(fromBlock, toBlock)

            // Sync IssuerRemoved events
            await this.syncTrustedIssuerRemovedEvents(fromBlock, toBlock)

            logger.info(`[Sync] Historical sync completed: blocks ${fromBlock}-${toBlock}`)

            // Update sync state in DB
            await this.storage.updateSyncState(toBlock)

        } catch (error) {
            logger.error('[Sync] Error in historical sync:', error)
            throw error
        } finally {
            this.syncState.isSyncing = false
        }
    }

    /**
     * Sync CredentialIssued events
     */
    private async syncCredentialIssuedEvents(fromBlock: number, toBlock: number): Promise<void> {
        const filter = this.facets.credentialStatus.filters.CredentialIssued()

        const events = await this.facets.credentialStatus.queryFilter(
            filter,
            fromBlock,
            toBlock
        )

        logger.info(`[Sync] Found ${events.length} CredentialIssued events`)

        for (const event of events) {
            const { credentialHash, issuer, subject, timestamp } = event.args as any

            await this.storage.insertCredentialIssuance({
                credentialHash,
                issuer,
                subject,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp.toNumber() * 1000)
            })

            logger.info(`[Sync] Credential ${credentialHash} indexed`)
        }
    }

    /**
     * Sync CredentialRevoked events
     */
    private async syncCredentialRevokedEvents(fromBlock: number, toBlock: number): Promise<void> {
        const filter = this.facets.credentialStatus.filters.CredentialRevoked()

        const events = await this.facets.credentialStatus.queryFilter(
            filter,
            fromBlock,
            toBlock
        )

        logger.info(`[Sync] Found ${events.length} CredentialRevoked events`)

        for (const event of events) {
            const { vcHash, revoker, timestamp } = event.args as any

            await this.storage.updateCredentialRevocation({
                credentialHash: vcHash,
                revoker,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp.toNumber() * 1000),
                reason: 'Revoked by issuer' // Contract does not include reason in event
            })

            logger.info(`[Sync] Revocation of ${vcHash} indexed`)
        }
    }

    /**
     * Sync IssuerAdded events
     */
    private async syncTrustedIssuerAddedEvents(fromBlock: number, toBlock: number): Promise<void> {
        const filter = this.facets.trustedIssuer.filters.IssuerAdded()

        const events = await this.facets.trustedIssuer.queryFilter(
            filter,
            fromBlock,
            toBlock
        )

        logger.info(`[Sync] Found ${events.length} IssuerAdded events`)

        for (const event of events) {
            const { issuer, addedBy } = event.args as any
            const block = await this.provider.getBlock(event.blockNumber)
            const timestamp = block.timestamp

            // Try to get pending metadata for this issuer
            let name: string | undefined
            let email: string | undefined

            try {
                const pendingMetadata = await this.storage.getPendingIssuerMetadata(issuer)
                if (pendingMetadata) {
                    name = pendingMetadata.name
                    email = pendingMetadata.email
                    logger.info(`[Sync] Found pending metadata for issuer ${issuer}: name=${name}, email=${email}`)

                    // Delete pending metadata after consuming it
                    await this.storage.deletePendingIssuerMetadata(issuer)
                }
            } catch (err) {
                logger.warn(`[Sync] Could not fetch pending metadata for ${issuer}:`, err)
            }

            // Use the new method that includes metadata
            await this.storage.insertTrustedIssuerWithMetadata({
                address: issuer,
                addedBy,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp * 1000),
                isActive: true,
                name,
                email
            })

            logger.info(`[Sync] Issuer ${issuer} added${name ? ` (${name})` : ''}`)
        }
    }

    /**
     * Sync IssuerRemoved events
     */
    private async syncTrustedIssuerRemovedEvents(fromBlock: number, toBlock: number): Promise<void> {
        const filter = this.facets.trustedIssuer.filters.IssuerRemoved()

        const events = await this.facets.trustedIssuer.queryFilter(
            filter,
            fromBlock,
            toBlock
        )

        logger.info(`[Sync] Found ${events.length} IssuerRemoved events`)

        for (const event of events) {
            const { issuer, removedBy } = event.args as any
            const block = await this.provider.getBlock(event.blockNumber)
            const timestamp = block.timestamp

            await this.storage.updateTrustedIssuer({
                address: issuer,
                removedBy,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp * 1000),
                isActive: false
            })

            logger.info(`[Sync] Issuer ${issuer} removed`)
        }
    }

    /**
     * Start real-time event listeners
     */
    private async startEventListeners(fromBlock: number): Promise<void> {
        // Listener for CredentialIssued
        this.facets.credentialStatus.on('CredentialIssued', async (
            credentialHash: string,
            issuer: string,
            subject: string,
            timestamp: ethers.BigNumber,
            event: ethers.Event
        ) => {
            logger.info(`[Sync] New CredentialIssued event: ${credentialHash}`)

            await this.storage.insertCredentialIssuance({
                credentialHash,
                issuer,
                subject,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp.toNumber() * 1000)
            })

            await this.storage.updateSyncState(event.blockNumber)
        })

        // Listener for CredentialRevoked
        this.facets.credentialStatus.on('CredentialRevoked', async (
            vcHash: string,
            revoker: string,
            timestamp: ethers.BigNumber,
            event: ethers.Event
        ) => {
            logger.info(`[Sync] New CredentialRevoked event: ${vcHash}`)

            await this.storage.updateCredentialRevocation({
                credentialHash: vcHash,
                revoker,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(timestamp.toNumber() * 1000),
                reason: 'Revoked by issuer'
            })

            await this.storage.updateSyncState(event.blockNumber)
        })

        // Listener for IssuerAdded
        this.facets.trustedIssuer.on('IssuerAdded', async (
            issuer: string,
            addedBy: string,
            event: ethers.Event
        ) => {
            logger.info(`[Sync] New IssuerAdded event: ${issuer}`)

            const block = await this.provider.getBlock(event.blockNumber)

            // Try to get pending metadata for this issuer
            let name: string | undefined
            let email: string | undefined

            try {
                const pendingMetadata = await this.storage.getPendingIssuerMetadata(issuer)
                if (pendingMetadata) {
                    name = pendingMetadata.name
                    email = pendingMetadata.email
                    logger.info(`[Sync] Found pending metadata for issuer ${issuer}: name=${name}, email=${email}`)

                    // Delete pending metadata after consuming it
                    await this.storage.deletePendingIssuerMetadata(issuer)
                }
            } catch (err) {
                logger.warn(`[Sync] Could not fetch pending metadata for ${issuer}:`, err)
            }

            await this.storage.insertTrustedIssuerWithMetadata({
                address: issuer,
                addedBy,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(block.timestamp * 1000),
                isActive: true,
                name,
                email
            })

            await this.storage.updateSyncState(event.blockNumber)
            logger.info(`[Sync] Issuer ${issuer} added${name ? ` (${name})` : ''}`)
        })

        // Listener for IssuerRemoved
        this.facets.trustedIssuer.on('IssuerRemoved', async (
            issuer: string,
            removedBy: string,
            event: ethers.Event
        ) => {
            logger.info(`[Sync] New IssuerRemoved event: ${issuer}`)

            const block = await this.provider.getBlock(event.blockNumber)

            await this.storage.updateTrustedIssuer({
                address: issuer,
                removedBy,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
                timestamp: new Date(block.timestamp * 1000),
                isActive: false
            })

            await this.storage.updateSyncState(event.blockNumber)
        })

        logger.info(`[Sync] Listeners started from block ${fromBlock}`)
    }

    /**
     * Periodic incremental sync
     */
    async syncIncremental(): Promise<void> {
        if (this.syncState.isSyncing) {
            logger.info('[Sync] Sync already in progress, skipping')
            return
        }

        const currentBlock = await this.provider.getBlockNumber()
        const fromBlock = this.syncState.lastSyncedBlock + 1

        if (fromBlock > currentBlock) {
            // console.log('[Sync] No new blocks')
            return
        }

        logger.info(`[Sync] Incremental sync: blocks ${fromBlock}-${currentBlock}`)

        await this.syncHistoricalEvents(fromBlock, currentBlock)

        this.syncState.lastSyncedBlock = currentBlock
        this.syncState.lastSyncTime = new Date()
    }

    /**
     * Get sync state
     */
    getSyncState(): SyncState {
        return { ...this.syncState }
    }

    /**
     * Stop listeners
     */
    stop(): void {
        this.facets.credentialStatus.removeAllListeners()
        this.facets.trustedIssuer.removeAllListeners()
        logger.info('[Sync] Listeners stopped')
    }
}
