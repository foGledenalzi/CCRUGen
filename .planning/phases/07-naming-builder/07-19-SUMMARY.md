---
phase: 07-naming-builder
plan: 19
subsystem: app-names-panel
tags: [naming, zone-list, virtualized-list, locks, bulk-paste, keyboard-model, go-to-zone, shortcuts-modal, pure-model, browser-verified, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-05 (editSound, pasteSounds, toggleLock: an edit locks its zone), plan 07-11 (NAMES_COPY, zoneIssue, pasted, pastedPartial, pasteRefused, noZone, zoneAria, lockAria, ZONE_ROW_HEIGHT_PX, ZONE_LIST_OVERSCAN, ZONE_PAGE_STEP, SOUND_FIELD_MAX_INPUT), plan 07-13 (NamingContext, apply, the session rules, restored { tick, zone }), plan 07-04 (LockIcon, the quiet and invalid field classes) and plan 07-17 (the NamesPanel shell and its block 12 insertion point)
  - phase: 06-canvas-tier-and-worker
    provides: INTERACTIVE_MAX_N from the measured tier table (the list is proved at that size)
provides:
  - app/components/names/ZoneList.tsx, the virtualized editable zone list (ZoneList, the presentational ZoneRowView, ZoneRowHandlers, RowControl, useObservedHeight)
  - app/lib/zoneListModel.ts, the pure rules behind it (splitPaste, planPaste, nextRowIndex, resolveGoTo, soundCommitOf, listMessageOf, tabStopZone, pinScrollTarget, restoredScrollTarget, and the list state reducer typeInto, settleRow, settleRows, refuseRow, withNote, hasRowEdit)
  - the zone list mounted as block 12 of NamesPanel in the ready and preview states, and the Names panel keyboard line in the shortcuts modal
  - 67 model tests, 42 new panel render tests, 22 mutants of the model, 30 of the list markup and 18 of the list state, 12 of the wiring, and a 91-check Chromium run of the real panel (scratch, not committed)
affects: [07-18, 07-20, 07-21, 07-22, 07-23, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every decision of an interactive list is a pure function of a small model module (commit, paste plan, navigation, go-to, message, Tab stop, scroll targets, a state reducer), so the wiring left in the component is thin and the decisions are mutation tested without a DOM"
    - "The list state is read synchronously through a ref (every change goes through one `update`), so an Enter or arrow commit and the blur it causes in the same tick cannot commit one draft twice (a mutant of that line is caught only by the browser run)"
    - "A server render of a windowed list keeps the real @tanstack/react-virtual and injects one starting rectangle through a wrapping vi.mock, so the first window is the one the real rule gives and every call's options are recorded"
    - "The list measures where its first row really sits in the scroller (a getBoundingClientRect difference, re-measured when the controls above or its own top block resize) and uses the panel's controls height only as the estimate before that"

key-files:
  created:
    - app/components/names/ZoneList.tsx
    - app/lib/zoneListModel.ts
    - tests/app/zoneListModel.test.ts
  modified:
    - app/components/names/NamesPanel.tsx
    - app/components/numogram/ShortcutsModal.tsx
    - tests/app/namesPanelRender.test.ts

key-decisions:
  - "Order inside block 12 is Go to zone field, both helper lines, the list message, then the list: the UI-SPEC puts the one message line directly above the sticky header, which wins over the order in which the plan listed the pieces (the plan only fixes that all of them come after the autosave line)"
  - "The sticky header text is gray-400, not the gray-500 the plan quotes from DemonRowList: the UI-SPEC contrast rule keeps gray-500 for the idle lock glyph only, and the header names the columns"
  - "The windowing margin is measured, not assumed: ZoneList reads `list top - scroller top + scrollTop` in an effect (re-run when the panel's controls height or its own go to block resizes) and adds the 24px header; the `scrollMargin` prop (the panel's measured controls height) is the estimate until the first measure. Needed because the gaps and wrapped lines above the list are not the controls height, and because the parent scroller's ref is still null when the child's first layout effect runs, so a state change after mount is what attaches the virtualizer to the scroller"
  - "`scrollPaddingStart` is the header height, so an 'auto' or 'start' scroll never leaves the target row under the sticky header, and a pinned zone is centred once per pin only after the first measure"
  - "A key pressed while a keyboard move is still travelling (the target row is not rendered yet) continues from where that move is going: a `pendingZone` ref, found by the browser run (five PageDown presses ended on zone 40, not 50)"
  - "The virtualizer is imported as a namespace (`import * as virtual`) so the plan's literal check `grep -c useVirtualizer ZoneList.tsx = 1` counts the call and not also the import line"
  - "The list's aria-label `Zone sounds` is a local constant in ZoneList.tsx: the copy module has no key for it and its test pins exactly 76 keys, and this plan does not list namingCopy.ts among its files"
  - "The shortcuts line carries a JSX comment that starts with `Names panel:` (renders nothing), so the plan's artifact check `contains: Names panel:` holds while the sentence itself stays single-sourced in the copy module"
  - "A refusal replaces a paste or unknown-zone note, a draft edit or commit drops a note, Escape with only a note clears it; a refusal on show follows the draft (it updates and clears while typing) and falls back to the lowest remaining invalid row"

patterns-established:
  - "A list row is a presentational view (ZoneRowView) over handlers, like the demon name editor view, so invalid, read-only, locked and pinned markup is testable by a server render"
  - "Plan acceptance greps that count lines (`grep -c`) are satisfied by shape (namespace import, one JSX mount line) and pinned by a source test, not by hoping comments avoid the word"

requirements-completed: []  # NAM-01 stays Pending: the list is built and proved, but nothing mounts NamesPanel until plan 07-21 (the provider arrives in 07-18); the orchestrator marks it at the phase gate

# Metrics
duration: about 35min (start was not stamped; estimated from the first test run at 17:41Z to the last full run at 18:13Z)
completed: 2026-11-10
---

# Phase 7 Plan 19: Virtualized Editable Zone List and the Shortcuts Line Summary

**Block 12 of the Names panel is now a real editor: one 28px row per zone inside the panel's single scroller (a few dozen mounted at the 4,000-zone ceiling), a sound field that commits on Enter or blur and locks its zone as one history entry, invalid drafts that stay with one red message, an all-or-nothing bulk paste, a lock toggle with a shape and colour change, one Tab stop with arrow, page and Ctrl+Home/End keys, Go to zone, a scroll to the pinned zone once per pin and to the undone row without moving focus, plus the Names panel line in the shortcuts modal, with every decision a pure tested function and the whole panel driven in real Chromium (91 checks).**

## Performance

- **Duration:** about 35 min (estimate, see Metrics), including the mutation runs, the browser harness, two typechecks, the two-timezone run and one full `test:swap`
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 3; **modified:** 3 (`NamesPanel.tsx`, `ShortcutsModal.tsx`, one existing test file, extended)
- **`$PLAN_BASE`:** `4cf248036f0f768673bdb5d64dea4b2a2cc36520`

## Accomplishments

- **Pure model (`app/lib/zoneListModel.ts`).** `splitPaste` (commas, semicolons, tabs, newlines, spaces; empties dropped), `planPaste` (every token that has a zone is validated in order; the first bad one refuses the whole paste and names its zone and carries no sound; tokens past the last zone are `unused` and not looked at; planned sounds are the NFC trimmed forms), `nextRowIndex` (arrows, Page Up and Down by `ZONE_PAGE_STEP`, Ctrl+Home and Ctrl+End, plain Home and End null), `resolveGoTo` (the exact shown label, then a numeral of the base in range, then a decimal in range; trimmed; over `GOTO_MAX_LENGTH` 40 is no zone; one label scan on Enter), `soundCommitOf` (none, unchanged, invalid with the first rule, or the text to apply), `listMessageOf`, `tabStopZone`, `pinScrollTarget`, `restoredScrollTarget` and a small immutable list state (`typeInto`, `settleRow`, `settleRows`, `refuseRow`, `withNote`, `hasRowEdit`) that holds only the zones the visitor touched. Imports are relative, nothing reads the browser, no zone count or page step is a literal.
- **The list (`ZoneList.tsx`).** `ZoneList({ scrollEl, scrollMargin, pinnedZone })` renders nothing without a provider, for a seed-only naming and in any state but ready and preview. It windows `count: base` rows of `ZONE_ROW_HEIGHT_PX` (28), overscan `ZONE_LIST_OVERSCAN` (8), against the panel scroller, under a sticky 24px header (`Zone`, `Sound`, `Lock`, `aria-hidden`), with `role="list"`, `aria-label="Zone sounds"`, rows `role="listitem"` with `aria-posinset` and `aria-setsize` (`data-names-row`, `data-locked`, `data-pinned`). A row is `[label 32px][sound field flex-1][lock 24x24]` at a 4px gap: the field has `ui-terminal-field ui-terminal-field--quiet` (and `--invalid` while refused), `aria-invalid`, `aria-describedby` to the list message, `dir="auto"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `autoComplete="off"`, `maxLength={SOUND_FIELD_MAX_INPUT}` (64); the lock is a `button` with `aria-pressed`, the constant label `Lock sound for zone {label}`, the help title, a closed or open padlock and, locked, the accent tint and inset underline; the pinned row carries the Phase 5 accent token and no hover background.
- **Editing.** A draft is held per zone (it survives scrolling the row out of the window); Enter or blur commits after NFC and trimming, applies `{ type: 'sound' }` (the engine locks the zone) as one history entry, and does nothing for the unchanged text; an invalid draft stays, gets the red underline, `aria-invalid` and `Zone {label}: {reason}` in the one message line (announced), and follows the draft while it is fixed; Escape reverts, clears the message and keeps focus. A paste of two or more tokens is taken over, planned, refused whole with `Paste not applied. Zone {label}: {reason}` or applied as one `{ type: 'paste' }` with the `pasted` or `pastedPartial` status; a one-token paste is left to the browser. The lock click or Space toggles one `{ type: 'lock' }`.
- **Keyboard and scrolling.** One Tab stop (the active row's field and lock, the first rendered row when the active one is scrolled out); Arrow Up and Down, Page Up and Down by 10, Ctrl+Home and Ctrl+End move to the same control of the target row (a valid draft is committed first, an invalid one keeps focus), scrolling the row in first and focusing it as soon as it is rendered, with no focus ring scroll; Shift, Alt and IME composition keep their meaning. Go to zone (quiet field, `aria-label="Go to zone"`, placeholder `zone number`) scrolls the row to just below the sticky header and focuses its field, or says `No zone "{text}" at base {n}.`. A pinned zone is scrolled to the middle once per pin (no focus move); an undo or redo that changed one row scrolls it into view (no focus move, none for a restore already seen). All scrolling is instant.
- **Mount and shortcuts.** `NamesPanel` wraps blocks 1 to 11 in a measured element (`data-names-controls`, `useObservedHeight`), keeps a ref on the scroller and mounts `<ZoneList scrollEl scrollMargin pinnedZone />` for `ready` and `preview` (the pending line stays for `pending`). `ShortcutsModal` gains `<div className="text-gray-400">{NAMES_COPY.shortcutLine}</div>` as the last line of the existing `data-post-baseline` block (no accent lead-in); the rest of its markup is byte-identical (a test pins the whole modal against the markup captured from the unmodified component).

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: pure zone-list model**
   - RED: `f24b16d` (test) the model tests failing on the missing module
   - GREEN: `1989e5b` (feat) `splitPaste`, `planPaste`, `nextRowIndex`, `resolveGoTo` and the five small decisions
2. **Task 2: ZoneList, its mount in NamesPanel and the shortcuts line**
   - RED: `ac755f7` (test) 41 panel render tests failing on the missing `ZoneList` module
   - GREEN: `d2c197d` (feat) `ZoneList.tsx`, the list state reducer in the model (with its tests), the `NamesPanel` mount and the `ShortcutsModal` line

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/components/names/ZoneList.tsx` - 519 lines: the list, the row view, the observed-height hook
- `app/lib/zoneListModel.ts` - 243 lines: the pure rules and the list state
- `tests/app/zoneListModel.test.ts` - 67 tests
- `app/components/names/NamesPanel.tsx` - blocks 1 to 11 wrapped in the measured element (a 254 line re-indent diff, no change to any block's markup), scroller ref, `pinnedZone` passed on, block 12 mounted
- `app/components/numogram/ShortcutsModal.tsx` - one import, one JSX comment, one line
- `tests/app/namesPanelRender.test.ts` - 141 tests (99 untouched, 42 new), with a wrapping mock of the virtualizer at the top of the file

## Decisions Made

See `key-decisions`. The plan's `[default]` decisions are implemented as written: editing auto-locks (the engine's `editSound` does it, the list only shows it), bulk paste splits on commas, semicolons, tabs, newlines and spaces and is all or nothing, and the roving tabIndex uses per-row focus (not `aria-activedescendant`) because rows hold inputs.

## Mutation Checks

Each mutant was applied by a scratchpad runner that refuses a find text that does not occur exactly once or a no-op, runs the test file in the foreground under a 150 s timeout, restores the source from a saved copy and confirms the file is unchanged (`git diff --quiet` on the staged file); one mutant at a time, never in the background.

**Task 1, the model (22 mutants against the green 51-test baseline), every one Killed.** The plan's named mutant, applying the valid prefix of a paste before the bad token (a refusal turned into `ok: true` with the sounds so far), fails 3 tests (the all-or-nothing case, the first-bad-token case and the `sounds`-absent assertion). The other 21: tokens past the last zone validated (3 failing); page step 1 (2); plain Home jumping (1); End ignoring Ctrl (1); Arrow Up unclamped (1); numeral read before the label (1); an out-of-range numeral accepted (4); an out-of-range decimal accepted (2); no length bound on the go-to text (1); an untrimmed go-to text (2); empty tokens kept (1); no semicolon separator (2); an unchanged commit that locks (1); an untrimmed draft refused (2); the message taking the highest invalid row (1); a note losing to a row message (1); a pin scrolled every time (1); a pin outside the base scrolled (1); the Tab stop always the active row (1); a seen restore scrolled again (1); a planned sound not in NFC (1).

**Task 2, the list markup (30 mutants against the green panel render tests).** 29 Killed on the first run; `Z09` (the description pointer always set) survived because the view test only passed an id to invalid rows, so a test that hands a valid row the id was added and the mutant now fails 1. Killed: overscan 1 (5 failing); no padding start (1); header not sticky (1); wrong `aria-setsize` (3) and `aria-posinset` (3); a field never read only (3); a lock never disabled (3); every row a Tab stop (2); no accent on a locked lock (1) and no pinned token (1); `data-locked` inverted (3); a doubled field cap (2); a view of another base accepted (1); an absolute row top (1); preview list hidden (3); pending list shown (1); always editable (2); a scroller of its own (1); no message id (1); an unbounded go-to field (1); no lock title (1); no `dir="auto"` (1); `autoComplete="on"` (1); `aria-pressed` always false (1); no hover class (1); an open padlock when locked (1); the same lock colour (1); the header words swapped (1); the pin prop ignored (2).

**Task 2, the list state in the model (18 mutants).** 16 Killed on the first run; `S13` (a paste settling one row too many) and `S15` (a refusal that keeps a note) survived, so the range test now keeps a draft right before and right after the range and a test was added that a refusal replaces a note; both now fail 1. Also Killed: the state mutated in place (5); a typed key keeping the note (1); a refusal that does not follow the draft (1), never clears (1) or keeps a stale reason (1); typing marking a row invalid (1); a settled row keeping its draft (3), its refusal (2) or its message (2), or dropping another row's message (1); a settled row keeping the note (1); a range one short (1); no message row on a refusal (2); a note always a new state (1); `hasRowEdit` seeing only drafts (1) or only refusals (1).

**The wiring, against the Chromium run (12 mutants of `ZoneList.tsx`; scratch driver, see below).** Killed: blur no longer committing (2 failing checks); a keyboard move that does not commit first (1); the pending-move origin ignored (1, five PageDown ended on zone 30); Escape not reverting (3); a paste not prevented (2); the go-to scroll aligned to the end (1); every row a Tab stop (2); the margin taken from the prop only (1); a lock click ignored (4); an undo that does not scroll and a pin that does not scroll (both end the run with a timeout waiting for the row, counted as killed). `H02` (a commit that does not drop its draft before applying) first survived, because the re-render between Enter and a later blur hides the double commit; a check that a move commits the draft exactly once (one `sound` action and one history entry) was added to the driver and then killed it. No survivors and no equivalents.

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/zoneListModel.test.ts --project oracle`: 67 passed (51 after Task 1, 16 more for the list state). `npx cross-env CCRUG_TZ=UTC vitest run tests/app --project oracle`: 56 files, 1,916 tests passed; the two touched files under `CCRUG_TZ=America/New_York`: 208 passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx`.
- `node scripts/check-repo.mjs` (all 11 gates, `base-ten` included, with the new files staged first): OK.
- `MSYS_NO_PATHCONV=1 npm run test:swap` after the Task 2 edits (the mounted `ShortcutsModal` is edited): exit 0, the build compiled, 65 Playwright passed (3.1 min; the 5 skipped are the behaviour specs on the New York project, by design, so the 60 DOM goldens and the behaviour baseline are unchanged), 116 files and 3,833 unit tests passed. `npm run check:weight` on that build: OK (2 routes, 30 golden states within tolerance). Task 1 edits no existing file, so no swap run for it.
- Acceptance greps: `maxLength={SOUND_FIELD_MAX_INPUT}` 1, `useVirtualizer` 1 line, `<ZoneList` in `NamesPanel.tsx` 1, `data-names-lock` 1, `aria-setsize` 1, `behavior: 'smooth'` 0, `git diff $PLAN_BASE -- ShortcutsModal.tsx | grep -c "^+.*text-gray-400"` 1, `export function planPaste` 1.
- `git diff --name-only $PLAN_BASE HEAD` (before this docs commit) lists exactly the six files above: nothing under `e2e/`, `engine/`, `app/presets/base10/`, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `reference/`. No frozen oracle, DOM golden, behaviour baseline, bank or signed-off vector was touched.
- **Real browser run (scratch, not committed).** The repo has no DOM test library, so the interactive wiring cannot be reached by a node test. A scratch harness (in the session scratchpad, `zl-harness/`: an esbuild bundle of the real `NamesPanel` over a `NamingContext` driven by the real `applyNamingAction`, the repo's own Tailwind CSS, a Playwright Chromium driver) ran 91 checks, all passing on the final code: base 28 geometry (rows 28px, header 24px, lock 24x24, no horizontal overflow, first row directly under the header); Enter, blur, Enter then Tab and the unchanged text each commit once and lock; an invalid draft stays with `aria-invalid`, the underline class, the message and `aria-describedby`, ArrowDown keeps focus, Escape reverts; the keys (Arrow, Page, Ctrl+Home and End, plain End as caret, one Tab stop, Tab out and Shift+Tab back, Space on a lock); paste (taken over, fills and locks, one history entry, refused whole, partial, single token left alone); Go to zone (`c`, an unknown text); preview read only; base 4000 (9 rows mounted of 4,000, a 112,000px spacer, the last zone reachable, Go to 2500 just below the sticky header, a draft surviving virtualization, Ctrl+End and Ctrl+Home, five PageDown to zone 50, the focused row not under the header); pin once per pin and no focus move; undo scroll with no focus move; the window following the exact margin when a notice appears above the list; a base switch starting afresh; no console error. The committed e2e coverage of the same behaviour belongs to plans 07-22 and 07-23.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Key repeat lost steps while a move was travelling**
- **Found during:** the browser run (five quick PageDown presses ended on zone 40, not 50)
- **Issue:** a second key pressed before the first move's target row was rendered and focused was computed from the row that still had focus, so one step was lost
- **Fix:** a `pendingZone` ref holds the row a move is travelling to; the next key continues from it; cleared when focus lands or the retry frames run out
- **Files modified:** `app/components/names/ZoneList.tsx`
- **Commit:** `d2c197d`

### Plan-level refinements recorded under key-decisions

1. **UI-SPEC over the plan** for the order inside block 12 (message directly above the sticky header) and the header colour (gray-400).
2. **Measured margin** (the plan says `scrollMargin` is the measured controls height; it is passed as such, and used as the estimate, while the list measures its own exact top). The panel's measured element is `data-names-controls`, a new wrapper around blocks 1 to 11, which re-indents those blocks.
3. **Namespace import** of the virtualizer and a **local `Zone sounds` constant** (see key-decisions).
4. **More pure helpers than the four the plan names** (`soundCommitOf`, `listMessageOf`, `tabStopZone`, `pinScrollTarget`, `restoredScrollTarget`, the list state reducer, three constants), all additive and tested, so the component holds wiring only.
5. **A visible `Go to zone` eyebrow** (`aria-hidden`, the field keeps its own `aria-label`) as in the UI-SPEC wireframe, and `min-h-[24px] min-w-[24px]` on the lock button so the existing every-small-button 24px test holds without being edited.
6. **The existing panel test file got a file-wide wrapping mock of the virtualizer** (the real library plus one starting rectangle); the 99 existing tests pass unchanged under it.

---

**Total deviations:** 1 auto-fix (Rule 1), 6 refinements (all within the plan's intent).
**Impact on plan:** none changes an exported name or signature the plan lists (`splitPaste`, `planPaste`, `nextRowIndex`, `resolveGoTo`, `ZoneList` and its props); the extra exports are additive.

## Issues Encountered

- A server render of a windowed list shows no rows unless the virtualizer has a starting rectangle, so the render tests wrap the library instead of replacing it (see patterns). A scratch probe test used to learn this was deleted before any commit (`git status` stayed clean).
- The `ShortcutsModal.tsx` working copy has CRLF endings while the index has LF; the edit was written with the file's own endings, so the diff is two insertions and one comment line.

## Known Limitations

- A row that has focus and is scrolled far out of the window (mouse wheel, scrollbar) is unmounted, so focus falls back to the page; its uncommitted draft is kept in the list state and returns when the row is rendered again. The plan does not ask for a range extractor that keeps the focused row mounted; it is a small follow-up if the 07-22 e2e or the screen-reader checkpoint wants it.
- The committed tests cover markup, options and every decision; the event wiring (Enter, blur, paste, keys, scrolling, focus) is proved by the scratch Chromium run above and by the later e2e plans, not by a committed node test. The harness stays in the session scratchpad.
- IME composition is handled by the standard guard (Enter, Escape and the arrows are ignored while composing) and is not exercised by any test.

## Known Stubs

None. The list renders real data from the naming context; the pending line stands in for it in the pending state, as the UI-SPEC says.

## Threat Flags

None beyond the register. T-07-03f: every committed and pasted token goes through `validateSound` (NFC, letters and marks, 1 to 16 graphemes) in `soundCommitOf` and `planPaste`, the engine validates again when the action is applied, and `maxLength` 64 cuts an absurd single-token paste first. T-07-02d: windowed rows with overscan 8 (9 rows mounted at 4,000 zones in the browser run, fewer than 80 in the render test), drafts held only for touched zones, the go-to label scan runs on Enter only. T-07-17e: a paste is all or nothing and one history entry, a refusal names the first bad zone and changes nothing, preview is read only (fields `readOnly`, locks `disabled`, paste ignored). Typed and pasted text is only ever an input value or a React text node (a test renders a hostile stored sound and checks it comes out escaped).

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-19)` `f24b16d` before `feat(07-19)` `1989e5b`, and `test(07-19)` `ac755f7` before `feat(07-19)` `d2c197d`. Each RED run failed on the missing module before its GREEN commit. One honest gap: the list state reducer and its 16 tests were written together in the Task 2 GREEN commit (there was no separate failing run for them); their strength is the 18 mutants above. No refactor commit was needed.

## Next Phase Readiness

- 07-18 (next, wave 8) provides the `NamingContext` value this list reads: `restored` must bump `tick` on every undo or redo and carry `zone` only for a single changed row (the list scrolls to it); `apply` must return false for a refusal; `announce` receives the list's refusal, paste and no-zone texts. 07-20 inserts the collision report at the block 9 comment (inside the measured controls element, so the list's margin follows it automatically). 07-21 mounts the panel; the e2e plans 07-22 to 07-24 can target `[data-names-list]`, `[data-names-row]`, `[data-names-sound]`, `[data-names-lock]`, `[data-names-list-message]` and `input[data-names-goto]`, and should measure the real field width (about 152px in a 240px panel in the harness).
- No blocker.

## Self-Check: PASSED

- The three created files exist and are tracked (`app/components/names/ZoneList.tsx`, `app/lib/zoneListModel.ts`, `tests/app/zoneListModel.test.ts`).
- All four task commits exist (`f24b16d`, `1989e5b`, `ac755f7`, `d2c197d`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, no `reference/` file, no `engine/` file, no `Projection.tsx`, no `PairGraphProjection.tsx`, no `NumogramClient.tsx` and no `app/presets/base10/` file was touched.
