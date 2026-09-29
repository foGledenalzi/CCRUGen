import { defineConfig } from 'vitest/config'

// TZ pin as data (research Pattern 3). Verified on Windows: a runtime assignment works, while a
// process-start TZ=Zone/Name is ignored by Node here. npm scripts set CCRUG_TZ through cross-env;
// engine/test/tz.test.ts is the canary that fails loudly if this pin stops working.
process.env.TZ = process.env.CCRUG_TZ ?? 'UTC'

export default defineConfig({
  // The root tsconfig.json sets jsx: "preserve" (Next.js compiles JSX itself), which Vite 8's default oxc
  // transformer picks up and then can't emit valid JS from; override it here for Vitest's own transform.
  // Needed since 04-09: the oracle project imports Projection.tsx directly for a server-render smoke
  // (tests/app/projectionRender.test.ts).
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    projects: [
      { test: { name: 'engine', environment: 'node', include: ['engine/**/*.test.ts'], testTimeout: 30_000 } },
      { test: { name: 'oracle', environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30_000 } },
    ],
  },
})
