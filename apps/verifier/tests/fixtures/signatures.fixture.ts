export const SignaturesFixture = {
    validIssuerSignature: "0xvalid_issuer_signature",
    validHolderSignature: "0xvalid_holder_signature",
    invalidSignature: "0xinvalid_signature",

    issuerAddress: "0x1234567890123456789012345678901234567890",
    holderAddress: "0xholder",

    eip712Domain: {
        name: "Circuloos",
        version: "1",
        chainId: 31337,
        verifyingContract: "0x0000000000000000000000000000000000000000"
    }
}
