---
phase: 02-engine-core-and-base-10-migration
plan: 08
subsystem: migration
tags: [base10-adapter, strangler-swap, syzygies, engine-instance, frozen-oracle, lore-by-id, seam]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-04..02-06 createNumogram(10) with pair(id), torqueCount, warp and demons.meshOf; 02-07 app/presets/base10/lore.ts (SYZYGY_LORE by pair id, DEMON_NAMES by mesh) and the app/data seams; 02-03 the frozen behaviour baseline and npm run test:swap
provides:
  - app/presets/base10/numogram.ts, the base-10 engine instance BASE10 = createNumogram(10) with the preset invariants (one Torque cycle, a Warp) checked at module load
  - app/presets/base10/syzygies.ts, SYZYGIES derived from the engine pairs joined with SYZYGY_LORE by pair id (the first data source of the viewer that comes from the engine)
  - app/data/syzygies.ts reduced to a seam of two lines, no hand-authored structure left for syzygies (D-08)
  - tests/presets/base10-adapter.test.ts, the adapter test (frozen oracle pairs, engine join, key order, demon join, seam identity, no lore text in adapter files)
affects: [02-09, 02-10, 02-11, 02-12, 02-13, phase-04-components-engine-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strangler swap in three moves: build the adapter and flip the seam while the hand data still exists (legacy equality test), prove the full gate green on the committed swap, then delete the hand data in its own commit"
    - "Adapter modules import the engine through one relative path (../../../engine/index) in a single file (numogram.ts); the other adapter files import BASE10 from it"
    - "Adapter code holds no CCRU text: a test scans every .ts file of app/presets/base10 except lore.ts for the syzygy demon names and descriptions"

key-files:
  created:
    - app/presets/base10/numogram.ts
    - app/presets/base10/syzygies.ts
    - tests/presets/base10-adapter.test.ts
  modified:
    - app/data/syzygies.ts

key-decisions:
  - "The seam keeps the export name SYZYGIES and re-exports the adapter array itself (identity checked with toBe), so no consumer import changed: NumogramClient.tsx, Projection, SyzygiesPanel, InfoDisplay and tests/oracle/deriveBase10.ts are untouched"
  - "The page-weight baseline was NOT touched: the engine now bundled into /numogram/ grew the route by +16,059 bytes raw (+2.8%) and +4,666 gzip (+2.7%), inside the stored tolerance (max(1 KiB, 5%)), so check:weight passed and the plan's conditional baseline update did not apply"
  - "The adapter test also pins that adapter files contain no lore text, because NOTICE section 1 treats them as MIT code and lore text may live only in lore.ts"

patterns-established:
  - "A seam file after its swap is exactly: one comment line and one re-export from app/presets/base10/<source>.ts; later swaps (02-09..02-12) follow the same shape"

requirements-completed: [MIG-01]

# Metrics
duration: 35min
completed: 2026-09-26
---

# Phase 2 Plan 08: Swap 1, Syzygies Summary

**The viewer's five syzygies now come from `createNumogram(10)` (pairs 4::5, 3::6, 2::7, 1::8, 0::9 from `BASE10.pair(id)`, ids descending) joined by pair id with `SYZYGY_LORE`, through the new `app/presets/base10/` adapter; `app/data/syzygies.ts` is a two-line seam and the hand-authored structure is deleted. The swapped data is deep-equal to the frozen f7d6689 file (26 nodes, 20 primitive fields, zero differences, key order a, b, demon, desc), and the full gate (60 DOM goldens, 5 behaviour baselines, numeric oracle, static-export specs) stayed green and unchanged.**

## Performance

- **Duration:** about 35 min (started about 00:14Z, finished about 00:50Z); 19 min of that is the five gate runs below
- **Tasks:** 2 (2 task commits), plus this metadata commit
- **Files:** 3 created, 1 modified (the plan's `files_modified` list minus `perf/page-weight.baseline.json`, which needed no change)

## What was built

### The adapter, and what it reads

```ts
// app/presets/base10/numogram.ts
import { createNumogram } from '../../../engine/index'
export const BASE10 = createNumogram(10)
if (BASE10.torqueCount !== 1 || BASE10.warp === null) throw new Error('base-10 preset: expected exactly one Torque cycle and a Warp')

// app/presets/base10/syzygies.ts   (exported shape: SyzygyData[] = { a, b, demon, desc }[], 5 entries)
export const SYZYGIES: SyzygyData[]   // built once at module load
```

- **From the engine:** `BASE10.pairCount` (5) drives the loop, ids `pairCount - 1` down to 0 (the upstream panel order); `BASE10.pair(id)` gives `lo` (becomes `a`) and `hi` (becomes `b`). `torqueCount` and `warp` are read once for the preset invariant.
- **From lore:** `SYZYGY_LORE[id].demon` and `.desc` by pair id (pair id = low zone); a missing entry throws `base-10 lore missing for syzygy <id>`.
- **Literal key order** `a, b, demon, desc`, plain (unfrozen) objects in a plain array, exactly like the hand data, so consumers see the same shape.
- `app/data/syzygies.ts` (after Task 2) is exactly:

```ts
// Base-10 data seam (MIG-01): syzygies derived by the engine and joined with lore in app/presets/base10/syzygies.ts.
export { SYZYGIES } from '../presets/base10/syzygies'
```

### What was deleted (Task 2, D-08)

The five literal entries `{ a: 4, b: 5, ... }` .. `{ a: 0, b: 9, ... }` and the `LEGACY_SYZYGIES` rename that carried them between the two commits, the `SYZYGY_LORE` and `SyzygyData` imports of the seam, and the legacy comparison of the adapter test. No `tests/legacy` copy exists (D-08): the frozen numeric oracle (reads `SYZYGIES` through `tests/oracle/deriveBase10.ts`, pairs `[[4,5],[3,6],[2,7],[1,8],[0,9]]`), the 60 DOM goldens and the behaviour baseline (Syzygies panel, zone items, lore sweep) guard the values.

## Strict old-versus-new proof (throwaway, not committed)

`git show f7d6689:app/data/syzygies.ts` was written byte-exact into the scratchpad (checked with `cmp`) and compared with `tsx` against the real `app/data/syzygies.ts` on the final tree (at 54ec485). The script walks both values with `Object.is` on primitives and requires equal key sets and key order, equal array lengths and equal prototypes.

| what | result |
|------|--------|
| entries | old 5, new 5 |
| nodes compared (1 array + 5 objects + 20 primitive fields) | 26 |
| primitive fields in the old file (5 x a, b, demon, desc) | 20 |
| order `a::b` | old and new both 4::5 3::6 2::7 1::8 0::9 |
| key order of every entry | a, b, demon, desc (5 of 5) |
| **differences** | **0** |

It also passed on the swap commit (27f0d8e) before the deletion; the text of the demon names and descriptions (including the em-dash escapes in the Djynxx, Murrumur and Uttunul descriptions) is therefore identical to the frozen upstream file, not only to the 02-07 lore module.

## Task Commits

1. **Task 1: Pre-flight gate, base-10 engine instance, syzygies adapter and seam flip** - `27f0d8e` (refactor): `app/presets/base10/numogram.ts`, `app/presets/base10/syzygies.ts`, `app/data/syzygies.ts`, `tests/presets/base10-adapter.test.ts`
2. **Task 2: Delete the hand-authored syzygy data (D-08)** - `54ec485` (refactor): `app/data/syzygies.ts`, `tests/presets/base10-adapter.test.ts`

No `perf(02-08)` commit: the page-weight budget passed unchanged (see below).

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification results (exact, per command)

| when | command | result |
|------|---------|--------|
| pre-flight, HEAD ebab0cc clean | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 250 s**: check:repo OK; typecheck (4x tsc + lint) clean; `test` 25 files 916 tests; `test:tz` 25 files 916 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` 75 passed 5 skipped (60 goldens + 10 static-export + 5 behaviour); `check-repo: OK (... clean-tree, static-out)` |
| TDD RED | `vitest run --project oracle tests/presets/base10-adapter.test.ts` before the adapter existed | the file failed to load (import of `base10/numogram` unresolved), no tests ran |
| Task 1 quick | `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` | 13 files, 438 tests pass (adapter test 8 tests) |
| Task 1 quick | `npm run typecheck` | exit 0 (4x tsc, lint: no warnings or errors) |
| Task 1, uncommitted swap | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 193 s**: build OK; playwright 65 passed 5 skipped (60 DOM goldens both timezones + 5 behaviour on UTC); vitest 26 files 924 tests |
| Task 1 committed (27f0d8e), full gate | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 249 s**: unit 924 in both timezones, basepath e2e 10 passed, `page-weight: OK`, e2e 75 passed 5 skipped, final check-repo OK incl. clean-tree and static-out |
| Task 2 quick | oracle project, `npm run typecheck`, `node scripts/check-repo.mjs` | 13 files 437 tests pass; exit 0; `check-repo: OK` |
| Task 2, uncommitted deletion | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 193 s**: playwright 65 passed 5 skipped (60 goldens + 5 behaviour), vitest 26 files 923 tests |
| final, deletion committed (54ec485), clean tree | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 249 s**: check:repo OK; typecheck clean; `test` 26 files 923 tests; `test:tz` 26 files 923 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` **75 passed, 5 skipped** (60 goldens unchanged + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project); `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

Frozen material (acceptance):

- `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks app/lib e2e/__golden__ engine/test/fixtures/base10.golden.json engine/test/fixtures/MANIFEST.json` exits 0 (also with `app/presets` absent from that list by design). `git diff --name-only f7d6689 -- app` lists only `app/data/{currents,demons,gates,syzygies,zones}.ts` and `app/presets/base10/{lore,numogram,syzygies}.ts`.
- `git diff --quiet b82f6a2 -- e2e/__behaviour__` exits 0; `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` prints `OK 5 files in 1 sets`; `git status --porcelain -- e2e/__behaviour__` prints nothing.
- The only difference under `engine/test/fixtures` against f7d6689 is the two files the derived notable-bases set added in 02-02; nothing frozen changed in this plan (`git diff --quiet 27f0d8e~1 -- engine/test/fixtures e2e/__golden__ e2e/__behaviour__ tests/oracle` exits 0). `tests/oracle/*` is unchanged.
- No `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. Nothing was pushed, fetched or pulled.
- Cleanup: no listener on ports 3000, 3007, 3111, 3112, 3113 afterwards; `.e2e-basepath/` removed after the last verify.

## Page weight (T-02-34)

This is the first swap that imports the engine into the viewer, so the `/numogram/` bundle grew. Measured with `node scripts/page-weight.mjs print` against `perf/page-weight.baseline.json` after the swap:

| route | metric | baseline | now | change |
|-------|--------|----------|-----|--------|
| `/numogram/` | js bytes | 563,909 | 579,968 | +16,059 (+2.8%) |
| `/numogram/` | js gzip | 170,556 | 175,222 | +4,666 (+2.7%) |
| `/` | js bytes / gzip | 416,830 / 128,120 | unchanged | 0 (html gzip +1 byte) |

The tolerance is `max(1 KiB, 5%)`, so the limit is baseline + 28,196 raw and baseline + 8,528 gzip bytes (`limitFor` = base + max(min, ceil(base x pct / 100))); `check:weight` passes and the baseline file was left untouched (no update, no reason to write). **Headroom left for swaps 02-09..02-12: about 12,137 raw and 3,862 gzip bytes** on `/numogram/`; the engine core itself is now in the bundle, so later swaps add mostly adapter code, but 02-12 (demons) is the one to watch. If a later swap fails only `check:weight`, the plan text in 02-09..02-12 already covers the `update --reason` route.

## Decisions Made

See key-decisions above. The plan was followed as written; the only judgement calls were:

- The hand data kept between the two commits was the 02-07 form (literal `a`, `b` with `SYZYGY_LORE[...]` text), renamed to `LEGACY_SYZYGIES`; the f7d6689 original is what the throwaway proof compares against, so the final claim does not rest on the 02-07 lore module alone.
- `it(...)` titles and comments in the adapter test avoid the token `LEGACY_SYZYGIES` after Task 2 (acceptance greps it at 0 in the test file).

## Deviations from Plan

None - plan executed exactly as written. The conditional page-weight step (Task 1 step 6, "if ONLY check:weight fails") did not trigger, so `perf/page-weight.baseline.json` and its `perf(02-08)` commit do not exist; the measured growth is recorded above instead.

Process notes (no effect on the result):

- The file-write tool produced files whose line endings looked doubtful in a first `grep -c` (that pattern counted every line because of how the shell passes the argument); a byte-level check with Python showed 0 CR bytes, 0 non-ASCII bytes and 0 escape sequences in all four files, and `git ls-files --eol` reports `w/lf`. No unicode escape was typed anywhere; the seam and adapter files contain no escape lines at all (the escaped text stays in `lore.ts`, untouched).
- A `git diff --quiet f7d6689 -- ... engine/test/fixtures` (whole directory) is non-zero on purpose since 02-02 added `engine/test/fixtures/derived/`; the plan's acceptance uses `base10.golden.json` and the manifest, which are identical.

## Issues Encountered

None. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None. `SYZYGIES` is fully engine- and lore-derived; nothing is hard-coded, empty or mocked.

## Threat Flags

None. T-02-32 (frozen oracles regenerated): none touched, verified by the diffs above. T-02-33 (lore joined to the wrong pair): the adapter test checks `SYZYGY_LORE[s.a]` and `DEMON_NAMES[BASE10.demons.meshOf(s.b, s.a)]` for every entry, the legacy equality held in Task 1, the f7d6689 deep-equality proof has 0 differences, the behaviour lore sweep passed. T-02-34 (bundle growth): measured and inside tolerance (table above). T-02-35 (consumer edited): `git diff --quiet f7d6689` on NumogramClient.tsx, app/components, app/hooks, app/lib exits 0. No new network, auth, file-access or schema surface: the only new import edge is app -> engine by relative path, and engine still imports nothing from app.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers swap 1 of 5, not MIG-01 as a whole. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Notes for swap 02-09 (currents) and the rest

- **Pattern to copy:** `app/presets/base10/numogram.ts` already exports `BASE10`; a new adapter file imports it (`import { BASE10 } from './numogram'`) and the lore (`from './lore'`), builds the viewer shape once at module load, and the seam re-exports it. Do not import the engine from more than one adapter file.
- **Currents need more than pair ids.** The old `CURRENTS` order is Surge, Hold, Sink, Warp, Plex = pair ids 1, 2, 4, 3, 0 (from 02-07); the seam's `name`/`desc` come from `CURRENT_LORE[pairId]`, but `from`, `to` and the `label` (with the unicode minus escape, e.g. the `8-1=7` style) are viewer structure: the label must be rebuilt byte for byte (build the minus from a char code in a script; never type the escape in a tool argument, the tools decode it). The Plex is drawn from 9 (the pair's even member drawn at 9, see 02-04 notes): check `g.current(pairId)` (`CurrentInfo`) for the engine's from/to before assuming the viewer's `from`.
- **Frozen references:** compare the swapped `CURRENTS` against `git show f7d6689:app/data/currents.ts` with the same throwaway deep-equality technique (the old file has 5 unicode-escape labels; compare runtime strings and also check the raw escape count in the seam if the labels stay literal).
- **Consumers of `CURRENTS`** are `app/components/**` and `tests/oracle/deriveBase10.ts` (via the seam); `tests/e2e-normalizer/behaviour-lore-coverage.test.ts` still reads the five current labels from `app/data/currents` (02-07 note): keep the export name `CURRENTS` or update that import in the same commit.
- **Gate timings on this machine:** `npm run verify` 249-250 s, `npm run test:swap` 193 s; run verify on the committed swap before the deletion commit exactly as here.
- **Page-weight headroom** is in the section above (about 12 KB raw / 3.9 KB gzip left on `/numogram/` before the stored baseline needs a reasoned update).

## Next Phase Readiness

- Ready for swap 2 (02-09, currents). Syzygies are engine-derived and lore-joined, no hand syzygy structure remains, the full gate is green with the 60 goldens, the behaviour baseline and the numeric oracle unchanged.

## Self-Check: PASSED

- FOUND: `app/presets/base10/numogram.ts`, `app/presets/base10/syzygies.ts`, `app/data/syzygies.ts`, `tests/presets/base10-adapter.test.ts`
- FOUND commits: `27f0d8e`, `54ec485`
