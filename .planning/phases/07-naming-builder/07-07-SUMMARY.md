---
phase: 07-naming-builder
plan: 07
subsystem: ui
tags: [panel-stack, drag, z-index, usePanelDrag, NumogramClient, playwright, e2e, todo-008, mutation-testing]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-03 (computeDesktopStack, STACK_REPORTERS, the pure drag and z reducers, the 69 z cap)
provides:
  - the live desktop panel stack in the browser: every panel the user has not dragged sits at the previous panel's measured bottom + 18 in its column and follows any height change, including a base change (todo 008's behaviour)
  - app/hooks/usePanelDrag.ts rebuilt on app/lib/panelDrag.ts (displayed positions, drag seeded from the displayed position, moved flag on the first move, z cap 69, a `names` slot in the maps)
  - e2e/panel-stack.spec.ts (9 tests) and the todo 008 regression in e2e/region-legend.spec.ts (3 test cases: the picker trigger 10 then 28, and real mouse clicks at base 202 at two viewports)
affects: [07-17, 07-21, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Old-versus-new probe: the base-10 placement claim was proven by building the plan-base sources, dumping every panel's box at four viewports from the old and the new static export and diffing them (identical), instead of trusting a formula test alone"
    - "Layout specs poll a violation list (expect.poll(layoutViolations).toEqual([])) so a failure prints every broken rule, and wait for a collapsing panel's height to stop changing before measuring (the body animates for 200 ms)"

key-files:
  created:
    - e2e/panel-stack.spec.ts
  modified:
    - app/hooks/usePanelDrag.ts
    - app/NumogramClient.tsx
    - e2e/region-legend.spec.ts

key-decisions:
  - "The hook mirrors `drag !== null` in a ref (panelDragActiveRef) so a window mouse move with no panel drag costs no setState; React would bail out of an identical state but may still render the large NumogramClient once when a lane is pending"
  - "activatePanel is a stable callback (functional setState, no dependency on positions) because it no longer needs the positions map; startDrag still depends on positions because it seeds from the displayed position"
  - "Selection's x is measured once as before (infoPanelInitRef) and stored in selectionX; computeDesktopStack falls back to INITIAL_INFO_X (420) until then, which is the old pre-measure position"
  - "The mobile path (usePanelGroupLayout, PANEL_GROUP_ORDER) is untouched; derivedStack is null at 820 px and below"

patterns-established:
  - "A panel toggle is found by its aria-label (Collapse X / Expand X): the old `header button:not([data-post-baseline])` locator matches nothing now that the toggle carries data-post-baseline"

requirements-completed: []  # NAM-01 stays Pending: the Names panel itself mounts in plan 07-21; this plan ships the live stack it joins

# Metrics
duration: ~60min
completed: 2026-11-09
---

# Phase 7 Plan 07: Live Desktop Stack Wired In Summary

**The desktop panel stack now follows every measured panel height (computeDesktopStack inside NumogramClient, usePanelDrag rebuilt on the pure drag and z reducers), base 10's placement is byte-for-byte what the one-shot effect gave at four viewports, base 10 then 28 no longer overlaps Regions and Currents, and 9 stack tests plus 3 todo 008 regression tests prove it in Chromium, with the three mutants that matter killed.**

## Performance

- **Duration:** about 60 min
- **Tasks:** 2 of 2
- **Files:** 1 created (e2e/panel-stack.spec.ts), 3 modified (usePanelDrag.ts, NumogramClient.tsx, region-legend.spec.ts)
- **`$PLAN_BASE`:** `655027fe2e8ff128bf8486f8a7298558b7420a8d`

## Accomplishments

- `NumogramClient.tsx`: the one-shot layout effect (`desktopPanelLayoutInitRef`) and the six local layout constants are gone (imported from `app/lib/panelStack.ts`, same values). `derivedStack = useMemo(() => viewport.w > 820 ? computeDesktopStack(desktopPanelHeights, { selectionX: selectionX ?? INITIAL_INFO_X, vw }) : null, ...)` feeds `usePanelDrag(derivedStack)`; `selectionX` is the `left` the info init effect always computed, kept in state. The ten `panelPositions.X` / `panelZ.X` call sites and `onPanelHeight` are unchanged.
- `usePanelDrag.ts`: one `DragState` over the reducers, `positions = displayedPositions(state, derived)`, `startDrag` seeds from the displayed position, the window move handler calls `dragMove` (the panel becomes moved on the first move, never on mouse down), mouse up calls `dragEnd`, `zIndexes` is `state.z` (never above 69). `setPanelPositions` and the dead `stackPanels` are deleted; the canvas pan handlers are unchanged.
- **Base-10 placement identity, measured:** the plan-base sources were rebuilt and the static export probed at 1440x900, 1280x800, 1280x900 and 1024x768 (every panel's x, y, width and height, plus style left/top/width): old and new are identical in all 36 panel boxes (Layers 64, Labels 228, Zones 347, Syzygies 635, Regions 64, Currents 227, Gates 388, Text 676, Selection 64; Selection x 1022, 942, 942 and 692). At base 28 (1280x800, 10 then 28 through the picker) the old build kept Currents at 227 on top of Regions (64 to 250), Zones 347, Gates 388, Syzygies 635; the new one gives Currents 268, Zones 326, Gates 618, Syzygies 874, Text 1166 (every top equals the previous bottom + 18).
- **todo 008:** at base 202 the Regions panel (3 Torques, Warp, Plex, Time Circuit) is 89.5 px taller than the stale slot allowed; with the live stack a real mouse click (no force) toggles Isolate and Mute of every row (Torque A, B, C, Warp, Plex) at 1280x800 and 1440x900.

## Task Commits

1. **Task 1: rebuild usePanelDrag on the reducers and derive the stack in NumogramClient** - `4b29a51` (feat); `npm run typecheck` exit 0, `npm run test:swap` exit 0 (65 passed, 5 skipped incl. the 60 DOM goldens and the behaviour baseline, 99 files and 2848 unit tests)
2. **Task 2: e2e proof of the live stack and the todo 008 regression** - `c01b668` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/hooks/usePanelDrag.ts` - rebuilt on `app/lib/panelDrag.ts`; signature `usePanelDrag(derived)`; returns `{ positions, zIndexes, activatePanel, startDrag, canvasPan, setCanvasPan, startCanvasDrag }`
- `app/NumogramClient.tsx` - `derivedStack` useMemo, `selectionX` state, one-shot effect removed, local constants replaced by imports (net -35 lines)
- `e2e/panel-stack.spec.ts` - 9 tests: base 10 at 1440x900, 1280x800 and 1024x768 (first tops 64, lefts 12 and 216, widths 180 and 320 for Text and Selection, each top = previous top + previous height + 18 within 1 px, no two panels overlapping); today's literal tops at 1280x900; the todo 008 trigger (10 then 28 through the picker); drag no-jump, exact delta (5 px then 60 px), reserved slot and collapse follow for Labels (Layers collapses, Zones follows) and Currents (Regions collapses, Gates follows); Layers collapse and expand with Labels, Zones and Syzygies; 80 header presses with every z at most 69, the last pressed panel on top and the toolbar (computed z 74) above all
- `e2e/region-legend.spec.ts` - two tests added after the existing six (unchanged): `todo 008: base 10 then 28 through the picker leaves Regions and Currents apart`, and `todo 008: a real mouse click on Warp and Plex Isolate/Mute toggles the region at base 202` at 1280x800 and 1440x900 (every Torque, Warp and Plex row: Isolate and Mute each flip aria-pressed and the URL's isolate= or mute= value with a real click and flip back)

## Decisions Made

See `key-decisions` above. The [default] choices of 07-UI-SPEC (z cap 69, no wrapping or squeezing of a slot) are implemented as 07-03 built them.

## Mutation Checks

Each mutant was applied by a script that replaces one unique string in a saved-original file, the project was rebuilt, the spec was run in the foreground, the source was restored from the saved copy and `git diff --quiet` confirmed it.

| # | Mutation | Result |
|---|----------|--------|
| 1 | Plan: the stack is computed once and frozen (a ref latches the first non-null result, the one-shot effect's behaviour) | Killed: 7 of the 18 tests in panel-stack and region-legend fail (todo 008 trigger in both specs, both drag tests at their collapse step, the Layers collapse test, and the base 202 mouse-click test at both viewports with `-89.5` px of overlap); the 11 others (base 10 placement, z cap, existing legend tests) pass, as they should |
| 2 | `startDrag` seeds from the stored position instead of the displayed one | Killed: both drag tests fail (Labels jumps 22 px, Currents 31 px on the first move) |
| 3 | `Z_CAP` 69 to 79 | Killed: the z cap test fails (`Expected <= 69, Received 75`) |

## Verification Results

- `npm run typecheck` exit 0 (the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx`, not touched); `node scripts/check-repo.mjs` OK (11 checks, `base-ten` run after `git add`).
- `npm run test:swap` after Task 1: exit 0, 65 passed and 5 skipped, 99 unit files and 2848 tests.
- The six layout-sensitive specs (`panel-stack`, `region-legend`, `canvas-interaction`, `layers-zoom`, `canvas-tier`, `row-click-regression`): 59 passed (59 skipped for the second timezone project) in each of 3 consecutive runs, no flake.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0 in about 7 min on the final tree (99 unit files and 2848 tests in UTC and in America/New_York, sub-path e2e 12 passed, page-weight OK with no baseline update, e2e 255 passed and 183 skipped including the 60 DOM goldens and the 5 behaviour specs, check-repo 13 checks incl. clean-tree and static-out OK).
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty; no `reference/`, `Projection.tsx`, `PairGraphProjection.tsx` or `app/presets/base10/**` file touched.

## Deviations from Plan

### Auto-fixed Issues

None: the plan executed as written. Minor notes:

**1. [Minor] Toggle locator.** The plan says "its header toggle button"; the toggle now carries `data-post-baseline`, so the older `header button:not([data-post-baseline])` locator finds nothing. The spec uses the button's accessible name (`Collapse Layers` / `Expand Layers`).

**2. [Minor] An extra test.** `base 10 keeps today's exact placement` pins the literal tops measured from the old build (Labels 228, Zones 347, Syzygies 635, Currents 227, Gates 388, Text 676, Selection x 942) at 1280x900, beyond the plan's formula test, so a formula and its test cannot drift together.

**3. [Minor] Base 202 opener.** The plan's `openViewer(page, 'base=202')` plus the `CANVAS_READY` wait is `openCanvas(page, 'base=202')` in the shared helpers (it also checks `data-base`).

No existing spec was changed: `canvas-interaction.spec.ts` keeps pressing Warp and Plex with focus and Space (06-13's workaround stays valid; it could now use real clicks, left to a later cleanup).

## Issues Encountered

None. The spec needed no fixes after its first run (18 of 18, then three clean repeats).

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path, file or storage access was added; T-07-16b (UI redress by an unbounded z counter) is mitigated and proven (80 presses, every z at most 69, toolbar 74 above), T-07-13b (oracle integrity) held (`test:swap` green with no baseline edit, golden and behaviour directories untouched).

## Next Phase Readiness

- Plan 07-21 (Names panel) must make heights reach the stack: `onPanelHeight` still drops ids that are not in `PANEL_GROUP_DEFAULT_HEIGHTS` and `desktopPanelHeights` is typed by the nine-name `PanelId`, so `names` needs adding there (and to `PANEL_GROUP_ORDER` for the mobile group) before its measured height can matter; `names` is already in the hook's maps, in `computeDesktopStack` (x from `namesX`, y under Selection) and in the z reducers.
- Todo 008 stays in `.planning/todos/pending/`: its three acceptance criteria are covered (mouse clicks at base 202 at both viewports; no overlap after 10 then 28; `test:swap` and `verify` green with no oracle regenerated); the orchestrator moves it at the phase gate (07-25).
- No blocker.

## Self-Check: PASSED

- Created file exists and is tracked: `e2e/panel-stack.spec.ts`; modified files present: `app/hooks/usePanelDrag.ts`, `app/NumogramClient.tsx`, `e2e/region-legend.spec.ts`.
- Both task commits exist (`4b29a51`, `c01b668`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer; `git diff --name-only 655027f HEAD` lists exactly those four files.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty; no scratch spec, probe route or `out/` artifact is tracked.
