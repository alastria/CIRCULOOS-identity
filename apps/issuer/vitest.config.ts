import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        // Several specs import the full server (src/index.ts: swagger, sql.js WASM, routes)
        // inside the test body; under a parallel run that first import can exceed the 5s/10s
        // defaults, producing spurious timeouts.
        testTimeout: 30000,
        hookTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'tests/',
                '**/*.d.ts',
                '**/*.config.ts',
            ],
        },
    },
})
