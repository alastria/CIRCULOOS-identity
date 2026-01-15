// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibProof } from "../../libraries/LibProof.sol";
import { IProof } from "./IProof.sol";

contract ProofFacet is IProof {
    
    function storeProof(bytes32 cidHash, string calldata note) external override returns (uint256) {
        uint256 id = LibProof.store(cidHash, note, msg.sender);
        emit ProofStored(id, cidHash, msg.sender, block.timestamp, note);
        return id;
    }

    function getProof(uint256 id) external view override returns (bytes32 cidHash, address submitter, uint256 timestamp, string memory note) {
        return LibProof.get(id);
    }
}
