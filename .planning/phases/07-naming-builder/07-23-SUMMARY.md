---
phase: 07-naming-builder
plan: 23
subsystem: e2e-naming-io-collisions-and-previews
tags: [naming, e2e, playwright, import-export, autosave, collisions, preview, ccru-preset, mutation-testing, typescript]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-21 and 07-22 (the mounted Names panel, e2e/names-helpers.ts and its conventions), 07-17 (panel blocks, Import and Export, preview notice), 07-18 (session, history, autosave, address), 07-20 (collision report and the inline editor), 07-16 (the demon name editor), 07-08 and 07-10 (the file format, validator and collision engine)
provides:
  - e2e/names-io.spec.ts (32 tests): export and import through the real download and the real file chooser, a wrong-base file and Use its seed here, eleven hostile files, the size cap at its boundary, a seed-only base, autosave per base, restore by fresh navigation, a full and a blocked store, collisions at four places with jumps, announcements and Tab order, the sliced scan under a 6.3x CPU throttle, the CCRU preset and base 12
  - e2e/names-preview.spec.ts (19 tests): the unsaved preview and its disabled controls, Keep and Back, equal link forms, a names=ccru preview, link forms and hostile links, a seed-only link, honest sharing, the seed field
  - e2e/names-helpers.ts extended with file, slot, status, collision, live-carrier, browser-name and storage-write helpers that 07-24 and 07-25 can reuse
affects: [07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expected values come from the engine (createNaming and its edit operations, serializeNaming, validateNamingJson, createNameResolver, findCollisions, canCertify), the copy module, the CCRU preset module and the tier table, never from the page; a copy sentence that the page and the spec both read from one module is also typed out once as a literal"
    - "A saved slot is seeded before the page loads with a write-if-absent init script; a spy on Storage.prototype.setItem (installed after the seed) turns 'writes nothing' into a fact about the writes, identical bytes included"
    - "The live carrier is recorded by a MutationObserver, so the order of announcements is asserted, not only the last text"
    - "A control for a measurement: pinning a demon does move the Names box, so the less-than-1px assertions around a jump are shown to be able to fail"
    - "Timings are logged and never asserted; the scan under CPU throttle is judged by what the page does meanwhile (frames painted, task turns that ran between slices, the Checking state shown)"

key-files:
  created:
    - e2e/names-io.spec.ts
    - e2e/names-preview.spec.ts
  modified:
    - e2e/names-helpers.ts

key-decisions:
  - "The plan's 'focus returns to that jump button' is asserted as the 07-20 component actually behaves: after Save name a unique name takes the demon out of its group, so its jump button is gone; focus goes to the first jump of the line that kept the name (groups of three) or to the Show repeated names toggle (groups of two), never to the page. Cancel and Escape (no change) do return to that demon's own jump button"
  - "A collision jump cannot be reached in preview from a browser: a link's naming is always a generated table or the CCRU preset (no typed sounds, locks or overrides), and the engine certifies those unique (a search of about 6,000 generated namings across bases, styles, joins, smoothing and seeds found no repeat). The preview spec asserts the report reads None there; the 'Keep this naming to rename demons.' hint stays covered by the 07-20 render tests"
  - "The two announcement sentences are asserted in order: a rename gives `Renamed ...` then `{g} repeated names.`; an Undo gives `Names restored from history.` then the count; the polite region keeps only the last text (left to the 07-25 screen-reader checkpoint, no app change)"
  - "The size cap is asserted at its boundary with a valid file padded to the cap: one byte over is refused with `8 MB`, exactly the cap imports. 'Before the file is read' is not observable except by timing (the validator has its own cap), so only the outcome is asserted"

patterns-established:
  - "Seeding a slot: write-if-absent init script, then the storage spy, then the first navigation"
  - "Walking the virtualized Demons browser (readBrowserNames) and the zone list (readTable) leaves the scroller at its end: assert a mounted row before walking, or scroll back to the top"

requirements-completed: []  # NAM-03 and NAM-04 are now observable end to end in Chromium; they stay Pending until the phase gate (07-25), as after 07-21 and 07-22

# Metrics
duration: about 2.5 h of wall time (the start was not stamped), most of it 40 mutant builds and runs
completed: 2026-11-11
---

# Phase 7 Plan 23: Import and Export, Autosave, Collisions, the CCRU Preset and Shared-Link Previews in Chromium Summary

**NAM-03 and NAM-04 are proved in a real browser: Export writes `ccrug-names-base28.json` and a fresh browser imports it through the real file chooser to the same naming (undoably); eleven hostile files and a wrong-base file are refused with nothing applied, no write and the input cleared; one slot per base is written after the first edit only and restored by fresh navigation; a full or blocked store shows the Couldn't save line; the repeated-names report equals the engine at four places and a jump opens the inline editor without moving the Names box; a link over a different saved slot is an unsaved preview that writes nothing, Keep replaces the slot undoably and Back restores it; base 10 opens on the 45 canonical names and base 12 shows none. Every expected value comes from the engine, the copy module or the preset module; 39 app mutants were killed.**

## Performance

- **Tasks:** 2 of 2 (plus two refinement commits)
- **Files created:** 2; **modified:** 1 (`e2e/names-helpers.ts`); no app, engine, perf or frozen file touched (`git diff --name-only 8bbe577 HEAD` lists the three e2e files)
- **`$PLAN_BASE`:** `8bbe5776ff651534f9014af233facb3199100418`

## Accomplishments

- **`e2e/names-io.spec.ts` (32 tests, chromium-utc, 1280 x 800).** (1) Edit zone 3 to `gl` and rename 12::3 to `Zed`, press Export names: the download is `ccrug-names-base28.json`, its text equals `serializeNaming(engine naming, pretty)`, schema `ccrug.naming/1`, base 28, `zones[3]` `gl`, locks `[3]`, overrides `{"69":"Zed"}`; a fresh context imports it through the real file chooser (`filechooser` event, one file, `accept` `.json,application/json`): `importSuccess(28, 28, 1)`, the whole table and locks equal the engine's, the browser cell of 12::3 shows `Zed` with the marker, the slot is the compact form of the imported naming, the inline Undo restores the default naming and the slot follows. (2) A base-30 file at base 28 is refused with the base-30 sentence (also typed out as the UI-SPEC literal), nothing applied, then Use its seed here applies only seed, style, join and smoothing (equal to `createNaming` at base 28), with an inline Undo. (3) Eleven hostile files (not JSON, a NaN literal, bytes that are not UTF-8, format version 2, not a names file, a `__proto__` override key built as text, `1e999` base, locks that are not zones, a control character, a digit, one zone short), each: the sentence the engine validator and copy module give, `data-kind="error"`, no Use-its-seed or Undo button, the table and seed unchanged, the file input empty, no slot, zero storage writes. (4) The cap: a valid file padded to the cap plus one byte is refused with `8 MB`, a file of exactly the cap imports. (5) At the first base above the ceiling a file with zones is refused with the seed-only sentence, a seed-only file imports (address `names=seed:abc&nstyle=soft`), and Export writes the seed record only (no zones, locks or overrides). (6) Autosave: an untouched base writes nothing (zero storage writes), one edit writes exactly one slot under `ccrug.naming.v1.28` and the line says `Saved in this browser for base 28.`, base 30 opens on its default and writes nothing, base 28 returns with its edit and lock and restoring writes nothing; a fresh navigation restores base 28 and, on the bare URL, a renamed demon at base 10 (address still empty, marker shown). (7) A store whose `setItem` throws `QuotaExceededError`, and one whose `localStorage` getter throws: the `Couldn't save in this browser...` line in the refusal colour, a second edit still applies, Export still gives a copy, no page error. (8) Collisions: typing `zz` into zones 1 and 2 (and 1 to 3) at base 28, with a zone selected, at a Canvas base (200 groups) and in xenotation: count, demons and line equal `findCollisions`, 20 lines then `Showing 20 of 26 names.` and Show more names, every line, jump text and accessible name equal the engine's report (also the UI-SPEC sentence typed out), the jump opens `[data-demon-name-context="collision"]` alone with focus in its prefilled field, the Names box top moves by less than 1 px and nothing is pinned (a control step shows that a pin does move the box), a unique name drops the counts to the engine's report, focus lands where the component puts it, the announcements follow. (9) Announcements and Tab order: `26 repeated names.` then `No repeated names.` once each and nothing for typing; after Undo `Names restored from history.` then the count; Tab order smoothing, Show repeated names, jump buttons, editor field, Save name, Cancel rename, Export names, Import names, Go to zone (and back with Shift+Tab), and Export, Import, Undo this change, Go to zone. (10) The scan at the 1,024 limit with the CPU throttled 6.3x through a CDP session stays sliced. (11) Above the limit the block says `Not checked above 1024 zones.` (12) Base 10 opens on CCRU with all 45 canonical names from the preset module, Generated gives the engine's generated names, CCRU brings the canonical ones back; base 12 has no Source row and no cell equal to a canonical name.
- **`e2e/names-preview.spec.ts` (19 tests).** A link with no slot is the working naming and writes nothing until an edit; a link over a different saved slot opens the panel by itself as an unsaved preview (notice text, `unsaved preview` tag, `Not saved...` line, the link's seed and table, seed read only, Reroll, style, join, smoothing and Import disabled, every mounted sound field read only and every lock disabled, typing changes nothing, both name editors disabled, Export writes the previewed naming, zero storage writes, the slot byte for byte unchanged); Keep replaces the slot (exactly one write), says so, moves focus to the seed and is undone by the inline and the header Undo (the slot is rewritten); Back restores the slot, moves focus to the seed and writes nothing; a link of the same form as the slot is no preview; a `names=ccru` link previews the preset at base 10 and Keep saves it; the default address has no `names`, Generated writes `names=seed:ccrug`, CCRU removes it; `names=ccru` is ignored at base 28; the style, join and smoothing companions are read, unknown values fall back, and are written back from the panel; six hostile links (65 characters, a control character, a separator inside, a trailing separator, a trailing newline, an empty seed) fall back to the default while `selected` and `labels=sounds` still work; a seed link at the first base above the ceiling is seed-only, names the demons from the seed, rewrites `nstyle` on a change and never writes; the header tag, the panel note and the Share title say that links do not carry edits; the seed field commits on Enter, Tab and blur, refuses an empty seed, reverts on Escape, trims, and a Reroll over a draft wins.
- **`e2e/names-helpers.ts`.** `AUTOSAVE_WAIT_MS`, `exportButton`, `importButton`, `importInput`, `statusLine`, `savedLine`, `inlineUndo`, `collisionsBlock`, `collisionsLine`, `collisionToggle`, `jumpButton`, `downloadText`, `chooseFile`, `importCopyContext`, `readSlot`, `seedSlot`, `slotKeyOf`, `typeSound`, `renamePinned`, `recordLive`, `liveLog`, `readBrowserNames`, `spyStorageWrites`, `storageWrites`.

## Measured values

| What | Value |
|---|---|
| Scan at base 1024 (the limit), 6.3x CPU throttle, Enter to answer | 2,460 and 2,485 ms (logged, never asserted) |
| Frames painted and task turns that ran meanwhile | 115 frames; 1,198 to 2,393 task turns; longest task 53 to 58 ms; Checking line shown |
| Contract asserted | Checking shown, at least 3 frames, at least 10 task turns between slices (a never-yielding job gives none: killed by C6) |
| Repeated names at base 28 with zones 1 and 2 equal | 26 names across 52 demons (from the engine); 200 and 400 at base 202; 1,022 and 2,044 at base 1024 |
| Live carrier after a rename | `["26 repeated names.","Renamed 1::0 to Qwerty.","25 repeated names."]` |
| Live carrier after Undo | `["Names restored from history.","26 repeated names."]` |

## Task Commits

1. **Task 1: names-io spec and the shared helpers** - `e183042` (test)
2. **Task 2: names-preview spec** - `9ebe365` (test)
3. **Refinement: count the storage writes** - `12975f8` (test)
4. **Refinement: pin what mutants showed untested** - `820f5c3` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Verification Results

- **Runs on the final clean build (`npm run build` from HEAD sources, `git diff HEAD -- app engine perf` empty), one invocation at a time:** `names-io.spec.ts` 32 passed three times in a row (about 48 s each, no flake); `names-preview.spec.ts` 19 passed three times in a row (about 24.5 s each, no flake); both specs without a project filter: 51 passed and 51 skipped (the New York project skips through the one `test.skip` preamble in each file). `npx tsc --noEmit` clean; `node scripts/check-repo.mjs` OK (11 gates) with the new files staged.
- **Acceptance greps:** `names-io.spec.ts` has `waitForEvent('download')` 3, `setInputFiles` 1, `__proto__` 4, `QuotaExceededError` 1, `data-demon-name-context="collision"` 1, `goto('/numogram/')` 1, `goto('/numogram/?base=28')` 1, `page.reload` 0 and no quoted canonical name; `names-preview.spec.ts` has `data-names-preview-notice` 1, `data-names-keep` 4, `data-names-revert` 2, `INTERACTIVE_MAX_N + 2` 1 and `test.skip(` 1.
- **Not run on purpose:** `npm run test:swap` (no app, engine or golden file changed), `npm run check:weight` (known failing since 07-18, 07-24 owns it) and `npm run verify`.

## Mutation Checks

A scratchpad runner refused a find text that was absent, repeated or a no-op, refused to start unless `git diff HEAD -- app engine perf` was empty, rebuilt `out/` for each mutant, ran the named tests in the foreground, restored the file from `git show HEAD:<file>` and checked `git diff --quiet HEAD -- app engine perf` (clean after every mutant). One at a time. `out/` was rebuilt from clean source after the last restore and the specs re-run green. **39 valid mutants, all killed** (the engine one, I8, was applied and restored in place; the plan edits no engine file).

| Mutant | Killed by |
|---|---|
| I1 export file name changed | export round trip, seed-only export |
| I2 size check off by one at the cap (`>=`) | size cap |
| I3 file input never cleared | all 11 hostile files |
| I4 Use its seed here applies another action | wrong base |
| I5 Import enabled in preview | preview |
| I6 export says nothing | export round trip |
| I7 a wrong-base refusal offers no seed | wrong base |
| I8 (engine) a non-numeric override key accepted | `__proto__` file |
| A1 autosave also writes untouched sessions | 13: all hostile files, autosave, no-slot link |
| A2 one slot key for every base | restore by fresh navigation |
| A3 a failed write reported as saved | full store |
| A4 storage unavailable to the app | autosave (2), preview |
| A5 saved slots never read | restore, preview, same form |
| P1 preview controls not disabled | preview |
| P2 no focus to the seed after Keep | Keep |
| P3 sound fields editable in preview | preview |
| P4 link form comparison inverted | preview, same form |
| P5 the panel does not open for a preview | preview |
| P6 Keep not counted as an edit | Keep |
| P7 Back counted as an edit (a write of identical bytes) | Back (only the storage spy sees it) |
| P8 the address never carries `names` | 4: Back, Generated, seed-only link, seed field |
| P9 `njoin` never written | link forms |
| P10 the edge check before trimming removed | trailing separator and trailing newline links |
| H1 Share title never says edits are not carried | honest sharing |
| H2 the header tag never says edits | honest sharing, Back, same form |
| C1 focus not returned after a rename | collisions at base 28 (2) |
| C2 count announcement has the wrong number | collisions, announcements |
| C3 one line too many per page | collisions |
| C4 jump accessible name swapped | collisions (the typed-out sentence) |
| C5 jump text ignores the label scheme | xenotation |
| C6 the scan never yields | scan under throttle |
| C7 editor does not take focus or select | collisions, Tab order |
| C8 Save and Cancel swapped | Tab order |
| S1 seed blur does not commit | seed field |
| S2b Escape keeps the draft | seed field |
| R1 base 10 default not the CCRU preset | base 10 |
| R2 choosing CCRU applies Generated | base 10 |
| R3b the Source row shown at every base | base 12 |
| F1 the failed line shows the untouched text | full and blocked store |

Not counted as killed, and why (each handled): I8, A2 and P8 first failed to build (an unused identifier is a lint error) and were rewritten to keep the identifiers used; **P10 survived** (the first hostile links had the control character inside the seed, which `normalizeSeed` alone refuses) and two edge cases (trailing line separator, trailing newline) were added; **C3 survived in its first form** (the spec reads the same constant from the mutated file) and became an off-by-one in `linesShown`; **C4 survived** (the spec read the same copy function as the page) and the UI-SPEC sentence is now typed out once; **C7 survived** (Chromium's `select()` also focuses) and the mutant now removes both calls; **S2 is equivalent** (the seed field re-syncs its draft from the committed seed whenever it is no longer dirty, so the explicit `setDraft` is redundant) and S2b (the dirty flag kept) is killed; **R3 is not a valid mutant** (the spec imports `namingSession`, so the mutated module made the whole spec file fail to load) and R3b, a page-only change, is killed. No mutant of the Names-box top exists: the jump has no path that pins, so the assertion is checked by a control (a pin moves the box by at least 1 px) instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan detail corrected] 'Focus returns to that jump button' only holds while the demon stays in its group**
- **Found during:** Task 1 (the first collision run, then reading `focusAfterEditor`)
- **Issue:** with `zz` in zones 1 and 2 every group has two demons, so a unique name leaves one demon, the line disappears and the renamed demon's jump button no longer exists
- **Fix:** the spec asserts the component's contract: the next demon's jump of the same line when the group had three demons (zones 1 to 3), the toggle when it had two; Escape and Cancel return to the demon's own jump. No app change.
- **Commit:** `e183042`

**2. [Rule 1 - plan detail corrected] The collision jump in preview is not reachable in a browser**
- **Found during:** Task 2 (an exhaustive search of seeds, styles, joins, smoothing and bases for a previewed naming with a repeat found none)
- **Issue:** a link carries only a seed or the preset, and the engine certifies those tables unique, so a previewed naming never has a repeat and its jump buttons never exist
- **Fix:** the spec asserts the block reads `None. Every demon name is unique.` in preview with no toggle; the hint sentence stays covered by the 07-20 render tests. No app change.
- **Commit:** `9ebe365`

**3. [Rule 3 - blocking] Walking a virtualized list leaves it at its end**
- **Found during:** Task 1 and 2 (rows near the top were not mounted after `readTable`)
- **Fix:** assert a mounted row before walking the table, or scroll the single scroller back to the top.
- **Commits:** `e183042`, `9ebe365`

### Additions beyond the plan's list (each pins a behaviour a mutant or an item left to this plan pointed at)

The real file chooser (`filechooser` event) next to `setInputFiles`; the size cap at its boundary; eleven hostile files instead of four; a seed-only export; a blocked store as well as a full one; the storage-write spy; the announcement order and the Undo overlap; the Tab order with and without an open editor and the Undo this change step; a xenotation scheme for the jump text; a Canvas base and a zone-selected jump; the scan limit sentence; a `names=ccru` preview at base 10; the written link companions; the seed field (blur timer, Tab, Escape, empty, trimmed, Reroll over a draft); and a control for the Names-top measurement.

## Items from earlier summaries, covered and left

Covered here: the Names box top staying put while a jump opens an inline editor beside the real Selection panel (nothing selected, a zone selected, a Canvas base) with a control; the real label scheme in the jump text (xenotation); Tab order through Show repeated names, the jump buttons and the inline editor to Export names; the scan at the 1,024 limit under the 6.3x throttle (by the sliced-scan contract, timings logged); both collision announcements and their overlap with `Renamed ...` and `Names restored from history.`; the real file chooser and download; focus to the seed after Keep and Back; the seed blur timer.

Left: the screen-reader reading of the announcements (07-25 manual checkpoint; the order is pinned here); geometry at every viewport, overlap and clearance, the desktop stack and planetary controls, the layout re-runs and the page-weight baseline (07-24); a collision jump in preview (unreachable from a browser, see deviation 2); "refused before the file is read" beyond its outcome (not observable without timing).

## Issues Encountered

- Three mutants failed to build on an unused identifier and one batch of replacements briefly corrupted a spec file when a `$'` sequence in a replacement string was interpreted by `String.replace` (the file was repaired and every later edit script uses function replacements).
- The session ended during the mutation batch; the working tree was found with one mutant applied (`defaultNamingFor`), restored from HEAD, `out/` rebuilt from clean source, and the remaining mutants run with a runner that restores from `git show HEAD:<file>`.

## Known Stubs

None. No application code was written.

## Threat Flags

None: no endpoint, storage key, file access or trust boundary was added. T-07-04d (a `__proto__` file applies nothing, kills I8), T-07-05c (one byte over the cap is refused, the cap itself accepted, kills I2), T-07-09b (a full store shows the failed line and no page error, kills A3 and F1) and T-07-17f (the slot is untouched in preview by value and by write count, Keep is one write and undoable, kills P1, P6 and P7) are mitigated.

## Next Phase Readiness

07-24 owns geometry at every viewport, the desktop stack, planetary clearance, the layout re-runs and the page-weight baseline (`update --reason`); it can reuse `namesTop`-style box measurements (always after `settleAnimations`). 07-25 should listen, at the manual screen-reader checkpoint, for the announcement overlap recorded above (a rename gives `Renamed ...` then the count; an Undo gives `Names restored from history.` then the count; the polite region keeps only the last text). The viewer's carrier updates a text node, so a sentence announced twice in a row would not change the DOM (read from the code, not tested here).

## Self-Check: PASSED

- `e2e/names-io.spec.ts`, `e2e/names-preview.spec.ts` and `e2e/names-helpers.ts` exist and are committed; commits `e183042`, `9ebe365`, `12975f8` and `820f5c3` exist on `main`, each ending with the `Co-Authored-By: Claude Sonnet 5` trailer.
- `git diff --name-only 8bbe577 HEAD` lists only the three e2e files; `git diff HEAD -- app engine perf` is empty; `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty; nothing was pushed.
