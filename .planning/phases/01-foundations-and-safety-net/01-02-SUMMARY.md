---
phase: 01-foundations-and-safety-net
plan: 02
subsystem: infra
tags: [eslint, engine-boundary, no-restricted-syntax, no-restricted-globals, import-no-restricted-paths, tsc, vitest, guard-test, purity]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: engine/tsconfig.json (lib ES2022, types []), engine/tsconfig.test.json, the typecheck/lint scripts, Vitest engine project
provides:
  - ESLint engine override banning non-relative imports (static, re-export, dynamic), app/ and workers/ imports, DOM/Node globals, Math.random, new Date(), Date.now inside engine/ (engine/test and engine/cli excluded)
  - engine/test/guard.test.ts, 22 tests that fail if either the tsc or the ESLint half of the boundary is weakened
  - ROADMAP success criterion 4 proven end to end through the single `npm run typecheck` script
affects: [01-03, 01-04, 01-08, phase-02-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-mechanism boundary: tsc (lib ES2022, types []) rejects DOM/Node names and node: modules; ESLint selectors reject bare/app imports and nondeterminism; both run inside `npm run typecheck`"
    - "Guard by construction: ESLint.lintText on a virtual engine/ path (no files written) and a temp tsconfig that extends the real engine config"
    - "Untyped CJS dependency loaded through createRequire with a local interface (loader named loadCjs, no any, no dependency added)"

key-files:
  created:
    - engine/test/guard.test.ts
  modified:
    - .eslintrc.json

key-decisions:
  - "The override is exactly the research-verified config (no-restricted-syntax selectors, because the regex option of no-restricted-imports does not exist in ESLint 8.57.1)"
  - "The virtual-path lintText call reports import/no-restricted-paths, so the in-repo probe fallback in the plan was not needed and no probe file is ever written into the repo by the test"
  - "Scope is guarded both ways: an engine/core file is linted (12 violation cases) and an engine/test file is not (T-01-06a)"

patterns-established:
  - "Boundary tests assert on rule ids (filtered to the three boundary rules) rather than on message text or counts, so unrelated Next lint rules never make the guard flaky"

requirements-completed: [FND-04]

# Metrics
duration: 3min
completed: 2026-09-26
---

# Phase 1 Plan 02: Engine Boundary Summary

**ESLint engine override (bare imports, app/ imports, DOM/Node globals, nondeterminism) plus a 22-test guard proving tsc and ESLint both reject violations and accept clean ES2022 code, all enforced by the single `npm run typecheck`.**

## Performance

- **Duration:** about 3 min (started 2026-09-26T02:15:55Z, finished 2026-09-26T02:19Z)
- **Tasks:** 2 (2 commits)
- **Files modified:** 2 (1 created, 1 modified), matching the plan's `files_modified` list

## Accomplishments

- `.eslintrc.json` still extends `next/core-web-vitals` and `next/typescript` and adds the `engine/**/*.ts` override (excluded: `engine/test/**`, `engine/cli/**`) with `import/no-restricted-paths` (engine to app/workers), `no-restricted-globals` (window, document, navigator, localStorage, sessionStorage, process, Buffer, fetch) and seven `no-restricted-syntax` selectors (four non-relative import/export forms, `Math.random()`, `new Date()`, `Date.now()`).
- `npm run lint` exits 0 on the tree with the override in place.
- `engine/test/guard.test.ts` (118 lines, 22 tests, 3 describe blocks) passes in about 3.7 s. The whole Vitest `engine` project passes (2 files, 24 tests: canary plus guard).
- `npm run typecheck` exits 0 on the committed tree, including the guard file itself (`noUncheckedIndexedAccess`, no `any`, no identifier named `require`).
- The render path is untouched: `git diff --quiet 7c38ad9 HEAD -- app public next.config.js postcss.config.js tailwind.config.ts` exits 0.

## Probe Outcomes (ROADMAP success criterion 4, recorded as required)

Task 1, ESLint alone (probe `engine/__probe__.ts` containing `import React from 'react'`):

| Step | Command | Result |
|------|---------|--------|
| Probe present | `npx next lint --dir engine` | exit 1, `1:1  Error: engine/ uses relative imports only  no-restricted-syntax` |
| Probe deleted | `npx next lint --dir engine` | exit 0, `No ESLint warnings or errors` |

Task 2, end to end through `npm run typecheck`:

| Probe content | Result |
|---------------|--------|
| `export const t = document.title` | exit 2, `engine/__probe__.ts(1,18): error TS2584: Cannot find name 'document'...` (from `tsc -p engine/tsconfig.json`; the root tsc has the DOM lib and does not object) |
| `import React from 'react'\nexport const a = React` | exit 1, tsc passes (as Pitfall 7 predicts), then `npm run lint` fails with `engine/ uses relative imports only  no-restricted-syntax` |
| Probe deleted | exit 0 |

The probe file was created and deleted each time and never staged or committed (`git status --short` showed only `engine/test/guard.test.ts` afterwards).

## Task Commits

1. **Task 1: Engine boundary override in .eslintrc.json** - `74d2c9f` (feat)
2. **Task 2: Guard test proving the tsc and ESLint boundaries** (tdd) - `5550fc9` (test); see TDD Note below

**Plan metadata:** committed separately after this file (docs: complete plan).

## TDD Note

Task 2 is marked `tdd="true"`, but the implementation it tests (the ESLint override and the engine tsconfig) was delivered by Task 1 and plan 01-01, so the test necessarily passed on first run (22/22). To prove the guard is not vacuous, a mutation check stood in for the RED gate: `.eslintrc.json` was temporarily reverted to the pre-override two-line config and the guard was re-run. Result: 12 failed, 10 passed (all 12 ESLint violation cases failed; the positive, scope, tsc and wiring tests still passed). `.eslintrc.json` was then restored with `git checkout -- .eslintrc.json` (specific file) and the guard passes again 22/22. Consequently the git history has no separate `feat` commit after the `test` commit for Task 2; the `feat` for this behaviour is Task 1's `74d2c9f`, which precedes the test. This is a plan-structure consequence, not a skipped gate.

## Files Created/Modified

- `.eslintrc.json` - engine boundary override (exactly the research-verified config)
- `engine/test/guard.test.ts` - ESLint cases (12 violations, 1 clean, 1 scope), tsc cases (1 negative with TS2584/TS2591/TS2307, 1 positive ES2022), typecheck wiring cases (5 script parts plus `--dir engine`)

## Decisions Made

- Used the override verbatim from the plan; no selector changes were needed.
- The lintText virtual-path approach works for `import/no-restricted-paths` (the resolver does not need a real file for a relative path into `app/`), so the plan's documented fallback (writing `engine/core/__guard_probe__.ts` and using `lintFiles`) was not exercised and is not in the test.
- Boundary assertions filter ESLint messages to the three boundary rule ids, so the guard is insensitive to unrelated Next lint rules.

## Deviations from Plan

None - plan executed exactly as written. (The mutation check in the TDD Note is an addition for verification only and changed no committed file.)

## Issues Encountered

- None blocking. `npm install` was not run in this plan, so `dist/` and `yarn.lock` were not touched and the tree stayed clean apart from `.planning/`.
- `next lint --dir workers` still tolerates the absent `workers/` directory, as recorded in 01-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-03 and 01-04 (wave 2) do not depend on this plan. Any file they add under `tests/`, `e2e/` or `scripts/` is outside the engine override; `npm run typecheck` currently exits 0.
- From Phase 2 on, engine modules under `engine/` (other than `engine/test` and `engine/cli`) are linted with the purity rules by `npm run typecheck` and `npm run lint`. Engine tests and CLIs may use `node:` modules and `process`.
- Plan 01-08's `verify` gate already includes `npm run typecheck`, so the boundary is enforced there with no further wiring.

## Requirements Note

`requirements-completed` lists FND-04 because this plan's frontmatter carries it, and this plan delivers the boundary enforcement and its guard. Per the orchestrator's instruction FND-* checkboxes are marked at phase level, so `requirements.mark-complete` was not run and REQUIREMENTS.md was not edited.

## Known Stubs

None.

## Threat Flags

None. The guard test writes only to `os.tmpdir()` (removed in `finally`); no new network, auth or trust-boundary surface. T-01-04 and T-01-06a are mitigated as planned (the scope test fails if the `files` glob is narrowed or `engine/test/**` stops being excluded); T-01-05 accepted as planned (no in-repo probe is written by the test).

## Self-Check: PASSED

- FOUND: `.eslintrc.json`, `engine/test/guard.test.ts`
- FOUND commits: `74d2c9f`, `5550fc9`
- `npm run typecheck` exits 0 and `test ! -e engine/__probe__.ts` holds on the committed tree
