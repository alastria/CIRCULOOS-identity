import { ethers } from 'ethers'
import { database } from './database'
import crypto from 'crypto'
import { createLogger } from '@circuloos/common'

// Auth nonce expiry in milliseconds (default: 5 minutes)
import { config } from '../config'

const logger = createLogger('auth-service')
const AUTH_NONCE_EXPIRY_MS = (config.security.nonceExpirySeconds || 300) * 1000

export const authService = {
    generateNonce(address: string): string {
        const nonce = `Sign this message to prove ownership of ${address}: ${crypto.randomBytes(16).toString('hex')}`
        const expiresAt = Date.now() + AUTH_NONCE_EXPIRY_MS
        database.saveNonce(address, nonce, expiresAt)
        return nonce
    },

    verifySignature(address: string, signature: string): boolean {
        const record = database.getNonce(address)
        if (!record) return false

        if (Date.now() > record.expires_at) {
            database.deleteNonce(address)
            return false
        }

        try {
            const recoveredAddress = ethers.utils.verifyMessage(record.nonce, signature)
            const isValid = recoveredAddress.toLowerCase() === address.toLowerCase()

            // Invalidate nonce after use (prevent replay)
            if (isValid) {
                database.deleteNonce(address)
            }

            return isValid
        } catch (err) {
            logger.error('Signature verification failed:', err)
            return false
        }
    }
}
