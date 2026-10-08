// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibPausableStorage {
    bytes32 constant STORAGE_POSITION = keccak256("alastria.pausable.storage");

    struct Layout {
        bool paused;
        // Accounts granted the pauser role; the Diamond owner is always a pauser (not stored)
        mapping(address => bool) pausers;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }
}
