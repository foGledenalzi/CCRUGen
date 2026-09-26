---
phase: 02-engine-core-and-base-10-migration
plan: 01
subsystem: engine
tags: [engine, pure-ts, base-validation, digital-root, numerals, rangeerror, fast-check, vitest]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net
    provides: engine purity boundary (tsc lib ES2022 + ESLint override), Vitest engine project with the CCRUG_TZ pin, fast-check
provides:
  - engine/core/types.ts, the public type contracts (Cycle, Numogram, PairInfo, CurrentInfo, GateInfo, DemonRef, DemonSelection, DemonSpace, DEMON_TYPES, DEMON_SUBTYPES) that plans 02-04..02-06 implement
  - engine/core/base.ts, MAX_BASE = 2^26, validateBase (reason without throwing), assertBase (RangeError)
  - engine/core/arith.ts, triangular(k) and the in-base digitalRoot(value, base)
  - engine/core/numerals.ts, the own-base numeral formatter and exact parser (D-04, D-05) with the beyond-36 scheme, gate names, net-spans, Torque display labels
  - engine/index.ts, the public barrel (relative re-exports only)
affects: [02-04, 02-05, 02-06, 02-08, 02-10, 02-12, phase-04-base-picker-and-labels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validate-then-allocate: every engine entry point checks its arguments (RangeError with a reason) before any allocation"
    - "Independent oracle: the engine derives digits by repeated division and never uses the built-in radix conversion or its parsing counterpart, so the tests use that built-in as the oracle (enforced by a textual grep on engine/core/numerals.ts and arith.ts)"
    - "Fixed seeds and run counts as literals in the tests (D-10): 20260926..20260934"
    - "Contract-first: types.ts lands before any implementation so later plans build against a fixed shape"

key-files:
  created:
    - engine/core/types.ts
    - engine/core/base.ts
    - engine/core/arith.ts
    - engine/core/numerals.ts
    - engine/test/base.test.ts
    - engine/test/arith.test.ts
    - engine/test/numerals.test.ts
  modified:
    - engine/index.ts

key-decisions:
  - "Numeral scheme (D-05, the Phase 4 contract): base 2..36 is one lowercase character per digit from '0123456789abcdefghijklmnopqrstuvwxyz'; base 37..2^26 writes each digit as its decimal value and joins digits with '.', a single digit being plain decimal ('59' in base 60, '1.0.1' for 3601); minDigits left-pads with zero DIGITS ('03', '0.3'); parseNumeral is the exact inverse"
  - "parseNumeral grammar: text length 1..64, base <= 36 lowercase alphanumerics with leading zeros allowed, base > 36 dot-separated groups each '0' or [1-9][0-9]*, group value below the base, no empty group, value at most Number.MAX_SAFE_INTEGER; single linear character loop, no regular expression"
  - "Numerals accept every integer base 2..2^26 (odd included); only numograms are restricted to even bases (validateBase)"
  - "torqueLabel(i) is 'A'..'Z' for 0..25 and String(i + 1) from 26 on; the numeric torqueIndex stays the identity"

patterns-established:
  - "Bounded error messages: parseNumeral echoes at most 40 characters of a refused text, so a hostile 1e6-character input cannot bloat a message"
  - "Test tables holding hostile values (throwing toString, null-prototype, symbols) use plain for-of loops with it(), not it.each (vitest stringifies extra it.each arguments)"

requirements-completed: [ENG-01, ENG-04]

# Metrics
duration: 14min
completed: 2026-09-26
---

# Phase 2 Plan 01: Engine Foundation Summary

**Public engine contracts plus base validation (RangeError with a reason, never-throwing validateBase, ceiling 2^26), the in-base digital root, and a reversible own-base numeral formatter (single characters to base 36, dot-joined decimal digit groups beyond) that reproduces every base-10 gate name and writes base-12 zone 11 as Gt-56.**

## Performance

- **Duration:** about 14 min (started about 2026-09-26T18:58Z, finished about 19:12Z)
- **Tasks:** 2 (2 task commits)
- **Files modified:** 8 (7 created, 1 modified), exactly the plan's `files_modified` list

## Accomplishments

- `validateBase(n)` classifies NaN and every non-number (`'10'`, `10n`, `null`, `undefined`, objects, null-prototype objects, objects with a throwing `toString`, symbols), Infinity, non-integers, 0 and -0, negatives, odd numbers and everything above 2^26, without ever throwing; `assertBase` throws a `RangeError` carrying the exact same message, always starting `Invalid base `. Accepts every even integer 2..67108864 (exhaustive to 20000 plus a fixed-seed sample of 2000 up to 2^26).
- `digitalRoot(v, n)` is the closed form `((value - 1) % (base - 1)) + 1` (0 for 0) and matches an iterated in-base digit-sum oracle for every base 2..36 (300 fixed-seed values each). Literal gate tables for bases 2, 4, 6, 8, 10 and the base-12 table `0,1,3,6,a,4,a,6,3,1,b,b` (written with `formatNumeral`) pass. `triangular(67108863) = 2251799780130816`, cross-checked against BigInt.
- `formatNumeral` equals the built-in radix conversion for every base 2..36 (200 fixed-seed values each, plus the `padStart` form), `parseNumeral(formatNumeral(v, b, d), b) === v` holds for 5000 fixed-seed cases with b in 2..2^26, v up to MAX_SAFE_INTEGER, d in 1..4. `formatGateName(66, 12) === 'Gt-56'`, `formatNetSpan(11, 3, 12) === 'b::3'`, `formatGateName(1770, 60) === 'Gt-29.30'`, and the ten base-10 names `Gt-00 .. Gt-45` come out unchanged.
- An invariant test ties formatting to arithmetic: for every even base 2..60 and every zone, the digital root of the gate name's digit sum equals the gate's target (the name itself shows the in-base digital root, per the "Specifics" note in CONTEXT).
- `parseNumeral` rejects every case in the plan's table plus Unicode digits, whitespace, `0x` prefixes, 65+ character strings, and any value above MAX_SAFE_INTEGER (a 1000-case fixed-seed sweep just above the boundary in random bases); a 1,000,000-character input is refused fast with a message under 300 characters.
- `engine/index.ts` keeps its boundary header comment and now re-exports the whole surface by relative path; `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint with the engine purity override) exits 0.

## Task Commits

1. **Task 1: Engine contracts (types.ts) and base validation with RangeError** - `4e95341` (feat)
2. **Task 2: In-base arithmetic and the numeral formatter/parser (D-04, D-05)** - `85fd316` (feat)

**Plan metadata:** committed separately after this file (docs: complete plan).

## TDD Note

Both tasks are `tdd="true"` but the plan prescribes one `feat(02-01)` commit per task (tests plus implementation), and that is what was committed. The RED state was still observed before each implementation: with the test files written and the modules absent, vitest failed with `Cannot find module '../core/base'` (Task 1) and `'../core/arith'` (Task 2). GREEN came on the first run after the implementation (Task 2: 297/297 engine tests). Because a first-run pass proves little, a mutation check followed (backups restored afterwards, nothing committed): replacing the digital root by `value % (base - 1)` failed 18 tests, removing the overflow guard 4, allowing a leading-zero digit group 2, moving the letter/group boundary from base 36 to 35 failed 5, removing the 64-character cap 2. All five mutants were killed.

## Contract Evolution Inside This Phase

`engine/core/types.ts` intentionally does not yet contain the members later plans add (the plan's acceptance criteria forbid them):

- Plan 02-05 adds `readonly demons: DemonSpace` to `Numogram`.
- Plan 02-06 adds `group(type: DemonType): DemonSelection` and `subtype(subtype: DemonSubtype): DemonSelection` to `DemonSpace`.

## Files Created/Modified

- `engine/core/types.ts` - public contracts, every member commented with its unit (pairs vs zones) and meaning
- `engine/core/base.ts` - `MAX_BASE`, `BaseProblem`, `BaseCheck`, `validateBase`, `assertBase`
- `engine/core/arith.ts` - `triangular`, `digitalRoot`
- `engine/core/numerals.ts` - `NUMERAL_DIGITS`, `NUMERAL_SEPARATOR`, `digitsOf`, `formatNumeral`, `parseNumeral`, `formatNetSpan`, `formatGateName`, `torqueLabel`
- `engine/index.ts` - barrel (header comment kept, `export {}` replaced)
- `engine/test/base.test.ts` (83 tests), `engine/test/arith.test.ts` (52), `engine/test/numerals.test.ts` (122)

## Decisions Made

- The numeral scheme and parse grammar recorded in `key-decisions` above are the contract Phase 4 (zone labels beyond base 36) and the base-10 adapter (plan 02-10, `Gt-NN`) consume.
- Numerals take any integer base 2..2^26, odd included, because a formatter has no reason to refuse base 7; only `validateBase`/`assertBase` (numograms) demand even bases.
- Error text is deliberately small and never throws: values are described by `String(n)` for numbers, `<typeof>` for other types in arith/numerals, and a guarded `JSON.stringify`/`String` with `<typeof>` fallback in base.ts.

## Deviations from Plan

None to the plan's behaviour or interfaces. Three small choices worth recording (no rule triggered; all inside the plan's files):

1. **Test tables use loops, not `it.each`, in `base.test.ts`.** The plan asks for `it.each` tables. Vitest's title formatter stringifies extra `it.each` arguments, so the deliberately hostile row (an object whose `toString` throws) crashed test collection before any assertion ran. The three tables with hostile values were changed to `for (...) it(...)` loops; every behaviour bullet is still covered one case per test. Committed in `4e95341`.
2. **A doc comment in `types.ts` was reworded.** The first draft of the `DemonSpace` comment contained the literal text `demons:`, which the acceptance grep (`does NOT contain demons: or group(`) forbids textually. Reworded before the commit.
3. **`triangular` ceiling.** The plan fixes the ceiling at 94906264 "so k(k+1) <= MAX_SAFE_INTEGER". That holds, but the tight bound is one higher (94906265 also fits). The plan's value was implemented as written and commented as conservative; it is far above 2^26 and changes nothing observable.

## Issues Encountered

- None blocking. A wave-1 peer never overlapped (plans ran one at a time), so no whole-repo check ever reported a foreign file.
- Observation for later plans: `formatNumeral` accepts `minDigits` up to 64 as specified, while `parseNumeral` refuses text over 64 characters. In bases above 36 a padded numeral wider than 32 digit groups is therefore writable but not parseable. Unpadded numerals never exceed 53 characters (base 2) so round trips are unaffected; the base-10 adapter pads to 2 digits only.

## User Setup Required

None. No dependency was added, `package.json` and the lockfile are untouched, and `npm install` was not run.

## Next Phase Readiness

- Plan 02-04 (`createNumogram`) can implement `Numogram` and `Cycle` straight from `engine/core/types.ts`; `digitalRoot` and `triangular` are ready for `gate(zone)`, `assertBase` for `createNumogram(base)`.
- Plan 02-05/02-06 import `DEMON_TYPES`, `DEMON_SUBTYPES` and the `DemonRef`, `DemonSelection`, `DemonSpace` shapes (adding the members listed above).
- Plan 02-10 (gates) builds `Gt-NN` names with `formatGateName(triangular(zone), 10)`; plan 02-12 (demons) can format mesh numbers and net-spans with `formatNumeral` and `formatNetSpan`.
- Verified now: `npm run typecheck` exit 0; `npm run test` (12 files, 493 tests) and `npm run test:tz` (same, America/New_York) pass. `git log --grep="(02-01)" --name-only --format= | sort -u` lists only the eight `engine/` files above. No file under `e2e/__golden__` or `engine/test/fixtures` was touched.

## Requirements Note

`requirements-completed` lists ENG-01 and ENG-04 because this plan's frontmatter carries them; each is only partly delivered here (ENG-01: the gate arithmetic; ENG-04: the input-validation half, the sweep and 2^26 test belong to 02-04). Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Known Stubs

None.

## Threat Flags

None. All four register entries are mitigated as planned: T-02-01 (every check runs before any allocation, one `MAX_BASE` constant), T-02-02 (length cap 64, linear character loop, overflow check on every step, bounded message), T-02-03 (`npm run typecheck` including the engine ESLint override passes on every new file), T-02-04 (`grep -nE "toString\(|parseInt"` on `engine/core/numerals.ts` and `engine/core/arith.ts` finds nothing). No new network, auth, file or schema surface.

## Self-Check: PASSED

- FOUND: `engine/core/types.ts`, `engine/core/base.ts`, `engine/core/arith.ts`, `engine/core/numerals.ts`, `engine/index.ts`, `engine/test/base.test.ts`, `engine/test/arith.test.ts`, `engine/test/numerals.test.ts`
- FOUND commits: `4e95341`, `85fd316`
