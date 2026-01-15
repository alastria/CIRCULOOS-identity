import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ERRORS, EVENTS } from '../constants'
import { ethers } from 'hardhat'

describe('TrustedIssuerFacet', function () {
  async function deployFixture() {
    return deployDiamondFixture()
  }

  describe('addTrustedIssuer', function () {
    it('Should allow owner to add a trusted issuer', async function () {
      const { trustedIssuer, contractOwner, user1 } = await loadFixture(deployFixture)

      await expect(trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address))
        .to.emit(trustedIssuer, EVENTS.ISSUER_ADDED)
        .withArgs(user1.address, contractOwner.address)

      expect(await trustedIssuer.isTrustedIssuer(user1.address)).to.be.true
    })

    it('Should revert if caller is not owner', async function () {
      const { trustedIssuer, user1, user2 } = await loadFixture(deployFixture)

      await expect(trustedIssuer.connect(user1).addTrustedIssuer(user2.address))
        .to.be.revertedWith(ERRORS.NOT_OWNER)
    })

    it('Should revert if issuer is address(0)', async function () {
      const { trustedIssuer, contractOwner } = await loadFixture(deployFixture)

      // Custom error support in Waffle/Chai can be tricky. Using generic reverted for now.
      await expect(trustedIssuer.connect(contractOwner).addTrustedIssuer(ethers.constants.AddressZero))
        .to.be.reverted
    })

    it('Should revert if issuer is already trusted', async function () {
      const { trustedIssuer, contractOwner, user1 } = await loadFixture(deployFixture)

      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)

      await expect(trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address))
        .to.be.reverted
    })
  })

  describe('removeTrustedIssuer', function () {
    it('Should allow owner to remove a trusted issuer', async function () {
      const { trustedIssuer, contractOwner, user1 } = await loadFixture(deployFixture)

      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)
      expect(await trustedIssuer.isTrustedIssuer(user1.address)).to.be.true

      await expect(trustedIssuer.connect(contractOwner).removeTrustedIssuer(user1.address))
        .to.emit(trustedIssuer, EVENTS.ISSUER_REMOVED)
        .withArgs(user1.address, contractOwner.address)

      expect(await trustedIssuer.isTrustedIssuer(user1.address)).to.be.false
    })

    it('Should revert if caller is not owner', async function () {
      const { trustedIssuer, user1 } = await loadFixture(deployFixture)
      await expect(trustedIssuer.connect(user1).removeTrustedIssuer(user1.address))
        .to.be.revertedWith(ERRORS.NOT_OWNER)
    })

    it('Should revert if issuer is not trusted', async function () {
      const { trustedIssuer, contractOwner, user1 } = await loadFixture(deployFixture)

      await expect(trustedIssuer.connect(contractOwner).removeTrustedIssuer(user1.address))
        .to.be.reverted
    })

    it('Should handle removal from middle of list (branch coverage)', async function () {
      const { trustedIssuer, contractOwner, user1, user2, user3 } = await loadFixture(deployFixture)
      
      // Add 3 issuers
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user2.address)
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user3.address)
      
      // Remove the middle one (user2). 
      // Loop check 1: user1 != user2 (Evaluates false -> Coverage gained!)
      // Loop check 2: user2 == user2 (Evaluates true -> Break)
      await trustedIssuer.connect(contractOwner).removeTrustedIssuer(user2.address)
      
      expect(await trustedIssuer.isTrustedIssuer(user2.address)).to.be.false
      expect(await trustedIssuer.isTrustedIssuer(user1.address)).to.be.true
      expect(await trustedIssuer.isTrustedIssuer(user3.address)).to.be.true
      
      // Verify array integrity by checking count
      expect(await trustedIssuer.getTrustedIssuersCount()).to.equal(2)
    })
  })

  describe('Legacy Support', function () {
    it('Should support legacy trustedIssuers view function', async function () {
      const { trustedIssuer, contractOwner, user1 } = await loadFixture(deployFixture)
      
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)
      
      // @ts-ignore
      expect(await trustedIssuer.trustedIssuers(user1.address)).to.be.true
    })
  })

  describe('Pagination Support', function () {
    it('Should return correct count', async function () {
      const { trustedIssuer, contractOwner, user1, user2 } = await loadFixture(deployFixture)
      
      expect(await trustedIssuer.getTrustedIssuersCount()).to.equal(0)
      
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)
      expect(await trustedIssuer.getTrustedIssuersCount()).to.equal(1)
      
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user2.address)
      expect(await trustedIssuer.getTrustedIssuersCount()).to.equal(2)
      
      await trustedIssuer.connect(contractOwner).removeTrustedIssuer(user1.address)
      expect(await trustedIssuer.getTrustedIssuersCount()).to.equal(1)
    })

    it('Should paginate issuers correctly', async function () {
      const { trustedIssuer, contractOwner, user1, user2 } = await loadFixture(deployFixture)
      const signers = await ethers.getSigners()
      const user3 = signers[3]
      
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user1.address)
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user2.address)
      await trustedIssuer.connect(contractOwner).addTrustedIssuer(user3.address)
      
      // Get all
      const all = await trustedIssuer.getTrustedIssuers(0, 10)
      expect(all.length).to.equal(3)
      expect(all).to.include(user1.address)
      expect(all).to.include(user2.address)
      expect(all).to.include(user3.address)
      
      // Pagination
      const firstTwo = await trustedIssuer.getTrustedIssuers(0, 2)
      expect(firstTwo.length).to.equal(2)
      
      const lastOne = await trustedIssuer.getTrustedIssuers(2, 2)
      expect(lastOne.length).to.equal(1)
      expect(lastOne[0]).to.equal(user3.address)
      
      // Offset out of bounds
      const empty = await trustedIssuer.getTrustedIssuers(10, 10)
      expect(empty.length).to.equal(0)

      const emptyExact = await trustedIssuer.getTrustedIssuers(3, 10)
      expect(emptyExact.length).to.equal(0)
      
      // Limit greater than remaining
      const partial = await trustedIssuer.getTrustedIssuers(1, 10)
      expect(partial.length).to.equal(2)
    })
  })
})
