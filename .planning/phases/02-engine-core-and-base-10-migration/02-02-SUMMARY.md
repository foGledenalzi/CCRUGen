---
phase: 02-engine-core-and-base-10-migration
plan: 02
subsystem: testing
tags: [oracle, brute-force-reference, frozen-fixture, sha256-manifest, vitest, tsx, numogram-math]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net
    provides: golden-manifest freeze/verify tooling (strictDir manifests, verifyManifestFile), the Vitest oracle project (tests/**/*.test.ts), the refuse-to-overwrite capture-script pattern
provides:
  - tests/bruteforce/numogramReference.ts, an engine-independent, definitions-only reference (zones, syzygies, currents, gates, cycles, region kinds, every demon, subtype counts) that plans 02-04, 02-05 and 02-06 sweep the engine against
  - a hand-literal self-test of that reference (bases 2..100, 666, a 5000-base warp/coverage sweep)
  - engine/test/fixtures/derived/notable-bases.golden.json, a frozen definition-derived fixture (17 full bases, 4 compact digests) under its own new strict manifest
  - scripts/capture-notable-bases.ts, a one-shot capture that refuses to overwrite
affects: [02-04, 02-05, 02-06, 02-07, phase-05-demon-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent oracle by construction: the reference imports nothing from engine/, does no file access, and never uses the engine's closed forms (cumulation by running sum, digital root by iterated in-base digit sums, mesh by enumeration counter, cycles by a functional-graph walk that does not assume a permutation); enforced by acceptance greps"
    - "Derived fixtures live in their own directory under their own strict manifest (engine/test/fixtures/derived/MANIFEST.json), so the frozen Phase 1 sets are never appended to or touched"
    - "One shared classification rule (subtypeIndex) drives both the object-per-demon path (refClassify/refDemons) and the O(n^2) integer-table counting path (refSubtypeCounts), and a test ties the two together for every even base 2..200"
    - "Heavy sweeps collect problems into an array and assert once (millions of expect() calls would be slow); rows holding arrays use plain for loops, not it.each"

key-files:
  created:
    - tests/bruteforce/numogramReference.ts
    - tests/bruteforce/numogramReference.test.ts
    - tests/bruteforce/notable-bases.fixture.test.ts
    - scripts/capture-notable-bases.ts
    - engine/test/fixtures/derived/notable-bases.golden.json
    - engine/test/fixtures/derived/MANIFEST.json
  modified: []

key-decisions:
  - "Reference lives in tests/bruteforce/, never tests/reference/ (the unanchored reference/ line in .gitignore would silently ignore it); .gitignore untouched, no git add -f"
  - "The derived fixture has its own manifest (strictDir engine/test/fixtures/derived, set 2026-09-26-notable-bases); the existing engine/test/fixtures/MANIFEST.json and e2e/__golden__ are byte-identical to f7d6689"
  - "Registering the new manifest in scripts/check-repo.mjs is deferred to plan 02-07; until then tests/bruteforce/notable-bases.fixture.test.ts verifies it"

patterns-established:
  - "Reference API for later sweeps: refStructure(base) then refClassify / refDemons / refSubtypeCounts(structure); all indices are plain numbers, cycles are { kind, pairs } in canonical order, pair id === low zone"

requirements-completed: [ENG-01, ENG-02, ENG-03, ENG-04]

# Metrics
duration: 11min
completed: 2026-09-26
---

# Phase 2 Plan 02: Independent Reference and Frozen Notable-Bases Fixture Summary

**A definitions-only brute-force numogram reference in tests/bruteforce (independent of engine/ by construction and by grep) proven against the research's hand literals, then used once to capture a sha256-frozen notable-bases fixture (17 full bases 2..100 plus digests for 256, 666, 1000, 1024) under a new strict manifest.**

## Performance

- **Duration:** about 11 min (started about 2026-09-26T19:13Z, finished about 19:25Z)
- **Tasks:** 2 (2 task commits, plus this metadata commit)
- **Files created:** 6, exactly the plan's `files_modified` list; nothing existing was modified

## Accomplishments

- `tests/bruteforce/numogramReference.ts` derives everything from the definitions: syzygy partner sum n-1, current hi::lo flowing to hi-lo, cumulation as a running sum, gates as the iterated in-base digit sum (0 stays 0), cycles from a functional-graph walk that does not assume a permutation, Plex = the cycle holding zone 0, Warp = any other single-pair cycle (a second one is an Error), Torque = the rest, canonical order (length descending, smallest pair ascending, rotated to the smallest pair, flow order), demons enumerated a = 1..n-1, b = 0..a-1 with the mesh number as a counter. It compiles under the root tsconfig and under the engine test config (`strict` + `noUncheckedIndexedAccess`, lib ES2022).
- The self-test (151 tests) reproduces every research literal: base-12 gates 0,1,3,6,a,4,a,6,3,1,b,b; Torque lengths for 2..100 and 666 (including `[36, 36, 36, 36, 36, 36, 36, 18, 18, 18, 12, 9, 3, 2]`); Warp exactly at 4, 10, 16, 22, 28, 64, 82, 100; subtype counts for 2, 4, 10, 12, 16, 28, 82 (`[156, 108, 12, 48, 48, 4, 2]` at 28, `[12, 0, 3, 12, 12, 4, 2]` at 10); demon counts; mesh 1::0=0, 2::1=2, 6::3=18, 9::8=44; Numodemons 0/1/4/5/13/40. A sweep over every even n in 2..5000 checks that the cycles cover each pair exactly once in canonical order and that Warp presence equals `((n - 1) % 3 === 0 && ((n - 1) / 3) % 2 === 1)`. `refDigits` agrees with `Number.prototype.toString` for bases 2..36 (200 fixed-seed values each, seed 20260930).
- The fixture `engine/test/fixtures/derived/notable-bases.golden.json` (26181 bytes, LF, sha256 `69500b9f93aca2ba3a4cfe9d75ae44270513da2672effd5742608192b278f7ea`) holds, for bases 2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 28, 32, 36, 64, 80, 82, 100: base, pairCount, warp, cycles (kind + pairs), torqueLengths, all n gates, demonCount, numodemonCount and the seven subtype counts; and, for 256, 666, 1000, 1024: base, warp, torqueLengths, demonCount, numodemonCount and subtypeCounts only (compact digests, Phase 1 D-17). The capture script refuses to overwrite (second run exits 1, file unchanged), and cross-checks `refSubtypeCounts` against a tally of `refDemons` for every full entry before writing.
- The fixture test verifies the bytes (no CR, trailing LF), the new manifest (`verifyManifestFile` returns `[]`, strictDir, one `-notable-bases` set with a reason, exactly this file), recomputes every entry from the reference and deep-equals it, and pins spot literals (base 28: 108 cross-Torque of 378; base 82 `[27, 9, 3]`; base 80 `[39]`; base 16 `[4, 2]`; base 666 digest: 221445 demons).
- `refSubtypeCounts(2000)` runs in about 6.4 ms (10 timed runs after warm-up), well under the ~15 ms budget plan 02-05 needs for its sweep to n = 2000.

## Task Commits

1. **Task 1: Independent reference module and its hand-literal self-test** - `54e8054` (test)
2. **Task 2: Capture and freeze the derived notable-bases fixture (new manifest)** - `0b809d6` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Reference API (for plans 02-04, 02-05, 02-06)

Exports of `tests/bruteforce/numogramReference.ts` (import from engine tests as `../../tests/bruteforce/numogramReference`; type names `RefKind`, `RefType`, `RefSubtype`, `RefCycle`, `RefStructure`, `RefDemon` are exported too):

- `REF_SUBTYPES`: the seven subtype names in the fixed order cyclic-chrono, cross-torque-chrono, syzygetic-chrono, plex-amphi, warp-amphi, chaotic-xeno, syzygetic-xeno.
- `refDigits(value, base)`: digits by repeated division, most significant first, `[0]` for 0; throws `Error` for a negative or non-integer value or a base below 2.
- `refDigitSumRoot(value, base)`: iterated in-base digit sum, 0 stays 0.
- `refStructure(base)`: `{ base, partner[zone], pairLo[], current[pair], nextPair[pair], cumulation[zone], gates[zone], cycles[{kind, pairs}], cycleOfZone[zone] }`; pair id === low zone; throws `Error` for odd, < 2 or non-integer bases; no upper limit and no time guard (slow on purpose).
- `refClassify(structure, a, b)`: `{ type, subtype, syzygetic, numodemon }` for a demon with 0 <= b < a < base (throws otherwise).
- `refDemons(structure)`: every demon `{ a, b, mesh, type, subtype, syzygetic, numodemon }`, a > b lexicographic, mesh 0-based counter; n(n-1)/2 objects, so keep it to n of a few hundred.
- `refSubtypeCounts(structure)`: `Record<RefSubtype, number>` in `REF_SUBTYPES` key order, an O(n^2) integer-table loop (about 6.4 ms at n = 2000).

## Files Created/Modified

- `tests/bruteforce/numogramReference.ts` - the reference (306 lines)
- `tests/bruteforce/numogramReference.test.ts` - hand-literal self-test, 151 tests
- `scripts/capture-notable-bases.ts` - one-shot capture (imports only `../tests/bruteforce/numogramReference`)
- `engine/test/fixtures/derived/notable-bases.golden.json` - frozen fixture
- `engine/test/fixtures/derived/MANIFEST.json` - new strict manifest, sha256 `2a4baf2a631c9f82df769d813662fa089e86d905a833568dae09737368661a97`
- `tests/bruteforce/notable-bases.fixture.test.ts` - manifest, bytes, recomputation and literal checks, 32 tests

## Decisions Made

- Everything in the plan's `key-decisions` above; no engine files, `.gitignore`, `package.json`, lockfile or existing fixture was touched, and `npm install` was not run.
- The reference throws `Error` (not `RangeError`) because it is test code with no relation to the engine's D-12 contract.
- Where the plan lets the reference build cycles "by a walk that does not assume a permutation", the rotation-to-smallest step is defensive: on a real numogram the walk starts at the smallest unvisited pair, so the tail is already rotated (see mutation check below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The throwaway engine-config compile needed `typeRoots`**
- **Found during:** Task 1 (the plan's engine-config compile of the reference)
- **Issue:** The temp tsconfig in the OS temp directory `extends` `engine/tsconfig.test.json`, whose `"types": ["node"]` is resolved relative to the temp directory, giving `TS2688: Cannot find type definition file for 'node'` (an artifact of the throwaway location, not of the reference).
- **Fix:** Added `compilerOptions.typeRoots` pointing at the repo's `node_modules/@types` in the temp tsconfig only. Every other option (strict, noUncheckedIndexedAccess, lib ES2022) is inherited unchanged. Result: reference compile exit 0; the self-test file also compiles clean under the same config (exit 0). The temp directory was removed.
- **Files modified:** none (temporary file only)
- **Commit:** none

**2. [Rule 1 - Bug in my own test, fixed before the first commit]** Two literals in the first draft of the self-test were wrong, not the reference: the base-10 row `9::1` sums to 10 so it is a Numodemon (row expectation now `numodemon: a + b === 10`), and `(root - v) % m` gave `-0` when m = 1 so it now asserts `=== 0` instead of `toBe(0)`. Both were caught by the first GREEN run.

Otherwise none: the plan was executed as written. Note for a strict reader of the acceptance grep `grep -n "engine/" scripts/capture-notable-bases.ts`: it shows the two output-path strings plus the `source` string the plan itself prescribes for the fixture ("... never engine/, never the gitignored root reference/ sources"); there is no import from engine/.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run --project oracle tests/bruteforce`: 2 files, 183 tests pass; same under `CCRUG_TZ=America/New_York`.
- `node scripts/golden-manifest.mjs verify engine/test/fixtures/derived/MANIFEST.json engine/test/fixtures/MANIFEST.json e2e/__golden__/MANIFEST.json`: exit 0 (1 + 1 + 30 files).
- `git diff --quiet f7d6689 -- engine/test/fixtures/base10.golden.json engine/test/fixtures/MANIFEST.json e2e/__golden__`: exit 0.
- `npm run typecheck`: exit 0 (root, engine, engine test, components tsc and lint). `npm run test`: 14 files, 676 tests pass; `npm run test:tz`: the same. `npm run check:repo`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow).
- `git check-ignore -q tests/bruteforce/numogramReference.ts`: exit 1 (not ignored); `git ls-files tests/bruteforce` lists exactly the three files; a second `npx tsx scripts/capture-notable-bases.ts` exits 1 and leaves the file unchanged.
- Acceptance greps on the reference (engine imports, closed-form patterns `% (n - 1)` / `k * (k + 1)` / `(k + 1)) / 2` / `(a - 1)) / 2`, fs/readFile/require) all find nothing.

## Mutation Check (nothing committed)

A first-run pass proves little, so eleven mutants of the reference were run against the self-test (file backed up and restored, byte-identical afterwards): plain-remainder digital root, Numodemon off by one, mesh starting at 1, cross-Torque folded into cyclic, syzygetic uses n instead of n-1, length-only ascending sort, Warp = any short cycle, current = lo, amphi sides swapped, cumulation off by one: all killed. Only "no rotation to smallest" survived, and it is an equivalent mutant on real numograms (the walk already starts at the smallest unvisited pair of a permutation).

## Issues Encountered

- None blocking. No wave-1 peer ran, so no whole-repo check reported a foreign file.

## Known Stubs

None.

## Threat Flags

None. T-02-05..T-02-09 are mitigated as planned: no engine imports and none of the engine's closed forms (greps), capture script refuses overwrite, new manifest with a fixture-recomputing test, existing frozen sets byte-identical to f7d6689, no file I/O in the reference (grep), `tests/bruteforce` not ignored (`git check-ignore` exit 1) and fixed repo-relative output path. No new network, auth, file or schema surface.

## Requirements Note

`requirements-completed` lists ENG-01..ENG-04 because this plan's frontmatter carries them; the plan only delivers the oracle they are verified against, the engine implementation and sweeps come in 02-04..02-06. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Next Phase Readiness

- Plan 02-04 (`createNumogram`) can sweep `refStructure(n)` for every even n (structure, gates, cycles); 02-05 can use `refSubtypeCounts` for n <= 2000 and `refDemons` for n <= 300; 02-06 can compare unranking against `refDemons`' mesh numbers. Engine tests must import the reference by relative path `../../tests/bruteforce/numogramReference` (allowed under `engine/tsconfig.test.json`: verified compiling).
- `scripts/check-repo.mjs` does not yet list `engine/test/fixtures/derived/MANIFEST.json`; plan 02-07 (the next plan editing that guard) should register it. Until then `tests/bruteforce/notable-bases.fixture.test.ts` is the only verifier, and `npm run verify` runs it through `npm run test`.

## Self-Check: PASSED

- FOUND: `tests/bruteforce/numogramReference.ts`, `tests/bruteforce/numogramReference.test.ts`, `tests/bruteforce/notable-bases.fixture.test.ts`, `scripts/capture-notable-bases.ts`, `engine/test/fixtures/derived/notable-bases.golden.json`, `engine/test/fixtures/derived/MANIFEST.json`
- FOUND commits: `54e8054`, `0b809d6`
