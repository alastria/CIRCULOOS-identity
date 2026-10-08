/**
 * Plan A2.1: "only trusted issuers issue" must not depend on configuration.
 * Without a trusted issuer registry, RegistryService refuses every issuer when
 * requireRegistry is set (the default in production) and stays open otherwise.
 */
import { describe, it, expect } from 'vitest'
import { RegistryService } from '../../src/services/registry.service'

const ISSUER = '0x' + '12'.repeat(20)
const NO_ONCHAIN = { onchain: {} }

describe('RegistryService without a trusted issuer registry', () => {
  it('refuses every issuer when the registry is required (production default)', async () => {
    const registry = new RegistryService(undefined, undefined, { ...NO_ONCHAIN, requireRegistry: true })
    expect(await registry.isTrustedIssuer(ISSUER)).toBe(false)
  })

  it('accepts issuers when the registry is not required (development)', async () => {
    const registry = new RegistryService(undefined, undefined, { ...NO_ONCHAIN, requireRegistry: false })
    expect(await registry.isTrustedIssuer(ISSUER)).toBe(true)
  })

  it('reports on-chain status recording as not configured, and does not try to revoke on-chain', async () => {
    const registry = new RegistryService(undefined, undefined, NO_ONCHAIN)
    expect(registry.isOnchainConfigured()).toBe(false)
    expect(await registry.revokeOnChain({ id: 'urn:uuid:x' })).toBeNull()
  })
})
