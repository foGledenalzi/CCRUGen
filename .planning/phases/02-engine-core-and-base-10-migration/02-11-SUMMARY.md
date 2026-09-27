---
phase: 02-engine-core-and-base-10-migration
plan: 11
subsystem: migration
tags: [base10-adapter, strangler-swap, regions, time-circuit, torque, cycles, frozen-oracle, seam-extension]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-04 createNumogram(10) with cycleOfZone(zone), torques, and Cycle.kind / zones() / pairs(); 02-07 app/presets/base10/lore.ts (CURRENT_LORE by pair id) and the app/data seams; 02-08 BASE10 (app/presets/base10/numogram.ts), the adapter pattern and tests/presets/base10-adapter.test.ts; 02-09 and 02-10 the swap sequence; 02-03 the frozen behaviour baseline and npm run test:swap; 02-02 the independent reference (tests/bruteforce)
provides:
  - app/presets/base10/regions.ts, ZONE_REGION, TC, TC_EDGES, TC_SYZYGIES and TC_CURRENTS derived from the engine's regions (Cycle[]) of createNumogram(10)
  - app/data/zones.ts (ZONE_REGION), app/data/demons.ts (TC) and app/lib/constants.ts (TC_EDGES, TC_CURRENTS, TC_SYZYGIES) as re-exports of the adapter objects; no hand-authored region structure left (D-08)
  - the regions block of tests/presets/base10-adapter.test.ts (frozen oracle, independent reference, order, walk closure, seam identity)
affects: [02-12, 02-13, phase-04-components-engine-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same strangler sequence as 02-08..02-10: adapter + seam flips with the hand values renamed LEGACY_* and kept, full gate green on the committed swap, hand values deleted in their own commit, full gate again"
    - "Engine regions are Cycle[]; the single-Torque viewer shapes are adapter outputs that lean on the BASE10 invariant (one Torque cycle, asserted at load in numogram.ts), while TC itself is built over ALL Torque cycles"
    - "An adapter test may use the independent reference (tests/bruteforce refStructure) to check region kinds, the Torque pairs and the walk against the definitions instead of against the engine's own cycle code"

key-files:
  created:
    - app/presets/base10/regions.ts
  modified:
    - app/data/zones.ts
    - app/data/demons.ts
    - app/lib/constants.ts
    - tests/presets/base10-adapter.test.ts

key-decisions:
  - "Deliberate seam extension beyond app/data/*: app/lib/constants.ts (TC_EDGES, TC_CURRENTS, TC_SYZYGIES become re-exports of app/presets/base10/regions.ts) is now the ONE file under app/lib that differs from f7d6689. This extends the D-01 data seam by one file, as the plan states, because the three time-circuit constants live there and Projection.tsx, RegionsPanel.tsx, ZonesPanel.tsx and InfoDisplay.tsx import them from there. Consequence for every later acceptance check: `git diff --quiet f7d6689 -- app/lib` exits 1 from 77be052 on; the check is now `git diff --name-only f7d6689 -- app/lib` must list exactly `app/lib/constants.ts` (done: it does). TWEEN_DURATION and REGION_CLR are byte-for-byte the old values; no other lib file, component, hook, NumogramClient.tsx or app/components/projection/** changed"
  - "The seams keep their export names and object shapes and re-export the adapter's very objects (toBe): ZONE_REGION (Record<number, Region>) from app/data/zones, TC (Set<number>) from app/data/demons, TC_EDGES / TC_SYZYGIES (number pairs) and TC_CURRENTS (Set<string>) from app/lib/constants; NumogramClient.tsx, InfoDisplay.tsx, ZonesPanel.tsx, Projection.tsx, RegionsPanel.tsx and tests/oracle/deriveBase10.ts are untouched"
  - "ZONE_REGION[z] = BASE10.cycleOfZone(z).kind for z = 0..zoneCount-1 (the engine kinds are exactly the viewer's Region strings); TC = the zones of all Torque cycles sorted ascending; TC_EDGES = the closed walk of BASE10.torques[0].zones() (odd then even member of each pair in flow order); TC_SYZYGIES = the Torque pairs as [lo, hi] in flow order; TC_CURRENTS = CURRENT_LORE[pairId].name for those pairs in flow order, so the names come from the lore module by id and the adapter holds no name literal"
  - "The page-weight baseline was NOT touched: /numogram/ is +16,805 bytes raw (+3.0%) and +4,804 gzip (+2.8%) over the stored baseline, inside max(1 KiB, 5%); this swap alone added +255 raw and +0 gzip"

patterns-established:
  - "A seam may reach one file beyond app/data when a data constant lives in a data-like lib module (here app/lib/constants.ts); the acceptance then names the single allowed file instead of asserting an empty diff"

requirements-completed: [MIG-01]

# Metrics
duration: 32min
completed: 2026-09-26
---

# Phase 2 Plan 11: Swap 4, Regions and Zones Summary

**The viewer's region data now comes from the engine's cycles of `createNumogram(10)`: `ZONE_REGION` is the kind of each zone's cycle, `TC` the Torque zones, `TC_EDGES` the closed Torque walk (1-8-7-2-5-4-1), `TC_SYZYGIES` the Torque pairs in flow order and `TC_CURRENTS` the lore names of the Torque currents (Surge, Hold, Sink), all built once in `app/presets/base10/regions.ts` and re-exported by `app/data/zones.ts`, `app/data/demons.ts` and `app/lib/constants.ts`; the hand-authored region table, Torque set and time-circuit literals are deleted. Every export of the old files equals the frozen f7d6689 values (471 nodes, 386 primitive fields, 0 differences), and the full gate (60 DOM goldens including region-* and time-circuit states, 5 behaviour baselines, numeric oracle, static-export specs) stayed green and unchanged.**

## Performance

- **Duration:** about 32 min (started about 01:45Z, finished about 02:17Z); about 21 of that is the five gate runs below
- **Tasks:** 2 (2 task commits), plus this metadata commit
- **Files:** 1 created, 4 modified (exactly the plan's `files_modified` list)

## What was built

### The adapter, what it reads, and its exported shapes

```ts
// app/presets/base10/regions.ts (imports: Region type, CURRENT_LORE from ./lore, BASE10 from ./numogram; no engine barrel import)
export const ZONE_REGION: Record<number, Region>   // keys 0..9 ascending; plex, torque, torque, warp, torque, torque, warp, torque, torque, plex
export const TC: Set<number>                        // insertion order 1, 2, 4, 5, 7, 8
export const TC_EDGES: [number, number][]           // [1,8] [8,7] [7,2] [2,5] [5,4] [4,1]
export const TC_SYZYGIES: [number, number][]        // [1,8] [2,7] [4,5]
export const TC_CURRENTS: Set<string>               // insertion order Surge, Hold, Sink
```

- **From the engine (`BASE10 = createNumogram(10)`):** `BASE10.zoneCount` and `BASE10.cycleOfZone(zone).kind` (ZONE_REGION); `BASE10.torques` with every Torque cycle's `zones()` sorted ascending (TC); `BASE10.torques[0]` with `zones()` = the walk 1, 8, 7, 2, 5, 4 (TC_EDGES: every zone to the next, the last back to the first) and `pairs()` = pair ids 1, 2, 4 in flow order with `BASE10.pair(p)` giving `lo` and `hi` (TC_SYZYGIES).
- **From lore (by pair id):** `CURRENT_LORE[p].name` (a missing entry throws `base-10 lore missing for current <p>`), so TC_CURRENTS holds the Torque currents' names in flow order without any name literal in the adapter.
- **Invariant:** the adapter reads `BASE10.torques[0]` and throws at load if there is none; that there is exactly one Torque cycle at base 10 is already asserted in `numogram.ts`. The engine itself never assumes one Torque (`TC` is built over all of them); the single-Torque shapes exist only because the viewer's types are single-Torque, and Phase 4 replaces them.
- Plain objects, arrays and Sets built once at module load, in the literal insertion order of the old values; no lore text, no escape sequence, no non-ASCII byte (byte-checked), no engine barrel import.
- Seams after Task 2:

```ts
// app/data/zones.ts        : lore re-exports (ZONE_CLR, ZONE_PARTICLE, PLANET_SYMBOL, ZONE_META) + export { ZONE_REGION } from '../presets/base10/regions'
// app/data/demons.ts       : export { TC } from '../presets/base10/regions' (+ the same import for the still-hand ALL_DEMONS builder, plan 02-12 replaces it)
// app/lib/constants.ts     : export { TC_EDGES, TC_CURRENTS, TC_SYZYGIES } from '../presets/base10/regions'; TWEEN_DURATION = 600 and REGION_CLR unchanged
```

### What was deleted (Task 2, D-08)

`LEGACY_ZONE_REGION` and the now-unused `Region` import in `app/data/zones.ts`, `LEGACY_TC` (the `new Set([1, 2, 4, 5, 7, 8])` literal) in `app/data/demons.ts`, the three `LEGACY_TC_EDGES` / `LEGACY_TC_CURRENTS` / `LEGACY_TC_SYZYGIES` literals in `app/lib/constants.ts`, and the legacy comparison test. No `tests/legacy` copy exists (D-08): the frozen numeric oracle (`zoneRegion`, `regions`, `tc` in `base10.golden.json`, read through `tests/oracle/deriveBase10.ts` which imports these seams), the 60 DOM goldens (region-plex, region-warp, region-torque, time-circuit) and the behaviour baseline guard the values.

### Tests (tests/presets/base10-adapter.test.ts, `describe('regions')`, written first)

RED was confirmed: before the adapter existed the file failed to load (`Cannot find module '../../app/presets/base10/regions'`, no tests ran). Nine tests then went green (eight remain after the deletion):

1. `ZONE_REGION` equals the frozen oracle `zoneRegion` (keys 0..9 ascending, exact Region strings);
2. `ZONE_REGION[z]` equals `BASE10.cycleOfZone(z).kind` and regroups into the oracle `regions` {plex, torque, warp};
3. `ZONE_REGION` equals the kind of each zone in the independent reference (`refStructure(10)`, definitions only);
4. `TC` is a Set with insertion order 1, 2, 4, 5, 7, 8, equal to the oracle `tc.zones` and to the reference's Torque zones;
5. `TC_EDGES` equals the six edges, the oracle `tc.edges`, a walk rebuilt from the reference Torque cycle (odd member then even member of each pair in flow order), and is closed and connected;
6. `TC_SYZYGIES` equals `[[1, 8], [2, 7], [4, 5]]`, the oracle `tc.syzygies`, sums to base - 1 and matches the reference Torque pairs with their partners;
7. `Array.from(TC_CURRENTS)` equals `['Surge', 'Hold', 'Sink']`, sorted equals the oracle `tc.currents`, equals the lore names of `TC_SYZYGIES` by pair id, and every one is a viewer current drawn from a Torque zone;
8. equality with the hand values (`LEGACY_*`, shape, values and insertion order), removed in Task 2;
9. the seam exports are the adapter's very objects (`toBe`) for all five.

The adapter-file lore scan now also requires `regions.ts` to exist in `app/presets/base10/`.

Mutation check (throwaway script, tree restored byte-identical afterwards, `cmp` verified): nine mutants of `regions.ts` were all killed by the new tests: reversed walk (2 failures), last edge dropped (2), walk sorted ascending (2), warp reported as plex (4), zones filled in descending order (4), currents sorted alphabetically (2), syzygies as [hi, lo] (3), TC over all cycles instead of the Torque cycles (2), TC not sorted (2).

## Strict old-versus-new proof (throwaway, not committed)

`git show f7d6689:app/data/zones.ts`, `app/data/demons.ts`, `app/data/types.ts` and `app/lib/constants.ts` were written byte-exact into the scratchpad (sizes checked against the blobs: 7,169, 1,403, 1,571 and 421 bytes) and compared with `tsx` against the real modules on the uncommitted swap state (the seams then also exported the `LEGACY_*` names, the only reported "extra" exports) and again on the final tree at 258b440 (exit 0). The script walks both values with `Object.is` on primitives and requires equal key sets and key order, equal array lengths, equal prototypes and `typeof`; Sets are compared by size, prototype and insertion-ordered elements.

| what | result |
|------|--------|
| `app/data/zones.ts` exports (old and final new) | PLANET_SYMBOL, ZONE_CLR, ZONE_META, ZONE_PARTICLE, ZONE_REGION (missing 0, extra 0); ZONE_REGION 11 nodes / 10 primitive fields; the four lore exports also equal the old file (ZONE_META 156 nodes / 135 fields) |
| `app/data/demons.ts` | old exports ALL_DEMONS, DEMON_NAMES, TC; final new ALL_DEMONS, TC (DEMON_NAMES was removed by 02-07 as unimported); TC 7 nodes / 6 fields (Set of 1, 2, 4, 5, 7, 8 in that order); ALL_DEMONS (still hand-built from the adapter's TC) 226 nodes / 180 fields |
| `app/lib/constants.ts` exports (old and final new) | REGION_CLR, TC_CURRENTS, TC_EDGES, TC_SYZYGIES, TWEEN_DURATION (missing 0, extra 0); TC_EDGES 19 nodes / 12 fields, TC_CURRENTS 4 / 3 (Surge, Hold, Sink in order), TC_SYZYGIES 10 / 6, REGION_CLR 4 / 3, TWEEN_DURATION 1 / 1 |
| ZONE_REGION key order and values | keys 0..9, values plex, torque, torque, warp, torque, torque, warp, torque, torque, plex, identical |
| total | **471 nodes, 386 primitive fields, 0 differences, export problems 0** |

## Task Commits

1. **Task 1: Regions adapter and seam flips (swap commit)** - `77be052` (refactor): `app/presets/base10/regions.ts`, `app/data/zones.ts`, `app/data/demons.ts`, `app/lib/constants.ts`, `tests/presets/base10-adapter.test.ts`
2. **Task 2: Delete the hand-authored region data (D-08)** - `258b440` (refactor): `app/data/zones.ts`, `app/data/demons.ts`, `app/lib/constants.ts`, `tests/presets/base10-adapter.test.ts`

No `perf(02-11)` commit: the page-weight budget passed unchanged (see below).

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification results (exact, per command)

| when | command | result |
|------|---------|--------|
| pre-flight, HEAD 5cb9f25 clean | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 (about 250 s)**: check:repo OK; typecheck (4x tsc + lint) clean; `test` 26 files 939 tests; `test:tz` 26 files 939 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` 75 passed 5 skipped; `check-repo: OK (... clean-tree, static-out)` |
| TDD RED | `vitest run --project oracle tests/presets/base10-adapter.test.ts` before the adapter existed | the file failed to load (`Cannot find module '../../app/presets/base10/regions'`), no tests ran |
| Task 1 quick | `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` | 13 files, 462 tests pass (453 + 9 new) |
| Task 1 quick | `npm run typecheck` | exit 0 (4x tsc, lint: no warnings or errors) |
| Task 1, uncommitted swap | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 194 s**: build OK; playwright 65 passed 5 skipped (60 DOM goldens both timezones + 5 behaviour on UTC); vitest 26 files 948 tests |
| Task 1 committed (77be052), full gate | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 250 s**: unit 948 in both timezones, basepath e2e 10 passed, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 75 passed 5 skipped, final check-repo OK incl. clean-tree and static-out |
| Task 2 quick | oracle project, `npm run typecheck`, `node scripts/check-repo.mjs` | 13 files 461 tests pass; exit 0 (lint clean); `check-repo: OK` |
| Task 2, uncommitted deletion | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 193 s**: playwright 65 passed 5 skipped (60 goldens + 5 behaviour), vitest 26 files 947 tests |
| final, deletion committed (258b440), clean tree | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 250 s**: check:repo OK; typecheck clean; `test` 26 files 947 tests; `test:tz` 26 files 947 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` **75 passed, 5 skipped** (60 goldens unchanged + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project); `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

Test count: 939 before, 948 after the swap (the regions block adds 9 tests), 947 after the deletion (the legacy comparison goes).

Frozen material (acceptance, checked after the swap commit and again after the final verify):

- `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks e2e/__golden__ engine/test/fixtures/base10.golden.json` exits 0 (also `app/components/projection` alone).
- `git diff --name-only f7d6689 -- app/lib` prints exactly `app/lib/constants.ts` (the deliberate seam extension, see Decisions). `git diff --name-only f7d6689 -- app` lists `app/data/{currents,demons,gates,syzygies,zones}.ts`, `app/lib/constants.ts` and `app/presets/base10/{currents,gates,lore,numogram,regions,syzygies}.ts` and nothing else.
- `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` prints `OK 5 files in 1 sets`; `git status --porcelain -- e2e/__behaviour__` prints nothing; `git diff --quiet ebab0cc -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures tests/oracle app/components app/hooks app/NumogramClient.tsx` exits 0 (nothing frozen or consumer-side changed since the pre-swap-1 state); `perf/` untouched.
- No `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. Nothing was pushed, fetched or pulled.
- Cleanup: no listener on ports 3000, 3007, 3111, 3112, 3113 afterwards; `.e2e-basepath/` removed after every verify.

## Page weight (T-02-42 style check)

Measured with `node scripts/page-weight.mjs print` against `perf/page-weight.baseline.json`:

| route | metric | baseline | after 02-10 | now (258b440) | vs baseline | this swap |
|-------|--------|----------|-------------|---------------|-------------|-----------|
| `/numogram/` | js bytes | 563,909 | 580,459 | 580,714 | +16,805 (+3.0%) | +255 |
| `/numogram/` | js gzip | 170,556 | 175,360 | 175,360 | +4,804 (+2.8%) | 0 |
| `/` | js bytes / gzip | 416,830 / 128,120 | unchanged | unchanged | 0 | 0 |

The swap commit (77be052) and the deletion commit (258b440) build to the same JS sizes (the unused `LEGACY_*` exports are tree-shaken). Tolerance `max(1 KiB, 5%)`: limits are baseline + 28,196 raw and + 8,528 gzip, so the headroom left for swap 02-12 is **about 11,391 raw and 3,724 gzip bytes** on `/numogram/`. `check:weight` passed on every run and the baseline file was not touched. 02-12 (demons) is the swap to watch. Side observation: at the swap commit the `/numogram/` CSS was 21 raw bytes larger (18,398) than the baseline (the word "table" in a `LEGACY` comment in `app/**` is a Tailwind candidate for the `table` utility); after the deletion it is back to the baseline 18,377.

## Decisions Made

See key-decisions above, especially the recorded seam extension to `app/lib/constants.ts`. Judgement calls:

- The builders are arrow-function constants after a single top-level `TORQUE` narrowing (`const TORQUE = BASE10.torques[0]` plus a throw when undefined), so no non-null assertions are needed and TypeScript keeps the narrowing inside them.
- `TC` is built over `BASE10.torques.flatMap(...)` (all Torque cycles), matching the plan's "all Torque cycles' zones sorted ascending", while the other three constants read the single Torque cycle `torques[0]` as the plan's derivation says.
- The test uses the independent reference for the region kinds, the Torque pairs and the walk (rebuilt as the odd member then the even member of each reference pair), in addition to the frozen oracle, so a shared bug between the engine's cycle code and this adapter cannot pass unnoticed.
- The plan's Task 1 acceptance asks the test file to contain `LEGACY_TC_EDGES`; it does at 77be052 and Task 2 removes it, as the plan's Task 2 requires.

## Deviations from Plan

None - plan executed exactly as written. The conditional page-weight step did not trigger, so `perf/page-weight.baseline.json` and any `perf(02-11)` commit do not exist.

Process notes (no effect on the result):

- The working-tree copy of `app/lib/constants.ts` had CRLF line endings (git's index holds LF, `.gitattributes` says `eol=lf`, so `git status` was clean). The file was rewritten with LF; `git diff` shows only the intended change and the byte check (0 CR, 0 escape sequences, 0 non-ASCII) passed.
- `python3` is not available in this shell; byte checks were done with a `node` script (backslash built from a char code, never typed).
- The pre-flight verify, run as a background shell job, was waited on with an until-loop on its log; nothing was edited in the tree while any gate ran (drafts and proofs stayed in the scratchpad).

## Issues Encountered

None. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None. `ZONE_REGION`, `TC`, `TC_EDGES`, `TC_SYZYGIES` and `TC_CURRENTS` are fully engine- and lore-derived; nothing is hard-coded, empty or mocked. The still-hand `ALL_DEMONS` builder in `app/data/demons.ts` is the scope of plan 02-12, not a stub of this plan.

## Threat Flags

None. T-02-42 (walk order of TC_EDGES, region kinds): deep equality with the hand literals before deletion (Task 1 test), the frozen oracle `tc` and `zoneRegion`, the independent reference, the f7d6689 deep-equality proof (0 differences), nine killed mutants, and the DOM goldens region-* and time-circuit plus the behaviour baseline passed. T-02-43 (component-level 10-zone logic touched out of scope): `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks` exits 0 and `app/lib` differs only in `constants.ts`. T-02-44 (goldens regenerated): none touched, verified by the diffs above. No new network, auth, file-access or schema surface: the new import edge is app/lib -> app/presets (app code to app code by relative path), and the engine imports nothing from app.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers swap 4 of 5, not MIG-01 as a whole. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Notes for swap 02-12 (demons) and the rest

- **The `ALL_DEMONS` builder** is still hand-built in `app/data/demons.ts`: a double loop `for i = 1..9, j = 0..i-1` that pushes `{ a: i, b: j, name: DEMON_NAMES[i * (i - 1) / 2 + j] || '?', kind }`, so the array is in ascending mesh order (mesh = a(a-1)/2 + b) and `name` comes from `DEMON_NAMES` in `lore.ts` by mesh number. Its `kind` mapping (the viewer's own classification, D-CONTEXT "locked earlier"): `i + j === 9` gives `'syzygy'` (the 3 syzygetic chrono + 2 syzygetic xeno), else both zones in `TC` gives `'chrono'`, neither in `TC` gives `'xeno'`, else `'amphi'`. It imports `TC` from `../presets/base10/regions` (it no longer owns any Torque set), and `tests/oracle/deriveBase10.ts` reads `ALL_DEMONS` and `TC` through the seam (`syzygeticBy` and `amphiBy` use `TC` and `ZONE_REGION`).
- **`TC` is now an engine-derived `Set<number>` re-exported by `app/data/demons.ts`**; plan 02-12 can keep that re-export, and if the builder moves into an adapter file it can import `TC` and `ZONE_REGION` from `./regions` or derive the kind from the engine demon subtypes (syzygy = syzygetic chrono + syzygetic xeno).
- **Page-weight headroom** is in the section above (about 11.4 KB raw and 3.7 KB gzip left on `/numogram/` before the stored baseline needs a reasoned `update --reason`; the demons swap replaces a 45-entry loop, so watch it and follow the plan's conditional baseline-update rule only if the growth is explained by that swap).
- **Acceptance for app/lib:** from this plan on use `git diff --name-only f7d6689 -- app/lib` (must list only `app/lib/constants.ts`), not the `--quiet` form.
- **Pattern to copy:** a new adapter file under `app/presets/base10/` imports `BASE10` from `./numogram` (and, if it needs a formatter, from the engine barrel `../../../engine/index`), builds the viewer shape once at module load, and the seam re-exports it; write the tests first (import of the missing adapter fails, RED), keep the hand data as `LEGACY_*` for the first commit, run `test:swap`, commit, `verify` on the committed swap, delete in a second commit, `test:swap`, quick checks and a final `verify`.
- **Never type a unicode escape sequence** in a Write/Edit argument: build the backslash from a char code in a script and check the bytes (there is no `python3` here; `node` works for byte counts). Do not edit the repo while a gate runs (`verify` ends with `--clean-tree`); keep drafts in the scratchpad.
- **Gate timings on this machine:** `npm run verify` 250 s, `npm run test:swap` 193-194 s. Test count now 947 in both timezones (26 files).

## Next Phase Readiness

- Ready for swap 5 (02-12, demons). Syzygies, currents, gates and regions are engine-derived and lore-joined, no hand structure remains for any of the four, the full gate is green with the 60 goldens, the behaviour baseline and the numeric oracle unchanged.

## Self-Check: PASSED

- FOUND: `app/presets/base10/regions.ts`, `app/data/zones.ts`, `app/data/demons.ts`, `app/lib/constants.ts`, `tests/presets/base10-adapter.test.ts`
- FOUND commits: `77be052`, `258b440`
