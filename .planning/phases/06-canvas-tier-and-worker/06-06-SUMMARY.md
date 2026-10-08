---
phase: 06-canvas-tier-and-worker
plan: 06
subsystem: ui
tags: [view-contract, canvas-tier, panels, shortcuts, react, ssr-tests, vitest]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-01's INTERACTIVE_MAX_N (the shipped ceiling as data, read from the tier table)
  - phase: 04-base-picker-and-generator-ui
    provides: the NumogramViewContext, the panels' PanelUnavailable early return and the `view` null-above-the-diagram discipline
  - phase: 05-demons-layer
    provides: the five render tests that build a NumogramViewContextValue literal, and the Provider-plus-renderToStaticMarkup SSR pattern
provides:
  - NumogramViewContextValue.tier (RenderTier) and .interactiveMaxN (number), both required, so every panel can tell the Canvas tier from the SVG tier and from the headless summary
  - CanvasListNote in panels/shared.tsx and the four list panels (Zones, Syzygies, Currents, Gates) showing it at the Canvas tier instead of thousand-row lists
  - gateInfoSuffix and particlesCanvasInfo (pure, exported) and the Particles N/A row in the Layers panel at the Canvas tier
  - RegionsPanel that reads ctx.g only after its early return
  - ShortcutsModal lines for both keyboard models (Diagram line qualified, new Canvas and touch line)
  - tests/app/canvasPanelsRender.test.ts (30 SSR and pure tests)
affects: [06-10, 06-11, 06-12, 06-13, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A required context field plus the five test literals updated in the same change, so typecheck never breaks between tasks"
    - "Hover-only copy is tested through exported pure helpers (gateInfoSuffix, particlesCanvasInfo), visible copy through renderToStaticMarkup inside the context Provider"
    - "A throwing-getter context proves a panel's read order: Object.defineProperty(ctx, 'g', { get() { throw ... } })"

key-files:
  created:
    - tests/app/canvasPanelsRender.test.ts
  modified:
    - app/components/numogram/ViewContext.tsx
    - app/NumogramClient.tsx
    - app/components/panels/shared.tsx
    - app/components/panels/ZonesPanel.tsx
    - app/components/panels/SyzygiesPanel.tsx
    - app/components/panels/CurrentsPanel.tsx
    - app/components/panels/GatesPanel.tsx
    - app/components/panels/LayersPanel.tsx
    - app/components/panels/RegionsPanel.tsx
    - app/components/numogram/ShortcutsModal.tsx
    - tests/app/demonBrowserRender.test.ts
    - tests/app/demonFocusRender.test.ts
    - tests/app/demonMatrixRender.test.ts
    - tests/app/demonRowListRender.test.ts
    - tests/app/demonsOverlayRender.test.ts

key-decisions:
  - "The new context fields are required, not optional, so NumogramClient can never forget them; the five Phase 5 test literals took them in the same commit"
  - "NumogramClient passes the tier it renders today (showDiagram ? 'svg' : 'headless') until 06-11 replaces it with the render tier; the panel rule `tier === 'canvas' && view` therefore changes nothing in the shipped viewer until a canvas exists"
  - "In the four sibling Phase 5 render tests (view is always null) the literal says tier 'headless'; in demonsOverlayRender, where view is a parameter, it is `view ? 'svg' : 'headless'`, so a literal never contradicts its own view"
  - "The Canvas list note is 10px (checker recommendation 3) and the new ShortcutsModal line is plain gray with no #10ff50 span (checker recommendation 6)"
  - "ShortcutsModal now calls useNumogramView() as its first statement, so it must render inside the provider even when closed (it does: NumogramClient mounts it inside the Provider)"

patterns-established:
  - "gateInfoSuffix(mode, tier): one pure place for the Gates info suffix; only (off, canvas) differs from the SVG wording"

requirements-completed: []  # REN-02 stays Pending: this plan ships the view-contract fields and panel copy only; the Canvas component (06-10), the viewer integration (06-11) and the e2e specs (06-12, 06-13) are what make the requirement true

# Metrics
duration: 22min
completed: 2026-10-08
---

# Phase 6 Plan 06: Tier and Ceiling in the View Contract, Canvas-Aware Panels Summary

**The shared view contract now carries the rendered tier and the shipped ceiling; at the Canvas tier the Zones, Syzygies, Currents and Gates panels show a 10px note instead of 4000-row lists, Layers says gates draw for the hovered or pinned zone and marks Particles N/A, Regions never touches the numogram before its early return, and the Shortcuts modal describes both keyboard models; the frozen oracles passed `npm run test:swap` right after the first NumogramClient edit.**

## Performance

- **Duration:** ~22 min (including two `test:swap` runs of about 4 min each and a 5 min full gate)
- **Started:** 2026-10-08T18:34:00Z
- **Completed:** 2026-10-08T18:56:00Z
- **Tasks:** 3 (Task 1 plain; Tasks 2 and 3 TDD: RED then GREEN commits)
- **Files modified:** 16 (1 created, 15 modified)

## Accomplishments

- **One view contract (REN-02).** `NumogramViewContextValue` gained `tier: RenderTier` and `interactiveMaxN: number`, both required. `NumogramClient.tsx` got the minimal edit the plan allows: one import name (`INTERACTIVE_MAX_N`), two fields in `viewCtx` (`tier: showDiagram ? 'svg' : 'headless'`, `interactiveMaxN: INTERACTIVE_MAX_N`) and `showDiagram` in the dependency list; `git diff --numstat` for the file was `4 2`. The five Phase 5 render-test context literals took both fields in the same commit, so typecheck stayed green.
- **No thousand-row lists at the Canvas tier (T-06-20, research P9).** `CanvasListNote` renders `Listed up to {max} zones. Pick elements on the diagram.` in a `data-post-baseline` element at `text-[10px]`. Zones, Syzygies, Currents and Gates return it when `tier === 'canvas' && view`, after every hook and before the existing `!view` return. `PanelUnavailable` is byte-identical (`Available up to {max} zones.`, 9px). The SSR test at base 202 asserts the exact note markup and zero row elements for all four panels, the headless markup unchanged, and one row per element for each panel at base 28 (svg).
- **Layers and Shortcuts copy.** `gateInfoSuffix(mode, tier)` returns ` Drawn for the hovered or pinned zone only at this base.` only for (`off`, `canvas`); thin, on and the SVG and headless `off` wording are unchanged. At the Canvas tier the Particles row has info `Particles are drawn up to {svgRichMaxN} zones.`, a no-op click and the right label `N/A` (syzygies and currents keep ON/OFF). The Shortcuts modal's Diagram line now starts `Up to {svgRichMaxN} zones:` and a new plain-gray line covers the Canvas model (arrows between zones, Tab through syzygy, current and gate, Page Up and Down jump 10, Enter or Space selects, touch drag, pinch, tap). Both live inside the existing `data-post-baseline` block, so the frozen behaviour baseline never sees them.
- **Regions cannot force the lazy numogram (T-06-01b, research P6).** `RegionsPanel` now takes `const ctx = useNumogramView()`, returns `PanelUnavailable` on `!ctx.view || !ctx.zoneLabels`, and only then reads `ctx.g`. A test supplies a context whose `g` getter throws and renders the panel at the headless tier without error (it fails with `Error: g read` on the old destructuring); at base 202 the panel renders one row per `regionRows(g)` entry plus the Time Circuit row.
- **Oracles untouched (T-06-11).** `npm run test:swap` was run twice, once right after the first NumogramClient edit (Task 1) and once at the end (Task 3), both exit 0; `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing both times.

## Task Commits

Each task is atomic; every commit carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`).

1. **Task 1: Required tier and ceiling fields in the view contract** - `5824b8a` (feat)
2. **Task 2: Canvas note for the four list panels (TDD)**
   - `70ab19f` test(06-06): failing test for the Canvas note on the four list panels (5 failed, 9 passed: the headless and svg cases already held)
   - `2408fdb` feat(06-06): show the Canvas note instead of rows in the four list panels
3. **Task 3: Layers copy, Regions read order and Shortcuts lines (TDD)**
   - `2558475` test(06-06): failing tests for Layers copy, Regions read order and Shortcuts lines (11 failed, 19 passed)
   - `d165059` feat(06-06): Canvas-tier copy for Layers and Shortcuts, and a safe read order in Regions

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_RED failure reasons: Task 2, the panels rendered the full 202-row lists with no note; Task 3, `gateInfoSuffix is not a function`, `particlesCanvasInfo is not a function`, Particles `OFF` instead of `N/A`, `Error: g read` from the Regions getter, and the Shortcuts lines absent._

## Files Created/Modified

- `app/components/numogram/ViewContext.tsx` - `tier` and `interactiveMaxN` (required), `view` comment now "null at the headless tier"
- `app/NumogramClient.tsx` - the two `viewCtx` fields, one import name, one dependency entry
- `app/components/panels/shared.tsx` - `CanvasListNote`; `PanelUnavailable` doc comment updated, markup unchanged
- `app/components/panels/{Zones,Syzygies,Currents,Gates}Panel.tsx` - `tier` destructured, one-line Canvas early return, `CanvasListNote` import
- `app/components/panels/LayersPanel.tsx` - `gateInfoSuffix`, `particlesCanvasInfo`, Particles N/A at the Canvas tier
- `app/components/panels/RegionsPanel.tsx` - `ctx.g` read only after the early return
- `app/components/numogram/ShortcutsModal.tsx` - `useNumogramView()` as the first statement, qualified Diagram line, new Canvas and touch line
- `tests/app/canvasPanelsRender.test.ts` - 30 tests: four list panels at three tiers, the pure helpers, Layers, Regions (throwing getter) and Shortcuts SSR
- `tests/app/demon{Browser,Focus,Matrix,RowList}Render.test.ts`, `tests/app/demonsOverlayRender.test.ts` - `tier` and `interactiveMaxN` in `buildCtx`

## Decisions Made

See `key-decisions` above. The plan fixed the copy and the structure; the judgement calls were the `tier` value in the five test literals (`'headless'` where `view` is null, `view ? 'svg' : 'headless'` where it is a parameter) and testing hover-only text through the exported helpers.

## Deviations from Plan

None - plan executed exactly as written. Additions inside the plan's open space, none changing behaviour: the SSR test also proves the note follows the context's `svgRichMaxN` (a context carrying 7 renders "Listed up to 7 zones"), counts rows for all four panels at base 28 (not only Zones), and asserts the closed Shortcuts modal still renders `''` now that it calls the context hook first.

## Issues Encountered

None. One line-ending observation, not a defect: `ShortcutsModal.tsx` is checked out with CRLF in this working copy (`core.autocrlf=true`) while the index holds LF (`.gitattributes` sets `eol=lf`); the edit kept the working copy consistent and the staged diff was the intended 4 added and 1 removed lines.

## Verification

- `npm run typecheck` (4x tsc plus lint): exit 0 after each task. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here); no `rules-of-hooks` error (the `useNumogramView()` call in `ShortcutsModal.tsx` is on line 12, `if (!open) return null` on line 13).
- `npx vitest run tests/app/canvasPanelsRender.test.ts --project oracle`: 30 passed (after RED runs of 5 and 11 failures).
- `npm run test:swap` after Task 1 (the first NumogramClient edit): exit 0. `65 passed, 5 skipped` in Playwright (the 60 DOM goldens and the behaviour baseline, across both timezone projects), then 75 files and 1897 unit tests.
- `npm run test:swap` after Task 3: exit 0. Playwright `65 passed, 5 skipped` again, then 76 files and 1927 unit tests (1897 + 30 new).
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing after each `test:swap`; no golden, baseline or manifest touched, no `-u` anywhere. `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**` and `useCanvasPan.ts` are unchanged.
- `node scripts/check-repo.mjs --only base-ten`: OK (run after `git add` of the new test file; no new `app/` file in this plan).
- Acceptance greps: `readonly tier: RenderTier` 1, `readonly interactiveMaxN: number` 1, `interactiveMaxN: INTERACTIVE_MAX_N` 1 in NumogramClient, `tier === 'canvas' && view` 1 per list panel, the note string 1 in `shared.tsx`, `Drawn for the hovered or pinned zone only at this base.` 1, `Up to {svgRichMaxN} zones`, `Above {svgRichMaxN} zones` and `Touch: drag pans, pinch zooms, tap selects.` each 1.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 76 test files and 1927 unit tests in both timezones, sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out.

## Known Stubs

- `app/NumogramClient.tsx` `viewCtx.tier` is `showDiagram ? 'svg' : 'headless'`, the tier rendered today. This is the plan's intentional interim value (the canvas branch does not exist yet); 06-11 replaces it with the real render tier. Until then `tier === 'canvas'` is never true in the shipped viewer, so the Canvas panel copy is exercised by the SSR tests only.
- Layers: at the Canvas tier the Particles row keeps `active: particlesOn`, so a user who switched particles on at an SVG base and then reaches a Canvas base sees an "active" row labelled N/A (the same way the existing locked Pandemonium row behaves). The plan specified only the label, info and click changes; 06-10 or 06-12 may decide whether the row should also render inactive.

## Threat Flags

None. No new endpoint, auth path, file access or trust-boundary schema change. T-06-20 (list-panel DOM blow-up) is mitigated by the Canvas early return, asserted with zero row elements at base 202; T-06-01b (RegionsPanel forcing the lazy numogram) is mitigated and proven with a throwing `g` getter; T-06-11 (oracle tampering) is mitigated by the two `test:swap` runs, the clean frozen directories and all new copy living inside `data-post-baseline` subtrees.

## Next Phase Readiness

- 06-10 and 06-11 can read `tier` and `interactiveMaxN` from `useNumogramView()`; 06-11 must replace the interim `tier` expression in `NumogramClient.tsx` with the render tier and change the Demons overlay's `showDiagram` meaning to `tier !== 'headless'` (research P9). When 06-11 makes `g` a lazy getter above the ceiling, `RegionsPanel` is already safe; the other six `ctx.g` readers (research P6) still need their own guard.
- REN-02 stays Pending until the Canvas component (06-10), the integration (06-11) and the e2e specs (06-12, 06-13) land.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED
