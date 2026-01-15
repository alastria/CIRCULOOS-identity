// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {LibTrustedIssuerStorage} from "../storage/LibTrustedIssuerStorage.sol";
import {ITrustedIssuer} from "../facets/TrustedIssuer/ITrustedIssuer.sol";

library LibTrustedIssuer {
    function add(address issuer) internal {
        if (issuer == address(0)) revert ITrustedIssuer.InvalidIssuer(issuer);
        LibTrustedIssuerStorage.Layout storage ds = LibTrustedIssuerStorage
            .layout();
        if (ds.trustedIssuers[issuer])
            revert ITrustedIssuer.IssuerAlreadyTrusted(issuer);
        ds.trustedIssuers[issuer] = true;
        ds.issuerList.push(issuer); // Add to array
    }

    function remove(address issuer) internal {
        LibTrustedIssuerStorage.Layout storage ds = LibTrustedIssuerStorage
            .layout();
        if (!ds.trustedIssuers[issuer])
            revert ITrustedIssuer.IssuerNotTrusted(issuer);
        delete ds.trustedIssuers[issuer];

        // Remove from array (swap and pop for gas efficiency)
        for (uint256 i = 0; i < ds.issuerList.length; i++) {
            if (ds.issuerList[i] == issuer) {
                ds.issuerList[i] = ds.issuerList[ds.issuerList.length - 1];
                ds.issuerList.pop();
                break;
            }
        }
    }

    function isTrusted(address issuer) internal view returns (bool) {
        return LibTrustedIssuerStorage.layout().trustedIssuers[issuer];
    }

    function getCount() internal view returns (uint256) {
        return LibTrustedIssuerStorage.layout().issuerList.length;
    }

    function getIssuers(
        uint256 offset,
        uint256 limit
    ) internal view returns (address[] memory) {
        LibTrustedIssuerStorage.Layout storage ds = LibTrustedIssuerStorage
            .layout();
        uint256 total = ds.issuerList.length;

        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        address[] memory result = new address[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = ds.issuerList[offset + i];
        }

        return result;
    }
}
