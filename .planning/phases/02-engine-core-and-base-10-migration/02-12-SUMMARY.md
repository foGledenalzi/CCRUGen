---
phase: 02-engine-core-and-base-10-migration
plan: 12
subsystem: migration
tags: [base10-adapter, strangler-swap, demons, demon-space, mesh-number, legacy-kind, frozen-oracle]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-05 the virtual demon space (BASE10.demons.count / at(mesh) with subtypes incl. cross-torque-chrono); 02-07 app/presets/base10/lore.ts (DEMON_NAMES keyed by mesh number) and the app/data seams; 02-08 BASE10 (app/presets/base10/numogram.ts), the adapter pattern and tests/presets/base10-adapter.test.ts; 02-09..02-11 the swap sequence and the regions adapter (TC); 02-03 the frozen behaviour baseline and npm run test:swap; 02-02 the independent reference (tests/bruteforce)
provides:
  - app/presets/base10/demons.ts, ALL_DEMONS (45 demons from BASE10.demons.at(m), named by DEMON_NAMES[m]) and legacyKind(subtype), the viewer's own kind classification derived from the engine subtypes
  - app/data/demons.ts as a three-line seam (comment, ALL_DEMONS from the demons adapter, TC from the regions adapter); no hand-authored demon structure left (D-08)
  - the demons block of tests/presets/base10-adapter.test.ts (frozen oracle, independent reference, subtype split, kind mapping, lemur-list join check, seam identity)
  - MIG-01 strangler step 5 of 5: syzygies, currents, gates, regions and demons are all engine-derived and lore-joined by id
affects: [02-13, phase-04-components-engine-driven, phase-05-demon-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same strangler sequence as 02-08..02-11: adapter + seam flip with the hand builder renamed LEGACY_ALL_DEMONS, deep equality against it in the test, test:swap, commit, full gate on the committed swap, deletion in its own commit, test:swap, quick checks, final full gate"
    - "The demon list is a base-10 compatibility list built once at load from the virtual demon space (count 45); the generic engine never materializes demons"
    - "A second, independent path to the joined names: the per-zone lemur lists of the lore module must equal the adapter's demons of that zone ('a::b Name', b ascending), so a mesh mis-join cannot pass even though no golden reads demon names"

key-files:
  created:
    - app/presets/base10/demons.ts
  modified:
    - app/data/demons.ts
    - tests/presets/base10-adapter.test.ts

key-decisions:
  - "Kind mapping implemented exactly as the plan locked it, as an exhaustive switch over the seven engine subtypes (with a never-typed default that throws): syzygetic-chrono and syzygetic-xeno -> 'syzygy'; cyclic-chrono and cross-torque-chrono -> 'chrono'; plex-amphi and warp-amphi -> 'amphi'; chaotic-xeno -> 'xeno'. At base 10 this yields amphi 24, chrono 12 (= the 12 cyclic), syzygy 5 (= 3 syzygetic chrono 5::4, 7::2, 8::1 + 2 syzygetic xeno 6::3, 9::0), xeno 4 (= the 4 chaotic)"
  - "The name join is by MESH number, not by the old 'a:b' string key: entry m is BASE10.demons.at(m) and its name is DEMON_NAMES[m]; a missing name throws 'base-10 lore missing for demon mesh <m>' (no placeholder fallback; the old builder's fallback name is gone). The old file's own a:b-keyed table (a different key path) is what the strict f7d6689 comparison uses as ground truth"
  - "TC stays re-exported from the regions adapter by app/data/demons.ts (consumers and tests/oracle/deriveBase10.ts import it from there); the demons adapter does not import TC or ZONE_REGION at all, the kind comes from the engine subtypes only"
  - "The page-weight baseline was NOT touched: /numogram/ is +17,113 bytes raw (+3.03%) and +4,890 gzip (+2.87%) over the stored baseline, inside max(1 KiB, 5%); this swap alone added +308 raw and +86 gzip over the state after 02-11"

patterns-established:
  - "An adapter test can cross-check a lore join through a second lore path (per-zone lemur lists) when no golden or baseline reads the joined field"

requirements-completed: [MIG-01]

# Metrics
duration: 28min
completed: 2026-09-26
---

# Phase 2 Plan 12: Swap 5, Demons Summary

**The viewer's 45 demons now come from the engine's virtual demon space: `app/presets/base10/demons.ts` builds `ALL_DEMONS` once at load from `BASE10.demons.at(m)` for mesh 0 (1::0) to 44 (9::8), names each by `DEMON_NAMES[m]` and gives it the viewer's own `kind` through `legacyKind(subtype)` (syzygetic chrono and xeno = syzygy, cyclic and cross-Torque = chrono, Plex and Warp amphi = amphi, chaotic = xeno); `app/data/demons.ts` is a three-line seam and the hand-typed double loop with its fallback name is deleted. The full gate (60 DOM goldens including the layer-pandemonium states, 5 behaviour baselines, numeric oracle) stayed green and unchanged, and ALL_DEMONS and TC equal the frozen f7d6689 values (233 nodes, 186 primitive fields, 0 differences). All five base-10 data sources are now engine-derived.**

## Performance

- **Duration:** about 28 min (started about 02:18Z, finished about 02:46Z); about 17 of that is the five gate runs below
- **Tasks:** 2 (2 task commits), plus this metadata commit
- **Files:** 1 created, 2 modified (exactly the plan's `files_modified` list)

## What was built

### The adapter, what it reads, and its exported shape

```ts
// app/presets/base10/demons.ts (imports: DemonSubtype type from the engine barrel, Demon type, DEMON_NAMES from ./lore, BASE10 from ./numogram)
export type LegacyDemonKind = 'syzygy' | 'chrono' | 'amphi' | 'xeno'
export function legacyKind(subtype: DemonSubtype): LegacyDemonKind   // exhaustive switch over the 7 subtypes
export const ALL_DEMONS: Demon[]                                       // 45 entries { a, b, name, kind }, key order a, b, name, kind
```

- **From the engine (`BASE10 = createNumogram(10)`):** `BASE10.demons.count` (45) and, for m = 0..44 ascending, `BASE10.demons.at(m)` giving `a`, `b` and `subtype` (the returned `mesh` equals m, asserted in the test). The value import of the engine barrel is not needed here (`DemonSubtype` is a type-only import, erased), so `numogram.ts`, `currents.ts` and `gates.ts` remain the only app files with a value import of the engine.
- **From lore (by mesh number):** `DEMON_NAMES[m]` (0 = 1::0 ... 44 = 9::8); the adapter holds no demon name literal (a test scans every adapter file for a quoted literal of each of the 45 names).
- **Only base 10:** the list has 45 items, computed from the virtual space; nothing in the engine or the adapter builds an n^2 structure for any other base (T-02-47). Phases 4 and 5 replace it.
- Seam after Task 2:

```ts
// app/data/demons.ts (3 lines, 276 bytes)
// Base-10 data seam (MIG-01): demons from the engine's demon space joined with names in app/presets/base10/demons.ts; the Torque zone set from app/presets/base10/regions.ts.
export { ALL_DEMONS } from '../presets/base10/demons'
export { TC } from '../presets/base10/regions'
```

### What was deleted (Task 2, D-08)

The import-time builder in `app/data/demons.ts` (the double loop `for i = 1..9, j = 0..i-1`, the hand kind rule over `TC`, the `'?'` fallback name) together with its `DEMON_NAMES` and `TC` imports, and the legacy comparison test. No `tests/legacy` copy exists (D-08): the frozen numeric oracle (`demons` with all 45 names and kinds, `kinds`, `demonCount` in `base10.golden.json`, read through `tests/oracle/deriveBase10.ts`, which is unchanged and still passes) and the DOM goldens guard the values.

### Tests (tests/presets/base10-adapter.test.ts, `describe('demons')`, written first)

RED was confirmed: before the adapter existed the file failed to load (`Cannot find module '../../app/presets/base10/demons'`, no tests ran). Twelve tests then went green (eleven remain after the deletion):

1. the 45 demons equal the frozen oracle `demons` (a, b, net-span, kind, name) in order, with `demonCount` 45;
2. entry m is the demon of mesh m: `BASE10.demons.at(m).mesh` = m, (a, b) equal the engine's, mesh by definition a(a-1)/2 + b, a > b, `name` = `DEMON_NAMES[m]`, and the (a, b) order equals the enumeration order of the independent reference (`refDemons`);
3. key order is exactly `a, b, name, kind` for all 45;
4. every name is non-empty and not the old placeholder, and the second, independent join check: `ZONE_META[z].lemurs` (the lore module's per-zone lists, `'a::b Name'`) equals the adapter's demons of zone z for z = 1..9 (zone 0 has none);
5. kind counts `{ amphi: 24, chrono: 12, syzygy: 5, xeno: 4 }`, equal to the frozen oracle `kinds`;
6. the engine subtype counts are 12 cyclic + 3 syzygetic (chrono), 12 Plex + 12 Warp (amphi), 4 chaotic + 2 syzygetic (xeno), 0 cross-Torque; the demon list's subtype tally equals them and each kind group has the size of its subtypes (chrono 12, syzygy 3 + 2, amphi 12 + 12, xeno 4);
7. kind `syzygy` is exactly the five nine-sum demons 5::4, 6::3, 7::2, 8::1, 9::0 (mesh order), whose engine subtypes AND independent reference subtypes are syzygetic chrono, xeno, chrono, chrono, xeno;
8. `legacyKind` maps all seven subtypes (checked against an expected table typed `Record<DemonSubtype, LegacyDemonKind>` so a new subtype breaks the compile), including `cross-torque-chrono` -> `chrono` which no base-10 demon exercises;
9. every demon's kind equals both the viewer's rule written from the definitions (nine-sum = syzygy, both zones in the reference Torque = chrono, neither = xeno, else amphi) and the mapping of the reference subtype (`refDemons`), demon by demon;
10. the two viewer views: the pandemonium layer's `kind !== 'syzygy'` selection has 40 demons and each zone's `a === zone || b === zone` selection has 9;
11. equality with the hand builder (`toStrictEqual` plus key order), removed in Task 2;
12. the seam's `ALL_DEMONS` is the adapter's very array (`toBe`).

The adapter-file lore scan now also requires `demons.ts` to exist and scans every adapter file for a quoted literal of each of the 45 demon names.

Mutation check (throwaway script, `app/presets/base10/demons.ts` restored byte-identical afterwards, `cmp` verified): eleven mutants, all killed by the adapter tests plus the oracle tests: syzygetic xeno mapped to xeno (9 failing tests), cross-torque-chrono to amphi (1: only the legacyKind test can see it, base 10 has no such demon), plex-amphi to chrono (7), names shifted by one mesh (5), descending mesh order (7), a and b swapped (6), key order a, name, b, kind (2), chaotic xeno to amphi (7), syzygetic chrono to chrono (9), mesh 0 skipped (9), warp-amphi to xeno (7).

## Strict old-versus-new proof (throwaway, not committed)

`git show f7d6689:app/data/demons.ts` and `app/data/types.ts` were written byte-exact into the scratchpad (sizes checked against the blobs: 1,403 and 1,571 bytes) and compared with `tsx` against the real modules, first on the committed swap state (where the seam also exported `LEGACY_ALL_DEMONS`, the only reported extra export) and again on the final tree. The script walks both values with `Object.is` on primitives and requires equal `typeof`, prototypes, key sets and key order, equal array lengths, and for Sets equal size and insertion-ordered elements. The old file's names come from its own `'a:b'`-keyed table, a different key path from the new mesh join, so the comparison is a real cross-check of the join.

| what | result |
|------|--------|
| exports | old: ALL_DEMONS, DEMON_NAMES, TC; final new: ALL_DEMONS, TC (DEMON_NAMES was removed by 02-07 as unimported); compared exports missing from the new module: 0 |
| ALL_DEMONS | 45 entries, 226 nodes, 180 primitive fields, key order a, b, name, kind in both; kind tally amphi 24, chrono 12, xeno 4, syzygy 5 in both |
| TC | 7 nodes, 6 primitive fields, Set order 1, 2, 4, 5, 7, 8 in both |
| total | **233 nodes, 186 primitive fields, 0 differences** (swap state and final tree) |

## Task Commits

1. **Task 1: Demons adapter with legacyKind and seam flip (swap commit)** - `f54f92b` (refactor): `app/presets/base10/demons.ts`, `app/data/demons.ts`, `tests/presets/base10-adapter.test.ts`
2. **Task 2: Delete the import-time demon builder (D-08)** - `d0cbf2a` (refactor): `app/data/demons.ts`, `tests/presets/base10-adapter.test.ts`

No `perf(02-12)` commit: the page-weight budget passed unchanged (see below).

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification results (exact, per command)

| when | command | result |
|------|---------|--------|
| pre-flight, HEAD 12d91db clean | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 (about 260 s)**: check:repo OK; typecheck (4x tsc + lint) clean; `test` 26 files 947 tests; `test:tz` 26 files 947 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` 75 passed 5 skipped; `check-repo: OK (... clean-tree, static-out)` |
| TDD RED | `vitest run --project oracle tests/presets/base10-adapter.test.ts` before the adapter existed | the file failed to load (`Cannot find module '../../app/presets/base10/demons'`), no tests ran |
| Task 1 quick | `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` | 13 files, 473 tests pass (461 + 12 new) |
| Task 1 quick | `npm run typecheck` | 4x tsc clean, lint: no warnings or errors |
| Task 1, uncommitted swap | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in about 195 s**: build OK; playwright 65 passed 5 skipped (60 DOM goldens both timezones + 5 behaviour on UTC); vitest 26 files 959 tests |
| Task 1 committed (f54f92b), full gate | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 257 s**: unit 959 in both timezones, basepath e2e 10 passed, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 75 passed 5 skipped, final check-repo OK incl. clean-tree and static-out |
| Task 2 quick | oracle project, `npm run typecheck`, `node scripts/check-repo.mjs` | 13 files 472 tests pass; typecheck and lint clean; `check-repo: OK` |
| Task 2 acceptance greps | `grep -cE "for \(\|push\(\|LEGACY\|'\?'" app/data/demons.ts`, non-empty lines, `grep -c LEGACY_ALL_DEMONS` in the test | 0; 3 non-empty lines (limit 4); 0 |
| Task 2, uncommitted deletion | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 195 s**: playwright 65 passed 5 skipped (60 goldens + 5 behaviour), vitest 26 files 958 tests |
| final, deletion committed (d0cbf2a), clean tree | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 252 s**: check:repo OK; typecheck clean; `test` 26 files 958 tests; `test:tz` 26 files 958 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` **75 passed, 5 skipped** (60 goldens unchanged + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project); `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

Test count: 947 before, 959 after the swap (the demons block adds 12 tests), 958 after the deletion (the legacy comparison goes).

Frozen material (acceptance, checked after the swap commit and again on the final tree):

- `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks e2e/__golden__ engine/test/fixtures/base10.golden.json` exits 0 (also `app/components/projection` alone).
- `git diff --name-only f7d6689 -- app/lib` prints exactly `app/lib/constants.ts` (the 02-11 seam extension). `git diff --name-only f7d6689 -- app` lists `app/data/{currents,demons,gates,syzygies,zones}.ts`, `app/lib/constants.ts` and `app/presets/base10/{currents,demons,gates,lore,numogram,regions,syzygies}.ts` and nothing else.
- `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` prints `OK 5 files in 1 sets`; `git status --porcelain -- e2e/__behaviour__ e2e/__golden__ engine/test/fixtures tests/oracle` prints nothing; `tests/oracle/*` unchanged; `perf/` untouched.
- No `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. Nothing was pushed, fetched or pulled.
- Cleanup: no listener on ports 3000, 3007, 3111, 3112, 3113 afterwards (only TIME_WAIT sockets from the test servers); `.e2e-basepath/` removed after every verify.

## Page weight (T-02-42 style check)

Measured with `node scripts/page-weight.mjs print` against `perf/page-weight.baseline.json`:

| route | metric | baseline | after 02-11 | swap commit (f54f92b) | now (d0cbf2a) | vs baseline | this swap |
|-------|--------|----------|-------------|-----------------------|---------------|-------------|-----------|
| `/numogram/` | js bytes | 563,909 | 580,714 | 581,222 | 581,022 | +17,113 (+3.03%) | +308 |
| `/numogram/` | js gzip | 170,556 | 175,360 | 175,522 | 175,446 | +4,890 (+2.87%) | +86 |
| `/numogram/` | css bytes / gzip | 18,377 / 4,603 | unchanged | 18,377 / 4,603 | 18,377 / 4,603 | 0 | 0 |
| `/` | js bytes / gzip | 416,830 / 128,120 | unchanged | unchanged | unchanged | 0 | 0 |

Tolerance `max(1 KiB, 5%)`: limits are baseline + 28,196 raw and + 8,528 gzip, so the headroom left on `/numogram/` is **11,083 raw and 3,638 gzip bytes**. `check:weight` passed on every run and the baseline file was not touched (the plan's conditional baseline-update rule did not trigger, so there is no `perf(02-12)` commit). The engine's demon space was already in the bundle (createNumogram references it), so the swap added only the adapter; the hand builder was not tree-shaken (its top-level loop has side effects), hence the small drop of 200 bytes at the deletion. The temporary `LEGACY` comment was worded without Tailwind utility words, and the CSS stayed at the baseline 18,377 in both commits.

## Decisions Made

See key-decisions above. Judgement calls:

- The `default` branch of `legacyKind` assigns the subtype to a `never` and throws, so adding an eighth subtype to the engine breaks the type check here instead of silently mapping to a wrong kind.
- The adapter test uses the lore module's per-zone lemur lists as a second name source (they were typed independently of the mesh-keyed table), because neither the DOM goldens nor the behaviour baseline read demon names or kinds; the frozen numeric oracle and the f7d6689 proof cover the values, this covers the join through a different key path.
- `ALL_DEMONS` is built by a plain loop over `BASE10.demons.count` rather than through `demons.group(...)`/`subtype(...)` unranking: the viewer list is mesh-ordered and the plan says `at(m)` for every m.

## Deviations from Plan

None - plan executed exactly as written. The conditional page-weight step did not trigger, so `perf/page-weight.baseline.json` and any `perf(02-12)` commit do not exist.

Process notes (no effect on the result):

- `python3` is not available in this shell; byte checks were done with a `node` script (CR, non-ASCII and backslash counts; the only backslashes in the touched test file are the three that were already in HEAD, in a regex).
- The verify and test:swap runs were run as foreground shell jobs with logs in the scratchpad; nothing was edited in the tree while any gate ran (drafts, the mutation script and the proof stayed in the scratchpad, and the mutation run restored the adapter file byte-identically before the next command).
- The mutation script's per-mutant "Tests" summary column shows the failing-test count from the vitest failure heading; each mutant is judged killed by the non-zero exit of the run.

## Issues Encountered

None. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None. `ALL_DEMONS` is fully engine- and lore-derived; nothing is hard-coded, empty or mocked.

## Threat Flags

None. T-02-45 (subtype to kind mapping): exhaustive switch with a never guard, deep equality with the hand builder before deletion, the frozen oracle kinds and per-demon kind, the independent reference kind check demon by demon, eleven killed mutants, the f7d6689 proof (0 differences), and the DOM goldens layer-pandemonium states passed. T-02-46 (name or mesh mis-join): names by mesh vs the frozen oracle names, the second join check through the zone lemur lists, the lore coverage test (02-07), the f7d6689 proof against the old a:b-keyed table. T-02-47 (n^2 builder at other bases): the adapter iterates the 45-item virtual space for base 10 only; the generic engine never materializes demons (02-05 ceiling test). No new network, auth, file-access or schema surface: the new edges are app code to app code by relative path and a type-only import of the engine barrel.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers swap 5 of 5, and MIG-01 as a whole is confirmed at phase level. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Notes for plan 02-13 (final phase gate)

- **Seams left in `app/data/*.ts` (all pass-through, no structure, no lore):** `zones.ts` (3 lines: lore re-exports and `ZONE_REGION`), `syzygies.ts` (2), `currents.ts` (2), `gates.ts` (2), `demons.ts` (3: `ALL_DEMONS` and `TC`); plus the deliberate extra seam `app/lib/constants.ts` (`TC_EDGES`, `TC_CURRENTS`, `TC_SYZYGIES` re-exported from `app/presets/base10/regions.ts`; `TWEEN_DURATION` and `REGION_CLR` unchanged).
- **The 02-13 Task 1 scope greps already hold on this tree (read-only pre-check):** `grep -cE "(from|to|cum|a|b): [0-9]|new Set\(\[|push\(|'Gt-"` prints 0 for all five `app/data` files; `grep -cE "\[\[1, 8\]|'Surge'" app/lib/constants.ts` prints 0; `grep -rl "CCRU-derived lore" app` prints only `app/presets/base10/lore.ts`; `git diff --name-only f7d6689 -- app` prints only the five seams, `app/lib/constants.ts` and files under `app/presets/base10/`; `git ls-files tests/bruteforce` lists three files. No old-brand string appears in `app/presets` or `tests/presets`.
- **Page-weight status:** no baseline update happened anywhere in Phase 2 (`perf/page-weight.baseline.json` untouched); `/numogram/` is +17,113 raw (+3.03%) and +4,890 gzip (+2.87%) over it, headroom 11,083 raw and 3,638 gzip. Nothing left in Phase 2 is expected to add weight (02-13 edits only planning docs).
- **Test counts:** 958 vitest tests in 26 files in both timezones, 75 playwright passed and 5 skipped (60 goldens + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project), basepath e2e 10 passed.
- **Timings on this machine:** `npm run verify` 252-257 s (about 260 s pre-flight), `npm run test:swap` about 195 s.
- **For the STATE decisions:** the seam approach (five thin pass-through files plus `app/lib/constants.ts`), the kind mapping (syzygy = the five nine-sum demons), and that all five swaps were done with the strict D-02 sequence and no page-weight baseline raise.
- **Never type a unicode escape sequence** in a Write/Edit argument, and do not edit the repo while a gate runs (`verify` ends with `--clean-tree`).

## Next Phase Readiness

- Ready for 02-13 (final phase gate and bookkeeping). All five data sources (syzygies, currents, gates, regions and zones, demons) are engine-derived and lore-joined by id; no hand-authored structure remains under `app/data`; the full gate is green with the 60 goldens, the behaviour baseline and the numeric oracle unchanged.

## Self-Check: PASSED

- FOUND: `app/presets/base10/demons.ts`, `app/data/demons.ts`, `tests/presets/base10-adapter.test.ts`
- FOUND commits: `f54f92b`, `d0cbf2a`
