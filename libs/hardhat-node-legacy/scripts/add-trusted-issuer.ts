import { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log('🔑 Using account:', deployer.address)

    // Get Diamond address from environment or checkpoint
    const diamondAddress = process.env.DIAMOND_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    console.log('💎 Diamond address:', diamondAddress)

    // Get TrustedIssuerFacet interface
    const trustedIssuerFacet = await ethers.getContractAt('TrustedIssuerFacet', diamondAddress)

    // Check if deployer is already a trusted issuer
    const isTrusted = await trustedIssuerFacet.isTrustedIssuer(deployer.address)

    if (isTrusted) {
        console.log('✅ Deployer is already a trusted issuer')
        return
    }

    // Add deployer as trusted issuer
    console.log('🔑 Adding deployer as trusted issuer...')
    const tx = await trustedIssuerFacet.addTrustedIssuer(deployer.address)
    await tx.wait()

    console.log('✅ Deployer added as trusted issuer:', deployer.address)
    console.log('📝 Transaction hash:', tx.hash)

    // Verify
    const isNowTrusted = await trustedIssuerFacet.isTrustedIssuer(deployer.address)
    console.log('🔍 Verification:', isNowTrusted ? '✅ Success' : '❌ Failed')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
