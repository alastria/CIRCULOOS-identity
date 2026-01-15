// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IIdentity {
    event IdentityRegistered(
        address indexed subject,
        string did,
        uint256 timestamp
    );
    event IdentityUpdated(address indexed subject, uint256 timestamp);
    event DelegateAdded(address indexed subject, address indexed delegate);
    event DelegateRemoved(address indexed subject, address indexed delegate);

    function registerIdentity(string memory did, string memory didDoc) external;
    function updateIdentity(string memory didDoc) external;
    function getIdentity(
        address subject
    )
        external
        view
        returns (string memory did, string memory didDoc, uint256 updatedAt);
    function resolveIdentity(
        string memory did
    ) external view returns (address subject);
    function addDelegate(address delegate) external;
    function removeDelegate(address delegate) external;
    function isDelegate(
        address subject,
        address delegate
    ) external view returns (bool);
}
