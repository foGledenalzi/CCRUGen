---
phase: 02-engine-core-and-base-10-migration
plan: 06
subsystem: engine
tags: [engine, pure-ts, demons, unranking, mesh-order, binary-search, closed-form-counts, cross-torque-chronodemon, ceiling-test, vitest, fast-check]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-01 contracts (DemonSelection, DemonRef, DEMON_TYPES, DEMON_SUBTYPES); 02-02 the definitions-only reference tests/bruteforce/numogramReference.ts; 02-04 createNumogram and numogramInternals; 02-05 the virtual demon space (at, netSpanOf, counts, typeCounts)
provides:
  - DemonSpace.group(type) and DemonSpace.subtype(subtype): frozen, memoized selections { count, at(k) } that return the k-th demon of a type or subtype in ascending mesh order, with no enumeration of demons
  - engine/core/unrank.ts (createSelection, countBelow per selector, exact binary search over mesh numbers)
  - proof against the independent reference (every rank for every even n up to 64, fixed-seed samples for every even n up to 300 and for 666 and 1024), rank/partition identities up to about 10^6, and the 2^26 literals
affects: [02-07, 02-08, 02-12, phase-05-demon-browser, phase-07-naming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unrank by counting: at(k) = the smallest mesh M with countBelow(M + 1) > k, where countBelow(m) is a closed form (rows below plus a partial row) over the at most 4 non-Torque zones; the mesh <-> net-span step reuses the exact netSpanOf"
    - "Per-cycle data only for the two subtypes that need it: cyclic-chrono and cross-torque-chrono use a sorted copy of the Torque pair ids built once per numogram (WeakMap keyed by the numogram's internal arrays), every other selector is allocation-free"
    - "Rank identities as a reference-free check at scale: the ranks of a mesh number m over the three types (and over the seven subtypes) must sum to m, and a type's rank must equal the sum of its subtypes' ranks; ranks are found with at() alone"

key-files:
  created:
    - engine/core/unrank.ts
    - engine/test/demons.unrank.test.ts
  modified:
    - engine/core/types.ts
    - engine/core/demons.ts
    - engine/test/ceiling.test.ts

key-decisions:
  - "Unranking is a binary search over mesh numbers with closed-form countBelow(selector, m): m = a(a-1)/2 + b splits into the demons of the rows below a (both zones below a) plus the demons (a, y) with y < b; both parts depend only on how many Torque, Plex and Warp zones lie below a value, plus per-cycle zone counts for cyclic-chrono and cross-torque-chrono"
  - "The lazily built sorted copy of the Torque pair ids is cached in a module-level WeakMap keyed by NumogramInternals (same lifetime as the numogram, shared by the two selectors that need it), not in a private field of the frozen demon space"
  - "unrank.ts reaches the mesh arithmetic only through the DemonSpace interface (space.netSpanOf, space.at), so there is no runtime import cycle and the classifier buildDemon stays private to demons.ts"
  - "Selections are frozen and memoized per name in a #private Map on the demon space; unknown names (also inherited ones such as 'toString'), crossed names (a subtype passed to group and the reverse) and bad ranks are RangeErrors"

patterns-established:
  - "Test-only ranks: rankOf(selection, m) = the number of members below mesh m by binary search over at(); it turns the partition of the mesh axis into an assertion that needs no reference enumeration"

requirements-completed: [ENG-03]

# Metrics
duration: 24min
completed: 2026-09-26
---

# Phase 2 Plan 06: Demon Unranking Summary

**`g.demons.group(type)` and `g.demons.subtype(subtype)` return the k-th demon of a type or subtype in mesh order by a binary search over closed-form "members below mesh m" counts, with no enumeration (about 0.01-0.03 ms per call for every selector except cyclic and cross-Torque chronodemons, at any base up to 2^26), and they equal the independent reference for every rank of every even n up to 64, fixed-seed samples up to 300, 666 and 1024, and the exact 2^26 end points.**

## Performance

- **Duration:** about 24 min (started about 20:55Z, finished about 21:20Z, the full gate about 4 min of that)
- **Tasks:** 2 planned (2 task commits), plus this metadata commit
- **Files:** 2 created, 3 modified. `app/`, `e2e/__golden__`, `e2e/__behaviour__` and `engine/test/fixtures` are byte-identical to the frozen baselines

## Accomplishments

- **Two new operations on the demon space** (`engine/core/types.ts`, `demons.ts`): `group(type)` and `subtype(subtype)` return a frozen `DemonSelection { count, at(k) }`, memoized per name. `count` is the closed form already served by `typeCounts()` / `counts()`; `at(k)` is the k-th member in ascending mesh order; a RangeError follows for any k that is not a whole number in `[0, count)` (`-1`, `count`, `0.5`, `NaN`, `Infinity`, strings, `undefined`; `-0` counts as 0) and for any name that is not a type (resp. subtype), including `'toString'`, `'__proto__'` and a subtype given to `group`.
- **`engine/core/unrank.ts`** implements the formulas below. `at(k)` finishes with `space.at(lo)` and asserts that the demon is of the selected type or subtype (`Error('internal: unrank')` otherwise), so a counting bug cannot return a wrong-typed demon silently.
- **Exact at the cap.** Every mesh step goes through `space.netSpanOf`, which is exact up to `C(2^26, 2)`; all counts stay below `2^52`, so nothing needs BigInt.
- **Base 10:** `group('chrono')` has 15 members starting at `2::1`; `subtype('syzygetic-chrono')` lists `5::4, 7::2, 8::1`; `syzygetic-xeno` lists `6::3, 9::0`; `chaotic-xeno` lists `3::0, 6::0, 9::3, 9::6`; `cross-torque-chrono` is empty and `at(0)` throws. **Base 28:** cross-torque-chrono has 108 members, all equal to the reference's.
- **2^26:** `group('chrono')` runs from `2::1` to `67108862::67108861`, `subtype('syzygetic-chrono')` starts at `33554432::33554431` and ends at `67108862::1`, `group('xeno')` has 6 demons that equal the six pairs of the four non-Torque zones written out from the definition (first `22369621::0`), `plex-amphi` starts at `1::0`, `warp-amphi` at `22369621::1`; all of these queries grew `arrayBuffers` by **+0.0 MiB**.

## The unranking formulas as implemented

Notation: `n` the base, `n1 = n - 1`, the Warp pair is `{warpLo, warpHi}` with `warpLo = first[warpId]` and `warpHi = n1 - warpLo` (so `warpLo = o = (n - 1) / 3` and `warpHi = 2o`; the code reads the numogram's own arrays rather than recomputing `o`), `C(x, 2) = x(x-1)/2` (exactly `+0` below 2), `S_c` the ascending pair ids of Torque cycle c with length `L_c`.

- `plexBelow(x) = (0 < x) + (n1 < x)`, `warpBelow(x) = (warpLo < x) + (warpHi < x)` (0 without a Warp), `nonTorqueBelow = plexBelow + warpBelow`, `torqueBelow(x) = x - nonTorqueBelow(x)`
- `zonesBelow_c(x) = #{s in S_c : s < x} + L_c - #{s in S_c : s <= n1 - x}`; `syzBelow_c(x) = L_c - #{s in S_c : s <= n1 - x}` (both by binary search over the cycle's segment of the sorted copy)
- `countBelow(sel, m)`: `m >= count` gives `total(sel)`; otherwise `[a, b] = netSpanOf(m)` and the result is `within(sel, a) + row(sel, a, b)`
- `within(sel, a)` (both zones below a): chrono `C(torqueBelow(a), 2)`; amphi `torqueBelow(a) * nonTorqueBelow(a)`; xeno `C(nonTorqueBelow(a), 2)`; syzygetic-chrono `Math.max(0, a - n / 2) - (Warp and warpHi < a ? 1 : 0)`; cyclic-chrono `sum_c (C(zonesBelow_c(a), 2) - syzBelow_c(a))`; cross-torque-chrono `C(torqueBelow(a), 2) - sum_c C(zonesBelow_c(a), 2)`; plex-amphi `torqueBelow(a) * plexBelow(a)`; warp-amphi `torqueBelow(a) * warpBelow(a)`; chaotic-xeno `plexBelow(a) * warpBelow(a)`; syzygetic-xeno `Warp and warpHi < a ? 1 : 0`
- `row(sel, a, b)` (the demons `(a, y)` with `y < b`) depends on the region of zone a. Torque zone a in cycle j with partner `p = n1 - a`: chrono `torqueBelow(b)`, amphi `nonTorqueBelow(b)`, syzygetic-chrono `(p < b)`, cyclic `zonesBelow_j(b) - (p < b)`, cross `torqueBelow(b) - zonesBelow_j(b)`, plex-amphi `plexBelow(b)`, warp-amphi `warpBelow(b)`, xeno and its subtypes 0. Plex zone a (`n1`): amphi and plex-amphi `torqueBelow(b)`, xeno `nonTorqueBelow(b)`, syzygetic-xeno `(0 < b)`, chaotic-xeno `warpBelow(b)`, others 0. Warp zone a: amphi and warp-amphi `torqueBelow(b)`, xeno `nonTorqueBelow(b)`, syzygetic-xeno `(p < b)`, chaotic-xeno `plexBelow(b)`, others 0.
- `at(k)`: `lo = 0`, `hi = space.count - 1`; `while (lo < hi) { mid = floor((lo + hi) / 2); if (countBelow(mid + 1) > k) hi = mid; else lo = mid + 1 }`; return `space.at(lo)` after the membership assertion.

These are exactly the plan's formulas. Every one was also derived independently before coding (for example the two partner terms: `p < b` removes the syzygy from the cyclic row and adds it to the syzygetic row).

## Complexity, as measured

Scratch measurements (throwaway test, not committed), one at(k) call, ranks spread over the selection:

| Base n (Torque cycles K) | chrono / amphi / plex-amphi at(k) | cross-torque at(k) | cyclic-chrono at(k) | first call builds the sorted copy |
| --- | --- | --- | --- | --- |
| 1024 (54) | 0.012-0.025 ms | 0.08 ms | 0.09 ms | about 0.8 ms |
| 65,536 (2,066) | 0.007-0.031 ms | 1.7 ms | 2.3 ms | about 4 ms |
| 1,048,576 (26,270) | 0.010-0.034 ms | 27 ms | 37 ms | about 8 ms |
| 67,108,864 (1,290,870) | 0.008-0.010 ms | 1.8 s | 2.5 s | about 0.2 s, 4 bytes per Torque pair (128 MiB) |

So the type-level and five subtype selectors are constant for practical purposes (about 51 steps of an O(1) count). The two per-cycle selectors cost O(K log n) per step, as the plan documents (T-02-25, accepted): fine for interactive bases (K in the tens or hundreds, well under a millisecond) and slow only at the cap, where nobody pages cyclic chronodemons rank by rank. No query of any other selector ever builds the sorted copy (proved by the +0.0 MiB figure at 2^26).

## Task Commits

1. **Task 1: Selector counting and binary-search unranking (group, subtype)** - `8787787` (feat)
2. **Task 2: Sampled unranking beyond 64 and at the ceiling** - `3a8c6cd` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Public API added

```ts
// DemonSpace (engine/core/types.ts; reachable as g.demons, no barrel change needed)
group(type: DemonType): DemonSelection          // RangeError for an unknown type; frozen, memoized per name
subtype(subtype: DemonSubtype): DemonSelection  // RangeError for an unknown subtype; frozen, memoized per name
// DemonSelection (02-01, unchanged): { readonly count: number; at(k: number): DemonRef }
//   count = typeCounts()[type] / counts()[subtype]; at(k) = the k-th member in ascending mesh order, RangeError unless k is a whole number in [0, count)

// engine/core/unrank.ts (siblings only, not in the barrel)
createSelection(space: DemonSpace, internals: NumogramInternals, selector: DemonType | DemonSubtype): DemonSelection
```

## Test coverage and runtime

- **`engine/test/demons.unrank.test.ts`** (29 tests, about 1.9 s of test time, 2.3 s wall alone):
  - hand-checked bases 10 and 28 (literals from the definitions plus the reference): 4 tests
  - names, memoization, freezing, ranks: 1 + 6 bases (2, 4, 10, 12, 28, 82) x 10 selectors + strict ascent and membership of every member at base 30
  - **every even n 2..64** (32 bases, 22,352 demons): all ten selectors, **44,704 ranks** (each demon once under its type and once under its subtype) equal the reference's filtered enumeration; the per-selector counts equal `typeCounts()` / `counts()` and the three type counts and the seven subtype counts each sum to `n(n-1)/2` (blocks [2,32] 16 ms and [34,64] 95 ms)
  - **every even n 66..300** (118 bases): for each of the 10 selectors the first rank, the last rank and 10 ranks from `fc.sample` (`seed: 20261007`, uniform draws through `fc.noBias`) equal the reference; empty selections must throw a RangeError for `at(0)` (blocks 232 ms and 851 ms)
  - **n = 666** (14 Torque cycles, no Warp) **and n = 1024** (54 Torque cycles, Warp): 50 sampled ranks plus both ends per selector (`seed: 20261008`) equal the reference and, for 20 sampled ranks, `at(k).mesh < at(k + 1).mesh` (117 ms and 305 ms)
  - **partition identities without a reference** (ranks found with `at()` alone, `seed: 20261009`): for bases 1026, 2048 and 4096 with all ten selectors, and for eight bases sampled between 1026 and 2^20 (46,004 to 891,264) with the array-free selectors, every one of about 14 meshes per base (0, 1, the last two, ten sampled) satisfies: the type ranks sum to m; the subtype ranks sum to m and each type's rank is the sum of its subtypes' ranks (amphi and xeno always; chrono up to 4096); the demon at m is the member of its own type and subtype with exactly that rank (2 to 61 ms each)
- **`engine/test/ceiling.test.ts`**: the 2^26 assertions above sit inside the existing ceiling test, before the final `clearNumogramCache()`; `CEILING_MS = 20_000` and every earlier assertion are unchanged; 200 sampled chronodemon ranks ascend and belong to the group (`seed: 20261008`), and 20 sampled meshes (`seed: 20261009`) satisfy the type-rank sum and the plex/warp-amphi and chaotic/syzygetic-xeno splits at 2^26 (the first ceiling test still takes about 1.5 s).
- **Whole engine project:** 13 files, 486 tests, 5.4 s wall in both timezones (was 12 files, 457 tests, 5.2 s). `npm run test` and `npm run test:tz`: 24 files, 891 tests, about 6 s each.

## Mutation spot check (nothing committed; each mutant applied to `engine/core/unrank.ts`, the original restored from a copy or `git checkout -- engine/core/unrank.ts` afterwards, `git diff --quiet` clean each time)

The plan's own mutant (cross-torque-chrono `within` without the `- sum_c C(zonesBelow_c(a), 2)` term): **12 tests FAIL** (base 28 in the hand-checked and bounds tests, both sweeps up to 64, both sampled blocks to 300, both bases 666/1024 and the three partition bases with cycle subtypes); the ceiling test still passes, as intended, because it never queries cross-torque. The full set of 13 mutants:

| Mutant | demons.unrank.test.ts | ceiling.test.ts alone |
| ------ | --------------------- | --------------------- |
| M1 cross-torque within omits the same-cycle sum | KILLED (12 failed) | survives (no per-cycle arrays at 2^26 by design) |
| M2 cyclic within keeps the syzygies | KILLED (10) | survives (same reason) |
| M3 syzygetic-chrono within forgets the Warp pair | KILLED (7) | KILLED |
| M4 `countAtMost` is `countLess` | KILLED (14) | survives (same reason) |
| M5 search uses `>= k` instead of `> k` | KILLED (26) | KILLED |
| M6 cyclic row keeps the partner in the count | KILLED (10) | survives (same reason) |
| M7 Warp row syzygetic-xeno ignores the partner | KILLED (14) | KILLED |
| M8 Plex row chaotic-xeno uses `plexBelow` | KILLED (14) | KILLED |
| M9 amphi within uses torque x torque | KILLED (21) | KILLED |
| M10 `zonesBelow` drops the high-zone term | KILLED (15) | survives (same reason) |
| M11 Torque-row warp-amphi uses `plexBelow` | KILLED (13) | KILLED |
| M12 sorted copy left unsorted | KILLED (11) | survives (same reason) |
| M13 `torqueBelow` forgets the Warp | KILLED (14) | KILLED |

No mutant survives the reference-based tests. Against the ceiling test alone, every mutant that touches an array-free formula is killed at 2^26 and only the six that need the per-cycle arrays survive, which is exactly the boundary the plan draws.

## Decisions Made

- The four decisions in `key-decisions` above.
- Deviation-free scope: `types.ts` gains only the two methods with their complexity notes; `engine/index.ts` is unchanged (`DemonSelection` and `DemonSpace` were already exported; `createSelection` is a sibling-only module like `createDemonSpace`).

## Deviations from Plan

### Design notes (no deviation rule applies; nothing in the acceptance criteria or the must-haves is loosened)

**1. The sorted-pairs cache is a module-level WeakMap, not a private field of the demon space.**
- The plan says "cache it on the demon space (private field)". `createSelection(space, internals, selector)` is a free function of the plan's own key link, and `DemonSpaceImpl` freezes itself, so a writable cache field would have to be threaded through a widened interface or a callback.
- A `WeakMap<NumogramInternals, Int32Array>` in `unrank.ts` has the same semantics the must-haves ask for: built lazily on the first cyclic/cross query, once per numogram, shared by both selectors, released together with the numogram, never built by any other selector (the +0.0 MiB figure at 2^26 proves that).

**2. unrank.ts calls the space, not `netSpanOf` from demons.ts.**
- The plan's import rule ("no runtime import cycle") and its formula text ("goes straight through netSpanOf") pull in different directions: `demons.ts` imports `unrank.ts` (for `createSelection`), so `unrank.ts` cannot also import `netSpanOf` from `demons.ts`. It uses `space.netSpanOf(m)` and `space.at(lo)` from the `DemonSpace` interface, which range-check and call the very same exact `netSpanOf`. `buildDemon` therefore did not have to be exported.

**3. Plan detail: "n = 666 and n = 1024 (54 Torque cycles)".**
- Only 1024 has 54 Torque cycles (and a Warp); base 666 has 14 (and no Warp). The test asserts 14 and 54 from `refStructure`, so both the with-Warp and without-Warp structures are covered at that size.

### Additions beyond the plan (all additive)

- Every sampled block also checks the first and the last rank, and empty selections must throw a RangeError for `at(0)` in every sweep.
- The partition-identity block (bases up to about 10^6, all ten selectors up to 4096) and the extra 2^26 checks (the six xenodemons written out from the definition, the last syzygetic-chrono, the first plex-amphi and warp-amphi, 200 ascending chrono ranks, the type-rank sum at the cap). They give absolute-rank evidence above the base where the reference stops (n = 1024).
- Sampled draws use `fc.noBias(...)` (fast-check 4.10 exposes it as a function): the default bias clustered the sampled bases at 1034..1048 and the ranks near the ends.

### Auto-fixed Issues

None in the engine. Two mistakes in my own new tests were fixed before the first commit of Task 2 (an empty selection made `count - 1` equal `-1` for the neighbour-ascent sampler, and an arbitrary `> 400` sample-count bound), see the test file; no rule needed.

### TDD note

Task 1 was RED first (`demons.unrank.test.ts` run against the absent methods: 14 of 14 failed with `space.group is not a function`), GREEN after the implementation (14 pass; the file has 29 tests after Task 2). Task 2's tests target code Task 1 already delivered, so their RED state cannot exist by construction; the 13-mutant table stands in, and the plan's own mutant fails 12 tests.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run --project engine` and the America/New_York run: 13 files, 486 tests pass in both (5.4 s wall each). `npx tsc -p engine/tsconfig.json --noEmit` and `-p engine/tsconfig.test.json --noEmit`: exit 0. `npm run lint`: no warnings or errors.
- `npm run typecheck` exit 0. `npm run test` and `npm run test:tz`: 24 files, 891 tests pass. `npm run check:repo`: OK (10 checks).
- `MSYS_NO_PATHCONV=1 npm run verify`: **exit 0** on a clean tree. Inside it: unit tests 891 in both timezones, sub-path e2e 10 passed, build, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 75 passed and 5 skipped (60 DOM goldens unchanged, 10 static-export, 5 behaviour on the UTC project; the 5 skipped are the same behaviour specs under the New York project), final `check-repo: OK` including `clean-tree` and `static-out`.
- `git diff --quiet fabde14 -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` and `git diff --quiet f7d6689 -- app` exit 0 (nothing frozen modified, no `app/` change); no `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. No LISTENING socket on ports 3000, 3007, 3111, 3112, 3113 afterwards; two throwaway measurement tests were deleted before the gate and never committed.
- Acceptance greps: `types.ts` contains `group(type: DemonType): DemonSelection` and `subtype(subtype: DemonSubtype): DemonSelection`; `unrank.ts` exports `createSelection`, contains `countBelow` and `Math.max(0, a - n / 2)`, and `grep -nE "for \(.*< *(this\.)?(space\.)?count\b" engine/core/unrank.ts` prints nothing; its only imports are `import type` from `./numogram` and `./types` plus the `DEMON_TYPES` constant from `./types`; the test file contains `refDemons`, `'cross-torque-chrono'`, `64`, `seed: 20261007`, `seed: 20261008`, `666` and `1024`; `ceiling.test.ts` contains `22369621`, `33554431` and `CEILING_MS = 20_000`.

## Notes for plan 02-07 and the adapter plans (02-08..02-12)

- **Nothing in this plan touches 02-07's files** (lore, NOTICE, check-repo, `app/`), and 02-07 needs no unranking. The engine core (ENG-03 including filtered access) is complete: `at`, `ref`, `meshOf`, `netSpanOf`, `counts`, `typeCounts`, `incident`, `numodemons`, `group`, `subtype`.
- **Base-10 adapters:** the viewer's 45 demons are `g.demons.at(0..44)` in mesh order (unchanged from 02-05). `group('chrono')` has 15 members, `subtype('cross-torque-chrono')` is empty in base 10, so nothing in the swap depends on the new methods; they exist for the Phase 5 demon browser ("all cross-Torque chronodemons" paged by rank).
- **Cost guidance for Phase 5:** unranking by type and by the five non-cycle subtypes is about 10-30 microseconds per rank at any base; `cyclic-chrono` and `cross-torque-chrono` are O(K log n) per step (about 0.1 ms at n = 1024, about 2 ms at 65,536, about 30 ms at 2^20, about 2 s at 2^26). A browser that pages those two at huge K should page from a cached page start or offer them only below a K threshold. If that ever matters, per-cycle prefix sums would make it O(log) again; not needed for v1.
- **Selections are values:** a `DemonSelection` keeps its demon space alive (memoized on it); compare demons by field, not identity (`DemonRef` is a frozen fresh object per call), exactly as noted in 02-05.
- **Numodemons** are still not a selection: `numodemons()` runs b ascending (mesh descending), and `group`/`subtype` are always ascending by mesh.

## Issues Encountered

- An inline `node -e` edit through the shell mangled a template literal once (a `${...}` was expanded by bash); the file was inspected and repaired with the Edit tool before any test result was trusted. No effect on the repository.

## Known Stubs

None.

## Threat Flags

None. T-02-25 (cyclic/cross unranking DoS at huge K): accepted and documented; the two selectors build their sorted copy lazily (about 0.2 s and 128 MiB at 2^26, measured), every other selector allocates nothing (+0.0 MiB at 2^26 asserted). T-02-26 (invalid selector or rank): RangeError for unknown, inherited-property and crossed names and for every non-integer, negative, too large, non-number rank, tested for every selector. T-02-27 (off-by-one in counting): every rank of every selector for every even n up to 64, fixed-seed samples for every even n up to 300, 666 and 1024, the partition identities up to about 10^6, the exact 2^26 end points, thirteen mutants killed, and the internal membership assertion in `at`. No new network, auth, file or schema surface.

## Requirements Note

`requirements-completed` lists ENG-03 because this plan's frontmatter carries it (filtered access was the missing half after 02-05). Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Next Phase Readiness

- The engine core is complete; the base-10 swaps (02-08 onward) can start, and the demon browser of Phase 5 has every operation it needs.

## Self-Check: PASSED

- FOUND: `engine/core/unrank.ts`, `engine/test/demons.unrank.test.ts`, `engine/core/types.ts`, `engine/core/demons.ts`, `engine/test/ceiling.test.ts`
- FOUND commits: `8787787`, `3a8c6cd`
