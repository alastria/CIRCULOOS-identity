import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock dotenv to prevent reloading .env files which interferes with tests
vi.mock('dotenv', () => ({
    default: {
        config: vi.fn()
    }
}))

// Mutable shared config for testing
const mockSharedConfig = {
    HTTP_HOST: undefined as string | undefined,
    VERIFIER_PORT: undefined as string | number | undefined
}

vi.mock('@circuloos/common', () => ({
    config: mockSharedConfig
}))

/**
 * Cover config.ts internal functions by testing them indirectly through config exports
 *
 * Since parseBool and isSqlEnabled are not exported, we test them by:
 * 1. Setting environment variables
 * 2. Re-importing config
 * 3. Verifying the computed values
 */

describe('Config Coverage - Internal Functions', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        originalEnv = { ...process.env }
        // Reset shared config
        mockSharedConfig.HTTP_HOST = undefined
        mockSharedConfig.VERIFIER_PORT = undefined
        // Clear module cache to force re-import
        vi.resetModules()
    })

    afterEach(() => {
        process.env = originalEnv
        vi.resetModules()
    })

    it('covers getRpcUrl fallback chain', async () => {
        // Test when RPC_URL is set
        process.env.RPC_URL = 'http://custom:8545'
        delete process.env.BLOCKCHAIN_RPC_URL
        delete process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL

        const { config } = await import('../src/config')
        expect(config.blockchain.rpcUrl).toBe('http://custom:8545')
    })

    it('covers getRpcUrl second fallback', async () => {
        // Test when only BLOCKCHAIN_RPC_URL is set
        delete process.env.RPC_URL
        process.env.BLOCKCHAIN_RPC_URL = 'http://blockchain:8545'
        delete process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL

        const { config } = await import('../src/config')
        expect(config.blockchain.rpcUrl).toBe('http://blockchain:8545')
    })

    it('covers getRpcUrl third fallback', async () => {
        // Test when only NEXT_PUBLIC_BLOCKCHAIN_RPC_URL is set
        delete process.env.RPC_URL
        delete process.env.BLOCKCHAIN_RPC_URL
        process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL = 'http://next:8545'

        const { config } = await import('../src/config')
        expect(config.blockchain.rpcUrl).toBe('http://next:8545')
    })

    it('covers getRpcUrl default fallback', async () => {
        // Test when no RPC URL is set
        delete process.env.RPC_URL
        delete process.env.BLOCKCHAIN_RPC_URL
        delete process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL

        const { config } = await import('../src/config')
        expect(config.blockchain.rpcUrl).toBe('http://127.0.0.1:8545')
    })

    it('covers trustedIssuers parsing with empty string', async () => {
        process.env.TRUSTED_ISSUERS = ''

        const { config } = await import('../src/config')
        expect(config.trustedIssuers).toEqual([])
    })

    it('covers trustedIssuers parsing with single value', async () => {
        process.env.TRUSTED_ISSUERS = '0x1234'

        const { config } = await import('../src/config')
        expect(config.trustedIssuers).toEqual(['0x1234'])
    })

    it('covers trustedIssuers parsing with multiple values', async () => {
        process.env.TRUSTED_ISSUERS = '0x1234, 0x5678 ,0xabcd'

        const { config } = await import('../src/config')
        expect(config.trustedIssuers).toEqual(['0x1234', '0x5678', '0xabcd'])
    })

    it('covers trustedHolders parsing with whitespace trimming', async () => {
        process.env.TRUSTED_HOLDERS = ' 0xholder1 , 0xholder2 '

        const { config } = await import('../src/config')
        expect(config.trustedHolders).toEqual(['0xholder1', '0xholder2'])
    })

    it('covers env default value', async () => {
        delete process.env.NODE_ENV

        const { config } = await import('../src/config')
        expect(config.env).toBe('development')
    })

    it('covers eip712VerifyingContract when set', async () => {
        process.env.EIP712_VERIFYING_CONTRACT = '0xverify'

        const { config } = await import('../src/config')
        expect(config.eip712VerifyingContract).toBe('0xverify')
    })

    it('covers eip712VerifyingContract when undefined', async () => {
        delete process.env.EIP712_VERIFYING_CONTRACT

        const { config } = await import('../src/config')
        expect(config.eip712VerifyingContract).toBeUndefined()
    })

    it('covers env when set', async () => {
        process.env.NODE_ENV = 'production'
        const { config } = await import('../src/config')
        expect(config.env).toBe('production')
    })

    it('covers http.host when HTTP_HOST set', async () => {
        process.env.HTTP_HOST = '1.2.3.4'
        const { config } = await import('../src/config')
        expect(config.http.host).toBe('1.2.3.4')
    })

    it('covers http.host default', async () => {
        delete process.env.HTTP_HOST
        // mock sharedConfig default is undefined
        const { config } = await import('../src/config')
        expect(config.http.host).toBe('0.0.0.0')
    })

    it('covers http.host from sharedConfig', async () => {
        delete process.env.HTTP_HOST
        mockSharedConfig.HTTP_HOST = 'shared-host'
        const { config } = await import('../src/config')
        expect(config.http.host).toBe('shared-host')
    })

    it('covers http.port when VERIFIER_PORT set', async () => {
        process.env.VERIFIER_PORT = '5000'
        delete process.env.HTTP_PORT
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(5000)
    })

    it('covers http.port when HTTP_PORT set', async () => {
        delete process.env.VERIFIER_PORT
        process.env.HTTP_PORT = '6000'
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(6000)
    })

    it('covers http.port default', async () => {
        delete process.env.VERIFIER_PORT
        delete process.env.HTTP_PORT
        // mock sharedConfig default is undefined
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(4001)
    })

    it('covers http.port from sharedConfig', async () => {
        delete process.env.VERIFIER_PORT
        delete process.env.HTTP_PORT
        mockSharedConfig.VERIFIER_PORT = 7000
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(7000)
    })

    it('covers swagger.enabled when "false"', async () => {
        process.env.SWAGGER_ENABLED = 'false'
        const { config } = await import('../src/config')
        expect(config.swagger.enabled).toBe(false)
    })

    it('covers swagger.enabled default (true)', async () => {
        delete process.env.SWAGGER_ENABLED
        const { config } = await import('../src/config')
        expect(config.swagger.enabled).toBe(true)
    })

    it('covers trustedRegistry.startBlock set', async () => {
        process.env.TRUSTED_REGISTRY_START_BLOCK = '100'
        const { config } = await import('../src/config')
        expect(config.trustedRegistry.startBlock).toBe(100)
    })

    it('covers trustedRegistry.startBlock default', async () => {
        delete process.env.TRUSTED_REGISTRY_START_BLOCK
        const { config } = await import('../src/config')
        expect(config.trustedRegistry.startBlock).toBe(0)
    })

    it('covers trustedRegistry.storagePath set', async () => {
        process.env.TRUSTED_REGISTRY_STORAGE_PATH = 'custom/path.json'
        const { config } = await import('../src/config')
        expect(config.trustedRegistry.storagePath).toBe('custom/path.json')
    })

    it('covers trustedRegistry.storagePath default', async () => {
        delete process.env.TRUSTED_REGISTRY_STORAGE_PATH
        const { config } = await import('../src/config')
        expect(config.trustedRegistry.storagePath).toBe('trusted-issuers/state.json')
    })

    it('covers credentialRegistry.startBlock set', async () => {
        process.env.CREDENTIAL_REGISTRY_START_BLOCK = '200'
        const { config } = await import('../src/config')
        expect(config.credentialRegistry.startBlock).toBe(200)
    })

    it('covers credentialRegistry.startBlock default', async () => {
        delete process.env.CREDENTIAL_REGISTRY_START_BLOCK
        const { config } = await import('../src/config')
        expect(config.credentialRegistry.startBlock).toBe(0)
    })

    it('covers filestore.baseDir set', async () => {
        process.env.FILESTORE_BASE_DIR = './custom-store'
        const { config } = await import('../src/config')
        expect(config.filestore.baseDir).toBe('./custom-store')
    })

    it('covers filestore.baseDir default', async () => {
        delete process.env.FILESTORE_BASE_DIR
        const { config } = await import('../src/config')
        expect(config.filestore.baseDir).toBe('./tmp-filestore')
    })

    describe('parseBool / isSqlEnabled coverage', () => {
        it('returns true for "true"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'true'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        it('returns true for "1"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = '1'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        it('returns true for "yes"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'yes'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        it('returns true for "on"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'on'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        it('returns false for "false"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'false'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns false for "0"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = '0'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns false for "no"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'no'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns false for "off"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'off'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns defaultValue (false) for unknown string', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'unknown'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns defaultValue (false) for empty string', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = ''
            const { config } = await import('../src/config')
            // parseBool returns defaultValue if !val. isSqlEnabled calls parseBool if defined.
            // Wait, if env var is '', it is defined but empty.
            // parseBool check is `if (!val) return defaultValue`.
            // defaultValue passed in isSqlEnabled is false.
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })

        it('returns process.env.NODE_ENV !== "production" when undefined', async () => {
            delete process.env.TRUSTED_ISSUER_SQL_DB_ENABLED
            process.env.NODE_ENV = 'development'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        it('returns false when NODE_ENV is production and undefined', async () => {
            delete process.env.TRUSTED_ISSUER_SQL_DB_ENABLED
            process.env.NODE_ENV = 'production'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })
    })
})
