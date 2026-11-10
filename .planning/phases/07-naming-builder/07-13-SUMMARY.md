---
phase: 07-naming-builder
plan: 13
subsystem: app-naming-state
tags: [naming, session, preview-adopt, autosave-slot, localstorage, link-form, naming-context, pure-rules, injected-storage, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (Naming, edit operations, createNaming), plan 07-08 (serializeNaming, validateNamingJson), plan 07-09 (NamesLink, sameNamesLink) and plan 07-11 (CCRU_NAMING_PRESET, NAMING_STORAGE_PREFIX)
  - phase: 06-canvas-tier-and-worker
    provides: INTERACTIVE_MAX_N read from the measured tier table (app/lib/tierBounds.ts)
provides:
  - app/lib/namingSession.ts, the pure naming session rules (NamingEnv, NamingSession, NamingAction with 13 action types, NamesPanelState, NextRev, defaultNamingFor, namingFromLink, linkFormOf, sessionForBase, applyNamingAction, keepPreview, revertPreview, snapshotNaming, restoreNaming, hasUncarriedEdits, namesPanelState, autosaveWanted)
  - app/lib/namingStorage.ts, the defensive per-base browser slot (StorageLike, browserStorage, slotKey, readSlot, writeSlot), read through the same validator as a file import
  - app/components/names/NamingContext.tsx, NamingContextValue, NamingContext (null default) and useNaming() that returns null outside a provider
  - 96 new tests (67 session, 29 storage and context), 55 mutants run against them
affects: [07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A session is a pure function of (slot, link): preview exactly when a slot exists and its link form differs from the link's; both forms are canonicalised through linkFormOf, so a link that spells out the defaults still equals a saved default-form slot"
    - "An action reducer returns the SAME session object for every refusal (preview, invalid value, dense-only action at a seed-only base, wrong-base import, edit that changes nothing), so the caller decides on a history entry and a slot write with one === comparison"
    - "The history snapshot of a previewing session is the SAVED naming, so Keep is one undoable entry and Back to my saved naming creates none, with no special case in the history code"
    - "Storage is an injected two-method interface; the browser getter, getItem and setItem are each guarded, and any failure reads as no slot or failed"
    - "A source-text assertion pins what behaviour cannot: no typed ceiling, no typed preset base, no typed key prefix, exactly one validator call"

key-files:
  created:
    - app/lib/namingSession.ts
    - app/lib/namingStorage.ts
    - app/components/names/NamingContext.tsx
    - tests/app/namingSession.test.ts
    - tests/app/namingStorage.test.ts
  modified: []

key-decisions:
  - "The plan's four [default] decisions are implemented as written: a link whose form equals the slot's opens the slot; snapshotNaming returns the saved naming while previewing; pending means a worker base switch in flight; an undo or redo restore marks the session edited so autosave rewrites the slot"
  - "applyNamingAction returns the same session when the engine edit changes nothing (resetting an absent override, saving a name equal to the layer below, pasting an empty list), not a new session with edited true: a no-op is not a user edit, so it neither creates a history entry nor causes a slot write, which is what the engine's own `===` contract for those edits is for"
  - "A paste is all-or-nothing over EVERY token of the list, including tokens past the last zone that the engine would drop: one bad token changes nothing (the plan says validate all)"
  - "Two sessions that open on the same naming (a slot, or no slot) share one revision for working and saved; a preview takes two, so the saved naming's history key differs from the previewed one and Back restores exactly the key that was current before"
  - "Beyond the plan, three defensive guards: sessionForBase ignores a saved naming of another base; restoreNaming refuses a naming of another base; an import is refused when its table shape (dense or seed-only) does not fit the session's base; writeSlot refuses a seed-only naming (D-11 at the storage layer too)"
  - "hasUncarriedEdits is not memoised: it is a field compare unless a dense table must be compared (one generateSounds, about 3 ms at 4000 zones), so the caller memoises it on the immutable naming (07-18)"
  - "useNaming never raises, and neither source file contains the word that a grep acceptance counts, so the comments say refuses or fails instead"

patterns-established:
  - "A mutation run is a check on the test, not only on the code: three runs found and fixed one weak test (a stray slot of ANOTHER base was ignored for the wrong reason at a seed-only base, so the ceiling check was untested)"

requirements-completed: []  # NAM-03 and NAM-01 stay Pending: the session, the slot and the context exist and are proved, but nothing imports them until NumogramClient wires them in 07-18 and the panel mounts in 07-21; the orchestrator marks them at the phase gate

# Metrics
duration: about 30min (start was not stamped; estimated from the first test run at 15:39Z and the build at the end)
completed: 2026-11-10
---

# Phase 7 Plan 13: Per-Base Naming Slot, Naming Session and NamingContext Summary

**The browser-side naming state is now three small pure modules: a session reducer where a shared link opens as an unsaved preview exactly when its link form differs from the saved slot and every action is refused while previewing, a per-base localStorage slot that reads through the import validator and treats every failure as no slot, and a null-default NamingContext, proved by 96 tests and 55 mutants (50 killed, 5 equivalent).**

## Performance

- **Duration:** about 30 min (estimate, see Metrics), including the mutation runs, three typechecks, two timezone runs, check-repo, build and the page-weight check
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 5 (3 modules, 2 test files); 0 modified
- **`$PLAN_BASE`:** `015b40f6c4a44148785b179bc417b6d63b20ed1b`

## Accomplishments

- **Session rules (`app/lib/namingSession.ts`).** `defaultNamingFor(base, env)` opens the preset base on the CCRU preset (the preset's base is `env.preset.base`, never typed) and every other base on the engine's default seed, `DEFAULT_STYLE` (harsh), `hi-lo` and smoothing 0; above the ceiling the table is null. `linkFormOf` compares fields only (it never generates sounds): null for every default naming and for a ccru naming, a seed link carrying all four settings otherwise, so a generated naming at the preset base always has a link. `sessionForBase(base, saved, link, env, nextRev)` is a pure function of (slot, link): no link gives the slot or the default; a link without a slot gives the link's naming; a link whose canonical form equals the slot's gives the slot; a link that differs gives the link's naming as an unsaved preview with the slot kept and its own `savedRev`. At a seed-only base any saved argument is ignored and there is never a preview. Nothing is edited at open, so nothing is written until the first edit.
- **Action reducer.** `applyNamingAction` covers all 13 action types (sound, paste, lock, seed, reroll, style, join, smoothing, source, override, reset-override, import, use-seed). While previewing it returns the same session for every type (proved by flipping only the `preview` flag on a session where each action is otherwise effective). Otherwise a changed naming gives `{ ...s, working, rev: nextRev(), edited: true }`. Refusals all return the same object: an invalid sound, seed, setting, override name or position (the engine's `RangeError`, caught; any other error is rethrown, proved with a malformed paste list), a dense-only action at a seed-only base, an import of another base or of a table of the wrong shape, and an edit that changes nothing.
- **History helpers.** `keepPreview(s, nextRev)` adopts the previewed naming (`saved = working`, edited, a new revision for both); `revertPreview` restores the saved naming under its own `savedRev` and leaves the session unedited; `snapshotNaming` returns the saved naming while previewing (so Keep is one undoable entry and Back creates none, proved on the key); `restoreNaming` leaves preview, marks the session edited and refuses another base. `hasUncarriedEdits` is true for a lock, an override or a dense table that differs from what its link form regenerates (so a typed sound followed by unlocking that zone stays true), false for every default and every seed, style, join or smoothing result, at the preset base too. `namesPanelState(base, s, env, pending)` is pending, then seed-only by the base alone, then preview, then ready; `autosaveWanted` is `edited && !preview && base <= ceiling`.
- **Slot (`app/lib/namingStorage.ts`).** `slotKey(28)` is `ccrug.naming.v1.28`, built from `NAMING_STORAGE_PREFIX`. `readSlot` guards the getter call and returns the naming only when `validateNamingJson` (the one validator, called once) accepts it for that base, ceiling and preset; a missing slot, `garbage`, a foreign or newer schema, a valid file of another base under this key, a text over `NAMING_IMPORT_MAX_BYTES`, a slot with one bad sound, a ccru slot where the environment has no preset, a non-text value, a throwing `getItem` and every base above the ceiling all read as null. `writeSlot` writes the compact export text and returns `'failed'` (never raises) without a storage, on a `QuotaExceededError`-like failure, and for a seed-only naming. `browserStorage()` is null on the server, when reading `window.localStorage` fails (a throwing getter on a stubbed `window`) and when the browser gives null.
- **Context (`app/components/names/NamingContext.tsx`).** `'use client'` first line, `NamingContextValue` exactly as the contract, `createContext<NamingContextValue | null>(null)` and `useNaming()` returning null outside a provider. A server render of a probe outside a provider gets `no-naming`, inside one it reads the value, so the seven existing view-context render tests and the headless path stay valid.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: namingSession (defaults, link forms, preview rule, action reducer, history helpers)**
   - RED: `87782be` (test) the session test failing on the missing module
   - GREEN: `9df5c72` (feat) `namingSession.ts` plus the test strengthened by the mutation runs (two tests added, one tightened)
2. **Task 2: per-base localStorage slot and the NamingContext**
   - RED: `edd12fc` (test) the storage and context test failing on the missing modules
   - GREEN: `2a758a1` (feat) `namingStorage.ts` and `NamingContext.tsx`

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/lib/namingSession.ts` - 280 lines
- `app/lib/namingStorage.ts` - 62 lines
- `app/components/names/NamingContext.tsx` - 44 lines
- `tests/app/namingSession.test.ts` - 67 tests; `tests/app/namingStorage.test.ts` - 29 tests

## Decisions Made

See `key-decisions`. The plan's four `[default]` decisions are implemented as written. The one that changes what a caller sees is that a no-op edit returns the same session (so 07-18's `apply()` returns false and records no history entry and no slot write for it). 07-18 also needs to know that `keepPreview` takes `nextRev` as a second argument, that the history snapshot for Keep must be taken before `keepPreview` is applied (it then reads the saved naming), and that `hasUncarriedEdits` should be memoised on the naming.

## Mutation Checks

Each mutant was applied by a scratchpad script that refuses a mutant not found exactly once or a no-op, ran the test file in the foreground under a 150 s timeout, restored the source from the saved copy, and checked `git diff --quiet <file>` (clean after every run; the sources were staged, so a stray edit would have shown).

**Task 1 (40 mutants against the green 67-test file).** The plan's two named mutants: inverting the preview comparison (`!sameNamesLink(...)`) is **Killed** by 8 tests; dropping the preview guard in `applyNamingAction` is **Killed** by the refusal test. The other 38, 37 **Killed**: the link form ignoring the style, join, smoothing or seed (4 mutants); a ccru naming getting a link; the preset applying to every base (this one by the module failing to load, because a module-level naming is built at base 28 with the ten preset sounds, which counts as a kill); the default ignoring the preset; a link without a slot opening the default; the preview's `savedRev` equal to `rev`; a no-op edit still editing; a `catch` that swallows every error; the source action allowed at a seed-only base; a paste that validates only the tokens that go in; use-seed forgetting the smoothing; an import of another base or of the wrong table shape accepted; reroll doing nothing; keep not marking edited or keeping the old revision; revert keeping the preview revision; the snapshot ignoring preview; restore keeping the preview flag, not marking edited, or accepting another base; the uncarried check ignoring locks, overrides, a typed sound, or comparing a ccru table with the generated one; the panel state with an exclusive ceiling, preview before seed-only, or pending ignored; autosave with an exclusive ceiling, with preview not refused, or needing no edit; a slot of another base accepted; a slot dropped at the ceiling itself.
- **A weak test found and fixed.** The first run left `slot read above the ceiling` alive: the stray slot in my seed-only test belonged to ANOTHER base, so it was ignored by the base check and the ceiling check was never exercised. The test now uses a stray slot of the very same seed-only base as well; the mutant is **Killed** by it (re-run, 1 failing, baseline 67 green).
- **One equivalent survivor.** Removing `'lock'` from the dense-only set survives: at a seed-only base the engine's `toggleLock` raises its own `RangeError`, which the reducer catches, so the explicit set is a second guard for `lock` (and necessary for `source`, whose generated branch the engine would apply, which is why that mutant IS killed).

**Task 2 (15 mutants against the green 29-test file).** The plan's mutant, removing the try/catch around `getItem`, is **Killed** by the throwing-storage case. 10 more **Killed**: `readSlot` ignoring the ceiling or with an exclusive ceiling, the validator getting no preset, no try/catch around `setItem`, a failed write reporting saved, the pretty form written, a seed-only naming written, the slot key with the base first, no try/catch around the `window` getter, and `useNaming` raising outside a provider. 4 **Survived as equivalent**: the validator given an infinite ceiling (the early guard in `readSlot` already returned for every base the validator would treat differently), removing the `typeof window` guard (the getter's own try/catch also catches the missing-window `ReferenceError` and returns null), returning `window.localStorage` without `?? null` (null in, null out), and removing the `text === null` check (the validator refuses a null as not a names file).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/namingSession.test.ts tests/app/namingStorage.test.ts --project oracle`: 2 files, 96 tests passed; the same under `CCRUG_TZ=America/New_York`: 2 files, 96 passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs` (all 11 gates including `base-ten`, `lore`, `goldens`, `lf`): OK, with the new files staged before the base-ten run.
- `npm run build` exit 0 and `npm run check:weight`: OK (2 routes, 30 golden states within tolerance); the working tree was clean afterwards.
- Acceptance greps: `export function sessionForBase` 1, `export function applyNamingAction` 1, `4000\|=== 10\b` 0 in `namingSession.ts`; `validateNamingJson(` 1 and `throw` 0 in `namingStorage.ts`; `createContext<NamingContextValue | null>(null)` 1 in `NamingContext.tsx`; `throw` 0 in `NamingContext.tsx`.
- `npm run test:swap` and `npm run verify` were NOT run: the plan only adds new files and edits no existing app file (nothing imports the three modules yet), so no bundle, no diagram and no golden can change; the plan's verify commands, typecheck, check-repo, build and the weight check are the proportionate gate. `git diff --name-only $PLAN_BASE HEAD` lists exactly the five files above, none under `e2e/`, `engine/`, `app/presets/base10/`, `app/components/numogram/Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `reference/`. No frozen oracle, bank or signed-off vector was touched.

## Deviations from Plan

### Auto-fixed Issues

None for Rules 1 to 3: the plan's contracts were implemented as written and the code worked on the first full test run.

### Plan-level refinements recorded under key-decisions

1. **A no-op edit returns the same session** (the plan's behaviour line says "otherwise a new session with edited true"). Resetting an absent override, saving a name equal to the layer below or pasting an empty list are not user edits, and the engine returns its argument for exactly those so the session can skip the history entry; a new session would write a slot for nothing. Tests: `returns the same session for an edit that changes nothing`.
2. **Paste validates every token**, including those the engine would drop past the last zone (the plan says validate all). Test: `refuses a paste with one bad token even when it lies past the last zone`.
3. **Four defensive guards not in the plan** (another base's saved naming, restore of another base, an import whose table shape does not fit, a seed-only naming at the writer). Each is a one-line refusal with a test and a killed mutant; none changes a contract.
4. **Tests added after the mutation runs:** the same-base stray slot at a seed-only base (above), the slot at the ceiling itself, and a malformed action proving only `RangeError` is refused quietly.

---

**Total deviations:** 0 auto-fixes, 4 refinements (all within the plan's intent).
**Impact on plan:** none changes an exported name or signature of the plan's contracts (the plan's `keepPreview` signature was not given; it takes `nextRev` second).

## Issues Encountered

None blocking. The first mutation run of Task 1 showed the weak seed-only slot test; fixed and re-run as described.

## Known Stubs

None. The modules hold no placeholder data; nothing imports them yet by design (07-14 onward, NumogramClient in 07-18).

## Threat Flags

None beyond the register. T-07-08b: a slot is read through the same validator as an import, and a wrong-base, oversized, foreign or corrupt slot is no slot (tests for each; mutants killed). T-07-09: the getter, `getItem` and `setItem` are each guarded and a quota failure returns `'failed'` (mutants killed). T-07-17: a link opens as a preview when its form differs from the slot, every action is refused while previewing, nothing is written before the first edit (`autosaveWanted`), and Keep is one undoable entry (the snapshot key test). T-07-20b: `snapshotNaming` and `restoreNaming` hold immutable namings that share their unchanged parts; the short undo depth for heavy namings belongs to 07-18.

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-13)` `87782be` before `feat(07-13)` `9df5c72`, and `test(07-13)` `edd12fc` before `feat(07-13)` `2a758a1`. Each RED run failed on the missing module before its GREEN commit. No refactor commit was needed.

## Next Phase Readiness

- 07-18 builds the session in NumogramClient: `sessionForBase(base, readSlot(browserStorage(), base, env), parseNamesLink(...), env, nextRev)` in the one batched reset, `applyNamingAction` behind `apply(action): boolean` (true exactly when the returned session differs), the history snapshot from `snapshotNaming` taken BEFORE `keepPreview`, `restoreNaming` on undo and redo, a debounced `writeSlot` (400 ms, flushed on `pagehide`) gated by `autosaveWanted`, and `hasUncarriedEdits` memoised on the naming. The `saved` field of `NamingContextValue` maps to the quiet save line: none before the first edit, saved or failed from `writeSlot`, preview, seed-only.
- 07-15 to 07-23 read `useNaming()` and must treat null as "no naming yet" (provider-less renders).
- No blocker.

## Self-Check: PASSED

- All five created files exist and are tracked: `app/lib/namingSession.ts`, `app/lib/namingStorage.ts`, `app/components/names/NamingContext.tsx`, `tests/app/namingSession.test.ts`, `tests/app/namingStorage.test.ts`.
- All four task commits exist (`87782be`, `9df5c72`, `edd12fc`, `2a758a1`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `engine/` file, no `Projection.tsx`, no `NumogramClient.tsx`, no `app/presets/base10/` file and no existing app file was touched.
