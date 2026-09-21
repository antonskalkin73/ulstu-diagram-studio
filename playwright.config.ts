import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined, viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
})
