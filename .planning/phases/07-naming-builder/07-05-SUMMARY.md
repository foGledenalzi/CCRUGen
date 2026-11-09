---
phase: 07-naming-builder
plan: 05
subsystem: engine
tags: [naming, resolver, layering, mesh-number, immutable-edits, locks, barrel, fast-check, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-01 (prng, feistel, banks, generate with locks and the spare stream) and plan 07-02 (text rules, euphony@1)
  - phase: 02-engine-core-and-base-10-migration
    provides: engine/core meshOf, netSpanOf, checkIndex, assertBase, the pure-engine rules and lint/tsc purity gates
provides:
  - engine/naming/types.ts, the naming data contract (JoinOrder, JOIN_ORDERS, isJoinOrder, NamingSource, Smoothing, NamingMeta, Naming, NamingPreset, NameState, NameResolver, CreateNamingOptions)
  - engine/naming/derive.ts, deriveName, createNaming and createNameResolver (override > preset > rule, O(1), keyed by decimal mesh number, lazy above the ceiling)
  - engine/naming/edit.ts, ten immutable edit operations that share unchanged parts by reference and keep locked zones through regeneration
  - engine/naming/index.ts, the barrel for prng, feistel, banks, generate, text, euphony, types, derive and edit; engine/index.ts exports it (one added line)
  - engine/test/naming.derive.test.ts (35 tests), engine/test/naming.edit.test.ts (38 tests), one added guard test (purity rules under engine/naming/)
affects: [07-06, 07-08, 07-10, 07-11, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20, 07-21, 07-22]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Names are never stored per demon: a resolver reads (sounds, overrides, preset) at call time, so a Naming at 2^26 zones is the seed record only"
    - "Layering by first hit: user override, then the preset layer (only while source is ccru and the preset is for this base), then the rule; the preset is an argument, never engine data"
    - "Zones are checked against the naming's base BEFORE the mesh lookup, because meshOf only checks MAX_BASE and a stale override for a demon outside the table must never be read"
    - "Edit operations return Object.freeze({ ...n, changedField }): the spread shares every other part by reference, and tests assert sharing with toBe"
    - "Typed-text boundary: edit.ts re-validates every sound and name and throws RangeError with the reason code only (never the raw text)"
    - "Mutation runs apply a one-line change with a scratchpad script, run the file in the foreground with a timeout, restore from a saved copy and confirm git diff --quiet"

key-files:
  created:
    - engine/naming/types.ts
    - engine/naming/derive.ts
    - engine/naming/edit.ts
    - engine/naming/index.ts
    - engine/test/naming.derive.test.ts
    - engine/test/naming.edit.test.ts
  modified:
    - engine/index.ts
    - engine/test/guard.test.ts

key-decisions:
  - "CCRU canonical names are a read-time preset layer (user override > preset > derived), never copied into overrides; the engine tests use a synthetic preset and quote no canonical name (orchestrator decision 6, research A5)"
  - "Override key = decimal mesh number, ReadonlyMap<number, string> in memory and in JSON; no a:b form (orchestrator decision 7)"
  - "Editing a sound locks its zone; setSeed and setStyle switch the source to generated; setSource ccru loads the preset sounds and clears the locks; setSource generated regenerates the unlocked zones and keeps the locks"
  - "Saving an override equal to what the rule or preset gives removes the override; a text that differs only in case is stored (overrides are shown exactly as typed)"
  - "An override edit that changes nothing (resetOverride on an absent key, setOverride with the value already stored, or equal to the layer below for a demon with no override) returns its argument, so the session can skip a history entry with ===; every other edit returns a new frozen object"
  - "setSource ccru, resetOverride and every per-zone edit refuse a seed-only naming with a RangeError (the plan listed editSound, pasteSounds, toggleLock and setOverride; the other two follow the same rule because a seed-only naming has no table, locks or overrides)"
  - "rev (the history key) is NOT part of Naming: the app session owns it (plan 07-13)"

patterns-established:
  - "A plan header comment that the same plan's grep gate forbids is reworded rather than the gate relaxed (see Deviations 3)"

requirements-completed: []  # NAM-01 and NAM-02 stay Pending: this plan ships the data contract, the resolver and the edit operations; the editable panel, derived names in the browser and import/export that make them observable arrive in plans 07-13 to 07-23

# Metrics
duration: ~20min
completed: 2026-11-09
---

# Phase 7 Plan 05: Naming Contract, Layered Resolver and Immutable Edits Summary

**The Naming data contract, an O(1) resolver that layers user override over CCRU preset over the derived join rule by decimal mesh number (lazy and storage-free above the ceiling), ten immutable lock-preserving edit operations, and the engine/naming barrel exported from engine/index.ts, with 74 new tests and 14 mutants killed.**

## Performance

- **Duration:** about 20 min (including the mutation runs and a build plus page-weight check)
- **Completed:** 2026-11-09
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 6 (4 engine modules, 2 test files); 2 modified (`engine/index.ts` +1 line, `engine/test/guard.test.ts` +7 lines)
- **`$PLAN_BASE`:** `49ad0f9c28b70343d98ae7983a604a84ffeaefeb`

## Accomplishments

- **Contract (`types.ts`).** Exactly the interface in the plan: `Naming` carries base, source, normalised seed, style, join, smoothing, an optional dense `sounds`, `locks`, `overrides` (mesh number to text) and `meta`. `JOIN_ORDERS` is frozen and `isJoinOrder` guards unknown values.
- **Derivation (`derive.ts`).** `deriveName(hi, lo, join, smoothing)` joins in NFC, smooths (euphony) when asked, then capitalises the first letter only, so `('tn','mnm','hi-lo',0)` is `Tnmnm`, `('tn','mnm','lo-hi',0)` is `Mnmtn`, `('ktt','dt','hi-lo',1)` is `Ktatdit` and `('TN','mnm','hi-lo',0)` is `TNmnm`. `createNaming` builds the seed's table (or copies the preset's sounds for ccru), and decides seed-only by the base alone: `sounds` is null when `base > interactiveMaxN`.
- **Resolver.** `createNameResolver(naming, preset)` returns a frozen `{ base, soundOf, nameOf, ruleNameOf, presetNameOf, stateOf }`. No cache and no per-demon array: a name is two sound reads, one `Map.get` and one join. At base 2^26 a name is lazy, derived from `createGenerator(seed, style).soundAt` (best of three fresh resolvers under 50 ms, the plan's bound).
- **Parity.** `nameOf` equals `deriveName` over `generateSounds` for every demon at base 28 (both join orders and both smoothings, both argument orders) and at base 666 (all 221,445 demons, both join orders). Overriding mesh 69 (`meshOf(12, 3)`) changes exactly one of the 378 names at base 28.
- **Edits (`edit.ts`).** `editSound`, `pasteSounds`, `toggleLock`, `setSeed`, `setStyle`, `setJoin`, `setSmoothing`, `setSource`, `setOverride`, `resetOverride`. Sharing is asserted with `toBe`: a sound edit keeps the same overrides Map, `setJoin` and `setSmoothing` keep sounds, locks and overrides, `toggleLock` keeps sounds and overrides, `setOverride` keeps sounds and locks. A fast-check property (seed 20261020, 200 runs, bases 28 and 666, up to 40 locks, half the typed sounds chosen to equal another zone's generated sound under the new seed so the spare stream is exercised) proves locked sounds survive `setSeed` and `setStyle`, the lock set is unchanged, the table stays pairwise distinct, and the table equals `generateSounds` with the locked map.
- **Barrel.** `engine/naming/index.ts` exports values and types in separate statements (the `engine/layout/index.ts` style); `engine/index.ts` gains exactly one line (`export * from './naming/index'`, numstat 1 addition and 0 deletions against `$PLAN_BASE`). tsc reported no duplicate export name, so nothing was renamed.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: types, deriveName, createNaming and the O(1) layered resolver**
   - RED: `49721b9` (test) failing tests for derivation, the resolver, layering, mesh keys and range checks
   - GREEN: `c2aa537` (feat) `types.ts` and `derive.ts`
2. **Task 2: immutable edit operations, the naming barrel and the engine export**
   - RED: `bafa253` (test) failing edit tests plus the `engine/naming/` guard test
   - GREEN: `ee1761c` (feat) `edit.ts`, `index.ts`, the `engine/index.ts` line, and one added test that closed a mutation survivor

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `engine/naming/types.ts` - the contract (83 lines)
- `engine/naming/derive.ts` - deriveName, createNaming, createNameResolver (144 lines)
- `engine/naming/edit.ts` - the ten edit operations and four private helpers: requireDense, soundText and nameText, lockedMap, regenerate (181 lines)
- `engine/naming/index.ts` - the barrel (56 lines)
- `engine/index.ts` - one added export line
- `engine/test/naming.derive.test.ts` - 35 tests; `engine/test/naming.edit.test.ts` - 38 tests; `engine/test/guard.test.ts` - 1 added test

## Decisions Made

See `key-decisions` above. The five `[default]` decisions the plan named (preset as a read-time layer, mesh-number key, edit semantics for locks and sources, equal-to-rule override removal, `rev` outside Naming) are implemented as written and recorded for review at the final checkpoint. Two refinements are mine and are listed in the same block: no-op override edits return their argument, and the seed-only refusals extend to `setSource('ccru')` and `resetOverride`.

## Mutation Checks

Every mutation was applied with a script, the file was run in the foreground under a 120 s timeout, then restored from a saved copy and confirmed with `git diff --quiet` (identical each time). The first four are the ones the plan lists; the rest are extras.

| File | Mutation | Result |
|------|----------|--------|
| derive.ts | swap the join order in deriveName | Killed: 8 tests (all `Tnmnm`, `Mnmtn`, `Tnamnam`, `Ktatdit`, `TNmnm` and `MNMtn` vectors, the NFC and smoothing cases) |
| derive.ts | remove upperFirst | Killed: 7 tests (the vectors, the non-Latin case, the lazy base-2^26 capital check) |
| derive.ts | key the override by `max(a,b) * min(a,b)` instead of the mesh number | Killed: 5 tests (the mesh-69 case, the cross-base key case, three layering cases) |
| derive.ts | check the preset before the override | Killed: 2 tests (user override beats preset; ruleNameOf and override case) |
| edit.ts | regenerate without the locked map (`generateSounds(gen, base)`) | Killed: 5 tests (setSeed, setStyle, setSource generated, and both fast-check properties at base 28 and 666) |
| edit.ts | copy the overrides Map inside editSound | Killed: the reference-sharing assertion |
| edit.ts | setOverride never removes an override equal to the rule | Killed: 3 tests |
| edit.ts | setSource ccru keeps the locks | Killed: 1 test |
| edit.ts | toggleLock mutates the shared Set | Killed: 1 test |
| edit.ts | editSound does not lock the zone | Killed: 6 tests |
| edit.ts | pasteSounds does not lock the zones | Killed: 1 test |
| edit.ts | setOverride ignores the preset layer | Killed: 1 test |
| edit.ts | setSeed keeps the old source | **Survived at first** (every setSeed test started from a generated naming); added a test that starts from a ccru naming, then Killed |
| edit.ts | setStyle keeps the old source | **Survived at first** for the same reason; Killed by the same new test |

No survivors remain.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.derive.test.ts --project engine`: 35 passed.
- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.edit.test.ts engine/test/guard.test.ts --project engine`: passed (38 edit tests plus the guard file, which now includes the `engine/naming/` purity test).
- `npx cross-env CCRUG_TZ=UTC vitest run --project engine`: 36 files, 1049 tests passed (no existing engine test regressed); the same run under `CCRUG_TZ=America/New_York`: 36 files, 1049 passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched here.
- `npx tsc -p engine/tsconfig.json --noEmit` and `npx tsc -p engine/tsconfig.test.json --noEmit`: exit 0 (re-run after the last test edit); `npx next lint --dir engine`: no warnings or errors.
- `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten).
- Acceptance greps: `grep -c "export interface Naming " engine/naming/types.ts` = 1; `grep -c "export function createNameResolver" engine/naming/derive.ts` = 1; `grep -n "app/\|lore" engine/naming/derive.ts engine/naming/types.ts` prints nothing; `grep -c "export \* from './naming/index'" engine/index.ts` = 1; `git diff --numstat "$PLAN_BASE" -- engine/index.ts` = `1 0 engine/index.ts`; `grep -c "engine/naming/__guard__.ts" engine/test/guard.test.ts` = 1; `grep -nE "Math\.random|Date\.now|new Date\(" engine/naming/*.ts` prints nothing.
- Beyond the plan: `npm run build` and `npm run check:weight` (`engine/index.ts` is imported by the app, so a barrel that defeated tree-shaking would have shown up here): build succeeded, `page-weight: OK (2 routes, 30 golden states within tolerance)`; `/numogram` stays 119 kB and 207 kB first load.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty. No `app/` file, no `Projection.tsx`, no `app/presets/base10/**` and no `reference/` file was touched; `git status --short` is clean after the build.
- `npm run test:swap` and `npm run verify` were not run: this plan adds only engine modules and tests plus one barrel line, and nothing in `app/` imports the new exports yet; the build and page-weight check above cover the one surface the barrel line can affect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Runtime validation of every field `createNaming` stores**
- **Found during:** Task 1
- **Issue:** The plan validates only the seed and the preset base. Style, join, smoothing and source reach `createNaming` from URLs and imported files as unchecked values, and for a seed-only naming nothing would build a generator, so an unknown style would stay hidden until the first name was read. A preset whose `sounds` length is not the base would also have produced a table of the wrong length.
- **Fix:** `createNaming` throws a `RangeError` for an unknown style, join, smoothing or source, a non-numeric ceiling, and a preset with the wrong number of sounds; tests cover each, including a seed-only base.
- **Files modified:** `engine/naming/derive.ts`, `engine/test/naming.derive.test.ts`
- **Committed in:** `c2aa537`

**2. [Rule 1 - Bug] The mesh lookup must follow the zone check against the naming's base**
- **Found during:** Task 1
- **Issue:** `meshOf` checks zones against `MAX_BASE`, not against the naming's base, so `nameOf(30, 2)` at base 28 would have passed `meshOf` and read a stale override (or a preset name) for a demon that is not in the table.
- **Fix:** A private `meshOfPair` checks both zones with `checkIndex('zone', z, base)` and then calls `meshOf`; every resolver method goes through it. A test stores an override under `meshOf(30, 2)` at base 28 and expects `nameOf(30, 2)` to throw.
- **Files modified:** `engine/naming/derive.ts`, `engine/test/naming.derive.test.ts`
- **Committed in:** `c2aa537`

**3. [Plan inconsistency] The specified header comment contains the strings the grep gate forbids**
- **Found during:** Task 1
- **Issue:** The action asks for a header comment naming `app/presets/base10/naming.ts` and `lore.ts`, while the acceptance criteria require `grep -n "app/\|lore" engine/naming/derive.ts engine/naming/types.ts` to print nothing.
- **Fix:** The header says the same thing without those strings ("the base-10 preset layer of the application reads the canonical table by reference (Phase 2 D-06)"). The gate is unchanged.
- **Files modified:** `engine/naming/derive.ts`
- **Committed in:** `c2aa537`

**4. [Rule 2 - Missing critical functionality] Input type checks in the edit operations**
- **Found during:** Task 2
- **Issue:** `validateSound`, `validateName` and `normalizeSeed` accept strings; a caller passing a non-string (a JSON value, for example) would reach `String.prototype.normalize` and throw a `TypeError` instead of the documented `RangeError`.
- **Fix:** `soundText`, `nameText` and `setSeed` check `typeof` first and throw a `RangeError` with no echo of the value. Tests pass a number for each.
- **Files modified:** `engine/naming/edit.ts`, `engine/test/naming.edit.test.ts`
- **Committed in:** `ee1761c`

**5. [Rule 2 - Coverage gap found by mutation] setSeed and setStyle from a ccru naming**
- **Found during:** Task 2 mutation runs
- **Issue:** Two extra mutants (setSeed and setStyle forgetting to switch the source to generated) survived because every test started from a generated naming.
- **Fix:** One test starts from a ccru naming at base 10, calls both, and checks that the source is `generated`, the preset sounds are gone and the preset layer no longer applies. Both mutants are then killed.
- **Files modified:** `engine/test/naming.edit.test.ts`
- **Committed in:** `ee1761c`

**6. [Presentation / decision] No-op override edits return their argument; two operations refuse seed-only namings**
- Recorded under key-decisions: the plan says each edit "returns a frozen new object" and lists the seed-only refusals for four operations. For `setOverride` and `resetOverride` the only cases where a new object would be byte-for-byte equal to the old one return the argument instead, and `setSource('ccru')` and `resetOverride` refuse a seed-only naming too (they would otherwise create a table or an override where none can exist). No exported name, vector or result the plan specified changes.

---

**Total deviations:** 2 auto-added hardening items, 1 bug avoided before it shipped, 1 plan inconsistency resolved in the comment, 1 test gap closed from the mutation runs, 1 documented design refinement.
**Impact on plan:** none of them changes an exported name or contract; no scope creep.

## Issues Encountered

None blocking. The `performance.now()` bound in the lazy base-2^26 test (under 50 ms) uses the best of three fresh resolvers rather than a single first call, so a slow cold start on a loaded machine does not make it flaky; the measured time is a few milliseconds.

## Known Stubs

None. The plan creates no UI and renders nothing; the syllable banks the generator uses stay the Appendix A DRAFTS until the user's contact-sheet sign-off at plan 07-06, and this plan pins no sound-table digest and no exact generated sound string (every expectation is built from the generator or from definitions). The harsh bank's generic cluster leaves overlap eight CCRU zone sounds (checkpoint question 5 at 07-06); no bank was changed here.

## Threat Flags

None. The plan adds only pure engine modules and tests: no network endpoint, no auth path, no file or storage access, no schema at a trust boundary. The four register entries are mitigated as planned: T-07-03b (every typed sound and name is re-validated in `edit.ts` and refused with a `RangeError` carrying the reason code only), T-07-12 (the preset is an argument; the engine tests use a synthetic preset; the `app/\|lore` grep prints nothing), T-07-02b (no per-demon storage; seed-only resolution is lazy and O(1); `checkIndex` on every zone and mesh number) and T-07-20 (unchanged parts shared by reference, asserted with `toBe`).

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-05)` `49721b9` before `feat(07-05)` `c2aa537`, and `test(07-05)` `bafa253` before `feat(07-05)` `ee1761c`. Each RED run failed on the missing module (confirmed before its GREEN commit). No refactor commit was needed.

## Next Phase Readiness

- Plan 07-06 can render the contact sheet from `SYLLABLE_BANKS` and `createGenerator` through `engine/index.ts`; the banks are unchanged.
- Plans 07-08 (schema and validator), 07-10 (collisions), 07-11 (preset adapter: `NamingPreset` is `{ id: 'ccru', base: 10, sounds, names }` keyed by mesh number) and 07-13 (session, which owns `rev`) build on the types and operations here. A session can skip a history entry when an override edit returns its argument (`next === prev`).
- No blocker.

## Self-Check: PASSED

- All six created files exist and are tracked (`git ls-files`): `engine/naming/{types,derive,edit,index}.ts`, `engine/test/naming.derive.test.ts`, `engine/test/naming.edit.test.ts`; `engine/index.ts` and `engine/test/guard.test.ts` carry the two edits.
- All four task commits exist (`49721b9`, `c2aa537`, `bafa253`, `ee1761c`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `app/` file, no `Projection.tsx` and nothing under `app/presets/base10/` was touched.
