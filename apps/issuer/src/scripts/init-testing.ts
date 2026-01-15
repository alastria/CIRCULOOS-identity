import { ethers } from 'ethers'
import { SqlJsStorageAdapter } from '@circuloos/common'
import { config } from '../config'

/**
 * Initialize testing environment
 * Auto-adds Diamond owner as a trusted issuer for development/testing
 *
 * This script:
 * 1. Derives owner address from DIAMOND_OWNER_PRIVATE_KEY
 * 2. Checks if owner is already a trusted issuer
 * 3. If not, calls diamond.addTrustedIssuer(ownerAddress)
 * 4. Waits for IssuerAdded event to be emitted
 * 5. BlockchainSyncService will capture the event and save to SQLite3
 */
export async function initTestingEnvironment(
    provider: ethers.providers.Provider,
    diamondAddress: string,
    trustedIssuerAbi: any[],
    storage: SqlJsStorageAdapter
): Promise<void> {
    const ownerPrivateKey = config.issuer.privateKey
    if (!ownerPrivateKey) {
        console.warn('DIAMOND_OWNER_PRIVATE_KEY not set - skipping auto-issuer initialization')
        return
    }

    // Derive owner address
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider)
    const ownerAddress = ownerWallet.address

    console.log(`Diamond Owner Address: ${ownerAddress}`)

    // Check if owner is already a trusted issuer in SQLite3
    const trustedIssuers = await storage.getTrustedIssuers({ active: true })
    const isAlreadyTrusted = trustedIssuers.some(
        (issuer: any) => issuer.address.toLowerCase() === ownerAddress.toLowerCase()
    )

    if (isAlreadyTrusted) {
        console.log('Owner is already a trusted issuer (found in SQLite3)')
        return
    }

    // Check on-chain if owner is trusted
    const diamond = new ethers.Contract(diamondAddress, trustedIssuerAbi, provider)
    const isOnChainTrusted = await diamond.isTrustedIssuer(ownerAddress)

    if (isOnChainTrusted) {
        console.log('Owner is trusted on-chain but not synced yet - waiting for sync...')
        // Give blockchainSyncService time to sync the event
        await new Promise(resolve => setTimeout(resolve, 2000))
        return
    }

    // Owner is not a trusted issuer - add them
    console.log('Adding owner as trusted issuer...')

    try {
        const diamondWithSigner = diamond.connect(ownerWallet)
        const tx = await diamondWithSigner.addTrustedIssuer(ownerAddress)
        console.log(`Transaction sent: ${tx.hash}`)

        const receipt = await tx.wait()
        console.log(`Owner added as trusted issuer at block ${receipt.blockNumber}`)
        console.log(`   Event will be captured by BlockchainSyncService → SQLite3`)

        // Give blockchainSyncService time to capture and process the event
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Verify it was saved to SQLite3
        const updatedIssuers = await storage.getTrustedIssuers({ active: true })
        const wasAdded = updatedIssuers.some(
            (issuer: any) => issuer.address.toLowerCase() === ownerAddress.toLowerCase()
        )

        if (wasAdded) {
            console.log('Owner successfully synced to SQLite3 - SIWA will work!')
        } else {
            console.warn('Owner not found in SQLite3 yet - sync may still be running')
        }

    } catch (error: any) {
        if (error.message?.includes('IssuerAlreadyTrusted')) {
            console.log('Owner is already a trusted issuer on-chain')
        } else {
            console.error('Failed to add owner as trusted issuer:', error.message)
            throw error
        }
    }
}
