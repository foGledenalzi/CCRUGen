---
phase: 05-demons-layer
plan: 06
subsystem: ui
tags: [react, demons, virtualization, search, typescript]

# Dependency graph
requires:
  - phase: 05-01
    provides: "app/lib/demonBrowser.ts: facetModel, DemonFilter/DemonSort, rowSourceFor/orderedSource, DEFAULT_DEMON_SORT"
  - phase: 05-03
    provides: "app/lib/demonSearch.ts: clampQuery/resolveDemonSearch/searchMessage/emptyFilterMessage"
  - phase: 05-05
    provides: "app/components/demons/DemonRowList.tsx: windowed, sortable, keyboard-accessible four-column grid"
provides:
  - "app/components/demons/DemonFacets.tsx: 2-level-disclosure clickable facet chips that are both the count display and the filter (D-05)"
  - "app/components/demons/DemonBrowser.tsx: the Browser tab (facets + search + sortable virtualized list + empty/status states), the main surface of ROADMAP success criteria 1/2/5"
affects: [05-08, 05-09, 05-10, 05-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filter/sort state owned by DemonBrowser, source recomputed via orderedSource(rowSourceFor(g, filter, sort.key), sort.direction) - never a materialized array"
    - "Search reveal state ({index, nonce}) decoupled from the search outcome itself: a fresh 'found' outcome bumps nonce automatically, Enter re-bumps it manually, filter/sort changes clear it"
    - "DemonRowList is remounted (React key = base|filter|sort) on any filter/sort change so its internal scroll/page state always starts fresh"

key-files:
  created:
    - app/components/demons/DemonFacets.tsx
    - app/components/demons/DemonBrowser.tsx
    - tests/app/demonBrowserRender.test.ts
  modified: []

key-decisions:
  - "renderToStaticMarkup writes the JSX prop name literally (maxLength), not the lowercase HTML attribute (maxlength) the plan's DOM contract describes - that lowercasing only happens when a real browser's HTML parser processes the markup (the e2e/live-DOM case). The RED test's literal assertion was corrected from maxlength=\"64\" to maxLength=\"64\" to match actual SSR output; the component prop itself is unchanged (maxLength={SEARCH_MAX_LENGTH})."

patterns-established:
  - "2-level facet disclosure (top type row + nested subtype row under the active type) reusing RegionsPanel's exact rgba(16,255,80,0.08)/inset-shadow active token, never inventing a second selection color"

requirements-completed: []  # DEM-01/DEM-02/DEM-05 span multiple 05-* plans (05-01, 05-03, 05-04, 05-05, 05-06, 05-09, 05-10, 05-11 per their frontmatter); left Pending in REQUIREMENTS.md until each requirement's final covering plan, per this project's established Phase 4/5 precedent

# Metrics
duration: 35min
completed: 2026-09-30
---

# Phase 5 Plan 6: Demon Browser Tab (Facets, Search, Sort, Virtualized List) Summary

**DemonFacets (D-05 closed-form facet chips that are the filter) and DemonBrowser (facets + search + sortable virtualized list + empty/status states) — the Browser tab, reading `g` directly so it works identically at base 666 where no SVG diagram exists.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed (Task 1: DemonFacets; Task 2: DemonBrowser, TDD RED then GREEN)
- **Files modified:** 3 (2 components created, 1 test file created)

## Accomplishments

- `DemonFacets`: 2-level disclosure of closed-form facet chips (`facetModel(g, filter)`, never a loop over demons) — top row All/Chrono/Amphi/Xeno, nested subtype row under whichever type is active; clicking a chip is the filter itself (an already-active chip clears back to its parent); zero-count chips (e.g. `cross-torque-chrono` at base 10) stay visible at 40% opacity with `aria-disabled="true"` and do nothing on click
- `DemonBrowser`: facets + a right-aligned search field (`maxLength=64` plus `clampQuery` on every keystroke, T-05-20) + a sortable virtualized `DemonRowList` + empty-filter/search-status copy, all reading `g` and the 05-01/05-03 data layer directly
- Verified exactly: base 28 filter `chrono` shows 378/276/108/12 chip counts and a 277-row grid (`aria-rowcount`); base 666 shows 221,445 with no subtype row; base 666 filter `warp-amphi` (no Warp pair at 666) renders the empty state with the exact UI-SPEC copy and no grid; base 10 filter `chrono` disables the `cross-torque-chrono` chip (single Torque cycle)
- A search hit reveals (scrolls to + marks) its row automatically; Enter re-reveals the current hit; filter/sort changes remount `DemonRowList` (React key) and clear any stale reveal target
- 4 new server-render tests plus the existing 7 `DemonRowList` tests all green (11/11); full project suite green at 1,697 tests across 70 files (no regressions, including the previously-flaky `demonMatrix.test.ts` property test, which passed cleanly on this run)

## Task Commits

1. **Task 1: DemonFacets** - `c870c60` (feat)
2. **Task 2: DemonBrowser (TDD)** - RED `0cc4716` (test) -> GREEN `71093f3` (feat)

_TDD gate sequence verified in git log: test commit (`0cc4716`) precedes the feat commit (`71093f3`)._

**Plan metadata:** (this commit) docs(05-06): complete demon browser tab plan

## Files Created/Modified

- `app/components/demons/DemonFacets.tsx` - `DemonFacets`/`DemonFacetsProps`: closed-form facet chips, 2-level disclosure, click-to-filter
- `app/components/demons/DemonBrowser.tsx` - `DemonBrowser`/`DemonBrowserProps`: facets + search + sort + virtualized list + empty/status states
- `tests/app/demonBrowserRender.test.ts` - Server-render assertions for chip counts/disabled state, search field DOM contract, sortable grid rowcount, empty-filter and outside-filter copy at bases 10/28/666

## Decisions Made

- **Test-literal correction (not a component change):** `renderToStaticMarkup` writes React's `maxLength` prop name literally into the output string; only a real browser's HTML parser lowercases it to `maxlength` (the form the plan's `<interfaces>` DOM contract and any future e2e spec against a live page would see). Corrected the RED test's assertion from `maxlength="64"` to `maxLength="64"` before GREEN; the component itself still declares `maxLength={SEARCH_MAX_LENGTH}` exactly as the plan specifies (`grep -c "maxLength={SEARCH_MAX_LENGTH}"` = 1).

No other decisions beyond the plan's literal specification (component shapes, onChip mapping rules, layout, copy sources) were needed.

## Deviations from Plan

None beyond the test-literal correction above (documented as a Decision, not a Rule 1-4 deviation, since no production code behavior changed — only a test assertion was corrected to match `renderToStaticMarkup`'s actual, well-documented output format).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DemonBrowser` is ready to be mounted by the demons overlay (05-09), which supplies `filter`/`onFilterChange` (shared with URL state per D-07), `selectedMesh`, and `onHoverDemon`/`onSelectDemon` (wired to the shared `InfoDisplay` detail panel via the `DemonRef` -> legacy `Demon` adapter from 05-01)
- `DemonFacets` is also directly reusable wherever a facet-chip row is needed outside the Browser tab (none currently planned, but the component takes no browser-specific state)
- DEM-01/DEM-02/DEM-05 stay Pending in REQUIREMENTS.md: this plan ships the Browser tab, but DEM-02 in particular still needs 05-09 (overlay mount), 05-10 (URL state wiring) and 05-11 (e2e coverage) before its final covering plan closes it out
- No blockers or concerns for 05-08 (Focus tab, no file overlap with this plan per the wave-3 note)

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created files exist on disk (`app/components/demons/DemonFacets.tsx`, `app/components/demons/DemonBrowser.tsx`,
`tests/app/demonBrowserRender.test.ts`, this SUMMARY) and all three task commits (`c870c60`, `0cc4716`, `71093f3`)
are present in `git log`.
