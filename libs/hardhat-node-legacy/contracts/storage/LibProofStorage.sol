// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibProofStorage {
    bytes32 constant STORAGE_POSITION = keccak256("alastria.proof.registry.storage");

    struct Proof {
        bytes32 cidHash;
        address submitter;
        uint256 timestamp;
        string note;
    }

    struct Layout {
        uint256 counter;
        mapping(uint256 => Proof) proofs;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }
}
