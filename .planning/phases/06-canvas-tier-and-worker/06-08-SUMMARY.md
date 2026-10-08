---
phase: 06-canvas-tier-and-worker
plan: 08
subsystem: canvas
tags: [canvas, drawing, overlay, level-of-detail, fidelity-downgrade, recording-context, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-02's CanvasScene (curves, syzygy segments, edge boxes, pair-graph strings), 06-03's RingTarget, 06-05's fit-relative view transform (toScreen, scaleOf, onScreenRadius) and 06-01's label threshold behind labelsShown
  - phase: 05-demons-layer
    provides: KIND_COLOR and the focus-chord route (curveAway, factor 0.25)
provides:
  - app/lib/canvas/draw.ts, the Canvas drawing module (static layers, overlay, scene index, layer opacity table, fidelity switch) against an injected 2D context and Path2D factory
  - EDGE_LAYER_ALPHA and edgeLayerOpacity, so context dimming is a layer CSS opacity and never a repaint
  - drawOverlay returning { highlightedEdges, fidelity, chords } for the data attributes (06-10) and the perf log (06-12)
  - tests/app/canvasDraw.test.ts, 123 recording-context tests with a mutation-checked rule set
affects: [06-10, 06-11, 06-12, 06-13, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draw functions are pure scene+state -> calls against an injected context and Path2D factory, so every parity rule is a recorded-call test (a Proxy recorder with path records, style snapshots at stroke/fill/text time and a NaN scan), no canvas package and no jsdom"
    - "Static edge layers paint at alpha 1 and the layer's CSS opacity carries the table value; isolate-dimmed edges paint at context over ambient; highlighted and on-demand edges live on the overlay (research A3)"
    - "Per-style batching: one Path2D per colour and alpha tier, so stroke() counts are small constants (select-all at base 4000 is 11 strokes, the pair graph 4) and a hover touches a few dozen calls"
    - "Level of detail only through labelsShown(on-screen radius); the pair graph uses the pill half height as the radius"
    - "Mutation-checked: 134 one-line mutants, 16 initial survivors each became a test (floors hide widths at fit, so width rules are asserted again zoomed in), all 134 killed"

key-files:
  created:
    - app/lib/canvas/draw.ts
    - tests/app/canvasDraw.test.ts
  modified: []

key-decisions:
  - "Context dimming is the edge layer's CSS opacity (edgeLayerOpacity: syzygy 0.5/0.1, current 0.6/0.08, gate 0.5/0.08, x0.5 thin); edges paint at alpha 1, isolate-dimmed ones at context over ambient (0.2, 0.0833.., 0.16); the overlay never reads anyFocus (a test proves identical output either way)"
  - "On-demand edges respect the Layers toggles (a switched-off layer draws nothing, not even on demand) and override only the density rule: the hovered zone's own gate draws at any gate mode, the gates that END in it only when the mode is not 'off'; the keyboard ring's own edge is always part of the highlighted set so it is drawn exactly once, after its #10ff50 underlay"
  - "Fidelity downgrade at HIGHLIGHT_FULL_FIDELITY_MAX = 400 highlighted edges (a syzygy, current or gate counts once): above it one plain batched stroke per kind and style (syzygy dotted 2 px, current legs and stems, gates dashed 5/3 and 3/2) at the highlighted alpha, no dots, arrowheads, junction circles, underlays or edge text; the report carries { highlightedEdges, fidelity, chords }"
  - "Canvas simplifications as planned: ambient syzygy is a dotted round-cap line (dash [0.1, 3 k s], 1.5 px), ambient current arrowheads only for stems of at least 24 CSS px and junction circles only at label level of detail, and partial-selection gradients are not reproduced (UI-SPEC Decisions Made Here item 7, listed for 06-15)"
  - "Pair-graph arrowheads come from parseArcEnd, a small parser of the engine's own single-arc route string (endpoint-to-centre conversion, tangent by sweep, extent for the ambient 24 px rule); the stroke itself stays new Path2D(d) batched with addPath and a world-to-CSS matrix"

patterns-established:
  - "Assert floored widths twice: at fit (the 1 px floor binds) and zoomed in with centerOn (the formula binds), otherwise a constant change hides behind the floor"
  - "Build real engine scenes once per (base, layout) in the test, derive every expectation from the scene and the transform in the test file, never from draw.ts constants"

requirements-completed: []  # REN-02 stays Pending: this plan ships only the drawing module; the Canvas component (06-10), the viewer integration (06-11) and the e2e specs (06-12 to 06-14) make the requirement true

# Metrics
duration: ~36min
completed: 2026-10-08
---

# Phase 6 Plan 08: Canvas Drawing Module Summary

**A pure Canvas drawing module with the SVG tier's palette, widths with 1 px floors, opacity table, dashes and label level of detail through labelsShown, for ring, ladder, spiral and the pair graph; edges drawn on demand by an interaction overlay that never touches the static layers and downgrades to bounded plain strokes above 400 highlighted edges, verified with a recording 2D context (123 tests, 134 of 134 mutants killed).**

## Performance

- **Duration:** ~36 min (including a 15 min mutation run)
- **Started:** 2026-10-08T22:33:00Z
- **Completed:** 2026-10-08T23:09:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments

- `app/lib/canvas/draw.ts` (1791 lines, imports only the engine barrel, app libs and the 06-05 transform) exports `EDGE_LAYER_ALPHA`, `HIGHLIGHT_FULL_FIDELITY_MAX` (400), `CAPTION_MIN_PX` (6), `NODE_MIN_RADIUS_PX` (1.5), `STROKE_MIN_PX`, `AMBIENT_ARROW_MIN_PX`, `PALETTE`, `edgeLayerOpacity`, `buildSceneIndex`, `drawSyzygyLayer`, `drawCurrentLayer`, `drawGateLayer`, `drawNodeLayer`, `drawOverlay`, `parseArcEnd` and the types. Every layer begins with `setTransform(dpr)` and a transparent `clearRect` (no background fill, no blur).
- **Static layers.** Syzygies are one dotted round-cap batch per alpha tier (`setLineDash [0.1, 3 k s]`, 1.5 px, `#e8e8e8`); currents draw legs at 0.7 width and alpha, the white junction disc with its green rim (label level of detail only) and the stem with a 9 x 7 arrowhead only when at least 24 CSS px long; gates follow `gateMode` (dashed 5/3 ss s single, 3/2 loop, `#cc44ff`, 'off' or Time Circuit only clears); nodes are discs at `max(R_px, 1.5)` with `${c}18` fill and `${c}44` stroke below the label threshold and, at or above it, the full SVG node (triangle at 0.2, bold monospace label, optional xenotation, region dot placed as the SVG's `regionDotY`). Region captions draw from 6 CSS px. Muted zones never draw, isolate-dimmed ones draw at 0.2, zones and edges outside the window are culled through the scene's edge boxes.
- **Pair graph.** Arcs and self loops go through `pathFromSvg(d)` batched with `addPath` and a world-to-CSS matrix (always drawn, as in the SVG pair graph), with arrowheads from `parseArcEnd`; pills are stadiums (fill 0.12, stroke 0.6, `max(1, 0.9 ss s)`), labelled `hi::lo` at label level of detail with the pill half height as the radius.
- **Overlay.** `drawOverlay` draws the Time Circuit (`#00ccff`, 1.5 ss s, 0.6, static), the focus-ring edge underlay, the highlighted edges, highlighted and selected zones (stroke 1.2 / 1.6 ss s, outer ring at `R + 7 k` alpha 0.3, label in the full colour, triangle 0.5, xenotation 0.82), demon focus chords (kind colour, 1.2 ss s, 0.75 or 0.15 when isolate-dimmed, the SVG's `curveAway` route) and the keyboard focus ring last (`#10ff50`, 2 px, `max(R_px + 3, 6)`; pair pills get a stadium with a 3 px gap). D-04 holds: a hovered zone at base 202 with the gate mode off draws its syzygy, current, incoming currents and own gate.
- **Fidelity.** Up to 400 highlighted edges the overlay draws graded dots (3 to 10, radius `(1 + 1.5 t) k s` with a 0.75 px floor), legs plus junction circle and arrowhead, dashed gates with an 8 x 6 arrowhead, a glow-substitute underlay (2 px wider at a quarter of the opacity) and edge text at label level of detail; above it, plain batched strokes. Select-all at base 4000 reports 8000 edges, `fidelity: 'plain'` and 11 `stroke()` calls (bound 16; the pair graph needs 4); a single hover at base 4000 records 21 context calls and 58 path operations.
- `tests/app/canvasDraw.test.ts` (2274 lines, 123 tests) uses a Proxy recording context with path records and style snapshots, real engine scenes at bases 2, 4, 6, 28, 202 and 4000 (ring), 28 (ladder, spiral) and the pair graph at 28, 202 and 4000, and a NaN scan over every recorded number for the static layers and the overlay (fit, zoomed, with isolate, mute and Time Circuit states).

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer, checked with `git log -1 --format=%B`):

1. **Task 1: Static layers (syzygy, current, gate, node, pair) with level of detail and culling**
   - `a91ea82` test(06-08): add failing tests for the canvas static layers
   - `97be1e0` feat(06-08): add the canvas static layers (syzygy, current, gate, node, pair)
2. **Task 2: Overlay (on-demand edges, highlights, selection, focus chords, Time Circuit, focus ring, fidelity downgrade)**
   - `f208b20` test(06-08): add failing tests for the canvas overlay
   - `9300972` feat(06-08): add the canvas overlay (on-demand edges, highlights, focus chords, ring, fidelity switch)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`Cannot find module '../../app/lib/canvas/draw'`; then `drawOverlay is not a function` for 47 tests while the 64 Task 1 tests stayed green). The Task 2 GREEN commit also carries the tests added after the mutation round (below)._

## Files Created/Modified

- `app/lib/canvas/draw.ts` - the drawing module: types (`Ctx2D`, `DrawEnv`, `DrawState`, `SceneIndex`, `OverlayState`, `OverlayReport`), the named constants, `buildSceneIndex`, the four static layer functions, `drawOverlay` and `parseArcEnd`
- `tests/app/canvasDraw.test.ts` - recording context, fixtures, 123 tests

## Decisions Made

See `key-decisions` above. The plan fixed the structure and numbers; the judgement calls were the SceneIndex extras, the ring edge joining the highlighted set, plain-mode styles, pair-graph arrowheads, and the deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The selected-zone outer ring needs a visible gap at tiny sizes**
- **Found during:** Task 2, writing the selection test at base 4000
- **Issue:** the SVG ring is `r + 7 k`; at base 4000 fit `k s` is 0.03 px, so the ring would sit on the 1.5 px floored disc and the non-colour selection cue (UI-07, D-08) would be invisible exactly where a select-all is most likely.
- **Fix:** the ring radius is `rDraw + max(7 k s, OUTER_RING_MIN_GAP_PX = 2)`, identical to the spec whenever `7 k s` is at least 2 px (R_px of 6 or more); the test pins both regimes.
- **Files modified:** app/lib/canvas/draw.ts, tests/app/canvasDraw.test.ts
- **Committed in:** 9300972

**2. [Rule 2 - Missing critical functionality] Highlighted syzygy dots floor at 0.75 px**
- **Found during:** Task 2, the base 202 on-demand test (dot radius `(1 + 1.5 t) k s` is 0.24 to 0.6 px there, below a pixel)
- **Issue:** a highlighted syzygy would be invisible at every large base.
- **Fix:** `DOT_MIN_RADIUS_PX = 0.75` (half the 1.5 px node floor); gradation is kept wherever `k s` allows it, tested at base 28 (strictly increasing) and base 4000 (all 0.75, glow 1.75).
- **Files modified:** app/lib/canvas/draw.ts, tests/app/canvasDraw.test.ts
- **Committed in:** 9300972

### Judgement calls beyond the plan (no scope change)

- `SceneIndex` has extra fields beyond the plan's six: `pairLo`/`pairHi`, `gatesIntoStart`/`gatesInto` (the plan needs the gates ending in a zone) and the `torqueSyzygy`/`torqueCurrent` flags (the Time Circuit filter from `view.torqueSyzygies` and `view.torqueCurrentNames`, joined by pair id). Lookups are typed `T | undefined`.
- The region dot sits where the SVG puts it (`nodeRadius + 10 k`, plus 8 k per label line and 2 k when a label shows), not at the plan's abbreviated `nodeRadius + 10 k`; the number and xenotation toggles decide the line count.
- Ambient gates (gate mode 'on' or 'thin', so at most 150 zones) get the same 24 px arrowhead rule as currents, so the non-colour cue (dashed with arrowhead) survives in the `tier=canvas` parity check at small bases.
- The pair graph draws its arcs whatever the Layers panel says and its pill label follows label level of detail only (the SVG pair graph has no layer check and no `numbers` toggle); zone layouts honour `labelVisibility`.
- `OverlayReport.chords` counts chords that are visible (neither end muted) and have valid geometry, whether or not they fall inside the window, so 06-12's D-05 check reads data, not zoom.
- `PALETTE` (frozen) and `parseArcEnd`/`ArcEnd` are extra exports; the ladder id (`LADDER_LAYOUT_ID`) switches off the gate meeting label as the SVG does for the ladder routing style.
- The Time Circuit keeps the layer opacity table for its Torque syzygies and currents (ambient, not highlighted alpha) and draws its `#00ccff` segments on the overlay; the overlay draws a highlighted node's strokes over the idle ones, so a selected pill fill (0.3 over 0.12) and a highlighted triangle (0.5 over 0.2) composite slightly brighter than the SVG's single draw. Both are the literal UI-SPEC values and are listed for the 06-15 review with item 7.
- An isolate-dimmed edge is painted at context over ambient on its layer; while another zone is hovered the layer's context opacity multiplies in (about 0.02 against the SVG's 0.1), which only makes an already dimmed edge dimmer.

**Total deviations:** 2 auto-fixed (both Rule 2, both visibility floors the spec's own formulas lose at large bases), plus the judgement calls above. **Impact on plan:** no scope change; the floors only bind where the spec's number would draw nothing visible.

## Mutation Check

Scratch runner outside the repo (`mutate.cjs`: apply one one-line mutant to `draw.ts`, run the draw test file, restore in a `finally`; the source was staged beforehand and `git diff --quiet app/lib/canvas/draw.ts` exited 0 after every run). 134 mutants: every palette-adjacent constant, table value, width, dash, floor, alpha, offset, size and suffix, the label-threshold and dim-ratio logic, the mute, layer and Time Circuit filters of both the static layers and the on-demand set, the fidelity comparison in both overlays (`<` for `<=`), the ladder rule, the arc tangent sign and flag rule, and the draw-in-plain mutants. First pass: 132 mutants ran, 117 killed and 15 survived (one more mutant string did not match and was re-run on its own, together with the pair-graph twin of the same comparison). The survivors pointed at real gaps and each became a test: the 1 px floor hides every width at fit (idle zone stroke, gate width, junction rim, highlighted gate width, gate label rim, chord width), so those are now asserted again zoomed in with `centerOn`; the xenotation fill suffix and offset; the gate label alpha; a muted partner and a muted gate destination in the on-demand set; the Time Circuit filter on a non-Torque pair; the "no demon name next to an isolate-dimmed end" rule; the absence of the glow substitute in plain fidelity; and the pair-graph fidelity boundary at exactly 400 arcs (found by the `<` mutant of the pair overlay). Final: 134 of 134 killed, no equivalent survivors.

## Issues Encountered

- A `bash` heredoc with the test patches tripped the tool's parser twice (unbalanced quote detection); the patch scripts were written with the Write tool and run with `node` instead. No effect on the repo.
- Real engine layouts never produce more than 9.33 dot spacings per syzygy, so the 10-dot clamp is exercised with synthetic scenes (a copy of a fixture with one zone moved), the real ladder pins 9.

## Verification

- `npx vitest run tests/app/canvasDraw.test.ts --project oracle`: 123 passed (RED runs: no module, then 47 `drawOverlay is not a function`).
- `npm run typecheck` (4x tsc plus lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK, run after `git add` of the new files (the gate scans tracked files only); the full default `node scripts/check-repo.mjs` is OK too.
- `npm test` (UTC) and `npm run test:tz` (America/New_York): 85 files, 2322 tests passed in both timezones (the 123 new ones included).
- Acceptance greps: `'#e8e8e8'`, `'#22ee66'`, `'#cc44ff'`, `'#00ccff'` and `'#10ff50'` are in `PALETTE`; `labelsShown(` is the only level-of-detail test; `grep -n "shadowBlur\|fillRect"` returns nothing; `grep -cE "LABEL_MIN_RADIUS_PX|labelVisibleMinRadiusPx"` is 0; `export const HIGHLIGHT_FULL_FIDELITY_MAX = 400` is on exactly 1 line; `export function drawOverlay` 1; the test file contains `4000` and `'plain'`.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing; `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**`, `useCanvasPan.ts` and `engine/` are untouched. The full `npm run verify` was not run: the plan adds one unimported pure module and one test file (no e2e, build or page-weight surface), and the unit suites in both timezones are green.

## Known Stubs

None.

## Threat Flags

None. The plan's register is covered: T-06-05 (labels, names and region captions go through `fillText` only, no HTML path exists in the module), T-06-10 (above 400 highlighted edges plain batched strokes; select-all at base 4000 records 11 `stroke()` calls against a bound of 16, and the fidelity is reported), T-06-22 (hover, pin, selection and focus touch only `drawOverlay`; a test records identical output for `anyFocus` true and false, and context dimming is `edgeLayerOpacity`).

## Next Phase Readiness

- **06-10 (CanvasDiagram):** build the `DrawEnv` as `{ ctx, makePath: () => new Path2D(), pathFromSvg: d => new Path2D(d) }`; build the `SceneIndex` once per (scene, view) with `buildSceneIndex`; give each static layer its own canvas and set its CSS `opacity` to `edgeLayerOpacity(kind, anyFocus, gateMode)` (the layers paint at alpha 1, so dimming on hover is an opacity switch, not a redraw); the pair graph needs the syzygy and gate canvases only for the clear (they draw nothing). Re-raster the static layers on scene swap, committed zoom or pan, resize, layers, labels, isolate, mute and Time Circuit; hover, pin, selection, demon focus and ring changes call `drawOverlay` only. All layer functions take the same `DrawState` fields, and the overlay adds `hlZones`, `selZones`, `anyFocus`, `focusChords` and `ring`.
- **Report fields:** `drawOverlay` returns `{ highlightedEdges, fidelity, chords }`: expose them as data attributes (06-10) and log them (06-12); `chords` is `base - 1` for a zone focus below `FOCUS_CHORD_DRAW_MAX`.
- **State to pass:** `zoneStates` from the region filter (null when none), `gateMode` from `gateMode(n)`, `labelVisibility` from the Labels panel, `layers` from the Layers panel (the pair graph ignores it for arcs), `zoneLabels` as the SVG tier's labels. `labelsOn` is not a state field: level of detail is derived from the transform inside the module.
- **06-15 review list:** UI-SPEC item 7 (partial-selection gradients are SVG-tier only), the Time Circuit's ambient alpha, the brighter compositing of a selected pill and a highlighted triangle, the 2 px outer-ring gap and the 0.75 px dot floor.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED
