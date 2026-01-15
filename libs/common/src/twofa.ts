import { createHmac } from 'crypto'

export function createToken(payload: Record<string, any>, secret: string, ttlSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const body = { ...payload, exp }
  // Use base64url encoding for URL-safe tokens (replaces + with -, / with _, removes = padding)
  const base64Data = Buffer.from(JSON.stringify(body)).toString('base64')
  const data = base64Data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const sig = createHmac('sha256', secret).update(data).digest('hex')
  return `${data}.${sig}`
}

export function verifyToken(token: string, secret: string): { ok: boolean; payload?: any; error?: string } {
  try {
    // Validate token format
    if (!token || typeof token !== 'string') {
      return { ok: false, error: 'Token is not a string' }
    }
    
    const [data, sig] = token.split('.')
    if (!data || !sig) {
      return { ok: false, error: 'Invalid token format: missing parts' }
    }
    
    // Verify signature - try both base64url (new format) and base64 (old format) for compatibility
    // First try with data as-is (base64url format for new tokens)
    let expected = createHmac('sha256', secret).update(data).digest('hex')
    let isValidSignature = expected === sig
    
    // If signature doesn't match, try with base64 format (for backward compatibility with old tokens)
    if (!isValidSignature) {
      // Convert base64url to base64 for signature verification
      const base64Data = data.replace(/-/g, '+').replace(/_/g, '/')
      const padding = base64Data.length % 4
      const paddedData = padding ? base64Data + '='.repeat(4 - padding) : base64Data
      expected = createHmac('sha256', secret).update(paddedData).digest('hex')
      isValidSignature = expected === sig
    }
    
    if (!isValidSignature) {
      return { ok: false, error: 'Invalid token signature' }
    }
    
    // Decode and parse payload
    // Handle both base64 and base64url encoding for backward compatibility
    let payload: any
    try {
      // Check if it's base64url (contains - or _) or base64
      const isBase64Url = data.includes('-') || data.includes('_')
      
      if (isBase64Url) {
        // Convert base64url back to base64
        const base64Data = data.replace(/-/g, '+').replace(/_/g, '/')
        // Add padding if needed
        const padding = base64Data.length % 4
        const paddedData = padding ? base64Data + '='.repeat(4 - padding) : base64Data
        payload = JSON.parse(Buffer.from(paddedData, 'base64').toString('utf8'))
      } else {
        // Standard base64
        payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
      }
    } catch (parseErr) {
      return { ok: false, error: 'Invalid token payload: cannot parse' }
    }
    
    // Check expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return { ok: false, error: 'Token has expired' }
    }
    
    return { ok: true, payload }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Token verification failed' }
  }
}
