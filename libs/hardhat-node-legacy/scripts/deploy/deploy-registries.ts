import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying registries with account:', deployer.address)

  const CredentialFactory = await ethers.getContractFactory('CredentialRegistry', deployer)
  const credential = await CredentialFactory.deploy()
  await credential.deployed()
  console.log('CredentialRegistry deployed at:', credential.address)

  const RevocationFactory = await ethers.getContractFactory('RevocationRegistry', deployer)
  const revocation = await RevocationFactory.deploy()
  await revocation.deployed()
  console.log('RevocationRegistry deployed at:', revocation.address)

  const ProofFactory = await ethers.getContractFactory('ProofRegistry', deployer)
  const proof = await ProofFactory.deploy()
  await proof.deployed()
  console.log('ProofRegistry deployed at:', proof.address)
}

main().catch((e) => {
  console.error('deploy failed', e)
  process.exit(1)
})
