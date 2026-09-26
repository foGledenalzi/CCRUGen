---
phase: 01-foundations-and-safety-net
plan: 03
subsystem: testing
tags: [oracle, golden, base-10, sha256-freeze, vitest, digital-root, demons, regions, planetary, tsx]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: scripts/golden-manifest.mjs (freeze/verify, never-overwrite), Vitest oracle project, CCRUG_TZ pin, LF enforcement
provides:
  - engine/test/fixtures/base10.golden.json, the frozen numeric base-10 oracle (11429 bytes, LF, 45 demons, 10 gates, 5 pairs/currents, layouts, planetary constants), captured from the untouched app/data/*
  - engine/test/fixtures/MANIFEST.json with set 2026-09-26-base10-numeric (sha256 + written reason)
  - tests/oracle/deriveBase10.ts (deriveBase10Oracle(), Base10Oracle and helper types), the derivation Phase 2's engine must reproduce
  - scripts/capture-base10-oracle.ts, a one-shot capture that exits 1 if the oracle already exists
  - tests/oracle/base10.oracle.test.ts, 38 tests: oracle equality plus definition-derived regressions (Gt-15 5->6, Gt-03 2->3, 12+3 / 12+12 / 4+2 demon split, regions as current cycles)
affects: [01-04, 01-05, 01-08, phase-02-engine, MIG-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen numeric oracle: derived once from untouched app data, sha256-frozen, capture script refuses to overwrite, drift detected by both an equality test and the manifest"
    - "Definitions live in the test (triangular numbers, base-n digital root, syzygy sum n-1, current lands on |a-b|), so the assertions do not depend on the JSON matching app/data"
    - "Regions modeled as cycles of the pair -> pair-containing-|a-b| map, never as a single Torque"

key-files:
  created:
    - tests/oracle/deriveBase10.ts
    - scripts/capture-base10-oracle.ts
    - engine/test/fixtures/base10.golden.json
    - engine/test/fixtures/MANIFEST.json
    - tests/oracle/base10.oracle.test.ts
  modified: []

key-decisions:
  - "center (CENTER per layout) is a top-level oracle key next to layouts, not nested inside it; the plan's one bullet named both and did not say"
  - "syzygeticBy carries an unreachable 'mixed' bucket so that a future data slip would surface as an extra key and fail the equality test instead of being silently dropped"
  - "The freeze set is dated by the UTC execution date (2026-09-26), per the plan, although the local date was still 2026-09-25"

patterns-established:
  - "Oracle helpers under tests/ import app code by relative path; engine/ never imports app/"
  - "Mutation spot check as the RED gate for a test written after its subject exists (Gt-15 to:6 -> to:5, restored with git checkout of that one file)"

requirements-completed: [FND-02]

# Metrics
duration: 5min
completed: 2026-09-26
---

# Phase 1 Plan 03: Frozen Numeric Base-10 Oracle Summary

**A sha256-frozen `base10.golden.json` captured from the untouched `app/data/*` (pairs, currents, gates, regions, TC_*, all 45 demons, layouts, planetary constants) guarded by a 38-test Vitest oracle with definition-derived Gt-15 / Gt-03 regressions and the correct 12+3 / 12+12 / 4+2 demon split, identical under UTC and America/New_York.**

## Performance

- **Duration:** about 5 min (started 2026-09-26T02:20:19Z, finished 2026-09-26T02:24:33Z)
- **Tasks:** 2 (2 commits)
- **Files created:** 5 (no file modified), matching the plan's `files_modified` list

## Accomplishments

- **Oracle captured from untouched data.** Pre-flight `git diff --quiet 7c38ad9 HEAD -- app` and `git diff --quiet -- app` both passed before capture, and `app/` is still identical to 7c38ad9 after both commits. `npx tsx scripts/capture-base10-oracle.ts` wrote 11429 bytes (inside the plan's 5-12 KB estimate), LF only, ending in `\n`.
- **Captured facts.** `demonCount 45`; `kinds {"amphi":24,"chrono":12,"syzygy":5,"xeno":4}`; `syzygeticBy {"chrono":3,"xeno":2}`; `amphiBy {"plex":12,"warp":12}`; `regions {plex [0,9], torque [1,2,4,5,7,8], warp [3,6]}`; 10 gates including `Gt-15` 5->6 and `Gt-03` 2->3; 5 pairs in data order (4,5) (3,6) (2,7) (1,8) (0,9); 5 currents normalized to pair + destination; all 45 demons have a real name (none is the `?` fallback).
- **Never-regenerate is enforced three ways.** A second capture run exits 1 with `the base-10 oracle is frozen and is never regenerated` and the file's sha256 is unchanged (`6c6c3861...835d01d`); `MANIFEST.json` holds the frozen hash with a written reason; the oracle equality test fails on any drift.
- **Freeze.** `node scripts/golden-manifest.mjs freeze ... --set 2026-09-26-base10-numeric --reason "..."`, then `verify` exits 0 (`OK 1 files in 1 sets`).
- **Oracle test: 38 tests.** Equality against the untouched data (planetary positions via `toBeCloseTo(v, 9)`), one gate test per zone from `T(k)` and `digitalRoot(T) = T === 0 ? 0 : ((t - 1) % (n - 1)) + 1`, the named `Gt-15 is 5 -> 6` and `Gt-03 is 2 -> 3` regressions, pair sums and coverage, `to === |a - b|` for every current, the three current cycles `[(0,9)]`, `[(1,8),(2,7),(4,5)]`, `[(3,6)]` mapped to plex / torque / warp, the demon classification and subtype totals computed by enumerating zone pairs from the definitions, time-circuit consistency (including edges = TC syzygies + TC currents), and planetary positions within 1e-9.
- **Both timezones pass.** `CCRUG_TZ=UTC` and `CCRUG_TZ=America/New_York` each run 38/38 (the Vitest start stamps 02:23 vs 22:23 confirm the pin differs). `npm run test` and `npm run test:tz` pass with 4 files / 85 tests each; `npm run typecheck` exits 0.

## Mutation Spot Check (recorded as required)

`engine/test/fixtures/base10.golden.json` line 109 changed from `"to": 6` to `"to": 5` (Gt-15), then `CCRUG_TZ=UTC vitest run --project oracle tests/oracle`:

| Result | Test | Failure |
|--------|------|---------|
| FAIL | `oracle equality > the untouched app data derives exactly the frozen JSON` | diff shows Gt-15 `- "to": 5,` expected vs `+ "to": 6,` received |
| FAIL | `gates > zone 5: gate 5 goes to the digital root of T(5) = 15` | `expected 5 to be 6` |
| FAIL | `gates > Gt-15 is 5 -> 6` | `to: 5` vs expected `to: 6` |

Summary line: `3 failed | 35 passed (38)`, exit 1. While mutated, `node scripts/golden-manifest.mjs verify` also exited 1 (`changed: engine/test/fixtures/base10.golden.json (set 2026-09-26-base10-numeric)`). The file was restored with `git checkout -- engine/test/fixtures/base10.golden.json`; `verify` exits 0 again and `git diff --quiet HEAD -- engine/test/fixtures` exits 0. The mutation was never staged or committed.

## Task Commits

1. **Task 1: Derive and capture the frozen numeric oracle** - `1858d05` (feat)
2. **Task 2: Oracle test with definition-derived regressions** (tdd) - `af3e6a1` (test); see TDD Note below

**Plan metadata:** committed separately after this file (docs: complete plan).

## TDD Note

Task 2 is marked `tdd="true"`, but the subject under test (the derivation and the frozen JSON) was delivered by Task 1, so the test passed on its first run (38/38). As in plan 01-02, the mutation spot check above stands in for the RED gate: it proves the tests fail when the frozen data or the definitions disagree. Consequently the git history has a `feat` commit (Task 1, `1858d05`) followed by a `test` commit (Task 2, `af3e6a1`), the reverse of the strict test-then-feat order, because the plan itself sequences capture before test. This is a plan-structure consequence, not a skipped gate.

## Files Created/Modified

- `tests/oracle/deriveBase10.ts` - `deriveBase10Oracle()` plus `Base10Oracle`, `Pair`, `OracleCurrent`, `OracleGate`, `OracleDemon` types; imports `app/data/*` and `app/lib/{planetary,constants}` by relative path; no date, timezone or locale input
- `scripts/capture-base10-oracle.ts` - one-shot capture (verbatim from the plan; paths from `process.cwd()`, no `import.meta`)
- `engine/test/fixtures/base10.golden.json` - the frozen numeric oracle
- `engine/test/fixtures/MANIFEST.json` - sha256 freeze, set `2026-09-26-base10-numeric`
- `tests/oracle/base10.oracle.test.ts` - 319 lines, 38 tests

## Decisions Made

- `center` is a separate top-level key (after `layouts`) rather than nested under `layouts`; the plan's bullet listed both without stating nesting. Phase 2 reproduces whatever the JSON says, so either is consistent, but it is now fixed.
- `syzygeticBy` classifies a syzygy as `chrono` (both in TC), `xeno` (neither) or an unreachable `mixed`; an unexpected `mixed` would appear as an extra key and fail the equality test.
- Regions in the test are labeled from the current cycles (cycle containing zone 0 is plex, a 3-cycle is torque, others are warp), never from `zoneRegion` or app data, so the regions assertion is genuinely definitional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header comment in the test contained the forbidden literal `reference/`**
- **Found during:** Task 2 (acceptance-criteria check)
- **Issue:** the first draft of `tests/oracle/base10.oracle.test.ts` said "never against the local reference/ sources" in its header comment, which trips the acceptance criterion that the file must not contain the string `reference/` (T-01-07 grep).
- **Fix:** reworded to "the local, gitignored reference sources". Nothing reads or names a `reference/` path.
- **Files modified:** `tests/oracle/base10.oracle.test.ts` (before its first commit)
- **Verification:** `grep -c 'reference/'` prints 0 for the test, the derivation module and the capture script.
- **Committed in:** `af3e6a1`

**Total deviations:** 1 auto-fixed (Rule 1). No scope creep.

## Issues Encountered

- None blocking. `npm install` was not run, so `dist/` and `yarn.lock` were untouched; `git status --short` was clean apart from `.planning/` after each commit.
- The local calendar date was 2026-09-25 while the UTC date was 2026-09-26; the freeze set is named for the UTC date as the plan specifies (`2026-09-26-base10-numeric`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-04 (same wave) is independent of this plan. Plan 01-08's `check:repo` can list `engine/test/fixtures/MANIFEST.json` as a manifest to verify; the DOM goldens from 01-04 should be added to the same manifest as their own dated set (the tool never overwrites an existing frozen file, so a second `freeze` on the same manifest adds a new set).
- Phase 2 (ENG-*, MIG-01): the engine's base-10 preset must reproduce `engine/test/fixtures/base10.golden.json` exactly (pairs, currents, gates, regions, TC_*, 45 demons with `a::b` net-spans and kinds, layouts and planetary constants). The definitional test file can be reused as a spec for the engine's own tests.
- The oracle records what the viewer shows today, including any lore quirks in `app/data/*`; nothing in it was "fixed". Any future intentional change requires a NEW dated set with a written reason, never `-u` or a re-capture.

## Requirements Note

`requirements-completed` lists FND-02 because this plan's frontmatter carries it, and this plan delivers the numeric half of FND-02. Per the orchestrator's instruction, FND-* checkboxes are marked at phase level (the DOM half arrives with plan 01-04 and the proof against the static export with 01-05), so `requirements.mark-complete` was not run and REQUIREMENTS.md was not edited.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or trust-boundary surface: the capture script writes one file under `engine/test/fixtures/` and refuses to overwrite it. T-01-06 (regenerated oracle) is mitigated as planned (capture script exits 1, sha256 freeze, definitional assertions independent of the JSON); T-01-07 (reference/ leakage) is mitigated (no `reference/` string or read in any new file); T-01-07b (TZ dependence) is mitigated (no date input; 38/38 in UTC and America/New_York).

## Self-Check: PASSED

- FOUND: `tests/oracle/deriveBase10.ts`, `scripts/capture-base10-oracle.ts`, `engine/test/fixtures/base10.golden.json`, `engine/test/fixtures/MANIFEST.json`, `tests/oracle/base10.oracle.test.ts`
- FOUND commits: `1858d05`, `af3e6a1`
- `node scripts/golden-manifest.mjs verify engine/test/fixtures/MANIFEST.json` exits 0; `git diff --quiet 7c38ad9 HEAD -- app` exits 0; `git diff --quiet HEAD -- engine/test/fixtures` exits 0
