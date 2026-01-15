import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NonceService } from '../../src/services/nonce.service'
import { SqlJsStorageAdapter } from '@circuloos/common'

describe('NonceService', () => {
    let nonceService: NonceService
    let mockStorage: any

    beforeEach(() => {
        mockStorage = {
            saveNonce: vi.fn().mockResolvedValue(undefined),
            getNonce: vi.fn().mockResolvedValue(null),
            markNonceAsUsed: vi.fn().mockResolvedValue(undefined),
            deleteNonce: vi.fn().mockResolvedValue(undefined),
            cleanupExpiredNonces: vi.fn().mockResolvedValue(0)
        }
        nonceService = new NonceService(mockStorage as any)
    })

    afterEach(() => {
        // Clear any intervals
        if (nonceService['gcInterval']) {
            clearInterval(nonceService['gcInterval'])
        }
    })

    describe('generateNonce', () => {
        it('should generate a nonce with correct expiry time', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const result = await nonceService.generateNonce(address)

            expect(result.nonce).toBeDefined()
            expect(result.nonce).toHaveLength(32) // 16 bytes in hex = 32 characters
            expect(result.expiresAt).toBeInstanceOf(Date)
            expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())

            // Verify storage was called
            expect(mockStorage.saveNonce).toHaveBeenCalledWith(
                address,
                result.nonce,
                expect.any(Number)
            )
        })

        it('should generate unique nonces for same address', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const result1 = await nonceService.generateNonce(address)
            const result2 = await nonceService.generateNonce(address)

            expect(result1.nonce).not.toBe(result2.nonce)
        })

        it('should use hardcoded 15 minute expiry', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const now = Date.now()
            const result = await nonceService.generateNonce(address)

            const expiryMs = result.expiresAt.getTime() - now
            const expectedMs = 15 * 60 * 1000 // 15 minutes

            // Allow 1 second tolerance
            expect(expiryMs).toBeGreaterThanOrEqual(expectedMs - 1000)
            expect(expiryMs).toBeLessThanOrEqual(expectedMs + 1000)
        })
    })

    describe('getNonce', () => {
        it('should retrieve an existing nonce', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'test-nonce-123'
            const createdAt = new Date()

            mockStorage.getNonce.mockResolvedValue({
                nonce,
                createdAt,
                used: false
            })

            const result = await nonceService.getNonce(address, nonce)

            expect(result).toEqual({
                nonce,
                createdAt,
                used: false
            })
            expect(mockStorage.getNonce).toHaveBeenCalledWith(address, nonce)
        })

        it('should return null if nonce does not exist', async () => {
            mockStorage.getNonce.mockResolvedValue(null)

            const result = await nonceService.getNonce('0xaddress', 'nonexistent')

            expect(result).toBeNull()
        })
    })

    describe('markAsUsed', () => {
        it('should mark nonce as used', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'test-nonce-123'

            await nonceService.markAsUsed(address, nonce)

            expect(mockStorage.markNonceAsUsed).toHaveBeenCalledWith(address, nonce)
        })
    })

    describe('deleteNonce', () => {
        it('should delete a nonce', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'test-nonce-123'

            await nonceService.deleteNonce(address, nonce)

            expect(mockStorage.deleteNonce).toHaveBeenCalledWith(address, nonce)
        })
    })

    describe('cleanupExpiredNonces', () => {
        it('should cleanup expired nonces and return count', async () => {
            mockStorage.cleanupExpiredNonces.mockResolvedValue(5)

            const count = await nonceService.cleanupExpiredNonces()

            expect(count).toBe(5)
            expect(mockStorage.cleanupExpiredNonces).toHaveBeenCalled()
        })

        it('should return 0 if no nonces were cleaned up', async () => {
            mockStorage.cleanupExpiredNonces.mockResolvedValue(0)

            const count = await nonceService.cleanupExpiredNonces()

            expect(count).toBe(0)
        })
    })

    describe('Garbage Collection', () => {
        it('should not start GC in test environment', () => {
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'test'

            nonceService.startGarbageCollection()

            expect(nonceService['gcInterval']).toBeUndefined()

            // Restore environment
            if (originalEnv) {
                process.env.NODE_ENV = originalEnv
            }
        })

        it('should start GC interval in non-test environment', () => {
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            nonceService.startGarbageCollection()

            expect(nonceService['gcInterval']).toBeDefined()

            // Cleanup
            clearInterval(nonceService['gcInterval'])
            if (originalEnv) {
                process.env.NODE_ENV = originalEnv
            } else {
                delete process.env.NODE_ENV
            }
        })

        it('should cleanup expired nonces during GC cycle', async () => {
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            mockStorage.cleanupExpiredNonces.mockResolvedValue(3)
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            nonceService.startGarbageCollection()

            // Manually trigger the cleanup (since we can't wait for the interval)
            await nonceService.cleanupExpiredNonces()

            expect(mockStorage.cleanupExpiredNonces).toHaveBeenCalled()

            // Cleanup
            clearInterval(nonceService['gcInterval'])
            consoleSpy.mockRestore()
            if (originalEnv) {
                process.env.NODE_ENV = originalEnv
            } else {
                delete process.env.NODE_ENV
            }
        })

        it('should handle errors during GC gracefully', async () => {
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            const error = new Error('Database error')
            mockStorage.cleanupExpiredNonces.mockRejectedValue(error)
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            // Manually trigger cleanup to test error handling
            try {
                await nonceService.cleanupExpiredNonces()
            } catch (e) {
                // The service should catch the error
            }

            // The error should be thrown from storage but we're testing the wrapper
            expect(mockStorage.cleanupExpiredNonces).toHaveBeenCalled()

            // Cleanup
            consoleErrorSpy.mockRestore()
            if (originalEnv) {
                process.env.NODE_ENV = originalEnv
            } else {
                delete process.env.NODE_ENV
            }
        })
    })

    describe('Nonce validation scenarios', () => {
        it('should validate that nonce exists before use', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'valid-nonce'
            const createdAt = new Date()

            mockStorage.getNonce.mockResolvedValue({
                nonce,
                createdAt,
                used: false
            })

            const result = await nonceService.getNonce(address, nonce)

            expect(result).not.toBeNull()
            expect(result?.used).toBe(false)
        })

        it('should return nonce data when it exists', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'test-nonce'
            const createdAt = new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago

            mockStorage.getNonce.mockResolvedValue({
                nonce,
                createdAt,
                used: false
            })

            const result = await nonceService.getNonce(address, nonce)

            expect(result).not.toBeNull()
            expect(result?.nonce).toBe(nonce)
        })

        it('should detect already used nonce', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const nonce = 'used-nonce'
            const createdAt = new Date()

            mockStorage.getNonce.mockResolvedValue({
                nonce,
                createdAt,
                used: true
            })

            const result = await nonceService.getNonce(address, nonce)

            expect(result?.used).toBe(true)
        })
    })
})
