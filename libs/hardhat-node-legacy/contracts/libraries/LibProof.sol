// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibProofStorage } from "../storage/LibProofStorage.sol";
import { IProof } from "../facets/Proof/IProof.sol";

library LibProof {
    function store(bytes32 cidHash, string calldata note, address submitter) internal returns (uint256) {
        if (cidHash == bytes32(0)) revert IProof.InvalidCidHash();

        LibProofStorage.Layout storage ds = LibProofStorage.layout();
        ds.counter++;
        
        ds.proofs[ds.counter] = LibProofStorage.Proof({
            cidHash: cidHash,
            submitter: submitter,
            timestamp: block.timestamp,
            note: note
        });

        return ds.counter;
    }

    function get(uint256 id) internal view returns (bytes32 cidHash, address submitter, uint256 timestamp, string memory note) {
        LibProofStorage.Layout storage ds = LibProofStorage.layout();
        LibProofStorage.Proof storage p = ds.proofs[id];
        return (p.cidHash, p.submitter, p.timestamp, p.note);
    }
}
