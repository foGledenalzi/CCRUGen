---
phase: 07-naming-builder
plan: 08
subsystem: engine
tags: [naming, json-schema, validator, prototype-pollution, total-guard, export-import, fast-check, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (Naming contract, createNaming, edit operations) plus 07-01/07-02 (generator ids, text rules, euphony version)
  - phase: 02-engine-core-and-base-10-migration
    provides: validateBase and the pure-engine lint and tsc boundary
provides:
  - engine/naming/schema.ts, the ccrug.naming/1 constants (SCHEMA_ID, SCHEMA_PREFIX, NAMING_IMPORT_MAX_BYTES, NAMING_MAX_OVERRIDES, META_MAX_LENGTH, ISSUES_MAX, UNKNOWN_KEYS_MAX), SeedRecord and the deterministic serializeNaming (compact for storage slots, pretty for export)
  - engine/naming/validate.ts, validateNamingJson with the typed NamingIssue and NamingImport results (the one reader of files and localStorage slots)
  - engine/naming/index.ts, the barrel lines for both (values and types in separate statements; engine/index.ts already re-exports the naming barrel)
  - engine/test/naming.schema.test.ts (143 tests, including three fast-check properties and a fuzz run)
affects: [07-11, 07-13, 07-16, 07-17, 07-18, 07-19, 07-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One total reader for every untrusted naming text (file or slot): try/catch around a non-recursive body, issues collected one rule at a time, at most 5 kept with the exact total"
    - "Prototype-safe maps from JSON: key regex (digits only) first, then a Map; every field read through an own-property helper so a polluted Object.prototype adds nothing"
    - "Deterministic serializer: fixed key order, locks and override keys explicitly sorted (an object only orders array-index keys by itself), no clock"

key-files:
  created:
    - engine/naming/schema.ts
    - engine/naming/validate.ts
    - engine/test/naming.schema.test.ts
  modified:
    - engine/naming/index.ts

key-decisions:
  - "An unknown generator id (prng or gen) or a join.smoothing above EUPHONY_VERSION is refused as unknown-version carrying that id (euphony@{n} for smoothing), and the file is refused alone: a pre-pass reads these before any other field, so nothing else about a newer file is reported"
  - "Missing or wrongly typed required blocks are bad fields, never defaults: generator, join, source and a null meta are strict; a missing generator.prng or generator.gen is a bad field, not an unknown version"
  - "The wrong-base seed offer requires the whole seed record to be valid and known (both generator ids, a normalisable seed, a known style, a known join order, smoothing 0 or 1); otherwise offerSeed is null"
  - "A ccru file is accepted only when the caller passes a preset whose base equals the current base and has one sound per zone; the file's zones, when present, stay authoritative over the preset sounds"
  - "The size cap counts UTF-16 units of the text (maxBytes option, default 8 MiB): callers read File.size before reading a file; slots use text.length"
  - "Locks need a zones array to be present (validity of the zones is checked separately, so one bad table does not cascade into a locks issue); overrides do not need zones"
  - "Reads use Object.prototype.hasOwnProperty (the own helper): an inherited property of a polluted Object.prototype is never read as a file field"

patterns-established:
  - "A plan's grep gate that counts a literal (the override-key regex, exactly once) is met by wording the header comment without repeating the literal"

requirements-completed: []  # NAM-03 stays Pending: the engine format and validator exist, but export/import buttons, the link codec and the collision report that make it observable arrive in plans 07-09 to 07-23

# Metrics
duration: ~18min
completed: 2026-11-09
---

# Phase 7 Plan 08: Versioned Naming JSON and Its Prototype-Safe Validator Summary

**The `ccrug.naming/1` file format as a deterministic serializer plus one hand-written, never-throwing, non-recursive, all-or-nothing validator (typed issues, 5 kept with an exact count, Map-stored mesh-number override keys so `__proto__`, `constructor` and `toString` are refused and never assigned), with export -> import proven the identity by property tests and 17 mutants killed.**

## Performance

- **Duration:** about 18 min (including the mutation runs, the full unit suites in two timezones, and a build plus page-weight check)
- **Completed:** 2026-11-09
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit), plus one test-only follow-up commit
- **Files created:** 3 (`schema.ts`, `validate.ts`, one test file); 1 modified (`engine/naming/index.ts`, +16 lines)
- **`$PLAN_BASE`:** `bd3afd8d345078dea4b8d8756b43ae5983ff8f9f`

## Accomplishments

- **Serializer (`schema.ts`).** `serializeNaming(n, { pretty })` writes `schema, base, source, generator { prng, gen, seed, style }, join { order, smoothing }, zones, locks, overrides` and `meta` only when non-null, in that fixed order. Locks and override keys are explicitly sorted ascending (an object lists only array-index keys, those below 2^32 - 1, in order by itself; a mesh number from 2^32 - 1 up would keep its insertion order, which a test with meshes 4,400,000,000 and 4,500,000,000 at base 100,000 pins). No timestamp, no clock. A seed-only naming (sounds null) is written as the seed record alone (under 400 bytes); pretty output is `JSON.stringify(JSON.parse(compact), null, 2) + '\n'`. A base-4000 naming with 400 locks and 1000 overrides is under 60,000 bytes compact.
- **Validator (`validate.ts`).** `validateNamingJson(text, { base, interactiveMaxN, preset, maxBytes? })` runs the plan's rule order: size cap, JSON, plain object, schema id (other `ccrug.naming/N` is `unknown-version` with the suffix), base through `validateBase` (invalid is `bad-field 'base'`, another valid base is `wrong-base` with the file's base and `offerSeed`), then generator, source, join, seed-only bases, zones, locks, overrides, meta and unknown keys. One `report()` collector keeps at most `ISSUES_MAX` = 5 issues and counts every issue exactly (`And {k} more.` is the UI's job).
- **Prototype safety (T-07-04).** Override keys must match `/^(0|[1-9][0-9]{0,15})$/` and be below `base * (base - 1) / 2`; accepted pairs go into a `Map<number, string>`. `__proto__`, `constructor`, `toString`, `hasOwnProperty`, `valueOf`, `prototype` and `__defineGetter__` are each refused as `bad-override-key` with `Object.prototype` unchanged afterwards (own names compared before and after, `({}).polluted` undefined). A `__proto__` key elsewhere in the file (top level, inside `generator`) is just an unknown key.
- **Denial of service (T-07-05).** The byte cap is checked before parsing; more than 250,000 override keys is `bad-field 'overrides'` before any key is read (exactly 250,000 is accepted, tested at base 4000); nothing recurses: a 100,000-deep nested array as `meta.notes` is `bad-field 'meta.notes'`, deep arrays and objects anywhere else are only listed or refused as one field. The whole body sits in a try/catch that returns `not-names-file`, and 2,000 random JSON values, 2,000 random strings and 1,500 single-field replacements of a valid file all return a typed result (and every accepted result re-exports to a file that imports to the same naming).
- **Content safety (T-07-03c).** Every sound passes `validateSound` and every override name `validateName`, so no control or format character (a bidi override, ZWNJ) gets in; non-text entries report reason `other`.
- **Slot safety (T-07-08).** The same function reads slots; any failure is typed issues, so a caller can treat the slot as absent.
- **Identity.** For 300 random namings at base 28 and 50 at base 666 (random seeds including non-ASCII, all styles, joins and smoothings, typed sounds in Latin, Greek, Cyrillic, Hiragana, CJK and Devanagari with a vowel sign, locks, overrides, meta), plus seed-only namings at base 4002, a ccru naming with a synthetic preset, a base on the ceiling and above-2^32 meshes: `validateNamingJson(serializeNaming(n))` is `ok` and equals `n` for both the compact and pretty forms, and export -> import -> export gives the same bytes.
- **Behaviour matrix covered by tests:** too-large (inclusive boundary), not-json, not-names-file, unknown versions (schema, generator ids, `euphony@2`), base and wrong-base (with seed offers: normalised, null for any invalid seed record, null for an unknown generator id), seed-only bases (ceiling itself is editable, one over is refused, all three keys give one issue), zones (length, reasons digit, empty, space, other, long, non-text), locks, overrides (keys, values, count cap), source, join, meta, unknown keys (dotted, 5 kept, exact count, clipped).

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: schema constants and the deterministic serializer**
   - RED: `3995682` (test) 11 tests failing on the missing module
   - GREEN: `411a914` (feat) `schema.ts`
2. **Task 2: validateNamingJson (all-or-nothing, non-recursive, prototype-safe)**
   - RED: `4b1e0b4` (test) 142 tests failing on the missing module
   - GREEN: `56c81c3` (feat) `validate.ts`, the barrel lines, and one fix of a test expectation (see Deviations 1)
   - Follow-up: `b1d0131` (test) pins that the validator reads own properties only (closed a mutation survivor)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `engine/naming/schema.ts` - constants, `SeedRecord`, `serializeNaming` (71 lines)
- `engine/naming/validate.ts` - `NamingIssue`, `NamingImport`, `ValidateNamingOptions`, `validateNamingJson` and five private helpers: `clip`, `own`, `seedRecordOf`, `unknownVersionOf`, `readLocks` (378 lines)
- `engine/naming/index.ts` - exports the schema and validator values and types in separate statements (+16 lines)
- `engine/test/naming.schema.test.ts` - 143 tests (1,115 lines)

## Decisions Made

See `key-decisions`. The five `[default]` decisions the plan named (the caps, unknown generator ids refused, smoothing versions, a file without zones regenerated, pretty exports and compact slots) are implemented as written. The additions are mine and listed in the same block: strict required blocks, the full-record rule for the seed offer, the own-property reader, and the unknown-version-stops-alone rule.

## Mutation Checks

Every mutation was a one-line (or small block) edit, the file was run in the foreground under a 120 s timeout, then restored with `git checkout -- <file>` and confirmed with `git diff --quiet` (identical each time). The first three are the ones the plan lists.

| File | Mutation | Result |
|------|----------|--------|
| validate.ts | remove the size cap (`text.length > Infinity`) | Killed: 3 tests (too-large, inclusive cap, default cap) |
| validate.ts | store overrides with `store[key] = value` into a plain object and drop the digit-regex key check | Killed: 25 tests (all 14 refused-key cases, all 7 prototype-key cases, the first/last mesh case, the key-clipping case, the collected-issue case and deep nesting) |
| validate.ts | make unknown keys an issue (a refusal) | Killed: 5 tests (the dotted listing, the exact count of 7, the clipping, the hostile `__proto__` key and the deep-nesting case) |
| validate.ts | drop only the digit-regex key check (keep the numeric bound) | Killed: 18 tests (all 7 prototype keys, `044`, `-1`, ``, whitespace, `0x10`, `1.5`, `+5`, Arabic-Indic digits, `5\n`, the deep-object case) |
| validate.ts | `own()` reads `rec[key]` (inherited properties) | **Survived at first** (no test polluted the prototype); added the polluted-`Object.prototype` test, then Killed: 1 test |
| validate.ts | mesh bound `>=` to `>` (key 378 accepted at base 28) | Killed: 2 tests |
| validate.ts | seed-only boundary `>` to `>=` (base on the ceiling refused) | Killed: 3 tests |
| validate.ts | `report()` stops capping issues (refuse still slices) | **Survived: equivalent mutant** (the cap is enforced twice on purpose: in `report` to bound memory, in `refuse` as the guarantee; the observable result is identical) |
| validate.ts | remove the cap in both `report()` and `refuse()` | Killed: 4 tests (5 kept of 9, the collected case, the override-name case, the fuzz shape check) |
| validate.ts | wrong-base never carries the seed offer | Killed: 3 tests |
| validate.ts | duplicate locks accepted (drop `locks.has`) | Killed: 1 test |
| validate.ts | override names skip `validateName` | Killed: 3 tests |
| validate.ts | `unknownKeyCount` counts only listed keys | Killed: 1 test |
| validate.ts | locks accepted without zones | Killed: 1 test |
| validate.ts | seed-only check ignores overrides | Killed: 1 test |
| validate.ts | smoothing 2 is not an unknown version (`> EUPHONY_VERSION + 1`) | Killed: 1 test |
| schema.ts | override keys not sorted | Killed: 1 test (the above-2^32 test; keys below 2^32 - 1 sort by themselves, so only that test can see it) |
| schema.ts | locks not sorted | Killed: 1 test |

No survivor except the one equivalent mutant.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.schema.test.ts --project engine`: 143 passed (about 3 s).
- `npm run test` (all projects, UTC): 103 files, 3,054 tests passed. `npm run test:tz` (America/New_York): 103 files, 3,054 passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched here. `npx next lint --dir engine`: no warnings or errors (re-run after the last test edit; `tsc -p engine/tsconfig.test.json` also exit 0).
- `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten).
- Acceptance greps: `grep -c "export const SCHEMA_ID = 'ccrug.naming/1'" engine/naming/schema.ts` = 1; `grep -c "export const NAMING_IMPORT_MAX_BYTES = 8388608" engine/naming/schema.ts` = 1; `grep -nE "Date|performance" engine/naming/schema.ts` (and `validate.ts`) prints nothing; `grep -c "export function validateNamingJson" engine/naming/validate.ts` = 1; `grep -cF "/^(0|[1-9][0-9]{0,15})$/" engine/naming/validate.ts` = 1; `grep -c "validateNamingJson\|serializeNaming" engine/naming/index.ts` = 2; the test file contains `__proto__` (6), `constructor`, `toString` and `unknownKeyCount` (6); `grep -c "validateSound(" engine/naming/validate.ts` = 1; `grep -c "new Map" engine/naming/validate.ts` = 1; `grep -c "app/\|lore" engine/naming/validate.ts engine/naming/schema.ts` = 0 and 0.
- Beyond the plan: `npm run build` exit 0 and `npm run check:weight`: `page-weight: OK (2 routes, 30 golden states within tolerance)`; `/numogram` stays 119 kB and 207 kB first load (nothing in `app/` imports the new exports yet, and the barrel is tree-shaken).
- `git diff --stat bd3afd8 -- e2e engine/test/fixtures app engine/naming/banks.ts engine/test/naming.vectors.test.ts reference`: empty. No frozen oracle, bank, vector, `Projection.tsx`, `app/presets/base10/**` or `reference/` file was touched; `git status --short` is clean after the build.
- `npm run test:swap` and `npm run verify` were not run: this plan adds only engine modules, a test file and a barrel line, nothing in `app/` imports them, and neither command is named in the plan. The unit suites in two timezones, the typecheck gate, the repo guard and the build plus page-weight check above cover the surfaces the change can reach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test bug in my own RED test] Wrong NFC expectation for the seed offer**
- **Found during:** Task 2 (first GREEN run, 141 of 142 passed)
- **Issue:** The test fed `'  cáfe  '` (which composes to `cáfe`) and expected `café`.
- **Fix:** The input is now `'  café  '` (composes to `café`). No implementation change; the validator was right.
- **Files modified:** `engine/test/naming.schema.test.ts`
- **Committed in:** `56c81c3`

**2. [Rule 2 - Missing critical functionality] Own-property reads**
- **Found during:** Task 2 (design) and confirmed by a mutation survivor
- **Issue:** The plan reads fields straight off the parsed object. A polluted `Object.prototype` (by another library on the page) would then add `locks`, `overrides` or `meta` to a file that has none.
- **Fix:** every field is read through `own(rec, key)` (`hasOwnProperty`). A test defines non-enumerable `locks`, `overrides`, `meta` and `zones` on `Object.prototype` for the duration of one call and checks the result is unchanged; the mutant that reads `rec[key]` is killed by it.
- **Files modified:** `engine/naming/validate.ts`, `engine/test/naming.schema.test.ts`
- **Committed in:** `56c81c3`, `b1d0131`

**3. [Plan ambiguity resolved] Unknown versions stop the read, and are looked for first**
- **Issue:** The plan says an unknown `generator.prng` or `generator.gen` stops the read, and for `join.smoothing` greater than `EUPHONY_VERSION` only names the issue kind. Collecting a `bad-field` for the seed first and then dropping it on a later "stop" would make the result depend on field order.
- **Fix:** a small pre-pass (`unknownVersionOf`) runs right after the base check and reads only the two generator ids and `join.smoothing`; a hit returns that one issue and nothing else. Both unknown-version families behave the same, and a test checks a newer file with otherwise bad zones and locks is refused alone.
- **Files modified:** `engine/naming/validate.ts`
- **Committed in:** `56c81c3`

**4. [Plan inconsistency] The grep gate counts the regex literal once**
- **Found during:** Task 2 acceptance
- **Issue:** My first header comment quoted the key regex, so `grep -cF "/^(0|[1-9][0-9]{0,15})$/" engine/naming/validate.ts` printed 2, and the plan requires 1.
- **Fix:** the header now says "OVERRIDE_KEY below: digits only, at most 16, no leading zero". The gate is unchanged.
- **Files modified:** `engine/naming/validate.ts`
- **Committed in:** `56c81c3`

**5. [Coverage beyond the plan] Tests the plan did not list**
- A test that the serializer orders override keys above 2^32 (the only case where the explicit sort matters), the polluted-prototype test (deviation 2), a base on the ceiling and the over-by-one case, an import -> export -> import stability check inside the fuzz runs, a single-field-replacement fuzz of a valid file, and the exact-boundary cases for the byte cap, the override-count cap and the mesh bound. No exported name or contract changes.

---

**Total deviations:** 1 test fix, 1 hardening item added, 1 plan ambiguity resolved, 1 gate-wording fix, 1 coverage extension.
**Impact on plan:** none of them changes an exported name, constant or contract; no scope creep.

## Issues Encountered

None blocking. The one equivalent mutant (the issue cap enforced in both `report()` and `refuse()`) is documented above rather than "fixed": removing either copy leaves behaviour unchanged, and the redundancy keeps memory bounded even if a future caller passes a huge `interactiveMaxN`.

## Notes for the plans that consume this module

- **07-11 (copy):** map `NamingIssue.kind` to the UI-SPEC error lines: `not-json` and `not-names-file` (one "not a names file" message is enough), `too-large` (carries `maxBytes`, print it through the one formatter), `unknown-version` (`version` is the schema suffix, a generator id or `euphony@{n}`), `wrong-base` (`fileBase`; offer `Use its seed here` only when `offerSeed !== null`), `seed-only-base`, `bad-sound` (`zone`, `reason`), `bad-override-key`, `bad-override-name` (`mesh`, `reason`), `bad-field` (`path`). Show `issues` and then `And {issueCount - issues.length} more.`; a success shows `unknownKeys` and `and {unknownKeyCount - unknownKeys.length} more`.
- **07-13 (slot):** write `serializeNaming(n)` (compact), read through `validateNamingJson(text, ...)`, and treat any `ok: false` as an absent slot. Pass `preset: <the base-10 preset>` so a ccru slot at base 10 reads back; without a preset a ccru file is `bad-field 'source'`. Check `File.size` against `NAMING_IMPORT_MAX_BYTES` before reading a file (the validator counts text length).
- **07-16 (export/import UI):** export with `serializeNaming(n, { pretty: true })`; at a seed-only base the serializer already writes the seed record alone (D-11).

## Known Stubs

None. The plan creates no UI and renders nothing.

## Threat Flags

None. The plan adds only pure engine modules and tests: no network endpoint, no auth path, no file or storage access (the callers own those), no schema at a new trust boundary beyond the two the plan's threat model names. The four register entries are mitigated as planned: T-07-04 (digit-regex keys, Map storage, seven prototype-key vectors, pollution checks, own-property reads), T-07-05 (byte cap before parsing, override-count cap, no recursion, never-throw fuzz), T-07-08 (the same validator for slots, failures are typed issues) and T-07-03c (every sound and name through `validateSound` / `validateName`). `meta.title` and `meta.notes` are free text limited only by length, as the plan specifies; the UI must render them as text (React escapes by default).

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-08)` `3995682` before `feat(07-08)` `411a914`, and `test(07-08)` `4b1e0b4` before `feat(07-08)` `56c81c3`. Each RED run failed on the missing module (confirmed before its GREEN commit). `b1d0131` is a test-only follow-up from the mutation runs. No refactor commit was needed.

## Next Phase Readiness

- Plan 07-09 (the `names=` link codec, `labels=sounds` and the worker guard) is independent of this one and can start; `SeedRecord` is the type a link carries.
- Plans 07-11, 07-13 and 07-16 build on the exports above (see the notes section).
- No blocker.

## Self-Check: PASSED

- All four files exist and are tracked: `engine/naming/schema.ts`, `engine/naming/validate.ts`, `engine/test/naming.schema.test.ts`, and the modified `engine/naming/index.ts`.
- All five commits exist (`3995682`, `411a914`, `4b1e0b4`, `56c81c3`, `b1d0131`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer (5 of 5 counted).
- No frozen oracle path, no `reference/` file, no `app/` file, no `Projection.tsx`, no bank and no signed-off vector was touched.
