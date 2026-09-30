---
phase: 05-demons-layer
plan: 01
subsystem: ui
tags: [engine, demons, virtualization, typescript]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: "DemonSpace (g.demons): at(mesh)/ref(a,b) O(1), typeCounts()/counts() closed-form, group()/subtype() O(log C(n,2)) unranking, incident(zone) generator"
provides:
  - "app/lib/demonBrowser.ts: demon taxonomy, closed-form facet model, base-10 name join, DemonRef->Demon adapter, {count, at(k)} row sources with sort/rank/window paging"
  - "isDemonType/isDemonSubtype/isDemonFilter exact-membership validators for URL/UI input, ready for D-07's demonFilter= param"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Uniform {count, at(k)} DemonRowSource: g.demons, g.demons.group(type) and g.demons.subtype(subtype) are interchangeable; 'sort' is index arithmetic (orderedSource), 'filter' is swapping which source backs the browser, never materialization"
    - "rankOfMesh: binary search over a mesh-ordered source's at(k).mesh (documented ascending-mesh-order contract), O(log count), never a linear scan"
    - "Exact-membership validation against DEMON_TYPES/DEMON_SUBTYPES tuples before any group()/subtype() call or property-key use (mirrors app/lib/regions.ts's isRegionId discipline)"
    - "Always read g (raw Numogram) for demon data, never view.demons (materialized, null above n=80 / null entirely above svgRichMaxN=200)"

key-files:
  created:
    - app/lib/demonBrowser.ts
    - tests/app/demonFacets.test.ts
    - tests/app/demonNames.test.ts
    - tests/app/demonBrowserSource.test.ts
  modified: []

key-decisions:
  - "Facet chip counts read g.demons.typeCounts()/counts() exactly once per facetModel() call (two total), never a per-chip recomputation or a loop over demons"
  - "Type-sorted single-subtype filter returns g.demons.subtype(s) directly rather than wrapping it in a 1-part concatSources, so rowSourceFor(g, subtype, 'type') and rowSourceFor(g, subtype, 'mesh') both hand back native engine selections"
  - "rankOf's type-key partition offset sums only the preceding parts' .count (closed-form reads), then adds a within-subtype rankOfMesh — no enumeration at any base"

patterns-established:
  - "Pattern 1 (uniform row source) and Pattern 2 (rank via binary search) from 05-RESEARCH.md, implemented exactly as specified"

requirements-completed: []  # DEM-01/DEM-02/DEM-05 span multiple 05-* plans (also 05-06, 05-09, 05-10, 05-11 per their frontmatter); left Pending in REQUIREMENTS.md until their final covering plan, per this project's established Phase 4 precedent

# Metrics
duration: 20min
completed: 2026-09-30
---

# Phase 5 Plan 1: Demon Taxonomy, Facet Model, Row Sources and Base-10 Names Summary

**Base-generic demon data layer (`app/lib/demonBrowser.ts`): closed-form type/subtype facets, a uniform `{count, at(k)}` row-source abstraction over the engine's `DemonSpace` with sort/rank/window paging, and the base-10 CCRU name join — proven exhaustively at base 28 (378 demons x 11 filters x 2 sort keys x 2 directions) and bounded at base 666 (221,445 demons) and the base-2^26 ceiling (2,251,799,780,130,816 demons).**

## Performance

- **Duration:** ~20 min (context/read time plus 4 commits spanning 02:32:09-02:35:57 local)
- **Tasks:** 2 completed (each RED test commit + GREEN implementation commit)
- **Files modified:** 4 (1 implementation file created across 2 commits, 3 test files)

## Accomplishments

- Demon taxonomy: exact-membership `isDemonType`/`isDemonSubtype`/`isDemonFilter` validators, `parentType`, `filterLabel`, `filterContains`, and the closed-form `facetModel`/`facetCount` that reproduce base 28 (378/276/96/6, cross-Torque 108) and base 666 (221,445/220,116/1,328/1, cross-Torque 199,884) straight from `g.demons.typeCounts()`/`counts()`
- `kindColor` is now the single path from any of the 7 engine subtypes to the app's 4-bucket legacy palette (`#00ccff`/`#cc8833`/`#cc3333`/`#e8e8e8`), matching `InfoDisplay.tsx`'s canonical hexes exactly
- Base-10 name join (`demonName`/`demonNameTable`) and the `legacyDemon` DemonRef -> Demon adapter, proven against all 45 entries of the frozen `base10.golden.json` oracle (read-only)
- `DemonRowSource` uniform interface (`rowSourceFor`, `concatSources`, `orderedSource`, `incidentSource`, `singleSource`) giving the browser/facets/focus-view one two-method shape for the full space, any type/subtype filter, a zone's incident demons, or a single pinned demon — never materializing an array of demons
- `rankOfMesh`/`rankOf` find any demon's row under any filter, sort key (mesh or type) and direction in O(log count), verified for all 378 x 11 x 2 x 2 = 16,632 combinations at base 28
- `windowCount`/`windowAt`/`windowFor` cap a rendered virtualizer window at `BROWSER_WINDOW_ROWS = 250,000` rows, proven correct at the exact boundary examples and safe-integer-bounded at the 2^26 demon count (2,251,799,780,130,816)

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation):

1. **Task 1: Taxonomy, facet model, kind colors, base-10 names and the legacy Demon adapter**
   - `e48ac3e` test(05-01): add failing tests for demon facet model and base-10 names
   - `25d7bee` feat(05-01): implement demon taxonomy, facet model and base-10 name join
2. **Task 2: Row sources, sort, rank-of-demon and window paging**
   - `7ad452e` test(05-01): add failing tests for demon row sources, rank and window paging
   - `38df5d7` feat(05-01): implement demon row sources, rank and window paging

**Plan metadata:** (this commit) docs(05-01): complete demon taxonomy/facets/row-sources plan

## Files Created/Modified

- `app/lib/demonBrowser.ts` - Demon taxonomy constants and validators, `facetModel`/`facetCount`, `demonName`/`demonNameTable`/`legacyDemon`/`netSpanLabel`, `DemonRowSource` and its five constructors, `rankOfMesh`/`rankOf`, `windowCount`/`windowAt`/`windowFor`
- `tests/app/demonFacets.test.ts` - DEM-01 facet-model assertions at bases 2, 10, 28, 666 and every even base 2..200; `isDemonFilter`/`parentType`/`filterLabel`/`kindColor`/`facetCount`/`filterContains` unit coverage
- `tests/app/demonNames.test.ts` - DEM-05: all 45 base-10 names and `legacyDemon` shapes checked against the frozen `base10.golden.json` oracle (read-only), plus the null-at-every-other-base and `netSpanLabel` behavior
- `tests/app/demonBrowserSource.test.ts` - DEM-02: row-source identity, type-sort concatenation order, `orderedSource`/`concatSources`/`incidentSource`/`singleSource` range checks, exhaustive `rankOfMesh`/`rankOf` at base 28, base-666 and 2^26-count boundedness, counting-wrapper materialization guards

## Decisions Made

None beyond what the plan specified — implementation followed the plan's literal export list, semantics and worked examples exactly (facet chip shape, row-source construction rules, rank/window formulas).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/lib/demonBrowser.ts` is the complete data layer the rest of Phase 5 (browser UI, facet chips, focus mode, matrix, URL codec, detail panel) reads from; no further engine or view-model work is needed for DEM-01/DEM-02/DEM-05's data side
- `isDemonType`/`isDemonSubtype` are ready for 05's later URL-codec plan (D-07's `demonFilter=`) to validate against before calling `g.demons.group()`/`.subtype()` (which throw `RangeError` on an unknown name)
- DEM-01/DEM-02/DEM-05 stay Pending in REQUIREMENTS.md: this plan ships only their data layer, and each also appears in later plans' `requirements` frontmatter (05-06, 05-09, 05-10, 05-11) that build the actual UI surfaces — not marked complete here, per this project's established multi-plan-requirement precedent (Phase 4)
- No blockers or concerns for subsequent Wave 1+ plans

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created files exist on disk (`app/lib/demonBrowser.ts`, `tests/app/demonFacets.test.ts`, `tests/app/demonNames.test.ts`,
`tests/app/demonBrowserSource.test.ts`, this SUMMARY) and all four task commits (`e48ac3e`, `25d7bee`, `7ad452e`, `38df5d7`)
are present in `git log`.
