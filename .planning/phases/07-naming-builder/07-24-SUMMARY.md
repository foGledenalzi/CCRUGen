---
phase: 07-naming-builder
plan: 24
subsystem: e2e-panel-geometry-and-page-weight
tags: [naming, panel-stack, geometry, mobile, planetary, drag, z-cap, page-weight, e2e, mutation-testing, playwright]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-03 (namesX, namesBodyMax, the derived desktop stack), 07-07 (the nine-panel stack spec and the todo 008 trigger), 07-21 (the Names panel mounted in both stacks, e2e/names-helpers.ts), 07-22 (settleAnimations and the panel's content)
provides:
  - 53 new tests in e2e/panel-stack.spec.ts (62 in all, the 9 of 07-07 unchanged) that prove the Names panel's placement in both stacks at every UI-SPEC viewport, state, tier and layout, by geometry
  - the /numogram/ page-weight baseline raised once, through the ledger command, with the exact numbers and a pointer to todo 007
  - three observations about the contract's own numbers, logged in deferred-items.md (no app bug found, no app file changed)
affects: [07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geometry is measured only after the 200 ms collapse transition has finished (settleAnimations) and the ten boxes have been equal in three consecutive samples 100 ms apart: a condition, never a sleep"
    - "Contract numbers (240 wide, x floor 548, 12 px edge gap, 96 px reserve, 80 px minimum, 560 maximum, the 18 px and 6 px gaps, the 12 px scroller inset) are literals in the spec, and the pure model (namesX, namesBodyMax, NAMES_PANEL_WIDTH, NAMES_BODY_MIN) is checked against the measured page as well, so a changed constant AND a model that drifted from the page are both caught"
    - "A control another panel overlaps is hit-tested at the middle of the overlap, not only at its own centre (a centre-only test let a mutant through)"

key-files:
  created: []
  modified:
    - e2e/panel-stack.spec.ts
    - perf/page-weight.baseline.json
    - .planning/phases/07-naming-builder/deferred-items.md

key-decisions:
  - "No app code was changed: the specs found no overlap or clipping bug at any viewport, state, tier or layout, so there was nothing to fix and `npm run test:swap` was not needed (git diff of app/, engine/ over the plan is empty)"
  - "The tap-target rule (24 x 24) is checked on the controls inside the Names panel's content root; CyberPanel's shared 10 x 10 header toggle (every panel since Phase 4) is outside it, as the UI-SPEC scopes the rule to the controls this phase adds"
  - "The body minimum is checked as the UI-SPEC states it in two places: the room handed to CyberPanel is clamp(80, ..., 560) and the one scroller is 12 px shorter, so the visible body at the clamp is 68 px; the spec pins both so a change is deliberate (logged in deferred-items.md)"
  - "The 'selection growth' and 'drag' specs clear the selection with the clear button AND unpin with a click on the bare diagram background: a zone click pins the zone, and Selection stays at its 52vh cap while anything is pinned"
  - "A DOM click opens the Text panel in the matrix: at the shorter windows its header lies below the fold (base 64 puts it at y 1448) where no pointer click can reach it, and the geometry does not depend on how it was opened"
  - "The page-weight baseline was raised once, after the last code-touching plan, from a clean build of unmodified source, with domNodes unchanged (6405 in total); the raise is flagged for the user at the 07-25 checkpoint"

patterns-established:
  - "Mutants for a layout spec are judged against the spec after a rebuild: 18 app mutants (constants, the stack, the mobile order and gap, the scroller inset, the tap-target and wrap classes, the z counter, the drag seed, the toolbar z) each killed by a named case"

requirements-completed: []  # NAM-01 stays Pending at the orchestrator's phase gate (07-25); the geometry is now e2e-proven

# Metrics
duration: about 46 min (09:57 MST, the 07-23 completion commit, to 10:43, the baseline commit), including 18 mutant builds and 4 full runs of the extended spec
completed: 2026-11-11
---

# Phase 7 Plan 24: Names Geometry Across Viewports and the Page-Weight Baseline Summary

**The Names panel's placement is now proved by geometry at every UI-SPEC viewport in both stacks (53 new tests, no overlap, clipping or covered control found, 18 app mutants killed), and the /numogram/ page-weight baseline is raised once through the ledger command: JS 808,836 to 890,987 bytes raw (+10.2%) and 245,874 to 273,143 gzip (+11.1%), for the user to review at the 07-25 checkpoint.**

## Performance

- **Duration:** about 46 min (see Metrics)
- **Completed:** 2026-11-11
- **Tasks:** 2 of 2
- **Files modified:** 3 (e2e/panel-stack.spec.ts, perf/page-weight.baseline.json, deferred-items.md); no app, engine or frozen file
- **`$PLAN_BASE`:** `b817059cd5fdd778006949749302f03cd817ea04`

## Accomplishments

- **Task 1: the geometry specs.** Appended to `e2e/panel-stack.spec.ts` (the 07-07 tests untouched: `git diff $PLAN_BASE -- e2e/panel-stack.spec.ts | grep -c "^-[^-]"` is 0; one `test.skip(` as before). 53 tests:
  - **Matrix (32):** no pair of the ten panel boxes intersects (0.5 px allowance) at 821x768, 900x800, 991x800, 1024x768, 1280x800, 1280x900 and 1440x900 for bases 10, 28, 64 and 202 (a Canvas base, `SVG_RICH_MAX_N + 2`), in four states (defaults; Names open; Names open with Text open; Names open with `selected=0..7`, SVG tier only), plus Canvas bases 1000 and the ceiling (4000) at 821x768 and 1280x800. In every state the nine-panel stack rule of 07-07 still holds, Names' left is `namesX(Selection left, vw)` and the contract's `min(max(sel, 548), vw - 252)`, its width is 240, its top is Selection's bottom + 18, its right edge is at most `vw - 12`, it does not intersect the zoom toolbar or the shortcuts button, both stay clickable, and, open, the wrapper's max-height equals `namesBodyMax(top, vh)` and the clamp literal, the scroller is 12 px shorter, and the box ends at or above `vh - 96` (these viewports are all 742 px or taller).
  - **Slot rule (1):** at 1280x800 base 10 Selection is at x 942 and Names under it at x 942 (the UI-SPEC's numbers), top = Selection bottom + 18, body room = `800 - (y + 34) - 96`.
  - **Selection growth (1):** eight zone clicks on the diagram (pointer never in the Names panel): Names follows Selection after every click, and after clear plus a click on the bare background it is back at its first top (within 1 px).
  - **Selection at its 52vh cap (5):** base 64 with 40 selected zones at 1280x800, 1024x768, 1280x900, 1280x700 and 1024x600: Selection's own scroller is 52vh tall and scrolls, the room equals the clamp, the box ends at or above `vh - 96` from 742 px, below that the room is exactly 80 and the toolbar and shortcuts button stay clickable (also where the Names box reaches them), the body scrolls inside its one scroller and the wrapper does not.
  - **todo 008 with Names open (1):** base 10 to 28 and back through the picker, the ten panels stay stacked (the nine-panel version of 07-07 stays as it was).
  - **Phone windows (7):** 375x667 and 768x1024 with touch, bases 10, 28 and 202: Names at (8, 64), 240 wide, collapsed and open; the ten panels form one column 6 px apart with no intersection; no overlap with the toolbar or the shortcuts button; the open box ends at or above `vh - 96` with the clamp room at y 64; `documentElement` and `body` do not scroll sideways; the wrapper does not scroll (one scroller); the scroller, every radio group, button row, table row and list row has `scrollWidth <= clientWidth` and every cell, control and row lies inside the body; every button and radio or checkbox label in the panel is at least 24 x 24. A seventh test: at 375x667 the base dropdown (z 120) is the topmost element over the part of the open Names box it overlaps.
  - **Planetary clearance (4):** `layout=planetary&date=2000-01-01` at 992, 1024, 1280 and 1440 wide: the Names box, collapsed and open, intersects none of the buttons and the date input of the top bar.
  - **Drag (1):** mouse down and up on the Names header without moving changes nothing; a 5 px move gives exactly the mouse delta, then 60 and 40 px in all; the body room follows the dragged y; Selection growing (a zone click) and shrinking (clear and unpin) leave the dragged Names exactly where it was dropped.
  - **Stacking (1):** 80 header presses across all ten panels never pass z 69, Names (the last pressed) is on top of the other nine, the toolbar stays at 74 above all, the presses move nothing, the Demons overlay (80) is the topmost element at the middle of the open Names box and the base dropdown (120) is above every panel.
- **Task 2: page weight.** `npm run check:weight` failed since 07-18 and failed on the final build, only on `/numogram/` jsBytes and jsGzip. After confirming the prerendered HTML holds no Names body (`grep -c "data-names-scroll" out/numogram/index.html` is 0), the source clean (`git diff HEAD -- app engine perf` empty) and `out/` a clean rebuild, `node scripts/page-weight.mjs update --reason "Phase 7 naming builder (2026-11): ..."` raised the baseline (history entry 10); `check` then exits 0. The JSON was never edited by hand.

## Page weight (the decision for the user at the 07-25 checkpoint)

| /numogram/ | baseline (post Phase 6) | after the Phase 7 UI | change |
|---|---|---|---|
| jsBytes (raw) | 808,836 | **890,987** | +82,151 (**+10.2%**) |
| jsGzip | 245,874 | **273,143** | +27,269 (**+11.1%**) |
| htmlBytes / htmlGzip | 90,137 / 12,985 | 91,501 / 13,076 | +1,364 / +91 (inside tolerance) |
| cssBytes / cssGzip | 20,497 / 5,064 | 21,421 / 5,242 | +924 / +178 (shared with `/`; inside tolerance) |

`/` is unchanged in JS (416,918 raw; gzip 128,175 to 128,174) and its CSS moved with the shared stylesheet; the update stores both routes' measured values. Golden DOM node counts are unchanged (total 6,405, 30 states). The limit before the raise was 849,278 raw and 258,168 gzip. Mounting the panel in 07-21 had already taken gzip from 260,596 to 273,143.

What grew (named in the ledger): `engine/naming` (seeded generator with the Feistel permutation, euphony banks, validator, derivation, collision scan, serializer), the naming session, storage and link modules (`app/lib/namingSession`, `namingStorage`, `namesLink`, `namingCopy`, `soundLabels`), the Names panel with its virtualized zone list, collision report and demon name editor (`app/components/names`), and the live desktop panel stack (`app/lib/panelStack`, `panelDrag`). All of it is imported eagerly by the viewer. **Lazy-loading the Names, Canvas and worker code (todo 007) would recover most of the raise for visitors who never use them; it was deliberately not done here and no weight was hidden.** With this raise the combined growth over the pre-Phase-6 baseline (726,294 raw, 218,587 gzip) is +22.7% raw and +25.0% gzip.

## Task Commits

1. **Task 1: the geometry specs** - `2677aa1` (test); strengthened in `3fe522c` (test: the toolbar and shortcuts are hit-tested at the middle of their overlap with the Names box, after mutant M17 survived the centre-only test)
2. **Task 2: the page-weight baseline raise through the ledger** - `d89b4c6` (chore)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and the deferred-items entry (hash in the final report).

## Verification Results

Every run below was a single foreground Playwright invocation against a clean build of the unmodified source (`MSYS_NO_PATHCONV=1`, one at a time, port 3111).

- **`e2e/panel-stack.spec.ts`, chromium-utc: 62 passed (9 from 07-07, 53 new), four full runs in a row, all 62/62** (three before and one after the last spec strengthening; the first also ran the chromium-ny project: 62 passed and 62 skipped by design). No flake: every wait is a condition (animations finished, then three equal samples). Timings were not asserted (each case takes 1 to 4 s).
- **Layout-sensitive specs, chromium-utc:** `canvas-interaction` + `layers-zoom` 22 passed (the 375 x 667 touch and 768 x 1024 cases included); `canvas-tier` + `row-click-regression` + `region-legend` 28 passed (including the todo 008 mouse clicks on Warp and Plex Isolate/Mute at base 202 at 1280x800 and 1440x900); `names-smoke` + `names-session` 21 passed. No pre-existing assertion needed changing.
- **`npx tsc --noEmit --incremental false`** clean (the e2e files are in the root tsconfig). `npm run build` clean.
- `git diff b817059..HEAD --stat` over the plan: `e2e/panel-stack.spec.ts` and `perf/page-weight.baseline.json` only (plus the docs commit). `engine/`, `app/`, the goldens, `e2e/__behaviour__`, `engine/test/fixtures`, the signed-off vectors and the banks are untouched, so `npm run test:swap` was not required.
- `npm run check:weight` (`node scripts/page-weight.mjs check`): FAIL before the ledger update (the two JS metrics above), `OK (2 routes, 30 golden states within tolerance)` after it.

## Mutation Checks

Each mutant: a scratchpad script refuses a find text that is absent, repeated or a no-op; a rebuild of `out/`; the named cases run in the foreground with `--max-failures=1`; the source restored from `git show HEAD:<file>` and `git diff --quiet HEAD -- app engine perf` clean after every one. One at a time, none in the background by choice (one long call, the M2 to M4 batch, was moved to the background by the tool after 180 s and waited for). All 18 **killed**:

| Mutant | Killed by |
|---|---|
| M1: `PANEL_BOTTOM_RESERVE` 96 to 40 | the matrix, base 10 at 821x768, Names open (body room and the `vh - 96` bound) |
| M2: `NAMES_MIN_X` loses its 12 px gap (536) | the same cell, defaults (Names left 536, contract 548) |
| M3: Names gets no `maxBodyHeight` | the same cell, Names open (wrapper max-height 500 against the clamp) |
| M4: Names last in the mobile order | the mobile 375x667 base 10 case, collapsed (Names top) |
| M5: the scroller loses its 12 px inset | the matrix, Names open (scroller max-height) |
| M6: `TARGET` (the 24 px minimum) emptied | the mobile base 10 case, open (a control under 24 x 24) |
| M7: radio rows do not wrap | the mobile base 10 case, open (overflow) |
| M8: activating Names never raises its z | the z-cap case (Names above Layers) |
| M9: Names drag seeded from its stored position | the drag case (first-move delta) |
| M10: Names x = Selection x (no floor, no clamp) | the matrix, 821x768, defaults |
| M11: Selection's height a constant 300 in the stack | the matrix, 821x768, defaults (Names top) |
| M12: `NAMES_BODY_MIN` 80 to 20 | the 52vh-cap case at 1280x800 (the model pin; the short windows also expect room 80) |
| M13: Names pinned to y 64 | the matrix, 821x768, defaults (overlap) |
| M14: header 34 to 10 in the room formula | the matrix, 821x768, Names open |
| M15: mobile body room ignores the reserve (560) | the mobile base 10 case, open |
| M16: mobile stack gap 6 to 0 | the mobile base 10 case, collapsed (gap) |
| M17: the zoom toolbar's z 74 to 30 | the 52vh-cap case at 1024x600, **only after** the spec was strengthened: the first version passed against it (re-run to confirm), so `3fe522c` hit-tests the overlap |
| M18: Names centred in the top bar (clear of every other panel) | the planetary clearance case at 992 (the planetary controls) |

One build failure (M10 as first written left `vw` unused, a lint error) was fixed in the mutant, not in the app. After the last restore `out/` was rebuilt from clean source and the extended spec re-run green (62 passed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - expectation in my own spec, not an app bug] Three first-draft assertions contradicted the contract or the app's real behaviour**
- **Found during:** Task 1. **Issue:** (a) I expected Selection to return to its empty height after the `clear` button, but `clear` drops the selection and not the pin; a zone click pins the zone and Selection is at its 52vh cap (464 px at 800) while anything is pinned. (b) I asserted the open body is at least 79 px at the 80 px minimum room, but the UI-SPEC's own "Scrolling" row makes the scroller 12 px shorter than the room, so the visible body is 68 px at the clamp (both statements are implemented as written). **Fix:** the specs clear the selection and unpin with a click on the bare background; the spec pins the 12 px inset and the 68 px floor instead. Both are recorded in `deferred-items.md`. **Commit:** `2677aa1`.

**2. [Rule 2 - missing coverage found by a mutant] The clickability of the toolbar and shortcuts button was tested only at their centres**
- **Found during:** Task 1 mutation checks (M17). **Fix:** where the Names box reaches either control (windows under 742 px tall with Selection at its cap) the hit test also runs at the middle of the overlap. **Commit:** `3fe522c`.

### Additions beyond the plan's list (more coverage, no scope change)

Canvas bases 1000 and 4000 in the matrix; the five Selection-at-the-cap cases (the instruction's explicit pinned-Selection check, with two windows under 742 px); the todo 008 base switch with Names open; the dropdown-over-Names case at 375 x 667; the `Names top = Selection bottom + 18` and the nine-panel stack checks in every matrix state.

### Plan wording interpreted

- "Skip the selected-zones state at 202" and the `test.skip(` count of 1: control flow, no new `test.skip`.
- "Names open with Text open" at the shorter windows: Text is opened with a DOM click (base 64 at 800 px tall puts its header at y 1448).
- "Every button... in the panel at least 24 x 24": scoped to the panel's content root (see key-decisions).
- "$PLAN_BASE" was empty in the first shell after a restart; re-exported from the literal above.

## Observations (logged in `deferred-items.md`, nothing changed in app code)

1. **At the body minimum the visible body is 68 px, not 80 px** (room 80 minus the 12 px scroller inset, both from the UI-SPEC): the sticky header plus about 1.6 rows, only when Selection is at its cap in a window under about 708 px tall. The one-line fix and what it would touch are in the entry; the user may want it at the 07-25 checkpoint.
2. **The UI-SPEC's worst-case figures are conservative:** Selection at its cap is `48 + 0.52 vh` tall (not `64 + ...`), so the room is `0.48 vh - 260` and the 80 px minimum binds below about 708 px (not 742). The contract holds with margin.
3. **The shared CyberPanel header toggle is 10 x 10** (every panel since Phase 4), outside the 24 px rule for this phase's controls.
4. **Todo 008 stays pending until the 07-25 gate moves it:** its acceptance criteria are covered by `panel-stack.spec.ts` (the base 10 to 28 picker trigger with and without Names open, the whole matrix) and by the mouse clicks on Warp and Plex Isolate/Mute in `region-legend.spec.ts` at base 202.

## Issues Encountered

None that touched app code. The tool moved one long call (the M2 to M4 mutant batch) to the background after 180 s; it was waited for and its result read before the next step.

## Known Stubs

None.

## Threat Flags

None: no new endpoint, storage key, file access or trust boundary (e2e and a budget ledger only). T-07-16d (UI redress by overlapping panels) is mitigated by the matrix, clearance, mobile and planetary specs and the 18 mutants above; T-07-25 (budget integrity) by the ledger-only update, unchanged domNodes and a prerendered HTML without the Names body.

## Next Phase Readiness

07-25 (the full `npm run verify`, validation sign-off, todo 008 moved to completed, the manual screen-reader, stack and narrow-window checkpoint) can start: `npm run check:weight` passes, so `verify` no longer stops at that step. The user should decide at 07-25 whether to keep the page-weight raise or schedule todo 007, and whether to take the 12 px body-minimum fix.

## Self-Check: PASSED

- Files: `e2e/panel-stack.spec.ts`, `perf/page-weight.baseline.json`, `.planning/phases/07-naming-builder/deferred-items.md` and this summary exist.
- Commits `2677aa1`, `3fe522c` and `d89b4c6` exist on `main`, each ending with the `Co-Authored-By: Claude Sonnet 5` trailer; nothing was pushed.
- `git diff HEAD -- app engine perf` was empty after every mutant restore and before the page-weight update; `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty.
