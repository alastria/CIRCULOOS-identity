import { FastifyPluginAsync } from 'fastify'
import { ethers } from 'ethers'
import {
  InMemoryLoginChallengeStore,
  verifyEmployeeLogin,
  type CredentialStatusRecord,
  type LoginChallengeStore,
} from '@circuloos/common'
import { config } from '../config'

/**
 * Employee-credential login (plan A3). Unlike /verify and /verify/presentation, this binds the
 * credential to whoever presents it (signed single-use challenge), and checks expiry, issuer trust
 * and on-chain status. See libs/common/src/login.ts.
 *
 *   POST /login/challenge { holderAddress, audience } → { nonce, audience, holder, expiresAt }
 *   POST /login/verify    { credential, signature, nonce, audience } → 200 { ok: true, holder, organization, … }
 *                                                                     | 401 { ok: false, code, reason }
 *
 * Challenges are kept in memory: a single verifier instance. Several instances need a shared
 * LoginChallengeStore with an atomic consume.
 */
export interface LoginRoutesOptions {
  challenges?: LoginChallengeStore
  isTrustedIssuer?: (address: string) => Promise<boolean>
  /** Explicitly `undefined` disables on-chain status (logins then fail closed). */
  credentialStatus?: (credentialHash: string) => Promise<CredentialStatusRecord>
}

const CREDENTIAL_STATUS_ABI = [
  'function getCredentialStatus(bytes32 vcHash) view returns (bool issued, bool revoked, bool suspended, address issuer, uint256 issuedAt, uint256 revokedAt)',
]

/** On-chain status from the configured Diamond (CredentialStatusFacet), if any. */
function credentialStatusFromConfig(): LoginRoutesOptions['credentialStatus'] {
  const address = config.revocationRegistry.address || config.credentialRegistry.address
  if (!address || !config.blockchain.rpcUrl) return undefined
  const contract = new ethers.Contract(address, CREDENTIAL_STATUS_ABI, new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl))
  return async (hash) => {
    const s = await contract.getCredentialStatus(hash)
    return { issued: s.issued, revoked: s.revoked, suspended: s.suspended, issuer: s.issuer }
  }
}

const loginRoutes: FastifyPluginAsync<LoginRoutesOptions> = async (fastify, opts) => {
  const challenges = opts.challenges ?? new InMemoryLoginChallengeStore({ ttlSeconds: config.challenge?.ttlSeconds ?? 300 })
  const credentialStatus = 'credentialStatus' in opts ? opts.credentialStatus : credentialStatusFromConfig()
  const isTrustedIssuer =
    opts.isTrustedIssuer ??
    (async (address: string) => {
      const registry = (fastify as any).trustedIssuerRegistry
      // No registry: nobody is trusted (fail closed)
      return registry ? Boolean(await registry.isTrustedIssuer(address)) : false
    })

  fastify.post('/login/challenge', {
    schema: {
      tags: ['login'],
      summary: 'Request a single-use login challenge',
      body: {
        type: 'object',
        required: ['holderAddress', 'audience'],
        properties: {
          holderAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          audience: { type: 'string', minLength: 1, maxLength: 200, description: 'Relying party identifier, e.g. iot-manager' },
        },
      },
    },
  }, async (request) => {
    const { holderAddress, audience } = request.body as { holderAddress: string; audience: string }
    return challenges.issue(holderAddress, audience)
  })

  fastify.post('/login/verify', {
    schema: {
      tags: ['login'],
      summary: 'Verify an employee credential login',
      body: {
        type: 'object',
        required: ['credential', 'signature', 'nonce', 'audience'],
        properties: {
          credential: { type: 'object', additionalProperties: true },
          signature: { type: 'string' },
          nonce: { type: 'string' },
          audience: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { credential: any; signature: string; nonce: string; audience: string }
    const result = await verifyEmployeeLogin(body, { challenges, isTrustedIssuer, credentialStatus })
    return reply.code(result.ok ? 200 : 401).send(result)
  })
}

export default loginRoutes
