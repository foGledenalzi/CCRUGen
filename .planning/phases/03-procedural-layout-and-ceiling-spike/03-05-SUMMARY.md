---
phase: 03-procedural-layout-and-ceiling-spike
plan: 05
subsystem: base10-adapter
tags: [typescript, layout, licensing, seam, oracle-test, dom-golden-parity]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: "03-01: engine/layout/types.ts (Layout, LayoutSpec, RegionLabel contracts)"
provides:
  - "app/presets/base10/layout-tables.ts: the nine upstream base-10 layout constants plus DRAW_ORDER, FRAME_HEIGHT, REGION_LABELS, not relicensed (NOTICE section 2)"
  - "app/presets/base10/layouts.ts: BASE10_LAYOUT_SPECS (original, labyrinth, ladder, planetary) as LayoutSpec presets, type-only engine imports"
  - "app/data/positions.ts: a two-line pass-through seam over the presets (D-05 complete; MIG-02/Phase 4 removes the remaining app/data seams)"
affects: [04-base-generic-viewer-and-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-DOM parsing inside a vitest file (no browser): a small local regex parser over the frozen e2e/__golden__ text files, keyed by attribute values (font-size=17 distinguishes zone labels from the font-size=7 pandemonium-layer digits, both single characters) rather than by DOM structure"
    - "Upstream-authored art gets its own not-relicensed file (layout-tables.ts) separate from the MIT preset code that exposes it (layouts.ts), mirroring lore.ts's split from the adapter files in Phase 2"
    - "Planetary's trig formula is duplicated inline in layouts.ts rather than imported from app/lib/planetary.ts, to avoid an import cycle once app/data/positions.ts became a seam over layouts.ts"

key-files:
  created:
    - app/presets/base10/layout-tables.ts
    - app/presets/base10/layouts.ts
    - tests/presets/base10-layouts.test.ts
  modified:
    - app/data/positions.ts
    - NOTICE

key-decisions:
  - "buildFixed(id, table, routingStyle) is a private helper called from inside buildOriginal/buildLabyrinth/buildLadder's function bodies (not at module top level), so the plan's four named builder functions stay distinct and tree-shakeable while sharing the table-fill and Layout-literal logic; buildPlanetary has its own body since its point formula differs"
  - "The nine table constants are imported into layouts.ts for internal use AND re-exported via a separate 'export { ... }' statement (no 'from', forwarding the already-imported bindings) rather than a second 'export { ... } from ./layout-tables' — avoids two import declarations of the same module while keeping full ES-module reference identity through positions.ts -> layouts.ts -> layout-tables.ts"
  - "Zone labels are told apart from the pandemonium/demon-layer's single-digit text nodes (both are one character) by font-size=17 vs font-size=7 in the frozen DOM goldens; r=21 uniquely identifies zone circles (confirmed exactly 10 per golden file, no collision with the small dashed-line dots or the demon halo circles)"

requirements-completed: [LAY-02]

# Metrics
duration: 21min
completed: 2026-09-27
---

# Phase 3 Plan 5: Base-10 Layout Presets as LayoutSpecs Summary

**Base 10's four hand-authored layouts (original, labyrinth, ladder, planetary) are now `LayoutSpec` presets in `app/presets/base10/layouts.ts`, proven equal to the frozen numeric oracle and the parsed DOM/behaviour goldens; `app/data/positions.ts` is a two-line pass-through seam, with the full `npm run verify` gate green and page weight essentially flat (-2 bytes raw, -1 byte gzip).**

## Performance

- **Duration:** 21 min (previous plan's docs commit 14:43:21 -> this plan's final code commit 14:59:06, plus the `npm run verify` gate through 15:04)
- **Started:** 2026-09-27T14:43:21-06:00
- **Completed:** 2026-09-27T15:04:38-06:00
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `app/presets/base10/layout-tables.ts`: the nine upstream coordinate/angle/radius/size tables copied verbatim from `app/data/positions.ts`, plus `FRAME_WIDTH`, `NODE_RADIUS`, `LABEL_SIZE`, `DRAW_ORDER` (copied from `NumogramClient.tsx`'s `zoneOrder` memo), `FRAME_HEIGHT` (from `useTween.ts`) and `REGION_LABELS` (from `Projection.tsx`'s `RegionLabels` sub-component) — all plain literals, line 1 the exact not-relicensed header.
- `app/presets/base10/layouts.ts`: `BASE10_LAYOUT_SPECS` with four `LayoutSpec`s (`original`, `labyrinth`, `ladder`, `planetary`), each `supports()` true only for base 10 and `build()` throwing `RangeError` otherwise; every built `Layout` has `width: 800`, `scale: 1`, `strokeScale: 1`, `nodeRadius: 21`, `labelSize: 17`, `base: 10`; imports the engine's `Layout`/`LayoutSpec`/`RoutingStyle`/`Numogram` types only (`import type`), so no engine layout runtime enters the viewer bundle.
- `tests/presets/base10-layouts.test.ts` (37 tests): **numeric oracle** — built `x`/`y`/`center` for original/labyrinth/ladder equal `engine/test/fixtures/base10.golden.json` exactly, planetary `x`/`y` match within 1e-9 and `nodeRadii` match the golden sizes; **DOM golden parity** — a local regex parser over the frozen `e2e/__golden__/golden.spec.ts/{original,labyrinth,ladder}--default.txt` confirms viewBox height, the zone-label draw-order sequence at `(x, y-1)`, an `r=21` circle at every zone's `(x,y)`, and the region labels (text/x/y/size/opacity/anchor) in order; planetary's height and draw order are checked against `e2e/__behaviour__/planetary.json` and the golden's `positionsAtDefaultAngle`; **specs** — ids, `supports`/`build` base-10-only behaviour, shared sizing; **licensing** — the not-relicensed header, NOTICE naming the new file, and every `engine/`-mentioning line in both new files being `import type`.
- `app/data/positions.ts` flipped to a two-line pass-through seam (`export { ... } from '../presets/base10/layouts'`); the render path, the 60 DOM goldens and the behaviour baseline are unchanged (`npm run test:swap` and the full `npm run verify` both green on the committed tree).
- NOTICE: section 1's `app/presets/base10/` exclusion now also excludes `layout-tables.ts`; section 2 gains an entry naming it and its four source files, without disturbing the existing `lumpenspace/ccru` attribution or the `lore.ts` exclusion in section 3.
- Page weight verified essentially flat: `/numogram/` before (Task 1 tree, positions.ts still literal) `jsBytes=580940 jsGzip=175500`; after (Task 2 tree, seam flipped) `jsBytes=580938 jsGzip=175499` — a 2-byte/1-byte *decrease*, confirming no engine layout runtime leaked into the bundle. `npm run check:weight` reported OK with no baseline change (still well inside the stored baseline's tolerance, consistent with the ~+17 KB/+3% accumulated growth already recorded at the end of Phase 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Layout tables, LayoutSpec presets, NOTICE entry and the equality proof** - `131707b` (feat)
2. **Task 2: Flip app/data/positions.ts to the pass-through seam and prove the full gate** - `1eee526` (refactor)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `app/presets/base10/layout-tables.ts` - upstream-derived tables (not relicensed): `P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`, `PLANETARY_CX/CY/RADIUS/DEFAULT_ANGLE/SIZE`, `CENTER`, `FRAME_WIDTH`, `NODE_RADIUS`, `LABEL_SIZE`, `DRAW_ORDER`, `FRAME_HEIGHT`, `REGION_LABELS`
- `app/presets/base10/layouts.ts` - `BASE10_LAYOUT_SPECS` and its four builders (`buildOriginal`, `buildLabyrinth`, `buildLadder`, `buildPlanetary`), re-exports the nine table constants
- `app/data/positions.ts` - two-line pass-through seam over `app/presets/base10/layouts`
- `NOTICE` - `layout-tables.ts` named in section 1's exclusion and added to section 2
- `tests/presets/base10-layouts.test.ts` - oracle equality, DOM golden parity, spec behaviour and licensing tests (37 tests)

## Decisions Made

- Shared a private `buildFixed(id, table, routingStyle)` helper called from inside each of the three fixed-table builder functions' bodies (not at module top level), keeping the plan's four distinct, individually tree-shakeable builder functions while avoiding literal duplication of the `Layout` object shape three times.
- Re-exported the nine table constants from `layouts.ts` via a bare `export { P_ORIGINAL, ... }` (forwarding the already-imported local bindings) instead of a second `export { ... } from './layout-tables'` statement, so there is only one `import` declaration per module (avoids any risk of an `import/no-duplicates` lint conflict) while preserving live-binding identity end to end for the Task 2 `toBe` checks.
- Distinguished zone-label text nodes from the pandemonium/demon-layer's single-digit labels (both single characters in the flattened golden text) by `font-size="17"` vs `font-size="7"`, discovered by inspecting the golden file directly (initial digit-only regex over-matched 20 nodes instead of 10 per file; fixed before the RED run reached CI).

## Deviations from Plan

None - plan executed as written. One self-correction during test authoring, not a deviation from the plan's own spec: the plan's behavior text says "the zone-label sequence (digit from the following #text line)"; a naive digit-content filter also picked up the pandemonium layer's font-size-7 single-digit mesh labels (10 extra per golden file), so the parser additionally keys on `font-size="17"` (the zone label's own stated size, already named in the plan's interfaces section) before the implementation was ever run against the empty preset files. No plan text needed reinterpretation to fix this — it was a test-authoring bug caught immediately.

## Issues Encountered

- The `layout-tables.ts` doc comment for `FRAME_WIDTH`/`NODE_RADIUS`/`LABEL_SIZE` originally said "procedural layouts (engine/layout/) compute their own", which the licensing test correctly flagged: the literal substring `engine/` appeared outside an `import type` line. Reworded to "procedural layouts (in the engine) compute their own" — a wording fix, not a logic change; re-ran the test file to confirm 37/37 green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LAY-02 is fully satisfied: base 10's four authored layouts are `LayoutSpec` presets, proven equal to the frozen oracles, and `app/data/positions.ts` is a thin seam consistent with the Phase 2 pattern.
- `app/presets/base10/layouts.ts` and `layout-tables.ts` are ready for the layout registry work in 03-07 (which is expected to add these specs alongside the procedural `ring`/`ladder`/`spiral` specs from 03-01/03-03).
- No known gaps or stubs. The remaining `app/data/*.ts` seams (`zones`, `syzygies`, `currents`, `gates`, `demons`) and `app/lib/constants.ts` are unaffected by this plan and remain scheduled for Phase 4 (MIG-02), as before.
- No blockers for 03-06.

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`131707b`, `1eee526`) verified present in git history.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*
