---
phase: 04-base-picker-and-generator-ui
plan: 11
subsystem: ui
tags: [react, url-codec, playwright, engine-layout, mig-02]

requires:
  - phase: 04-05
    provides: parseShareParams/buildShareParams (the single URL codec), DEFAULT_LAYERS, BaseRefusal
  - phase: 04-06
    provides: refusalFromUrl (base-picker refusal copy)
  - phase: 04-07
    provides: numogramText, BigBaseSummary, TextView, PairGraphProjection
  - phase: 04-08
    provides: layoutTarget/DIAGRAM_CSS_WIDTH/engineRenderData/frameLayout, useLayoutTween, useReducedMotion
  - phase: 04-09
    provides: base-generic Projection.tsx, NumogramViewContext
  - phase: 04-10
    provides: panels/InfoDisplay/PinnedBackground reading NumogramViewContext
provides:
  - The viewer itself switched from the fixed base-10 preset path to the engine-driven generator (base state, layout
    target, tier gate, URL codec wiring, context all follow ?base=)
  - e2e/url-codec.spec.ts and e2e/hover-pin.spec.ts (UI-02/UI-04/UI-06 at a generated base, 28)
affects: [04-12, 04-13, 04-14, 04-15, 04-16]

tech-stack:
  added: []
  patterns:
    - "A LayoutTarget (and everything downstream of it — presetGates/presetCurrents/finalRoutes/frameRoutes/
       pairRoutes/zoneOrder/labelsOn) is computed only when the base-generic view is non-null (within the measured
       SVG tier, D-16): above the ceiling target stays null and useLayoutTween runs against a cheap module-level
       FALLBACK_TARGET (base 10's authored 'original' preset) so the hook is still called every render (rules of
       hooks) without ever building layout/routing structure for a huge base"
    - "The digit-shortcut gate lookup (0-9 keys select a zone's gate) is wrapped in `base === 10 &&` so it can never
       collide with another base's own in-base numeral keys; every other MIG-02 zone loop/partner/Torque-set
       reference now reads g.zoneCount/g.partner(z)/view.torqueZones or zonesOfRegion(g, ...) instead of a literal"
    - "hlRegion's highlight lookup is guarded by isRegionId(hlRegion, g) before calling zonesOfRegion (Rule 1: a
       region id valid for one base is not guaranteed valid after urlHydration changes the base under it, and the
       existing RegionsPanel.tsx is not yet base-generic itself — 04-13 rewrites it)"

key-files:
  created:
    - e2e/url-codec.spec.ts
    - e2e/hover-pin.spec.ts
  modified:
    - app/NumogramClient.tsx
    - app/components/ui/CyberButton.tsx
    - app/hooks/useOrbitalAnimation.ts
    - app/lib/shareTitle.ts
    - app/components/panels/RegionsPanel.tsx
    - perf/page-weight.baseline.json
  deleted:
    - app/hooks/useTween.ts

key-decisions:
  - "CyberButton.tsx's new `postBaseline` prop puts `data-post-baseline` on the new ring/spiral/pairGraph layout
     buttons (and on the base-10 preset buttons only when the base is not 10) so the frozen behaviour baseline's
     four-button/A-S-D-F contract at base 10 is untouched while the switcher is otherwise fully generic
     (`layoutIdsForBase(g.base)`)"
  - "app/lib/shareTitle.ts's ShareTitleInput.layout was widened from the old four-literal `Layout` type to
     `ViewLayoutId` (Rule 3, blocking-issue fix): once the layout switcher offers ring/spiral/pairGraph at base 10
     too (Task 1), the share-title builder's existing call site would not typecheck against the narrower type"
  - "RegionsPanel.tsx's prop types were widened to `RegionId | null` (04-13 rewrites the panel's own torque/warp/plex
     body to be base-generic; this plan only keeps the type contract consistent with the now-generic hlRegion state)"
  - "UI-04 is the only requirement this plan marks complete: UI-02's refusal message is stored (baseRefusal state)
     but not yet surfaced anywhere in the UI (04-12 mounts the picker that reads it), and UI-06 still needs the
     zoom/fit toolbar and its own e2e spec (04-15) — both stay Pending per the phase's established per-plan
     traceability (STATE.md Phase 4 P05/P07/P08/P09/P10 notes); MIG-02 stays Pending too, deferred to 04-16's
     DEFAULT_CHECKS promotion even though `node scripts/check-repo.mjs --only base-ten` now reports zero problems
     project-wide after this plan"

requirements-completed: [UI-04]

duration: ~2h40min
completed: 2026-09-29
---

# Phase 4 Plan 11: Base Picker and Generator UI — Engine-Driven Generator Switch Summary

**Switched `NumogramClient.tsx` from the fixed base-10 viewer to the engine-driven generator: layout targets and the generic tween drive base-10 presets and every procedural/pair-graph layout, the single URL codec reads and writes `?base=`, an SVG-tier gate degrades gracefully above the measured ceiling to a summary card and bounded text view, and the last hard-coded 10-zone assumptions in the file are gone.**

## Performance

- **Duration:** ~2h40min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified, 1 deleted)

## Accomplishments

- **Task 1 — layout plumbing (base still fixed at 10).** `NumogramClient.tsx` now builds one `LayoutTarget` per
  render (`layoutTarget(g, layout, packer, planetaryPos)`) and drives `pos`/`ctr`/`svgWidth`/`svgHeight`/`tweening`
  through the base-generic `useLayoutTween` (replacing `useTween.ts`, deleted). Base-10 presets (`original`,
  `labyrinth`, `ladder`, `planetary`) still render through the authored `base10GateRender`/`base10CurrentRender`
  path — byte-identical to the frozen goldens — while procedural layouts (`ring`, `spiral`) and the pair graph route
  through the engine (`engineRenderData`, `routePairGraph`, `PairGraphProjection`). The layout switcher is generic
  (`layoutIdsForBase(g.base)`), so base 10 now offers seven buttons (the four presets plus rings/spiral/pair graph),
  with `CyberButton`'s new `postBaseline` prop keeping the frozen four-button/A-S-D-F behaviour baseline contract
  intact for the original four. `useOrbitalAnimation`'s layout parameter widened from the old `Layout` union to
  `string` (base-generic).
- **Task 2 — base from the URL, SVG-tier gate, MIG-02.** `NumogramClient.tsx` now holds `base`/`labelScheme`/
  `tierOverride`/`baseRefusal` state; `g = createNumogram(base)`, `summary = summarize(g)`,
  `showDiagram = tierFor(base, tierOverride) === 'svg'`, and `view`/`zoneLabels`/`target` are all `null` above the
  tier (built only within it, per D-16/T-04-08). Hydration reads `parseShareParams(window.location.search)` instead
  of the file's own hand-written parser (base is the one strict field; a refusal is stored via `refusalFromUrl` for
  the 04-12 picker); the replaceState sync and the share button both call the codec's `buildShareParams` from one
  `currentShareState()` helper, and the local `sortSearchParams`/`buildShareParams`/`DEFAULT_LAYERS` were deleted in
  favour of the codec's own. Above the tier the pannable diagram is replaced by `<BigBaseSummary>` (refusal-style
  message, 4-metric card, bounded `numogramText`) outside the zoom wrapper. Every hard-coded 10-zone construct is
  gone: `finalizeSelection`/`onToggleAllZones` loop `g.zoneCount`, `onSelectCurrent`/`onRemoveSelectedInfo` call
  `g.partner(...)`, `hlZones`'s Time-Circuit branch reads `view.torqueZones` and its region branch calls
  `zonesOfRegion(g, hlRegion)` (guarded by `isRegionId`), `selectedInfos` iterates `view.gates`/`view.currents`/
  `view.syzygies`, and the `0-9` gate shortcut now only runs `if (base === 10 && ...)` against `view.gates`.
- **Two new e2e specs, both green on the first run.** `e2e/url-codec.spec.ts` (11 tests: `?base=28` round-trips
  through the URL and a reload with 4 layout buttons; `/numogram/?selected=5` and `?layout=ladder&selected=5` keep
  the legacy base-10 behaviour; `/?base=28` redirects through to `/numogram/?base=28`; `99999999999`/`27`/`28abc`
  each refuse to base 10 without freezing; `?layout=planetary` at base 28 degrades to a procedural layout;
  `?base=1024` shows the summary card and text view with zero `[data-diagram]` elements and no `pageerror`s;
  `?base=28&layout=pairGraph` renders 14 pair nodes; the `s` shortcut switches layout at base 28 while the `5`
  digit shortcut is a no-op; neither base 28 nor `base=10&layout=ring` ever emits `NaN`/`undefined` in the diagram's
  markup) and `e2e/hover-pin.spec.ts` (5 tests at base 28: hovering a zone changes its stroke-width and clicking it
  selects it with `selected=15` in the URL and a "Zone f" title; clicking a syzygy shows "Syzygy d::e"; clicking a
  current's hit-path shows its own name plus " Current"; clicking zone 5's gate shows the own-base gate name
  computed independently in the spec via `formatGateName(createNumogram(28).gate(5).cumulation, 28)`; toggling the
  Gates layer off removes every `[data-gate]`).
- **Verification, in order:** `npm run typecheck` (4x tsc + lint) clean after both tasks, on the first attempt each
  time; `npm run test:swap` (build + 60 goldens + behaviour baseline + 1537 unit tests) green after Task 1; the two
  new specs green (17/17) plus golden/behaviour (35/35) green after Task 2; `npm run verify` on the committed tree —
  `check:weight` was the only failure (expected, the engine layout/routing/pair-graph/tween/codec runtime now ships
  in the client bundle), confirmed `grep -rlE "jsHeapBytes|Ryzen" out/_next/static` printed nothing, raised the
  baseline with the plan's own written reason, then a clean `npm run verify` (122 e2e incl. 26 expected skips, 1537
  unit tests x2 timezones, `check-repo --clean-tree --static-out` OK).

## Task Commits

1. **Task 1: engine layouts, generic tween and pair graph in the viewer (UI-06)** - `35c7e29` (feat)
2. **Task 2: base from the URL codec, SVG-tier gate with big-base fallback (UI-02, D-14..D-18, MIG-02)** - `a26c810` (feat)
3. **Page-weight baseline update** (the plan's own instruction: raise it only if `check:weight` is the sole failure) - `44cd450` (chore)

## Files Created/Modified

- `app/NumogramClient.tsx` - engine-driven generator: base/labelScheme/tierOverride/baseRefusal state, layout
  target + generic tween, URL codec wiring, SVG-tier gate with `BigBaseSummary` fallback, MIG-02 cleanup
- `app/components/ui/CyberButton.tsx` - new `postBaseline` prop (`data-post-baseline`)
- `app/hooks/useOrbitalAnimation.ts` - `layout` param widened `Layout` -> `string`
- `app/hooks/useTween.ts` - deleted (superseded by `useLayoutTween`)
- `app/lib/shareTitle.ts` - `layout` widened to `ViewLayoutId`; new optional `base` field (prefixed first when != 10)
- `app/components/panels/RegionsPanel.tsx` - `hlRegion`/`onSelectRegion` prop types widened to `RegionId | null`
- `e2e/url-codec.spec.ts` - `?base=` round trip, legacy links, refusals, big-base fallback, pair graph, layout switch (new)
- `e2e/hover-pin.spec.ts` - UI-04 at base 28 for zone, syzygy, current and gate, plus a layer toggle (new)
- `perf/page-weight.baseline.json` - raised for this plan's growth (below)

## Decisions Made

See `key-decisions` in the frontmatter for the `postBaseline`/behaviour-baseline contract, the `shareTitle.ts` type
widening (Rule 3), the `RegionsPanel.tsx` type widening, and the requirements-completed scoping (UI-04 only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking type fix] `ShareTitleInput.layout` widened from `Layout` to `ViewLayoutId`**
- **Found during:** Task 1
- **Issue:** Once the generic layout switcher offers `ring`/`spiral`/`pairGraph` at base 10 (this plan's own change),
  the `layout` state's type is `ViewLayoutId`, a superset of the old four-literal `Layout` type `shareTitle.ts`
  declared for its `layout` field. The existing `onShareExplanation` call site (`buildNumogramTitle({ layout, ... })`)
  would no longer typecheck.
- **Fix:** Widened `ShareTitleInput.layout` to `ViewLayoutId` (imported from `./layoutIds`); no runtime behaviour
  change (the field is only interpolated into a string).
- **Files modified:** `app/lib/shareTitle.ts`
- **Commit:** `35c7e29`

**2. [Rule 1 - bug/robustness] `hlZones`'s region highlight guarded against a stale region id**
- **Found during:** Task 2
- **Issue:** The plan's own pseudocode for the region branch of `hlZones` was `new Set(zonesOfRegion(g, hlRegion))`
  with no guard; `zonesOfRegion` throws a `RangeError` for a region id that does not exist at the current base (for
  example `hlRegion === 'warp'` after loading a base with no Warp pair). Since `RegionsPanel.tsx` is not yet
  base-generic itself (its own torque/warp/plex rows are still the base-10-shaped hand list; 04-13 rewrites it), a
  user on a non-base-10, no-Warp session could still click "Warp" in the still-base-10-shaped Regions panel and
  crash the render.
- **Fix:** Added `isRegionId(hlRegion, g)` as a guard before calling `zonesOfRegion`, falling through to the
  existing selection/hover highlight logic otherwise. `parseShareParams` already validates `region=` against the
  parsed base at hydration time, so the guard is purely a defence against runtime panel clicks, not a URL-input gap.
- **Files modified:** `app/NumogramClient.tsx`
- **Commit:** `a26c810`

No other deviations — the rest of both tasks' `<action>` steps were followed as written.

## Page Weight

`check:weight` was the only failing step of `npm run verify` after Task 2 (as anticipated by the plan): `/numogram/`
grew from 598,261 to 635,299 bytes raw (+37,038, +6.2%) and from 180,068 to 192,433 bytes gzip (+12,365, +6.9%),
because the engine's layout/routing/pair-graph/tween/URL-codec runtime now ships in the client bundle for every
visitor (previously only the base-10 preset path did). Confirmed `grep -rlE "jsHeapBytes|Ryzen" out/_next/static`
printed nothing (the measurement rows in `engine/scene/tier-table.json` are not leaking into the bundle — only
`boundaries`/`tierOverrideParam` are read by `app/lib/tierBounds.ts`). Raised the baseline with
`node scripts/page-weight.mjs update --reason "04-11: the viewer now bundles the engine layouts, routing, pair
graph, tween and URL codec (Phase 4 engine-driven generator)"` (commit `44cd450`). Final `npm run verify` exit 0.

## Issues Encountered

None beyond the two auto-fixed deviations above and the expected page-weight growth.

## Known Stubs

- `PairGraphProjection`'s `pairStates` prop is passed `null` at both of this plan's call sites (`NumogramClient.tsx`
  wires the interactive pair graph, but not a region isolate/mute filter) — the prop's own type comment
  (`app/components/projection/PairGraphProjection.tsx`) already documents this as "04-13 fills it", matching
  `ShareState.isolate`/`ShareState.mute` both being hard-coded to `[]` in this plan's `currentShareState()` helper.
  Neither is a gap in this plan's own goal (switching the viewer to the engine): isolate/mute are a distinct UI-05
  requirement scoped to 04-13.
- `baseRefusal` state is set on a refused `?base=` but never rendered anywhere yet; 04-12 mounts the base picker
  that reads it (documented inline and in `key-decisions` above).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The viewer is fully engine-driven: any even base loads via `?base=`, renders through the SVG tier or degrades to
  the summary/text view above it, and `NumogramClient.tsx` has zero hard-coded 10-zone constructs left
  (`node scripts/check-repo.mjs --only base-ten` reports zero problems project-wide).
- `baseRefusal` state and the `packer`/`labelScheme`/`tierOverride` URL-driven state are all in place and unread by
  any UI control yet — 04-12 mounts `BasePicker.tsx`/`LabelSchemeControls.tsx` (already built in 04-06) directly
  against this state with no further plumbing needed in `NumogramClient.tsx`.
- `RegionsPanel.tsx`'s own torque/warp/plex body is still base-10-shaped (only its prop types were widened this
  plan); 04-13 rewrites it to read `regionRows(g)` and adds the isolate/mute controls, at which point
  `PairGraphProjection`'s `pairStates` prop stops being `null`.
- UI-04 is complete. UI-02 (needs the picker to show the refusal, 04-12), UI-06 (needs the zoom/fit toolbar and its
  own e2e spec, 04-15) and MIG-02 (needs the grep gate promoted to `DEFAULT_CHECKS`, 04-16) all stay Pending per the
  phase's established per-plan traceability, even though this plan's own code satisfies each of their functional
  descriptions already.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 8 touched paths (2 new e2e specs, 5 modified files, `perf/page-weight.baseline.json`) found on disk;
`app/hooks/useTween.ts` confirmed deleted (not just untracked); all three commits (`35c7e29`, `a26c810`, `44cd450`)
found in `git log`.
