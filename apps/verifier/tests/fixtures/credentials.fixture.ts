export const CredentialsFixture = {
    validVC: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: "urn:uuid:test-vc-123",
        type: ["VerifiableCredential"],
        issuer: "did:ethr:0x1234567890123456789012345678901234567890",
        issuanceDate: "2023-01-01T00:00:00Z",
        credentialSubject: {
            id: "did:ethr:0xholder",
            degree: "Bachelor of Science"
        },
        proof: {
            type: "Eip712Signature2023",
            proofPurpose: "assertionMethod",
            verificationMethod: "did:ethr:0x1234567890123456789012345678901234567890#controller",
            signature: "0xissuer_signature",
            created: "2023-01-01T00:00:00Z",
            domain: {
                name: "Circuloos",
                version: "1",
                chainId: 31337
            }
        }
    },

    // W3C VC with embedded proof (standard format)
    signedCredential: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: "urn:uuid:test-vc-456",
        type: ["VerifiableCredential"],
        issuer: "did:ethr:0x1234567890123456789012345678901234567890",
        issuanceDate: "2023-01-01T00:00:00Z",
        credentialSubject: {
            id: "did:ethr:0xholder"
        },
        proof: {
            type: "Eip712Signature2023",
            proofPurpose: "assertionMethod",
            verificationMethod: "did:ethr:0x1234567890123456789012345678901234567890#controller",
            signature: "0xissuer_signature",
            created: "2023-01-01T00:00:00Z",
            domain: {
                name: "Circuloos",
                version: "1",
                chainId: 31337,
                verifyingContract: "0xcontract"
            }
        }
    },

    validVP: {
        presentation: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            type: ["VerifiablePresentation"],
            holder: "0xholder",
            verifiableCredential: [
                {
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    id: "urn:uuid:test-vc-123",
                    type: ["VerifiableCredential"],
                    issuer: "did:ethr:0x1234567890123456789012345678901234567890",
                    issuanceDate: "2023-01-01T00:00:00Z",
                    credentialSubject: {
                        id: "did:ethr:0xholder",
                        degree: "Bachelor of Science"
                    },
                    proof: {
                        type: "Eip712Signature2023",
                        proofPurpose: "assertionMethod",
                        verificationMethod: "did:ethr:0x1234567890123456789012345678901234567890#controller",
                        signature: "0xissuer_signature",
                        created: "2023-01-01T00:00:00Z",
                        domain: {
                            name: "Circuloos",
                            version: "1",
                            chainId: 31337
                        }
                    }
                }
            ],
            issuanceDate: "2023-01-01T00:00:00Z",
            expirationDate: "2099-12-31T23:59:59Z"
        },
        signature: "0xvp_signature",
        signer: "0xholder",
        domain: {
            name: "Circuloos",
            version: "1",
            chainId: 31337
        }
    }
}
