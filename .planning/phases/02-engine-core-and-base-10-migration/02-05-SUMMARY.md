---
phase: 02-engine-core-and-base-10-migration
plan: 05
subsystem: engine
tags: [engine, pure-ts, demons, mesh-number, closed-form-counts, cross-torque-chronodemon, brute-force-sweep, ceiling-test, vitest, fast-check]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-01 contracts (DemonRef, DemonSpace, DEMON_TYPES, DEMON_SUBTYPES), MAX_BASE, formatNetSpan; 02-02 the definitions-only reference tests/bruteforce/numogramReference.ts and the frozen notable-bases fixture; 02-04 createNumogram and numogramInternals(g)
provides:
  - engine/core/demons.ts, the lazy virtual demon space: meshOf and netSpanOf (O(1), exact up to 2^26), createDemonSpace (classifier, closed-form counts, incident and numodemons iterators), wired into Numogram as the lazy readonly `demons` member
  - proof against the independent reference: every demon of every even n up to 300, brute-force counts for every even n up to 2000, twelve sampled bases up to 2^20, the frozen base-10 oracle, the notable-bases fixture and the 2^26 ceiling
affects: [02-06, 02-07, 02-12, phase-05-demon-browser, phase-07-naming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Virtual demon space: a demon is an address (mesh number) plus index math over the numogram's typed arrays; a frozen DemonRef is built per call and nothing per demon is ever stored; counts are closed forms over the Torque cycles only"
    - "Float estimate plus exact integer correction for an inverse that leaves 2^53: Math.sqrt only proposes the row, two integer loops decide it, and a test that replaces Math.sqrt with a wrong one proves the loops (V8's bare estimate happens to be exact everywhere, so nothing else can)"
    - "Lazy iterators are re-iterable frozen objects around module-level generator functions; argument validation is eager, at the call, not on the first step"
    - "Sweeps tally the classifier itself (walking mesh numbers) as well as the closed forms, so a wrong branch cannot hide behind a correct count"

key-files:
  created:
    - engine/core/demons.ts
    - engine/test/demons.test.ts
    - engine/test/demons.sweep.test.ts
  modified:
    - engine/core/types.ts
    - engine/core/numogram.ts
    - engine/index.ts
    - engine/test/base10.engine.test.ts
    - engine/test/notable-bases.test.ts
    - engine/test/ceiling.test.ts

key-decisions:
  - "Mesh inversion stays exact at the 2^26 cap without BigInt: the float square root is only an ESTIMATE (clamped to >= 1) and two integer loops (while a(a-1)/2 > m a--; while (a+1)a/2 <= m a++) finish it; a stays at or below 2^26 so every product is below 2^53 and every comparison exact. Test-only BigInt bisection is the independent check"
  - "Cross-Torque chronodemons are an explicit subtype: cyclic-chrono means the same Torque cycle, cross-torque-chrono two different Torque cycles, syzygetic-chrono a + b = n - 1; counts and types are closed forms over the Torque cycles (O(number of Torque cycles), exact integers below 2^52)"
  - "numodemons() runs b = 1 .. n/2 - 1, i.e. (n-b)::b, which is DESCENDING mesh order (the contract in types.ts); the reference lists Numodemons by mesh ascending, so the sweep sorts it by b"
  - "DemonRef values, netSpanOf tuples, counts/typeCounts objects and the iterable wrappers are frozen; counts and typeCounts are memoized in a #private field (writable after the freeze); -0 is normalized to +0 at every entry point"

patterns-established:
  - "Engine siblings build on numogramInternals(g): a zone's cycle id is pairCycle[min(z, n-1-z)] with no view allocation; Torque = id < torqueCount, Plex = plexId, Warp = warpId"
  - "Frozen-fixture readers and the reference are reached by relative path from engine/test only; engine/core imports nothing outside engine/"

requirements-completed: [ENG-03, ENG-04, ENG-05]

# Metrics
duration: 24min
completed: 2026-09-26
---

# Phase 2 Plan 05: Virtual Demon Space Summary

**`g.demons` serves any of the up-to-2.25e15 demons of any even base by mesh number or net-span in O(1) with no per-demon storage, classifies them into seven subtypes with an explicit cross-Torque chronodemon, counts them in closed form, and equals the independent reference for every demon of every even n up to 300 and every count up to 2000.**

## Performance

- **Duration:** about 24 min (started about 20:31Z, code finished about 20:47Z, full gate about 3.5 min of that)
- **Tasks:** 2 planned (2 task commits), plus 1 fix commit found by the mutation spot check, plus this metadata commit
- **Files:** 3 created, 6 modified. `app/`, `e2e/__golden__`, `e2e/__behaviour__` and `engine/test/fixtures` are byte-identical to the frozen baselines

## Accomplishments

- **The demon space.** `engine/core/demons.ts` implements the whole 02-01 `DemonSpace` contract on `numogramInternals`: `at(mesh)`, `ref(a, b)` (order-normalizing), `meshOf`, `netSpanOf` (with `< base` / `< count` range checks), `counts()`, `typeCounts()`, `incident(z)` and `numodemons()`. `Numogram.demons` is a lazy getter with a `#private` cache (the class freezes itself, private fields stay writable). Nothing is ever allocated per demon: `at` builds one small frozen `DemonRef` from the typed arrays, the two iterators are generators.
- **Exact mesh inversion at the cap.** See the section below. The last demon of base 2^26 round-trips: `meshOf(67108863, 67108862) = 2251799780130815`, `netSpanOf(2251799780130815) = [67108863, 67108862]`, `netSpanOf(2251799780130816)` throws.
- **Classification with the explicit cross-Torque subtype.** Both zones Torque: syzygetic-chrono if `a + b = n - 1`, else cyclic-chrono if the same Torque cycle, else cross-torque-chrono. Exactly one Torque: plex-amphi or warp-amphi by the other zone's region. Neither: syzygetic-xeno or chaotic-xeno. Numodemon iff `a + b = n`. The subtype strings equal the reference's `REF_SUBTYPES` one for one.
- **Closed forms as implemented.** With `L_c` the length in pairs of Torque cycle c, `T = sum 2 L_c` (Torque zones), `W = 2` if a Warp exists else 0, `C(x,2) = x(x-1)/2` (exactly +0 below 2, see Deviations):
  - cyclic-chrono `sum (C(2 L_c, 2) - L_c)`; cross-torque-chrono `C(T,2) - sum C(2 L_c, 2)`; syzygetic-chrono `T/2`
  - plex-amphi `2T`; warp-amphi `W T`
  - chaotic-xeno `4` with a Warp else `0`; syzygetic-xeno `2` with a Warp else `1`
  - types: chrono `C(T,2)`, amphi `T(n-T)`, xeno `C(n-T,2)`; Numodemons `n/2 - 1`; demon count `n(n-1)/2`
  - The only loop runs over the Torque cycles (`internals.length[0 .. torqueCount)`, 1.29 million at 2^26, a few milliseconds) and is memoized.
- **Verified values.** base 10 `[12, 0, 3, 12, 12, 4, 2]`; base 12 `[40, 0, 5, 20, 0, 0, 1]`; base 16 `[28, 32, 6, 24, 24, 4, 2]`; base 28 `[156, 108, 12, 48, 48, 4, 2]` = 378 with 108 cross-Torque; base 82 `[1560, 1404, 39, 156, 156, 4, 2]` = 3321; base 4 `[0, 0, 0, 0, 0, 4, 2]`; base 2 `[0, 0, 0, 0, 0, 0, 1]`; base 10 types `{ chrono 15, amphi 24, xeno 6 }`.

## How mesh inversion is made exact at the cap

`mesh(a::b) = a(a-1)/2 + b` is exact for every a below 2^26 (`a(a-1) <= (2^26-1)(2^26-2) < 2^52`). The inverse needs the row a = largest with `a(a-1)/2 <= m`. The textbook route through `sqrt(8m + 1)` is not exact at the top: `8 * 2251799780130815 + 1` is about 1.8e16 and exceeds 2^53, so the argument is not even representable. `rowOf(m)` therefore treats the float result only as a proposal: `a = max(1, floor((1 + sqrt(8m + 1)) / 2))`, then `while (a * (a - 1) / 2 > m) a--` and `while ((a + 1) * a / 2 <= m) a++`. With `a <= 2^26` every product stays below 2^53 (so each comparison against the integer `m` is exact), `b = m - a(a-1)/2` is exact, and no exact integer square root and no BigInt exist anywhere in `engine/`. The clamp keeps a broken square root from sending the first loop into a runaway descent (`a(a-1)/2` grows again below 0).

Finding worth knowing: on V8 the bare estimate is already exact for every row. A brute force over all 2^26 - 1 rows (first and last mesh of each row, run once in a scratch script, not committed) found zero misses, and because correctly rounded `sqrt` and division are monotone, that means the bare formula is exact for every mesh. The correction loops therefore never fire on V8, which made two mutants survive the first tests (no loops at all; `<` instead of `<=` in the second loop). To pin the loops anyway, `demons.test.ts` replaces `Math.sqrt` with a wrong one (off by up to 80 in both directions, at row starts, row ends and the last rows of 2^26) and requires the BigInt-derived net-span; both mutants now fail. The independent BigInt bisection is also the check in the fixed-seed round trips (seeds 20261003, 20261004), the triangular-boundary sweep (rows 1..3000, every power of two, the 2^53 crossing rows around 47,453,133 and the last 64 rows) and the first 300,000 meshes walked one by one.

## Task Commits

1. **Task 1: DemonSpace core (mesh, classification, closed-form counts, iterators) wired into Numogram** - `c5ebc0e` (feat)
2. **Fix from the mutation spot check: clamp the row estimate and pin the correction loops with a wrong-sqrt test** - `95a4351` (fix)
3. **Task 2: Demon sweeps, base-10 oracle, notable-bases and ceiling additions** - `901ce38` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Public API added

```ts
// engine/index.ts (new exports)
meshOf(a: number, b: number): number                    // RangeError unless distinct whole numbers below 2^26; order-normalizing
netSpanOf(mesh: number): readonly [number, number]      // [a, b] with a > b; RangeError unless 0 <= mesh < 2251799780130816

// Numogram (02-01 interface, new member)
readonly demons: DemonSpace                             // lazy, cached per numogram, frozen

// DemonSpace (02-01 contract, now implemented)
base, count (= n(n-1)/2), numodemonCount (= n/2 - 1)
meshOf(a, b), netSpanOf(mesh)                           // the standalone functions plus < base / < count range checks
at(mesh): DemonRef, ref(a, b): DemonRef                 // O(1), frozen DemonRef { a, b, mesh, type, subtype, syzygetic, numodemon, cycleA, cycleB }
counts(): Readonly<Record<DemonSubtype, number>>        // memoized, frozen, keys in DEMON_SUBTYPES order
typeCounts(): Readonly<Record<DemonType, number>>       // memoized, frozen, keys in DEMON_TYPES order
incident(zone): Iterable<DemonRef>                      // n - 1 demons, other zone ascending; validates eagerly, re-iterable, lazy
numodemons(): Iterable<DemonRef>                        // (n - b)::b for b = 1 .. n/2 - 1 (b ascending = mesh DESCENDING), lazy

// engine/core/demons.ts (siblings only, not in the barrel)
createDemonSpace(g: Numogram, internals: NumogramInternals): DemonSpace
```

## Sweep coverage and runtime

- **Full enumeration:** every even n from 2 to 300 (150 bases, 2,261,225 demons in total across three blocks [2,100], [102,200], [202,300], each asserting 50 bases covered and the summed demon count): every demon's `a, b, mesh, type, subtype, syzygetic, numodemon, cycleA, cycleB` equals `refDemons`, with `meshOf` both ways, `netSpanOf`, `ref(b, a)`, `counts()` and `typeCounts()` against the enumeration's tally, the full `numodemons()` list against the reference sorted by b, and `incident(z)` for z in {0, n/2, n-1} against the reference demons containing z ordered by the other zone. 0 mismatches.
- **Brute-force counts:** every even n from 2 to 2000 (1000 bases, blocks [2,1000] and [1002,2000], each asserting 500 bases): `counts()` equals `refSubtypeCounts(refStructure(n))` for all seven subtypes, `typeCounts()` equals the per-type sums, the counts sum to `n(n-1)/2`, `count` and `numodemonCount` are right.
- **Sampled larger bases:** `fc.sample(..., { seed: 20261005, numRuns: 12 })` gave 2034, 2010, 129230, 1048546, 2008, 947684, 814420, 594970, 1048574, 258622, 2026, 205534 (largest 2^20 - 2): for each, T, the Torque lengths and the Warp come from `refStructure(n)`, the closed-form invariants of the plan hold (sum, `syzygetic-chrono + syzygetic-xeno = n/2`, `cyclic + cross + syzygetic-chrono = C(T,2)`, `cross = C(T,2) - sum C(2L,2)`, `plex-amphi = 2T`, `warp-amphi`, both xeno counts, the type counts), and 200 sampled pairs (seed 20261006) classify exactly as `refClassify` with the same cycle ids and mesh.
- **Runtime:** `demons.sweep.test.ts` takes about 4.7 s of test time (68 + 287 + 805 ms for the three enumeration blocks, 329 + 2024 ms for the two count blocks, about 1.2 s for the twelve sampled bases) and 5.0 s wall including start-up when run alone. The plan's "under 15 s" target holds with a wide margin, the reference is again the dominant cost.
- **Whole engine test project:** 12 files, 457 tests, 5.2 s wall in both timezones (was 10 files, 377 tests). `npm run test` and `npm run test:tz`: 23 files, 862 tests, 5.5 s each.
- **Ceiling (2^26):** demon queries (count, numodemonCount, `at(last mesh)`, 1000 `at` calls on a fixed LCG walk, `counts()`, `typeCounts()`, `ref(67108863, 0)`) grew `arrayBuffers` by **+0.0 MiB** (limit 1 MiB); the counts equal an independent computation from the histogram of cycle lengths (`T = 2^26 - 4`, so chrono `C(2^26 - 4, 2)`, amphi `4 T`, xeno 6); 2000 fixed-seed demons (seed 20261007) re-derive their subtype from the cycle views. The whole first ceiling test (build, structural checks and now the demon checks) takes about 1.5 s.

## Mutation spot check (nothing committed; `git checkout -- engine/core/demons.ts` or a file copy after each)

| Mutant | Result |
| ------ | ------ |
| M1 (the plan's): cyclic-chrono and cross-torque-chrono branches swapped | demons.sweep (15 tests), base10.engine (1), notable-bases (18), demons.test (1) and ceiling (1) all FAIL |
| M2: correction loops removed (bare float estimate) | first run PASSED everywhere (equivalent on V8, see above); after the wrong-sqrt test it FAILS (1 test) |
| M3: `<` instead of `<=` in the upward correction loop | same as M2: survived, now FAILS (1 test) |
| M4: Numodemon flag `a + b === n - 1` | demons.sweep (13), demons.test (2) and ceiling (1) FAIL |
| M5: cyclic-chrono count forgets the `- L_c` | 5 files FAIL (47 tests) |
| M6: Plex and Warp swapped in the amphi rule | demons.sweep (15), notable-bases (9), demons.test (1), ceiling (1) FAIL; base10.engine cannot see it (base 10 has 12 Plex-amphi and 12 Warp-amphi, a limit of that oracle, not of the suite) |
| M7: `C(2L, 2)` computed as `C(2L - 1, 2)` | 5 files FAIL (47 tests) |

`git diff --quiet -- engine/core/demons.ts` was clean after each revert.

## Decisions Made

- The four decisions in `key-decisions` above (exact inversion by estimate plus integer loops, explicit cross-Torque subtype, `numodemons()` in b-ascending order, frozen values with -0 normalized).
- `incident`/`numodemons` return a frozen `{ [Symbol.iterator]: () => generator }` object, not a bare generator, so a caller can iterate the result twice; the module-level generators (`function*`) hold no reference to the demon-space object.
- The 2^26 assertions live only in `ceiling.test.ts` (Task 2), not also in `demons.test.ts`: several test files build 2^26 numograms in parallel workers otherwise (300 MiB each). `demons.test.ts` covers the cap with the standalone `meshOf`/`netSpanOf` (no numogram needed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The closed forms returned `-0` for bases with no Torque zone**
- **Found during:** Task 1 (first GREEN run: base 2 and 4 `cross-torque-chrono` was `-0`, `expected -0 to be +0`)
- **Issue:** `T(T - 1) / 2` with `T = 0` is `-0`; the chrono total and, through the subtraction, the cross-Torque count carried a negative zero that breaks `toEqual`, `Object.is` and any JSON or display use.
- **Fix:** `choose2(x)` returns `+0` for `x < 2`; every `C(x, 2)` uses it. `checkIndex` also normalizes a caller's `-0` zone or mesh to `+0`, with a test.
- **Files modified:** `engine/core/demons.ts`, `engine/test/demons.test.ts`
- **Commit:** `c5ebc0e`

**2. [Rule 2 - Missing critical functionality] The integer correction loops were untested and had no lower guard**
- **Found during:** Task 2 (mutation spot check: removing the loops, or changing `<=` to `<`, left every test green)
- **Issue:** On V8 the float estimate is exact for every row, so the loops never run and nothing pinned them; and if a runtime's `Math.sqrt` came out low, `a` could go below 1 and the first loop would descend forever (`a(a-1)/2` grows for negative `a`).
- **Fix:** the estimate is clamped to at least 1, and a test replaces `Math.sqrt` with a wrong one (offsets of -80, -3, -1.5, -0.6, 0.6, 1.5, 3, 80) and requires the exact net-spans (BigInt bisection) at row starts, ends and the top rows of 2^26.
- **Files modified:** `engine/core/demons.ts`, `engine/test/demons.test.ts`
- **Commit:** `95a4351`

**3. [Rule 2 - Test strengthening the plan's own spot check needed] base10.engine and notable-bases did not exercise the classifier**
- **Found during:** Task 2 (thinking through the plan's mutation spot check: "swap cyclic and cross, confirm demons.sweep, base10.engine and notable-bases FAIL")
- **Issue:** the viewer's kinds merge cyclic and cross into `chrono`, and the fixture's `subtypeCounts` are compared to `counts()`, which is a closed form and never touches the classifier; the swap would have passed both files.
- **Fix:** both files also tally the subtype of every enumerated demon (`at(0 .. count - 1)`, at most 523,776 demons for base 1024) and compare it to the frozen values (base 10 `[12, 0, 3, 12, 12, 4, 2]`, every fixture entry). M1 now fails both.
- **Files modified:** `engine/test/base10.engine.test.ts`, `engine/test/notable-bases.test.ts`
- **Commit:** `901ce38`

### Other notes (no rule needed)

- The plan's Task 2 says `numodemons()` "equals the reference demons with numodemon true". The engine iterator follows the `types.ts` contract (`b = 1 .. n/2 - 1`, that is mesh DESCENDING: base 10 yields 9::1, 8::2, 7::3, 6::4), while the reference lists by mesh ascending. The sweep compares against the reference sorted by `b`; nothing else changed.
- TDD: Task 1 was RED first (`demons.test.ts` written and run against the absent module, 33 failed), GREEN after the implementation (4 failed on the `-0` bug, then 34 pass). Task 2 tests target code Task 1 already delivered, so their RED state cannot exist by construction; the mutation table stands in.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run --project engine` and the America/New_York run: 12 files, 457 tests pass in both. `npx tsc -p engine/tsconfig.json --noEmit` and `-p engine/tsconfig.test.json`: exit 0.
- `npm run typecheck` exit 0 (root, engine, engine test, components tsc and lint with the engine purity override). `npm run test` and `npm run test:tz`: 23 files, 862 tests pass. `npm run check:repo`: OK (10 checks).
- `node scripts/golden-manifest.mjs verify engine/test/fixtures/MANIFEST.json engine/test/fixtures/derived/MANIFEST.json`: OK (1 file in 1 set each). `git diff --quiet f7d6689 -- engine/test/fixtures/base10.golden.json engine/test/fixtures/MANIFEST.json` and `git diff --quiet fabde14 -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` exit 0; `git diff --quiet f7d6689 -- app` exits 0.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0 (a few minutes; the e2e suite alone took 2.8 min). Inside it: unit tests 862 in both timezones, sub-path e2e 10 passed, build, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 75 passed and 5 skipped (60 DOM goldens unchanged, 10 static-export, 5 behaviour on the UTC project; the 5 skipped are the same behaviour specs under the New York project), final `check-repo: OK` including clean-tree and static-out. The tree was clean afterwards and no listener remained on ports 3000, 3007, 3111, 3112, 3113.
- Acceptance greps: `demons.ts` contains `while (a * (a - 1) / 2 > m)`, `'cross-torque-chrono'` and `function*`, its only `./numogram` import is `import type`, and it contains no `new Array(`, `Array.from({ length` or push loop; `types.ts` contains `readonly demons: DemonSpace`; the tests contain `2251799780130815`, `[156, 108, 12, 48, 48, 4, 2]`, `seed: 20261003/4/5/6`, `refDemons`, `refSubtypeCounts`, `refClassify`, `syzygeticBy`, `amphiBy`, `2251799780130816`, `33554431`.

## Notes for plan 02-06 and the adapter plans

- **02-06 (unranking):** add `group(...)`/`subtype(...)` to `DemonSpace` in `types.ts` and implement them in `engine/core/demons.ts` (or a sibling that takes `NumogramInternals`). `DemonSpaceImpl` freezes itself in its constructor, so any new cache must be a `#private` field; classification is `buildDemon(s, n1, a, b)` (module-private in `demons.ts`; export it or factor it if unranking needs the same rule) and every count it needs is already memoized behind `counts()`. `rowOf`/`netSpanOf` are exact for any mesh below `C(2^26, 2)`, so an unranked mesh can go straight through `netSpanOf`. The reference to rank against is `refDemons` (n <= 300) and `refSubtypeCounts` (n <= 2000); the `DEMON_SUBTYPES` strings equal `REF_SUBTYPES`.
- **Order of `numodemons()`:** b ascending, i.e. mesh descending (9::1, 8::2, 7::3, 6::4 in base 10). Do not assume mesh order for Numodemons; a "k-th Numodemon in mesh order" is `(n - b)::b` with `b = numodemonCount - k`.
- **Adapter (02-12, base-10 demons swap):** the frozen oracle's 45 demons are in mesh order (`at(0 .. 44)` gives the same `(a, b)` sequence as `golden.demons`, verified) and `formatNetSpan(a, b, 10)` equals every golden `netSpan`. The viewer's `kind` is `syzygetic-* -> 'syzygy'`, `cyclic-chrono | cross-torque-chrono -> 'chrono'`, `*-amphi -> 'amphi'`, `chaotic-xeno -> 'xeno'` (the test file `base10.engine.test.ts` holds this table as `VIEWER_KIND`); the viewer's `amphiBy` is `plex-amphi` and `warp-amphi`, its `syzygeticBy` is `syzygetic-chrono` and `syzygetic-xeno`. `DemonRef` objects are frozen and created fresh per call (compare by field, never by identity); `cycleA`/`cycleB` are `Cycle.id`s. Lore keys are mesh numbers or `(a, b)`.
- **02-07 (lore coverage):** `g.demons.at(m)` for `m < count` and `g.demons.count` (45 in base 10) give the id set to compare with the lore keys.
- **Barrel:** `meshOf` and `netSpanOf` are exported from `engine/index.ts`; `createDemonSpace` is not.

## Issues Encountered

- A very long `node` heredoc that mixed template literals and quotes made the shell refuse the command once (nothing was applied); the edits were redone with the Edit tool. No effect on the repository.

## Known Stubs

None.

## Threat Flags

None. T-02-21 (materialization DoS): virtual space, O(1) `at`/`ref`, closed-form counts, generators; the ceiling test measured +0.0 MiB of array buffers for the demon queries at 2^26. T-02-22 (float precision above 2^53): estimate plus exact integer loops, BigInt-derived independent checks at the last mesh, at every triangular boundary near the top, across the 2^53 crossing rows, fixed-seed round trips, and a wrong-sqrt test that pins the loops. T-02-23 (out-of-range indices): a `RangeError` at every entry point (`meshOf`, `netSpanOf`, `at`, `ref`, `incident`, the space's own `meshOf`/`netSpanOf`), eager for `incident`, non-numbers included. T-02-24 (taxonomy drift): enumeration against the reference for every even n up to 300, the frozen base-10 split, the fixture's counts and enumerated tallies, mutants M1 and M6 killed. No new network, auth, file or schema surface.

## Requirements Note

`requirements-completed` lists ENG-03, ENG-04 and ENG-05 because this plan's frontmatter carries them: ENG-03 (mesh, subtypes, closed-form counts, Numodemons) is proven here except the type/subtype unranking that plan 02-06 adds, ENG-04 (input refusal) and ENG-05 (no O(n^2) materialization, the 2^26 demon queries) are proven for the demon half. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Next Phase Readiness

- Plan 02-06 (demon unranking) can build on `createDemonSpace`, `numogramInternals` and the reference sweeps exactly as described above.
- The adapter plans get a demon space whose order, subtypes and counts match the frozen base-10 oracle demon for demon.

## Self-Check: PASSED

- FOUND: `engine/core/demons.ts`, `engine/test/demons.test.ts`, `engine/test/demons.sweep.test.ts`, `engine/core/types.ts`, `engine/core/numogram.ts`, `engine/index.ts`, `engine/test/base10.engine.test.ts`, `engine/test/notable-bases.test.ts`, `engine/test/ceiling.test.ts`
- FOUND commits: `c5ebc0e`, `95a4351`, `901ce38`
