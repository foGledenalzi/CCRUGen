---
phase: 07-naming-builder
plan: 03
subsystem: ui
tags: [panel-stack, drag, z-index, pure-functions, fast-check, vitest, typescript, todo-008]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: nothing at code level (wave 1, independent of 07-01 and 07-02); the contract comes from 07-UI-SPEC "Desktop Panel Stack Rule" and 07-RESEARCH Pattern 9
provides:
  - app/lib/panelStack.ts, the live desktop stack as a pure function (DESKTOP_* and PANEL_WIDTH/INFO_PANEL_WIDTH constants moved out of NumogramClient with the same values, the Names geometry constants, STACK_PANEL_IDS, DESKTOP_COLUMNS, STACK_REPORTERS, computeDesktopStack, namesX, namesBodyMax)
  - app/lib/panelDrag.ts, the pure drag and z reducers (Z_BASE 40, Z_CAP 69, Z_RERANK_START 50, initialDragState, activate, dragStart, dragMove, dragEnd, displayedPositions)
  - tests/app/panelStack.test.ts (42 tests, identity oracle against a literal copy of the old one-shot effect) and tests/app/panelDrag.test.ts (31 tests)
affects: [07-07, 07-17, 07-21, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A literal copy of the replaced code as the identity oracle: the derived stack is compared with the old one-shot formula at the measured heights and on 20,000 random height sets, so the base-10 placement cannot drift"
    - "Property generators drawn as whole sets from a double arm, a tenth-pixel arm and a half-pixel arm: the (a + b) + c versus a + (b + c) association only flips a Math.round tie when a whole chain sits on one grid"
    - "Hook logic extracted into reducers over one immutable state object, because the hook has no jsdom test; the derived stack takes no `moved` input, which is what keeps a moved panel's slot reserved"

key-files:
  created:
    - app/lib/panelStack.ts
    - app/lib/panelDrag.ts
    - tests/app/panelStack.test.ts
    - tests/app/panelDrag.test.ts
  modified: []

key-decisions:
  - "computeDesktopStack writes the chain `y = y + (heights[id] ?? PANEL_HEADER_HEIGHT) + DESKTOP_PANEL_GAP` left to right with Math.round applied to each y at the end and the first panel of a column at exactly 64; this equals the old effect for every panel the old effect placed (also unreported syz, gates, text, info default to the 34px header like `gates ?? 34` did)"
  - "dragMove stores `ox + (mx - d.mx)`, the association the old hook used (`dx = clientX - startX; origX + dx`), not the plan's `ox + mx - d.mx`; identical for integer mouse coordinates, more faithful for fractional ones"
  - "A no-op reducer call (dragMove or dragEnd without a drag) returns the same state object, so a React setState given the result will not re-render"
  - "z re-rank breaks ties by STACK_PANEL_IDS order and always leaves the activated panel at the counter (50 after a re-rank), so every z stays distinct and inside 40..69"

patterns-established:
  - "Mutation runs go through a script that replaces one unique string, runs the suite in the foreground under a timeout, restores from a saved copy and checks git diff --quiet"

requirements-completed: []  # NAM-01 stays Pending: this plan ships pure functions only; nothing calls them until plan 07-07 wires the stack into usePanelDrag and NumogramClient and the Names panel exists (07-17 to 07-21)

# Metrics
duration: ~15min
completed: 2026-11-09
---

# Phase 7 Plan 03: Live Desktop Stack and Drag Reducers Summary

**The desktop panel stack as a pure function that reproduces today's base-10 placement exactly (measured heights and 20,000 random sets, unrounded chain with Math.round at the end) and follows every height change, plus the Names slot and body room and pure drag/z reducers (drag seeded from the displayed position, moved on the first move, z never above 69), with 21 mutants killed.**

## Performance

- **Duration:** about 15 min
- **Tasks:** 2 of 2 (each as a RED commit, a GREEN commit and one test-hardening commit)
- **Files created:** 4 (2 app/lib modules, 2 test files); no existing file modified
- **`$PLAN_BASE`:** `db8280060846fa170a354fb883a2ac37ddad130b` (`git diff --stat` against it lists exactly the four new files, 965 insertions)

## Accomplishments

- `computeDesktopStack` returns null until layers, labels, zones, regions and currents have a non-zero height (the old guard), then places every panel at `y_prev + height_prev + 18` in its column. At the measured base-10 heights (146, 101, 270, 145, 143, 143, 270, 30, 296.5) it gives the browser-observed tops Labels 228, Zones 347, Syzygies 635, Currents 227, Gates 388, Text 676, Selection {942, 64} and Names {942, 379}. A collapsed Layers panel (30) moves Labels, Zones and Syzygies up by exactly 146 - 30 and leaves the other columns alone.
- **Base-10 identity oracle:** the stack equals a literal copy of the old NumogramClient effect (constants written out as 64, 18, 12, 216) for all eight panels the old effect placed, at the measured heights and on 20,000 fast-check height sets (seed 20261020, three arms: doubles in [20, 700], tenths and halves of a pixel), with zero mismatches; four pinned tenth-pixel cases (found by a deterministic search) fail by one pixel under the other chain association.
- `namesX` and `namesBodyMax` give every value in the behaviour list: 548, 568, 659, 692, 942, 1022, 1028 for the seven viewport rows; body room 291, 259, 80 (minimum), 560 (maximum), 473 (mobile slot).
- The drag reducers seed from the displayed position (Labels stored y 206, displayed 228: a 5 px and a 60 px move give exactly the mouse delta, mouse down plus mouse up leaves it at 228), mark a panel moved only on the first move, keep a moved panel's stored position while the derived map (which takes no `moved` input) keeps reserving its slot.
- The z counter: 20 activations hand out 50 to 69, the 21st re-ranks the ten panels onto 40..49 in their current order and continues from 50; 80 activations cycling the ten ids never exceed a literal 69, the last panel activated is always the highest, and 300 random runs of 40 to 500 activations keep every z in 40..69, distinct, with the others' relative order preserved at each re-rank.

## Task Commits

1. **Task 1: computeDesktopStack, namesX and namesBodyMax with the old formula as oracle**
   - RED: `88f9814` (test) failing tests (module missing)
   - GREEN: `6d1cdbc` (feat) `app/lib/panelStack.ts`
   - Hardening: `5486b8e` (test) generator arms that reach the rounding ties, and the Names x versus Selection x case (both found by mutation, see below)
2. **Task 2: pure drag and z-index reducers**
   - RED: `b55f660` (test) failing tests (module missing)
   - GREEN: `6660ef8` (feat) `app/lib/panelDrag.ts`
   - Hardening: `a19927d` (test) the random z property now always crosses a re-rank (activation runs of at least 40)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/lib/panelStack.ts` - constants (six moved with their values, plus `NAMES_PANEL_WIDTH` 240, `PANEL_HEADER_HEIGHT` 34, `PANEL_EDGE_GAP` 12, `NAMES_MIN_X` 548, `PANEL_BOTTOM_RESERVE` 96, `NAMES_BODY_MIN` 80, `NAMES_BODY_MAX` 560, `INITIAL_INFO_X` 420), `STACK_PANEL_IDS`, `DESKTOP_COLUMNS`, `STACK_REPORTERS`, `namesX`, `namesBodyMax`, `computeDesktopStack`
- `app/lib/panelDrag.ts` - `Z_BASE`, `Z_CAP`, `Z_RERANK_START`, `Point`, `DragState`, `initialDragState`, `activate`, `dragStart`, `dragMove`, `dragEnd`, `displayedPositions`
- `tests/app/panelStack.test.ts` - 42 tests (constants, columns, measured-height identity, guard, follow-on-change, 20,000-run identity property, four pinned tie cases, namesX and namesBodyMax tables and clamps)
- `tests/app/panelDrag.test.ts` - 31 tests (initial state, activate and the cap, drag seed and no-jump, moved flag, slot reservation against the real derived stack, displayed positions, immutability through frozen states)

## Decisions Made

See `key-decisions` above. The [default] decisions the plan records (z cap 69 with a re-rank onto 40..49, no fold-aware tweak at larger bases) are implemented as stated; the stack never skips, wraps or squeezes a slot.

## Mutation Checks

Each mutant was applied by a script that replaces one unique string in a saved-original file, the suite was run in the foreground under a 120 s timeout, the source was restored from the saved copy and `git diff --quiet` confirmed it equal to HEAD.

### panelStack.ts

| # | Mutation | Result |
|---|----------|--------|
| 1 | Plan: `y += (heights[id] ?? PANEL_HEADER_HEIGHT) + DESKTOP_PANEL_GAP` | First run: SURVIVED the 20,000-run random property (only the pinned tie case failed), because pure doubles almost never land on a rounding tie and the first generator mixed arms per height. Fixed (whole sets from a double, tenths and halves arm); now killed by the random property and the pinned ties (2 failures) |
| 2 | Plan: drop `Math.round` | Killed (5 failures: Names 378.5, the .5-tie test, the 20,000-run property, the Names property, the pinned ties) |
| 3 | guard `every` -> `some` | Killed (3 failures) |
| 4 | first panel of a column no longer exactly 64 | Killed (8 failures) |
| 5 | namesX without the 548 minimum | Killed (2) |
| 6 | namesX without the `vw - 252` clamp | Killed (2) |
| 7 | namesBodyMax without the 96 reserve | Killed (5) |
| 8 | namesBodyMax without the 80 minimum | Killed (2) |
| 9 | Names x = selectionX instead of `namesX(...)` | First run: SURVIVED (no test had a Names x that differs from Selection x through `computeDesktopStack`). Added the 489/821 and 1200/1280 case; now killed (1 failure) |
| 10 | unreported panel contributes 0 instead of 34 | Killed (1) |

### panelDrag.ts

| # | Mutation | Result |
|---|----------|--------|
| 1 | Plan: `Z_CAP` 69 -> 79 | Killed (3 failures: the constant pin, the 21st-activation re-rank, the 80-activation loop, which asserts a literal 69) |
| 2 | Plan: seed `dragStart` from `s.stored[id]` | Killed (6 failures, among them the 5 px / 60 px mouse-delta case) |
| 3 | moved set on mouse down | Killed (4) |
| 4 | moved never set on move | Killed (6) |
| 5 | re-rank threshold `Z_CAP + 1` | Killed (2) |
| 6 | re-rank restart 60 | Killed (5) |
| 7 | re-rank in descending order | First run: only the 21st-activation test failed (fast-check's default array size left the random runs short). Raised the minimum run length to 40; now also killed by the random property (2 failures) |
| 8 | `dragStart` does not activate | Killed (1) |
| 9 | displayed ignores the moved flag | Killed (5) |
| 10 | `derived?.[id]` for the null case | Equivalent mutant (same behaviour for a null derived map); not a gap, not killable |
| 11 | re-rank assigns every panel `Z_BASE` | Killed (2) |

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/panelStack.test.ts tests/app/panelDrag.test.ts --project oracle`: 2 files, 73 tests passed (42 + 31); the same in `CCRUG_TZ=America/New_York`.
- `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` (the whole oracle project): 62 files, 1765 tests passed.
- `npm run typecheck` (root tsc, engine and engine-test tsc, components tsc, lint): exit 0 (the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched).
- `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten); `--only base-ten` was also run after `git add` of each new app/lib file.
- Acceptance greps: the `y = y + (heights[id] ?? PANEL_HEADER_HEIGHT) + DESKTOP_PANEL_GAP` line, `export const NAMES_PANEL_WIDTH = 240` and `export const Z_CAP = 69` each appear once; the stack test contains `function oldFormula` and `numRuns: 20000`; a node check finds no non-ASCII or control character in any of the four new files.
- `git diff --stat db82800 HEAD`: exactly the four new files. No frozen oracle (`e2e/__golden__`, `e2e/__behaviour__`, `engine/test/fixtures`), no `reference/` file, no `Projection.tsx`, `PairGraphProjection.tsx` or `app/presets/base10/**` file and no existing app file was touched.
- `npm run test:swap` and `npm run verify` were not run: this plan adds only new files under `app/lib/` and `tests/app/` that nothing imports yet (plan 07-07 wires them), so no build input, DOM golden or behaviour baseline can change. The whole oracle unit project, the typecheck and the repo guard above cover the surfaces the plan can affect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test adequacy] The plan's random height generator could not kill the plan's own mutant**
- **Found during:** Task 1 mutation check
- **Issue:** The plan specifies heights as doubles in [20, 700] and says the `y +=` mutant must fail the random identity property. A rounding tie needs every term of a chain on one decimal grid, which a pure double never produces; with a first version that mixed the arms per height the property still passed on the mutant (only the pinned tie test failed).
- **Fix:** Whole height sets are drawn from one of three arms (doubles in [20, 700], tenths, halves); the double arm keeps the plan's range. The property now fails the mutant, and four tenth-pixel cases found by a deterministic search are pinned with hard-coded expected tops (470, 1188, 850, 832; the other association gives 469, 1187, 849, 833).
- **Files modified:** `tests/app/panelStack.test.ts`
- **Commit:** `5486b8e`

**2. [Rule 1 - Test adequacy] Two surviving mutants found and killed**
- **Found during:** mutation checks (stack mutant 9: Names x equal to Selection x; drag mutant 7: descending re-rank, which only the 21st-activation test caught because fast-check's default array size kept the random runs short)
- **Fix:** added the 489/821 and 1200/1280 Names x case; random activation runs now have at least 40 steps so every run crosses a re-rank.
- **Files modified:** `tests/app/panelStack.test.ts`, `tests/app/panelDrag.test.ts`
- **Commits:** `5486b8e`, `a19927d`

**3. [Minor, plan wording] `dragMove` association**
- The plan writes `{ ox + mx - drag.mx, ... }`; the module computes `ox + (mx - d.mx)`, the association the pre-07-03 hook used. Identical for integer mouse coordinates (all the plan's examples), and no more than one ulp apart for fractional ones.

**4. [Minor] Extra imports and no-op identity**
- `panelDrag.ts` also imports `DESKTOP_PANEL_LEFT_X` and `DESKTOP_PANEL_RIGHT_X` (the plan lists a subset) so the initial x values are not repeated as literals. `dragMove` and `dragEnd` return the very same state object when there is no drag, so the hook's setState bails out of a re-render.

---

**Total deviations:** 2 test-adequacy fixes (found by the plan's own mutation step), 2 minor notes.
**Impact on plan:** None changes an exported name, a value or a result the plan specified; no scope creep.

## Issues Encountered

None beyond the deviations above. Plan 07-07 must remember two things this plan deliberately leaves to it: the hook's `activatePanel` currently returns early when the panel is not in `positions` (Names must be in the map), and `NumogramClient` must keep `Math.round` semantics by feeding `computeDesktopStack` the same unrounded `getBoundingClientRect().height` values that `onPanelHeight` stores today (it already ignores changes below 0.5 px, which is fine for the stack: the old effect ran once, the new one re-derives per change).

## Known Stubs

None. Both modules are complete and unit-tested; they are intentionally not yet called from the hook or the viewer (plan 07-07).

## Threat Flags

None. Pure functions and tests only: no endpoint, auth path, file or storage access and no schema at a trust boundary. T-07-16 (UI redress by an unbounded z counter) is mitigated as planned: the counter never hands out more than 69, below the toolbar and shortcuts button (74), the Demons overlay (80) and the base picker dropdown (120), pinned by the 80-activation test against a literal 69 and a 300-run random property. T-07-21 (a non-finite height misplacing panels) is accepted as planned: heights come from `getBoundingClientRect` and the null guard waits for the reporters.

## TDD Gate Compliance

Both tasks followed RED then GREEN as separate commits: `test(07-03)` `88f9814` before `feat(07-03)` `6d1cdbc`, and `test(07-03)` `b55f660` before `feat(07-03)` `6660ef8`. Both RED runs failed on the missing module. No refactor commit was needed; the two `test(07-03)` hardening commits followed the mutation checks.

## Next Phase Readiness

- Plan 07-07 can import `computeDesktopStack`, `STACK_REPORTERS`, `DESKTOP_COLUMNS`, `namesX`, `namesBodyMax` and the constants from `app/lib/panelStack.ts` (and delete the six module-private constants in `NumogramClient.tsx`), and hold one `DragState` in `usePanelDrag` driven by `initialDragState`, `dragStart`, `dragMove`, `dragEnd`, `activate` and `displayedPositions`; the hook's `stackPanels` is dead code and can go with the rewrite.
- Todo 008 stays pending until 07-07 wires the stack and the e2e regression exists; the orchestrator moves it to completed at the phase gate (07-25).
- No blocker.

## Self-Check: PASSED

- All four created files exist and are tracked (`git ls-files app/lib/panelStack.ts app/lib/panelDrag.ts tests/app/panelStack.test.ts tests/app/panelDrag.test.ts`).
- All six task commits exist (`88f9814`, `6d1cdbc`, `5486b8e`, `b55f660`, `6660ef8`, `a19927d`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file and no existing app file was touched.
