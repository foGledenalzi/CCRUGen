---
phase: 06-canvas-tier-and-worker
plan: 03
subsystem: ui
tags: [canvas, keyboard, pointer, touch, pinch, accessibility, typescript, vitest, fast-check]

# Dependency graph
requires:
  - phase: 04-base-picker-and-generator-ui
    provides: the SVG tier's aria-label strings and data-focus-key grammar (Projection.tsx, PairGraphProjection.tsx), regionLabel in app/lib/regions.ts
  - phase: 05-demons-layer
    provides: the DemonMatrix pointer bookkeeping (drag threshold 3, pinch factor, cancel handling) and the pure-module-plus-thin-component precedent (demonMatrix.ts)
provides:
  - app/lib/canvas/keyboardModel.ts, the D-08 keyboard traversal as a pure function (nextTarget) plus focusKeyOf, announcementFor, activationAnnouncement
  - app/lib/canvas/interaction.ts, the D-09 pointer state machine (reducePointer) for mouse, pen and touch, and wheelZoomFactor
  - tests/app/canvasKeyboard.test.ts (49 tests) and tests/app/canvasInteraction.test.ts (59 tests)
affects: [06-10, 06-12, 06-13, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-free input models: a keyboard model and a pointer reducer take plain objects and return plain outcomes, so everything the Canvas component does with input is unit-tested in the node environment and the component only translates DOM events"
    - "Mutation-checked tests: each model was run against 11 and 26 hand-made mutants; the one that survived pointed at a real test gap and was closed"

key-files:
  created:
    - app/lib/canvas/keyboardModel.ts
    - app/lib/canvas/interaction.ts
    - tests/app/canvasKeyboard.test.ts
    - tests/app/canvasInteraction.test.ts
  modified: []

key-decisions:
  - "A null ring, a zone that was muted since, an edge whose owner zone left the order, or a ring of the wrong kind for the mode is treated as initialTarget BEFORE the key applies (so ArrowRight from it lands on order[1], Enter activates order[0]). The component re-seeds the ring with initialTarget when the order changes; this is the safety net"
  - "An edge lookup that returns null (TargetText.syzygyOf/currentOf/gateOf) degrades to the owner zone: focusKeyOf gives 'zone:N', announcementFor the zone text, and activationAnnouncement does NOT say 'pinned' because nothing was pinned"
  - "Page, Home and End at an end still answer 'move' (with the same target), because the key belongs to the model: the caller prevents the default and may skip the repeat announcement. An empty order answers only Tab ('leave'); every other key, zoom keys included, is 'ignore'"
  - "Click slop is the displacement between press and release, not accumulated path length. A mouse or pen release within 3 px of a press on empty space is also a 'click' (after rubberStart), which is how the Canvas tier reproduces the SVG tier's empty-space click that clears hover and pin"
  - "Pinch emits zoom about the midpoint BEFORE the move, then a pan by the midpoint delta; applied in order this keeps the content under the fingers exactly (proved by a fast-check property that replays the actions on a transform). Zoom factors are finite and positive only, identity zooms are not emitted, and the last valid finger distance is kept when the fingers coincide"
  - "A touch's first pan carries the whole displacement since the press (sum of pan deltas equals the finger's total travel), so the content never lags the finger by the 8 px slop. When one finger of a pinch lifts, the other carries on as a press that belongs to the open gesture: start point rebased, no tap, no second gestureStart, and a gestureEnd only when the last pointer is gone"
  - "Mouse presses (target or empty space) do not emit 'capture' (touch, pen and pan do), so a mouse that leaves the canvas during an uncaptured press ends the press without a click (leave in press or rubber mode); a second pointer joins only touch-with-touch; non-finite coordinates are ignored for down, move and up, while cancel and leave are always processed so a pointer can never get stuck"

patterns-established:
  - "Guard every pure module with the same forbidden-token grep the plan names (no react, document or window text anywhere in the file, comments included)"

requirements-completed: []  # REN-02 stays Pending: this plan ships only the pure input models; the Canvas component (06-10) and its e2e specs (06-12, 06-13) are what make the requirement true

# Metrics
duration: 21min
completed: 2026-10-08
---

# Phase 6 Plan 03: Pure Canvas Input Models Summary

**Two DOM-free modules, a two-level keyboard model (arrows between zones, Tab through a zone's syzygy, current and gate, then out) and a mouse, pen and touch pointer reducer with a wheel zoom factor, with 108 tests and the SVG tier's exact strings and keys.**

## Performance

- **Duration:** ~21 min (including a 4.5 min full gate)
- **Started:** 2026-10-08T17:41:00Z
- **Completed:** 2026-10-08T18:02:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `app/lib/canvas/keyboardModel.ts`: `nextTarget(current, key, shiftKey, ctx)` returns `move`, `activate`, `zoom`, `leave` or `ignore`. Arrows wrap over the visible zones (or pairs) in order, Home and End jump, Page Up and Down jump `PAGE_STEP` = 10 positions clamped without wrapping, Tab steps syzygy, current, gate (absent ones skipped) and then leaves, Shift+Tab mirrors it, Enter and Space activate, `+ = - _ 0` zoom. Muted zones are simply not in `order`, so they are never a stop and never counted by a Page jump. The pair graph visits pairs in pair-id order and Tab leaves at once.
- `focusKeyOf`, `announcementFor` and `activationAnnouncement` produce the SVG tier's own `data-focus-key` grammar (`zone:15`, `syzygy:13:14`, `current:<name>`, `gate:<name>`, `pair:3`) and aria-label strings (`Zone c, Torque`, `Syzygy d::e`, `Current ...`, `Gate ...: zone x to zone y`, pair graph hi::lo), plus the `, selected`, `, not selected` and `, pinned` suffixes. A zone's activation text is built without the selected suffix, so it can never read "selected, not selected".
- `app/lib/canvas/interaction.ts`: `reducePointer(state, input)` is an immutable reducer. Mouse click slop is 3 px, touch tap and pan 8 px, a middle button or Alt-drag pans from the first pixel, a drag from empty space starts the rubber band (Shift = additive), two touches pinch about their midpoint and pan with it, `pointercancel` drops the gesture, non-finite input is ignored. `wheelZoomFactor` is the existing `exp(-step x 0.0015)` with the step clamped to +-100 and line and page deltas normalized.
- 108 new tests, all green in both timezones: 49 for the keyboard model (every behaviour bullet, plus purity and two fast-check properties) and 59 for the pointer machine (every bullet, plus a fast-check property that replays random two-finger streams on a transform and checks the anchoring, and an arbitrary-event-stream property for finite actions, positive zoom factors and balanced gestureStart/gestureEnd).
- Both models were mutation-checked against hand-made mutants (11 and 26). Everything was killed except two: one equivalent mutant (a redundant `mode === 'pairs'` test that normalization already guarantees, removed from the code) and one real gap (the rebased slop of the finger that stays after a pinch), now covered by its own test.

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer):

1. **Task 1: Canvas keyboard model (D-08)**
   - `9ba71e4` test(06-03): add failing test for the canvas keyboard model
   - `1f5c247` feat(06-03): implement the canvas keyboard model
2. **Task 2: Pointer state machine and wheel factor (D-09)**
   - `95591bb` test(06-03): add failing test for the canvas pointer state machine
   - `70ee383` feat(06-03): implement the canvas pointer state machine and wheel factor

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`Cannot find module` for the new file) before their GREEN commits. The GREEN commit of Task 2 also carries the one added test (`the finger that stays measures its slop from where it was when the other lifted`), found by the mutation check._

## Files Created/Modified

- `app/lib/canvas/keyboardModel.ts` - `PAGE_STEP`, `RingTarget`, `KeyboardContext`, `KeyOutcome`, `initialTarget`, `nextTarget`, `TargetText`, `focusKeyOf`, `announcementFor`, `activationAnnouncement`
- `app/lib/canvas/interaction.ts` - `CLICK_SLOP_PX`, `TOUCH_SLOP_PX`, `PointerKind`, `PointerInput`, `TrackedPointer`, `PointerState`, `PointerAction`, `PointerReduction`, `INITIAL_POINTER_STATE`, `reducePointer`, `wheelZoomFactor`
- `tests/app/canvasKeyboard.test.ts` - keyboard model tests, text fixture built from the real base-28 view (`createNumogram(28)`, `buildNumogramView`, `zoneLabelsFor`)
- `tests/app/canvasInteraction.test.ts` - pointer reducer and wheel factor tests with literal event objects

## Decisions Made

See `key-decisions` above. The plan fixed the rules in its `<behavior>` lists; the decisions record only what those lists left open (null and stale rings, missing edges, boundary Page keys, how a click is measured, the order of pinch zoom and pan, what happens to the other finger when one lifts, and when `capture` is emitted).

## Deviations from Plan

None - plan executed exactly as written. Judgement calls inside the plan's open space are in `key-decisions`. One small addition to the exported surface: `PointerReduction` (the `{ state, actions }` return type) is exported so the signature is nameable; the planned names are all present with the planned shapes.

## Notes for 06-10 (the component that consumes these)

- Do not call `nextTarget` for a key event carrying Ctrl, Meta or Alt (browser shortcuts such as page zoom); Shift only matters for Tab.
- Re-seed the ring with `initialTarget(ctx)` on focus and whenever `order` changes; `nextTarget` also falls back to it, but the painted ring should not rely on that.
- Apply a pointer reduction's actions in order. For a pinch the `zoom` action is about the midpoint before the move and the `pan` that follows carries it to the new midpoint, so apply `zoom` then `pan` and the content stays under the fingers. A `click` after `rubberStart` (a release within 3 px on empty space) is the empty-space click that clears hover and pin.
- `capture` asks for `setPointerCapture`; mouse presses on a target or on empty space do not, so forward the canvas `pointerleave` as a `leave` input.

## Issues Encountered

None.

## Verification

- `npx vitest run tests/app/canvasKeyboard.test.ts tests/app/canvasInteraction.test.ts --project oracle`: 108 passed (49 and 59).
- Acceptance greps: `export const PAGE_STEP = 10`, `export const CLICK_SLOP_PX = 3` and `export const TOUCH_SLOP_PX = 8` each appear once; `, not selected`, `, pinned`, `Gate ${` and `0.0015` are present; `grep -nE "react|document|window"` returns nothing for both modules.
- `node scripts/check-repo.mjs --only base-ten`: OK (run after `git add` of the new files, since the gate scans tracked files only).
- `npm run typecheck` (4x tsc plus lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 1857 unit tests in 74 files in both timezones, sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update: the new modules are not imported by any route yet), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing (no frozen file touched). `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**` and `useCanvasPan.ts` are unchanged.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or trust-boundary schema change. T-06-17 (non-finite input) is mitigated by the finite guard on down, move and up, the finite-and-positive pinch factor and the immutable state, each pinned by tests including a property over arbitrary event streams; T-06-18 (Page keys) is mitigated by clamping to the order bounds, with the empty order handled (`leave` for Tab, `ignore` otherwise) and an arbitrary-order property test.

## Next Phase Readiness

- 06-10 can import `nextTarget`, `focusKeyOf`, `announcementFor`, `activationAnnouncement`, `reducePointer`, `INITIAL_POINTER_STATE` and `wheelZoomFactor` directly; nothing else in this plan has to land first.
- REN-02 stays Pending until the Canvas component and its e2e specs exist (06-10, 06-12, 06-13).

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*
