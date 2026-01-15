// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ITrustedIssuer {
    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    error InvalidIssuer(address issuer);
    error IssuerAlreadyTrusted(address issuer);
    error IssuerNotTrusted(address issuer);

    function addTrustedIssuer(address issuer) external;
    function removeTrustedIssuer(address issuer) external;
    function isTrustedIssuer(address issuer) external view returns (bool);
    // Legacy support
    function trustedIssuers(address issuer) external view returns (bool);
}

