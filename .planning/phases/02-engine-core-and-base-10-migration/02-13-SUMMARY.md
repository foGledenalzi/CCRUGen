---
phase: 02-engine-core-and-base-10-migration
plan: 13
subsystem: verification
tags: [phase-gate, verify, frozen-oracle, evidence, roadmap, state, base10-adapter, engine]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-01..02-06 the engine (contracts, base validation, numerals, createNumogram, virtual demon space, unranking); 02-02 the independent reference and the notable-bases fixture; 02-03 the frozen behaviour baseline; 02-07 the single lore module; 02-08..02-12 the five data-source swaps (syzygies, currents, gates, regions and zones, demons)
provides:
  - a green final gate (MSYS_NO_PATHCONV=1 npm run verify, exit 0) on the committed tree bf49729, with per-stage results
  - the evidence table for ROADMAP Phase 2 success criteria 1-5 and for ENG-01..ENG-05 and MIG-01 (tests, commands, numbers, commits)
  - proof that nothing frozen changed (numeric oracle, 60 DOM goldens, four manifests) and that the only app/ files changed since f7d6689 are the five app/data seams, app/lib/constants.ts and app/presets/base10/*
  - ROADMAP.md (13 plan checkboxes, progress row 13/13) and STATE.md (position, decisions, resume point) updated by hand for the hand-off to /gsd-verify-work 2
affects: [phase-2-verification, phase-3-layout, phase-4-base-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A verification-only plan changes no source, test, golden, baseline or fixture file: the whole diff of this plan is two planning docs and this summary"

key-files:
  created:
    - .planning/phases/02-engine-core-and-base-10-migration/02-13-SUMMARY.md
  modified:
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "STATE.md frontmatter status is the short state word verifying (the body Status line and stopped_at carry the full text 'Phase 2 executed (13/13 plans); next /gsd-verify-work 2')"
  - "One consolidated [Phase 2 P13] decision line in STATE.md records the phase-level facts the plan lists (numeral scheme, canonical cycle order, seam approach with the app/lib/constants.ts extension, the D-11 outcome with its numbers, the behaviour baseline location, no page-weight baseline raise)"
  - "Requirement status and the Phase 2 phase-list checkbox are left to the orchestrator (phase-level completion after code review and independent verification); REQUIREMENTS.md and the Phase 2 line of the ROADMAP phase list are untouched"

requirements-completed: [ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, MIG-01]

# Metrics
duration: 20min
completed: 2026-09-26
---

# Phase 2 Plan 13: Final Phase Gate Summary

**The complete gate `MSYS_NO_PATHCONV=1 npm run verify` exits 0 on the final committed tree (275 s: 958 unit tests in two timezones, 10 sub-path e2e, build, page weight, 75 e2e passed with the 60 frozen DOM goldens and 5 behaviour baselines, clean-tree and static-out), every frozen oracle is byte-identical, the only `app/` files changed since f7d6689 are the five `app/data` pass-through seams, `app/lib/constants.ts` and `app/presets/base10/*`, and each of the five Phase 2 success criteria and each of ENG-01..ENG-05 and MIG-01 has its tests, commands, numbers and commits recorded below.**

## Performance

- **Duration:** about 20 min (started about 02:50Z, finished about 03:10Z; the gate itself is 275 s)
- **Tasks:** 2 (Task 1 verification only, Task 2 bookkeeping), one docs commit for both
- **Files:** 1 created (this summary), 2 modified (`.planning/ROADMAP.md`, `.planning/STATE.md`). No source, test, golden, baseline, fixture, package or perf file was touched.

## Task 1: the final gate and the phase-wide invariants

### `MSYS_NO_PATHCONV=1 npm run verify`: exit 0, 4 m 34.9 s wall (275 s between the first and last log line)

Run on HEAD `bf49729` with a clean tree, no listener on ports 3000, 3007, 3111, 3112, 3113, no `.e2e-basepath/`. Nothing in the tree was edited while it ran (the summary was drafted in the scratchpad afterwards).

| stage | command | result |
|-------|---------|--------|
| 1 | `check:repo` | `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow)` |
| 2 | `typecheck` | `tsc` root, `tsc -p engine/tsconfig.json`, `tsc -p engine/tsconfig.test.json`, `tsc -p tsconfig.components.json` all clean; `next lint --dir app --dir engine --dir workers`: `No ESLint warnings or errors` |
| 3 | `test` (`CCRUG_TZ=UTC`) | `Test Files 26 passed (26)`, `Tests 958 passed (958)`, 5.80 s |
| 4 | `test:tz` (`CCRUG_TZ=America/New_York`) | `Test Files 26 passed (26)`, `Tests 958 passed (958)`, 5.75 s |
| 5 | `test:e2e:basepath` (sub-path `/ccrug`, port 3112) | build OK, `10 passed (15.1s)` (5 static-export specs in each of the two timezone projects) |
| 6 | `build` | `next build` (Next.js 14.2.35) OK, static export; `/numogram` 48.5 kB, first load 136 kB |
| 7 | `check:weight` | `page-weight: OK (2 routes, 30 golden states within tolerance)` |
| 8 | `test:e2e` | `Running 80 tests using 1 worker`, `5 skipped`, `75 passed (2.8m)`: 60 DOM goldens (30 states x 2 timezone projects), 10 static-export, 5 behaviour on the UTC project (original 56.3 s, labyrinth 22.8 s, ladder 23.2 s, planetary 20.7 s, mobile 0.86 s); the 5 skipped are the same behaviour specs under the New York project |
| 9 | `check-repo --clean-tree --static-out` | `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

After the gate: `git status --short` prints nothing; the only leftover was `.e2e-basepath/` (gitignored, left by the sub-path stage), which I removed with `rm -rf .e2e-basepath`; no listener on any of the five ports.

### Frozen files and manifests

| check | result |
|-------|--------|
| `git diff --quiet f7d6689 -- e2e/__golden__ engine/test/fixtures/base10.golden.json engine/test/fixtures/MANIFEST.json` | exit 0 (byte-identical to the pre-phase state) |
| `node scripts/golden-manifest.mjs verify e2e/__golden__/MANIFEST.json engine/test/fixtures/MANIFEST.json engine/test/fixtures/derived/MANIFEST.json e2e/__behaviour__/MANIFEST.json` | exit 0: `OK 30 files in 1 sets`, `OK 1 files in 1 sets`, `OK 1 files in 1 sets`, `OK 5 files in 1 sets` |
| `git status --porcelain -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` | prints nothing |
| new Phase 2 oracles against their freeze commits: `git diff --quiet fabde14 -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`, `git diff --quiet b82f6a2 -- e2e/__behaviour__`, `git diff --quiet 0b809d6 -- engine/test/fixtures/derived` | all exit 0 (behaviour baseline frozen at b82f6a2, notable-bases fixture at 0b809d6, never changed since) |
| `git diff --name-only f7d6689 HEAD -- .planning/REQUIREMENTS.md` | prints nothing (no requirement was ticked during the phase) |
| `-u`, `GOLDEN_CAPTURE`, `BEHAVIOUR_CAPTURE` | never used in this plan |

### Scope of the `app/` changes

```
git diff --name-only f7d6689 -- app
app/data/currents.ts
app/data/demons.ts
app/data/gates.ts
app/data/syzygies.ts
app/data/zones.ts
app/lib/constants.ts
app/presets/base10/currents.ts
app/presets/base10/demons.ts
app/presets/base10/gates.ts
app/presets/base10/lore.ts
app/presets/base10/numogram.ts
app/presets/base10/regions.ts
app/presets/base10/syzygies.ts

git diff --name-only f7d6689 -- app/lib
app/lib/constants.ts

git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks   -> exit 0
```

Exactly the five seams, the deliberate extra seam `app/lib/constants.ts` (02-11) and seven adapter files under `app/presets/base10/` (D-01, D-03). `NumogramClient.tsx`, every component, every hook (and `app/components/projection/**`), `app/data/positions.ts` and `app/data/types.ts` are byte-identical to f7d6689.

### Lore, hand structure, purity, independence

| check | result |
|-------|--------|
| `grep -rl "CCRU-derived lore" app` | prints exactly `app/presets/base10/lore.ts` |
| `grep -cE "(from\|to\|cum\|a\|b): [0-9]\|new Set\(\[\|push\(\|'Gt-"` over `app/data/{zones,syzygies,currents,gates,demons}.ts` | 0 for every file |
| `grep -cE "\[\[1, 8\]\|'Surge'" app/lib/constants.ts` | 0 |
| seam sizes (`wc -l`) | zones 3, syzygies 2, currents 2, gates 2, demons 3 lines (all pass-through, no structure and no lore); `app/lib/constants.ts` 11 lines (TC_EDGES, TC_CURRENTS, TC_SYZYGIES re-exported from `app/presets/base10/regions.ts`; `TWEEN_DURATION` and `REGION_CLR` unchanged) |
| `grep -rnE "from '(\.\./)+(app\|tests\|scripts)" engine/core engine/index.ts` | prints nothing (the engine imports nothing outside `engine/`) |
| `grep -rnE "engine/(core\|index)" tests/bruteforce/numogramReference.ts` | prints nothing (the reference is independent of the engine) |
| `git ls-files reference \| wc -l` | 0 |
| `git ls-files tests/bruteforce` | `notable-bases.fixture.test.ts`, `numogramReference.test.ts`, `numogramReference.ts` |
| old upstream branding in `app/`, `tests/presets/`, `engine/` | none (`git grep` finds the old names only in historical planning docs, `CLAUDE.md` and the guard's own forbidden list, all pre-existing; nothing new was added) |

## Evidence: ROADMAP Phase 2 success criteria

All test counts are from the final run (958 unit tests in 26 files, both timezones; per-file counts from a JSON reporter run on the same tree). A test named here passes in the gate above.

| # | Success criterion | Evidence (tests, commands, numbers) | Commits |
|---|-------------------|--------------------------------------|---------|
| 1 | The engine's base-10 output equals the frozen oracle: 10 zones, 5 pairs, currents, gates incl. Gt-15 = 5->6 and Gt-03 = 2->3, regions, 45 demons = 12+3 chrono, 12+12 amphi, 4+2 xeno | `engine/test/base10.engine.test.ts` (14 tests, engine vs `base10.golden.json`): 'has the same set of syzygy pairs', 'flows every current to the fixture zone', 'has the same gates: from, to, cumulation and the own-base name', **'Gt-15 is 5 -> 6'**, **'Gt-03 is 2 -> 3'**, 'has the same zone regions and region zone sets', 'has the same time circuit', 'has the fixture demon count 45 and the Numodemon count 4', 'tallies the 45 enumerated demons per subtype as 12 cyclic, 0 cross-Torque, 3 + 12 + 12, 4 chaotic and 2 syzygetic xeno', 'reproduces the fixture kinds { amphi 24, chrono 12, syzygy 5, xeno 4 }'. `tests/oracle/base10.oracle.test.ts` (38 tests; the definitions-based oracle now reads the data through the `app/data` seams, so it exercises the engine adapters): the derived data equals the frozen JSON, the same two gate regressions, 'the correct subtype split holds: chrono 12 + 3, amphi 12 plex + 12 warp, xeno 4 + 2'. `tests/presets/base10-adapter.test.ts` (42 tests): the five adapters against the frozen oracle and the independent reference, e.g. 'Gt-15 is 5 -> 6 in the viewer data', 'Gt-03 is 2 -> 3 in the viewer data', 'split by engine subtype as 12+3 chrono (cyclic + syzygetic), 12+12 amphi (Plex + Warp) and 4+2 xeno (chaotic + syzygetic)'. Engine `counts()` for base 10 is `[12, 0, 3, 12, 12, 4, 2]` (cyclic, cross, syzygetic chrono, Plex, Warp, chaotic, syzygetic xeno). Frozen files byte-identical to f7d6689 (above) | 4e95341, 85fd316 (gates and names), e009d18, c07146b (structure vs oracle), c5ebc0e, 901ce38 (demons vs oracle), 27f0d8e..f54f92b (the five swaps) |
| 2 | The guide's facts hold (base 12; Torque [4,2] at 16, [9,3] at 28, [39] at 80, [27,9,3] at 82; Warp iff n = 3o+1, o odd); sweep over every even n <= 2000; invalid bases rejected | `engine/test/notable-bases.test.ts` (48 tests): 'pins the literals the guide names: 16 [4,2], 28 [9,3], 80 [39], 82 [27,9,3]', the base-12 example ('writes the gates in base 12 as 0,1,3,6,a,4,a,6,3,1,b,b', "names zone 11's gate 'Gt-56' (5 + 6 = 11 = b)", 'has no Warp and one Torque cycle [1, 2, 4, 3, 5]'), and all 17 full fixture bases plus the 4 digests (256, 666, 1000, 1024). `engine/test/structure.sweep.test.ts` (4 blocks, **every even n from 2 to 2000, 1000 bases**, each block asserting 250 bases covered; about 0.63 s): partner, pairOf, currents, nextPair, gates (from, to, cumulation), regions, cycle kinds and lengths, and Warp presence `(n - 1) % 3 === 0 && ((n - 1) / 3) % 2 === 1` with `warp.firstPair = (n - 1) / 3`, all against the definitions-only reference. `tests/bruteforce/*` (183 tests): the reference itself against research literals, including a Warp and coverage sweep over every even n in 2..5000. `engine/test/base.test.ts` (83 tests): `validateBase` rejects NaN, non-numbers, Infinity, 10.5, 0, -0, negatives, odd numbers, 67108866, 2^27 and 1e308 with a reason and never throws; `assertBase` throws a `RangeError` carrying the same message; `engine/test/numogram.test.ts` (33): 'createNumogram(x) throws RangeError' for each invalid base, refused before allocating | 54e8054, 0b809d6 (reference and fixture), e009d18, c07146b, 4e95341 |
| 3 | Base 28 = 378 demons of which 108 are cross-Torque chronodemons; mesh <-> net-span in O(1); per-type counts sum to C(n,2); Numodemons n/2 - 1 | `engine/test/demons.test.ts` (35 tests): **'base 28 has 378 demons, 108 of them cross-Torque chronodemons'** (`[156, 108, 12, 48, 48, 4, 2]`), 'base 28: two zones in different Torque cycles make a cross-Torque chronodemon, the same cycle a cyclic one', 'counts always sum to the demon count and the type counts equal the subtype sums, for every even n up to 130' (also `numodemonCount === n / 2 - 1` for each), counts for bases 2, 4, 10, 12, 16, 28, 82 summing to `n(n-1)/2`; mesh <-> net-span: 'map the literals of the math: 1::0 = 0, 2::1 = 2, 6::3 = 18, 9::8 = 44', 'is exact at the very last mesh of base 2^26' (`meshOf(67108863, 67108862) = 2251799780130815`), 'round-trips netSpanOf(meshOf(a, b))' and 'round-trips meshOf(...netSpanOf(m))' against a BigInt bisection (fixed seeds 20261003, 20261004), exact at every triangular boundary; the inversion is a float estimate plus two integer correction loops (no BigInt, O(1)). `engine/test/demons.sweep.test.ts` (18): every demon of every even n <= 300 (2,261,225 demons) equals the reference, counts for every even n <= 2000 equal the brute force, twelve sampled bases up to 2^20. `engine/test/demons.unrank.test.ts` (29): `group(type)` / `subtype(subtype)` in mesh order, every rank for every even n <= 64 (44,704 ranks), samples to 300, 666 and 1024, partition identities to about 10^6 | c5ebc0e, 95a4351, 901ce38 (space, fix, sweeps), 8787787, 3a8c6cd (unranking) |
| 4 | Base 2^26 computes zones, pairs and cycles without any O(n^2) structure; bases above the ceiling refused | `engine/test/ceiling.test.ts` (8 tests, run inside `npm run verify`): 'builds within the explicit time and memory ceilings and keeps every structural invariant' (ceilings asserted: 20,000 ms, 768 MiB of array buffers, 128 MiB of heap), 'refuses 2^26 + 2 with a RangeError before allocating anything', 'stays inside the same ceilings when one cycle holds almost every pair (base 67108860)', 'storageBytes / n is between 4 and 8 for n = 2^12, 2^14, 2^16, 2^18', 'evicts the oldest entry when the zone budget is exceeded'. Measured line on this tree (`vitest run --project engine engine/test/ceiling.test.ts --reporter=verbose --disableConsoleIntercept`): `[ceiling] base 2^26: 648 ms, arrayBuffers +270.8 MiB, heapUsed -0.2 MiB, storageBytes 283925920, cycles 1290872`; the demon queries and the group/subtype unranking at 2^26 add `+0.0 MiB` of array buffers each; worst case `[ceiling] base 67108860 (one huge cycle): 974 ms, arrayBuffers +113.2 MiB`. (02-04's three runs: 616-623 ms, +302 MiB in-process.) `validateBase` refuses everything above 2^26 with reason `too-large` (base.test.ts) | e009d18, 2676daf (ceiling), c5ebc0e, 901ce38, 8787787, 3a8c6cd (demon and unrank queries at 2^26) |
| 5 | The viewer's syzygies, currents, gates, demons and regions come from the engine joined with lore by id; DOM goldens byte-identical; layouts, hover, undo and share links unchanged | Data: `app/presets/base10/{syzygies,currents,gates,regions,demons}.ts` build every export from `BASE10 = createNumogram(10)` (`numogram.ts`) and join lore from `app/presets/base10/lore.ts` by pair id, gate origin zone or mesh number; the five `app/data/*.ts` files are 2-3 line pass-throughs (greps above). `tests/presets/base10-adapter.test.ts` (42 tests, per source: strict equality with the frozen oracle, key order, the very array the seam exports, a lore-join check, no lore text in any adapter file) and `tests/presets/base10-lore.test.ts` (19): coverage (engine ids zones 0..9, pair ids 0..4, mesh 0..44 each have lore, no orphan) and join consistency. Each swap was also proven equal to `git show f7d6689:app/data/<file>.ts` by a strict deep comparison: syzygies 26 nodes, currents 31, gates 71, regions/zones/constants 471, demons and TC 233, all with 0 differences. Output: `e2e/golden.spec.ts` **60 passed** (30 states x 2 timezones, byte-identical DOM, in the gate above), `e2e/behaviour.spec.ts` **5 passed** (the D-15 behaviour and text baseline: layout switches, hover popovers, the 30-row lore sweep through the Selection panel, URL after every action, undo/redo, shortcuts, share text), and `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks` exits 0. Sub-path e2e `10 passed` (legacy `/?...` and `/numogram/?...` share links keep working) | 30a5a8b, cb32c1a (lore), 27f0d8e/54ec485, d34787b/580aa8c, b8bea46/92dc1c6, 77be052/258b440, f54f92b/d0cbf2a (swap and delete pairs), a11e132, b82f6a2 (behaviour baseline) |

## Evidence: requirements ENG-01..ENG-05 and MIG-01

Status is left to the orchestrator; REQUIREMENTS.md is untouched. This table records what proves each requirement.

| Requirement | What proves it | Where (tests, commits) |
|-------------|----------------|------------------------|
| ENG-01: zones, syzygy pairs (`hi::lo`, sum n-1), currents (pair -> `hi-lo`), gates (zone k -> in-base digital root of T(k), T(0) -> 0) for any even n | `createNumogram` equals the definitions-only reference for every even n in 2..2000 (structure sweep, 0 mismatches), the base-10 oracle and 17 full notable bases; `digitalRoot` is the in-base closed form checked against an iterated in-base digit-sum oracle for every base 2..36; gates in base 12 `0,1,3,6,a,4,a,6,3,1,b,b` | `engine/test/{arith,numogram,structure.sweep,base10.engine,notable-bases}.test.ts`, `tests/bruteforce/*`; 4e95341, 85fd316, e009d18, c07146b |
| ENG-02: Plex always, Warp iff n = 3o+1 with o odd, one or more Torque cycles in canonical order, each in pairs and zones | Cycles are canonical `Cycle[]` (Torque by length descending then smallest zone, then Plex, then Warp; each rotated to its smallest pair; regions never assume one Torque); guide facts 16 [4,2], 28 [9,3], 80 [39], 82 [27,9,3]; Warp presence checked for every even n <= 2000 and by the reference for every even n <= 5000; base 666 has 14 Torque cycles and no Warp, base 1024 has 54 and a Warp | `engine/test/{numogram,structure.sweep,notable-bases}.test.ts`, `tests/bruteforce/*`; e009d18, c07146b |
| ENG-03: virtual demons, mesh <-> net-span in O(1), subtypes incl. the explicit cross-Torque chronodemon (cyclic = same Torque only), closed-form counts, Numodemons n/2 - 1 | `g.demons` (`at`, `ref`, `meshOf`, `netSpanOf`, `counts`, `typeCounts`, `incident`, `numodemons`, `group`, `subtype`), nothing stored per demon; base 28 `[156, 108, 12, 48, 48, 4, 2]` = 378 with 108 cross-Torque; every demon of every even n <= 300, counts to 2000, unranking sweeps (numbers in criterion 3); 13 unranking mutants and 7 demon-space mutants killed in their plans | `engine/test/{demons,demons.sweep,demons.unrank}.test.ts`; c5ebc0e, 95a4351, 901ce38, 8787787, 3a8c6cd |
| ENG-04: base-10 output equals the frozen oracle; guide facts; sweeps for every even n <= 2000; odd or invalid bases rejected | Criterion 1 and criterion 2 rows above; `validateBase`/`assertBase` reject odd, zero, negative, non-integer, NaN, Infinity, non-numbers and above 2^26 (`RangeError` with a reason, D-12) | `engine/test/{base,numogram,base10.engine,structure.sweep,notable-bases}.test.ts`, `tests/oracle/base10.oracle.test.ts`; 4e95341, c07146b |
| ENG-05: no O(n^2) structure up to the ceiling 2^26 | Criterion 4 row: five `Int32Array`s (283,925,920 bytes and 1,290,872 cycles at 2^26, built in about 0.65 s), demon and unranking queries add +0.0 MiB, `storageBytes / n` between 4 and 8, ceiling test inside `verify`; the reference is the only O(n^2) code and lives in `tests/` | `engine/test/ceiling.test.ts`; e009d18, 2676daf, c5ebc0e, 8787787 |
| MIG-01: the base-10 viewer's syzygies, currents, gates, demons and regions derive from the engine, joined with lore by id, DOM goldens byte-identical | Criterion 5 row: five swaps in the strict D-02 order (syzygies, currents, gates, regions and zones, demons), each committed with the full gate green before its hand data was deleted (D-08); lore in one module keyed by id (D-06, D-07) with the guard, NOTICE and header changed together (D-16); 60 goldens plus the 5 behaviour baselines unchanged after every swap and in this final gate | `tests/presets/*`, `e2e/golden.spec.ts`, `e2e/behaviour.spec.ts`; 30a5a8b, cb32c1a, 27f0d8e, 54ec485, d34787b, 580aa8c, b8bea46, 92dc1c6, 77be052, 258b440, f54f92b, d0cbf2a |

Not part of Phase 2 (still open by design): MIG-02, the removal of the hard-coded 10-zone logic from the components (Phase 4, its CI grep gate); the `app/data` seams, `app/lib/constants.ts` and the adapters stay until then (D-03).

## D-11 outcome

The 2^26 test stays inside `npm run verify`; there is no `test:heavy` script (`grep -c "test:heavy" package.json` prints 0). It builds in about 0.62-0.65 s with about +271 MiB (+302 MiB in-process in 02-04's runs) of typed arrays, far under the asserted 20 s and 768 MiB and the fallback thresholds (10 s, 512 MiB); the ceiling file alone takes about 4 s.

## Page weight

No page-weight baseline raise happened anywhere in Phase 2 (`git log f7d6689..HEAD -- perf` prints nothing; the stored baseline still comes from the pre-phase declutter commit ed0ec1a). `node scripts/page-weight.mjs print` on this tree:

| route | metric | baseline | now | delta |
|-------|--------|----------|-----|-------|
| `/numogram/` | js bytes | 563,909 | 581,022 | +17,113 (+3.03%) |
| `/numogram/` | js gzip | 170,556 | 175,446 | +4,890 (+2.87%) |
| `/numogram/` | css bytes / gzip | 18,377 / 4,603 | 18,377 / 4,603 | 0 |
| `/` | js bytes / gzip | 416,830 / 128,120 | 416,830 / 128,120 | 0 |

Tolerance `max(1 KiB, 5%)`: limits are baseline + 28,196 raw and + 8,528 gzip, so the headroom left is about 11.1 KB raw and 3.6 KB gzip. The golden DOM node counts are unchanged.

## Timings on this machine

`npm run verify` 275 s here (about 250-260 s in the 02-08..02-12 gates; this run shared the machine with read-only checks); `npm run test:swap` about 195 s in 02-12; unit suite about 5.8 s per timezone; e2e stage 2.8 min.

## Task Commits

1. **Task 1: Final phase gate and evidence** - verification only, no commit of its own (the plan says to commit the summary with Task 2)
2. **Task 2: ROADMAP and STATE bookkeeping** - the `docs(02-13): phase 2 roadmap and state bookkeeping` commit, which also holds this summary. Its hash is in `git log` (a commit cannot cite itself); it changes exactly `02-13-SUMMARY.md`, `.planning/ROADMAP.md` and `.planning/STATE.md`.

## Task 2: what was edited

- `.planning/ROADMAP.md` (by hand; the SDK's `roadmap.update-plan-progress` cannot match this ROADMAP): the last unticked plan line became `- [x] 02-13-PLAN.md` (13 of 13 ticked, texts unchanged) and the Progress row for Phase 2 now reads `| 2. Engine Core and Base-10 Migration | 13/13 | Executed, verification pending | - |`. The phase-list line `- [ ] **Phase 2: Engine Core and Base-10 Migration**` stays unticked (the orchestrator completes the phase after code review and independent verification); no other phase was touched.
- `.planning/STATE.md` (by hand; the `gsd-sdk query state.*` helpers were not used): frontmatter `status: verifying`, `stopped_at: Phase 2 executed (13/13 plans); next /gsd-verify-work 2`, `last_updated`, counters 21 of 21 planned plans (100%); Current Position "Phase 2, Plan 13 of 13, Executed, awaiting /gsd-verify-work 2"; Performance rows (Phase 2 now 13 plans, 334 min, 26 min average, plus a `Phase 2 P13` row); one new `[Phase 2 P13]` decision line; Session Continuity resume point `/gsd-verify-work 2`. `git diff` of both files was read before the commit.
- The `[Phase 2 P13]` line records: the numeral scheme (0-9a-z to base 36, dot-separated decimal digit groups beyond, `Gt-NN` through `formatGateName`); the canonical cycle order; the seam approach (five thin pass-through files `app/data/{zones,syzygies,currents,gates,demons}.ts` remain until Phase 4 so the consumers stay untouched, plus the deliberate extra seam `app/lib/constants.ts` re-exporting TC_EDGES, TC_CURRENTS and TC_SYZYGIES); the D-11 outcome with its numbers; the behaviour baseline location `e2e/__behaviour__` (manifest-protected, freeze commit b82f6a2); no page-weight baseline raise; and the gate result.

## Deviations from Plan

None - plan executed exactly as written. Interpretation notes (no rule triggered):

- The plan says STATE `status` and `stopped_at` describe "Phase 2 executed (13/13 plans); next /gsd-verify-work 2". `status` holds the short state word `verifying` (previous plans used `executing`) and `stopped_at` carries the full sentence; the body Status line reads "Executed, awaiting /gsd-verify-work 2".
- The plan's Task 1 lists the `git ls-files reference` and grep checks as read-only; they were run both before and after the gate with the same output.

## Issues Encountered

None. The gate was green on the first run; nothing had to be patched, deferred or re-run. `python3` is not available in this shell, so the per-file test counts were read with a small `node` script kept in the scratchpad.

## Known Stubs

None. Every adapter export is engine-derived and lore-joined; the `app/data` seams are intentional pass-throughs that Phase 4 removes.

## Threat Flags

None. T-02-48 (claims without evidence): the gate output, manifest checks and scope greps are pasted above. T-02-49 (frozen oracles drifted): `git diff --quiet f7d6689` on the pre-phase frozen files and `--quiet` against the freeze commits of the two new oracle sets all exit 0, and all four manifests verify. T-02-50 (unapproved push): no `git push`, `fetch`, `pull` or `ls-remote` was run, and no git config or remote was changed. This plan adds no new network, auth, file-access or schema surface.

## Requirements Note

`requirements-completed` lists ENG-01..ENG-05 and MIG-01 because this plan's frontmatter carries them; this plan proves the phase-level evidence and does not change requirement status. No ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run: the orchestrator marks requirements at phase level after code review and independent verification. MIG-02 stays a Phase 4 requirement.

## Next Phase Readiness

- Ready for `/gsd-verify-work 2` (after the orchestrator's code review): the full gate is green on the committed tree, every criterion and requirement has recorded evidence, and STATE.md and ROADMAP.md point at verification.
- Phase 3 inputs are in place: `createNumogram(base)` for any even base up to 2^26, the canonical `Cycle[]` regions, the `hi::lo` pairs, and the base-10 hand-drawn layouts still in `app/data/positions.ts`.

## Self-Check: PASSED

- FOUND: `02-13-SUMMARY.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` (modified), and the evidence files named above (`engine/test/ceiling.test.ts`, `tests/presets/base10-adapter.test.ts`, `e2e/behaviour.spec.ts`, `app/presets/base10/lore.ts`)
- FOUND commits (all 27 cited hashes plus f7d6689, fabde14 and bf49729 resolve with `git cat-file -e`): 4e95341, 85fd316, 54e8054, 0b809d6, a11e132, b82f6a2, 97afa20, e009d18, c07146b, 2676daf, c5ebc0e, 95a4351, 901ce38, 8787787, 3a8c6cd, 30a5a8b, cb32c1a, 27f0d8e, 54ec485, d34787b, 580aa8c, b8bea46, 92dc1c6, 77be052, 258b440, f54f92b, d0cbf2a
