---
phase: 07-naming-builder
plan: 10
subsystem: engine
tags: [naming, collisions, certificate, partitioned-scan, resumable-job, typed-arrays, nfc, fast-check, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (Naming, NamingPreset, createNameResolver with nameOf and the override > preset > rule layering) and plan 07-02 (smoothingInert, toNfc, upperFirst, euphony@1)
  - phase: 02-engine-core-and-base-10-migration
    provides: engine/core netSpanOf and meshOf (mesh number a(a-1)/2 + b) and the pure-engine lint and tsc gates
provides:
  - engine/naming/collisions.ts, COLLISION_GROUPS_MAX (2000), COLLISION_GROUP_MESHES_MAX (16), COLLISION_SCAN_MAX_N (4096), CollisionGroup, CollisionReport, CollisionJob, provablyUnique, canCertify, createCollisionJob, findCollisions
  - the certificate (O(n log n), instant, no cap) for generated tables with exact override checks, and one generic resumable hash scan over nameOf for every other table
  - engine/naming/index.ts barrel lines (values and types separately); reachable from engine/index.ts through the existing naming barrel line
  - engine/test/naming.collisions.test.ts (65 tests)
affects: [07-11, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A job is a closure with explicit phase state and one step(shouldYield) that always makes progress and returns null until finished; the engine never reads a clock"
    - "Hash equality only nominates; every group is confirmed by exact comparison of the real NFC names, so a wrong hash can slow the scan but never change its answer"
    - "One Float64Array (hash29 * 2^23 + mesh) plus one Uint16Array (first UTF-16 unit) per demon, partitioned in place by cycle-leader swaps, then freed"
    - "Bounded output with exact counts: a running trim keeps the 2000 groups with the lowest first mesh and a cutoff skips groups that cannot enter the list"
    - "The public way to force the scan in a test is a ccru naming with a preset that names no demon (canCertify is false for any preset), so no test-only export exists"

key-files:
  created:
    - engine/naming/collisions.ts
    - engine/test/naming.collisions.test.ts
  modified:
    - engine/naming/index.ts

key-decisions:
  - "Final names are compared after NFC (the report's name is the NFC form); a name whose UTF-16 units are all below U+0300 is already NFC and skips normalisation, an assumption pinned by a test over every such unit and every pair of them"
  - "The scan moves entries to their first-unit partition in place (count, then cycle-leader swaps) instead of copying into a second Float64Array, which keeps the plan's memory figure (one Float64Array and one Uint16Array per demon, about 84 MB at 4096) and frees both arrays when the report is built"
  - "The certified path ignores an override whose mesh number is outside the table, exactly like the resolver (a stale override is never read), and derives its candidate demons only from the two readings of an override text (first letter lowered, and with a/u/i removed when smoothing is on), confirmed by the real nameOf"
  - "createCollisionJob also refuses a table whose length is not the base (RangeError), in addition to the seed-only and over-cap refusals the plan lists"

patterns-established:
  - "A mutant that survives is either proven equivalent or answered with a new test in the same plan (three here: the cap message, the exact-name confirmation, the running cutoff)"

requirements-completed: []  # NAM-03 stays Pending: this plan is the engine half of the collision report; the report UI, the app limit and the jump-to-demon links arrive in 07-11 and 07-20 to 07-23

# Metrics
duration: ~30min
completed: 2026-11-09
---

# Phase 7 Plan 10: Collision Certificate and Resumable Partitioned Scan Summary

**Exact, bounded name-collision reports in the pure engine: an O(n log n) certificate (0.24 ms at 666, 1.3 ms at 4000) proves generated tables collision-free and checks overrides by reading each text back as a join, and one generic hash scan over the UI's own `nameOf` (211 ms at 1024, 3.3 s at 4000) handles every other table as a job that yields through an app-supplied `shouldYield`.**

## Performance

- **Duration:** about 30 min (including 26 mutation runs of the 22 s test file)
- **Completed:** 2026-11-09
- **Tasks:** 1 of 1 (TDD: one RED commit and one GREEN commit)
- **Files created:** 2 (`engine/naming/collisions.ts` 426 lines, `engine/test/naming.collisions.test.ts` 65 tests); 1 modified (`engine/naming/index.ts`, +12 lines)
- **`$PLAN_BASE`:** `b7b74896bb0041eb1c50582eafe435e113adcbe6`

## Accomplishments

- **Certificate (`provablyUnique`, `canCertify`).** A table is certified when every sound is lowercase ASCII, the set is distinct and prefix-free (sort, then compare each sound with its successor; this also catches duplicates), and for smoothing 1 either no sound contains a, u or i (the pass is insert-only and inserts only those) or `smoothingInert` holds. True for every generated table tested (bases 28, 64, 300, all three styles, smoothing 0 and 1), false for a duplicate, a prefix pair, a non-ASCII or upper-case sound, and for `['ta', 'kt', 'tkt']` with smoothing 1. `canCertify` is false for a seed-only naming and for a ccru naming with a preset of its base (preset names must be scanned), mirroring `createNameResolver`'s own rule for when the preset layer applies.
- **Certified report.** With no derived collisions possible, a group is two or more overrides with equal text, plus at most one non-overridden demon whose derived name equals that text. The demon is found by reading the text as a join: lower the first capital, with smoothing also strip a/u/i, split at every distinct sound length, look both halves up in a `Map`, check the order (hi-lo: first sound is the higher zone), skip overridden demons, and confirm with the real `nameOf`. No per-demon allocation, no cap, cost O(overrides x sound lengths).
- **Scan (`createCollisionJob` and `findCollisions`).** One pass over the same `nameOf` the UI shows: each demon's NFC name gives a 29-bit hash (FNV-1a with a murmur finaliser) packed with its mesh number into one double (`hash29 * 2^23 + mesh`, exact below 2^52) and a first-UTF-16-unit partition id; entries are moved in place to contiguous per-partition ranges, each partition is sorted as a typed array, and every run of equal hashes is verified by recomputing the real names and grouping exact equals. Every phase yields: names every 512 demons, the placement every 65,536 swap steps, the sort and verify between partitions; each `step` makes progress even when `shouldYield` always answers yes, and a finished job returns the same report object forever. The engine contains no clock.
- **Bounded, exact output.** `groups` and `demons` are exact; `list` keeps at most 2000 groups ordered by lowest mesh and each group its lowest 16 meshes with the exact `size`. A running trim (sort and cut at 4000 buffered groups) and a cutoff keep memory bounded when millions of groups exist. All 200 sounds equal at base 200 gives `groups` 1, `demons` 19,900, one group of size 19,900 listing meshes 0 to 15.
- **Refusals.** RangeError for a seed-only naming, for a table that is not one sound per zone, and for a scan above `COLLISION_SCAN_MAX_N = 4096` (the certificate has no cap: a generated table at base 4098 still gets its answer instantly, and the message names the 4096 limit). 4096 x 4095 / 2 = 8,386,560 < 2^23, so a mesh number always fits the packed index; a defensive guard at 2^23 is kept and is unreachable while the cap holds.
- **Zero collisions, proven twice.** For all three styles, both join orders and smoothing 0 and 1 at bases 666 and 1024 (24 cases), the full scan reports `{ groups: 0, demons: 0, list: [] }` and so does the certificate; at base 4000 (harsh, raw, hi-lo) the full scan of 7,998,000 demons reports none.

## Task Commits

1. **Task 1: certificate, override checks and the resumable partitioned scan (TDD)**
   - RED: `a6e6c70` (test) failing tests; the first run failed on the missing module, confirmed before GREEN
   - GREEN: `9d765e1` (feat) `collisions.ts`, the barrel lines, and the tests strengthened after the mutation runs

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `engine/naming/collisions.ts` - constants, types, `provablyUnique`, `canCertify`, the certified report, the scan job (fill, place, walk), `createCollisionJob`, `findCollisions`
- `engine/naming/index.ts` - the collision exports (values and types in separate statements)
- `engine/test/naming.collisions.test.ts` - 65 tests: hand-checked certified cases, a 200-run brute-force differential (tiny alphabet, NFC and case, stale overrides), a preset-layer property, certificate versus forced scan (80 runs, 3 bases x 3 styles x 2 joins x 2 smoothings with 0 to 30 overrides), bounded output at 2,475 and 5,587 groups, an adversarial late group, resumable stepping under 30 yield patterns, refusals, and the exhaustive zero-collision cases

## Timings (Node 22.16, esbuild bundle of the engine, one run each, no yielding)

| Base | Demons | Scan raw | Scan smoothed | Certificate (no overrides) | Certificate (1,000 overrides) |
|------|--------|----------|---------------|----------------------------|-------------------------------|
| 666 | 221,445 | 102 ms | 197 ms | 0.24 ms | 0.66 ms |
| 1024 | 523,776 | 211 ms | 432 ms | 0.35 ms | 0.72 ms |
| 2000 | 1,999,000 | 794 ms | 1,698 ms | n/a | n/a |
| 4000 | 7,998,000 | 3,323 ms | 7,003 ms | 1.27 ms | 1.59 ms |
| 4096 (the cap) | 8,386,560 | 3,487 ms | n/a | n/a | n/a |

The scan is about 1.7x the research prototype's figures (62, 122, 468 and 1,956 ms raw), because it calls the real `nameOf` for every demon (zone checks, mesh lookup, override map, join, capital) and then verifies exactly. `nameOf` alone is 115 ms of the 211 ms at 1024. Profiling showed `toNfc` as the top self-time item (the resolver already normalises its join), so names whose units are all below U+0300 skip a second normalisation (about 10 percent faster raw). For plan 07-11: the app's limit of 1024 stays comfortable as a sliced job (about 0.2 s raw, 0.45 s smoothed of total work); 4000 is a few seconds, so it remains certificate-only for generated tables. In the test run the 4000-zone exhaustive case takes about 5 s.

## Mutation Checks

Every mutant was one single-line change applied by a script, the whole test file run in the foreground under a 120 s timeout, the source restored from a saved copy and confirmed with `git diff --quiet` (identical each time). The three the plan names are first.

| # | Mutation | Result |
|---|----------|--------|
| M01 | `provablyUnique` compares `sorted[i + 2]` instead of `sorted[i + 1]` | Killed: 4 tests (duplicate, prefix pair, canCertify typed table, refusals) |
| M02 | drop the a/u/i-or-inert condition (`return true`) | Killed: 1 test (the `['ta', 'kt', 'tkt']` smoothing case) |
| M25 | scan trusts hash equality alone (real names kept, every equal-hash run reported as one group) | Killed: 27 tests (the 319,600-name one-partition false-positive test and every 666 and 1024 exhaustive case, which proves equal-hash false positives really occur in these tables) |
| M03 | scan groups names by the hash text | Killed: 38 |
| M04 | certified derived-demon search disabled | Killed: 5 |
| M05 | certified join order swapped | Killed: 5 |
| M06 | certified does not skip overridden demons | Killed: 2 |
| M07 | certified keeps stale (out-of-table) overrides | Killed: 1 |
| M08 | certified override text not NFC-normalised | Killed: 1 |
| M09 | accumulator trim does not sort | Killed: 1 (only the 5,587-group test) |
| M10 | accumulator cutoff inverted | Killed: 18 |
| M11 | scan reports singleton names as groups | Killed: 27 |
| M12 | scan caps the exact size at 16 | Killed: 4 |
| M13 | scan cap removed | **Survived at first** (the defensive 2^23 guard throws the same RangeError at base 4098); the test now also asserts the message `limited to 4096 zones`; Killed |
| M14 | fill never asks to yield | Killed: 1 test. The plan's "more than one step" would be satisfied by the phase boundaries alone, so before this run the test was strengthened to require at least 44,850 / 512 steps |
| M15 | placement into partitions skipped | Killed: 10 |
| M16 | partitions not sorted | Killed: 9 |
| M17 | NFC shortcut never normalises | Killed: 1 (the 200-run differential) |
| M18 | `canCertify` ignores the preset layer | Killed: 32 |
| M19 | certified drops the smoothing (a/u/i-stripped) candidate | Killed: 2 |
| M20 | certified does not lower the first letter | Killed: 5 |
| M21 | `demons` counted as 1 per group | Killed: 18 |
| M22 | certified drops the exact-name confirmation | **Survived at first** (no test had a text that strips to another demon's join without being its name); added `Dub`, `Dbuu` and `Dbi` against the smoothed `Dbu`; Killed |
| M23 | mesh recovered from the key is off by one | Killed: 13 |
| M24 | scan builds its resolver without the preset | Killed: 2 |
| M26 | accumulator cutoff taken one group too low | **Survived at first** (no test had a late group fall in a one-group gap below the cutoff); added an adversarial insertion order at base 200 (4,001 groups); Killed |

M01, M02, M13, M22, M25 and M26 were re-run against the final committed tests and are all killed; no survivor remains. One mutant was deliberately not written because it is equivalent by design: replacing `hash29` with a constant only slows the scan (the exact verification still decides), which is the point of "hash equality only nominates".

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.collisions.test.ts --project engine`: 65 passed (about 22 s). Under `CCRUG_TZ=America/New_York` with `engine/test/guard.test.ts`: 2 files, 104 passed.
- Whole engine project: 39 files, 1301 tests passed (no existing engine test regressed).
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0; the only lint output is the pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched.
- `node scripts/check-repo.mjs`: OK (all eleven checks including base-ten).
- Acceptance greps: `export function createCollisionJob` 1, `export const COLLISION_GROUPS_MAX = 2000` 1, `export const COLLISION_SCAN_MAX_N = 4096` 1, `COLLISION_SCAN_MAX_N + 2` in the test 1 (with RangeError expectations), `COLLISION_SCAN_MAX_N` in `engine/naming/index.ts` 1; `grep -nE "performance|Date|setTimeout|Worker" engine/naming/collisions.ts` prints nothing; the test contains `19900` and a 4000-zone case with `120_000`; `grep -n "app/\|lore" engine/naming/collisions.ts` prints nothing.
- Beyond the plan: `npm run build` and `npm run check:weight` (the new module is exported through the engine barrel but imported by no app file, so tree-shaking should leave it out): build succeeded, `page-weight: OK (2 routes, 30 golden states within tolerance)`, working tree clean afterwards.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty. No `app/` file, `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**`, `engine/naming/banks.ts`, `engine/test/naming.vectors.test.ts` or `reference/` file was touched.
- `npm run test:swap` and `npm run verify` were not run: the plan edits only `engine/` files (test:swap is required only when an existing app file changes, and nothing in `app/` imports the new exports yet).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoided] Final names must be compared after NFC, not as `nameOf` returns them**
- **Found during:** Task 1 design
- **Issue:** The plan says collisions are equal final names "after NFC", but `nameOf` returns an override exactly as stored (and a preset name as given); a Naming built outside the validator could hold a non-NFC text, so two visually identical names would not be reported.
- **Fix:** Every compared name goes through `nfcName` (NFC, with the all-below-U+0300 shortcut) in the scan, the verification and the certified path; the group's `name` is the NFC form. Tests include precomposed and decomposed overrides on both paths.
- **Files modified:** `engine/naming/collisions.ts`, `engine/test/naming.collisions.test.ts`
- **Committed in:** `9d765e1`

**2. [Rule 1 - Bug avoided] A stale override must not collide**
- **Found during:** Task 1 design
- **Issue:** An override whose mesh number is outside the table is never read by the resolver, so the scan cannot see it, but a certified path that grouped override texts blindly would report a collision the scan (and the UI) would not.
- **Fix:** The certified path skips overrides that are not whole mesh numbers below base(base-1)/2; a hand test and the 200-run property (override meshes up to count + 5) cover it, and mutant M07 is killed.
- **Files modified:** `engine/naming/collisions.ts`, `engine/test/naming.collisions.test.ts`
- **Committed in:** `9d765e1`

**3. [Rule 2 - Missing critical functionality] A table of the wrong length is refused**
- **Found during:** Task 1
- **Issue:** The plan lists RangeErrors for a seed-only naming and for the scan cap only; a dense table whose length is not the base would make `nameOf` read `undefined` sounds deep inside a long scan.
- **Fix:** `createCollisionJob` throws a RangeError (no echo of the table) when `sounds.length !== base`.
- **Files modified:** `engine/naming/collisions.ts`
- **Committed in:** `9d765e1`

**4. [Design refinement] In-place partitioning instead of a second Float64Array**
- **Found during:** Task 1
- **Issue:** The plan asks for a two-pass count and place so each partition is a contiguous subarray, and quotes a memory figure of one Float64Array and one Uint16Array per demon (about 84 MB at 4096). Placing into a second Float64Array would double the key memory.
- **Fix:** Count per partition during the first pass, then move entries to their ranges in place with cycle-leader swaps (the same result, resumable every 65,536 steps), and release both arrays when done. The cap, the packed key and the partition (first UTF-16 unit) are as planned.
- **Committed in:** `9d765e1`

**5. [Design refinement] The scan walks `(a, b)` instead of calling `netSpanOf` for every mesh**
- **Issue:** The plan's Phase A reads `[a, b] = netSpanOf(m)` for each mesh. An incremental `(a, b)` cursor visits the same demons in the same ascending mesh order without a square root and an array per demon; `netSpanOf` is used where a mesh number has to be turned back into zones (the verification of an equal-hash run).
- **Committed in:** `9d765e1`

**6. [Rule 2 - Coverage gaps found by mutation] Four tests added after the mutation runs**
- Found by reading the tests against the planned mutants before running them: the running trim and cutoff only trigger above 4,000 groups (base 150 with 5,587 groups added) and the yield cadence (M14). Found by surviving mutants: M13 (the cap versus the 2^23 guard), M22 (the exact-name confirmation) and M26 (a late group in a one-group gap below the cutoff). All committed in `9d765e1` with the implementation.

---

**Total deviations:** 3 hardening items (1 and 2 avoid wrong reports, 3 refuses a malformed table), 2 documented design refinements (4 and 5, no exported name or contract changes), 1 coverage round from the mutation runs.
**Impact on plan:** none of them changes an exported name, type or result the plan specified; no scope creep.

## Issues Encountered

None blocking. The plan's wording "a scan above COLLISION_SCAN_MAX_N + 2" is exercised at base 4098, where the 2^23 guard would also fire; the test therefore asserts the cap's own message so the two checks cannot mask each other (M13).

## Known Stubs

None. The module renders nothing and holds no placeholder data. The app side (the yield predicate with `performance.now()`, `NAMING_COLLISION_SCAN_MAX_N`, the report UI and the jump to each colliding demon) belongs to plans 07-11 and 07-20 to 07-23.

## Threat Flags

None. The plan adds only a pure engine module and its tests: no network endpoint, auth path, file or storage access, or schema at a trust boundary. The two register entries are mitigated as planned: T-07-06 (certificate first, resumable steps with an app-supplied yield predicate, bounded group and mesh lists, the mesh-number bound enforced by the 4096 cap and the 2^23 guard, a hostile all-equal table measured to produce one group and an exact count) and T-07-23 (hash equality only nominates, groups are confirmed by exact NFC string equality, and the brute-force, certificate-versus-scan and 319,600-name false-positive tests would fail on a wrong report).

## TDD Gate Compliance

RED `test(07-10)` `a6e6c70` (failed on the missing module) before GREEN `feat(07-10)` `9d765e1`. No refactor commit was needed.

## Next Phase Readiness

- Plan 07-11 (limits) can set `NAMING_COLLISION_SCAN_MAX_N = 1024` and assert it is at most `COLLISION_SCAN_MAX_N` (4096), imported through `engine/index.ts`; the measured cost above is the evidence for the 1024 choice.
- Plans 07-20 and later call `createCollisionJob(naming, preset)`, check `job.certified`, and drive `job.step(() => performance.now() > deadline)` from a `MessageChannel` or `setTimeout 0` loop; dropping the job cancels it (no resources to release). A seed-only naming or a scan above the cap throws, so the app decides first with `canCertify` and its own limit and shows "Not checked above {collisionCheckMax} zones." only when the certificate cannot decide.
- No blocker.

## Self-Check: PASSED

- Created files exist and are tracked: `engine/naming/collisions.ts`, `engine/test/naming.collisions.test.ts`; `engine/naming/index.ts` carries the barrel lines.
- Both task commits exist (`a6e6c70`, `9d765e1`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `app/` file, no `Projection.tsx`, nothing under `app/presets/base10/`, no bank and no signed-off vector file was touched.
