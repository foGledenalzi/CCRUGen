---
phase: 07-naming-builder
plan: 15
subsystem: app-name-displays
tags: [naming, render-time-names, overridden-marker, matrix-tooltip, demon-detail, pinned-background, live-name-search, provider-less-parity, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-13 (useNaming(), the null-default NamingContext), plan 07-11 (NAMES_COPY overridden strings, matrixTooltip, NAME_TOOLTIP_GRAPHEMES) and plan 07-05 (createNameResolver, nameOf, stateOf)
  - phase: 05-demons-layer
    provides: the demon browser, matrix, DemonInfo detail and the name search this plan extends
provides:
  - DemonRowList NAME cell read from the naming resolver at render time, with a post-baseline "overridden" marker span outside the truncating span (none for canonical or generated names)
  - DemonMatrix demonText(d, zoneLabel, name | null) (exported), cut at NAME_TOOLTIP_GRAPHEMES graphemes with an ellipsis, used by the hover tooltip and the keyboard live text
  - DemonInfo (both headings), the exported selectedInfoMeta(info, ctx, naming) and PinnedBackground resolve the demon name through the naming, never from the name baked into HoverInfo
  - demonSearch.ts optional nameOf on parseDemonQuery and resolveDemonSearch (type DemonNameOf), and DemonBrowser passing the displayed base's resolver
  - 39 new tests (26 render, 13 search) and 24 mutants run
affects: [07-16, 07-18, 07-21, 07-22]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A display reads the name through one guarded expression: the resolver only when `naming.base` equals the displayed base, else the legacy text, so a base switch in flight never asks a resolver for a zone outside its base and a provider-less render is byte for byte today's"
    - "A server render of a virtualized list is reached by replacing @tanstack/react-virtual with a fixed window in the test file (vi.mock), because a static render has no scroll element and renders no rows"
    - "A source-text assertion pins the one wiring a server render cannot reach (the hover tooltip needs a pointer, the browser's query box needs a user)"
    - "A search over live names loops the mesh space only inside the existing count cap and reads names through the resolver's own method, with no table and no per-demon array"

key-files:
  created:
    - tests/app/namesDisplayRender.test.ts
  modified:
    - app/components/demons/DemonRowList.tsx
    - app/components/demons/DemonMatrix.tsx
    - app/components/demons/DemonBrowser.tsx
    - app/components/info/InfoDisplay.tsx
    - app/components/info/PinnedBackground.tsx
    - app/lib/demonSearch.ts
    - tests/app/demonSearch.test.ts

key-decisions:
  - "Every display asks the naming only when `naming.base` equals the displayed base (the plan reads `naming?.resolver.nameOf(...) ?? baked` unguarded). 07-14 found that a switch in flight can show the old scene with the new naming, and nameOf raises a RangeError for a zone outside its base, which would crash the render. The fallback is the legacy text (baked name, `demonName(base, mesh) ?? ''`, or no name segment)"
  - "demonText and selectedInfoMeta are now named exports so the plan's behaviour lines (demonText(d, zoneLabel, name) equals matrixTooltip, selectedInfoMeta(info, ctx, naming).title) are tested directly; both are plain functions, nothing else about the modules changes"
  - "The NAME cell keeps its gridcell element untouched (role and data-col only). The name sits in an inline-block span (max-width 100%, or 100% minus 1.5ch beside a marker, vertical-align bottom) so `truncate` actually clips, with the full name in title and unicode-bidi plaintext; the marker is a sibling span after it"
  - "DemonBrowser's memo depends on the resolver's `nameOf` function, not on the whole context value: it changes exactly when the naming changes, so an unrelated context update (an announcement, the save line) does not re-run the up-to-50,000-name loop (the plan says `naming` in the dependencies)"
  - "parseLiveName treats a RangeError from nameOf (a naming that does not cover this numogram) as no name search (syntax), like a base without a table; any other error propagates. The old table path is untouched, byte for byte, when nameOf is absent"
  - "The hover tooltip keeps its text captured at pointer-move time (as before for zone labels): a rename or undo while the pointer rests on the matrix updates it on the next move, and the pointer leaving clears it. The keyboard live text and every other display are recomputed on each render"

patterns-established:
  - "When a plan's behaviour line names a plain function inside a component file, export it rather than test it only through markup the server render cannot reach"

requirements-completed: []  # NAM-02 and NAM-04 stay Pending at the orchestrator's phase gate: the displays, the marker and the search are built and proved, but no NamingContext provider is mounted until 07-18, so the app still renders as before

# Metrics
duration: about 28 min (start about 16:10Z, last task commit 16:35Z; includes two full test:swap runs of about 5 min each)
completed: 2026-11-10
---

# Phase 7 Plan 15: Render-Time Names in the Browser, Matrix, Detail and Pinned Background, and Live-Name Search Summary

**Every place that prints a demon name now reads it from the NamingContext resolver at render time (the browser NAME cell with a `*` and hidden ", overridden" for overridden names only, the matrix tooltip and keyboard text cut at 32 graphemes, both DemonInfo headings, the selected-item title and the pinned background), the name search matches the names the visitor actually sees within the existing 50,000-demon cap, and with no provider every display renders exactly as before (test:swap after each task: 60 DOM goldens and the behaviour baseline unchanged).**

## Performance

- **Duration:** about 28 min, including two full `test:swap` runs
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 1 (a test file); **modified:** 7 (5 app components, 1 lib, 1 existing test file, appended only)
- **`$PLAN_BASE`:** `285925b45f173b018ee9cb9de1db12e36ce41582`

## Accomplishments

- **Browser NAME cell (`DemonRowList.tsx`).** `const naming = useNaming()`, and a resolver only when `naming.base === base`. With a resolver the cell is `nameCell(resolver, d)`: a `truncate` span (inline-block, full name in `title`, `unicode-bidi: plaintext`) and, only for `stateOf === 'overridden'`, a sibling `<span data-post-baseline="" data-name-overridden="" title="Overridden name">*<span class="sr-only">, overridden</span></span>` (both strings from `NAMES_COPY`). Canonical (preset) and generated names carry no marker, so base-10 `Lurgo` stays exact text. Without a resolver the cell content is `demonName(base, d.mesh) ?? ''`, the same text node as before, and no attribute was added to the gridcell (a test pins `<div role="gridcell" data-col="name">`).
- **Matrix (`DemonMatrix.tsx`).** `export function demonText(d, zoneLabel, name | null)` builds through `matrixTooltip(netSpan, cutName(name), mesh, subtype)`; `cutName` keeps a name of at most `NAME_TOOLTIP_GRAPHEMES` graphemes whole and otherwise keeps the first limit minus one plus U+2026 (graphemes through `splitGraphemes`, so marks stay with their letter). Both call sites (hover tooltip, keyboard live text) pass the resolver name or null. The unused `SEP` constant went away.
- **Detail, selected title, pinned background.** `DemonInfo` reads `useNaming()` and uses one `name` for both `GlitchText` headings (lore and non-lore); `selectedInfoMeta(info, ctx, naming)` is exported and `InfoDisplay` calls `selectedInfoMeta(si, ctx, naming)`; `PinnedBackground` resolves the same way. The name baked into `HoverInfo` by `legacyDemon` is only the fallback (Pitfall 6). `legacyDemon`, `demonName` and `demonNameTable` are untouched, and `demonNames`, `demonState` and `demonsOverlayRender` tests are byte-identical.
- **Search (`demonSearch.ts`, `DemonBrowser.tsx`).** `parseDemonQuery(raw, g, nameOf?)` and `resolveDemonSearch(raw, g, filter, sort, nameOf?)`. With `nameOf`, `parseLiveName` returns syntax above `NAME_SEARCH_MAX_COUNT`, else loops meshes 0..count-1 through `netSpanOf` and `nameOf` (exact case-insensitive match beats an earlier prefix match, otherwise the lowest prefix mesh, else not-found). Without it the table path runs unchanged. `DemonBrowser` passes `naming.resolver.nameOf` when the naming's base is the displayed base, so `Lurgo` stops matching once base 10 shows generated names and matches again under the preset naming.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: render-time names in the browser cell, matrix text, demon detail, selected title and pinned background**
   - RED: `def8573` (test) 25 tests, 20 failing on the missing behaviour or export
   - GREEN: `6cbd3e3` (feat) the four components; the same commit adds the matrix call-site source assertion after a mutant survived
2. **Task 2: name search over live names**
   - RED: `d158143` (test) 8 of 11 new cases failing, the rest pinning behaviour that must not change
   - GREEN: `8440d79` (feat) `demonSearch.ts` and `DemonBrowser.tsx`; the same commit adds the exact-beats-prefix case and the browser wiring assertion

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/components/demons/DemonRowList.tsx` - `nameCell`, `useNaming`, guarded resolver
- `app/components/demons/DemonMatrix.tsx` - exported `demonText`, `cutName`, guarded `nameOf`, two call sites
- `app/components/info/InfoDisplay.tsx` - `demonNameFor`, `DemonInfo`, exported `selectedInfoMeta` with a third argument, the call site
- `app/components/info/PinnedBackground.tsx` - the pinned demon line
- `app/lib/demonSearch.ts` - `DemonNameOf`, `parseLiveName`, the optional parameter on two functions
- `app/components/demons/DemonBrowser.tsx` - `useNaming`, guarded `nameOf`, memo dependency
- `tests/app/namesDisplayRender.test.ts` (new, 26 tests); `tests/app/demonSearch.test.ts` (13 added, nothing removed or changed)

## Decisions Made

See `key-decisions`. The two a reviewer should look at: the base guard on every display (a deliberate addition to the plan's unguarded expression) and `demonText`/`selectedInfoMeta` becoming exports.

## Mutation Checks

Each mutant was applied by a scratchpad script that refuses a snippet not found exactly once or a no-op, ran the named test file in the foreground under a 150 s timeout, restored the file from a saved copy and compared the content with the original (identical every time). Baselines were green before each batch (26 and 49 tests).

**Task 1 (13 mutants, all Killed).** The plan's two: reading `d.name` instead of the resolver in `DemonInfo` is Killed by 3 tests (both branches and the InfoDisplay pass-through); marking `preset` names with `*` (`!== 'generated'`) is Killed by the CCRU case (1 test). Extras: the base guard removed in `demonNameFor` (2), `cutName` keeping the limit instead of limit minus one (2), `cutName` splitting by code units (1, the combining-mark case), `selectedInfoMeta` returning `info.demon.name` (1), `PinnedBackground` returning `d.name` (1), `unicode-bidi` dropped (1), the matrix resolver always null (2), the tooltip call site passing null (1, only the source assertion can see it; the first draft of the file let this survive, so the assertion was added), the row cell ignoring the resolver (6), the row-list base guard removed (1), and the `selectedInfoMeta(si, ctx, null)` call (1).

**Task 2 (11 mutants, all Killed; one more, swapping the nameOf arguments, is equivalent because the resolver orders its zones, and was not run).** `nameOf` ignored (9 failing), the count cap removed (1), an exact match no longer preferred over an earlier prefix match (1), the lowest prefix replaced by the last (2), every error swallowed (1), no error swallowed (1), `resolveDemonSearch` not forwarding `nameOf` (2), the browser base guard removed (1), the loop one mesh short (1, the last-mesh case), the lower-casing of names removed (9), the browser not passing `nameOf` (1).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app --project oracle`: 53 files, 1621 tests passed (52 files and 1582 tests before this plan); the two touched test files under `CCRUG_TZ=America/New_York`: 75 passed.
- Plan verify commands: Task 1 `tests/app` plus `npm run typecheck` exit 0; Task 2 `tests/app/demonSearch.test.ts tests/app/demonBrowserRender.test.ts` (51 passed at the time) plus typecheck exit 0. `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint) exit 0 on the final tree; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx` (line 227, not touched).
- `MSYS_NO_PATHCONV=1 npm run test:swap` after Task 1 (four app files edited): exit 0, build, 65 Playwright passed (3.1 min; the 5 skipped are the behaviour specs on the New York project, by design, so the 60 DOM goldens and the behaviour baseline are unchanged), 113 files and 3524 unit tests passed. After Task 2 (two more app files): exit 0, 65 passed (3.1 min), 113 files and 3538 unit tests passed.
- `node scripts/check-repo.mjs` (all 11 gates incl. `base-ten`, `lore`, `goldens`, `lf`): OK after each task. `npm run check:weight` after the Task 2 build: OK (2 routes, 30 golden states within tolerance); the demons chunk pulling `namingCopy.ts` in stays inside the budget.
- Acceptance: `grep -c data-name-overridden DemonRowList.tsx` 1; `grep -c 'role="gridcell" data-col="name">'` 1; `grep -c "selectedInfoMeta(si, ctx, naming)" InfoDisplay.tsx` 1; `useNaming()` counts 2 (InfoDisplay), 1 (DemonMatrix), 1 (DemonRowList), 1 (PinnedBackground), 1 (DemonBrowser); `grep -c NAME_TOOLTIP_GRAPHEMES DemonMatrix.tsx` 4; `grep -c nameOf demonSearch.ts` 10; `git diff --stat $PLAN_BASE -- tests/app/demonNames.test.ts demonState.test.ts demonsOverlayRender.test.ts demonRowListRender.test.ts demonMatrixRender.test.ts` prints nothing; `git diff $PLAN_BASE -- tests/app/demonSearch.test.ts | grep -c "^-[^-]"` is 0. `git diff --name-only $PLAN_BASE HEAD` lists exactly the 8 files above: no golden, behaviour baseline, engine file, signed-off vector or bank, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx`, `app/presets/base10/**` or `reference/` was touched.
- `npm run verify` was not run (the proportionate gate is the two swap runs, typecheck, check-repo and the weight check above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Every display only asks a naming of the displayed base**
- **Found during:** Task 1 (reading 07-14's summary for how a switch in flight behaves)
- **Issue:** The plan reads `naming?.resolver.nameOf(a, b) ?? baked` and passes `naming.resolver.nameOf` to the search. During a base switch the scene can be the old base's while the naming is the new one's; `nameOf` raises a `RangeError` for a zone outside its base, and an uncaught error in render crashes the tree.
- **Fix:** the resolver is used only when `naming.base` equals the displayed base (row list, matrix, DemonInfo, selectedInfoMeta, PinnedBackground, DemonBrowser); otherwise the legacy text. `parseLiveName` also turns a RangeError into no name search. Tests: a naming of another base in the row list, the matrix live text, `DemonInfo`, `selectedInfoMeta` and the search; mutants for each guard are killed.
- **Files modified:** all six app files
- **Commits:** `6cbd3e3`, `8440d79`

**2. [Rule 3 - Blocking] `demonText` and `selectedInfoMeta` had to be exported**
- **Found during:** Task 1 (writing the plan's behaviour lines as tests)
- **Issue:** both were module-private, and the hover tooltip and the selected-title path are not reachable from a server render (a pointer is needed, and `InfoDisplay` fills its selection list from an effect).
- **Fix:** both are named exports; nothing else about their modules changed.
- **Commits:** `6cbd3e3`

### Conflicts and additions recorded, not bugs

**3. [Plan detail] The browser's memo depends on `nameOf`, not on `naming`.** The resolver's `nameOf` changes exactly when the naming changes; the context value may change for unrelated reasons (announcement, save line), and each recompute is up to 50,000 name reads.

**4. [Test infrastructure] `@tanstack/react-virtual` is mocked in the new render test.** A server render has no scroll element, so the real virtualizer renders zero rows (the existing row-list test documents this); the mock returns up to 50 fixed items so the real `DemonRowList` wiring is what is rendered. It affects only that test file.

**5. [Addition] Two small things beyond the plan:** the inline-block and max-width style on the name span (so `truncate` clips and the marker is never hidden, as the UI-SPEC asks), and tests for exact-beats-prefix and for the source wiring of the two call sites the server cannot reach.

**Total deviations:** 1 missing-functionality guard, 1 blocking export, 3 recorded refinements. None changes an exported name of the plan's contracts.

## Issues Encountered

None blocking. One mutant survived the first Task 1 run (the tooltip call site passing null), which showed that no render could see it; the source assertion was added and the mutant re-run was Killed.

## Known Stubs

None in the files of this plan. One interim state is by design and tracked: no `NamingContext` provider is mounted until 07-18, so every display still renders as before in the app; the provider-aware paths are proved by render tests.

## Deferred and limits to know about

- **Name search matches ASCII letters only.** The `NAME_RE` gate (`^[a-z]{1,32}$`, case-insensitive) is unchanged by the plan, so an override typed in another script (valid as a name, UI-SPEC "letters of any script") is shown everywhere but cannot be found by typing it into the search box. Generated names are ASCII lowercase letters, so they are searchable. Widening the gate also changes the status text for non-ASCII queries, so it needs a decision; suggested for the phase gate review.
- **A rename re-reveals a found row.** `DemonBrowser` re-runs its search when the resolver changes, and its existing effect scrolls to a `found` outcome, so renaming (or undoing) while a name query is typed in the box jumps back to that row. Harmless; noted for 07-18 e2e.
- **The hover tooltip text is captured at pointer-move time** (see `key-decisions`).
- The e2e tests that assert base-10 or other-base NAME text (`other bases keep an empty NAME column`) are not touched here; they change in 07-18 when the provider mounts.

## Threat Flags

None beyond the register. T-07-10b: names are React text nodes and `title` attributes only, no `dangerouslySetInnerHTML` (asserted in a source test). T-07-03d: `unicode-bidi: plaintext` on the cell name (mutant killed), the matrix chip cut at 32 graphemes by grapheme, not code unit (mutants killed). T-07-06c: the live-name loop runs only within `NAME_SEARCH_MAX_COUNT` and the resolver is never called above it (a counting `nameOf` at base 666 sees 0 calls).

## TDD Gate Compliance

Both tasks followed RED then GREEN in separate commits: `test(07-15)` `def8573` before `feat(07-15)` `6cbd3e3`, and `test(07-15)` `d158143` before `feat(07-15)` `8440d79`. Each RED run failed before its GREEN commit (Task 1: 20 of 25; Task 2: 8 of 47). No refactor commit was needed.

## Next Phase Readiness

- 07-16 (the demon name editor) mounts inside `DemonInfo` and reads the same `useNaming()` and resolver; the heading it sits under now follows the naming.
- 07-18 mounts the provider: the NAME cell, matrix text, detail, pinned background and name search switch on together, and the base-10 default naming (the preset) keeps `Lurgo` and `Ummnu` exact with no marker. It must update the e2e specs listed above, and should memoise the resolver on the naming so the search memo does not recompute for unrelated context changes.
- No blocker.

## Self-Check: PASSED

- All eight files exist and are tracked: `tests/app/namesDisplayRender.test.ts` (new) and the seven modified files listed above.
- All four task commits exist (`def8573`, `6cbd3e3`, `d158143`, `8440d79`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, golden, behaviour baseline, `reference/` file, `engine/` file, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `app/presets/base10/` file was touched.
