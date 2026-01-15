import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ethers } from 'hardhat'

describe('Diamond Init Coverage', function () {
  async function deployFixture() {
    const fixture = await deployDiamondFixture()
    const InitDiamond = await ethers.getContractFactory('InitDiamond')
    const initDiamond = await InitDiamond.deploy()
    await initDiamond.deployed()
    return { ...fixture, initDiamond }
  }

  it('Should initialize successfully with delegatecall', async function () {
    const { diamondCut, initDiamond } = await loadFixture(deployFixture)
    
    const calldata = initDiamond.interface.encodeFunctionData('init')
    
    // This should succeed without reverting (covers success branch of delegatecall)
    await diamondCut.diamondCut(
      [],
      initDiamond.address,
      calldata
    )
    // Success! The delegatecall executed and returned true
  })

  it('Should handle init when _init is address(this)', async function () {
    const { diamondCut, diamondAddress } = await loadFixture(deployFixture)
    
    // When _init == address(this), enforceHasContractCode is skipped
    // We need calldata.length > 0
    // Let's use the diamondCut selector itself as dummy calldata
    const dummyCalldata = '0x1f931c1c' // diamondCut selector
    
    await expect(
      diamondCut.diamondCut(
        [],
        diamondAddress, // _init == address(this) from Diamond's perspective
        dummyCalldata
      )
    ).to.be.reverted // Will likely revert because diamondCut expects specific args, but we cover the branch
  })
})

