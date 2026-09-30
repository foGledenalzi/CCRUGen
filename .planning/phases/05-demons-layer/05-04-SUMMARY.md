---
phase: 05-demons-layer
plan: 04
subsystem: ui
tags: [state, url-codec, typescript, engine, demons]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-01)
    provides: "app/lib/demonBrowser.ts: isDemonFilter, facetCount, incidentSource, legacyDemon, DemonFilter"
  - phase: 04-base-picker-and-generator-ui
    provides: "app/lib/shareParams.ts: ShareState/parseShareParams/buildShareParams single URL codec, app/lib/baseSwitch.ts UI-08 sanitation precedent"
provides:
  - "app/lib/demonState.ts: DemonFocus/DemonTab model shared by the diagram-to-browser and browser-to-diagram entry points (D-03), URL tokens (formatDemonFocus/parseDemonFocus/parseDemonFilter), bounded focusChordList/focusDrawPlan (FOCUS_CHORD_DRAW_MAX=4096), demonsAfterBaseSwitch (UI-08 precedent), initialDemonTab"
  - "app/lib/shareParams.ts extended with demonFilter=/demonFocus=/demonsOpen=1 (D-07), each independent of the other two"
affects: [05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared DemonFocus discriminated union ({kind:'zone',zone} | {kind:'demon',a,b}, a>b normalized) consumed by every focus entry point, so diagram-click and browser-row-click can never drift into two different focus shapes"
    - "URL tokens for a new feature follow the same regex-gate-then-range-check discipline as every other lenient field in shareParams.ts (parseDemonFocus/parseDemonFilter never throw, never use raw input as a property key)"
    - "D-07 independence: demonsOpen=1 is written/read with no coupling to demonFilter/demonFocus presence, preserving parse(build(state)) === state for every field combination"
    - "focusChordList strides through incidentSource (O(1) at(k)) rather than enumerating g.demons.incident(zone) directly, so a huge base's chord list is capped at FOCUS_CHORD_DRAW_MAX without ever materializing base-1 entries"

key-files:
  created:
    - app/lib/demonState.ts
    - tests/app/demonState.test.ts
  modified:
    - app/lib/shareParams.ts
    - tests/app/shareParams.test.ts
    - app/NumogramClient.tsx

key-decisions:
  - "demonsOpen=1 is written exactly when the overlay is open, independent of filter/focus state (Claude's discretion per D-07, confirmed by this plan's own note): the UI-SPEC's tentative 'only when a filter or focus is active' coupling was rejected because it would break the codec's round-trip property for the demonsOpen-alone case"
  - "focusDrawPlan's stride formula (Math.max(1, Math.ceil(total / FOCUS_CHORD_DRAW_MAX))) guarantees drawn <= FOCUS_CHORD_DRAW_MAX at any base, verified exactly at base 2^20 (drawn = 4096, the boundary case) and structurally at base 2^26 territory via the same formula"
  - "demonsAfterBaseSwitch always clears focus (a zone id or demon pair may not exist at the new base) but keeps a filter only when facetCount(next, prev.filter) > 0, mirroring baseSwitch.ts's existing UI-08 pattern rather than inventing a new one"

patterns-established:
  - "Demon-related URL fields extend shareParams.ts's existing omit-at-default / lenient-per-field / never-throw contract exactly, with no special-casing for the new feature"

requirements-completed: []  # DEM-02 spans 05-01/05-03/05-04/05-05/05-06/05-09/05-10/05-11; DEM-03 spans 05-04/05-08/05-10; both left Pending in REQUIREMENTS.md until their final covering plan, per this project's established Phase 4 precedent

# Metrics
duration: 10min
completed: 2026-09-30
---

# Phase 5 Plan 4: Demon Focus/Tab Model and URL State Summary

**Shared `DemonFocus` model (`app/lib/demonState.ts`) consumed by both focus-mode entry points, a chord list bounded at 4,096 entries via strided `incidentSource` access at any base up to 2^20, the UI-08-style base-switch sanitation rule, and the single URL codec extended with `demonFilter=`/`demonFocus=`/`demonsOpen=1`, each independent of the other two.**

## Performance

- **Duration:** ~10 min (context/read time plus 4 commits spanning 21:10:03-21:14:04 local)
- **Tasks:** 2 completed (each RED test commit + GREEN implementation commit)
- **Files modified:** 5 (2 implementation files created/extended, 2 test files created/extended, 1 compile-fix touch)

## Accomplishments

- `DemonFocus` (zone or demon, `a > b` always normalized via `demonFocusOf`), `DemonTab`/`DEMON_TABS`/`DEMON_TAB_LABEL`, `zoneFocus`/`sameFocus` — the one shared focus shape D-03 requires for both the diagram-to-browser and browser-to-diagram directions
- `formatDemonFocus`/`parseDemonFocus`/`parseDemonFilter`: URL tokens that never throw, drop anything malformed/hostile/out-of-range/overlong (`DEMON_PARAM_MAX_LENGTH = 40`), and round-trip exactly for every zone and every `a > b` pair at base 12
- `focusZones`/`focusDemonRef`: the zones and engine `DemonRef` a focus resolves to, used by the diagram to know what to highlight
- `focusDrawPlan`/`focusChordList` (`FOCUS_CHORD_DRAW_MAX = 4096`, T-05-26): a zone focus draws all `base - 1` incident demons when that fits, else strides down via `incidentSource`'s O(1) `at(k)` — proven element-for-element against `g.demons.incident(zone)` at base 28, base-10 lore names intact, and never exceeding 4,096 entries at base 2^20
- `demonsAfterBaseSwitch` (T-05-15, UI-08 precedent): focus always clears on a base switch, a filter survives only when `facetCount` confirms members at the new base (proven for `warp-amphi` at 666, `cross-torque-chrono` at 28 vs 10)
- `initialDemonTab`: a zone focus opens the Focus tab; a demon focus (shown pinned in Browser) or no focus opens Browser
- `app/lib/shareParams.ts` extended (D-07): `ShareState` gains `demonFilter`/`demonFocus`/`demonsOpen`, each parsed leniently against `base` alone (never building a `Numogram` for validation, never reaching `group()`/`subtype()`/`ref()` with unvalidated input) and built independently of the other two so `demonsOpen=1` round-trips alone with no filter or focus present
- `currentShareState` in `NumogramClient.tsx` gets the three static defaults (3-line diff); plan 05-10 wires live state
- 29 new tests in `tests/app/demonState.test.ts`, 11 new tests extending `tests/app/shareParams.test.ts` (legacy corpus, golden states and the pre-existing round-trip assertions untouched), full project suite green at 1,681 tests across 67 files

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation):

1. **Task 1: The demon focus/tab model, URL tokens, chord list, draw plan and base-switch rule**
   - `733218c` test(05-04): add failing tests for demon focus/tab model and URL tokens
   - `db29c25` feat(05-04): implement demon focus/tab model, URL tokens and base-switch rule
2. **Task 2: Extend the single URL codec with demonFilter=, demonFocus= and demonsOpen=1**
   - `4024182` test(05-04): add failing tests for demonFilter/demonFocus/demonsOpen params
   - `e3bf8d9` feat(05-04): extend the URL codec with demonFilter=, demonFocus=, demonsOpen=1

**Plan metadata:** (this commit) docs(05-04): complete demon focus/tab model and URL state plan

## Files Created/Modified

- `app/lib/demonState.ts` - `DemonTab`/`DEMON_TABS`/`DEMON_TAB_LABEL`, `DemonFocus`, `zoneFocus`/`demonFocusOf`/`sameFocus`, `formatDemonFocus`/`parseDemonFocus`/`parseDemonFilter`, `focusZones`/`focusDemonRef`, `FocusDrawPlan`/`focusDrawPlan`/`focusChordList`, `DemonSessionState`/`demonsAfterBaseSwitch`, `initialDemonTab`
- `tests/app/demonState.test.ts` - Behavior-spec coverage for every exported function: focus round trip at base 12, hostile-input lists (`__proto__`, 5,000-character floods, U+202E), the base-2^20 chord-list bound, and the four `demonsAfterBaseSwitch` worked examples
- `app/lib/shareParams.ts` - `ShareState` gains `demonFilter`/`demonFocus`/`demonsOpen`; `parseShareParams`/`buildShareParams`/`defaultShareState` extended per D-07
- `tests/app/shareParams.test.ts` - New parse/build cases, extended hostile-input list, and the round-trip property now drawing `demonFilter`/`demonFocus`/`demonsOpen` alongside every existing field
- `app/NumogramClient.tsx` - `currentShareState`'s returned object literal gains the three static defaults (3 lines only, per the plan's acceptance criterion)

## Decisions Made

- `demonsOpen=1` is written exactly when the overlay is open, independently of `demonFilter`/`demonFocus` — the UI-SPEC's tentative "only when a filter or focus is active" idea was explicitly rejected (per the plan's own D-07 discretion note) because it would break the codec's `parse(build(state)) === state` round trip for the demonsOpen-alone case; this plan's new `'demonsOpen alone, with no filter or focus, still round-trips'` test locks that in
- No architectural deviations - implementation followed the plan's literal export list, regex specifications and worked examples exactly

## Deviations from Plan

None - plan executed exactly as written. All behavior-spec worked examples (zone/demon focus parsing, hostile inputs, the four `demonsAfterBaseSwitch` cases, the three URL param cases) verified by name in the test suite.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/lib/demonState.ts` is the complete shared-focus/URL-token data layer that 05-08 (Focus rendering) and 05-10 (viewer wiring, both directions) will consume; no further data-layer work is needed for DEM-03's focus-mode behavior
- `app/lib/shareParams.ts`'s `demonFilter`/`demonFocus`/`demonsOpen` fields are ready for 05-10 to wire to live component state; `currentShareState`'s defaults are placeholders by design until then
- DEM-02 stays Pending in REQUIREMENTS.md (spans 05-01/05-03/05-04/05-05/05-06/05-09/05-10/05-11); DEM-03 stays Pending (spans 05-04/05-08/05-10) - neither marked complete here, per this project's established Phase 4 precedent for multi-plan requirements
- No blockers or concerns for subsequent Wave 2/3 plans (05-05, 05-06, 05-07, 05-08) - this plan shares no files with 05-05/05-06/05-07's own file lists, and 05-08 will import `demonState.ts` by design

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created/modified files exist on disk (`app/lib/demonState.ts`, `tests/app/demonState.test.ts`, `app/lib/shareParams.ts`,
`tests/app/shareParams.test.ts`, `app/NumogramClient.tsx`, this SUMMARY) and all four task commits (`733218c`, `db29c25`,
`4024182`, `e3bf8d9`) are present in `git log`.
