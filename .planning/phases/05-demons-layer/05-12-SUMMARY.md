---
phase: 05-demons-layer
plan: 12
subsystem: testing

tags: [playwright, e2e, demons, focus-mode, matrix, raster-timing, verify-gate]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-11)
    provides: "e2e/demons-helpers.ts's waitRaster/matrixCellPoint helpers, built for this plan's Matrix-tab specs"
  - phase: 05-demons-layer (05-08, 05-10)
    provides: "DEM-03's focus-chord layer in Projection.tsx and DemonFocusView.tsx; DemonMatrix.tsx wired into DemonsOverlay"
provides:
  - "e2e/demons-focus.spec.ts: 6 real-browser tests proving DEM-03 (D-03) in both directions, the pre-existing zone-click behaviour when focus mode is off, the toggle clearing state, base 666 (no diagram) and a demonFocus= URL reload"
  - "e2e/demons-matrix.spec.ts: 6 real-browser tests proving DEM-04 (D-06) exact hover/click resolve at multiple zoom levels, pin-and-focus, the syzygy diagonal overlay, keyboard access, base 666, and measured raster-fill timings (research A1)"
  - "A green full `npm run verify` gate closing Phase 5, with every frozen oracle, golden and baseline untouched"
affects: ["05-VERIFICATION (phase 5 verifier)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Matrix hover/click/keyboard specs always compute the expected tooltip/live-region text independently via `createNumogram(...).demons.ref(a, b)` plus the engine's own `formatNumeral` and `SUBTYPE_LABEL`, never read back from the app, mirroring every other Phase 5 e2e spec's convention"
    - "Zoom-at-a-point tests move the mouse to the target cell's centre *before* reading the pre-zoom scale and before `page.mouse.wheel(...)`, then gate the next step on `data-scale` actually changing (`expect.poll`) rather than trusting `waitRaster` alone, since the raster-done attribute can already read 'done' from a prior commit at the instant a new wheel tick fires"
    - "Raster timings are logged via `console.log` and asserted only `>= 0` / finite (T-05-38): the measured answer belongs in the SUMMARY, not a flakiness-prone threshold"

key-files:
  created:
    - e2e/demons-focus.spec.ts
    - e2e/demons-matrix.spec.ts
  modified:
    - tests/app/demonMatrix.test.ts

key-decisions:
  - "Fixed the pre-existing flaky fast-check property in tests/app/demonMatrix.test.ts (logged in deferred-items.md during 05-05, owned by 05-02/05-03, untouched since) rather than leaving it deferred again: this is the phase-closing plan and the gate must be green, the failure is a 1-ULP floating-point boundary artifact in the test's own assertion (not a product bug), and deferred-items.md already prescribed the exact epsilon-tolerance fix applied here"

patterns-established: []

requirements-completed: [DEM-03, DEM-04]

# Metrics
duration: ~50min
completed: 2026-09-30
---

# Phase 5 Plan 12: Demons Focus Mode and Matrix E2E, Phase Gate Summary

**12 real-Chromium Playwright tests prove DEM-03 (both focus-mode directions, including base 666 with no diagram) and DEM-04 (exact matrix hover/click/keyboard resolve at multiple zoom levels, raster timings measured at 16-83ms) end to end, closing Phase 5 with a green `npm run verify`.**

## Performance

- **Duration:** ~50 min (context/interface reading across ~10 production files, two spec files authored and green on first Playwright run each, one pre-existing flaky unit test diagnosed and fixed, two full `npm run verify` runs)
- **Started:** 2026-09-30T01:00:00Z (approx., first file read)
- **Completed:** 2026-09-30T01:50:00Z (second `npm run verify` run green)
- **Tasks:** 3 completed
- **Files modified:** 3 (2 new: e2e/demons-focus.spec.ts, e2e/demons-matrix.spec.ts; 1 fixed: tests/app/demonMatrix.test.ts)

## Accomplishments

- `e2e/demons-focus.spec.ts` proves DEM-03 (D-03) in both directions against the static export: a zone click in Demon focus mode at base 28 draws its 27 incident chords (`g.demons.ref` cross-checked, `base - 1` derived from `createNumogram(28)`) and lands the overlay on the already-selected Focus tab; choosing a demon in the overlay (search `c::3` -> row 69, click, Escape) draws its one chord (`[data-demon-focus="12:3"]`), highlights zones 12 and 3's node-circle stroke (not dimmed to the `44`-suffixed alpha) while zone 5 stays dimmed, and shows `c::3` in the Selection panel; the pre-existing non-focus-mode zone click still writes `selected=` and draws no chords; toggling focus mode off clears both the chords and `demonFocus=` from the URL; base 666 (zero `[data-diagram]` elements) still works entirely through the Focus tab's own zone-number input, including a `MESH`-bearing detail pin, a `clear focus` reset, and an out-of-range zone (`700` >= base 666) producing the `"Couldn't parse"` error; and a `?demonFocus=12%3A%3A3` link reloads directly into the same pinned-and-focused view.
- `e2e/demons-matrix.spec.ts` proves DEM-04 (D-06) against the static export: hovering a cell resolves the exact `a::b`/mesh/subtype text (`'c::3 · 69 · Cyclic chrono'` at base 28, matching the interface contract's engine facts) both at the initial fit scale and after a wheel-zoom centred on that same cell, and also resolves a second cell (20, 7) correctly post-zoom; a click pins and focuses the demon (`aside[data-demon-detail]`, `rect[data-matrix-pinned]`, `demonFocus=12%3A%3A3` in the URL); the syzygy diagonal (`line[data-matrix-line="syzygy"]`) is present as an explicit overlay; the keyboard model (arrows move the cursor from the default (1,0) through (3,0) to (3,1), Enter pins, `+` zooms) is proven via the `[data-matrix-live]` aria-live region; base 666 renders with zero diagram elements and still resolves exactly after six successive zoom-in wheel steps recentred on the same target cell each time; and raster-fill timings are measured and logged (not asserted against a threshold, per T-05-38) at bases 28, 666 and 4096.
- **Research assumption A1 answered** (05-RESEARCH.md: "will the viewport-resolution point-sampled raster meet the `oneTimePaintMs` (500ms) budget at realistic panel sizes?"): measured on this run, `base=28 ms=16`, `base=666 ms=83`, `base=4096 ms=71` — all comfortably under the 500ms budget, confirming the architecture proposal without needing the progressive-fill fallback the research flagged as a contingency.
- Full `npm run verify` gate is green: repo guard (11 checks), typecheck (4x tsc + lint, one pre-existing unrelated warning in `DemonMatrix.tsx` from 05-07), 1720 unit tests in both UTC and America/New_York, 10 sub-path e2e, build, page-weight OK with no baseline change, 200 e2e passed / 130 skipped (including the 60 frozen DOM goldens and all 5 behaviour-baseline specs, byte-identical), and the final clean-tree/static-out guard. `node scripts/check-repo.mjs --only goldens` exits 0 independently. No frozen oracle, golden, behaviour baseline, fixture or page-weight baseline was touched.

## Task Commits

1. **Task 1: Focus-mode specs** - `834bf15` (test)
2. **Task 2: Matrix specs** - `a3ee503` (test)
3. **Task 3: Full phase gate** - `8b0c7cf` (fix, the one deviation below; the gate run itself produced no further commits)

**Plan metadata:** (this commit) docs(05-12): complete demons focus and matrix e2e plan

## Files Created/Modified

- `e2e/demons-focus.spec.ts` - 6 tests proving DEM-03 end to end (diagram-to-overlay, overlay-to-diagram, mode-off, toggle-off, base 666, URL reload)
- `e2e/demons-matrix.spec.ts` - 6 tests proving DEM-04 end to end (hover at two zoom levels, click-pin, syzygy overlay, keyboard, base 666, raster timings)
- `tests/app/demonMatrix.test.ts` - Rule 1 fix: a 1e-9 epsilon absorbs a 1-ULP floating-point boundary miss in the `clampTransform` pan-clamp fast-check property

## Decisions Made

- Fixed (rather than re-deferred) the pre-existing flaky `clampTransform` property test from 05-05's deferred-items.md entry, since 05-12 is the phase-closing plan and the full gate must be green; the fix is exactly the epsilon-tolerance approach the deferred-items.md note already prescribed, and the file (`tests/app/demonMatrix.test.ts`, owned by 05-02/05-03) is a Phase 5 file, which the plan's own Task 3 instructions explicitly put in scope ("if a failure is caused by one of this phase's files, fix it").
- Both new spec files recompute every expected value independently from `createNumogram(...)` (never from the app's own state), continuing the convention established in `e2e/demons-browser.spec.ts` and `e2e/hover-pin.spec.ts`.
- Zoom-at-a-point assertions gate on `data-scale` actually changing (`expect.poll`) before calling `waitRaster`, since the raster-done attribute can read 'done' from a stale prior commit at the instant a new wheel tick fires — resolving the exact cell afterward is still correct regardless (the live transform updates synchronously), but gating on the scale change keeps the test's intent explicit and matches the plan's own described flow for test 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Flaky 1-ULP floating-point boundary miss in a pre-existing fast-check property**
- **Found during:** Task 3, first `npm run verify` run
- **Issue:** `tests/app/demonMatrix.test.ts`'s `clampTransform > property: the viewport centre stays inside the matrix square after any panBy(dx, dy)` failed under one fast-check seed with `expected 216.71884485663327 to be greater than or equal to 216.7188448566333` — `clampNum`'s `(h/2 - base*scale) + base*scale` is not always bit-identical to `h/2` under IEEE 754. This exact issue was found during 05-05 and logged (not fixed) in `.planning/phases/05-demons-layer/deferred-items.md`, with a suggested epsilon-tolerance fix.
- **Fix:** Added a `1e-9` epsilon to all four boundary assertions in the property (`toBeLessThanOrEqual(w/2 + EPS)` etc.), per the already-suggested fix. The property's actual claim (the viewport centre stays inside the matrix square) is unaffected; only exact floating-point equality at the boundary is relaxed.
- **Files modified:** tests/app/demonMatrix.test.ts
- **Verification:** 5 consecutive full re-runs of `tests/app/demonMatrix.test.ts` (29 tests each, fresh random fast-check seeds) all green; the full `npm run verify` re-run afterward was fully green (1720 unit tests x2 timezones).
- **Committed in:** 8b0c7cf

---

**Total deviations:** 1 auto-fixed (Rule 1, a test-only floating-point tolerance fix; no production code changed)
**Impact on plan:** No scope creep — the fix is scoped to the one flaky assertion already identified and prescribed by a prior plan's deferred-items.md entry, and was necessary for this phase-closing plan's own gate to pass.

## Issues Encountered

None beyond the one deviation above. Both new spec files passed on their first Playwright run with no debugging iterations needed.

## Per-Requirement Evidence

| Req ID | Unit Tests | E2E Tests |
|--------|-----------|-----------|
| DEM-01 | `tests/app/demonFacets.test.ts` | `e2e/demons-browser.spec.ts` tests 1-2 |
| DEM-02 | `tests/app/demonBrowserSource.test.ts`, `demonSearch.test.ts`, `demonRowListRender.test.ts` | `e2e/demons-browser.spec.ts` tests 3-6 and 12 |
| DEM-03 | `tests/app/demonState.test.ts`, `projectionRender.test.ts`, `demonFocusRender.test.ts` | `e2e/demons-focus.spec.ts` (this plan, 6 tests) |
| DEM-04 | `tests/app/demonMatrix.test.ts` | `e2e/demons-matrix.spec.ts` (this plan, 6 tests) |
| DEM-05 | `tests/app/demonNames.test.ts` | `e2e/demons-browser.spec.ts` tests 7-8 |

All five requirements were already marked Complete in REQUIREMENTS.md by plan 05-10 (the final covering plan for DEM-01/02/05) and by their own multi-plan spans for DEM-03 (05-04, 05-08, 05-10) and DEM-04 (05-02, 05-07, 05-10); this plan adds the e2e proof the traceability table already anticipated for DEM-03/DEM-04 and ROADMAP success criteria 3 and 4, without changing any requirement's completion status.

## Full Gate Evidence

- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. check-repo (11 checks) OK; typecheck (4x tsc + lint) clean (one pre-existing unrelated `DemonMatrix.tsx` `react-hooks/exhaustive-deps` warning from 05-07, out of this plan's scope); 1720 unit tests passed in both `CCRUG_TZ=UTC` and the America/New_York timezone project; 10 sub-path e2e passed; build OK; page-weight OK (2 routes, 30 golden states within tolerance, no baseline change); e2e suite 200 passed / 130 skipped (60 frozen DOM goldens + 5 behaviour-baseline specs unchanged, all other Phase 4/5 UI specs run once in the `chromium-utc` project per their own `test.beforeEach` skip rule); final `node scripts/check-repo.mjs --clean-tree --static-out` OK.
- `node scripts/check-repo.mjs --only goldens`: exit 0.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures perf/page-weight.baseline.json`: empty.
- **Raster timings (research A1, measured this run, not asserted):** `raster-ms base=28 ms=16 scale=22.07`, `raster-ms base=666 ms=83 scale=0.928`, `raster-ms base=4096 ms=71 scale=0.151` — all well under the `oneTimePaintMs: 500ms` budget in `engine/scene/tier-table.json`. Timings will vary by machine; the architecture (viewport-resolution point-sampled raster, redrawn on commit) is confirmed sufficient without needing the progressive/chunked-fill contingency the research flagged.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 (demons-layer) execution is complete: 12/12 plans, all five DEM requirements marked Complete, full `npm run verify` green.
- `.planning/phases/05-demons-layer/deferred-items.md`'s one entry is now resolved (fixed in this plan, not re-deferred); the file can stay as a historical record or be cleared by a future housekeeping pass — no action required before `/gsd-verify-work 5`.
- Next step: `/gsd-verify-work 5`.

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

- FOUND: e2e/demons-focus.spec.ts
- FOUND: e2e/demons-matrix.spec.ts
- FOUND: .planning/phases/05-demons-layer/05-12-SUMMARY.md
- FOUND: tests/app/demonMatrix.test.ts
- FOUND commit: 834bf15 (test, Task 1)
- FOUND commit: a3ee503 (test, Task 2)
- FOUND commit: 8b0c7cf (fix, Task 3 deviation)
