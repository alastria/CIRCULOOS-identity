import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecurityService } from '../../src/services/security.service'
import * as common from '@circuloos/common'

vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual<any>('@circuloos/common')
    return {
        ...actual,
        generateOtp: vi.fn(),
        hmacOtp: vi.fn(),
        verifyOtp: vi.fn(),
        createToken: vi.fn(),
        verifyToken: vi.fn(),
        verifyCredential: vi.fn(),
        config: {
            ISSUER_HMAC_SECRET: 'default-secret',
            OTP_EXPIRY_SECONDS: 300,
            EIP712_DOMAIN_NAME: 'TestDomain',
            EIP712_DOMAIN_VERSION: '1',
            CHAIN_ID: 123
        }
    }
})

describe('SecurityService', () => {
    let service: SecurityService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new SecurityService('custom-secret', 600)
    })

    it('initializes with provided values', () => {
        expect(service['hmacSecret']).toBe('custom-secret')
        expect(service['otpExpirySeconds']).toBe(600)
    })

    it('initializes with default values from config', () => {
        const defaultService = new SecurityService()
        expect(defaultService['hmacSecret']).toBe('default-secret')
        expect(defaultService['otpExpirySeconds']).toBe(300)
    })

    it('generates OTP', () => {
        vi.mocked(common.generateOtp).mockReturnValue('123456')
        expect(service.generateOtpCode(6)).toBe('123456')
        expect(common.generateOtp).toHaveBeenCalledWith(6)
    })

    it('hashes OTP', () => {
        vi.mocked(common.hmacOtp).mockReturnValue('hashed-otp')
        expect(service.hashOtp('123456')).toBe('hashed-otp')
        expect(common.hmacOtp).toHaveBeenCalledWith('custom-secret', '123456')
    })

    it('verifies OTP', () => {
        vi.mocked(common.verifyOtp).mockReturnValue(true)
        expect(service.verifyOtpCode('123456', 'hash')).toBe(true)
        expect(common.verifyOtp).toHaveBeenCalledWith('custom-secret', '123456', 'hash')
    })

    it('creates session token', () => {
        vi.mocked(common.createToken).mockReturnValue('token')
        const payload = { id: '1' }
        expect(service.createSessionToken(payload)).toBe('token')
        expect(common.createToken).toHaveBeenCalledWith(payload, 'custom-secret', 600)
    })

    it('verifies session token', () => {
        vi.mocked(common.verifyToken).mockReturnValue({ ok: true, payload: { id: '1' } })
        expect(service.verifySessionToken('token')).toEqual({ ok: true, payload: { id: '1' } })
        expect(common.verifyToken).toHaveBeenCalledWith('token', 'custom-secret')
    })

    it('gets expiry date', () => {
        // expiresAt is a simple calculation, we can just check it returns a number
        // or mock it if we want precise control. For now, let's trust the integration or mock if needed.
        // The service calls common.expiresAt
        // Let's verify it calls it with correct seconds?
        // Actually expiresAt is imported directly.
        // We didn't mock expiresAt in the top mock, so it uses actual.
        const exp = service.getExpiryDate()
        expect(typeof exp).toBe('number')
        expect(exp).toBeGreaterThan(Date.now())
    })

    it('builds domain', () => {
        const domain = service.buildDomain('0x123')
        expect(domain).toEqual({
            name: 'TestDomain',
            version: '1',
            chainId: 123,
            verifyingContract: '0x123'
        })
    })

    it('verifies signature', () => {
        vi.mocked(common.verifyCredential).mockReturnValue('0xsigner')
        expect(service.verifySignature({}, {}, 'sig')).toBe('0xsigner')
        expect(common.verifyCredential).toHaveBeenCalled()
    })

    it('uses hardcoded fallback when hmacSecret is falsy', () => {
        // Test coverage for line 18: hmacSecret || config || 'dev-secret'
        // Pass empty string to test the fallback
        const testService = new SecurityService('', 600)
        // Should fallback to config value
        expect(testService['hmacSecret']).toBe('default-secret')
    })

    it('uses hardcoded fallback when otpExpirySeconds is falsy', () => {
        // Test coverage for line 19: otpExpirySeconds || config || 300
        // Pass 0 to test the fallback
        const testService = new SecurityService('secret', 0)
        // Should fallback to config value
        expect(testService['otpExpirySeconds']).toBe(300)
    })

    it('uses hardcoded 300 when both params and config are falsy', () => {
        // Mock config to have falsy values
        const originalConfig = (common as any).config
        ;(common as any).config = {
            ...originalConfig,
            ISSUER_HMAC_SECRET: '',
            OTP_EXPIRY_SECONDS: 0
        }

        const testService = new SecurityService('', 0)
        // Should fallback to hardcoded value 300
        expect(testService['otpExpirySeconds']).toBe(300)
        expect(testService['hmacSecret']).toBeTruthy()

        // Restore
        ;(common as any).config = originalConfig
    })
})
