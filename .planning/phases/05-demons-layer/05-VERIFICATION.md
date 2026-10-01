---
phase: 05-demons-layer
verified: 2026-10-01T04:30:22Z
status: passed
score: 5/5 ROADMAP success criteria verified, 5/5 requirement IDs satisfied
overrides_applied: 0
---

# Phase 5: Demons Layer Verification Report

**Phase Goal:** Users can see, count, browse and inspect every demon of any base without the page freezing
**Verified:** 2026-10-01T04:30:22Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a 12-plan, 7-wave phase, interrupted twice by rate limits (05-05 after `npm install`, 05-12 after the final
`verify` run but before its completion commit — both resumed and spot-checked per their own SUMMARYs). Rather than
trust the SUMMARYs:

1. Read all 12 PLAN frontmatters (`must_haves`) and all 12 SUMMARY.md files in full, plus `05-CONTEXT.md` (D-01..D-07),
   `05-UI-SPEC.md` (approved design contract) and `05-REVIEW.md` (code review: 0 critical, 0 warning, 1 info).
2. Independently re-derived the phase's headline numbers from the real engine (`npx tsx`, not the app or a fixture):
   `createNumogram(28).demons.{count,typeCounts,counts}` and `createNumogram(666)` likewise, plus `createNumogram(10)`
   against `app/presets/base10/lore.ts`'s `DEMON_NAMES` — see Observable Truths below for the exact numbers obtained.
3. Read the actual source of every artifact named in every plan's must_haves — `app/lib/{demonBrowser,demonMatrix,
   demonSearch,demonState}.ts`, `app/components/demons/{DemonBrowser,DemonFacets,DemonMatrix,DemonFocusView,
   DemonRowList,DemonsOverlay}.tsx`, `app/components/projection/Projection.tsx`, `app/components/info/InfoDisplay.tsx`
   (`DemonInfo`), `app/components/numogram/ViewContext.tsx`, `app/NumogramClient.tsx` — not just the SUMMARYs'
   descriptions of them.
4. Independently traced the phase's own stated critical correctness rule (every demon surface reads `g`/`g.demons`
   directly, never `view.demons`, never gated behind `showDiagram`) by grepping every file under
   `app/components/demons/` and `app/lib/demon*.ts` for `view.demons`/`view.lore`/`showDiagram` and reading each hit
   in context — see "Critical Correctness Rule" below. This matches 05-REVIEW.md's independent trace.
5. Ran the actual test suite rather than trusting reported numbers: `npx vitest run` on all 13 `demon*`/`projectionRender`
   test files (250/250 passed), `npm run typecheck` (exit 0, one pre-existing unrelated warning), `npm run check:weight`
   (OK), and live Playwright runs (not `--list`) of `e2e/demons-browser.spec.ts`, `e2e/demons-focus.spec.ts`,
   `e2e/demons-matrix.spec.ts` (24/24 passed) and `e2e/golden.spec.ts` + `e2e/behaviour.spec.ts` (35/35 passed — the
   60 frozen DOM goldens and 5 behaviour-baseline specs, confirming zero regression) against the real static `out/`
   build, in the `chromium-utc` project.
6. Grepped for stub/placeholder anti-patterns across every new Phase 5 file — none found.

## Critical Correctness Rule (independent spot-check)

The phase's own research flagged that every demon surface must read `g`/`g.demons` directly, never `view.demons`
(null above n=80) or `view` itself (null above n=200, the SVG tier ceiling) — base 666 (221,445 demons, this phase's
own headline example) has no SVG diagram at all. 05-REVIEW.md already traced this and found it holds; this
verification repeated the trace independently:

- `grep -rn "view\.demons\|view\.lore" app/lib app/components/demons` — **zero matches**.
- `grep -rn "showDiagram" app/components/demons` — two matches, both prop pass-through (`DemonsOverlay.tsx` ->
  `DemonFocusView.tsx`) that only gate a hint sentence ("Or turn on Demon focus...") shown when no zone is focused
  yet, never functionality (`DemonFocusView.tsx:264`).
- Every demon component (`DemonBrowser`, `DemonFacets`, `DemonMatrix`, `DemonRowList`, `DemonsOverlay`) destructures
  `g` (never `view`) from `useNumogramView()`; `app/components/numogram/ViewContext.tsx` confirms `g: Numogram` is
  unconditionally populated while `view: NumogramView | null` is the tier-gated field — the two are structurally
  distinct fields, so a demon surface reading `g` cannot accidentally also read `view`.
- The header's "Browse demons" button (`app/NumogramClient.tsx:1487-1502`) lives inside `CyberPageHeader`, which
  renders unconditionally — not inside the `{showDiagram && (...)}` block that gates the SVG diagram itself
  (confirmed by reading lines 1380-1507 directly).
- `InfoDisplay.tsx`'s `DemonInfo` (the shared detail-pane renderer) reads `g.demons.ref(d.a, d.b)` for authoritative
  mesh/subtype and only branches on `view?.lore` for the base-10-specific lore copy, falling back to an
  engine-derived zone color (`zoneColorFor(g.cycleOfZone(z).kind)`) when `view` is null.
- Live e2e proof: `e2e/demons-browser.spec.ts`'s and `e2e/demons-focus.spec.ts`'s and `e2e/demons-matrix.spec.ts`'s
  base-666 cases all assert `page.locator(DIAGRAM)).toHaveCount(0)` and then exercise full functionality anyway — run
  live against the static build in this verification (see Behavioral Spot-Checks), not just read as claims.

**The rule holds**, confirmed independently of 05-REVIEW.md's own trace.

## Goal Achievement — ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Base 28 shows demon type facets with closed-form counts incl. cross-Torque (108/378); base 666 shows 221,445-demon facets instantly | ✓ VERIFIED | Independently re-derived from the engine (not a fixture): `createNumogram(28).demons.count === 378`, `typeCounts = {chrono:276, amphi:96, xeno:6}`, `counts()['cross-torque-chrono'] === 108`; `createNumogram(666).demons.count === 221445`, `typeCounts.chrono === 220116`, `counts()['cross-torque-chrono'] === 199884`. Subtype sums equal totals at both bases (sanity-checked). Live e2e (`demons-browser.spec.ts:15,45`) reproduces these exact numbers in the running app, including the `108` cross-Torque sub-facet after clicking the Chrono chip, and base 666 renders with `[data-demons-total="221445"]` visible immediately (no enumeration — `facetModel` calls only `typeCounts()`/`counts()`, both O(Torque-cycle-count), never a loop over demons; confirmed by reading `app/lib/demonBrowser.ts:136-183`). |
| 2 | At base 666 the browser scrolls over 221,445 rows while the DOM holds only visible ones; sort/filter/search by `a::b` or mesh work | ✓ VERIFIED | `DemonRowList.tsx` uses `@tanstack/react-virtual`'s `useVirtualizer` with `count: win.size` (windowed, max 250,000) and renders only `virtualizer.getVirtualItems()`. Live e2e (`demons-browser.spec.ts:65`) asserts the DOM holds between 1 and 80 `[data-demon-row]` elements both before and after scrolling to the bottom of a 221,445-row list, and the last row (`665::664`) is reachable. `sort toggles direction and sorts by type` and `search by mesh and a::b under a filter` tests both pass live, including a filtered search (`108` -> `15::3`) and hostile/out-of-filter/malformed inputs producing the UI-SPEC copy exactly. |
| 3 | Choosing a zone in focus mode draws its n-1 demons as chords; selecting a demon draws its own chord | ✓ VERIFIED | `app/lib/demonState.ts`'s `focusChordList`/`focusDrawPlan` produce exactly `base-1` chords for a zone focus (capped/strided at 4,096) and exactly 1 for a demon focus. Live e2e (`demons-focus.spec.ts`) proves both directions at base 28 (`[data-demon-focus]` count === 27 after a zone click in Demon-focus mode; count === 1, `[data-demon-focus="12:3"]`, after picking `c::3` in the browser) and base 666 with **zero** `[data-diagram]` elements still drawing 665 chords on the Focus tab's own canvas and listing all 666 rows. |
| 4 | Triangular demon matrix shows every demon at large n; clicking/hovering a cell identifies `a::b`, mesh number and type | ✓ VERIFIED | `app/lib/demonMatrix.ts`'s `cellAtPixel`/`cellCenter` are the only path hover/click/keyboard use to resolve a cell (never raster pixels, confirmed by reading `DemonMatrix.tsx`'s hover/click handlers, which call `g.demons.ref(a,b)` after `cellAtPixel`). Live e2e (`demons-matrix.spec.ts`) proves exact tooltip text (`c::3 · 69 · Cyclic chrono`) at the fit scale and after a real wheel-zoom, at a second cell post-zoom, with a keyboard cursor walk and Enter-to-pin, the syzygy diagonal rendered as an explicit `<line data-matrix-line="syzygy">`, and base 666 (no diagram) resolving correctly after 6 successive zoom-in steps. Raster cost is pixel-bounded (`MATRIX_MAX_RASTER_PX = 1,500,000`), confirmed by reading `rasterizeRows`'s classify-call-bounded loop; measured raster-fill timings (re-run live in this verification) were 17ms/83ms/83ms at bases 28/666/4096, all far under the 500ms budget. |
| 5 | Base 10 shows its 45 canonical CCRU demon names in the browser and detail panel | ✓ VERIFIED | Independently confirmed `app/presets/base10/lore.ts`'s `DEMON_NAMES` has exactly 45 entries (mesh 0..44), matching `createNumogram(10).demons.count === 45` exactly, with the full name list re-printed and spot-checked (`Lurgo` at mesh 0, `Ummnu` at mesh 44). Live e2e (`demons-browser.spec.ts:151,172`) confirms the NAME column shows these names at base 10 (including a name-search hit on `tuk` -> mesh 11) and stays present-but-empty (not hidden, not a dash) at base 28, matching D-02's "table shape never changes" rule exactly. |

**Score:** 5/5 ROADMAP success criteria verified, all via a combination of independent engine re-derivation and live Playwright runs against the actual static build (not re-reading SUMMARY claims).

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| DEM-01 | 05-01, 05-06, 05-09, 05-10 | Type facets with closed-form counts at any base, incl. cross-Torque | ✓ SATISFIED | `facetModel` (demonBrowser.ts) + `DemonFacets.tsx`; SC1 above |
| DEM-02 | 05-01, 05-03, 05-04, 05-05, 05-06, 05-09, 05-10 | Virtualized browser: sort/filter/search over C(n,2) rows, nothing fully rendered | ✓ SATISFIED | `DemonRowList.tsx` + `demonSearch.ts`; SC2 above |
| DEM-03 | 05-04, 05-08, 05-10 | Focus mode: zone -> n-1 chords, demon -> own chord, both directions | ✓ SATISFIED | `demonState.ts` + `Projection.tsx` focus layer + `DemonFocusView.tsx`; SC3 above |
| DEM-04 | 05-02, 05-07, 05-10 | Triangular matrix, pick-by-pixel at large n | ✓ SATISFIED | `demonMatrix.ts` + `DemonMatrix.tsx`; SC4 above |
| DEM-05 | 05-01, 05-06, 05-09, 05-10 | Base 10's 45 canonical CCRU names | ✓ SATISFIED | `demonName`/`demonNameTable` joined from `lore.ts`; SC5 above |

**All 5 requirement IDs declared across the phase's 12 plans are accounted for in `.planning/REQUIREMENTS.md`'s
traceability table (lines 147-151), each marked Complete with the correct plan list. No orphaned requirements
found** — `.planning/REQUIREMENTS.md`'s Phase-5-mapped rows (DEM-01..05) exactly match the union of `requirements:`
fields across all 12 plan frontmatters.

## Required Artifacts (spot-checked at all 3-4 levels)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/demonBrowser.ts` | Taxonomy, facet model, names, row sources, rank, window paging | ✓ VERIFIED | 383 lines, all 19 exports from 05-01's must_haves present; row-source identity (`g.demons`/`.group()`/`.subtype()`), binary-search `rankOfMesh`, `windowAt`/`windowCount` bounded at 250,000 all read as specified; wired into `DemonBrowser.tsx`, `DemonFacets.tsx`, `DemonRowList.tsx`, `DemonMatrix.tsx`, `DemonFocusView.tsx`, `demonState.ts` |
| `app/lib/demonMatrix.ts` | Transform math, exact resolve, raster | ✓ VERIFIED | 264 lines; `cellAtPixel`/`zoomAt`/`clampTransform`/`rasterizeRows`/`syzygyLine` all present and match must_haves (64px/cell cap, 1.5M-px raster cap, classify-bounded raster loop with row-copy and same-cell shortcuts) |
| `app/lib/demonSearch.ts` | Search parsing, resolution | ✓ VERIFIED | Clamped to 64 chars, regex-gated before `parseNumeral`, name search capped at 50,000 — confirmed by reading source |
| `app/lib/demonState.ts` | Focus model, URL tokens, base-switch rule | ✓ VERIFIED | `FOCUS_CHORD_DRAW_MAX = 4096`, `demonsAfterBaseSwitch` clears focus and drops filters with 0 members at the new base, `parseDemonFocus`/`parseDemonFilter` never throw on hostile input (length-capped, regex-anchored) |
| `app/components/demons/DemonRowList.tsx` | Virtualized windowed row list | ✓ VERIFIED | `useVirtualizer` with `count: win.size`, `source.at(k)` called once per rendered row, keyboard model (arrows/Home/End/PageUp/PageDown/Enter) present |
| `app/components/demons/DemonBrowser.tsx`, `DemonFacets.tsx`, `DemonFocusView.tsx`, `DemonMatrix.tsx`, `DemonsOverlay.tsx` | Browser/Focus/Matrix tabs, overlay shell | ✓ VERIFIED | All read `g` from `useNumogramView()` (never `view`); `DemonsOverlay` composes all three tabs plus the shared `DemonInfo` detail pane; live e2e exercises every one of these components end to end |
| `app/components/info/InfoDisplay.tsx` (`DemonInfo`) | Works when `view` is null | ✓ VERIFIED | Reads `g.demons.ref(d.a,d.b)` for authoritative mesh/subtype; `view?.lore` branch guards the base-10-only copy; `zoneClr` falls back to `zoneColorFor(g.cycleOfZone(z).kind)` when `view` is null |
| `app/NumogramClient.tsx` | Header entry point, wiring, URL sync | ✓ VERIFIED | "Browse demons" button at line 1487, never inside a `showDiagram`-gated block; `demonFilter`/`demonFocus`/`demonsOpen` wired to `shareParams.ts`; base-switch calls `demonsAfterBaseSwitch` |
| `perf/page-weight.baseline.json` | Raised only if needed, with reason | ✓ VERIFIED | Raised for `/numogram/`'s `jsBytes`/`jsGzip` growth only, dated and plan-attributed; `npm run check:weight` re-run in this verification: OK |

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/lib/demonBrowser.ts` | `engine` `DemonSpace` | `g.demons.{typeCounts,counts,group,subtype,ref,at}` | ✓ WIRED | Confirmed by direct read; `rg "view\.demons"` returns zero matches anywhere in `app/lib`/`app/components/demons` |
| `app/components/demons/DemonFacets.tsx` | `facetModel(g, filter)` | `useMemo` | ✓ WIRED | Live e2e confirms exact counts at bases 28/666 |
| `app/components/demons/DemonBrowser.tsx` | `app/lib/demonSearch.ts` | `resolveDemonSearch` -> reveal index | ✓ WIRED | Live e2e confirms search-hit scroll/mark and status copy |
| `app/components/projection/Projection.tsx` | `focusChords` prop | `data-demon-focus` chord layer, null-safe | ✓ WIRED | Byte-identical with no focus (60 goldens + 5 behaviour specs re-run live, 35/35 passed); live e2e confirms chord count exactly `base-1` / `1` |
| `app/NumogramClient.tsx` | `app/components/demons/DemonsOverlay.tsx` | `{demonsOpen && <DemonsOverlay ... />}` | ✓ WIRED | Entry point button and mount both outside the `showDiagram` gate |
| `app/NumogramClient.tsx` | `app/lib/shareParams.ts` | `demonFilter`/`demonFocus`/`demonsOpen` fields | ✓ WIRED | Live e2e confirms round-trip through reload, bogus-value fallback to All, legacy links unaffected |

## Data-Flow Trace (Level 4)

All demon surfaces read live from `g` (the real `Numogram` for the current base), not from any cached/materialized
structure and not from hardcoded fixtures:

- `DemonFacets`/`DemonBrowser` -> `facetModel(g, filter)`/`rowSourceFor(g, filter, key)` -> `g.demons.typeCounts()`/
  `.counts()`/`.group()`/`.subtype()` — closed forms and O(1)/O(log C(n,2)) selections, confirmed by the engine's own
  `closedForms()` implementation (loops only over Torque cycles, never demons) and by base-666's instant facet
  render in the live e2e run.
- `DemonMatrix` -> `rasterizeRows` -> `classify = (a,b) => g.demons.ref(a,b)` — pixel-bounded, confirmed live
  (raster-ms measured at 17/83/83ms for bases 28/666/4096, far under budget, and never scales with `base²` since the
  raster is capped at 1,500,000 backing pixels regardless of base).
- `DemonFocusView`/`Projection`'s focus layer -> `incidentSource(g, zone)`/`g.demons.ref(a,b)` — bounded at 4,096
  chords, confirmed live at base 666 (665 demons -> 665 chords, under the cap, all listed in the row list).

No hollow props or static-empty fallbacks found in any Phase 5 component.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit test suite for all Phase 5 lib/component files | `vitest run tests/app/demon*.test.ts tests/app/projectionRender.test.ts tests/app/shareParams.test.ts` | 13 files, 250/250 tests passed | ✓ PASS |
| Full typecheck + lint | `npm run typecheck` | exit 0 (one pre-existing unrelated `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx`, not a new issue) | ✓ PASS |
| Page-weight budget | `npm run check:weight` | "page-weight: OK (2 routes, 30 golden states within tolerance)" | ✓ PASS |
| Live e2e: demon browser, facets, search, sort, names, URL state, base 1024 windowing | `playwright test e2e/demons-browser.spec.ts --project=chromium-utc` | 12/12 passed | ✓ PASS |
| Live e2e: focus mode both directions, base 666, URL reload | `playwright test e2e/demons-focus.spec.ts --project=chromium-utc` | 6/6 passed | ✓ PASS |
| Live e2e: matrix hover/click/keyboard at 2 zoom levels, base 666, raster timings | `playwright test e2e/demons-matrix.spec.ts --project=chromium-utc` | 6/6 passed | ✓ PASS |
| Regression: 60 frozen DOM goldens + 5 behaviour-baseline specs | `playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts --project=chromium-utc` | 35/35 passed, byte-identical | ✓ PASS |
| `check-repo` goldens-only guard | `node scripts/check-repo.mjs --only goldens` | exit 0 | ✓ PASS |

Every check above was re-run live during this verification, not read as a claim from a SUMMARY.

## Requirements / Decision Compliance (05-CONTEXT.md D-01..D-07)

- **D-01** (dedicated large overlay, not a `CyberPanel`): `DemonsOverlay.tsx` is a scaled `ShortcutsModal`-style modal, confirmed by reading its backdrop/content-box structure.
- **D-02** (4-column table shape never changes, name column empty not hidden elsewhere): confirmed live (`other bases keep an empty NAME column` test, all cells `''`, column header always visible).
- **D-03** (focus mode, both directions): confirmed live in both directions at base 28 and the zone-entry direction at base 666.
- **D-04** (`allChordsMaxN = 80` accepted as-is, no edge bundling): no edge-bundling code added; `LayersPanel.tsx`'s pointer text directs to "Browse demons" above the ceiling (confirmed by grep).
- **D-05** (facet chips are the filter, not a separate display): confirmed by reading `DemonFacets.tsx`'s `onChip` — clicking a chip calls `onFilterChange` directly, no separate read-only summary.
- **D-06** (matrix color-by-kind, hover/click mirrors existing pin pattern): confirmed — `kindColor(subtype)` reduces through the same `legacyKind` function used everywhere else; click pins through the same `DemonInfo` path.
- **D-07** (URL state: `demonFilter=`/`demonFocus=`/`demonsOpen=1`, matrix pan/zoom NOT in the URL): confirmed by reading `shareParams.ts` and by the absence of any pan/zoom/transform field in it; live e2e confirms round-trip and omit-at-default.

## Code Review Findings (from `05-REVIEW.md`, already on record)

0 critical, 0 warning, 1 info. The one info-level finding (**IN-01**: `legacyKind`/`LegacyDemonKind` — a base-generic
classification function — lives in `app/presets/base10/demons.ts`, a base-10 preset module, rather than a
base-generic one) is a code-organization observation with no behavioral effect: `legacyKind` only switches on the
engine's own `DemonSubtype` enum and carries no base-10 state. Confirmed non-blocking: it doesn't affect any
ROADMAP success criterion, doesn't violate the engine-purity rule (the function itself never touches `app/presets`
state), and the reviewer's suggested fix (move it into `app/lib/demonBrowser.ts`) is a pure refactor with no test or
behavior depending on the current file location. Not treated as a gap.

### Anti-Patterns Found

None. Grepped every new Phase 5 file (`app/lib/demon*.ts`, `app/components/demons/*.tsx`, the Projection/InfoDisplay/
NumogramClient edits) for `TODO|FIXME|XXX|HACK|PLACEHOLDER`, "not yet implemented"/"coming soon", empty-return
stubs, and hardcoded-empty props flowing to render — none found outside the intentional, UI-SPEC-mandated
`''` (empty, not hidden) for the NAME column at non-base-10 bases, which is a documented product decision (D-02),
not a stub.

## Human Verification Required

None. Every ROADMAP success criterion is exercised by a live, re-run Playwright test against the real static build
(not just a claim in a SUMMARY), the frozen DOM-golden and behaviour-baseline regression suites pass byte-identical,
and the UI-SPEC's one non-blocking Dimension-2 flag (no explicit focal-point statement for the overlay's default
view) was a planning-time recommendation already resolved by the checker's approval, not an open verification
question.

## Gaps Summary

No gaps found. All 5 ROADMAP success criteria verified independently (engine re-derivation + live e2e), all 5
requirement IDs satisfied with no orphans, the phase's own headline correctness rule (demon surfaces never read
`view.demons`/gate behind `showDiagram`) independently re-traced and confirmed, zero regressions in the 60 frozen
DOM goldens and 5 behaviour-baseline specs, and the one prior code-review finding is a non-blocking organizational
note with no functional impact.

---

_Verified: 2026-10-01T04:30:22Z_
_Verifier: Claude (gsd-verifier)_
