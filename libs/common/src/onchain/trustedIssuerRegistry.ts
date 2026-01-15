import { Contract, providers, utils } from 'ethers'
import { config } from '../config'

export const trustedIssuerRegistryAbi = [
  'function owner() view returns (address)',
  'function isTrustedIssuer(address issuer) view returns (bool)',
  'function addTrustedIssuer(address issuer)',
  'function removeTrustedIssuer(address issuer)',
  'event IssuerAdded(address indexed issuer, address indexed addedBy)',
  'event IssuerRemoved(address indexed issuer, address indexed removedBy)',
]

export type TrustedIssuerRegistryClient = {
  address: string
  provider: providers.Provider
  contract: Contract
  isTrustedIssuer(address: string): Promise<boolean>
}

export function createTrustedIssuerRegistryClient(opts?: {
  address?: string
  rpcUrl?: string
  provider?: providers.Provider
}): TrustedIssuerRegistryClient {
  const address = (opts?.address ?? config.diamond?.address)?.trim()
  if (!address) throw new Error('Trusted issuer registry address is not configured')

  const provider = opts?.provider ?? new providers.JsonRpcProvider(opts?.rpcUrl ?? config.blockchain.rpcUrl)
  const contract = new Contract(address, trustedIssuerRegistryAbi, provider)

  return {
    address: contract.address,
    provider,
    contract,
    async isTrustedIssuer(issuer: string): Promise<boolean> {
      if (!issuer) return false
      let normalized: string
      try {
        normalized = utils.getAddress(issuer)
      } catch (err) {
        throw new Error(`invalid issuer address: ${issuer}`)
      }

      // Verify contract exists before calling
      try {
        const code = await provider.getCode(address)
        if (code === '0x' || code.length <= 2) {
          throw new Error(`No contract code found at address ${address}. Contract may not be deployed.`)
        }
      } catch (err: any) {
        if (err.message.includes('No contract code')) throw err
        // If getCode fails, continue anyway - might be network issue
        console.warn(`[TrustedIssuerRegistry] Could not verify contract code: ${err.message}`)
      }

      try {
        const result: boolean = await contract.isTrustedIssuer(normalized)
        return result
      } catch (err: any) {
        // Provide more detailed error information
        const errorMessage = err?.message || String(err)
        const errorCode = err?.code
        const errorData = err?.data

        // Check if it's a "function does not exist" error from Diamond
        if (errorMessage.includes('Function does not exist') ||
          errorMessage.includes('Diamond: Function does not exist')) {
          throw new Error(`Function isTrustedIssuer not found in Diamond at ${address}. TrustedIssuerFacet may not be installed.`)
        }

        // Check if it's a call exception (contract not responding)
        if (errorCode === 'CALL_EXCEPTION' || errorMessage.includes('CALL_EXCEPTION')) {
          throw new Error(`Contract call failed at ${address}. Error: ${errorMessage}. This may indicate the contract is not deployed or the RPC is not accessible.`)
        }

        throw err
      }
    },
  }
}
