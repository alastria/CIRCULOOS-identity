// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibAttestationBatchStorage } from "../storage/LibAttestationBatchStorage.sol";
import { LibOwnership } from "./LibOwnership.sol";

/**
 * @title LibAttestationBatch
 * @notice Core logic for attestation batching with Merkle trees
 */
library LibAttestationBatch {

    // ============ Errors ============

    error InvalidMerkleRoot();
    error InvalidVpCount();
    error InvalidProof();
    error BatchNotFound();
    error UnauthorizedAttester();

    // ============ Functions ============

    /**
     * @notice Submits a new batch of VP attestations
     * @param merkleRoot The Merkle root of all VP hashes in the batch
     * @param vpCount Number of VPs included in this batch
     * @param ipfsCid Optional IPFS CID for storing full batch data off-chain
     * @param attester Address submitting the batch
     * @return batchId The unique identifier for this batch
     */
    function submitBatch(
        bytes32 merkleRoot,
        uint64 vpCount,
        string calldata ipfsCid,
        address attester
    ) internal returns (uint256 batchId) {
        LibAttestationBatchStorage.Layout storage l = LibAttestationBatchStorage.layout();

        // Validate inputs
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (vpCount == 0) revert InvalidVpCount();
        if (!l.authorizedAttesters[attester]) revert UnauthorizedAttester();

        // Increment batch counter
        l.batchCount++;
        batchId = l.batchCount;

        // Store batch
        LibAttestationBatchStorage.Batch storage batch = l.batches[batchId];
        batch.merkleRoot = merkleRoot;
        batch.timestamp = uint96(block.timestamp);
        batch.vpCount = vpCount;
        batch.attester = attester;
        batch.ipfsCid = ipfsCid;

        return batchId;
    }

    /**
     * @notice Verifies that a VP hash is included in a batch using Merkle proof
     * @param batchId The batch to verify against
     * @param vpHash Hash of the VP to verify (the leaf)
     * @param proof Array of sibling hashes for the Merkle proof
     * @param index Position of the leaf in the tree
     * @return valid True if the VP is included in the batch
     */
    function verifyInclusion(
        uint256 batchId,
        bytes32 vpHash,
        bytes32[] calldata proof,
        uint256 index
    ) internal view returns (bool valid) {
        LibAttestationBatchStorage.Layout storage l = LibAttestationBatchStorage.layout();

        // Check batch exists
        LibAttestationBatchStorage.Batch storage batch = l.batches[batchId];
        if (batch.merkleRoot == bytes32(0)) revert BatchNotFound();

        // Verify Merkle proof
        bytes32 computedRoot = computeMerkleRoot(vpHash, proof, index);

        return computedRoot == batch.merkleRoot;
    }

    /**
     * @notice Computes the Merkle root from a leaf, proof, and index
     * @param leaf The leaf hash (VP hash)
     * @param proof Array of sibling hashes
     * @param index Position of the leaf in the tree
     * @return root The computed Merkle root
     */
    function computeMerkleRoot(
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) internal pure returns (bytes32 root) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            // Determine order based on index bit
            // If bit is 0, current element is left child
            // If bit is 1, current element is right child
            if (index & (1 << i) == 0) {
                // computedHash is left, proofElement is right
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // proofElement is left, computedHash is right
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash;
    }

    /**
     * @notice Gets batch information by ID
     * @param batchId The batch ID to query
     * @return batch The batch data
     */
    function getBatch(uint256 batchId) internal view returns (LibAttestationBatchStorage.Batch memory batch) {
        LibAttestationBatchStorage.Layout storage l = LibAttestationBatchStorage.layout();

        if (batchId == 0 || batchId > l.batchCount) revert BatchNotFound();

        return l.batches[batchId];
    }

    /**
     * @notice Gets the total number of batches
     * @return count Total number of batches
     */
    function getBatchCount() internal view returns (uint256 count) {
        return LibAttestationBatchStorage.layout().batchCount;
    }

    /**
     * @notice Checks if an address is authorized to submit batches
     * @param attester Address to check
     * @return authorized True if the address can submit batches
     */
    function isAuthorizedAttester(address attester) internal view returns (bool authorized) {
        return LibAttestationBatchStorage.layout().authorizedAttesters[attester];
    }

    /**
     * @notice Adds an authorized attester (only owner can call)
     * @param attester Address to authorize
     */
    function addAttester(address attester) internal {
        LibOwnership.enforceIsContractOwner();
        LibAttestationBatchStorage.layout().authorizedAttesters[attester] = true;
    }

    /**
     * @notice Removes an authorized attester (only owner can call)
     * @param attester Address to remove
     */
    function removeAttester(address attester) internal {
        LibOwnership.enforceIsContractOwner();
        LibAttestationBatchStorage.layout().authorizedAttesters[attester] = false;
    }
}
