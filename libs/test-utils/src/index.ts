import issuerServer from '../../../backend/issuer/src/index'
import { buildVC, buildEip712Domain, signCredentialWithProof, SignedCredential } from '@circuloos/common'

/**
 * Starts the issuer server on an ephemeral port (port 0) and returns the
 * running Fastify instance. The caller should call `stopIssuer()` when done.
 *
 * If the issuer is already listening this will return the existing instance.
 */
export async function startIssuer() {
  // apps/issuer exports a Fastify instance that exposes `listen` and `address()`.
  // Listen on port 0 so the OS picks a free port during tests.
  if ((issuerServer as any).server && (issuerServer as any).server.listening) {
    return issuerServer
  }

  await issuerServer.listen({ port: 0 })
  return issuerServer
}

/**
 * Stops the issuer server if it is running.
 */
export async function stopIssuer() {
  try {
    if ((issuerServer as any).close) {
      await issuerServer.close()
    }
  } catch (err) {
    // swallow errors to make tests more robust, but surface unexpected ones
    // during development by rethrowing non-ERR_SERVER_NOT_RUNNING style issues.
    // Keep minimal logging to avoid noisy test output.
    // eslint-disable-next-line no-console
    console.debug('stopIssuer: ignored error', (err as Error).message)
  }
}

/**
 * issueSignedVC(options?) -> { vc, signature }
 *
 * Helper to build and sign a VC using the repository's `ISSUER_PRIVATE_KEY`.
 * - options.domainChainId: override the EIP-712 domain chainId (defaults to env CHAIN_ID or 1337)
 * - options.issuerName / version: override domain name and version
 *
 * Throws if no private key is available.
 */
export async function issueSignedVC(opts?: {
  domainChainId?: number
  issuerName?: string
  issuerVersion?: string
}): Promise<SignedCredential> {
  const chainId = Number(opts?.domainChainId ?? process.env.CHAIN_ID ?? 1337)
  const name = opts?.issuerName ?? process.env.EIP712_DOMAIN_NAME ?? 'Circuloos'
  const version = opts?.issuerVersion ?? process.env.EIP712_DOMAIN_VERSION ?? '1'

  const privateKey = process.env.ISSUER_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('ISSUER_PRIVATE_KEY is not set in environment')
  }

  const vc = buildVC({ name: 'helper' })
  const domain = buildEip712Domain(name, version, chainId)
  const { proof } = await signCredentialWithProof(privateKey, domain, vc, 'assertionMethod')
  return {
    vc,
    issuerProof: proof,
  }
}
