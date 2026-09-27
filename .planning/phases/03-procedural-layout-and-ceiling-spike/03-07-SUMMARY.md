---
phase: 03-procedural-layout-and-ceiling-spike
plan: 07
subsystem: engine-layout
tags: [typescript, layout, registry, tween, determinism, sizing, engine-barrel, sideEffects]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: "03-01: engine/layout/types.ts, ringLayout; 03-02: engine/scene/tiers.ts and tier-table.json; 03-03: ladderLayout, spiralLayout, pairGraphLayout/routePairGraph; 03-04: routeGates/routeCurrents; 03-05: app/presets/base10/layouts.ts (BASE10_LAYOUT_SPECS); 03-06: engine/scene/svgString.ts (layoutToSvg/pairGraphToSvg)"
provides:
  - "engine/layout/registry.ts: PROCEDURAL_LAYOUT_SPECS, resolveLayout (preset -> procedural id -> base default), layoutIdsFor"
  - "engine/layout/tween.ts: lerpPositions (D-09 straight interpolation, exact at t=0/t=1)"
  - "engine/layout/index.ts and engine/scene/index.ts: barrels, re-exported through engine/index.ts (export * from './layout/index' and './scene/index')"
  - "engine/package.json: \"sideEffects\": false"
  - "tests/presets/layout-registry.test.ts: BASE10_LAYOUT_SPECS resolve through resolveLayout/layoutIdsFor from the engine barrel"
affects: [03-08, 03-09, 03-10, 04-base-generic-viewer-and-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry resolution order (D-05, T-03-19): (1) an exact preset id that supports the base wins; (2) else a LAYOUT_IDS id builds the matching procedural layout with the caller's params; (3) else the first supporting preset, else the procedural ring — an unrecognised id is only ever compared, never evaluated, so it can only fall through to the base default"
    - "Exact tween boundaries: lerpPositions special-cases t=0/t=1 with a plain Float64Array.set (not the lerp formula) because `fx + (tx - fx)` is not always bit-identical to `tx` under IEEE 754 — discovered by the registry test's own toEqual assertion at t=1, fixed before the GREEN commit"
    - "Barrel re-export split: `export { ... }` (values) and `export type { ... }` (types) kept as separate statements per module in engine/layout/index.ts and engine/scene/index.ts, matching the existing engine/index.ts style, so a type-only importer (app/presets/base10/layouts.ts) never pulls layout/scene runtime into its bundle"
    - "Module-scope sample memoization in layout.sizing.test.ts (SAMPLES built once, reused by both the 'sizing' and 'monotonic' describe blocks) to avoid rebuilding 812 layouts twice"

key-files:
  created:
    - engine/layout/registry.ts
    - engine/layout/tween.ts
    - engine/layout/index.ts
    - engine/scene/index.ts
    - engine/test/layout.registry.test.ts
    - engine/test/layout.determinism.test.ts
    - engine/test/layout.sizing.test.ts
    - tests/presets/layout-registry.test.ts
  modified:
    - engine/index.ts
    - engine/package.json
    - .planning/REQUIREMENTS.md

key-decisions:
  - "lerpPositions copies from/to exactly at t=0/t=1 via .set() rather than always applying `fx + (tx - fx) * t`: the literal formula is used only for 0 < t < 1. This was a genuine bug caught by the GREEN run (t=1 produced a 1-ULP-off Float64Array that failed toEqual against layout.y), fixed under Rule 1 before committing."
  - "layout.determinism.test.ts and layout.sizing.test.ts test already-implemented modules (ring/ladder/spiral/pairgraph/routing from 03-01/03-03/03-04, svgString from 03-06) and passed on the very first run with no production changes needed outside tween.ts — committed together with the new registry.ts/tween.ts/index.ts in one GREEN commit rather than as a separate coverage-only commit, since all three test files were written together as Task 1's single TDD unit per the plan's action text."
  - "REQUIREMENTS.md traceability rows for LAY-01 and LAY-03 were hand-edited to add '03-07' to the covering-plans count ('... 03-06, 03-07 of 6 covering plans done') instead of running `requirements mark-complete`, per the phase's known corruption risk with multi-plan requirements; neither checkbox was ticked since 03-08 (the human contact-sheet sign-off) is still pending."
  - "ROADMAP.md's 03-07 checkbox and STATE.md were updated by hand-verifying gsd-sdk's automated helpers rather than trusting them blindly, per the phase's known tooling issues with `state advance-plan` and `roadmap update-plan-progress`."

requirements-completed: []

# Metrics
duration: 19min
completed: 2026-09-27
---

# Phase 3 Plan 07: Layout Registry, Tween Helper and Engine Barrel Summary

**A three-tier layout registry (`resolveLayout`/`layoutIdsFor`: exact preset, then procedural id, then base default) and a straight-line tween helper (`lerpPositions`, exact at the endpoints) are wired together with the layout and scene modules into `engine/index.ts`, proven deterministic and correctly sized across bases 2 to 4096/1024/666, and the full `npm run verify` gate is green with the page-weight baseline unchanged (`sideEffects: false` kept the new runtime out of the viewer bundle).**

## Performance

- **Duration:** 19 min (previous plan's docs commit 15:29:33 -> this plan's final code commit 15:43:24, plus the `npm run verify` gate through roughly 15:47)
- **Started:** 2026-09-27T15:29:33-06:00
- **Completed:** 2026-09-27T21:48:38Z
- **Tasks:** 2 completed
- **Files modified:** 10 (8 created, 2 modified under `engine/`, plus the `.planning/REQUIREMENTS.md` traceability edit)

## Accomplishments

- `engine/layout/registry.ts`: `PROCEDURAL_LAYOUT_SPECS` (`ring`, `ladder`, `spiral`, each supporting every base as a plain-literal `LayoutSpec`), `resolveLayout(g, id?, presets?, params?)` implementing the exact three-tier resolution order from the plan (preset match -> procedural `LAYOUT_IDS` id -> first supporting preset else procedural `ring`), and `layoutIdsFor(g, presets?)` (supporting preset ids in order, then any `LAYOUT_IDS` id not already listed). No caching: layouts stay cheap, only the numogram itself is cached.
- `engine/layout/tween.ts`: `lerpPositions(from, to, t, outX, outY)` — `t = 0`/`t = 1` copy `from`/`to` exactly via `.set()`, `0 < t < 1` uses the literal `fx + (tx - fx) * t` formula (D-09); `RangeError` for a base mismatch, `t` outside `[0, 1]` (including `NaN`, which fails every comparison), or a wrong-length output array.
- `engine/layout/index.ts` and `engine/scene/index.ts`: explicit barrels (values and types as separate `export`/`export type` statements) covering every public name of `engine/layout` and `engine/scene`; both re-exported from `engine/index.ts` via `export * from './layout/index'` and `export * from './scene/index'` with zero name collisions against the existing core exports.
- `engine/package.json` gains `"sideEffects": false`.
- Three new engine test files (Task 1, TDD): `engine/test/layout.registry.test.ts` (13 tests: `resolveLayout`'s four resolution branches including the `'nonsense'`/`'labyrinth'`-at-base-28 fallbacks (T-03-19), `layoutIdsFor`, and `lerpPositions`'s boundary/midpoint/cross-layout/error behaviour), `engine/test/layout.determinism.test.ts` (byte-identical `x`/`y`/`px`/`py` via `Buffer.from(...).equals(...)`, equal `groups`/`regionLabels`/`center`/`width`/`height`, identical route and SVG strings, all across two builds and after `clearNumogramCache()`, for 14 bases 2..1024 x 4 zone builders plus the pair graph; a source scan of every `.ts` file under `engine/layout` and `engine/scene` for `Math.random`/`new Date`/`Date.now`/`Intl.`/`toLocaleString` found none), `engine/test/layout.sizing.test.ts` (formula checks — `nodeRadius === 21 * scale`, `labelSize === 0.8 * nodeRadius`, `strokeScale === max(1, width/800)`, `0 < scale <= 1`, `max(width,height) <= 4096`, pair-graph `nodeHeight === 1.6 * 21 * scale` — over 203 bases per builder; a "monotonic" check that scale/nodeRadius never increase as `natural` frame size grows; a "review bases" check over the 10 roadmap bases for frame containment, minimum centre spacing (>= 3r zone / >= 2r pair), region-label containment and a positive on-screen radius).
- `tests/presets/layout-registry.test.ts` (Task 2, oracle project): proves `BASE10_LAYOUT_SPECS` resolve through the same `resolveLayout`/`layoutIdsFor` interface imported from the engine barrel — base 10 with no id defaults to `'original'`, the `'ladder'` preset wins over and exactly matches the procedural `ladderLayout(g10)` (`drawOrder` `[4,5,3,6,2,7,1,8,0,9]`), `'ring'`/`'planetary'` resolve correctly, base 28 with `'labyrinth'` or no id falls back to the procedural `'ring'` (D-05), and `layoutIdsFor(g10, BASE10_LAYOUT_SPECS)` equals `['original','labyrinth','ladder','planetary','ring','spiral']`.
- Full gate: `npx tsc -p engine/tsconfig.json`, `engine/tsconfig.test.json` and `npm run typecheck` (4x tsc + lint) all clean; `npx cross-env CCRUG_TZ=UTC vitest run` — 42 files, 1151 tests, all green; the determinism suite re-run green under `CCRUG_TZ=America/New_York`; `MSYS_NO_PATHCONV=1 npm run verify` exit 0 on the committed tree (75 e2e passed + 5 expected-skipped, 60 DOM goldens and the behaviour baseline unchanged, `check:weight` OK, `check-repo` 12/12).
- Page weight: `/numogram/` before this plan (Task 1 tree) `jsBytes=580938 jsGzip=175499`; after (Task 2 tree, engine barrel exports plus `sideEffects: false`) `jsBytes=580938 jsGzip=175506` — 0 bytes raw, +7 bytes gzip (noise), confirming the new layout/scene runtime never entered the viewer bundle. `npm run check:weight` OK, baseline unchanged.
- `git diff --quiet d8ed75f -- perf/page-weight.baseline.json e2e engine/test/fixtures app/NumogramClient.tsx app/components app/hooks app/lib` exits 0: no frozen path touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Registry, tween helper, layout barrel, determinism and sizing tests**
   - `faabcfb` (test) — add failing test for the layout registry and tween helper (RED: `../layout/registry` and `../layout/tween` did not exist; the determinism and sizing suites passed immediately since they exercise already-implemented modules)
   - `8b05fec` (feat) — layout registry, tween helper and the layout barrel (GREEN: all 20 tests in the three new files pass in UTC, the determinism suite also passes in America/New_York, both engine tsconfigs clean)
2. **Task 2: Scene barrel, engine exports, sideEffects flag, preset resolution test and the full gate** - `d6d39b9` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `engine/layout/registry.ts` - `PROCEDURAL_LAYOUT_SPECS`, `resolveLayout`, `layoutIdsFor`
- `engine/layout/tween.ts` - `lerpPositions`
- `engine/layout/index.ts` - the layout barrel
- `engine/scene/index.ts` - the scene barrel
- `engine/index.ts` - appends `export * from './layout/index'` and `export * from './scene/index'`
- `engine/package.json` - `"sideEffects": false`
- `engine/test/layout.registry.test.ts` - registry and tween tests (13 tests)
- `engine/test/layout.determinism.test.ts` - determinism sweep and the T-03-21 source scan (2 tests)
- `engine/test/layout.sizing.test.ts` - sizing formula, monotonic and review-bases tests (5 tests)
- `tests/presets/layout-registry.test.ts` - preset resolution through the engine barrel (7 tests)
- `.planning/REQUIREMENTS.md` - LAY-01/LAY-03 traceability rows now read "... 03-06, 03-07 of 6 covering plans done"

## Decisions Made

- `lerpPositions` special-cases `t === 0` and `t === 1` with `Float64Array.set()` instead of always evaluating `fx + (tx - fx) * t`: the plan's own literal formula is not guaranteed bit-identical to `to.x`/`to.y` at `t = 1` under IEEE 754 (confirmed empirically — the GREEN run failed a `toEqual` by one ULP on a real base-28 layout before this fix), so the boundary cases copy exactly and the formula is used only for the interior of `[0, 1]`.
- Kept Task 1's three test files as one TDD unit (one `test` commit, one `feat` commit) rather than splitting the coverage-only determinism/sizing tests into a separate commit, because the plan's action text introduces and describes all three together as a single numbered step, and their assertions all depend on (and were authored alongside) the same `registry.ts`/`tween.ts` work.
- `tests/presets/layout-registry.test.ts` imports every engine name (`createNumogram`, `ladderLayout`, `layoutIdsFor`, `resolveLayout`) from `'../../engine/index'` rather than individual module paths, per the plan's explicit instruction, so the test also exercises the barrel itself.
- REQUIREMENTS.md was hand-edited for the LAY-01/LAY-03 covering-plan counts instead of invoking `requirements mark-complete`, and ROADMAP.md/STATE.md updates were verified by hand after running the `gsd-sdk` helpers, per this phase's documented tooling-corruption risks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `lerpPositions` at `t = 1` was not bit-identical to the destination layout**
- **Found during:** Task 1 GREEN run (`engine/test/layout.registry.test.ts`, the `lerpPositions` `t=0/t=1/t=0.5` test)
- **Issue:** The literal formula `outY[z] = fy + (ty - fy) * t` evaluated at `t = 1` produced `166.7906187069309` where `to.y[z]` was `166.79061870693093` — a 1-ULP difference from IEEE 754 non-associativity (`fy + (ty - fy)` is not always bit-identical to `ty`), failing the `toEqual` assertion that "t = 1 copies b" exactly.
- **Fix:** Special-cased `t === 0` and `t === 1` in `lerpPositions` to copy the source arrays directly via `Float64Array.set()`, leaving the lerp formula for `0 < t < 1`.
- **Files modified:** `engine/layout/tween.ts`
- **Commit:** `8b05fec`

No other deviations — every other formula, resolution order and file/export shape matches the plan's action text and interfaces list verbatim.

## Issues Encountered

None beyond the tween precision fix above. `engine/test/layout.determinism.test.ts` and `engine/test/layout.sizing.test.ts` passed on their very first run against the already-implemented ring/ladder/spiral/pairgraph/routing/svgString modules from prior plans, with no production changes needed outside `tween.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LAY-02 stays Complete (unaffected). LAY-01 and LAY-03 remain **in progress** (03-01, 03-03, 03-04, 03-06, 03-07 of 6 covering plans done; 03-08's human contact-sheet sign-off is the final covering plan) — neither checkbox is ticked by this plan. LAY-04's row is unchanged (03-07 does not cover it).
- `engine/layout/registry.ts` and `engine/layout/tween.ts` are ready for 03-08's contact-sheet script (layout selection per base) and any future layout-switch UI in Phase 4.
- No known gaps or stubs. No blockers for 03-08, which is a `autonomous: false` checkpoint plan (human contact-sheet sign-off, D-10) that the orchestrator spawns next, not this executor.

## Self-Check: PASSED

All 8 created files verified present on disk (`engine/layout/registry.ts`, `engine/layout/tween.ts`, `engine/layout/index.ts`, `engine/scene/index.ts`, `engine/test/layout.registry.test.ts`, `engine/test/layout.determinism.test.ts`, `engine/test/layout.sizing.test.ts`, `tests/presets/layout-registry.test.ts`); all 3 task commit hashes (`faabcfb`, `8b05fec`, `d6d39b9`) verified present in `git log`.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*
