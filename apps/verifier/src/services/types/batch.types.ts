/**
 * Attestation Batch Types
 *
 * TypeScript interfaces matching the Solidity contracts
 */

/**
 * Represents a batch of VP attestations on-chain
 */
export interface AttestationBatch {
  batchId: number
  merkleRoot: string // bytes32 as hex string
  timestamp: number
  vpCount: number
  ipfsCid?: string
  attester?: string
}

/**
 * Represents a pending VP to be included in the next batch
 */
export interface PendingVP {
  vpHash: string // bytes32 as hex string
  holderAddress: string
  timestamp: number
  metadata?: Record<string, any> // Optional metadata (not stored on-chain)
}

/**
 * Merkle proof for a specific VP
 */
export interface MerkleProof {
  vpHash: string // The leaf (VP hash)
  root: string // The Merkle root
  proof: string[] // Array of sibling hashes
  index: number // Position in the tree
  batchId: number // Which batch this belongs to
}

/**
 * Result of building a Merkle tree
 */
export interface MerkleTreeResult {
  root: string // The computed Merkle root
  leaves: string[] // All leaf hashes (in order)
  tree: string[][] // Full tree (array of levels)
}

/**
 * Configuration for the BatchService
 */
export interface BatchServiceConfig {
  maxBatchSize: number // Maximum VPs per batch (e.g., 500)
  batchIntervalMs: number // Time interval to trigger batch (e.g., 15 minutes)
  dbPath: string // Path to SQLite database
  contractAddress?: string // Address of Diamond contract (optional for testing)
  rpcUrl?: string // RPC URL for blockchain (optional for testing)
  privateKey?: string // Private key for signing transactions (optional)
}

/**
 * Statistics for monitoring
 */
export interface BatchStats {
  totalBatches: number
  totalVPs: number
  pendingVPs: number
  lastBatchTimestamp: number
  averageVPsPerBatch: number
}
