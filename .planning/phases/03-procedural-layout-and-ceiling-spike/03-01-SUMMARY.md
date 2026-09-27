---
phase: 03-procedural-layout-and-ceiling-spike
plan: 01
subsystem: engine-layout
tags: [typescript, layout, geometry, svg-coordinates, deterministic-packing]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: "pure engine/core (createNumogram, Cycle.zones() canonical walk order, torqueLabel)"
provides:
  - "engine/layout/types.ts: the Layout, LayoutGroup, RegionLabel, PairGraphLayout, LayoutSpec, GateRoutes, CurrentRoutes, PairGraphRoutes contracts every later layout/routing plan builds against"
  - "engine/layout/params.ts: DEFAULT_LAYOUT_PARAMS (frozen) and resolveParams"
  - "engine/layout/format.ts: fmt/ceilQ/roundQ, the 1/8 quantization grid every layout module compares on"
  - "engine/layout/pack.ts: packSpiral (golden-angle, D-03 default) and packShelf (row packing), both overlap-free and bit-stable"
  - "engine/layout/frame.ts: fitFrame/applyFit/fitPoint, the margin + 800x600 minimum + 4096 cap (D-06)"
  - "engine/layout/ring.ts: ringLayout, the default procedural layout (D-01, D-02, D-03) verified for every even base 2..400 plus 666, 1024, 4096"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "1/8 quantization before comparison (ceilQ/roundQ) so trig-derived coordinates are bit-stable across engines"
    - "explicit bbox loops (never Math.min/max(...arr)) to avoid call-stack blowup at n up to 4096"
    - "canonical cycle order (length descending) doubles as packer input order, so no sort is needed before packing"
    - "mismatch-collector sweep pattern (capped array of short strings, one expect per sweep) reused from engine/test/structure.sweep.test.ts"

key-files:
  created:
    - engine/layout/types.ts
    - engine/layout/params.ts
    - engine/layout/format.ts
    - engine/layout/pack.ts
    - engine/layout/frame.ts
    - engine/layout/ring.ts
    - engine/test/layout.format.test.ts
    - engine/test/layout.pack.test.ts
    - engine/test/layout.ring.test.ts
  modified: []

key-decisions:
  - "packer default is 'spiral' (D-03's golden-angle spiral); 'shelf' stays selectable and is shown on the 03-08 contact sheet for the user's sign-off"
  - "composeTorques nesting order (outward-then-gap pass) fixes a research-prototype ordering bug that could break the nest gap for k=3"

requirements-completed: [LAY-01, LAY-03]

# Metrics
duration: 14min
completed: 2026-09-27
---

# Phase 3 Plan 1: Layout Contracts and the Default Ring Layout Summary

**Pure `engine/layout` module: shared Layout/LayoutParams contracts, two deterministic glyph packers (golden-angle spiral and row-shelf), a frame fit with an 800x600 minimum and a 4096 cap, and `ringLayout` — every Torque cycle a ring glyph, nested (<=3) or packed (>=4), Plex/Warp capsules at the bottom — verified for every even base 2..400 plus 666, 1024 and 4096.**

## Performance

- **Duration:** 14 min (across Tasks 1-3; git commit span 19:16:25Z-19:30:41Z)
- **Started:** 2026-09-27T19:16:25Z
- **Completed:** 2026-09-27T19:30:41Z
- **Tasks:** 3 completed
- **Files modified:** 9 created (6 modules, 3 test files)

## Accomplishments

- Fixed the phase's shared contracts first (`engine/layout/types.ts`): `Layout`, `LayoutGroup`, `RegionLabel`, `PairGraphLayout`, `LayoutSpec`, `GateRoutes`, `CurrentRoutes`, `PairGraphRoutes`, `RouteOptions`, and the `LAYOUT_IDS`/`PACKERS`/`CAPSULE_PLACEMENTS` tuples every later plan in this phase (ladder, spiral, pair graph, routing, emitter, presets, contact sheet, spike) builds against.
- `fmt`/`ceilQ`/`roundQ` (`engine/layout/format.ts`): deterministic number formatting (never `-0`, throws `RangeError` on non-finite input, mitigating threat T-03-01) and a 1/8 quantization grid that absorbs `Math.sin` last-ulp differences (`ceilQ(chordRadius(6, 84))` is exactly `84`, not `84.00000000000001`).
- Two overlap-free, bit-stable packers (`engine/layout/pack.ts`): `packSpiral` (golden-angle first fit, D-03 default) with a uniform grid for O(1)-ish neighbourhood lookups, and `packShelf` (row packing, the tighter/cheaper alternative kept selectable). Both round every discrete decision to 1/8 before the overlap test.
- `fitFrame`/`applyFit`/`fitPoint` (`engine/layout/frame.ts`): the margin, 800x600 minimum frame and the 4096 growth cap (D-06), with explicit bbox loops (no `Math.min/max(...arr)`, which would blow the call stack at n = 4096).
- `ringLayout` (`engine/layout/ring.ts`, D-01/D-02/D-03): every Torque cycle drawn as a regular ring glyph in canonical (length-descending) order; up to 3 nest concentrically with a corrected outward-then-gap pass; 4 or more are packed by the chosen packer; Plex/Warp capsules sit at the bottom centre (beside or above); the whole composition is fit to the frame and reports `nodeRadius`, `labelSize`, `strokeScale`, `scale` and `natural` size per LAY-03.
- Verified by direct sweep (not sampling): every even base 2..400 plus 666, 1024 and 4096, for both packers — ring-node radii, uniform neighbour spacing, walk-order parity, `partner`/`current` agreement with the engine, anticlockwise angle steps, nesting/packing clearance, capsule placement, frame bounds, minimum inter-zone spacing, and every LAY-03 size formula.

## Task Commits

Each task was committed atomically (TDD RED/GREEN pairs):

1. **Task 1: Layout contracts, default parameters and the fmt/quantize helpers** - test `17178d6`, feat `e4288b2`
2. **Task 2: Deterministic glyph packers and the frame fit** - test `6b48819`, feat `bd9ebb0`
3. **Task 3: ringLayout with nesting, packing, capsules, frame and sizes** - test `635d68f`, feat `2822b86`

_Tasks 1 and 2 were executed in a prior session of this same plan; Task 3 (ring.ts + its sweep test) was executed in this session, verified against the already-committed Task 1/2 modules._

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `engine/layout/types.ts` - Layout/LayoutGroup/RegionLabel/PairGraphLayout/LayoutSpec/GateRoutes/CurrentRoutes/PairGraphRoutes/RouteOptions contracts, LAYOUT_IDS/PACKERS/CAPSULE_PLACEMENTS tuples
- `engine/layout/params.ts` - DEFAULT_LAYOUT_PARAMS (frozen) and resolveParams
- `engine/layout/format.ts` - fmt, QUANTUM, ceilQ, roundQ
- `engine/layout/pack.ts` - packSpiral (golden-angle first fit) and packShelf (row packing)
- `engine/layout/frame.ts` - fitFrame, applyFit, fitPoint
- `engine/layout/ring.ts` - chordRadius, ringNodes, torqueGlyphs, composeTorques, ringLayout
- `engine/test/layout.format.test.ts` - fmt/ceilQ/roundQ and default-params behaviour
- `engine/test/layout.pack.test.ts` - packer overlap/quantization/determinism, frame fit/cap behaviour
- `engine/test/layout.ring.test.ts` - LAY-01 sweep (every even base 2..400 plus 666/1024/4096, both packers) plus specific-base and determinism checks

## Decisions Made

- Packer default is `'spiral'` (D-03's locked wording); `'shelf'` (measured tighter/cheaper by research) stays selectable, to be shown on the 03-08 contact sheet for the user's sign-off.
- `composeTorques`'s nesting arithmetic deliberately reorders the research prototype's two passes (interpolate-to-chord-radius first, then an outward gap-enforcing pass from the innermost ring out) so both the chord-radius minimum and the `nestDelta * s` gap are guaranteed simultaneously for every k in {1, 2, 3} — the plan called this out explicitly as a fix of a research bug.
- The ring-layout sweep test uses squared-distance comparisons (no `sqrt`/`hypot`) for the O(n^2) minimum-inter-zone-spacing check so the n = 4096 case (about 8.4M pairs, doubled for two packers plus the 2..400 sweep) stays well under the plan's ~10 s budget; the suite runs in about 0.5 s.

## Deviations from Plan

None - plan executed exactly as written. One clarification made during implementation: the doc comment in `ring.ts` originally read "no Math.random, no Date," which the acceptance grep `Math\.random|new Date|Date\.now|Intl\.|toLocaleString` matched as a false positive against its own comment text; reworded to "no RNG calls, no wall-clock reads" (Rule 1 - trivial self-inflicted bug caught by the plan's own acceptance check, fixed before the Task 3 commit, not a separate commit).

## Issues Encountered

None. Both TDD cycles (Task 3's test then implementation) passed on the first implementation attempt; no debugging iteration was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/layout/types.ts`, `params.ts`, `format.ts`, `pack.ts`, `frame.ts` are the fixed contracts for every remaining plan in this phase (03-02 ladder layout, 03-03 spiral/pair-graph, 03-04+ routing, presets, the contact sheet and the ceiling spike).
- `ringLayout` is the default layout and is fully verified; no known gaps or stubs. `composeTorques`'s 'compact' `nestMode` branch and the `'above'` capsule placement are implemented and exercised by dedicated tests, though the sweep itself only exercises the default `nestMode: 'even'` and `capsulePlacement: 'beside'` (matching `DEFAULT_LAYOUT_PARAMS`) — later plans that expose these as user-facing options should add their own coverage if they change the defaults.
- No blockers for 03-02.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 9 created files verified present on disk; all 6 task commit hashes (17178d6, e4288b2, 6b48819, bd9ebb0, 635d68f, 2822b86) verified present in `git log`.
