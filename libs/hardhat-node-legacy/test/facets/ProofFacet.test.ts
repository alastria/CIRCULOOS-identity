import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ERRORS, EVENTS } from '../constants'
import { ethers } from 'hardhat'

describe('ProofFacet', function () {
  async function deployFixture() {
    return deployDiamondFixture()
  }

  describe('storeProof', function () {
    it('Should store a proof', async function () {
      const { proof } = await loadFixture(deployFixture)
      const cidHash = ethers.utils.id('QmTest...')
      const note = 'Test Proof'

      await expect(proof.storeProof(cidHash, note))
        .to.emit(proof, EVENTS.PROOF_STORED)

      const stored = await proof.getProof(1)
      expect(stored.cidHash).to.equal(cidHash)
      expect(stored.submitter).to.equal(await proof.signer.getAddress())
      expect(stored.note).to.equal(note)
    })

    it('Should increment proof IDs', async function () {
      const { proof } = await loadFixture(deployFixture)
      const cidHash = ethers.utils.id('QmTest...')
      
      await proof.storeProof(cidHash, 'Proof 1')
      await proof.storeProof(cidHash, 'Proof 2')
      
      const p1 = await proof.getProof(1)
      const p2 = await proof.getProof(2)
      
      expect(p1.note).to.equal('Proof 1')
      expect(p2.note).to.equal('Proof 2')
    })

    it('Should revert if cidHash is zero', async function () {
      const { proof } = await loadFixture(deployFixture)
      await expect(proof.storeProof(ethers.constants.HashZero, 'Note'))
        .to.be.reverted
    })
  })
})
