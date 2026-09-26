---
phase: 02-engine-core-and-base-10-migration
plan: 04
subsystem: engine
tags: [engine, pure-ts, typed-arrays, counting-sort, cycles, immutability, lru-cache, brute-force-sweep, ceiling-test, vitest, fast-check]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-01 contracts (Numogram, Cycle, PairInfo, CurrentInfo, GateInfo), assertBase, MAX_BASE, triangular, digitalRoot, formatNumeral, formatGateName; 02-02 the definitions-only reference tests/bruteforce/numogramReference.ts and the frozen notable-bases fixture
provides:
  - engine/core/numogram.ts, createNumogram(base): the frozen, cached, O(n) typed-array structure (zones, pairs, currents, gates, regions as canonical Cycle[]) plus clearNumogramCache, NUMOGRAM_CACHE_LIMITS and the internal numogramInternals view for 02-05/02-06
  - proof against the independent reference for every even n from 2 to 2000, against the frozen base-10 oracle and the frozen notable-bases fixture
  - the 2^26 ceiling test with explicit time and memory limits (D-11 decision: it stays inside npm run verify)
affects: [02-05, 02-06, 02-08, 02-09, 02-10, 02-11, phase-03-layouts, phase-05-demon-browser, phase-06-worker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eager O(n) typed arrays, lazy per-cycle views: five Int32Arrays (flow, pairCycle, first, length, offset) hold the whole decomposition; a Cycle is a tiny frozen value object over them, created on demand, compared by id"
    - "Canonical order from a stable counting sort over cycle lengths (never from sorting objects); discovery in ascending pair order makes the tie-break (smallest pair) automatic"
    - "Freeze in the constructor, lazy caches in #private fields (private fields stay writable after Object.freeze)"
    - "Validate-then-allocate again: assertBase before any array, evict-then-build in the cache so the peak of a huge build never includes entries about to be evicted"
    - "Sweeps collect short mismatch strings and assert once per block; the mutation spot check is recorded per mutant"

key-files:
  created:
    - engine/core/numogram.ts
    - engine/test/numogram.test.ts
    - engine/test/structure.sweep.test.ts
    - engine/test/base10.engine.test.ts
    - engine/test/notable-bases.test.ts
    - engine/test/ceiling.test.ts
  modified:
    - engine/index.ts

key-decisions:
  - "D-11: the 2^26 test runs inside npm run verify. Measured 616-623 ms and +302 MiB of array buffers (+271 MiB in a fresh process), far below the 10 s / 512 MiB fallback thresholds, so package.json is unchanged and there is no test:heavy script"
  - "Cycle storage: flow (all pair ids, cycle after cycle, each cycle rotated to its smallest pair, in flow order), pairCycle (cycle id of every pair), and per-cycle first / length / offset; 4 bytes per zone for flow + pairCycle plus 12 bytes per cycle (283,925,920 bytes at 2^26)"
  - "Views are value objects: cycleAt(id) returns a new frozen view unless g.cycles has been materialized; only Plex and Warp are shared objects (g.plex, g.warp, and the same objects inside g.cycles)"
  - "The fixture's current.from is the viewer's drawing origin, not engine data: it equals the pair's even member (the walk leaves each pair through its even member: 8 -> 7, 2 -> 5, 4 -> 1, 6 -> 3) except the Plex, which the viewer draws at 9 (its odd member); CurrentInfo stays {pair, lo, hi, to}"

patterns-established:
  - "Engine tests reach the reference by relative path ../../tests/bruteforce/numogramReference (compiles under engine/tsconfig.test.json); the engine sources never import outside engine/"
  - "Frozen-fixture readers use readFileSync(fileURLToPath(new URL('./fixtures/...', import.meta.url))) and never write"

requirements-completed: [ENG-01, ENG-02, ENG-04, ENG-05]

# Metrics
duration: 21min
completed: 2026-09-26
---

# Phase 2 Plan 04: createNumogram Summary

**`createNumogram(base)` builds the frozen, cached numogram of any even base from 2 to 2^26 in O(n) typed arrays (1.29 million cycles at the cap in 0.62 s, no per-cycle objects), and it equals the independent reference for every even n up to 2000, the frozen base-10 oracle and the notable-bases fixture.**

## Performance

- **Duration:** about 21 min (started about 2026-09-26T20:07Z, finished about 20:28Z; the full gate is about 3 min of that)
- **Tasks:** 3 (3 task commits, plus this metadata commit)
- **Files:** 6 created, 1 modified (`engine/index.ts`); `package.json` is in the plan's file list only for the D-11 fallback and stays untouched

## Accomplishments

- **The engine core.** `createNumogram(base)` runs `assertBase` first, then: (1) discovers the cycles of the pair map `next(p) = d < P ? d : n1 - d` with `d = n1 - 2p` by ascending walks (so each cycle's first pair is its smallest); (2) sorts them by length descending with a stable counting sort (ties keep ascending first pair); (3) lays every cycle out in flow order in one `flow` array and records `pairCycle`; (4) finds Plex (the fixed pair 0, always) and Warp (the other fixed pair, if any) from the sorted order, asserting internally that every Torque cycle has at least two pairs. Warp is derived from the fixed point, the `n = 3o + 1, o odd` formula is used only as the test oracle.
- **Immutable and bounded.** The instance, `cycles`, `torques` and every `Cycle` view are frozen; the typed arrays sit in `#private` fields; `pairs()` and `zones()` return fresh copies; every index argument is checked with a `RangeError` that names the argument and the valid range (`Invalid pair id 5: expected a whole number from 0 to 4`). The cache is an LRU of 4 entries and at most 2^26 cached zones; eviction happens before the build so a 2^26 build never coexists with entries that are about to go.
- **Proof against the definitions.** The sweep compares, for EVERY even n from 2 to 2000 (1000 bases), the engine's partner, pairOf, pair(id), current, nextPair, gate (from, to, cumulation), cycleOfZone/cycleOfPair, cycle count, torque count, every cycle's kind, pairs(), lengths, firstPair, torqueIndex, the odd/even zone walk (zones() and zoneAt) and Warp presence and position against `refStructure(n)`. 0 mismatches.
- **Proof against the frozen oracles.** Engine base 10 equals `base10.golden.json` (pair set, every current's pair and target, every gate's from/to/cum and the own-base name, zoneRegion, regions, tc.zones, tc.syzygies in flow order, tc.edges as the closed walk; named regressions `Gt-15 is 5 -> 6` and `Gt-03 is 2 -> 3`). The engine equals the notable-bases fixture for all 17 full bases (pairCount, warp, cycles, torqueLengths, all gates) and the 4 digests (256, 666, 1000, 1024: warp and torqueLengths), and the guide's examples hold (16 [4,2], 28 [9,3], 80 [39], 82 [27,9,3]; base-12 gates 0,1,3,6,a,4,a,6,3,1,b,b, Gt-56, no Warp, Torque [1,2,4,3,5]).
- **The ceiling is enforced and measured** (numbers below): 2^26 is built inside the limits and 2^26 + 2 is refused.

## Task Commits

1. **Task 1: createNumogram with O(n) typed arrays, canonical Cycle[], immutability and a bounded cache** - `e009d18` (feat)
2. **Task 2: Sweeps against the independent reference (every even n <= 2000), the frozen base-10 oracle and the notable-bases fixture** - `c07146b` (test)
3. **Task 3: Base 2^26 ceiling test with explicit time and memory limits (D-11, ENG-05)** - `2676daf` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Public API (engine/index.ts, new in this plan)

```ts
createNumogram(base: number): Numogram          // RangeError for any base assertBase refuses; cached, frozen
clearNumogramCache(): void
NUMOGRAM_CACHE_LIMITS: Readonly<{ entries: 4; zones: 67108864 }>
```

`Numogram` is exactly the 02-01 interface (no `demons` yet, 02-05 adds it). Not exported from the barrel, for sibling engine modules only (`engine/core/numogram.ts`):

```ts
numogramInternals(g: Numogram): NumogramInternals
interface NumogramInternals { flow: Int32Array; pairCycle: Int32Array; first: Int32Array; length: Int32Array; offset: Int32Array; torqueCount: number; plexId: number; warpId: number }
```

## How cycles are stored

Five `Int32Array`s and three integers, nothing per cycle:

- `flow[pairCount]`: the pair ids of cycle 0, then cycle 1, ... each cycle starting at its smallest pair and following the next-pair map.
- `pairCycle[pairCount]`: the cycle id of every pair (this is what makes `cycleOfZone(z)` O(1)).
- `first[k]`, `length[k]`, `offset[k]`: per cycle its smallest pair, its length in pairs and its start index in `flow`.
- `torqueCount`, `plexId`, `warpId` (`-1` if none). Cycle ids are in canonical order, so ids `0 .. torqueCount-1` are Torque, then Plex, then Warp; `torqueIndex` of a Torque cycle is its id.

The walk of a cycle (zones) is derived on the fly: pair `lo` has members `lo` and `n-1-lo`, the odd one first, then the even one (base 10 Torque: 1, 8, 7, 2, 5, 4). `g.cycles` and `g.torques` materialize all views once and are documented as meant for small bases; nothing in the 2^26 test touches them.

## Measured 2^26 (D-11)

Three runs of `npx cross-env CCRUG_TZ=UTC vitest run --project engine engine/test/ceiling.test.ts` (ceilings asserted: 20,000 ms, 768 MiB of array buffers, 128 MiB of heap, storageBytes <= 8 * 2^26):

```
[ceiling] base 2^26: 616 ms, arrayBuffers +302.0 MiB, heapUsed -1.5 MiB, storageBytes 283925920, cycles 1290872
[ceiling] base 2^26: 623 ms, arrayBuffers +302.8 MiB, heapUsed -0.1 MiB, storageBytes 283925920, cycles 1290872
[ceiling] base 2^26: 621 ms, arrayBuffers +301.9 MiB, heapUsed -1.5 MiB, storageBytes 283925920, cycles 1290872
```

- Retained typed arrays: 283,925,920 bytes (270.8 MiB); the extra 31 MiB in the in-test delta is presumably the 32 MiB discovery `seen` array, not yet collected. In a fresh process (`tsx` probe, run twice): 622 ms, +270.7 MiB.
- 1,290,872 cycles = 1,290,870 Torque + Plex + Warp `{22369621, 44739242}`; the cycle count and the whole length histogram equal a Uint8Array walk of the definition computed in the test; the lengths sum to 2^25.
- **D-11 decision: "2^26 runs inside npm run verify".** The measurement is far below the plan's fallback thresholds (10 s, 512 MiB), so the fallback (`it.runIf(CCRUG_HEAVY)`, an always-on 2^22 case, `test:heavy`) was NOT applied and `package.json` is unchanged. The whole ceiling file takes about 3.8 s (its share of `npm run test`, which totals 4.9 s for 782 tests in 21 files).
- **Extra worst case (not in the plan):** base 67108860 has pair 1 on a single cycle of 2^25 - 3 pairs, which makes the counting sort's temporary bucket array (sized by the longest cycle, 4 bytes per length up to 33.5 million) as large as flow. Fresh-process measurement: 1021 ms, +384 MiB peak (256 MiB retained plus 128 MiB temporary), still well under both the ceiling and the fallback threshold; the ceiling test covers it with the same limits (in-process the delta reads lower, about +113 MiB, because the collector frees the previous test's buffers meanwhile; the comment in the test says so).
- Other checks in the file: `createNumogram(2 ** 26 + 2)` and `2 ** 27` throw `RangeError` without allocating; `storageBytes / n` is between 4 and 8 for n = 2^12, 2^14, 2^16, 2^18; 1000 fixed-seed cycles (seed 20261001) close on themselves along the next-pair map; 10,000 fixed-seed pairs (seed 20261002) match the definition and stay in their cycle; the cache zone budget evicts the oldest of three 2^25-zone bases although fewer than 4 entries are cached.

## Sweep coverage and runtime

- Bases: every even n from 2 to 2000 (1000 bases), in four blocks [2,500], [502,1000], [1002,1500], [1502,2000], each asserting `covered === 250` so an empty loop cannot pass.
- Runtime: 96 + 106 + 176 + 247 ms = about 0.63 s for the whole file (whole file 0.9 s including start-up), well under the plan's 5 s target; the reference dominates the cost.
- Other engine tests added: 33 in `numogram.test.ts`, 9 in `base10.engine.test.ts`, 26 in `notable-bases.test.ts`. The engine project now has 377 tests in 10 files.

## Mutation spot check (nothing committed; `git checkout -- engine/core/numogram.ts` after each)

| Mutant | Result |
| ------ | ------ |
| M1 (the plan's): the next-pair step in the build loops uses `n1 - 2 * q + 1` | sweep, base-10 and notable-bases tests all FAIL (the build itself throws `internal: pair map is not a permutation`) |
| M2: only the public `nextPair` method is off by one | sweep FAILS (4 blocks); the base-10 and notable tests do not exercise `nextPair`, which is why the sweep matters |
| M3: odd and even zone of a pair swapped in the walk | sweep and base-10 tests FAIL |
| M4: counting sort ascending instead of descending | sweep, base-10 and notable-bases tests FAIL |
| M5: Warp detection ignores `first != 0` | sweep and notable-bases tests FAIL |

`git diff --quiet -- engine/core/numogram.ts` is clean afterwards.

## Decisions Made

- The four decisions in `key-decisions` above (D-11 measured in-verify, storage layout, views as value objects, `current.from` is viewer data).
- Eviction happens before the build (the plan allows either order): peak memory of a 2^26 build never includes a cache entry that is about to be evicted.
- `gate(k)` writes `digitalRoot(triangular(k), base)` and `triangular(k)` separately (two calls, trivially cheap) so the plan's literal acceptance grep `digitalRoot(triangular(` holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own test, fixed before the first commit of that file] The first draft of the base-10 oracle test compared the fixture's `current.from` to `current(id).hi`**
- **Found during:** Task 2 (first GREEN run: `Hold from: expected 7 to be 2`)
- **Issue:** The plan asks for the currents' `(pair, to)`. The fixture's `from` is the viewer's drawing origin and is not a function of `hi`: Hold is `from 2 to 5`, Sink `from 4 to 1`, while Surge is `from 8`, Warp `from 6`, Plex `from 9`.
- **Fix:** The test now compares `pair` and `to` as the plan says, and a separate test records the rule that does hold: `from` is the pair's even member for Surge, Hold, Sink and Warp, and the odd member (9) for the Plex. The engine was correct; no engine change.
- **Files modified:** `engine/test/base10.engine.test.ts`
- **Commit:** `c07146b`

Otherwise none: the plan was executed as written. Additions beyond the plan (all inside the plan's test files, none changes an acceptance criterion): the one-huge-cycle worst case and the cache zone-budget test in `ceiling.test.ts`, the barrel/internals and LRU-hit tests in `numogram.test.ts`, the `from` rule above.

### TDD note

Task 1 was run RED first (`numogram.test.ts` written, vitest failed with the module absent), then GREEN on the first run after the implementation (33/33). Tasks 2 and 3 are tests for code that Task 1 already delivered, so their RED state cannot exist by construction; the mutation spot check above stands in for it (each mutant turns a test red).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run --project engine` and the America/New_York run: 10 files, 377 tests pass in both.
- `node scripts/golden-manifest.mjs verify engine/test/fixtures/MANIFEST.json engine/test/fixtures/derived/MANIFEST.json`: OK (1 file in 1 set each); `git diff --quiet f7d6689 -- engine/test/fixtures/base10.golden.json engine/test/fixtures/MANIFEST.json e2e/__golden__` exits 0; `git diff --quiet fabde14 -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` exits 0; `git diff --quiet f7d6689 -- app` exits 0.
- `npm run typecheck` exit 0 (root, engine, engine test, components tsc and lint with the engine purity override). `npm run test`: 21 files, 782 tests pass; `npm run test:tz`: the same. `npm run check:repo`: OK (10 checks).
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0 (about 3.5 min). Inside it: unit tests 782 in both timezones, sub-path e2e 10 passed, build, `page-weight: OK`, e2e 75 passed and 5 skipped (60 DOM goldens unchanged, 10 static-export, 5 behaviour on the UTC project; the 5 skipped are the same behaviour specs under the New York project), final `check-repo: OK` including clean-tree and static-out. The tree is clean afterwards and no listener remained on ports 3000, 3007, 3111, 3112, 3113.
- Greps: `numogram.ts` contains `assertBase(`, `new Int32Array(`, `Object.freeze(this)`, `digitalRoot(triangular(` and `67108864`; `grep -cE "\.sort\(|Math\.random" engine/core/numogram.ts` prints 0; `engine/index.ts` has no `numogramInternals`; `ceiling.test.ts` has no `.cycles` or `.torques` access.

## Notes for plans 02-05 and 02-06

- Build the demon space on `numogramInternals(g)` (`pairCycle` gives the cycle of any pair in O(1); `plexId`/`warpId`/`torqueCount` classify a cycle id into kind without a view). Zone `z` belongs to cycle `pairCycle[min(z, n-1-z)]`. `g.cycleOfZone(z).id` does the same but allocates a view per call: in hot loops use the array.
- `DemonRef.cycleA` / `cycleB` are `Cycle.id`s in canonical order (Torque ids `0 .. torqueCount-1`, then Plex, then Warp); cross-Torque is `cycleA !== cycleB` with both Torque.
- Views are value objects: compare cycles by `id`, never by identity (only Plex and Warp are shared objects).
- The demon subtype names of `DEMON_SUBTYPES` equal the reference's `REF_SUBTYPES` strings one for one, so no mapping is needed in the 02-05 tests (checked by reading both lists, not asserted here).
- The base-10 adapter (02-09, currents): the frozen data's `from` for each current is the pair's even member, except the Plex, which is drawn at 9 (see Deviations 1). `engine.current(pair).to` and `pair(id)` cover everything else, and `cycleOfPair(id).kind` gives the region name to join with the lore.
- Engine `pair(id)` returns `{id, lo, hi, odd, even}` with `odd`/`even` by parity (pair 0 is `odd 9, even 0` in base 10), and Torque walks list the odd member first.

## Issues Encountered

- None blocking. Windows has no `python3` in this shell; two text edits that I first scripted with Python were redone with the Edit tool.

## Known Stubs

None.

## Threat Flags

None. T-02-16 (DoS at huge n): `assertBase` before allocation, O(n) arrays, counting sort, no eager per-cycle objects, ceiling test with explicit limits, the 2^26 + 2 refusal test and the worst-case one-huge-cycle test. T-02-17 (cache retention): LRU of 4 entries and 2^26 zones, tested in both dimensions. T-02-18 (shared cached state mutated): the numogram, `cycles`, `torques` and every view are frozen, arrays are `#private`, `pairs()`/`zones()` return copies (tests assign, push and mutate). T-02-19 (out-of-range indices): every index argument is checked with a RangeError. T-02-20 (shared bug with the oracle): sweeps use the definitions-only reference, the frozen base-10 JSON and the frozen notable-bases fixture; five mutants killed. No new network, auth, file or schema surface.

## Requirements Note

`requirements-completed` lists ENG-01, ENG-02, ENG-04 and ENG-05 because this plan's frontmatter carries them; ENG-01/ENG-02 (structure), ENG-04 (input refusal and the structural sweep) and ENG-05 (the 2^26 build) are proven here, but ENG-03 and the demon halves come in 02-05/02-06. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Next Phase Readiness

- Plan 02-05 (virtual demon space) can attach `demons` to `Numogram` using `numogramInternals`; it can sweep counts to n = 2000 against `refSubtypeCounts` and enumerate to n = 300 against `refDemons`.
- Plan 02-06 (demon groups) is unaffected; the cache and freeze rules here hold for any object it adds.
- The heavy tests are in `npm run verify` on this machine at about 4 s total; if a slower CI runner ever exceeds the ceilings, the D-11 fallback recipe in the plan (opt-in `test:heavy`) is still available.

## Self-Check: PASSED

- FOUND: `engine/core/numogram.ts`, `engine/test/numogram.test.ts`, `engine/test/structure.sweep.test.ts`, `engine/test/base10.engine.test.ts`, `engine/test/notable-bases.test.ts`, `engine/test/ceiling.test.ts`, `engine/index.ts` (modified)
- FOUND commits: `e009d18`, `c07146b`, `2676daf`
