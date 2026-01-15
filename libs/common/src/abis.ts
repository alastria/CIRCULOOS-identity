export const TrustedIssuerFacetAbi = [
    'function isTrustedIssuer(address issuer) view returns (bool)',
    'function addTrustedIssuer(address issuer)',
    'function removeTrustedIssuer(address issuer)',
    'event IssuerAdded(address indexed issuer, address indexed addedBy)',
    'event IssuerRemoved(address indexed issuer, address indexed removedBy)'
]

export const CredentialStatusFacetAbi = [
    'function isRevoked(bytes32 credentialHash) view returns (bool)',
    'function getCredentialStatus(bytes32 vcHash) view returns (bool issued, bool revoked, address issuer, uint256 issuedAt, uint256 revokedAt)',
    'function issueCredential(bytes32 vcHash, address subject)',
    'function revokeCredential(bytes32 vcHash)',
    'event CredentialIssued(bytes32 indexed credentialHash, address indexed issuer, address indexed subject, uint256 timestamp)',
    'event CredentialRevoked(bytes32 indexed vcHash, address indexed revoker, uint256 timestamp)'
]

export const DiamondLoupeFacetAbi = [
    'function facets() view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
    'function facetFunctionSelectors(address _facet) view returns (bytes4[])',
    'function facetAddresses() view returns (address[])',
    'function facetAddress(bytes4 _functionSelector) view returns (address)'
]
