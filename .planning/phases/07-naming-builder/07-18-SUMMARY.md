---
phase: 07-naming-builder
plan: 18
subsystem: viewer-naming-session
tags: [naming, viewer, history, undo-redo, hydration, preview, autosave, localstorage, url-names, naming-context, e2e, mutation-testing, typescript, playwright]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-13 (session rules, slot, NamingContext), 07-09 (the names= link codec and ShareState.names), 07-11 (limits and copy), 07-15 (displays that read useNaming), 07-16 (the Selection demon editor), 07-07 (the live panel stack)
  - phase: 06-canvas-tier-and-worker
    provides: the worker swap and resetForBaseSwitch that the naming now joins
provides:
  - app/NumogramClient.tsx owns one NamingSession per displayed base and provides NamingContext at every render tier (SVG, Canvas, headless)
  - naming edits in the undo/redo history keyed by a monotonic revision, restored with an announcement and a single-changed-zone hint; a short undo depth for namings over the override limit
  - base switch (synchronous commit and worker swap) loading the saved slot or the default in the same batch; a pending debounced write flushed first
  - hydration of the saved slot (bare URL included) and of a names= link with the preview rule (SVG bases in the hydration effect, worker bases in the swap); a loaded naming is never an undo entry for the naming
  - ShareState.names = the link form of the displayed naming; autosave (400 ms debounce, pagehide flush, first edit only, never in preview or above the ceiling)
  - app/lib/historyHydration.ts (historySnapshotKey, withHydratedNaming, singleChangedZone) with 17 tests and 10 mutants
  - e2e/demons-browser.spec.ts and e2e/demons-matrix.spec.ts rewritten from the engine's names; e2e/names-session.spec.ts (11 tests)
affects: [07-20, 07-21, 07-22, 07-23, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One commit helper (commitSession) moves a ref first and the state second, so an action reads the latest committed session and reports a change by comparing two session objects; no flag is ever read back out of a state updater"
    - "The history key skips the naming and reads only its revision; a naming that arrives by LOAD is adopted into the previous snapshot once (a flag consumed on the render where the revision changes), and the rewritten snapshot is stored back in the ref, because the key-equal path returns without touching it"
    - "A debounced write keeps its pending naming in a ref so the two events that would lose it (a base switch, pagehide) write it at once; the timer checks it is still the pending one"
    - "A behavioural spec seeds localStorage with an init script built from the engine's own serializer, so a saved slot of any shape is tested without the Names panel"

key-files:
  created:
    - app/lib/historyHydration.ts
    - tests/app/historyHydration.test.ts
    - e2e/names-session.spec.ts
    - .planning/phases/07-naming-builder/deferred-items.md
  modified:
    - app/NumogramClient.tsx
    - e2e/demons-browser.spec.ts
    - e2e/demons-matrix.spec.ts

key-decisions:
  - "The history snapshot is taken by the existing history effect from the rendered state, so the 07-13 note 'take the snapshot BEFORE keepPreview' needs no special code: while previewing, snapshotNaming returns the SAVED naming, so the ref already holds it when Keep arrives (Keep is one entry, Back none)"
  - "Hydration adopts only the NAMING fields (historyNamingAdoptRef, withHydratedNaming, stored back in historyCurrentRef) instead of removing the whole post-load entry, because the frozen behaviour baseline records Undo enabled after ?layout=labyrinth, ?layout=ladder and ?layout=planetary loads; the first-run history branch and the null-previous branch are unchanged"
  - "A base switch needs no adopt flag: resetForBaseSwitch already nulls historyCurrentRef, so the history effect takes the swap render as its new start; the flag is only for mount-time hydration. A bare URL with no saved slot commits nothing and sets no flag"
  - "A pending slot write is flushed before a base switch reads the slot (flushPendingSave in resetForBaseSwitch) and on pagehide; without it an edit made less than the debounce before a base switch was lost (found while writing the effect; mutant C proves the test)"
  - "The first URL sync is normally only a record of the opening URL; it now also writes the address when the displayed naming has a link form and the URL carries no names= (a restored slot with a non-default seed), so the address always names the displayed naming (D-13). Fresh visitors have no slot, so no frozen state changes"
  - "namingCtx.undo goes through onUndoRef so the context value does not change with every history entry (the displays that search or list names do not re-render for an undo-stack change)"
  - "The bare-URL slot read uses sessionRef.current.base (the base the page opened on) rather than a typed 10; no ceiling and no preset base is typed anywhere in the diff (acceptance grep for 4000 is 0)"
  - "namesOpen is declared and opened by a link preview but not read until 07-21 mounts the panel; one eslint-disable-next-line with the reason carries it (07-21 removes the comment when it reads the value)"
  - "singleChangedZone is exported from app/lib/historyHydration.ts (the plan lists two exports there) so it is tested and mutated; additive"

patterns-established:
  - "A mutation run found two weak helper tests (a sound changed with no lock change, and tables of different length whose common part differs in one zone); both were added before the final run, 10 of 10 killed"

requirements-completed: []  # NAM-01 to NAM-04 stay Pending at the orchestrator's phase gate: the session, history, slot restore, URL link and autosave are observable and proved, but the Names panel and the Share title arrive in 07-21 and the full gate in 07-25

# Metrics
duration: about 1h20min since the resume (the first session was cut off by a usage limit with no commits; first commit 54c7c2b to the last 353d835, including 3 test:swap runs and 9 mutation builds)
completed: 2026-11-10
---

# Phase 7 Plan 18: Viewer Naming Session, History, Hydration and Autosave Summary

**The viewer now holds one naming session per displayed base and provides it at every render tier: renames show in the browser NAME column, matrix tooltip, Selection and pinned background at every base, join undo and redo by revision, are kept per base across base switches and reloads (a bare URL included), a names= link opens as an unsaved preview over a different saved slot, and the address and the autosave follow the displayed naming, proved by 11 browser tests, 9 e2e mutants and 10 helper mutants.**

## Performance

- **Tasks:** 3 of 3 (Task 2 as a RED commit and a GREEN commit), plus two follow-up test commits
- **Files created:** 4 (a lib module, its unit test, the session spec, the deferred-items log); 3 modified
- **`$PLAN_BASE`:** `931c48439740e950bb245dbd7e1ee14fb8ed285f`

## Accomplishments

- **Session and provider (Task 1).** `NAMING_ENV` takes the ceiling from the tier table and the preset by reference; `revRef`/`nextRev`, `namingSession`, `sessionRef` (assigned on every render and moved first by `commitSession`), and the panel flags (`namesOpen`, `namesSaved`, `namesAnnouncement`, `namesRestored`). `applyNaming` is `applyNamingAction(sessionRef.current, ...)` and returns false when the same session object comes back; `keepNaming`/`revertNaming` call the 07-13 rules. `namingCtx` is built once per change (resolver and `hasUncarriedEdits` memoised on the working naming) and declared above `onShareExplanation`; `<NamingContext.Provider>` wraps the whole tree with no `hasDiagram` guard.
- **History (Task 1).** `HistorySnapshot` gained `naming` and `namingRev`, taken from `snapshotNaming(namingSession)`; the key is `historySnapshotKey` (JSON without the naming); `applySnapshot` restores the naming when the revision differs, computes the single changed zone and sets `restored` (tick plus zone) and the `Names restored from history.` announcement; a naming over 5,000 overrides keeps 8 undo entries.
- **Base switch (Task 1).** `resetForBaseSwitch(nextDemons, nextBase)` commits `sessionForBase(nextBase, readSlot(...), null, ...)`, clears the saved line and the announcement, after flushing a pending write; both callers pass the base.
- **Hydration (Task 2).** Bare URL: the slot of the opening base is read and committed with the adopt flag set (no slot, nothing committed, no flag). Query load at an SVG base: `sessionForBase(state.base, readSlot, state.names, ...)`, adopt flag, `namesOpen` once when it is a preview. Worker base: the same commit inside `applyHydratedState` (no flag; the swap's reset nulls the history ref). The history effect consumes the flag on the render where the revision changes: `withHydratedNaming(previous, current)` stored back in `historyCurrentRef`, so nothing is pushed when only the naming changed (Undo stays disabled after a bare-URL restore) and a layout load still pushes its one frozen post-load entry, now carrying the loaded naming.
- **URL and autosave (Task 2).** `names: linkFormOf(namingSession.working, NAMING_ENV)`; the first URL sync also writes it when the address lacks `names=`. Autosave is an effect on the session: `autosaveWanted` gate, a 400 ms timer, the pending naming in a ref, a `pagehide` flush, `setNamesSaved(writeSlot(...))`.
- **Tests (Task 3).** The two pre-naming e2e specs are rewritten from the engine's names; `e2e/names-session.spec.ts` has 11 tests (below).

## Task Commits

1. **Task 1: session state, history, base switch, actions and provider** - `54c7c2b` (feat)
2. **Task 2: hydration with preview, adopt flag, URL names and autosave**
   - RED: `1f77036` (test) the helper test failing on the missing module
   - GREEN: `507328d` (feat) `historyHydration.ts` and the NumogramClient wiring
3. **Task 3: the two rewritten specs and the session spec** - `27b646b` (test)
4. Follow-ups: `0938424` (test) the short undo depth proof; `353d835` (test) two helper tests added after the mutation run

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and deferred-items.md (hash in the final report).

## e2e assertions changed, and why

- `e2e/demons-browser.spec.ts`: `other bases keep an empty NAME column` is replaced by `other bases show generated names in the NAME column (Phase 7 D-03)`. Every base now carries a naming, so at base 28 each of the first rows' NAME cell must equal `createNameResolver(defaultNamingFor(28, env), preset).nameOf(a, b)` (the net-span from the row's mesh via `netSpanOf`), be non-empty with an upper-case first letter, and no `[data-name-overridden]` exists. The base-10 `Lurgo` and `Ummnu` assertions are unchanged (counts 1 and 1).
- `e2e/demons-matrix.spec.ts`: `cellText` now builds `A::B · Name · MESH · Subtype` with the engine's name for the base's default naming, cut at `NAME_TOOLTIP_GRAPHEMES` with an ellipsis like the matrix cuts it. The two pre-naming literals are gone: the base-28 hover literal (`c::3 · 69 · Cyclic chrono`) was removed as redundant with the next `cellText(g, 12, 3, 28)` assertion, and the base-666 literal (`15::3 · 108 · Cross-Torque chrono`) likewise (the following `cellText(g, 15, 3, 666)` line already asserts it). Every other assertion already called `cellText`. Nothing is skipped.
- `e2e/names-session.spec.ts` (new, chromium-utc, 1280 x 800), 11 tests: (a) rename 12::3 from the Selection editor at base 28, shown in Selection and the browser cell with the overridden marker, Undo restores the engine name, Redo returns `Zed`; (b) autosave lands in the slot, base 30 clears history and shows its own default, back at base 28 the cell shows `Zed` and Undo stays disabled; (c) a fresh `goto('/numogram/?base=28')` restores `Zed` and Undo (the post-load entry belongs to base 10 and is refused) leaves it; (d) a bare `goto('/numogram/')` restores the base-10 slot with the URL still bare, Undo disabled, then one layer toggle and one Undo leave `Zed` in place and in the slot, and Reset to CCRU name returns `Lurgo`; (e) `?layout=labyrinth` leaves Undo enabled (frozen) and its Undo leaves the naming alone; plus a base switch within the debounce still saving, `names=` written to the address for a restored slot of another link form (bases 28 and 10), a `names=` link over a different saved slot previewed without touching the slot (bases 28 and 666, the latter through the worker swap), and the short undo depth of a naming over the override limit (base 102). None uses the browser's own reload.

## Mutation Checks

Each e2e mutant was applied by a scratchpad script that refuses a find text not present exactly once or a no-op, rebuilt the export, ran the named spec tests in the foreground, restored the source from a saved copy and checked `git diff --quiet app/NumogramClient.tsx` (clean after every run); one at a time, none in the background. All 9 were **killed**:

| Mutant | Killed by |
|---|---|
| A: the no-query branch no longer sets the adopt flag | the bare-URL test (Undo enabled after the restore) |
| B: the consume branch no longer stores the rewritten snapshot in `historyCurrentRef` | the bare-URL test (Undo after the layer toggle brings back the default name) |
| C: a base switch no longer flushes the pending write | the quick-switch test |
| D: autosave always writes (no first-edit, preview or ceiling guard) | both preview tests (the slot is overwritten) |
| E: a heavy naming keeps the normal undo depth | the short-depth test (13 steps instead of 8) |
| F: the worker swap no longer commits the hydrated naming | the base-666 preview test |
| G: the first URL sync never writes `names=` | both address tests |
| H: undo and redo no longer restore the naming | the rename, undo, redo test |
| I: a query load at an SVG base never reads the slot | the fresh-load and the layout-load tests |

Helper mutants (10 against `tests/app/historyHydration.test.ts`): key without the replacer, key dropping the revision, `withHydratedNaming` keeping the previous naming, keeping the previous revision, taking everything from current, `singleChangedZone` ignoring locks, ignoring sounds, returning the last of several changed zones, without the length check, returning zone 0 for none. The first run killed 8; the two survivors (ignoring sounds, the missing length check) exposed two weak tests, both added (a sound that differs with no lock difference; tables of different length whose common part differs in one zone), and the re-run killed 10 of 10. Not behaviourally testable until 07-21: whether a link preview opens the Names panel (`setNamesOpen(true)` has no reader yet) and the Keep/Back buttons.

## Verification Results

- `MSYS_NO_PATHCONV=1 npm run test:swap` (build, the 60 DOM goldens and 5 behaviour specs, then the unit suite): exit 0 after each task (three runs): 65 Playwright passed and 5 skipped by design, 116 files and 3,833 unit tests after Task 1, 117 files and 3,848 after Tasks 2 and 3 (the helper test then grew by two to 17). `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` empty; the behaviour baseline still records Undo enabled after the labyrinth, ladder and planetary loads.
- The plan's five specs on the final clean build: 40 passed (names-session 11, demons-browser 12, demons-matrix 6, demons-focus 6, hover-pin 5), 40 skipped for the New York project. Every other e2e spec was also run in two batches against the same sources: 65 passed and 96 passed, no failure (no other spec needed a change).
- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/historyHydration.test.ts --project oracle` and the same under `America/New_York`: 17 tests passed.
- `npm run typecheck` (root tsc including the e2e files, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task; the only lint output is the pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx`. `node scripts/check-repo.mjs` (all 11 gates incl. `base-ten`, `lore`, `goldens`, `lf`) OK.
- Acceptance greps: all as the plan states except two arithmetic or wording slips of the plan, recorded under deviations.
- **`npm run check:weight` FAILS** after this plan: `/numogram/` jsGzip 260,596 against a limit of 258,168 (baseline 245,874). At the plan base `931c484` the same check passes (measured by building that source), so the growth is this plan's: NumogramClient now imports the naming engine (generator banks, validator, serializer), the slot, the CCRU preset and the copy. The baseline was NOT edited: plan 07-24 raises it only through `update --reason` once the Names panel is mounted (07-21 adds more). `npm run verify` will stop at the weight step until then.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A base switch within the debounce lost the edit**
- **Found during:** Task 2 (designing the autosave effect: its cleanup clears the timer when the session changes)
- **Issue:** an edit made less than 400 ms before a base switch was never written, and the slot is read back right after the switch.
- **Fix:** the pending naming lives in `pendingSaveRef`; `flushPendingSave` runs at the start of `resetForBaseSwitch` and on `pagehide`; the timer callback writes only if its naming is still the pending one.
- **Files modified:** `app/NumogramClient.tsx`. **Commit:** `507328d`. Proved by the quick-switch test and mutant C.

**2. [Rule 2 - Missing critical functionality] The address did not carry a restored slot's link form on load**
- **Found during:** Task 2 (the first URL sync only records the opening URL)
- **Issue:** `?base=28` plus a saved slot with a non-default seed showed the slot's names while the address carried no `names=`, against the must-have "the URL always reflects the displayed naming's link form (D-13)".
- **Fix:** the first sync also writes the address when the displayed naming has a link form and the URL has no `names=`; every other first sync stays a record only (fresh visitors have no slot, so no frozen state changes).
- **Files modified:** `app/NumogramClient.tsx`. **Commit:** `507328d`. Proved by the two address tests and mutant G.

### Plan-level refinements

1. `singleChangedZone` lives in `app/lib/historyHydration.ts` (exported, 9 tests) instead of inside the client.
2. `namingCtx.undo` goes through `onUndoRef` (the plan allows it only for a declaration-order problem; here it keeps the context value stable).
3. The bare-URL slot read uses `sessionRef.current.base`, not a typed 10.
4. `namesOpen` is declared now (a link preview opens it) with one `eslint-disable-next-line` and a reason, because nothing reads it until 07-21.
5. The plan's acceptance `grep -c "NAMING_AUTOSAVE_DEBOUNCE_MS" app/NumogramClient.tsx` = 1 cannot hold (the import and the use are two occurrences); the comment was reworded so the count is the minimum, 2. The plan's `git diff ... | grep -c "test.skip\|test.fixme"` = 0 finds two hits, both unified-diff hunk headers that quote the unchanged `test.beforeEach(... test.skip(...))` line; no added or removed line contains it (`git diff -U0 ... | grep -c '^[+-].*test\.\(skip\|fixme\)'` is 0).
6. Extra e2e tests beyond the plan's five cases (quick switch, two address tests, two preview tests, the short undo depth) because each pins a behaviour a mutant showed untested.

**Total deviations:** 2 auto-fixes (both Rule 2), 6 refinements. None changes the shape of the plan's contracts.

## Issues Encountered

- **Pre-existing history bug (not fixed, logged).** An edit made right after an Undo or Redo is not recorded: the effect returns on key equality BEFORE the `historyApplyingRef` branch, so the flag stays set and swallows the next change; the Redo stack is not cleared and Undo jumps a step. Present at the plan base `931c484`; found with a throwaway probe (rename `Aaa`, `Bbb`, Undo, `Ccc`: Redo still enabled, a second Undo shows the original name). Not specific to the naming (two layer toggles do the same). The frozen behaviour baseline may encode today's behaviour, so the fix needs a decision: details, repro and a suggested one-line move are in `.planning/phases/07-naming-builder/deferred-items.md`.
- A `?base=28` load still leaves its pre-existing post-load entry (a base-10 snapshot); Undo on it is refused by `applySnapshot`'s base check and the naming is untouched (test c). Unchanged behaviour.
- One scripting slip: a `sed` expression with `\`` (a GNU anchor) prefixed every line of the new spec with a backtick; it was repaired by a node script before any commit and the spec typechecks and passes.

## Known Stubs

None. `namesOpen` is state with no reader until 07-21 mounts the panel (documented, one lint exemption); `namingCtx.announcement` has no live carrier until then either.

## Threat Flags

None beyond the register. T-07-17d: autosave is refused for previews and before a first edit, and a link over a differing saved slot opens as an unsaved preview (the base-28 and base-666 tests and mutant D). T-07-08c: every slot read goes through `readSlot`, whose validator turns garbage into the default. T-07-20c: the key never visits the naming (a hostile object whose fields throw is accepted by the key test) and a naming over the limit keeps 8 entries (mutant E). T-07-11: the naming is loaded inside the single batched reset for the commit and the swap, the actions read `sessionRef`, and `applySnapshot` refuses another base. T-07-13e: `test:swap` with no `-u`, base 10 defaults to CCRU so every baseline name is unchanged.

## TDD Gate Compliance

Task 2 followed RED then GREEN with separate commits: `test(07-18)` `1f77036` (failing on the missing module) before `feat(07-18)` `507328d`. Tasks 1 and 3 are not marked `tdd` in the plan (the viewer wiring has no node test seam; the browser specs of Task 3 are its proof, each with a killed mutant). No refactor commit was needed.

## Next Phase Readiness

- **07-20 (next):** inserts the collision report at the block 9 comment of `NamesPanel`; it reads `useNaming()` (now provided) and mounts `DemonNameEditor` with `context="collision"`.
- **07-21:** `namingCtx` is declared above `onShareExplanation` and exposes `uncarried` and `announce`; read `namesOpen` and remove the `eslint-disable-next-line` above its declaration; mount `<NamesPanel ...>` with `open={namesOpen}`; `namesRestored.tick` bumps on every undo or redo; `rev` changes on every committed change and restore; `apply` returns false for refusals; the inline Undo calls `undo()` (through the ref). The sounds pass-through and the Share title are also 07-21; a link preview already sets `namesOpen` once.
- **07-24:** `check:weight` fails now (numbers above); settle it with `update --reason` after 07-21.
- **Decision for the orchestrator:** the pre-existing history bug in `deferred-items.md` (fix now, schedule, or leave); not a blocker for 07-20 to 07-25.

## Self-Check: PASSED

- All four created files exist and are tracked or in the docs commit: `app/lib/historyHydration.ts`, `tests/app/historyHydration.test.ts`, `e2e/names-session.spec.ts`, `.planning/phases/07-naming-builder/deferred-items.md`; the three modified files are in the commits.
- All six task commits exist (`54c7c2b`, `1f77036`, `507328d`, `27b646b`, `0938424`, `353d835`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No golden, `e2e/__behaviour__`, `engine/` file, `engine/test/fixtures`, the signed-off vectors or banks, `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/` file or `reference/` file was touched (`git diff --name-only 931c484 HEAD` lists exactly the six code and test files above).
