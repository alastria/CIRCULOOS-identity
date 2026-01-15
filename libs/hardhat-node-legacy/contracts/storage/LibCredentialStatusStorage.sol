// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibCredentialStatusStorage {
    bytes32 constant STORAGE_POSITION = keccak256("alastria.credential.status.storage");

    struct CredentialStatus {
        address issuer;
        uint96 issuedAt;
        uint96 revokedAt; // 0 if valid, > 0 if revoked
    }

    struct Layout {
        mapping(bytes32 => CredentialStatus) statuses;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }
}
