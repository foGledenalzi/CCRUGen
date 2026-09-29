---
phase: 04-base-picker-and-generator-ui
plan: 13
subsystem: ui
tags: [react, region-legend, url-codec, svg-projection, accessibility]

# Dependency graph
requires:
  - phase: 04-base-picker-and-generator-ui
    provides: "04-03's region identity + independent isolate/mute RegionFilter model (app/lib/regions.ts) and 04-05's ShareState isolate/mute fields; 04-12's base-switch reset and RegionsPanel widening"
provides:
  - "Base-generic region legend (RegionsPanel.tsx) rendering regionRows(g) for any base, with per-row Isolate/Mute toggles"
  - "Projection.tsx and PairGraphProjection.tsx isolate (dim)/mute (hard-hide) rendering wired from one zoneStateArr"
  - "isolate=/mute= carried in the URL, undo/redo history and cleared on base switch (UI-08)"
affects: [05-demons-layer, 06-tiered-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Region legend rows are data-driven from the engine's Cycle[] via regionRows(g), never a hard-coded 3-row union"
    - "Render-filter contract: a single Uint8Array (0 hidden/1 dimmed/2 normal) computed once in NumogramClient and passed to both diagram components; null means 'render exactly as before'"

key-files:
  created:
    - app/lib/regions.ts (RegionFilter/zoneStates/elementState already existed from 04-03; this plan is the first consumer)
    - e2e/region-legend.spec.ts
  modified:
    - app/components/panels/RegionsPanel.tsx
    - app/components/numogram/NumogramIcons.tsx
    - app/NumogramClient.tsx
    - app/lib/baseSwitch.ts
    - tests/app/baseSwitch.test.ts
    - app/components/projection/Projection.tsx
    - tests/app/projectionRender.test.ts
    - perf/page-weight.baseline.json

key-decisions:
  - "Row order stays Torque, Warp, Plex (UI-SPEC calls Plex/Warp placement presentational); single-cycle label stays 'Torque' so base 10's legend text is byte-identical to the frozen goldens/behaviour baseline"
  - "Isolate/mute buttons are icon-only with data-post-baseline so the frozen behaviour-baseline text sweep (which excludes post-baseline subtrees) never changes for base 10"
  - "Projection's zoneStates/pairStates render filter reuses the exact existing dim opacity constants (dimOpacity, 0.03/0.1/0.2) rather than inventing new levels, per the UI-SPEC's 'never invent new levels' rule"

requirements-completed: [UI-05]

# Metrics
duration: ~55min (session interrupted by a rate limit mid-task and resumed)
completed: 2026-09-29
---

# Phase 4 Plan 13: Region Legend with Isolate/Mute Summary

**Base-generic region legend (any base's Torque/Warp/Plex cycles) with independent per-row Isolate (spotlight) and Mute (hard-hide) toggles, rendered in both the SVG projection and the pair-graph view, round-tripped through the URL and undo/redo history.**

## Performance

- **Duration:** ~55 min total (interrupted mid-task by a session rate limit, resumed from in-progress uncommitted state)
- **Completed:** 2026-09-29T16:30:08Z
- **Tasks:** 2
- **Files modified:** 9 (7 source/test files + 1 new e2e spec + 1 page-weight baseline)

## Accomplishments
- `RegionsPanel.tsx` rewritten to list every region of any base (`regionRows(g)`: Torque cycles in canonical order, then Warp, then Plex) with two independent 24px Isolate/Mute buttons per row (`aria-pressed`, `data-post-baseline`), a scrollable list past 8 rows (D-20), and base-10's exact frozen row text/hover lore preserved via a `view.lore !== null` branch
- `Projection.tsx` gained a `zoneStates: Uint8Array | null` prop driving a hide (opacity-omitted skip)/dim (`opacity=0.2` or the existing focus-dim constants) rule reused identically across zones, syzygies, currents (+labels), gates (+meeting labels), demons, both particle layers and the Time Circuit overlay — a null filter reduces every rule to the pre-existing always-normal behaviour
- `NumogramClient.tsx` computes one `zoneStateArr` from the region filter and threads it into `Projection` (`zoneStates`) and `PairGraphProjection` (`pairStates`, keyed by pair id = low zone, since both members of a pair always share a region)
- `isolate=`/`mute=` extend the existing URL codec, undo/redo history (`HistorySnapshot`) and `app/lib/baseSwitch.ts`'s `sessionAfterBaseSwitch`, so the filter is shareable, undoable and unconditionally cleared on a base change (UI-08)
- `e2e/region-legend.spec.ts` (6 tests) proves the contract at base 64 (row order/labels/button coverage, isolate, multi-isolate, mute-wins-over-isolate, independence, reload persistence), base 12 (stale-id dropping), base 10 (unchanged legend text) and base 28's pair graph (muted pair removal)

## Task Commits

Each task was committed atomically:

1. **Task 1: Region legend with isolate/mute buttons, filter state in URL, history and base-switch reset** - `471547b` (feat)
2. **Task 2: Filter rendering in Projection and the pair graph, and the region-legend e2e spec** - `754d309` (feat)

**Page-weight baseline (required by Task 2's own verify step):** `28aa364` (chore)

_Note: Task 1 was TDD-flavored per its `tdd="true"` flag — `tests/app/baseSwitch.test.ts` was extended alongside `app/lib/baseSwitch.ts` and verified failing-then-passing before the single task commit, per the plan's own explicit single-commit action step._

## Files Created/Modified
- `app/components/panels/RegionsPanel.tsx` - Rewritten as a base-generic region legend with Isolate/Mute buttons
- `app/components/numogram/NumogramIcons.tsx` - New `IsolateIcon`/`MuteIcon`
- `app/NumogramClient.tsx` - `regionFilter` state, URL hydration/share/history round-trip, `zoneStateArr` memo threaded to both diagrams, base-switch reset
- `app/lib/baseSwitch.ts` - `SessionResetState` gains `isolate`/`mute`, both reset to `[]`
- `tests/app/baseSwitch.test.ts` - Extended for the new fields plus a dedicated isolate/mute-clearing test
- `app/components/projection/Projection.tsx` - `zoneStates` prop and the hide/dim rendering rule across every layer
- `tests/app/projectionRender.test.ts` - Passes the new required `zoneStates` prop (pre-existing test outside this plan's file list, fixed as a Rule 3 blocking issue)
- `e2e/region-legend.spec.ts` - New spec, 6 tests
- `perf/page-weight.baseline.json` - Raised for `/numogram/`'s new client-bundle weight (+4,148 bytes raw / +523 gzip)

## Decisions Made
- Kept row order Torque/Warp/Plex and the single-cycle 'Torque' label exactly as before, so base 10's legend text and the frozen DOM goldens/behaviour baseline needed zero changes
- Reused the plan's literal object-shape guidance for `RegionsPanel.tsx`'s item-building closure verbatim (including that a highlighted+muted row keeps full color per the `active` ternary, muted forcing only the `inactiveColor`/strike-through, not overriding `active`'s color choice) rather than inventing a different precedence
- Split the single continuous edit session into two commits matching the plan's task boundaries exactly (Task 1 stops before touching `Projection.tsx` or wiring `zoneStates`/`pairStates`; Task 2 owns all of that) by stashing/reapplying the Task-2-only hunks before each commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated a pre-existing test file for the new required Projection prop**
- **Found during:** Task 2 (adding the required `zoneStates` prop to `ProjectionProps`)
- **Issue:** `tests/app/projectionRender.test.ts` (from 04-09, not in this plan's file list) calls `createElement(Projection, {...})` directly with a full prop object; adding a new required prop broke its type-check
- **Fix:** Added `zoneStates: null` to both call sites (base-10 preset render and the procedural-ring sweep over bases 2..40)
- **Files modified:** tests/app/projectionRender.test.ts
- **Verification:** `npm run typecheck` clean; the file's own tests still assert no NaN/undefined and correct zone/gate counts
- **Committed in:** 754d309 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the build green; no scope creep — the fix is a one-line prop addition per call site, not a behavior change.

## Issues Encountered
- The execution session was cut off mid-task by a rate limit after Projection.tsx's prop/import were added but before its rendering-rule edits were applied. Resumed by re-reading `git status`/`git diff` to confirm exact prior state, then continuing from the last completed edit — no work was lost or redone.
- Task 1 and Task 2 both touch `app/NumogramClient.tsx`, and both were implemented in one continuous editing pass before either was committed. To keep commits matching the plan's task boundaries, the Task-2-only hunks (the `zoneStateArr` memo and the `zoneStates`/`pairStates` prop-passing, plus all of `Projection.tsx`) were temporarily shelved (`git stash push --keep-index`) and the import list trimmed back to Task-1-only symbols, so Task 1's own commit and its `npm run test:swap` verification ran against exactly the tree the plan describes for Task 1; the stash was then restored and the three hunks reapplied for Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- UI-05 is complete (region legend with stable-id isolate/mute at any base). Remaining Phase 4 plans (04-14, 04-15, 04-16) cover UI-06 (layer toggles/zoom/pan/fit), UI-07 (accessibility/text view) and the final MIG-02 grep-gate promotion respectively — none are blocked by this plan.
- `app/lib/regions.ts`'s `RegionFilter`/`zoneStates`/`elementState` primitives (built in 04-03) now have their first and only consumer; no further generalization needed there.
- No blockers.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three commits (471547b, 754d309, 28aa364) confirmed in `git log`. `npm run verify` green on the committed tree (122 e2e passed, 52 skipped by design, check-repo 12/12 including clean-tree/static-out); `git status --porcelain e2e/__golden__ e2e/__behaviour__` empty (60 DOM goldens and the 5-file behaviour baseline unchanged).
