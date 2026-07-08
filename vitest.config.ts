import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 15000,
  },
  resolve: {
    alias: [
      { find: '@/app', replacement: path.resolve(__dirname, './app') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
