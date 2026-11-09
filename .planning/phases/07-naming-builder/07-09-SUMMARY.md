---
phase: 07-naming-builder
plan: 09
subsystem: app-url-codec
tags: [naming, url-codec, share-params, label-scheme, worker-guard, fast-check, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (engine barrel exports StyleId, isStyleId, DEFAULT_STYLE, JoinOrder, Smoothing, normalizeSeed, SEED_MAX_LENGTH) and plan 07-07 (live panel stack; NumogramClient already edited once)
  - phase: 06-canvas-tier-and-worker
    provides: the worker request guard (isWorkerRequest, isLabelScheme) and resultKey that the sounds mode has to pass
provides:
  - app/lib/namesLink.ts, the naming's link form (NamesLink, NAMES_PARAM_MAX_LENGTH, CCRU_LINK_BASE, parseNamesLink, writeNamesLink, sameNamesLink)
  - ShareState.names (null by default and omitted from every existing URL), parsed outside the natural-tier guard so a seed link survives above the ceiling without building a numogram
  - labels=sounds, a fourth LabelScheme member (parse, format, key, no alphabet, digit labels in every existing slot) and its acceptance in the worker guard
  - 53 new app tests (41 in shareParamsNames.test.ts, 12 across labelScheme, workerCore and shareParams) plus the extended round trips
affects: [07-11, 07-12, 07-13, 07-16, 07-18, 07-21]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One allow-listed URL codec: a new param pair is a small module (namesLink.ts) with parse and write, called from parseShareParams and buildShareParams; null writes nothing, so every existing URL stays byte for byte"
    - "Hostile-text screen BEFORE trim: control and separator characters are tested on the raw value, because String.trim() strips U+2028, U+2029 and the common controls at the edges and would hide them"
    - "A union member and the worker guard branch land in the same commit (research Pitfall 5); a protocol mutant that drops the branch fails three tests"

key-files:
  created:
    - app/lib/namesLink.ts
    - tests/app/shareParamsNames.test.ts
  modified:
    - app/lib/shareParams.ts
    - app/lib/labelScheme.ts
    - app/lib/worker/protocol.ts
    - app/NumogramClient.tsx
    - tests/app/shareParams.test.ts
    - tests/app/labelScheme.test.ts
    - tests/app/workerCore.test.ts

key-decisions:
  - "names= refuses control characters (Cc) and line or paragraph separators (Zl, Zp) anywhere in the raw value, tested before trimming; the plan's literal trim-first algorithm would read 'seed:a<U+2028>' as seed 'a', contradicting its own behaviour list and the must-have truth (see Deviations 1)"
  - "A link without names= expresses no naming (the visitor's saved slot or the base default is shown); the default naming of a base is written as no param (canonical form computed by the session in 07-13)"
  - "Companions (nstyle, njoin, nsmooth) are read only together with names=seed:; names=ccru ignores them"
  - "names=seed: means names-gen@1 forever; a future generator needs a new prefix (orchestrator decision 8)"
  - "Toggling sounds at a Canvas base triggers one worker rebuild (resultKey includes the label key); normalising it away is unsafe (research Pattern 7)"
  - "currentShareState passes names: null until plan 07-18 connects the naming session, so no URL carries names= yet"

patterns-established:
  - "A mutant that a plan names but the code makes unkillable (the 65-character seed is also refused by normalizeSeed) is replaced by a test that does kill it (exact length-bound padding case), and the substitution is recorded"

requirements-completed: []  # NAM-03 and NAM-01 stay Pending: the codec and label mode exist, but nothing in the app writes names= or offers the Sounds option until plans 07-12, 07-18 and 07-21; the orchestrator marks them at the phase gate

# Metrics
duration: ~16min
completed: 2026-11-09
---

# Phase 7 Plan 09: names= Link Codec and the labels=sounds Mode Summary

**The single URL codec now carries a naming as a preset or a seed only (`names=ccru` at base 10, or `names=seed:<seed>` with lenient `nstyle`, `njoin=lh`, `nsmooth=1`, kept above the interactive ceiling with no numogram built), and `labels=sounds` is a fourth label mode that round-trips, keeps digit zone labels everywhere, and passes the worker guard, with 17 mutants killed (two equivalent survivors recorded) and every existing URL unchanged.**

## Performance

- **Duration:** about 16 min (two RED and two GREEN commits, two `npm run test:swap` runs of about 3 min each, 19 mutation runs)
- **Completed:** 2026-11-09
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 2 (`app/lib/namesLink.ts`, `tests/app/shareParamsNames.test.ts`); 7 modified
- **`$PLAN_BASE`:** `6315f265c11178f8942bb408d99bf41eda3fb03b`

## Accomplishments

- **Codec (`namesLink.ts`).** `parseNamesLink(params, base)` reads `names`: a raw value longer than `NAMES_PARAM_MAX_LENGTH` (`SEED_MAX_LENGTH + 13` = 77) is `null` before anything else runs; any control, line-separator or paragraph-separator character anywhere in the raw value is `null`; then trim; `ccru` is `{ kind: 'ccru' }` at base 10 only (`CCRU_LINK_BASE = 10`) and `null` elsewhere; `seed:` plus a seed accepted by the engine's `normalizeSeed` (NFC, trim, 1 to 64 UTF-16 units) is a seed link whose style, join and smoothing come from `nstyle` (exact `isStyleId`), `njoin=lh` and `nsmooth=1`, each falling back to its default without dropping the seed; everything else is `null`. The raw text is only compared with fixed prefixes and handed to `normalizeSeed`; it is never an object key (a `__proto__`, `constructor` or `toString` seed is plain data and the link is an ordinary object). `writeNamesLink` writes nothing for `null`, `names=ccru` alone for the preset, and `names=seed:<seed>` plus each companion only when it is off its default. `sameNamesLink` compares by value.
- **Codec wiring (`shareParams.ts`).** `ShareState` gained `names: NamesLink | null` (default `null`); `parseShareParams` calls `parseNamesLink(params, base)` OUTSIDE the natural-tier guard (a seed-only naming is exactly what survives above the ceiling and reading it needs no numogram); `buildShareParams` calls `writeNamesLink(params, state.names)` before `sortedParams`. `NumogramClient.currentShareState` passes `names: null` with the 07-18 comment, so the page writes no `names=` yet and the 40-URL baseline corpus round-trips unchanged.
- **Above the ceiling.** The tests run `?base=4002` (`INTERACTIVE_MAX_N + 2`) and `?base=67108864` (2^26) with `names=seed:x&nstyle=soft&njoin=lh&nsmooth=1`: the link is kept and the `vi.mock` spy on `createNumogram` records zero calls; `region=` in the same link is still dropped. `names=` alone never builds a numogram at any base.
- **`labels=sounds`.** `LabelScheme` gained `{ mode: 'sounds' }`: `parseLabelScheme('sounds')`, `formatLabelScheme` and `labelSchemeKey` both `'sounds'`, `schemeAlphabet` null, and `formatZoneLabel` and `zoneLabelsFor` return the digit labels exactly as `digits` does (at bases 2, 10, 28, 40, 66 and 202; `formatZoneLabel(12, 28, sounds)` is `'c'`). The parse is exact (`Sounds`, `sound`, `sounds ` and `sounds:x` fall back to digits). `isLabelScheme` in `protocol.ts` accepts `sounds` in the same commit; a request with `{ mode: 'sounds' }` is accepted, `handleRequest` answers `built` (not `build-failed`) at base 28, 202 and 4000, echoes the scheme, builds a text identical to the digits text, and its `resultKey` (`28:ring:shelf:sounds`) differs from the digits key. The codec's fast-check round trip now includes `sounds` among the label schemes.
- **Tests.** `shareParamsNames.test.ts` (41 tests: grammar, companions, hostile values, the exact length bound at 77 and 78, prototype-key seeds, write, `sameNamesLink`, a 576-run seed round trip over `&`, `=`, `%`, `+`, `:`, `?`, `#`, quotes, CJK, Devanagari, emoji and a musical symbol, the 64-unit extremes, `ShareState.names`, the ceiling spy); the existing `shareParams.test.ts` literal gains `names: null`, its arbitrary gains a names field (`ccru` only at base 10) and `parse(build(state))` is asserted for it at bases 2, 10, 12, 28 and 64; `labelScheme.test.ts` gains a `sounds mode` block (6 tests) and extends the round-trip and key tests; `workerCore.test.ts` gains the key, guard and Canvas-base cases and two near-miss rejections (`Sounds`, `sound`).

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: namesLink codec and ShareState.names**
   - RED: `64aeae8` (test) failing tests (the module did not exist; the extended state literal and round trip failed)
   - GREEN: `c305352` (feat) `namesLink.ts`, the `shareParams.ts` wiring and the `names: null` line in `NumogramClient.tsx`
2. **Task 2: labels=sounds in the label scheme and the worker guard**
   - RED: `3edd82c` (test) 13 failing tests across `labelScheme`, `workerCore` and `shareParams`
   - GREEN: `c475b4d` (feat) the union member, every formatter branch and the `protocol.ts` branch

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Decisions Made

See `key-decisions` above. The four `[default]` decisions the plan named are implemented as written; the control-character screen on the raw value is the one refinement (Deviations 1).

## Mutation Checks

Each mutant was applied with a scratchpad script (it refuses a mutant that is not found exactly once or is a no-op), the test files ran in the foreground under a 150 s timeout, the source was restored from a saved copy, and `git diff --quiet <file>` confirmed the restore (all `restored-clean`). The first two rows of each table are the ones the plan lists.

Task 1 (`shareParamsNames.test.ts`, plus `shareParams.test.ts` for the last-but-one):

| File | Mutation | Result |
|------|----------|--------|
| shareParams.ts | `names = aboveCeiling ? null : parseNamesLink(...)` (parse inside the ceiling guard) | Killed: 2 tests (the base 4002 and 2^26 cases) |
| namesLink.ts | drop the `raw.length > NAMES_PARAM_MAX_LENGTH` bound | Killed: 1 test (the exact-bound padding case) |
| namesLink.ts | bound off by one (`>=`) | Killed: 1 test (value of exactly 77 characters is read) |
| namesLink.ts | hostile check after the trim | Killed: 3 tests (U+2028, newline and tab at the edge) |
| namesLink.ts | `names=ccru` honoured at any base | Killed: 2 tests |
| namesLink.ts | `nstyle` taken unchecked | Killed: 11 tests |
| namesLink.ts | seed not passed through `normalizeSeed` | Killed: 4 tests (NFD, trim, 65 units, empty) |
| namesLink.ts | `njoin` written for the default order | Killed: 6 tests |
| namesLink.ts | `sameNamesLink` ignores smoothing | Killed: 1 test |
| shareParams.ts | `writeNamesLink` call removed | Killed: 8 tests across both files |

Note on the plan's second named mutant: "dropping the length bound fails the 65-character case" is not true as written, because a 65-character seed is also refused by `normalizeSeed`, so that case passes with or without the bound. The bound only matters for padded values, so a test with `seed:` plus padding plus `ab` at exactly 77 and 78 characters (and `ccru` behind 77 spaces) was added; the mutant is killed by it. The 65-character case stays as the seed-length test.

Task 2 (`labelScheme.test.ts`, `workerCore.test.ts`, `shareParams.test.ts`):

| File | Mutation | Result |
|------|----------|--------|
| protocol.ts | remove the `sounds` branch of `isLabelScheme` | Killed: 3 tests (the `isWorkerRequest` case and both `handleRequest` cases) |
| labelScheme.ts | `formatZoneLabel` returns `'?'` for sounds | Killed: 2 tests |
| labelScheme.ts | `zoneLabelsFor` returns `'?'` for sounds | Killed: 1 test |
| labelScheme.ts | `formatLabelScheme` returns null for sounds | Killed: 9 tests |
| labelScheme.ts | `parseLabelScheme('sounds')` returns the default | Killed: 9 tests |
| labelScheme.ts | `labelSchemeKey` returns `'digits'` for sounds | Killed: 4 tests |
| labelScheme.ts | `schemeAlphabet` returns an alphabet for sounds | Killed: 1 test |
| labelScheme.ts | remove only the `|| scheme.mode === 'sounds'` of `formatZoneLabel` | **Survived, equivalent:** a sounds scheme then falls through to the final `formatNumeral`, which is the digit label anyway |
| labelScheme.ts | remove only the `|| scheme.mode === 'sounds'` of `zoneLabelsFor` | **Survived, equivalent:** it falls through to the numeral fallback of the alphabet path |

The two survivors are behaviourally identical to the code they replace: the explicit branches are kept for clarity and so a later change to that fall-through cannot silently alter the sounds mode, and the first two mutants above (which return a different label) show that the digit behaviour itself is pinned.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/shareParamsNames.test.ts tests/app/shareParams.test.ts tests/app/shareParamsHeadless.test.ts --project oracle`: 3 files, 107 tests passed. Task 2's three files (`labelScheme`, `workerCore`, `shareParams`): 146 passed. The five touched test files plus the headless spy file under `CCRUG_TZ=America/New_York`: 5 files, 197 passed.
- `MSYS_NO_PATHCONV=1 npm run test:swap` after Task 1: exit 0 (build, Playwright 65 passed including the 60 DOM goldens and the behaviour specs, then the unit suite: 104 files, 3095 tests). After Task 2: exit 0 (65 passed, 104 files, 3107 tests).
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint) after each task: exit 0 with no type error; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx` (not touched). TypeScript reported no non-exhaustive switch in `app/` for the new `sounds` member.
- `node scripts/check-repo.mjs` (all gates including `base-ten`, `lore`, `goldens`, `lf`): OK, with `app/lib/namesLink.ts` staged before the run.
- Acceptance greps: `names: parseNamesLink` or `const names = parseNamesLink(params, base)` 1, `writeNamesLink(params, state.names)` 1, `export const CCRU_LINK_BASE = 10` 1, `numRuns: 576` 1, `mode === 'sounds'` in protocol.ts 1, `'sounds'` in labelScheme.ts 8 (at least 4), `{ mode: 'sounds' }` in workerCore.test.ts 4.
- `git diff --name-only 6315f26 HEAD` lists exactly the nine files above; `git diff --name-only 6315f26 HEAD -- e2e engine app/presets app/components/numogram/Projection.tsx app/components/numogram/PairGraphProjection.tsx reference` is empty. No frozen oracle, no bank, no `engine/` file, no `Projection.tsx` and no base-10 preset was touched.
- `npm run verify` was not run: it is the phase gate at the end of Phase 7, and this plan's app edits are covered by two `test:swap` runs (build, the 60 DOM goldens, the behaviour baseline and the whole unit suite).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's trim-first parse would accept a trailing line separator**
- **Found during:** Task 1 (analysing the behaviour list before writing tests)
- **Issue:** The action says `t = raw.trim()` and then `normalizeSeed(t.slice(5))`, but the behaviour list and the first must-have truth require `names=seed:a%E2%80%A8` (and control characters) to fall back to no link. `String.prototype.trim()` strips U+2028, U+2029 and the common controls (tab, newline, carriage return) at the edges, and `normalizeSeed` trims again, so the literal algorithm reads that link as seed `a`. (Plan 07-02 recorded the same contradiction for `normalizeSeed` itself.)
- **Fix:** `parseNamesLink` tests the raw value against `/[\p{Cc}\p{Zl}\p{Zp}]/u` before trimming and returns null on any hit, at any position (a hostile value such as `ccru` plus a newline is refused too). Spaces still trim (`seed:  ab  ` is `ab`). A test pins both the edge and the inside cases, and a mutant that moves the check after the trim is killed by 3 tests.
- **Files modified:** `app/lib/namesLink.ts`, `tests/app/shareParamsNames.test.ts`
- **Commits:** `64aeae8` (tests), `c305352` (implementation)

**2. [Plan inconsistency] The named length-bound mutant is not killed by the named case**
- **Found during:** Task 1 mutation planning
- **Issue:** See Mutation Checks: the 65-character seed is refused by `normalizeSeed` regardless of the bound.
- **Fix:** Added the padded-value test at exactly 77 and 78 characters (and the `ccru` padding case) that does kill it; recorded above. No source change.
- **Commit:** `64aeae8`

**3. [Plan scope note] `labels=sounds` has no picker option yet**
- `LabelSchemeControls` (the label radio group) is not in this plan's file list, so a hand-edited `?labels=sounds` link applies the mode but shows no radio checked until the Sounds option arrives with the node label slot (07-12) and the Names panel wiring. Nothing breaks (digit labels stay), and no existing URL changes.

---

**Total deviations:** 1 bug avoided before it shipped, 1 plan inconsistency resolved with a stronger test, 1 scope note for later plans.
**Impact on plan:** none changes an exported name or contract; no scope creep.

## Issues Encountered

None blocking. The `mutate.mjs` helper refused one mutant (the `labelSchemeKey` replacement matched the identical `formatLabelScheme` text as well); its anchor was widened to start at the function signature and the mutant then ran.

## Known Stubs

None that block the plan goal. `names: null` in `NumogramClient.currentShareState` is the plan's intended placeholder: plan 07-18 connects the naming session and supplies the displayed naming's link form (until then no `names=` is written and no existing URL changes). The `sounds` label mode is accepted and round-trips, but no control offers it and the node label slot does not read the naming's sounds yet (07-12 and later).

## Threat Flags

None beyond the register. `names=` (T-07-07) is the only new trust-boundary input: length bound before processing, control and separator screen before trim, NFC and trim, `normalizeSeed`, fixed prefixes, lenient fallback to null, raw text never an object key, hostile-input tests. T-07-02c (no numogram for a link above the ceiling) is proved by the spy tests. T-07-14 (the worker guard accepts `sounds` in the same commit as the union member) is proved by the guard test and its mutant.

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-09)` `64aeae8` before `feat(07-09)` `c305352`, and `test(07-09)` `3edd82c` before `feat(07-09)` `c475b4d`. Each RED run failed as expected (the missing module in Task 1, 13 failing tests in Task 2) before its GREEN commit. No refactor commit was needed.

## Next Phase Readiness

- Plan 07-11 can assert `CCRU_LINK_BASE` against the CCRU preset's base; 07-13 (session) decides the canonical link form and uses `sameNamesLink`; 07-18 replaces `names: null` in `currentShareState` and handles the unsaved-preview behaviour for a link; 07-12 adds the node label slot that reads sounds when `labels` is `sounds`, and the label picker option.
- A link without `names=` expresses no naming; the session shows the visitor's saved slot or the base default.
- No blocker.

## Self-Check: PASSED

- Both created files exist and are tracked: `app/lib/namesLink.ts`, `tests/app/shareParamsNames.test.ts`; the seven modified files carry the edits listed above.
- All four task commits exist (`64aeae8`, `c305352`, `3edd82c`, `c475b4d`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `engine/` file, no `Projection.tsx` and nothing under `app/presets/base10/` was touched.
