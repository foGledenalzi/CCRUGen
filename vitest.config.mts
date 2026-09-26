import { defineConfig } from 'vitest/config'

// TZ pin as data (research Pattern 3). Verified on Windows: a runtime assignment works, while a
// process-start TZ=Zone/Name is ignored by Node here. npm scripts set CCRUG_TZ through cross-env;
// engine/test/tz.test.ts is the canary that fails loudly if this pin stops working.
process.env.TZ = process.env.CCRUG_TZ ?? 'UTC'

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine', environment: 'node', include: ['engine/**/*.test.ts'], testTimeout: 30_000 } },
      { test: { name: 'oracle', environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30_000 } },
    ],
  },
})
