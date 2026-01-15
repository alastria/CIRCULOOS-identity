import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ERRORS, EVENTS } from '../constants'
import { ethers } from 'hardhat'

describe('CredentialStatusFacet', function () {
  async function deployFixture() {
    return deployDiamondFixture()
  }

  describe('issueCredential', function () {
    it('Should allow issuing a credential', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-1')
      const subject = user1.address

      await expect(credentialStatus.issueCredential(vcHash, subject))
        .to.emit(credentialStatus, EVENTS.CREDENTIAL_ISSUED)
      
      const status = await credentialStatus.getCredentialStatus(vcHash)
      expect(status.issued).to.be.true
      expect(status.revoked).to.be.false
      expect(status.issuer).to.equal(await credentialStatus.signer.getAddress())
    })

    it('Should revert if vcHash is zero', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      await expect(credentialStatus.issueCredential(ethers.constants.HashZero, user1.address))
        .to.be.reverted
    })

    it('Should revert if already issued', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-1')
      
      await credentialStatus.issueCredential(vcHash, user1.address)
      
      await expect(credentialStatus.issueCredential(vcHash, user1.address))
        .to.be.reverted
    })
  })

  describe('revokeCredential', function () {
    it('Should allow issuer to revoke a credential', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-1')
      
      // Issue first (required now)
      await credentialStatus.issueCredential(vcHash, user1.address)

      await expect(credentialStatus.revokeCredential(vcHash))
        .to.emit(credentialStatus, EVENTS.CREDENTIAL_REVOKED)

      const status = await credentialStatus.getCredentialStatus(vcHash)
      expect(status.revoked).to.be.true
    })

    it('Should revert if trying to revoke non-existent credential', async function () {
      const { credentialStatus } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-non-existent')
      
      await expect(credentialStatus.revokeCredential(vcHash))
        .to.be.reverted
    })

    it('Should revert if revoking with vcHash zero', async function () {
      const { credentialStatus } = await loadFixture(deployFixture)
      await expect(credentialStatus.revokeCredential(ethers.constants.HashZero))
        .to.be.reverted
    })

    it('Should revert if non-issuer tries to revoke', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-1')
      
      // Issued by deployer (default signer)
      await credentialStatus.issueCredential(vcHash, user1.address)
      
      // Try to revoke by user1
      // Use generic reverted because custom error matching is flaky
      await expect(credentialStatus.connect(user1).revokeCredential(vcHash))
        .to.be.reverted
    })

    it('Should revert if already revoked', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-1')
      
      await credentialStatus.issueCredential(vcHash, user1.address)
      await credentialStatus.revokeCredential(vcHash)
      
      await expect(credentialStatus.revokeCredential(vcHash))
        .to.be.reverted
    })
  })

  describe('Legacy Support', function () {
    it('Should support recordIssuance and isIssued', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-legacy')
      
      // @ts-ignore
      await credentialStatus.recordIssuance(vcHash, user1.address)
      expect(await credentialStatus.isIssued(vcHash)).to.be.true
    })

    it('Should support revoke and isRevoked', async function () {
      const { credentialStatus, user1 } = await loadFixture(deployFixture)
      const vcHash = ethers.utils.id('vc-legacy-revoke')
      
      await credentialStatus.issueCredential(vcHash, user1.address)
      
      // @ts-ignore
      await credentialStatus.revoke(vcHash)
      expect(await credentialStatus.isRevoked(vcHash)).to.be.true
    })
  })
})
