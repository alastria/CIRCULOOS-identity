import { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log('🔑 Using account:', deployer.address)

    // Get Diamond address from environment (REQUIRED)
    const diamondAddress = process.env.DIAMOND_ADDRESS
    if (!diamondAddress) {
        console.error('❌ ERROR: DIAMOND_ADDRESS environment variable is required')
        console.error('   Set it in your .env file or pass it as: DIAMOND_ADDRESS=0x... npx hardhat run ...')
        process.exit(1)
    }
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
