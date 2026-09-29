---
phase: 04-base-picker-and-generator-ui
plan: 09
subsystem: ui
tags: [react, svg, numogram-engine, view-model, dom-golden]

requires:
  - phase: 04-03
    provides: NumogramView/buildNumogramView, NumogramSummary, zoneLabelsFor/DEFAULT_LABEL_SCHEME, tierBounds accessors
  - phase: 04-08
    provides: layoutTarget/engineRenderData, ViewLayoutId, RegionLabel/RoutingStyle contracts
provides:
  - NumogramViewContext/useNumogramView carrying the numogram view model to the tree
  - Base-generic Projection.tsx (view, metrics and label props; no base-10 data imports)
  - In-base plexExpr, partner-aware syzMidBiased/syzTrianglePoints, base-generic xenotationByZone
  - renderToStaticMarkup smoke proving bases 2..40 render with no NaN/undefined through a procedural layout
affects: [04-10, 04-11, 04-12, 04-13, 04-16]

tech-stack:
  added: []
  patterns:
    - "View-model props over data imports: a React component takes a NumogramView (or a slice of one) plus explicit
       metrics (width/nodeRadius/labelSize/strokeScale) instead of importing base-10-specific constants directly"
    - "Node/stroke scale factors (k, ss) multiplied into every size-bearing SVG attribute so k=ss=1 reproduces a
       frozen preset's numbers exactly, and non-1 values scale correctly at other bases"
    - "Per-iteration React.Fragment (not a wrapping <g>) when mapping a variable-length list (here Torque walks) into
       a byte-identical DOM position at the n=1 case, so adding generality never changes existing golden markup"

key-files:
  created:
    - app/components/numogram/ViewContext.tsx
    - tests/app/numogramLib.test.ts
    - tests/app/projectionRender.test.ts
  modified:
    - app/lib/numogram.ts
    - app/lib/geometry.ts
    - app/lib/xenotation.ts
    - app/presets/base10/routes.ts
    - app/components/info/InfoDisplay.tsx
    - app/components/projection/Projection.tsx
    - app/NumogramClient.tsx
    - vitest.config.mts

key-decisions:
  - "plexExpr(cum, base) keeps the pre-existing multi-step chain-drop shape (only the first reduction step shows its
     digit breakdown, e.g. plexExpr(28, 10) = '2+8=10=1' not '2+8=10=1+0=1') to match the frozen e2e/__behaviour__
     baseline captured from the untouched viewer; the plan's <behavior> example was inherited from a pre-existing,
     never-verified docstring rather than the baseline's actual captured output"
  - "vitest.config.mts needs oxc.jsx: { runtime: 'automatic' } because the root tsconfig's jsx:\"preserve\" (for
     Next's own compiler) otherwise breaks Vite 8's default oxc transform when a test imports a .tsx component
     directly"
  - "layoutId is part of ProjectionProps per the plan's contract but is not read anywhere in the component body in
     this plan (no substitution in the plan's list needs it); kept for the interface's completeness, expected to be
     used once 04-11 wires a live layout switch"

requirements-completed: []
# MIG-02, UI-03 and UI-04 all remain Pending: MIG-02's final covering plan is 04-16 (NumogramClient.tsx, panels and
# the default grep gate are still untouched), UI-03's is 04-12 (label scheme spans six plans), UI-04's is 04-11
# (hover/pin generality is proven only once the app can actually run a non-base-10 base), matching this phase's
# established per-plan-requirements precedent (see STATE.md Phase 4 P02/P03 notes).

duration: 55min
completed: 2026-09-29
---

# Phase 4 Plan 9: Base-Generic Projection, In-Base plexExpr, NumogramViewContext Summary

**Projection.tsx (1061 lines) now draws any even base from a NumogramView + layout-metrics prop contract instead of importing base-10 data directly, with base 10 proven byte-identical against the frozen DOM goldens and behaviour baseline, and a server-render smoke covering every even base 2..40.**

## Performance

- **Duration:** ~55 min (one session interruption/resume mid-execution; net active work)
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `app/components/numogram/ViewContext.tsx` (new): `NumogramViewContext`/`useNumogramView` carry `base`, `g`,
  `summary`, `view` (nullable above the SVG tier), `zoneLabels`, `labelScheme`, `zoneLabel()`, `svgRichMaxN`,
  `allChordsMaxN` and `gateMode` to the whole tree; `NumogramClient.tsx` builds the base-10 view once and wraps the
  page in the provider.
- `Projection.tsx` is fully base-generic: it no longer imports `app/data/{zones,syzygies,currents,gates,demons}` or
  `TC_EDGES/TC_CURRENTS/TC_SYZYGIES` from `app/lib/constants`. It takes a `view: NumogramView`, `layoutId`,
  `routingStyle`, `presetRouting`, explicit metrics (`width`, `nodeRadius`, `labelSize`, `strokeScale`),
  `regionLabels`, `zoneLabels`, `labelsOn` and `gateMode`. Every size-bearing attribute is multiplied by a node
  scale `k = nodeRadius / 21` or a stroke scale `ss = strokeScale`, both `1` for the four authored base-10 presets,
  so the rendered numbers are unchanged.
- `plexExpr(cum, base)` (app/lib/numogram.ts) computes digit sums in the numogram's own base via the engine's
  `digitsOf`/`formatNumeral` instead of `String(current).split('')` (CLAUDE.md's core in-base-arithmetic rule);
  `syzMidBiased`/`syzTrianglePoints` (app/lib/geometry.ts) take the partner zone as a parameter (from
  `view.partner(zone)`/the engine) instead of computing `9 - zone`, and `syzTrianglePoints` also takes a node-scale
  factor; `xenotationByZone(zoneCount)` (app/lib/xenotation.ts) loops to the given zone count instead of a literal
  `<= 9`.
- `data-diagram="zones"`, `data-zone`, `data-gate`, `data-current`, `data-syzygy`, `data-demon`, `data-gate-label`
  and `data-region-label` hooks added throughout (all `data-*` attributes are dropped by the DOM golden comparator,
  so these are free test hooks, not golden risk).
- `tests/app/numogramLib.test.ts` (new, 21 tests): plexExpr digit-sum correctness for bases 10/16/12 and against the
  engine's own gate destination for every even base 2..64; geometry parity against the pre-existing base-10 formula
  for zones 0..9 plus a node-scale check; `xenotationByZone(4)`.
- `tests/app/projectionRender.test.ts` (new, 25 tests): `renderToStaticMarkup` of the base-10 `original` preset with
  the exact props `NumogramClient.tsx` passes (`viewBox="0 0 800 940"`, 10 `data-zone=` groups, WARP/PLEX text
  present), and every even base 2..40 through `layoutTarget(g, 'ring', 'shelf', {})` +
  `engineRenderData(buildNumogramView(g), target.layout)` (n `data-zone=` groups, n `data-gate=` groups, no `NaN` or
  `undefined` anywhere in the markup).
- Full gate green on the committed tree: `npm run verify` exit 0 (75 e2e passed, 5 skipped; 1537 unit tests in two
  timezones; `check-repo` OK including `clean-tree`/`static-out`; `check:weight` OK without needing a baseline
  update — `/numogram/` grew +25,454 bytes raw / +8,139 gzip, +4.5%/+4.8%, inside the max(1 KiB, 5%) tolerance, from
  `buildNumogramView`/`tierBounds`/`labelScheme` entering the bundle for the first time via `NumogramClient.tsx`).

## Task Commits

1. **Task 1: ViewContext, in-base plexExpr, partner-aware geometry, xenotationByZone(zoneCount) and their call sites** - `8c90fd8` (fix)
2. **Task 2: Projection.tsx fully base-generic (view, metrics, labels, region labels, gate mode) with a server-render smoke** - `6affe92` (refactor)

_No plan-metadata commit yet — this SUMMARY/STATE/ROADMAP update is committed separately after this document is written (see final_commit step)._

## Files Created/Modified

- `app/components/numogram/ViewContext.tsx` - `NumogramViewContext`/`useNumogramView` (new)
- `app/lib/numogram.ts` - `plexExpr(cum, base)`, in-base via `digitsOf`/`formatNumeral`
- `app/lib/geometry.ts` - `syzMidBiased(zone, partner, pos)`, `syzTrianglePoints(zone, partner, pos, scale)`
- `app/lib/xenotation.ts` - `xenotationByZone(zoneCount)`
- `app/presets/base10/routes.ts` - `syzMidBiased` call site passes the already-computed `partner`
- `app/components/info/InfoDisplay.tsx` - `GateInfo` reads `base` from `useNumogramView()` for `plexExpr`
- `app/components/projection/Projection.tsx` - full base-generic rewrite (view/metrics/label props, no base-10 data
  imports, `data-*` hooks, node/stroke scale factors, per-walk `React.Fragment` for the Time-Circuit layers)
- `app/NumogramClient.tsx` - builds `view`/`zoneLabels`/`viewCtx`, wraps the tree in the provider, passes the new
  Projection props for the base-10 preset in use, `zoneOrder` reads `DRAW_ORDER`/`view.zoneCount`
- `vitest.config.mts` - `oxc.jsx: { runtime: 'automatic' }` so the oracle test project can import `Projection.tsx`
- `tests/app/numogramLib.test.ts` - new (21 tests)
- `tests/app/projectionRender.test.ts` - new (25 tests)

## Decisions Made

- **plexExpr keeps the legacy multi-step chain-drop shape at base 10.** The plan's `<behavior>` example
  (`plexExpr(28, 10) === '2+8=10=1+0=1'`) was copied from `app/lib/numogram.ts`'s pre-existing doc comment, which
  had never matched the actual pre-existing implementation (verified: `git show 452a2c9:app/lib/numogram.ts`, a
  pre-GSD commit, already had this doc/code mismatch). The frozen `e2e/__behaviour__` baseline was captured from
  the untouched viewer's *actual* (chain-dropping) output, so `npm run test:swap` failed the `behaviour: original`
  test (a Gt-28 Selection panel PLEX line) the first time plexExpr was fixed to show every step's breakdown. Per
  CLAUDE.md's frozen-oracle policy and this plan's own must-have ("Base 10 renders byte-identically... so the 60 DOM
  goldens and the behaviour baseline pass unregenerated"), the fix keeps the base-10-visible shape unchanged
  (`plexExpr(28, 10) === '2+8=10=1'`) while still fixing the actual MIG-02-relevant defect (in-base `digitsOf`/
  `formatNumeral` instead of decimal `String(current).split('')`, which only changes output at bases other than 10).
  The test file and the doc comment were both updated to state this explicitly.
- **`vitest.config.mts` needs `oxc: { jsx: { runtime: 'automatic' } }`.** Vite 8 defaults to its Rust-based `oxc`
  transformer (not esbuild); it picks up the root `tsconfig.json`'s `jsx: "preserve"` (set for Next's own compiler)
  and then can't emit valid JS for any `.tsx` file, which broke `tests/app/projectionRender.test.ts`'s direct import
  of `Projection.tsx` (the first oracle test to import a component). Setting `esbuild.jsx` had no effect (Vite 8
  logs "Both esbuild and oxc options were set... oxc options will be used"); overriding `oxc.jsx` directly fixed it.
- **Commit granularity:** `app/components/projection/Projection.tsx` and `app/NumogramClient.tsx` are touched by
  both tasks (Task 1 adds a `view` prop and three call-site fixes; Task 2 immediately rewrites/extends the same
  lines). Reconstructed the true Task-1-only intermediate state for both files (verified independently against
  `npm run test:swap`, exit 0, before Task 2 began) so the two commits are accurate rather than front-loading Task
  2's work into Task 1's commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-walk React.Fragment instead of a wrapping `<g>` in the Time-Circuit layers**
- **Found during:** Task 2, first `npm run test:swap` run on the combined Task 1+2 tree
- **Issue:** The generalized code mapped `view.torqueWalks.map((walk, i) => <g key={...}>...</g>)` for both the
  particle-layer TC path and the `tcActive` overlay. Base 10 has exactly one Torque walk, but wrapping it in a `<g>`
  added one DOM element that the original flat structure (path and circles as direct siblings) never had, breaking
  5 of the 60 frozen DOM goldens (`{original,labyrinth,ladder}--time-circuit`, chromium-utc and chromium-ny).
- **Fix:** Replaced both `<g key={...}>...</g>` wrappers with `<React.Fragment key={...}>...</React.Fragment>`,
  which supports a keyed list without adding a DOM node, matching the pre-existing flat structure exactly at the
  single-walk case while still working for bases with zero or several Torque cycles.
- **Files modified:** `app/components/projection/Projection.tsx`
- **Verification:** Rerun of `npm run test:swap` (65 passed, 5 skipped; the two prior flaky `browserContext.newPage:
  Target crashed`/`worker process exited unexpectedly` failures on `ladder / region-warp` and `ladder /
  region-torque` — both unrelated to this change — did not recur).
- **Committed in:** `6affe92` (Task 2 commit)

**2. [Rule 3 - Blocking] `oxc.jsx` override added to `vitest.config.mts`**
- **Found during:** Task 2, first run of the new `tests/app/projectionRender.test.ts`
- **Issue:** Vitest failed to even load the test file (`Failed to parse source for import analysis because the
  content contains invalid JS syntax... make sure to not set jsx to preserve`) because no existing oracle test had
  ever imported a `.tsx` component before, and the root tsconfig's `jsx: "preserve"` broke Vite 8's oxc transform.
- **Fix:** Added `oxc: { jsx: { runtime: 'automatic' } }` to `vitest.config.mts` (an `esbuild.jsx` override was
  tried first and silently ignored, per Vite 8's own warning that oxc wins when both are set).
- **Files modified:** `vitest.config.mts`
- **Verification:** `tests/app/projectionRender.test.ts` and the rest of the suite (1537 tests) pass; `npm run
  verify`'s `check:repo`/`typecheck`/`test`/`test:tz` steps all green.
- **Committed in:** `6affe92` (Task 2 commit)

**3. [Rule 1 - Bug, discovered but deliberately not "fixed" beyond the plan's own base-10 constraint] plexExpr's
multi-step chain-drop**
- See "Decisions Made" above — this is the plexExpr behaviour-baseline conflict. Documented here too because it
  changed the plan's own `<behavior>` example and the corresponding test assertion.
- **Committed in:** `8c90fd8` (Task 1 commit)

---

**Total deviations:** 3 (2 auto-fixed bugs/blockers, 1 base-10-preserving behavior-spec correction, all inside
Projection.tsx/vitest.config.mts/numogram.ts). **Impact on plan:** None on scope; all three were necessary to keep
base 10 byte-identical against the frozen oracles while still delivering the plan's stated generalization.

## Issues Encountered

- The first full `npm run test:swap` run also reported `browserContext.newPage: Target crashed` and `worker process
  exited unexpectedly (code=3221225794)` on two unrelated `ladder / region-warp` and `ladder / region-torque` tests
  under the `chromium-ny` project. These did not touch the Time-Circuit code path and did not recur on the next full
  run (including inside `npm run verify`), so they were transient Windows/Chromium flakiness, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Projection.tsx` is ready to receive a non-base-10 view (04-11): it already reads every zone/syzygy/current/gate/
  demon/lore/Torque list from `NumogramView`, and `tests/app/projectionRender.test.ts` proves bases 2..40 render
  correctly through a procedural `ring` layout today, ahead of that plan wiring it into the live app.
- `NumogramViewContext` is mounted (base 10 only) so `04-10`'s panels/detail views can start reading it immediately.
- MIG-02, UI-03 and UI-04 all remain Pending in REQUIREMENTS.md by design (see `key-decisions`/frontmatter note);
  no blockers for `04-10` or `04-11`.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 12 created/modified files found on disk; both task commits (`8c90fd8`, `6affe92`) found in `git log`.
