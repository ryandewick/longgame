import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // local/ is the optional private add-on of one local copy (see docs/ARCHITECTURE.md). It is never committed,
    // so for everyone else the second pattern matches nothing.
    include: ['tests/**/*.test.ts', 'local/**/*.test.ts'],
    environment: 'node',
  },
})
