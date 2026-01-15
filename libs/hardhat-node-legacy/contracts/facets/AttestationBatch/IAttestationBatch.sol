// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IAttestationBatch
 * @notice Interface for batching VP attestations using Merkle trees
 * @dev Uses Merkle trees to batch multiple VP hashes and anchor the root on-chain
 *      Reduces gas costs by ~99.9% compared to individual attestations
 */
interface IAttestationBatch {

    // ============ Structs ============

    /**
     * @notice Represents a batch of attestations
     * @param merkleRoot The Merkle root of all VP hashes in this batch
     * @param timestamp When the batch was created
     * @param vpCount Number of VPs included in this batch
     * @param ipfsCid Optional IPFS CID for storing the full batch data
     * @param attester Address that submitted the batch (should be backend service)
     */
    struct Batch {
        bytes32 merkleRoot;
        uint96 timestamp;
        uint64 vpCount;
        string ipfsCid; // Optional: for storing full data off-chain
    }

    // ============ Events ============

    /**
     * @notice Emitted when a new batch is attested on-chain
     * @param batchId Unique identifier for this batch
     * @param merkleRoot The Merkle root of the batch
     * @param vpCount Number of VPs in the batch
     * @param attester Address that submitted the batch
     * @param timestamp When the batch was created
     */
    event BatchAttested(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        uint64 vpCount,
        address indexed attester,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a VP hash is verified on-chain
     * @param vpHash Hash of the VP that was verified
     * @param batchId Which batch it belongs to
     * @param verifier Who verified it
     */
    event VPVerifiedOnChain(
        bytes32 indexed vpHash,
        uint256 indexed batchId,
        address indexed verifier
    );

    // ============ Errors ============

    error InvalidMerkleRoot();
    error InvalidVpCount();
    error InvalidProof();
    error BatchNotFound();
    error UnauthorizedAttester();

    // ============ Functions ============

    /**
     * @notice Submits a new batch of VP attestations on-chain
     * @param merkleRoot The Merkle root of all VP hashes in the batch
     * @param vpCount Number of VPs included in this batch
     * @param ipfsCid Optional IPFS CID for storing full batch data off-chain
     * @return batchId The unique identifier for this batch
     */
    function submitBatch(
        bytes32 merkleRoot,
        uint64 vpCount,
        string calldata ipfsCid
    ) external returns (uint256 batchId);

    /**
     * @notice Verifies that a VP hash is included in a specific batch
     * @param batchId The batch to verify against
     * @param vpHash Hash of the VP to verify
     * @param proof Merkle proof (array of sibling hashes)
     * @param index Position of the leaf in the tree
     * @return valid True if the VP is included in the batch
     */
    function verifyInclusion(
        uint256 batchId,
        bytes32 vpHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool valid);

    /**
     * @notice Gets batch information by ID
     * @param batchId The batch ID to query
     * @return batch The batch data
     */
    function getBatch(uint256 batchId) external view returns (Batch memory batch);

    /**
     * @notice Gets the total number of batches created
     * @return count Total number of batches
     */
    function getBatchCount() external view returns (uint256 count);

    /**
     * @notice Gets batches in a range
     * @param startId First batch ID to retrieve
     * @param endId Last batch ID to retrieve (inclusive)
     * @return batches Array of batch data
     */
    function getBatches(uint256 startId, uint256 endId) external view returns (Batch[] memory batches);

    /**
     * @notice Checks if an address is authorized to submit batches
     * @param attester Address to check
     * @return authorized True if the address can submit batches
     */
    function isAuthorizedAttester(address attester) external view returns (bool authorized);

    /**
     * @notice Adds an authorized attester (only owner)
     * @param attester Address to authorize
     */
    function addAttester(address attester) external;

    /**
     * @notice Removes an authorized attester (only owner)
     * @param attester Address to remove
     */
    function removeAttester(address attester) external;
}
