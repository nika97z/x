import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the built app works from any folder or sub-path it is hosted in.
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Node 22+ has its own global localStorage, which would hide jsdom's.
    execArgv: ['--no-experimental-webstorage'],
  },
})
