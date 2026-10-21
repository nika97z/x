import { defineConfig, devices } from '@playwright/test'

// Uses the Microsoft Edge that ships with Windows, so no browser download is needed.
// Override with PW_CHANNEL=chrome. PW_PORT and PW_OUTPUT_DIR let several runs happen at once.
const port = Number(process.env.PW_PORT ?? 5199)
const previewPort = port + 100
const channel = process.env.PW_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: './e2e',
  outputDir: process.env.PW_OUTPUT_DIR ?? 'test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // The main target: a phone, with touch.
    { name: 'phone', testMatch: 'mobile.spec.ts', use: { ...devices['Pixel 7'], channel } },
    { name: 'desktop', testMatch: 'todos.spec.ts', use: { ...devices['Desktop Edge'], channel } },
    // The installable app needs the production build, where the service worker runs.
    {
      name: 'installed app',
      testMatch: 'pwa.spec.ts',
      use: { ...devices['Pixel 7'], channel, baseURL: `http://localhost:${previewPort}` },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: true,
    },
    {
      command: `npm run build && npm run preview -- --port ${previewPort} --strictPort`,
      url: `http://localhost:${previewPort}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
