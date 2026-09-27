---
phase: 02-engine-core-and-base-10-migration
plan: 09
subsystem: migration
tags: [base10-adapter, strangler-swap, currents, engine-instance, frozen-oracle, lore-by-id, seam, unicode-minus]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-04 createNumogram(10) with pair(id), current(pairId), torques, warp and plex; 02-07 app/presets/base10/lore.ts (CURRENT_LORE by pair id) and the app/data seams; 02-08 BASE10 (app/presets/base10/numogram.ts), the adapter pattern and tests/presets/base10-adapter.test.ts; 02-03 the frozen behaviour baseline and npm run test:swap
provides:
  - app/presets/base10/currents.ts, CURRENTS derived from the engine (cycle order, to = hi - lo, in-base label with the minus sign U+2212) joined with CURRENT_LORE by pair id, plus legacyCurrentFrom(pairId), the upstream viewer's drawing convention for `from`
  - app/data/currents.ts reduced to a two-line seam, no hand-authored current structure left (D-08)
  - the currents block of tests/presets/base10-adapter.test.ts (frozen oracle, engine order, label form, key order, lore join, legacyCurrentFrom, seam identity, no lore text in adapter files)
affects: [02-10, 02-11, 02-12, 02-13, phase-04-components-engine-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same strangler sequence as 02-08: adapter + seam flip with the hand data renamed and kept, full gate green on the committed swap, hand data deleted in its own commit, full gate again"
    - "Viewer structure that is not lore (current labels) is rebuilt from engine data with the engine's own numeral formatter; the one non-ASCII character is a named constant kept in its escape source form, as in the file it replaces"
    - "Legacy drawing conventions live in a named function (legacyCurrentFrom) with a doc comment saying it is upstream's convention and which phase replaces it"

key-files:
  created:
    - app/presets/base10/currents.ts
  modified:
    - app/data/currents.ts
    - tests/presets/base10-adapter.test.ts

key-decisions:
  - "The seam keeps the export name CURRENTS and re-exports the adapter array itself (identity checked with toBe): NumogramClient.tsx (routing keys on c.name), Projection, CurrentsPanel, InfoDisplay, PinnedBackground, tests/oracle/deriveBase10.ts and tests/e2e-normalizer/behaviour-lore-coverage.test.ts are untouched"
  - "The label is `formatNumeral(hi, base) + MINUS + formatNumeral(lo, base) + '=' + formatNumeral(to, base)` with base = BASE10.base, so it is derived from engine data and the engine's numeral scheme (D-04) instead of a copied string; the runtime strings equal the originals code point by code point"
  - "The minus sign in code is a `MINUS` constant written in the same escape source form the old file used (one escape, not five); the adapter's two comment lines carry the raw character so the plan's literal acceptance grep for it also holds"
  - "The page-weight baseline was NOT touched: /numogram/ is +16,966 bytes raw (+3.0%) and +4,926 gzip (+2.9%) over the stored baseline, inside max(1 KiB, 5%), and this swap alone added +907 raw and +260 gzip over the state after 02-08"

patterns-established:
  - "An adapter that needs a number formatter imports it from the engine barrel (../../../engine/index) next to BASE10 from ./numogram; the plan's key link asks for exactly this (formatNumeral), so currents.ts is the second app file that imports the engine after numogram.ts"

requirements-completed: [MIG-01]

# Metrics
duration: 32min
completed: 2026-09-26
---

# Phase 2 Plan 09: Swap 2, Currents Summary

**The viewer's five currents now come from `createNumogram(10)` (order from the cycles: Torque pairs 1, 2, 4 in flow order, then the Warp pair 3, then the Plex pair 0; `to` = hi - lo; labels rebuilt as in-base `hi`, U+2212, `lo`, `=`, `to`) joined by pair id with `CURRENT_LORE`, through `app/presets/base10/currents.ts`; `app/data/currents.ts` is a two-line seam and the hand-authored from/to/label structure is deleted. The swapped data is deep-equal to the frozen f7d6689 file (31 nodes, 25 primitive fields, 0 differences, key order name, from, to, label, desc, all five labels equal as runtime strings and by code point), and the full gate (60 DOM goldens, 5 behaviour baselines, numeric oracle, static-export specs) stayed green and unchanged.**

## Performance

- **Duration:** about 32 min (started about 00:45Z, finished about 01:17Z); about 17 of that is the five gate runs below
- **Tasks:** 2 (2 task commits), plus this metadata commit
- **Files:** 1 created, 2 modified (exactly the plan's `files_modified` list)

## What was built

### The adapter, what it reads, and its exported shape

```ts
// app/presets/base10/currents.ts
export function legacyCurrentFrom(pairId: number): number   // the pair's even member; the Plex pair (lo === 0) drawn at its high zone
export const CURRENTS: CurrentData[]                        // built once at module load, 5 entries, keys name, from, to, label, desc
```

- **From the engine (`BASE10 = createNumogram(10)`):** `torques`, `warp` and `plex` give the order `[...torques.flatMap(c => Array.from(c.pairs())), warp.firstPair, plex.firstPair]` = pair ids 1, 2, 4, 3, 0; `BASE10.current(p)` gives `{ lo, hi, to }` (`to` = hi - lo); `BASE10.pair(p)` gives `lo`, `hi` and `even` for `from`; `BASE10.base` and `formatNumeral` (engine barrel) give the numerals of the label.
- **From lore:** `CURRENT_LORE[p].name` and `.desc` by pair id (a missing entry throws `base-10 lore missing for current <p>`).
- **`from` is the upstream viewer's convention, not engine data:** `legacyCurrentFrom(p) = pair.lo === 0 ? pair.hi : pair.even` (1 -> 8, 2 -> 2, 4 -> 4, 3 -> 6, 0 -> 9). The frozen oracle and the old data agree with it for all five; the doc comment says Phase 4 replaces it with engine-driven routing.
- **`to`** is `BASE10.current(p).to` (7, 5, 1, 3, 9). **`label`** is built per current as the in-base numeral of hi, the minus sign, the numeral of lo, `=`, the numeral of `to`: `8−1=7`, `7−2=5`, `5−4=1`, `6−3=3`, `9−0=9`.
- Plain (unfrozen) objects in a plain array with the literal key order, like the hand data.
- `app/data/currents.ts` after Task 2 is exactly:

```ts
// Base-10 data seam (MIG-01): currents derived by the engine and joined with lore in app/presets/base10/currents.ts.
export { CURRENTS } from '../presets/base10/currents'
```

### Source form of the minus sign

The old file wrote every label with an escape sequence for U+2212 (5 in the source). The adapter has one `MINUS` constant in that same escape source form (built with a script from a char code, never typed: the file-write tool decodes typed escapes). Byte check of `app/presets/base10/currents.ts`: 0 CR bytes, 1 escape sequence (the constant), 2 raw U+2212 characters (both in comment lines: one names the `hi−lo=to` label shape, one describes the constant), so the plan's literal grep for the character finds it. The seam and the test file contain no escape sequence and no non-ASCII byte at all (byte-checked).

### What was deleted (Task 2, D-08)

The five literal entries (`from: 8, to: 7, label: ...` .. `from: 9, to: 9, label: ...`), the `LEGACY_CURRENTS` rename that carried them between the two commits, the `CURRENT_LORE` and `CurrentData` imports of the seam, and the legacy comparison of the adapter test. No `tests/legacy` copy exists (D-08): the frozen numeric oracle (`tests/oracle/deriveBase10.ts` reads `CURRENTS` through the seam and compares name, pair, from, to to `base10.golden.json`), the 60 DOM goldens (layer-currents, time-circuit, region states) and the behaviour baseline (Currents panel rows, lore sweep) guard the values.

## Strict old-versus-new proof (throwaway, not committed)

`git show f7d6689:app/data/currents.ts` was written byte-exact into the scratchpad (checked with `cmp`; 1,224 bytes, 0 CR, 5 escapes for U+2212 and 2 for the em dash) and compared with `tsx` against the real `app/data/currents.ts` on the swap commit (d34787b, uncommitted state before it, and again on the final tree at 580aa8c). The script walks both values with `Object.is` on primitives and requires equal key sets and key order, equal array lengths, equal prototypes and equal `typeof`.

| what | result |
|------|--------|
| entries | old 5, new 5 |
| nodes compared (1 array + 5 objects + 25 primitive fields) | 31 |
| primitive fields in the old file (5 x name, from, to, label, desc) | 25 |
| order (name:from>to) | old and new both Surge:8>7 Hold:2>5 Sink:4>1 Warp:6>3 Plex:9>9 |
| key order of every entry | name, from, to, label, desc (5 of 5) |
| labels as runtime strings and as code points (U+0038 U+2212 U+0031 U+003D U+0037 for the first, and so on) | 5 of 5 identical, exactly one U+2212 in each, no ASCII hyphen |
| U+2212 escapes in the source | old file 5; final `app/data/currents.ts` 0 (seam); `app/presets/base10/currents.ts` 1 (the constant) |
| **differences** | **0** |

The names and descriptions (including the em-dash escapes in the Hold and Sink descriptions) come from `lore.ts` and are equal to the frozen upstream file, not only to the 02-07 lore module.

## Task Commits

1. **Task 1: Currents adapter and seam flip (swap commit)** - `d34787b` (refactor): `app/presets/base10/currents.ts`, `app/data/currents.ts`, `tests/presets/base10-adapter.test.ts`
2. **Task 2: Delete the hand-authored current data (D-08)** - `580aa8c` (refactor): `app/data/currents.ts`, `tests/presets/base10-adapter.test.ts`

No `perf(02-09)` commit: the page-weight budget passed unchanged (see below).

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification results (exact, per command)

| when | command | result |
|------|---------|--------|
| pre-flight, HEAD 3e16cb9 clean | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0** (about 250 s, not separately timed): check:repo OK; typecheck (4x tsc + lint) clean; `test` 26 files 923 tests; `test:tz` 26 files 923 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` 75 passed 5 skipped; `check-repo: OK (... clean-tree, static-out)` |
| TDD RED | `vitest run --project oracle tests/presets/base10-adapter.test.ts` before the adapter existed | the file failed to load (`Cannot find module '../../app/presets/base10/currents'`), no tests ran |
| Task 1 quick | `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` | 13 files, 445 tests pass |
| Task 1 quick | `npm run typecheck` | exit 0 (4x tsc, lint: no warnings or errors) |
| Task 1, uncommitted swap | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 194 s**: build OK; playwright 65 passed 5 skipped (60 DOM goldens both timezones + 5 behaviour on UTC); vitest 26 files 931 tests |
| Task 1 committed (d34787b), full gate | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 252 s**: unit 931 in both timezones, basepath e2e 10 passed, `page-weight: OK`, e2e 75 passed 5 skipped, final check-repo OK incl. clean-tree and static-out |
| Task 2 quick | oracle project, `npm run typecheck`, `node scripts/check-repo.mjs` | 13 files 444 tests pass; exit 0; `check-repo: OK` |
| Task 2, uncommitted deletion | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 195 s**: playwright 65 passed 5 skipped (60 goldens + 5 behaviour), vitest 26 files 930 tests |
| final, deletion committed (580aa8c), clean tree | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 250 s**: check:repo OK; typecheck clean; `test` 26 files 930 tests; `test:tz` 26 files 930 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` **75 passed, 5 skipped** (60 goldens unchanged + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project); `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

Test count: 923 before, 931 after the swap (the currents block adds 8 tests), 930 after the deletion (the legacy comparison goes).

Frozen material (acceptance):

- `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks app/lib e2e/__golden__ engine/test/fixtures/base10.golden.json` exits 0. `git diff --name-only f7d6689 -- app` lists only `app/data/{currents,demons,gates,syzygies,zones}.ts` and `app/presets/base10/{currents,lore,numogram,syzygies}.ts`.
- `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` prints `OK 5 files in 1 sets`; `git status --porcelain -- e2e/__behaviour__` prints nothing; `git diff --quiet ebab0cc -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures tests/oracle app/components app/hooks app/lib app/NumogramClient.tsx` exits 0 (nothing frozen or consumer-side changed since the pre-swap-1 state).
- No `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. Nothing was pushed, fetched or pulled.
- Cleanup: no listener on ports 3000, 3007, 3111, 3112, 3113 afterwards; `.e2e-basepath/` removed after every verify.

## Page weight (T-02-34 style check)

Measured with `node scripts/page-weight.mjs print` against `perf/page-weight.baseline.json`:

| route | metric | baseline | after 02-08 | now (580aa8c) | vs baseline | this swap |
|-------|--------|----------|-------------|---------------|-------------|-----------|
| `/numogram/` | js bytes | 563,909 | 579,968 | 580,875 | +16,966 (+3.0%) | +907 |
| `/numogram/` | js gzip | 170,556 | 175,222 | 175,482 | +4,926 (+2.9%) | +260 |
| `/` | js bytes / gzip | 416,830 / 128,120 | unchanged | unchanged | 0 | 0 |

Tolerance `max(1 KiB, 5%)`: limits are baseline + 28,196 raw and + 8,528 gzip, so the headroom left for swaps 02-10..02-12 is **about 11,230 raw and 3,602 gzip bytes** on `/numogram/`. `check:weight` passed on every run and the baseline file was not touched. 02-12 (demons) is the swap to watch.

## Decisions Made

See key-decisions above. The plan was followed as written. Judgement calls:

- `currentPairIds()` uses the plan's expression (`firstPair` for the Warp and the Plex): base 10 has exactly one-pair Warp and Plex cycles, and the preset invariant in `numogram.ts` already pins one Torque cycle and a Warp.
- The adapter test scans the adapter files for lore text: for currents it checks the five descriptions (prose) as substrings and the five names only as quoted literals, because a comment may legitimately say Warp or Plex.
- The `it(...)` titles and comments of the adapter test avoid the token `LEGACY_CURRENTS` after Task 2 (acceptance greps it at 0 in the test file).

## Deviations from Plan

None - plan executed exactly as written. The conditional page-weight step did not trigger, so `perf/page-weight.baseline.json` and any `perf(02-09)` commit do not exist.

Process notes (no effect on the result):

- The plan's key link makes `currents.ts` import `formatNumeral` from the engine barrel, so it is the second app file (after `numogram.ts`) that imports the engine; the 02-08 note "one file only" was a description of that plan, not a guard (no test or lint rule restricts it, checked with a repo-wide search for `engine/index`).
- The file-write tool refused an overwrite of `app/data/currents.ts` after a script had edited it (stale read), so it was re-read and then written; the resulting file was byte-checked (172 bytes, 0 CR, 0 escapes, 0 non-ASCII).
- `tests/e2e-normalizer/behaviour-lore-coverage.test.ts` was not edited: it still reads the five labels from the `app/data/currents` seam (now engine-derived, values unchanged); only its header comment ("until it is engine-derived") is now out of date, which does not matter for behaviour.

## Issues Encountered

None. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None. `CURRENTS` is fully engine- and lore-derived; nothing is hard-coded, empty or mocked. `legacyCurrentFrom` is a deliberate, documented legacy convention (not a stub) that Phase 4 replaces.

## Threat Flags

None. T-02-36 (name/pair mis-join or order change): the adapter test checks the name and description against `CURRENT_LORE[pairId]` for the exact order 1, 2, 4, 3, 0 and the frozen oracle currents (name, from, to), the legacy equality held in Task 1, the f7d6689 deep-equality proof has 0 differences, and the DOM goldens (layer-currents, time-circuit) and the behaviour lore sweep passed. T-02-37 (label character drift): the labels equal the originals code point by code point, exactly one U+2212 and no ASCII hyphen in each (asserted in the test and in the proof). T-02-38 (goldens regenerated): none touched, verified by the diffs above. No new network, auth, file-access or schema surface: the new import edge is app -> engine by relative path (already introduced in 02-08), and the engine imports nothing from app.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers swap 2 of 5, not MIG-01 as a whole. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Notes for swap 02-10 (gates) and the rest

- **Pattern to copy:** a new adapter file under `app/presets/base10/` imports `BASE10` from `./numogram` and the lore from `./lore`, builds the viewer shape once at module load, and the seam re-exports it; write the tests first (import of the missing adapter fails, RED), keep the hand array as `LEGACY_*` in the seam for the first commit, run `test:swap` before committing, `verify` on the committed swap, then delete in a second commit and run `test:swap`, quick checks and a final `verify`.
- **Gates need the same care as the labels:** gate names use the in-base `Gt-NN` scheme (see the plan), and `GATE_LORE` is keyed by gate origin zone; compare the swapped `GATES` (or whatever the seam exports, check the real file at f7d6689) against `git show f7d6689:app/data/gates.ts` with the same throwaway deep-equality script (`prove-currents.mts` pattern: `Object.is` on primitives, key sets and order, prototypes, plus code points for any non-ASCII text).
- **Never type a unicode escape sequence** in a Write/Edit argument (or in a Python string literal inside a heredoc: a plain `\u` in a Python string is a syntax error): build the backslash with `chr(92)` / `String.fromCharCode(92)`, and check with `od -c` and a Python byte count.
- **Do not edit the repo while a gate runs**: `verify` ends with `--clean-tree`, so any doc or draft written into the tree during the run fails it; keep drafts in the scratchpad.
- **Gate timings on this machine:** `npm run verify` 250-252 s, `npm run test:swap` 194-195 s. Test counts now 930 in both timezones (26 files).
- **Page-weight headroom** is in the section above (about 11.2 KB raw / 3.6 KB gzip left on `/numogram/` before the stored baseline needs a reasoned `update --reason`).

## Next Phase Readiness

- Ready for swap 3 (02-10, gates). Syzygies and currents are engine-derived and lore-joined, no hand structure remains for either, the full gate is green with the 60 goldens, the behaviour baseline and the numeric oracle unchanged.

## Self-Check: PASSED

- FOUND: `app/presets/base10/currents.ts`, `app/data/currents.ts`, `tests/presets/base10-adapter.test.ts`
- FOUND commits: `d34787b`, `580aa8c`
