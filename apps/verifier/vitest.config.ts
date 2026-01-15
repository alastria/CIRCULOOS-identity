import { defineConfig } from 'vitest/config'

// Minimal Vitest config to avoid loading Vite's config during tests
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',
        'src/fastify.ts',
        'src/routes/eip712.ts',
        'src/routes/hybrid.ts',
        'src/routes/playground.ts',
        'src/services/onchainService.ts',
        'src/services/persistentStore.ts',
        'src/services/sqlIssuerStore.ts',
        'src/services/sqlCredentialStore.ts'
      ],
      reportsDirectory: './coverage',
      skipFull: false,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    }
  },
})
