import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3111)
const dev = process.env.E2E_SERVER === 'dev'                // golden CAPTURE only (untouched viewer); default serves the static export
const STATIC_DIR = process.env.E2E_STATIC_DIR || 'out'      // .e2e-basepath for the sub-path test (plan 01-05)
const BASE = process.env.E2E_BASE_PATH || ''                 // e.g. /ccrug for the sub-path test
const project = (name: string, timezoneId: string) => ({
  name,
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, timezoneId },
})

export default defineConfig({
  testDir: 'e2e',
  testMatch: /\.spec\.ts$/,                                 // Vitest never collects .spec.ts; Playwright never collects .test.ts
  snapshotPathTemplate: '{testDir}/__golden__/{testFilePath}/{arg}{ext}', // no project/platform: ONE golden set for both TZ projects
  updateSnapshots: process.env.GOLDEN_CAPTURE === '1' ? 'missing' : 'none', // never 'all'; Playwright's own CLI default would be 'missing'
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: 'en-US', colorScheme: 'dark' },
  projects: [project('chromium-utc', 'UTC'), project('chromium-ny', 'America/New_York')],
  webServer: {
    command: dev ? `npx next dev -p ${PORT}` : `npx serve ${STATIC_DIR} -l ${PORT} --no-clipboard`,
    url: `http://127.0.0.1:${PORT}${BASE}/numogram/`,
    reuseExistingServer: false,                             // never test a stale server by accident (deliberate deviation from the lab's `true`)
    timeout: 180_000,
  },
})
