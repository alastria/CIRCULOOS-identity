import {
    TrustedIssuerRegistryClient,
    createTrustedIssuerRegistryClient,
    hashVC,
    createLogger,
} from '@circuloos/common'
import { config } from '../config'
import { ethers } from 'ethers'

const logger = createLogger('registry-service')

export class RegistryService {
    private trustedIssuerRegistry?: TrustedIssuerRegistryClient
    // Factory for dependency injection/mocking
    private createCredentialRegistryFn?: (address: string, signerOrProvider: any) => any

    constructor(
        trustedIssuerRegistry?: TrustedIssuerRegistryClient,
        createCredentialRegistryFn?: (address: string, signerOrProvider: any) => any
    ) {
        this.createCredentialRegistryFn = createCredentialRegistryFn

        if (trustedIssuerRegistry) {
            this.trustedIssuerRegistry = trustedIssuerRegistry
        } else if (config.diamond?.address) {
            this.trustedIssuerRegistry = createTrustedIssuerRegistryClient({
                address: config.diamond.address,
                rpcUrl: config.blockchain.rpcUrl,
            })
        }
    }

    getTrustedRegistryAddress(): string | undefined {
        return this.trustedIssuerRegistry?.address
    }

    async isTrustedIssuer(address: string): Promise<boolean> {
        if (!this.trustedIssuerRegistry) return true // If no registry configured, assume trusted (or handle as policy)
        try {
            return await this.trustedIssuerRegistry.isTrustedIssuer(address)
        } catch (err: any) {
            const errorMessage = err?.message || String(err)
            // Log detailed error for debugging
            logger.error(`[RegistryService] Error checking trusted issuer:`, {
                address,
                registryAddress: this.trustedIssuerRegistry.address,
                error: errorMessage,
                errorCode: err?.code,
                errorData: err?.data
            })
            throw new Error(`failed to check issuer against trusted registry: ${errorMessage}`)
        }
    }

    async recordIssuance(vc: any): Promise<{ txHash: string; blockNumber: number } | null> {
        const registryAddress = config.diamond?.address
        const rpcUrl = config.blockchain.rpcUrl
        const signerKey = config.issuer.privateKey

        if (!registryAddress || !rpcUrl || !signerKey) {
            return null
        }

        try {
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
            const signer = new ethers.Wallet(signerKey, provider)

            let credentialRegistry: any
            if (this.createCredentialRegistryFn) {
                credentialRegistry = this.createCredentialRegistryFn(registryAddress, signer)
            } else {
                // Dynamic import to avoid circular deps if any, or just standard import
                const { createCredentialRegistry } = await import('../onchain')
                credentialRegistry = createCredentialRegistry(registryAddress, signer)
            }

            const vcHash = hashVC(vc)
            const subjectAddr = vc.credentialSubject?.id || vc.credentialSubject?.holderAddress || ethers.constants.AddressZero

            const tx = await credentialRegistry.recordIssuance(vcHash, subjectAddr)
            const receipt = await tx.wait()

            return {
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber
            }
        } catch (err: any) {
            logger.error('on-chain recordIssuance failed:', err?.message || err)
            return null
        }
    }
}
