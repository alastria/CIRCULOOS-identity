/**
 * Helpers to produce REAL holder claim signatures for IssuanceService.finalize().
 *
 * finalize() no longer verifies the holder signature through SecurityService.verifySignature
 * (which unit tests used to stub); it calls ethers `utils.verifyTypedData` directly with the
 * `circuloos-marketplace` claim schema from @circuloos/common (schema registry). Fixtures must
 * therefore be signed with the CURRENT claim types — stubbing verifySignature has no effect.
 */
import { Wallet } from 'ethers'
import { getCredentialType } from '@circuloos/common'

// Deterministic test keys (never used outside tests)
export const holderWallet = new Wallet('0x' + '11'.repeat(32))
export const otherWallet = new Wallet('0x' + '22'.repeat(32))

// A valid EIP-712 domain (verifyingContract must be a real address to sign)
export const CLAIM_DOMAIN = {
    name: 'TrustedIssuerRegistry',
    version: '1.0',
    chainId: 31337,
    verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}

/**
 * Sign the current `CirculoosMarketplaceClaim` typed data.
 * Returns the signature plus the exact `claimMessage` the frontend sends to /finalize
 * (timestamp serialised as a string, as done over JSON).
 */
export async function signClaim(
    signer: Wallet,
    token: string,
    domain: any = CLAIM_DOMAIN,
    holderAddress: string = signer.address,
) {
    const schema = getCredentialType('circuloos-marketplace')
    if (!schema) throw new Error('circuloos-marketplace schema not registered')
    const { types, messageBuilder } = schema.schema.claim
    const message = messageBuilder({ issuerName: 'did:example:issuer', holderName: '', issuedAt: '' }, holderAddress, token)
    const signature = await signer._signTypedData(domain, types, message)
    return {
        signature,
        claimMessage: { ...message, timestamp: message.timestamp.toString() },
    }
}

/**
 * Sign the current `CirculoosMarketplaceCredential` issuance typed data for a draft VC.
 * Since details-en 6a34ad5 the issuance message no longer contains holderName/holderEmail/
 * companyName, so legacy fixtures (signCredential / pre-6a34ad5 types) no longer verify.
 */
export async function signIssuance(signer: Wallet, domain: any, vc: any) {
    const schema = getCredentialType('circuloos-marketplace')
    if (!schema) throw new Error('circuloos-marketplace schema not registered')
    const { types, messageBuilder } = schema.schema.issuance
    return signer._signTypedData(domain, types, messageBuilder(vc))
}
