import { describe, it, expect } from 'vitest'
import { canonicalize, hashVC } from '../src/hash'

describe('hash utilities', () => {
  it('canonicalize sorts object keys deterministically', () => {
    const a = { b: 2, a: 1 }
    const c = { a: 1, b: 2 }
    expect(canonicalize(a)).toEqual(canonicalize(c))
  })

  it('canonicalize handles arrays and nested objects deterministically', () => {
    const x = { arr: [ { z: 3, y: 2 }, 1 ] }
    const y = { arr: [ { y: 2, z: 3 }, 1 ] }
    expect(canonicalize(x)).toEqual(canonicalize(y))
  })

  it('hashVC returns a keccak256 hex string of 32 bytes', () => {
    const vc = { id: 'vc1', credentialSubject: { name: 'Alice' } }
    const h = hashVC(vc)
    expect(typeof h).toBe('string')
    // keccak256 hex string starts with 0x and is 66 chars
    expect(h.startsWith('0x')).toBe(true)
    expect(h.length).toBe(66)
  })
})
