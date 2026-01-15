// Script to add an issuer to the registry
// Run with: DIAMOND_ADDRESS=0x... ISSUER_ADDRESS=0x... npx hardhat run scripts/add-issuer.ts --network local

import { ethers } from "hardhat";

async function main() {
    // Get issuer address from env or CLI argument (CLI takes precedence)
    const issuerAddress = process.argv[2] || process.env.ISSUER_ADDRESS;
    if (!issuerAddress) {
        console.error("❌ ERROR: ISSUER_ADDRESS is required");
        console.error("   Pass it as CLI argument: npx hardhat run scripts/add-issuer.ts 0x...");
        console.error("   Or set ISSUER_ADDRESS environment variable");
        process.exit(1);
    }

    console.log("Adding issuer:", issuerAddress);

    // Get Diamond address from env (REQUIRED)
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    if (!diamondAddress) {
        console.error("❌ ERROR: DIAMOND_ADDRESS environment variable is required");
        process.exit(1);
    }

    // Get deployer (owner)
    const [deployer] = await ethers.getSigners();
    console.log("Using deployer:", deployer.address);

    // Get TrustedIssuerFacet
    const TrustedIssuerFacet = await ethers.getContractAt("TrustedIssuerFacet", diamondAddress);

    // Add issuer
    const tx = await TrustedIssuerFacet.addTrustedIssuer(issuerAddress);
    await tx.wait();

    console.log("✅ Added", issuerAddress, "as trusted issuer");

    // Verify
    const isTrusted = await TrustedIssuerFacet.isTrustedIssuer(issuerAddress);
    console.log("Is trusted?", isTrusted);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
