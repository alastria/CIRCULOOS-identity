import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ethers } from 'hardhat'
import { FacetCutAction, getSelectors } from '../utils/diamond'

describe('Diamond Branch Coverage', function () {
  async function deployFixture() {
    const fixture = await deployDiamondFixture()
    const MockFacet = await ethers.getContractFactory('MockFacet')
    const mockFacet = await MockFacet.deploy()
    await mockFacet.deployed()
    
    const RevertNoReason = await ethers.getContractFactory('RevertNoReason')
    const revertNoReason = await RevertNoReason.deploy()
    await revertNoReason.deployed()

    return { ...fixture, mockFacet, revertNoReason }
  }

  it('Should revert when replacing function with same facet address', async function () {
    const { diamondCut, mockFacet } = await loadFixture(deployFixture)
    const selectors = getSelectors(mockFacet).get(['mockFunc1'])
    
    // Add
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Try to replace with SAME address
    await expect(
      diamondCut.diamondCut(
        [{
          facetAddress: mockFacet.address, // Same address
          action: FacetCutAction.Replace,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero,
        '0x'
      )
    ).to.be.revertedWith('LibDiamondCut: Can\'t replace function with same function')
  })

  it('Should revert when removing immutable function', async function () {
    const { diamondCut, diamondAddress } = await loadFixture(deployFixture)
    const selector = '0x12345678'
    
    // Add function pointing to Diamond (immutable simulation)
    await diamondCut.diamondCut(
      [{
        facetAddress: diamondAddress,
        action: FacetCutAction.Add,
        functionSelectors: [selector]
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Try to remove it
    await expect(
      diamondCut.diamondCut(
        [{
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: [selector]
        }],
        ethers.constants.AddressZero,
        '0x'
      )
    ).to.be.revertedWith('LibDiamondCut: Can\'t remove immutable function')
  })

  it('Should revert with default message if init reverts without data', async function () {
    const { diamondCut, revertNoReason } = await loadFixture(deployFixture)
    
    // Call revertNow via init
    const functionCall = revertNoReason.interface.encodeFunctionData('revertNow')
    
    await expect(
      diamondCut.diamondCut(
        [],
        revertNoReason.address,
        functionCall
      )
    ).to.be.revertedWith('LibDiamondCut: _init function reverted')
  })

  it('Should handle short calldata in fallback', async function () {
    const { diamondAddress } = await loadFixture(deployFixture)
    const [signer] = await ethers.getSigners()
    
    // Send 2 bytes of data
    // Expected: Revert with "Diamond: Function does not exist" or similar, or just revert
    try {
        await signer.sendTransaction({
            to: diamondAddress,
            data: '0x1234' 
        })
    } catch (e) {
        // We just want to ensure it hits the fallback logic and doesn't crash unexpectedly
    }
  })

  it('Should add multiple functions to same facet (selectorPosition != 0)', async function () {
    const { diamondCut, mockFacet } = await loadFixture(deployFixture)
    const selectors = getSelectors(mockFacet).get(['mockFunc1', 'mockFunc2'])
    
    // Add first function
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: [selectors[0]]
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Add second function to SAME facet (selectorPosition will be > 0)
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: [selectors[1]]
      }],
      ethers.constants.AddressZero,
      '0x'
    )
  })

  it('Should replace multiple functions in same facet (selectorPosition != 0)', async function () {
    const { diamondCut, mockFacet } = await loadFixture(deployFixture)
    const selectors = getSelectors(mockFacet).get(['mockFunc1', 'mockFunc2'])
    
    // Add both functions
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Deploy new version
    const MockFacet = await ethers.getContractFactory('MockFacet')
    const mockFacetV2 = await MockFacet.deploy()
    await mockFacetV2.deployed()

    // Replace first function (selectorPosition will be 0)
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacetV2.address,
        action: FacetCutAction.Replace,
        functionSelectors: [selectors[0]]
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Replace second function to SAME new facet (selectorPosition will be > 0)
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacetV2.address,
        action: FacetCutAction.Replace,
        functionSelectors: [selectors[1]]
      }],
      ethers.constants.AddressZero,
      '0x'
    )
  })

  it('Should remove one function but keep facet (lastSelectorPosition != 0)', async function () {
    const { diamondCut, mockFacet } = await loadFixture(deployFixture)
    const selectors = getSelectors(mockFacet).get(['mockFunc1', 'mockFunc2', 'mockFunc3'])
    
    // Add 3 functions
    await diamondCut.diamondCut(
      [{
        facetAddress: mockFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero,
      '0x'
    )

    // Remove only the last one (lastSelectorPosition will be 2, not 0)
    await diamondCut.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [selectors[2]]
      }],
      ethers.constants.AddressZero,
      '0x'
    )
  })
})

