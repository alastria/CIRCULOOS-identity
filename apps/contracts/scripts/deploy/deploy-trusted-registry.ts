import { ethers } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying TrustedIssuerRegistry with:")
  console.log("  account:", deployer.address)

  const Factory = await ethers.getContractFactory("TrustedIssuerRegistry", deployer)
  const contract = await Factory.deploy()
  await contract.deployed()

  console.log("TrustedIssuerRegistry deployed at:", contract.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
