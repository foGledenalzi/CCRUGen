---
phase: 07-naming-builder
plan: 01
subsystem: engine
tags: [prng, sfc32, cyrb128, feistel, cycle-walking, prefix-code, syllable-banks, fast-check, bigint-oracle, typescript, vitest]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: engine/core/index-check.ts (checkIndex) and engine/core/base.ts (assertBase, MAX_BASE), the pure-engine rules and lint/tsc purity gates
provides:
  - engine/naming/prng.ts, the frozen PRNG sfc32-cyrb128@1 (PRNG_ALGO, cyrb128, sfc32), integer-only
  - engine/naming/feistel.ts, the 8-round Feistel permutation with cycle-walking and its key schedule (FEISTEL_ROUNDS, FEISTEL_KEY_DISCARD, feistelRoundKeys, feistelPermutation)
  - engine/naming/banks.ts, STYLE_IDS / StyleId / DEFAULT_STYLE / isStyleId / SyllableBank and the three DRAFT (unsigned) syllable banks
  - engine/naming/generate.ts, names-gen@1 (GENERATOR_ID, DEFAULT_SEED 'ccrug', GENERATOR_MAX_DEPTH 5, SoundGenerator, createGenerator, generateSounds with locks and the spare stream)
  - engine/test/naming.prng.test.ts (18 tests), naming.feistel.test.ts (47 tests), naming.generate.test.ts (51 tests)
affects: [07-02, 07-05, 07-06, 07-08, 07-10, 07-13, 07-22]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen algorithm ids defined by code plus vectors: PRNG_ALGO and GENERATOR_ID name behaviour that the Appendix B tables pin; a change is a new id, never an edit"
    - "Independent BigInt oracles inside the tests (cyrb128Big, sfc32Big, mixBig, feistelBig, keysBig) that share no code with the module, plus an independent greedy parser over the bank union that recovers (depth, permuted index) from a sound"
    - "Distinct by construction: prefix-free internal/leaf syllable banks, one Feistel permutation per depth class, mixed-radix decode, so no retry loop over a table exists anywhere"
    - "Lazy per-depth permutation memo (never all depths eagerly) and a frozen generator object"

key-files:
  created:
    - engine/naming/prng.ts
    - engine/naming/feistel.ts
    - engine/naming/banks.ts
    - engine/naming/generate.ts
    - engine/test/naming.prng.test.ts
    - engine/test/naming.feistel.test.ts
    - engine/test/naming.generate.test.ts
  modified: []

key-decisions:
  - "DEFAULT_SEED = 'ccrug' (the app identity), exported from the engine so no component types it; recorded for review at the final checkpoint"
  - "Generator construction is the prefix-code tree with a Feistel permutation per depth class (research Open Question 2 RESOLVED); the roadmap's seeded Fisher-Yates fallback is not built"
  - "names=seed: and every stored seed record mean names-gen@1 forever (orchestrator decision 8); a future generator gets a new id"
  - "generateSounds reserves only locks whose zone is a whole number in [0, base): a lock outside the table neither enters the table nor blocks another zone's sound. This keeps the spare index below 2 * base < limit (the T-07-02 bound) for any Map a caller passes"
  - "createGenerator validates the style at runtime (RangeError) because styles reach it from URLs and files as unchecked strings"
  - "No sound-table digest and no exact generated sound string is pinned; the banks are Appendix A drafts until the user's contact-sheet sign-off at plan 07-06"

patterns-established:
  - "Pure naming modules use relative imports to ../core only, build every control character as data (String.fromCharCode(0)) and describe purity in comments without the forbidden identifiers, so the acceptance grep for platform randomness and clock calls prints nothing"
  - "Mutation runs apply a one-line change with a script, run the suite, and restore the file from a saved copy, then diff the restored file against the copy"

requirements-completed: []  # NAM-01 stays Pending: this plan ships only the deterministic engine core; the editable zone table, locks UI, autosave and import/export that make NAM-01 observable arrive in plans 07-13 to 07-23

# Metrics
duration: 17min
completed: 2026-11-07
---

# Phase 7 Plan 01: Pure Generator Core Summary

**The frozen PRNG sfc32-cyrb128@1, an 8-round cycle-walking Feistel permutation, three draft syllable banks and the names-gen@1 prefix-code generator: sounds are distinct by construction for any base, O(1) and lazy up to 2^26 - 1, and locked zones survive regeneration through a spare stream, with 116 tests and BigInt oracles.**

## Performance

- **Duration:** about 17 min (including the mutation runs)
- **Started:** 2026-11-07T22:42:20Z
- **Completed:** 2026-11-07T22:59Z
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 7 (4 engine modules, 3 test files); no file modified
- **`$PLAN_BASE`:** `bb5bc317455d1809a897bef9647db66900fde51e`

## Accomplishments

- `sfc32-cyrb128@1` reproduces all 12 Appendix B seeds (state words and the first 8 outputs, including NFC, NFD, a surrogate pair and a 1000-character string) and equals an independent BigInt implementation on 2,000 fixed-seed strings and 64 outputs each. It is integer-only (`Math.imul`, `^`, `>>>`, `| 0`, `<<`).
- The Feistel permutation reproduces the Appendix B key-schedule vectors (4 schedules) and permutation vectors (5 sizes up to 2,278,125,000, with both literal and scheduled keys), is exhaustively bijective on 12 domains up to 2^20, and equals an independent BigInt Feistel on 2,000 inputs for each of 6 sizes (up to 2,744,320,000) and on samples of the 2^52 domain.
- `createGenerator(seed, style).soundAt(z)` is exhaustively distinct for the first 300,000 zones of each style at two seeds (1.8 M lookups), recovered correctly by an independent greedy parser for 2,000 fixed-seed zones in [0, 2^26) per style including z = 2^26 - 1, base-independent (prefix stability at bases 10, 28, 64, 666 and 4000) and lazy. `limit` is 2,779,058,227 (harsh), 869,857,626 (soft) and 1,329,394,638 (syllabic), all above `2 * MAX_BASE`; the longest sound at depth 5 is 15 / 11 / 11 letters, inside the 16-letter cap.
- `generateSounds` keeps every locked zone and, when the locked sounds are distinct, returns a fully distinct table (fast-check, bases 28 and 666, up to 40 locks, 500 runs each) with no retry loop over the table: a colliding unlocked zone takes the next unused `soundAt(base + j)`.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: sfc32-cyrb128@1 and the Feistel permutation**
   - RED: `e785d18` (test) failing tests, vectors and BigInt oracles
   - GREEN: `d36039e` (feat) `prng.ts` and `feistel.ts`
2. **Task 2: draft banks and the names-gen@1 generator**
   - RED: `e2f87bd` (test) failing tests
   - GREEN: `9a541ed` (feat) `banks.ts` and `generate.ts`

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `engine/naming/prng.ts` - PRNG_ALGO, cyrb128, sfc32 (copied from the measured research code)
- `engine/naming/feistel.ts` - FEISTEL_ROUNDS = 8, FEISTEL_KEY_DISCARD = 12, murmur-style `mix`, feistelRoundKeys (frozen array), feistelPermutation (size validated once, hot path unvalidated)
- `engine/naming/banks.ts` - STYLE_IDS, StyleId, DEFAULT_STYLE ('harsh'), isStyleId, SyllableBank, frozen SYLLABLE_BANKS (harsh 80/67, soft 60/66, syllabic 64/78)
- `engine/naming/generate.ts` - names-gen@1: depth classes `I^(d-1) * L`, lazy per-depth permutation memo, mixed-radix decode, frozen generator, generateSounds with locks and spare stream
- `engine/test/naming.prng.test.ts`, `naming.feistel.test.ts`, `naming.generate.test.ts` - 116 tests

## Decisions Made

See `key-decisions` above. The two default decisions stated in the plan (DEFAULT_SEED, prefix-code construction instead of Fisher-Yates) and the names-gen@1 meaning of stored seeds are recorded there for review at the final checkpoint.

## Mutation Checks

Every mutation was applied with a script, the suite was run, and the file was restored from a saved copy and diffed against it (identical each time).

| File | Mutation | Result |
|------|----------|--------|
| feistel.ts | `FEISTEL_ROUNDS` 8 -> 7 | Killed: key-schedule vectors, scheduled-key permutation vectors, BigInt Feistel and key-count test fail |
| feistel.ts | `FEISTEL_KEY_DISCARD` 12 -> 11 | Killed: same set of tests fail |
| feistel.ts | separator `String.fromCharCode(0)` -> `(1)` | Killed: all four key-schedule vectors, the BigInt key schedule and every scheduled-key permutation test fail |
| generate.ts | swap leaf and internal roles in the decode | Killed: exhaustive distinctness (3 styles), independent parser (3 styles) and boundary-depth tests fail |
| generate.ts | remove the spare loop (`out[z] = gen.soundAt(z)`) | Killed: spare-zone test, spare-skipping test and both locks properties (base 28 and 666) fail |
| generate.ts | depth boundary `z >= offsets[depth]` -> `z >` (extra) | Killed by non-termination: an out-of-domain input never re-enters the cycle walk, so the run hung and was stopped by a 45 s timeout (exit 124). It is not a clean assertion failure |
| generate.ts | drop `normalize('NFC')` (extra) | Killed: the NFC + trim test fails for all 3 styles |
| generate.ts | drop `.trim()` (extra) | Killed: same test fails |
| generate.ts | per-depth key always depth 1 (extra) | Killed: independent parser fails for all 3 styles |
| generate.ts | per-style key always 'harsh' (extra) | Killed: independent parser fails for soft and syllabic |
| generate.ts | count out-of-range locks as reserved (extra) | Killed: the "ignores a lock outside the table" test fails |

No survivors.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.prng.test.ts engine/test/naming.feistel.test.ts engine/test/naming.generate.test.ts --project engine`: 3 files, 116 tests passed (18 + 47 + 51).
- `vitest run --project engine` (whole engine project, includes `guard.test.ts`): 32 files, 848 tests passed.
- `npx tsc -p engine/tsconfig.json --noEmit` and `npx tsc -p engine/tsconfig.test.json --noEmit`: exit 0.
- `npm run lint`: exit 0 (one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched here).
- `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten).
- Acceptance greps: all `export const` anchors present once; `Math.random|Date.now|new Date(|Math.(sin|cos|pow)` prints nothing in `engine/naming/*.ts`; `sha256|createHash|SIGNED_OFF` prints nothing in the generate test; the four Appendix B anchor strings are present in the test files.
- The six bank strings in `banks.ts` were compared against the plan's literal lists by script: byte-identical.
- No Unicode category Cf or non-ASCII characters in any new file.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty (no frozen oracle touched).
- `npm run test:swap` and `npm run verify` were not run: this plan adds only new engine and test files, no `app/` file, no build input and no frozen oracle changed. The whole-engine and repo-guard checks above cover the surfaces it can affect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prefix-stability test index at base 10**
- **Found during:** Task 2 (first GREEN run)
- **Issue:** The plan's behaviour reads "z < 12 at b = 10 ...", but a base-10 table has only ten zones, so `table[10]` and `table[11]` are undefined and the assertion failed.
- **Fix:** The test checks `z < Math.min(12, base)`. The property it tests (the table equals the lazy sounds for every zone it has, at bases 10, 28, 64, 666 and 4000) is unchanged.
- **Files modified:** `engine/test/naming.generate.test.ts`
- **Committed in:** `9a541ed`

**2. [Rule 2 - Missing critical functionality] Runtime style validation in createGenerator**
- **Found during:** Task 2
- **Issue:** The plan types `style` as `StyleId`, but styles reach the generator from URLs and imported files as unchecked strings; an unknown style would crash on `bank.leaf` with an unhelpful TypeError.
- **Fix:** `createGenerator` throws a `RangeError` naming the clipped bad value; a test covers it.
- **Files modified:** `engine/naming/generate.ts`, `engine/test/naming.generate.test.ts`
- **Committed in:** `9a541ed`

**3. [Rule 2 - Missing critical functionality] Only in-range locks reserve a sound**
- **Found during:** Task 2
- **Issue:** The plan builds the reserved set from `locked.values()`. A Map with keys outside [0, base) (or with non-integer keys) would reserve sounds for zones that do not exist, and a Map with more than `base` entries could push the spare index past `limit`, breaking the T-07-02 bound (a spare index never reaches `limit`).
- **Fix:** Only entries whose key is a whole number in [0, base) reserve a sound, so at most `base` spares are consumed and every spare index stays below `2 * base < limit`. A test covers out-of-range, negative and fractional keys.
- **Files modified:** `engine/naming/generate.ts`, `engine/test/naming.generate.test.ts`
- **Committed in:** `9a541ed`

**4. [Presentation] Bank lists written through a `syllables()` helper**
- The plan says "literal arrays"; `banks.ts` builds each frozen list from one space-separated string through a private helper, which keeps the 80-entry lists readable. The content is byte-identical to the plan's lists (verified by script) and the tests pin the sizes and prefix-freedom.

---

**Total deviations:** 3 auto-fixed (1 bug in a test index, 2 missing-critical hardening items) and 1 presentation choice.
**Impact on plan:** None of them changes an exported name, a vector or a result the plan specified; no scope creep.

## Issues Encountered

- **Mutation run hung and raced.** The extra "depth boundary" mutation sends the cycle walk into an infinite loop. The shell tool moved the mutation loop to the background after its 120 s limit; I stopped the stuck vitest process tree (my own processes, identified by command line), restored `generate.ts` from the saved copy, and the background loop meanwhile carried on and restored the file itself afterwards. The "drop NFC" result from that loop raced with my manual restore and showed a false survivor, so I discarded it and re-ran the mutation alone: killed. The boundary mutation was then re-run under a 45 s timeout (killed by non-termination). The final `generate.ts` was diffed against the saved pre-mutation copy (identical) and the full suite re-ran green before the Task 2 commit.
- The hot path of `feistelPermutation` does not re-validate `x`, as the plan specifies, so a caller bug that passes an out-of-domain index spins forever instead of throwing. `soundAt` validates through `checkIndex` and derives the in-class offset itself, so no public path can reach that; later plans must keep calling the permutation only through the generator.

## Known Stubs

None. The three syllable banks are the Appendix A DRAFTS: they are complete data, but unsigned. Plan 07-06 produces the contact sheet and asks the user to sign them off before any sound-table digest is pinned. The harsh bank overlaps eight verbatim CCRU zone sounds (a licensing question put to the user at 07-06); the banks were not changed here.

## Threat Flags

None. The plan adds only pure engine modules and tests: no network endpoint, no auth path, no file or storage access and no schema at a trust boundary. The two register entries are mitigated as planned: T-07-01 (integer-only arithmetic, NFC + trim inside `createGenerator`, Appendix B vectors, BigInt oracles, no platform randomness or clock in `engine/naming`) and T-07-02 (`checkIndex` against `limit`, `assertBase`, lazy per-depth permutations, O(1) per zone, no retry over the table, spare loop bounded by the number of in-range locks).

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-01)` `e785d18` before `feat(07-01)` `d36039e`, and `test(07-01)` `e2f87bd` before `feat(07-01)` `9a541ed`. The RED runs failed on the missing modules (confirmed before each GREEN commit). No refactor commit was needed.

## Next Phase Readiness

- Plan 07-02 (text rules and `euphony@1`) and 07-05 (naming contract and resolver) can import `createGenerator`, `generateSounds`, `DEFAULT_SEED`, `GENERATOR_ID` and the `StyleId` helpers. `engine/index.ts` is deliberately not extended here; the barrel arrives with 07-05.
- Plan 07-06 needs the draft banks unchanged, to render the contact sheet for the user's sign-off; the sound-table digests are pinned only after that.
- No blocker.

## Self-Check: PASSED

- All seven created files exist and are tracked (`git ls-files`): `engine/naming/{prng,feistel,banks,generate}.ts` and the three `engine/test/naming.*.test.ts` files.
- All four task commits exist (`e785d18`, `d36039e`, `e2f87bd`, `9a541ed`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file and no `app/` file was touched.
