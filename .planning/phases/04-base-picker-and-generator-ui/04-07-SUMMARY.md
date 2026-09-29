---
phase: 04-base-picker-and-generator-ui
plan: 07
subsystem: ui
tags: [react, typescript, vitest, svg, accessibility, clipboard]

# Dependency graph
requires:
  - phase: 04-02
    provides: app/lib/labelScheme.ts (formatZoneLabel, used by the xenotation label test)
  - phase: 04-03
    provides: app/lib/numogramView.ts (summarize, NumogramSummary, zoneColorFor, NumogramView, SUMMARY_TORQUE_LIMIT)
provides:
  - app/lib/numogramText.ts (numogramText, bigBaseMessage, TEXT_VIEW_ZONE_LIMIT) - bounded plain-text numogram description
  - app/components/numogram/TextView.tsx - read-only monospace block with a "Copy numogram text" / "Copied" button
  - app/components/numogram/BigBaseSummary.tsx - big-base fallback (refusal message + summary card + TextView), no show-anyway control
  - app/components/projection/PairGraphProjection.tsx - interactive syzygy-collapsed pair-graph renderer with hover/pin/toggle
affects: [04-11, 04-13, 04-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded text generation: numogramText only builds per-zone/per-pair listings when base <= TEXT_VIEW_ZONE_LIMIT (1024); above it, only the header block plus at most 12 Torque lengths (via the existing summarize()) are produced"
    - "Standalone presentation components built ahead of their mount point (04-11 wires TextView/BigBaseSummary/PairGraphProjection into the live viewer) - all four artifacts are new files with no existing call sites yet"

key-files:
  created:
    - app/lib/numogramText.ts
    - app/components/numogram/TextView.tsx
    - app/components/numogram/BigBaseSummary.tsx
    - app/components/projection/PairGraphProjection.tsx
    - tests/app/numogramText.test.ts
  modified: []

key-decisions:
  - "numogramText's per-region/per-pair loops iterate in engine-native order (ascending pair id 0..P-1 for syzygies/currents, g.torques canonical order for regions), not the descending order app/lib/numogramView.ts's buildStructuralSyzygies uses elsewhere - the plan's <behavior> examples pin this explicitly (e.g. the base-28 Torque A/B line order, the base-10 '8::1' syzygy line found by toContain not position)"
  - "BigBaseSummary's Torque-cycles metric value joins torqueLengths with a bare comma ('[9,3]', no space) per the plan's literal '[9,3] style' example, while the text view's own header line still uses summarize()'s ', ' join - two different presentations of the same truncated list, both reading svgRichMaxN/the cutoff from a prop, never a literal (T-04-24 grep criterion enforced: no literal 200 in BigBaseSummary.tsx)"

patterns-established:
  - "Pattern: any UI-07 text output uses the same zoneLabel(zone) callback the diagram uses (never a raw decimal integer) - numogramText takes zoneLabel as a parameter rather than assuming formatNumeral, verified with a dedicated xenotation-label test"

requirements-completed: []  # UI-07 and UI-02 each span multiple plans (04-05/04-07/04-11/04-12 for UI-02; 04-07/04-08/04-14/04-15 for UI-07); neither is the final covering plan here, per this phase's established per-plan-requirements precedent (04-01..04-06)

# Metrics
duration: 13min
completed: 2026-09-29
---

# Phase 4 Plan 07: Text View, Big-Base Fallback and Interactive Pair-Graph Summary

**Bounded plain-text numogram description (1024-zone cap), its read-only copy-to-clipboard view, the big-base degradation fallback card, and an interactive syzygy-collapsed pair-graph SVG renderer — four new standalone files, none mounted into the viewer yet.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-29T02:10:24Z (previous plan's completion commit)
- **Completed:** 2026-09-29T02:23:29Z
- **Tasks:** 2 completed
- **Files modified:** 5 (4 created + 1 test file created)

## Accomplishments

- `app/lib/numogramText.ts`: `numogramText(g, zoneLabel, opts?)` produces a full plain-text description (header, per-region zone walks, per-pair syzygy/current lines, per-zone gate lines) for any base up to `TEXT_VIEW_ZONE_LIMIT` (1024), and only the header block (plus at most 12 truncated Torque lengths) above it — proven to stay under 4000 characters at base 4096 while base 1024 still produces its full 1024 gate lines
- `TextView.tsx`: reusable read-only monospace block with the UI-SPEC's exact "Copy numogram text" primary CTA, swapping to "Copied" for 1.5s, reusing the header share button's color/border/background pattern and failure-swallowing clipboard try/catch
- `BigBaseSummary.tsx`: the D-14..D-18 big-base fallback - factual refusal message (cutoff arrives as a prop, never hard-coded), a four-metric summary card, and the text view together, with no "show anyway" control
- `PairGraphProjection.tsx`: interactive pair-graph SVG mirroring `engine/scene/svgString.ts`'s `pairGraphToSvg` pill/arc/loop geometry, adding hover/pin/click-to-toggle per pair and a `pairStates` visibility/dim channel for the future region-legend wiring (04-13)

## Task Commits

1. **Task 1: numogramText.ts, TextView.tsx and BigBaseSummary.tsx** - `08b8d9e` (feat, TDD: test file + implementation in one commit after red→green)
2. **Task 2: PairGraphProjection.tsx** - `34e5cd0` (feat)

**Plan metadata:** (this commit) - docs: complete plan

_Note: Task 1 was TDD (`tdd="true"`); the RED phase (14 failing/erroring assertions against a missing module) was run and confirmed before writing `app/lib/numogramText.ts`, then re-run to green (14/14) before committing test and implementation together._

## Files Created/Modified

- `app/lib/numogramText.ts` - `numogramText`, `bigBaseMessage`, `TEXT_VIEW_ZONE_LIMIT` (1024); bounded per T-04-21
- `app/components/numogram/TextView.tsx` - read-only `<pre>` block + copy button, `data-post-baseline` root, no `<header>`
- `app/components/numogram/BigBaseSummary.tsx` - refusal message + summary card + `TextView`, `data-post-baseline` root
- `app/components/projection/PairGraphProjection.tsx` - `'use client'`, `React.memo`, `data-diagram="pairs"` svg root, `data-pair={q}` per pill
- `tests/app/numogramText.test.ts` - 14 tests across bases 10, 16, 28, 1024, 4096, plus xeno labels and `bigBaseMessage`

## Decisions Made

- Iteration order in `numogramText`'s syzygy/current and gate loops follows the engine's own ascending id/zone order (pair id `0..P-1`, zone `0..zoneCount-1`), matching the plan's literal `<behavior>` examples rather than the descending order used elsewhere in `app/lib/numogramView.ts`'s structural-view builders (those are a different consumer with a different presentation need - view order for the diagram, vs. a linear readable listing here).
- `BigBaseSummary`'s Torque-cycles metric renders truncated lengths as `[9,3]` (comma, no space) per the plan's literal example text, distinct from the text view's own `summarize()`-driven `, ` join used inside the header line of `numogramText` - both still read the truncation threshold (`SUMMARY_TORQUE_LIMIT` = 12) from the same `summarize()` call, no duplicated logic.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep checks and `npm run typecheck`) passed without needing a Rule 1/2/3 fix.

## Issues Encountered

- Initial draft of a manual verification script used `console.log` inside a scratch Vitest test to inspect base-4096's `torqueCount`/`torqueLengths`/demon counts before writing the final test file; Vitest's default reporter didn't surface the console output, so the scratch test was switched to writing a JSON file instead, read, and then both the scratch test and its output file were deleted before the real test file was written. No trace of this remains in the working tree (confirmed via `git status`).
- One test-authoring bug (`split(':')[2]` instead of `[1]` when isolating a Torque-cycle line's zone-walk substring) was caught immediately by the RED→GREEN run and fixed before the commit; not a deviation from the plan, just a test typo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four artifacts (`numogramText`, `TextView`, `BigBaseSummary`, `PairGraphProjection`) are ready for 04-11 to mount into the engine-driven viewer (the big-base tier gate and the pair-graph view toggle) and for 04-13/04-14 to wire in region-legend `pairStates` and ARIA respectively.
- No blockers. `npm run typecheck` (4x tsc + lint) and the full unit suite (56 files, 1477 tests) both pass unchanged; this was a unit-only wave-2 plan with no build/Playwright step required or run.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 5 created files found on disk; both task commits (`08b8d9e`, `34e5cd0`) found in git history.
