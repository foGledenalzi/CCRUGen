---
phase: 04-base-picker-and-generator-ui
plan: 12
subsystem: ui
tags: [react, playwright, url-state, accessibility, base-picker]

# Dependency graph
requires:
  - phase: 04-06
    provides: BasePicker/LabelSchemeControls components (unmounted) with refusal copy and summary logic
  - phase: 04-11
    provides: engine-driven viewer (base from the URL codec, SVG-tier gate, useLayoutTween, packer state)
provides:
  - Header-mounted base picker driving the whole app (UI-01)
  - Pure UI-08 base-switch sanitation module (app/lib/baseSwitch.ts) applied as one batched commit
  - Live, undoable, URL-round-tripping label-scheme and packer session state (UI-03, todo 005)
  - e2e coverage for UI-01, UI-03 (interactive half) and UI-08
affects: [04-13, 04-15, 04-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI-08 base-switch sanitation as one pure function (sessionAfterBaseSwitch) applied inside a single batched React event handler, never split across multiple effects"
    - "Deferred blur-close (setTimeout(0) + document.activeElement) instead of synchronous e.relatedTarget, for any popover/dropdown containing sr-only radio/checkbox controls reached via label-click"
    - "Click the CyberRadio/CyberCheckbox wrapping <label> in Playwright tests, never the sr-only input itself (viewer-helpers.radioLabel)"

key-files:
  created:
    - app/lib/baseSwitch.ts
    - tests/app/baseSwitch.test.ts
    - e2e/base-picker.spec.ts
    - e2e/label-scheme.spec.ts
    - e2e/base-switch-reset.spec.ts
  modified:
    - app/NumogramClient.tsx
    - app/components/numogram/BasePicker.tsx
    - e2e/viewer-helpers.ts

key-decisions:
  - "Header widens 384->480px desktop (DESKTOP_PANEL_RIGHT_X + PANEL_WIDTH - DESKTOP_PANEL_LEFT_X + 96) to fit the picker beside Undo/Redo/Share without covering the fixed layout-switcher ButtonSet at 1280px, proven by an e2e bounding-box non-intersection check"
  - "Packer changes call switchLayout() before setPacker so the rings tween when the tier allows it, mirroring handleSwitchLayout's existing call order"
  - "HistorySnapshot gained base/labels/packer fields; applySnapshot guards on snapshot.base !== base (defensive; commitBase already clears both stacks on every switch so this guard should never actually trigger in practice)"

patterns-established:
  - "UI-08 reset rules live in one pure, unit-tested module (app/lib/baseSwitch.ts) that the component calls, not inline reset logic scattered across the event handler"

requirements-completed: [UI-02, UI-03, UI-08]

# Metrics
duration: 56min
completed: 2026-09-29
---

# Phase 4 Plan 12: Header Base Picker, UI-08 Sanitation, Label/Packer Session State Summary

**BasePicker mounted in the header (widened 384->480px) drives the app through a single batched UI-08 reset (`app/lib/baseSwitch.ts`), with label scheme and packer now live, undoable, URL-synced state, proven by three new Playwright specs plus a real dropdown-radio-click bug found and fixed along the way.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-09-29T06:49:00Z
- **Completed:** 2026-09-29T07:45:00Z
- **Tasks:** 2 completed
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `<BasePicker>` is now mounted in `CyberPageHeader`'s `actions` slot, left of Undo/Redo/Share — it is the way a visitor changes base, types/steps/slides/chips all going through one sanitized `commitBase` path
- `app/lib/baseSwitch.ts` (`sessionAfterBaseSwitch`, `nextLayoutForBase`) is the single source of truth for UI-08's reset rules, unit-tested and called from one batched event handler that also resets history stacks, pending share-fit, the orientation cache, and zoom/pan
- Label scheme and packer choice are now live session state: they change the diagram immediately, round-trip through `labels=`/`packer=`, and are part of the undo/redo history (closing todo 005)
- Three new e2e specs (60 total new test cases across projects, 20 in chromium-utc) prove UI-01, UI-03's interactive half, and UI-08 end to end in the built static site

## Task Commits

Each task was committed atomically:

1. **Task 1: UI-08 reset rules (baseSwitch.ts) and the header picker wiring with label/packer state and history** - `4df01c2` (feat)
2. **Task 2: e2e specs for the picker, label schemes and base-switch sanitation** - `1a90815` (test, includes a Rule 1 bug fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/lib/baseSwitch.ts` - Pure `sessionAfterBaseSwitch`/`nextLayoutForBase` (UI-08 reset rules)
- `tests/app/baseSwitch.test.ts` - Unit tests for both functions, matching the plan's exact behavior table
- `app/NumogramClient.tsx` - `<BasePicker>` mounted in the header actions slot; `commitBase` batches the full UI-08 reset; `HistorySnapshot`/`snapshotState`/`applySnapshot` carry `base`/`labels`/`packer`; `onPackerChange` tweens via `switchLayout()`; desktop header width 384->480px
- `app/components/numogram/BasePicker.tsx` - Rule 1 fixes: `handleContainerBlur` deferred to avoid closing the dropdown out from under a real click on a CyberRadio pill; a new effect re-syncs the shown refusal from `externalRefusal` after mount (previously read once via a lazy `useState` initializer)
- `e2e/viewer-helpers.ts` - New shared `radioLabel()` helper for clicking a CyberRadio's wrapping `<label>` instead of its `sr-only` input
- `e2e/base-picker.spec.ts` - UI-01 e2e: default/type/odd/absurd/steppers/slider/chips/URL-refusal/packer/layout-overlap
- `e2e/label-scheme.spec.ts` - UI-03 e2e: Xeno/preset/custom validation, URL round trip, integer zone identity, Digits mode
- `e2e/base-switch-reset.spec.ts` - UI-08 e2e: selection/undo-stack/region/pin cleared on a switch, undo cannot restore the old base, a mid-tween commit never mixes two bases

## Decisions Made
- Header width formula gains `+ 96` specifically (not a rounder number) to keep the picker's right edge short of the fixed layout-switcher's leftmost extent at exactly 1280px, verified by an e2e bounding-box check rather than a visual judgment call
- `onPackerChange` always calls `switchLayout()` before `setPacker` (not conditionally on "same base and layout", since the packer control is only ever shown when both already hold) so the tween-or-jump decision is delegated entirely to `useLayoutTween`'s own `animate` gate
- `applySnapshot`'s `snapshot.base !== base` guard is defensive-in-depth per the plan's explicit instruction, not the primary mechanism (that's `commitBase` clearing both stacks unconditionally on every switch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `handleContainerBlur` closed the base-picker dropdown out from under a real click on any label-scheme/packer radio**
- **Found during:** Task 2, while writing `e2e/label-scheme.spec.ts` and the packer test in `e2e/base-picker.spec.ts`
- **Issue:** `CyberRadio`'s actual `<input type="radio">` is `sr-only` (visually 1px, positioned under its own decorative indicator `<span>`), so a user activates it by clicking its wrapping `<label>`. Clicking a `<label>` is not itself a focusable mousedown target, so the browser blurs the currently-focused element (the Base input) with `relatedTarget = null` *before* the click's own default action focuses/toggles the radio. `handleContainerBlur` read `e.relatedTarget` synchronously and, seeing `null`, called `setOpen(false)` immediately — unmounting the portal dropdown (and the radio inside it) before the click's label-forwarding could ever land. This made every label-scheme and packer control in the dropdown **unusable by a real mouse click** (not a Playwright-only artifact — the same event ordering applies to genuine human clicks), confirmed by a standalone reproduction script before fixing.
- **Fix:** `handleContainerBlur` now defers its check with `window.setTimeout(..., 0)` and reads `document.activeElement` instead of the synchronous `relatedTarget`, so it observes the click's actual outcome (the radio now focused inside the dropdown) rather than the transient mid-click `null`.
- **Files modified:** `app/components/numogram/BasePicker.tsx`
- **Verification:** A standalone Playwright reproduction script confirmed the dropdown closed and focus reverted to `<body>` before the fix, and stayed open with the radio focused and the label scheme applied after; all three new e2e specs (20 chromium-utc tests) plus the full `npm run verify` gate pass with the fix in place.
- **Committed in:** `1a90815` (Task 2 commit)

**2. [Rule 1 - Bug] The base picker never showed a refused `?base=` reported after the URL-hydration effect ran**
- **Found during:** Task 2, while writing the "URL refusal" test in `e2e/base-picker.spec.ts`
- **Issue:** `BasePicker`'s `refusal` state was seeded from `externalRefusal` via a lazy `useState(() => externalRefusal)` initializer, which only runs once at mount. `NumogramClient.tsx`'s URL-hydration effect (which computes and sets `baseRefusal` from a refused `?base=`) runs post-mount, so the picker's first render always saw `externalRefusal = null` and never re-read the prop afterwards — a refused `?base=` on page load produced 10 zones correctly but showed no explanation next to the picker, contradicting this plan's own UI-02 must-have ("a refused `?base=` from the URL shows the same kind of message on load").
- **Fix:** Added an effect that re-syncs `refusal` from `externalRefusal` whenever it changes, guarded by the same `!dirty` mid-edit check the existing `candidate` resync effect already uses.
- **Files modified:** `app/components/numogram/BasePicker.tsx`
- **Verification:** `e2e/base-picker.spec.ts`'s "URL refusal: ?base=27 shows the on-load refusal and falls back to base 10 (UI-02)" test passes.
- **Committed in:** `1a90815` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — real bugs in already-committed 04-06 code that only became observable once 04-12 mounted the component and exercised it end to end)
**Impact on plan:** Both fixes were necessary for this plan's own must-have truths (UI-08's dropdown controls usable by mouse; UI-02's on-load refusal message) to actually hold. No scope creep — no other files were touched.

## Issues Encountered
- Two Playwright selector mistakes surfaced and were fixed during Task 2 (not deviations from the plan's intent, just test-authoring corrections): a `useId()`-generated id containing a colon broke a raw `#id` CSS selector (switched to an attribute selector `[id="..."]`); and `<output aria-live="polite">` (the live candidate echo) carries the implicit ARIA `status` role, the same as the refusal text, so `getByRole('status').first()` was non-deterministic until scoped with `.filter({ hasText: 'Showing base' })`. A third test used an odd 11-digit number for the "too-large" refusal case, which validateBase actually classifies as "odd" first (oddness is checked before the ceiling) — fixed by using an even out-of-range candidate.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI-01's remaining piece (bases 2-40 NaN/undefined smoke test and the MIG-02 grep gate promoted to default) is still deferred to 04-16, per this phase's established per-plan-requirements precedent (matches how 04-02/04-03/04-04/04-06/04-09/04-10/04-11 already handled multi-plan requirements)
- 04-13 (region legend) can now assume the header picker and its live label/packer state are stable, tested surface to build isolate/mute controls against
- No blockers for 04-13 (region legend), 04-14 (accessibility) or 04-15 (panels/zoom toolbar)

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 9 files (5 created, 3 modified, this summary) confirmed present on disk; both task commits (`4df01c2`, `1a90815`) confirmed in `git log`.
