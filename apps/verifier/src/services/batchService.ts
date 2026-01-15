/**
 * Batch Service
 *
 * Accumulates VP hashes and creates Merkle tree batches for on-chain attestation
 *
 * Features:
 * - Accumulates VP hashes in SQLite
 * - Builds Merkle trees when threshold is reached (time or count)
 * - Provides Merkle proofs for inclusion verification
 * - Stores batch metadata for auditing
 */

import Database = require('better-sqlite3')
import { createHash } from 'crypto'
import type {
  AttestationBatch,
  BatchServiceConfig,
  BatchStats,
  MerkleProof,
  MerkleTreeResult,
  PendingVP
} from './types/batch.types'

export class BatchService {
  private db: any // better-sqlite3 Database instance
  private config: BatchServiceConfig
  private batchTimer: NodeJS.Timeout | null = null

  constructor(config: BatchServiceConfig) {
    this.config = config
    this.db = new (Database as any)(config.dbPath)
    this.initDatabase()
    this.startBatchTimer()
  }

  /**
   * Initialize database tables
   */
  private initDatabase(): void {
    // Table for pending VPs (not yet batched)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_vps (
        vp_hash TEXT PRIMARY KEY,
        holder_address TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      )
    `)

    // Table for batches
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS batches (
        batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
        merkle_root TEXT NOT NULL,
        vp_count INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        ipfs_cid TEXT,
        attester TEXT,
        tx_hash TEXT,
        block_number INTEGER
      )
    `)

    // Table for VP to batch mapping (for Merkle proofs)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vp_batch_mapping (
        vp_hash TEXT PRIMARY KEY,
        batch_id INTEGER NOT NULL,
        leaf_index INTEGER NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
      )
    `)

    // Table for Merkle tree structure (for proof generation)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS merkle_tree_nodes (
        batch_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        node_index INTEGER NOT NULL,
        hash TEXT NOT NULL,
        PRIMARY KEY (batch_id, level, node_index),
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
      )
    `)

    // Indexes for performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_pending_timestamp ON pending_vps(timestamp)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_vp_batch ON vp_batch_mapping(batch_id)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_merkle_nodes ON merkle_tree_nodes(batch_id, level)')
  }

  /**
   * Add a VP hash to the pending queue
   */
  addVP(vpHash: string, holderAddress: string, metadata?: Record<string, any>): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO pending_vps (vp_hash, holder_address, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(
      vpHash,
      holderAddress,
      Date.now(),
      metadata ? JSON.stringify(metadata) : null
    )

    // Check if we should trigger a batch
    this.checkAndTriggerBatch()
  }

  /**
   * Get all pending VPs
   */
  getPendingVPs(): PendingVP[] {
    const stmt = this.db.prepare('SELECT * FROM pending_vps ORDER BY timestamp ASC')
    const rows = stmt.all() as any[]

    return rows.map(row => ({
      vpHash: row.vp_hash,
      holderAddress: row.holder_address,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }))
  }

  /**
   * Get pending VP count
   */
  getPendingCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM pending_vps').get() as { count: number }
    return result.count
  }

  /**
   * Build a Merkle tree from an array of leaf hashes
   */
  private buildMerkleTree(leaves: string[]): MerkleTreeResult {
    if (leaves.length === 0) {
      throw new Error('Cannot build Merkle tree with no leaves')
    }

    // Convert hex strings to buffers
    const leafBuffers = leaves.map(leaf => Buffer.from(leaf.replace('0x', ''), 'hex'))

    // Build tree level by level
    const tree: string[][] = []
    tree[0] = leaves // Level 0 = leaves

    let currentLevel = leafBuffers
    let level = 0

    while (currentLevel.length > 1) {
      level++
      const nextLevel: Buffer[] = []

      // Pair up hashes and hash them together
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left // Duplicate if odd

        // Hash(left || right)
        const combined = Buffer.concat([left, right])
        const hash = createHash('sha256').update(combined).digest()
        nextLevel.push(hash)
      }

      tree[level] = nextLevel.map(buf => '0x' + buf.toString('hex'))
      currentLevel = nextLevel as any
    }

    const root = '0x' + currentLevel[0].toString('hex')

    return { root, leaves, tree }
  }

  /**
   * Generate Merkle proof for a specific leaf
   */
  private generateProof(leaves: string[], leafIndex: number): string[] {
    if (leafIndex < 0 || leafIndex >= leaves.length) {
      throw new Error('Invalid leaf index')
    }

    const proof: string[] = []
    let currentIndex = leafIndex
    let currentLevel = leaves.map(leaf => Buffer.from(leaf.replace('0x', ''), 'hex'))

    while (currentLevel.length > 1) {
      const isRightNode = currentIndex % 2 === 1
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1

      // Add sibling to proof (if it exists)
      if (siblingIndex < currentLevel.length) {
        proof.push('0x' + currentLevel[siblingIndex].toString('hex'))
      }

      // Move up to next level
      currentIndex = Math.floor(currentIndex / 2)

      // Build next level
      const nextLevel: Buffer[] = []
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left
        const hash = createHash('sha256').update(Buffer.concat([left, right])).digest()
        nextLevel.push(hash)
      }

      currentLevel = nextLevel as any
    }

    return proof
  }

  /**
   * Create a new batch from pending VPs
   */
  async createBatch(): Promise<AttestationBatch | null> {
    const pending = this.getPendingVPs()

    if (pending.length === 0) {
      console.log('[BatchService] No pending VPs to batch')
      return null
    }

    console.log(`[BatchService] Creating batch with ${pending.length} VPs`)

    // Build Merkle tree
    const leaves = pending.map(vp => vp.vpHash)
    const { root, tree } = this.buildMerkleTree(leaves)

    // Start transaction
    const insertBatch = this.db.transaction(() => {
      // Insert batch record
      const batchStmt = this.db.prepare(`
        INSERT INTO batches (merkle_root, vp_count, timestamp)
        VALUES (?, ?, ?)
      `)

      const result = batchStmt.run(root, pending.length, Date.now())
      const batchId = result.lastInsertRowid as number

      // Insert VP mappings
      const mappingStmt = this.db.prepare(`
        INSERT INTO vp_batch_mapping (vp_hash, batch_id, leaf_index)
        VALUES (?, ?, ?)
      `)

      for (let i = 0; i < pending.length; i++) {
        mappingStmt.run(pending[i].vpHash, batchId, i)
      }

      // Store Merkle tree structure
      const nodeStmt = this.db.prepare(`
        INSERT INTO merkle_tree_nodes (batch_id, level, node_index, hash)
        VALUES (?, ?, ?, ?)
      `)

      for (let level = 0; level < tree.length; level++) {
        for (let i = 0; i < tree[level].length; i++) {
          nodeStmt.run(batchId, level, i, tree[level][i])
        }
      }

      // Remove from pending
      this.db.prepare('DELETE FROM pending_vps').run()

      return batchId
    })

    const batchId = insertBatch()

    console.log(`[BatchService] Batch ${batchId} created with root: ${root}`)

    // TODO: Submit to blockchain if configured
    // await this.submitToBlockchain(batchId, root, pending.length)

    return {
      batchId,
      merkleRoot: root,
      timestamp: Date.now(),
      vpCount: pending.length
    }
  }

  /**
   * Get Merkle proof for a VP hash
   */
  getMerkleProof(vpHash: string): MerkleProof | null {
    // Get batch and index
    const mapping = this.db.prepare(`
      SELECT batch_id, leaf_index FROM vp_batch_mapping WHERE vp_hash = ?
    `).get(vpHash) as { batch_id: number; leaf_index: number } | undefined

    if (!mapping) {
      return null
    }

    // Get batch info
    const batch = this.db.prepare(`
      SELECT merkle_root FROM batches WHERE batch_id = ?
    `).get(mapping.batch_id) as { merkle_root: string } | undefined

    if (!batch) {
      return null
    }

    // Get all leaves from level 0
    const leaves = this.db.prepare(`
      SELECT hash FROM merkle_tree_nodes
      WHERE batch_id = ? AND level = 0
      ORDER BY node_index ASC
    `).all(mapping.batch_id) as { hash: string }[]

    // Generate proof
    const leafHashes = leaves.map(l => l.hash)
    const proof = this.generateProof(leafHashes, mapping.leaf_index)

    return {
      vpHash,
      root: batch.merkle_root,
      proof,
      index: mapping.leaf_index,
      batchId: mapping.batch_id
    }
  }

  /**
   * Get batch by ID
   */
  getBatch(batchId: number): AttestationBatch | null {
    const batch = this.db.prepare(`
      SELECT * FROM batches WHERE batch_id = ?
    `).get(batchId) as any

    if (!batch) {
      return null
    }

    return {
      batchId: batch.batch_id,
      merkleRoot: batch.merkle_root,
      timestamp: batch.timestamp,
      vpCount: batch.vp_count,
      ipfsCid: batch.ipfs_cid,
      attester: batch.attester
    }
  }

  /**
   * Get statistics
   */
  getStats(): BatchStats {
    const batchCount = (this.db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number }).count
    const totalVPs = (this.db.prepare('SELECT COUNT(*) as count FROM vp_batch_mapping').get() as { count: number }).count
    const pendingVPs = this.getPendingCount()

    const lastBatch = this.db.prepare(`
      SELECT timestamp FROM batches ORDER BY batch_id DESC LIMIT 1
    `).get() as { timestamp: number } | undefined

    return {
      totalBatches: batchCount,
      totalVPs,
      pendingVPs,
      lastBatchTimestamp: lastBatch?.timestamp || 0,
      averageVPsPerBatch: batchCount > 0 ? totalVPs / batchCount : 0
    }
  }

  /**
   * Check if batch should be triggered
   */
  private checkAndTriggerBatch(): void {
    const pendingCount = this.getPendingCount()

    if (pendingCount >= this.config.maxBatchSize) {
      console.log(`[BatchService] Triggering batch: reached max size (${pendingCount}/${this.config.maxBatchSize})`)
      this.createBatch()
    }
  }

  /**
   * Start periodic batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      const pendingCount = this.getPendingCount()
      if (pendingCount > 0) {
        console.log(`[BatchService] Triggering batch: time interval (${pendingCount} pending VPs)`)
        this.createBatch()
      }
    }, this.config.batchIntervalMs)
  }

  /**
   * Stop batch timer
   */
  stop(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.stop()
    this.db.close()
  }
}
