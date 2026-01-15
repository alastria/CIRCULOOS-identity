// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibCredentialStatusStorage } from "../storage/LibCredentialStatusStorage.sol";
import { ICredentialStatus } from "../facets/CredentialStatus/ICredentialStatus.sol";

library LibCredentialStatus {
    function issue(bytes32 vcHash, address issuer) internal {
        if (vcHash == bytes32(0)) revert ICredentialStatus.InvalidVcHash();
        
        LibCredentialStatusStorage.Layout storage ds = LibCredentialStatusStorage.layout();
        if (ds.statuses[vcHash].issuedAt != 0) revert ICredentialStatus.AlreadyIssued();
        
        ds.statuses[vcHash] = LibCredentialStatusStorage.CredentialStatus({
            issuer: issuer,
            issuedAt: uint96(block.timestamp),
            revokedAt: 0
        });
    }

    function revoke(bytes32 vcHash, address revoker) internal {
        if (vcHash == bytes32(0)) revert ICredentialStatus.InvalidVcHash();
        
        LibCredentialStatusStorage.Layout storage ds = LibCredentialStatusStorage.layout();
        LibCredentialStatusStorage.CredentialStatus storage status = ds.statuses[vcHash];
        
        if (status.issuedAt == 0) revert ICredentialStatus.NotIssued();
        if (status.revokedAt != 0) revert ICredentialStatus.AlreadyRevoked();
        if (status.issuer != revoker) revert ICredentialStatus.NotIssuer();
        
        status.revokedAt = uint96(block.timestamp);
    }

    function getStatus(bytes32 vcHash) internal view returns (bool issued, bool revoked, address issuer, uint256 issuedAt, uint256 revokedAt) {
        LibCredentialStatusStorage.CredentialStatus storage status = LibCredentialStatusStorage.layout().statuses[vcHash];
        
        issued = status.issuedAt != 0;
        revoked = status.revokedAt != 0;
        issuer = status.issuer;
        issuedAt = uint256(status.issuedAt);
        revokedAt = uint256(status.revokedAt);
    }
}
