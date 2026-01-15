import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { FACET_NAMES } from '../constants'
import { ethers } from 'hardhat'

describe('DiamondLoupeFacet', function () {
  async function deployFixture() {
    return deployDiamondFixture()
  }

  describe('facets', function () {
    it('Should return all facets', async function () {
      const { loupe } = await loadFixture(deployFixture)
      const facets = await loupe.facets()
      
      // Should have DiamondCut, DiamondLoupe, Ownership, TrustedIssuer, CredentialStatus, Proof
      expect(facets.length).to.be.gte(6)
    })
  })

  describe('facetFunctionSelectors', function () {
    it('Should return selectors for a facet', async function () {
      const { loupe, trustedIssuer } = await loadFixture(deployFixture)
      
      // Get address of TrustedIssuerFacet from fixture (it's a contract instance connected to diamond address, 
      // but we need the actual facet implementation address? No, Loupe uses implementation addresses.
      // But wait, deployDiamondFixture returns contract instances attached to DIAMOND address.
      // We need to find the implementation address.
      // We can find it via loupe.facetAddress(selector)
      
      const selector = trustedIssuer.interface.getSighash('addTrustedIssuer')
      const facetAddress = await loupe.facetAddress(selector)
      
      const selectors = await loupe.facetFunctionSelectors(facetAddress)
      expect(selectors).to.include(selector)
    })
  })

  describe('facetAddresses', function () {
    it('Should return all facet addresses', async function () {
      const { loupe } = await loadFixture(deployFixture)
      const addresses = await loupe.facetAddresses()
      expect(addresses.length).to.be.gte(6)
    })
  })

  describe('facetAddress', function () {
    it('Should return facet address for a selector', async function () {
      const { loupe, trustedIssuer } = await loadFixture(deployFixture)
      const selector = trustedIssuer.interface.getSighash('addTrustedIssuer')
      const address = await loupe.facetAddress(selector)
      expect(address).to.not.equal(ethers.constants.AddressZero)
    })

    it('Should return address(0) for unknown selector', async function () {
      const { loupe } = await loadFixture(deployFixture)
      const randomSelector = ethers.utils.hexDataSlice(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('unknown()')), 0, 4)
      const address = await loupe.facetAddress(randomSelector)
      expect(address).to.equal(ethers.constants.AddressZero)
    })
  })
  
  describe('supportsInterface', function () {
    it('Should support ERC165', async function () {
      const { loupe } = await loadFixture(deployFixture)
      const interfaceId = '0x01ffc9a7' // ERC165
      expect(await loupe.supportsInterface(interfaceId)).to.be.true
    })
    
    it('Should support IDiamondLoupe', async function () {
      const { loupe } = await loadFixture(deployFixture)
      const interfaceId = '0x48e2b093' // IDiamondLoupe
      expect(await loupe.supportsInterface(interfaceId)).to.be.true
    })
  })
})

