---
phase: 04-base-picker-and-generator-ui
plan: 05
subsystem: ui
tags: [url-codec, share-links, base-picker, region-legend, labels, packer, tier-override]

# Dependency graph
requires:
  - phase: 04-base-picker-and-generator-ui
    provides: "04-02's LabelScheme/parseLabelScheme/formatLabelScheme; 04-03's RegionId/parseRegionId, ViewLayoutId/isLayoutIdFor/defaultLayoutFor, tierOverrideFrom"
  - phase: 02-engine-core-and-base-10-migration
    provides: validateBase/BaseCheck, createNumogram (cached)
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: PACKERS/DEFAULT_LAYOUT_PARAMS.packer, RenderTier
provides:
  - "app/lib/shareParams.ts — ShareState, defaultShareState, parseShareParams (strict base, lenient every other field), buildShareParams (canonical, omit-at-default, localeCompare-sorted keys), replacing the dead canonicalizeShareParams"
  - "tests/app/shareParams.test.ts — 51 tests: hostile-input coverage for every field, a 40-URL legacy corpus read from the frozen e2e/__behaviour__ baseline (byte-for-byte round trip), the e2e/golden.spec.ts STATES+PIN combinations, and a fast-check property round trip over bases 2/10/12/28/64"
affects: [04-11 (NumogramClient.tsx switches to this codec), 04-06 (base picker's refusal UI reads BaseRefusal), 04-13 (RegionsPanel reads/writes isolate=/mute=)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "base is the one strict/user-visible field (D-06): digits-only regex + 16-char cap before Number(), then engine validateBase; every other field fails silently to its default (lenient-per-field) so a hand-edited or stale URL always loads a valid ShareState, never throws."
    - "region/isolate/mute build a Numogram lazily (createNumogram is cached) only when one of the three params is present, so a URL with none of them never pays for cycle materialization."
    - "buildShareParams extends the existing 'omit at default' convention (base=10, layout=original) uniformly to labels/isolate/mute/packer/tier, and always sorts keys with localeCompare — the exact sort NumogramClient.tsx's own sortSearchParams already uses, so this codec is a drop-in replacement in 04-11."

key-files:
  created:
    - app/lib/shareParams.ts
    - tests/app/shareParams.test.ts
  modified: []

key-decisions:
  - "Fixed a plan-authored test example: the plan's odd/too-large refusal example used '?base=99999999999', which is odd (11 digits ending in 9) and so refuses as 'odd' before the too-large check ever runs (validateBase checks oddness before size). Used '?base=99999999998' (even, same digit count, still over the 2^26 ceiling) to actually exercise the 'too-large' reason. [Rule 1 - test bug]"
  - "requirements-completed left empty in this summary's frontmatter: UI-02's final covering plan is 04-12, UI-03's is 04-12, UI-05's is 04-13 (per this phase's existing per-plan requirements frontmatter across 04-01..04-16) — mirrors the same choice already made in 04-01..04-04's summaries for MIG-02/UI-01/UI-03/UI-05."

patterns-established:
  - "URL codec module shape: defaultShareState(base) + parseShareParams(input): ParsedShare + buildShareParams(state, opts): URLSearchParams, with ParsedShare separating the always-valid ShareState from an optional BaseRefusal record — no exceptions cross this module's boundary."

requirements-completed: []

# Metrics
duration: 16min
completed: 2026-09-29
---

# Phase 4 Plan 05: Unified URL Codec (parse + build) Summary

**Rewrote the dead `app/lib/shareParams.ts` into the viewer's single URL codec: strict `base=` refusal (D-06), lenient per-field parsing of every other param (layout, layers, selected, region, isolate, mute, labels, tc, particles, orbits, date, packer, tier), and canonical building proven byte-identical against 40 URLs from the frozen behaviour baseline plus a fast-check round trip across bases 2/10/12/28/64.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-29T01:35:00Z
- **Completed:** 2026-09-29T01:51:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created net-new content replacing a dead file, 1 new test file)

## Accomplishments
- `parseShareParams` never throws on any input: a refused `base=` (odd, zero, too-large, malformed/non-decimal) yields a `BaseRefusal` record and falls back to base 10; every other field is validated independently and falls back to its own default rather than rejecting the whole URL.
- `buildShareParams` is the canonical, deterministic build side: every field omitted at its default (extending the existing base-10/layout=original convention to the five new fields this plan adds), keys always sorted with `localeCompare` to match `NumogramClient.tsx`'s existing `sortSearchParams`.
- Proved backward compatibility the hard way: all 40 URLs recorded under `*url*`-named behaviours in the four frozen `e2e/__behaviour__/*.json` baselines (original/labyrinth/ladder/planetary) round-trip through `parse` then `build` byte for byte, plus the recorded share-clipboard URL with `includeLayoutAlways`.
- A fast-check property (`numRuns: 50` per base, seeded) proves `parse(build(s)).state` round-trips arbitrary Phase 4 states — including multi-Torque `region`/`isolate`/`mute` ids, every label scheme mode except custom, both packers, and all four tier-override values — at bases 2, 10, 12, 28 and 64.
- `isolate=`/`mute=` and `labels=`/`packer=`/`tier=` are new, tested URL surface (D-13, D-21, todo 005); the legacy singular `region=`/`tc=1` keep their old base-10 meaning untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: parseShareParams (strict base, lenient fields) with hostile-input tests** - `cc022eb` (feat)
2. **Task 2: buildShareParams with the frozen-baseline legacy corpus and a fast-check round trip** - `60849b4` (feat)

_Both tasks followed the plan's explicit single-commit-per-task instruction (tests-first internally verified RED before each implementation, but the plan calls for one `feat` commit per task, not a separate RED commit)._

## Files Created/Modified
- `app/lib/shareParams.ts` - Rewritten entirely: `ShareState`/`BaseRefusal`/`ParsedShare` types, `defaultShareState`, `parseShareParams`, `buildShareParams`, `DEFAULT_LAYERS`, `BASE_PARAM_MAX_LENGTH`. The dead `canonicalizeShareParams` (no importers, confirmed via `grep -rn canonicalizeShareParams app tests scripts` before deletion) is gone.
- `tests/app/shareParams.test.ts` - 51 tests across five `describe` blocks: `parseShareParams` (28 hostile-input/behavior tests), `buildShareParams` (canonical-building unit tests), `legacy corpus` (40-URL frozen-baseline round trip + clipboard URL), `golden states` (10 `e2e/golden.spec.ts` STATES+PIN combinations), `round trip` (fast-check property, 5 bases).

## Decisions Made
- Fixed the plan's own `'?base=99999999999'` "too-large" example (it's actually odd, so it refuses as `'odd'` first per `validateBase`'s check order) — swapped to an even 11-digit value so the test genuinely exercises the `'too-large'` path. [Rule 1]
- Left `requirements-completed: []` in this summary: UI-02/UI-03/UI-05 each have a later plan in this phase as their final covering plan (04-12, 04-12, 04-13 respectively, per every plan's own `requirements:` frontmatter across 04-01..04-16) — REQUIREMENTS.md checkboxes stay Pending, matching the precedent already set by 04-01 (MIG-02), 04-02 (UI-03), 04-03 (UI-01/UI-05/MIG-02) and 04-04 (MIG-02).
- Property round trip deliberately holds `layers` fixed at `DEFAULT_LAYERS` rather than generating it arbitrarily: `buildShareParams` always emits `layers=` pre-sorted alphabetically, so an arbitrary (unsorted) input order would need its own normalization step to compare against the parsed (sorted) output; `layers` parsing/building is already covered directly by Task 1/Task 2 unit tests, so the property test's added value is concentrated on the base-dependent fields (layout, selected, region/isolate/mute, labels, packer, tier) the plan's own behavior spec calls out.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a literal `canonicalizeShareParams` mention from the header comment**
- **Found during:** Task 1 acceptance check
- **Issue:** The plan's suggested header comment text said "Replaces the dead canonicalizeShareParams of the removed share-image route," which would itself make `grep -rn "canonicalizeShareParams" app tests scripts` find a match (the comment), failing that exact acceptance criterion.
- **Fix:** Reworded the header comment to describe the same fact ("Replaces the dead URL canonicalizer that used to back the removed share-image route") without using the literal old function name.
- **Files modified:** app/lib/shareParams.ts
- **Verification:** `grep -rn "canonicalizeShareParams" app tests scripts` exits 1 (no matches)
- **Committed in:** cc022eb (Task 1 commit)

**2. [Rule 1 - Bug] Fixed the plan's own odd/too-large test example**
- **Found during:** Task 1, first green run
- **Issue:** `'?base=99999999999'` (used in the plan's `<behavior>` as a `'too-large'` example) is odd, so `validateBase` reports `'odd'` before it ever reaches the size check — the test failed with `expected 'odd' to be 'too-large'`.
- **Fix:** Changed the test's example value to `'99999999998'` (even, same digit count, still far past 2^26), which genuinely exercises the `'too-large'` branch.
- **Files modified:** tests/app/shareParams.test.ts
- **Verification:** test passes; `validateBase`'s own check order (odd before too-large) is unchanged and untouched by this plan.
- **Committed in:** cc022eb (Task 1 commit)

**3. [Rule 1 - Bug] Avoided a literal bidi-override character in the test source**
- **Found during:** Task 1, authoring the hostile-input test
- **Issue:** Typing the U+202E escape sequence in a test string gets written to disk as the actual raw U+202E (RIGHT-TO-LEFT OVERRIDE) character by the file-write tooling (a known gotcha for this repo, per the Phase 2 P07 lore-swap note in STATE.md) — embedding a literal bidi-override character in tracked source is exactly the kind of "Trojan Source" pattern security scanners flag.
- **Fix:** Used `String.fromCodePoint(0x202e)` instead, so the source file itself contains only ASCII.
- **Files modified:** tests/app/shareParams.test.ts
- **Verification:** test still exercises the same hostile input (a labels= custom alphabet full of bidi-override characters) and passes; `git diff` shows no non-ASCII bytes introduced.
- **Committed in:** cc022eb (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — plan/test-authoring bugs caught during implementation, no architectural changes, no scope creep).
**Impact on plan:** None of the three change what the codec does; all three are test/comment correctness fixes needed to make the plan's own stated acceptance criteria actually pass.

## Issues Encountered
None beyond the three auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The codec (`parseShareParams`/`buildShareParams`/`defaultShareState`) is ready for 04-11 to wire into `NumogramClient.tsx` in place of its inline `buildShareParams`/URL-hydration `useEffect` (lines ~186-213 and ~459-532), and for 04-06's base picker to read `ParsedShare.baseRefusal` for the inline refusal message (D-06).
- `isolate=`/`mute=` are ready for 04-13's Region Legend Contract; `labels=` is ready for 04-02's label-scheme UI to round-trip through the URL; `packer=` closes out part of todo 005 (the base picker/procedural-layout UI in 04-06 still needs to expose the actual toggle).
- No blockers. `npm run typecheck` and the full unit suite (`npx cross-env CCRUG_TZ=UTC vitest run`, 54 files / 1437 tests) are green; `tests/app/shareParams.test.ts` also passes under `CCRUG_TZ=America/New_York` (date parsing is UTC-anchored, TZ-independent).

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

- FOUND: app/lib/shareParams.ts
- FOUND: tests/app/shareParams.test.ts
- FOUND: .planning/phases/04-base-picker-and-generator-ui/04-05-SUMMARY.md
- FOUND commit: cc022eb (Task 1)
- FOUND commit: 60849b4 (Task 2)
