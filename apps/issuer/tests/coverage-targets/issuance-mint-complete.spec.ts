import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { EmailMock, SqlJsStorageAdapter } from '@circuloos/common'
import { logger } from '../../src/logger'

/**
 * Complete coverage for issuanceService.ts mint() method
 * Lines: 106-107, 109-110, 119-120, 128-130
 *
 * Updated: IssuanceService now takes an IStorageAdapter (`storage`, sql.js) instead of a
 * FileStore (`store`), and dev-only console.debug calls were replaced by pino logger.debug.
 */

describe('IssuanceService - Complete Mint Coverage', () => {
    let store: SqlJsStorageAdapter
    let loggerDebugSpy: any

    beforeEach(() => {
        loggerDebugSpy = vi.spyOn(logger, 'debug')
        store = new SqlJsStorageAdapter(':memory:')
    })

    afterEach(() => {
        loggerDebugSpy.mockRestore()
    })

    it('throws error when domain missing verifyingContract (lines 106-107)', async () => {
        const mockRegistry = {
            address: '0x0000000000000000000000000000000000000001', // Must be a property, not a method!
            isTrustedIssuer: async () => true,
            recordIssuance: async () => null
        }

        const svc = new IssuanceService({
            storage: store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
            trustedIssuerRegistry: mockRegistry as any
        })

        const prepareResult = await svc.prepare(
            'test@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company'
        )

        const domainWithoutContract = {
            name: 'TrustedIssuerRegistry',
            version: '1.0',
            chainId: 31337
            // Missing verifyingContract!
        }

        // Lines 106-107: Should throw when verifyingContract is missing
        await expect(
            svc.mint(prepareResult.id, '0xsig', '0x1234567890123456789012345678901234567890', domainWithoutContract)
        ).rejects.toThrow('trusted issuer registry enabled but domain missing verifyingContract')
    })

    it('throws error when verifyingContract mismatch (lines 109-110)', async () => {
        const mockRegistry = {
            address: '0x0000000000000000000000000000000000000002', // Property, not method
            isTrustedIssuer: async () => true,
            recordIssuance: async () => null
        }

        const svc = new IssuanceService({
            storage: store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
            trustedIssuerRegistry: mockRegistry as any
        })

        const prepareResult = await svc.prepare(
            'test2@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company'
        )

        const domainWithWrongContract = {
            name: 'TrustedIssuerRegistry',
            version: '1.0',
            chainId: 31337,
            verifyingContract: '0x0000000000000000000000000000000000000001' // Different from registry
        }

        // Lines 109-110: Should throw when verifyingContract doesn't match
        await expect(
            svc.mint(prepareResult.id, '0xsig', '0x1234567890123456789012345678901234567890', domainWithWrongContract)
        ).rejects.toThrow('verifyingContract must match trusted issuer registry address')
    })

    it('logs mint signature verification data (logger.debug)', async () => {
        const svc = new IssuanceService({
            storage: store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
        })

        const prepareResult = await svc.prepare(
            'test3@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company'
        )

        // Call mint with invalid signature to trigger error AFTER the debug log
        await expect(
            svc.mint(prepareResult.id, '0xbadsignature', '0x1234567890123456789012345678901234567890')
        ).rejects.toThrow('invalid issuer signature')

        // Debug log carries domain, VC id, signer and signature presence (signature itself is not logged)
        expect(loggerDebugSpy).toHaveBeenCalledWith(
            {
                domain: expect.any(Object),
                vcId: prepareResult.draftVc.id,
                issuerSigner: '0x1234567890123456789012345678901234567890',
                hasSignature: true
            },
            'Mint signature verification starting'
        )
    })

    it('logs recovered/expected addresses on signer mismatch (logger.debug)', async () => {
        const mockSecurity = {
            verifySignature: () => '0xRECOVERED_ADDRESS_DIFFERENT', // Return different address
            buildDomain: () => ({ name: 'Test', version: '1.0', chainId: 31337 }),
            generateOtpCode: (len: number) => '123456',
            hashOtp: (otp: string) => 'hashed',
            createSessionToken: (data: any) => 'token',
            getExpiryDate: () => Date.now() + 300000
        }

        // Manually create service with mocked security
        const svcWithMockedSecurity: any = new IssuanceService({
            storage: store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
        })

        // Replace security service
        svcWithMockedSecurity.security = mockSecurity

        const prepareResult = await svcWithMockedSecurity.prepare(
            'test4@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company'
        )

        // Call mint - should fail with signer mismatch
        await expect(
            svcWithMockedSecurity.mint(prepareResult.id, '0xsig', '0x1234567890123456789012345678901234567890')
        ).rejects.toThrow('issuer signer mismatch')

        // Debug log should carry the recovered and expected addresses
        expect(loggerDebugSpy).toHaveBeenCalledWith(
            {
                recovered: '0xRECOVERED_ADDRESS_DIFFERENT',
                expected: '0x1234567890123456789012345678901234567890'
            },
            'Signer mismatch'
        )
    })
})
