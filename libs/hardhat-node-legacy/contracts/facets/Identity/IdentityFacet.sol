// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {LibIdentity} from "../../libraries/LibIdentity.sol";
import {IIdentity} from "./IIdentity.sol";
import {LibOwnership} from "../../libraries/LibOwnership.sol";

contract IdentityFacet is IIdentity {
    modifier onlyIdentityOwner(address subject) {
        require(
            msg.sender == subject ||
                LibIdentity.isDelegate(subject, msg.sender) ||
                msg.sender == LibOwnership.contractOwner(),
            "Not authorized"
        );
        _;
    }

    function registerIdentity(
        string memory did,
        string memory didDoc
    ) external override {
        // Anyone can register their own identity
        // Or maybe we want to restrict this to only trusted issuers?
        // For now, let's allow self-registration but we might want to verify the DID format
        LibIdentity.register(msg.sender, did, didDoc);
    }

    function updateIdentity(string memory didDoc) external override {
        LibIdentity.update(msg.sender, didDoc);
    }

    function getIdentity(
        address subject
    )
        external
        view
        override
        returns (string memory did, string memory didDoc, uint256 updatedAt)
    {
        return LibIdentity.getIdentity(subject);
    }

    function resolveIdentity(
        string memory did
    ) external view override returns (address subject) {
        return LibIdentity.resolve(did);
    }

    function addDelegate(address delegate) external override {
        LibIdentity.addDelegate(msg.sender, delegate);
    }

    function removeDelegate(address delegate) external override {
        LibIdentity.removeDelegate(msg.sender, delegate);
    }

    function isDelegate(
        address subject,
        address delegate
    ) external view override returns (bool) {
        return LibIdentity.isDelegate(subject, delegate);
    }
}
