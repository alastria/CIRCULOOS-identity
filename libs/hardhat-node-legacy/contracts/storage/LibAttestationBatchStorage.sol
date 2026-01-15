// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title LibAttestationBatchStorage
 * @notice Storage library for AttestationBatch using Diamond Storage pattern
 * @dev Uses namespaced storage to avoid collisions in Diamond proxy
 */
library LibAttestationBatchStorage {
    bytes32 constant STORAGE_POSITION = keccak256("alastria.attestation.batch.storage");

    /**
     * @notice Represents a batch of attestations
     * @dev Optimized for storage efficiency
     */
    struct Batch {
        bytes32 merkleRoot;      // Merkle root of all VP hashes in this batch
        uint96 timestamp;        // When the batch was created (packed with vpCount)
        uint64 vpCount;          // Number of VPs in the batch (packed with timestamp)
        address attester;        // Who submitted the batch
        string ipfsCid;          // Optional IPFS CID for off-chain data
    }

    struct Layout {
        // Mapping from batchId to Batch
        mapping(uint256 => Batch) batches;

        // Counter for batch IDs (starts at 1)
        uint256 batchCount;

        // Authorized attesters (backend services that can submit batches)
        mapping(address => bool) authorizedAttesters;
    }

    /**
     * @notice Returns the storage layout
     * @return l The storage layout at the namespaced position
     */
    function layout() internal pure returns (Layout storage l) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }
}
