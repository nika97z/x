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
    // The production build (where the service worker runs), served from a sub-folder like GitHub Pages does.
    {
      name: 'installed app',
      testMatch: 'pwa.spec.ts',
      use: { ...devices['Pixel 7'], channel, baseURL: `http://localhost:${previewPort}/x/` },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: true,
    },
    {
      command: `npm run build && npm run preview -- --port ${previewPort} --strictPort --base /x/`,
      url: `http://localhost:${previewPort}/x/`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
