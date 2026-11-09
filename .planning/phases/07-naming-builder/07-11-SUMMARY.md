---
phase: 07-naming-builder
plan: 11
subsystem: app-data-modules
tags: [naming, ccru-preset, by-reference-lore, limits-as-data, copy-module, uispec-copywriting, clipecho, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (NamingPreset, createNaming, createNameResolver), plan 07-08 (NamingIssue, ISSUES_MAX, UNKNOWN_KEYS_MAX, NAMING_IMPORT_MAX_BYTES), plan 07-09 (CCRU_LINK_BASE) and plan 07-10 (COLLISION_SCAN_MAX_N 4096, canCertify, createCollisionJob)
  - phase: 06-canvas-tier-and-worker
    provides: INTERACTIVE_MAX_N read from the measured tier table (app/lib/tierBounds.ts)
provides:
  - app/presets/base10/naming.ts, CCRU_NAMING_PRESET (id 'ccru', base 10, the ten zone sounds from ZONE_PARTICLE in zone order, names === DEMON_NAMES by reference), frozen, throws on a lore gap
  - app/lib/namingLimits.ts, sixteen named data constants and collisionScanLimit() (the smaller of NAMING_COLLISION_SCAN_MAX_N 1024 and the tier-table ceiling)
  - app/lib/namingCopy.ts, NAMES_COPY (76 frozen keys) and 41 string functions: every visible string of the Names feature equal to the UI-SPEC Copywriting Contract, numbers filled from data
  - 289 passing tests across tests/presets, namingLimits and namingCopy (in UTC and America/New_York)
affects: [07-12, 07-13, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A preset adapter under app/presets/base10/ is lore-scanned: it imports DEMON_NAMES and ZONE_PARTICLE and exports them by reference, so the CCRU text stays in its one non-MIT file and the scanner and an identity test (toBe) both guard it"
    - "A limit that depends on a measured ceiling is a function of two data values (Math.min of a constant and the tier-table ceiling), proved with vi.doMock on the tier-table JSON at 512, 1024 and 8000"
    - "One copy module: fixed strings in a frozen object, sentences with numbers as functions; limits, the CCRU base and the page step are imported and a source assertion forbids typing them as prose"
    - "A source-text assertion catches a typed constant that is behaviourally identical to the imported one (a mutant no output test can kill)"

key-files:
  created:
    - app/presets/base10/naming.ts
    - app/lib/namingLimits.ts
    - app/lib/namingCopy.ts
    - tests/presets/namingPreset.test.ts
    - tests/app/namingLimits.test.ts
    - tests/app/namingCopy.test.ts
  modified: []

key-decisions:
  - "The plan's [default] copy decisions are implemented as written: the inert-smoothing caption (the checkbox stays enabled), override problems as `{a}::{b}: {reason}`, bad keys as `Override key \"{key}\" is not a demon of base {n}.`, other fields as `Field {path} is not valid.`, the closing sentence by whether every listed issue is a zone issue, sizes as whole MB when exact else one decimal, 8-character reroll seeds, 8 undo entries above 5000 overrides"
  - "importError is overloaded: the context-free kinds (not-json, not-names-file, too-large, unknown-version, unreadable) take the issue alone (07-17 calls importError({ kind: 'too-large', maxBytes })); every other kind needs the context and a missing context is a TypeError, a compile error for typed callers. The union ImportFailure adds { kind: 'unreadable' } to NamingIssue because a failed file read is not a validator issue"
  - "importError is total over NamingIssue: an entry issue given alone reads as a one-entry invalidEntries; invalidEntries renders a seed-only-base issue beside other issues as the first sentence of the seed-only error, and the kinds that end a read by themselves (never in a list) as `This file is not valid.`"
  - "The CCRU base in `ccruHint` and `loadedCcru` comes from CCRU_LINK_BASE and the page step in `shortcutLine` from ZONE_PAGE_STEP, so no base or step is typed as prose; a source assertion enforces it"
  - "matrixTooltip only assembles `A::B · Name · MESH · Subtype` (name segment omitted for null); the 31-graphemes-plus-ellipsis cut at NAME_TOOLTIP_GRAPHEMES stays with the caller (07-15)"
  - "plural(n, one, many) returns the count and the word (`1 locked zone`); formatBytes adds KB and byte fallbacks below a megabyte (whole when exact, else one decimal) so a smaller cap never prints `0.0 MB`"
  - "pastedPartial reads `1 was not used` for one unused token; generated() clips the seed echo like every user-text echo (T-07-19)"

patterns-established:
  - "A mutation run is only evidence against a green baseline: run the file first, then the mutants (the first run here had a red baseline, see Deviations 1)"

requirements-completed: []  # NAM-04 and NAM-03 stay Pending: the preset adapter, the limits and the copy exist, but nothing renders them until plans 07-15 to 07-23; the orchestrator marks them at the phase gate

# Metrics
duration: ~12min
completed: 2026-11-09
---

# Phase 7 Plan 11: CCRU Preset by Reference, Naming Limits and the Single Copy Module Summary

**The base-10 CCRU naming preset reads the ten zone sounds and the 45 canonical names from `lore.ts` by reference (`names: DEMON_NAMES`, frozen, lore scanner still green), every naming limit is a named data value (the collision scan limit is `Math.min(1024, INTERACTIVE_MAX_N)` from the tier table), and one copy module holds all 76 fixed strings and 41 sentence functions of the UI-SPEC Copywriting Contract with limits imported rather than typed, proved by 289 tests and 33 killed mutants.**

## Performance

- **Duration:** about 12 min (start was not stamped; estimated from the previous plan's end at 23:32Z and the first test run at 23:33Z), including the mutation runs, two typechecks and two timezone runs
- **Completed:** 2026-11-09
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 6 (3 modules, 3 test files); 0 modified
- **`$PLAN_BASE`:** `b31da29b624315b0527d7c33c01c9b8d685473f7`

## Accomplishments

- **Preset (`app/presets/base10/naming.ts`).** `CCRU_NAMING_PRESET` is `Object.freeze({ id: 'ccru', base: BASE10.zoneCount, sounds, names: DEMON_NAMES })`, the `sounds` array built by a loop over `BASE10.zoneCount` reading `ZONE_PARTICLE[z]` and frozen, with `new Error('base-10 lore missing a zone sound for zone ' + z)` on a gap (proved with `vi.doMock` of the lore module). No canonical name or sound is quoted in the file. Tests: `names` is `toBe(DEMON_NAMES)`; `sounds` equals `Object.values(ZONE_PARTICLE)`; `base` equals `BASE10.zoneCount` and `CCRU_LINK_BASE`; `createNaming({ source: 'ccru', preset })` resolves all 45 demons to `DEMON_NAMES[mesh]` with state `preset`, pairwise distinct; with source `generated` at base 10 `presetNameOf` is null and the state `generated` for all 45; the file is in the list the lore scanner walks and quotes no name or sound.
- **Limits (`app/lib/namingLimits.ts`).** The sixteen constants of the plan with `[default]` doc comments (`NAMING_COLLISION_SCAN_MAX_N` 1024, `NAMING_AUTOSAVE_DEBOUNCE_MS` 400, `NAMING_STORAGE_PREFIX` `ccrug.naming.v1.`, `NAMING_UNDO_OVERRIDE_LIMIT` 5000, `NAMING_UNDO_HEAVY_DEPTH` 8, `REROLL_SEED_LENGTH` 8, `COLLISION_LINES_STEP` 20, `COLLISION_JUMPS_SHOWN` 4, `NAME_TOOLTIP_GRAPHEMES` 32, `NAMES_PREVIEW_ROWS` 3, `ZONE_ROW_HEIGHT_PX` 28, `ZONE_LIST_OVERSCAN` 8, `ZONE_PAGE_STEP` 10, `COLLISION_SLICE_MS` 8, `NAMES_SCROLL_INSET_PX` 12, `SOUND_FIELD_MAX_INPUT` 64) and `collisionScanLimit()`. 07-10's recommendation is applied: 1024 is asserted at most `COLLISION_SCAN_MAX_N` (4096) and at most `INTERACTIVE_MAX_N`, so `createCollisionJob` can never refuse a size the panel offers. With the tier table mocked to 512 the constant stays 1024 and `collisionScanLimit()` returns 512; mocked to 8000 or 1024 it returns 1024. The source holds no `4000` and reads the ceiling through `./tierBounds`.
- **Copy (`app/lib/namingCopy.ts`).** `NAMES_COPY` carries exactly the 76 keys the plan names (checked as a sorted key set), each equal to its UI-SPEC row, frozen including the four records (`styleLabels`, `styleDescriptions`, `joinLabels`, `joinDescriptions`). The 41 functions (the plan's list) fill every number from data: `SOUND_MAX_LENGTH`, `NAME_MAX_LENGTH`, `SEED_MAX_LENGTH`, `ISSUES_MAX`, `UNKNOWN_KEYS_MAX`, `INTERACTIVE_MAX_N`, `CCRU_LINK_BASE` and `ZONE_PAGE_STEP` are imported, and the import errors cover every `NamingIssue` kind plus a failed file read. Echoes of typed or file text (go-to text, unknown keys, override keys, field paths, unknown versions, the seed in a status) go through `clipEcho`.
- **Voice.** A sweep over every fixed string and one output of every function (about 170 strings) asserts no em dash, no exclamation mark, no invisible format character, no typographic apostrophe, no doubled or edge space, and at least two words in each of the 15 button labels; source assertions forbid `4000`, `16 characters`, `32 characters`, `64 characters`, `base 10` and `jump 10 rows` as typed prose.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: CCRU preset adapter and naming limits**
   - RED: `c22eec0` (test) both test files failing on the missing modules
   - GREEN: `d7b7ebc` (feat) `naming.ts` and `namingLimits.ts`
2. **Task 2: the single copy module for the Names feature**
   - RED: `7d62895` (test) the copy test failing on the missing module
   - GREEN: `dcaa27a` (feat) `namingCopy.ts` and two source assertions added to the copy test

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/presets/base10/naming.ts` - 23 lines
- `app/lib/namingLimits.ts` - 61 lines
- `app/lib/namingCopy.ts` - 472 lines (`NAMES_COPY`, 41 functions, three types)
- `tests/presets/namingPreset.test.ts` - 10 tests; `tests/app/namingLimits.test.ts` - 9 tests; `tests/app/namingCopy.test.ts` - 128 tests

## Decisions Made

See `key-decisions`. The plan's five `[default]` decisions are implemented as written; the rest are mine and are listed in the same block for review at the final checkpoint. The two that later plans feel directly: `importError` is overloaded (07-17 may call it with the issue alone for too-large and unreadable, and must pass the context for every other kind), and `matrixTooltip` does not cut the name (07-15 cuts at `NAME_TOOLTIP_GRAPHEMES` before calling it).

## Mutation Checks

Each mutant was applied by a scratchpad script that refuses a mutant not found exactly once or a no-op, ran the test file in the foreground under a 150 s timeout, restored the source from a saved copy, and `git diff --quiet <file>` confirmed the restore (clean after every run).

Task 1 (the plan's named mutant): pasting one canonical name as a quoted literal into `naming.ts` (`const leaked = '<first canonical name>'`) is **Killed** by the lore scanner (`tests/presets/base10-adapter.test.ts`: `app/presets/base10/naming.ts contains CCRU lore: [ 'the demon name ...' ]`) and independently by `namingPreset.test.ts` (`quotes no canonical name and no zone sound`). Restored and confirmed.

Task 2 (extras, 20 mutants against the green 128-test baseline in `namingCopy.test.ts`), every one **Killed**:

| # | Mutation | Failing tests |
|---|----------|---------------|
| M01 | `plural` always the many form | 6 |
| M02 | `noZone` echoes the text unclipped | 1 |
| M03 | `invalidEntries` keeps every issue (no ISSUES_MAX cap) | 1 |
| M04 | closing sentence always says zones | 2 |
| M05 | name limit typed as `16 characters` in the shared reason | 2 |
| M06 | tooltip keeps a separator for a missing name | 2 |
| M07 | `formatBytes` always one decimal | 3 |
| M08 | unknown keys never say `and k more` | 1 |
| M09 | an em dash in one string | 3 |
| M10 | wrong-base prints the file base for the current base | 2 |
| M11 | join status swapped | 1 |
| M12 | sounds aria always `, selected` | 1 |
| M13 | unknown version echoed unclipped | 1 |
| M14 | CCRU base typed as `base 10` in the hint (output identical, killed by the source assertion) | 1 |
| M15 | page step typed as `jump 10 rows` (output identical, killed by the source assertion) | 1 |
| M16 | `pastedPartial` always `were` | 1 |
| M17 | a missing context returns a default instead of throwing | 1 |
| M18 | seed limit typed as `64 characters` | 1 |
| M19 | override key echoed unclipped | 1 |
| M20 | `generated` echoes the seed unclipped | 1 |

Limits (6 mutants against the green 9-test `namingLimits.test.ts`), every one **Killed**: L1 `Math.max` instead of `Math.min` in `collisionScanLimit` (3 failing tests), L2 `collisionScanLimit` ignores the ceiling (1, the 512 mock), L3 the scan constant raised to 4096, above the ceiling (5), L4 `SOUND_FIELD_MAX_INPUT` lowered to 16 (2), L5 the storage prefix without its trailing dot (2), L6 `REROLL_SEED_LENGTH` 80, above a seed's limit (2).

Preset (6 mutants against the green 10-test `namingPreset.test.ts`), every one **Killed**: P1 `names` copied with a spread instead of referenced (2 failing tests, the identity and the source assertion), P2 `sounds` not frozen (1), P3 `sounds` in reverse order (2), P4 `base` 12 (2), P5 a lore gap skipped instead of thrown (1), P6 the preset object not frozen (1).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/presets tests/app/namingLimits.test.ts tests/app/namingCopy.test.ts --project oracle`: 11 files, 289 tests passed; the same command under `CCRUG_TZ=America/New_York`: 11 files, 289 passed. This includes `tests/presets/base10-adapter.test.ts` (the lore scanner, with `naming.ts` in its file list) and `naming-banks-lore.test.ts`.
- Task 1's own verify command (`namingPreset`, `base10-adapter`, `namingLimits`): 3 files, 60 tests passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs` (all 11 gates including `base-ten`, `lore`, `goldens`, `lf`): OK, with the new files staged before the base-ten run.
- Acceptance greps: `names: DEMON_NAMES` 1 and `from './lore'` 1 in `naming.ts`; `4000` 0 in `namingLimits.ts`; `export const NAMES_COPY` 1; each of `shareTitleUncarried`, `overriddenTitle`, `overriddenHidden`, `shortcutLine`, `numeralsNote`, `soundsNote`, `labelsRowSounds`, `labelsInfoSounds`, `restored`, `smoothingInert` appears once as a key; `export const SOUND_FIELD_MAX_INPUT = 64` 1; `\b(4000|16 characters|32 characters|64 characters)\b` 0 in `namingCopy.ts`; the em dash and `\p{Cf}` check exits 0.
- `npm run test:swap` and `npm run verify` were NOT run: the plan only adds new app files (`namingCopy.ts` imports `namingLimits.ts`, and nothing else imports any of the three), so no bundle, no diagram and no golden can change; the plan's verify commands, typecheck and check-repo above are the proportionate gate. `git diff --name-only $PLAN_BASE HEAD` lists exactly the six files above, none under `e2e/`, `engine/`, `app/components/numogram/Projection.tsx`, `PairGraphProjection.tsx` or `reference/`. No frozen oracle, bank, signed-off vector or other `app/presets/base10/` file was touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Process / test bug] The first mutation run had a red baseline**
- **Found during:** Task 2 verification
- **Issue:** After the 20-mutant run, the plan's verification command showed one failing test. A source assertion I had just added (`no base 10 typed as prose`) failed on a code comment (`// base 10 only source`) in `namingCopy.ts`, so the baseline was red during the whole first mutation run, which made M14 and M15 (one failing test each) look killed when the one failure was the baseline's own.
- **Fix:** Reworded the comment, confirmed the baseline green (128 tests), and re-ran all 20 mutants; the table above is that second run (M14 and M15 each now fail exactly the new source assertion, with 127 tests passing).
- **Files modified:** `app/lib/namingCopy.ts` (one comment), no test change
- **Commit:** `dcaa27a`

**2. [Rule 2 - Missing critical functionality] `importError` had to accept a call without context**
- **Found during:** Task 2 (reading how 07-17 calls it)
- **Issue:** The plan gives `importError(issue, ctx)` with a required context, but 07-17's action calls `importError({ kind: 'too-large', maxBytes })` and a file-read failure is not a `NamingIssue` at all.
- **Fix:** Two overloads: the context-free kinds take the issue alone, every other kind requires the context (and throws a `TypeError` at runtime if an untyped caller omits it); `ImportFailure` adds `{ kind: 'unreadable' }`. Tests cover the three requirement cases and each overload.
- **Files modified:** `app/lib/namingCopy.ts`, `tests/app/namingCopy.test.ts`
- **Commit:** `dcaa27a`

**3. [Plan example] A neutral sample name**
- The behaviour list uses `backTo('9', '8', 'Ummnu-like')`; the tests use `Zed` instead so no test names a canonical-looking demon (the same hygiene 07-06 applied to the engine tests). No contract changes.

### Design refinements recorded under key-decisions

`invalidEntries` handles seed-only-base and the read-ending kinds; `formatBytes` has KB and byte fallbacks; `pastedPartial` reads `1 was not used`; `generated()` clips the seed echo; `ccruHint`, `loadedCcru` and `shortcutLine` take their base and page step from constants. None changes a name, key or sentence the plan or the UI-SPEC specifies.

---

**Total deviations:** 1 process correction (re-ran the mutants), 1 missing-functionality fix (overloads), 1 neutral-sample note.
**Impact on plan:** none changes an exported name or a UI-SPEC sentence; no scope creep.

## Issues Encountered

None blocking. A stray placeholder file created by mistake in `.planning/` was deleted before any commit (`git status` never showed it staged).

## Known Stubs

None. The modules render nothing and hold no placeholder data; nothing imports them yet by design (07-12 onward).

## Threat Flags

None beyond the register. T-07-12c (licensing): the preset imports from `lore.ts`, the lore scanner auto-scans the file and the mutation above proves it fails on a pasted name, and the identity test pins `names === DEMON_NAMES`. T-07-19 (label injection): every echo of user text is bounded by `clipEcho` (40 characters) and tested, and the strings are plain text for React text nodes. T-07-06b (denial of service): the scan limit is data capped by the tier-table ceiling and by `COLLISION_SCAN_MAX_N`.

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-11)` `c22eec0` before `feat(07-11)` `d7b7ebc`, and `test(07-11)` `7d62895` before `feat(07-11)` `dcaa27a`. Each RED run failed on the missing module before its GREEN commit. No refactor commit was needed.

## Next Phase Readiness

- 07-12 reads `NAMES_COPY.soundsRadio`, `soundsNote`, `numeralsNote`, `labelsRowSounds`, `labelsInfoSounds` and `zoneSoundAria(digits, sound, region, selected)`; 07-13 reads `CCRU_NAMING_PRESET`, `NAMING_AUTOSAVE_DEBOUNCE_MS`, `NAMING_UNDO_OVERRIDE_LIMIT`, `NAMING_UNDO_HEAVY_DEPTH` and `NAMES_COPY.restored`; 07-17 reads the import and export functions, `REROLL_SEED_LENGTH`, `NAMES_PREVIEW_ROWS` and `NAMES_SCROLL_INSET_PX`; 07-19 the zone-list copy, `ZONE_ROW_HEIGHT_PX`, `ZONE_LIST_OVERSCAN`, `ZONE_PAGE_STEP`, `SOUND_FIELD_MAX_INPUT`; 07-20 the collision copy and `collisionScanLimit()`, `COLLISION_*` constants.
- `collisionScanLimit()` is the number the report compares a base against; above it the app shows `collisionsNotChecked(limit)` only when `canCertify` cannot decide (07-10's guidance), and a seed-only naming never reaches `createCollisionJob`.
- No blocker.

## Self-Check: PASSED

- All six created files exist and are tracked: `app/presets/base10/naming.ts`, `app/lib/namingLimits.ts`, `app/lib/namingCopy.ts`, `tests/presets/namingPreset.test.ts`, `tests/app/namingLimits.test.ts`, `tests/app/namingCopy.test.ts`.
- All four task commits exist (`c22eec0`, `d7b7ebc`, `7d62895`, `dcaa27a`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `engine/` file, no `Projection.tsx`, no other `app/presets/base10/` file and no existing app file was touched.
