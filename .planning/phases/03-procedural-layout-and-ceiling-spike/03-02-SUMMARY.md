---
phase: 03-procedural-layout-and-ceiling-spike
plan: 02
subsystem: infra
tags: [renderer-tiers, threshold-table, schema-validation, ceiling-spike, engine]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike (plan 01)
    provides: engine/layout contracts and ringLayout (not consumed here, but the sibling module this plan's data feeds)
provides:
  - engine/scene/tiers.ts (TierTable schema, selectTier, parseTierOverride, tweenAllowed, labelsVisible, gateLayerMode, deriveBoundaries, validateTierTable)
  - engine/scene/tier-table.json (interim placeholder threshold table from the four-profile research spike)
  - engine/scene/tierTable.ts (typed TIER_TABLE loader)
affects: [03-09 (renderer tiers consume selectTier/tweenAllowed/labelsVisible/gateLayerMode), 03-10 (ceiling spike replaces tier-table.json with status 'measured' and re-derives boundaries), Phase 4/5/6 (renderer generalization reads this table)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Threshold table as frozen JSON data + typed loader (engine/scene/tierTable.ts), never constants in components"
    - "'Longest passing prefix' derivation: sort rows by n, walk in order, stop at first budget failure"
    - "validateBase idiom extended to a second validator (validateTierTable): one if per rule, one specific message per rule, never a generic 'invalid'"

key-files:
  created:
    - engine/scene/tiers.ts
    - engine/scene/tier-table.json
    - engine/scene/tierTable.ts
    - engine/test/tiers.select.test.ts
    - engine/test/tiers.schema.test.ts
  modified: []

key-decisions:
  - "Shipped tier boundaries (svgRichMaxN, svgLeanMaxN, layoutTweenMaxN) are basedOn sw-6x (the conservative CPU-throttled/software-raster profile), never the native gpu row, per D-14d; validateTierTable enforces this for every table."
  - "canvasMaxN and layoutTweenMaxN are explicit research placeholders in the interim table (canvasMaxN null, layoutTweenMaxN a stated placeholder rule); only svgRichMaxN, svgLeanMaxN, allChordsMaxN and canvasAreaLimitPx are required to equal deriveBoundaries() over the interim table's own rows. The 'boundary equals deriveBoundaries' invariant is enforced by the validator only when status === 'measured' (plan 03-10)."
  - "webglDecision.adopt is false with a reasoned, dated explanation from the research measurements (D-12); tierOverrideParam is enabled for name 'tier' with values svg/canvas/headless (D-13)."

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-09-27
---

# Phase 3 Plan 02: Renderer Threshold Table (REN-01) Summary

**Pure TierTable schema, selection/derivation helpers and a schema-only validator (engine/scene/tiers.ts), plus the interim four-profile research table (engine/scene/tier-table.json) and its typed loader — so later plans read render-tier thresholds from data, never hard-coded constants.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-27T19:44:42Z
- **Completed:** 2026-09-27T19:49:40Z
- **Tasks:** 2 (each executed as a RED/GREEN TDD cycle, 4 commits total)
- **Files modified:** 5 (all created, none modified)

## Accomplishments
- `engine/scene/tiers.ts`: the full `TierTable` schema (environments, measurements, chords, canvas probes, headless rows, memory model, boundaries, WebGL decision, tier-override param) plus pure helpers `selectTier`, `parseTierOverride`, `tweenAllowed`, `labelsVisible`, `gateLayerMode`
- `deriveBoundaries`: the "longest passing prefix" derivation for svg-rich, svg-lean and canvas suites against budgets, the tween boundary across the svg-rich/canvas split point, the chord legibility cutoff, and the canvas area limit from probes
- `validateTierTable`: ~35 schema/invariant rules (never a timing assertion), including the D-14d conservative-shippedProfile check and the status-`measured`-only equality check against `deriveBoundaries`
- `engine/scene/tier-table.json`: the interim placeholder table transcribed from the 03-RESEARCH.md four-profile spike (183 real rows condensed to the 22 sw-6x rows plus gpu/sw/sw-4x/sw-6x environment metadata, 9 chord rows, 9 canvas probes, 4 headless rows), `status: "placeholder"`, `shippedProfile: "sw-6x"`
- `engine/scene/tierTable.ts`: typed `TIER_TABLE` loader (`as unknown as TierTable`, per the plan's documented fallback for JSON-module literal-type narrowing)

## Task Commits

Each task was executed as a full TDD RED/GREEN cycle:

1. **Task 1: Tier-table schema, selection helpers, boundary derivation and validator**
   - `c44c6f2` (test) - add failing test for tier-table selection helpers (RED: module `../scene/tiers` did not exist)
   - `6a2b214` (feat) - tier-table schema, selection helpers, boundary derivation and validator (GREEN: 18/18 tests pass)
2. **Task 2: Interim threshold table (research placeholders) and its typed loader**
   - `c308f71` (test) - add failing test for the interim tier table and its loader (RED: `../scene/tierTable` did not exist)
   - `e66aa3e` (feat) - tier table schema, validator and interim research table (GREEN: 33/33 tests pass)

**Plan metadata:** (this commit) - docs: complete 03-02 plan

## Files Created/Modified
- `engine/scene/tiers.ts` - TierTable schema, selectTier/parseTierOverride/tweenAllowed/labelsVisible/gateLayerMode, deriveBoundaries, validateTierTable (454 lines, no imports, no DOM/Node types, no Math.random/Date)
- `engine/scene/tier-table.json` - interim placeholder threshold table (LF-only, trailing newline, 22 sw-6x measurement rows)
- `engine/scene/tierTable.ts` - typed `TIER_TABLE` export over the JSON
- `engine/test/tiers.select.test.ts` - 18 tests against synthetic TierTable objects (a local factory), covering every `<behavior>` bullet of Task 1
- `engine/test/tiers.schema.test.ts` - 15 tests against the real `TIER_TABLE`: validity, conservative boundary source, D-12/D-13 decisions, derived-boundary equalities, LF/newline convention, and 9 `structuredClone` mutation cases exercising `validateTierTable`'s rules directly

## Decisions Made
- Followed the plan's exact schema, helper signatures and validator message prefixes verbatim (all copied from the plan's `<action>` blocks); no schema deviations.
- Used `as unknown as TierTable` (not a direct `as TierTable`) for the JSON loader assertion, since the plan explicitly permits this fallback and it avoids an unnecessary iteration against TypeScript's literal-type overlap check on an imported JSON module.
- Verified by hand-computation (documented in the validator's own passing test) that the transcribed interim data reproduces `deriveBoundaries()` exactly for svgRichMaxN (100), svgLeanMaxN (1000), allChordsMaxN (60) and canvasAreaLimitPx (268435456) — matching the plan's stated expectations — while `canvasMaxN` (null, a deliberate placeholder) and `layoutTweenMaxN` (500, a stated placeholder rule) are correctly excluded from that equality per the plan's own acceptance text.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; no architectural questions arose.

## Issues Encountered

None. Both tasks passed on the first GREEN attempt (all acceptance-criteria greps, unit tests in both timezones, and the four-config `npm run typecheck` passed without iteration).

## User Setup Required

None - no external service configuration required.

## Self-Check

- [x] `engine/scene/tiers.ts` exists
- [x] `engine/scene/tier-table.json` exists
- [x] `engine/scene/tierTable.ts` exists
- [x] `engine/test/tiers.select.test.ts` exists
- [x] `engine/test/tiers.schema.test.ts` exists
- [x] Commit `c44c6f2` exists (test, RED, Task 1)
- [x] Commit `6a2b214` exists (feat, GREEN, Task 1)
- [x] Commit `c308f71` exists (test, RED, Task 2)
- [x] Commit `e66aa3e` exists (feat, GREEN, Task 2)

## Next Phase Readiness

`engine/scene/tiers.ts` and `TIER_TABLE` are ready for plan 03-09 (renderer tiers, which will call `selectTier`/`tweenAllowed`/`labelsVisible`/`gateLayerMode`) and plan 03-10 (the ceiling spike, which replaces `tier-table.json` with `status: "measured"` real four-profile rows and must satisfy the validator's stricter measured-table checks, including the `deriveBoundaries` equality on every boundary). No blockers. REN-01 remains "in progress" in REQUIREMENTS.md — it is also covered by plans 03-09 and 03-10, which have not yet executed.

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 5 created files found on disk; all 4 task commits (`c44c6f2`, `6a2b214`, `c308f71`, `e66aa3e`) found in git log.
