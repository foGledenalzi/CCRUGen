---
phase: 05-demons-layer
reviewed: 2026-09-30T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - app/NumogramClient.tsx
  - app/components/demons/DemonBrowser.tsx
  - app/components/demons/DemonFacets.tsx
  - app/components/demons/DemonFocusView.tsx
  - app/components/demons/DemonMatrix.tsx
  - app/components/demons/DemonRowList.tsx
  - app/components/demons/DemonsOverlay.tsx
  - app/components/info/InfoDisplay.tsx
  - app/components/numogram/BigBaseSummary.tsx
  - app/components/numogram/NumogramIcons.tsx
  - app/components/numogram/ViewControls.tsx
  - app/components/panels/LayersPanel.tsx
  - app/components/projection/Projection.tsx
  - app/components/ui/CyberButton.tsx
  - app/lib/demonBrowser.ts
  - app/lib/demonMatrix.ts
  - app/lib/demonSearch.ts
  - app/lib/demonState.ts
  - app/lib/shareParams.ts
  - e2e/demons-browser.spec.ts
  - e2e/demons-focus.spec.ts
  - e2e/demons-helpers.ts
  - e2e/demons-matrix.spec.ts
  - package-lock.json
  - package.json
  - perf/page-weight.baseline.json
  - tests/app/demonBrowserRender.test.ts
  - tests/app/demonBrowserSource.test.ts
  - tests/app/demonFacets.test.ts
  - tests/app/demonFocusRender.test.ts
  - tests/app/demonMatrix.test.ts
  - tests/app/demonMatrixRender.test.ts
  - tests/app/demonNames.test.ts
  - tests/app/demonRowListRender.test.ts
  - tests/app/demonSearch.test.ts
  - tests/app/demonState.test.ts
  - tests/app/demonsOverlayRender.test.ts
  - tests/app/projectionRender.test.ts
  - tests/app/shareParams.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-09-30
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found (one Info-level observation; no Critical or Warning findings)

## Summary

This review focused on the phase's own headline correctness rule (from its RESEARCH.md): every new demon surface
must read `g`/`g.demons` directly and never `view.demons` or gate behind `showDiagram`, since `view` is `null` above
`svgRichMaxN` (200) and `view.demons` is `null` above `allChordsMaxN` (80) — base 666 (221,445 demons) is the
headline example with no SVG diagram at all.

**The rule is honored everywhere.** I traced every read of `view` in the demon surfaces (`DemonBrowser`,
`DemonFacets`, `DemonFocusView`, `DemonMatrix`, `DemonRowList`, `DemonsOverlay`, `demonBrowser.ts`, `demonState.ts`,
`demonSearch.ts`, `demonMatrix.ts`) and found none — they all read `g`/`g.demons`/`base`/`summary` from
`useNumogramView()`, which stay populated at every base regardless of tier. The only three `view.demons` /
`view.lore` reads in the reviewed files are in pre-existing, diagram-bound code that is itself correctly gated by
`view` being non-null (`Projection.tsx`'s Pandemonium layer, `LayersPanel.tsx`'s main-diagram layer toggle, and
`InfoDisplay.tsx`'s legacy `ZoneInfo` panel) — none of these are "new demon surfaces" under the rule, and all three
require an actual mounted diagram by construction. `showDiagram` is threaded into `DemonFocusView`/`DemonsOverlay`
only to decide whether to show a textual hint ("turn on Demon focus in the diagram toolbar"), never to gate
functionality; this is confirmed by `demons-focus.spec.ts`'s and `demonFocusRender.test.ts`'s base-666 cases, which
exercise the Focus tab's own zone-number entry point with no diagram mounted.

**Virtualization is also correct and well-proven.** `engine/core/demons.ts` and `engine/core/unrank.ts` (read for
context, not in this phase's file list) back every demon lookup with closed-form counts and O(log n) binary-search
unranking — nothing materializes the demon space. On the UI side: `DemonRowList` windows at `BROWSER_WINDOW_ROWS`
(250,000) and relies on `@tanstack/react-virtual` for the visible slice; `demonMatrix.ts`'s `rasterizeRows` is
pixel-bounded (`MATRIX_MAX_RASTER_PX`), not `base²`-bounded, with row-copy and same-cell shortcuts; `DemonFocusView`
bounds chord drawing at `FOCUS_CHORD_DRAW_MAX` (4096) via striding. `tests/app/demonBrowserSource.test.ts` and
`tests/app/demonMatrix.test.ts` both include explicit "materialization guard" tests (counting-wrapper call counts,
base 2^26 corner-cell resolution, classify-call bounds at base 1,048,576) that make this a proven property, not just
an assumption. `e2e/demons-browser.spec.ts`, `demons-focus.spec.ts` and `demons-matrix.spec.ts` all include base-666
("no diagram") cases that pass against the real static export.

No bugs, security issues, missing error handling, or dangerous patterns were found in the reviewed diff. Defensive
`try/catch` blocks around `selectedMesh`/`netSpanOf` lookups (stale mesh after a base switch) are deliberate and
commented; search/focus/share-param parsers are exhaustively fuzzed against hostile input in the test suite; `==`
vs `===`, unchecked array access, and off-by-one patterns were not found. The one item below is a code-organization
observation, not a correctness or security concern.

## Info

### IN-01: `legacyKind` (base-generic logic) lives in the base-10 preset module

**File:** `app/presets/base10/demons.ts:19-37` (consumed from `app/lib/demonBrowser.ts:12,105,208` and
`app/components/demons/DemonMatrix.tsx:8,177,308`)
**Issue:** `legacyKind(subtype: DemonSubtype): LegacyDemonKind` is a pure, base-generic classification function (it
only switches on the engine's `DemonSubtype` enum) but is defined in `app/presets/base10/demons.ts` — a module whose
own header comment says it is "a base-10 compatibility list... never a way to materialize the demons of another
base." Both `app/lib/demonBrowser.ts` (used by every base) and `app/components/demons/DemonMatrix.tsx` (the
base-generic matrix, including base 666/1,048,576 in tests) import this function directly from the base-10 preset
folder, and that import also pulls in `app/presets/base10/lore.ts`'s `DEMON_NAMES` and the eager `ALL_DEMONS` build
(45 entries, cheap, but unrelated to the generic rendering path) as a side effect of the module graph. This doesn't
cause incorrect behavior — `legacyKind` has no base-10-specific state — but it blurs the preset/generic boundary
that CLAUDE.md and this phase's own code otherwise take care to keep explicit (e.g., `demonBrowser.ts`'s own doc
comment: "The ONLY way any Phase 5 surface colors a demon... reduces the 7 subtypes to the 4-bucket legacy kind
palette").
**Fix:** Consider moving `legacyKind`/`LegacyDemonKind` (and the `KIND_COLOR`/`KIND_LABEL` tables that already live
in `demonBrowser.ts`) into a base-generic module (e.g. inline into `app/lib/demonBrowser.ts`, which already owns the
four-bucket kind palette), leaving `app/presets/base10/demons.ts` to only build `ALL_DEMONS` for the base-10
viewer's own legacy consumers. This is a refactor for clarity, not a required fix — no test or behavior depends on
the current file location.

---

_Reviewed: 2026-09-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
