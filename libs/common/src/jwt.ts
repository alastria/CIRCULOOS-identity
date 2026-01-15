import { VC } from './types'

export function encodeEIP712Jwt(header: Record<string, any>, payload: Record<string, any>, signatureHex: string): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signatureHex.replace(/^0x/, '')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function decodeEIP712Jwt(token: string): { header: any, payload: any, signature: string } {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
    signature: parts[2]
  }
}

export function sanitizeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return obj.toString()
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt)
  if (typeof obj === 'object') {
    const out: any = {}
    for (const k of Object.keys(obj)) out[k] = sanitizeBigInt(obj[k])
    return out
  }
  return obj
}
