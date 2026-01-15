import { ethers } from 'hardhat'
import { FacetCutAction, getSelectors } from '../utils/diamond'

export async function deployDiamondFixture() {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]
  const user1 = accounts[1]
  const user2 = accounts[2]
  const user3 = accounts[3]

  // 1. Deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
  const diamondCutFacet = await DiamondCutFacet.deploy()
  await diamondCutFacet.deployed()

  // 2. Deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.address)
  await diamond.deployed()

  // 3. Deploy DiamondInit
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.deployed()

  // 4. Deploy Facets
  const FacetNames = [
    'DiamondLoupeFacet',
    'OwnershipFacet',
    'TrustedIssuerFacet',
    'CredentialStatusFacet'
  ]
  const cut = []

  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()

    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // 5. Execute Diamond Cut
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address)
  let functionCall = diamondInit.interface.encodeFunctionData('init')
  await diamondCut.diamondCut(cut, diamondInit.address, functionCall)

  // Get contract instances connected to diamond address
  const trustedIssuer = await ethers.getContractAt('TrustedIssuerFacet', diamond.address)
  const credentialStatus = await ethers.getContractAt('CredentialStatusFacet', diamond.address)
  const ownership = await ethers.getContractAt('OwnershipFacet', diamond.address)
  const loupe = await ethers.getContractAt('DiamondLoupeFacet', diamond.address)

  return {
    diamond,
    diamondAddress: diamond.address,
    contractOwner,
    user1,
    user2,
    user3,
    trustedIssuer,
    credentialStatus,
    ownership,
    loupe,
    diamondCut // Exported for testing
  }
}
