import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestServer } from '../helpers/test-server'
import path from 'path'
import fs from 'fs'
import { Wallet } from 'ethers'
import { signVP } from '../helpers/vp-helpers'

describe('VP Batch Integration', () => {
  let server: any
  let dbPath: string
  let wallet: Wallet

  beforeEach(async () => {
    // Create temp DB
    const tmpDir = path.join(process.cwd(), 'apps/verifier/tmp-test')
    fs.mkdirSync(tmpDir, { recursive: true })
    dbPath = path.join(tmpDir, `batch-integration-${Date.now()}.sqlite`)

    // Build test server with batching enabled
    server = await buildTestServer({
      batchService: {
        maxBatchSize: 10,
        batchIntervalMs: 60000,
        dbPath
      }
    })

    // Create test wallet
    wallet = Wallet.createRandom()
  })

  afterEach(async () => {
    await server.close()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  describe('Full Flow: Challenge -> VP Verification -> Batching -> Proof', () => {
    it('should complete full workflow', async () => {
      // Step 1: Generate challenge
      const challengeResponse = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: {
          holderAddress: wallet.address
        }
      })

      expect(challengeResponse.statusCode).toBe(200)
      const { challenge, expiresAt } = JSON.parse(challengeResponse.payload)
      expect(challenge).toBeDefined()
      expect(expiresAt).toBeGreaterThan(Date.now())

      // Step 2: Create and sign VP with challenge
      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 3600000).toISOString()
      }

      const signedVP = await signVP(vp, wallet, challenge)

      // Step 3: Verify VP (should add to batch queue)
      const verifyResponse = await server.inject({
        method: 'POST',
        url: '/verify-vp',
        payload: signedVP
      })

      expect(verifyResponse.statusCode).toBe(200)
      const verifyResult = JSON.parse(verifyResponse.payload)
      expect(verifyResult.ok).toBe(true)

      // Step 4: Check batch stats (should have 1 pending VP)
      const statsResponse = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/stats'
      })

      expect(statsResponse.statusCode).toBe(200)
      const stats = JSON.parse(statsResponse.payload)
      expect(stats.pendingVPs).toBe(1)
      expect(stats.totalBatches).toBe(0) // Not yet batched

      // Step 5: Trigger batch manually (add 9 more VPs to reach threshold)
      for (let i = 0; i < 9; i++) {
        const dummyChallenge = await server.inject({
          method: 'POST',
          url: '/marketplace/auth/challenge',
          payload: { holderAddress: wallet.address }
        })

        const { challenge: dummyCh } = JSON.parse(dummyChallenge.payload)
        const dummySignedVP = await signVP(vp, wallet, dummyCh)

        await server.inject({
          method: 'POST',
          url: '/verify-vp',
          payload: dummySignedVP
        })
      }

      // Wait for batch creation
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 6: Check stats again (should have batch created)
      const stats2Response = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/stats'
      })

      const stats2 = JSON.parse(stats2Response.payload)
      expect(stats2.totalBatches).toBe(1)
      expect(stats2.totalVPs).toBe(10)
      expect(stats2.pendingVPs).toBe(0)

      // Step 7: Get Merkle proof for the VP
      const vpHash = calculateVPHash(signedVP)
      const proofResponse = await server.inject({
        method: 'GET',
        url: `/marketplace/auth/proof/${vpHash}`
      })

      expect(proofResponse.statusCode).toBe(200)
      const proof = JSON.parse(proofResponse.payload)
      expect(proof.vpHash).toBe(vpHash)
      expect(proof.batchId).toBe(1)
      expect(proof.merkleRoot).toBeDefined()
      expect(proof.proof).toBeInstanceOf(Array)
      expect(proof.index).toBeGreaterThanOrEqual(0)

      // Step 8: Get batch info
      const batchResponse = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/1'
      })

      expect(batchResponse.statusCode).toBe(200)
      const batch = JSON.parse(batchResponse.payload)
      expect(batch.batchId).toBe(1)
      expect(batch.vpCount).toBe(10)
      expect(batch.merkleRoot).toBe(proof.merkleRoot)
    })
  })

  describe('Challenge Endpoint', () => {
    it('should generate challenge for holder', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: {
          holderAddress: wallet.address
        }
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.challenge).toMatch(/^[a-f0-9]{64}$/)
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should return 400 for missing holderAddress', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Batch Stats Endpoint', () => {
    it('should return initial stats', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/stats'
      })

      expect(response.statusCode).toBe(200)
      const stats = JSON.parse(response.payload)
      expect(stats.totalBatches).toBe(0)
      expect(stats.totalVPs).toBe(0)
      expect(stats.pendingVPs).toBe(0)
    })

    it('should update stats after VP verification', async () => {
      // Generate and verify VP
      const challengeResp = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: { holderAddress: wallet.address }
      })

      const { challenge } = JSON.parse(challengeResp.payload)

      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 3600000).toISOString()
      }

      const signedVP = await signVP(vp, wallet, challenge)

      await server.inject({
        method: 'POST',
        url: '/verify-vp',
        payload: signedVP
      })

      // Check stats
      const statsResp = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/stats'
      })

      const stats = JSON.parse(statsResp.payload)
      expect(stats.pendingVPs).toBe(1)
    })
  })

  describe('Merkle Proof Endpoint', () => {
    it('should return 404 for non-existent VP', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/marketplace/auth/proof/0x123456'
      })

      expect(response.statusCode).toBe(404)
      const result = JSON.parse(response.payload)
      expect(result.error).toBeDefined()
    })

    it('should return proof for batched VP', async () => {
      // Create and batch a VP
      const challengeResp = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: { holderAddress: wallet.address }
      })

      const { challenge } = JSON.parse(challengeResp.payload)

      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 3600000).toISOString()
      }

      const signedVP = await signVP(vp, wallet, challenge)

      await server.inject({
        method: 'POST',
        url: '/verify-vp',
        payload: signedVP
      })

      // Add more VPs to trigger batch
      for (let i = 0; i < 9; i++) {
        const ch = await server.inject({
          method: 'POST',
          url: '/marketplace/auth/challenge',
          payload: { holderAddress: wallet.address }
        })
        const { challenge: ch2 } = JSON.parse(ch.payload)
        const svp = await signVP(vp, wallet, ch2)
        await server.inject({
          method: 'POST',
          url: '/verify-vp',
          payload: svp
        })
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Get proof
      const vpHash = calculateVPHash(signedVP)
      const proofResp = await server.inject({
        method: 'GET',
        url: `/marketplace/auth/proof/${vpHash}`
      })

      expect(proofResp.statusCode).toBe(200)
      const proof = JSON.parse(proofResp.payload)
      expect(proof.vpHash).toBe(vpHash)
      expect(proof.batchId).toBe(1)
    })
  })

  describe('Batch Info Endpoint', () => {
    it('should return 404 for non-existent batch', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/999'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return batch info', async () => {
      // Create a batch first (add 10 VPs)
      for (let i = 0; i < 10; i++) {
        const ch = await server.inject({
          method: 'POST',
          url: '/marketplace/auth/challenge',
          payload: { holderAddress: wallet.address }
        })

        const { challenge } = JSON.parse(ch.payload)

        const vp = {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          holder: wallet.address,
          verifiableCredential: [],
          issuanceDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 3600000).toISOString()
        }

        const signedVP = await signVP(vp, wallet, challenge)
        await server.inject({
          method: 'POST',
          url: '/verify-vp',
          payload: signedVP
        })
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Get batch info
      const response = await server.inject({
        method: 'GET',
        url: '/marketplace/batch/1'
      })

      expect(response.statusCode).toBe(200)
      const batch = JSON.parse(response.payload)
      expect(batch.batchId).toBe(1)
      expect(batch.vpCount).toBe(10)
      expect(batch.merkleRoot).toMatch(/^0x[a-f0-9]{64}$/)
      expect(batch.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle batch service unavailable', async () => {
      // Build server without batch service
      const serverNoBatch = await buildTestServer({
        batchService: null
      })

      const response = await serverNoBatch.inject({
        method: 'GET',
        url: '/marketplace/batch/stats'
      })

      expect(response.statusCode).toBe(503)

      await serverNoBatch.close()
    })

    it('should not fail VP verification if batching fails', async () => {
      // This tests that batching errors don't block verification
      const challengeResp = await server.inject({
        method: 'POST',
        url: '/marketplace/auth/challenge',
        payload: { holderAddress: wallet.address }
      })

      const { challenge } = JSON.parse(challengeResp.payload)

      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: wallet.address,
        verifiableCredential: [],
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 3600000).toISOString()
      }

      const signedVP = await signVP(vp, wallet, challenge)

      // Close batch service to simulate failure
      if (server.batchService) {
        server.batchService.close()
      }

      // Verification should still succeed
      const verifyResp = await server.inject({
        method: 'POST',
        url: '/verify-vp',
        payload: signedVP
      })

      expect(verifyResp.statusCode).toBe(200)
      const result = JSON.parse(verifyResp.payload)
      expect(result.ok).toBe(true)
    })
  })
})

// Helper function to calculate VP hash (same as in vp.ts)
function calculateVPHash(signedVP: any): string {
  const { utils } = require('ethers')
  const vpData = JSON.stringify({
    presentation: signedVP.presentation,
    signer: signedVP.signer,
    signature: signedVP.signature
  })
  return utils.keccak256(utils.toUtf8Bytes(vpData))
}
