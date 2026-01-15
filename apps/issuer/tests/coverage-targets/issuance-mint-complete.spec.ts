import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IssuanceService } from '../../src/services/issuanceService'
import { FileStore } from '@circuloos/file-store'
import { EmailMock } from '@circuloos/common'

/**
 * Complete coverage for issuanceService.ts mint() method
 * Lines: 106-107, 109-110, 119-120, 128-130
 */

describe('IssuanceService - Complete Mint Coverage', () => {
    let store: FileStore
    let origEnv: NodeJS.ProcessEnv
    let consoleDebugSpy: any

    beforeEach(() => {
        origEnv = { ...process.env }
        process.env.NODE_ENV = 'development'
        process.env.ISSUER_HMAC_SECRET = 'test-secret'
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
        store = new FileStore('./tmp-filestore-mint-complete')
    })

    afterEach(() => {
        process.env = origEnv
        consoleDebugSpy.mockRestore()
    })

    it('throws error when domain missing verifyingContract (lines 106-107)', async () => {
        const mockRegistry = {
            address: '0x0000000000000000000000000000000000000001', // Must be a property, not a method!
            isTrustedIssuer: async () => true,
            recordIssuance: async () => null
        }

        const svc = new IssuanceService({
            store,
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
            store,
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

    it('executes console.debug with mint data in development (lines 119-120)', async () => {
        const svc = new IssuanceService({
            store,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
        })

        const prepareResult = await svc.prepare(
            'test3@example.com',
            '0x1234567890123456789012345678901234567890',
            'Test Company'
        )

        // Call mint with invalid signature to trigger error AFTER console.debug
        try {
            await svc.mint(prepareResult.id, '0xbadsignature', '0x1234567890123456789012345678901234567890')
        } catch (e) {
            // Expected to fail, but console.debug should have been called first
        }

        // Lines 119-120: console.debug should have been called with domain, vc, and signature
        expect(consoleDebugSpy).toHaveBeenCalledWith(
            '[DEV] mint: domain=',
            expect.any(String),
            'vc=',
            expect.any(String),
            'issuerSignature=',
            '0xbadsignature'
        )
    })

    it('executes console.debug when signer mismatch in development (lines 128-130)', async () => {
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
            store,
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

        // Lines 128-130: console.debug should have been called with recovered and expected addresses
        expect(consoleDebugSpy).toHaveBeenCalledWith(
            '[DEV] mint: recovered=',
            '0xRECOVERED_ADDRESS_DIFFERENT',
            'expected=',
            '0x1234567890123456789012345678901234567890'
        )
    })
})
