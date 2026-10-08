---
phase: 06-canvas-tier-and-worker
plan: 02
subsystem: engine
tags: [canvas, scene, typed-arrays, routes, picking, pair-graph, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: the zone layouts (ring, ladder, spiral), routeGates/routeCurrents, the pair-graph layout and routePairGraph, and svgString.ts's syzygy trimming
  - phase: 06-canvas-tier-and-worker
    provides: 06-01's shipped ceiling (interactiveMaxN), so a scene is only ever built up to the ceiling by the caller
provides:
  - engine/scene/canvasScene.ts, the pure typed-array CanvasScene (buildZoneScene, buildPairScene, parseRouteCurve, flattenQuad, edgeCount, EDGE_KIND, CURVE_STRIDE, PICK_FLATTEN_STEPS)
  - one curve of six numbers for every gate, current leg and current stem of a zone layout, equal to the engine's own route strings
  - syzygy segments with exactly the svgString.ts endpoint trimming
  - flattened pick segments (CSR over edges) with per-edge boxes for every syzygy, current and gate edge
  - the pair-graph scene (pill centres and size, arc and loop strings kept for drawing)
  - engine/test/scene.canvasScene.test.ts (40 tests)
affects: [06-04, 06-05, 06-07, 06-08, 06-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A renderer-neutral scene in the engine: typed arrays and numbers only (no DOM paths), so the worker builds it, transfers it, and the Phase 8 CLI can reuse it"
    - "Parse route text once, in one place, behind a whitelist and an exact grammar; downstream drawing and picking read numbers and skip NaN curves"
    - "Own-buffer discipline for transferables: every output array is a fresh allocation or a .slice() copy, proved with a Set over buffers and a whole-buffer check"
    - "Mutation-checked tests: 86 mutant runs over four rounds; every survivor that pointed at a real gap became a test (six gaps, one of them a real bug), the equivalent ones are named in the summary"

key-files:
  created:
    - engine/scene/canvasScene.ts
    - engine/test/scene.canvasScene.test.ts
  modified:
    - engine/scene/index.ts

key-decisions:
  - "Edge order in the CSR is syzygies 0..P-1, currents P..2P-1, gates 2P..2P+n-1, keyed by pair id and origin zone (never by a view-array index); a current edge carries up to 24 segments (legA, legB, stem at 8 each), a gate edge 8, a syzygy edge 1"
  - "flattenQuad checks for a NaN curve BEFORE its output bounds: a NaN curve reserves no pick space, so on the very last edge it sits past the end of the array and must still return 0 (found by mutation testing, fixed before the first commit of the implementation)"
  - "edgeCount(scene) is edgeSegStart.length - 1, which is 2P + n for zones (equal to the plan's formula 2 * (n / 2) + n) and 0 for the pair graph (Int32Array.of(0))"
  - "Both builders also validate the shapes they index (route array lengths, px/py/arc/loop lengths) with a RangeError, and buildPairScene refuses a non-pair layout, beyond the plan's list: a mismatched route array would otherwise silently become NaN curves"
  - "The base guard runs first, then the kind guard, then the length guard, so a layout of another base is always reported as a base mismatch"

patterns-established:
  - "Test the shared geometry against the other tier directly: the syzygy segments are compared with the lines layoutToSvg actually emits (rounded as the emitter rounds), not only with a copy of its formula"

requirements-completed: []  # REN-02 stays Pending: this plan ships only the pure scene; the worker (06-04/06-07), the draw module (06-08) and the Canvas component (06-10) are what make the requirement true

# Metrics
duration: 26min
completed: 2026-10-08
---

# Phase 6 Plan 02: Engine Canvas Scene Summary

**A pure typed-array CanvasScene in the engine: every gate, current leg and stem of a ring, ladder or spiral becomes one six-number curve equal to the engine's own route string, syzygies reuse svgString's exact trimming, flattened pick segments with per-edge boxes make every edge hit-testable, and the pair graph keeps its arc strings and pill geometry, all on separate transferable buffers at bases 2..64, 202, 666, 1024 and 4000.**

## Performance

- **Duration:** ~26 min (including a 5 min full gate and three mutation rounds)
- **Started:** 2026-10-08T18:05:00Z
- **Completed:** 2026-10-08T18:31:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `engine/scene/canvasScene.ts` (422 lines, relative imports only, no DOM text anywhere in the file) builds a `CanvasScene` from a numogram, a layout and the engine's own routes. `parseRouteCurve` is the only reader of route text: a character whitelist plus exactly `M x y L x y` (stored with its midpoint as the control) or `M x y Q cx cy x y`; `''` becomes six NaN, anything else (a cubic, an arc, a stray token, a wrong count, an overflow to Infinity) throws a `RangeError` naming the string (T-06-15).
- Zone layouts: `x`, `y`, `drawOrder` copied; `syzygySeg` (4 per pair) trimmed exactly as `svgString.ts` trims, per-node radii and the `dist <= 2r` centre-to-centre case included and compared with the lines `layoutToSvg` actually emits; `currentCurves` (18 per pair: legA, legB, stem) and `gateCurves` (6 per zone) whose endpoints equal the numbers in the engine's route strings (control point equal to the printed one, or the midpoint for an `L`); kind, junction, loop, to and label arrays mirrored; `currentTo[q] === g.current(q).to`.
- Pick data: edges in the order syzygies, currents, gates; one CSR `edgeSegStart`, `pickSegments` (4 numbers per segment, 8 chords per non-NaN curve through `flattenQuad` on the Bezier formula, shared joints exact) and `edgeBox` (min/max over the edge's segment endpoints, four NaN for an edge with no segments). At n = 4000 on the ladder this is about 82,000 segments (2.6 MB), one allocation.
- Pair graph: `buildPairScene` copies `x`, `y`, `drawOrder`, `px`, `py`, the pill size and the frame, keeps the engine's `arc`/`loop` path strings (SVG `A` arcs, drawn from the strings; only pills are pickable), and returns fresh zero-length arrays for everything zone-only with `edgeSegStart = Int32Array.of(0)`.
- Transfer safety (T-06-13): all 17 typed arrays of a zone scene (19 of a pair scene, the empty ones included) own a whole buffer of their own, none shares a buffer with the layout or the routes; proven with `new Set(buffers)` plus a "whole buffer, offset 0" check over every case.
- Guards: both builders throw `RangeError('canvasScene: layout base ... does not match numogram base ...')` first; `buildZoneScene` refuses a pair-graph layout, `buildPairScene` a non-pair layout, and both refuse routes of the wrong length.

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer):

1. **Task 1: Zone-layout scene (coordinates, syzygy segments, curves, gates) and the route parser**
   - `a1adff7` test(06-02): add failing tests for the zone-layout canvas scene
   - `8283b02` feat(06-02): build the zone-layout canvas scene from the engine's own routes
2. **Task 2: Pair-graph scene and the engine guard**
   - `2f322a3` test(06-02): add failing tests for the pair-graph canvas scene and the builder guards
   - `38d0209` feat(06-02): build the pair-graph canvas scene and guard both builders

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`Cannot find module '../scene/canvasScene'`; then `buildPairScene is not a function` and the missing guards) before their GREEN commits. The Task 1 GREEN commit also carries the test additions made after the first mutation round (see below); the Task 2 GREEN commit carries two more pair-scene length tests._

## Files Created/Modified

- `engine/scene/canvasScene.ts` - the `CanvasScene` type, `parseRouteCurve`, `flattenQuad`, `edgeCount`, `buildZoneScene`, `buildPairScene`, the pick-data builder and the constants
- `engine/scene/index.ts` - barrel exports (values and the `CanvasScene`/`SceneKind` types separately), reaching the app through `engine/index.ts`
- `engine/test/scene.canvasScene.test.ts` - 40 tests: parser grammar and rejection, flattening, a 2..64 x ring/ladder/spiral sweep plus 202, 666, 1024 and 4000 (ring, and all three at 4000), the pair-graph sweep over the same bases, determinism, buffer distinctness, guards

## Decisions Made

See `key-decisions` above. In short: CSR edge order and identity by pair id and origin zone; NaN is checked before bounds in `flattenQuad`; `edgeCount` comes from the CSR length; extra shape validation beyond the plan's list; base guard first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] flattenQuad threw on a NaN curve placed on the last edge**
- **Found during:** Task 1, mutation round 1 (the "route length guard removed" mutant survived because a test passed for the wrong reason)
- **Issue:** `flattenQuad` validated its output bounds before checking for a NaN curve. A NaN curve reserves no pick space, so on the final edge its `outOffset` sits at the end of `pickSegments` and the bounds check threw a `RangeError`, instead of returning 0 as the plan specifies ("returns 0 when curves[offset] is NaN"). An empty route string on the last gate (or the last pair's currents) would have made `buildZoneScene` throw.
- **Fix:** NaN check first, bounds check second. New tests: a NaN curve returns 0 with a zero-length output, an empty string on the very last edge builds (and the whole tail of the CSR may be empty), and the exact output bound (4 x steps fits, one fewer or a shifted start throws).
- **Files modified:** engine/scene/canvasScene.ts, engine/test/scene.canvasScene.test.ts
- **Verification:** `npx vitest run engine/test/scene.canvasScene.test.ts --project engine` 40/40; the "bounds before NaN" mutant is killed
- **Committed in:** 8283b02 (found before the implementation was first committed, so the fix is part of it)

**2. [Rule 2 - Missing critical functionality] Shape validation beyond the plan's guard list**
- **Found during:** Task 1 and Task 2 implementation
- **Issue:** the plan guards the layout base and the layout kind, but a route array shorter than the numogram would silently become NaN curves (`?? ''`), and a pair layout whose `px`/`py` or `arc`/`loop` lengths disagree with the pair count would read past its arrays. The worker (06-04) is a trust boundary for exactly these inputs.
- **Fix:** both builders throw a `RangeError` for route arrays whose length is not the zone count (gates) or the pair count (legA, legB, stem, arc, loop, px, py); `buildPairScene` also refuses a layout with no `px`/`py`. Each condition has its own test and mutant.
- **Files modified:** engine/scene/canvasScene.ts, engine/test/scene.canvasScene.test.ts
- **Committed in:** 8283b02 and 38d0209

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical validation). **Impact on plan:** no scope change; the bug fix makes the specified NaN behaviour true on every edge, the validation only rejects inputs that were already invalid.

## Issues Encountered

None beyond the deviation above. Mutation testing (86 mutant runs over four rounds with a scratch script outside the repo, source restored after every run, `git status` clean afterwards) found survivors that pointed at six real test gaps, all closed with new tests: per-node radii and the `dist <= 2r` threshold in the syzygy test (the first sweep had uniform radii and no pair between r and 2r apart), the `NaN` on the last edge bug above, the route-length guards of legA and legB, the exact flatten output bound and a negative offset, the "must start with M" rule, and the pair `px` length guard. Three survivors were equivalent: the command-letter check in the number loop was redundant (a letter is non-finite there) and was removed; removing the `ROUTE_SAFE` whitelist survives because the tokenizer already rejects every character the whitelist rejects (the whitelist stays: the plan specifies it as defence in depth); raising `MAX_ROUTE_TOKENS` by one survives because the token cap only bounds work and the count check rejects the same strings.

## Verification

- `npx vitest run engine/test/scene.canvasScene.test.ts --project engine`: 40 passed (after RED runs of 0 collected and 9 failed).
- `npm run typecheck` (4x tsc plus the engine purity lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- Acceptance greps: `export function buildZoneScene`, `parseRouteCurve` and `buildPairScene` each 1 in `canvasScene.ts`; `buildPairScene` on 1 line of `engine/scene/index.ts`; the forbidden-token grep (`from 'engine|app|react`, `Path2D`, `window`, `document`) returns nothing; the test file contains `4000`, `666`, `1024` and `new Set(`.
- `git status --porcelain engine/test/fixtures engine/test/layout.digest.test.ts e2e/__golden__ e2e/__behaviour__` printed nothing (no frozen file touched; the layout digests are unchanged).
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 75 test files and 1897 unit tests (1857 + 40 new) in both timezones, sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update: the scene is not imported by the viewer yet and the barrel is tree-shaken), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo OK including clean-tree and static-out.

## Known Stubs

None.

## Threat Flags

None. The only new trust boundary is the one the plan's register already covers: `parseRouteCurve` as the sole reader of route text (T-06-15, mitigated: whitelist, exact grammar, RangeError, NaN for empty), the scene arrays as transferables (T-06-13, mitigated: own buffers, tested with a `Set` over buffers) and scene size (T-06-16, accepted: O(n), about 100k numbers at n = 4000; callers build a scene only up to the shipped ceiling).

## Next Phase Readiness

- 06-04 (worker contract and `buildResult`) can call `resolveLayout` / `pairGraphLayout`, `routeGates` / `routeCurrents` / `routePairGraph` and then `buildZoneScene` / `buildPairScene`, listing each typed array's `.buffer` in the transfer list exactly once (`Object.values(scene).filter(ArrayBuffer.isView)`; 17 arrays for zones, 19 for pairs). It must build a scene only when `base <= interactiveMaxN` (T-06-16) and keep `buildZoneScene` away from pair-graph layouts.
- 06-08 and 06-10 draw from `syzygySeg`, `currentCurves` and `gateCurves` (moveTo / quadraticCurveTo, NaN curves skipped) and pick through `edgeSegStart`, `pickSegments` and `edgeBox`; pair-graph arcs and loops are drawn from `pairArc` / `pairLoop` strings (not pickable), pills are picked from `px`, `py`, `pillWidth`, `pillHeight`. Gate edges are pickable only when drawn (the on-demand gate of a hovered zone), as RESEARCH Pattern 6 says.
- `edgeBox` and `pickSegments` are in world units; the transform from 06-05 maps them to screen pixels.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED
