---
phase: 05-demons-layer
plan: 09
subsystem: ui
tags: [react, demons, modal, accessibility, typescript]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-04)
    provides: "app/lib/demonState.ts: DemonTab/DEMON_TABS/DEMON_TAB_LABEL, DemonFocus/demonFocusOf"
  - phase: 05-demons-layer (05-06)
    provides: "app/components/demons/DemonBrowser.tsx: the Browser tab"
  - phase: 05-demons-layer (05-07)
    provides: "app/components/demons/DemonMatrix.tsx: the Matrix tab"
  - phase: 05-demons-layer (05-08)
    provides: "app/components/demons/DemonFocusView.tsx: the Focus tab"
provides:
  - "app/components/demons/DemonsOverlay.tsx: the D-01 overlay shell composing Browser/Focus/Matrix with a shared detail pane, focus trap and key isolation"
  - "app/components/info/InfoDisplay.tsx: exported DemonInfo that renders from g when view is null (base 666), with MESH/TYPE rows at every base"
  - "app/components/ui/CyberButton.tsx: optional role/selected/id/controls tab semantics, markup-identical by default"
  - "app/components/numogram/BigBaseSummary.tsx: exported Metric, reused verbatim for the overlay's Total readout"
affects: [05-10, 05-11, 05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DemonsOverlay reads only g/base/summary from useNumogramView (never view), so the overlay and every tab inside it work identically at base 666 where no SVG diagram exists"
    - "Only the active tab is mounted (tab === 'browser' && <DemonBrowser .../> etc.) so the matrix raster never runs while hidden"
    - "DemonRef -> legacy Demon adapter concentrated at one boundary inside DemonsOverlay (hoverDemon/selectDemon/pickDemon) rather than duplicated in each tab component"
    - "CyberButton's new tab props (role/selected/id/controls) all default to undefined so React emits nothing new for any existing call site, proven by a byte-for-byte markup-identity test captured from the unmodified component"
    - "DemonInfo falls back to zoneColorFor(g.cycleOfZone(z).kind) for zone color when view is null, instead of forking a second component for the no-view case"

key-files:
  created:
    - app/components/demons/DemonsOverlay.tsx
    - tests/app/demonsOverlayRender.test.ts
  modified:
    - app/components/ui/CyberButton.tsx
    - app/components/numogram/BigBaseSummary.tsx
    - app/components/info/InfoDisplay.tsx

key-decisions:
  - "Both tasks' test cases were written into tests/app/demonsOverlayRender.test.ts together in a single RED commit (0b1472f), then Task 1's shared primitives (CyberButton/Metric/DemonInfo) and Task 2's DemonsOverlay component were each committed as their own GREEN commit (0d41d14, 4a55dd5) — a documented process choice (not a scope change) since the plan's own DOM contract and worked examples for both tasks live in the one shared test file"
  - "createElement's children must be passed inside the props object, not as a third rest argument, when the target component's props type declares children as a required field (CyberButtonProps) — a test-only correction made during the RED phase, no production behavior affected"
  - "DemonInfo's authoritative ref (g.demons.ref(d.a, d.b)) is used only for the new MESH/TYPE rows; the existing kindClr/kindDesc still derive from the caller-supplied legacy d.kind, so base-10's exact lore-branch text and colors are unchanged"

patterns-established:
  - "A dedicated overlay shell scales ShortcutsModal's pattern (backdrop + centered bordered box + header + close) rather than CyberPanel, for surfaces that need real estate CyberPanel's ~300px width cannot give"

requirements-completed: []  # DEM-01..DEM-05 all span multiple 05-* plans (05-01/05-03/05-04/05-05/05-06/05-07/05-08/05-09/05-10/05-11 per their frontmatter); left Pending in REQUIREMENTS.md until each requirement's final covering plan (05-10 mounts the overlay into NumogramClient.tsx; 05-11/05-12 add e2e coverage), per this phase's established precedent (05-02, 05-03, 05-04, 05-06, 05-07, 05-08 SUMMARYs)

# Metrics
duration: 18min
completed: 2026-10-01
---

# Phase 5 Plan 9: Demons Overlay Shell, Shared Detail Pane and Primitive Extensions Summary

**DemonsOverlay (D-01): a scaled-up ShortcutsModal shell composing the Browser/Focus/Matrix tabs behind one Total readout and a shared detail pane, plus the exported DemonInfo that now works without a view model (base 666) and shows mesh/subtype everywhere.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-10-01T00:02:35Z
- **Completed:** 2026-10-01T00:20:07Z
- **Tasks:** 2 completed (each RED test commit + GREEN implementation commit)
- **Files modified:** 5 (1 component created, 1 test file created, 3 components extended)

## Accomplishments

- `CyberButton` gains optional `role`/`selected`/`id`/`controls` tab semantics (`role="tab"`, `aria-selected`, `id`, `aria-controls`, `tabIndex` 0/-1), all defaulting to `undefined` so every one of the app's existing call sites keeps byte-identical markup — proven by a test that pins the exact pre-change markup string for a default button and an active+shortcut button, captured from the unmodified component before editing it (T-05-31)
- `BigBaseSummary.tsx`'s `Metric` is now exported and reused verbatim for the overlay's "Total" readout
- `InfoDisplay.tsx`'s `DemonInfo` is now exported and no longer returns `null` when `view` is null: it reads `g.demons.ref(d.a, d.b)` for the authoritative mesh/subtype (never the caller-supplied legacy fields) and falls back to `zoneColorFor(g.cycleOfZone(z).kind)` for zone color when there is no view; both the base-10 lore branch and the generic branch gain `MESH`/`TYPE` `DataRow`s inside the existing `SectionFrame`, verified at base 666 (`15::3`, mesh `108`, `Cross-Torque chrono`), base 10 (`Lurgo`, mesh `0`, `Plex amphi`) and base 28 (`c::3`, mesh `69`, `Cyclic chrono`) (T-05-32)
- `DemonsOverlay.tsx` (D-01): the dedicated large modal — `z-[80]` backdrop below `ShortcutsModal`'s 84, `role="dialog"` with `aria-modal`, title + `Metric` Total count, close button, a `role="tablist"` of three `CyberButton`s (Browser/Focus/Matrix, exact UI-SPEC labels) and a shared `aside[data-demon-detail]` rendering `DemonInfo` for whichever demon is hovered or pinned (falling back to "Hover or click a demon to inspect it." when nothing is shown)
- Reads only `g`/`base`/`summary` from `useNumogramView()` — never `view` — so the overlay and every tab inside it work identically at base 666, where no SVG diagram or view model exists at all; only the active tab's component is ever mounted
- One boundary-adapter set (`hoverDemon`/`selectDemon`/`pickDemon`) converts every `DemonRef` crossing into the shared hover/pin state into the legacy `Demon` shape via `legacyDemon`; `selectDemon` (Browser row clicks, Matrix cell clicks) also sets the shared `DemonFocus` via `demonFocusOf`, while `pickDemon` (Focus tab list clicks) pins only, per D-03's two-direction contract
- Focus management (T-05-30): on mount the opener's `document.activeElement` is remembered and focus moves to the active tab button; on unmount, `onHoverInfo(null)` clears any stale hover and focus returns to the opener if it is still connected
- Modal keyboard isolation (T-05-31): `Escape` closes; `Tab`/`Shift+Tab` wraps focus between the dialog's first and last focusable elements; outside text inputs, any single printable key and `Cmd/Ctrl+Z/Y` are `preventDefault`'d so the hidden viewer's shortcut listeners (which all honor `e.defaultPrevented`) never fire while the overlay is open; `ArrowLeft`/`ArrowRight` on the tablist cycle tabs and move focus
- 12 new server-render tests in `tests/app/demonsOverlayRender.test.ts` (CyberButton markup identity + tab semantics, DemonInfo at bases 666/10/28, DemonsOverlay shell/tabs/detail-pane at bases 28/666/10); full `npm run verify` green (176 e2e passed, 106 skipped as expected by the two-timezone split, 60 goldens and the 5 behaviour specs unchanged, `check-repo` 13/13 including `base-ten`)

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation); both tasks' test cases were authored together in one RED commit since they share `tests/app/demonsOverlayRender.test.ts` (see Decisions Made):

1. **Task 1: Shared primitives — CyberButton tab props, exported Metric, DemonInfo without a view plus MESH/TYPE rows**
   - `0b1472f` test(05-09): add failing tests for shared primitives (CyberButton tabs, Metric export, DemonInfo without a view) — *also contains Task 2's DemonsOverlay test cases, which failed for the expected reason (missing component/export) at this commit*
   - `0d41d14` feat(05-09): add CyberButton tab props, export Metric, extend DemonInfo with mesh/type
2. **Task 2: DemonsOverlay — scaled modal shell, tabs, detail pane, focus trap and key isolation**
   - `4a55dd5` feat(05-09): add DemonsOverlay — scaled modal shell, tabs, detail pane, focus trap and key isolation

**Plan metadata:** (this commit) docs(05-09): complete demons overlay shell plan

## Files Created/Modified

- `app/components/demons/DemonsOverlay.tsx` - D-01 overlay shell: shell/backdrop/dialog, Total `Metric`, tablist, per-tab panel, shared detail pane, focus trap, key isolation
- `app/components/ui/CyberButton.tsx` - Optional `role`/`selected`/`id`/`controls` tab semantics, all undefined by default
- `app/components/numogram/BigBaseSummary.tsx` - `Metric` exported (no other change)
- `app/components/info/InfoDisplay.tsx` - `DemonInfo` exported, works without `view`, gains MESH/TYPE rows in both branches
- `tests/app/demonsOverlayRender.test.ts` - Server-render smoke for both tasks: CyberButton markup identity + tab semantics, DemonInfo at bases 666/10/28, DemonsOverlay shell/tabs/matrix/focus/detail-pane cases

## Decisions Made

- Both tasks' test cases live in one shared file per the plan's own `files` list (`tests/app/demonsOverlayRender.test.ts` is listed under both Task 1 and Task 2), so both tasks' `<behavior>` cases were written together into one RED commit before either task's implementation existed; Task 1's implementation and Task 2's implementation then each got their own GREEN commit. This preserves an honest RED-before-every-GREEN git history (the DemonsOverlay tests genuinely failed with "Element type is invalid" at the RED commit, since neither `DemonInfo` was exported nor `DemonsOverlay.tsx` existed yet) while matching the plan's literal task boundaries for the two `feat` commits.
- `createElement(CyberButton, {}, 'A')` does not type-check when `CyberButtonProps.children` is a required field (TS2769, "Property 'children' is missing"); the three test cases needing a text child were corrected to pass `children` inside the props object (`createElement(CyberButton, { children: 'A' })`) during the RED phase. This is a test-call-shape correction, not a change to `CyberButton`'s props contract or any production behavior.
- `DemonInfo`'s existing `kindClr`/`kindDesc` continue to derive from the caller-supplied legacy `d.kind` string exactly as before (not re-derived from the new authoritative `ref`), so base-10's existing lore-branch text, colors and the frozen behaviour baseline are byte-for-byte unaffected; only the two new `DataRow`s use `ref.mesh`/`ref.subtype`.

## Deviations from Plan

None beyond the two test-only corrections documented above as Decisions (no production code behavior changed from what the plan specified).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DemonsOverlay` exports `{ DemonsOverlay, DemonsOverlayProps }` exactly per the plan's interface contract and is ready for 05-10 to mount into `NumogramClient.tsx` behind a new header entry-point button, wiring `isMobile`/`tab`/`filter`/`focus`/`hoverInfo`/`pinnedInfo` to the existing shared state (`onHoverInfo`/`onPinInfo` already match the app-wide contract; `onTabChange`/`onFilterChange`/`onFocusChange`/`onClose` are new state 05-10 introduces)
- `DemonInfo`'s export and its MESH/TYPE rows are consumed identically by the Selection panel's existing pin/hover flow (unchanged call site in `InfoDisplay`'s own `renderInfoContent`) and by `DemonsOverlay`'s detail pane — no second detail-rendering path exists anywhere in the demons layer
- DEM-01..DEM-05 all stay Pending in REQUIREMENTS.md (05-10 is the viewer-wiring plan that actually makes the overlay reachable from the running app; 05-11/05-12 add e2e coverage) — no blocker, just sequencing, matching this phase's established multi-plan-requirement precedent
- No blockers or concerns for 05-10

---
*Phase: 05-demons-layer*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: app/components/demons/DemonsOverlay.tsx
- FOUND: tests/app/demonsOverlayRender.test.ts
- FOUND: app/components/ui/CyberButton.tsx (modified)
- FOUND: app/components/numogram/BigBaseSummary.tsx (modified)
- FOUND: app/components/info/InfoDisplay.tsx (modified)
- FOUND: .planning/phases/05-demons-layer/05-09-SUMMARY.md
- FOUND commit: 0b1472f (test, Task 1+2 RED)
- FOUND commit: 0d41d14 (feat, Task 1 GREEN)
- FOUND commit: 4a55dd5 (feat, Task 2 GREEN)
