import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// `~` and `@` both resolve to <front>/app, matching the Nuxt 4 srcDir layout.
const appDir = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': appDir,
      '@': appDir,
    },
  },
  test: {
    // Pure logic only - no DOM needed. Switch a file to happy-dom locally if required.
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
  },
})
