---
phase: 01-foundations-and-safety-net
plan: 04
subsystem: testing
tags: [oracle, playwright, visual-dom, golden, sha256-freeze, chromium, next-dev, settle-signal, normalizer]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: scripts/golden-manifest.mjs (freeze/verify, never-overwrite), Vitest oracle project, @playwright/test 1.63.0, LF enforcement
provides:
  - e2e/visual-dom.ts, the visual-DOM normalizer (extractTree in-page; normalizeTree/canonAttr/isIgnoredAttr/countElements on the Node side)
  - tests/e2e-normalizer/visual-dom.test.ts, 22 tests (33 assertions) proving the normalizer on synthetic trees
  - playwright.config.ts in its final shape (chromium-utc and chromium-ny share one golden set; updateSnapshots 'none' unless GOLDEN_CAPTURE=1; E2E_SERVER=dev switch; reuseExistingServer false), reused by plan 01-05
  - e2e/golden.spec.ts, the 3 layouts x 10 states spec with the measured settle signal
  - 30 frozen DOM goldens in e2e/__golden__/golden.spec.ts/ (660,506 bytes, 6,405 element lines) captured from the untouched viewer
  - e2e/__golden__/MANIFEST.json with set 2026-09-26-baseline (sha256 per file, strictDir e2e/__golden__, written reason)
affects: [01-05, 01-06, 01-08, phase-02-migration, phase-04-accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-DOM comparison: geometry, paint and text only; aria-*, data-*, role, tabindex ignored; numbers rounded to 3 decimals; style canonicalized; attributes sorted"
    - "Settle signal = expected viewBox height + __reactFiber$ own key on the svg + 2 rAF + 300 ms of unchanged normalized DOM (no sleeps, no networkidle, no page.clock)"
    - "Golden capture is opt-in: GOLDEN_CAPTURE=1 gives updateSnapshots 'missing' (exits 1 by design), every other run is 'none'; frozen goldens are never rewritten"
    - "Extractor is called only from Playwright specs (esbuild keepNames breaks it elsewhere, Pitfall 15); the Vitest test builds trees by hand"

key-files:
  created:
    - e2e/visual-dom.ts
    - tests/e2e-normalizer/visual-dom.test.ts
    - playwright.config.ts
    - e2e/golden.spec.ts
    - e2e/__golden__/MANIFEST.json
    - e2e/__golden__/golden.spec.ts/ (30 files: {original,labyrinth,ladder}--{default,layer-syzygies,layer-currents,layer-gates,layer-pandemonium,region-plex,region-warp,region-torque,zone-5,time-circuit}.txt)
  modified: []

key-decisions:
  - "The manifest for the DOM goldens is its own file, e2e/__golden__/MANIFEST.json, with strictDir e2e/__golden__ (separate from the numeric oracle's engine/test/fixtures/MANIFEST.json); plan 01-08 check:repo lists both"
  - "The freeze set is dated by the UTC execution date (2026-09-26) although the local date was still 2026-09-25, as in plan 01-03"
  - "Task 1 (TDD) was committed as a test commit then a feat commit; the plan's 'commit the three files' is satisfied in aggregate"

patterns-established:
  - "A frozen golden set is created in one commit together with its spec and manifest; from that commit on the render path may change and the goldens are only ever compared, never regenerated"

requirements-completed: [FND-02]

# Metrics
duration: 14min
completed: 2026-09-26
---

# Phase 1 Plan 04: Frozen Visual-DOM Oracle (30 goldens, untouched viewer) Summary

**30 normalized visual-DOM goldens (original, labyrinth, ladder x 10 states) captured once from the untouched viewer on `next dev` with the original `next.config.js`, identical across three runs and two browser timezones, sha256-frozen in `e2e/__golden__/MANIFEST.json`, guarded by a normalizer whose 22 unit tests prove aria/data/role/tabindex are ignored while any geometry, paint or text change is not.**

## Performance

- **Duration:** about 14 min (started about 2026-09-26T02:26Z, finished 2026-09-26T02:40Z; start time was not captured in a variable, so this is approximate)
- **Tasks:** 2 (3 commits: Task 1 is TDD, test then feat; Task 2 is one commit)
- **Files created:** 36 (5 source/config files, the manifest, 30 goldens), no file modified, no file under `app/`, `public/` or `next.config.js` touched

## Accomplishments

- **Normalizer proven on synthetic trees.** RED first (`Cannot find module '../../e2e/visual-dom'`), then GREEN: 22 tests, 33 `expect(` assertions, never calls `extractTree`. Covered: aria/data/role/tabindex never change output; attribute order and style declaration order/format never change it; `141.42135623730951` and `141.4213562373095` both become `141.421`; `-0.0001` becomes `0`; `M0,0.5L7,3.14159` becomes `M0,0.5L7,3.142`; `#0044cc`, `sphere-05` and `url(#grad-1-2)` untouched; a 0.01 coordinate change, a colour change, a text change, an added element, a removed attribute and a viewBox change each change the output; output ends with `\n` with no `\r`; `countElements` ignores `#text` lines. Root `tsc` exits 0; `npm run test` and `npm run test:tz` pass 5 files / 107 tests in UTC and America/New_York; `npm run typecheck` (including lint) exits 0.
- **Pre-flight (T-01-08) all held before capture:** `git diff --quiet 7c38ad9 HEAD -- app public next.config.js postcss.config.js tailwind.config.ts` exit 0, working-tree and index diffs of `app public next.config.js` exit 0, `next.config.js` has no `output` key, port 3111 free, `e2e/__golden__/` absent. The same committed diff still exits 0 after the final commit.
- **Capture run:** `GOLDEN_CAPTURE=1 E2E_SERVER=dev playwright test e2e/golden.spec.ts --project=chromium-utc` exited 1 as designed: 30 failed, 30 `A snapshot doesn't exist at ..., writing actual.` messages, 30 files written (wall clock 1 m 07 s including the `next dev` start; `.next` already existed, so the first compile was warm).
- **Stability (never with GOLDEN_CAPTURE, `updateSnapshots: 'none'`):**

| Run | Command scope | Result | Time |
|-----|---------------|--------|------|
| 1 | both projects, dev | 60 passed, exit 0 | 1.1 m |
| 2 | chromium-utc repeat, dev | 30 passed, exit 0 | 35.5 s |
| 3 | chromium-ny (the task's own verify command), dev | 30 passed, exit 0 | 35.2 s |

  After the runs `git status --porcelain -- e2e/__golden__` showed only the untracked directory (no file rewritten); all 30 files have distinct sha256, none contains a CR byte (checked with `tr` and `grep`), every file ends in a single `\n`.
- **Content sanity (all as the lab predicted, no differences):** every `original--*.txt` starts with `viewBox="0 0 800 940"`, every `labyrinth--*` with `880`, every `ladder--*` with `870` (10/10 each). Total 660,506 bytes, 6,405 element lines (original 2,166, labyrinth 2,265, ladder 1,974); default states 258 / 272 / 226 element lines; smallest file `original--layer-syzygies.txt` 12,432 B, largest `labyrinth--zone-5.txt` 30,371 B; per-file elements 128 (`ladder--layer-gates`) to 291 (`labyrinth--zone-5`). Gzipped per file and summed: 80,671 B (lab: 79,762 B, a 1 % difference in gzip level/header, not in content).
- **Freeze:** `node scripts/golden-manifest.mjs freeze e2e/__golden__/MANIFEST.json --set 2026-09-26-baseline --strict-dir e2e/__golden__ --reason "..." e2e/__golden__/golden.spec.ts` froze 30 files; `verify` exits 0 (`OK 30 files in 1 sets`) before and after the commit. The committed blobs are all LF (`git ls-files --eol e2e` shows no non-LF entry). The manifest holds `"strictDir": "e2e/__golden__"`, one set ending `-baseline`, 30 file entries and the written reason.

## Task Commits

1. **Task 1: Visual-DOM normalizer, its unit test, and the Playwright config** (TDD)
   - RED: `acd0abf` (test) - 22 tests failing on the missing module
   - GREEN: `9015713` (feat) - `e2e/visual-dom.ts` and `playwright.config.ts`, 22/22 passing
2. **Task 2: Capture, prove and freeze the 30 goldens** - `70984f8` (test) - spec, 30 goldens, manifest in one commit (32 files, no deletions)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Files Created/Modified

- `e2e/visual-dom.ts` - normalizer, verbatim from RESEARCH "Normalizer that passed"; no `__reactFiber$` in it
- `tests/e2e-normalizer/visual-dom.test.ts` - Vitest `oracle`-project tests with a hand-built `node()` helper
- `playwright.config.ts` - final shape from the plan, used unchanged by plan 01-05
- `e2e/golden.spec.ts` - verbatim from the lab (viewBox + `__reactFiber$` + 2 rAF + 300 ms stability)
- `e2e/__golden__/golden.spec.ts/*.txt` - the 30 goldens
- `e2e/__golden__/MANIFEST.json` - sha256 freeze

## Decisions Made

- The DOM oracle gets its own manifest file with a strict directory so that any added, changed or missing golden is caught by `check:repo` (plan 01-08); it is deliberately separate from the numeric oracle's manifest.
- The "3 runs" claim in the manifest reason is accurate: the runs are (both projects) + (UTC repeat) + (NY), on top of the capture run itself, so "stable across 3 runs and UTC/America-New_York" is accurate.
- No live mutation check was run against the goldens (unlike plan 01-03): they were untracked until the final commit, so a temporary edit could not be restored from git, and the normalizer's change-detection is already covered by unit tests. Plan 01-05's static-export run is the next real comparison.

## Deviations from Plan

None - plan executed exactly as written. `e2e/visual-dom.ts` needed no rewrite: the ternary expression statement in `emit` passes root `tsc`, and `e2e/` is outside the `next lint --dir app --dir engine --dir workers` scope, so lint has no complaint either. The TDD task's two-commit split (test then feat) is a commit-granularity choice, not a change of behavior.

## Issues Encountered

- None blocking. `git status` stayed clean apart from the plan's own files throughout: `npm install` was never run (so `dist/` and `yarn.lock` were untouched), `test-results/` is gitignored, and `next dev` did not modify `next-env.d.ts` or `tsconfig.json`.
- The bash `grep -P '\r'` check failed under the Windows locale (`-P supports only unibyte and UTF-8 locales`); redone with `tr -cd '\r'` and `LC_ALL=C grep`, both reporting 0 CR bytes.
- Process hygiene: Playwright started and stopped its own `next dev` each run; `netstat -ano | grep LISTENING` showed nothing on 3111 or 3112 after every run and at the end.

## User Setup Required

None. Chromium (chromium-1243 plus the headless shell, Playwright 1.63.0) was already in `%LOCALAPPDATA%\ms-playwright`; no browser download was needed or run.

## Next Phase Readiness

- Plan 01-05 can now edit `next.config.js` and `NumogramClient.tsx` (D-16): the DOM oracle exists and is committed. It must run `playwright test e2e/golden.spec.ts` against `serve out` (default webServer, no `E2E_SERVER`) and require 60/60, using the same spec and goldens, with `updateSnapshots: 'none'`. Never pass `-u`; a legitimate visual change would be a new dated set with a written reason.
- Plan 01-06 can read `countElements` per golden for the D-17 DOM-node baseline (`countElements` is exported from `e2e/visual-dom.ts`); the per-file numbers are in this summary.
- Plan 01-08's `check:repo` should verify both `engine/test/fixtures/MANIFEST.json` and `e2e/__golden__/MANIFEST.json`.
- Residual risk carried from research: `__reactFiber$` is a React 18 internal key name; on a React upgrade re-verify the settle signal.
- The 3-decimal rounding makes a real change below 0.0005 SVG units invisible to the oracle by design (also what lets later phases recompute positions in a different operation order without false failures).

## Requirements Note

`requirements-completed` lists FND-02 because this plan's frontmatter carries it, and this plan delivers the DOM half of FND-02 (the numeric half was plan 01-03; the proof against the static export follows in 01-05). Per the orchestrator's instruction, FND-* checkboxes are marked at phase level, so `requirements.mark-complete` was not run and REQUIREMENTS.md was not edited.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or trust-boundary surface beyond the plan's threat model: T-01-08 (capture from a modified viewer) mitigated by the pre-flight diffs and the untouched `next.config.js`; T-01-09 (self-healing goldens) mitigated by `updateSnapshots: 'none'` by default, the capture-only `GOLDEN_CAPTURE=1` switch and the strict-dir manifest; T-01-09b (stale server) mitigated by `reuseExistingServer: false`; T-01-09c (unexplained golden changes) mitigated by the dated set with a written reason.

## Self-Check: PASSED

- FOUND: `e2e/visual-dom.ts`, `tests/e2e-normalizer/visual-dom.test.ts`, `playwright.config.ts`, `e2e/golden.spec.ts`, `e2e/__golden__/MANIFEST.json`, 30 files in `e2e/__golden__/golden.spec.ts/`
- FOUND commits: `acd0abf`, `9015713`, `70984f8`
- TDD gate: `test(...)` commit `acd0abf` precedes `feat(...)` commit `9015713`
- `node scripts/golden-manifest.mjs verify e2e/__golden__/MANIFEST.json` exits 0; `git diff --quiet 7c38ad9 HEAD -- app public next.config.js` exits 0
