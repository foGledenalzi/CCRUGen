---
phase: 05-demons-layer
plan: 03
subsystem: ui
tags: [search, regex, typescript, engine, demons]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-01)
    provides: "app/lib/demonBrowser.ts: DemonFilter/DemonSort, filterContains, filterLabel, rankOf, demonNameTable, rowSourceFor"
  - phase: 02-engine-core-and-base-10-migration
    provides: "parseNumeral (in-base numeral parsing, throws RangeError), clipEcho (bounded-echo helper)"
provides:
  - "app/lib/demonSearch.ts: clampQuery/parseZoneNumeral/parseDemonQuery (mesh / a::b / base-10-name query parsing), resolveDemonSearch (query -> row under active filter/sort), searchMessage/emptyFilterMessage (exact UI-SPEC status copy)"
affects: [05-05, 05-06, 05-09, 05-10, 05-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regex-gate-then-try/catch-then-range-check: every hostile-input surface in this app (basePicker, shareParams, now demonSearch) clamps length first, then anchored bounded regex, then a try/catch around the engine parser, then a numeric range check - never throws regardless of input"
    - "Two-pass zone-numeral validation for pair queries: normalizeZoneCandidate's regex gate distinguishes 'syntax' (malformed shape) from 'not-found' (well-formed numeral whose value is not below the base) using the SAME regex+try/catch logic parseZoneNumeral uses internally"
    - "Curly quotes/em dash built via String.fromCodePoint as module-level constants (LQ/RQ/DASH), never typed unicode escapes in source (STATE Phase 2 P07 gotcha)"

key-files:
  created:
    - app/lib/demonSearch.ts
    - tests/app/demonSearch.test.ts
  modified: []

key-decisions:
  - "parseDemonQuery distinguishes 'syntax' from 'not-found' for a::b pairs by running the same regex gate twice: once directly (to classify malformed shape as syntax) and once inside parseZoneNumeral (to classify a well-formed-but-out-of-range or overflow numeral as not-found) - this matches the plan's literal rule and the '700::3' -> not-found (not syntax) worked example"
  - "The name-search loop short-circuits on an exact match (returned immediately) so exact match always wins even when an earlier index only produced a prefix hit, satisfying the exact-beats-prefix rule without a second pass"

patterns-established:
  - "Search parser output is always one of 6 closed DemonQuery kinds (empty/mesh/pair/name/not-found/syntax); every caller can exhaustively switch without a default case"

requirements-completed: []  # DEM-02 spans 05-01, 05-03, 05-04, 05-05, 05-06, 05-09, 05-10, 05-11; left Pending in REQUIREMENTS.md until its final covering plan, per this project's established Phase 4 precedent

# Metrics
duration: 25min
completed: 2026-09-30
---

# Phase 5 Plan 3: Demon Browser Search (Mesh / A::B / Name Parsing and Resolution) Summary

**Defensive demon-search parser (`app/lib/demonSearch.ts`) that resolves a decimal mesh id, an in-base a::b net-span in either order, or a base-10 CCRU name to its exact row under any active filter/sort, with the outside-filter case reported explicitly and hostile/oversized input clamped to 64 characters and never throwing.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed (each RED test commit + GREEN implementation commit)
- **Files modified:** 2 (1 implementation file created, 1 test file created and extended)

## Accomplishments

- `clampQuery`/`parseZoneNumeral`/`parseDemonQuery`: a defensive three-form parser (mesh id, a::b pair in-base either order, base-10 name exact-or-prefix) that is regex-gated, try/catch-wrapped around the engine's `parseNumeral`, and range-checked before ever touching `g.demons` - proven against base 28's letter-scheme digits (`'12'` in base 28 means 30, not decimal 12), base 666's dotted decimal-group numerals, and base 10's 45 CCRU names read from the frozen oracle
- `resolveDemonSearch`: maps any parsed query to its row index via `filterContains`/`rankOf` from 05-01, reporting a demon outside the active filter explicitly (`outside-filter`) rather than silently dropping it, for every filter/sort/direction combination
- `searchMessage`/`emptyFilterMessage`: byte-exact UI-SPEC copy (curly quotes U+201C/U+201D, em dash U+2014, ASCII apostrophe in "Couldn't") built from `String.fromCodePoint` constants, with echoes clipped through the engine's `clipEcho` (40 chars + `...`) so a pasted megabyte never becomes a megabyte of message text
- A fixed hostile-input list (`__proto__`, `constructor`, `%00`, 50 U+202E right-to-left-override characters, 10,000-character digit/letter floods) proven never to throw through both `parseZoneNumeral`, `parseDemonQuery` and `resolveDemonSearch`, at every base tested
- 36 new tests in `tests/app/demonSearch.test.ts`, full project suite green at 1,647 tests across 66 files

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation):

1. **Task 1: Query clamping, zone-numeral parsing and the mesh / a::b / name query parser**
   - `fcf8771` test(05-03): add failing tests for demon search query parsing
   - `11bf6ae` feat(05-03): implement demon search query clamping, zone numerals and parser
2. **Task 2: Resolve a query to a row under the active filter and sort, plus the UI-SPEC status copy**
   - `991a1d7` test(05-03): add failing tests for demon search resolution and status copy
   - `0138411` feat(05-03): implement demon search resolution and UI-SPEC status copy

**Plan metadata:** (this commit) docs(05-03): complete demon browser search plan

## Files Created/Modified

- `app/lib/demonSearch.ts` - `SEARCH_MAX_LENGTH`/`NAME_SEARCH_MAX_COUNT` constants, `DemonQuery`/`SearchOutcome`/`StatusMessage` types, `clampQuery`, `parseZoneNumeral`, `parseDemonQuery`, `resolveDemonSearch`, `searchMessage`, `emptyFilterMessage`
- `tests/app/demonSearch.test.ts` - DEM-02 parse/resolve tests: mesh numbers, a::b pairs (either order, in-base numerals, malformed shapes), base-10 name exact/prefix matching, empty/syntax classification, the T-05-07..T-05-11 hostile-input list, resolution under filter/sort/direction, and exact UI-SPEC status copy assertions

## Decisions Made

- Distinguishing "syntax" (malformed a::b side) from "not-found" (well-formed side that parses but is out of range) required running the zone-numeral regex gate once outside `parseZoneNumeral` (for the syntax/not-found split) in addition to its internal use (for the actual value); this was necessary because `parseZoneNumeral`'s `number | null` return type collapses both failure modes into `null` by design, per its documented interface signature in the plan
- No architectural deviations - implementation followed the plan's literal export list, regex specifications and worked examples exactly

## Deviations from Plan

None - plan executed exactly as written. All behavior-spec worked examples (mesh/pair/name parsing, hostile inputs, resolution, exact UI-SPEC copy) verified by name in the test suite.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/lib/demonSearch.ts` is the complete search/resolution layer the demon browser UI (05-05/05-06/05-09) will wire a `CyberInput` search box to; no further data-layer work is needed for DEM-02's search behavior
- `resolveDemonSearch`'s `SearchOutcome` and `searchMessage`'s `StatusMessage` are ready to drive the browser's search-result UI and scroll-to-row behavior (`rowSourceFor`/`rankOf` from 05-01 already proven to compose correctly with this plan's output)
- DEM-02 stays Pending in REQUIREMENTS.md: this plan ships one more piece of its multi-plan requirement (05-01, 05-03, 05-04, 05-05, 05-06, 05-09, 05-10, 05-11 all touch it); not marked complete here, per this project's established Phase 4 precedent
- No blockers or concerns for subsequent Wave 2 plans (05-04, 05-05, 05-07) - this plan shares no files with them

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

All created files exist on disk (`app/lib/demonSearch.ts`, `tests/app/demonSearch.test.ts`, this SUMMARY) and all four task
commits (`fcf8771`, `11bf6ae`, `991a1d7`, `0138411`) are present in `git log`.
