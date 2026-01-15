import { TrustedIssuerRegistryClient } from '@circuloos/common'
import type { TrustedIssuerRegistryService } from './services/trustedIssuerRegistryService'
import type { OnchainService } from './services/onchainService'
import type {
  FastifyBaseLogger,
  FastifyTypeProvider,
  FastifyTypeProviderDefault,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from 'fastify'

declare module 'fastify' {
  interface FastifyInstance<
    RawServer extends RawServerBase = RawServerDefault,
    RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
    RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
    Logger extends FastifyBaseLogger = FastifyBaseLogger,
    TypeProvider extends FastifyTypeProvider = FastifyTypeProviderDefault
  > {
    trustedIssuerRegistry?: TrustedIssuerRegistryClient | TrustedIssuerRegistryService
    onchainService?: OnchainService
  }
}

export {}
