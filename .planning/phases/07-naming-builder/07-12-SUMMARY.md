---
phase: 07-naming-builder
plan: 12
subsystem: app-label-mode
tags: [naming, sounds-label-mode, fit-rule, svg-tier, label-scheme-controls, labels-panel, grapheme-safe, byte-identical-goldens, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-04 (CyberRadio optional props), plan 07-05 (resolver), plan 07-09 (labels=sounds in the label scheme codec) and plan 07-11 (NAMES_COPY, zoneSoundAria)
provides:
  - app/lib/soundLabels.ts, the one pure fit rule for a sound in a node (SOUND_EM_NARROW, SOUND_EM_WIDE, SOUND_FIT_BUDGET, SOUND_MIN_FONT_PX, SoundFit, fitSoundLabel, isWideGrapheme)
  - Projection.tsx optional props zoneSounds and labelPxPerUnit; the non-planetary zone label slot draws the fitted sound (data-sound-label, data-truncated) and the node is named by it
  - LabelSchemeControls Sounds radio between Xeno and Custom, flex-wrap row, the sounds note and the numerals note; BasePicker forwards numeralsLayout
  - LabelsPanel numbers row reads Sounds (and its hover text) only while the scheme is sounds
  - 49 new tests (23 fit rule, 10 Projection, 16 controls and panel)
affects: [07-14, 07-21, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One pure fit function shared by both tiers and both Canvas passes: the caller passes the sound, the on-screen node radius and the layout label size in px and draws exactly what comes back (07-14 reuses it for the static pass and the highlight overlay)"
    - "A new render branch behind optional props whose absence emits the old markup byte for byte; the guard (no table, no scale, planetary) makes the default path the old code, and test:swap proves the 60 DOM goldens"
    - "A spy that wraps a hook-free component (CyberRadio, HoverInfoList) to reach a handler or hover-only text from a server render, with no new test dependency"
    - "A source-text assertion for what a static render cannot observe (state set before a callback; a prop forwarded into a client-only portal)"

key-files:
  created:
    - app/lib/soundLabels.ts
    - tests/app/soundLabels.test.ts
    - tests/app/labelsPanelSounds.test.ts
  modified:
    - app/components/projection/Projection.tsx
    - app/components/numogram/LabelSchemeControls.tsx
    - app/components/numogram/BasePicker.tsx
    - app/components/panels/LabelsPanel.tsx
    - tests/app/projectionRender.test.ts

key-decisions:
  - "The Sounds radio label and both notes and the Labels panel row text come from NAMES_COPY (soundsRadio, soundsNote, numeralsNote, labelsRowSounds, labelsInfoSounds), never typed in a component (the single copy module, 07-11). The plan's acceptance grep for the literal label=\"Sounds\" therefore counts 0; the rendered label is Sounds and a test pins it and the key"
  - "A one-grapheme sound that does not fit is kept as is at 6 px and reported truncated: false (the plan text says true). Nothing was cut, and data-truncated=\"true\" would then claim a cut that did not happen. A multi-grapheme sound cut down to one grapheme is truncated: true"
  - "Projection draws a zone with no sound (an empty or missing table entry) as its numeral with its usual accessible name, per the UI-SPEC fallback label, instead of an empty text element"
  - "fontSize in the sounds label is the layout labelSize itself when the sound fits at full size (not fontPx / scale), so a full-size label carries no floating-point noise such as 17.000000000000004"
  - "The sounds note paragraph carries data-post-baseline itself as well as sitting in the dropdown portal that already is one"
  - "NumogramClient is not touched: nothing passes zoneSounds, labelPxPerUnit or numeralsLayout yet (07-21 wires the viewer), so choosing Sounds in the picker currently changes the label scheme and the note only and the diagram still draws digits"

patterns-established:
  - "A guard that compares with NaN is written as the negation of the fitting condition, so a NaN radius degrades to one grapheme like a zero radius (the first draft kept the whole sound for NaN; a test found it)"

requirements-completed: []  # NAM-01 stays Pending at the orchestrator's phase gate: the sounds label mode is built and tested here, but nothing passes the sounds to a diagram until 07-21 (and the Canvas passes in 07-14)

# Metrics
duration: about 40 min of work across two sessions (a usage limit interrupted it between the Task 2 tests and its GREEN commit)
completed: 2026-11-10
---

# Phase 7 Plan 12: Sounds Label Mode (Fit Rule, SVG Slot, Radio and Labels Panel) Summary

**One pure grapheme-safe fit rule (0.62 em narrow, 1.0 em wide, 90% of the node diameter, 6 px floor, ellipsis cut) now drives a `sounds` label mode on the SVG tier: the non-planetary node label shows the fitted sound with `data-sound-label` and the node is named `Zone {digits}, sound {sound}, {Region}`, the label row gained a Sounds radio with its note, and the Labels panel row reads Sounds only in that mode, with every other mode byte-identical (test:swap: 60 DOM goldens and the behaviour baseline unchanged after each task).**

## Performance

- **Duration:** about 40 min of work, in two sessions (interrupted by a usage limit after the Task 2 RED commit)
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each a RED commit and a GREEN commit)
- **Files created:** 3 (1 module, 2 test files); **modified:** 5 (4 app files, 1 test file)
- **`$PLAN_BASE`:** `fe457cddd6fabfe2b12e9c26abe910c82435c409`

## Accomplishments

- **Fit rule (`app/lib/soundLabels.ts`, 82 lines).** `fitSoundLabel(sound, rPx, fullPx)` splits the sound into graphemes with the engine's `splitGraphemes`, estimates the width as the sum of 0.62 em (1.0 em for Han, Hiragana, Katakana, Hangul, Bopomofo and the fullwidth forms, judged by a grapheme's first code point) and returns the layout size when it fits `1.8 x rPx`, else the shrunk size `budget / em` when that is at least 6 px, else 6 px with the longest whole-grapheme prefix that leaves room for an ellipsis (U+2026, built from its code point), and a single grapheme without an ellipsis when not even two fit. UI-SPEC worked example reproduced: R_px 15.2 gives 6.31 px for 7 graphemes, 12.3 px for 2, 6 px and 7 graphemes ending in the ellipsis for 16; R_px 7 gives `ab` plus the ellipsis; R_px 3 gives `a`; four ideographs shrink to 6.84 px.
- **SVG slot (`Projection.tsx`, +34 lines).** Optional `zoneSounds` and `labelPxPerUnit`. `soundTable` is non-null only off the planetary layout, with a table and a non-zero scale. In the zone map a zone with a sound is named by `zoneSoundAria` and its label text becomes the fitted sound at `fontPx / labelPxPerUnit` world units (the layout `labelSize` itself when it fits at full size) with the same anchor, weight, family, fill and pointer style as the numeral, plus `data-sound-label` (the full sound) and `data-truncated="true"` only when cut. The existing numeral `<text>` is unchanged byte for byte and renders whenever `sound === null`. The sound is a React text child and attribute value, so it is escaped (a test renders `<b>x`).
- **Controls.** `LabelSchemeControls`: `soundsChecked`, `selectSounds` (closes the custom disclosure, then `onChange({ mode: 'sounds' })`), the Sounds radio between Xeno and Custom, row class `flex flex-wrap items-center gap-2 gap-y-1`, and under the row, only while the scheme is sounds, a `text-[10px] text-gray-400` post-baseline note: the sounds note, or the numerals note when the new optional `numeralsLayout` prop is true. `BasePicker` takes `numeralsLayout` (default false) and forwards it.
- **Labels panel.** `LabelsPanel` reads `labelScheme` from the view context; only in sounds mode the numbers row label is `Sounds` and its hover text is the sounds sentence. The base-10 strings (`Numbers`, `Show or hide numeric zone ids (0-9) on the diagram.`) are context lines in the diff, not touched.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: the shared fit function and the SVG sounds label slot**
   - RED: `f9d09b0` (test) fit rule tests (module missing) and 10 Projection cases
   - GREEN: `e704a2d` (feat) `soundLabels.ts` and the Projection edit
2. **Task 2: the Sounds radio, its notes and the Labels panel wording**
   - RED: `8fb5393` (test) `labelsPanelSounds.test.ts` (11 of 16 failing)
   - GREEN: `47d2d50` (feat) the three component edits and a corrected source-assertion regex in the test file

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/lib/soundLabels.ts` - new, 82 lines
- `app/components/projection/Projection.tsx` - 2 props, 1 guard, per-zone sound lookup and fit, 1 new sibling `<text>` (the numeral `<text>` gained a `sound === null` guard only)
- `app/components/numogram/LabelSchemeControls.tsx`, `BasePicker.tsx`, `app/components/panels/LabelsPanel.tsx` - as above
- `tests/app/soundLabels.test.ts` (23 tests, incl. three fast-check properties of 400 runs), `tests/app/projectionRender.test.ts` (existing cases untouched, 10 added), `tests/app/labelsPanelSounds.test.ts` (16 tests)

## Decisions Made

See `key-decisions`. The two a reviewer should look at: the Sounds radio text comes from `NAMES_COPY.soundsRadio` (so the plan's `label="Sounds"` grep is 0), and a one-grapheme sound is never reported as cut.

## Mutation Checks

Each mutant was applied with one edit to a file saved beforehand, ran the named test file in the foreground under a timeout, was restored from the saved copy, and `git diff --quiet <file>` confirmed the restore (clean every time). Every mutant was a real change.

The plan's two named mutants (`soundLabels.ts`, 23-test baseline green), both **Killed**:

| # | Mutation | Failing tests |
|---|----------|---------------|
| T1-a | `SOUND_MIN_FONT_PX` 6 -> 5 | 8 (the constants, the 16-grapheme case, the boundary, R_px 7, R_px 3, a one-grapheme case, the ZWJ and marked-letter cases) |
| T1-b | the ellipsis width left out of the truncation budget (`used = 0`) | 6 (the 16-grapheme case, the boundary, R_px 7, R_px 3, marked letters, and the width property) |

Extras on `Projection.tsx` (37-test baseline green), each **Killed**:

| # | Mutation | Failing tests |
|---|----------|---------------|
| P-a | planetary layout no longer excluded from the sounds table | 1 (planetary numerals stay) |
| P-b | `data-truncated="true"` on every sound label | 1 (the size and cut cases) |
| P-c | font size not divided by the px-per-unit scale | 1 (the size and cut cases) |

Extras on the controls and panel (`labelsPanelSounds.test.ts`, 16-test baseline green), each **Killed**:

| # | Mutation | Failing tests |
|---|----------|---------------|
| C-a | the Labels panel sounds wording applies in digits mode too (`!== 'xeno'`) | 3 |
| C-b | the two notes swapped | 3 |
| C-c | `selectSounds` without `setOpen(false)` | 1 (the source assertion; a static render cannot observe a state set) |
| C-d | the Sounds radio placed after Custom | 1 |

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/soundLabels.test.ts tests/app/projectionRender.test.ts --project oracle`: 2 files, 60 tests passed. `... tests/app/labelsPanelSounds.test.ts tests/app/basePickerRender.test.ts --project oracle`: 2 files, 24 tests passed.
- `MSYS_NO_PATHCONV=1 npm run test:swap` after Task 1 (Projection edited): exit 0, build, 65 Playwright tests passed (30 + 5 on `chromium-utc`, 30 goldens on `chromium-ny`; 5 skipped are the behaviour specs on the New York project, by design), 109 files and 3352 unit tests passed. After Task 2 (three more app files edited): exit 0, 65 Playwright passed (3.1 min), 110 files and 3368 unit tests passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx`.
- `node scripts/check-repo.mjs` (all 11 gates incl. `base-ten`, `lore`, `goldens`, `lf`): OK after the final commit. `npm run check:weight` after the second build: OK (2 routes, 30 golden states within tolerance), so pulling `namingCopy.ts` into the main bundle through `Projection` stays inside the page-weight budget.
- Acceptance greps: `export function fitSoundLabel` 1, `SOUND_MIN_FONT_PX = 6` 1, `data-sound-label` 1 in Projection, `flex-wrap` 1, `numeralsLayout` 3 in BasePicker; `git diff $PLAN_BASE -- LabelsPanel.tsx | grep -c "^-.*Show or hide numeric zone ids"` 0; `git status --porcelain e2e/__golden__ e2e/__behaviour__` prints nothing. `grep -c 'label="Sounds"' LabelSchemeControls.tsx` is 0 by decision (see Deviations 1). `git diff --name-only $PLAN_BASE HEAD` lists exactly the 8 files above: no golden, behaviour baseline, engine file, signed-off vector or bank, `PairGraphProjection.tsx`, `app/presets/base10/**` or `reference/` was touched.
- `npm run verify` was not run (proportionate gate for this plan is the two swap runs, typecheck, check-repo and the weight check above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Conflict, resolved toward the single copy module] The Sounds radio label is not typed as `label="Sounds"`**
- **Found during:** Task 2
- **Issue:** The plan's action and acceptance grep write the literal `label="Sounds"`, but 07-11 made every visible string of the feature a `NAMES_COPY` key (`soundsRadio`) and the coordinator's instructions are to take all copy from `NAMES_COPY` and type none in a component.
- **Fix:** `label={NAMES_COPY.soundsRadio}`. The rendered label is `Sounds` (asserted by the test through the spy on `CyberRadio` and the markup), and a separate assertion pins `NAMES_COPY.soundsRadio === 'Sounds'`. The literal grep for `label="Sounds"` returns 0.
- **Files modified:** `app/components/numogram/LabelSchemeControls.tsx`
- **Commit:** `47d2d50`

**2. [Rule 1 - Bug] A one-grapheme sound was reported as cut**
- **Found during:** Task 1 (writing the tests from the contract)
- **Issue:** The plan's step returns `{ text: g[0], fontPx: 6, truncated: true }` whenever fewer than two graphemes fit. For a one-grapheme sound the text is the whole sound, so `data-truncated="true"` would claim a cut that did not happen.
- **Fix:** `truncated: graphemes.length > 1` in that branch. The multi-grapheme case in the plan's behaviour list (`eiaoung` at R_px 3 gives `e`, truncated true) is unchanged and tested; a new test covers the one-grapheme case.
- **Files modified:** `app/lib/soundLabels.ts`
- **Commit:** `e704a2d`

**3. [Rule 1 - Bug] A NaN radius kept the whole sound**
- **Found during:** Task 1, first GREEN run (one failing test of 23)
- **Issue:** The truncation loop's `(used + w) * 6 > budget` is false for a NaN budget, so nothing ever broke the loop and `abc` came back whole.
- **Fix:** the break condition is the negation of the fitting condition, `!((used + w) * 6 <= budget)`, so a NaN radius keeps one grapheme like a zero radius.
- **Files modified:** `app/lib/soundLabels.ts`
- **Commit:** `e704a2d`

**4. [Rule 2 - Missing critical functionality] A zone without a sound falls back to its numeral**
- **Found during:** Task 1
- **Issue:** The plan's step 2 indexes `zoneSounds[z]` unconditionally; a short table or an empty entry would draw an empty label and a name `Zone 3, sound , ...`. UI-SPEC "Fallback label" says a zone with no sound draws its normal digits label, never a placeholder.
- **Fix:** `const sound = soundTable !== null && soundTable[z] ? soundTable[z] : null`; with `null` the numeral label and the usual accessible name render. A test covers one empty entry.
- **Files modified:** `app/components/projection/Projection.tsx`
- **Commit:** `e704a2d`

**5. [Test correction] A source-assertion regex stopped at the first brace**
- **Found during:** Task 2, before the GREEN commit
- **Issue:** `[^}]*` ended inside `onChange({ mode: 'sounds' })`; the working copy may also be CRLF.
- **Fix:** the regex matches to the function's closing line and the source is normalised to LF first.
- **Files modified:** `tests/app/labelsPanelSounds.test.ts`
- **Commit:** `47d2d50`

**Total deviations:** 1 copy-rule conflict resolved, 2 bugs (the one-grapheme flag, NaN), 1 missing fallback, 1 test fix. None changes an exported name or a UI-SPEC sentence.

## Issues Encountered

A usage limit interrupted the run between the Task 2 RED commit and its GREEN commit; the staged Task 2 work was reviewed against the acceptance criteria, then verified and committed on resume. No work was lost.

## Known Stubs

None in the files of this plan. One interim state is by design and tracked: nothing passes `zoneSounds`, `labelPxPerUnit` or `numeralsLayout` yet (`NumogramClient.tsx` is outside this plan), so selecting Sounds in the picker sets the scheme and shows the note, while the diagram still draws digits until 07-21 wires the viewer. The Canvas tier draws digits in sounds mode until 07-14.

## Threat Flags

None beyond the register. T-07-10: sounds are React text children and attribute values (a test renders `<b>x` and finds it escaped). T-07-13c: the sounds branch exists only with a table, a non-zero scale and a non-planetary layout; test:swap proved the 60 goldens unchanged twice. T-07-19b: the accessible name always holds the digits label and the full sound (a 16-letter cut label is named by all 16 letters, tested); the validator upstream refuses bidi and format characters.

## TDD Gate Compliance

Both tasks followed RED then GREEN in separate commits: `test(07-12)` `f9d09b0` before `feat(07-12)` `e704a2d`, and `test(07-12)` `8fb5393` before `feat(07-12)` `47d2d50`. Each RED run failed before its GREEN commit (Task 1: the fit module missing, then 8 of the Projection cases; Task 2: 11 of 16). No refactor commit was needed.

## Next Phase Readiness

- 07-14 (Canvas passes) reads `fitSoundLabel` from `app/lib/soundLabels.ts` and calls it in both the static node pass and the highlight overlay with the same radius and size, so the two agree; 07-21 passes `zoneSounds` and `labelPxPerUnit = (580 / svgWidth) * zoom` to `Projection` (R_px = `nodeRadius * labelPxPerUnit`, the same product the level of detail uses), the sounds only when the scheme is `sounds` and the base is within the interactive ceiling, and `numeralsLayout` to `BasePicker` for the pair graph and planetary layouts.
- No blocker.

## Self-Check: PASSED

- All created files exist and are tracked: `app/lib/soundLabels.ts`, `tests/app/soundLabels.test.ts`, `tests/app/labelsPanelSounds.test.ts`.
- All four task commits exist (`f9d09b0`, `e704a2d`, `8fb5393`, `47d2d50`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, golden, behaviour baseline, `reference/` file, `engine/` file, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `app/presets/base10/` file was touched.
