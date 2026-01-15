// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibAttestationBatch } from "../../libraries/LibAttestationBatch.sol";
import { LibAttestationBatchStorage } from "../../storage/LibAttestationBatchStorage.sol";
import { IAttestationBatch } from "./IAttestationBatch.sol";

/**
 * @title AttestationBatchFacet
 * @notice Diamond facet for batching VP attestations using Merkle trees
 * @dev Implements IAttestationBatch interface
 */
contract AttestationBatchFacet is IAttestationBatch {

    /**
     * @inheritdoc IAttestationBatch
     */
    function submitBatch(
        bytes32 merkleRoot,
        uint64 vpCount,
        string calldata ipfsCid
    ) external override returns (uint256 batchId) {
        batchId = LibAttestationBatch.submitBatch(merkleRoot, vpCount, ipfsCid, msg.sender);

        emit BatchAttested(batchId, merkleRoot, vpCount, msg.sender, block.timestamp);

        return batchId;
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function verifyInclusion(
        uint256 batchId,
        bytes32 vpHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view override returns (bool valid) {
        return LibAttestationBatch.verifyInclusion(batchId, vpHash, proof, index);
    }

    /**
     * @notice Verifies inclusion and emits event (for on-chain verification tracking)
     * @param batchId The batch to verify against
     * @param vpHash Hash of the VP to verify
     * @param proof Merkle proof
     * @param index Position of the leaf
     * @return valid True if valid
     */
    function verifyAndAttest(
        uint256 batchId,
        bytes32 vpHash,
        bytes32[] calldata proof,
        uint256 index
    ) external returns (bool valid) {
        valid = LibAttestationBatch.verifyInclusion(batchId, vpHash, proof, index);

        if (valid) {
            emit VPVerifiedOnChain(vpHash, batchId, msg.sender);
        }

        return valid;
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function getBatch(uint256 batchId) external view override returns (Batch memory batch) {
        LibAttestationBatchStorage.Batch memory storageBatch = LibAttestationBatch.getBatch(batchId);

        // Convert storage struct to interface struct
        batch.merkleRoot = storageBatch.merkleRoot;
        batch.timestamp = storageBatch.timestamp;
        batch.vpCount = storageBatch.vpCount;
        batch.ipfsCid = storageBatch.ipfsCid;

        return batch;
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function getBatchCount() external view override returns (uint256 count) {
        return LibAttestationBatch.getBatchCount();
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function getBatches(uint256 startId, uint256 endId) external view override returns (Batch[] memory batches) {
        uint256 count = LibAttestationBatch.getBatchCount();

        // Validate range
        if (startId == 0 || startId > count) revert BatchNotFound();
        if (endId > count) endId = count;
        if (endId < startId) revert InvalidVpCount(); // Reusing error for invalid range

        uint256 resultCount = endId - startId + 1;
        batches = new Batch[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            LibAttestationBatchStorage.Batch memory storageBatch = LibAttestationBatch.getBatch(startId + i);

            batches[i].merkleRoot = storageBatch.merkleRoot;
            batches[i].timestamp = storageBatch.timestamp;
            batches[i].vpCount = storageBatch.vpCount;
            batches[i].ipfsCid = storageBatch.ipfsCid;
        }

        return batches;
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function isAuthorizedAttester(address attester) external view override returns (bool authorized) {
        return LibAttestationBatch.isAuthorizedAttester(attester);
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function addAttester(address attester) external override {
        LibAttestationBatch.addAttester(attester);
    }

    /**
     * @inheritdoc IAttestationBatch
     */
    function removeAttester(address attester) external override {
        LibAttestationBatch.removeAttester(attester);
    }
}
