---
phase: 05-demons-layer
plan: 10
subsystem: ui
tags: [react, demons, url-codec, state, nextjs]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-04)
    provides: "app/lib/demonState.ts: DemonFocus/DemonTab model, demonsAfterBaseSwitch, focusChordList/focusZones, URL tokens"
  - phase: 05-demons-layer (05-08)
    provides: "Projection.tsx focusChords prop, ViewControls demonFocusMode/onToggleDemonFocus toggle"
  - phase: 05-demons-layer (05-09)
    provides: "app/components/demons/DemonsOverlay.tsx: the Browser/Focus/Matrix overlay shell"
provides:
  - "app/NumogramClient.tsx: demon state (demonsOpen/demonTab/demonFilter/demonFocus/demonFocusMode), header entry point, overlay mount, focus mode on zone clicks, focus chords + zone highlights into Projection, demonFilter=/demonFocus=/demonsOpen= URL hydration and sync, base-switch reset, Escape handling"
  - "app/components/panels/LayersPanel.tsx: D-04 pointer from the Pandemonium-unavailable text to 'Browse demons'"
affects: [05-11, 05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The header entry point and the overlay mount are driven by g alone and sit outside every showDiagram-gated block, proven both structurally (grep -B15 for showDiagram above the button) and at runtime (base=666, no SVG diagram, still opens the overlay with the correct demon count)"
    - "onZoneNodeClick branches on demonFocusMode first (D-03 diagram-to-browser entry point) and falls through to the pre-existing selection toggle unchanged when the mode is off, so the behaviour baseline and hover-pin specs stay green"
    - "Demon state (filter/focus/open/tab/mode) is deliberately excluded from HistorySnapshot/undo-redo (browse state, like zoom), but does flow through currentShareState/URL sync and through demonsAfterBaseSwitch on every committed base change"

key-files:
  created: []
  modified:
    - app/NumogramClient.tsx
    - app/components/panels/LayersPanel.tsx
    - perf/page-weight.baseline.json

key-decisions:
  - "Page-weight baseline raised (reason 'Phase 5 plan 05-10: demons layer mounted...'): /numogram/ jsBytes 659,795 -> 726,294 (+66,499 raw, +10.1%), jsGzip 198,957 -> 218,587 (+19,630 gzip, +9.9%); htmlBytes/cssBytes grew by a few hundred bytes (the new header button markup and its CSS). This is the first commit where TanStack Virtual and every app/components/demons/*.tsx component actually ship to a visitor, since nothing imported DemonsOverlay before this plan. domNodesTotal (6,405) is unchanged — the 60 frozen DOM goldens are untouched."
  - "The URL-hydration pin for a demon focus calls createNumogram(state.base) a second time (independent of the existing region/tc gForBase local) rather than hoisting a shared variable, since the two call sites are in different conditional branches and createNumogram is itself cached (LRU 4 entries) — a second call is a cache hit, not a second build"

patterns-established: []

requirements-completed: [DEM-01, DEM-02, DEM-03, DEM-04, DEM-05]

# Metrics
duration: ~15min
completed: 2026-10-01
---

# Phase 5 Plan 10: Demons Layer Viewer Wiring Summary

**The demons layer becomes reachable in the running app: a header "Browse demons" button (works at base 666, where no SVG diagram exists), the DemonsOverlay mounted behind it, bidirectional focus mode between diagram zone-clicks and the overlay's Browser/Focus/Matrix tabs, full demonFilter=/demonFocus=/demonsOpen= URL round-tripping, and a UI-08-style base-switch reset — all five DEM requirements closed.**

## Performance

- **Duration:** ~15 min (context/read time plus 2 task commits spanning 00:25-00:33 UTC, plus runtime verification and this summary)
- **Started:** 2026-10-01T00:21:35Z
- **Completed:** 2026-10-01T00:33:31Z
- **Tasks:** 2 completed
- **Files modified:** 3 (app/NumogramClient.tsx, app/components/panels/LayersPanel.tsx, perf/page-weight.baseline.json)

## Accomplishments

- `app/NumogramClient.tsx` gains `demonsOpen`/`demonTab`/`demonFilter`/`demonFocus`/`demonFocusMode` state, `onDemonFocusChange`/`onToggleDemonFocus`/`onCloseDemons` callbacks, and imports `DemonsOverlay`/`DemonsIcon`/`demonState.ts`'s exports
- `currentShareState` now carries the live demon fields (replacing 05-04's three static placeholders) so the share button and the URL-sync effect both reflect the actual filter/focus/open state (D-07)
- `commitBase` batches `demonsAfterBaseSwitch` into its existing single-render UI-08 reset: the focus always clears, the filter survives only if it still has members at the new base
- URL hydration restores filter/focus/mode/tab from `parseShareParams`'s already-range-checked output and pins a demon focus (`state.demonFocus.kind === 'demon'`) via `legacyDemon(gForDemonFocus.demons.ref(a, b), base)`
- Escape closes the demons overlay first (before falling through to clearing selection), and clearing selection now also clears any demon focus (a no-op when there is none, so the frozen behaviour baseline's Escape presses are unaffected)
- Header "Browse demons" icon button mounted immediately after Share, **outside every `showDiagram` block**, `data-post-baseline` so it never perturbs the frozen behaviour baseline's header-row text sweep
- `DemonsOverlay` mounted at `{demonsOpen && (...)}` as a sibling after `SourcesFooter`, unmounted (zero DOM) when closed
- `onZoneNodeClick` branches on `demonFocusMode`: when on, clicking a zone sets/clears a zone focus and switches the overlay to the Focus tab (D-03 diagram-to-browser); when off, the body is byte-identical to the prior toggle
- `focusChords` (`useMemo`, bounded via `focusChordList`) passed to `<Projection>`; `hlZones` now also includes `focusZones(demonFocus)`, so a focused zone or a focused demon's two zones highlight in the diagram and `anyFocus` dims the rest
- `ViewControls` gains the `demonFocusMode`/`onToggleDemonFocus` toggle (still inside `{showDiagram && ...}`, since this toggle only acts on the mounted diagram)
- `LayersPanel.tsx`'s Pandemonium-unavailable text now reads "Demon chords are drawn up to {allChordsMaxN} zones (legibility limit). Use Browse demons (header) for focus, matrix and search." (D-04)
- Page-weight baseline raised with a dated reason (`node scripts/page-weight.mjs update --reason "Phase 5 plan 05-10: ..."`) after `check:weight` failed only on `/numogram/`'s intended `jsBytes`/`jsGzip` growth from the now-bundled demons components; DOM-node counts (frozen goldens) unchanged
- Full regression run green against the static export: 60 DOM goldens, all 5 behaviour specs, `url-codec`, `base-switch-reset`, `hover-pin`, `layers-zoom`, `base-picker`, `accessibility`, `region-legend`, `smoke-bases` (156 passed, 96 skipped by the expected two-timezone split, 0 failed); `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` empty throughout
- Runtime-proved the plan's critical rule with an ad-hoc Playwright check (written, run, then deleted — never committed): at `?base=666` (no `[data-diagram]` present, only the `BigBaseSummary`), the "Browse demons" button is visible and clickable, the overlay opens showing the correct `221,445` demon total, and Escape closes it

## Task Commits

1. **Task 1: Demon state, URL hydration/sync, base-switch reset and Escape handling**
   - `98055b4` feat(05-10): add demon state, URL hydration/sync, base-switch reset and Escape handling
2. **Task 2: Header entry point, overlay mount, focus mode on zone clicks, focus chords and highlights, toolbar toggle, D-04 pointer, page weight and regression run**
   - `cda42f3` feat(05-10): mount demons entry point, overlay, focus-mode wiring and D-04 pointer

**Plan metadata:** (this commit) docs(05-10): complete demons layer viewer wiring plan

## Files Created/Modified

- `app/NumogramClient.tsx` - Demon state, header button, overlay mount, focus-mode zone clicks, focus chords/highlights, URL hydration/sync, base-switch reset, Escape handling
- `app/components/panels/LayersPanel.tsx` - Pandemonium-unavailable copy now points to "Browse demons" (D-04)
- `perf/page-weight.baseline.json` - Raised with a dated, plan-attributed reason for the now-bundled demons components

## Decisions Made

- Page-weight baseline raise is this plan's own growth only (TanStack Virtual + `app/components/demons/*` finally reachable from the bundle analyzer's perspective since `DemonsOverlay` is now imported and conditionally rendered) — see key-decisions above for the exact byte deltas
- No architectural deviations - implementation followed the plan's literal task steps, interface contract and acceptance criteria exactly

## Deviations from Plan

None - plan executed exactly as written. Every numbered sub-step in both tasks' `<action>` blocks was applied verbatim (import list, state hooks, `currentShareState`/`commitBase`/URL-hydration edits, the three new callbacks, the Escape branch, the header button, the overlay mount, `onZoneNodeClick`, `focusChords`/`hlZones`, the `ViewControls` toggle, and the `LayersPanel.tsx` copy change).

## Issues Encountered

None. `npm run typecheck` (4x tsc + lint) was clean except one pre-existing, unrelated warning in `app/components/demons/DemonMatrix.tsx` (a `react-hooks/exhaustive-deps` ref-cleanup warning from 05-07, outside this plan's file list and out of scope per the deviation rules' scope boundary — not touched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five DEM requirements (DEM-01..DEM-05) are now satisfied end-to-end in the running app: facets/browser/search (05-01/05-03/05-06), the matrix (05-02/05-07), focus mode both directions (05-04/05-08, now wired both ways here), and base-10 names (05-01) are all reachable through the header button at every base, including above the SVG tier
- `05-11`/`05-12` (not yet executed) add dedicated e2e coverage for the demons layer; this plan's own ad-hoc runtime check (written and deleted, not committed) already proved the base-666 critical rule holds, but a permanent spec is still 05-11/05-12's job
- No blockers or concerns: the full regression suite (60 goldens, 5 behaviour specs, 9 other existing e2e specs) passed unchanged, frozen directories untouched, and the page-weight baseline raise is isolated to this plan's own growth with a dated ledger entry

---
*Phase: 05-demons-layer*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: app/NumogramClient.tsx (modified)
- FOUND: app/components/panels/LayersPanel.tsx (modified)
- FOUND: perf/page-weight.baseline.json (modified)
- FOUND: .planning/phases/05-demons-layer/05-10-SUMMARY.md
- FOUND commit: 98055b4 (feat, Task 1)
- FOUND commit: cda42f3 (feat, Task 2)
