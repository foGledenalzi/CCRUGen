---
phase: 05-demons-layer
plan: 08
subsystem: ui
tags: [canvas, svg, react, demons, focus-mode]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-01)
    provides: "app/lib/demonBrowser.ts: incidentSource/singleSource row sources, netSpanLabel, kindColor, SUBTYPE_LABEL"
  - phase: 05-demons-layer (05-03)
    provides: "app/lib/demonSearch.ts: parseZoneNumeral (defensive in-base zone-numeral parsing)"
  - phase: 05-demons-layer (05-04)
    provides: "app/lib/demonState.ts: DemonFocus model, zoneFocus/demonFocusOf, focusDemonRef, focusDrawPlan/focusChordList (FOCUS_CHORD_DRAW_MAX=4096), formatDemonFocus"
  - phase: 05-demons-layer (05-05)
    provides: "app/components/demons/DemonRowList.tsx (virtualized demon grid, listId 'focus') and app/lib/geometry.ts's curveAway"
provides:
  - "app/components/projection/Projection.tsx: optional focusChords prop drawing a data-demon-focus-layer chord layer, additive-only (no DOM when unset)"
  - "app/components/numogram/ViewControls.tsx: optional Demon focus toolbar toggle (aria-pressed), additive-only (no DOM when onToggleDemonFocus is absent)"
  - "app/components/demons/DemonFocusView.tsx: the Focus tab — zone input, compact chord canvas (works with no SVG diagram, e.g. base 666), incident/single demon list, clear focus"
affects: [05-10, 05-11, 05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only DOM extension on a byte-identical-goldens component: new prop defaults to null/undefined and the render branch is `focusChords && focusChords.length > 0 &&`, so the default markup string stays provably unchanged (string-equality test) rather than just 'visually similar'"
    - "Chord math is reused (curveAway from app/lib/geometry.ts) via `new Path2D(curveAway(...))` on a bare <canvas> 2D context, independent of Projection.tsx's SVG DOM, so a base with no diagram tier (base 666) still gets a compact chord visualization"
    - "A single DemonRowSource (incidentSource or singleSource) is computed once and reused for both the canvas chord loop and the demon list, avoiding a second incidentSource call for the same focus"

key-files:
  created:
    - app/components/demons/DemonFocusView.tsx
    - tests/app/demonFocusRender.test.ts
  modified:
    - app/components/projection/Projection.tsx
    - app/components/numogram/ViewControls.tsx
    - tests/app/projectionRender.test.ts

key-decisions:
  - "The focus-chord layer is inserted after the Pandemonium layer and before the Gates layer, wrapped in its own data-demon-focus-layer[data-post-baseline] group using a different attribute (data-demon-focus, not data-demon) so it never collides with the existing Pandemonium web's e2e selector (e2e/layers-zoom.spec.ts counts data-demon) or the frozen DOM goldens/behaviour baseline (verified via npm run test:swap plus git status --porcelain on e2e/__golden__ and e2e/__behaviour__, both empty)"
  - "ViewControls' Demon focus button renders only when onToggleDemonFocus is supplied, so every existing/未wired caller (NumogramClient does not pass it until 05-10) keeps byte-identical markup; ViewButton's new `pressed` prop defaults to undefined, which React omits from the DOM entirely rather than rendering aria-pressed=\"undefined\""
  - "DemonFocusView reads g/base/zoneLabel from useNumogramView(), never view — the same Pitfall 2 discipline as every other Phase 5 component — so the Focus tab works unmodified at base 666 (no SVG diagram tier) and base 1,048,576"
  - "Canvas sizing/drawing lives entirely inside useEffect/ResizeObserver (never executed during server rendering), matching DemonMatrix.tsx's established pattern, so the SSR smoke tests exercise only the DOM-contract attributes (data-chord-count/-total/-stride) that are computed synchronously from focusDrawPlan, not from measured canvas pixels"

patterns-established:
  - "TDD-stash protocol for a plan whose task reads 'write tests first (RED), then implement (GREEN)' when the executor already has a correct implementation in mind: stash the implementation files, write+run the new tests to confirm RED, commit the test-only diff, pop the stash, confirm GREEN, commit the implementation — preserves an honest RED-then-GREEN git history without re-deriving already-verified code"

requirements-completed: []  # DEM-03 spans 05-04/05-08/05-10; stays Pending in REQUIREMENTS.md until 05-10 (diagram<->browser wiring), per this phase's established multi-plan-requirement precedent (05-01/05-03/05-04 SUMMARYs)

# Metrics
duration: ~25min
completed: 2026-09-30
---

# Phase 5 Plan 8: Demon Focus Mode Rendering (Projection Layer, Toolbar Toggle, Focus Tab) Summary

**Three focus-mode rendering surfaces for DEM-03/D-03: an additive-only chord layer in the main SVG diagram (`Projection.tsx`), a `ViewControls` "Demon focus" toggle, and a new `DemonFocusView` Focus tab whose own `<canvas>` draws a zone's or one demon's chords (via `curveAway`/`Path2D`, not SVG) and works even where the main diagram doesn't exist, such as base 666.**

## Performance

- **Duration:** ~25 min (context/read time plus 4 commits spanning 17:50:55-18:00:10 local)
- **Tasks:** 2 completed (each RED test commit + GREEN implementation commit)
- **Files modified:** 5 (1 implementation file created, 1 test file created, 2 implementation files extended, 1 test file extended)

## Accomplishments

- `Projection.tsx` gains an optional `focusChords?: readonly Demon[] | null` prop and a `data-demon-focus-layer` chord group, inserted between the Pandemonium layer and the Gates layer, colored via `KIND_COLOR`/legacy `kind` string, with hover/click wired to the same `onHoverInfo`/`onPinInfo` contract every other layer uses — proven to add zero bytes to the base-10 default markup (string-equality test) and exactly the expected chord count at base 28 (27 for a zone focus, 1 for a demon focus)
- `ViewControls.tsx` gains an optional `demonFocusMode`/`onToggleDemonFocus` pair and a reusable `pressed` prop on the internal `ViewButton`, rendering a "Demon focus" toggle (`aria-pressed`) only when wired, with the existing accent token (`#10ff50` family) for the active state — proven to add nothing when unwired and to render the exact `aria-pressed` state when wired
- `npm run test:swap` (build + all 60 frozen DOM goldens + the behaviour baseline + the full vitest suite) passes with `git status --porcelain e2e/__golden__ e2e/__behaviour__` empty; `e2e/hover-pin.spec.ts` (explicitly re-run per the plan's note) passes unchanged
- `DemonFocusView.tsx` (DEM-03's Focus tab): a zone-numeral input (`parseZoneNumeral`, 24-char max) that sets a zone focus; a compact ring-and-chords `<canvas>` (bounded at `FOCUS_CHORD_DRAW_MAX = 4096` via `focusDrawPlan`'s stride, with a "Drawing 1 in N" note when striding) that draws via `curveAway`/`Path2D` independent of any SVG diagram; a click-the-ring-to-focus-a-zone gesture; a `DemonRowList` (`listId="focus"`) showing every demon of the zone (or the single pinned demon) regardless of how many chords were actually drawn; a `clear focus` button; and a toolbar hint shown only when `showDiagram` is true — proven at base 666 (no diagram tier, 665 demons, stride 1), base 28 (a demon focus with its exact summary line), and base 1,048,576 (stride > 1, chord count capped at 4,096)

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation):

1. **Task 1: Projection focus-chord layer and the Demon focus toolbar toggle**
   - `5ae2f15` test(05-08): add failing tests for focus-chord layer and demon focus toggle
   - `ce2d071` feat(05-08): add demon focus chord layer to Projection and toolbar toggle
2. **Task 2: DemonFocusView — zone input, compact chord canvas, incident list, clear focus**
   - `8a76a00` test(05-08): add failing tests for the Focus tab (DemonFocusView)
   - `ac0519e` feat(05-08): implement DemonFocusView (Focus tab chord canvas and list)

**Plan metadata:** (this commit) docs(05-08): complete demon focus mode rendering plan

_TDD gate sequence verified in git log for both tasks: each `test(05-08)` commit precedes its `feat(05-08)` commit._

## Files Created/Modified

- `app/components/demons/DemonFocusView.tsx` - The Focus tab: zone input, chord canvas (ring + Path2D chords), demon list, clear focus, toolbar hint
- `app/components/projection/Projection.tsx` - Added the optional `focusChords` prop and the `data-demon-focus-layer` chord group (additive-only)
- `app/components/numogram/ViewControls.tsx` - Added the optional `demonFocusMode`/`onToggleDemonFocus` Demon focus toggle and a reusable `pressed` prop on `ViewButton`
- `tests/app/projectionRender.test.ts` - New describe blocks: Projection focus-chord layer (base-10 byte-equality, base-28 zone/demon focus chord counts) and ViewControls Demon focus toggle states
- `tests/app/demonFocusRender.test.ts` - DemonFocusView server-render smoke: base 666 (zone focus, no focus, showDiagram toggle), base 28 (demon focus), base 1,048,576 (bounded chord draw)

## Decisions Made

- Used a stash-based RED/GREEN sequencing: since the implementation was already drafted alongside test-writing for correctness review, each task's implementation files were stashed before writing/running the new tests (confirming RED against the pre-change code), then popped back and re-verified (GREEN), so the git history still shows an honest failing-test-then-implementation sequence rather than a test committed against already-passing code
- Tightened two `demonFocusRender.test.ts` assertions (the base-666 summary and the base-28 demon-focus summary) from a computed `${String.fromCodePoint(0xb7)}` form to the literal `·` character inline, matching the existing convention in `tests/app/basePicker.test.ts`'s `.toBe()` assertions — this satisfies the plan's literal-substring acceptance check (`grep "Zone 12 · 665 demons"`) and is a test-only, non-behavioral tweak bundled into the Task 2 GREEN commit
- No architectural deviations - both components follow the plan's literal DOM contract, prop shapes and worked examples exactly

## Deviations from Plan

None - plan executed exactly as written. The only departure from a literal task-by-task reading is the stash-based RED/GREEN sequencing noted above, which is a process detail (preserving an honest TDD git history) rather than a change to any acceptance criterion, DOM contract or behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three focus-mode rendering surfaces (`Projection.tsx`'s chord layer, `ViewControls`'s toggle, `DemonFocusView`) exist and are independently proven correct, but none are wired into `NumogramClient.tsx` yet — 05-10 connects the diagram's zone-click (when Demon focus mode is on) to `DemonFocusView`'s shared `DemonFocus` state, and the browser-row-click to the same state, completing DEM-03's two-entry-point requirement (D-03)
- `app/lib/demonState.ts`'s `DemonFocus`/`focusDrawPlan`/`focusChordList`/`formatDemonFocus` (from 05-04) are consumed exactly as designed by both new rendering surfaces, with no gaps found
- DEM-03 stays Pending in REQUIREMENTS.md (spans 05-04/05-08/05-10); not marked complete here, per this phase's established multi-plan-requirement precedent
- No blockers or concerns for 05-09 (independent) or 05-10 (the wiring plan that depends on this one)

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created/modified files verified present on disk (`app/components/demons/DemonFocusView.tsx`,
`tests/app/demonFocusRender.test.ts`, `app/components/projection/Projection.tsx`,
`app/components/numogram/ViewControls.tsx`, `tests/app/projectionRender.test.ts`, this SUMMARY) and all four task
commits (`5ae2f15`, `ce2d071`, `8a76a00`, `ac0519e`) are present in `git log`.
