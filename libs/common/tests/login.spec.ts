/**
 * Plan A3 — secure verification of an employee credential to log in to a relying party
 * (e.g. the CIRCULOOS IoT fleet panel). Fixes advisory P3 for this use.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Wallet } from 'ethers'
import { buildEmployeeVC, EMPLOYEE_SCHEMA_ID } from '../src/employee'
import { signCredentialIssuance, buildCredentialProof } from '../src/eip712'
import { hashVC } from '../src/hash'
import {
  InMemoryLoginChallengeStore,
  buildLoginTypedData,
  verifyEmployeeLogin,
  type CredentialStatusRecord,
  type LoginVerificationDeps,
} from '../src/login'

const issuer = new Wallet('0x' + 'a1'.repeat(32))
const holder = new Wallet('0x' + 'b2'.repeat(32))
const other = new Wallet('0x' + 'c3'.repeat(32))
const rogueIssuer = new Wallet('0x' + 'd4'.repeat(32))
const CHAIN_ID = 31337
const AUDIENCE = 'iot-manager'
const issuerDomain = { name: 'TrustedIssuerRegistry', version: '1.0', chainId: CHAIN_ID, verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3' }
const ORG = { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678', addressCountry: 'ES' }

async function issue(opts: { signer?: Wallet; validFrom?: Date; validityDays?: number; holderAddress?: string } = {}) {
  const vc: any = buildEmployeeVC({
    holderAddress: opts.holderAddress ?? holder.address,
    organization: ORG,
    issuer: `did:alastria:quorum:${(opts.signer ?? issuer).address}`,
    // A minute in the past: the tests' clock (now) is captured before issuing
    validFrom: opts.validFrom ?? new Date(Date.now() - 60_000),
    validityDays: opts.validityDays,
  })
  const signer = opts.signer ?? issuer
  const signature = await signCredentialIssuance(signer.privateKey, issuerDomain, vc, EMPLOYEE_SCHEMA_ID)
  return { ...vc, proof: buildCredentialProof({ signature, signer: signer.address, domain: issuerDomain }) }
}

describe('A3 — employee login verification', () => {
  let challenges: InMemoryLoginChallengeStore
  let status: Map<string, CredentialStatusRecord>
  let deps: LoginVerificationDeps
  let now: Date

  beforeEach(() => {
    now = new Date()
    challenges = new InMemoryLoginChallengeStore({ ttlSeconds: 120, now: () => now })
    status = new Map()
    deps = {
      challenges,
      chainId: CHAIN_ID,
      isTrustedIssuer: async (address) => address.toLowerCase() === issuer.address.toLowerCase(),
      credentialStatus: async (hash) => status.get(hash) ?? { issued: false, revoked: false, suspended: false, issuer: '0x' + '00'.repeat(20) },
      now: () => now,
    }
  })

  /** Records the credential on "chain" as issued by `recordedBy` (the issuer backend key in reality). */
  function record(vc: any, patch: Partial<CredentialStatusRecord> = {}) {
    status.set(hashVC(vc), { issued: true, revoked: false, suspended: false, issuer: issuer.address, ...patch })
  }

  async function login(vc: any, signer: Wallet = holder, opts: { audience?: string; challengeAudience?: string; nonce?: string } = {}) {
    const challenge = await challenges.issue(signer.address, opts.challengeAudience ?? AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    const signature = await signer._signTypedData(domain, types, message)
    return verifyEmployeeLogin({ credential: vc, signature, nonce: opts.nonce ?? challenge.nonce, audience: opts.audience ?? AUDIENCE }, deps)
  }

  it('A3.1 a valid employee credential, signed challenge by its holder → verified holder and organisation', async () => {
    const vc = await issue()
    record(vc)

    const result = await login(vc)

    expect(result).toMatchObject({
      ok: true,
      holder: holder.address.toLowerCase(),
      organization: ORG,
      credentialId: vc.id,
      credentialHash: hashVC(vc),
      issuer: issuer.address.toLowerCase(),
    })
  })

  it('A3.1 also accepts the credential wrapped in the presentation stored after the claim', async () => {
    const vc = await issue()
    record(vc)
    const challenge = await challenges.issue(holder.address, AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    const signature = await holder._signTypedData(domain, types, message)

    const result = await verifyEmployeeLogin(
      { credential: { type: ['VerifiablePresentation'], verifiableCredential: [vc] }, signature, nonce: challenge.nonce, audience: AUDIENCE },
      deps,
    )
    expect(result.ok).toBe(true)
  })

  it('A3.2 someone else presenting the holder\'s credential is rejected (signer is not the holder)', async () => {
    const vc = await issue()
    record(vc)
    expect(await login(vc, other)).toMatchObject({ ok: false, code: 'HOLDER_MISMATCH' })
  })

  it('A3.3 a challenge cannot be used twice', async () => {
    const vc = await issue()
    record(vc)
    const challenge = await challenges.issue(holder.address, AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    const signature = await holder._signTypedData(domain, types, message)
    const input = { credential: vc, signature, nonce: challenge.nonce, audience: AUDIENCE }

    expect((await verifyEmployeeLogin(input, deps)).ok).toBe(true)
    expect(await verifyEmployeeLogin(input, deps)).toMatchObject({ ok: false, code: 'CHALLENGE_INVALID' })
  })

  it('A3.3 an expired challenge is rejected', async () => {
    const vc = await issue()
    record(vc)
    const challenge = await challenges.issue(holder.address, AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    const signature = await holder._signTypedData(domain, types, message)
    now = new Date(now.getTime() + 121_000)

    expect(await verifyEmployeeLogin({ credential: vc, signature, nonce: challenge.nonce, audience: AUDIENCE }, deps)).toMatchObject({
      ok: false,
      code: 'CHALLENGE_EXPIRED',
    })
  })

  it('A3.3 a challenge issued for another audience is rejected', async () => {
    const vc = await issue()
    record(vc)
    expect(await login(vc, holder, { challengeAudience: 'marketplace' })).toMatchObject({ ok: false, code: 'CHALLENGE_INVALID' })
  })

  it('A3.3 an unknown nonce is rejected', async () => {
    const vc = await issue()
    record(vc)
    expect(await login(vc, holder, { nonce: '0x' + 'ff'.repeat(32) })).toMatchObject({ ok: false, code: 'CHALLENGE_INVALID' })
  })

  it('A3.4 an expired credential is rejected', async () => {
    const vc = await issue({ validFrom: new Date(Date.now() - 400 * 86400_000), validityDays: 365 })
    record(vc)
    expect(await login(vc)).toMatchObject({ ok: false, code: 'EXPIRED' })
  })

  it('A3.4 a credential revoked on-chain is rejected', async () => {
    const vc = await issue()
    record(vc, { revoked: true })
    expect(await login(vc)).toMatchObject({ ok: false, code: 'REVOKED' })
  })

  it('A3.4 a credential suspended on-chain is rejected', async () => {
    const vc = await issue()
    record(vc, { suspended: true })
    expect(await login(vc)).toMatchObject({ ok: false, code: 'SUSPENDED' })
  })

  it('A3.4 a credential signed by an issuer that is not trusted is rejected', async () => {
    const vc = await issue({ signer: rogueIssuer })
    record(vc, { issuer: rogueIssuer.address })
    expect(await login(vc)).toMatchObject({ ok: false, code: 'UNTRUSTED_ISSUER' })
  })

  it('A3.4 a credential with the organisation altered is rejected (invalid signature)', async () => {
    const vc = await issue()
    record(vc)
    const forged = JSON.parse(JSON.stringify(vc))
    forged.credentialSubject.worksFor.taxID = 'ESA87654321'
    expect(await login(forged)).toMatchObject({ ok: false, code: 'INVALID_ISSUER_SIGNATURE' })
  })

  it('A3.4 a credential never recorded on-chain is rejected', async () => {
    const vc = await issue()
    expect(await login(vc)).toMatchObject({ ok: false, code: 'NOT_RECORDED' })
  })

  it('A3.4 a status record created by an untrusted address is rejected (P14, defence in depth)', async () => {
    const vc = await issue()
    record(vc, { issuer: rogueIssuer.address })
    expect(await login(vc)).toMatchObject({ ok: false, code: 'STATUS_ISSUER_UNTRUSTED' })
  })

  it('A3.4 without an on-chain status source the login fails closed', async () => {
    const vc = await issue()
    const { credentialStatus, ...withoutStatus } = deps
    deps = withoutStatus as LoginVerificationDeps
    expect(await login(vc)).toMatchObject({ ok: false, code: 'STATUS_UNAVAILABLE' })
  })

  it('A3.4 a marketplace (non-employee) credential is not accepted for login', async () => {
    const vc = await issue()
    record(vc)
    const marketplace = { ...vc, type: ['VerifiableCredential', 'CirculoosMarketplaceCredential'] }
    expect(await login(marketplace)).toMatchObject({ ok: false, code: 'NOT_EMPLOYEE_CREDENTIAL' })
  })

  it('A3.4 altering the type array (e.g. to steer schema detection) breaks the match with the on-chain record', async () => {
    const vc = await issue()
    record(vc)
    // The schema is forced to employee whatever the order; and since `type` is part of hashVC,
    // the altered credential no longer matches what the issuer recorded on-chain.
    const reordered = { ...vc, type: ['VerifiableCredential', 'IdentityCredential', 'CirculoosEmployeeCredential'] }
    expect(await login(reordered)).toMatchObject({ ok: false, code: 'NOT_RECORDED' })
  })

  it('A3.5 the login signature is checked against the server-side challenge and credential, not a client message', async () => {
    const vc = await issue()
    record(vc)
    const challenge = await challenges.issue(holder.address, AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    // The holder signs a message for a different credential hash: the server rebuilds the real one
    const signature = await holder._signTypedData(domain, types, { ...message, credentialHash: '0x' + '11'.repeat(32) })

    expect(await verifyEmployeeLogin({ credential: vc, signature, nonce: challenge.nonce, audience: AUDIENCE }, deps)).toMatchObject({
      ok: false,
      code: 'HOLDER_MISMATCH',
    })
  })

  it('a failed attempt burns the challenge', async () => {
    const vc = await issue()
    record(vc)
    const challenge = await challenges.issue(holder.address, AUDIENCE)
    const { domain, types, message } = buildLoginTypedData(vc, challenge, CHAIN_ID)
    const badSignature = await other._signTypedData(domain, types, message)
    const goodSignature = await holder._signTypedData(domain, types, message)

    expect((await verifyEmployeeLogin({ credential: vc, signature: badSignature, nonce: challenge.nonce, audience: AUDIENCE }, deps)).ok).toBe(false)
    expect(await verifyEmployeeLogin({ credential: vc, signature: goodSignature, nonce: challenge.nonce, audience: AUDIENCE }, deps)).toMatchObject({
      ok: false,
      code: 'CHALLENGE_INVALID',
    })
  })
})
