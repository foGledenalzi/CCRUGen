---
phase: 06-canvas-tier-and-worker
plan: 05
subsystem: canvas
tags: [view-transform, picking, zone-grid, fit-relative-zoom, backing-store, hit-testing, typescript, vitest, fast-check]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-01's LABEL_MIN_RADIUS_PX and CANVAS_AREA_LIMIT_PX (read from the tier table) and 06-02's CanvasScene pick data (edgeSegStart, edgeBox, pickSegments, px, py, pillWidth, pillHeight, parseRouteCurve, flattenQuad, PICK_FLATTEN_STEPS)
  - phase: 05-demons-layer
    provides: the demonMatrix transform conventions (zero-safety, non-finite fallback, zoom-about-point, ensure-visible) and the cellAtPixel "one resolve path" contract
provides:
  - app/lib/canvas/viewTransform.ts, the pure Canvas transform (fitScale, scaleOf, onScreenRadius, zoomMax, toScreen, toWorld, clampTransform, zoomAt, panBy, fitZones, ensureVisible, canvasFootprint, backingStore) with fit-relative zoom
  - app/lib/canvas/pickIndex.ts, the pure geometric pick (PICK_RADIUS_PX, TIE_ORDER, buildZoneGrid, pickAt, zonesInWorldRect, distToSegment, distToStadium, flattenChords)
  - tests/app/canvasView.test.ts (54 tests) and tests/app/canvasPick.test.ts (59 tests), with an independent brute-force reference for the pick
affects: [06-08, 06-09, 06-10, 06-12, 06-13, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fit-relative zoom: s = min(W / width, H / height) x zoom, so any frame shape (the 19 x 4096 ladder) letterboxes at zoom 1 and the zoom ceiling is derived from the table's label threshold, not a literal"
    - "One resolve path for hover, click, tap and keyboard: pickAt over the zone grid, the scene's flattened edge segments, pair stadiums and flattened chords, in CSS px at any zoom"
    - "The caller owns the semantics of 'drawn' and 'muted' through a two-method PickFilter; the pick never knows about layers, isolate or mute"
    - "Property tests against an independent brute-force reference with its own distance formulas and a pinned spec radius, so changing PICK_RADIUS_PX cannot move the reference with it"
    - "Mutation-checked: 57 mutant runs over both modules, every survivor either became a test or is named as equivalent below"

key-files:
  created:
    - app/lib/canvas/viewTransform.ts
    - app/lib/canvas/pickIndex.ts
    - tests/app/canvasView.test.ts
    - tests/app/canvasPick.test.ts
  modified: []

key-decisions:
  - "Fit-relative zoom (research P8) supersedes the UI-SPEC scale rule as the plan's [default] says: zoom 1 is the whole frame letterboxed, zoom range 0.3 to max(5, 2 x threshold / fitted radius) capped at 100, the threshold read through LABEL_MIN_RADIUS_PX"
  - "The pan clamp is the plan's formula, limit = max(0, frame x s / 2 + window / 2 - 24): the frame always reaches at least 24 px into the window from every side (it may sit entirely inside the window while smaller than 24 px on screen); it is centred only when the window itself is under 48 px"
  - "pickAt derives a pill's two member zones as q and base - 1 - q (the engine's own pair id is the lower member and the pair sums to base - 1), because the scene carries no pair table; a test pins this against g.pair(q) at bases 2 to 4000"
  - "FlatChords also carries zoneA and zoneB (Int32Array per chord) so a chord whose end zone is muted is never a candidate (the plan's interface listed segments and chordStart only; muted elements must not be picked)"
  - "A non-finite pan delta returns the clamped input, never the identity (a stray NaN must not reset the user's view); a non-finite viewport counts as 0, so canvasFootprint answers 1 x 1 rather than a huge canvas (T-06-02)"
  - "buildZoneGrid bounds its cell count to 8 per zone (plus 64) by doubling the cell, so a zero or tiny node radius over a 4000-unit frame cannot allocate millions of cells"
  - "The edge-pick unit tests run on the ladder, not the ring: on the ring the two members of a pair sit next to each other (the syzygy is a 2 to 3 radius stub between two nodes), so no point can be 6 px from it and 20 px from every node; the ring is covered by the whole-pick brute-force properties"

patterns-established:
  - "Test a spatial index against a second implementation written from the definition (candidate list, radius cut, rank, id) with random points, scales, filters and chords, plus hand-made scenes for exact ties"
  - "When the pick has several candidate classes, test each class with a filter that leaves only that class, then test the mixture by brute-force equivalence"

requirements-completed: []  # REN-02 stays Pending: this plan ships only the pure transform and pick math; the draw module (06-08), the pointer and keyboard models (06-09) and the Canvas component (06-10) are what make the requirement true

# Metrics
duration: 25min
completed: 2026-10-08
---

# Phase 6 Plan 05: Canvas View Transform and Pick Index Summary

**A pure fit-relative Canvas transform (tall ladders letterbox, labels reachable by zoom at every Canvas base, a bounded DPR-3 backing store) and one nearest-wins 12 px pick over zones, edges, pair pills and demon chords that equals an independent brute force for random points, filters and chords.**

## Performance

- **Duration:** ~25 min (including three mutation rounds of 57 mutant runs)
- **Started:** 2026-10-08T19:19:00Z
- **Completed:** 2026-10-08T19:45:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits, plus one test-strengthening commit)
- **Files modified:** 4 (4 created)

## Accomplishments

- **Fit-relative transform.** `fitScale = min(W / width, H / height)` (0-safe, non-finite becomes 1e-12), `s = fitScale x zoom`, `screen = window / 2 + pan + (world - frame / 2) x s`. The 19 x 4096 ladder in a 580 x 700 window fits at exactly `700 / 4096`; a 1000 x 1000 frame in 580 x 580 at 0.58. `toWorld` inverts `toScreen` within 1e-9 for any transform and point (fast-check).
- **Zoom range from the table.** `zoomMax = min(100, max(5, 2 x LABEL_MIN_RADIUS_PX / fitted radius))`; a radius that is 0, negative or NaN gets the full 100, an infinite one gets the floor of 5. Checked on real scenes in the 580 x 704 footprint (viewport 1280 x 800), radius at the zoom ceiling:

  | n | ring | ladder | spiral | pair graph (radius = pill height / 2) |
  |---|------|--------|--------|------|
  | 202 | 24.8 px (zmax 5.0) | 14.0 (8.1) | 30.0 (5.0) | 21.3 (5.0) |
  | 666 | 14.0 (7.1) | 14.0 (26.6) | 16.9 (5.0) | 14.0 (7.1) |
  | 1024 | 14.0 (5.4) | 14.0 (40.8) | 14.0 (5.1) | 14.0 (5.8) |
  | 4000 | 14.0 (22.3) | **8.8 (100, cap binds)** | 14.0 (10.1) | 14.0 (23.5) |

  Every cell is at or above the 7 px label threshold, so labels are reachable by zoom everywhere. The one cell that does not reach twice the threshold is the ladder at n = 4000 (fitted radius 0.09 px, a hairline strip): there the cap of 100 binds and labels appear only from about 79x. 06-08 and 06-10 should treat that as the known worst case.
- **View operations.** `zoomAt` keeps the world point under the cursor fixed (within 1e-6) from the identity and from a panned, zoomed view, clamps into `[0.3, zoomMax]`, and returns the input unchanged for a factor that is not finite and positive. `clampTransform` falls back to the identity for any non-finite field and keeps at least 24 px of the frame reachable on each axis. `fitZones` frames a subset's bounding box plus two node radii (hand-computed: two zones at x 100 and 300, radius 10, in a 500 x 500 window give scale 500 / 240), and every chosen zone of the ring at 202 ends inside the window with its disc (fast-check over subsets). `ensureVisible` leaves a point 30 px inside untouched and otherwise pans the minimum so it sits exactly `24 + radius` inside.
- **Footprint and backing store.** `canvasFootprint` gives 580 x 580 for a square frame on a desktop, 359 wide at a 375 px viewport (375 - 16), 704 high for the ladder at an 800 px viewport (800 - 96), whole CSS px, never below 1, and 1 x 1 for a non-finite viewport. `backingStore(580, 580, 2)` is `{ 2, 1160, 1160 }`, DPR 5 becomes 3, NaN or 0 becomes 1, and the area is reduced under the injected limit, which defaults to `CANVAS_AREA_LIMIT_PX` from the table (a 30,000 x 30,000 window is reduced below it); the area, DPR and unreduced-ratio invariants hold for random sizes and limits (fast-check).
- **The pick.** `pickAt` collects candidates within 12 CSS px at any scale: zones through the uniform CSR grid (`max(0, distance x s - R x s)`, so a disc hit is 0), every drawn edge through its box reject and flattened segments, pair pills as stadiums (pill half-height as radius), and flattened demon chords. The nearest wins; equal distances resolve zone (pair ranks with it), syzygy, current, gate, chord, then the lower id. `TIE_ORDER` is the single source of the ranks.
- **Filters.** Muted zones are never returned and their edges are excluded through `edgeAllowed`; isolate-dimmed zones (allowed) still pick; a gate is a candidate only when `edgeAllowed('gate', z)` says it is drawn (so a hovered zone's on-demand gate is pickable at n = 4000 while ambient gates are not); a pill needs both member zones allowed; a chord needs both end zones allowed.
- **Equal to brute force.** The grid zone pick equals a brute-force nearest search for random points at bases 202 and 666 and for random hand-made clouds at any offset, radius and scale; the whole pick (zones, edges, pills, chords, tie order, random filters) equals a brute-force pick written from the definition, on the ring at 202, the ladder at 666 and the pair graph at 202.
- **Cost guard.** 100 picks on the ladder at n = 4000 (about 80,000 segments) finish well inside a generous bound; a point outside every edge box never calls the filter.

## Task Commits

Each task followed RED then GREEN (every commit carries the Co-Authored-By trailer, checked with `git log -1 --format=%B`):

1. **Task 1: View transform, footprint and backing store**
   - `6830904` test(06-05): add failing tests for the canvas view transform
   - `2b5046c` feat(06-05): add the canvas view transform, footprint and backing store
   - `7570a39` test(06-05): anchor zoomAt from a panned and zoomed view (a mutation round found that the fixed-point property only started from the identity)
2. **Task 2: Pick index (zone grid, edges, pills, demon chords, rubber band)**
   - `e734538` test(06-05): add failing tests for the canvas pick index
   - `91f78b4` feat(06-05): add the canvas pick index (zone grid, edges, pills, chords)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`Cannot find module` for the new lib file). The Task 2 GREEN commit also carries the four tests added after the mutation round (below)._

## Files Created/Modified

- `app/lib/canvas/viewTransform.ts` - the constants (`ZOOM_MIN`, `ZOOM_MAX_CEILING`, `ZOOM_FLOOR_MAX`, `ZOOM_STEP`, `PAN_KEEP_PX`, `FOCUS_MARGIN_PX`, `DPR_MAX`, `NARROW_INSET_PX`, `HEIGHT_RESERVE_PX`) and the thirteen functions; imports only `tierBounds` and `viewLayouts` (for `DIAGRAM_CSS_WIDTH`)
- `app/lib/canvas/pickIndex.ts` - `PICK_RADIUS_PX`, `TIE_ORDER`, the grid, `pickAt`, `zonesInWorldRect`, the two distance functions and `flattenChords`; imports the engine barrel, `curveAway` and the `Demon` type
- `tests/app/canvasView.test.ts` - 54 tests: constants, fit, mapping round trip, zoom range and label reachability on real scenes, zoomAt anchor properties, clamp and pan properties, fitZones, ensureVisible, footprint, backing store
- `tests/app/canvasPick.test.ts` - 59 tests: constants, closed-form distances, the grid, zone pick at 5 / 11 / 13 px, edges on the ladder, filters, tie order on hand-made scenes, pills, chords, brute-force properties on the ring, ladder and pair graph, the rubber band, guards and a cost bound

## Decisions Made

See `key-decisions` above. The plan fixed the structure and formulas; the judgement calls were the chord end-zone arrays, the pill member rule, the non-finite policies, the bounded grid, and moving the edge-pick unit tests to the ladder.

## Mutation Check (plan requirement)

Scratch script outside the repo (`mutate.cjs`: apply a one-line mutant, run the test file, restore the original in a `finally`); the source was staged before the run, and `git diff --quiet app/lib/canvas/pickIndex.ts` exited 0 after every round.

| Mutant (required ones first) | Result | Killed by |
|------|--------|-----------|
| `PICK_RADIUS_PX` 12 to 14 | **killed** | the constant test, "a point 13 px from the nearest node surface ... picks nothing", the grid-versus-brute-force property |
| `TIE_ORDER` syzygy and current swapped | **killed** | the constant test, "syzygy beats current, gate and chord at equal distance", "at equal distance the lower id wins within a kind" |

Pick module, 37 distinct mutants in two rounds (40 runs; the three survivors of round 1 that pointed at gaps were re-run after their tests were added): 34 killed, 3 equivalent. The mutants (swap zone/syzygy, gate/chord, current/gate in `TIE_ORDER`; `<` for `<=` on the radius cut; higher id wins; no node radius in the zone metric; zone, edge, chord-end and pill-member filters removed; edge box without margin; grid query without the pick radius; pill member `base - q`; chord factor 0.2; stadium as a circle; segment distance unclamped; edge and chord distance not in CSS px; grid cell cap removed; cell 40 radii; `zonesInWorldRect` ignoring the filter or the corner order; row and column bounds using the wrong origin axis (four mutants); cell index with the wrong dimension; pill box and gate and current id offsets). The first round left four survivors; three pointed at real gaps and were closed with tests (then killed): `<` versus `<=` (exact 12 px boundary), pill rank (a pill must beat a chord at equal distance whatever the ids), and the row and column origin axes (clouds whose x and y ranges are far apart). The three final survivors are equivalent: removing the non-finite point guard (every later stage already returns no candidate for NaN or infinity), a pill box reject that uses the width for the half height (a looser reject only costs speed), and removing the `b >= known` range check in `flattenChords` (the next line's finite check rejects the same chord).

View module, 17 mutants (threshold not doubled, max for min in `fitScale`, pan limit without the keep margin, no zoom lower clamp, `zoomAt` ignoring the existing pan, `toWorld` pan sign, no area reduction, no DPR cap, no height reserve, `ensureVisible` ignoring the radius, `fitZones` padding of one radius, no narrow inset, no identity fallback, no zoom cap, no zoom floor, a non-finite pan resetting, area limit hard-coded instead of read from the table): 17 killed. The `zoomAt` mutant that ignored the existing pan survived the first version of the anchor property (it only started from the identity), which is what `7570a39` fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Muted chord ends were not representable in `FlatChords`**
- **Found during:** Task 2, designing the filter rule ("muted elements are never candidates")
- **Issue:** the plan's `FlatChords` is `{ segments, chordStart }`, which gives `pickAt` no way to know which zones a chord joins, so a chord whose end zone is muted (or hidden) could still be picked.
- **Fix:** `FlatChords` also carries `zoneA` and `zoneB` (one `Int32Array` entry per chord, `-1` for an invalid chord) and `pickAt` skips a chord unless both end zones are allowed. Additive: a caller that ignores the new fields compiles unchanged.
- **Files modified:** app/lib/canvas/pickIndex.ts, tests/app/canvasPick.test.ts (a muted-end test and a mutant for it)
- **Committed in:** 91f78b4

**2. [Rule 1 - Bug] The plan's behaviour line "the frame is centred when it is smaller than 24 px on screen" does not follow from its own pan formula**
- **Found during:** Task 1, writing the clamp test (a 10 x 10 frame in a 30 x 30 window at zoom 1 still pans by 6 px)
- **Issue:** with `limit = max(0, frame x s / 2 + window / 2 - 24)` a small frame may sit entirely inside a large window; it is centred only when `frame x s + window < 48`. The formula (the plan's explicit action) is what gives the useful guarantee: the frame always reaches at least 24 px into the window from every side.
- **Fix:** kept the formula, tested the guarantee it gives (fast-check over frames, windows, zooms and pans), and tested both the centred case (30 px window at zoom 0.3) and the pannable case (zoom 1) so the behaviour is explicit.
- **Files modified:** tests/app/canvasView.test.ts
- **Committed in:** 2b5046c

**3. [Rule 3 - Blocking test construction] The plan's syzygy example is impossible on the ring layout**
- **Found during:** Task 2, the first run of the edge tests
- **Issue:** "a point 6 px from a syzygy segment and 20 px from every node" needs a long syzygy. On the ring the two members of a pair sit next to each other (segment length 2.0 to 3.1 node radii at n = 202), so every point 6 px from a syzygy is within a few px of a node; with all edge kinds on, currents and gates also crowd every point.
- **Fix:** the edge-pick unit tests run on the ladder at n = 202 (syzygy rungs are 11.3 node radii) at 12 px per node, with a filter that leaves only the edge kind under test for the exact assertions; the ring (and the ladder at 666) are covered by the whole-pick brute-force properties with every edge kind on.
- **Files modified:** tests/app/canvasPick.test.ts
- **Committed in:** 91f78b4

### Judgement calls beyond the plan (no scope change)

- `panBy` with a non-finite delta returns the clamped input instead of the identity, so a stray NaN cannot reset the user's view; `zoomAt` with a non-finite cursor or transform falls through to the clamp.
- `canvasFootprint` computes the height from the floored width (keeping the aspect as close as whole pixels allow) and treats a non-finite viewport as 0, which yields 1 x 1.
- `backingStore` returns a 0 x 0 store for an invalid CSS size and falls back to the table limit for an invalid injected one.
- `buildZoneGrid` doubles its cell until the grid has at most 8 cells per zone (plus 64), and skips zones with a non-finite coordinate.

**Total deviations:** 3 documented (1 missing critical functionality, 1 plan-text inconsistency resolved in favour of the plan's formula, 1 impossible test geometry). **Impact on plan:** no scope change; the additive chord arrays make the "muted is never a candidate" rule true for chords, and the clamp and pick behave as specified.

## Issues Encountered

None beyond the deviations. The only test-writing surprises were geometric: the ring's pairs are adjacent (above), the ring-28 chord example needs a node radius of about 20 px on screen before any point is 30 px from every node, and a scale of 2 turns an exact 12 px boundary point from x = 14 into x = 8 (the 2-unit node radius is 4 px there). All were fixed in the tests, never by loosening the code.

## Verification

- `npx vitest run tests/app/canvasPick.test.ts tests/app/canvasView.test.ts --project oracle`: 113 passed (59 + 54), after RED runs of "no tests" for each file.
- `npm run typecheck` (4x tsc plus lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK, run after `git add` of the new files (the gate scans tracked files only); the full default `node scripts/check-repo.mjs` is OK too.
- `npm test` (UTC) and `npm run test:tz` (America/New_York): 80 files, 2123 tests passed in both timezones.
- Acceptance greps: `export const PICK_RADIUS_PX = 12` is on exactly 1 line; `LABEL_MIN_RADIUS_PX` is in `viewTransform.ts` (2) and the view test (6), `CANVAS_AREA_LIMIT_PX` in `viewTransform.ts` (3); `268435456` appears in neither file; the view test contains `4096` and `fc.`; the pick test contains `fc.assert` and the 5, 11 and 13 px cases.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing; no frozen file, `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**`, `useCanvasPan.ts` or `engine/` file was touched. The full `npm run verify` was not run: the plan adds two unimported pure modules and two test files (no e2e, build or page-weight surface), and the unit suites in both timezones are green.

## Known Stubs

None.

## Threat Flags

None. The plan's register is covered: T-06-02 (window-only store, DPR capped at 3 and reduced under the table's area limit, zoom clamped to `[0.3, 100]`, non-finite transforms fall back to the identity, a non-finite viewport gives 1 x 1) and T-06-19 (grid query plus per-edge box reject, a non-finite point returns null, a cost bound on the ladder at n = 4000).

## Next Phase Readiness

- **06-08 (draw) and 06-10 (component):** build the frame as `{ width: scene.width, height: scene.height, nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius }`; take the window from `canvasFootprint(frame, viewportW, viewportH)` and the store from `backingStore(cssWidth, cssHeight, devicePixelRatio)`; the scale for drawing and picking is `scaleOf(t, frame, w, h)`; level of detail uses `onScreenRadius` through `labelsShown`. The ladder at n = 4000 is the worst case for labels (see the table above).
- **06-09/06-10 (pointer and keyboard):** call `pickAt(scene, grid, wx, wy, scaleOf(...), filter, chords)` with `(wx, wy) = toWorld(...)`; the filter must say which edges are drawn (ambient layers plus the highlighted zone's own syzygy, current and gate) and exclude the edges and chords of muted zones; the rubber band is `zonesInWorldRect` over the world rectangle of the screen rectangle; the keyboard ring target is panned with `ensureVisible(t, x, y, radiusPx, ...)`; "fit selection" is `fitZones`. Build the grid once per scene with `buildZoneGrid(scene.x, scene.y, scene.nodeRadius)`.
- **Hit ids:** zone and pair hits carry the zone or pair id, syzygy and current hits the pair id (join to view entries through `g.pairOf`, never a view-array index), gate hits the origin zone, chord hits the index into the array given to `flattenChords`.
- **Chords:** `flattenChords` takes the same `Demon[]` and layout centre the SVG tier's focus view uses; rebuild it only when the focus set changes.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED
