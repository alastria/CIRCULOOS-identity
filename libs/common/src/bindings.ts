import { createHmac, randomBytes } from 'crypto'

export type EmailBinding = {
  algorithm: 'HMAC-SHA256'
  salt: string
  digest: string
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function generateSalt(bytes = 16): string {
  return randomBytes(bytes).toString('hex')
}

export function buildEmailBinding(email: string, secret: string, salt?: string): EmailBinding {
  if (!secret) throw new Error('Secret is required to build email binding')
  const normalized = normalizeEmail(email)
  const effectiveSalt = salt || generateSalt()
  const digest = createHmac('sha256', secret).update(`${effectiveSalt}:${normalized}`).digest('hex')
  return {
    algorithm: 'HMAC-SHA256',
    salt: effectiveSalt,
    digest,
  }
}

export function verifyEmailBinding(email: string, binding: EmailBinding, secret: string): boolean {
  if (!binding || binding.algorithm !== 'HMAC-SHA256') return false
  const expected = buildEmailBinding(email, secret, binding.salt)
  return expected.digest === binding.digest
}
