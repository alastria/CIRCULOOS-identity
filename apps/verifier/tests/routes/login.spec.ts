/**
 * Plan A3 — POST /api/v1/login/challenge and /api/v1/login/verify (employee credential login).
 * The verification logic itself is covered in libs/common/tests/login.spec.ts and against a
 * real chain in apps/issuer/tests/integration; this covers the HTTP contract.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { Wallet } from 'ethers'
import {
  buildEmployeeVC,
  buildCredentialProof,
  buildLoginTypedData,
  hashVC,
  signCredentialIssuance,
  EMPLOYEE_SCHEMA_ID,
  InMemoryLoginChallengeStore,
} from '@circuloos/common'
import loginRoutes, { type LoginRoutesOptions } from '../../src/routes/login'

const issuer = new Wallet('0x' + 'a1'.repeat(32))
const holder = new Wallet('0x' + 'b2'.repeat(32))
const other = new Wallet('0x' + 'c3'.repeat(32))
const CHAIN_ID = 31337
const ORG = { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678', addressCountry: 'ES' }
const issuerDomain = { name: 'TrustedIssuerRegistry', version: '1.0', chainId: CHAIN_ID, verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3' }

async function issuedCredential() {
  const vc: any = buildEmployeeVC({
    holderAddress: holder.address,
    organization: ORG,
    issuer: `did:alastria:quorum:${issuer.address}`,
    validFrom: new Date(Date.now() - 60_000),
  })
  const signature = await signCredentialIssuance(issuer.privateKey, issuerDomain, vc, EMPLOYEE_SCHEMA_ID)
  return { ...vc, proof: buildCredentialProof({ signature, signer: issuer.address, domain: issuerDomain }) }
}

describe('Login routes (A3)', () => {
  let server: FastifyInstance
  let vc: any

  async function build(overrides: Partial<LoginRoutesOptions> = {}) {
    vc = await issuedCredential()
    const options: LoginRoutesOptions = {
      challenges: new InMemoryLoginChallengeStore(),
      isTrustedIssuer: async (a) => a.toLowerCase() === issuer.address.toLowerCase(),
      credentialStatus: async (hash) => ({ issued: hash === hashVC(vc), revoked: false, suspended: false, issuer: issuer.address }),
      ...overrides,
    }
    server = Fastify({ logger: false })
    await server.register(loginRoutes, { prefix: '/api/v1', ...options })
    await server.ready()
  }

  afterEach(async () => {
    await server?.close()
  })

  async function challengeFor(address: string, audience = 'iot-manager') {
    const res = await server.inject({ method: 'POST', url: '/api/v1/login/challenge', payload: { holderAddress: address, audience } })
    expect(res.statusCode).toBe(200)
    return res.json()
  }

  async function verify(signer: Wallet, challenge: any) {
    const { domain, types, message } = buildLoginTypedData(vc, challenge)
    const signature = await signer._signTypedData(domain, types, message)
    return server.inject({
      method: 'POST',
      url: '/api/v1/login/verify',
      payload: { credential: vc, signature, nonce: challenge.nonce, audience: challenge.audience },
    })
  }

  describe('with on-chain status available', () => {
    beforeEach(async () => build())

    it('issues a challenge bound to the holder and audience (no chain id: D5)', async () => {
      const challenge = await challengeFor(holder.address)
      expect(challenge).toMatchObject({ audience: 'iot-manager', holder: holder.address.toLowerCase() })
      expect(challenge.chainId).toBeUndefined()
      expect(challenge.nonce).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('A3.1 verifies the holder and returns the organisation', async () => {
      const res = await verify(holder, await challengeFor(holder.address))
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ ok: true, holder: holder.address.toLowerCase(), organization: ORG })
    })

    it('A3.2 someone else presenting the credential → 401 HOLDER_MISMATCH', async () => {
      const res = await verify(other, await challengeFor(other.address))
      expect(res.statusCode).toBe(401)
      expect(res.json()).toMatchObject({ ok: false, code: 'HOLDER_MISMATCH' })
    })

    it('A3.3 replaying the same login → 401 CHALLENGE_INVALID', async () => {
      const challenge = await challengeFor(holder.address)
      const { domain, types, message } = buildLoginTypedData(vc, challenge)
      const payload = { credential: vc, signature: await holder._signTypedData(domain, types, message), nonce: challenge.nonce, audience: 'iot-manager' }

      expect((await server.inject({ method: 'POST', url: '/api/v1/login/verify', payload })).statusCode).toBe(200)
      const replay = await server.inject({ method: 'POST', url: '/api/v1/login/verify', payload })
      expect(replay.statusCode).toBe(401)
      expect(replay.json().code).toBe('CHALLENGE_INVALID')
    })

    it('rejects a challenge request without a valid holder address or audience', async () => {
      const bad = await server.inject({ method: 'POST', url: '/api/v1/login/challenge', payload: { holderAddress: 'nope', audience: 'iot-manager' } })
      expect(bad.statusCode).toBe(400)
      const noAudience = await server.inject({ method: 'POST', url: '/api/v1/login/challenge', payload: { holderAddress: holder.address } })
      expect(noAudience.statusCode).toBe(400)
    })
  })

  it('fails closed without an on-chain status source → 401 STATUS_UNAVAILABLE', async () => {
    await build({ credentialStatus: undefined })
    const res = await verify(holder, await challengeFor(holder.address))
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('STATUS_UNAVAILABLE')
  })
})
