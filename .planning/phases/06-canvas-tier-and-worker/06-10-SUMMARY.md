---
phase: 06-canvas-tier-and-worker
plan: 10
subsystem: canvas
tags: [canvas, react-component, gestures, picking, keyboard, accessibility, live-region, dpr, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-02's CanvasScene, 06-03's keyboard model and pointer reducer, 06-05's view transform and pick index, 06-08's drawing module (layers, overlay, edgeLayerOpacity, DrawEnv handoff)
provides:
  - app/lib/canvas/diagramModel.ts, the pure glue (pick filter, pick-to-HoverInfo, keyboard context, target text, ring info and anchor, callout placement and colour, aria-label, live-text toggle, frame, gesture mapping)
  - app/components/canvas/CanvasDiagram.tsx, the Canvas tier's one component (forwardRef with the CanvasDiagramHandle) with the UI-SPEC DOM contract and data hooks, ready to mount in 06-11
  - tests/app/canvasDiagramModel.test.ts (59 tests) and tests/app/canvasDiagramRender.test.ts (23 SSR tests)
affects: [06-11, 06-12, 06-13, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A DOM shell over pure modules: every decision (which edges a pick may land on, how a pick becomes the SVG tier's HoverInfo, which stops the ring may visit, where the chip sits, how a repeat is announced, how a bitmap is CSS-stretched) is a tested pure function; the component only wires events to them"
    - "Live view in a ref, committed view in React state keyed by the scene: the committed transform belongs to one (kind, layoutId, base) key, so a new base or layout is the identity at render time with no stale frame; gestures stretch the cached layer stack with a CSS transform and the layout effect re-rasters and clears it in the same frame"
    - "Per-render controller ref (ctl.current = {...}) so animation frames, timers and the native wheel listener always call the latest closures; effects that only schedule never list props"
    - "Verified in a real browser with a throwaway probe route (never committed): about 110 checks across four scripts, then the route and the dev output were deleted"

key-files:
  created:
    - app/lib/canvas/diagramModel.ts
    - app/components/canvas/CanvasDiagram.tsx
    - tests/app/canvasDiagramModel.test.ts
    - tests/app/canvasDiagramRender.test.ts
  modified: []

key-decisions:
  - "The canvas has five canvases in one CSS-transformed stack (syzygy, current, gate, node, overlay) inside a root that is the tier wrapper; the four layers are aria-hidden and pointer-transparent, the overlay is the single Tab stop (role=application, outline none, touch-action none); data-canvas-state is 'pending' until the current scene has painted once and nothing is pending"
  - "Context dimming is a CSS opacity on the edge layer canvases (edgeLayerOpacity of anyFocus and the gate mode), so hover and pin never repaint the static layers; the overlay is redrawn once per animation frame on interaction changes and written into data-overlay-edges, -fidelity, -chords and -ms"
  - "The pick filter is the draw module's own rule: a layer that is off is not pickable, a muted end hides an edge (a current by any of its three zones), the Time Circuit leaves only Torque edges, a gate is a candidate at gate modes on and thin and, at off, only for a highlighted zone (D-04); keyboard gates are reachable whenever the layer is on and the Time Circuit is off, because keyboard focus counts as hover and so draws the focused zone's own gate"
  - "Pointer-initiated focus (a press on the canvas) does not seed the ring or hover zone 0: only keyboard focus does (it would otherwise highlight the first zone after any click and desynchronise the hover tracking); a key then starts from the first visible zone as the model defines"
  - "Wheel listener sits on the root, not the overlay: the overlay lives inside the CSS-transformed stack and shrinks during a zoom-out burst, so wheel events near the window edge would miss it and scroll the page; the root never moves"
  - "DPR is re-measured on a resolution media query change (re-armed after each change) and also on window resize (browser zoom fires both): headless Chromium's CDP device-scale emulation fires no media query event, and older Safari lacks MediaQueryList.addEventListener"

patterns-established:
  - "Test the effectful half of a component in a real browser once, with a probe route that is deleted before the commit, and keep the permanent test to the SSR DOM contract plus pure-function unit tests"
  - "A stub of matchMedia and devicePixelRatio (init script) drives the resolution listener logic when the engine's own emulation does not dispatch the event"

requirements-completed: []  # REN-02 stays Pending: the component is not mounted until 06-11 and the e2e specs (06-12, 06-13) make the requirement true

# Metrics
duration: ~75min active (the run was interrupted by a usage limit between Task 2 RED and the browser smoke)
completed: 2026-10-15
---

# Phase 6 Plan 10: CanvasDiagram Component Summary

**The Canvas tier's one component, built from tested pure glue: stacked layer canvases with opacity-carried context dimming, a focusable role=application overlay, 12 px nearest-wins picking, pinch, pan and wheel gestures that stretch the cached bitmap and re-raster at commit, a roving keyboard ring with a callout chip and a live region, and a pending state; every input ends in the SVG tier's own callbacks. Nothing mounts it yet.**

## Performance

- **Duration:** ~75 min active across two sessions (a usage limit interrupted the run after the Task 2 RED commit and again during the browser smoke; no work was redone)
- **Started:** 2026-10-08T23:17:00Z
- **Completed:** 2026-10-15
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `app/lib/canvas/diagramModel.ts` exports `CALLOUT_OFFSET_PX` (12), `WHEEL_COMMIT_DELAY_MS` (120), `PENDING_GRACE_MS` (150), `FilterArgs`, `pickFilterFor`, `hoverInfoOf`, `keyboardContextFor`, `targetTextFor`, `ringInfo`, `targetOfInfo`, `calloutPosition`, `calloutColor`, `canvasAriaLabel`, `liveText`, `frameOf`, plus two extras the component needed and now tested: `targetAnchor` (world position and keep-visible radius of a ring target) and `gestureMapping` (the CSS scale and translation that maps the committed bitmap onto the live view, proven point by point against `toScreen`). Edges join to the view by pair id and origin zone, never by view-array index; a pair's two members share one entry, so `targetOfInfo` returns the entry's own owner zone and the round trip is exact for zones and gates and pair-exact for syzygies and currents.
- `app/components/canvas/CanvasDiagram.tsx` (944 lines) renders the tier wrapper (`data-render-tier="canvas"`, `data-canvas-state`, `data-base`, `data-post-baseline`, the four overlay report attributes), four `aria-hidden` layer canvases whose CSS opacity is `edgeLayerOpacity(kind, anyFocus, gateMode)`, the overlay (`data-diagram`, `data-focus-key`, `data-zoom`, `data-tx`, `data-ty`, `aria-busy`), the callout chip (`role="tooltip"`, the demon-matrix classes and style) and the `data-canvas-live` region. Static raster (all four layers, then the overlay, then the CSS transform cleared) runs in a layout effect on scene, view, labels, layers, label visibility, gate mode, mute state, Time Circuit, committed transform, footprint and DPR; the overlay redraws once per animation frame on hover, selection, ring, demon focus and Time Circuit changes. The handle exposes `zoomIn`, `zoomOut`, `fit`, `fitZones`, `zonesInClientRect` and `element`.
- **Gestures.** Wheel (native non-passive listener on the root, commit 120 ms after the last tick), mouse (alt or middle drag pans, a plain press on empty space starts the rubber band, a release within 3 px is a click) and touch (one finger pans past 8 px, two fingers pinch about their midpoint, a tap pins) go through the 06-03 reducer; the live transform is a ref, mirrored to `data-zoom/tx/ty` and `onZoomChange` at commit only. A 12 px pick runs once per animation frame and is suspended during a gesture or a wheel burst; cursor is `pointer` over a target, `crosshair` otherwise, `grabbing` while panning.
- **Keyboard and announcements.** `nextTarget` drives the ring (arrows wrap, Home, End, Page keys, Tab through a zone's syzygy, current and gate, then out), moving the ring calls `onHoverInfo`, keeps the target 24 px inside the window and announces through `liveText` once per frame; Enter and Space make the click calls and announce `activationAnnouncement` (plain zone text in Demon focus mode). While pending every key but Tab is ignored and navigation keys are prevented.
- **Browser verification (throwaway probe route, deleted).** About 110 checks in Chromium across four scripts, all passing: ring at base 202 painted at 2x (nodes, syzygies, currents; the gate layer empty at gate mode off), hover draws the on-demand gate with its arrowhead, the syzygy layer drops to 0.1, the chip flips at the window edge, wheel stretches the stack and commits after 120 ms, handle zoom steps, whole-window `zonesInClientRect` finds all 202 zones, Tab, arrows, Page, Home, End, `+` and `0` through the ring, the pending state, blur, the pair graph at base 64 (hover, click, ring, Enter), touch tap, pan and pinch (CDP), base 4000 (hover overlay 0.4 ms, End scrolls the ring target into view), the ladder clamped to 704 px, a 375 px window (359 px canvas, no overflow), alt and middle drag, the rubber band after a pan, scene swap (zoom and ring reset), labels crossing the level-of-detail threshold on a deep zoom, and live DPR changes.

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer, checked with `git log -1 --format=%B`):

1. **Task 1: Pure glue module**
   - `6ff69d9` test(06-10): add failing tests for the canvas diagram glue module
   - `3559a05` feat(06-10): add the pure glue module for the canvas diagram
2. **Task 2: CanvasDiagram component**
   - `22c85a7` test(06-10): add failing tests for the canvas diagram DOM contract
   - `fa8471c` feat(06-10): add the CanvasDiagram component (layers, gestures, picking, keyboard, callout, live region)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (module not found). The Task 1 GREEN run had one failing test, my own over-strict `toEqual` on a subset of a view entry; it was tightened to object identity (a stronger join check), not weakened._

## Files Created/Modified

- `app/lib/canvas/diagramModel.ts` - the pure glue module
- `app/components/canvas/CanvasDiagram.tsx` - the Canvas tier component
- `tests/app/canvasDiagramModel.test.ts` - 59 unit tests with real engine scenes and views at bases 28, 64, 202 and 4000
- `tests/app/canvasDiagramRender.test.ts` - 23 SSR tests: wrapper attributes, layer canvases, overlay contract, both aria-labels, live region, layer opacities (ambient, context, thin gates), pending state, callout chip, source rules

## Decisions Made

See `key-decisions` above. The plan fixed the structure and the behaviour list; the judgement calls were the focus rule, the wheel listener's host, the DPR re-measure sources, and the deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] DPR also re-measured on window resize**
- **Found during:** browser smoke (live DPR change)
- **Issue:** the plan names only a `matchMedia` resolution listener. Chromium's CDP device-scale emulation dispatches no media query change event in headless mode (my own stub listener counted 0), and older Safari lacks `MediaQueryList.addEventListener`, so a DPR change could leave a stale bitmap density (UI-SPEC: never leave a bitmap stretched; re-raster on a devicePixelRatio change).
- **Fix:** the same re-measure and re-arm function is also a `resize` listener (browser zoom fires both). The listener logic is proven with a stubbed `matchMedia` and `devicePixelRatio` (one live listener at any time, re-armed for 2dppx, 1.5 gives floor(580 x 1.5) = 870, resize alone re-measures).
- **Files modified:** app/components/canvas/CanvasDiagram.tsx
- **Committed in:** fa8471c

### Judgement calls beyond the plan (no scope change)

- **Wheel listener on the root.** The plan says "on the overlay". The overlay sits in the CSS-transformed stack and shrinks during a zoom-out burst, so a wheel event near the window edge would miss it and scroll the page. The root never moves; the contract (native, `passive: false`, `preventDefault`, `zoomAt(live, wheelZoomFactor(...))`) is unchanged.
- **Root `overflow: hidden`.** Not in the plan's style list: a stretched bitmap (zoom in) must not spill over the page. The chip flips inside the window, so nothing legitimate is clipped.
- **Pointer coordinates come from the root's rect**, not the overlay's, for the same reason (the overlay is transformed during a gesture).
- **Callout sources.** The plan's priority is pointer hover, ring, pinned. The props include `hoverInfo` (the parent's hover), so it is a third source between the ring and the pin; a hovered chord shows the demon's name in its kind colour (the UI-SPEC lists no chord string; a pinned or externally hovered demon has no chip); the chip for a ring, hover or pin target is hidden when its anchor is outside the window.
- **Pointer-initiated focus** does not seed the ring or hover (see key-decisions); keyboard focus follows the plan literally (ring to the first visible zone or pair, hover it, no announcement beyond the aria-label).
- **Two extra pure exports** in diagramModel (`targetAnchor`, `gestureMapping`) and the `FilterArgs` type, each unit-tested. `targetTextFor` accepts the scene for call-site symmetry but joins through the index.
- **`data-overlay-*` initial values** (`0`, `full`, `0`, `0`) are rendered in the markup and then updated by ref; React never rewrites them because the props do not change.

**Total deviations:** 1 auto-fixed (Rule 2), plus the judgement calls above. **Impact on plan:** no scope change.

## Issues Encountered

- A shell heredoc containing a quote tripped the tool's parser once; the smoke script was written with the Write tool instead.
- Three browser-smoke failures turned out to be harness artefacts, not component bugs: a rubber-band press that landed on a current edge (the view had been panned vertically, so the press was correctly "over a target"), a `waitForSelector` visibility wait that stalled after CDP metric overrides, and the DPR emulation firing no media query event (which led to the resize fallback and the stub-based test).
- A usage limit interrupted the run twice; the repo state was re-checked and nothing was redone.

## Verification

- `npx vitest run tests/app/canvasDiagramRender.test.ts tests/app/canvasDiagramModel.test.ts --project oracle`: 82 passed (59 + 23).
- `npm run typecheck` (4x tsc plus lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK after `git add` of the new files (the gate scans tracked files only).
- Acceptance greps: `passive: false`, `setPointerCapture`, `role="application"`, `data-canvas-live`, `data-canvas-callout`, `data-render-tier="canvas"` and `pickAt(` are each in the component once; `grep -nE "dangerouslySetInnerHTML|innerHTML|shadowBlur|useCanvasZoom"` returns nothing; `export const CALLOUT_OFFSET_PX = 12`, `export const PENDING_GRACE_MS = 150`, the aria-label string and `fromCodePoint(0x200b)` are in diagramModel once each.
- `git status --porcelain app/components/projection app/hooks/useCanvasPan.ts e2e/__golden__ e2e/__behaviour__` prints nothing; `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**` and `engine/` are untouched.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 87 test files and 2404 unit tests passed in both timezones, the sub-path e2e passed (10), `npm run build` exit 0, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 200 passed and 130 skipped (the "run once in UTC" skips, unchanged), then `check-repo` OK for all 13 checks including clean-tree and static-out.
- Page weight, honestly: nothing imports the component, so it is not in the bundle (`grep` of `out/_next/static` for `data-canvas-layer` finds 0 files). `/numogram/` is 727,350 B raw JS and 218,837 B gzip now against a baseline of 726,294 and 218,587 (+1,056 and +250, within the tolerance and unchanged by this plan; the drift comes from earlier Phase 6 plans). The baseline was not updated.

## Known Stubs

None.

## Threat Flags

None. The plan's register is covered: T-06-02b (the store comes from `backingStore` for the window only with DPR capped at 3 and area under the table's limit; zoom is clamped by `clampTransform`; gestures stretch a cached bitmap, no per-frame raster), T-06-05b (the chip and the live region are React text nodes; a test greps the source for any HTML injection), T-06-24 (one pick per animation frame, suspended during gestures, overlay-only redraw on hover; hover at base 4000 measured 0.4 ms overlay in the browser).

## Next Phase Readiness

- **06-11 (viewer integration):** mount `CanvasDiagram` with the props listed in the file. **Memoize `layers`, `labelVisibility`, `zoneLabels`, `zoneStates`, `scene` and `view`**: the static raster effect keys on their identity, so a fresh `Set` per parent render would re-raster every render (`hlZones`, `selZones` and `focusChords` only trigger the cheap overlay). `onZoomChange` fires at commit (and once at mount with 1). `pending` should be true only after the 150 ms grace (`PENDING_GRACE_MS`); `viewportWidth` and `viewportHeight` are the window size. The first paint is reported as `data-canvas-state="pending"` until the scene has drawn, so `e2e/viewer-helpers.ts` should wait on `[data-render-tier="canvas"][data-canvas-state="ready"]`.
- **Rubber band:** the component only calls `onRubberBandStart(clientX, clientY, additive)`; the parent owns the rectangle and the window listeners, and resolves it with `handle.zonesInClientRect(left, top, right, bottom)` (live transform, mute filter applied, ascending zone ids).
- **ViewControls:** `handle.zoomIn()`, `zoomOut()` (x1.25 about the window centre), `fit()` and `fitZones(zones)` re-raster at once; the percentage readout is `onZoomChange`'s value.
- **E2E hooks** (06-12, 06-13): `[data-render-tier="canvas"]` with `data-canvas-state`, `data-base`, `data-overlay-edges`, `-fidelity`, `-chords`, `-ms`; `canvas[role="application"]` with `data-diagram`, `data-focus-key` (SVG grammar), `data-zoom`, `data-tx`, `data-ty`, `aria-busy`; `[data-canvas-layer="syzygy|current|gate|node"]` with inline `opacity`; `[data-canvas-callout]` and `[data-canvas-live]`. Hover at base 4000 records about 0.4 ms in `data-overlay-ms`.
- **06-15 review list:** the ambient current arrowheads become very large at a deep zoom (their marker size scales with the stroke width, as the SVG tier's markers would; seen at zoom 22 on base 4000), the callout shows chord names (not in the UI-SPEC copy list), and the plan items already listed by 06-08 (partial-selection gradients, Time Circuit ambient alpha, brighter compositing of a selected pill, 2 px ring gap, 0.75 px dot floor).

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-15*

## Self-Check: PASSED
