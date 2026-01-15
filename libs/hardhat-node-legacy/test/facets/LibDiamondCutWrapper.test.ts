import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe('LibDiamondCut Wrapper - 100% Branch Coverage', function () {
  async function deployFixture() {
    const Wrapper = await ethers.getContractFactory('LibDiamondCutWrapper')
    const wrapper = await Wrapper.deploy()
    await wrapper.deployed()

    const MockFacet = await ethers.getContractFactory('MockFacet')
    const mockFacet1 = await MockFacet.deploy()
    await mockFacet1.deployed()
    
    const mockFacet2 = await MockFacet.deploy()
    await mockFacet2.deployed()

    return { wrapper, mockFacet1, mockFacet2 }
  }

  describe('addFunctions - selectorPosition branch coverage', function () {
    it('Should add first function to new facet (selectorPosition == 0)', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector = mockFacet1.interface.getSighash('mockFunc1')

      await wrapper.addFunctions(mockFacet1.address, [selector])
      
      expect(await wrapper.getFacetAddress(selector)).to.equal(mockFacet1.address)
    })

    it('Should add second function to existing facet (selectorPosition != 0)', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector1 = mockFacet1.interface.getSighash('mockFunc1')
      const selector2 = mockFacet1.interface.getSighash('mockFunc2')

      // Add first (selectorPosition == 0)
      await wrapper.addFunctions(mockFacet1.address, [selector1])
      
      // Add second (selectorPosition != 0) - this covers the FALSE branch
      await wrapper.addFunctions(mockFacet1.address, [selector2])
      
      const selectors = await wrapper.getFacetSelectors(mockFacet1.address)
      expect(selectors.length).to.equal(2)
    })
  })

  describe('replaceFunctions - selectorPosition branch coverage', function () {
    it('Should replace to new facet (selectorPosition == 0)', async function () {
      const { wrapper, mockFacet1, mockFacet2 } = await loadFixture(deployFixture)
      const selector = mockFacet1.interface.getSighash('mockFunc1')

      // Add to facet1
      await wrapper.addFunctions(mockFacet1.address, [selector])
      
      // Replace with facet2 (selectorPosition == 0 for facet2)
      await wrapper.replaceFunctions(mockFacet2.address, [selector])
      
      expect(await wrapper.getFacetAddress(selector)).to.equal(mockFacet2.address)
    })

    it('Should replace multiple functions to same new facet (selectorPosition != 0)', async function () {
      const { wrapper, mockFacet1, mockFacet2 } = await loadFixture(deployFixture)
      const selector1 = mockFacet1.interface.getSighash('mockFunc1')
      const selector2 = mockFacet1.interface.getSighash('mockFunc2')

      // Add both to facet1
      await wrapper.addFunctions(mockFacet1.address, [selector1, selector2])
      
      // Replace first to facet2 (selectorPosition == 0)
      await wrapper.replaceFunctions(mockFacet2.address, [selector1])
      
      // Replace second to facet2 (selectorPosition != 0) - covers FALSE branch
      await wrapper.replaceFunctions(mockFacet2.address, [selector2])
      
      const selectors = await wrapper.getFacetSelectors(mockFacet2.address)
      expect(selectors.length).to.equal(2)
    })
  })

  describe('removeFunctions - lastSelectorPosition branch coverage', function () {
    it('Should remove last function and delete facet (lastSelectorPosition == 0)', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector = mockFacet1.interface.getSighash('mockFunc1')

      // Add one function
      await wrapper.addFunctions(mockFacet1.address, [selector])
      
      // Remove it (lastSelectorPosition == 0, should delete facet)
      await wrapper.removeFunctions(ethers.constants.AddressZero, [selector])
      
      expect(await wrapper.getFacetAddress(selector)).to.equal(ethers.constants.AddressZero)
      const facets = await wrapper.getAllFacetAddresses()
      expect(facets.length).to.equal(0)
    })

    it('Should remove one function but keep facet (lastSelectorPosition != 0)', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector1 = mockFacet1.interface.getSighash('mockFunc1')
      const selector2 = mockFacet1.interface.getSighash('mockFunc2')
      const selector3 = mockFacet1.interface.getSighash('mockFunc3')

      // Add three functions
      await wrapper.addFunctions(mockFacet1.address, [selector1, selector2, selector3])
      
      // Remove last one (lastSelectorPosition == 2, != 0) - covers FALSE branch
      await wrapper.removeFunctions(ethers.constants.AddressZero, [selector3])
      
      const selectors = await wrapper.getFacetSelectors(mockFacet1.address)
      expect(selectors.length).to.equal(2)
      
      const facets = await wrapper.getAllFacetAddresses()
      expect(facets.length).to.equal(1) // Facet still exists
    })
  })

  describe('initializeDiamondCut - delegatecall branch coverage', function () {
    it('Should skip enforceHasContractCode when _init == address(this)', async function () {
      const { wrapper } = await loadFixture(deployFixture)
      
      // When _init == address(this), the check is skipped
      // We need valid calldata that exists in wrapper
      const calldata = wrapper.interface.encodeFunctionData('getAllFacetAddresses')
      
      // This should execute without checking for contract code
      await wrapper.initializeDiamondCut(wrapper.address, calldata)
    })

    it('Should handle successful delegatecall (!success == false)', async function () {
      const { wrapper } = await loadFixture(deployFixture)
      
      const InitDiamond = await ethers.getContractFactory('InitDiamond')
      const initDiamond = await InitDiamond.deploy()
      await initDiamond.deployed()
      
      const calldata = initDiamond.interface.encodeFunctionData('init')
      
      // This should succeed (covers !success == false branch)
      await wrapper.initializeDiamondCut(initDiamond.address, calldata)
    })

    it('Should revert when _init is address(0) but calldata is not empty', async function () {
      const { wrapper } = await loadFixture(deployFixture)
      
      // Branch 19: _init == address(0) but _calldata.length != 0
      await expect(
        wrapper.initializeDiamondCut(ethers.constants.AddressZero, '0x1234')
      ).to.be.revertedWith('LibDiamondCut: _init is address(0) but_calldata is not empty')
    })

    it('Should revert when _init is not address(0) but calldata is empty', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      
      // Branch 20: _init != address(0) but _calldata.length == 0
      await expect(
        wrapper.initializeDiamondCut(mockFacet1.address, '0x')
      ).to.be.revertedWith('LibDiamondCut: _calldata is empty but _init is not address(0)')
    })
  })

  describe('replaceFunctions - require branch coverage', function () {
    it('Should revert when selectors array is empty', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      
      // Branch 7: _functionSelectors.length == 0
      await expect(
        wrapper.replaceFunctions(mockFacet1.address, [])
      ).to.be.revertedWith('LibDiamondCut: No selectors in facet to cut')
    })

    it('Should revert when facet address is address(0)', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector = mockFacet1.interface.getSighash('mockFunc1')
      
      // Branch 8: _facetAddress == address(0)
      await expect(
        wrapper.replaceFunctions(ethers.constants.AddressZero, [selector])
      ).to.be.revertedWith('LibDiamondCut: Add facet can\'t be address(0)')
    })
  })

  describe('removeFunctions - require branch coverage', function () {
    it('Should revert when selectors array is empty', async function () {
      const { wrapper } = await loadFixture(deployFixture)
      
      // Branch 12: _functionSelectors.length == 0
      await expect(
        wrapper.removeFunctions(ethers.constants.AddressZero, [])
      ).to.be.revertedWith('LibDiamondCut: No selectors in facet to cut')
    })
  })

  describe('diamondCut - full wrapper coverage', function () {
    it('Should execute diamondCut through wrapper', async function () {
      const { wrapper, mockFacet1 } = await loadFixture(deployFixture)
      const selector = mockFacet1.interface.getSighash('mockFunc1')
      
      // Use the diamondCut wrapper function (line 32)
      await wrapper.diamondCut(
        [{
          facetAddress: mockFacet1.address,
          action: 0, // Add
          functionSelectors: [selector]
        }],
        ethers.constants.AddressZero,
        '0x'
      )
      
      expect(await wrapper.getFacetAddress(selector)).to.equal(mockFacet1.address)
    })
  })
})

