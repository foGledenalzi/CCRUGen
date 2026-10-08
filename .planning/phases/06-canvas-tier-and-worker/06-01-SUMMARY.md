---
phase: 06-canvas-tier-and-worker
plan: 01
subsystem: engine
tags: [tier-table, selectTier, validator, spike-shaper, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: the measured tier table (engine/scene/tier-table.json, budgets.canvasTargetN 4000), selectTier/validateTierTable/deriveBoundaries and scripts/spike/shape.ts
  - phase: 04-base-picker-and-generator-ui
    provides: app/lib/tierBounds.ts, the app's only reader of the table (property access on boundaries only)
provides:
  - boundaries.interactiveMaxN (n 4000, basedOn sw-6x) in tier-table.json, the shipped interactive ceiling as data (D-01)
  - interactiveCeiling(table) = min(canvasMaxN, interactiveMaxN), exported from the engine barrel
  - selectTier returning svg up to svgRichMaxN, canvas from svgRichMaxN + 2 up to the ceiling, headless above (no lean tier, D-03)
  - validateTierTable rules for interactiveMaxN, one per invariant, each killed by its own mutant
  - spike shaper that carries interactiveMaxN forward (clamped, never raised, never dropped)
  - INTERACTIVE_MAX_N, LABEL_MIN_RADIUS_PX, CANVAS_AREA_LIMIT_PX in app/lib/tierBounds.ts
affects: [06-02, 06-04, 06-06, 06-07, 06-09, 06-11, 06-12, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shipped decision as data: a ceiling that is a choice, not a derivation, lives in its own boundary field next to the derived ones, is optional in the type (synthetic test tables keep their meaning) and required by the validator for a measured table"
    - "Carry-forward clamp in the shaper: a decision field is copied from the previous table and clamped to what the new run measured, so a re-measure can lower it but never raise or drop it"

key-files:
  created: []
  modified:
    - engine/scene/tiers.ts
    - engine/scene/index.ts
    - engine/scene/tier-table.json
    - scripts/spike/shape.ts
    - app/lib/tierBounds.ts
    - engine/test/tiers.select.test.ts
    - engine/test/tiers.schema.test.ts
    - tests/spike/shape.test.ts
    - tests/app/tierBounds.test.ts

key-decisions:
  - "PATTERNS hazard 1 resolved by clamping in the shaper and keeping the validator strict: interactiveMaxN = min(previous ?? maxMeasuredN, maxMeasuredN, canvasMaxN ?? Infinity). The synthetic shape run (canvas rows only to n = 100) yields 100, the real table keeps 4000, a run whose rows all pass beyond 4000 still yields 4000 (a re-measure never raises the ceiling by itself)"
  - "interactiveMaxN is optional in TierBoundaries and required (validator rule) only for status 'measured', so the existing synthetic makeTable() fixtures and the old selectTier(10**6) = canvas case keep their meaning"
  - "The real-table selectTier assertions (200/202/ceiling/ceiling + 2/2^26, no lean tier) live in tiers.schema.test.ts, which already owns TIER_TABLE; tiers.select.test.ts stays synthetic-only as its header promises"
  - "INTERACTIVE_RULE is exported from shape.ts and a test pins it equal to the JSON rule string, so the fallback wording cannot drift from the table"

patterns-established:
  - "One validator `if` per invariant with its own specific message and its own brokenCopy mutant (T-06-07)"

requirements-completed: []  # REN-02 and REN-03 stay Pending: this plan ships only the ceiling datum and its selection rule; the Canvas tier, worker and over-limit message land in later Phase 6 plans

# Metrics
duration: 13min
completed: 2026-10-08
---

# Phase 6 Plan 01: Shipped Interactive Ceiling as Data Summary

**boundaries.interactiveMaxN = 4000 in the tier table drives selectTier (svg, canvas to the ceiling, headless above), is policed by six validator rules with one mutant each, survives a spike re-measure through a clamped carry-forward, and is read by the app as INTERACTIVE_MAX_N with no literal anywhere.**

## Performance

- **Duration:** ~13 min (including a 4.5 min full gate)
- **Started:** 2026-10-08T17:25:00Z
- **Completed:** 2026-10-08T17:38:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 9 (0 created)

## Accomplishments

- The shipped ceiling is data: `boundaries.interactiveMaxN { n: 4000, basedOn: "sw-6x", rule }` is the only change to `tier-table.json` (5 lines added, 0 removed; the 144 measurement rows, derived boundaries, `canvasMaxN: null` and `webglDecision` are byte-identical, file still LF-only with a final newline and parses equal to `TIER_TABLE`).
- `interactiveCeiling(table)` returns `min(canvasMaxN?.n ?? Infinity, interactiveMaxN?.n ?? Infinity)` and `selectTier` uses it: 200 is svg, 202 and the ceiling are canvas, ceiling + 2 and 2^26 are headless, an explicit override still wins, no lean tier is ever returned (D-03). `canvasMaxN: null` with no `interactiveMaxN` keeps today's meaning, so the old synthetic cases stay green unchanged.
- `validateTierTable` gained one rule per invariant: field missing from a measured table, `basedOn` not the shipped profile, `n` not a non-negative integer, empty `rule`, below `svgRichMaxN`, above the largest measured canvas n, above a non-null `canvasMaxN`. Each has its own `brokenCopy` mutant asserting its own message.
- `scripts/spike/shape.ts` carries the field through a re-measure (clamped to what the run measured, never raised, never dropped); a previous table without the field falls back to the largest measured n and the exported `INTERACTIVE_RULE` wording.
- `app/lib/tierBounds.ts` exports `INTERACTIVE_MAX_N = interactiveCeiling(TIER_VIEW)`, `LABEL_MIN_RADIUS_PX` and `CANVAS_AREA_LIMIT_PX` by property access on boundaries (still only `.boundaries` and `.tierOverrideParam` are read from the JSON). No `4000` appears in `app/lib/tierBounds.ts` or `tests/app/tierBounds.test.ts`, and a test with an injected table proves the ceiling follows the data (T-06-01a).

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer):

1. **Task 1: interactiveMaxN in the schema, the table, selectTier and the validator**
   - `8c6db27` test(06-01): add failing tests for the shipped interactive ceiling
   - `c0da2a9` feat(06-01): ship the interactive ceiling as data and select tiers by it
2. **Task 2: Carry the field through the spike shaper and expose it to the app**
   - `973ddda` test(06-01): add failing tests for shaper carry-forward and the app ceiling reader
   - `10128b9` feat(06-01): carry the interactive ceiling through the shaper and expose it to the app

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`interactiveCeiling is not a function`, missing exports, and, for the shaper, the validator flagging the missing field in a shaped table: the PATTERNS hazard made concrete) before their GREEN commits._

## Files Created/Modified

- `engine/scene/tiers.ts` - `TierBoundaries.interactiveMaxN?`, `interactiveCeiling()`, `selectTier` rewritten on it, validator rules
- `engine/scene/index.ts` - barrel export of `interactiveCeiling` (reaches the app and tests through `engine/index.ts`'s `export *`)
- `engine/scene/tier-table.json` - the one new boundary (5 lines)
- `scripts/spike/shape.ts` - `INTERACTIVE_RULE`, clamped carry-forward into `boundaries`
- `app/lib/tierBounds.ts` - `INTERACTIVE_MAX_N`, `LABEL_MIN_RADIUS_PX`, `CANVAS_AREA_LIMIT_PX`
- `engine/test/tiers.select.test.ts` - selectTier and interactiveCeiling cases on synthetic tables
- `engine/test/tiers.schema.test.ts` - real-table assertions plus seven mutants (six rules and the empty-rule check)
- `tests/spike/shape.test.ts` - four shaper behaviours plus the rule-text pin
- `tests/app/tierBounds.test.ts` - ceiling, label and area constants read from the table, `tierFor` at the boundaries, override cases

## Decisions Made

See `key-decisions` above. In short: clamp in the shaper and keep the validator strict (the PATTERNS hazard-1 choice the plan pre-decided as the default); optional in the type, required for measured tables; real-table selection assertions in the schema test; the rule text exported and pinned to the JSON.

## Deviations from Plan

None - plan executed exactly as written. The only judgement call was placement, not scope: the plan's `<behavior>` lists real-table `selectTier` assertions without naming a file, and I put them in `tiers.schema.test.ts` (which already imports `TIER_TABLE`) so `tiers.select.test.ts` keeps its stated contract of using synthetic tables only. I also added two small tests beyond the listed behaviours (empty `rule` mutant, and an assertion that `interactiveMaxN.n` equals `budgets.canvasTargetN` and `canvasMaxN` stays null).

## Issues Encountered

None.

## Verification

- `npx vitest run engine/test/tiers.select.test.ts engine/test/tiers.schema.test.ts --project engine`: 51 passed (16 failed before the implementation).
- `npx vitest run tests/spike/shape.test.ts tests/app/tierBounds.test.ts --project oracle`: 40 passed (10 failed before the implementation).
- `npm test` (UTC) and `npm run test:tz` (America/New_York): 72 files, 1749 tests passed in both.
- `npm run typecheck` (4x tsc plus lint): exit 0. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK. Acceptance greps: `git diff --numstat` for the JSON was `5 0`; `interactiveMaxN.n === budgets.canvasTargetN`, `canvasMaxN === null`, 144 rows; no `4000` in `app/lib/tierBounds.ts` or `tests/app/tierBounds.test.ts`; `tierTableJson.` appears twice in `tierBounds.ts`.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing (no frozen file touched).
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 1749 unit tests in both timezones, sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out. Tier selection is only consumed as `tierFor(...) === 'svg'` in `NumogramClient.tsx`, so the canvas-versus-headless distinction has no behavioural effect on the viewer yet.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or trust-boundary schema change beyond the planned `interactiveMaxN` field, which the plan's threat register (T-06-07, T-06-01a, T-06-07b) already covers and this plan mitigates with the validator rules, the data-driven ceiling test and the clamped carry-forward.

## Next Phase Readiness

- Later plans read the ceiling through `INTERACTIVE_MAX_N` (app) or `interactiveCeiling(table)` (engine and worker); none needs a literal. The worker scene guard (06-04), the over-limit message (06-04, 06-11) and the tier branch (06-06, 06-11) can build on `tierFor` returning `'canvas'` for 202 up to the ceiling and `'headless'` above it.
- `NumogramClient.tsx` still treats everything that is not svg as "no diagram"; the canvas branch arrives in 06-11.
- `LABEL_MIN_RADIUS_PX` and `CANVAS_AREA_LIMIT_PX` are ready for the Canvas draw and view-transform modules (06-05, 06-08).

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*
