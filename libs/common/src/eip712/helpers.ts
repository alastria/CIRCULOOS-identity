/**
 * EIP-712 Signing Helpers
 *
 * High-level functions for signing credentials using the schema registry.
 */

import { Wallet, utils } from 'ethers'
import { EIP712Domain } from '../types'
import { getCredentialType, detectCredentialType } from './registry'

/**
 * Sign a credential issuance (issuer signs the VC)
 *
 * @param privateKey - Issuer's private key
 * @param domain - EIP-712 domain
 * @param vc - Verifiable Credential object
 * @param credentialType - Type of credential (auto-detected if not provided)
 * @returns Signature
 */
export async function signCredentialIssuance(
  privateKey: string,
  domain: EIP712Domain,
  vc: any,
  credentialType?: string
): Promise<string> {
  const typeId = credentialType || detectCredentialType(vc)
  const metadata = getCredentialType(typeId)

  if (!metadata) {
    throw new Error(`Unknown credential type: ${typeId}. Available types: ${Array.from(getCredentialType.name)}`)
  }

  const { primaryType, types, messageBuilder } = metadata.schema.issuance
  const message = messageBuilder(vc)

  const wallet = new Wallet(privateKey)
  return await wallet._signTypedData(domain as any, types, message)
}

/**
 * Verify a credential issuance signature (verifier checks issuer's signature)
 *
 * @param domain - EIP-712 domain used when signing
 * @param vc - Verifiable Credential object
 * @param signature - The signature to verify
 * @param credentialType - Type of credential (auto-detected if not provided)
 * @returns Recovered signer address or null if invalid
 */
export function verifyCredentialIssuance(
  domain: EIP712Domain,
  vc: any,
  signature: string,
  credentialType?: string
): string | null {
  const typeId = credentialType || detectCredentialType(vc)
  const metadata = getCredentialType(typeId)

  if (!metadata) {
    console.warn(`[verifyCredentialIssuance] Unknown credential type: ${typeId}, falling back to generic`)
    return null
  }

  const { types, messageBuilder } = metadata.schema.issuance
  const message = messageBuilder(vc)

  try {
    const recovered = utils.verifyTypedData(domain as any, types, message, signature)
    return recovered
  } catch (err) {
    console.error('[verifyCredentialIssuance] Verification error:', err)
    return null
  }
}

/**
 * Sign a credential claim (holder claims the credential)
 *
 * @param signTypedDataFn - wagmi's signTypedDataAsync function
 * @param domain - EIP-712 domain
 * @param credentialPreview - Preview of the credential being claimed
 * @param holderAddress - Address of the holder claiming
 * @param token - Claim token
 * @param credentialType - Type of credential
 * @returns Signature
 */
export async function signCredentialClaim(
  signTypedDataFn: any,
  domain: EIP712Domain,
  credentialPreview: any,
  holderAddress: string,
  token: string,
  credentialType: string = 'circuloos-marketplace'
): Promise<string> {
  const metadata = getCredentialType(credentialType)

  if (!metadata) {
    throw new Error(`Unknown credential type: ${credentialType}`)
  }

  const { primaryType, types, messageBuilder } = metadata.schema.claim
  const message = messageBuilder(credentialPreview, holderAddress, token)

  return await signTypedDataFn({
    domain,
    types,
    primaryType,
    message
  })
}

/**
 * Sign a verifiable presentation (holder presents the credential)
 *
 * @param signTypedDataFn - wagmi's signTypedDataAsync function
 * @param domain - EIP-712 domain
 * @param vc - Verifiable Credential being presented
 * @param holderAddress - Address of the holder presenting
 * @param verifierAddress - Address of the verifier (optional)
 * @param credentialType - Type of credential (auto-detected if not provided)
 * @returns Signature
 */
export async function signCredentialPresentation(
  signTypedDataFn: any,
  domain: EIP712Domain,
  vc: any,
  holderAddress: string,
  verifierAddress?: string,
  credentialType?: string
): Promise<string> {
  const typeId = credentialType || detectCredentialType(vc)
  const metadata = getCredentialType(typeId)

  if (!metadata) {
    throw new Error(`Unknown credential type: ${typeId}`)
  }

  const { primaryType, types, messageBuilder } = metadata.schema.presentation
  const message = messageBuilder(vc, holderAddress, verifierAddress)

  return await signTypedDataFn({
    domain,
    types,
    primaryType,
    message
  })
}

/**
 * Get the EIP-712 types for a specific operation and credential type
 *
 * Useful for manual signing or inspection
 */
export function getEIP712Types(
  operation: 'issuance' | 'claim' | 'presentation',
  credentialType: string = 'circuloos-marketplace'
) {
  const metadata = getCredentialType(credentialType)

  if (!metadata) {
    throw new Error(`Unknown credential type: ${credentialType}`)
  }

  const schema = metadata.schema[operation]
  return {
    primaryType: schema.primaryType,
    types: schema.types
  }
}
