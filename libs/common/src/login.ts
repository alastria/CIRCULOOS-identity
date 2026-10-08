/**
 * Logging in to a relying party (e.g. the CIRCULOOS IoT fleet panel) with an employee credential.
 *
 * Flow:
 *   1. The relying party issues a single-use challenge for the holder's wallet and its own
 *      audience (`LoginChallengeStore.issue`).
 *   2. The holder signs `buildLoginTypedData(vc, challenge)` with their wallet and sends
 *      the credential, the signature and the nonce.
 *   3. The relying party calls `verifyEmployeeLogin`, which rebuilds the signed message itself
 *      from the stored challenge and the credential (it never trusts a client-supplied message),
 *      and returns the verified holder and organisation — or a failure code.
 *
 * Unlike /verify and /verify/presentation (advisory P3), this binds the credential to whoever
 * presents it, cannot be replayed, and checks expiry, issuer trust and on-chain status.
 */
import { randomBytes } from 'crypto'
import { utils } from 'ethers'
import { EMPLOYEE_SCHEMA_ID, EMPLOYEE_VC_TYPE, Organization } from './employee'
import { verifyCredentialIssuance } from './eip712/helpers'
import { subjectAddress } from './eip712/utils'
import { hashVC } from './hash'

export const LOGIN_DOMAIN_NAME = 'CirculoosLogin'
export const LOGIN_DOMAIN_VERSION = '1'
export const LOGIN_PRIMARY_TYPE = 'EmployeeLogin'

export const LOGIN_TYPES = {
  EmployeeLogin: [
    { name: 'action', type: 'string' },
    { name: 'audience', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'holder', type: 'address' },
    { name: 'credentialId', type: 'string' },
    { name: 'credentialHash', type: 'bytes32' },
    { name: 'organizationTaxID', type: 'string' },
  ],
}

// ---------------------------------------------------------------- challenges

export interface LoginChallenge {
  nonce: string
  audience: string
  /** Lowercase address the challenge was issued to. */
  holder: string
  /** Epoch milliseconds. */
  expiresAt: number
}

export type ConsumeResult = { status: 'ok'; challenge: LoginChallenge } | { status: 'unknown' } | { status: 'expired' }

/**
 * Single-use challenges. `consume` must remove the challenge whatever the outcome of the login,
 * so a nonce can never be tried twice. Implementations shared by several server instances need
 * an atomic consume (e.g. a DELETE … RETURNING in SQL).
 */
export interface LoginChallengeStore {
  issue(holder: string, audience: string): Promise<LoginChallenge>
  consume(nonce: string, audience: string): Promise<ConsumeResult>
}

/** In-process store: fine for a single server instance and for tests. */
export class InMemoryLoginChallengeStore implements LoginChallengeStore {
  private readonly challenges = new Map<string, LoginChallenge>()
  private readonly ttlMs: number
  private readonly now: () => Date

  constructor(opts: { ttlSeconds?: number; now?: () => Date } = {}) {
    this.ttlMs = (opts.ttlSeconds ?? 300) * 1000
    this.now = opts.now ?? (() => new Date())
  }

  async issue(holder: string, audience: string): Promise<LoginChallenge> {
    if (!utils.isAddress(holder)) throw new Error('holder must be an Ethereum address')
    if (!audience) throw new Error('audience is required')
    this.purgeExpired()
    const challenge = {
      nonce: '0x' + randomBytes(32).toString('hex'),
      audience,
      holder: holder.toLowerCase(),
      expiresAt: this.now().getTime() + this.ttlMs,
    }
    this.challenges.set(challenge.nonce, challenge)
    return challenge
  }

  async consume(nonce: string, audience: string): Promise<ConsumeResult> {
    const challenge = this.challenges.get(nonce)
    this.challenges.delete(nonce) // single use, whatever happens next
    if (!challenge || challenge.audience !== audience) return { status: 'unknown' }
    if (this.now().getTime() > challenge.expiresAt) return { status: 'expired' }
    return { status: 'ok', challenge }
  }

  private purgeExpired() {
    const now = this.now().getTime()
    for (const [nonce, c] of this.challenges) if (now > c.expiresAt) this.challenges.delete(nonce)
  }
}

// ---------------------------------------------------------------- typed data

/**
 * What the holder signs to log in. Rebuilt server-side from the stored challenge for verification.
 *
 * The domain has no chainId on purpose (decision D5): MetaMask refuses to sign EIP-712 data whose
 * chainId differs from the active network, and Red-B is not reachable from holders' browsers.
 * Nothing here is replayable on another chain anyway: the signature binds a single-use nonce,
 * the relying party's audience and the exact credential hash.
 */
export function buildLoginTypedData(vc: any, challenge: Pick<LoginChallenge, 'nonce' | 'audience' | 'holder'>) {
  return {
    domain: { name: LOGIN_DOMAIN_NAME, version: LOGIN_DOMAIN_VERSION },
    types: LOGIN_TYPES,
    primaryType: LOGIN_PRIMARY_TYPE,
    message: {
      action: 'Iniciar sesión con mi credencial de empleado',
      audience: challenge.audience,
      nonce: challenge.nonce,
      holder: challenge.holder,
      credentialId: vc?.id || '',
      credentialHash: hashVC(vc),
      organizationTaxID: vc?.credentialSubject?.worksFor?.taxID || '',
    },
  }
}

// ---------------------------------------------------------------- verification

export interface CredentialStatusRecord {
  issued: boolean
  revoked: boolean
  suspended: boolean
  /** Address that recorded the credential on-chain (CredentialStatusFacet). */
  issuer: string
}

export interface LoginVerificationDeps {
  challenges: LoginChallengeStore
  /** Trusted issuer registry lookup (e.g. TrustedIssuerFacet.isTrustedIssuer). */
  isTrustedIssuer(address: string): Promise<boolean>
  /** On-chain status (e.g. CredentialStatusFacet.getCredentialStatus). Without it, logins fail closed. */
  credentialStatus?(credentialHash: string): Promise<CredentialStatusRecord>
  now?(): Date
}

export type LoginFailureCode =
  | 'CHALLENGE_INVALID'
  | 'CHALLENGE_EXPIRED'
  | 'NOT_EMPLOYEE_CREDENTIAL'
  | 'MISSING_PROOF'
  | 'INVALID_ISSUER_SIGNATURE'
  | 'UNTRUSTED_ISSUER'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'HOLDER_MISMATCH'
  | 'STATUS_UNAVAILABLE'
  | 'NOT_RECORDED'
  | 'STATUS_ISSUER_UNTRUSTED'
  | 'REVOKED'
  | 'SUSPENDED'

export type LoginResult =
  | {
      ok: true
      /** Lowercase holder address. */
      holder: string
      holderDid: string
      organization: Organization
      credentialId: string
      credentialHash: string
      /** Lowercase address of the issuer that signed the credential. */
      issuer: string
    }
  | { ok: false; code: LoginFailureCode; reason: string }

const fail = (code: LoginFailureCode, reason: string): LoginResult => ({ ok: false, code, reason })

export interface LoginInput {
  /** The employee VC with its embedded issuer proof, or the presentation stored after the claim. */
  credential: any
  signature: string
  nonce: string
  audience: string
}

export async function verifyEmployeeLogin(input: LoginInput, deps: LoginVerificationDeps): Promise<LoginResult> {
  // 1. Challenge: consumed first, so a nonce is single-use even if the rest fails
  const consumed = await deps.challenges.consume(input.nonce, input.audience)
  if (consumed.status === 'unknown') return fail('CHALLENGE_INVALID', 'unknown, already used or other-audience challenge')
  if (consumed.status === 'expired') return fail('CHALLENGE_EXPIRED', 'challenge expired')
  const challenge = consumed.challenge

  // 2. Credential type: the schema is forced to employee, never detected from the presented type order
  const vc = input.credential?.verifiableCredential?.[0] ?? input.credential
  if (!Array.isArray(vc?.type) || !vc.type.includes(EMPLOYEE_VC_TYPE)) {
    return fail('NOT_EMPLOYEE_CREDENTIAL', 'only employee credentials can be used to log in')
  }
  const proof = vc.proof
  if (!proof?.signature || !proof?.domain || !proof?.verificationMethod) return fail('MISSING_PROOF', 'credential has no issuer proof')

  // 3. Issuer signature over the credential content (organisation, holder, validity)
  const { proof: _proof, ...unsigned } = vc
  const recoveredIssuer = verifyCredentialIssuance(proof.domain, unsigned, proof.signature, EMPLOYEE_SCHEMA_ID)
  if (!recoveredIssuer || recoveredIssuer.toLowerCase() !== String(proof.verificationMethod).toLowerCase()) {
    return fail('INVALID_ISSUER_SIGNATURE', 'issuer signature does not match the credential content')
  }
  const issuer = recoveredIssuer.toLowerCase()
  if (!(await deps.isTrustedIssuer(issuer))) return fail('UNTRUSTED_ISSUER', 'credential issuer is not a trusted issuer')

  // 4. Validity period
  const now = (deps.now?.() ?? new Date()).getTime()
  if (vc.validFrom && now < Date.parse(vc.validFrom)) return fail('NOT_YET_VALID', 'credential is not valid yet')
  if (!vc.validUntil || now > Date.parse(vc.validUntil)) return fail('EXPIRED', 'credential has expired')

  // 5. Holder binding: the login signature, rebuilt from the stored challenge and this credential
  let holder: string
  try {
    holder = subjectAddress(vc.credentialSubject)
  } catch {
    return fail('INVALID_ISSUER_SIGNATURE', 'credential subject is inconsistent')
  }
  const { domain, types, message } = buildLoginTypedData(vc, { ...challenge, holder })
  let signer: string | null = null
  try {
    signer = utils.verifyTypedData(domain, types, message, input.signature).toLowerCase()
  } catch {
    signer = null
  }
  if (signer !== holder || challenge.holder !== holder) {
    return fail('HOLDER_MISMATCH', 'the login was not signed by the credential holder')
  }

  // 6. On-chain status: recorded by a trusted issuer, not revoked, not suspended
  if (!deps.credentialStatus) return fail('STATUS_UNAVAILABLE', 'no on-chain status source configured')
  const credentialHash = hashVC(vc)
  let status: CredentialStatusRecord
  try {
    status = await deps.credentialStatus(credentialHash)
  } catch {
    return fail('STATUS_UNAVAILABLE', 'on-chain status could not be read')
  }
  if (!status.issued) return fail('NOT_RECORDED', 'credential is not recorded on-chain')
  if (!(await deps.isTrustedIssuer(status.issuer.toLowerCase()))) {
    return fail('STATUS_ISSUER_UNTRUSTED', 'on-chain record was not created by a trusted issuer')
  }
  if (status.revoked) return fail('REVOKED', 'credential has been revoked')
  if (status.suspended) return fail('SUSPENDED', 'credential is suspended')

  const worksFor = vc.credentialSubject.worksFor
  return {
    ok: true,
    holder,
    holderDid: vc.credentialSubject.id,
    organization: { legalName: worksFor.legalName, taxID: worksFor.taxID, addressCountry: worksFor.addressCountry },
    credentialId: vc.id,
    credentialHash,
    issuer,
  }
}
