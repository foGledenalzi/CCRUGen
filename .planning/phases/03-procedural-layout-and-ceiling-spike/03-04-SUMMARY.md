---
phase: 03-procedural-layout-and-ceiling-spike
plan: 04
subsystem: engine-layout
tags: [typescript, layout, geometry, svg-coordinates, routing]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: "03-01: engine/layout/types.ts (Layout, LayoutGroup, GateRoutes, CurrentRoutes, RouteOptions contracts) and ringLayout"
provides:
  - "engine/layout/routing.ts: routeGates (every zone's gate, Gt-00 included, lanes for shared destinations, deterministic self loops) and routeCurrents (every pair's current, Y for Torque pairs or a fixed-pair triangle for Plex/Warp) as pure numeric-id functions of (Numogram, Layout)"
affects: [03-05, 03-06, 03-07, 03-08, 03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sideOf(dot): a single discrete-sign helper (|dot| <= 1e-9 resolves to +1) used everywhere a routing decision depends on a float dot product, so no tie ever depends on the last bit of a trig function"
    - "detection by structure, not identity: a fixed-pair current is 'destination is a member of the pair' (D === A || D === B), never a name check against 'Plex'/'Warp'"
    - "RouteOptions.orientation as a reusable per-index Int8Array (0 = geometric sign, +-1 = forced) so a future layout-switch tween can hold a route's bulge/junction side steady across two layouts (D-09) without a ref"

key-files:
  created:
    - engine/layout/routing.ts
    - engine/test/layout.routing.test.ts
  modified: []

key-decisions:
  - "routeGates never emits an 'L' path (always 'M...Q...', even when the bulge would be small), so its shape is simpler than the private quad() helper used inside routeCurrents; both are exercised by a generic endpoints() parser in the test that reads the first/last coordinate pair regardless of path command"
  - "The Y-current's per-pair 'centre' used for bend/junction-side decisions is that pair's own group centre (its Torque ring's cx/cy via centreOf), not a single global diagram centre — a deliberate generalisation beyond the base-10 viewer, which only ever had one ring and one global ctr"
  - "The fixed-pair leg/stem sign (s2) is computed independently of the junction-side sign (side) from its own local dot product against the pair's centre, rather than reusing a cached orientation the way the viewer's resolveCurrentOrientation ref does — required by the plan's 'no refs' rule and by D-09's explicit per-call orientation array"

requirements-completed: [LAY-01, LAY-03]

# Metrics
duration: 5min
completed: 2026-09-27
---

# Phase 3 Plan 4: Pure Gate and Current Routing Summary

**`engine/layout/routing.ts`: `routeGates` and `routeCurrents`, pure O(n) numeric-id functions of `(Numogram, Layout)` that generalise the base-10 viewer's name-keyed gate/current memos and 72-sample angular self-loop search to any even base and any procedural layout, verified against every even base 2..200 on `ringLayout`.**

## Performance

- **Duration:** 5 min (git commit span 14:25:04-14:30:21, local -06:00; Task 1 RED->GREEN 14:25:04-14:28:00, Task 2 RED->GREEN 14:28:55-14:30:21)
- **Started:** 2026-09-27T14:25:04-06:00
- **Completed:** 2026-09-27T14:30:21-06:00
- **Tasks:** 2 completed
- **Files modified:** 2 created (1 module, 1 test file)

## Accomplishments

- `routeGates(g, layout, opts?)`: every zone gets a gate path (Gt-00 included and drawn, the Phase 2 draw/omit policy), keyed only by `g.gate(z).to`. Non-self gates bend away from the layout centre with a `0.18 * distance` concave bulge, offset into lanes (`lane * 10 * k`) when multiple gates share a destination, ordered by ascending origin zone with no sort. Self gates loop deterministically: radially outward (`3.1 * nodeRadius` reach) on a ring node, straight down on a capsule node — replacing the viewer's 72-sample angular argmax clearance search with an O(1) formula.
- `routeCurrents(g, layout, opts?)`: every pair's current is either a Y (junction `0.35` of the way to the destination plus `0.52 * nodeRadius` perpendicular offset toward the pair's ring centre, stem landing `nodeRadius` short of `g.current(q).to`) or a fixed-pair triangle (junction at the equilateral centroid, `sqrt(3)/6 * dist` from the pair midpoint) for Plex and Warp — detected only by "the destination is a member of the pair" (`D === A || D === B`), never by name. Base 10's Plex current lands on zone 9 (the engine convention), matching the plan's explicit correction of the viewer's own "drawn to zone 0" legacy convention (which stays put in `app/presets/base10/currents.ts`, untouched).
- Both functions accept an optional `RouteOptions.orientation: Int8Array` (0 = geometric sign, +-1 = forced) so a future layout-switch tween can hold a route's bulge or junction side steady across two layouts (D-09) — verified by two dedicated override tests.
- Verified by direct sweep (not sampling) over every even base 2..200 on `ringLayout`: gate endpoint distances, self-loop reach and direction (radial on a ring, straight-down on a capsule), lane separation for shared destinations, current `kind` classification, leg start points, Y-current junction offset and stem endpoint, and the "next pair's odd zone" identity for every Torque current — plus a dedicated Plex-lands-on-`n-1` check at bases 10, 28 and 64, orientation-override checks, and determinism checks (identical arrays on a second call). No path string in any of it ever contains `NaN`, `Infinity` or `undefined` (`fmt` throws first).

## Task Commits

Each task was committed as a TDD RED/GREEN pair:

1. **Task 1: Gate routing (concave curves, lanes, deterministic self loops)** - test `b8e5d33`, feat `04d0e00`
2. **Task 2: Current routing (Y junction and fixed-pair triangle)** - test `3bf4d7a`, feat `1dce3ab`

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `engine/layout/routing.ts` - `sideOf`, `pt`, `quad`, `curveAway`, `groupOf`, `centreOf` (private), `routeGates`, `routeCurrents` (exported)
- `engine/test/layout.routing.test.ts` - gate and current mismatch-collector sweeps over every even base 2..200, Plex-convention checks, orientation-override checks, determinism checks

## Decisions Made

- `routeGates`'s self/non-self gate paths are built directly as `'M...Q...'` (never through the private `quad()` helper's `|bulge| < 0.5` shortcut), so a gate's `d` string always has exactly 6 numbers; `routeCurrents`'s fixed-pair leg/stem does go through `quad()` and can legitimately be a straight `'L'` line when the computed bulge is small. The test's `endpoints()` parser reads only the first and last coordinate pair via a generic number regex so it doesn't care which command was used.
- `centreOf(layout, z)` returns the zone's own ring group centre when it belongs to a `'ring'` glyph, else the layout's global centre — used for every "which side does this bend toward" decision in both functions. This is a genuine generalisation beyond the base-10 viewer (which always had exactly one Torque ring and used a single global `ctr` everywhere); multi-ring bases (28, 82, 64, ...) get gates and currents that bend relative to their own ring, not the whole diagram's bounding box.
- All ambiguous-sign dot-product decisions (gate bulge side, fixed-pair junction side, fixed-pair leg/stem sign, Y-current junction side) go through one `sideOf(dot)` helper implementing the project's `|dot| <= 1e-9` counts-as-positive convention (CLAUDE.md), rather than each site rolling its own threshold — a plan-driven consistency choice since the plan's pseudocode gave this convention explicitly for two of the four sites and left the other two as "sign of ..." without a stated epsilon.

## Deviations from Plan

None - plan executed exactly as written. The plan's action text was pseudocode using implicit point/vector notation (e.g. "`M = (A + B) / 2`" where A, B are zone ids); this was implemented as the coordinate midpoint of the two zones' layout positions, the only sensible reading, and confirmed correct by every sweep and targeted test passing on the first implementation attempt for both tasks.

## Issues Encountered

None. Both TDD cycles (Task 1: gate routing, Task 2: current routing) went RED (confirmed by physically removing/omitting the not-yet-written implementation and by extending the test file to reference `routeCurrents` before it existed) then GREEN on the first implementation attempt; no debugging iteration was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `routeGates` and `routeCurrents` are the routing primitives every later plan in this phase needs: 03-05 (scene assembly / SVG emitter), 03-06 (base-10 presets reproducing the frozen goldens through the new routing where applicable), 03-07 (layout switching / tween), 03-08 (contact-sheet sign-off), 03-09/03-10 (the ceiling spike's real routes).
- No known gaps or stubs. `RouteOptions.orientation` is implemented and tested but not yet consumed by a tween (that lands in a later plan per the roadmap's wave ordering); this is expected, not a deferred item.
- No blockers for 03-05.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*
