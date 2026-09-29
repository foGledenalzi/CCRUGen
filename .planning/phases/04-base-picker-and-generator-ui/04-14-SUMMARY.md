---
phase: 04-base-picker-and-generator-ui
plan: 14
subsystem: ui
tags: [react, accessibility, keyboard, aria, reduced-motion, svg-projection]

# Dependency graph
requires:
  - phase: 04-base-picker-and-generator-ui
    provides: "04-03's regions.ts (RegionId/RegionFilter), 04-08's useReducedMotion.ts, 04-09's base-generic Projection.tsx, 04-13's zoneStates/pairStates render filter"
provides:
  - "Roving-tabindex composite widget (one Tab stop, arrow/Home/End/Enter/Space) across zones, syzygies, currents and gates in Projection.tsx, and pairs in PairGraphProjection.tsx"
  - "Accessible names (aria-label) and state (aria-pressed) for every diagram element, built from the in-base label"
  - "reducedMotion plumbing from useReducedMotion() through useOrbitalAnimation and Projection's particle/orbit/TC-carrier animation"
affects: [04-15-zoom-pan-text-view-and-e2e, 04-16-mig-02-gate-promotion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Roving tabindex: one focusKey React state per diagram, a focusOrder array recomputed each render by mirroring each layer's existing render filter exactly (never a separate/divergent list), tabIndex={key === activeKey ? 0 : -1}"
    - "data-post-baseline on every newly-focusable svg element so the frozen behaviour-baseline's svg interactive counter (which only exists because base 10's goldens/baseline predate this phase) stays exactly 0"
    - "reducedMotion is a plain boolean prop/parameter threaded from one useReducedMotion() call at the top of NumogramClient, never re-read via matchMedia lower in the tree"

key-files:
  created:
    - e2e/accessibility.spec.ts
  modified:
    - app/components/projection/Projection.tsx
    - app/components/projection/PairGraphProjection.tsx
    - app/lib/regions.ts
    - tests/app/regions.test.ts
    - tests/app/projectionRender.test.ts
    - app/globals.css
    - app/hooks/useOrbitalAnimation.ts
    - app/components/numogram/ShortcutsModal.tsx
    - app/NumogramClient.tsx
    - perf/page-weight.baseline.json

key-decisions:
  - "Focus order per diagram is zones (ascending, hidden-filtered) then syzygies then currents then gates (base-generic pair graph: pairs in pair-id order) — mirrors each render layer's own filter predicate line-for-line rather than introducing a second source of truth"
  - "Muted (mute=) elements are excluded from the traversal entirely (zs(z) !== ZONE_HIDDEN); dimmed (isolate spotlight complement) elements stay in the traversal, matching the Accessibility Contract's 'disappear from view entirely' vs. 'dimmed' distinction from 04-13"
  - "CSS focus ring is pure attribute-selector CSS ([data-focus-key]:focus-visible) with no new element or class, so all 60 frozen DOM goldens (which drop role/tabindex/aria-*/data-*) stay byte-identical"

requirements-completed: []

# Metrics
duration: ~40min
completed: 2026-09-29
---

# Phase 4 Plan 14: Diagram Accessibility (Keyboard, ARIA, Reduced Motion) Summary

**Roving-tabindex keyboard traversal with ARIA names in both diagrams, a visible focus ring, prefers-reduced-motion gating of the orbit/particle/Time-Circuit animations, and documented shortcuts — proven by a 12-test e2e spec at base 28.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 10 (9 source/test files + 1 new e2e spec; page-weight baseline counted separately below)

## Accomplishments

- `Projection.tsx` and `PairGraphProjection.tsx` implement the WAI-ARIA roving-tabindex composite pattern: one `focusKey` state, a `focusOrder` array computed by mirroring each render layer's existing filter (zones ascending → syzygies → currents → gates, or pairs in pair-id order for the pair graph), `tabIndex={0}` on exactly the active element and `-1` elsewhere, arrow keys step (wrapping), Home/End jump to the ends, Enter/Space activates exactly like a click via `svgRef.current.querySelector('[data-focus-key="..."]')` + `CSS.escape`.
- Every focusable element carries `role="button"`, an `aria-label` built from the in-base label (e.g. `Zone f, Torque A`, `Syzygy d::e`, `Current <name>: <formula>`, `Gate Gt-..: zone 5 to zone ..`), `aria-pressed` for its selection state, and `data-post-baseline` so the frozen behaviour-baseline's svg-interactive counter stays 0; the svg root gets `role="group"` and a summary `aria-label` (never matched by the behaviour collector's selector).
- `app/lib/regions.ts` gains `regionLabel(id)` (`'torque'` → `'Torque'`, `'torque:<i>'` → `` `Torque ${torqueLabel(i)}` ``, `'plex'`/`'warp'` → `'Plex'`/`'Warp'`), TDD'd first in `tests/app/regions.test.ts`.
- `app/globals.css` adds `[data-focus-key]:focus-visible { outline: 2px solid #10ff50; outline-offset: 2px; }` — no new element/class, so the 60 frozen DOM goldens are unaffected.
- `useOrbitalAnimation` takes a `reducedMotion` parameter that short-circuits its rAF loop; `NumogramClient.tsx` wires `useReducedMotion()` through to it, disables the orbit `Button` (which also silences its `z` shortcut via `CyberButton`'s existing disabled-ignores-shortcut behavior), and passes `reducedMotion` to `Projection`, which gates the particle animation layer, the selection-triggered particle flow, and the Time Circuit overlay's animated carriers (`!reducedMotion`) while leaving all static edges/paths unchanged.
- `ShortcutsModal.tsx` documents the diagram keyboard model and that the `0`-`9` gate shortcut is base-10 only, in a `data-post-baseline` wrapper.
- `e2e/accessibility.spec.ts` (chromium-utc, 12 tests) proves: 84-element traversal and wraparound at base 28 (28 zones + 14 syzygies + 14 currents + 28 gates), ARIA names/roles, keyboard activation (Enter selects zone 15 exactly like a click), muted-order exclusion, a visible solid focus outline, reduced-motion (instant layout switch sampled every frame, zero `animateMotion` elements, disabled orbit control), the base-10-only digit shortcut, and pair-graph traversal (14 distinct pairs).

## Task Commits

Each task was committed atomically:

1. **Task 1: Roving-tabindex keyboard model and ARIA names in both diagrams, focus ring CSS** - `60a571d` (feat)
2. **Task 2: Reduced motion for orbit and particles, shortcut documentation, accessibility e2e** - `e86a3ee` (feat)

**Page-weight baseline (required by Task 2's own verify step):** `ad1631f` (chore)

## Files Created/Modified

- `app/components/projection/Projection.tsx` - Roving-tabindex state/handlers, `data-focus-key`/`role`/`tabIndex`/`aria-label`/`aria-pressed`/`onFocus`/`onBlur` on every zone/syzygy/current/gate group, svg-root `role="group"` + `aria-label` + `onKeyDown`, `reducedMotion` prop gating particle/TC-carrier animation
- `app/components/projection/PairGraphProjection.tsx` - Same roving-tabindex pattern for pair pills, svg-root ARIA label
- `app/lib/regions.ts` - New `regionLabel(id)` export
- `tests/app/regions.test.ts` - New `regionLabel` test block (TDD red-then-green)
- `tests/app/projectionRender.test.ts` - Passes the new required `reducedMotion` prop (pre-existing test outside this plan's file list, fixed as a Rule 3 blocking issue)
- `app/globals.css` - `[data-focus-key]:focus` / `:focus-visible` rules
- `app/hooks/useOrbitalAnimation.ts` - `reducedMotion` parameter short-circuiting the rAF loop
- `app/components/numogram/ShortcutsModal.tsx` - Diagram keyboard model + base-10-only digit-shortcut documentation
- `app/NumogramClient.tsx` - `reducedMotion` hoisted above `useOrbitalAnimation`, threaded to it and to `Projection`, orbit `Button` gets `disabled={reducedMotion}`
- `e2e/accessibility.spec.ts` - New spec, 12 tests
- `perf/page-weight.baseline.json` - Raised for `/numogram/`'s new client-bundle weight

## Decisions Made

- Focus order mirrors each render layer's own filter predicate exactly (re-derived inline in `Projection.tsx`, not extracted into a shared helper), so it can never silently diverge from what is actually rendered/hidden.
- Reused `CyberButton`'s existing `disabled` prop (which already ignores its own keyboard shortcut) rather than adding new reduced-motion-specific disabling logic to the orbit control.
- Kept the accessible names' punctuation/wording exactly as specified in the plan (`Zone <label>, <region>[, selected]`, `Syzygy a::b`, `Current name: label`, `Gate name: zone X to zone Y`) rather than inventing alternate phrasing, since the plan's e2e assertions depend on the exact prefix text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS comment's `*/`-shaped substring closed itself early, breaking `next build`**
- **Found during:** Task 1, first `npm run test:swap` run
- **Issue:** The focus-ring CSS comment read `role/tabindex/aria-*/data-* are ignored...`; the literal substring `aria-*/data-*` contains the two characters `*` then `/`, which is the CSS block-comment close token. The comment closed after `aria-*`, leaving `data-* are ignored by the frozen DOM goldens, so this\n   is pure CSS with no new element or class in either projection svg. */` as bare (invalid) CSS text, which broke `next build`'s cssnano minifier ("Unexpected '/'").
- **Fix:** Reworded to `role, tabindex and aria-/data- attributes are ignored...`, removing the `*/`-shaped substring.
- **Files modified:** app/globals.css
- **Verification:** `npm run build` succeeded; isolated by reverting only `globals.css` to HEAD and confirming the JS/TSX changes alone built cleanly, then bisecting the CSS diff.
- **Committed in:** 60a571d (Task 1 commit)

**2. [Rule 3 - Blocking] Updated a pre-existing test file for the new required `reducedMotion` prop**
- **Found during:** Task 2 (adding the required `reducedMotion` prop to `ProjectionProps`)
- **Issue:** `tests/app/projectionRender.test.ts` (from 04-09, not in this plan's file list) calls `createElement(Projection, {...})` directly with a full prop object; adding a new required prop broke `npm run typecheck` (the root `tsc` config includes the whole repo).
- **Fix:** Added `reducedMotion: false` to both call sites (base-10 preset render and the procedural-ring sweep over bases 2..40).
- **Files modified:** tests/app/projectionRender.test.ts
- **Verification:** `npm run typecheck` clean; the file's own 21 tests still pass (no NaN/undefined, correct zone/gate counts).
- **Committed in:** e86a3ee (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary to keep the build/typecheck green; no scope creep — one is a CSS wording fix, the other a one-line prop addition per call site.

## Issues Encountered

- During the currents/gates `<g>` attribute edits, a `replace_all` pass over `<g key={c.name} data-current={c.name}>` missed the third (yshape) occurrence because its leading-whitespace-inclusive `old_string` only matched two of the three differently-indented copies; caught immediately by grepping the post-edit file for the unmodified tag and fixed with a targeted follow-up edit before running any tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-07 is **not yet complete**: this plan covers keyboard traversal, ARIA labelling, non-colour cues and reduced-motion support, but the accessible text view (`TextView.tsx`/`BigBaseSummary.tsx`, built in 04-07) is not mounted into the normal (non-big-base) viewer yet — that happens in 04-15, which is UI-07's final covering plan. `requirements-completed` is left empty here, matching this phase's established multi-plan-requirement precedent (e.g. UI-03 across six plans, UI-02 across 04-05/04-07/04-11/04-12).
- No blockers for 04-15 or 04-16.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 12 created/modified files confirmed present on disk; all three commits (60a571d, e86a3ee, ad1631f) confirmed in `git log`. `npm run verify` exit 0 on the committed tree (134 e2e passed, 64 skipped by design including the new 12-test `accessibility.spec.ts` on chromium-ny, check-repo OK including clean-tree/static-out, page-weight OK after the raised baseline); `git status --porcelain e2e/__golden__ e2e/__behaviour__` empty (60 DOM goldens and the 5-file behaviour baseline unchanged).
