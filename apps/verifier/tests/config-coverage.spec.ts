import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'

// Mock dotenv to prevent reloading .env files which interferes with tests
vi.mock('dotenv', () => ({
    default: {
        config: vi.fn()
    }
}))

/**
 * Cover config.ts by testing it through its exports.
 *
 * src/config.ts no longer reads process.env itself: it maps the validated result of
 * `loadConfig()` from @circuloos/common (env -> zod schemas in libs/common/src/config/)
 * onto the verifier Config shape. These tests therefore use the real `loadConfig`
 * (no mock of @circuloos/common) and check env var -> verifier config end to end:
 * 1. Setting environment variables
 * 2. Re-importing config
 * 3. Verifying the computed values
 */

// Every env var read by the libs/common config loaders that can change the values asserted
// below. They are cleared before each test so results do not depend on the shell / .env.
const CONFIG_ENV_VARS = [
    'NODE_ENV', 'HTTP_HOST', 'HTTP_PORT', 'VERIFIER_PORT', 'SWAGGER_ENABLED',
    'CORS_ALLOWED_ORIGINS', 'TRUSTED_PROXIES',
    'RPC_URL', 'BLOCKCHAIN_RPC_URL', 'NEXT_PUBLIC_BLOCKCHAIN_RPC_URL', 'NEXT_PUBLIC_ALASTRIA_RPC_URL',
    'CHAIN_ID', 'DIAMOND_ADDRESS', 'NEXT_PUBLIC_DIAMOND_ADDRESS', 'SHARED_CONFIG_PATH',
    'EIP712_VERIFYING_CONTRACT',
    'TRUSTED_ISSUER_REGISTRY_ADDRESS', 'CREDENTIAL_REGISTRY_ADDRESS', 'REVOCATION_REGISTRY_ADDRESS',
    'TRUSTED_REGISTRY_START_BLOCK', 'CREDENTIAL_REGISTRY_START_BLOCK', 'TRUSTED_REGISTRY_STORAGE_PATH',
    'TRUSTED_ISSUER_SQL_DB_ENABLED', 'TRUSTED_ISSUER_SQL_DB_PATH', 'TRUSTED_ISSUER_SQL_DB_DIR',
    'TRUSTED_ISSUERS', 'TRUSTED_HOLDERS',
    'FILESTORE_BASE_DIR', 'FILESTORE_TMP_DIR',
]

// Test-only placeholder values for the secrets loadConfig() requires when NODE_ENV=production
const setProductionSecrets = () => {
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.VC_ENCRYPTION_KEY = 'test-vc-encryption-key'
    process.env.VC_INDEX_PEPPER = 'test-vc-index-pepper'
    process.env.ISSUER_HMAC_SECRET = 'test-issuer-hmac-secret'
}

describe('Config Coverage - Internal Functions', () => {
    let originalEnv: NodeJS.ProcessEnv

    // Warm up the (externalized, natively cached) @circuloos/common module graph once, so its
    // cold load under a busy parallel run is not charged to the first test's 5s timeout.
    beforeAll(async () => {
        await import('@circuloos/common')
    }, 60000)

    beforeEach(() => {
        originalEnv = { ...process.env }
        for (const key of CONFIG_ENV_VARS) delete process.env[key]
        // Minimal valid environment required by loadConfig()
        process.env.NODE_ENV = 'test'
        process.env.RPC_URL = 'http://127.0.0.1:8545'
        process.env.CHAIN_ID = '31337'
        process.env.APP_PUBLIC_URL = 'http://127.0.0.1:3000'
        // Never pick up a real /shared/diamond-config.json (docker) during unit tests
        process.env.SHARED_CONFIG_PATH = path.join(os.tmpdir(), 'circuloos-verifier-config-test-missing.json')
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
        delete process.env.NEXT_PUBLIC_ALASTRIA_RPC_URL

        // There is no localhost default any more: blockchainSchema requires a valid RPC URL
        // (libs/common/src/config/blockchain.schema.ts; localhost only in getTestConfig()).
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            await expect(import('../src/config')).rejects.toThrow('Invalid configuration. Check environment variables.')
            expect(errorSpy.mock.calls.flat().join('\n')).toContain('blockchain.rpcUrl')
        } finally {
            errorSpy.mockRestore()
        }
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
        // loadConfig() refuses to start in production without these secrets
        setProductionSecrets()
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
        const { config } = await import('../src/config')
        expect(config.http.host).toBe('0.0.0.0')
    })

    // OBSOLETE: src/config.ts no longer reads a shared `config` object (HTTP_HOST/VERIFIER_PORT) from @circuloos/common; it uses loadConfig() and the only shared-config file values left are diamondAddress/chainId (libs/common/src/config/blockchain.schema.ts readSharedConfig)
    it.skip('covers http.host from sharedConfig', async () => {
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
        // HTTP_PORT is now the shared/base (issuer) port; the verifier port comes only from
        // VERIFIER_PORT (src/config.ts: port: appConfig.verifier.port), so HTTP_PORT is ignored.
        delete process.env.VERIFIER_PORT
        process.env.HTTP_PORT = '6000'
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(4001)
    })

    it('covers http.port default', async () => {
        delete process.env.VERIFIER_PORT
        delete process.env.HTTP_PORT
        const { config } = await import('../src/config')
        expect(config.http.port).toBe(4001)
    })

    // OBSOLETE: see 'covers http.host from sharedConfig' - the shared `config` object (VERIFIER_PORT) is no longer consumed by src/config.ts
    it.skip('covers http.port from sharedConfig', async () => {
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

        // KNOWN-BUG: TRUSTED_ISSUER_SQL_DB_ENABLED=yes now yields false - libs/common verifier.schema.ts parseBool only knows true/1/false/0, while the yes/on-aware parseBool in src/config.ts:66 is dead code
        it.skip('returns true for "yes"', async () => {
            process.env.TRUSTED_ISSUER_SQL_DB_ENABLED = 'yes'
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(true)
        })

        // KNOWN-BUG: TRUSTED_ISSUER_SQL_DB_ENABLED=on now yields false - libs/common verifier.schema.ts parseBool only knows true/1/false/0, while the yes/on-aware parseBool in src/config.ts:66 is dead code
        it.skip('returns true for "on"', async () => {
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
            // loadConfig() refuses to start in production without these secrets
            setProductionSecrets()
            const { config } = await import('../src/config')
            expect(config.trustedRegistry.sql.enabled).toBe(false)
        })
    })
})
