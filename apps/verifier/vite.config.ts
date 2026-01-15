import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@circuloos/test-utils': path.resolve(__dirname, '../../packages/test-utils/src'),
      '@circuloos/issuer-server': path.resolve(__dirname, '../../apps/issuer/src/index.ts')
    }
  }
})
