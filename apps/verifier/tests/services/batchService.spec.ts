import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import fs from 'fs'
import { BatchService } from '../../src/services/batchService'
import type { BatchServiceConfig } from '../../src/services/types/batch.types'

describe('BatchService', () => {
  let service: BatchService
  let dbPath: string
  let config: BatchServiceConfig

  beforeEach(() => {
    // Use temporary database for each test
    const tmpDir = path.join(process.cwd(), 'apps/verifier/tmp-test')
    fs.mkdirSync(tmpDir, { recursive: true })
    dbPath = path.join(tmpDir, `batch-test-${Date.now()}.sqlite`)

    config = {
      maxBatchSize: 100,
      batchIntervalMs: 60000, // 1 minute
      dbPath
    }

    service = new BatchService(config)
  })

  afterEach(() => {
    // Clean up
    try {
      service.close()
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  describe('Initialization', () => {
    it('should create database tables', () => {
      const stats = service.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalBatches).toBe(0)
      expect(stats.totalVPs).toBe(0)
      expect(stats.pendingVPs).toBe(0)
    })

    it('should accept custom configuration', () => {
      const customConfig: BatchServiceConfig = {
        maxBatchSize: 500,
        batchIntervalMs: 900000,
        dbPath: dbPath.replace('.sqlite', '-custom.sqlite')
      }

      const customService = new BatchService(customConfig)

      expect((customService as any).config.maxBatchSize).toBe(500)
      expect((customService as any).config.batchIntervalMs).toBe(900000)

      customService.close()
      if (fs.existsSync(customConfig.dbPath)) {
        fs.unlinkSync(customConfig.dbPath)
      }
    })
  })

  describe('addVP', () => {
    it('should add VP to pending queue', () => {
      const vpHash = '0x1234567890abcdef'
      const holderAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

      service.addVP(vpHash, holderAddress)

      const pending = service.getPendingVPs()
      expect(pending).toHaveLength(1)
      expect(pending[0].vpHash).toBe(vpHash)
      expect(pending[0].holderAddress).toBe(holderAddress)
    })

    it('should not duplicate VPs', () => {
      const vpHash = '0xabc123'
      const holderAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

      service.addVP(vpHash, holderAddress)
      service.addVP(vpHash, holderAddress) // Duplicate

      const pending = service.getPendingVPs()
      expect(pending).toHaveLength(1)
    })

    it('should store metadata with VP', () => {
      const vpHash = '0xdef456'
      const holderAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      const metadata = { verifiedAt: Date.now(), challenge: 'test-challenge' }

      service.addVP(vpHash, holderAddress, metadata)

      const pending = service.getPendingVPs()
      expect(pending[0].metadata).toEqual(metadata)
    })

    it('should trigger batch when maxBatchSize is reached', async () => {
      const smallConfig: BatchServiceConfig = {
        maxBatchSize: 3,
        batchIntervalMs: 60000,
        dbPath: dbPath.replace('.sqlite', '-small.sqlite')
      }

      const smallService = new BatchService(smallConfig)

      // Add 3 VPs (should trigger batch)
      smallService.addVP('0x01', '0xaaa')
      smallService.addVP('0x02', '0xbbb')
      smallService.addVP('0x03', '0xccc')

      // Wait a bit for async batch creation
      await new Promise(resolve => setTimeout(resolve, 100))

      const stats = smallService.getStats()
      expect(stats.totalBatches).toBe(1)
      expect(stats.pendingVPs).toBe(0)

      smallService.close()
      if (fs.existsSync(smallConfig.dbPath)) {
        fs.unlinkSync(smallConfig.dbPath)
      }
    })
  })

  describe('getPendingVPs', () => {
    it('should return empty array when no pending VPs', () => {
      const pending = service.getPendingVPs()
      expect(pending).toEqual([])
    })

    it('should return all pending VPs', () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')
      service.addVP('0x03', '0xccc')

      const pending = service.getPendingVPs()
      expect(pending).toHaveLength(3)
    })

    it('should return VPs in chronological order', () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')
      service.addVP('0x03', '0xccc')

      const pending = service.getPendingVPs()
      expect(pending[0].vpHash).toBe('0x01')
      expect(pending[1].vpHash).toBe('0x02')
      expect(pending[2].vpHash).toBe('0x03')
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 when no pending VPs', () => {
      expect(service.getPendingCount()).toBe(0)
    })

    it('should return correct count', () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')

      expect(service.getPendingCount()).toBe(2)
    })
  })

  describe('createBatch', () => {
    it('should return null when no pending VPs', async () => {
      const batch = await service.createBatch()
      expect(batch).toBeNull()
    })

    it('should create batch with pending VPs', async () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')

      const batch = await service.createBatch()

      expect(batch).toBeDefined()
      expect(batch!.batchId).toBe(1)
      expect(batch!.vpCount).toBe(2)
      expect(batch!.merkleRoot).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should clear pending VPs after batch creation', async () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')

      await service.createBatch()

      expect(service.getPendingCount()).toBe(0)
    })

    it('should create multiple batches', async () => {
      service.addVP('0x01', '0xaaa')
      await service.createBatch()

      service.addVP('0x02', '0xbbb')
      await service.createBatch()

      const stats = service.getStats()
      expect(stats.totalBatches).toBe(2)
    })

    it('should build correct Merkle tree', async () => {
      const vpHashes = ['0x01', '0x02', '0x03', '0x04']
      vpHashes.forEach(hash => service.addVP(hash, '0xaaa'))

      await service.createBatch()

      // Verify all VPs have proofs
      vpHashes.forEach(hash => {
        const proof = service.getMerkleProof(hash)
        expect(proof).toBeDefined()
        expect(proof!.batchId).toBe(1)
      })
    })
  })

  describe('Merkle Tree Construction', () => {
    it('should build tree with 1 leaf', async () => {
      service.addVP('0x01', '0xaaa')
      await service.createBatch()

      const proof = service.getMerkleProof('0x01')
      expect(proof).toBeDefined()
      expect(proof!.proof).toHaveLength(0) // Single leaf = no siblings
    })

    it('should build tree with 2 leaves', async () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')
      await service.createBatch()

      const proof0 = service.getMerkleProof('0x01')
      const proof1 = service.getMerkleProof('0x02')

      expect(proof0!.proof).toHaveLength(1) // 1 sibling
      expect(proof1!.proof).toHaveLength(1)
      expect(proof0!.root).toBe(proof1!.root) // Same root
    })

    it('should build tree with 4 leaves', async () => {
      for (let i = 0; i < 4; i++) {
        service.addVP(`0x0${i}`, '0xaaa')
      }
      await service.createBatch()

      const proof = service.getMerkleProof('0x00')
      expect(proof!.proof).toHaveLength(2) // 2 levels
    })

    it('should build tree with odd number of leaves', async () => {
      for (let i = 0; i < 3; i++) {
        service.addVP(`0x0${i}`, '0xaaa')
      }
      await service.createBatch()

      const proofs = ['0x00', '0x01', '0x02'].map(hash => service.getMerkleProof(hash))
      proofs.forEach(proof => {
        expect(proof).toBeDefined()
        expect(proof!.root).toBeDefined()
      })
    })

    it('should handle large batch', async () => {
      const count = 1000
      for (let i = 0; i < count; i++) {
        service.addVP(`0x${i.toString(16).padStart(4, '0')}`, '0xaaa')
      }

      // With maxBatchSize=100, should have auto-created 10 batches
      const stats = service.getStats()
      expect(stats.totalBatches).toBe(10)
      expect(stats.totalVPs).toBe(count)
      expect(stats.pendingVPs).toBe(0)
    })
  })

  describe('getMerkleProof', () => {
    beforeEach(async () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')
      await service.createBatch()
    })

    it('should return proof for valid VP', () => {
      const proof = service.getMerkleProof('0x01')

      expect(proof).toBeDefined()
      expect(proof!.vpHash).toBe('0x01')
      expect(proof!.batchId).toBe(1)
      expect(proof!.root).toBeDefined()
      expect(proof!.proof).toBeInstanceOf(Array)
      expect(proof!.index).toBeGreaterThanOrEqual(0)
    })

    it('should return null for non-existent VP', () => {
      const proof = service.getMerkleProof('0x999')
      expect(proof).toBeNull()
    })

    it('should return null for pending VP', () => {
      service.addVP('0x03', '0xccc') // Not batched yet
      const proof = service.getMerkleProof('0x03')
      expect(proof).toBeNull()
    })

    it('should return different proofs for different VPs', () => {
      const proof1 = service.getMerkleProof('0x01')
      const proof2 = service.getMerkleProof('0x02')

      expect(proof1!.index).not.toBe(proof2!.index)
      // Proofs may differ depending on position in tree
    })

    it('should return proofs from different batches', async () => {
      service.addVP('0x03', '0xccc')
      await service.createBatch()

      const proof1 = service.getMerkleProof('0x01')
      const proof3 = service.getMerkleProof('0x03')

      expect(proof1!.batchId).toBe(1)
      expect(proof3!.batchId).toBe(2)
      expect(proof1!.root).not.toBe(proof3!.root)
    })
  })

  describe('getBatch', () => {
    it('should return null for non-existent batch', () => {
      const batch = service.getBatch(999)
      expect(batch).toBeNull()
    })

    it('should return batch by ID', async () => {
      service.addVP('0x01', '0xaaa')
      await service.createBatch()

      const batch = service.getBatch(1)

      expect(batch).toBeDefined()
      expect(batch!.batchId).toBe(1)
      expect(batch!.merkleRoot).toBeDefined()
      expect(batch!.vpCount).toBe(1)
      expect(batch!.timestamp).toBeGreaterThan(0)
    })

    it('should return different batches', async () => {
      service.addVP('0x01', '0xaaa')
      await service.createBatch()

      service.addVP('0x02', '0xbbb')
      await service.createBatch()

      const batch1 = service.getBatch(1)
      const batch2 = service.getBatch(2)

      expect(batch1!.batchId).toBe(1)
      expect(batch2!.batchId).toBe(2)
      expect(batch1!.merkleRoot).not.toBe(batch2!.merkleRoot)
    })
  })

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats()

      expect(stats.totalBatches).toBe(0)
      expect(stats.totalVPs).toBe(0)
      expect(stats.pendingVPs).toBe(0)
      expect(stats.lastBatchTimestamp).toBe(0)
      expect(stats.averageVPsPerBatch).toBe(0)
    })

    it('should update stats after adding VPs', () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')

      const stats = service.getStats()
      expect(stats.pendingVPs).toBe(2)
    })

    it('should update stats after batch creation', async () => {
      service.addVP('0x01', '0xaaa')
      service.addVP('0x02', '0xbbb')
      await service.createBatch()

      const stats = service.getStats()
      expect(stats.totalBatches).toBe(1)
      expect(stats.totalVPs).toBe(2)
      expect(stats.pendingVPs).toBe(0)
      expect(stats.lastBatchTimestamp).toBeGreaterThan(0)
      expect(stats.averageVPsPerBatch).toBe(2)
    })

    it('should calculate correct average', async () => {
      service.addVP('0x01', '0xaaa')
      await service.createBatch()

      service.addVP('0x02', '0xbbb')
      service.addVP('0x03', '0xccc')
      service.addVP('0x04', '0xddd')
      await service.createBatch()

      const stats = service.getStats()
      expect(stats.averageVPsPerBatch).toBe(2) // (1 + 3) / 2 = 2
    })
  })

  describe('Timer-based batching', () => {
    it('should create batch after interval', async () => {
      const timerConfig: BatchServiceConfig = {
        maxBatchSize: 1000,
        batchIntervalMs: 100, // 100ms
        dbPath: dbPath.replace('.sqlite', '-timer.sqlite')
      }

      const timerService = new BatchService(timerConfig)

      timerService.addVP('0x01', '0xaaa')

      // Wait for timer to trigger
      await new Promise(resolve => setTimeout(resolve, 150))

      const stats = timerService.getStats()
      expect(stats.totalBatches).toBe(1)

      timerService.close()
      if (fs.existsSync(timerConfig.dbPath)) {
        fs.unlinkSync(timerConfig.dbPath)
      }
    }, 10000)

    it('should not create empty batches', async () => {
      const timerConfig: BatchServiceConfig = {
        maxBatchSize: 1000,
        batchIntervalMs: 100,
        dbPath: dbPath.replace('.sqlite', '-empty.sqlite')
      }

      const timerService = new BatchService(timerConfig)

      // Wait for timer
      await new Promise(resolve => setTimeout(resolve, 150))

      const stats = timerService.getStats()
      expect(stats.totalBatches).toBe(0) // No VPs, no batch

      timerService.close()
      if (fs.existsSync(timerConfig.dbPath)) {
        fs.unlinkSync(timerConfig.dbPath)
      }
    }, 10000)
  })

  describe('Error Handling', () => {
    it('should handle invalid VP hash gracefully', () => {
      expect(() => {
        service.addVP('', '0xaaa')
      }).not.toThrow()
    })

    it('should handle invalid holder address gracefully', () => {
      expect(() => {
        service.addVP('0x01', '')
      }).not.toThrow()
    })

    it('should throw error when building empty Merkle tree', () => {
      const buildTree = (service as any).buildMerkleTree.bind(service)
      expect(() => buildTree([])).toThrow('Cannot build Merkle tree with no leaves')
    })

    it('should throw error for invalid leaf index in proof generation', () => {
      const generateProof = (service as any).generateProof.bind(service)
      const leaves = ['0x01', '0x02']

      expect(() => generateProof(leaves, -1)).toThrow('Invalid leaf index')
      expect(() => generateProof(leaves, 10)).toThrow('Invalid leaf index')
    })
  })

  describe('Cleanup', () => {
    it('should stop timer on close', () => {
      service.close()
      expect((service as any).batchTimer).toBeNull()
    })

    it('should close database connection', () => {
      service.close()
      expect(() => service.getStats()).toThrow()
    })

    it('should be safe to call close multiple times', () => {
      expect(() => {
        service.close()
        service.close()
      }).not.toThrow()
    })
  })
})
