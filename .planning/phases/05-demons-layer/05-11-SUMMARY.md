---
phase: 05-demons-layer
plan: 11
subsystem: testing
tags: [playwright, e2e, demons, virtualization, url-codec]

# Dependency graph
requires:
  - phase: 05-demons-layer (05-09)
    provides: "app/components/demons/DemonsOverlay.tsx: the Browser/Focus/Matrix overlay shell, DemonFacets/DemonBrowser/DemonRowList/DemonMatrix DOM contract"
  - phase: 05-demons-layer (05-10)
    provides: "The demons layer wired into app/NumogramClient.tsx: header 'Browse demons' button (works with no diagram), demonFilter=/demonFocus=/demonsOpen= URL round-trip, base-switch reset"
provides:
  - "e2e/demons-helpers.ts: shared Playwright helpers for the demons specs (openDemons, demonsDialog, facet, demonList, demonRow, searchDemons, waitRaster, matrixCellPoint)"
  - "e2e/demons-browser.spec.ts: 12 real-browser tests proving DEM-01 (facets), DEM-02 (virtualized browser sort/filter/search/windowing), DEM-05 (base-10 names), the D-07 URL contract and D-01 overlay dismissal"
affects: [05-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every expected count/label in the demons specs is computed independently from createNumogram(...) (typeCounts()/counts()), never read from the app's own view model — mirrors e2e/layers-zoom.spec.ts / e2e/hover-pin.spec.ts's existing convention at a generated base"
    - "`[data-demon-pager]` is a sibling of `[data-demon-list]` (DemonRowList.tsx renders them as adjacent children of one wrapper div), not a descendant — specs query it from the dialog root, not scoped under the list locator"
    - "DemonsOverlay's dialog-level onKeyDown calls preventDefault() on any unmodified single-character key when the target isn't a typing control (T-05-30/T-05-31); since that handler is attached deeper in the DOM than the main viewer's window-level shortcut listeners (both bubble-phase), it sets nativeEvent.defaultPrevented before CyberButton's own shortcut listener or NumogramClient's layout-shortcut listener ever runs, so 's'/digit/etc. shortcuts never leak through the open modal"

key-files:
  created:
    - e2e/demons-helpers.ts
    - e2e/demons-browser.spec.ts
  modified: []

key-decisions:
  - "Plan's two tasks were committed as written (helpers + tests 1-6, then tests 7-12 appended) even though both were authored and verified together, to preserve the per-task atomic-commit record the plan's task breakdown describes"
  - "matrixCellPoint and waitRaster are exported per the plan's interface contract but unused by this plan's own 12 tests (they exist for 05-12's Matrix-tab specs); left in demons-helpers.ts rather than deferred, since the plan explicitly lists them as this task's required exports"

patterns-established: []

requirements-completed: [DEM-01, DEM-02, DEM-05]

# Metrics
duration: ~20min
completed: 2026-09-30
---

# Phase 5 Plan 11: Demons Browser E2E Summary

**12 real-Chromium Playwright tests prove the demons Browser tab end-to-end against the static export — closed-form facet counts (incl. the 108-member cross-Torque sub-facet), 221,445-row virtualization at base 666 with DOM-row counts capped at <=80, sort/search/filter, base-10's 45 canonical names, the `demonFilter=`/`demonFocus=`/`demonsOpen=` URL contract, D-01 overlay dismissal with focus restore, modal key isolation, and base 1024's 523,776-row pager windowing.**

## Performance

- **Duration:** ~20 min (context/interface reading, component DOM verification, two task commits, three debug/fix iterations, full-suite confirmation)
- **Started:** 2026-09-30T18:30:00Z (approx., first file read)
- **Completed:** 2026-09-30T18:50:00Z (second task commit)
- **Tasks:** 2 completed
- **Files modified:** 2 (both new: e2e/demons-helpers.ts, e2e/demons-browser.spec.ts)

## Accomplishments

- `e2e/demons-helpers.ts` ships the 8 helpers named in the plan's interface contract: `openDemons` (clicks the header button, waits for the dialog), `demonsDialog`, `facet`, `demonList`, `demonRow`, `searchDemons` (fill + Enter), `waitRaster` (polls `data-raster-state="done"`, 15s timeout, for 05-12), `matrixCellPoint` (reads `data-scale`/`data-tx`/`data-ty` plus the container's bounding box to resolve a cell's page-space centre, for 05-12)
- Test 1 proves base 28's facets against `g.demons.typeCounts()`/`counts()` directly (378/276/96/6, cross-Torque 108), the 2-level disclosure (clicking Chrono reveals Cross-Torque), and that selecting the sub-facet updates `aria-rowcount` to 109 and writes both `demonFilter=cross-torque-chrono` and `demonsOpen=1` into the URL
- Test 2 proves base 666 opens with **zero** `[data-diagram]` elements yet the header button still works and the overlay shows 221,445/220,116/199,884 instantly (closed forms, no enumeration)
- Test 3 proves true virtualization: `aria-rowcount="221446"`, the rows-spacer height is exactly `221445 * 22 = 4871790`px, the live DOM never holds more than 80 `[data-demon-row]` elements before or after scrolling the grid to its bottom, and the last row (mesh 221444) is `665::664`
- Test 4 proves the sort toggle (mesh ascending to descending flips the first rendered row from the lowest to the highest mesh) and a mesh-to-type sort switch (first row becomes `Cyclic chrono`, the first `DEMON_SUBTYPES` entry)
- Test 5 proves search resolves mesh ids, `a::b` pairs (either order), an outside-the-active-filter demon (`'1::0' is not in the Cross-Torque chrono filter.'`), a well-formed-but-absent mesh (`'No demon found for...'`), and a syntactically invalid query (`'1e3'` -> `"Couldn't parse..."`)
- Test 6 proves clicking a browser row pins it into the shared `aside[data-demon-detail]` with `MESH`/`69`/`Cyclic chrono`/`c::3` all present
- Test 7 proves base 10's `DEMON_NAMES` join: mesh 0 is `Lurgo`, mesh 44 is `Ummnu` with `a::b` `9::8`, a `tuk` prefix search resolves to mesh 11, and the pinned detail pane shows the name
- Test 8 proves the NAME column exists (header visible) but every rendered cell is the empty string at base 28 (D-02: table shape never changes across base)
- Test 9 proves `demonFilter=`/`demonFocus=`/`demonsOpen=1` round-trip through a page reload, a bogus `demonFilter=bogus` silently falls back to the `All` chip, and `demonsOpen` absent keeps the dialog closed until the header button is clicked (while the stale `demonFilter=chrono` from the URL still applies once opened)
- Test 10 proves Escape, the full-viewport backdrop button (clicked at its top-left corner, away from the centered dialog box), and the `close` button all dismiss the overlay, Escape also drops `demonsOpen` from the URL, and focus returns to `button[aria-label="Browse demons"]`
- Test 11 proves modal key isolation: focusing the browser grid and pressing `s` neither adds `layout=labyrinth` to the URL nor closes the dialog (the dialog's own `preventDefault()` on an unmodified single-character key beats the window-level shortcut listeners in the bubble-phase ordering)
- Test 12 proves base 1024's 523,776-row pager (`Rows 1–250,000 of 523,776`, built with `String.fromCodePoint` to avoid the Phase 2 "typed unicode escape" gotcha) and that searching `400000` crosses a window boundary (`Rows 250,001–500,000 of 523,776`) and lands on the correct row

## Task Commits

1. **Task 1: Shared demons helpers and the facets / virtualization / sort / search specs** - `d8a6b36` (test)
2. **Task 2: Base-10 names, URL state, overlay dismissal and base-1024 windowing specs** - `dec7b0b` (test)

**Plan metadata:** (this commit) docs(05-11): complete demons layer e2e browser plan

## Files Created/Modified

- `e2e/demons-helpers.ts` - Shared Playwright locators/actions for every Phase 5 demons spec (this plan and 05-12)
- `e2e/demons-browser.spec.ts` - 12 tests proving DEM-01/DEM-02/DEM-05, D-07 and D-01 against the static export

## Decisions Made

- Scoped `[data-demon-pager]` queries from the dialog root rather than the `[data-demon-list]` grid locator, since `DemonRowList.tsx` renders the pager as the grid's sibling, not its descendant (confirmed by reading the component before writing the assertion, then caught by a real test failure and fixed before committing)
- Scoped NAME-column emptiness checks to `[role="gridcell"][data-col="name"]` rather than the bare `[data-col="name"]` attribute selector, since the sticky header's `columnheader` div shares the same `data-col="name"` attribute and its text ("NAME") would otherwise collide with the empty-cell assertion

## Deviations from Plan

None against the plan's own text — every numbered sub-step in both tasks' `<action>` blocks was implemented as specified (helper signatures, the 12 test bodies, the exact UI-SPEC copy strings, the exact numeric constants). Two implementation bugs were found and fixed via Rule 1 (auto-fix) while first running the suite, both caught before any commit:

### Auto-fixed Issues

**1. [Rule 1 - Bug] NAME-column emptiness check matched the column header's own "NAME" text**
- **Found during:** Task 2, first run of "other bases keep an empty NAME column"
- **Issue:** The locator `[data-col="name"]` matches both `DemonRowList.tsx`'s `role="columnheader"` header cell (text "NAME") and every row's `role="gridcell"` (D-02's intentional empty string at non-base-10). The test read the header's non-empty text and failed.
- **Fix:** Scoped the cell locator to `[role="gridcell"][data-col="name"]`, excluding the header.
- **Files modified:** e2e/demons-browser.spec.ts
- **Verification:** Test passes; the header-visibility assertion still separately checks `[role="columnheader"][data-col="name"]`.
- **Committed in:** dec7b0b (Task 2 commit; found and fixed before commit)

**2. [Rule 1 - Bug] Pager locator scoped under the row grid, which never contains it**
- **Found during:** Task 2, first run of "base 1024 windows 523,776 rows"
- **Issue:** `DemonRowList.tsx` returns `<div class="flex ... flex-col"><div role="grid" data-demon-list=...>...</div>{pages > 1 && <div data-demon-pager>...}</div>` — the pager is a sibling of the grid, not nested inside it. Querying `demonList(page,'browser').locator('[data-demon-pager]')` always timed out, element not found.
- **Fix:** Scoped the pager locator to the dialog root (`dialog.locator('[data-demon-pager]')`) in both the base-666 (expect-absent) and base-1024 (expect-present) tests.
- **Files modified:** e2e/demons-browser.spec.ts
- **Verification:** Both tests pass; a code comment at each site documents the sibling relationship for future specs (05-12).
- **Committed in:** d8a6b36 and dec7b0b (found and fixed before either commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, test-code bugs caught before commit via the plan's own `<verify>` command)
**Impact on plan:** No scope creep — both fixes are corrections to the new test file's own locators, not changes to any production component or plan requirement.

## Issues Encountered

- A full-suite Playwright run (`--project=chromium-utc`, all specs) was started as an extra confirmation beyond the plan's own verification command and took ~3.3 minutes in the background (153 tests, including the 60 frozen DOM goldens and all 5 behaviour-baseline specs); it completed with 153/153 passed and 0 failures, confirming this plan's new spec coexists cleanly with the full existing regression suite. Not a plan requirement — the plan's own `<verify>` (`npm run build && npx playwright test e2e/demons-browser.spec.ts --project=chromium-utc`) was the acceptance gate and was run and passed on its own both before and after the two-commit split.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `e2e/demons-helpers.ts`'s `waitRaster` and `matrixCellPoint` are ready for 05-12 (Matrix-tab specs: exact picks at two zoom levels, raster timings, focus mode at base 666, full verify gate) but are not exercised by this plan's own tests
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty — no frozen oracle, golden, or baseline file was touched
- No blockers or concerns: `npm run typecheck` (4x tsc + lint) is clean except the pre-existing, unrelated `DemonMatrix.tsx` `react-hooks/exhaustive-deps` warning from 05-07 (out of this plan's file list and scope)

---
*Phase: 05-demons-layer*
*Completed: 2026-09-30*

## Self-Check: PASSED

- FOUND: e2e/demons-helpers.ts
- FOUND: e2e/demons-browser.spec.ts
- FOUND: .planning/phases/05-demons-layer/05-11-SUMMARY.md
- FOUND commit: d8a6b36 (test, Task 1)
- FOUND commit: dec7b0b (test, Task 2)
