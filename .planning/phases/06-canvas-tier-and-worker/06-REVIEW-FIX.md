---
phase: 06-canvas-tier-and-worker
fixed_at: 2026-10-19T17:20:00Z
review_path: .planning/phases/06-canvas-tier-and-worker/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-19
**Source review:** `.planning/phases/06-canvas-tier-and-worker/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01, WR-02, WR-03, plus IN-02 and IN-05, which are one to few-line fixes with a test)
- Fixed: 5
- Skipped: 0
- Left alone on purpose (outside the requested scope, recorded as follow-ups by the orchestrator): IN-01 (label formatter re-validates the alphabet on every call), IN-03 (debounced base commit can run with stale props), IN-04 (no recovery for a worker reply that never arrives)

Every fix is one commit that carries its own regression test. Each new e2e test was first run against the previous `out/` build and failed at the intended step, then passed against the rebuilt export. None of the frozen oracles (60 DOM goldens, `e2e/__behaviour__`, numeric oracle, derived fixtures, manifests) was edited or regenerated.

## Fixed Issues

### WR-01: `?tier=svg` builds the whole numogram and SVG on the main thread at any base up to 2^26

**Files modified:** `app/lib/tierBounds.ts`, `tests/app/tierBounds.test.ts`, `tests/app/shareParamsHeadless.test.ts`, `e2e/worker.spec.ts`, `.planning/phases/04-base-picker-and-generator-ui/04-SECURITY.md`
**Commit:** `9dd330a`
**Status:** fixed

**Applied fix:** `tierFor` (the one entry point every app caller uses: link hydration, `commitBase`, `needsWorkerFor`, the swap effect, `parseShareParams`) now ignores an `svg` override when `n > INTERACTIVE_MAX_N`, so the natural tier (headless) wins there. Decision recorded in the code comment:
- `tier=svg` stays a diagnostic from `svgRichMaxN + 2` up to and including the ceiling (4000), as before.
- `tier=canvas` and `tier=headless` are untouched at every base (both are worker-routed; a canvas override above the ceiling still lands as a scene-less headless result, unchanged).
- The clamp lives in the app's `tierFor`, not in the engine's `selectTier`: `selectTier` stays the plain primitive whose existing engine tests (`engine/test/tiers.select.test.ts` "an explicit override still wins above the interactive ceiling") are pinned and were not touched. The table is not edited (`validateTierTable` needs `tierOverrideParam.enabled === true`).
- The accepted-risk note T-04-37 in `04-SECURITY.md` got a dated update stating that the old "only slows the opener's tab" scope no longer applies above 200 and what replaced it (the reviewer asked for it; it is outside the files listed in the task, so it is called out here).

**Regression tests:**
- `tests/app/tierBounds.test.ts`: new `describe` "the svg override never lifts the interactive ceiling (WR-01)": `tierFor` with an svg override at `SVG_RICH_MAX_N + 2`, 1024 and the ceiling is `svg`; at ceiling + 2 and 2^26 it is `headless` and equal to the natural tier; `selectTier` is shown to remain the unclamped primitive. One existing assertion had to change: `expect(tierFor(INTERACTIVE_MAX_N + 2, 'svg')).toBe('svg')` in "the tier= override still wins above the ceiling..." asserted the defect itself. It moved into the new block with the corrected expectation; the canvas and headless override assertions of that test were kept and extended (not weakened).
- `tests/app/shareParamsHeadless.test.ts`: new test that the parsed `tier=svg` state at ceiling + 2 and 2^26 still gives `tierFor(state.base, state.tier) === 'headless'` and builds no numogram. The existing "ignores the tier= override in the guard" test is unchanged and still true.
- `e2e/worker.spec.ts` (two new specs, same heartbeat bound as the 2^26 spec): `?base=4002&tier=svg` shows the over-limit summary (not the "Tier override active" wording), no `[data-diagram]`, no `[data-zone]`, exactly one worker, heartbeat max gap 52 ms (bound 450); and `?base=202&tier=svg` still draws 202 SVG zones with no worker, then a picker commit of 4002 goes to the worker (one worker, no diagram, max gap 98 ms).

**Verification:** Both new e2e specs failed against the previous build (the hydration spec timed out waiting for the summary; the picker spec ended with "Protocol error ... session closed" when the tab died on the main-thread build), and pass on the rebuilt export. `engine/test/tiers.select.test.ts`, `tiers.schema.test.ts`, `shareParams.test.ts` unchanged and green. Unit tests without the fix: 2 of the new tests fail, as intended. `npm run typecheck` clean (the one existing `DemonMatrix.tsx` hook warning is unrelated).

### WR-02: Returning to a previously zoomed Canvas scene restores the stale committed zoom

**Files modified:** `app/components/canvas/CanvasDiagram.tsx`, `app/lib/canvas/diagramModel.ts`, `tests/app/canvasDiagramModel.test.ts`, `e2e/canvas-tier.spec.ts`
**Commit:** `cfc1e26`
**Status:** fixed (logic fix, behaviourally verified, see below)

**Applied fix:** The reviewer's suggestion, with the logic moved into the pure model so it can be unit-tested. `diagramModel.ts` gains `CommittedBox`, `committedFor(box, sceneKey)` (the stored transform for its own key, the identity for any other) and `boxForScene(prev, sceneKey)` (the same box object for the same key, `{ key, IDENTITY_TRANSFORM }` otherwise). `CanvasDiagram` reads `committed` through `committedFor` and its existing scene-key layout effect now also calls `setBox(prev => boxForScene(prev, sceneKey))` next to the `liveRef` reset. The render before the effect already gets the identity from the key mismatch, so no stale frame; on first mount the updater returns the same object, so there is no extra render, and `committed` keeps the same `IDENTITY_TRANSFORM` reference, so no extra re-raster.

**Regression tests:**
- Unit (`canvasDiagramModel.test.ts`, 5 tests): own key versus other key, same-key no-op, replacement on a new key, the zoomed A, B, A walk (identity at every step), and a control showing a never-swapped box does revive the old zoom.
- E2E (`canvas-tier.spec.ts`, 2 tests): base 202 zoomed twice (`data-zoom` 1.5625, toolbar 156%), then 204, then back to 202: `data-zoom="1"`, toolbar `100%`, layer stack `style.transform === ''` at each step, and a toolbar zoom from the returned scene works (1.25); and the layout variant ring, pair graph, ring through the `A`/`F` shortcuts.

**Verification:** Both e2e specs failed against the previous build at the return step (`data-zoom` received `1.5625` and `1.25`), pass on the rebuilt export. All of `canvas-tier.spec.ts` and `canvas-interaction.spec.ts` (25 tests) pass after the change. Unit suite for `tests/app` green (1101 tests at that point). `npm run typecheck` clean.

### WR-03: SVG-tier wheel zoom stays dead after the SVG diagram has been unmounted once

**Files modified:** `app/hooks/useCanvasPan.ts`, `app/NumogramClient.tsx`, `e2e/layers-zoom.spec.ts`
**Commit:** `ee72684`
**Status:** fixed (logic fix, behaviourally verified, see below)

**Applied fix:** The `active` flag from the review. `useCanvasZoom(wrapRef, active = true)`: the effect returns early when `!active || !wrap` and `active` is in the deps, so the non-passive wheel listener is re-bound to the new wrapper element when the SVG branch comes back. `NumogramClient.tsx` passes `!!(view && target)`, the exact condition of the JSX branch that renders the wrapper (both are declared before the hook call). No markup change. Zoom range (0.3 to 5), wheel factor (`exp(-step * 0.0015)`), the 120 ms gesture timer and everything on a first mount are byte-for-byte as before; the default `true` keeps the hook identical for any other caller (there is none). One addition beyond the bare flag: the effect cleanup now also sets `wheelGestureActiveRef.current = false` when it clears the pending gesture timer, so a rebind within 120 ms of a wheel event cannot inherit a gesture whose timer was just cleared (the first wheel after the remount would otherwise keep a stale zoom origin). That line runs only on cleanup, never during a gesture. `useCanvasPan.ts` was explicitly allowed for this task; `Projection.tsx`, `PairGraphProjection.tsx` and `app/presets/base10/**` were not touched.

**Regression test:** `e2e/layers-zoom.spec.ts` "the mouse wheel still zooms the SVG diagram after a visit to a Canvas base (WR-03)": base 10 first-mount wheel (control, scale goes above 1), commit base 202 (Canvas, SVG wrapper unmounted), commit base 10 (new wrapper, zoom reset to 1), wheel over the diagram and assert the scale rose above 1.

**Verification:** The spec failed against the previous build at the final assertion (scale stayed 1) and passes after the fix; the other 10 specs of `layers-zoom.spec.ts` pass. `npm run test:swap` passed unchanged (60 DOM goldens and the behaviour baseline: 65 passed, 5 skipped as designed; unit suite 88 files, 2420 tests). `npm run typecheck` clean.

### IN-02: A Canvas rubber band leaves `suppressNextCanvasClickRef` set

**Files modified:** `app/NumogramClient.tsx`, `e2e/canvas-tier.spec.ts`
**Commit:** `c0c5631`
**Status:** fixed

**Applied fix:** `if (renderTier !== 'canvas') suppressNextCanvasClickRef.current = true` in `finalizeSelection` (one line plus a comment). Only the SVG wrapper's `onClick` consumes the flag, and the Canvas tier ends a drag on its own pointer events, so arming it there could only leak into the next SVG-tier base. The SVG-tier rubber band keeps suppressing its trailing click exactly as before.

**Regression test:** `e2e/canvas-tier.spec.ts` "a Canvas rubber band does not swallow the first background click of the next SVG base": a rubber band of a few tens of px on base 202, commit base 28, pin zone 15 (observed through the `PinnedBackground` layer), one click on the empty SVG background must remove the pin.

**Verification:** The spec failed against the previous build (the pin stayed after the one click) and passes after the fix. `npm run test:swap` passed unchanged (65 passed, 5 skipped as designed; 2420 unit tests). `npm run typecheck` clean.

### IN-05: `INTERACTIVE_MAX_N` is not asserted finite where it is read

**Files modified:** `app/lib/tierBounds.ts`, `tests/app/tierBoundsCeiling.test.ts` (new)
**Commit:** `33a2d2d`
**Status:** fixed

**Applied fix:** `app/lib/tierBounds.ts` throws `tier table has no interactive ceiling (boundaries.interactiveMaxN is missing)` at module load when `INTERACTIVE_MAX_N` is not finite. The shipped table (`interactiveMaxN` 4000) is unaffected and the engine's documented `Infinity` behaviour is unchanged.

**Regression test:** `tests/app/tierBoundsCeiling.test.ts` swaps the table JSON with `vi.doMock` (the real file is never edited) and checks: shipped table loads with a finite ceiling (control); a table with `canvasMaxN: null` and no `interactiveMaxN` throws at import; the same with only `interactiveMaxN` removed; a table whose ceiling comes from `canvasMaxN` alone still loads.

**Verification:** Without the guard, 2 of the 4 tests fail; with it all pass. Full unit suite green (89 files, 2424 tests). `npm run typecheck` clean.

## Final gate

`MSYS_NO_PATHCONV=1 npm run verify` exited 0 on the final commit `33a2d2d` with a clean tree: repo guard, typecheck (4x tsc plus engine lint), unit tests in UTC and America/New_York (89 files, 2424 tests each), sub-path e2e (12 passed), build, page-weight budget ("2 routes, 30 golden states within tolerance"), the full e2e suite (243 passed, 171 skipped by design: Phase 6 specs run in the UTC project only) and the clean-tree and static-out guard.

## Notes for the orchestrator

- Left unfixed as instructed: IN-01, IN-03, IN-04.
- `04-SECURITY.md` (Phase 4) was edited, a dated update under T-04-37, because the review asked for it and the old acceptance text had become wrong. It is a docs-only change inside the WR-01 commit.
- STATE.md and ROADMAP.md were not touched; no requirement was marked.
- The working copy of `app/hooks/useCanvasPan.ts` is CRLF while the index is LF (autocrlf); the commit stores LF and the diff shows only the intended lines.

---

_Fixed: 2026-10-19_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
