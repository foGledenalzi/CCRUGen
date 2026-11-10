---
phase: 07-naming-builder
plan: 16
subsystem: app-demon-name-editor
tags: [naming, demon-name-editor, overrides, selection-detail, demons-overlay, hover-proof-binding, preview-lock, server-render-tests, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-04 (CyberButton optional props, ui-terminal-field classes), plan 07-05 (the override and reset-override edit ops, createNameResolver with stateOf and presetNameOf), plan 07-11 (the NAMES_COPY editor strings and the demonIssue, renamed, backTo, nameFieldAria and renamingUnavailable copy functions), plan 07-13 (the null-default NamingContext and the apply rules) and plan 07-15 (render-time names in DemonInfo)
  - phase: 05-demons-layer
    provides: DemonInfo and the DemonsOverlay detail pane the editor mounts into
provides:
  - app/components/names/DemonNameEditor.tsx, DemonNameEditor({ a, b, context, autoEdit?, onEditingChange?, onDone? }) with read, edit, locked and unavailable modes, and the exported presentational DemonNameEditorView
  - exported pure helpers behind the handlers (commitName, saveOutcome, resetOutcome, nameAfterReset, editKeyAction, editorAvailability, activeEdit, resetLabelOf)
  - DemonInfo optional editorContext and onEditingChange props mounting the editor after the detail frame in both variants; InfoDisplay passes the selection context
  - DemonsOverlay detailShown(hover, pinned, bound) and a detail pane bound to the demon being edited, dropped on a base change
  - 87 tests in tests/app/demonNameEditorRender.test.ts, 79 valid mutants run
affects: [07-18, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A component whose handlers a node test cannot reach is split into a container (hooks, refs, focus) and an exported presentational view with no hooks; the view is rendered to markup AND called as a plain function, so its element tree shows which handler each button, field and root carries"
    - "Every decision inside a handler is a pure function that returns the naming action and the sentence to announce (saveOutcome, resetOutcome), so the action type, mesh, text and status are asserted without a DOM"
    - "A detail pane that normally follows hover is bound by a separate piece of state that carries its base: the derived value is null for another base, so a stale binding can never reach a numogram of the wrong size"
    - "An edit is keyed by the mesh it was opened on and is shown only while that demon is on show; anything that makes it unshowable (preview, a base building, another demon pinned) closes it and tells the owner"

key-files:
  created:
    - app/components/names/DemonNameEditor.tsx
    - tests/app/demonNameEditorRender.test.ts
  modified:
    - app/components/info/InfoDisplay.tsx
    - app/components/demons/DemonsOverlay.tsx

key-decisions:
  - "Pending is locked like preview: the plan lists preview and the ceiling only, but while a worker switch is building the naming an override would land on a naming that is about to be replaced, so the buttons are disabled and an open edit closes (editorAvailability: unavailable above the ceiling or in seed-only, locked in preview or pending, else open)"
  - "The editor renders nothing when the naming is for another base than the displayed one, the same guard 07-15 put on every display: a switch in flight must not ask a resolver for a zone outside its base. The view context is read optionally (useContext(NumogramViewContext), labels fall back to the default scheme) so the collision mount in 07-20 can render inside a panel with no view provider"
  - "commitName returns an `unchanged` flag beside the text (draft equal to the name on show, compared after NFC): saving it closes the edit with no history entry and no announcement. A draft equal to the RULE or PRESET name while an override stands is NOT unchanged: it is sent to the engine, which removes the override (proved through setOverride in the tests, at base 28 and for the CCRU name at mesh 44)"
  - "An edit belongs to the mesh it was opened on (activeEdit): if the Selection panel pins another demon while it is open the edit closes and reports false, never writing a draft to a different demon. In the overlay the pane is bound, so that case cannot arise"
  - "onDone is called after every close (save, Cancel rename and Escape), and Rename-button focus is restored in the selection and overlay mounts only; the collision mount lets its owner move focus to the jump button"
  - "A refused draft keeps the edit open with the message under the field, announces the sentence through the live carrier, and puts the caret back in the field; a message already on show follows the draft, so it clears as soon as the draft is fixed"
  - "Keys during an IME composition (isComposing or keyCode 229) are ignored: the name field takes any script, and the Enter that confirms a composition must not save. Enter saves only from the text field (on a button it is the button's own click), Escape cancels from anywhere inside an open edit and stops the event so the overlay does not close"
  - "The name field takes at most NAME_MAX_LENGTH x 8 code units (256), a local named constant: one character can be a base letter with several marks, so a plain 32 would refuse a valid name, and the cap still cuts an absurd paste before validation runs"
  - "DemonsOverlay keeps the bound demon as { base, info } and derives boundEdit from it only for the current base, and also clears it in an effect on a base change; detailShown returns the demon variant of HoverInfo, so the old `as HoverInfo & { type: 'demon' }` cast is gone"
  - "InfoDisplay passes the selection context from renderInfoContent for every demon: the Selected Elements list holds gates, currents, syzygies and zones only (selectedInfos never contains a demon), so the single pinned-demon render is the only mount in practice"

patterns-established:
  - "When a plan's behaviour line names a handler (Enter saves, Escape cancels, reset announces) and the repo has no DOM test library, name the decision as a pure function and the wiring as exact source lines, and let the e2e plans cover the effect-driven rest"

requirements-completed: []  # NAM-02 stays Pending at the orchestrator's phase gate: the editor and its two mounts are built and proved, but no NamingContext provider is mounted until 07-18 (and the panel's live carrier until 07-21), so the app still renders as before

# Metrics
duration: about 45 min (start was not stamped; estimated from the first test run at about 17:05Z and the last commit; includes one full test:swap of about 5 min and 79 mutant runs)
completed: 2026-11-10
---

# Phase 7 Plan 16: Demon Name Editor, Selection and Overlay Mounts, Hover-Proof Binding Summary

**One editor component now renames a single demon from the Selection detail and from the Demons overlay detail (source tag, Rename, a reset that reads `Reset to CCRU name` only where a preset name stands under the override, a validated field with its message under it, disabled in preview and while a base builds, not offered above the ceiling), and the overlay pane stays on the demon being edited however the pointer moves; with no provider the app renders exactly as before (test:swap: 60 DOM goldens and the behaviour baseline unchanged), proved by 87 tests and 79 mutants.**

## Performance

- **Duration:** about 45 min (estimate, see Metrics), including `test:swap`, the two-timezone run, typecheck, check-repo and the mutation runs
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit, plus a refactor, two test-strengthening commits and one small fix)
- **Files created:** 2 (`app/components/names/DemonNameEditor.tsx`, `tests/app/demonNameEditorRender.test.ts`); **modified:** 2 (`InfoDisplay.tsx`, `DemonsOverlay.tsx`)
- **`$PLAN_BASE`:** `bfe0bc782160b70a025f3929ccba6f5c108267ff`

## Accomplishments

- **The editor (`DemonNameEditor.tsx`).** Root `[data-post-baseline][data-demon-name-editor][data-demon-name-context="selection|overlay|collision"][data-demon-name-state="generated|preset|overridden"]`. Read mode: the 8px `Name` label, the tag (`generated`, `CCRU name`, `overridden`), `button[data-demon-rename]` `Rename demon` and, only when overridden, `button[data-demon-name-reset]`. Edit mode: `input[data-demon-name-input]` prefilled with the current name and fully selected, `aria-label="Name for demon {a}::{b}"`, `dir="auto"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck` false, `autoComplete="off"`, in the standard `ui-terminal-field` (the `--invalid` underline, `aria-invalid` and `aria-describedby` to a message line under it when a draft is refused), then `Save name` and `Cancel rename` in a `flex flex-wrap gap-1` row, every button 24px high. Unavailable: only `Renaming is available up to {INTERACTIVE_MAX_N} zones.`
- **Rules.** Outside a provider (or with the naming of another base) it renders nothing. Preview and pending disable every button natively and set `aria-disabled="true"` on the root; a draft that was open when that happens closes. Above the ceiling there is no button. Save checks the draft with `validateName` (NFC, 1 to 32 letters and marks, no space or digit) and then `apply({ type: 'override', mesh, name })`, where the engine checks again and removes the override when the text equals what the rule or preset gives; Reset applies `reset-override`; each is announced (`Renamed {a}::{b} to {name}.`, `{a}::{b} is back to {name}.`) only when `apply` accepted it, and a refusal sentence is announced too.
- **Selection mount.** `DemonInfo` gained optional `editorContext` and `onEditingChange` and renders the editor as the last child of its `space-y-1.5` wrapper, after the frame, in both the lore (base 10) and non-lore variants; `renderInfoContent` passes `selection`. Without `editorContext`, or without a provider, the markup is byte for byte as before (tested).
- **Overlay mount and binding.** `detailShown(hover, pinned, bound)` returns the bound demon first, then the hovered one, then the pinned one (demons only). `DemonsOverlay` keeps `bound` (`{ base, info }`), derives `boundEdit` for the current base only, clears it in an effect when the base changes, binds it when an editor reports editing and releases it when it reports done; the editor also reports false if it unmounts while open. The aside renders `<DemonInfo data={shown} editorContext="overlay" onEditingChange=... />`.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: the DemonNameEditor component**
   - RED: `dc13f28` (test) the missing module
   - GREEN: `2d651b3` (feat) the component, the view and the first pure helpers (51 tests)
   - Refactor: `d658b81` the save and reset decisions pulled into `saveOutcome`, `resetOutcome` and `nameAfterReset`, key events ignored unless an edit shows; tests for them and for the view's handler wiring (66 tests)
   - Strengthened after the first mutation batch: `11e24ab` (test) both announcement lines pinned exactly
2. **Task 2: mount the editor in DemonInfo and bind the overlay detail while editing**
   - RED: `5b1a982` (test) 13 of 85 failing on the missing props and `detailShown`
   - GREEN: `725f2f2` (feat) `InfoDisplay.tsx` and `DemonsOverlay.tsx`
   - Strengthened after the second mutation batch: `d14116f` (test) the editor is a sibling after the frame, and belongs to the demon on show
3. **Follow-up fix:** `18cfe9d` (fix) the caret returns to the field after a refused draft (found on review; test and three mutants added)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/components/names/DemonNameEditor.tsx` (new) - component, view and eight exported pure helpers
- `tests/app/demonNameEditorRender.test.ts` (new) - 87 tests
- `app/components/info/InfoDisplay.tsx` - the `editorContext` and `onEditingChange` props, two mount lines, one pass-through (15 added, 2 removed)
- `app/components/demons/DemonsOverlay.tsx` - `detailShown`, the bound state, the aside's props (`useState` import added)

## Decisions Made

See `key-decisions`. The three a reviewer should look at: pending treated as locked (beyond the plan), the `unchanged` flag and the rule-name save that clears an override, and the pane binding carrying its base.

## Mutation Checks

Each mutant was applied by a scratchpad runner (`run-mutants.mjs`) that refuses a no-op or a find text that does not occur exactly once, runs the test file in the foreground under a 150 s timeout, restores the source from a saved copy and confirms `git diff --quiet <file>`; every file was restored clean after every batch.

**Task 1 (55 mutants).** 52 in the first batch, 51 Killed and one survivor (`T1-49`: announcing the rename even when `apply` refused it); the survivor was killed by pinning the two exact accept-then-announce lines (a source assertion), and the last three (caret not returned to the field on a refusal, a refusal not announced, a refusal that does not keep the message) are Killed too. The 51 cover: the ceiling made inclusive, pending and preview each dropped from locked, the seed-only state ignored, `unchanged` never true and compared without NFC, the message without the net-span, the IME check removed, Escape only in the field, Enter anywhere, `activeEdit` ignoring the mesh, the reset label inverted and the reset shown for a preset name, the CCRU tag showing generated, `aria-disabled` always on and never on, Rename and Reset never disabled, no invalid underline, no `aria-invalid`, no `aria-describedby`, the message not red, `dir`, `spellCheck`, `autoComplete`, no `maxLength` and a one-unit-per-character cap (which first showed the cap test was too loose), a button row that does not wrap, no 24px target, the view never locked, the ceiling mode dropped, the edit shown while locked, the base guard removed, `autoEdit` ignored and the draft not prefilled, the net-span labels swapped and the higher zone taken as the lower, the reset label ignoring the preset, the tag, state and context attributes fixed, the post-baseline mark dropped, the key handler on the root in every mode, the override on the wrong mesh, the status naming the raw draft, the reset name ignoring the preset, the reset on the wrong mesh, the key handler without its guard, the collision mount refocusing Rename, and `onDone` never called.

**Task 2 (24 valid mutants, plus one invalid).** The plan's named mutant (`shown = hover ?? pinned`, ignoring the bound edit, by removing the bound line of `detailShown`) fails the binding test (`T2-01`, Killed). The other 11 in `DemonsOverlay.tsx`: pinned before hover, any hover or any bound counted as a demon, the pane built with no bound edit, the wrong context, a bound demon of another base kept, the base-change clear removed, closing not releasing, opening not binding, binding with the wrong base, and the context prop dropped, all Killed. In `InfoDisplay.tsx` 12: the selection context dropped, the editor missing from the lore or the non-lore variant, inside the frame (`T2-23`, which first SURVIVED and was killed by the new "the frame closes before the editor starts" assertion, in both variants), before the frame, `onEditingChange` not forwarded in either variant, always mounted, and mounted for the wrong demon, all Killed. One more (`T2-24`, the editor placed after the wrapper) was not a valid mutant (JSX syntax error, a suite error), so it was replaced by the valid `T2-24b` and is not counted.

79 valid mutants in all; 2 survivors found (`T1-49`, `T2-23`), both killed after adding a test; 0 equivalents.

## Verification Results

- Plan verify commands: Task 1 `npx cross-env CCRUG_TZ=UTC vitest run tests/app/demonNameEditorRender.test.ts --project oracle` plus `npm run typecheck` exit 0; Task 2 `npx cross-env CCRUG_TZ=UTC vitest run tests/app --project oracle` (55 files, 1807 tests passed on the final tree; 52 files and 1621 tests before this plan per 07-15) plus `npm run typecheck` exit 0. The editor test file also passes under `CCRUG_TZ=America/New_York` (87).
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint) exit 0 on the final tree; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx` (not touched). One lint warning that this plan's first draft raised (an effect that sets state with no dependency list) was fixed with a dependency list.
- `MSYS_NO_PATHCONV=1 npm run test:swap` after Task 2 (two existing app files edited, run at `d14116f`): exit 0; build, 65 Playwright tests passed in 3.1 min (the 5 skipped are the behaviour specs on the New York project, by design, so the 60 DOM goldens and the behaviour baseline are unchanged), 115 files and 3,723 unit tests passed. Not run after Task 1 (a new file only, which nothing imported until Task 2). After that run only `DemonNameEditor.tsx` (a new, provider-gated file) and the test file changed, by the two-line caret fix; the unit run for them is the 1,807-test `tests/app` run above.
- `node scripts/check-repo.mjs` (all 11 gates incl. `base-ten`, `lore`, `goldens`, `lf`): OK on the final tree, with the new files staged before the `base-ten` run. `npm run check:weight` on the swap build: OK (2 routes, 30 golden states within tolerance; `namingCopy.ts` now reaches the main bundle through `InfoDisplay`).
- Acceptance: `grep -c "data-demon-name-editor"` 1 and `data-demon-name-context` 1 in the editor; `type: 'override'` 1 and `type: 'reset-override'` 1; `grep -c editorContext app/components/info/InfoDisplay.tsx` 5; `grep -c 'editorContext="overlay"'` 1 and `grep -c "export function detailShown"` 1 in `DemonsOverlay.tsx`; `git diff --stat $PLAN_BASE -- tests/app/demonsOverlayRender.test.ts` prints nothing. `git diff --name-only $PLAN_BASE HEAD` lists exactly the four files above: no golden, behaviour baseline, engine file, signed-off vector or bank, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx`, `app/presets/base10/**` or `reference/` was touched.
- `npm run verify` was not run (the proportionate gate is the swap run, typecheck, check-repo and the weight check above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Pending locks the editor, and a naming of another base renders nothing**
- **Found during:** Task 1 (reading 07-15's summary and the pending state of the panel)
- **Issue:** the plan disables the buttons in preview and removes them above the ceiling, but says nothing about `pending` (a worker switch building the naming) or a switch in flight where the displayed base and the naming's base differ. An override applied then would land on a naming about to be replaced, and `resolver.stateOf` raises a RangeError for a zone outside its base.
- **Fix:** `editorAvailability` returns `locked` for pending as well as preview; the editor returns null when the displayed base is not the naming's base (the 07-15 guard); an edit that becomes unshowable closes and reports false. Tests and mutants cover each.
- **Files modified:** `DemonNameEditor.tsx`
- **Commits:** `2d651b3`, `d658b81`

**2. [Rule 1 - Bug avoided] A draft is bound to its mesh**
- **Found during:** Task 1 (the plan's "draft keyed by mesh, reset only if not editing")
- **Issue:** if the Selection panel pins another demon while an edit is open, a draft left in state would be saved onto the new demon.
- **Fix:** the edit stores the mesh it was opened on; `activeEdit` shows it only for that demon; otherwise it closes. Save uses the stored mesh, not the displayed one.
- **Commits:** `2d651b3`, `d658b81`

### Conflicts and additions recorded, not bugs

**3. [Plan detail] The editor is a container plus an exported view, with eight exported pure helpers.** The plan names `commitName(draft, current, netSpan)` only. The repo has no DOM test library, so the markup (`DemonNameEditorView`, no hooks) and the decisions (`saveOutcome`, `resetOutcome`, `nameAfterReset`, `editKeyAction`, `editorAvailability`, `activeEdit`, `resetLabelOf`) are exported so tests can reach them. `commitName` returns `{ ok: true, text, unchanged }` (a superset of the plan's `{ ok: true, text }`).

**4. [Plan detail] The view context is optional (`useContext(NumogramViewContext)`), not `useNumogramView()`**, which throws outside a provider; labels fall back to the default scheme exactly as `NamesPanel` does. Inside DemonInfo nothing changes.

**5. [Plan detail] `boundEdit` is derived from a `{ base, info }` state, not stored as a bare `HoverInfo`.** The plan says to clear it when the base changes; carrying the base makes the first render after a switch already safe, and an effect clears the stale state as well. `detailShown` returns the demon variant of `HoverInfo`, which removed the cast in the aside.

**6. [Addition] The name field is capped at 256 code units, a refusal is announced and returns the caret to the field, IME keys are ignored, and `onDone` follows every close** (not only a save). Each is small, recorded under `key-decisions`, and covered by a pure helper or a source assertion.

**Total deviations:** 2 auto-fixes (1 missing-functionality guard, 1 bug avoided), 4 recorded refinements. None changes the name or shape of the plan's contracts (`DemonNameEditor`'s props, `DemonInfo`'s `editorContext`, `detailShown`'s signature).

## Issues Encountered

None blocking. The first mutation batch found one survivor (the rename announced even when `apply` refused it) and the second one (the editor mounted inside the frame instead of after it); both were test gaps, closed before the next step. A mutant that placed the editor after the wrapper was invalid JSX and was replaced rather than counted.

## Known Stubs

None. The collision mount is a prop-compatible third mount (`context="collision"`, `autoEdit`, `onDone`) that 07-20 wires; nothing renders it yet by design.

## Not covered by a node test (left to the e2e plans 07-22 and 07-23)

The editor cannot be seen in the app until 07-18 mounts the `NamingContext` provider (and 07-21 the panel that carries the live announcements). The decisions inside the effect-driven parts are the pure helpers above, each tested and mutated; the effects themselves have no DOM test here: the caret and selection on entering edit mode, focus returning to Rename after Save, Cancel and Reset, the real Enter and Escape key events (Escape must not close the overlay), `onEditingChange` reaching the overlay while the pointer crosses other rows, and the unmount report. The e2e plans should cover them with `[data-demon-name-editor][data-demon-name-context="selection"|"overlay"]` selectors (the bare selector is ambiguous), and the overlay case from UI-SPEC "Editor binding" (open `Rename demon`, move across rows, the same demon stays with its draft).

## Threat Flags

None beyond the register. T-07-03e: the draft goes through `validateName` in the component and again in the engine op (a refusal never reaches `apply`). T-07-17b: in preview and pending every button is natively disabled and an open edit closes; the session reducer refuses override actions in preview too. T-07-10c: names are input values and text nodes only (a hostile override renders escaped, asserted; no `dangerouslySetInnerHTML`, asserted on the source).

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `test(07-16)` `dc13f28` before `feat(07-16)` `2d651b3`, and `test(07-16)` `5b1a982` before `feat(07-16)` `725f2f2`. Each RED run failed before its GREEN commit (Task 1 on the missing module; Task 2 with 13 failing tests). A `refactor(07-16)` commit (`d658b81`) followed Task 1's GREEN.

## Next Phase Readiness

- 07-19 (the zone list and the shortcuts line) is next in the order and does not depend on this plan. 07-18 mounts the provider: `apply` must return false for a refused action (the editor announces only an accepted one), `announce` must reach the panel's live carrier, and `state` must be `pending`, `preview`, `seed-only` or `ready` so the editor's lock follows. 07-20 mounts `<DemonNameEditor a b context="collision" autoEdit onDone={...} />` inline in the collision list: `onDone` fires after save, cancel and Escape, and the editor does not move focus in that context, so 07-20 focuses the jump button.
- No blocker.

## Self-Check: PASSED

- Both created files exist and are tracked (`app/components/names/DemonNameEditor.tsx`, `tests/app/demonNameEditorRender.test.ts`), and both modified files are in the commits.
- All eight task commits exist (`dc13f28`, `2d651b3`, `d658b81`, `11e24ab`, `5b1a982`, `725f2f2`, `d14116f`, `18cfe9d`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, golden, behaviour baseline, `reference/` file, `engine/` file, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `app/presets/base10/` file was touched.
