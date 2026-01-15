import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { FacetCutAction, getSelectors } from '../utils/diamond'
import { deployDiamondFixture } from '../fixtures/deployDiamond'

describe('AttestationBatchFacet', function () {
  /**
   * Deploy Diamond with AttestationBatchFacet
   */
  async function deployFixture() {
    const base = await deployDiamondFixture()

    // Deploy AttestationBatchFacet
    const AttestationBatchFacet = await ethers.getContractFactory('AttestationBatchFacet')
    const attestationBatchFacet = await AttestationBatchFacet.deploy()
    await attestationBatchFacet.deployed()

    // Add facet to diamond
    const cut = [{
      facetAddress: attestationBatchFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(attestationBatchFacet)
    }]

    await base.diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x')

    // Get contract instance connected to diamond
    const attestationBatch = await ethers.getContractAt('AttestationBatchFacet', base.diamondAddress)

    return {
      ...base,
      attestationBatch
    }
  }

  describe('Deployment', function () {
    it('Should have AttestationBatchFacet added to diamond', async function () {
      const { loupe, attestationBatch } = await loadFixture(deployFixture)
      const facets = await loupe.facets()

      const selectors = getSelectors(attestationBatch)
      const attestationFacet = facets.find((f: any) =>
        selectors.some((s: string) => f.functionSelectors.includes(s))
      )

      expect(attestationFacet).to.not.be.undefined
    })
  })

  describe('Authorization Management', function () {
    it('Should allow owner to add attester', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const isAuthorized = await attestationBatch.isAuthorizedAttester(user1.address)
      expect(isAuthorized).to.be.true
    })

    it('Should allow owner to remove attester', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      // Add first
      await attestationBatch.connect(contractOwner).addAttester(user1.address)
      expect(await attestationBatch.isAuthorizedAttester(user1.address)).to.be.true

      // Remove
      await attestationBatch.connect(contractOwner).removeAttester(user1.address)
      expect(await attestationBatch.isAuthorizedAttester(user1.address)).to.be.false
    })

    it('Should revert when non-owner tries to add attester', async function () {
      const { attestationBatch, user1, user2 } = await loadFixture(deployFixture)

      await expect(
        attestationBatch.connect(user1).addAttester(user2.address)
      ).to.be.reverted
    })

    it('Should revert when non-owner tries to remove attester', async function () {
      const { attestationBatch, user1, user2, contractOwner } = await loadFixture(deployFixture)

      // Add as owner first
      await attestationBatch.connect(contractOwner).addAttester(user2.address)

      // Try to remove as non-owner
      await expect(
        attestationBatch.connect(user1).removeAttester(user2.address)
      ).to.be.reverted
    })
  })

  describe('submitBatch', function () {
    it('Should allow authorized attester to submit batch', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      // Authorize attester
      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const merkleRoot = ethers.utils.id('test-merkle-root')
      const vpCount = 100
      const ipfsCid = 'QmTest123'

      await expect(attestationBatch.connect(user1).submitBatch(merkleRoot, vpCount, ipfsCid))
        .to.emit(attestationBatch, 'BatchAttested')
        // Don't check exact timestamp, just check other params

      const batch = await attestationBatch.getBatch(1)
      expect(batch.merkleRoot).to.equal(merkleRoot)
      expect(batch.vpCount).to.equal(vpCount)
    })

    it('Should increment batch ID for each batch', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const merkleRoot1 = ethers.utils.id('root-1')
      const merkleRoot2 = ethers.utils.id('root-2')

      await attestationBatch.connect(user1).submitBatch(merkleRoot1, 50, 'ipfs1')
      await attestationBatch.connect(user1).submitBatch(merkleRoot2, 100, 'ipfs2')

      expect(await attestationBatch.getBatchCount()).to.equal(2)
    })

    it('Should revert when unauthorized attester tries to submit', async function () {
      const { attestationBatch, user1 } = await loadFixture(deployFixture)

      const merkleRoot = ethers.utils.id('test-root')

      await expect(
        attestationBatch.connect(user1).submitBatch(merkleRoot, 50, 'ipfs')
      ).to.be.reverted
    })

    it('Should revert with zero merkle root', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      await expect(
        attestationBatch.connect(user1).submitBatch(ethers.constants.HashZero, 50, 'ipfs')
      ).to.be.reverted
    })

    it('Should revert with zero VP count', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const merkleRoot = ethers.utils.id('test-root')

      await expect(
        attestationBatch.connect(user1).submitBatch(merkleRoot, 0, 'ipfs')
      ).to.be.reverted
    })

    it('Should store batch with correct data', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const merkleRoot = ethers.utils.id('test-root')
      const vpCount = 250
      const ipfsCid = 'QmTestCID123'

      await attestationBatch.connect(user1).submitBatch(merkleRoot, vpCount, ipfsCid)

      const batch = await attestationBatch.getBatch(1)
      expect(batch.merkleRoot).to.equal(merkleRoot)
      expect(batch.vpCount).to.equal(vpCount)
      expect(batch.ipfsCid).to.equal(ipfsCid)
      expect(batch.timestamp).to.be.gt(0)
    })
  })

  describe('Merkle Proof Verification', function () {
    it('Should verify valid Merkle proof (2 leaves)', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      // Build Merkle tree with 2 leaves
      const leaf0 = ethers.utils.id('vp-0')
      const leaf1 = ethers.utils.id('vp-1')
      const root = ethers.utils.keccak256(ethers.utils.concat([leaf0, leaf1]))

      await attestationBatch.connect(user1).submitBatch(root, 2, '')

      // Verify leaf0 (index 0)
      const proof0 = [leaf1] // Sibling
      const valid0 = await attestationBatch.verifyInclusion(1, leaf0, proof0, 0)
      expect(valid0).to.be.true

      // Verify leaf1 (index 1)
      const proof1 = [leaf0] // Sibling
      const valid1 = await attestationBatch.verifyInclusion(1, leaf1, proof1, 1)
      expect(valid1).to.be.true
    })

    it('Should verify valid Merkle proof (4 leaves)', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      // Build Merkle tree with 4 leaves
      const leaves = [
        ethers.utils.id('vp-0'),
        ethers.utils.id('vp-1'),
        ethers.utils.id('vp-2'),
        ethers.utils.id('vp-3')
      ]

      const node0 = ethers.utils.keccak256(ethers.utils.concat([leaves[0], leaves[1]]))
      const node1 = ethers.utils.keccak256(ethers.utils.concat([leaves[2], leaves[3]]))
      const root = ethers.utils.keccak256(ethers.utils.concat([node0, node1]))

      await attestationBatch.connect(user1).submitBatch(root, 4, '')

      // Verify leaf0 (index 0: binary 00)
      const proof0 = [leaves[1], node1]
      const valid0 = await attestationBatch.verifyInclusion(1, leaves[0], proof0, 0)
      expect(valid0).to.be.true

      // Verify leaf2 (index 2: binary 10)
      const proof2 = [leaves[3], node0]
      const valid2 = await attestationBatch.verifyInclusion(1, leaves[2], proof2, 2)
      expect(valid2).to.be.true
    })

    it('Should reject invalid Merkle proof', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const leaf0 = ethers.utils.id('vp-0')
      const leaf1 = ethers.utils.id('vp-1')
      const root = ethers.utils.keccak256(ethers.utils.concat([leaf0, leaf1]))

      await attestationBatch.connect(user1).submitBatch(root, 2, '')

      // Wrong proof
      const wrongLeaf = ethers.utils.id('vp-wrong')
      const valid = await attestationBatch.verifyInclusion(1, leaf0, [wrongLeaf], 0)
      expect(valid).to.be.false
    })

    it('Should revert when verifying non-existent batch', async function () {
      const { attestationBatch } = await loadFixture(deployFixture)

      const leaf = ethers.utils.id('vp-0')

      await expect(
        attestationBatch.verifyInclusion(999, leaf, [], 0)
      ).to.be.reverted
    })

    it('Should emit event when verifying and attesting', async function () {
      const { attestationBatch, user1, user2, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const leaf0 = ethers.utils.id('vp-0')
      const leaf1 = ethers.utils.id('vp-1')
      const root = ethers.utils.keccak256(ethers.utils.concat([leaf0, leaf1]))

      await attestationBatch.connect(user1).submitBatch(root, 2, '')

      // Use verifyAndAttest instead of verifyInclusion
      await expect(attestationBatch.connect(user2).verifyAndAttest(1, leaf0, [leaf1], 0))
        .to.emit(attestationBatch, 'VPVerifiedOnChain')
        .withArgs(leaf0, 1, user2.address)
    })
  })

  describe('Batch Queries', function () {
    it('Should return correct batch count', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      expect(await attestationBatch.getBatchCount()).to.equal(0)

      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root1'), 10, '')
      expect(await attestationBatch.getBatchCount()).to.equal(1)

      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root2'), 20, '')
      expect(await attestationBatch.getBatchCount()).to.equal(2)
    })

    it('Should return batch by ID', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const root = ethers.utils.id('test-root')
      await attestationBatch.connect(user1).submitBatch(root, 100, 'ipfs123')

      const batch = await attestationBatch.getBatch(1)
      expect(batch.merkleRoot).to.equal(root)
      expect(batch.vpCount).to.equal(100)
      expect(batch.ipfsCid).to.equal('ipfs123')
    })

    it('Should revert when getting non-existent batch', async function () {
      const { attestationBatch } = await loadFixture(deployFixture)

      await expect(
        attestationBatch.getBatch(999)
      ).to.be.reverted
    })

    it('Should revert when getting batch with ID 0', async function () {
      const { attestationBatch } = await loadFixture(deployFixture)

      await expect(
        attestationBatch.getBatch(0)
      ).to.be.reverted
    })

    it('Should return batches in range', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      // Create 5 batches
      for (let i = 1; i <= 5; i++) {
        await attestationBatch.connect(user1).submitBatch(ethers.utils.id(`root-${i}`), i * 10, `ipfs${i}`)
      }

      // Get batches 2-4
      const batches = await attestationBatch.getBatches(2, 4)
      expect(batches.length).to.equal(3)
      expect(batches[0].vpCount).to.equal(20)
      expect(batches[1].vpCount).to.equal(30)
      expect(batches[2].vpCount).to.equal(40)
    })

    it('Should handle range beyond batch count', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root1'), 10, '')
      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root2'), 20, '')

      // Request beyond count (should cap at 2)
      const batches = await attestationBatch.getBatches(1, 10)
      expect(batches.length).to.equal(2)
    })

    it('Should revert when start ID is 0', async function () {
      const { attestationBatch } = await loadFixture(deployFixture)

      await expect(
        attestationBatch.getBatches(0, 5)
      ).to.be.reverted
    })

    it('Should revert when start ID exceeds count', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)
      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root'), 10, '')

      await expect(
        attestationBatch.getBatches(5, 10)
      ).to.be.reverted
    })

    it('Should revert when end ID is less than start ID', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)
      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root'), 10, '')

      await expect(
        attestationBatch.getBatches(5, 3)
      ).to.be.reverted
    })
  })

  describe('Edge Cases', function () {
    it('Should handle empty IPFS CID', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root'), 10, '')

      const batch = await attestationBatch.getBatch(1)
      expect(batch.ipfsCid).to.equal('')
    })

    it('Should handle large VP counts', async function () {
      const { attestationBatch, user1, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)

      const largeCount = 10000
      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root'), largeCount, '')

      const batch = await attestationBatch.getBatch(1)
      expect(batch.vpCount).to.equal(largeCount)
    })

    it('Should handle multiple attesters', async function () {
      const { attestationBatch, user1, user2, contractOwner } = await loadFixture(deployFixture)

      await attestationBatch.connect(contractOwner).addAttester(user1.address)
      await attestationBatch.connect(contractOwner).addAttester(user2.address)

      await attestationBatch.connect(user1).submitBatch(ethers.utils.id('root1'), 10, '')
      await attestationBatch.connect(user2).submitBatch(ethers.utils.id('root2'), 20, '')

      expect(await attestationBatch.getBatchCount()).to.equal(2)
    })
  })
})
