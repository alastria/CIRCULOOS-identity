import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { FacetCutAction, getSelectors } from '../utils/diamond'

/**
 * PausableFacet (plan A4, gap G3): an emergency brake for the credential status registry.
 * Pausing blocks every credential status write (record, revoke, suspend); it does NOT block
 * trusted issuer management, so the owner can still remove a compromised key while paused.
 * Cut into an existing Diamond, the same way it would be added to an already deployed one.
 */
describe('PausableFacet', function () {
  async function deployFixture() {
    const fixture = await deployDiamondFixture()
    const Pausable = await ethers.getContractFactory('PausableFacet')
    const facet = await Pausable.deploy()
    await facet.deployed()
    const diamondCut = await ethers.getContractAt('IDiamondCut', fixture.diamondAddress)
    await diamondCut.diamondCut(
      [{ facetAddress: facet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(facet) }],
      ethers.constants.AddressZero,
      '0x'
    )
    const pausable = await ethers.getContractAt('PausableFacet', fixture.diamondAddress)
    await fixture.trustedIssuer.addTrustedIssuer(fixture.contractOwner.address)
    return { ...fixture, pausable }
  }

  /** The chai matchers in use lack revertedWithCustomError: read the custom error ethers decodes. */
  async function expectCustomError(call: Promise<unknown>, name: string) {
    try {
      await call
    } catch (err: any) {
      expect(err.errorName, err.message).to.equal(name)
      return
    }
    expect.fail(`expected revert with ${name}`)
  }

  it('starts unpaused; the owner is a pauser', async function () {
    const { pausable, contractOwner } = await loadFixture(deployFixture)
    expect(await pausable.paused()).to.be.false
    expect(await pausable.isPauser(contractOwner.address)).to.be.true
  })

  it('the owner pauses: recording, revoking and suspending credentials revert with EnforcedPause', async function () {
    const { pausable, credentialStatus, user1 } = await loadFixture(deployFixture)
    const recorded = ethers.utils.id('vc-recorded-before-pause')
    await credentialStatus.issueCredential(recorded, user1.address)

    await expect(pausable.pause()).to.emit(pausable, 'Paused')
    expect(await pausable.paused()).to.be.true

    await expectCustomError(credentialStatus.callStatic.issueCredential(ethers.utils.id('vc-new'), user1.address), 'EnforcedPause')
    await expectCustomError(credentialStatus.callStatic.recordIssuance(ethers.utils.id('vc-new'), user1.address), 'EnforcedPause')
    await expectCustomError(credentialStatus.callStatic.revokeCredential(recorded), 'EnforcedPause')
    await expectCustomError(credentialStatus.callStatic.revoke(recorded), 'EnforcedPause')
    await expectCustomError(credentialStatus.callStatic.batchRevokeCredential([recorded]), 'EnforcedPause')
    await expectCustomError(credentialStatus.callStatic.updateCredentialStatus(recorded, true), 'EnforcedPause')
  })

  it('reads keep working while paused', async function () {
    const { pausable, credentialStatus, user1 } = await loadFixture(deployFixture)
    const recorded = ethers.utils.id('vc-read-while-paused')
    await credentialStatus.issueCredential(recorded, user1.address)
    await pausable.pause()

    expect(await credentialStatus.isIssued(recorded)).to.be.true
    expect(await credentialStatus.isRevoked(recorded)).to.be.false
  })

  it('trusted issuer management still works while paused (to remove a compromised key)', async function () {
    const { pausable, trustedIssuer, user2 } = await loadFixture(deployFixture)
    await pausable.pause()

    await trustedIssuer.addTrustedIssuer(user2.address)
    expect(await trustedIssuer.isTrustedIssuer(user2.address)).to.be.true
    await trustedIssuer.removeTrustedIssuer(user2.address)
    expect(await trustedIssuer.isTrustedIssuer(user2.address)).to.be.false
  })

  it('unpausing restores writes', async function () {
    const { pausable, credentialStatus, user1 } = await loadFixture(deployFixture)
    await pausable.pause()
    await expect(pausable.unpause()).to.emit(pausable, 'Unpaused')

    await credentialStatus.issueCredential(ethers.utils.id('vc-after-unpause'), user1.address)
    expect(await credentialStatus.isIssued(ethers.utils.id('vc-after-unpause'))).to.be.true
  })

  it('pausing twice / unpausing when not paused revert clearly', async function () {
    const { pausable } = await loadFixture(deployFixture)
    await expectCustomError(pausable.callStatic.unpause(), 'NotPaused')
    await pausable.pause()
    await expectCustomError(pausable.callStatic.pause(), 'AlreadyPaused')
  })

  it('an account without the pauser role cannot pause or unpause', async function () {
    const { pausable, user1 } = await loadFixture(deployFixture)
    await expectCustomError(pausable.connect(user1).callStatic.pause(), 'NotPauser')
    await pausable.pause()
    await expectCustomError(pausable.connect(user1).callStatic.unpause(), 'NotPauser')
  })

  it('the owner grants and revokes the pauser role; a granted pauser can pause', async function () {
    const { pausable, user1 } = await loadFixture(deployFixture)
    await expect(pausable.grantPauserRole(user1.address)).to.emit(pausable, 'PauserGranted')
    expect(await pausable.isPauser(user1.address)).to.be.true
    await pausable.connect(user1).pause()
    expect(await pausable.paused()).to.be.true

    await expect(pausable.revokePauserRole(user1.address)).to.emit(pausable, 'PauserRevoked')
    expect(await pausable.isPauser(user1.address)).to.be.false
  })

  it('only the owner can grant or revoke the pauser role', async function () {
    const { pausable, user1, user2 } = await loadFixture(deployFixture)
    await expect(pausable.connect(user1).grantPauserRole(user2.address)).to.be.reverted
    await expect(pausable.connect(user1).revokePauserRole(user2.address)).to.be.reverted
  })

  it('a new owner becomes a pauser and the previous one stops being one (no stale role)', async function () {
    const { pausable, ownership, contractOwner, user3 } = await loadFixture(deployFixture)
    await ownership.transferOwnership(user3.address)
    expect(await pausable.isPauser(user3.address)).to.be.true
    expect(await pausable.isPauser(contractOwner.address)).to.be.false
  })
})
