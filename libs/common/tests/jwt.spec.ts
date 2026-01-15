/// <reference types="vitest" />
import { encodeEIP712Jwt, decodeEIP712Jwt } from '../src/jwt'

describe('jwt encode/decode', () => {
  console.log('[TEST] common jwt tests')
  it('encodes and decodes a token', () => {
    const header = { alg: 'none' }
    const payload = { foo: 'bar' }
    const sig = 'deadbeef'
    const token = encodeEIP712Jwt(header, payload, sig)
    const parsed = decodeEIP712Jwt(token)
    expect(parsed.header).toEqual(header)
    expect(parsed.payload).toEqual(payload)
    expect(parsed.signature).toEqual(sig)
  })
})
