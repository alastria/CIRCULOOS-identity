/**
 * EIP-712 Utilities (Legacy + New Registry System)
 *
 * This file maintains backward compatibility with existing code
 * while providing access to the new schema registry system.
 */

import { CredentialProof, CredentialProofPurpose, EIP712Domain, VC } from './types'
import { utils, Wallet } from 'ethers'

// Export new registry system
export * from './eip712/types'
export * from './eip712/helpers'
export * from './eip712/utils'

import { DIDUtils } from './utils/did'

/**
 * Build an EIP-712 domain
 */
export function buildEip712Domain(name: string, version: string, chainId: number, verifyingContract?: string): EIP712Domain {
  const d: any = { name, version, chainId }
  if (verifyingContract) {
    // Ensure verifyingContract is a valid address (not a DID)
    d.verifyingContract = DIDUtils.normalizeAddress(verifyingContract)
  }
  return d
}

/**
 * Legacy credential types (maintained for backward compatibility)
 * @deprecated Use the new schema registry system instead
 */
export const credentialTypes = {
  Credential: [
    { name: 'id', type: 'string' },
    { name: 'issuer', type: 'string' },
    { name: 'issuanceDate', type: 'string' },
    { name: 'expirationDate', type: 'string' },
    { name: 'credentialSubject', type: 'string' },
  ],
}

export function toCredentialValue(vc: VC) {
  // Map W3C VCDM v2.0 (validFrom/validUntil) to legacy EIP-712 signature fields
  const issuanceDate = (vc as any).validFrom || vc.issuanceDate || ''
  const expirationDate = (vc as any).validUntil || vc.expirationDate || ''

  // Normalize issuer: if it's an object, extract the id, otherwise use as string
  const issuer = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer as any)?.id || vc.issuer

  return {
    id: vc.id,
    issuer,
    issuanceDate,
    expirationDate,
    credentialSubject: JSON.stringify(vc.credentialSubject || {}),
  }
}

export function normalizeNumber(value: any): any {
  if (typeof value === 'bigint') return value.toString()
  return value
}

export async function verifyTypedDataWithFallback(domain: any, types: any, value: any, signature: string, expectedAddress: string): Promise<boolean> {
  try {
    const recovered = utils.verifyTypedData(domain, types, value, signature)
    return recovered.toLowerCase() === expectedAddress.toLowerCase()
  } catch (err) {
    try {
      const hash = utils.hashMessage(typeof value === 'string' ? value : JSON.stringify(value))
      const recovered = utils.recoverAddress(hash, signature)
      return recovered.toLowerCase() === expectedAddress.toLowerCase()
    } catch (err2) {
      return false
    }
  }
}

/**
 * Sign a credential (legacy format)
 * @deprecated Use signCredentialIssuance from eip712/helpers instead
 */
export async function signCredential(privateKey: string, domain: EIP712Domain, vc: VC): Promise<string> {
  const wallet = new Wallet(privateKey)
  const value = toCredentialValue(vc)
  const signature = await wallet._signTypedData(domain as any, credentialTypes as any, value as any)
  return signature
}

export function verifyCredential(domain: EIP712Domain, vc: VC, signature: string): string | null {
  const value = toCredentialValue(vc)
  try {
    const recovered = utils.verifyTypedData(domain as any, credentialTypes as any, value as any, signature)
    return recovered
  } catch (err) {
    return null
  }
}

export function buildCredentialProof(params: {
  signature: string
  signer: string
  domain: EIP712Domain
  proofPurpose?: CredentialProofPurpose
  created?: string
  type?: CredentialProof['type']
}): CredentialProof {
  const {
    signature,
    signer,
    domain,
    proofPurpose = 'assertionMethod',
    created = new Date().toISOString(),
    type = 'Eip712Signature2023',
  } = params

  if (!signature) throw new Error('signature is required to build a proof')
  if (!signer) throw new Error('signer is required to build a proof')

  return {
    type,
    proofPurpose,
    verificationMethod: signer,
    signature,
    created,
    domain,
  }
}

export async function signCredentialWithProof(
  privateKey: string,
  domain: EIP712Domain,
  vc: VC,
  proofPurpose: CredentialProofPurpose = 'assertionMethod',
) {
  const wallet = new Wallet(privateKey)
  const value = toCredentialValue(vc)
  const signature = await wallet._signTypedData(domain as any, credentialTypes as any, value as any)
  const proof = buildCredentialProof({ signature, signer: wallet.address, domain, proofPurpose })
  return { signature, signer: wallet.address, proof }
}

export function recoverCredentialProofSigner(vc: VC, proof: CredentialProof): string | null {
  return verifyCredential(proof.domain, vc, proof.signature)
}

export function proofMatchesVerificationMethod(vc: VC, proof: CredentialProof): boolean {
  const recovered = recoverCredentialProofSigner(vc, proof)
  if (!recovered) return false
  return recovered.toLowerCase() === proof.verificationMethod.toLowerCase()
}
