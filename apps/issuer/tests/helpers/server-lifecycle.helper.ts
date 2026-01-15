import type { FastifyInstance } from 'fastify'
import { patchServerWithMocks, mockConsole, mockProcessExit } from '../fixtures/mocks/fastify.mock'
import { vi } from 'vitest'

/**
 * Helper functions for testing server lifecycle (startup, shutdown)
 */

export interface ServerStartupTestOptions {
    shouldSucceed?: boolean
    mockConsoleOutput?: boolean
    mockProcessExit?: boolean
}

export interface ServerStartupTestResult {
    consoleMock?: ReturnType<typeof mockConsole>
    exitMock?: ReturnType<typeof mockProcessExit>
    listenMock: any
    error?: Error
}

/**
 * Test server startup behavior with controlled mocks
 */
export async function testServerStartup(
    server: FastifyInstance,
    options: ServerStartupTestOptions = {}
): Promise<ServerStartupTestResult> {
    const {
        shouldSucceed = true,
        mockConsoleOutput = true,
        mockProcessExit: shouldMockExit = true
    } = options

    const result: ServerStartupTestResult = {
        listenMock: null
    }

    // Patch server with mocks
    const { mockListen } = patchServerWithMocks(server, {
        listenShouldSucceed: shouldSucceed,
        mockLogger: true
    })
    result.listenMock = mockListen

    // Mock console if requested
    if (mockConsoleOutput) {
        result.consoleMock = mockConsole()
    }

    // Mock process.exit if requested
    if (shouldMockExit) {
        result.exitMock = mockProcessExit()
    }

    return result
}

/**
 * Cleanup mocks after server testing
 */
export function cleanupServerMocks(result: ServerStartupTestResult) {
    if (result.consoleMock) {
        result.consoleMock.log.mockRestore()
        result.consoleMock.error.mockRestore()
        result.consoleMock.warn.mockRestore()
        result.consoleMock.debug.mockRestore()
    }

    if (result.exitMock) {
        result.exitMock.mockRestore()
    }

    if (result.listenMock) {
        result.listenMock.mockRestore?.()
    }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 10): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
