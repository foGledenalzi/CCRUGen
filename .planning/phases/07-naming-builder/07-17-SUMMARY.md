---
phase: 07-naming-builder
plan: 17
subsystem: app-names-panel
tags: [naming, names-panel, import-export, file-io, live-carrier, preview-notice, inline-undo, copy-module, server-render-tests, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-04 (CyberButton, CyberRadio and CyberCheckbox optional props, ui-terminal-field classes), plan 07-08 (serializeNaming, validateNamingJson, NAMING_IMPORT_MAX_BYTES), plan 07-11 (NAMES_COPY and the copy functions, REROLL_SEED_LENGTH, NAMES_PREVIEW_ROWS, NAMES_SCROLL_INSET_PX) and plan 07-13 (NamingContext with a null default, the session rules and the panel states)
  - phase: 06-canvas-tier-and-worker
    provides: INTERACTIVE_MAX_N read from the measured tier table (app/lib/tierBounds.ts)
provides:
  - app/components/names/NamesPanel.tsx, NamesPanel({ open, bodyMax, pinnedMesh, pinnedZone }) with every global block (preview notice, Source, Seed and Reroll, Style, Join order, Smoothing, preview table, summary and share note, Import/Export with one status slot and inline Undo, autosave line), the four states, the persistent live carrier, and NamesHeaderTag()
  - exported pure helpers behind the handlers (rerollSeed, seedCommitOf, previewMeshes, exportFileName, exportNaming, downloadJson, importOutcome, readImportFile, importAllowed, statusFate) and the presentational NamesStatusSlot
  - 99 tests in tests/app/namesPanelRender.test.ts, 53 mutants run against them
affects: [07-18, 07-19, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The panel root and the sr-only live carrier are always mounted; the body mounts only while open and is keyed by the displayed base, so a base switch or a collapse starts it afresh (no status, no draft, scroll at the top) with no clearing effect"
    - "Handler logic that a node test cannot reach through a DOM is pulled into pure helpers with injected environments (a recording download environment, a File-like with a size and a text(), a revision-fate function) and those are tested and mutated directly"
    - "A status line records the naming revision it was produced at; the render that first shows it adopts the revision, and any later revision, from this panel or from anywhere else, clears it"
    - "Import reads the chosen file as untrusted data: size before reading, one validator, all or nothing, the input cleared in a finally, and a result is dropped when the base or state moved on while the file was read"

key-files:
  created:
    - app/components/names/NamesPanel.tsx
    - tests/app/namesPanelRender.test.ts
  modified: []

key-decisions:
  - "Block order is the UI-SPEC order (notice, Source, Seed with Reroll on its own row, Style, Join order, Smoothing, Preview, Summary and share note, Import/Export, autosave line); the collision report (block 9) and the zone list (block 12) have commented insertion points for 07-20 and 07-19"
  - "Pending disables every editing control (aria-disabled on the groups and the seed field, disabled on buttons and radios) AND Import, but keeps Export enabled ([default]: the plan only fixes Import-off in preview and Export-on everywhere); one `importAllowed(state)` decides both the disabled attribute and the late guard"
  - "Join and smoothing results are info statuses with no inline Undo (they change derived names, not the table, so they are not replace-all actions); source, seed, reroll, style, Keep and Use its seed here are success statuses with Undo; Back to my saved naming is an info status without Undo (history gets no entry)"
  - "A style change at a seed-only base says `Generated names for base n from seed s.` because there is no count of unlocked zones to report"
  - "The autosave line is decided by the panel state first (preview and seed-only), then by the context's `saved` value, so an inconsistent context can never show the wrong sentence"
  - "The seed field also reverts to the naming's seed on Escape (not in the UI-SPEC, consistent with the sound fields' Escape) and the panel moves focus to the seed field after Keep or Back (UI-SPEC Shared link)"
  - "The panel reads zone labels through an optional `useContext(NumogramViewContext)` and falls back to `formatZoneLabel` with the default scheme, so it renders without the view provider (the tests do)"
  - "Extra data hooks beyond the UI-SPEC list, all on new elements: data-names-seed-error, data-names-seed-only, data-names-summary, data-names-share-note, data-names-smoothing-note, data-names-preview-caption, data-names-preview-row and -cell, data-names-pending, and data-names-source, -style and -join on the radio inputs"

patterns-established:
  - "A mutation plan is also a test-gap finder: planning the mutants before running them exposed four logic paths with no test (the state-first autosave line, the seed-only hint, the per-base body key, a CCRU file accepted only with the preset), and two effect-bound decisions that were extracted into pure functions so they could be tested"

requirements-completed: []  # NAM-01, NAM-03 and NAM-04 stay Pending: the panel and its import and export exist and are proved, but nothing mounts it until plan 07-21 (NumogramClient provider in 07-18); the orchestrator marks them at the phase gate

# Metrics
duration: about 35min (start was not stamped; estimated from the first test run and the last commit)
completed: 2026-11-10
---

# Phase 7 Plan 17: Names Panel Shell, States, Import and Export Summary

**The Names panel now exists as one component: every global control block in the UI-SPEC order, the four states decided by the base alone, a preview notice that disables all editing, a persistent live carrier that is mounted even while collapsed, and export and import through one serializer and one validator, all or nothing, with the UI-SPEC copy, a wrong-base seed offer and an inline Undo, proved by 99 tests and 53 mutants (0 survivors).**

## Performance

- **Duration:** about 35 min (estimate, see Metrics), including the mutation runs, two typechecks, the two-timezone run, the full unit suite and check-repo
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit, plus one test-strengthening commit)
- **Files created:** 2 (`app/components/names/NamesPanel.tsx`, `tests/app/namesPanelRender.test.ts`); 0 modified
- **`$PLAN_BASE`:** `430c1f3af759fe3e4e5779a84086272ec6fa783c`

## Accomplishments

- **Shell and states.** `NamesPanel({ open, bodyMax, pinnedMesh, pinnedZone })` renders `<div data-names-panel data-names-state data-names-base>` with the always-mounted `<div role="status" aria-live="polite" class="sr-only" data-names-live>` and, only while open, one scroller `data-names-scroll` (max-height `bodyMax - NAMES_SCROLL_INSET_PX`, overflow-x hidden, overscroll contained, `touch-action: pan-y`). Outside a provider it renders nothing. `ready` shows everything; `pending` shows the controls with `aria-disabled` and the `Generating names for base {n}...` line where the list will be; `seed-only` shows Seed, Style, Join, Smoothing, Preview and Import/Export plus the seed-only sentence and no Source, summary or zone list; `preview` puts the notice first (label, body, `Keep this naming`, `Back to my saved naming`) and disables the seed field (`readOnly`, `aria-disabled`), Reroll, every radio, the checkbox and Import, while Export stays on.
- **Controls.** Source (`CCRU`, `Generated`) only where the environment's preset is for the displayed base; a seed field with a dirty-flag draft, Enter and deferred-blur commit, an invalid seed shown with `ui-terminal-field--invalid`, `aria-invalid`, `aria-describedby` and the seed error; `Reroll unlocked sounds` on its own row with a seed from two 32-bit random words in base 36 cut to `REROLL_SEED_LENGTH`; Style and Join radio groups (`role="radiogroup"`, labelled, `aria-describedby` to the visible description of the selected option, `flex flex-wrap gap-x-3 gap-y-1`, every radio wrapper `min-h-[24px]`); the Smooth names checkbox with its helper and, when smoothing changes nothing for the current table (or style, at a seed-only base), `Smoothing makes no difference to these sounds.`; the preview table (real `<table>`, scoped headers, fixed layout, three rows from the pinned demon then the lowest meshes, raw and smoothed names from the resolver, `aria-current` and the accent underline on the column in use, the CCRU caption under the CCRU source); the summary and, only with edits a link cannot carry, the share note; the one-line autosave line for the five states.
- **Header tag.** `NamesHeaderTag()` shows `unsaved preview` in the preview state, else `edits not in links`, else nothing.
- **Export.** `exportNaming(naming, base)` serializes through `serializeNaming(naming, { pretty: true })`, builds one `application/json` Blob, clicks a temporary anchor named `ccrug-names-base{n}.json` (seed and style only above the ceiling) and revokes the object URL after the click; the status is `exportSuccess` or `exportSeedOnly`.
- **Import.** The button clicks a hidden `input[type=file][accept=".json,application/json"]`; `readImportFile` checks `file.size > NAMING_IMPORT_MAX_BYTES` before reading, reads the text (a failed read is the `unreadable` refusal), runs the one validator with the displayed base, the ceiling and the preset, and returns the naming or null plus the sentence. `importOutcome` maps every result: the success line with sound and override counts (the seed-only line at a seed-only base) plus the unknown-keys suffix; not-JSON, too-large (the cap through the one byte formatter), unknown version, not a names file, wrong base (with the seed offer only when the file carries a usable generator record), seed-only base; and every entry problem as the list of at most five with `And {k} more.` The input is cleared in a `finally`, so the same file can be chosen twice; a result is dropped when the base or state moved on while the file was read; there is no drag and drop.
- **Status slot and Undo.** One plain-text `p[data-names-status][data-kind]` (no role) with `Use its seed here` and `Undo this change` each on its own line; every result also goes through the live carrier. The status clears on the next naming revision from anywhere, on a base change (the body is keyed by base) and on collapse; the inline Undo is the app's own `undo()`.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: panel shell, states, controls, preview table, summary, notice, header tag and live carrier**
   - RED: `2553827` (test) the shell test failing on the missing module
   - GREEN: `b13eacd` (feat) blocks 1 to 8 and 11, the four states, the helpers and the header tag
   - Tests strengthened after planning 24 mutants: `829d91b` (test) three tests (the state-first autosave line, the seed-only hint, the per-base body key)
2. **Task 2: export, import, Use its seed here, status slot and inline Undo**
   - RED: `705bf08` (test) 36 failing tests for the new exports
   - GREEN: `68db6b4` (feat) block 10, the status slot, the import and export helpers, `importAllowed` and `statusFate`

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/components/names/NamesPanel.tsx` - 925 lines
- `tests/app/namesPanelRender.test.ts` - 99 tests, 1,348 lines

## Decisions Made

See `key-decisions`. The plan's `[default]` decisions are implemented as written (extras per UI-SPEC decision 16, the Reroll seed from `crypto.getRandomValues` in UI code only, the status and Undo clearing on the next naming action, a base change or collapse). 07-18 needs to know: the context's `rev` must change on every committed naming change and every restore (it clears the panel status); `apply` must return false for a refusal (the panel shows nothing then); `announce` is called with every result and refusal text; `undo` is called by the inline Undo with no argument. 07-21 mounts `<NamesPanel open bodyMax pinnedMesh pinnedZone />` inside `CyberPanel` with `headerRight={<NamesHeaderTag />}`, and 07-19 and 07-20 fill the two commented insertion points.

## Mutation Checks

Each mutant was applied by a scratchpad runner (`run-mutants.mjs`) that refuses a no-op or a find text that does not occur exactly once, runs the test file in the foreground under a 150 s timeout, restores the source from a saved copy and confirms `git diff --quiet <file>`; one mutant at a time, in order, never in the background. Every row below was restored clean.

**Task 1 (24 mutants against the green 58-test baseline), every one Killed:** pending no longer locks controls (1 failing test); preview no longer locks (2); the Source row at every base with a preset (2); the summary at seed-only bases (1); the inert rule inverted for a seed-only naming (1); the raw column never in use (1); the autosave line ignoring the state (1); the pinned bound inclusive (2); reroll words not padded (2); the seed commit never reporting unchanged (1); the pending line ignoring the pending base (1); the share note always shown (1); radio rows that do not wrap (1); no 24px minimum (3); the caption under the wrong source (1); the scroller not inset (1); the seed editable in preview (2); the preview tag losing to the edits tag (1); the raw column showing smoothed names (2); the Source options swapped (2); the carrier mounted only when open (1); the body mounted while collapsed (1); the base hint hidden at seed-only bases (1); no `aria-disabled` on the groups (2). Planning them found three missing tests (the autosave line ignoring the state survived on paper because the hand-built context was always consistent, the seed-only hint and the per-base `key` were unasserted); each was added before the run.

**Task 2 (29 mutants against the green 99-test baseline), every one Killed. The plan's named mutant:** mapping a wrong-base issue to the generic `invalidEntries` text with no seed offer (`T2-PLAN`) fails 3 tests, the wrong-base sentence case and the two offer assertions; separately, keeping the sentence but dropping the offer (`T2-M01b`) and keeping the offer under the generic text (`T2-M01c`) each fail 2. The other 26: the size cap made exclusive of the cap itself (2); no size check before reading (2); the override count taken from locks (1); unknown keys never listed (2); an unreadable file read as not JSON (1); the file name without the word base (3); the object URL revoked before the click is handled (1); the Blob type changed (1); the export written compact (1); the seed-only export reporting the full-table sentence (1); Import enabled in every state (1); Export disabled when locked (1); the error status not red (2); Use its seed here always shown (2); Undo always shown (2); the picker accepting only `.json` (1); the file input visible (1); the input never cleared (1); the seed-only refusal listed as an entry (1); a later revision no longer clearing the status (1); a status never adopted (1); import allowed while building (2); an unreadable branch swallowed (1); the validator given no preset (1, found by a CCRU-file test added before the run); the anchor never removed (1); the download name not set (3).

No survivors and no equivalents. 53 mutants in all.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/namesPanelRender.test.ts --project oracle`: 1 file, 99 tests passed; the same under `CCRUG_TZ=America/New_York`: 99 passed.
- `npm test` (the whole unit suite, both projects, UTC): 114 files, 3,637 tests passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task and after the last edit; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs` (all 11 gates including `base-ten`, `lore`, `goldens`, `lf`): OK, with the new file staged before the base-ten run.
- Acceptance greps on `NamesPanel.tsx`: `data-names-live` 1, `export function NamesHeaderTag` 1, `crypto.getRandomValues` 1, `\b4000\b|\b4002\b` 0, `serializeNaming(` 1, `validateNamingJson(` 1, `file.size > NAMING_IMPORT_MAX_BYTES` 1, `URL.revokeObjectURL` 1, `dangerouslySetInnerHTML` 0.
- `npm run test:swap`, `npm run build`, `npm run check:weight` and `npm run verify` were NOT run: the plan only adds a new app file and a new test and edits no existing app file, and nothing imports `NamesPanel.tsx` yet (07-21 mounts it), so no bundle, no diagram, no golden and no behaviour baseline can change; the plan's verify commands, the full unit suite, typecheck and check-repo above are the proportionate gate. `git diff --name-only $PLAN_BASE HEAD` (before this docs commit) lists exactly the two files above, none under `e2e/`, `engine/`, `app/presets/base10/`, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `reference/`. No frozen oracle, DOM golden, behaviour baseline, bank or signed-off vector was touched.
- Not covered by a node test and left to the e2e suite of plans 07-22 and 07-23 (there is no DOM test library in the repo): the real file chooser and download, the seed field's blur timer, focus moving to the seed after Keep or Back, and the status effect itself; the decisions inside them are the pure helpers above, each tested and mutated. The field widths in the browser (about 206px content and 142px sound field) belong to the zone-list plan.

## Deviations from Plan

### Auto-fixed Issues

None for Rules 1 to 3: the plan's contracts were implemented as written and the code worked on the first full test run of each task.

### Plan-level refinements recorded under key-decisions

1. **Two small pure helpers beyond the plan's two** (`importAllowed`, `statusFate`) and a download and file-read layer (`downloadJson`, `exportNaming`, `readImportFile`, `browserDownloadEnv`) so the export and import paths are testable without a DOM; the plan only names `importOutcome` and `exportFileName`.
2. **Extra data hooks** on new elements (listed under key-decisions) so tests and the e2e suite can target them; none replaces a hook of the UI-SPEC list.
3. **Escape in the seed field, focus to the seed after Keep or Back, a state-first autosave line, Import off while pending, Export on while pending, a late-result guard on import, and the seed-only status wording for a style change.** Each is small, tested where a node test can reach it, and none changes a sentence of the copy module.
4. **No copy was added to `namingCopy.ts`.** The one case with no sentence (an import that `apply` refuses after validation passed) cannot occur while Import is disabled wherever `apply` refuses; a race (the base or state changed during the read) drops the result silently rather than showing a wrong sentence.

---

**Total deviations:** 0 auto-fixes, 4 refinements (all within the plan's intent).
**Impact on plan:** none changes an exported name or signature the plan lists (`NamesPanel`, `NamesHeaderTag`, `importOutcome`, `exportFileName`); the extra exports are additive.

## Issues Encountered

None blocking. A throwaway markup dump test file used to look at the rendered HTML was deleted before any commit (`git status` stayed clean).

## Known Stubs

None. Block 9 (collision report) and block 12 (zone list) are commented insertion points for plans 07-20 and 07-19 by design, not placeholders that render anything; the pending line stands where the list will be.

## Threat Flags

None beyond the register. T-07-05b: `File.size` is checked against `NAMING_IMPORT_MAX_BYTES` before reading (a file of exactly the cap is read, one byte over is not, and `text()` is never called for it), the validator re-checks the text length, and the input is cleared in a `finally`. T-07-04b: only `validateNamingJson` results are applied (a `__proto__` override key is refused as a key; a hostile key is echoed as text and escaped), all or nothing. T-07-17c: every replace-all result ends with the inline `Undo this change` through the app's own undo, and Import is disabled in preview and pending. T-07-10d: every status and error is a React text node, the export is a JSON Blob with a fixed file name that carries only the base, and a test renders a hostile string and checks it comes out escaped.

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-17)` `2553827` before `feat(07-17)` `b13eacd`, and `test(07-17)` `705bf08` before `feat(07-17)` `68db6b4`. Each RED run failed before its GREEN commit (the first on the missing module, the second with 36 failing tests on the missing exports). One test-only commit (`829d91b`) strengthened Task 1 after the mutation plan. No refactor commit was needed.

## Next Phase Readiness

- 07-16 (next in the order, the demon name editor with Selection and overlay mounts and hover-proof binding) does not depend on this plan. 07-18 provides the `NamingContext` value this panel reads. 07-19 inserts the zone list at the block 12 comment (it needs `pinnedZone`, already accepted as a prop) and 07-20 the collision report at the block 9 comment. 07-21 mounts the panel with `headerRight={<NamesHeaderTag />}`, `maxBodyHeight={bodyMax}` and the 240px width.
- No blocker.

## Self-Check: PASSED

- Both created files exist and are tracked: `app/components/names/NamesPanel.tsx`, `tests/app/namesPanelRender.test.ts`.
- All five task commits exist (`2553827`, `b13eacd`, `829d91b`, `705bf08`, `68db6b4`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `engine/` file, no `Projection.tsx`, no `NumogramClient.tsx`, no `app/presets/base10/` file and no existing app file was touched.
