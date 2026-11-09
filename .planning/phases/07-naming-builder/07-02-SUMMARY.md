---
phase: 07-naming-builder
plan: 02
subsystem: engine
tags: [unicode, nfc, intl-segmenter, grapheme, validation, euphony, smoothing, fast-check, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-01 (generator core); this plan is independent of it at code level (no import), it only shares the engine/naming folder
provides:
  - engine/naming/text.ts, the D-07 text rules (SOUND_MAX_LENGTH 16, NAME_MAX_LENGTH 32, SEED_MAX_LENGTH 64, TextProblem, TextCheck, toNfc, splitGraphemes, graphemeCount, validateSound, validateName, normalizeSeed, upperFirst)
  - engine/naming/euphony.ts, euphony@1 (EUPHONY_VERSION = 1, smoothName, smoothingInert)
  - engine/test/naming.text.test.ts (84 tests) and engine/test/naming.euphony.test.ts (43 tests)
affects: [07-03, 07-04, 07-05, 07-07, 07-08, 07-11, 07-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-reason validators that never throw: the engine returns a reason code (empty, space, digit, other, long) and the UI owns the words (plan 07-11)"
    - "Length checks that skip the expensive segmenter: UTF-16 length within the limit implies the grapheme count is within it, so Intl.Segmenter runs only for strings longer than the limit (36.3 ms down to 0.67 ms for 4,000 sounds)"
    - "Frozen pass behind a version number, pinned by a vector table plus properties (idempotent, insert-only, no run over 2), with an independent regex oracle for the inertness predicate"

key-files:
  created:
    - engine/naming/text.ts
    - engine/naming/euphony.ts
    - engine/test/naming.text.test.ts
    - engine/test/naming.euphony.test.ts
  modified: []

key-decisions:
  - "Letters rule ^\\p{L}[\\p{L}\\p{M}]*$ after NFC and trim; ZWNJ, joiners, bidi controls, the soft hyphen, tag characters and every other Cf character are refused as 'other' (orchestrator decision 2, threat T-07-03)"
  - "Names (overrides) use the same character rule with NAME_MAX_LENGTH 32 (UI-SPEC decision 11)"
  - "euphony@1 has no triple-letter collapse rule: without it the pass is insert-only, hence injective on inputs that contain no a, u or i, and kttt and ktt stay distinct"
  - "Seeds are trimmed first and checked after: a leading or trailing line separator or newline is trimmed like any edge whitespace, an interior control, line separator or paragraph separator makes the seed null"
  - "The mark-aware fallback regex is lossless (\\P{M}\\p{M}* | \\p{M}+), so a string that starts with a mark is not truncated when Intl.Segmenter is missing"

patterns-established:
  - "Tests build every non-ASCII or invisible character with String.fromCodePoint; a node check confirms no Cf or non-ASCII character landed in any new source file"
  - "Mutation runs go through a script that starts from a saved original, apply one mutant, run the suite in the foreground under a timeout, restore from the saved copy and finish with git diff --quiet"

requirements-completed: []  # NAM-01 and NAM-02 stay Pending: this plan ships pure engine modules only; the editable table, derived names, import/export and the UI that make them observable arrive in plans 07-05 to 07-23

# Metrics
duration: ~25min active (two sessions: the first ended after the euphony RED commit, the second resumed on 2026-11-09)
completed: 2026-11-09
---

# Phase 7 Plan 02: Text Rules and euphony@1 Summary

**The D-07 text rules (NFC, grapheme-safe sound, name and seed validators with typed reasons, locale-independent first-letter capitalisation) and the frozen euphony@1 smoothing pass with its inertness predicate: 127 tests, 21 mutants killed, every Appendix B vector reproduced.**

## Performance

- **Duration:** about 25 min of active work across two sessions (wall clock 2026-11-07 to 2026-11-09, because the first session ended mid-Task 2)
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 4 (2 engine modules, 2 test files); no file modified
- **`$PLAN_BASE`:** `6fe9e440e42a6978164c99d95112a29a89f0b4fb` (`git diff --stat` against it lists exactly the four new files, 800 insertions)

## Accomplishments

- `validateSound` and `validateName` accept exactly 1 to 16 (32 for names) user-perceived characters of letters of any script with their combining marks, after NFC and trim, and report the first failing reason in the order empty, space, digit, other, long. Devanagari with virama and vowel sign, Thai with a tone mark, Arabic with harakat, CJK (BMP and astral) and Greek pass; ZWNJ, ZWJ, LRM, RLO, bidi isolates, the soft hyphen, tag characters, emoji, controls, lone surrogates and a leading combining mark are 'other'.
- Length uses graphemes but the segmenter is skipped for any string whose UTF-16 length is within the limit: a test counts `Intl.Segmenter.segment` calls through a subclass (0 calls for 4,000 short sounds, 16 CJK letters, 16 and 32 ASCII letters; 1 call for a 17-letter sound; 0 for a string rejected earlier for another reason). With `Intl.Segmenter` stubbed out the mark-aware regex gives the same split on ASCII, CJK and combining-mark samples.
- `normalizeSeed` returns the NFC, trimmed seed for 1 to 64 UTF-16 units with no control, line-separator or paragraph-separator character, else null; interior spaces and punctuation are allowed.
- `euphony@1` reproduces all 12 Appendix B vectors (`tnmnm -> tnamnam` through `mnmtn -> mnamtan`), is a no-op on any string that is not all ASCII letters, has the right fill vowel for all 20 consonants in both cases, and is idempotent, insert-only, free of consonant runs over 2 and never ends in two different consonants (20,000 fast-check runs each, seed 20261020).
- `smoothingInert` matches an independent regex statement of research Pattern 5 condition B on 20,000 random tables (more than 1,000 of them inert, so the comparison is not vacuous), and for 5,000 inert pairs neither join order is changed by smoothing.

## Task Commits

1. **Task 1: text.ts (NFC, graphemes, sound/name/seed rules, upperFirst)**
   - RED: `d3c33b5` (test) failing tests for the text rules
   - GREEN: `4b32047` (feat) `engine/naming/text.ts`
2. **Task 2: euphony@1 smoothing and its inertness predicate**
   - RED: `5ea4fe5` (test) failing tests for euphony@1 and smoothingInert
   - GREEN: `d24ca01` (feat) `engine/naming/euphony.ts`, plus two corrected examples in the test file (see Deviations 5)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `engine/naming/text.ts` - limits, `TextProblem`/`TextCheck`, `toNfc`, lazily created `Intl.Segmenter` with the regex fallback, `splitGraphemes`, `graphemeCount`, `validateSound`, `validateName`, `normalizeSeed`, `upperFirst`
- `engine/naming/euphony.ts` - `EUPHONY_VERSION`, the fill map and its char-code table, a linear char-code walk with a string builder, `smoothName`, `smoothingInert`
- `engine/test/naming.text.test.ts` - 84 tests (42-row reason table, names, seeds, upperFirst, split/fallback/segmenter-call counting)
- `engine/test/naming.euphony.test.ts` - 43 tests (vector table, unchanged non-ASCII names, rules, 7 properties, inertness oracle)

## Decisions Made

See `key-decisions` above. The three [default] decisions in the plan (letters rule with Cf refused, the 32-character name limit, no triple-letter collapse) are implemented as stated.

## Mutation Checks

Each mutant was applied by a script from a saved copy of the original, the suite was run in the foreground under a 90 or 120 s timeout, the file was restored from the saved copy and `git diff --quiet` confirmed it equal to HEAD (or to the saved copy, for the one run before text.ts was committed). No mutant spun forever. No survivors.

### text.ts

| # | Mutation | Result |
|---|----------|--------|
| 1 | Plan: replace the rule with `/^\p{L}+$/u` | Killed: devanagari, thai, arabic and the two `q` + combining-acute cases fail (6 failures) |
| 2 | Plan: drop the `t.length > max &&` fast path | Killed by the segmenter-call-count test (1 failure). The plan expected the suite to stay green here; the behaviour list requires the fast path, so the call-count test is deliberate. Measured time of `validateSound` over 4,000 sounds: 0.67 ms median with the fast path, 36.3 ms without (Pitfall 8 predicted about 35 ms) |
| 3 | digit check before space check | Killed: "space wins over digit" |
| 4 | no trim in `checkLetters` | Killed: trimmed, blank, only tabs and newlines, and more (4 failures) |
| 5 | `toNfc` returns its input | Killed: 6 failures (NFC composition, e + acute, length after normalisation) |
| 6 | seed: drop Zl and Zp from the forbidden set | Killed: interior line separator, interior paragraph separator |
| 7 | `SEED_MAX_LENGTH` 65 | Killed: constants test, "65 units", surrogate-pair count |
| 8 | `upperFirst` slices one code unit (breaks astral letters) | Killed: sharp s and astral test |
| 9 | fallback regex drops leading marks | Killed: "does not drop a leading mark in the fallback" |

### euphony.ts

| # | Mutation | Result |
|---|----------|--------|
| 1 | Plan: collapse three identical letters into two before the walk | Killed (9 failures): insert-only and injectivity properties, "has no collapse rule" (`kttt` vs `ktt`), idempotence, the linear-run test and others |
| 2 | Plan: insert the fill only after a chunk that is followed by more consonants | Killed (3 failures), but NOT by the `pbzx -> pbuzxi` vector as the plan predicted: for `pbzx` the closing-vowel rule appends the same `i`, so that vector still passes. The mutant is killed where the closing rule does not fire (a last chunk of two identical consonants): `tttt -> ttatta`, `kttt -> ktatta` and the 200,000-letter run length test. The pbzx vector is kept as specified |
| 3 | drop the closing-vowel rule | Killed: `gleiaoung` vector, the "ends in two different consonants" test and the matching property |
| 4 | y is not a vowel | Killed (9 failures; the output contains a NUL fill) |
| 5 | inserted vowel always lower case | Killed: case tests, the per-consonant table in upper case |
| 6 | fill of x changed from i to a | Killed: `pbzx`, `zxskr`, `zxpb` vectors and the per-consonant table |
| 7 | inert: trailing run allowed up to 2 | Killed: examples, regex oracle comparison, join-unchanged property |
| 8 | inert: leading run allowed up to 2 | Killed: same three |
| 9 | inert: internal run allowed up to 3 | Killed: same three |
| 10 | no ASCII-letter guard | Killed: all non-ASCII no-op cases (9 failures) |
| 11 | runs of exactly 3 copied unchanged | Killed (5 failures) |
| 12 | closing-vowel comparison case-sensitive | Killed: "regardless of case" test |

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.text.test.ts engine/test/naming.euphony.test.ts --project engine`: 2 files, 127 tests passed (84 + 43).
- `npx cross-env CCRUG_TZ=UTC vitest run --project engine` (whole engine project, includes `guard.test.ts`): 34 files, 975 tests passed (848 before this plan plus 127).
- `npx tsc -p engine/tsconfig.json --noEmit` and `npx tsc -p engine/tsconfig.test.json --noEmit`: exit 0.
- `npm run lint`: exit 0 (the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`, not touched).
- `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten).
- Acceptance greps: `export const SOUND_MAX_LENGTH = 16`, `NAME_MAX_LENGTH = 32`, `SEED_MAX_LENGTH = 64` and `EUPHONY_VERSION = 1` each once; `\p{L}[\p{L}\p{M}]*` present (the header comment and the regex); the euphony test file contains `eiaoungugla` and `mnamtan` and not `DEMON_NAMES`; a node check finds no Cf and no non-ASCII or control character in any of the four new files; `Math.random|Date.now|new Date(|Math.(sin|cos|pow)` prints nothing in `engine/naming/text.ts` and `euphony.ts`.
- Speed of `smoothName` (Node 22, strip-types harness, 221,445 random 4 to 11 letter joins, consonant-heavy): median 55.6 ms, 0.25 us per join (research measured 0.20 us).
- `git diff --stat 6fe9e44 HEAD`: exactly the four new files. `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty (no frozen oracle touched); `engine/naming/banks.ts` untouched; no digest pinned.
- `npm run test:swap` and `npm run verify` were not run: this plan adds only new engine and test files, no `app/` file, no build input and no frozen oracle changed. The whole-engine, typecheck, lint and repo-guard checks above cover the surfaces it can affect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's behaviour list] A seed with a trailing line or paragraph separator**
- **Found during:** Task 1 (writing the seed tests)
- **Issue:** The behaviour list says `'a' + U+2028 -> null` and `'a' + U+2029 -> null`, while the action says to trim first and then reject Cc, Zl and Zp. `String.prototype.trim` strips U+2028 and U+2029 (and `\n`) at the ends, so `'a' + U+2028` trims to `'a'`, a valid seed. Rejecting it would also contradict the useful case of a pasted seed with a trailing newline (`'abc\n'` -> `'abc'`).
- **Fix:** Followed the action (trim, then check). The tests assert the refusal for an interior separator (`'a' + U+2028 + 'b'` and the U+2029 and `\n`, tab, NUL, DEL and C1 equivalents -> null) and assert that edge separators are trimmed like any other edge whitespace (`LS + 'a'` -> `'a'`, `'abc\n'` -> `'abc'`, a seed that is only a separator -> null).
- **Files modified:** `engine/test/naming.text.test.ts`
- **Committed in:** `d3c33b5`

**2. [Rule 1 - Bug] The regex fallback dropped a leading combining mark**
- **Found during:** Task 1
- **Issue:** The plan's fallback `/\P{M}\p{M}*/gu` skips any marks that precede the first non-mark (`'U+0301' + 'a'` would split into `['a']`), so `splitGraphemes` could lose text when `Intl.Segmenter` is missing. The validators never reach it with such input (the letters rule rejects a leading mark first), but `splitGraphemes` is exported.
- **Fix:** `/\P{M}\p{M}*|\p{M}+/gu`, which gives the same split on every sample the plan names and loses nothing; a test and a mutant (text.ts mutant 9) pin it.
- **Files modified:** `engine/naming/text.ts`, `engine/test/naming.text.test.ts`
- **Committed in:** `4b32047`, `d3c33b5`

**3. [Plan expectation corrected] The Pitfall 8 mutant is killed, not green**
- The acceptance text says removing the `t.length > max &&` fast path "keeps tests green". The behaviour list requires that the Segmenter is used only for strings longer than the limit, so the tests count Segmenter calls and kill that mutant. Timings are recorded as asked (0.67 ms with the fast path, 36.3 ms without, for 4,000 sounds).

**4. [Plan expectation corrected] The `pbzx -> pbuzxi` vector does not kill the "fill only before more consonants" mutant**
- See euphony mutant 2: the closing-vowel rule appends the same vowel, so that mutant is invisible on that vector. It is killed by the identical-pair and long-run tests added for it. No behaviour of euphony@1 changed; the vector table is exactly Appendix B.

**5. [Test examples] Two hand-computed ad hoc examples were wrong and were corrected**
- `abgl` was written as an example of "ends in two different consonants", but its run `bgl` has three consonants, so the rule gives `abgul` (chunk `bg` plus the fill of `g`, then `l`). `ekkle` was written as an inert sound with an internal run of two, but `kkl` is a run of three. The module was right in both cases (all 12 Appendix B vectors passed throughout); the examples became `agl -> agla`, `abgl -> abgul`, `ekke` (inert) and `ekkle` (not inert). Corrected in the Task 2 GREEN commit `d24ca01`.

**6. [Session break]** The first session ended after the Task 2 RED commit with `euphony.ts` written but unverified; the continuation session re-ran the tests, found the two wrong examples above, committed the GREEN and ran all mutation and verification steps.

---

**Total deviations:** 2 auto-fixed items (one plan inconsistency, one hardening), 3 expectation corrections, 1 session break.
**Impact on plan:** None changes an exported name, a vector or a result the plan specified; no scope creep.

## Issues Encountered

- A write tool turns typed backslash-u and some backslash-x escapes into the real characters, which put a stray Cyrillic letter and a raw control range into a first draft of the euphony test. They were replaced by plain ASCII literals before the RED commit, and the node check above (no non-ASCII, Cf or control character in any new file) guards it.
- `String.prototype.trim` treats U+FEFF (a Cf character) as whitespace, so a BOM at the very start or end of a sound is trimmed away (the stored text is clean) and an interior BOM is reported as 'space'. No Cf character survives into a validated sound; this is pinned by a test row.

## Known Stubs

None. Both modules are complete. Messages are deliberately not built here: the engine returns reasons and plan 07-11 owns the UI copy.

## Threat Flags

None. The plan adds only pure engine modules and tests: no endpoint, auth path, file or storage access and no schema at a trust boundary. The two register entries are mitigated as planned: T-07-03 (the letters-and-marks rule refuses every Cf character and controls, seeds refuse Cc, Zl and Zp, NFC first, so visually equal text compares equal) and T-07-18 (only anchored single character-class regexes over strings the callers already bound, and smoothing is a linear char-code walk, tested with a 200,000-letter run).

## TDD Gate Compliance

Both tasks followed RED then GREEN as separate commits: `test(07-02)` `d3c33b5` before `feat(07-02)` `4b32047`, and `test(07-02)` `5ea4fe5` before `feat(07-02)` `d24ca01`. Both RED runs failed on the missing module. No refactor commit was needed.

## Next Phase Readiness

- Plan 07-05 (naming contract and resolver) and later plans can import `validateSound`, `validateName`, `normalizeSeed`, `upperFirst`, `smoothName`, `smoothingInert` and the three limits from `engine/naming/text.ts` and `euphony.ts`. `engine/index.ts` is deliberately not extended here; the barrel arrives with 07-05.
- The certificate plan can use `smoothingInert` as research condition B; condition A (no a, u or i in any sound) is the caller's check.
- No blocker.

## Self-Check: PASSED

- All four created files exist and are tracked (`git ls-files engine/naming/text.ts engine/naming/euphony.ts engine/test/naming.text.test.ts engine/test/naming.euphony.test.ts`).
- All four task commits exist (`d3c33b5`, `4b32047`, `5ea4fe5`, `d24ca01`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `app/` file and not `engine/naming/banks.ts` was touched.
