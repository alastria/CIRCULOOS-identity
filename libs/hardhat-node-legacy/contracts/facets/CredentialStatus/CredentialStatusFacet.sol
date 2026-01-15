// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibCredentialStatus } from "../../libraries/LibCredentialStatus.sol";
import { ICredentialStatus } from "./ICredentialStatus.sol";

contract CredentialStatusFacet is ICredentialStatus {
    
    function issueCredential(bytes32 vcHash, address subject) public override {
        LibCredentialStatus.issue(vcHash, msg.sender);
        emit CredentialIssued(vcHash, msg.sender, subject, block.timestamp);
    }

    function revokeCredential(bytes32 vcHash) public override {
        LibCredentialStatus.revoke(vcHash, msg.sender);
        emit CredentialRevoked(vcHash, msg.sender, block.timestamp);
    }

    function getCredentialStatus(bytes32 vcHash) external view override returns (bool issued, bool revoked, address issuer, uint256 issuedAt, uint256 revokedAt) {
        return LibCredentialStatus.getStatus(vcHash);
    }

    // Legacy support
    function isIssued(bytes32 vcHash) external view override returns (bool) {
        (bool issued,,,,) = LibCredentialStatus.getStatus(vcHash);
        return issued;
    }

    function isRevoked(bytes32 vcHash) external view override returns (bool) {
        (,bool revoked,,,) = LibCredentialStatus.getStatus(vcHash);
        return revoked;
    }
    
    // Legacy alias
    function recordIssuance(bytes32 vcHash, address subject) external {
        issueCredential(vcHash, subject);
    }
    
    // Legacy alias
    function revoke(bytes32 vcHash) external {
        revokeCredential(vcHash);
    }
}
