/**
 * Relying parties (e.g. the IoT fleet panel) import the login module on its own, through the
 * `@circuloos/common/login` subpath. It must work in isolation: register the employee EIP-712
 * schema it verifies with, and never load the issuer/verifier configuration (which validates
 * environment variables and production secrets at import time).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const ENV_KEYS = ['RPC_URL', 'CHAIN_ID', 'APP_PUBLIC_URL', 'NODE_ENV', 'JWT_SECRET']

describe('login module imported on its own', () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    vi.resetModules()
  })

  it('registers the employee schema it needs, and loads without any identity configuration (even in production)', async () => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    process.env.NODE_ENV = 'production'
    vi.resetModules()

    const login = await import('../src/login')
    const { getCredentialType } = await import('../src/eip712/registry')

    expect(typeof login.verifyEmployeeLogin).toBe('function')
    expect(getCredentialType('circuloos-employee')).toBeDefined()
  })
})
