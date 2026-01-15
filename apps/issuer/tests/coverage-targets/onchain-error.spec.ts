import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Test onchain.ts error branch - when ABI file cannot be read
 * This tests the catch block that handles missing/unreadable ABI files
 */

describe('onchain.ts - Error Branch Coverage', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('throws custom error when fs.readFileSync fails (ENOENT)', async () => {
        // Mock fs module before importing onchain
        vi.doMock('fs', () => ({
            readFileSync: vi.fn(() => {
                const error: any = new Error('ENOENT: no such file or directory')
                error.code = 'ENOENT'
                throw error
            })
        }))

        // Import after mocking
        const { createCredentialRegistry } = await import('../../src/onchain')

        const address = '0x1234567890123456789012345678901234567890'
        const mockProvider = { getNetwork: () => Promise.resolve({ chainId: 1 }) }

        // Verify the catch block throws the custom error message
        expect(() => {
            createCredentialRegistry(address, mockProvider)
        }).toThrow('CredentialRegistry ABI not found. Run contract compile to generate ABI artifacts.')

        vi.doUnmock('fs')
    })

    it('throws custom error when fs.readFileSync fails (permission denied)', async () => {
        // Mock fs module to simulate permission error
        vi.doMock('fs', () => ({
            readFileSync: vi.fn(() => {
                const error: any = new Error('EACCES: permission denied')
                error.code = 'EACCES'
                throw error
            })
        }))

        const { createCredentialRegistry } = await import('../../src/onchain')

        const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        const mockProvider = {}

        expect(() => {
            createCredentialRegistry(address, mockProvider)
        }).toThrow('CredentialRegistry ABI not found. Run contract compile to generate ABI artifacts.')

        vi.doUnmock('fs')
    })

    it('throws custom error when JSON.parse fails (invalid JSON)', async () => {
        // Mock fs to return invalid JSON
        vi.doMock('fs', () => ({
            readFileSync: vi.fn(() => '{ invalid json syntax')
        }))

        const { createCredentialRegistry } = await import('../../src/onchain')

        const address = '0x1111111111111111111111111111111111111111'
        const mockProvider = {}

        // The JSON.parse error should be caught and rethrown as custom message
        expect(() => {
            createCredentialRegistry(address, mockProvider)
        }).toThrow('CredentialRegistry ABI not found. Run contract compile to generate ABI artifacts.')

        vi.doUnmock('fs')
    })
})
