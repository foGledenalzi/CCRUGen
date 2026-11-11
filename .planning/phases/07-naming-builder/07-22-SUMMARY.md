---
phase: 07-naming-builder
plan: 22
subsystem: e2e-naming-editing-and-labels
tags: [naming, e2e, playwright, zone-list, undo, reroll, seed, sounds-labels, canvas, mutation-testing, typescript]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-21 (the Names panel mounted at every tier, e2e/names-helpers.ts, the smoke spec), 07-16 (the demon name editor), 07-17 and 07-19 and 07-20 (panel blocks, zone list, collision report), 07-18 (the naming session, history and autosave), 07-12 and 07-14 (sounds labels on both tiers)
provides:
  - e2e/names-panel.spec.ts (20 tests): editing and locks, Reroll and seed changes, seed determinism, join and smoothing, rename and reset in the Selection and overlay mounts, the editor binding, Undo and Redo order, Ctrl+Z in a field, the zone list at the interactive ceiling, the seed-only state, a headless base within the ceiling, field width with hidden and with real scrollbars, the list keys, the Tab order, the focus-loss limitation
  - e2e/names-labels.spec.ts (12 tests): the sounds label mode on the SVG and Canvas tiers (fit, truncation, level of detail, accessible names, picker and URL round trip, pair graph and planetary numerals, seed-only bases, Digits)
  - e2e/names-helpers.ts extended with the zone list, history, editor, Reroll-stub and table-reading helpers that 07-23 and 07-24 reuse
affects: [07-23, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expected values come from the engine (createNaming edit operations, createNameResolver, generateSounds, deriveName), the copy module, the CCRU preset module, fitSoundLabel and layoutTarget, never from the page; the whole zone table is compared by walking the panel's one scroller (readTable)"
    - "The Reroll button's random source is replaced by a fixed sequence (stubRerollRandom) so the seed it writes, and which zones that seed changes, is certain; a fixture guard in each test proves the lock is what keeps a locked sound"
    - "Seed determinism is proved in two fresh browser contexts (a second page in one context would restore the first one's saved slot instead of rebuilding from the seed)"
    - "Widths are measured twice: with Playwright's hidden scrollbars and in a browser of the spec's own started without --hide-scrollbars; measurements wait for the panel's 200 ms opening transition (settleAnimations)"
    - "Canvas labels are checked through what the canvas says (the keyboard announcement and callout) and what it paints (CanvasRenderingContext2D.fillText recorded by an init script), never through pixels"

key-files:
  created:
    - e2e/names-panel.spec.ts
    - e2e/names-labels.spec.ts
  modified:
    - e2e/names-helpers.ts
    - .planning/phases/07-naming-builder/deferred-items.md

key-decisions:
  - "The focus-loss limitation: 'a focused row scrolled out of the window' is pinned as it behaves (focus falls to the page, the uncommitted draft returns with the row, nothing is committed or lost) instead of hedged, so a change to the known limitation of 07-19 is a decision and not an accident"
  - "The 'seed-only base with a diagnostic tier override draws digits' check of the plan is replaced by what is true: a Canvas override cannot lift the ceiling (the tier is clamped), so above it there is no diagram at all; the spec asserts the summary stays, no canvas and no sound label exist, and labels=sounds stays in the address"
  - "names-open-ms is asserted below budgets.interactionMs as the plan asks (measured 23 to 28 ms against 100); other timing probes in the repo only log, so this is the one timing assertion of the plan and the first thing to relax if a slow runner ever flakes"
  - "The real-scrollbar run starts its own Chromium (a describe-level launchOptions is refused by Playwright); the hidden-scrollbar run keeps the plain layout as a second reading"

patterns-established:
  - "An open panel's wrapper animates max-height for 200 ms and can show its own bar meanwhile with real scrollbars: any width or box measurement right after opening waits for settleAnimations"

requirements-completed: []  # NAM-01 and NAM-02 are now observable end to end in Chromium; they stay Pending until the phase gate (07-25), as after 07-21

# Metrics
duration: about 1 h 10 min of wall time (the start was not stamped; estimated from the 07-21 STATE stamp at 15:50 MST), most of it 35 mutant builds and runs
completed: 2026-11-10
---

# Phase 7 Plan 22: Editing, Generation, Derivation, Renaming, Scale, Undo and Sounds Labels in Chromium Summary

**The Names panel's editing and display behaviour is proved in a real browser: a typed sound locks its zone and renames the demons that use it, Reroll and a new seed keep locked rows and regenerate the rest, one seed always gives one table, join order and smoothing match the engine, a rename touches one demon and Reset restores it, the header Undo walks five different edits back and forward in order, the zone list stays windowed at the interactive ceiling, and the sounds label mode fits, cuts and names zones on both the SVG and the Canvas tier. Every expected value comes from the engine, the copy module or the preset module; 29 app mutants were all killed.**

## Performance

- **Tasks:** 2 of 2 (plus one refinement commit)
- **Files created:** 2; **modified:** 2 (`e2e/names-helpers.ts`, `deferred-items.md`); no app, engine or frozen file touched
- **`$PLAN_BASE`:** `f680b840501590d91dc6c28c0fcd78440d4a0ace`

## Accomplishments

- **`e2e/names-panel.spec.ts` (20 tests, chromium-utc, 1280 x 800 unless a test sets another).** (1) A sound typed into zone 3 locks the row, shows the engine's name for 3::0 in the browser and the overlay detail and leaves 5::4 alone; `g1` stays in the field with `aria-invalid` and `Zone 3: Sounds can't contain digits.` until Escape. (2) Lock zone 7, Reroll (seed written from a stubbed random source): the whole table equals `generateSounds(createGenerator(newSeed, style), 28, locked)`, zone 7 unchanged, zone 8 changed, one locked zone; a seed typed into the field does the same. (3) `hollow-vector` in two fresh contexts gives the engine's table both times and `names=seed:hollow-vector`. (4) Low then high, Smooth names and Soft against `deriveName`: the NAME cell of 12::3, the three preview rows (raw and smoothed cells), `aria-current` on the column in use, `Smoothing makes no difference to these sounds.`. (5) Rename 12::3 from the Selection editor: caret and whole-name selection on entering edit mode, Escape cancels and focus returns to Rename, Save name, the `*` marker and hidden `, overridden`, twelve other rows and two neighbours unchanged, Reset, Enter saves. (6) The overlay editor stays on its demon and keeps its draft while the pointer crosses three other rows, Cancel rename and Escape (the overlay stays open), Enter saves, a second Escape closes the overlay. (7) A sound edit, a lock, an override, a Reroll and an import (a file the spec serialises with `serializeNaming`, set with `setInputFiles`), then the header Undo five times and Redo five times, each step checking the whole table, every lock, the seed and the name and state of 12::3 against an engine naming; then a base switch to 30 and back clears the history and the saved naming of 28 returns. (8) Ctrl+Z inside a field changes only its text, outside a field it undoes the last committed edit; an open rename survives header Undo and Redo and saves onto the restored naming. (9) At the interactive ceiling: ready, rows mounted under 80, `aria-setsize` equal to the base, Go to zone with the last label focuses its field, lock zone 0 and Reroll keeps zone 0 and follows the new seed at the first and last zone. (10) Above the ceiling: `seed-only`, the seed-only sentence, no list, lazy names in the browser, `Renaming is available up to {n} zones.` in the Selection editor, a new seed changes the names and the address. (11) `tier=headless` at base 28 is still ready with the list and full editing. (12) Field width (below). (13) Keys: ArrowDown, PageDown, Ctrl+End, PageUp, ArrowUp, Ctrl+Home, plain End as a caret key, one Tab stop, Tab to the lock, Space toggles it. (14) Tab order from the header toggle to the first list lock at bases 10 and 28. (15) A focused row scrolled out of the window.
- **`e2e/names-labels.spec.ts` (12 tests).** Base 10 original with the Sounds radio: the sounds are read from `CCRU_NAMING_PRESET`, all ten labels equal `fitSoundLabel` (text, font size in CSS px within 0.5, cut flag) at the px-per-unit measured from the svg, the first sound shrinks and the second keeps `LABEL_SIZE`, the node's accessible name is `zoneSoundAria(...)`, the Labels row reads `Sounds` (not `Numbers`), reload keeps the mode, Digits removes it and the parameter. The fit follows the zoom (five Zoom in clicks, then the floor: a preset layout still draws every label at R_px 4.6 and the long sounds are cut). The pair graph and planetary layouts keep numerals with `This layout shows numerals.`. At base 28 all 28 labels are fitted by the shared rule with the layout from `layoutTarget`, and a typed 16-letter sound is cut (`data-truncated`, the full sound in `data-sound-label` and in the accessible name). At the Canvas base 666 a `labels=sounds` link and the picker's Sounds radio are both accepted by the worker (no revert) and the keyboard ring on zone 1 announces `Zone 1, sound {sound}, {Region}` through `[data-canvas-live]` and the callout; Digits brings the numeral wording back; the painted text (recorded at `fillText`) holds no sound at fit and no numeral in sounds mode, and shows sounds once zoomed past `LABEL_MIN_RADIUS_PX`. Above the ceiling the summary stays, the mode stays in the address and a Canvas override cannot draw a diagram. Digits mode draws no sound label at bases 10 and 28.
- **`e2e/names-helpers.ts`.** `nameRow`, `soundField`, `lockButton`, `seedField`, `rerollButton`, `listMessage`, `gotoField`, `gotoZone`, `undoButton`, `redoButton`, `demonEditor(page, context)`, `nameCell`, `readTable` (walks the one scroller and returns every sound and lock, throwing if a zone was never mounted), `lockedZones`, `lockedOf`, `switchBase`, `pinFromOverlay`, `closeDemons`, `stubRerollRandom`, `settleFrames`, `settleAnimations`, `NAMING_ENV`.

## Measured values

| What | Value |
|---|---|
| `names-open-ms` (Expand click to the first mounted row, at the interactive ceiling, Canvas tier) | 23.4 to 28.4 ms over eight runs; budget `budgets.interactionMs` 100 ms |
| Mounted rows at the ceiling | under 80 (the assertion), `aria-setsize` equal to the base |
| Field widths, hidden scrollbars (Playwright default), 1280 x 800 and 375 x 667 | scroller content 214 px, sound field 150 px |
| Field widths, real scrollbar (own Chromium without `--hide-scrollbars`), both viewports | bar 10 px, scroller content 204 px, sound field 140 px; the 16-letter sample has `scrollWidth` equal to `clientWidth` (it fits) |
| UI-SPEC prediction | about 206 px content and 142 px field for an 8 px thin bar; the bar is 10 px in this Windows Chromium, so 204 and 140 |

## Task Commits

1. **Task 1: names-panel spec and the shared helpers** - `5a47282` (test)
2. **Task 2: names-labels spec** - `20969e2` (test)
3. **Refinement: headless base within the ceiling, a clearer windowing check, finite animations only** - `ac5378f` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and the deferred-items entry (hash in the final report).

## Verification Results

- **Runs, one invocation at a time against a fresh `npm run build`:** `names-panel.spec.ts` 20 passed three times in a row (about 25 s each, no flake) and once more on the final clean rebuild; `names-labels.spec.ts` 12 passed three times in a row (about 10 s each, no flake) and once more on the final clean rebuild; both specs without a project filter: 32 passed and 32 skipped (the New York project skips through the one `test.skip` preamble in each file). `names-smoke` and `names-session` (21 tests) still pass with the extended helper file. `npx tsc --noEmit` clean; `node scripts/check-repo.mjs` OK (11 gates, `base-ten` included) with the new files staged.
- **Acceptance greps:** `names-panel.spec.ts` has `INTERACTIVE_MAX_N + 2` 1, `names-open-ms` 1, `data-demon-name-context="overlay"` 1, `setInputFiles` 1, `test.skip(` 1, and no `4000` or `4002` word; `names-labels.spec.ts` has `labels=sounds` 13, `data-truncated` 6, `CANVAS_READY` 6, `eiaoung` 0, `test.skip(` 1, and no `4000` or `4002` word.
- **Not run on purpose:** `npm run test:swap` (no app, engine or golden file changed; the plan asks for it only after an app fix), `npm run check:weight` (known failing since 07-18, 07-24 owns it) and `npm run verify`.

## Mutation Checks

A scratchpad runner refused a find text that was absent, repeated or a no-op, rebuilt `out/` for each mutant, ran the whole spec of the mutant in the foreground, restored the source from the saved copy and checked `git diff --quiet -- <file>` (clean after every mutant). One at a time. `out/` was rebuilt after the last restore. 29 valid mutants, **all killed**; six more first failed to build (an unused identifier is a lint error in `next build`) and were replaced by an equivalent that keeps the identifiers used (the `b` rows).

| Mutant | Killed by |
|---|---|
| N1 a typed sound is never applied (ZoneList) | 5 tests: edit and lock, Undo order, Ctrl+Z, open rename, focus loss |
| N2 the lock click is ignored (ZoneList) | 4: Reroll, Undo order, the ceiling test, the list keys |
| N3 the join order always applied as high then low (NamesPanel) | join order and smoothing |
| N4 `aria-current` on the wrong column (NamesPanel) | join order and smoothing |
| N5b Reroll writes the current seed (NamesPanel) | 3: Reroll, Undo order, the ceiling test |
| N6 focus not returned to Rename after save, cancel or Escape (DemonNameEditor) | rename (Selection) and the overlay binding |
| N7 the name is not selected on entering edit mode | the same two |
| N8 the overlay pane follows hover instead of the bound demon (DemonsOverlay) | the overlay binding |
| N9 Escape in the editor reaches the overlay's own handler | the overlay binding (the overlay closes) |
| N10 overscan 8 raised to 120 (namingLimits) | the ceiling test (rows under 80) and the focus-loss test |
| N11 Ctrl+End one row short (zoneListModel) | the list keys |
| N12 the seed-only sentence not rendered (NamesPanel) | the seed-only test |
| N13b renaming offered at a seed-only base (DemonNameEditor) | the seed-only test |
| N14b a lock never changes the naming (namingSession) | 4: Reroll, Undo order, the ceiling test, the list keys |
| N15b Undo restores nothing (namingSession `restoreNaming`) | 3: Undo order, Ctrl+Z, open rename |
| N16 the typing-target guard bypassed (NumogramClient) | Ctrl+Z in a field |
| N17 Go to zone does not scroll (ZoneList) | the ceiling test |
| N18b every row is a Tab stop (ZoneList) | the list keys |
| N19 an imported file is not applied (NamesPanel) | Undo order |
| N20 the seed field commits a different seed (NamesPanel) | 3: Reroll, seed determinism, seed-only |
| L1 `data-truncated` never set (Projection) | zoom test, base 28 fit |
| L2 the label always at the layout size (Projection) | 3: base 10, zoom, base 28 |
| L3 the fit given twice the node radius (Projection) | 3: base 10, zoom, base 28 |
| L4 the Canvas announcement ignores sounds (keyboardModel) | both Canvas keyboard tests |
| L5 the Canvas static pass ignores sounds (draw.ts, first occurrence) | the Canvas painted-text test |
| L6 the worker guard rejects `sounds` (protocol) | 5: both Canvas keyboard tests, the painted-text test and the two above-the-ceiling tests (the summary view is built through the same guard) |
| L7 `labels=sounds` parsed as digits (labelScheme) | 7: base 10 spec, zoom, pair graph, planetary, Canvas ones |
| L8 the Labels row keeps `Numbers` in sounds mode | the base 10 spec |
| L9b the note ignores `numeralsLayout` (LabelSchemeControls) | pair graph and planetary |

The Names-panel mutants of `NamesPanel.tsx`, `ZoneList.tsx`, `DemonNameEditor.tsx`, `DemonsOverlay.tsx`, `namingSession.ts`, `namingLimits.ts`, `zoneListModel.ts` and `NumogramClient.tsx`, and the label mutants of `Projection.tsx`, `keyboardModel.ts`, `draw.ts`, `protocol.ts`, `labelScheme.ts`, `LabelsPanel.tsx` and `LabelSchemeControls.tsx`, were each restored byte for byte (`git diff --quiet` clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan detail corrected] The 'seed-only base with a diagnostic tier draws digits' case cannot exist**
- **Found during:** Task 2 (a probe at `?base={ceiling + 2}&labels=sounds&tier=canvas`)
- **Issue:** the tier is clamped by the base: a Canvas override above the interactive ceiling still renders the headless summary, so no diagram exists in which a sound could be drawn or replaced by digits (UI-SPEC "Seed-only check" assumed one).
- **Fix:** the spec asserts the actual contract: the summary stays, no canvas and no `[data-sound-label]`, `labels=sounds` stays in the address, with and without the override. No app change.
- **Commit:** `20969e2`

**2. [Rule 2 - flake removed] Reroll's new seed is random, so 'zone 8 changed' would be wrong one run in about 67**
- **Found during:** Task 1 (reading the generator: depth class 1 has only a few dozen sounds, 67 in the harsh bank)
- **Fix:** `stubRerollRandom` replaces `crypto.getRandomValues` for the two-word request with a fixed sequence, and each Reroll test proves with the engine that without its lock the locked zone would have changed, so the lock is what keeps it. The seed field's text is still read from the page, and the whole table is compared with the engine's.
- **Commit:** `5a47282`

**3. [Rule 3 - blocking] A width measured right after opening was 10 px too narrow with real scrollbars**
- **Found during:** Task 1 (the first real-scrollbar run gave a 130 px field)
- **Issue:** `CyberPanel`'s wrapper animates `max-height` for 200 ms and shows its own bar until the animation ends; the scroller's width then returns to normal. Not a Phase 7 defect (see `deferred-items.md`).
- **Fix:** `settleAnimations` (finite animations only) before any width measurement.
- **Commits:** `5a47282`, `ac5378f`

### Additions beyond the plan's list (each pins a behaviour a mutant or a deferred item pointed at)

Ctrl+Z outside a field, an open rename across Undo and Redo, `tier=headless` at a base within the ceiling, the Tab order of the panel, the focus-loss limitation of 07-19, the fit following the zoom with the preset layout's always-on labels, planetary numerals, the picker toggle at a Canvas base (research Pitfall 5), and the Escape and Enter keys of the overlay editor.

## Items from earlier summaries, covered and left

Covered here: the caret and selection on entering edit mode; focus returning to Rename after Save, Cancel, Escape and Reset; real Enter and Escape (Escape closes only the editor, not the Demons overlay); `onEditingChange` reaching the overlay while the pointer crosses rows; undo and redo with a demon editor open; the Tab order of the panel up to the list; the field widths at 375 x 667; Canvas tier sounds; a focused row scrolled out of the window (pinned as a limitation).

**Left to 07-23 (collisions, import and export, previews):** the Names box top staying put while a jump opens an editor next to the real Selection panel; the real label scheme in the jump text; the Tab order through Show repeated names, the jump buttons and the inline editor to Export; the scan at the 1,024 limit under the 6.3x throttle; the two collision announcements. **Left to 07-24 (geometry):** overlap and clearance at every viewport, the desktop stack invariants, planetary controls, the layout re-runs and the page weight. **Left to the 07-25 manual checkpoint:** the screen-reader reading of the announcements.

## Issues Encountered

- Six mutants (N5, N13, N14, N15, N18, L9) first failed to build because an unused identifier is a lint error in the production build; each was replaced by a mutant with the same effect that keeps the identifier used.
- The long mutation batches were moved to the background by the tool after 180 s; they still ran one at a time, and the working tree was checked clean after each.

## Known Stubs

None. No application code was written.

## Threat Flags

None: no endpoint, storage key, file access or trust boundary was added. T-07-24 (false green) is mitigated by the engine-computed expectations, the fixture guards and the 29 killed mutants; T-07-04c (the imported file) is mitigated: the file is produced by `serializeNaming` in the spec and the page's own validator reads it.

## Next Phase Readiness

07-23 can import the helpers (`readTable`, `demonEditor(page, 'collision')`, `pinFromOverlay`, `stubRerollRandom`, `settleAnimations`) and should remember: the Names box is the fixed ancestor of `[data-names-live]`, the rows are virtualized (use `gotoZone` or `readTable`), a `?base=` load leaves one dead history entry (start at base 10 and switch through the picker for a clean history), and the panel's measurements need `settleAnimations`. 07-24 owns geometry at every viewport and the page-weight baseline.

## Self-Check: PASSED

- `e2e/names-panel.spec.ts`, `e2e/names-labels.spec.ts` and `e2e/names-helpers.ts` exist and are committed; commits `5a47282`, `20969e2` and `ac5378f` exist on `main`, each ending with the `Co-Authored-By: Claude Sonnet 5` trailer.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty; `git diff --name-only f680b84 HEAD` lists only the three e2e files (and, after the docs commit, `.planning` files); nothing was pushed.
