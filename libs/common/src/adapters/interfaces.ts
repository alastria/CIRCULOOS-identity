/**
 * Adapter interfaces for dependency injection
 * Enables clean separation and testability
 */

export interface IEmailAdapter {
    sendEmail(to: string, subject: string, body: string): Promise<void>
}

export interface IRegistryAdapter {
    /**
     * Check if an address is a trusted issuer
     */
    isTrustedIssuer(address: string): Promise<boolean>

    /**
     * Record a VC issuance on-chain
     * Returns transaction receipt or null if not configured
     */
    recordIssuance(vc: any): Promise<{ txHash: string, blockNumber: number } | null>

    /**
     * Get the trusted registry address (if configured)
     */
    getTrustedRegistryAddress(): string | undefined
}
