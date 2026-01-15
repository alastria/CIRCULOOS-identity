// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibIdentity {
    bytes32 constant IDENTITY_STORAGE_POSITION =
        keccak256("alastria.identity.storage");

    struct Identity {
        string did; // Full DID string e.g., "did:ala:quor:0x..."
        string didDoc; // IPFS hash or JSON string of the DID Document
        bool exists;
        uint256 updatedAt;
        mapping(address => bool) delegates; // Delegates authorized to sign on behalf of this identity
    }

    struct IdentityStorage {
        mapping(address => Identity) identities;
        mapping(string => address) didToAddress; // Reverse lookup
        uint256 identityCount;
    }

    function identityStorage()
        internal
        pure
        returns (IdentityStorage storage ds)
    {
        bytes32 position = IDENTITY_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    event IdentityRegistered(
        address indexed subject,
        string did,
        uint256 timestamp
    );
    event IdentityUpdated(address indexed subject, uint256 timestamp);
    event DelegateAdded(address indexed subject, address indexed delegate);
    event DelegateRemoved(address indexed subject, address indexed delegate);

    function register(
        address subject,
        string memory did,
        string memory didDoc
    ) internal {
        IdentityStorage storage ds = identityStorage();
        require(!ds.identities[subject].exists, "Identity already exists");
        require(ds.didToAddress[did] == address(0), "DID already registered");

        Identity storage id = ds.identities[subject];
        id.did = did;
        id.didDoc = didDoc;
        id.exists = true;
        id.updatedAt = block.timestamp;

        ds.didToAddress[did] = subject;
        ds.identityCount++;

        emit IdentityRegistered(subject, did, block.timestamp);
    }

    function update(address subject, string memory didDoc) internal {
        IdentityStorage storage ds = identityStorage();
        require(ds.identities[subject].exists, "Identity does not exist");

        ds.identities[subject].didDoc = didDoc;
        ds.identities[subject].updatedAt = block.timestamp;

        emit IdentityUpdated(subject, block.timestamp);
    }

    function addDelegate(address subject, address delegate) internal {
        IdentityStorage storage ds = identityStorage();
        require(ds.identities[subject].exists, "Identity does not exist");

        ds.identities[subject].delegates[delegate] = true;
        emit DelegateAdded(subject, delegate);
    }

    function removeDelegate(address subject, address delegate) internal {
        IdentityStorage storage ds = identityStorage();
        require(ds.identities[subject].exists, "Identity does not exist");

        ds.identities[subject].delegates[delegate] = false;
        emit DelegateRemoved(subject, delegate);
    }

    function getIdentity(
        address subject
    )
        internal
        view
        returns (string memory did, string memory didDoc, uint256 updatedAt)
    {
        IdentityStorage storage ds = identityStorage();
        require(ds.identities[subject].exists, "Identity does not exist");

        Identity storage id = ds.identities[subject];
        return (id.did, id.didDoc, id.updatedAt);
    }

    function isDelegate(
        address subject,
        address delegate
    ) internal view returns (bool) {
        IdentityStorage storage ds = identityStorage();
        return ds.identities[subject].delegates[delegate];
    }

    function resolve(string memory did) internal view returns (address) {
        IdentityStorage storage ds = identityStorage();
        return ds.didToAddress[did];
    }
}
