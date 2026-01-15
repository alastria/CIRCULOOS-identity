import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ERRORS, EVENTS } from '../constants'
import { ethers } from 'hardhat'

describe('OwnershipFacet', function () {
  async function deployFixture() {
    return deployDiamondFixture()
  }

  describe('transferOwnership', function () {
    it('Should transfer ownership to new owner', async function () {
      const { ownership, contractOwner, user1 } = await loadFixture(deployFixture)

      await expect(ownership.connect(contractOwner).transferOwnership(user1.address))
        .to.emit(ownership, EVENTS.OWNERSHIP_TRANSFERRED)
        .withArgs(contractOwner.address, user1.address)

      expect(await ownership.owner()).to.equal(user1.address)
    })

    it('Should prevent non-owners from transferring ownership', async function () {
      const { ownership, user1, user2 } = await loadFixture(deployFixture)

      await expect(ownership.connect(user1).transferOwnership(user2.address))
        .to.be.revertedWith(ERRORS.NOT_OWNER)
    })
  })

  describe('owner', function () {
    it('Should return the correct owner', async function () {
      const { ownership, contractOwner } = await loadFixture(deployFixture)
      expect(await ownership.owner()).to.equal(contractOwner.address)
    })
  })
})

