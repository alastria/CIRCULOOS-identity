import type { SignedCredential } from '@circuloos/common'
import type { TrustedIssuerRegistryService } from './services/trustedIssuerRegistryService'
import type {
  FastifyBaseLogger,
  FastifyTypeProvider,
  FastifyTypeProviderDefault,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from 'fastify'

declare module '@circuloos/test-utils' {
  export function issueSignedVC(): Promise<SignedCredential>
}

declare module '@circuloos/issuer-server' {
  const issuerServer: any
  export default issuerServer
}

declare module 'vite'

declare module 'fastify' {
  interface FastifyInstance<
    RawServer extends RawServerBase = RawServerDefault,
    RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
    RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
    Logger extends FastifyBaseLogger = FastifyBaseLogger,
    TypeProvider extends FastifyTypeProvider = FastifyTypeProviderDefault
  > {
    trustedIssuerRegistry?: TrustedIssuerRegistryService
  }
}
