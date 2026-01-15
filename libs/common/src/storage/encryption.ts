/**
 * Encryption utilities for secure credential storage
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32
const KEY_LENGTH = 32

/**
 * Derive a 256-bit key from a password/secret using scrypt
 */
export function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH)
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: salt (32) + iv (16) + authTag (16) + ciphertext (base64)
 */
export function encrypt(plaintext: string, encryptionKey: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(encryptionKey, salt)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ])

  return combined.toString('base64')
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(encryptedData: string, encryptionKey: string): string {
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  const key = deriveKey(encryptionKey, salt)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * Hash sensitive data for indexing (one-way)
 * Used for holder_address index without exposing the actual address
 */
export function hashForIndex(value: string, pepper: string): string {
  return createHash('sha256')
    .update(value.toLowerCase() + pepper)
    .digest('hex')
}

/**
 * Check if a string looks like encrypted data (base64 with correct length)
 */
export function isEncrypted(data: string): boolean {
  try {
    const decoded = Buffer.from(data, 'base64')
    // Minimum length: salt (32) + iv (16) + authTag (16) + at least 1 byte ciphertext
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1
  } catch {
    return false
  }
}
