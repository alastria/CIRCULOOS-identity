// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICredentialStatus {
    event CredentialIssued(bytes32 indexed vcHash, address indexed issuer, address indexed subject, uint256 timestamp);
    event CredentialRevoked(bytes32 indexed vcHash, address indexed revoker, uint256 timestamp);

    error InvalidVcHash();
    error AlreadyIssued();
    error NotIssued();
    error AlreadyRevoked();
    error NotIssuer();

    function issueCredential(bytes32 vcHash, address subject) external;
    function revokeCredential(bytes32 vcHash) external;
    
    function getCredentialStatus(bytes32 vcHash) external view returns (bool issued, bool revoked, address issuer, uint256 issuedAt, uint256 revokedAt);
    
    // Legacy support
    function isIssued(bytes32 vcHash) external view returns (bool);
    function isRevoked(bytes32 vcHash) external view returns (bool);
}

