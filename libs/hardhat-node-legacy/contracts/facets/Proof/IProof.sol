// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IProof {
    event ProofStored(uint256 indexed id, bytes32 indexed cidHash, address indexed submitter, uint256 timestamp, string note);
    
    error InvalidCidHash();

    function storeProof(bytes32 cidHash, string calldata note) external returns (uint256);
    function getProof(uint256 id) external view returns (bytes32 cidHash, address submitter, uint256 timestamp, string memory note);
}
