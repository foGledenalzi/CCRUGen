---
phase: 04-base-picker-and-generator-ui
plan: 03
subsystem: ui
tags: [numogram, region-legend, tier-table, layout-ids, view-model, isolate-mute]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: Numogram/Cycle/DemonSpace, formatNumeral/formatNetSpan/formatGateName/torqueLabel, the base-10 preset adapters (SYZYGIES/CURRENTS/GATE_LIST/ALL_DEMONS/regions/lore)
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: the measured tier-table.json (REN-01), engine/layout LAYOUT_IDS and the base-10 layout presets
provides:
  - app/lib/regions.ts — RegionId/RegionRow, regionRows/isRegionId/parseRegionId/regionOfZone/zonesOfRegion, and an independent isolate/mute RegionFilter with zoneStates/elementState (D-19, D-22, D-23, D-24)
  - app/lib/layoutIds.ts — VIEW_LAYOUT_IDS/BASE10_PRESET_LAYOUT_IDS, layoutIdsForBase/defaultLayoutFor/isLayoutIdFor/isPresetLayoutId/LAYOUT_LABELS/layoutShortcut
  - app/lib/tierBounds.ts — TIER_VIEW (property-scoped, never the full TIER_TABLE) plus tierFor/tierOverrideFrom/mayTween/labelsShown/gateMode
  - app/lib/numogramView.ts — buildNumogramView(g)/summarize(g)/zoneColorFor(kind), the base-generic view model and cheap summary every later Phase 4 surface renders from
  - engine/scene/tiers.ts's selection helpers now accept Pick<TierTable, 'boundaries' | 'tierOverrideParam'>, so app/lib/tierBounds.ts can hand them a narrowed object instead of the full measurement JSON
affects: [04-05 (shareParams isolate/mute URL codec), 04-06 (base picker consuming layoutIds/tierBounds), 04-09 (Projection generalization), 04-11 (engine-driven viewer wiring numogramView), 04-13 (RegionsPanel), 04-16 (MIG-02 close-out)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Property-scoped table access: app code takes Pick<TierTable, ...> instead of the whole measured JSON, so the ~84 KB measurement rows tree-shake out of the viewer bundle (D-16)."
    - "Preset identity at base 10: buildNumogramView returns the very SYZYGIES/CURRENTS/GATE_LIST/ALL_DEMONS/TC_* objects (toBe, not toEqual) so the frozen goldens keep seeing byte-identical data; every other base gets structurally-built lists with no lore."
    - "Region ids are compared, never used as object keys or evaluated (T-04-07): isRegionId/parseRegionId use exact string comparisons plus one anchored regex, with prototype-key strings like '__proto__'/'constructor' as ordinary rejected input."

key-files:
  created:
    - app/lib/regions.ts
    - app/lib/layoutIds.ts
    - app/lib/tierBounds.ts
    - app/lib/numogramView.ts
    - tests/app/regions.test.ts
    - tests/app/layoutIds.test.ts
    - tests/app/tierBounds.test.ts
    - tests/app/numogramView.test.ts
  modified:
    - engine/scene/tiers.ts

key-decisions:
  - "Row order for regionRows is Torque cycle(s) (canonical length-descending order), then Warp, then Plex — matching this plan's own must_haves/behavior spec verbatim, even though 04-UI-SPEC.md's prose example lists Plex before Warp; the UI-SPEC explicitly defers exact list ordering to 'presentation,' and Phase 4's later RegionsPanel plan (04-13) is free to reorder for display without touching this data layer's contract."
  - "layoutIdsForBase/isPresetLayoutId/defaultLayoutFor decide purely from the base number (base === 10) rather than constructing a Numogram and calling the engine's resolveLayout/layoutIdsFor registry functions — the base-10 presets' own `supports` predicate is exactly `g.base === 10`, so no cycle materialization is needed for id sequencing; this keeps the module a cheap, dependency-free id list."
  - "presetCurrentDest generalizes the base-10 authored drawing convention (fixed-pair currents converge on the lower member, Torque currents keep flowing to current.to) using g.cycleOfPair(g.pairOf(c.from)).kind, proven at base 10 against the legacy by-name rule (Warp/Plex -> min(from, 9-from)) and at every even base 2..40 against an in-range check."
  - "UI-01, UI-05 and MIG-02 are NOT marked complete in REQUIREMENTS.md by this plan: it ships only the pure data layer they depend on. UI-01 needs the BasePicker UI (04-06, 04-12) and its final covering plan is 04-16; UI-05 needs the generalized RegionsPanel and Projection isolate/mute rendering, final covering plan 04-13; MIG-02 needs the base-10 seams actually deleted and the grep gate defaulted on, final covering plan 04-16. This mirrors the 04-02 precedent for UI-03 spanning multiple plans."

patterns-established:
  - "SVG-tier-only JSDoc contract: regionRows/zoneStates/zonesOfRegion('torque')/buildNumogramView are documented as safe only for bases in the SVG tier (they materialize every Torque cycle's zones/pairs); summarize(g) is the one function proven safe at any base (2^16 tested), reading at most SUMMARY_TORQUE_LIMIT=12 cycles via cycleAt and the demon space's O(1) count/typeCounts (T-04-08)."

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-09-29
---

# Phase 4 Plan 03: Region Model, View Layout Ids, Tier Accessor and Numogram View Summary

**Base-generic data layer (regions/isolate-mute, view layout ids, a property-scoped tier-table reader, and a numogram view model) that returns base-10's exact preset objects while generalizing to any even base for the rest of Phase 4's UI to render from.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-29T00:53:19Z (immediately after 04-02's completion commit)
- **Completed:** 2026-09-29T01:07:27Z
- **Tasks:** 2 completed
- **Files modified:** 9 (5 created source modules including one engine type-only edit, 4 new test files)

## Accomplishments

- `app/lib/regions.ts`: `RegionId`/`RegionRow`, `regionRows`/`isRegionId`/`parseRegionId`/`regionOfZone`/`zonesOfRegion` derived entirely from the engine's `Cycle[]` (never assumes a single Torque cycle), plus an independent isolate/mute `RegionFilter` with `zoneStates`/`elementState` implementing D-19 (isolate = spotlight/dim, mute = hard hide, mute wins), D-22 (any combination valid) and D-23 (uniform treatment of every region including Plex/Warp).
- `app/lib/layoutIds.ts`: the view-layout id vocabulary (`VIEW_LAYOUT_IDS`, `BASE10_PRESET_LAYOUT_IDS`) plus `layoutIdsForBase`/`defaultLayoutFor`/`isLayoutIdFor`/`isPresetLayoutId`/`LAYOUT_LABELS`/`layoutShortcut`, matching the engine registry's own ordering (procedural ids not already offered by a preset, `pairGraph` last) without needing to construct a `Numogram`.
- `app/lib/tierBounds.ts`: `TIER_VIEW`, the app's only reader of `engine/scene/tier-table.json`, scoped to `boundaries`/`tierOverrideParam` only (never the ~84 KB measurement rows), plus `tierFor`/`tierOverrideFrom`/`mayTween`/`labelsShown`/`gateMode`.
- `engine/scene/tiers.ts`: type-only widening of `selectTier`/`parseTierOverride`/`tweenAllowed`/`labelsVisible`/`gateLayerMode` to accept `Pick<TierTable, 'boundaries'>` / `Pick<TierTable, 'tierOverrideParam'>`, so `tierBounds.ts` can hand them `TIER_VIEW` instead of the full table — no runtime behavior change, all 674 engine tests stayed green.
- `app/lib/numogramView.ts`: `buildNumogramView(g)` returns the base-10 preset objects (`SYZYGIES`, `CURRENTS`, `GATE_LIST`, `ALL_DEMONS`, `TC_EDGES`, `TC_CURRENTS`, `TC_SYZYGIES`, and the lore) by identity at base 10, and structural syzygy/current/gate/demon lists with in-base numerals and no lore at every other even base (demons capped at `allChordsMaxN`); `summarize(g)` gives a cheap `{zoneCount, hasWarp, torqueCount, torqueLengths, demonCount, typeCounts}` safe at any base up to 2^16 (tested), reading at most 12 Torque cycles.

## Task Commits

Each task was committed atomically:

1. **Task 1: regions.ts, layoutIds.ts, tierBounds.ts and the type-only widening of the engine tier helpers** - `f9ebb6e` (feat)
2. **Task 2: numogramView.ts (view model and summary) with base-10 identity and a 2..40 sweep** - `afa8634` (feat)

_Both tasks followed the plan's TDD flag: tests were written first and observed failing (module-not-found) before the implementation made them pass; no separate red-only commit was needed since the plan specifies a single "tests first, red, then implement, commit" cycle per task rather than a full RED/GREEN/REFACTOR gate sequence._

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `app/lib/regions.ts` - RegionId/RegionRow, regionRows/isRegionId/parseRegionId/regionOfZone/zonesOfRegion, RegionFilter + toggleIsolate/toggleMute/sanitizeRegionFilter/regionFilterActive, zoneStates/elementState
- `app/lib/layoutIds.ts` - VIEW_LAYOUT_IDS/BASE10_PRESET_LAYOUT_IDS constants, layoutIdsForBase/defaultLayoutFor/isLayoutIdFor/isPresetLayoutId/LAYOUT_LABELS/layoutShortcut
- `app/lib/tierBounds.ts` - TIER_VIEW plus tierFor/tierOverrideFrom/mayTween/labelsShown/gateMode
- `app/lib/numogramView.ts` - NumogramSummary/Base10Lore/NumogramView types, zoneColorFor/summarize/buildNumogramView
- `engine/scene/tiers.ts` - selectTier/parseTierOverride/tweenAllowed/labelsVisible/gateLayerMode now take `Pick<TierTable, ...>` (type-only change, bodies unchanged)
- `tests/app/regions.test.ts` - 21 tests: base 10/28/64/12 region rows, malformed/hostile id rejection, filter independence, zoneStates/elementState
- `tests/app/layoutIds.test.ts` - 11 tests: id lists, defaults, validity checks, shortcuts at base 10 and 28
- `tests/app/tierBounds.test.ts` - 8 tests: TIER_VIEW parity with TIER_TABLE, boundary agreement with the engine functions
- `tests/app/numogramView.test.ts` - 39 tests: base-10 identity, summaries at 10/28/16/65536, a base-28 structural view, a base-100 (demons null) case, and a full sweep of every even base 2..40

## Decisions Made

See `key-decisions` in the frontmatter above (row order, layoutIds' base-number-only design, presetCurrentDest generalization, and the deliberate non-completion of UI-01/UI-05/MIG-02 in REQUIREMENTS.md).

## Deviations from Plan

None - plan executed exactly as written. One small self-inflicted mid-execution correction (not a deviation from the plan's design, just cleanup): the first draft of `tests/app/tierBounds.test.ts` had a comment mentioning the literal numbers "200" and "80" as descriptive prose; this was reworded before committing so the acceptance-criteria grep for hard-coded thresholds (`\b200\b|\b80\b`) has nothing to match, keeping the file's only source of those values the engine's own `TIER_TABLE`.

## Issues Encountered

None. All 79 new unit tests (21 + 11 + 8 + 39) passed on the first implementation attempt against the tests written first; the full `tests/app/` suite (129 tests), the full oracle+engine vitest projects (1373 tests), and `npm run typecheck` (4x tsc + engine lint) were all green with no regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The pure data layer plans 04-05, 04-06, 04-09, 04-11 and 04-13 need is in place: `regions.ts` for the region legend and isolate/mute state, `layoutIds.ts` for the base picker's layout controls, `tierBounds.ts` for every big-base degradation decision, and `numogramView.ts` for the live summary and the generalized viewer's data source.
- No blockers. UI-01, UI-05 and MIG-02 remain correctly `Pending` in REQUIREMENTS.md pending their final covering plans (04-16, 04-13, 04-16 respectively) — this is expected, not a gap.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 9 created/modified source files and the SUMMARY.md verified present on disk; both task commits (`f9ebb6e`, `afa8634`) verified present in `git log --oneline --all`.
