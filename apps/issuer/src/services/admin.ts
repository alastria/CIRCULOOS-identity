import { ethers } from 'ethers'

/**
 * Wallets with the admin role in the issuer web.
 *
 * - ADMIN_ADDRESSES: explicit human wallets. Required once the Diamond owner key lives in
 *   Web3Signer (Red-B, plan A4 decision D2): that key cannot log in with MetaMask.
 * - The address derived from the configured private key, kept for local development.
 * Invalid entries are ignored rather than granted anything.
 */
export function adminAddresses(issuerConfig: { adminAddresses?: string[]; privateKey?: string }): string[] {
  const admins = new Set<string>()
  for (const entry of issuerConfig.adminAddresses ?? []) {
    const address = entry.trim()
    if (ethers.utils.isAddress(address)) admins.add(address.toLowerCase())
  }
  if (issuerConfig.privateKey) {
    try {
      admins.add(new ethers.Wallet(issuerConfig.privateKey).address.toLowerCase())
    } catch {
      // not a valid key: no admin derived from it
    }
  }
  return [...admins]
}
