---
phase: 03-procedural-layout-and-ceiling-spike
plan: 03
subsystem: engine-layout
tags: [typescript, layout, geometry, svg-paths, spiral, pair-graph, determinism]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike (plan 01)
    provides: "engine/layout contracts (Layout, LayoutGroup, PairGraphLayout, LayoutParams), resolveParams, fmt/ceilQ, fitFrame/applyFit/fitPoint, chordRadius/ringNodes/torqueGlyphs/composeTorques"
provides:
  - "engine/layout/ladder.ts: ladderDefaults/ladderLayout, the procedural ladder that reduces EXACTLY to the authored base-10 ladder (frame 800 x 870, centre 400,450)"
  - "engine/layout/spiral.ts: spiralDefaults/spiralLayout, the Barker spiral (every pair on one anticlockwise Archimedean spiral ordered by destination)"
  - "engine/layout/pairgraph.ts: PAIR_GRAPH_DEFAULTS, pairGraphLayout, routePairGraph, the syzygy-collapsed pair-graph view with anticlockwise current arcs and Plex/Warp self loops"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ladder/spiral/pairgraph reuse ring.ts's chordRadius/ringNodes/torqueGlyphs/composeTorques rather than re-deriving ring geometry (pairgraph passes unitsPerPair=1 so groups are indexed by pair id, not zone id)"
    - "no minimum-frame clamp in ladderLayout (unlike ringLayout/spiralLayout/pairGraphLayout, which all go through fitFrame): the only way to reduce EXACTLY to the authored base-10 numbers"
    - "regex-based SVG path parsing in tests (layout.pairgraph.test.ts) to recover arc/loop endpoints and check them against nearest-pair-centre, rather than re-deriving the trig by hand in the test"
    - "mismatch-collector sweep pattern (capped array of short strings, one expect per sweep) reused from layout.ring.test.ts for all three new sweeps"

key-files:
  created:
    - engine/layout/ladder.ts
    - engine/layout/spiral.ts
    - engine/layout/pairgraph.ts
    - engine/test/layout.ladder.test.ts
    - engine/test/layout.spiral.test.ts
    - engine/test/layout.pairgraph.test.ts
  modified: []

key-decisions:
  - "ladderLayout intentionally skips fitFrame/the minimum-frame clamp used by every other layout module: its own width/height formula (a.width; a.top + (P-1)*a.rowGap + a.bottom) is exact by construction and matches the frozen base-10 oracle bit-for-bit at k=1, which fitFrame's minWidth/minHeight floor would have broken for small bases."
  - "pairGraphLayout builds pair-indexed px/py arrays first (via the reused ring.ts primitives with unitsPerPair=1), then derives zone-indexed x/y by copying through g.pairOf(z) before calling fitFrame once on the zone arrays; the final (fitted) px/py are produced by applying the same fitPoint transform to the pre-fit pair arrays, which is provably identical to reading the fitted zone array at index q (zone q is always the lo/pair-id-equal member) - done this way for clarity over relying on that identity implicitly."
  - "routePairGraph's arc/loop path strings are built by literal string concatenation (not template interpolation helpers) so the required substrings (' 0 0 0 ' for current arcs, ' 0 1 0 ' for self loops) are trivially greppable, matching the plan's acceptance criteria verbatim."

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-09-27
---

# Phase 3 Plan 03: Procedural Ladder, Barker Spiral and Pair-Graph View Summary

**Three engine/layout modules on the shared Layout contract: `ladderLayout` (two columns, one row per pair, reduces EXACTLY to the authored base-10 ladder), `spiralLayout` (the Barker spiral, every pair on one anticlockwise Archimedean curve ordered by destination), and `pairGraphLayout`/`routePairGraph` (the syzygy-collapsed pair-graph view, every Torque cycle a clean ring of hi::lo pills with anticlockwise current arcs and Plex/Warp self loops) — each verified for every even base 2..400.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed (each a TDD RED/GREEN pair, 4 commits total)
- **Files modified:** 6 created (3 modules, 3 test files)

## Accomplishments

- `ladderLayout` (`engine/layout/ladder.ts`, D-04): pair `q` in row `base/2 - 1 - q` (pair 0 at the bottom, the highest pair on top), lo zone at `xLeft` (260), hi zone at `xRight` (540); row gap `max(params.s, min(175, round(1400 / (base/2))))` so base 10's 5 pairs give exactly 175 and the layout reduces bit-for-bit to `engine/test/fixtures/base10.golden.json`'s `layouts.ladder`/`center.ladder` (800 x 870, centre 400,450) with no minimum-frame clamp.
- `spiralLayout` (`engine/layout/spiral.ts`, D-04): walks pair `n/2 - 1` down to pair `0` (destination ascending), odd member then even member of each pair, along an Archimedean spiral (`rho = inner + b*theta`, arclength-normalized `theta` steps, `y = -rho*sin(theta)` for anticlockwise screen motion), then fit to the shared frame/cap.
- `pairGraphLayout`/`routePairGraph` (`engine/layout/pairgraph.ts`, D-08, LAY-04): one pill per pair labelled `hi::lo` (pill size derived from the widest own-base net-span string at that base), every Torque cycle drawn as a clean ring of pills by reusing `ring.ts`'s `torqueGlyphs`/`composeTorques`/`ringNodes` with one unit per pair (base 64: six rings; base 28: rings of 9 and 3 pairs); Plex and Warp are pills placed beside each other below the rings. `routePairGraph` draws an anticlockwise current arc (SVG flags `0 0 0`) from each pair's pill to `g.nextPair(q)`'s pill around their shared ring, and a self loop (flags `0 1 0`) for the fixed pairs (Plex, Warp).
- Verified by direct sweep over every even base 2..400 (not sampling) for all three layouts: partner y-sharing/column placement/monotonic rows/frame containment for the ladder; strictly-increasing centre distance and anticlockwise angle steps plus a 3x-node-radius minimum centre distance for the spiral; per-ring circle placement with node-0-at-top and uniform `2*pi/L` anticlockwise angle steps, current-arc endpoints nearest their originating/destination pair (T-03-08: a wrong flow direction cannot pass), no pill overlap, and frame containment for the pair graph.

## Task Commits

Each task was executed as a full TDD RED/GREEN cycle:

1. **Task 1: Procedural ladder (exact base-10 reduction) and Barker spiral**
   - `28c082b` (test) - add failing tests for the procedural ladder and Barker spiral (RED: `../layout/ladder` and `../layout/spiral` did not exist)
   - `77c45f6` (feat) - procedural ladder and Barker spiral layouts (GREEN: 8/8 tests pass on the first attempt)
2. **Task 2: Syzygy-collapsed pair-graph layout and its current arcs and self loops**
   - `ed3d265` (test) - add failing test for the syzygy-collapsed pair-graph view (RED: `../layout/pairgraph` did not exist)
   - `cf346a9` (feat) - procedural ladder, Barker spiral and pair-graph view (GREEN: 14/14 tests pass on the first attempt)

**Plan metadata:** (this commit) - docs: complete 03-03 plan

## Files Created/Modified

- `engine/layout/ladder.ts` - `LadderParams`, `ladderDefaults`, `ladderLayout`
- `engine/layout/spiral.ts` - `SpiralParams`, `spiralDefaults`, `spiralLayout`
- `engine/layout/pairgraph.ts` - `PAIR_GRAPH_DEFAULTS`, `pairGraphLayout`, `routePairGraph`
- `engine/test/layout.ladder.test.ts` - exact base-10 reduction (read-only against the frozen fixture) plus a sweep over every even base 2..400, specific-base checks (28, 100) and a determinism check
- `engine/test/layout.spiral.test.ts` - sweep over every even base 2..400, the base-10 innermost/outermost structure check and a determinism check
- `engine/test/layout.pairgraph.test.ts` - sweep over every even base 2..400 (LAY-04 truths plus `routePairGraph`), specific-base checks (64, 28, 2) and a determinism check

## Decisions Made

- Followed the plan's exact formulas verbatim (row gap clamp, spiral `theta`/`rho` recurrence, pill sizing from `maxChars`/`fontRatio`/`heightRatio`/`charWidth`/`padRatio`, ring spacing `sp`, capsule placement, arc/loop SVG path construction) — no formula deviations were needed; every sweep passed on the first implementation attempt.
- One TypeScript-only fix during Task 2 (`engine/test/layout.pairgraph.test.ts`): `routes.arc[q]` is typed `string | null | undefined` under the project's `noUncheckedIndexedAccess`, not just `string | null`, so a plain `d === null` narrowing left `d.includes(...)` possibly-undefined; changed to `const d = routes.arc[q] ?? null` before narrowing. Not a Rule 1-4 deviation in the behavioural sense — a type-narrowing correction caught by `npm run typecheck`, fixed inline before the Task 2 feat commit.

## Deviations from Plan

None - plan executed exactly as written, including every literal formula, string-concatenation format and file/export shape. The one typing fix above is the only change from a first-draft transcription of the plan's action text, and it is test-only (no production-code behavior changed).

## Issues Encountered

None. Both TDD cycles passed on the first GREEN attempt (all acceptance-criteria greps, `npm run typecheck`/lint, and both timezones passed without iteration). The `Math.round(1400 / (base / 2))` acceptance-criterion grep initially missed because the first draft computed `base / 2` into a local variable (`pairCount`) before rounding; inlined the expression to match the plan's literal acceptance text (functionally identical, a wording fix, not a logic fix).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ladderLayout`, `spiralLayout` and `pairGraphLayout`/`routePairGraph` are fully verified (every even base 2..400) and ready for the base-10 preset plan (03-05, which must reproduce the authored ladder's region labels/draw order — deliberately NOT attempted here per the plan's own scope note) and the routing/contact-sheet/spike plans (03-04, 03-06 through 03-10).
- LAY-01/LAY-03 continue to be covered by later plans in this phase (not fully complete after 03-01 + 03-03 alone); LAY-04 is also covered by 03-06 and 03-08 per the phase's plan-checker coverage table - none of the three are marked complete in `REQUIREMENTS.md` by this plan (see the traceability-table note below).
- No blockers for 03-04.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 6 created files verified present on disk; all 4 task commit hashes (28c082b, 77c45f6, ed3d265, cf346a9) verified present in `git log`.
