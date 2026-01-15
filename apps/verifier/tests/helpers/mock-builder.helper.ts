import { vi } from 'vitest'
import { FastifyInstance } from 'fastify'
import { TrustedIssuerRegistryService } from '../../src/services/trustedIssuerRegistryService'
import { HybridCredentialService } from '../../src/services/hybridCredentialService'
import { FileStore } from '@circuloos/file-store'

export class MockBuilder {
    static fileStore() {
        return {
            writeAtomic: vi.fn().mockResolvedValue(undefined),
            loadAll: vi.fn().mockResolvedValue(null),
            delete: vi.fn().mockResolvedValue(undefined),
            list: vi.fn().mockResolvedValue([]),
            exists: vi.fn().mockResolvedValue(false),
        } as unknown as FileStore
    }

    static trustedIssuerRegistryService() {
        return {
            start: vi.fn(),
            stop: vi.fn(),
            isTrustedIssuer: vi.fn(),
            listIssuers: vi.fn(),
            getState: vi.fn(),
            sync: vi.fn(),
        } as unknown as TrustedIssuerRegistryService
    }

    static hybridCredentialService() {
        return {
            start: vi.fn(),
            stop: vi.fn(),
            isIssued: vi.fn(),
            isRevoked: vi.fn(),
            store: MockBuilder.fileStore(),
        } as unknown as HybridCredentialService
    }

    static fastify() {
        const server = {
            register: vi.fn(),
            get: vi.fn(),
            post: vi.fn(),
            listen: vi.fn(),
            log: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
            },
            decorate: vi.fn(),
            hasDecorator: vi.fn(),
            addHook: vi.fn(),
            trustedIssuerRegistry: undefined,
            hybridCredentialService: undefined,
        } as unknown as FastifyInstance & {
            trustedIssuerRegistry?: TrustedIssuerRegistryService
            hybridCredentialService?: HybridCredentialService
        }
        return server
    }

    static ethersContract() {
        return {
            on: vi.fn(),
            removeAllListeners: vi.fn(),
            queryFilter: vi.fn().mockResolvedValue([]),
            filters: {
                IssuerAdded: vi.fn(),
                IssuerRemoved: vi.fn(),
            },
        }
    }

    static ethersProvider() {
        return {
            getBlockNumber: vi.fn().mockResolvedValue(100),
            lookupAddress: vi.fn().mockResolvedValue(null),
        }
    }
}
