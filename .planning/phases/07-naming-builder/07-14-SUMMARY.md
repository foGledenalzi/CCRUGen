---
phase: 07-naming-builder
plan: 14
subsystem: app-canvas-sounds
tags: [naming, sounds-label-mode, canvas-tier, draw-passes, no-ghosting, keyboard-announcements, chord-callout, live-names, byte-identical-digits-path, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-12 (fitSoundLabel, the one shared fit rule), plan 07-13 (useNaming(), the null-default NamingContext) and plan 07-11 (zoneSoundAria in the single copy module)
  - phase: 06-canvas-tier-and-worker
    provides: the layered Canvas draw module, the keyboard model, the diagram model and CanvasDiagram this plan extends
provides:
  - draw.ts DrawState.zoneSounds (optional, inherited by OverlayState); both zone-label passes (the static node pass and the highlight overlay) paint the fitted sound per label through one fit call each, with the same radius and size
  - keyboardModel.ts TargetText.zoneSounds; a zone with a sound is announced and named "Zone {digits}, sound {sound}, {Region}" (selected and not-selected suffixes after it)
  - diagramModel.ts targetTextFor sixth argument zoneSounds and the pure chordCalloutText (net-span, middle dot, live name; the chord's own name without a naming)
  - CanvasDiagram optional zoneSounds prop wired into both draw states, both keyboard texts and their dependency lists; useNaming() feeds the chord callout
  - 35 new tests (11 draw, 8 keyboard, 12 model and wiring, 4 callout in a server render) and 10 mutants run
affects: [07-15, 07-21]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new branch in a hot draw loop sits BESIDE the old one (`if (showNumber && sounds !== null) {...} else if (showNumber) {...}`), so the digits path lines keep their indentation and the diff against the plan base removes only the two `if` lines"
    - "The ghost test: one recorded static pass and one recorded overlay pass at the same transform, compared label by label on text and font string, at fit and zoomed (the fit changes with the radius, so a wrong size argument shows)"
    - "A source-text assertion for wiring a server render cannot reach (a state object literal carries the prop, a dependency list names it, the chord callout goes through the pure function), next to a server render that CAN reach the callout chip for zones"
    - "A pure text function takes the resolver's method or null (never the whole naming), so the module stays free of React and the engine"

key-files:
  created: []
  modified:
    - app/lib/canvas/draw.ts
    - app/lib/canvas/keyboardModel.ts
    - app/lib/canvas/diagramModel.ts
    - app/components/canvas/CanvasDiagram.tsx
    - tests/app/canvasDraw.test.ts
    - tests/app/canvasKeyboard.test.ts
    - tests/app/canvasDiagramModel.test.ts
    - tests/app/canvasDiagramRender.test.ts

key-decisions:
  - "A zone whose sound is empty or missing keeps its DIGITS label in both draw passes and its digits wording in the announcements (the plan writes `?? ''`, which would paint an empty text and say `Zone c, sound , Torque`). This is the UI-SPEC fallback label and the same rule 07-12 chose for the SVG tier, so the visible text and the accessible name still agree"
  - "keyboardModel.ts imports the copy module as a namespace (`import * as namingCopy`) and calls `namingCopy.zoneSoundAria(`, so the plan's literal acceptance grep `grep -c zoneSoundAria keyboardModel.ts` counts exactly 1 (a named import would add the import line and make it 2). Behaviour is identical"
  - "chordCalloutText catches a RangeError from the naming (a naming that does not cover the chord's zones, such as a stale base during a switch) and returns the chord's own name; any other error propagates. The component additionally passes a resolver only when `naming.base === scene.base`, so a naming of another base is never asked for a name"
  - "The chord parameter type carries an optional `kind` (`{ a, b, name, kind? }`): the plan's own behaviour example passes a `kind`, which an exact `{ a, b, name }` type refuses as an excess property in a literal"
  - "The label font in sounds mode is set per label inside the loop (the fit shrinks or cuts a long sound), and the radius handed to the fit is `geo.rPx`, the on-screen node radius that level of detail already uses, with `scene.labelSize * geo.s` as the full size: the same two numbers in both passes"
  - "Callout and announcement tests for zones are also server-rendered in canvasDiagramRender.test.ts (a file not in the plan's list): the chip text for a pinned or hovered zone is reachable from a static render and proves the prop reaches targetTextFor inside the component"

patterns-established:
  - "When a plan's acceptance grep counts a symbol on lines, an import line counts too: check the count before writing the import style"

requirements-completed: []  # NAM-01 and NAM-02 stay Pending at the orchestrator's phase gate: the Canvas passes, announcements and chord callout are built and tested here, but nothing passes zoneSounds to CanvasDiagram until 07-21 and the NamingContext provider arrives in 07-18

# Metrics
duration: about 25 min (start about 15:50Z, last task commit 16:12Z; includes two full test:swap runs of about 5 min each)
completed: 2026-11-10
---

# Phase 7 Plan 14: Canvas Sounds Labels, Sound-Aware Announcements and Live Chord Callout Names Summary

**On the Canvas tier the sounds label mode now paints each zone's fitted sound with the same text and font in both the static node pass and the highlight overlay (no ghosting), behind the existing label toggle and level of detail; keyboard announcements and the callout name a zone "Zone {digits}, sound {sound}, {Region}"; and a hovered demon chord's callout reads `a::b · Name` from the live naming at render time; with no table the digits path is byte for byte what it was (test:swap: 60 DOM goldens and the behaviour baseline unchanged after each task).**

## Performance

- **Duration:** about 25 min, including two full `test:swap` runs
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2 (each as a RED commit and a GREEN commit)
- **Files created:** 0; **modified:** 8 (4 app files, 4 test files)
- **`$PLAN_BASE`:** `63ecfe65c1b52f9dc0f7f247dabbfd8694c44883`

## Accomplishments

- **Both zone-label passes (`draw.ts`, +42 lines, 2 removed).** `DrawState` gained `zoneSounds?: readonly string[] | null` (inherited by `OverlayState`). The static node pass and the highlight overlay each get a sounds branch beside the old loop: with numbers on and a table, per label `fitSoundLabel(sound, geo.rPx, scene.labelSize * geo.s)`, `ctx.font = bold ${fit.fontPx}px monospace`, `fillText(fit.text, cx, cy + nudge)`. A zone with an empty or missing entry keeps its numeral at the layout size. Without a table (absent or null) the old single-font loops run unchanged: the only removed lines in the diff are the two `if (showNumber)` and `if (st.labelVisibility.numbers)` headers, never a `ctx.font = bold ${scene.labelSize * geo.s}px monospace` line. Pair pills, gate labels, the xenotation passes and region captions are untouched. Both passes keep their guards (`showNumber` or `labelVisibility.numbers`, and `if (!geo.lod) return`), so level of detail is unchanged.
- **Announcements (`keyboardModel.ts`, `diagramModel.ts`).** `TargetText.zoneSounds`; `zoneText` returns `zoneSoundAria(digits, sound, region, withSelected)` when the zone has a sound, so `announcementFor`, `activationAnnouncement` (suffix after the sound text, never doubled) and the callout chip name the zone with its full, untruncated sound; every edge, pair and focus-key string keeps numerals. `targetTextFor(view, zoneLabels, index, scene, selZones, zoneSounds = null)` carries the table.
- **Chord callout (`diagramModel.ts`, `CanvasDiagram.tsx`).** `chordCalloutText(chord, zoneLabels, nameOf)` returns the chord's own name without a naming, else `${labels[a]}::${labels[b]} · ${nameOf(a, b)}` (middle dot built from its code point, net-span first so nothing disappears at a base whose names differ from the preset; the baked legacy name is never shown once a naming is given). `CanvasDiagram` takes `zoneSounds` (default null), puts it in the static state, the overlay state, both `targetTextFor` calls and every dependency list (the static raster's, which also repaints the overlay, and both memoised texts), calls `useNaming()` unconditionally at the top and builds the chord callout with the resolver's `nameOf` only when `naming.base === scene.base`.

## Task Commits

Each task was committed atomically, test first:

1. **Task 1: both Canvas zone-label passes paint fitted sounds**
   - RED: `166d9c4` (test) 11 sounds cases in `canvasDraw.test.ts`; 4 failing on the real expectation, the rest pinning behaviour that must not change
   - GREEN: `6b04ae0` (feat) the `draw.ts` field, import and two branches; the same commit tightens the fallback test (one text per zone, no empty text) after a mutant survived
2. **Task 2: sound-aware Canvas announcements and the live chord callout name**
   - RED: `838b016` (test) 19 failing tests across the keyboard, model and render files
   - GREEN: `092d3e2` (feat) the `keyboardModel`, `diagramModel` and `CanvasDiagram` edits; the same commit adds the base-guard source assertion

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## Files Created/Modified

- `app/lib/canvas/draw.ts` - import, 1 field, 2 branches
- `app/lib/canvas/keyboardModel.ts` - namespace import, 1 field, `zoneText`
- `app/lib/canvas/diagramModel.ts` - sixth argument, `CHORD_CALLOUT_SEP`, `chordCalloutText`
- `app/components/canvas/CanvasDiagram.tsx` - import of `chordCalloutText` and `useNaming`, prop, two states, two texts, dependency lists, callout text
- `tests/app/canvasDraw.test.ts` (11 added), `canvasKeyboard.test.ts` (8), `canvasDiagramModel.test.ts` (3 + 6 + 3), `canvasDiagramRender.test.ts` (4); existing assertions untouched

## Decisions Made

See `key-decisions`. The two a reviewer should look at: a zone without a sound keeps its digits label and wording (the plan's `?? ''` would have painted empty text), and `keyboardModel.ts` uses a namespace import so the plan's literal `zoneSoundAria` grep counts 1.

## Mutation Checks

Each mutant was one edit to a file saved beforehand, ran the named test files in the foreground under a timeout, was restored from the saved copy, and `cmp` against the saved copy confirmed the restore (identical every time). Every mutant was a real change.

The plan's named mutant (`draw.ts`, 134-test baseline green): passing `scene.labelSize` (without `* geo.s`) as the full size in the OVERLAY pass only is **Killed**, and by exactly one test, the ghost test (`the highlight overlay paints the same text and the same font string as the static pass`, 133 passed and 1 failed).

Extras on `draw.ts` (each **Killed**):

| # | Mutation | Failing tests |
|---|----------|---------------|
| T1-b | static pass keeps the numeral font size instead of the fitted `fit.fontPx` | 2 (the static fit test and the ghost test) |
| T1-c | static pass paints the fallback numeral and then also an empty fit text (no `continue`) | 1 (the no-sound fallback test, after the count and empty-text assertions were added: the first draft let this survive) |
| T1-d | the same in the overlay pass | 1 (the fallback test) |
| T1-e | overlay sounds branch ignores the numbers toggle | 2 (the numbers toggle test and the xenotation test) |

Extras on Task 2 (each **Killed**):

| # | Mutation | Failing tests |
|---|----------|---------------|
| T2-a | `keyboardModel`: the selected flag dropped in the sound branch | 3 |
| T2-b | `keyboardModel`: the empty-sound fallback removed | 1 |
| T2-c | `chordCalloutText`: net-span order swapped | 4 |
| T2-d | `chordCalloutText`: every error swallowed, not only a RangeError | 1 |
| T2-e | `CanvasDiagram`: the plain keyboard text built without `zoneSounds` | 4 (the callout chip in a server render and the wiring assertion) |

## Verification Results

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app --project oracle`: 52 files, 1582 tests passed; the four touched test files under `CCRUG_TZ=America/New_York`: 294 passed.
- `npm run typecheck` (root tsc, engine tsc, engine test tsc, components tsc, lint): exit 0 after each task; the only lint output is the one pre-existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx`. (An intermediate Task 2 run failed on six excess-property errors in the new tests, which led to the optional `kind` on the chord type.)
- `MSYS_NO_PATHCONV=1 npm run test:swap` after Task 1 (draw.ts edited): exit 0, build, 65 Playwright passed (3.1 min; the 5 skipped are the behaviour specs on the New York project, by design, so the 60 DOM goldens and the behaviour baseline are unchanged), 112 files and 3475 unit tests passed. After Task 2 (three more app files edited): exit 0, 65 Playwright passed (3.1 min), 112 files and 3499 unit tests passed.
- `node scripts/check-repo.mjs` (all 11 gates incl. `base-ten`, `lore`, `goldens`, `lf`): OK after the final commit. `npm run check:weight` after the Task 2 build: OK (2 routes, 30 golden states within tolerance), so `keyboardModel.ts` pulling `namingCopy.ts` into the Canvas path stays inside the page-weight budget.
- Acceptance: `grep -c "fitSoundLabel(" app/lib/canvas/draw.ts` is 2; the diff against the plan base removes 0 lines matching ``ctx.font = `bold ${scene.labelSize * geo.s}px monospace` ``; `grep -c zoneSounds CanvasDiagram.tsx` is 9 (at least 5); `grep -c "chordCalloutText(" CanvasDiagram.tsx` is 1; `grep -c "export function chordCalloutText" diagramModel.ts` is 1; `grep -c zoneSoundAria keyboardModel.ts` is 1; `canvasDiagramModel.test.ts` has a `chordCalloutText` case with a `nameOf` and one with null. `git diff --name-only $PLAN_BASE HEAD` lists exactly the 8 files above: no golden, behaviour baseline, engine file, signed-off vector or bank, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx`, `app/presets/base10/**` or `reference/` was touched.
- `npm run verify` was not run (the proportionate gate for this plan is the two swap runs, typecheck, check-repo and the weight check above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A zone with no sound keeps its digits label and wording**
- **Found during:** Task 1 and Task 2 (writing the tests from the UI-SPEC)
- **Issue:** The plan indexes the table with `?? ''`, so an empty or missing entry would paint an empty label (the fit returns the empty text unchanged) and announce `Zone c, sound , Torque`. UI-SPEC "Fallback label" says a zone with no sound draws its normal digits label, and 07-12 already did this on the SVG tier.
- **Fix:** both draw passes paint the numeral at the layout size for an empty or missing entry; `zoneText` uses the digits wording for it. Tests cover an empty entry and a short table in both passes and in the announcements; two mutants prove them.
- **Files modified:** `app/lib/canvas/draw.ts`, `app/lib/canvas/keyboardModel.ts`
- **Commits:** `6b04ae0`, `092d3e2`

**2. [Rule 2 - Missing critical functionality] The chord callout cannot take down the render, and never asks another base's naming**
- **Found during:** Task 2
- **Issue:** `nameOf` raises a `RangeError` for a zone outside its base, and a switch in flight can show the old scene with the new naming; an uncaught error in render crashes the tree, and a name of the wrong base would be wrong text.
- **Fix:** `chordCalloutText` returns the chord's own name on a `RangeError` (any other error propagates); `CanvasDiagram` passes a resolver only when `naming.base === scene.base`. Tests: the RangeError and TypeError cases and a source assertion for the guard.
- **Files modified:** `app/lib/canvas/diagramModel.ts`, `app/components/canvas/CanvasDiagram.tsx`
- **Commit:** `092d3e2`

**3. [Rule 3 - Blocking] The chord parameter type refused the plan's own example**
- **Found during:** Task 2, first typecheck
- **Issue:** the signature `chord: { a, b, name }` makes a literal with `kind` an excess-property error (six errors in the new tests).
- **Fix:** an optional `readonly kind?: string` on the parameter type; a `Demon` and a literal with `kind` both fit.
- **Files modified:** `app/lib/canvas/diagramModel.ts`
- **Commit:** `092d3e2`

### Conflicts and additions recorded, not bugs

**4. [Acceptance grep] `grep -c zoneSoundAria keyboardModel.ts` = 1 through a namespace import.** A named import adds a second matching line, so the file uses `import * as namingCopy` and `namingCopy.zoneSoundAria(`. Behaviour and bundle are the same.

**5. [Addition] Server-rendered callout tests in `canvasDiagramRender.test.ts`.** The file is not in the plan's list, but the chip text for a pinned or hovered zone is reachable from a static render and is the only direct proof that the prop reaches the keyboard text inside the component. Existing assertions in the file are untouched.

**6. [Test strengthened by a mutant]** the first draft of the fallback test let a `continue`-less mutant survive; it now also asserts one text per zone and no empty text.

**Total deviations:** 2 missing-functionality additions, 1 blocking type fix, 3 recorded conflicts or additions. None changes an exported name of the plan's contracts except the widened `kind?` on the chord type.

## Issues Encountered

None blocking. The first Task 2 typecheck failed on the chord type (above); fixed before the GREEN commit.

## Known Stubs

None in the files of this plan. One interim state is by design and tracked: nothing passes `zoneSounds` to `CanvasDiagram` yet (`NumogramClient.tsx` is outside this plan; 07-21 wires the viewer) and nothing provides a `NamingContext` yet (07-18), so on the Canvas tier in sounds mode the diagram still draws digits and the chord callout keeps its own name until then. The prop, the draw branches, the announcements and the callout function exist and are proved.

## Threat Flags

None beyond the register. T-07-19c: `fillText` paints text only (a test paints `<b>x` verbatim as one string argument; a server render escapes it in the chip), announcements are text in an `aria-live` region, and the sounds and names come from the letters-and-marks validator upstream. T-07-13d: the sounds code runs only when `zoneSounds` is a non-null array; the existing 123 `canvasDraw` assertions are untouched, a test compares every text call with and without a table (absent and null), and test:swap proved the 60 goldens and the behaviour baseline unchanged twice.

## TDD Gate Compliance

Both tasks followed RED then GREEN in separate commits: `test(07-14)` `166d9c4` before `feat(07-14)` `6b04ae0`, and `test(07-14)` `838b016` before `feat(07-14)` `092d3e2`. Each RED run failed before its GREEN commit (Task 1: 4 of 134 on the real expectation; Task 2: 19 tests). No refactor commit was needed.

## Next Phase Readiness

- 07-21 passes `zoneSounds` to `CanvasDiagram` (the sounds only when the scheme is `sounds` and the base is within the interactive ceiling) and `useNaming()` supplies the live chord name once 07-18 provides the context; the draw states, keyboard texts and dependency lists are already wired, so a new table repaints the static layers and the overlay.
- 07-15 reads the same `nameOf` for the matrix text, demon detail and browser cell; `chordCalloutText` is the Canvas callout's one place for the net-span and name.
- No blocker.

## Self-Check: PASSED

- All eight modified files exist and are tracked: `app/lib/canvas/draw.ts`, `keyboardModel.ts`, `diagramModel.ts`, `app/components/canvas/CanvasDiagram.tsx`, `tests/app/canvasDraw.test.ts`, `canvasKeyboard.test.ts`, `canvasDiagramModel.test.ts`, `canvasDiagramRender.test.ts`.
- All four task commits exist (`166d9c4`, `6b04ae0`, `838b016`, `092d3e2`) and each message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- No frozen oracle path, golden, behaviour baseline, `reference/` file, `engine/` file, `Projection.tsx`, `PairGraphProjection.tsx`, `NumogramClient.tsx` or `app/presets/base10/` file was touched.
