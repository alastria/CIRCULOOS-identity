import { randomInt, createHmac } from 'crypto'

export function generateOtp(digits = 6) {
  return ('' + randomInt(0, Math.pow(10, digits) - 1)).padStart(digits, '0')
}

export function hmacOtp(secret: string, otp: string) {
  return createHmac('sha256', secret).update(otp).digest('hex')
}

export function expiresAt(seconds: number) {
  return Date.now() + seconds * 1000
}

export function verifyOtp(secret: string, otp: string, expectedHash: string) {
  return hmacOtp(secret, otp) === expectedHash
}
