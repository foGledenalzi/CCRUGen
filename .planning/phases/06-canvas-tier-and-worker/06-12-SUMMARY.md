---
phase: 06-canvas-tier-and-worker
plan: 12
subsystem: canvas-chrome-and-e2e
tags: [canvas, toolbar, fit, shared-link-fit, selection-panel, e2e, parity, lod, pick-radius, fidelity, page-weight]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-10's CanvasDiagram handle (zoomIn, zoomOut, fit, fitZones, zonesInClientRect, element) and its data-* hooks, 06-11's render tier, worker swap and e2e helpers (openCanvas, openHeadless), 06-09's capped Selection list, 06-08's overlay fidelity, 06-05's pure transform and pick index, 06-01's table-driven boundaries
provides:
  - app/NumogramClient.tsx with the zoom toolbar mounted at every drawn tier and driving the canvas transform, a Canvas fit (Fit button and shared-link fit), and a Selection panel placement that measures whichever diagram is mounted
  - e2e/canvas-tier.spec.ts - 12 browser tests of the Canvas tier (tier boundaries, four layouts, SVG parity at 28 and 64, level of detail, the 12 px pick rule, hover/pin/clear, on-demand gate, panels and toolbar, select-all fidelity and the capped Selection list, Demon focus chords, shared-link fit)
  - perf/page-weight.baseline.json raised through `update --reason` (ledger entry 9, "Phase 6 06-12")
affects: [06-13, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas e2e specs compute every expectation with the engine and the same pure modules the app uses (createNumogram, resolveLayout, buildZoneScene, pickAt, toScreen, fitZones, parseRouteCurve, curveAway) and never read geometry back from the app; the DOM is only read for attributes the app publishes (data-zoom, data-tx, data-ty, data-overlay-*)"
    - "A press point is chosen with document.elementFromPoint and the app's own corner emptiness, because fixed panels sit above the canvas's left strip at a 1280 px viewport"
    - "Timings (overlay-ms, parity deltas, fitted radius) are logged with console.log and never compared to a threshold"

key-files:
  created:
    - e2e/canvas-tier.spec.ts
  modified:
    - app/NumogramClient.tsx
    - perf/page-weight.baseline.json

key-decisions:
  - "At the Canvas tier the toolbar's percentage is the canvas zoom relative to fit (`canvasZoom` from onZoomChange); Zoom in and Zoom out call canvasRef.current?.zoomIn()/zoomOut(); the SVG tier's ViewControls props are identical to before"
  - "A pair-graph scene is indexed by pair id, so the Canvas fit maps selected zones to pair ids (g.pairOf) for a shared link, and Fit passes the pair ids whose low zone is not muted (the same rule PairGraphProjection's pairStates use); zone scenes pass zone ids unchanged"
  - "The Selection panel's first-render placement uses canvasRef.current?.element() ?? the [data-diagram] element inside the SVG wrapper, so it never queries a bare svg; the one-shot timing is unchanged (the base-10 SVG at load)"
  - "Page weight: raised through the sanctioned update route only; /numogram/ JS 726,294 -> 808,836 raw and 218,587 -> 245,874 gzip; the lazy-load alternative that would recover most of it stays todo 007 for the user at 06-15"

patterns-established:
  - "Throwaway probe specs (never committed) located the two spec bugs below; the permanent spec asserts the cause (the start corner must reach the canvas and every node centre must lie inside the rubber band)"

requirements-completed: []  # REN-02 stays Pending: 06-13 (keyboard, touch, narrow windows, isolate/mute) and 06-15 (phase gate) still list it, and the project marks a requirement only at its final covering plan

# Metrics
duration: ~32min
completed: 2026-10-15
---

# Phase 6 Plan 12: Canvas Chrome and Canvas-Tier E2E Summary

**The Canvas tier now has its full viewer chrome (the zoom toolbar, Fit and the shared-link fit drive the canvas transform, the Selection panel finds the diagram at any tier), and 12 Chromium tests prove tier choice, SVG parity within 0.30 and 0.72 CSS px, level of detail, the exact 12 px pick rule, on-demand gates, select-all fidelity downgrade with the capped Selection list, and Demon focus chords, with every expectation computed from the engine rather than read back from the app. The page-weight budget was raised once, with a reasoned ledger entry.**

## Performance

- **Duration:** ~32 min
- **Tasks:** 3
- **Files:** 3 (1 created, 2 modified), plus this summary

## Accomplishments

- **Canvas chrome (Task 1, `cc56c50`).** `ViewControls` mounts for `hasDiagram` (every drawn tier) and at the Canvas tier shows `canvasZoom` (the former value-less `[, setCanvasZoom]` now read) and calls `canvasRef.current?.zoomIn()` / `zoomOut()` / `fit()` / `fitZones()`. `fitSelectionToView` has a Canvas branch (so the pending shared-link fit works: the timer reads the ref when it fires), `fitAll` calls `fit()` with no mute filter or `fitZones(visible)` with one, and the Selection panel's initial position measures `canvasRef.current?.element()` or the `[data-diagram]` element of the SVG wrapper. The unused `showDiagram` constant was removed. `typecheck` clean (only the existing DemonMatrix warning), `base-ten` OK, and `npm run test:swap` green: 65 passed and 5 skipped (60 goldens plus the behaviour specs, nothing regenerated), then 88 files and 2411 unit tests.
- **Spec (Task 2, `bc5fb0c`).** `e2e/canvas-tier.spec.ts`, 687 lines, 12 tests, all closing with `expect(errors).toEqual([])`. Results of the measurements the spec logs: SVG/Canvas centre agreement `maxDeltaPx` 0.304 at base 28 (tolerance 1) and 0.715 at base 64 (tolerance 1.5, matching the predicted floor effect of about 0.73); at base 202 the fitted radius is 4.96 px (below the 7 px label threshold), no zone label is painted at fit and labels are painted after wheel-zooming to threshold over fitted radius; the 12 px rule holds at 5 and 11 px and releases at 13 px for the zone and direction the spec's own `pickAt` selects; a hovered zone's own gate is drawn with the gate layer off (`data-overlay-edges` 0 before hover and 1 + |pair current plus currents into it| + 1 after); select-all at base 4000 gives `overlay-ms base=4000 edges=8000 fidelity=plain ms=14.2` to 19.6 (8000 = 2 x 2000 pairs + 4000 gates, exact), the Selection header reads `Selected Elements (12000)` and the panel shows 200 entries plus one `[data-selection-more]` reading `and 11800 more selected`; Demon focus at base 202 draws 201 chords and a chord is picked from its curve midpoint and named `20::0` in the Selection panel.
- **Page weight (Task 3, `02b0e9e`).** After the build the check failed only on `/numogram/` JS (808,836 raw against a limit of 762,609, 245,874 gzip against 229,517); HTML, CSS, the `/` route and all 30 golden DOM counts were within tolerance. `node scripts/page-weight.mjs update --reason "Phase 6 06-12: ..."` raised the baseline and `check` then passed (`page-weight: OK (2 routes, 30 golden states within tolerance)`).

## Task Commits

Each carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`):

1. **Task 1: canvas toolbar, fit, shared-link fit, Selection panel placement** - `cc56c50` feat(06-12)
2. **Task 2: e2e/canvas-tier.spec.ts** - `bc5fb0c` test(06-12)
3. **Task 3: page-weight baseline raise** - `02b0e9e` chore(06-12)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

## Page weight (the numbers asked for)

| Measure, `/numogram/` | Baseline before | Measured at 06-11 | Final (after this plan) | Baseline now |
|---|---|---|---|---|
| JS raw | 726,294 | 808,034 | **808,836** | 808,836 |
| JS gzip | 218,587 | 245,633 | **245,874** | 245,874 |
| HTML raw / gzip | 91,347 / 13,294 | - | 90,137 / 12,985 | same |
| CSS raw / gzip | 20,550 / 5,085 | - | 20,497 / 5,064 | same |

The Task 1 toolbar and fit wiring added +802 raw and +241 gzip over 06-11. `/numogram/` growth over the pre-Phase-6 baseline is +82,542 raw (+11.4 percent) and +27,287 gzip (+12.5 percent). `update` rewrites every route in the file from one measurement, so `/` (416,830 -> 416,918 JS raw, 128,120 -> 128,175 gzip) and the CSS/HTML figures moved by a few bytes too; that is the script's behaviour, not a hand edit. The worker chunk (17,006 bytes) is not referenced by HTML and is outside this measure. The ledger entry's reason starts with `Phase 6 06-12` and names the lazy-load alternative (todo 007).

## Requirements

REN-02 stays Pending in REQUIREMENTS.md. The plan lists it, but 06-13 (keyboard, touch, narrow windows, isolate and mute at the Canvas tier) and 06-15 (the phase gate) list it too, and the project marks a requirement only at its final covering plan (the 06-11 precedent). This plan makes ROADMAP criterion 1 (tier chosen from the table, same features, parity) and criterion 2 (picks and level of detail) observable in a real browser.

## Deviations from Plan

### Judgement calls and clarifications (no scope change)

1. **Pair-graph fit.** The plan says `fitZones(zones)`. A pair-graph scene is indexed by pair id, so passing zone ids would silently ignore every zone at or above `base / 2`. `fitSelectionToView` maps zones through `g.pairOf` at a pairs scene, and `fitAll` passes the pair ids whose low zone is not muted (the rule `pairStates` already uses for the SVG pair graph). Zone scenes are unchanged.
2. **The "more selected" remainder is counted in entries, not zones.** The plan text says the number equals "(selected zone count - SELECTION_LIST_MAX)". The capped list is of Selection entries (zones, syzygies, currents and gates, keyed `zone:`, `gate:`, `current:`, `syzygy:`), so at base 4000 it is 12000 entries and the remainder is 11800 (a zone count of 4000 would give 3800). The spec derives the 12000 from the engine with the same keys, asserts the panel header `Selected Elements (12000)` and the exact `and 11800 more selected`, and that at most 200 entry rows exist.
3. **One test beyond the plan's ten (test 11, a shared link fits on the canvas).** must_haves truth 1 names it ("a shared link with selected zones fits them on the canvas"), and no listed test covered it. `?base=1024&selected=5,6,40` is expected to land on exactly the pure `fitZones(...)` transform (zoom, tx, ty), and Fit returns to zoom 1.
4. **`showDiagram` removed** from NumogramClient (it had one use, the toolbar mount, and would be an unused variable).
5. **The Text panel needed no change.** 06-11 already gated it on `hasDiagram`, so Task 1's `grep -c "hasDiagram &&"` is 2 only because of the toolbar.
6. **The select-all rectangle** starts 1 px inside a corner that reaches the canvas and ends 10 px beyond the opposite corner. The spec proves from the engine scene that every node centre lies inside it, because the Plex and Warp row sits within a few px of the frame edge.

### Auto-fixed Issues

**1. [Rule 1 - Bug in the new spec] Corner presses landed on a panel.**
- **Found during:** Task 2, first run (tests 6 and 9 failed).
- **Issue:** At a 1280 px viewport the fixed desktop panels (x 217 to 395) sit above the left strip of the 580 px canvas (x 350 to 930), so a press at the top-left corner hit a panel header, not the canvas. The app was right (panels above the diagram is the UI-SPEC z-order and the SVG tier's behaviour); the spec's corner choice was wrong.
- **Fix:** `emptyCorner(page, inset)` tries the right-hand corners first and verifies each with `document.elementFromPoint(...).hasAttribute('data-diagram')`; every empty click and the rubber band use it.
- **Files modified:** e2e/canvas-tier.spec.ts. **Commit:** bc5fb0c (never committed in the broken form).

**2. [Rule 1 - Bug in the new spec] Select-all selected 3866 of 4000 zones.**
- **Found during:** Task 2, second run (`data-overlay-edges` 7747, not 8000).
- **Issue:** a 4 px inset excluded 134 zones (the Plex and Warp row within a few px of the frame edge). A throwaway probe confirmed 3866 zones in the URL and `Selected Elements (11497)`; the app's counts were exactly consistent with that selection.
- **Fix:** see judgement call 6; the spec now asserts the enclosing precondition and then the exact 8000 edges.
- **Files modified:** e2e/canvas-tier.spec.ts. **Commit:** bc5fb0c.

**Total deviations:** two spec bugs fixed before commit, six judgement calls above. **Impact on plan:** none; no app code was changed to make a test pass, and no frozen file was touched.

## Issues Encountered

- A throwaway probe spec (`e2e/zz-probe.spec.ts`, used three times, deleted each time, never staged) located both spec bugs; `git status` after the final commit shows a clean tree.
- `sleep` in the foreground is blocked in this environment; `npm run verify` ran in the background with an `until grep` wait on its log.

## Verification

- `npm run typecheck`: exit 0 after Task 1 (4x tsc plus lint; the one warning is the existing `genRef.current` note in `DemonMatrix.tsx`). `tsc --noEmit` also clean after every spec edit.
- `node scripts/check-repo.mjs --only base-ten`: OK (new files `git add`ed first).
- `npm run test:swap` after the NumogramClient edit: **exit 0**, 65 passed and 5 skipped (60 DOM goldens plus the behaviour specs, nothing regenerated), then vitest 88 files and 2411 tests.
- `npx playwright test e2e/canvas-tier.spec.ts --project=chromium-utc`: **12 passed**, three consecutive full runs (about 15 s each).
- Acceptance greps on the spec: `interactiveMaxN` 1, `pickAt(` 3, `toScreen(` 5, `fillText` 7, `data-overlay-fidelity` 2, `overlay-ms` 1, `data-overlay-chords` 1, `Demon focus` 3, `data-selection-more` 1, `SELECTION_LIST_MAX` 4, `height: 1000` 1; the 4000/4002 grep returns nothing; no comparison of `data-overlay-ms` against a threshold (it is only logged).
- `node scripts/page-weight.mjs check`: OK after the sanctioned update.
- `npm run test:e2e` (both projects): **213 passed, 143 skipped** (up exactly 12 passed and 12 skipped from 06-11's 201 and 131: the 12 new tests run in the UTC project and skip in the New York one).
- `MSYS_NO_PATHCONV=1 npm run verify`: **exit 0.** check-repo 11 checks OK, typecheck, 88 files and 2411 unit tests in UTC and again in America/New_York, sub-path e2e 10 passed, build, page-weight OK, e2e 213 passed and 143 skipped, then `check-repo --clean-tree --static-out` OK (13 checks).
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty throughout; no frozen manifest or oracle was edited or regenerated; no `reference/`, Projection, PairGraphProjection, `app/presets/base10`, `useCanvasPan` or `engine/` change.

## Known Stubs

None.

## Threat Flags

None new. T-06-12 (budget drift) is mitigated by the `update --reason` ledger entry and `check:weight` re-validating in verify; T-06-11 (oracle integrity) by the unchanged SVG-tier toolbar props, `test:swap` green after the edit and the full e2e and verify green; T-06-26 (select-all denial of service) by the browser-proven plain-fidelity downgrade (8000 edges, overlay about 14 to 20 ms, logged not asserted) and the capped Selection list.

## Observations for 06-13 and 06-15

- **Panels cover the left strip of the canvas at 1280 px** (fixed panels x 217 to 395 against the canvas x 350 to 930), exactly as the UI-SPEC z-order says and as the SVG tier behaves; a press there goes to the panel. Worth a line in the 06-15 manual narrow-window and parity checkpoint, not a bug.
- **Page-weight decision for the user at 06-15:** accept the raise (+27,287 gzip on every `/numogram/` visit, including base 10) or lazy-load `CanvasDiagram` and the worker fallback core (todo 007). The raise is already a reasoned ledger entry, so the choice does not block the phase.
- **Hooks ready for 06-13:** `emptyCorner` and `canvasPoint` in the spec show how to press at a canvas point that reaches the overlay; `data-focus-key`, `[data-canvas-live]` and `data-canvas-state` are live from 06-10; Fit and zoom are verified, so 06-13's keyboard `+`, `-`, `0` assertions can compare against the toolbar's `data-zoom` values.
- REN-02 and REN-03 stay Pending until 06-13 to 06-15.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-15*

## Self-Check: PASSED
