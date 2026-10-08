import {
    TrustedIssuerRegistryClient,
    createTrustedIssuerRegistryClient,
    hashVC,
    createLogger,
    subjectAddress,
} from '@circuloos/common'
import { config } from '../config'
import { ethers } from 'ethers'

const logger = createLogger('registry-service')

/** Where the issuer backend records credential status on-chain, and the key it signs with. */
export interface OnchainConfig {
    diamondAddress?: string
    rpcUrl?: string
    signerKey?: string
}

export interface RegistryServiceOptions {
    /** Defaults to the app config (DIAMOND address, RPC_URL, issuer private key). */
    onchain?: OnchainConfig
    /**
     * Without a trusted issuer registry, refuse every issuer instead of accepting all of them.
     * Defaults to true in production: "only trusted issuers issue" must not depend on configuration.
     */
    requireRegistry?: boolean
}

export class RegistryService {
    private trustedIssuerRegistry?: TrustedIssuerRegistryClient
    // Factory for dependency injection/mocking
    private createCredentialRegistryFn?: (address: string, signerOrProvider: any) => any
    private onchainOverride?: OnchainConfig
    private requireRegistry: boolean

    constructor(
        trustedIssuerRegistry?: TrustedIssuerRegistryClient,
        createCredentialRegistryFn?: (address: string, signerOrProvider: any) => any,
        options: RegistryServiceOptions = {}
    ) {
        this.createCredentialRegistryFn = createCredentialRegistryFn
        this.onchainOverride = options.onchain
        this.requireRegistry = options.requireRegistry ?? config.nodeEnv === 'production'

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
        // No registry: open in development, closed in production (or when requireRegistry is set)
        if (!this.trustedIssuerRegistry) return !this.requireRegistry
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

    /** Injected settings, or the app config read at call time. */
    private get onchain(): OnchainConfig {
        return this.onchainOverride ?? {
            diamondAddress: config.diamond?.address,
            rpcUrl: config.blockchain.rpcUrl,
            signerKey: config.issuer.privateKey,
        }
    }

    /** Whether credential status is recorded on-chain at all (address, RPC and signer configured). */
    isOnchainConfigured(): boolean {
        const { diamondAddress, rpcUrl, signerKey } = this.onchain
        return Boolean(diamondAddress && rpcUrl && signerKey)
    }

    private async credentialRegistry(): Promise<any> {
        const { diamondAddress, rpcUrl, signerKey } = this.onchain
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
        const signer = new ethers.Wallet(signerKey!, provider)
        if (this.createCredentialRegistryFn) return this.createCredentialRegistryFn(diamondAddress!, signer)
        const { createCredentialRegistry } = await import('../onchain')
        return createCredentialRegistry(diamondAddress!, signer)
    }

    /**
     * Revokes the credential on-chain (CredentialStatusFacet.revokeCredential), signed by the
     * backend key that recorded it — the contract only lets the recording issuer revoke.
     * `null` when on-chain status is not configured; throws if the transaction fails.
     */
    async revokeOnChain(vc: any): Promise<{ txHash: string; blockNumber: number } | null> {
        if (!this.isOnchainConfigured()) return null
        const registry = await this.credentialRegistry()
        const tx = await registry.revokeCredential(hashVC(vc))
        const receipt = await tx.wait()
        return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }
    }

    async recordIssuance(vc: any): Promise<{ txHash: string; blockNumber: number } | null> {
        const { diamondAddress: registryAddress, rpcUrl, signerKey } = this.onchain

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
            // The contract takes the subject ADDRESS; credentialSubject.id is a DID (fix P11)
            const subjectAddr = subjectAddress(vc.credentialSubject)

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
