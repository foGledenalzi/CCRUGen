---
phase: 01-foundations-and-safety-net
plan: 06
subsystem: infra
tags: [page-weight, perf-budget, ci, github-actions, fflate, plugin-zip, determinism, vitest]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: package.json scripts (check:weight, build:plugin-zip, verify), exact pins incl. fflate 0.8.3 and package-lock.json, Vitest oracle project
  - phase: 01-foundations-and-safety-net (plan 04)
    provides: 30 frozen normalized DOM goldens (element counts are read from them, no browser at check time)
  - phase: 01-foundations-and-safety-net (plan 05)
    provides: numogram-only static export in out/ (root build) that the baseline is measured on
provides:
  - scripts/page-weight.mjs (measure / check / update --reason / print) with exported measureRoutes, measureDomNodes, countElements, limitFor, compare, nextBaseline
  - perf/page-weight.baseline.json (per-route bytes, 30 golden DOM counts, tolerance, history ledger)
  - .github/workflows/ci.yml (dormant Windows + Ubuntu matrix calling npm run verify)
  - deterministic fflate plugin ZIP (scripts/build-plugin-zip.mjs -> artifacts/)
affects: [01-08, phase-02, phase-03, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Budget as data + ledger: baseline JSON holds tolerance and a history array; raising it requires update --reason, refused before anything is measured or written"
    - "DOM node budget computed from the frozen normalized goldens (deterministic, no browser at check time)"
    - "Deterministic ZIP: sorted entries + fixed LOCAL-time mtime; CCRUG_TZ sets process.env.TZ at runtime (Windows ignores process-start TZ)"

key-files:
  created:
    - scripts/page-weight.mjs
    - tests/perf/page-weight.test.ts
    - perf/page-weight.baseline.json
    - .github/workflows/ci.yml
  modified:
    - scripts/build-plugin-zip.mjs

key-decisions:
  - "Baseline captured from a root npm run build (no NEXT_PUBLIC_BASE_PATH), as flagged by plan 01-05"
  - "Tolerance stored inside the baseline file (bytes max(1 KiB, 5%), DOM nodes max(2, 2%)) so the budget and its history travel together"
  - "Single commit per task (test and implementation together for the TDD task) as the plan instructs; RED was confirmed by a failing run first"

patterns-established:
  - "Any future intended growth: node scripts/page-weight.mjs update --reason \"<why>\" (ledger entry with before/after summaries)"

requirements-completed: [FND-01, FND-02]

# Metrics
duration: 8min
completed: 2026-09-26
---

# Phase 1 Plan 06: Page-weight Budget, Dormant CI and Deterministic Plugin ZIP Summary

**A zero-dependency page-weight budget (per-route HTML/JS/CSS bytes raw and gzip, plus DOM element counts of the 30 frozen goldens) guards the numogram-only export with a written-reason ledger, a dormant Windows + Ubuntu workflow calls the single `npm run verify`, and the optional plugin ZIP is now an fflate build that is byte-identical across timezones and writes only to gitignored `artifacts/`.**

## Performance

- **Duration:** about 8 min (2026-09-26T02:47Z to 02:55Z)
- **Tasks:** 3 (3 commits)
- **Files:** 4 created, 1 modified; no golden, fixture, `app/`, `dist/` or `yarn.lock` change

## Accomplishments

- **Task 1 (7f7688f), tool and tests:** `tests/perf/page-weight.test.ts` written first and run red (module not found), then `scripts/page-weight.mjs` implemented; `npx cross-env CCRUG_TZ=UTC vitest run --project oracle tests/perf`: 18 passed. Covers `limitFor` (2024 and 105000, ceil rounding), 6% jsGzip growth flagged once with the metric named, 4% and shrinkage accepted, missing/extra route and golden state, baseline-stored tolerance honored, DOM 258 allows 264 and rejects 265, `nextBaseline` (whitespace reason throws, first entry has `before: null`, second appends with non-null `before`), `countElements` ignoring `#text` lines, `measureRoutes` on a temp `out` (asset referenced twice counted once, `/` key, `404.html` and `404/index.html` skipped, missing asset ignored), `measureDomNodes`, and a CLI refusal path (`update` without `--reason` exits 1 and never writes). Root `tsc` and the full `npm run typecheck` (incl. lint) exit 0.
- **Task 2 (3316156), baseline:** `npm run build` (root, exit 0), then `update --reason "Initial baseline: ..."`. Baseline (root build): `/` html 4,934 B (1,843 gz), js 419,127 (129,167 gz), css 23,230 (5,570 gz); `/numogram/` html 76,766 (11,484 gz), js 572,056 (173,091 gz), css 23,230 (5,570 gz). 30 golden states, 6,405 elements in total; defaults original 258, labyrinth 272, ladder 226. File is LF (no `\r`), one history entry starting `Initial baseline`.
  - **Versus the lab's indicative numbers** (reported, not acted on): `/numogram/` html 76,766 vs about 77,077 (11,484 vs 11,528 gz); js 572,056 vs about 569,592 (173,091 vs 172,280 gz, +0.4 to +0.5 percent); css identical; DOM counts identical (30 states, 6,405, 258/272/226). The small JS difference is expected: the lab measured before the 01-05 edits to `NumogramClient.tsx`.
  - **`npm run check:weight` on the committed baseline:** `page-weight: OK (2 routes, 30 golden states within tolerance)`, exit 0.
  - **Negative proof (not committed):** with `routes["/numogram/"].jsGzip` lowered by 20 percent in the real baseline, `npm run check:weight` exited 1 printing `page-weight: FAIL /numogram/ jsGzip 173091 > limit 145397 (baseline 138473)` and the hint `page-weight: if the growth is intended: node scripts/page-weight.mjs update --reason "<why>"`. The baseline was restored from a scratch copy (`cmp` identical) and the check passes again.
- **Task 3 (4a22d5d), CI and ZIP:**
  - `.github/workflows/ci.yml` verbatim from the plan: matrix `ubuntu-latest` + `windows-latest`, `permissions: contents: read`, triggers `push` (main) and `pull_request` only, no secrets, `npm ci`, Playwright Chromium cached by OS + locked version (lock has `@playwright/test` 1.63.0), `npm run verify`, artifacts upload on failure. Actions used: `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7` (as verified by the planner on 2026-09-25; I did not re-check them, no network calls were made). Structural checks passed (no tab, all required strings present, no `pull_request_target`/`secrets.`), and a one-off parse with the transitive `js-yaml` (not added as a dependency, not in `package.json`) confirmed valid YAML: 9 steps, matrix `[ubuntu-latest, windows-latest]`, `contents: read`.
  - `scripts/build-plugin-zip.mjs` rewritten: fflate `zipSync`, 14 runtime files in sorted order, `level: 9`, `mtime: new Date(2000, 0, 1, 0, 0, 0)`, `CCRUG_TZ` sets `process.env.TZ` before the date is created, compile via `execFileSync(process.execPath, [typescript/bin/tsc, ...])` (no shell, no `npx`), writes `artifacts/ccru-gematria-plugin.zip`. No `zipInfo`, no `public/downloads`, no `zip` binary. `npm run build` is still `next build`.
  - **Determinism:** sha256 `e1370547a73b88d78d97ac78ea54917c6187fe9bc2ffef348661e03d6763d787` under `CCRUG_TZ=UTC`, `Asia/Tokyo` and `America/New_York` (three runs, identical). The archive holds exactly the 14 expected entries (checked with fflate `unzipSync`). This hash differs from the research lab's `5a8a1e61...`, which is expected (different plugin sources or compile output at that time; the point is TZ-independence).
  - `git status --porcelain --untracked-files=all -- app public` is empty; the ZIP lands in ignored `artifacts/` and the compile output in ignored `gematria/plugin/dist/`.

## Task Commits

1. **Task 1: Page-weight measure/compare/update script with unit tests** - `7f7688f` (feat)
2. **Task 2: Record the page-weight baseline of the numogram-only export** - `3316156` (feat)
3. **Task 3: Dormant Windows + Ubuntu CI workflow and deterministic fflate plugin ZIP** - `4a22d5d` (feat)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification (final, exact results)

| Command | Result |
|---------|--------|
| `npm run typecheck` (tsc x4 + `next lint`) | exit 0, "No ESLint warnings or errors" |
| `npm run test` (CCRUG_TZ=UTC) | 6 files, 125 tests passed |
| `npm run test:tz` (America/New_York) | 6 files, 125 tests passed |
| `npm run check:weight` | `page-weight: OK (2 routes, 30 golden states within tolerance)`, exit 0 |
| `git status --short` | clean (only ignored `out/`, `artifacts/`, `.next/`, `gematria/plugin/dist/`, `test-results/`) |
| listeners on 3000, 3111, 3112, 3007 | none |

## Files Created/Modified

- `scripts/page-weight.mjs` - CLI (`check`, `update --reason`, `print`) plus exported pure helpers; validates the reason before measuring or writing
- `tests/perf/page-weight.test.ts` - 18 Vitest tests in the `oracle` project on temp directories
- `perf/page-weight.baseline.json` - frozen budget: routes, domNodes, tolerance, history ledger
- `.github/workflows/ci.yml` - dormant verify matrix
- `scripts/build-plugin-zip.mjs` - deterministic fflate ZIP to `artifacts/`

## Decisions Made

- `update` validates `--reason` (via `nextBaseline`) before measuring and before touching `perf/`, so a refused update cannot write anything; also accepts `--reason=<text>`.
- `compare` merges a partial baseline tolerance over `DEFAULT_TOLERANCE` and reports a byte metric that is absent from the baseline as a problem (instead of silently skipping it). Both are small hardening additions inside the plan's behavior.
- Followed the plan's single-commit-per-task rule for the TDD task (RED was verified by running the test file before the implementation existed; the failing state was not committed to keep every commit green for bisecting).

## Deviations from Plan

None - plan executed as written. (The two hardening details above are within the specified function contracts.)

## Issues Encountered

- **`npm run verify` cannot run end to end yet:** it starts with `node scripts/check-repo.mjs` and ends with `node scripts/check-repo.mjs --clean-tree --static-out`; that script is created by plan 01-08. The CI workflow is therefore dormant twice over (nothing pushed, and `verify` is incomplete until 01-08).
- Cosmetic: on Windows `update` prints the baseline path with a backslash (`perf\page-weight.baseline.json`); the file itself is unaffected.
- `.gitignore` still contains the stale `public/downloads/` line from before the ZIP moved to `artifacts/`; harmless, left for hygiene later.
- `out/` currently holds the ROOT export from this plan's build (gitignored); run `npm run build` again after any `test:e2e:basepath`, which consumes and moves `out/`.

## User Setup Required

None. After the first user-approved push, GitHub validates the workflow (no task in this phase pushes). Action majors were not re-verified at execution time.

## Next Phase Readiness

- Plan 01-08 can assert that `perf/page-weight.baseline.json` and `.github/workflows/ci.yml` exist and are tracked and LF, and must add `scripts/check-repo.mjs` so `npm run verify` becomes runnable.
- Phase 2 and later: run `npm run build && npm run check:weight` after any change that grows the bundle; raise the budget only through `update --reason`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-01-15 mitigated (read-only token, no `pull_request_target`, no secrets, action majors pinned), T-01-16 accepted, T-01-17 mitigated (`update` refuses without a reason and appends `{date, reason, before, after}`; baseline is LF), T-01-17b mitigated (ZIP goes to gitignored `artifacts/`, never `public/`).

## Self-Check: PASSED

- FOUND: `scripts/page-weight.mjs`, `tests/perf/page-weight.test.ts`, `perf/page-weight.baseline.json`, `.github/workflows/ci.yml`, `scripts/build-plugin-zip.mjs`
- FOUND commits: `7f7688f`, `3316156`, `4a22d5d`
- Frozen oracle untouched: no path under `e2e/__golden__` or `engine/test/fixtures` in any of the three commits; `dist/`, `yarn.lock` and `app/` unchanged
