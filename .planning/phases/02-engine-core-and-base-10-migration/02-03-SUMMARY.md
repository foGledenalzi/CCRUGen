---
phase: 02-engine-core-and-base-10-migration
plan: 03
subsystem: testing
tags: [playwright, behaviour-baseline, frozen-oracle, sha256-manifest, lore-coverage, check-repo, cross-os]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net
    provides: golden-manifest freeze/verify tooling, check-repo guard (MANIFESTS, LF_DIRS, --clean-tree), Playwright config with the static-export webServer, the visual-DOM helper pattern
  - phase: 02-engine-core-and-base-10-migration
    provides: seed/inventory.mjs (todo 001 before/after inventory) that this plan turns into a committed, parametrized check
provides:
  - e2e/behaviour-collect.ts, a self-contained in-page collector (text, attribute and computed-style facts only) and the PANELS list
  - e2e/behaviour-compare.ts, pure Node-side helpers normalizeDeep, diffBaseline, baselineAction (unit-tested)
  - e2e/behaviour.spec.ts, the D-15 behaviour script replayed for original, labyrinth, ladder, planetary and a 390x800 run against the built static export
  - five frozen baselines e2e/__behaviour__/{original,labyrinth,ladder,planetary,mobile}.json (408665 bytes) with their own strict sha256 manifest
  - a lore coverage test that proves the frozen original.json contains all 55 lore fields it has to guard
  - npm run test:swap, the one-command per-swap gate for plans 02-08..02-12
affects: [02-08, 02-09, 02-10, 02-11, 02-12, 02-13, phase-04-components-engine-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Behaviour baseline as compare-or-capture: baselineAction never captures over an existing file; capture only for a missing file and BEHAVIOUR_CAPTURE exactly 1 (exits 1 by design); a mismatch writes the actual text next to the test output and fails with one JSON-path per difference"
    - "Cross-OS by construction: the collector reads no bounding box, viewport size, client rect or animation list; visibility is decided from computed style alone (display, visibility, opacity, zero height or max-height on a clipping element); the share flow, clipboard and Web Share are stubbed by an init script"
    - "Every readout goes through stable(): poll every 50 ms, accept once the JSON of the value has not changed for 300 ms; layout tweens are additionally waited to their final svg height, so no fixed sleep decides a value"
    - "Behaviour baselines are guarded like the other oracles: strict manifest in check-repo MANIFESTS, directory in LF_DIRS (so lf and --clean-tree cover it)"

key-files:
  created:
    - e2e/behaviour-collect.ts
    - e2e/behaviour-compare.ts
    - e2e/behaviour.spec.ts
    - e2e/__behaviour__/original.json
    - e2e/__behaviour__/labyrinth.json
    - e2e/__behaviour__/ladder.json
    - e2e/__behaviour__/planetary.json
    - e2e/__behaviour__/mobile.json
    - e2e/__behaviour__/MANIFEST.json
    - tests/e2e-normalizer/behaviour-lore-coverage.test.ts
    - tests/e2e-normalizer/behaviour-compare.test.ts
  modified:
    - scripts/check-repo.mjs
    - tests/repo/check-repo.test.ts
    - NOTICE
    - package.json

key-decisions:
  - "The lore sweep records the Selection panel after clicking each row, not after hovering it: in this viewer hovering a Zones, Syzygies, Currents or Gates row shows no lore at all (InfoDisplay gets hoverInfo={null}); the lore of a row is visible only as an open item of the Selection panel. Each of the 30 rows is selected, its own item opened, the visible texts recorded, the selection cleared; the page is reloaded once afterwards so the undo history of the sweep does not leak into the later behaviours"
  - "Dates are masked inside the stability read, not only at the end: the planetary orbit key (z) ticks the date every frame, so an unmasked snapshot never settles"
  - "The frozen set is 2026-09-26-behaviour-baseline; the freeze commit b82f6a2 is the reference commit for the swap plans"

patterns-established:
  - "New oracle sets follow the golden pattern: capture once from the untouched viewer, prove determinism (3 consecutive identical passes), freeze with a written reason, register the manifest and the directory in check-repo, correct only by a NEW dated set"
  - "Comparator behaviour is proven by unit tests on hand-made inputs plus one real-baseline mutation in memory, instead of mutating tracked app/ files in a shared working tree"

requirements-completed: [MIG-01]

# Metrics
duration: 38min
completed: 2026-09-26
---

# Phase 2 Plan 03: Frozen Behaviour and Text Baseline Summary

**A frozen, OS-independent behaviour and text baseline of the untouched base-10 viewer (4 layouts plus a 390x800 run: panel text, hover popovers, a 30-row lore sweep through the Selection panel, URL after every action, undo/redo, shortcuts, share with a stubbed clipboard), sha256-guarded in check-repo, with a comparator proven by unit tests and an `npm run test:swap` gate for the data-source swaps.**

## Performance

- **Duration:** about 38 min (started about 2026-09-26T19:27Z, finished about 20:05Z)
- **Tasks:** 3 (3 task commits, plus this metadata commit)
- **Files:** 11 created, 4 modified (the plan's `files_modified` list; nothing else)

## Accomplishments

- `e2e/behaviour.spec.ts` replays the D-15 script (layout-button hover labels, hover popovers, panel toggles, panel drag, select/toggle/undo/redo/clear with the URL after each, Regions, Labels, Particles, Gates/Currents/Syzygies clicks, all keyboard shortcuts, the shortcuts modal four ways, share, header link) for `original`, `labyrinth`, `ladder` and `planetary` (`layout=planetary&date=2000-01-01`) plus the 390x800 block, and compares with the frozen JSON. The known upstream dropped-click probe on Zones row 5 (todo 003) is deleted, as the plan says.
- The baselines were captured from the untouched viewer: `git diff --quiet f7d6689 -- app` exited 0 before the capture, after it, before the freeze and at every later check; `app/presets` does not exist; no tracked file under `app/` was ever modified, not even temporarily.
- **What the baseline holds** (52 stages, 204 behaviour rows, 3425 interactive-element rows, 643 non-empty region texts, 408665 bytes in total; the interactive-row total equals the 3425 lines of the todo-001 inventory exactly):

  | file | bytes | stages | behaviour rows | interactive rows | non-empty region texts |
  |------|-------|--------|----------------|------------------|------------------------|
  | original.json | 142938 | 12 | 76 (30 lore sweep) | 786 | 149 |
  | labyrinth.json | 79373 | 12 | 43 | 777 | 149 |
  | ladder.json | 79319 | 12 | 43 | 777 | 149 |
  | planetary.json | 100949 | 15 | 41 | 1025 | 184 |
  | mobile.json | 6086 | 1 | 1 | 60 | 12 |

  Every behaviour value that the todo-001 inventory tabulated is reproduced (hover labels `["original","labyrinth","ladder","planetary"]`, drag delta `[60,40]`, `?selected=5`, `Selected Elements (25)`, `(12)`, `(3)`, viewBoxes 880/870/940/800, share text `ORIGIN/numogram/?layers=currents%2Cgates&layout=original&particles=1&selected=5%2C6`, page errors `[]`); 177 seed rows - 4 deleted probes + 30 lore sweep + 1 mobile row = 204.
- **Lore coverage proven, not assumed.** `behaviour-lore-coverage.test.ts` checks that all 55 lore fields (10 gate desc + 10 gate detail, 5 current desc + 5 label, 5 syzygy desc, 10 zone desc + 10 zone lemurian) occur as substrings of recorded strings in the frozen `original.json`. The first capture used the plan's hover sweep and the test failed with 41 missing fields (hover shows no lore); the sweep was then changed to the plan's fallback (click, open the row's own item, record, clear), the never-committed file was deleted and recaptured, and the test passes.
- **Determinism proven before freezing:** `--repeat-each 3` on `chromium-utc` passed 15/15 with per-test times identical to about 1 s across the three passes; a plain `npx playwright test e2e/behaviour.spec.ts` shows 5 passed and 5 skipped (`chromium-ny`); the compare passes ran 7 further times in total without a difference.
- **Frozen and guarded:** `e2e/__behaviour__/MANIFEST.json` (strictDir `e2e/__behaviour__`, set `2026-09-26-behaviour-baseline`, 5 files; file sha256 begins `b3f3f296` original, `100fb3e4` labyrinth, `7aa1d373` ladder, `fb25713a` planetary, `7af4d120` mobile; the manifest file itself has sha256 `b5e17e7f4ba03a295ba1a8e2fa6c769e8423fd79fe7c3ba995feb866aa6c646a`). `scripts/check-repo.mjs` lists it in `MANIFESTS` and the directory in `LF_DIRS` (only those two lines changed; `goldens`, `lf` and `--clean-tree` now cover it). NOTICE section 3 names `e2e/__behaviour__/` as carrying the lore's status.
- **Comparator proven by unit tests** (22 tests): a deep-equal copy is `[]`; one changed lore-like string is exactly one entry naming `stages.initial.texts.Gates`; removed key, added key and array length are one entry each; one changed character in the real `original.json` (lore sweep Gates row 2) is reported; `normalizeDeep` masks `2000-01-01` to `DATE` and `http://127.0.0.1:3111` to `ORIGIN`; `baselineAction(true, '1')` is `compare`, `(false, '1')` is `capture`, `(false, undefined)` is `fail-missing`. Six mutants of the comparator (diff always empty, capture overwrites, no origin mask, no date mask, ignore array length, ignore extra keys) were run against the tests: all six killed; the file was restored byte-identical to HEAD each time and nothing from the mutation was committed.
- **Per-swap gate:** `npm run test:swap` = `npm run build && playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts && npm run test`. `verify` is unchanged (its `test:e2e` step already runs every spec).

## Task Commits

1. **Task 1: Collector, comparator helpers and spec; capture from the current viewer; prove lore coverage** - `a11e132` (test)
2. **Task 2: Prove determinism, freeze the baseline, register it in check-repo, note it in NOTICE, add test:swap** - `b82f6a2` (test) - **the commit that froze the baseline; later plans reference this SHA**
3. **Task 3: Prove the baseline check fails on drift (comparator and capture-guard unit tests)** - `97afa20` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Measured timings (Windows 10, this machine)

| what | wall-clock |
|------|-----------|
| `next build` (static export) | about 17 s |
| capture run, all five files (`BEHAVIOUR_CAPTURE=1`, includes webServer start) | 2 m 10 s |
| one full single pass of the behaviour spec, `--project chromium-utc` (compare) | 2 m 07 s (Playwright reports 2.1 m) |
| per test: original / labyrinth / ladder / planetary / mobile | 56 s / 22.5 s / 23 s / 20.6 s / 0.85 s |
| `--repeat-each 3` (15 tests) | 6 m 15 s (6.2 m), 15/15 passed |
| both projects (5 passed, 5 skipped) | 2 m 07 s |
| `playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` (60 goldens + 5 behaviour, 5 skipped) | 2 m 47 s (2.8 m) |
| `npm run verify` (full gate) | 244 s, exit 0 |

The behaviour spec is under the plan's 4-minute-per-pass target (about 2 min) and costs the CI job about 2 min.

## Cross-OS rule (for CI and later plans)

The baseline was captured on Windows and must also pass on ubuntu-latest. It records only text, attributes and computed-style facts: `grep -cE "getBoundingClientRect|getClientRects|offsetWidth|offsetHeight|innerWidth|innerHeight|getAnimations|geometry|overlays|shellStyleCounts" e2e/behaviour-collect.ts` prints 0 (the panel drag records the style left/top delta, which equals the mouse delta; the layout tween is waited to its known final svg height). Clicks and hovers of list rows use `position: { x: 1, y: 1 }` (the row's own padding) so no hit target depends on font metrics. **If CI on another OS ever diverges, the remedy is: fix the collector (drop or normalise the diverging field), capture the corrected baseline into NEW files (for example a dated subdirectory of `e2e/__behaviour__`) from a checkout of commit `a11e132` or `b82f6a2` (the pre-swap viewer), freeze them as a NEW dated set with a written reason and point the spec at them. Never `-u`, never overwrite or re-freeze the existing set.** (Ubuntu has not been run from here; the risk is recorded, the remedy is defined.)

## Files Created/Modified

- `e2e/behaviour-collect.ts` - in-page collector; exports `collect` and `PANELS`
- `e2e/behaviour-compare.ts` - `normalizeDeep`, `diffBaseline`, `baselineAction` (no Playwright import)
- `e2e/behaviour.spec.ts` - the replay and compare-or-capture; one test per layout plus `mobile`; runs only in `chromium-utc`
- `e2e/__behaviour__/*.json` and `MANIFEST.json` - the frozen set
- `tests/e2e-normalizer/behaviour-lore-coverage.test.ts`, `behaviour-compare.test.ts` - coverage and comparator tests
- `scripts/check-repo.mjs` (two lines), `tests/repo/check-repo.test.ts` (one test), `NOTICE` (one sentence), `package.json` (`test:swap`)

## Decisions Made

See key-decisions above. The plan was followed as written except the deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's approach] The hover lore sweep records no lore**
- **Found during:** Task 1 step 5 (the lore coverage test after the first capture)
- **Issue:** the plan's step 3(b) hovers each Zones, Syzygies, Currents and Gates row and records `texts`; in this viewer `InfoDisplay` receives `hoverInfo={null}`, so hovering shows nothing (only a highlight), and the lore is visible only as an open Selection-panel item or the pinned background. The coverage test failed with 41 of 55 fields missing.
- **Fix:** the plan's own fallback (step 5): click each row at `{ position: { x: 1, y: 1 } }`, open the row's own Selection item (found by its title: `Zone n`, `Syzygy a::b`, `<Name> Current`, `Gt-NN`) when it is not already the open one, record `texts`, press the Selection panel's `clear` button. The five uncommitted baseline files were deleted and recaptured, as step 5 allows only before the first commit. The rows keep the plan's names (`lore sweep <Panel> row <i>`, 30 rows).
- **Follow-on:** the sweep leaves undo history behind, which would change the later `undo/redo disabled at start` behaviour, so the original test reloads the page once after the sweep (`[true,true]` is reproduced).
- **Files modified:** `e2e/behaviour.spec.ts`, `e2e/__behaviour__/original.json` (before its first commit)
- **Commit:** `a11e132`

**2. [Rule 3 - Blocking] Dates must be masked inside the stability read**
- **Found during:** design of the planetary steps
- **Issue:** `stable()` compares the JSON of each read; with the orbit key (z) the date changes every frame, so an unmasked snapshot could never settle. The plan masks dates only in `normalizeDeep` at the end.
- **Fix:** `snapshot()` runs `normalizeDeep(..., origin)` inside the read (the final `normalizeDeep` is idempotent).

**3. [Rule 2 - determinism] Two small hardenings of the plan's settle and wait rules**
- `settle` for planetary waits for a viewBox that is not the SSR 940 (the plan says "any"), so the layout switch has started before the first stability read.
- Layout tweens after the S, D, A, F keys are waited to their known final svg height (`waitForFunction`) before the stable read, instead of relying on a quiet window alone.

**4. [Process, no effect on the result] Task 3 is marked TDD but its code already existed**
- The comparator was committed in Task 1, so a RED phase before the implementation was not possible. The equivalent evidence is the six-mutant run above (all killed). The mutation edits touched only `e2e/behaviour-compare.ts` (my own file, not `app/`) and were reverted (`git checkout -- e2e/behaviour-compare.ts`, then a scripted restore in a `finally`); afterwards `git diff --quiet HEAD -- e2e/behaviour-compare.ts` exits 0, i.e. the file is byte-identical to its committed version. The first attempt of that loop crashed on a Python output-decoding error after installing the first mutant; the file was restored with `git checkout` before the loop was rerun with a `finally` restore.

**5. [Process] An aborted second launch of the 3x run**
- A first launch of the 3x run and a second launch (through a script) overlapped: the second stopped after 2 s with "already used" (port 3111 held by the first), but its `npm run build` rewrote `out/` (same app, same content) while pass 1 of the first run was executing. All 15 tests of the first run passed with identical timings across the three passes, so the result stands; no port or process was left behind.

## Verification Results

- `git diff --quiet f7d6689 -- app e2e/__golden__ engine/test/fixtures/MANIFEST.json engine/test/fixtures/base10.golden.json`: exit 0 after every task and after the full gate.
- Task 1: `npx playwright test e2e/behaviour.spec.ts --project chromium-utc` 5 passed; `vitest --project oracle tests/e2e-normalizer` passes; acceptance greps: 5 baseline files, each ending `\n`, no CR byte; `grep -c "lore sweep" original.json` = 30; `grep -l 127.0.0.1 e2e/__behaviour__/*.json` finds nothing; `grep -c ORIGIN original.json` = 1; the collector grep prints 0; the spec has `BEHAVIOUR_CAPTURE`, `chromium-utc`, `addInitScript`, `diffBaseline` and none of `toMatchSnapshot`, `C:/Users`, `4600`.
- Task 2: repeat-each 3 15/15; both projects 5 passed and 5 skipped; `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` OK (5 files in 1 sets); `node scripts/check-repo.mjs` prints `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow)`; `vitest --project oracle tests/repo` 4 files, 119 tests pass; `git diff f7d6689 -- scripts/check-repo.mjs` changes exactly the two lines.
- Task 3: `tests/e2e-normalizer` passes under `CCRUG_TZ=UTC` and `America/New_York` (3 files, 47 tests); `git status --porcelain -- app e2e/__behaviour__` prints nothing.
- **Full gate `MSYS_NO_PATHCONV=1 npm run verify`: exit 0 in 244 s.** Stages: `check:repo` OK; typecheck (4x tsc + lint) clean; `test` 16 files 702 tests pass; `test:tz` 16 files 702 tests pass; `test:e2e:basepath` 10 passed; `build` OK; `check:weight` OK (2 routes, 30 golden states within tolerance); `test:e2e` 75 passed, 5 skipped (60 DOM goldens + 10 static-export + 5 behaviour); final `check-repo --clean-tree --static-out` OK. The 60 goldens are unchanged.
- Cleanup: no listener on 3000, 3007, 3111, 3112 or 3113; `.e2e-basepath/` removed; nothing was pushed, fetched or pulled.

## Issues Encountered

- None blocking. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None.

## Threat Flags

None. T-02-10..T-02-14 are mitigated as planned: capture never overwrites (`baselineAction`, unit-tested), sha256 strict manifest plus `goldens`, `lf` and `--clean-tree` coverage, origin and date masking (unit-tested, grep acceptance), NOTICE names the directory, init-script stubs and no clipboard permission, text/attribute/computed-style fields only with three-pass determinism and a documented new-set remedy, no mutation run against `app/`.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers the safety net MIG-01 is verified against, not the migration itself (the data-source swaps are 02-08..02-12). Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Next Phase Readiness

- Plans 02-08..02-12 run `npm run test:swap` after each swap (about 3.5 min including the build; the full `npm run verify` stays the gate before deleting old data). A behaviour mismatch prints one JSON path per difference and writes `actual-<name>.json` under `test-results/`.
- **Coverage gaps the swap plans must know:** the baseline reads no demon name or demon kind text. `DemonInfo` (name, kind line, `a::b`) is reachable only by hovering or clicking a pandemonium path on the canvas, which the D-15 script does not do, and the 60 goldens draw the demon paths (stroke colour per kind, the 40 non-syzygy demons) but no name text. The 5 syzygy demon names and the per-zone count "N DEMONS IN PANDEMONIUM" are covered (Syzygies panel, zone items). Zone `centauri` is not displayed anywhere. Plan 02-12 (demons) should therefore rely on its own adapter unit tests for the 45 names and the kind mapping (12+3 chrono, 12+12 amphi, 4+2 xeno, syzygy kind = the 5 nine-sum demons), or add a small NEW dated baseline set that clicks pandemonium paths.
- The lore move (D-06/D-16) can be checked end to end: after it, `behaviour-lore-coverage.test.ts` still imports the lore through `../../app/data/*` (the seam names stay exported through Phase 2) and will need its import path updated in the same change if those files are deleted.

## Self-Check: PASSED

- FOUND: `e2e/behaviour-collect.ts`, `e2e/behaviour-compare.ts`, `e2e/behaviour.spec.ts`, `e2e/__behaviour__/{original,labyrinth,ladder,planetary,mobile}.json`, `e2e/__behaviour__/MANIFEST.json`, `tests/e2e-normalizer/behaviour-lore-coverage.test.ts`, `tests/e2e-normalizer/behaviour-compare.test.ts`
- FOUND commits: `a11e132`, `b82f6a2`, `97afa20`
