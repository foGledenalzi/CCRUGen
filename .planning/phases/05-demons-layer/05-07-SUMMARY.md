---
phase: 05-demons-layer
plan: 07
subsystem: ui
tags: [canvas, demons, matrix, pan-zoom, keyboard-a11y, react]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-02)
    provides: app/lib/demonMatrix.ts's pure transform/pixel-resolve/raster-fill math (fitTransform, clampTransform,
      zoomAt, panBy, cellAtPixel, cellRect, stepCursor, ensureCellVisible, syzygyLine, numodemonLine, rasterSize,
      buildPalette, rasterizeRows)
  - phase: 05-demons-layer (05-01)
    provides: app/lib/demonBrowser.ts's KIND_COLOR/KIND_LABEL/LEGACY_KINDS/SUBTYPE_LABEL/netSpanLabel taxonomy
provides:
  - DemonMatrix.tsx, DEM-04's canvas component (a plain <canvas>, no WebGL): progressive raster, drag pan,
    wheel/pinch zoom, exact hover/click resolve, keyboard cursor + pin, syzygy/numodemon diagonal overlay, legend
affects: [05-09 (mounts DemonMatrix into the demons overlay's Matrix tab)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas raster progressive-fill: <= 8ms/frame slices via requestAnimationFrame, cancelled by a generation
      counter (never a stale job keeps painting after a newer commit supersedes it)"
    - "CSS-transform the stale bitmap during a gesture (drag/wheel/pinch), recompute the raster once committed
      (mirrors the main diagram's existing panMs/oneTimePaintMs budget split)"
    - "Exact pixel resolve (hover/click/keyboard) always goes through cellAtPixel + g.demons.ref on the LIVE
      transform, never through the raster (raster is a display cache, resolve is authoritative)"
    - "Thin diagonal features (syzygy/numodemon lines) drawn as explicit SVG overlay geometry, never point-sampled"

key-files:
  created:
    - app/components/demons/DemonMatrix.tsx
    - tests/app/demonMatrixRender.test.ts
  modified: []

key-decisions:
  - "Cursor safety: derive an activeCursor (falls back to [1,0] when the stored cursor cell is out of range for the
    current base) rather than trusting raw state, so a base change can never make g.demons.ref(cursor) throw
    during render"
  - "Pointer gesture state (drag vs. pinch vs. click) tracked via three plain refs (a Map of active pointers, a
    DragState, a PinchState) with setPointerCapture on pointerdown, rather than a library; a release with <= 3px
    of total movement is a click, anything more commits the pan/zoom"

requirements-completed: []  # DEM-04 stays Pending: this plan ships the canvas component but 05-09 mounts it into
  # the demons overlay (per this plan's own objective, "Mounted by the overlay in 05-09"); DEM-04's text ("lets the
  # user see and inspect every demon") is not satisfiable until a user can actually open it, matching the
  # established precedent (05-02's SUMMARY deferred DEM-04 to this plan for the identical reason).

# Metrics
duration: ~20min
completed: 2026-09-30
---

# Phase 5 Plan 07: Demon Matrix Canvas Summary

**DemonMatrix.tsx: a plain `<canvas>` triangular demon matrix with progressive point-sampled raster fill, drag/wheel/pinch pan-zoom, and exact hover/click/keyboard pixel-to-demon resolve, ready for 05-09 to mount.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-30T23:36:13Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created component, 1 created test)

## Accomplishments
- Progressive canvas raster (never blocks the main thread for more than one ~8ms slice) that colors every demon of
  the current base by kind (chrono/amphi/xeno/syzygy), working identically at base 666 where the main SVG diagram
  doesn't exist (`view` is null — this component reads only `g`)
- Drag-to-pan, wheel-to-zoom and two-finger pinch-to-zoom, all CSS-transforming the stale bitmap during the gesture
  and recomputing the raster once it commits (no per-frame re-raster during a gesture)
- Hover tooltip and click-to-pin, both resolved exactly from the live transform via `g.demons.ref`, never sampled
  from the raster — correct at any zoom level, including the coarsest fit-to-viewport zoom at base 666
- Full keyboard model: arrow keys move a triangle-confined cursor (auto-panning to keep it visible), Enter/Space
  pins the cursor's demon, `+`/`-` zoom on the cursor cell, `0` re-fits; an `aria-live` region announces the
  cursor's `A::B · MESH · Subtype` on every move
- Explicit SVG diagonal overlays for the syzygy line (`a + b = n - 1`) and the numodemon line (`a + b = n`), plus
  outlined pinned-cell and keyboard-cursor rectangles, so thin one-cell features never alias away under the
  point-sampled raster

## Task Commits

1. **Task 1: Canvas raster with progressive <= 8 ms slices, live/committed transform, drag pan, wheel and pinch zoom** - `9750063` (feat)
2. **Task 2: Exact hover tooltip, click and keyboard pin, diagonal and cursor overlay, live region, render test** - `10f5e23` (test, RED) + `509449c` (feat, GREEN)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/components/demons/DemonMatrix.tsx` - the canvas matrix component (DEM-04): raster, pan/zoom, hover/click/keyboard resolve, overlay, legend
- `tests/app/demonMatrixRender.test.ts` - server-render smoke: container contract, legend order, no server-side tooltip, base-666 no-throw

## Decisions Made
- Cursor validity is derived every render (`cursorValid` / `activeCursor`) rather than trusted from raw state, with
  a corrective effect that resets to `[1, 0]` only when the stored cell is actually out of range — this guards
  against a future base-change-without-remount scenario throwing inside `g.demons.ref` during render, without
  changing the plan's specified behavior in the common case
- Pointer-gesture bookkeeping (drag/pinch/click discrimination, `setPointerCapture`) implemented as plain refs and
  handlers directly on the container's JSX props (not a native-listener effect), since JSX pointer handlers already
  get a fresh closure over `live`/`committed`/`size` on every render — only the wheel listener needs the native,
  non-passive path (JSX `onWheel` is passive in React) and a `liveRef` "latest ref" for its async 150ms commit timer

## Deviations from Plan

None - plan executed exactly as written. The plan's TypeScript-level detail (module constants, effect structure,
pointer/wheel formulas, DOM contract) was followed literally; the only additions (the `cursorValid`/`activeCursor`
guard and the `liveRef` latest-value ref) are implementation details needed to make the plan's own described
behavior (e.g. "commit immediately" from a keyboard handler, a cursor that must stay inside the triangle at any
base) actually correct, not scope changes.

## Issues Encountered
- ESLint's `@typescript-eslint/no-unused-vars` flagged `selectedMesh`/`onSelectDemon` as unused during Task 1 (they
  are only consumed starting Task 2). Referenced them with `void selectedMesh; void onSelectDemon` in Task 1's
  commit to keep `npm run typecheck` (which runs lint) green without renaming the props or disabling the rule; Task
  2 removed the `void` statements once the props were wired up for real. Not a deviation rule (Rules 1-3 are about
  code correctness/blocking issues; this was a lint-cleanliness step within the plan's own two-commit task
  structure), noted here only for continuity.
- One unrelated, previously-logged flaky fast-check property in `tests/app/demonMatrix.test.ts` (05-02's file,
  1-ULP floating-point boundary, see `.planning/phases/05-demons-layer/deferred-items.md`) did not reproduce during
  this plan's `npx vitest run tests/app` run (34/34 and 437/437 passed). Left as-is, out of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `DemonMatrix` exports `{ DemonMatrix, DemonMatrixProps }` exactly per the plan's interface contract, ready for
  05-09 to mount as the demons overlay's "Matrix" tab (`selectedMesh`/`onSelectDemon` wire directly into the
  overlay's shared pin state, the same pattern `DemonRowList` from 05-05 already uses)
- DEM-04 stays Pending in REQUIREMENTS.md until 05-09 actually mounts the component (see `requirements-completed`
  note above) — no blocker, just sequencing, matching this phase's established multi-plan-requirement precedent

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

- FOUND: app/components/demons/DemonMatrix.tsx
- FOUND: tests/app/demonMatrixRender.test.ts
- FOUND: .planning/phases/05-demons-layer/05-07-SUMMARY.md
- FOUND commit: 9750063 (feat, Task 1)
- FOUND commit: 10f5e23 (test, Task 2 RED)
- FOUND commit: 509449c (feat, Task 2 GREEN)
