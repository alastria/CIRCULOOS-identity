// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {LibOwnership} from "../../libraries/LibOwnership.sol";
import {LibTrustedIssuer} from "../../libraries/LibTrustedIssuer.sol";
import {ITrustedIssuer} from "./ITrustedIssuer.sol";

contract TrustedIssuerFacet is ITrustedIssuer {
    function addTrustedIssuer(address issuer) external override {
        LibOwnership.enforceIsContractOwner();
        LibTrustedIssuer.add(issuer);
        emit IssuerAdded(issuer, msg.sender);
    }

    function removeTrustedIssuer(address issuer) external override {
        LibOwnership.enforceIsContractOwner();
        LibTrustedIssuer.remove(issuer);
        emit IssuerRemoved(issuer, msg.sender);
    }

    function isTrustedIssuer(
        address issuer
    ) external view override returns (bool) {
        return LibTrustedIssuer.isTrusted(issuer);
    }

    // Legacy support function name
    function trustedIssuers(
        address issuer
    ) external view override returns (bool) {
        return LibTrustedIssuer.isTrusted(issuer);
    }

    // New pagination functions
    function getTrustedIssuers(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        return LibTrustedIssuer.getIssuers(offset, limit);
    }

    function getTrustedIssuersCount() external view returns (uint256) {
        return LibTrustedIssuer.getCount();
    }
}
