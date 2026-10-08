import {
    TrustedIssuerRegistryClient,
    createTrustedIssuerRegistryClient,
    hashVC,
    createLogger,
    subjectAddress,
    Web3SignerSigner,
} from '@circuloos/common'
import { config } from '../config'
import { ethers } from 'ethers'

const logger = createLogger('registry-service')

/** Where the issuer backend records credential status on-chain, and the key it signs with. */
export interface OnchainConfig {
    diamondAddress?: string
    rpcUrl?: string
    /** Raw private key — local development only. */
    signerKey?: string
    /** Web3Signer (preferred, required on Red-B): on-chain writes are signed there by `signerAddress`. */
    web3signerUrl?: string
    signerAddress?: string
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
            web3signerUrl: config.issuer.web3signerUrl,
            signerAddress: config.issuer.onchainSignerAddress,
        }
    }

    /** Web3Signer when configured; otherwise the raw development key. */
    private hasSigner(): boolean {
        const { signerKey, web3signerUrl, signerAddress } = this.onchain
        return Boolean((web3signerUrl && signerAddress) || signerKey)
    }

    private signer(provider: ethers.providers.JsonRpcProvider): ethers.Signer {
        const { signerKey, web3signerUrl, signerAddress } = this.onchain
        if (web3signerUrl && signerAddress) return new Web3SignerSigner(web3signerUrl, signerAddress, provider)
        return new ethers.Wallet(signerKey!, provider)
    }

    /** Whether credential status is recorded on-chain at all (address, RPC and signer configured). */
    isOnchainConfigured(): boolean {
        const { diamondAddress, rpcUrl } = this.onchain
        return Boolean(diamondAddress && rpcUrl && this.hasSigner())
    }

    private async credentialRegistry(): Promise<any> {
        const { diamondAddress, rpcUrl } = this.onchain
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
        const signer = this.signer(provider)
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
        if (!this.isOnchainConfigured()) {
            return null
        }

        try {
            const credentialRegistry = await this.credentialRegistry()

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
