// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibTrustedIssuerStorage {
    bytes32 constant STORAGE_POSITION =
        keccak256("alastria.trusted.issuer.storage");

    struct Layout {
        mapping(address => bool) trustedIssuers;
        address[] issuerList; // Array for iteration
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }
}
