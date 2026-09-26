---
phase: 01-foundations-and-safety-net
plan: 01
subsystem: infra
tags: [npm, exact-pins, gitattributes, typescript, es2022, vitest, tz-canary, golden-manifest, sha256, engine-scaffold]

# Dependency graph
requires:
  - phase: none
    provides: first plan of the project; starts from the untouched lumpenspace/ccru viewer (upstream tip 7c38ad9)
provides:
  - LF enforcement (.gitattributes) committed before any fixture or golden exists
  - Exact-pinned npm install with a committed package-lock.json (next 14.2.35, vitest 5.0.2, vite 8.3.1, playwright 1.63.0, typescript 5.9.3, eslint 8.57.1)
  - Final-shape package.json (ccrug identity, every Phase 1 script entry defined up front, build is `next build` only)
  - Root type-check at ES2022 and a `typecheck` script covering root tsc, both engine tsconfigs, the components tsconfig and lint
  - engine/ scaffold with its own pure tsconfig (lib ES2022, types []) and a test tsconfig (types node)
  - Vitest 5 with engine + oracle projects, TZ pinned from CCRUG_TZ, and a canary proving the pin
  - scripts/golden-manifest.mjs, a tested freeze/verify tool that refuses to overwrite a frozen golden
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, phase-02-engine]

# Tech tracking
tech-stack:
  added: [vitest 5.0.2, vite 8.3.1, "@playwright/test 1.63.0", fast-check 4.10.2, tsx 4.23.15, cross-env 10.1.0, serve 14.2.6, fflate 0.8.3, typescript 5.9.3 (exact), next 14.2.35 (exact)]
  patterns:
    - "Environment pin as data: process.env.TZ assigned in vitest.config.mts from CCRUG_TZ, proven by a canary test"
    - "Frozen-baseline goldens: sha256 manifest with never-overwrite semantics; a change adds a NEW dated set with a written reason"
    - "Pure tool modules exported from a CLI script (verifyManifest is pure and takes readFile/listDir), tested against an in-memory file system"

key-files:
  created:
    - .gitattributes
    - package-lock.json
    - engine/package.json
    - engine/tsconfig.json
    - engine/tsconfig.test.json
    - engine/index.ts
    - engine/test/tz.test.ts
    - vitest.config.mts
    - scripts/golden-manifest.mjs
    - tests/repo/golden-manifest.test.ts
  modified:
    - .gitignore
    - package.json
    - tsconfig.json

key-decisions:
  - "TZ is pinned by a runtime assignment in vitest.config.mts driven by CCRUG_TZ (a process-start TZ=Zone/Name is ignored by Node on this Windows machine); tz.test.ts is the canary"
  - "golden-manifest resolves manifest paths and targets against the repo root, records repo-relative forward-slash paths, and prints problems on stderr with exit code 1"
  - "freeze refuses any file containing a CR byte, and addSet refuses a reused set name, a re-frozen file, an empty reason, a bad set name or an empty file list"
  - "The TDD task was committed as test then feat (two commits) rather than one combined commit"

patterns-established:
  - "Every npm install must be followed by git checkout -- dist and git checkout -- yarn.lock until plan 01-08 untracks them"
  - "Scripts that later plans call (check:repo, check:weight, test:e2e:basepath, verify) are defined in package.json now so no parallel-wave plan edits it"

requirements-completed: [FND-01, FND-02, FND-04]

# Metrics
duration: 6min
completed: 2026-09-26
---

# Phase 1 Plan 01: Toolchain, LF Enforcement, ES2022, Vitest TZ Canary and Golden-Manifest Freeze Tool Summary

**Exact-pinned npm toolchain with committed lockfile, ES2022 root target and a pure `engine/` scaffold, Vitest 5 with a TZ canary proven in UTC and America/New_York, and a sha256 golden-manifest tool that can never overwrite a frozen file.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-09-26T02:05Z (approximate; start time was not captured in a variable)
- **Completed:** 2026-09-26T02:11Z
- **Tasks:** 3 (4 commits: Task 3 is TDD, test then feat)
- **Files modified:** 13 (10 created, 3 modified), matching the plan's `files_modified` list

## Accomplishments

- `.gitattributes` (`* text=auto eol=lf`) is committed before any fixture exists; `git add --renormalize .` restaged nothing but `.gitattributes`, so the index was already LF. Every committed blob from this plan has zero CR bytes.
- `npm install` ran once from the exact pins and produced `package-lock.json`. Lockfile versions read back as `next@14.2.35 vitest@5.0.2 vite@8.3.1 @playwright/test@1.63.0 typescript@5.9.3 eslint@8.57.1`; `npm ls next` shows only 14.2.35 (deduped under `@vercel/analytics`). `npm run build:components` still exits 0 after the rename to `ccrug`.
- `npm run typecheck` exits 0 at ES2022: root `tsc --incremental false`, `tsc -p engine`, `tsc -p engine/tsconfig.test.json`, `tsc -p tsconfig.components.json`, and `next lint --dir app --dir engine --dir workers` (the absent `workers/` is tolerated).
- `npm run test` and `npm run test:tz` both pass (2 files, 25 tests) in UTC and America/New_York; the canary asserts offset 0 and 300 respectively, and a plain-node spot check of `process.env.TZ='America/New_York'` printed 300.
- `scripts/golden-manifest.mjs` exports `ROOT, sha256, toRepoPath, listFiles, emptyManifest, addSet, verifyManifest, verifyManifestFile`; 23 tests cover every behavior bullet in the plan plus `listFiles` and the real CLI (freeze, verify, refuse to overwrite, tamper detection, CR refusal). `node scripts/golden-manifest.mjs verify does-not-exist.json` exits 1 and prints `manifest missing`.
- The render path is untouched: `git diff --quiet 7c38ad9 HEAD -- app public next.config.js postcss.config.js tailwind.config.ts` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: LF enforcement, ignore rules and exact-pinned npm install** - `1240f78` (chore)
2. **Task 2: ES2022 root target, engine scaffold, Vitest config and TZ canary** - `3991f25` (feat)
3. **Task 3: Golden-manifest freeze/verify tool** (TDD)
   - RED: `0151e4f` (test) - 23 tests failing on the missing module
   - GREEN: `ceb4ac6` (feat) - implementation, 23/23 passing

**Plan metadata:** committed separately after this file (docs: complete plan).

## Files Created/Modified

- `.gitattributes` - LF normalization (`* text=auto eol=lf`) plus binary types
- `.gitignore` - adds `/out/`, `/dist/`, `/artifacts/`, `/.e2e-basepath/`, `*.tsbuildinfo`, `yarn.lock`, `demo.mov`, `.DS_Store`, `/test-results/`, `/playwright-report/`, `/.pw-browsers/`; keeps `reference/`
- `package.json` - `ccrug` identity, exact pins, `packageManager`/`engines`, all Phase 1 scripts; `main`/`types`/`exports`/`files` unchanged
- `package-lock.json` - npm lockfile for `npm ci`
- `tsconfig.json` - only `target` (es5 to ES2022) and one added `"**/*.mts"` include
- `engine/package.json`, `engine/tsconfig.json`, `engine/tsconfig.test.json`, `engine/index.ts` - pure engine compiler boundary (no DOM, no Node types)
- `vitest.config.mts` - `engine` and `oracle` projects; `process.env.TZ = process.env.CCRUG_TZ ?? 'UTC'`
- `engine/test/tz.test.ts` - canary for the TZ pin
- `scripts/golden-manifest.mjs` - freeze/verify tool (zero dependencies, ESM)
- `tests/repo/golden-manifest.test.ts` - 23 tests (in-memory unit tests plus CLI tests in a scratch dir under `node_modules`, removed afterwards)

## Decisions Made

- TZ pin is a runtime assignment driven by the project variable `CCRUG_TZ` (per research; process-start `TZ=` is ignored by Node on this machine), with a canary that fails loudly if the pin stops working.
- `golden-manifest` paths (manifest and targets) resolve against the repo root and are stored as repo-relative forward-slash paths, so the same manifest verifies on Windows and Linux. `verify` writes problems to stderr and sets exit code 1 (`process.exitCode`, so output flushes). `verifyManifestFile` accepts extra arguments harmlessly, so plan 01-08's `MANIFESTS.flatMap(verifyManifestFile)` works.
- The TDD task got a RED commit and a GREEN commit instead of the single combined commit the plan text implies; the plan's "commit both files" is satisfied in aggregate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `git add --renormalize .` staged an unrelated modified file**
- **Found during:** Task 1 (step 1)
- **Issue:** `--renormalize` re-adds every tracked file, so it also staged the already-modified `.planning/STATE.md`, which the Task 1 commit must not contain.
- **Fix:** `git restore --staged .planning/STATE.md` (index only; working tree untouched). `.gitattributes` remained the only other staged file, as the plan expected.
- **Files modified:** none (index only)
- **Verification:** `git status --short` showed `A .gitattributes` and ` M .planning/STATE.md` before the commit; the commit contains exactly the four planned files.
- **Committed in:** n/a (no file change)

**2. [Rule 3 - Blocking] `npm install` rewrote the tracked `yarn.lock`**
- **Found during:** Task 1 (step 4)
- **Issue:** with a `yarn.lock` present, npm updated it (1478 insertions, 899 deletions). The plan only anticipated `dist/` being rewritten, and the plan's clean-tree criterion would have failed.
- **Fix:** `git checkout -- yarn.lock` (specific file). `yarn.lock` stays for plan 01-08 to remove.
- **Files modified:** none (restored)
- **Verification:** `git status --porcelain -- . ':(exclude).planning'` was empty after the Task 1 commit.
- **Committed in:** n/a (no file change)

**3. [Rule 2 - Robustness] Small additions to `golden-manifest.mjs` beyond the written spec**
- **Found during:** Task 3
- **Issue:** the spec did not cover a malformed manifest (would crash `check-repo.mjs` with a stack trace via `flatMap`), a missing strict directory, or the manifest file living inside the strict directory.
- **Fix:** `verifyManifestFile` returns `manifest unreadable: <path> (<reason>)` for invalid JSON; its `listDir` returns `[]` for a missing directory (the frozen files then report as `missing:`); `verifyManifest` skips a file named `MANIFEST.json` in the strict-dir scan. All exports and message strings named in the plan are unchanged.
- **Files modified:** `scripts/golden-manifest.mjs`
- **Verification:** the 23 tests pass; the "ignores a MANIFEST.json inside the strict directory" case is covered explicitly.
- **Committed in:** `ceb4ac6`

---

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2)
**Impact on plan:** No scope creep. The two Rule 3 items are environment side effects that were restored; the Rule 2 items only harden the tool against unhelpful crashes.

## Issues Encountered

- `git` warns "CRLF will be replaced by LF" for `.gitignore` and `tsconfig.json`: the Windows working copies of pre-existing files are CRLF (`autocrlf`). The index and every commit are LF (`git ls-files --eol` shows `i/lf`), as intended by the new `.gitattributes`.
- `npm install` reported `5 vulnerabilities (4 high, 1 critical)` in the audit summary. Not investigated: pins are dictated by project decisions (Next 14.2.35 exact, no upgrade phase), and this is outside the plan's scope. Logged here for a later dependency-hygiene pass.
- The `prepare` script rewrote tracked `dist/` on install and on `build:components`; restored with `git checkout -- dist` both times (Pitfall 9, threat T-01-SC). `dist/` was never staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 (plans 01-02, 01-03, 01-04) can start: `npm run test`, `npm run test:tz` and `npm run typecheck` work, `@playwright/test` 1.63.0 is installed (Chromium was already in the local cache, not touched here), and `scripts/golden-manifest.mjs freeze|verify` is ready to freeze the numeric oracle and the DOM goldens.
- Reminder for every later plan that runs `npm install` before plan 01-08: restore `dist/` and `yarn.lock` afterwards, and never stage them.
- `check:repo`, `check:weight`, `test:e2e:basepath` and `verify` are defined in `package.json` but reference files that later plans create; do not run them before those plans land.

## Requirements Note

`requirements-completed` lists the IDs this plan's frontmatter carries (FND-01, FND-02, FND-04), but this plan delivers only the tooling foundation for each, so the REQUIREMENTS.md checkboxes and traceability rows were deliberately left Pending: FND-01 completes when the static-export build passes (plan 01-05) and CI lands (01-06); FND-02 when the numeric and DOM oracles are captured and frozen (01-03, 01-04); FND-04 when the ESLint engine boundary and guard tests land (01-02). `requirements.mark-complete` was not run for these IDs.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `.gitattributes`, `package.json`, `package-lock.json`, `tsconfig.json`, `engine/package.json`, `engine/tsconfig.json`, `engine/tsconfig.test.json`, `engine/index.ts`, `engine/test/tz.test.ts`, `vitest.config.mts`, `scripts/golden-manifest.mjs`, `tests/repo/golden-manifest.test.ts`
- FOUND commits: `1240f78`, `3991f25`, `0151e4f`, `ceb4ac6`
- TDD gate: `test(...)` commit `0151e4f` precedes `feat(...)` commit `ceb4ac6`
