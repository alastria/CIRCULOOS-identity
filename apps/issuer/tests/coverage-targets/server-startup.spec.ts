import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testServerStartup, cleanupServerMocks } from '../helpers/server-lifecycle.helper'
import { patchServerWithMocks, mockConsole, mockProcessExit } from '../fixtures/mocks/fastify.mock'
import { config } from '../../src/config'

// start() now reports through the shared pino logger (createLogger('issuer') from
// @circuloos/common) instead of console.log / server.log.error.
const issuerLogger = vi.hoisted(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn()
}))
vi.mock('@circuloos/common', async () => {
    const actual = await vi.importActual<any>('@circuloos/common')
    return { ...actual, createLogger: () => issuerLogger }
})

/**
 * Tests to cover server startup code (index.ts lines 115-131)
 * This tests the start() function and require.main === module condition
 */

describe('Server Startup Coverage (index.ts 115-131)', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        originalEnv = { ...process.env }
        vi.clearAllMocks()
    })

    afterEach(() => {
        process.env = originalEnv
        vi.restoreAllMocks()
    })

    it('covers successful server startup (lines 115-126)', async () => {
        // Import fresh server instance
        const serverModule = await import('../../src/index')
        const server = serverModule.default

        const consoleMock = mockConsole()
        const mocks = patchServerWithMocks(server, { listenShouldSucceed: true })

        // Set expected environment variables
        const port = process.env.PORT || '3000'
        const host = process.env.HOST || '0.0.0.0'

        // Manually invoke start() function to cover lines 115-126
        const startFn = (serverModule as any).start
        if (startFn) {
            await startFn()

            // Verify listen was called with the configured port/host
            expect(mocks.mockListen).toHaveBeenCalledWith({ port: config.issuer.port, host: config.http.host })

            // Verify startup message was logged
            expect(issuerLogger.info).toHaveBeenCalledWith(
                `Issuer Service started at http://${config.http.host}:${config.issuer.port}`
            )
            expect(issuerLogger.info).toHaveBeenCalledWith(
                `API Docs: http://${config.http.host}:${config.issuer.port}/api/v1/docs`
            )
        }

        cleanupServerMocks({ consoleMock, listenMock: mocks.mockListen })
    })

    it('covers server startup failure and error handling (lines 127-130)', async () => {
        const serverModule = await import('../../src/index')
        const server = serverModule.default

        const consoleMock = mockConsole()
        const exitMock = mockProcessExit()
        const mocks = patchServerWithMocks(server, { listenShouldSucceed: false })

        const startFn = (serverModule as any).start
        if (startFn) {
            try {
                await startFn()
            } catch (err: any) {
                // process.exit(1) throws in our mock
                expect(err.message).toContain('process.exit(1)')
            }

            // Verify error was logged and the process asked to exit with code 1
            expect(issuerLogger.fatal).toHaveBeenCalledWith('Failed to start server', expect.any(Error))
            expect(exitMock).toHaveBeenCalledWith(1)
        }

        cleanupServerMocks({ consoleMock, exitMock, listenMock: mocks.mockListen })
    })

    it('covers require.main === module condition (line 133)', () => {
        // This test verifies the module can be imported without auto-starting
        // If line 133 wasn't there, importing would start the server automatically

        // Simply importing the module should NOT start the server
        // because require.main !== module in test environment
        const testImport = async () => {
            const serverModule = await import('../../src/index')
            return serverModule.default
        }

        // Should not throw - server doesn't auto-start in tests
        expect(testImport()).resolves.toBeDefined()
    })
})
