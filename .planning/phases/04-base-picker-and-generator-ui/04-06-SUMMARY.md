---
phase: 04-base-picker-and-generator-ui
plan: 06
subsystem: ui
tags: [base-picker, label-scheme, custom-alphabet, xenotation, debounce, react]

# Dependency graph
requires:
  - phase: 04-base-picker-and-generator-ui
    provides: "04-02's LabelScheme/DEFAULT_LABEL_SCHEME/customAlphabet.ts/glyphCoverage.ts; 04-03's NumogramSummary/summarize; 04-05's BaseRefusal (raw, check) shape"
  - phase: 02-engine-core-and-base-10-migration
    provides: validateBase/BaseCheck/clipEcho/MAX_BASE
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: Packer type
provides:
  - "app/lib/basePicker.ts — NOTABLE_BASES/BASE_STEP/SLIDER_MIN/SLIDER_MAX/BASE_DEBOUNCE_MS constants, evaluateCandidate (regex-gated, then validateBase), refusalMessage (exact UI-SPEC copy for every reason), refusalFromUrl (bridges 04-05's BaseRefusal), stepBase/sliderPosition (clamped), summaryLine/typeCountsLine (live summary + per-type demon breakdown), evaluateCustomAlphabet"
  - "app/components/numogram/BasePicker.tsx — standalone header control: collapsed editable-numeral + live-summary/refusal, portal-anchored expanded dropdown (stepper/slider/chips/type-counts/packer toggle/label-scheme controls/refusal), 200ms debounced live preview, Enter-commits, Escape/outside-click/focusout closes"
  - "app/components/numogram/LabelSchemeControls.tsx — Digits/Xeno/Custom radios (mutually exclusive derived checked state), 4 curated preset chips, free-text alphabet with as-you-type validation (empty/invalid/too-short/glyph-risk messages)"
  - "tests/app/basePicker.test.ts — 26 unit tests covering every refusal reason's exact copy, echo clipping, stepping/slider clamping, summary formatting (including the >12-cycle ellipsis and toLocaleString thousands separators) and custom-alphabet evaluation"
affects: [04-12 (mounts BasePicker into the header and wires state/URL), 04-09, 04-10 (further label-scheme work)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Candidate text is regex-gated (a plain signed decimal, optionally with a fractional part) before it ever reaches validateBase, so hex/scientific-notation/other Number()-parseable-but-surprising shapes read as 'malformed' rather than silently becoming a different number than the visitor typed."
    - "refusalMessage is a single exhaustive switch over RefusalReason (BaseProblem | 'malformed') producing the UI-SPEC's exact copy, echoed via the engine's own clipEcho (40 chars) — never a locally reimplemented parity/ceiling check."
    - "BasePicker's local text state (candidate) updates optimistically on every keystroke/drag tick; a 200ms-debounced effect is the only path that calls evaluateCandidate and commits to the real base prop via onCommitBase — Enter bypasses the debounce for an immediate commit."
    - "LabelSchemeControls derives each radio's checked state (digitsChecked/xenoChecked/customChecked) rather than storing a separate 'selected mode' — selecting Custom only opens the disclosure (sets a local `open` flag) without calling onChange until a preset or a valid typed alphabet is chosen; selecting Digits/Xeno resets `open` so the three radios stay mutually exclusive."

key-files:
  created:
    - app/lib/basePicker.ts
    - app/components/numogram/BasePicker.tsx
    - app/components/numogram/LabelSchemeControls.tsx
    - tests/app/basePicker.test.ts
  modified: []

key-decisions:
  - "requirements-completed left empty in this summary's frontmatter: UI-01's final covering plan is 04-16, UI-03's is 04-12 (per this phase's existing per-plan requirements frontmatter across 04-01..04-16) — mirrors the same choice already made in 04-01..04-05's summaries for MIG-02/UI-01/UI-02/UI-03/UI-05."
  - "clipEcho/validateBase/MAX_BASE are imported directly from engine/core/base.ts rather than the app-facing engine/index barrel, because clipEcho is not re-exported by the barrel (only MAX_BASE/validateBase/assertBase are). This mirrors the existing in-repo precedent of importing types directly from engine/core (app/presets/base10/layouts.ts imports Numogram from engine/core/types) rather than duplicating a second 40-character clip helper the way app/lib/shareParams.ts's older clipRaw does."
  - "LabelSchemeControls closes its own disclosure (setOpen(false)) when Digits or Xeno is selected, and derives Custom's checked state as (mode is preset/custom) OR (disclosure is open) — not explicitly specified by the plan's pseudocode, but necessary so the three radios never show two simultaneously checked (Rule 1 — a plain radio group must stay mutually exclusive)."
  - "LabelSchemeControls' free-text state initializes from the current scheme's characters when the scheme is already 'custom' (e.g. loaded from a share URL before this component mounts in 04-12), instead of always starting blank, so editing continues from where the URL left off (Rule 2 — missing behavior a visitor would expect)."

patterns-established:
  - "Pure typed-result validators (evaluateCandidate/evaluateCustomAlphabet) never throw and return a discriminated union the caller narrows before rendering — the same idiom as engine/core/base.ts's validateBase and app/lib/customAlphabet.ts's checkAlphabetChars/validateAlphabet."

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-09-29
---

# Phase 4 Plan 06: Base Picker and Label Scheme Controls Summary

**Standalone base-picker control (debounced type/step/slide/chip commit with UI-SPEC refusal copy) plus its label-scheme sub-controls (Digits/Xeno/Custom with as-you-type custom-alphabet validation), built as pure logic + two components with 26 unit tests — not yet mounted (04-12 wires it into the header).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-29T01:53:08Z (STATE.md session start)
- **Completed:** 2026-09-29T02:10:00Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `app/lib/basePicker.ts`: candidate evaluation through the engine's `validateBase`, the exact UI-SPEC refusal copy for every reason (odd/too-large/not-integer/zero/negative/not-a-number/infinite/malformed), stepping/slider clamping, the live summary line and per-type demon-count line, and custom-alphabet evaluation — all pure, all tested.
- `app/components/numogram/BasePicker.tsx`: a self-contained header control with a collapsed editable-numeral + live-summary/refusal display and a portal-anchored expanded dropdown (stepper, slider, 14 notable-base chips, type-count breakdown, conditional packer toggle, label-scheme controls, refusal message), 200ms debounced live preview, Enter-commits-immediately, Escape/outside-click/focusout closes the dropdown.
- `app/components/numogram/LabelSchemeControls.tsx`: Digits/Xeno/Custom mode radios, 4 curated preset chips, a free-text alphabet input validated as-you-type (empty-state copy, duplicate/forbidden/too-short errors, glyph-risk warnings capped at 5) — an invalid typed alphabet never reaches `onChange`.
- 26 new unit tests in `tests/app/basePicker.test.ts`, run in the RED (module-not-found) then GREEN sequence per the plan's TDD task.

## Task Commits

1. **Task 1: basePicker.ts pure helpers** - `34810f7` (feat)
2. **Task 2: BasePicker.tsx and LabelSchemeControls.tsx components** - `edcd15c` (feat)

**Plan metadata:** (this commit) `docs(04-06): complete base-picker-and-label-scheme-controls plan`

## Files Created/Modified
- `app/lib/basePicker.ts` - Pure candidate evaluation, refusal copy, stepping/slider math, summary lines, custom-alphabet evaluation
- `app/components/numogram/BasePicker.tsx` - Standalone base-picker component (collapsed control + portal dropdown)
- `app/components/numogram/LabelSchemeControls.tsx` - Standalone label-scheme sub-controls
- `tests/app/basePicker.test.ts` - 26 unit tests for basePicker.ts

## Decisions Made
- `clipEcho`/`validateBase`/`MAX_BASE` imported directly from `engine/core/base.ts` (not the barrel, which doesn't re-export `clipEcho`) rather than duplicating a second echo-clip helper.
- `LabelSchemeControls` derives a mutually-exclusive checked state across its three radios and resets its own disclosure when Digits/Xeno is picked (see Deviations below).
- `requirements-completed` left empty: UI-01's final covering plan is 04-16, UI-03's is 04-12 (established phase-wide precedent, see frontmatter).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mutual exclusivity of the Digits/Xeno/Custom radio group**
- **Found during:** Task 2 (LabelSchemeControls.tsx)
- **Issue:** The plan's pseudocode defines "Custom" as checked when `mode is preset/custom OR the disclosure is open`, but doesn't say what happens to that `open` flag when the visitor then picks Digits or Xeno — without resetting it, Digits/Xeno and Custom could show simultaneously checked (an invalid radio-group state).
- **Fix:** `selectDigits`/`selectXeno` reset the local `open` flag to `false` before calling `onChange`, so the three checked states stay derived and mutually exclusive at every point.
- **Files modified:** `app/components/numogram/LabelSchemeControls.tsx`
- **Verification:** `npm run typecheck` (tsc x4 + lint) green; reasoned through by hand (component isn't yet mounted for an interaction test — 04-12 covers that).
- **Committed in:** `edcd15c` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Custom free-text field starts from the existing scheme's characters**
- **Found during:** Task 2 (LabelSchemeControls.tsx)
- **Issue:** The plan's pseudocode initializes the free-text `text` state without specifying a starting value; always starting blank would silently blank out an already-active custom alphabet (e.g. one restored from a share URL before this component mounts) even though the scheme itself still reports `mode: 'custom'`.
- **Fix:** `text` initializes to `scheme.chars.join('')` when `scheme.mode === 'custom'`, else `''`.
- **Files modified:** `app/components/numogram/LabelSchemeControls.tsx`
- **Verification:** `npm run typecheck` green.
- **Committed in:** `edcd15c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical) — both confined to `LabelSchemeControls.tsx`'s internal state handling, no scope creep.
**Impact on plan:** Both fixes are small, local correctness gaps the plan's pseudocode left ambiguous; neither changes any exported shape, prop, or the UI-SPEC contract.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `BasePicker`/`LabelSchemeControls` are ready to mount; 04-12 wires `BasePicker` into `CyberPageHeader`'s `actions` slot, threads `base`/`summary`/`labelScheme`/`packer` state from `NumogramClient.tsx`, and adds e2e coverage.
- No blockers. Packer-visibility logic (`packerVisible` prop) and the `isolate=`/`mute=` region-legend wiring remain for later plans (04-13) as already scheduled.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

- FOUND: app/lib/basePicker.ts
- FOUND: app/components/numogram/BasePicker.tsx
- FOUND: app/components/numogram/LabelSchemeControls.tsx
- FOUND: tests/app/basePicker.test.ts
- FOUND: .planning/phases/04-base-picker-and-generator-ui/04-06-SUMMARY.md
- FOUND commit: 34810f7 (Task 1)
- FOUND commit: edcd15c (Task 2)
