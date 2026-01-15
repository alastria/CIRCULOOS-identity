import { ethers } from "hardhat";

async function main() {
    const diamondAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const issuerAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"; // From user paste
    const issuanceId = "issuance_1763975368391_1ea5f289fd7a"; // From user paste

    console.log(`\n💎 Inspecting Diamond at: ${diamondAddress}`);

    // 0. Check if contract exists
    const code = await ethers.provider.getCode(diamondAddress);
    if (code === "0x") {
        console.error("\n❌ ERROR: No code found at Diamond address! Deployment likely failed.");
        console.log("  This explains the 'Calling an account which is not a contract' warnings in logs.");
        console.log("  The 'StackUnderflow' errors in logs suggest the deployment transaction reverted.");
        return;
    }

    // 1. Check Facets (DiamondLoupe)
    const loupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const facets = await loupe.facets();
    console.log(`\n🔍 Found ${facets.length} Facets:`);
    facets.forEach((f: any, i: number) => {
        console.log(`  [${i}] ${f.facetAddress} (${f.functionSelectors.length} selectors)`);
    });

    // 2. Check Trusted Issuer Storage
    // Slot: keccak256("alastria.trusted.issuer.storage")
    const trustedIssuerStorageSlot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("alastria.trusted.issuer.storage"));

    // Mapping is at the start of the struct, so it's at the slot itself.
    // mapping(address => bool) trustedIssuers;
    // Slot for key k = keccak256(abi.encode(k, slot))
    const issuerSlot = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [issuerAddress, trustedIssuerStorageSlot])
    );

    const isTrusted = await ethers.provider.getStorageAt(diamondAddress, issuerSlot);
    console.log(`\n🛡️ Trusted Issuer Check (${issuerAddress}):`);
    console.log(`  Slot: ${issuerSlot}`);
    console.log(`  Value: ${isTrusted} (1 = true, 0 = false)`);

    // 3. Check Credential Status Storage
    // Slot: keccak256("alastria.credential.status.storage")
    const credentialStatusStorageSlot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("alastria.credential.status.storage"));

    // mapping(bytes32 => CredentialStatus) statuses;
    // CredentialStatus struct: { address issuer; uint96 issuedAt; uint96 revokedAt; }
    // Key is likely the hash of the issuance ID or the ID itself if it's bytes32.
    // The ID is a string "issuance_...", so it's likely hashed.
    // Let's try hashing the string ID.
    const idHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(issuanceId));

    const statusSlot = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [idHash, credentialStatusStorageSlot])
    );

    const statusData = await ethers.provider.getStorageAt(diamondAddress, statusSlot);
    console.log(`\n📜 Credential Status Check (ID: ${issuanceId}):`);
    console.log(`  ID Hash: ${idHash}`);
    console.log(`  Slot: ${statusSlot}`);
    console.log(`  Raw Data: ${statusData}`);

    // Decode CredentialStatus (packed)
    // address (160 bits) + uint96 (96 bits) = 256 bits (slot 0)
    // uint96 revokedAt (slot 1?) -> Wait, struct packing.
    // struct CredentialStatus { address issuer; uint96 issuedAt; uint96 revokedAt; }
    // 160 + 96 = 256 bits. So issuer and issuedAt fit in first slot.
    // revokedAt is in the next slot?
    // No, 160 + 96 = 256. Exactly one slot.
    // Wait, revokedAt is another uint96. 256 + 96 > 256.
    // So it takes 2 slots.
    // Slot 0: [issuedAt (96)][issuer (160)]
    // Slot 1: [revokedAt (96)]

    // Let's read the next slot too.
    const statusSlot2 = ethers.BigNumber.from(statusSlot).add(1).toHexString();
    const statusData2 = await ethers.provider.getStorageAt(diamondAddress, statusSlot2);
    console.log(`  Raw Data (Slot+1): ${statusData2}`);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
