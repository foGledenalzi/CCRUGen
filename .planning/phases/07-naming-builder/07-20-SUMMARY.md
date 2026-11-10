---
phase: 07-naming-builder
plan: 20
subsystem: app-names-panel
tags: [naming, collisions, sliced-scan, main-thread, cancellation, jump-to-demon, inline-editor, focus-return, pure-model, browser-verified, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-10 (createCollisionJob, canCertify, findCollisions, COLLISION_SCAN_MAX_N), plan 07-11 (NAMES_COPY and the collision sentences, COLLISION_LINES_STEP, COLLISION_JUMPS_SHOWN, COLLISION_SLICE_MS, collisionScanLimit), plan 07-16 (DemonNameEditor with context collision, autoEdit and onDone), plan 07-17 and 07-19 (the NamesPanel shell and its block 9 insertion point), plan 07-18 (the NamingContext provider the block reads)
  - phase: 06-canvas-tier-and-worker
    provides: PENDING_GRACE_MS (150 ms) for the "Checking..." grace
provides:
  - app/lib/collisionSchedule.ts, collisionPlan (certify, scan or skip), runSlicedJob (injected clock and scheduler, cancel), browserSchedule, SliceDeps
  - app/components/names/CollisionReport.tsx, the container CollisionReport({ open, initialReport? }), the presentational CollisionReportView, and the pure decisions phaseOf, jumpsOf, linesShown, jumpOutcome, collisionAnnouncement
  - the collision report mounted as block 9 of NamesPanel for ready and preview
  - 28 scheduling tests, 37 new collision block tests (178 in the extended panel file), 13 + 29 + 6 mutants of the app code and 25 mutants of the wiring against a 90-check scratch Chromium run
affects: [07-21, 07-22, 07-23, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A sliced job is driven by a pure runner with an injected clock and scheduler: each slice reads the clock once for its own deadline and gives the engine job a yield predicate that is true strictly after it, so the fake-clock tests pin the boundary, and cancel() also silences a report finished inside the very step that was cancelled"
    - "A stale answer is impossible by two independent guards (a generation counter and the job's own cancel); each alone is equivalent to both, so only removing both is a valid mutant"
    - "The block keeps the last answer on screen during the 150 ms grace, then shows only 'Checking...' (no count, no list) until the newer answer lands; a skipped check and a certified check never show it"
    - "Focus after an inline editor closes follows a fallback chain because a rename usually takes the demon out of its group: its own jump button, else the first jump of the line that kept the name, else the toggle, else the block (tabIndex -1), so focus is never dropped to the page"
    - "The re-check is keyed on the naming object (not the revision), so Keep, which gives the same naming a new revision, does not rescan"

key-files:
  created:
    - app/lib/collisionSchedule.ts
    - app/components/names/CollisionReport.tsx
    - tests/app/collisionSchedule.test.ts
  modified:
    - app/components/names/NamesPanel.tsx
    - tests/app/namesPanelRender.test.ts

key-decisions:
  - "Re-check keyed on [naming, preset, base, open, limit], not on the revision (the plan text says rev): a naming object changes exactly when its content does, and Keep gives the same object a new revision, which must not rescan; the focus gate compares the answer's naming with the current one for the same reason"
  - "collisionPlan also skips a table that is not one sound per zone and clamps the limit to COLLISION_SCAN_MAX_N, beyond the plan's three cases: the engine throws a RangeError for both, and an uncaught throw in an effect would unmount the panel"
  - "The two announcement sentences ('{g} repeated names.' and 'No repeated names.') come from a pure helper in CollisionReport.tsx, not the copy module: they are UI-SPEC wording that the copy module lacks, namingCopy.ts is not in this plan's files, and editing it means a mounted-file change (test:swap); recommended to move into the copy module in 07-21, which has to run test:swap anyway"
  - "The preview hint shows directly under the line that was jumped from (status line scoped to that line), so it is next to the button the visitor pressed; the visitor cannot miss it far above a 20-line list. It clears when the state leaves preview, and returning to preview does not bring it back"
  - "A new naming closes an open inline editor and the toggle closes it when the list collapses (it never resurrects on expand): an editor stays bound to the demon it was opened on, and a changed naming or a hidden line is a reason to drop an unsaved draft"
  - "The root takes programmatic focus (tabIndex -1) so the focus fallback has a last target when a save leaves no collision, plus a data-state hook (pending, checking, none, some, skip) for the e2e plans; data-count and data-demons are present only while an answer is shown (never while checking, skipped or before the first answer), and during the 150 ms grace the previous answer stays on screen"
  - "NamesBody receives the panel's open flag (always true while it is mounted) so the plan's 'passing open' wording holds and the check still runs only while the panel is open"
  - "The editor heading (net-span in the active scheme and the kind tag) is rendered by the collision mount, because DemonNameEditor's edit mode has no header of its own"

patterns-established:
  - "Mutation results that look equivalent are proven so by construction (double guards) and every other survivor is answered with a test or a scenario in the same plan (five here: W05, W09, W13, W21 and U15)"
  - "A scratch Chromium harness (esbuild bundle of the real NamesPanel over the real session reducer, kept in the session scratchpad, not committed) pins what node cannot: timers, focus, scrolling, main-thread gaps"

requirements-completed: []  # NAM-03 and NAM-02 stay Pending: the block is built and proved but nothing mounts NamesPanel until plan 07-21; the orchestrator marks them at the phase gate

# Metrics
duration: ~47min (start was not stamped; estimated from the first test run at 21:14Z to the final full run at 21:54Z, plus about 7 min of reading)
completed: 2026-11-10
---

# Phase 7 Plan 20: Collision Report Summary

**Block 9 of the Names panel counts repeated demon names without freezing the page and lets the visitor fix them by hand: a generated table is certified at once, any other table up to 1,024 zones is scanned on the main thread in 8 ms slices that a newer edit cancels (a stale answer cannot report), 'Checking...' shows only after the 150 ms grace, and each repeated name lists up to four jump buttons that open the demon name editor inline under that line (no pin, so the Names box never moves) with focus returning to the right button afterwards.**

## Performance

- **Duration:** about 47 min (estimate, see Metrics), including 13 + 29 + 6 + 25 mutants, a 90-check browser run and the full unit run in two timezones
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit, plus two follow-up commits)
- **Files created:** 3; **modified:** 2 (`NamesPanel.tsx`: 7 added and 3 changed lines, `namesPanelRender.test.ts`: +513 lines)
- **`$PLAN_BASE`:** `78340482679ecf8f5b0b9937e4ebd0494e89dc51`

## Accomplishments

- **Scheduling (`app/lib/collisionSchedule.ts`).** `collisionPlan(naming, preset, limit)` is `certify` when the engine's `canCertify` holds (any base, no cap), `scan` when the table is not certifiable and the base is within `min(limit, COLLISION_SCAN_MAX_N)`, and `skip` otherwise, including a seed-only naming and a table that is not one sound per zone (the engine refuses both with a RangeError, so the app decides first). `runSlicedJob(job, { schedule, now, sliceMs }, onDone)` schedules its first slice (never runs it inside the call), reads the clock once per slice for that slice's own deadline and hands the job `() => now() > deadline` (strictly after), schedules the next slice while the job answers null, calls `onDone` once with the report, and `cancel()` stops every later slice and also suppresses a report finished inside the cancelled step. `browserSchedule` is a `MessageChannel` (port closed after it fires) with a zero-delay `setTimeout` fallback. No worker, no wall clock, nothing but injected dependencies.
- **The block (`CollisionReport.tsx`).** Container `CollisionReport({ open, initialReport? })`: renders nothing outside a provider and outside the ready and preview states; while open it runs one job per naming (`useEffect` on the naming, preset, base, open and limit): a skipped plan sets a null report at once, otherwise `createCollisionJob` is driven by `runSlicedJob` with `performance.now()` and `COLLISION_SLICE_MS`, a `PENDING_GRACE_MS` timer sets `checking` only if no answer came, and the cleanup retires the generation, cancels the job and clears the timer; only the current generation may set the answer. A changed count after the first answer is announced through the panel's live carrier (`{g} repeated names.`, `No repeated names.`; nothing for the first answer or an unchanged count). View `CollisionReportView`: root `[data-names-collisions][data-count][data-demons][data-state]` with `aria-busy` while checking, the `Collisions` eyebrow, then `Checking...`, `Not checked above {limit} zones.`, `None. Every demon name is unique.` (gray-400) or `{g} repeated names across {d} demons.` (gray-100, never red) with a `Show repeated names` / `Hide repeated names` toggle (`aria-expanded`); the list is a `ul role="list"` of at most 20 lines per page, each `[data-collision-name]` line the name (text node, wraps anywhere, own direction), up to four 24px jump buttons `[data-collision-jump="{mesh}"]` labelled with the net-span in the active scheme and named `Rename demon {a}::{b}, currently {name}` (the live name), and `+{k} more` from the exact group size; `Showing {n} of {g} names.` and `Show more names` appear when lines are hidden (the list the engine returns is bounded at 2,000, so the count line can outlive the button).
- **The jump.** In the ready state a jump opens `DemonNameEditor` in the collision context in edit mode directly under that line (one editor at a time, headed by the demon's net-span and kind tag), scrolls it into the panel scroller (`scrollIntoView({ block: 'nearest', behavior: 'auto' })`) and never pins anything (the file has no `onPinInfo`); in preview it opens nothing, shows `Keep this naming to rename demons.` under that line and announces it. After a save, a cancel or Escape the editor closes and focus returns to that demon's jump button, else the first jump of the line that kept the name, else the toggle, else the block, once the answer for the new naming is in. The editor closes when the naming changes under it or the list collapses.
- **Mount.** `NamesPanel` mounts `<CollisionReport open={open} />` at the block 9 comment for ready and preview, after the summary and before import and export; `NamesBody` takes the open flag.

## Task Commits

Each task was committed test first:

1. **Task 1: collision plan and sliced runner**
   - RED: `c8b2e3b` (test) the scheduling tests failing on the missing module
   - GREEN: `9ea75d9` (feat) `collisionSchedule.ts` and the tests as finally strengthened (one test bug of mine fixed, one test added for the port close)
2. **Task 2: CollisionReport block, inline editor and mount**
   - RED: `70828cc` (test) 37 block tests failing on the missing module
   - GREEN: `5977e67` (feat) `CollisionReport.tsx`, the `NamesPanel` mount
   - `3a8338c` (fix) the focus-return fallback chain, found while writing the browser run (the demon's own jump button is usually gone after a rename)
   - `5bb60fa` (test) three assertions added after the mutation run (the hint under a later jump button, the name's wrap and direction styles, the list role)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/lib/collisionSchedule.ts` - 84 lines: the plan, the runner, the browser schedule
- `app/components/names/CollisionReport.tsx` - 438 lines: the pure decisions, the view, the editor heading, the container and its focus helper
- `app/components/names/NamesPanel.tsx` - the import, the `open` prop of `NamesBody`, the block 9 mount (7 lines added, 3 changed)
- `tests/app/collisionSchedule.test.ts` - 28 tests with a fake clock and a fake scheduler
- `tests/app/namesPanelRender.test.ts` - 178 tests (141 untouched, 37 new), server render of the block, the view in every state, the pure decisions and the source rules

## Decisions Made

See `key-decisions`. The plan's `[default]` decisions are implemented as written: the check runs only while the panel is open, and the Demons overlay is modal (a fixed layer with a backdrop), so no plumbing reveals a demon there.

## Mutation Checks

Every mutant was one scripted edit to a saved copy of the source, the test command run in the foreground under a timeout, the source restored and confirmed with `git diff --quiet`; one at a time, never in the background. A valid mutant is rejected by the runner unless its find text occurs exactly once.

**Task 1 (13 mutants against the 28-test file), all Killed.** The plan's named mutant (no cancelled check before `onDone`) fails 2 tests (a cancel inside the finishing step, a cancel inside a yielding step). Deadline computed once instead of per slice: 1. Yield at equal time (`>=`): 2. No reschedule: 4. No cancel check at the start of a slice: 2. No clamp to the engine cap: 1. Limit exclusive (`<`): 1. No null-table guard: 1. No length guard: 1. Scan decided before certify: 2. First slice run synchronously: 12. Timer delay 1 instead of 0: 1. The port never closed (`A12`) **survived at first**: the test claimed it but never observed it; a stubbed channel now records `post, close, run` in order and kills it.

**Task 2, the block (29 mutants against the 178-test panel file).** 28 Killed on the first run; `U15` (a hint shown only under the line whose first mesh was jumped from) **survived** because the test jumped from a first mesh, so a case with a later button was added and it now fails 1. Killed: jump cap removed (3), `+k more` from the listed meshes (2), lines not bounded by the list (1), preview opens the editor (1), first report announced (1), unchanged count announced (1), checking never wins (1), summary not gray-100 (1), the count line and the more button swapped (1 each), toggle labels swapped (2), no busy flag (1), editor only under the first-mesh line (3), jump name from the group instead of the live name (1), wrong overridden tag (1), count attribute constant (4), root not focusable (1), skip limit ignored (1), editor heading span swapped (1), `+k more` at the boundary (1), name not gray-100 (1), list role dropped (1), name direction dropped (1), wrap class dropped (1), post-baseline mark dropped (2), demons attribute wrong (2), count shown while checking (1), none line hidden (1).

**The mount (6 mutants).** Mount removed (3 failing), mounted after import and export (3), open flag lost (1), the container allowing seed-only (1) and pending (1) all Killed. Ungating the mount in `NamesPanel` (`P2`) is **equivalent by design**: the container guards the same two states itself (the two container mutants prove that guard).

**The wiring, against the Chromium run (24 mutants of `CollisionReport.tsx`; scratch driver, see below).** Killed: both stale guards removed (`W04b`, 3 failing: the cancelled scan reported 1,022 groups); a zero grace (`W05`, a 47 ms scan showed Checking...); the grace timer never cleared (`W06`, the list is replaced by a permanent Checking... and the run timed out at the first click on it) and Checking never cleared (`W07`, the run timed out); announcement dropped (`W08`, 6 failing); first report announced (`W09`); the skip branch removed (`W10`, the run timed out in the 1,030-zone scenario); a preview jump opening the editor (`W11`); the hint not announced (`W12`); the hint not cleared when leaving preview (`W13`); no focus return (`W14`, 3 failing); focus before the answer for the new naming is in (`W15`); no sibling fallback (`W16`) and no toggle fallback (`W17`); the editor not closed after done (`W18`), after a new naming (`W19`) or when the list collapses (`W20`); no `scrollIntoView` (`W21`); the more button doing nothing (`W22`); the effect ignoring the naming (`W23`); a scan whose clock never advances (`W24`, the same scan blocks for 252 ms and the checks on Checking... and on the stale answer fail). `W01` to `W04` (removing only the generation check, only the cancel, only the cleanup's retire, or the cancel and the retire together) are **equivalent by design** (the generation check, the cancel and the generation bump at the start of the next job are independent guards); only removing the generation check and the cancel together is a valid mutant (`W04b`). Four of the five wiring survivors at first were fixed by a new scenario, not a shrug: `W05` (no scenario separated a 0 ms grace from 150 ms: a 400-zone scan that finishes under the grace was added), `W09` (my driver's regex had lost its backslashes: fixed), `W13` (coming back to preview must not resurrect the old hint) and `W21` (Chromium's `focus()` already scrolls the field into view, so the call is pinned with a recorder on `Element.prototype.scrollIntoView`).

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/collisionSchedule.test.ts --project oracle`: 28 passed; `... tests/app/namesPanelRender.test.ts`: 178 passed.
- The whole `--project oracle` run: 79 files, 2,614 tests, passed under `CCRUG_TZ=UTC` and under `CCRUG_TZ=America/New_York`.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0; the only lint output is the pre-existing `react-hooks/exhaustive-deps` warning in `app/components/demons/DemonMatrix.tsx` (the new effect retires its generation through a helper, so it adds none).
- `node scripts/check-repo.mjs`: OK (all eleven checks); `node scripts/check-repo.mjs --only base-ten` after `git add`: OK.
- Acceptance greps: `createCollisionJob(` 1, `context="collision"` 1, `onPinInfo` 0, `new Worker` 0 (both files), `<CollisionReport` in `NamesPanel.tsx` 1, `data-names-collisions` in `CollisionReport.tsx` 7; `grep -c "new Worker" app/lib/collisionSchedule.ts` 0; `COLLISION_SCAN_MAX_N` in the scheduling test 11.
- **Wiring mutants that ended by a timeout, not a FAIL line:** `W06`, `W07`, `W10`, `W15` and `W23` made the driver wait for something that never came, so Playwright's TimeoutError ended the run (exit 1); the baseline passed 90/90 on every other run, so these are kills.
- **Real browser run (scratch, not committed).** The repo has no DOM test library, so the timers, focus and scrolling cannot be reached by a node test. A scratch harness (session scratchpad `cr-harness/`: an esbuild bundle of the real `NamesPanel` over a `NamingContext` driven by the real `applyNamingAction`, the repo's Tailwind CSS, a Playwright Chromium driver) ran 90 checks, all passing: certified at base 28 without ever showing Checking...; two typed duplicates giving 26 groups and 78 demons equal to the engine's own report, announced once; the 20-line page, `Showing 20 of 26 names.` and Show more names; jump accessible names and 24px targets; the inline editor in the collision context with focus in its field, holding the current name, one at a time, in the right line, the Names box top moving by less than 1 px through jumps, cancels, an unchanged save and a refused name; Escape, Cancel and an unchanged save returning focus to the same jump button; a rename out of a group of three leaving focus on a jump of the line that kept the name and a rename that dissolves a group of two leaving it on the toggle, each with the exact counts and the announcement; the preview hint under the jumped line (and not resurrected on return); a newer naming closing an open editor and collapse not resurrecting one; undo back to the certified table giving `No repeated names.`; the base-10 CCRU naming scanned; the seed-only base 4002 and a table of 1,030 zones with a duplicate (`Not checked above 1024 zones.`, never scanned, while a generated one is still certified); the 1,024-zone scan of 1,022 groups: Checking... after the grace, busy flag, no count claimed, 258 ms from edit to exact answer, largest main-thread gap 26 ms (a first reading of 244 ms was my own driver calling the engine's synchronous scan inside the measured window); a scan cancelled by a newer edit never reporting, before or after the grace; collapse mid-scan and reopen giving a fresh exact answer without announcing it; no console error or page error.
- `npm run build` succeeded. `npm run check:weight` **still fails with exactly the numbers of 07-18** (`/numogram/` jsGzip 260,596 against a limit of 258,168, baseline 245,874): this plan adds no weight because nothing that is mounted imports `NamesPanel` or `CollisionReport` yet. The baseline was not edited; plan 07-24 settles it.
- `git diff --name-only 7834048..HEAD -- e2e engine app/presets/base10 reference app/NumogramClient.tsx app/components/numogram/Projection.tsx app/components/numogram/PairGraphProjection.tsx`: empty. Only the five files listed above changed; no golden, behaviour baseline, fixture, bank, vector, numeric oracle or `reference/` file was touched.
- `npm run test:swap` and `npm run verify` were not run: the only existing app file edited is `NamesPanel.tsx`, which nothing mounts until 07-21, and `verify` stops at the known `check:weight` failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `collisionPlan` also refuses a malformed table and an over-cap limit**
- **Found during:** Task 1
- **Issue:** The plan lists three outcomes. A naming with no table, a table whose length is not the base, or a limit set above the engine's own cap would make `createCollisionJob` throw a RangeError inside an effect, which unmounts the panel.
- **Fix:** `skip` for no table or a wrong length, and the scan bound is `min(limit, COLLISION_SCAN_MAX_N)`; each case has a test and a mutant.
- **Files modified:** `app/lib/collisionSchedule.ts`, `tests/app/collisionSchedule.test.ts`
- **Committed in:** `9ea75d9`

**2. [Rule 2 - Missing critical functionality] Focus fallback chain after a rename**
- **Found during:** Task 2 (browser run)
- **Issue:** The plan and the UI-SPEC return focus to the demon's own jump button, but a save that resolves a collision removes that demon from its group, so the button is gone and focus drops to the page.
- **Fix:** the chain described above (own button, the line that kept the name, the toggle, the block), waiting for the answer for the new naming; proved in Chromium with two mutants (`W16`, `W17`).
- **Files modified:** `app/components/names/CollisionReport.tsx`
- **Committed in:** `5977e67`, refined in `3a8338c`

### Design refinements (no contract changes)

**3. The re-check is keyed on the naming object, not the revision** (see `key-decisions`).
**4. The two announcement sentences are a local pure helper**, not copy-module entries (see `key-decisions`; the orchestrator should decide where they live).
**5. The preview hint sits under the jumped line; the editor gets a heading; the block carries `data-state`; the open editor closes on a new naming and on collapse** (see `key-decisions`).

---

**Total deviations:** 2 hardening items (1 and 2), 3 documented refinements (3 to 5). **Impact on plan:** none changes an exported name or a contract the later plans read; the e2e hooks the plan lists (`[data-names-collisions][data-count][data-demons]`, `[data-collision-name]`, `[data-collision-jump]`, the collision editor) are all present, plus `data-state`, `[data-collision-toggle]`, `[data-collision-more]`, `[data-collision-showing]`, `[data-collision-extra]`, `[data-collision-name-text]`, `[data-collision-editor-title]`, `[data-names-collisions-line]` and `[data-names-collisions-status]`.

## Issues Encountered

None blocking. Two of my own test-writing slips were caught by the first runs (a hand-built "above the cap" naming that was seed-only at the app ceiling, and an assertion that expected the editor under the wrong line), and one of my driver's: a regex that lost its backslashes made a mutant survive until it was rewritten (see `W09`).

## Known Stubs

None. Every state of the block is rendered from real data; the only value that is not computed here is the report itself, which comes from the engine.

## Threat Flags

None. The plan adds no network endpoint, auth path, storage access or schema at a trust boundary. The register is mitigated as planned: T-07-06d (certificate first, scans only up to `collisionScanLimit()`, 8 ms slices with yield, bounded lists from the engine, runs only while the panel is open; a never-yielding clock was measured to block the page for 252 ms, which is what the slicing prevents), T-07-11b (generation counter and cancel on every naming, base or open change; the cancelled scan is proved never to report, before and after the grace) and T-07-10e (names are text nodes and attribute strings, a hostile name is tested through the line, the attribute and the accessible name; the source has no raw-html path).

## TDD Gate Compliance

Task 1: RED `test(07-20)` `c8b2e3b` (failed on the missing module) before GREEN `feat(07-20)` `9ea75d9`. Task 2: RED `test(07-20)` `70828cc` (failed on the missing module) before GREEN `feat(07-20)` `5977e67`. No refactor commits.

## Next Phase Readiness

- **07-21** mounts `NamesPanel` in both stacks and is the first plan that makes this block visible. It has to run `test:swap` anyway, so it is the natural place to move the two announcement sentences into `app/lib/namingCopy.ts` (and its key-set test is unaffected, they are functions). The block's effect depends on the provider keeping `naming` stable between renders (it does: the context value is memoised on `namingSession.working`); an announcement changes the context value but not the naming, so it cannot restart the check.
- **07-22 and 07-23 (e2e)** own what node cannot reach in the real viewer: the Names box top staying put while a jump opens an editor next to the real Selection panel, the real label scheme in the jump text (`view.zoneLabel`), undo and redo with an editor open, the Tab order (Show repeated names, jump buttons and the editor, then Export), narrow and mobile widths, the Canvas tier at base 666, a scan at the 1,024 limit under the shipped 6.3x throttle (about 1.6 s, with the page still responsive because of the slices), and the screen-reader reading of the two announcements.
- **For the orchestrator to decide:** (1) where the two announcement sentences live (above); (2) after a rename the editor announces `Renamed ...` and a few milliseconds later the block announces the new count, which replaces the polite live text; most screen readers queue the two, some may drop the first, so the manual screen-reader checkpoint in 07-25 should listen for it; (3) `Names restored from history.` after an undo is likewise followed by the count announcement when the count changed.
- No blocker.

## Self-Check: PASSED

- Created files exist and are tracked: `app/lib/collisionSchedule.ts`, `app/components/names/CollisionReport.tsx`, `tests/app/collisionSchedule.test.ts`; `NamesPanel.tsx` and `namesPanelRender.test.ts` carry the mount and the new tests.
- All six work commits exist (`c8b2e3b`, `9ea75d9`, `70828cc`, `5977e67`, `3a8338c`, `5bb60fa`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, `reference/` file, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx`, bank, signed-off vector or `app/presets/base10/**` file was touched; `engine/` was not edited.
