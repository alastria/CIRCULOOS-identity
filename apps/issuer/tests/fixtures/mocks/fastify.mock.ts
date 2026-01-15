import type { FastifyInstance } from 'fastify'
import { vi } from 'vitest'

/**
 * Mock for Fastify server.listen() method
 * Used to test server startup without actually binding to a port
 */

export interface MockListenOptions {
    port: number
    host: string
}

export interface MockServerListenResult {
    port: number
    host: string
    address: string
}

/**
 * Create a mock listen function that simulates successful server startup
 */
export const createMockListen = (shouldSucceed: boolean = true) => {
    return vi.fn(async (opts: MockListenOptions): Promise<string> => {
        if (!shouldSucceed) {
            throw new Error('EADDRINUSE: Address already in use')
        }
        return `http://${opts.host}:${opts.port}`
    })
}

/**
 * Mock server.log methods
 */
export const createMockLogger = () => {
    return {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn()
    }
}

/**
 * Mock process.exit to prevent tests from actually exiting
 */
export const mockProcessExit = () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`process.exit(${code})`)
    })
    return exitSpy
}

/**
 * Mock console methods to capture output
 */
export const mockConsole = () => {
    return {
        log: vi.spyOn(console, 'log').mockImplementation(() => { }),
        error: vi.spyOn(console, 'error').mockImplementation(() => { }),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
        debug: vi.spyOn(console, 'debug').mockImplementation(() => { })
    }
}

/**
 * Mock require.main to simulate running as main module
 */
export const mockRequireMain = (moduleToTest: NodeModule, asMain: boolean = true) => {
    // Store original value
    const originalMain = require.main

    if (asMain) {
        // Make the tested module appear as the main module
        Object.defineProperty(require, 'main', {
            value: moduleToTest,
            configurable: true,
            writable: true
        })
    }

    return () => {
        // Restore original
        Object.defineProperty(require, 'main', {
            value: originalMain,
            configurable: true,
            writable: true
        })
    }
}

/**
 * Helper to patch a Fastify server instance with mocks
 */
export const patchServerWithMocks = (
    server: FastifyInstance,
    options: {
        listenShouldSucceed?: boolean
        mockLogger?: boolean
    } = {}
) => {
    const { listenShouldSucceed = true, mockLogger = true } = options

    // Mock listen
    const mockListen = createMockListen(listenShouldSucceed)
        ; (server as any).listen = mockListen

    // Mock logger if requested
    if (mockLogger) {
        const logger = createMockLogger()
            ; (server as any).log = logger
    }

    return {
        mockListen,
        mockLogger: mockLogger ? (server as any).log : null
    }
}
