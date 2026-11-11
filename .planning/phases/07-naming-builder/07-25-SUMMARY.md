---
phase: 07-naming-builder
plan: 25
subsystem: phase-gate-and-validation-sign-off
tags: [naming, phase-gate, verify, frozen-oracles, validation, todo-008, manual-checkpoint, page-weight]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plans 07-01 to 07-24 (the engine, the Names panel, the live stack, the e2e suites and the page-weight raise)
provides:
  - a green `MSYS_NO_PATHCONV=1 npm run verify` (exit 0) with every frozen oracle byte-identical to the commit before Phase 7 began
  - 07-VALIDATION.md signed off for the automated rows (nyquist_compliant and wave_0_complete true; status deliberately still draft)
  - todo 008 closed (moved to .planning/todos/completed/ with its resolution trace)
  - the per-requirement evidence, the mutation roll-up, the timings and the [default] decisions list for the user's review
affects: [07-25 Task 2 (the manual checkpoint), /gsd-verify-work 7, phase 7 completion bookkeeping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The gate runs on a clean tree and nothing is edited while it runs (its last step, `check-repo --clean-tree --static-out`, would fail on a dirty tree)"

key-files:
  created: []
  modified:
    - .planning/phases/07-naming-builder/07-VALIDATION.md
    - .planning/todos/completed/008-regions-panel-overlaps-currents-at-large-bases.md (moved from pending/)

key-decisions:
  - "Task 1 is complete; Task 2 (the blocking manual checkpoint: screen reader, desktop stack by eye, narrow windows, review of the [default] decisions) is NOT done and is presented to the user by the orchestrator. 07-VALIDATION.md keeps `status: draft`, its Approval line says pending, and row 07-25-T2 stays pending."
  - "The sign-off box 'Feedback latency < 60s per touched spec' was ticked with a qualification written next to it: e2e/panel-stack.spec.ts takes 144 s in full (62 geometry cases of 1 to 5 s each) and the frozen behaviour spec 124 s; every other touched spec is under 60 s. The user may prefer to leave that box open or to split the geometry spec."
  - "ROADMAP.md keeps the 07-25 box unticked (a checkbox cannot say 'Task 1 done, Task 2 pending' without implying completion); STATE.md carries the partial state in one decision bullet and the session lines. REQUIREMENTS.md checkboxes and the phase-complete bookkeeping are left to the orchestrator after the user's sign-off."

requirements-completed: []  # NAM-01..NAM-04 stay Pending until the orchestrator marks them after the user's sign-off at Task 2

# Metrics
duration: about 20 min of active work for Task 1 (gate start 17:47Z, gate end 17:58Z = 11 min 23 s; close-out to the last commit about 10 min more; the start of the plan itself was not stamped)
completed: 2026-11-11 (Task 1 only; Task 2 pending the user)
---

# Phase 7 Plan 25: Phase Gate Summary

**Task 1 complete, Task 2 (the manual checkpoint) pending the user. The full gate `npm run verify` exits 0 in 11 min 23 s (118 unit files, 3,916 tests in both timezones; 412 e2e tests passed with 340 skipped by design, including all 60 DOM goldens and the 5 behaviour stages), every frozen oracle is byte-identical to the commit before Phase 7 (`0f25f1b`), the validation map is green for all 50 automated rows, and todo 008 is closed with its e2e proof.**

## Performance

- **Gate duration:** 11 min 23 s (17:47:14Z to 17:58:37Z, one run, no retry, no fix needed)
- **Task 1:** complete. **Task 2:** not started (blocking human checkpoint, see "Checkpoint for the user" below)
- **Files changed by this plan:** 2 (07-VALIDATION.md, todo 008) plus this SUMMARY and STATE.md; no `app/`, `engine/`, test, golden, baseline or `perf/` file

## The gate (`MSYS_NO_PATHCONV=1 npm run verify`, exit 0)

Log: `C:\Users\MJMC\AppData\Local\Temp\claude\c5d6695e9ff69dd1\6d9b5389-29d7-47cc-b00b-c3f0c2e81b45\scratchpad\verify-07-25.log` (scratch, not committed). Source tree clean at the start (`git status` empty at `c5e9189`).

| Step | Result |
|---|---|
| `check:repo` | OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, base-ten) |
| `typecheck` (4x tsc + `next lint`) | clean; the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx` (not touched) |
| `npm test` (UTC) | 118 files, 3,916 tests passed (25.90 s) |
| `npm run test:tz` (America/New_York) | 118 files, 3,916 tests passed (26.89 s) |
| `test:e2e:basepath` (sub-path) | 12 passed (7.9 s) |
| `build` + `check:weight` | build clean; `page-weight: OK (2 routes, 30 golden states within tolerance)` |
| `test:e2e` | 752 tests: **412 passed, 340 skipped by design (the second timezone project and spec-level skips), 0 failed, 0 flaky** (8.9 min); includes `golden.spec.ts` 60 of 60 (30 per timezone project) and `behaviour.spec.ts` 5 of 5 |
| `check-repo --clean-tree --static-out` | OK (all 13 checks incl. clean-tree and static-out) |

Key e2e counts inside the gate (chromium-utc): `panel-stack` 62, `names-io` 32, `names-panel` 20, `names-preview` 19, `names-session` 14, `names-labels` 12, `demons-browser` 12, `names-smoke` 7, `demons-matrix` 6, `region-legend` 9 (incl. the 3 `todo 008` tests).

## Frozen-oracle confirmation

All run after the gate, from the repo root. "Base" is `0f25f1b` (`docs(07): create phase plans`, the planning commit before 07-01).

| Check | Result |
|---|---|
| `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures engine/test/layout.digest.test.ts` | empty |
| `node scripts/check-repo.mjs --only goldens` | exit 0 (`check-repo: OK (goldens)`) |
| `node scripts/check-repo.mjs --only lore` | exit 0 (`check-repo: OK (lore)`) |
| `git diff --stat 0f25f1b -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` | empty; `git log 0f25f1b..HEAD -- <those paths>` has 0 commits |
| `git diff --stat 0f25f1b -- engine/test/layout.digest.test.ts` | empty |
| `git diff --stat 0f25f1b -- package.json package-lock.json` | empty (no new dependency) |
| `grep -rn "new Worker(" app workers \| wc -l` | 1 (`app/lib/worker/workerClient.ts:177`), unchanged |
| 07-06 signed-off files: `git diff --stat fb00ada -- engine/naming/banks.ts engine/test/naming.vectors.test.ts` (and `banks.ts` against `67e3002`, the bank revision the user approved) | empty; the last commits touching them are `fb00ada` (digest pin) and `67e3002` (bank revision) |
| `tests/app/demonNames.test.ts` | unchanged since `0f25f1b` |
| `perf/page-weight.baseline.json` | changed since `0f25f1b` only by the one ledger raise of 07-24 (history entry 10), never by hand |

## Page weight (carried from 07-24; the gate re-confirmed `check:weight` OK)

/numogram/ JS 808,836 to 890,987 bytes raw (+10.2%) and 245,874 to 273,143 gzip (+11.1%); cumulative over the pre-Phase-6 baseline (726,294 raw, 218,587 gzip): +22.7% raw, +25.0% gzip. `/` JS unchanged (416,918 raw). Golden DOM node counts unchanged (6,405 in total). Everything is imported eagerly; todo 007 (lazy-load the Canvas, worker fallback and now the Names code) is the pending way to recover most of it. This is a decision for the user (see the [default] list, item "page weight").

## Timings (logged, never asserted, T-05-38)

| Probe | Value | Source |
|---|---|---|
| `names-open-ms` (Expand click to first mounted row, base 4000, Canvas tier) | 23.8 ms in the gate run (23.4 to 28.4 ms over eight runs in 07-22); budget `budgets.interactionMs` 100 | gate log; 07-22 (log-only since `8bbe577`) |
| Collision scan, engine only, raw / smoothed | 666: 102 / 197 ms; 1,024: 211 / 432 ms; 4,000: 3,323 / 7,003 ms; 4,096 (the cap): 3,487 ms | 07-10 (Node 22.16, one run each, no yielding) |
| Collision certificate (generated tables), no overrides / 1,000 overrides | 666: 0.24 / 0.66 ms; 1,024: 0.35 / 0.72 ms; 4,000: 1.27 / 1.59 ms | 07-10 |
| Sliced scan in Chromium at the 1,024 limit under a 6.3x CPU throttle | 2,418 ms Enter to answer in the gate run (2,460 and 2,485 in 07-23), 115 frames and 4,951 task turns meanwhile, longest task 53 ms, "Checking..." shown | gate log; 07-23 |
| Canvas raster, overlay, heartbeats (earlier phases, for context) | raster 16 / 83 / 82 ms at 28 / 666 / 4096; overlay 11 ms at 4000; worker heartbeat max gap 32.5 to 123 ms | gate log |
| Slowest specs (chromium-utc) | `panel-stack` 62 cases 143.8 s (longest 4.7 s); `behaviour` 5 cases 123.6 s (frozen, Phase 1); `names-io` 32 cases 44.4 s; the rest under 25 s each | gate log |

## Per-requirement evidence

Evidence is the named files; all exist and all passed in the gate above (unit totals: 118 files and 3,916 tests in each timezone; e2e counts per spec above). Mutation counts are those each plan reported.

| Requirement | Automated evidence | Plans |
|---|---|---|
| **NAM-01** (per-zone sound table, seeded generator, locks, styles, live stack and Names panel) | `engine/test/naming.{prng,feistel,generate,text,vectors}.test.ts`; `tests/app/{zoneListModel,namesPanelRender,panelStack,panelDrag}.test.ts`; `e2e/names-panel.spec.ts` (20), `e2e/names-smoke.spec.ts` (7), `e2e/names-session.spec.ts` (14), `e2e/panel-stack.spec.ts` (62); also `e2e/names-labels.spec.ts` (12, sounds label mode on both tiers) | 07-01 to 07-04, 07-06, 07-07, 07-09, 07-12, 07-14, 07-17, 07-19, 07-21, 07-22, 07-24; manual: style banks signed off 2026-11-09 (07-06) |
| **NAM-02** (derived demon names, editing, display everywhere) | `engine/test/naming.{derive,edit,euphony}.test.ts`; `tests/app/{namesDisplayRender,demonNameEditorRender,canvasKeyboard}.test.ts`; `e2e/names-panel.spec.ts`, `e2e/demons-browser.spec.ts` (12), `e2e/demons-matrix.spec.ts` (6) | 07-02, 07-05, 07-14, 07-15, 07-16, 07-18, 07-22 |
| **NAM-03** (JSON import and export, links, per-base autosave, collisions, previews) | `engine/test/naming.{schema,collisions}.test.ts`; `tests/app/{shareParamsNames,namingSession,namingStorage,collisionSchedule,namingCopy}.test.ts`; `tests/app/historyHydration.test.ts`; `e2e/names-io.spec.ts` (32), `e2e/names-preview.spec.ts` (19), `e2e/names-session.spec.ts` (reload restore and undo) | 07-08 to 07-11, 07-13, 07-17, 07-18, 07-20, 07-23 |
| **NAM-04** (the CCRU base-10 preset) | `tests/presets/namingPreset.test.ts`, `tests/presets/base10-adapter.test.ts`; `e2e/names-io.spec.ts` (CCRU preset: base 10 opens on the 45 canonical names, base 12 shows none); `e2e/demons-browser.spec.ts` (Lurgo, Ummnu) | 07-11, 07-18, 07-23 |

Manual-only items (07-VALIDATION "Manual-Only Verifications"): style banks (row 1) approved 2026-11-09 in 07-06; rows 2 to 4 (screen reader, desktop stack by eye, narrow windows) are Task 2 and are not done.

## Mutation roll-up (as each plan reported it; not recounted)

Every mutant was applied by script, the named tests were run, and the source was restored and diffed. Where a mutant first survived, the plan added a test and re-ran it killed; no unresolved survivor is recorded in any of the 24 SUMMARIES.

| Plan | Mutants killed | Notes |
|---|---|---|
| 07-01 | 11 | no survivors; one (depth boundary) killed by non-termination |
| 07-02 | 21 | |
| 07-03 | 21 | |
| 07-04 | 4 | |
| 07-05 | 14 | |
| 07-06 | 12 | 1 lore comparison, 8 euphony, 3 bank-swap digests; one invalid mutant (lost backslashes) rebuilt and killed |
| 07-07 | 3 | stack frozen after first render, drag seeded from stored position, z cap 79 |
| 07-08 | 17 | |
| 07-09 | 17 | plus 2 equivalent survivors, proven so |
| 07-10 | 26 | 3 survivors answered with new tests; 1 equivalent mutant (`hash29` constant) deliberately not written |
| 07-11 | 33 | |
| 07-12 | 9 | |
| 07-13 | 50 | plus 5 equivalent |
| 07-14 | 10 | one survivor answered by tightening a test |
| 07-15 | 24 | one survivor answered by a call-site source assertion; one equivalent not run |
| 07-16 | 79 | 55 + 24 valid; one survivor and one invalid mutant answered |
| 07-17 | 53 | 0 survivors |
| 07-18 | 19 | 9 e2e + 10 helper |
| 07-19 | 82 | 22 model + 30 list markup + 18 list state + 12 wiring; survivors Z09, S13, S15 answered |
| 07-20 | 73 | 13 + 29 + 6 + 25; survivors U15, W05, W09, W13, W21 answered; P2 equivalent by design |
| 07-21 | 8 | |
| 07-22 | 29 | 35 mutant builds and runs |
| 07-23 | 39 | 40 builds; P10 and C3 survived first and were answered |
| 07-24 | 18 | M17 survived the first spec and was answered by hit-testing the overlap |
| **Total** | **about 670 killed** | about 8 equivalent or unrun, as listed |

## Legitimately changed existing tests (rewritten, none skipped)

- `e2e/demons-browser.spec.ts`: `other bases keep an empty NAME column` became `other bases show generated names in the NAME column (Phase 7 D-03)`, computed from the engine's default naming (07-18). The base-10 `Lurgo` and `Ummnu` assertions are unchanged.
- `e2e/demons-matrix.spec.ts`: `cellText` now builds `A::B · Name · MESH · Subtype` from the engine's name, and two pre-naming literals (base 28 and base 666 hover text) were removed as redundant with the `cellText` assertions that follow them (07-18). Nothing skipped.
- Additions only (no assertion removed): `e2e/region-legend.spec.ts` (+3 `todo 008` tests; the diff's 2 deleted lines are an import rewrite), `tests/app/{canvasDiagramModel,canvasDiagramRender,canvasDraw,canvasKeyboard,demonSearch,demonsOverlayRender,workerCore}.test.ts` (added cases only), `labelScheme.test.ts`, `projectionRender.test.ts`, `shareParams.test.ts` (added cases plus one import or key-list line widened to include sounds).
- 07-07 and 07-24 changed no existing assertion; `tests/app/demonNames.test.ts` is unchanged.
- Pre-existing history bug found by 07-18 and fixed by the orchestrator in `18c8f57` and `4bf1fce` (see the decisions list); the frozen behaviour stages `after-undo` and `after-redo` were never touched and pass unchanged.

## Todo 008

Moved with `git mv` to `.planning/todos/completed/008-regions-panel-overlaps-currents-at-large-bases.md` (`status: completed`, `completed: 2026-11-11`) with a "Resolution (Phase 7, plans 07-03, 07-07, 07-24)" section and the three acceptance criteria ticked. Criterion 2 is worded as proven: no overlap at the sampled bases (10, 28, 64 and the Canvas bases 202, 1000, 4000) and after a base change through the picker, by construction for any base because the stack is derived from measured heights; no sweep of every base was run. Proof: `e2e/panel-stack.spec.ts` (62 cases) and the three `todo 008` tests in `e2e/region-legend.spec.ts` (base 10 then 28; a real mouse click on every Torque row's, Warp's and Plex's Isolate and Mute at base 202 at 1280x800 and 1440x900), all passed in the gate. Note: `CLAUDE.md` still lists todo 008 as open in its "Resuming" paragraph; this plan did not edit it (project instructions are the orchestrator's or the user's to change).

## [default] decisions to review (for Task 2 check 4)

Each decision was taken by the planner or an executor under a "[default]" rule rather than asked. "Where" names the module or SUMMARY that holds it.

**From the plans (07-25-PLAN `<interfaces>`)**

1. **07-01** `DEFAULT_SEED` is `'ccrug'`; sounds come from a prefix-code tree with a Feistel permutation (no Fisher-Yates); a stored `names=seed:` means names-gen@1 forever. Where: `engine/naming/generate.ts`, `feistel.ts`.
2. **07-02** The letters rule refuses ZWNJ and other Cf characters; sounds use the sound rule with a 32-character cap; `euphony@1` does not collapse triple letters. Where: `engine/naming/text.ts`, `euphony.ts`.
3. **07-03** The z cap is 69 with re-rank onto 40..49; no fold-aware tweak. Where: `app/lib/panelDrag.ts` (`Z_CAP`).
4. **07-05** CCRU names are a read-time preset layer with mesh-number override keys; editing auto-locks; `setSeed`/`setStyle` switch to generated; `setSource('ccru')` clears locks; an override equal to the rule removes itself; the revision counter lives in the app. Where: `engine/naming/derive.ts`, `edit.ts`.
5. **07-06** The banks are as the user approved them on 2026-11-09, including dropping the eight verbatim CCRU clusters from the harsh bank (licensing: NOTICE section 3 excludes CCRU lore from the MIT licence; the engine holds no preset table, canonical names or zone-sound table). Where: `engine/naming/banks.ts`, pinned by `engine/test/naming.vectors.test.ts`.
6. **07-08** Import caps: 8 MiB, 250,000 overrides, 200-character meta, 5 issues kept, 5 unknown keys; unknown prng or gen ids are refused as an unknown format version; smoothing above v1 is an unknown version; files without zones regenerate from the seed; exports are pretty, slots compact. Where: `engine/naming/schema.ts`, `validate.ts`.
7. **07-09** A link without `names=` expresses no naming; companion parameters only with `names=seed:`; the Sounds toggle at a Canvas base costs one worker rebuild. Where: `app/lib/namesLink.ts`, `shareParams.ts`.
8. **07-10** A certificate plus a main-thread sliced scan, no worker; bounded group lists (2,000 groups, 16 meshes each); the scan's per-demon typed arrays are a bounded exception to the engine's no-O(n^2) rule, capped by `COLLISION_SCAN_MAX_N = 4096` (the app limit is 1024). Where: `engine/naming/collisions.ts`, `app/lib/namingLimits.ts`.
9. **07-11** Smoothing caption copy "Smoothing makes no difference to these sounds."; copy for non-zone import issues; MB formatting; 8-character reroll seeds; heavy-naming undo depth 8 above 5,000 overrides. Where: `app/lib/namingCopy.ts`, `namingLimits.ts`.
10. **07-12** Sounds swap only the node label slot (pair graph and planetary keep numerals); fit 0.62 em narrow and 1.0 em wide, 90% of the node diameter, 6 px floor. Where: `app/lib/soundLabels.ts`.
11. **07-13** Equal link forms open the saved slot; preview snapshots hold the saved naming; "pending" means a worker switch is in flight; undo and redo mark the session edited. Where: `app/lib/namingSession.ts`.
12. **07-14** The Canvas chord hover callout (not in the UI-SPEC Name Display Contract) now reads `a::b · Name`. Where: `app/lib/canvas/diagramModel.ts`, `app/components/canvas/CanvasDiagram.tsx` (07-14 SUMMARY).
13. **07-15** `demonName` and `legacyDemon` are unchanged (RESEARCH over UI-SPEC); name search reads live names at every base within the 50,000-demon cap (UI-SPEC decision 20 says no NEW name search; whether this extension of the Phase 5 search is wanted is for the user); no existing unit test changed. Where: `app/lib/demonSearch.ts` (`NAME_SEARCH_MAX_COUNT`).
14. **07-17** Panel extras kept (preview table, summary, share note, reroll); status clears on the next action, a base change or collapse. Where: `app/components/names/NamesPanel.tsx`.
15. **07-18** Base 10 defaults to CCRU; the slot is read on mount (a bare URL included); Names auto-opens once for a preview; hydration adopts only the naming fields into history (`historyNamingAdoptRef`), keeping the frozen post-load undo entry of query loads. Where: `app/NumogramClient.tsx`, `app/lib/historyHydration.ts`.
16. **07-19** Auto-lock on edit and paste; paste separators; roving tabIndex. Where: `app/lib/zoneListModel.ts`, `app/components/names/ZoneList.tsx`.
17. **07-20** The collision check runs only while the panel is open; the overlay-reveal clause is vacuous because the Demons overlay is modal. Where: `app/lib/collisionSchedule.ts`, `CollisionReport.tsx`.
18. **07-24** Page weight raised via `--reason`; todo 007 stays pending (see item "page weight" below).

**Added by later plans and the orchestrator**

19. **07-15, name search is ASCII-letter only.** Demon NAME search matches ASCII-letter queries only (`NAME_RE` unchanged): a name typed in another script displays everywhere but cannot be found by typing it into the search box; widening the gate would also change the status text for non-ASCII queries. Where: `app/lib/demonSearch.ts`.
20. **07-16, name field limits.** The demon name field is capped at 256 code units; Pending locks the editor like preview; IME composition keys are ignored. Where: `app/components/names/DemonNameEditor.tsx` (`NAME_FIELD_MAX_INPUT`).
21. **07-18 plus the orchestrator fix, history after Undo or Redo.** An edit made right after Undo or Redo used to be swallowed (a pre-existing bug since Phase 1: Redo was not cleared and Undo skipped a step; layer toggles were affected too). Fixed in `18c8f57` (the history flag is cleared on the apply render), with the frozen `after-undo` and `after-redo` stages unchanged; then in `4bf1fce` a REFUSED Undo or Redo (the base-10 post-load history entry a `?base=28` load leaves on the stack) no longer sets the flag, still pops the dead entry once and no longer pushes a Redo entry. The user may prefer a refusal to pop nothing at all. Where: `app/NumogramClient.tsx`; logged in `deferred-items.md`.
22. **07-18, flush and first URL sync.** A pending slot write is flushed before a base switch and on `pagehide`; the first URL sync also writes `names=` when a restored slot's link form differs from the opening URL. Where: `app/NumogramClient.tsx`, `app/lib/namingStorage.ts`.
23. **07-20 and 07-23, announcements after a rename.** The polite live region receives several sentences in quick succession ("N repeated names." / "Renamed ..." / the new count; after a header Undo: "Names restored from history." / the count); a screen reader may drop the first. This is what the screen-reader checkpoint (check 1) should listen for (the gate log shows the sequence `["26 repeated names.","Renamed 1::0 to Qwerty.","25 repeated names."]`).
24. **07-20 and 07-23, focus after Save name.** Focus returns to the demon's own jump button only while the demon stays in its group; when the rename makes the name unique, focus goes to the first jump of the line that kept the name (groups of three) or to the "Show repeated names" toggle (groups of two). Escape and Cancel return to the demon's own jump. Where: `CollisionReport.tsx`.
25. **07-23, collision jump in a preview.** A collision jump is unreachable in a shared-link preview from a browser (links carry only a seed or the preset and generated tables are provably unique); the "Keep this naming to rename demons." hint is covered by render tests only.
26. **07-19, focused zone row far out of the window.** A focused zone-list row scrolled far out of the virtual window unmounts and focus falls to the page (the draft is kept and restored when the row returns). A `rangeExtractor` that keeps the focused row mounted is a small follow-up if the screen-reader check wants it. Where: `ZoneList.tsx`.
27. **07-24, the Names body minimum is 68 px, not 80.** The UI-SPEC makes the Names scroller `NAMES_SCROLL_INSET_PX` (12 px) shorter than the room and clamps the room to 80, so when the clamp binds (Selection at its 52vh cap in a window under about 708 px tall) the visible body is 68 px (the sticky header plus about 1.6 rows). One-line fix available in `app/components/names/NamesPanel.tsx` (`Math.max(bodyMax - NAMES_SCROLL_INSET_PX, NAMES_BODY_MIN)`) plus the `namesPanelRender` test that pins the inset; logged in `deferred-items.md`. Also: the UI-SPEC worst-case figures are conservative (the minimum binds below about 708 px, not 742); the shared CyberPanel header toggle is 10 x 10 for every panel since Phase 4 (the 24 x 24 check is scoped to Names content); CyberPanel's wrapper shows a transient 10 px scrollbar for 200 ms on open with real scrollbars.
28. **07-24, PAGE WEIGHT (a decision the user should review).** `/numogram/` JS grew 808,836 to 890,987 raw (+10.2%) and 245,874 to 273,143 gzip (+11.1%) via ledger entry 10; cumulative over the pre-Phase-6 baseline (726,294 raw, 218,587 gzip): +22.7% raw and +25.0% gzip. Everything is imported eagerly. Keep the raise, or schedule todo 007 (lazy-load the Canvas, the worker fallback and now the Names code), and say whether to broaden 007 to the Names panel.
29. **07-22, timing probes.** They are logged, never asserted (T-05-38): the Names open time was asserted at first and relaxed to log-only by the orchestrator in `8bbe577`.
30. **This plan, validation sign-off.** The box "Feedback latency < 60s per touched spec" was ticked with the `panel-stack` (144 s) and frozen `behaviour` (124 s) exceptions written beside it (see key-decisions).

**Open pre-existing items still pending (not Phase 7):** todo 006 (base 10's drawn shape versus the CCRU numogram; needs the user's sign-off because it touches the frozen oracle), 007 (lazy loading), 009 (three low-severity Phase 6 review infos), and the deferred review findings 002 and 004.

## Deviations from Plan

None - plan executed as written for Task 1. Two points of interpretation, both recorded above: (1) the "Feedback latency" sign-off box was ticked with a written qualification instead of being left open; (2) no row was marked green without a citable run or SUMMARY (all 24 plan SUMMARIES carry `Self-Check: PASSED`, every referenced test file exists, and the gate ran them all). No source file was fixed because the gate passed first time.

## Issues Encountered

None. One wait command was moved to the background by the tool after 180 s; it was only a wait on the gate's end marker and was not a second gate run.

## Known Stubs

None (no application file was created or changed by this plan).

## Threat Flags

None. T-07-13g (oracle integrity): no `-u` anywhere, manifests verified by `check-repo`, the frozen directories diff empty against `0f25f1b`, naming digests untouched. T-07-12d (policy): the final `check-repo --clean-tree --static-out` and the lore scanner passed; `reference/` untouched; no upstream branding added. T-07-15b (repudiation of manual claims): the manual rows stay pending until the user answers at Task 2 and the outcomes are written into 07-VALIDATION.md.

## Checkpoint for the user (Task 2, blocking, NOT done)

Run `npm run build` then `npm start` (serves `out/` at http://127.0.0.1:3000 on loopback only), then:

1. **Screen reader (NVDA or VoiceOver)** at http://127.0.0.1:3000/numogram/?base=28 : expand Names, Tab through the panel; edit a sound (Enter), lock a zone, press Reroll unlocked sounds, import a file exported from the panel, type the same sound into two zones and jump from a collision into the inline editor; each action should be announced once, with the visible wording (decision 23 says what to listen for).
2. **Desktop stack by eye at 1280 x 800:** open http://127.0.0.1:3000/numogram/ , type 28 in the base picker, collapse and expand panels, drag one, open Names: no panel covers another; the zoom toolbar and the shortcuts button stay clear.
3. **Narrow windows:** at about 375 x 667 and 768 x 1024 open http://127.0.0.1:3000/numogram/?base=28 : Names is first in the stack and reachable with the default panels, no panel overlaps another or the zoom toolbar, no horizontal scroll.
4. **Review the [default] decisions above** and say if any should change (items 5, 13, 21, 27 and 28 are the ones most likely to matter: the bank licensing choice, the name-search extension, the refused-Undo behaviour, the 68 px body minimum and the page-weight raise).

Reply "approved" or describe the issues per check (1 to 4). On approval the orchestrator or a continuation sets 07-VALIDATION.md `status: approved` and its approval date, marks row 07-25-T2 green, and records the outcome of checks 1 to 3 under "Manual-Only Verifications"; on issues each is recorded with its check number and the status stays draft.

## Task Commits

1. **Task 1: gate, oracle confirmation, validation sign-off and todo 008 close-out** - `0157afe` (docs: 07-VALIDATION.md and the todo move); the gate itself produced no commit. The docs commit that carries this SUMMARY and STATE.md follows (hash in the final report).
2. **Task 2: manual checkpoint** - not done, pending the user.

## Self-Check: PASSED

- `07-VALIDATION.md` has `nyquist_compliant: true` (count 1), `wave_0_complete: true`, 50 rows green, row 07-25-T2 pending, and no `status: approved` (count 0).
- `.planning/todos/completed/008-regions-panel-overlaps-currents-at-large-bases.md` exists with `status: completed` (count 1); the pending file is gone.
- Commit `0157afe` exists on `main` with the `Co-Authored-By: Claude Sonnet 5` trailer; nothing was pushed.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures engine/test/layout.digest.test.ts` is empty.
