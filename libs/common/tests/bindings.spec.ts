import { describe, it, expect } from 'vitest'
import { buildEmailBinding, verifyEmailBinding, normalizeEmail } from '../src/bindings'

describe('email bindings', () => {
  it('normalizes emails to lowercase without surrounding whitespace', () => {
    expect(normalizeEmail(' Example@TEST.COM ')).toBe('example@test.com')
  })

  it('builds and verifies an email binding', () => {
    const binding = buildEmailBinding('user@example.test', 'secret', 'salt')
    expect(binding.algorithm).toBe('HMAC-SHA256')
    expect(binding.digest).toMatch(/^[0-9a-f]{64}$/)
    const valid = verifyEmailBinding('user@example.test', binding, 'secret')
    expect(valid).toBe(true)
    const invalid = verifyEmailBinding('other@example.test', binding, 'secret')
    expect(invalid).toBe(false)
  })
})
