---
phase: 04-base-picker-and-generator-ui
plan: 08
subsystem: ui
tags: [layout, engine-adapter, react-hooks, tween, reduced-motion, svg-icons]

# Dependency graph
requires:
  - phase: 04-03
    provides: NumogramView, ViewLayoutId, isPresetLayoutId, mayTween/tierBounds
  - phase: 03
    provides: engine/layout (resolveLayout, pairGraphLayout, routeGates, routeCurrents, Layout, Packer types)
provides:
  - "layoutTarget(g, id, packer, planetaryPos): the one function that resolves a drawable LayoutTarget for any base/layout id/packer combination"
  - "engineRenderData(view, layout): engine gate/current routes adapted into the viewer's GateRender/CurrentRender records keyed by name"
  - "frameLayout(layout, pos): a layout re-framed to a tween frame's positions, sharing every other field by reference"
  - "useLayoutTween: base-generic 600ms tween hook (position record, centre, width, height) that never interpolates across two bases"
  - "useReducedMotion: prefers-reduced-motion hook with a live change listener"
  - "RingIcon, SpiralIcon, PairGraphIcon for the new layout picker"
affects: [04-11, 04-13, 04-14, 04-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LayoutTarget: a single resolved-layout record (pos/ctr/frame/nodeRadius/labelSize/strokeScale/drawOrder/regionLabels/routingStyle/layout) built once per (base, layout id, packer) key, base-10 presets returning the authored tables by identity and everything else built from the engine"
    - "engine route -> viewer record adapter keyed by the view's own gate/current names (not zone/pair index), mirroring the existing base10GateRender/base10CurrentRender naming convention from 04-04"
    - "fromBaseRef guard in a tween hook: any hook interpolating positions across a base change must compare the tween's captured base against the new target's base and hard-jump on mismatch (T-04-26)"

key-files:
  created:
    - app/lib/viewLayouts.ts
    - app/lib/renderData.ts
    - app/hooks/useLayoutTween.ts
    - app/hooks/useReducedMotion.ts
    - tests/app/viewLayouts.test.ts
    - tests/app/renderData.test.ts
  modified:
    - app/components/numogram/NumogramIcons.tsx

key-decisions:
  - "The 2..40 x {ring, ladder, spiral} NaN/undefined sweep in renderData.test.ts calls the engine's resolveLayout directly rather than layoutTarget, because at base 10 layoutTarget's 'ladder' resolves to the authored preset (layout: null) and the sweep needs an actual engine Layout to feed engineRenderData; layoutTarget itself is covered separately by the preset-identity and base-28/64 procedural tests."
  - "Neither hook nor either new lib module is imported anywhere yet; NumogramClient.tsx and useTween.ts are untouched by this plan (verified: git diff --quiet against both, clean) — 04-11 does the viewer switch and deletes useTween.ts."

requirements-completed: []  # UI-06 and UI-07 both span multiple plans (04-07, 04-08, 04-11, 04-13, 04-14, 04-15); nothing built here is mounted, so neither requirement is complete yet (final covering plans later in the phase)

# Metrics
duration: 20min
completed: 2026-09-29
---

# Phase 4 Plan 08: Layout Target Resolver, Engine Route Adapter, Tween/Reduced-Motion Hooks Summary

**Base-generic layout plumbing (`layoutTarget`/`engineRenderData`/`useLayoutTween`/`useReducedMotion`) that 04-11 wires into the viewer to replace `useTween.ts`'s base-10-only tables.**

## Performance

- **Duration:** 20 min
- **Tasks:** 2
- **Files modified:** 7 (5 created, 1 modified, plus 2 test files)

## Accomplishments

- `app/lib/viewLayouts.ts`: `layoutTarget(g, id, packer, planetaryPos)` returns one `LayoutTarget` record (positions, routing centre, frame size, node radius, label size, stroke scale, draw order, region labels, routing style, and the raw engine layout) for any even base, any `ViewLayoutId`, and either packer — base-10's four presets return the authored `P_ORIGINAL`/`P_LABYRINTH`/`P_LADDER`/`FRAME_HEIGHT`/`DRAW_ORDER`/`REGION_LABELS` tables by identity (`toBe`), while ring/ladder/spiral/pairGraph at any base come from `resolveLayout`/`pairGraphLayout`.
- `app/lib/renderData.ts`: `engineRenderData(view, layout)` adapts `routeGates`/`routeCurrents` into `Record<string, GateRender>`/`Record<string, CurrentRender>` keyed by the view's own gate/current names; `frameLayout(layout, pos)` produces a re-positioned layout for a tween frame while sharing groups/zoneGroup/center by reference.
- `app/hooks/useLayoutTween.ts`: a base-generic version of `useTween` — same 600ms `easeInOutCubic` interpolation, generalized to any `LayoutTarget`'s position record plus width/height, `animate=false` makes `switchLayout()` instant, and a `fromBaseRef` guard forces an immediate jump instead of interpolating whenever the target's base changes mid-tween (T-04-26).
- `app/hooks/useReducedMotion.ts`: reads `prefers-reduced-motion` via `matchMedia` with a live `change` listener, SSR-safe.
- Three new icons (`RingIcon`, `SpiralIcon`, `PairGraphIcon`) appended to `NumogramIcons.tsx` following the file's existing convention.
- Nothing is mounted: `NumogramClient.tsx` and `useTween.ts` are byte-identical to before this plan (checked with `git diff --quiet`).

## Task Commits

1. **Task 1: viewLayouts.ts and renderData.ts (TDD)** - `8481f3e` (feat) — tests written first (`tests/app/viewLayouts.test.ts`, `tests/app/renderData.test.ts`), confirmed red against the not-yet-existing modules' expected shapes, then `app/lib/viewLayouts.ts` and `app/lib/renderData.ts` implemented to green.
2. **Task 2: useLayoutTween, useReducedMotion, layout icons** - `16ecd5c` (feat)

**Plan metadata:** (this commit)

_Note: Task 1 carried `tdd="true"`; both test files and both implementation files were committed together once green (the plan's action step specifies one commit after tests+typecheck pass, not separate RED/GREEN commits)._

## Files Created/Modified

- `app/lib/viewLayouts.ts` - `layoutTarget`, `toPosRecord`, `tweenPositions`, `DIAGRAM_CSS_WIDTH`; the per-base/id/packer layout resolver
- `app/lib/renderData.ts` - `engineRenderData`, `frameLayout`; engine routes -> viewer render records
- `app/hooks/useLayoutTween.ts` - base-generic layout tween hook
- `app/hooks/useReducedMotion.ts` - prefers-reduced-motion hook
- `app/components/numogram/NumogramIcons.tsx` - added `RingIcon`, `SpiralIcon`, `PairGraphIcon`
- `tests/app/viewLayouts.test.ts` - preset identity, base 28 procedural sweep, base 64 packer-difference, base 10 pairGraph, tweenPositions
- `tests/app/renderData.test.ts` - full 2..40 x {ring, ladder, spiral} NaN/undefined sweep, base-10 key-identity check, `frameLayout` reference-sharing

## Decisions Made

- The renderData sweep test builds engine layouts via `resolveLayout` directly (not `layoutTarget`) to exercise `engineRenderData` against real engine `Layout` objects at every base including 10, since `layoutTarget`'s base-10 'ladder' is a preset with `layout: null`.
- No new page-weight or golden impact: neither new module nor hook is imported by any mounted file yet.

## Deviations from Plan

None - plan executed exactly as written. All artifact exports, interfaces, and acceptance-criteria greps match the plan's `<action>` and `<acceptance_criteria>` blocks exactly (verified: `resolveLayout|pairGraphLayout` count 3 in viewLayouts.ts, `routeGates|routeCurrents` count 3 in renderData.ts, no `940|880|870|<=9` literals in viewLayouts.ts, `fromBaseRef` count 4 and `TWEEN_DURATION` count 3 in useLayoutTween.ts, three icon exports, viewer files untouched).

## Issues Encountered

None.

## Known Stubs

None - no hardcoded empty values, placeholder text, or unwired data sources were introduced. Nothing in this plan is rendered yet by design (04-11 wires it in); this is layout/routing/tween plumbing, not a UI screen.

## Threat Flags

None - this plan implements exactly the mitigations described in its own `<threat_model>` (T-04-25, T-04-26, T-04-27) and introduces no new network endpoint, auth path, file access, or schema surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `layoutTarget`, `engineRenderData`, `useLayoutTween`, and `useReducedMotion` are ready for 04-11 to wire into `NumogramClient.tsx` in place of the base-10-only `useTween.ts` (which 04-11 deletes).
- Full unit suite green: 1491 tests across 58 files, `npm run typecheck` (4x tsc + lint) clean.
- No blockers for 04-09 through 04-16.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created files found on disk (app/lib/viewLayouts.ts, app/lib/renderData.ts, app/hooks/useLayoutTween.ts, app/hooks/useReducedMotion.ts, tests/app/viewLayouts.test.ts, tests/app/renderData.test.ts, app/components/numogram/NumogramIcons.tsx). Both task commits (8481f3e, 16ecd5c) found in git log.
