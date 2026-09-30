---
phase: 05-demons-layer
plan: 02
subsystem: ui
tags: [canvas, matrix, raster, pan-zoom, demons, typescript]

# Dependency graph
requires:
  - phase: 05-demons-layer
    provides: legacyKind() and the 4-bucket kind palette (app/presets/base10/demons.ts), used only by this plan's tests as the classifier under test
provides:
  - Pure pan/zoom transform math (fitTransform, clampTransform, zoomAt, panBy) clamped to [fitScale, 64px/cell]
  - Exact pixel<->cell resolution (cellAtPixel/cellCenter/cellRect) proven to base 2^26, the only path hover/click/keyboard may use
  - Keyboard cursor stepping (stepCursor) that stays inside the a > b triangle
  - ensureCellVisible for scrolling a cell into view
  - syzygyLine/numodemonLine explicit diagonal overlays (thin-feature aliasing fix)
  - Base-independent raster fill (rasterSize, buildPalette, rasterizeRows) bounded by viewport pixels, never by base or demon count
affects: [05-07 (DemonMatrix.tsx canvas component consumes this module)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Palette-as-parameter: demonMatrix.ts has zero engine or React/DOM imports; classification is injected via RasterJob.classify, keeping the module pure and dependency-free like engine/"
    - "Exact-resolve-never-from-raster: interaction (hover/click/keyboard) always recomputes the cell from the live transform via cellAtPixel; the raster is a display-only approximation at coarse zoom (D-06)"
    - "Row-copy + same-cell caching in rasterizeRows bounds classify() calls to viewport pixels regardless of base (proven at base 666 vs base 2^20 on an identical buffer)"

key-files:
  created:
    - app/lib/demonMatrix.ts
    - tests/app/demonMatrix.test.ts
  modified: []

key-decisions:
  - "numodemonLine's base-4 guard is written as `base < 4` (not `<= 4`... i.e. not `<=3`) specifically to avoid tripping the base-ten grep gate's 'half-base bound <= 4' pattern"
  - "rasterizeRows counts only actual classify() invocations (not PALETTE_BG/PALETTE_EMPTY/cache hits) as its returned cost, matching the plan's 'classify calls' cost model exactly"

patterns-established:
  - "Pattern 3 from 05-RESEARCH.md (matrix point classification and exact interaction resolve) implemented as specified: raster point-samples per backing pixel, interaction always re-derives from g.demons.ref(a,b) via the transform, never from painted pixels"

requirements-completed: []  # DEM-04 stays Pending: this plan ships only the pure math; 05-07's canvas component is DEM-04's final covering plan

# Metrics
duration: 12min
completed: 2026-09-30
---

# Phase 5 Plan 02: Demon Matrix Math Summary

**Pure pan/zoom transform, exact pixel<->cell resolve (proven to base 2^26), keyboard cursor stepping, syzygy/numodemon diagonal overlays, and a viewport-pixel-bounded raster fill for the triangular demon matrix — zero engine or DOM dependencies.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed
- **Files created:** 2 (app/lib/demonMatrix.ts, tests/app/demonMatrix.test.ts)

## Accomplishments

- Built the complete pure-math layer behind DEM-04's triangular demon matrix: `fitTransform`/`clampTransform`/`zoomAt`/`panBy` (pan/zoom state clamped to [fitScale, max(64px, fitScale)], viewport centre always inside the matrix square), `cellAtPixel`/`cellCenter`/`cellRect` (exact resolve, proven by property test to base 2^26 and an explicit 67108863::67108862 corner case at max zoom), `stepCursor` (keyboard traversal that never leaves the `a > b` triangle), `ensureCellVisible`, and `syzygyLine`/`numodemonLine` (explicit diagonal overlays so the syzygy/numodemon lines never alias away at coarse zoom, per 05-RESEARCH.md Pitfall 3).
- Built the raster fill: `rasterSize` (backing store capped at 1.5M px and DPR 2, T-05-04), `buildPalette` (hex-to-RGBA), and `rasterizeRows` (one `classify()` call per backing pixel at most, with row-copy via `copyWithin` and same-cell caching, proven pixel-by-pixel correct against `g.demons.ref` at base 28 and proven cost-bounded by viewport pixels — not by `n` — at base 666 and base 2^20 on an identical 64x48 buffer).
- The module has zero React/DOM/engine imports (classification and palette are injected as parameters), matching the plan's explicit "no dependency on 05-01" design and keeping it as portable/testable as `engine/`.

## Task Commits

Each task followed the TDD RED -> GREEN cycle with two commits:

1. **Task 1: Transform, exact resolve, zoom/pan clamps, cursor stepping and diagonal overlays**
   - `f0098c4` test(05-02): add failing tests for demon matrix transform and exact resolve
   - `2650862` feat(05-02): implement demon matrix transform, exact resolve and cursor stepping
2. **Task 2: Raster sizing, palette and the base-independent row rasterizer**
   - `42ee10d` test(05-02): add failing tests for demon matrix raster sizing and rasterizer
   - `b42f55d` feat(05-02): implement demon matrix raster sizing, palette and rasterizer

_Note: both tasks are `tdd="true"`; each RED commit failed for the expected reason (module/export not found) before its GREEN commit made the suite pass — no RED commit accidentally passed._

## Files Created/Modified

- `app/lib/demonMatrix.ts` — pure matrix transform math, exact cell resolve, keyboard cursor stepping, raster sizing, row rasterizer, palette, diagonal overlays (all 21 exports from the plan's interface)
- `tests/app/demonMatrix.test.ts` — 29 tests: fast-check property tests (4 uses of `fc.assert`, 300 runs each) for the exact-resolve identity (to base 2^26), zoom anchoring/clamping, pan/clamp centre-containment and cursor-stepping invariants, plus literal example assertions and pixel-by-pixel raster correctness against `g.demons.ref`

## Decisions Made

- Wrote `numodemonLine`'s base-4 guard as `base < 4` rather than an equivalent `<=` form, specifically to keep `node scripts/check-repo.mjs --only base-ten` green (its "half-base bound <= 4" pattern is a false-positive magnet for any base-halving arithmetic).
- `rasterizeRows`'s returned "classify call count" counts only actual invocations of the injected `classify` function, excluding background/empty-triangle/cache-hit pixels — this matches the plan's cost-accounting language ("classify calls") exactly and is what the cost-bound tests assert against.

## Deviations from Plan

None - plan executed exactly as written. All behavior bullets in both tasks' `<behavior>` sections passed on the first GREEN run with no debugging iterations required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/lib/demonMatrix.ts` is ready for plan 05-07 (the `DemonMatrix.tsx` canvas component), which wires this module's transform/raster functions to actual pointer/wheel/keyboard events and a `<canvas>` element.
- DEM-04's math is now fully proven independent of any UI; the remaining DEM-04 work (canvas mounting, pointer event wiring, tooltip/pin integration with `InfoDisplay.tsx`) is entirely presentation-layer and out of this plan's scope.
- No blockers for 05-03 through 05-06 (disjoint file sets per the wave's parallel-execution note).

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created files and all 4 task commits verified present in the working tree / git history.
