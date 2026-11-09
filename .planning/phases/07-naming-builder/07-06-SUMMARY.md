---
phase: 07-naming-builder
plan: 06
subsystem: engine
tags: [contact-sheet, sign-off, syllable-banks, licensing, sha256-digests, euphony, mutation-testing, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-01 (the three draft syllable banks and the names-gen@1 generator) and plan 07-02 (euphony@1 and upperFirst) that the sheet renders
provides:
  - scripts/naming-sheet/build.ts and scripts/naming-sheet.ts, the pure deterministic contact sheet and its CLI (output under the gitignored /.review/)
  - the user-approved syllable banks (harsh revised once: no syllable equals a CCRU zone sound)
  - engine/test/naming.vectors.test.ts, 30 sound-table digests and 12 lazy samples pinned after the sign-off
  - tests/presets/naming-banks-lore.test.ts, a standing comparison of every syllable and generated table with the ten ZONE_PARTICLE strings
  - neutral inputs in every naming test (euphony vectors re-derived, edit, derive and text examples)
affects: [07-10, 07-11, 07-13, 07-17, 07-22, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A contact sheet before a pin: the look of generated data is a taste call, so a deterministic gitignored sheet is reviewed first and the digests are pasted as literals only after the user's reply (the Phase 3 precedent, repeated)"
    - "Licensing comparison by import: a test reads the lore strings from the lore file and compares them with the bank, so neither the engine nor the test ever quotes them"
    - "Re-deriving frozen vectors safely: an independent implementation written from the rule text is first proved on the old research-verified table and on a million random strings against the engine, then used to compute the new table; the old inputs are never committed"

key-files:
  created:
    - scripts/naming-sheet/build.ts
    - scripts/naming-sheet.ts
    - tests/presets/naming-sheet.smoke.test.ts
    - tests/presets/naming-banks-lore.test.ts
    - engine/test/naming.vectors.test.ts
  modified:
    - engine/naming/banks.ts
    - engine/naming/euphony.ts
    - engine/test/naming.euphony.test.ts
    - engine/test/naming.derive.test.ts
    - engine/test/naming.text.test.ts
    - engine/test/naming.edit.test.ts

key-decisions:
  - "The user approved the style character of all three banks as shown (harsh reads CCRU-flavoured, soft and syllabic are readable aloud, smoothing stays a no-op for soft and syllabic with its caption)"
  - "The user chose to DROP the eight verbatim CCRU zone sounds from the harsh bank (NOTICE section 3 excludes the CCRU lore from the MIT licence that covers engine/); they are replaced in place by other consonant-only leaves of the same lengths: sdr pdd lkk mnn (3 letters) and kd xg gb tb (2 letters). None is a fragment of a canonical demon name"
  - "Approval date: 2026-11-09 (the revised harsh bank approved after round 1; the soft and syllabic banks approved in the same sitting)"
  - "The user chose to RE-DERIVE the twelve pinned euphony vectors with neutral inputs, so no CCRU zone sound or canonical-name string remains as a test input in engine/ or the naming tests; the euphony@1 rules and version are unchanged"
  - "The lore comparison test lives in tests/presets/, not engine/test/: the engine lint forbids importing from app/, and the engine must stay lore-free"

patterns-established:
  - "Bank edits are in place and keep sizes (80/67, 60/66, 64/78), so the generator limit, the longest sound and every generate-test expectation stay as they were"

requirements-completed: []  # NAM-01 stays Pending: the editable zone table, locks UI, autosave and import/export that make it observable arrive in plans 07-13 to 07-23

# Metrics
duration: about 35min active (three sessions of work around two user checkpoints, 2026-11-09)
completed: 2026-11-09
---

# Phase 7 Plan 06: Style-bank Contact Sheet, Sign-off and Digest Pin Summary

**A deterministic contact sheet of the harsh, soft and syllabic sounds and demon names, the user's sign-off in two rounds (the harsh bank revised to drop the eight verbatim CCRU zone sounds), a standing test that no syllable or table equals a ZONE_PARTICLE string, the euphony vectors re-derived with neutral inputs, and 30 sound-table digests plus 12 lazy samples pinned after the approval.**

## Performance

- **Duration:** about 35 min of active work, split by two user checkpoints (the plan is `autonomous: false`)
- **Started:** 2026-11-09T21:57:49Z
- **Completed:** 2026-11-09T22:25Z
- **Tasks:** 3 of 3 (Task 2 was the user checkpoint, answered in two rounds; a third user decision added the euphony re-derivation)
- **Files created:** 5; **modified:** 6
- **`$PLAN_BASE`:** `cdf049c993b1dacd54c7d75cf4e450dddf9fe106`

## Accomplishments

- `buildNamingSheet()` renders three styles x seeds `ccrug` and `hollow-vector` x bases 10, 28, 64, 666 and 4000: zone grids (leading 64 zones, plus 16 evenly spaced and the last 4 above 64), 24 demon names per base (12 lowest mesh numbers, then 12 spread) raw and smoothed side by side with inserted vowels marked, shape statistics over up to 400 names, `smoothingInert`, and lazy samples at zones 65535, 1048576 and 67108863. The output is 161,469 bytes (sha256 prefix 08ee872c19a8, byte-identical on every run), self-contained, with no script and no network reference, and was opened in headless Chromium with no console error.
- The user's sign-off was collected at a blocking checkpoint and recorded below. The harsh bank was revised once: eight leaves replaced in place, bank sizes unchanged (80 internal and 67 leaf), so the generator limit (2,779,058,227) and the longest sound (15 letters) did not move and no generate-test expectation changed.
- Sound length and vowel-density statistics of harsh are identical before and after the revision; the doubled-letter share of harsh sounds rose from about 1.5 percent to about 3 to 5 percent (the originals have about 11), because three of the new leaves have a doubled letter.
- `tests/presets/naming-banks-lore.test.ts` compares every internal and leaf syllable, every depth 1 and depth 2 sound, and every generated table (3 styles x 2 seeds x 5 bases) with the ten ZONE_PARTICLE strings read from the lore file by import. Measured: 0 hits in all 30 tables, and 0 of the ten appear in any harsh table; before the revision the harsh tables held between 0 and 8 of them.
- The twelve euphony vectors were re-derived with neutral consonant inputs of the same shapes (see Euphony vector re-derivation); every other naming test example that was a zone sound, a base-10 raw join or a canonical name is neutral too.
- `engine/test/naming.vectors.test.ts` pins 30 sha256 digests and 12 exact lazy samples from the approved banks, with the approval date in its header and the failure message "changed; this needs a new contact-sheet sign-off, not a test update".

## Task Commits

1. **Task 1: contact sheet builder, CLI and smoke test** - `df8757a` (feat); STATE note `92f52f1` (docs)
2. **Task 2: user sign-off on the banks (blocking checkpoint)**
   - Round 1 answers applied: `67e3002` (fix) bank revision, the lore test, the sheet note; `d2aef5a` (test) neutral examples; STATE note `f85d427` (docs)
   - Euphony re-derivation (a further user decision): `7411b2a` (test)
3. **Task 3: pin the signed-off sound tables** - `fb00ada` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Checkpoint Rounds and the User's Answers

**Round 1.** The checkpoint put the contact sheet (`.review/naming-sheet.html`) and five questions to the user: (1) open the sheet; (2) does harsh read as CCRU-flavoured consonant clusters, and are more doubled-letter leaves or vowels wanted; (3) are soft and syllabic readable aloud, given that smoothing is a no-op for them; (4) are the harsh smoothed names acceptable as a convenience; (5) the harsh bank held eight of the ten CCRU zone sounds verbatim as generic leaves, so keep them or drop them given NOTICE section 3. The user's replies: the style character of all three banks is approved as shown ("Approve all three as shown"), and the eight verbatim sounds are to be dropped ("Drop them and use other consonant clusters").
- Applied: the eight leaves were replaced (four 3-letter, four 2-letter) by sdr pdd lkk mnn and kd xg gb tb, in the same list positions. Each replacement was checked against prefix-freeness, against the ten zone strings and against all 45 canonical names (not a substring of any).
- Measured on the revised harsh bank (seed `ccrug`, same definitions as the sheet): sounds length 2 / mean / 3 unchanged at bases 10, 28 and 64; doubled-letter share of sounds 0.0 / 0.0 / 4.7 percent at bases 10, 28 and 64 (0.0 / 0.0 / 1.6 before); raw-name vowel density 0.0 percent and smoothed 31 percent unchanged.

**Round 2.** The checkpoint asked only "Approve the revised harsh bank?". The user replied "Approve the revised bank". Approval date for the pin: 2026-11-09. A further decision at the same point: re-derive the twelve pinned euphony vectors (and every other test input that is a zone sound or canonical-name string) with neutral inputs ("Re-derive them with neutral inputs").

## Euphony Vector Re-derivation (Task 2 follow-up)

- A separate regex implementation of the euphony@1 rule text (07-02-PLAN action and 07-RESEARCH Pattern 4) was written fresh in the session scratchpad, outside the repo. It matched all twelve research-verified original vectors and the engine on 1,000,000 random strings (0 differences), which proves it right; it then computed the expected outputs for the new inputs and agreed with the engine on every one. The old inputs were used only for that proof and are not committed.
- The twelve new vectors keep the shapes of the originals: 2+3 and 3+2 runs of five, 2+2 runs of four, a doubled letter inside and at the end of a run, a leading and a trailing cluster around five vowels with the closing vowel, a run of four after vowels, and x as the last letter of a chunk (so the x fill is pinned by a vector). Case, y, triple-letter, linear-run, non-ASCII and inertness examples are neutral too. The version string stays euphony@1, every property test is kept.
- Each new input was checked by script against the ten zone strings and all 45 canonical names (comparison only): no zone sound, no piece of 3 or more letters from a name, no adjacent consonant pair that occurs in a name.
- A final script scan of `engine/`, `scripts/` and the naming tests finds no zone sound or canonical name used as an input. What remains is deliberate and documented: two lore sentinel names in `scripts/worker-chunks.mjs` (a detector that must FAIL if base-10 lore leaks into the worker chunk), a two-letter SVG class and filter id for the gate label in `engine/scene/svgString.ts`, its test and `scripts/spike/harness.mjs` (a coincidence with one of the ten ZONE_PARTICLE strings, unrelated to it), and a few generic bank syllables that happen to be 3-letter fragments of names (informational; the approved banks were not touched again).

## Files Created/Modified

- `scripts/naming-sheet/build.ts`, `scripts/naming-sheet.ts` - the sheet and its CLI; `NAMING_SHEET_BASES`, `NAMING_SHEET_SEEDS` and `LAZY_SAMPLE_ZONES` are also exported
- `tests/presets/naming-sheet.smoke.test.ts` - 9 tests: determinism, 6 sections x 5 bases, raw and smoothed tables, lazy samples equal the generator, 24 names per base, no script or `http`, below 2,000,000 bytes, no canonical name in any table cell
- `tests/presets/naming-banks-lore.test.ts` - 10 tests (the lore comparison)
- `engine/naming/banks.ts` - the eight harsh leaves replaced in place; a comment records the rule (no syllable equals a CCRU zone sound)
- `engine/naming/euphony.ts` - one comment reworded (no code change)
- `engine/test/naming.euphony.test.ts`, `naming.derive.test.ts`, `naming.text.test.ts`, `naming.edit.test.ts` - neutral inputs
- `engine/test/naming.vectors.test.ts` - 30 digests, 12 lazy samples, two count tests

## Decisions Made

See `key-decisions` above.

## Mutation Checks

Each mutant was applied by a script to a saved copy, the suite was run in the foreground under a timeout, and the file was restored from the saved copy and diffed against HEAD (identical each time).

**Lore comparison test.** Putting one of the removed zone sounds back into the harsh bank: killed by 3 of its 10 tests (syllable equality, depth 1 and 2 sounds, generated tables).

**euphony.ts against the NEW vectors** (`engine/test/naming.euphony.test.ts`, 43 tests):

| Mutation | Result |
|----------|--------|
| drop the closing rule | Killed (3 tests) |
| x fill i -> a | Killed (2 tests: the x vector and the per-consonant table) |
| collapse three equal letters before the walk | Killed (9 tests) |
| closing comparison case-sensitive | Killed (1 test) |
| leftover single consonant also gets a fill | Killed (14 tests) |
| run threshold 2 -> 1 | Killed (9 tests) |
| fill of the first consonant of a chunk | Killed (15 tests) |
| inserted vowel always lower case | Killed (3 tests) |

**banks.ts against the digests** (`engine/test/naming.vectors.test.ts`, 44 tests): swapping the first two internal syllables of harsh failed 4 pinned entries, of soft 5, and swapping the first two leaves of syllabic failed 8. Every swap fails at least one digest.

No survivors (see Issues Encountered for the one invalid mutant that looked like a survivor).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming.vectors.test.ts engine/test/naming.generate.test.ts --project engine`: 2 files, 95 tests passed (44 + 51). The same files plus the euphony test under `America/New_York`: 138 passed.
- Whole engine project (`vitest run --project engine`, includes the guard test): 37 files, 1093 tests passed (1049 before the vectors file).
- `tests/presets/naming-sheet.smoke.test.ts` and `naming-banks-lore.test.ts` (`--project oracle`): 19 tests passed.
- `npm run typecheck` (four tsc runs and lint) exits 0; the one lint warning, in DemonMatrix.tsx, was already there.
- `node scripts/check-repo.mjs`: OK, including base-ten, lore and goldens. `git status --porcelain .review e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty; no file under `reference/` was touched; no `-u` or snapshot update was run anywhere.
- Acceptance greps: `export function buildNamingSheet` once; "contact-sheet sign-off, not a test update" present; the count test asserts 30 entries.
- `npm run test:swap` and `npm run verify` were not run: this plan adds scripts, tests and a bank edit in `engine/`, and changes no `app/` file, no build input and no frozen oracle. The engine, typecheck, lint and repo-guard runs above cover the surfaces it can affect.

## Deviations from Plan

### Auto-fixed and user-directed changes

**1. [User decision] The eight verbatim CCRU zone sounds were dropped from the harsh bank**
- **Found during:** Task 2 (the licensing question the plan put to the user)
- **Change:** as described under Round 1. The plan's note text ("The harsh bank contains 8 of the CCRU clusters ...") and its smoke-test assertion were reworded to say the bank no longer contains the verbatim zone sounds.
- **Files:** `engine/naming/banks.ts`, `scripts/naming-sheet/build.ts`, `tests/presets/naming-sheet.smoke.test.ts`
- **Commit:** `67e3002`

**2. [Rule 2 - Missing critical functionality] A standing licensing test**
- **Issue:** nothing prevented a future bank edit from reintroducing a zone sound.
- **Fix:** `tests/presets/naming-banks-lore.test.ts` (placed under `tests/presets/` because the engine lint forbids imports from `app/`). The comparison reads the lore file by import and never quotes the strings.
- **Commit:** `67e3002`

**3. [User decision] Neutral test inputs across the naming tests**
- **Change:** the zone-sound, base-10-join and canonical-name examples in the derive, text, edit and euphony tests became neutral strings with hand-derived expectations; the twelve Appendix B euphony vectors were re-derived (plan 07-02 had pinned them as the research table).
- **Commits:** `d2aef5a`, `7411b2a`

**4. [Presentation] Extra exports and statistics in the sheet builder**
- `NAMING_SHEET_BASES`, `NAMING_SHEET_SEEDS` and `LAZY_SAMPLE_ZONES` are exported (the plan listed only `buildNamingSheet`), and the statistics table also reports raw and smoothed name length and doubled-letter share.

---

**Total deviations:** 2 user-directed changes, 1 hardening addition, 1 presentation choice.
**Impact on plan:** the bank content changed once by the user's choice; exported names, bank sizes, capacity and every generate-test expectation are unchanged. No scope creep beyond the user's answers.

## Issues Encountered

- **An invalid mutant looked like a survivor.** The first run of the "collapse three equal letters" mutant reported 43 of 43 passing. The mutation script had lost its backslashes through the shell heredoc, so the injected regex matched nothing and euphony.ts was unchanged. The mutant was rebuilt with the backslash made by `String.fromCharCode(92)` and killed by 9 tests (table above). The file was restored and diffed against HEAD.
- **A literal-extraction scan mis-paired quotes.** The first throwaway scan of string literals used a shared global regex and skipped alternate lines; it was replaced by a per-line match. Only scan scripts were affected.
- The harsh digests were computed from the revised banks only after the user's second approval; no digest ever existed for the unrevised banks.

## Known Stubs

None. The three banks, the sheet, the digests and the lazy samples are complete.

## Threat Flags

None. The plan adds dev-only scripts (gitignored output), tests, and a data edit inside `engine/`; no endpoint, auth path, storage access or schema at a trust boundary. The register entries are mitigated as planned: T-07-15 (blocking checkpoint, approval date 2026-11-09 in the digest test header and here), T-07-01b (30 digests and 12 samples with a header forbidding updates), T-07-12b (output gitignored; the smoke test checks that no canonical name appears in any table cell).

## Next Phase Readiness

- The banks and `names-gen@1` are frozen by digests: any later change to a bank, the depth rule, the permutation or the PRNG fails a pinned entry and needs a new sign-off and a new generator id.
- Plans 07-08 onward can rely on `STYLE_IDS`, the approved banks and `DEFAULT_SEED 'ccrug'`. NAM-01 remains Pending until the editable table and import/export land.
- Open for later review: `07-VALIDATION.md` rows 07-06-T1 to T3 are still marked pending by hand-edited convention (the phase gate plan 07-25 closes them); the manual row 1 outcome is recorded here.

## Self-Check: PASSED

- All created files exist and are tracked: `scripts/naming-sheet/build.ts`, `scripts/naming-sheet.ts`, `tests/presets/naming-sheet.smoke.test.ts`, `tests/presets/naming-banks-lore.test.ts`, `engine/test/naming.vectors.test.ts`.
- All task commits exist (`df8757a`, `92f52f1`, `67e3002`, `d2aef5a`, `f85d427`, `7411b2a`, `fb00ada`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file and no `app/` file was touched; `.review/` is untracked.
