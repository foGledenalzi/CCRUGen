---
phase: 06-canvas-tier-and-worker
plan: 13
subsystem: canvas-input-e2e
tags: [canvas, e2e, touch, keyboard, accessibility, narrow-window, announcements, auto-pan, reduced-motion, isolate, mute, playwright, cdp]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-10's CanvasDiagram (data-zoom, data-tx, data-ty, data-focus-key, data-canvas-live, data-canvas-callout, data-overlay-edges), 06-12's toolbar and the e2e helpers it established (canvasPoint/emptyCorner approach, openCanvas, CANVAS_READY), 06-03's keyboard model, 06-05's pure transform and pick index
provides:
  - e2e/canvas-interaction.spec.ts - 11 browser tests of the Canvas tier's input surface (375 x 667 and 768 x 1024 windows, CDP pinch, one-finger pan, tap pin, keyboard traversal and announcements, Shift+Tab, Enter, auto-pan, reduced motion, mute, isolate, Regions-row highlight)
  - app/components/canvas/CanvasDiagram.tsx with two production fixes the spec exposed (window width on a phone, keyboard-focus announcement)
affects: [06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Touch is driven through CDP Input.dispatchTouchEvent in a hasTouch context (pinch: two touchStart points then five touchMove spreads then touchEnd with no points; drag: one point), taps through page.touchscreen.tap; every point is checked with document.elementFromPoint so it reaches the canvas and not a fixed panel"
    - "Keyboard expectations are strings and keys built from createNumogram, buildNumogramView and zoneLabelsFor (checked against the engine's pair, current and gate definitions), compared with data-focus-key and the live region with the zero-width repeat toggle stripped; the keyboard model is only imported for PAGE_STEP"
    - "A control hidden under another fixed panel is activated with focus and Space in setup (the press helper), which is also a real user path"

key-files:
  created:
    - e2e/canvas-interaction.spec.ts
    - .planning/phases/06-canvas-tier-and-worker/deferred-items.md
  modified:
    - app/components/canvas/CanvasDiagram.tsx

key-decisions:
  - "The canvas root keeps its footprint width with flexShrink: 0 instead of the spec expecting 343 px: the UI-SPEC and the plan both say 359 px at 375 px, and a 343 px root with 359 px layers clips the diagram's right edge and offsets every pick"
  - "Keyboard focus now announces the ring's target (D-08: the live region announces the focused zone) instead of the spec dropping its first-Tab announcement assertion; pointer-initiated focus is unchanged"
  - "The Regions buttons the Currents panel header covers are activated by keyboard in the spec's setup; the panel overlap is logged in deferred-items.md, not fixed here"

patterns-established:
  - "A Tab stop is found by pressing Tab until document.activeElement is the role=application canvas (5 presses on the viewer page), never by calling focus(), except where a test is about something else than reaching the canvas"

requirements-completed: []  # REN-02 stays Pending: 06-15 (the phase gate) still lists it, and the project marks a requirement only at its final covering plan (the 06-11 and 06-12 precedent)

# Metrics
duration: ~25min
completed: 2026-10-15
---

# Phase 6 Plan 13: Canvas Input E2E Summary

**11 Chromium tests prove the Canvas tier's phone and tablet windows, CDP pinch, pan and tap, the keyboard model with every focus key and announcement computed from the engine, auto-pan, reduced motion, mute, isolate and the Regions highlight; the narrow-window test found a real clipping bug (the canvas was 343 px wide, not 359, and lost its right edge) and the keyboard test found that the ring's first target was never announced, both fixed in their own commits.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files:** 3 (1 spec and 1 deferred-items file created, 1 component modified), plus this summary

## Accomplishments

- **Narrow windows (Task 1, `b7f37ea`).** At 375 x 667 with touch the canvas is 359 CSS px wide, at x = 8, at most 667 - 96 px high, and the overlay is exactly as wide as its window; `documentElement` and `body` scrollWidth are 375. At 768 x 1024 the column is 580 px wide, centred, with no overflow. A CDP two-finger pinch from 36 px to 96 px apart zooms 1 -> 2.6667 (the ratio of the spreads, to two decimals), a one-finger drag of (+40, +20) moves tx and ty by exactly 40 and 20, a second pinch brings the zoom back to 1, and `data-canvas-state` is `ready` after each gesture. A tap on a zone's centre pins it (callout text, `selected=<z>` in the URL, the callout still there two frames later because touch has no hover); a tap 5 px beside another zone's node pins that zone; a tap in an empty corner clears the callout.
- **Keyboard (Task 2, `d233405`).** The canvas is Tab stop 5 on the viewer page. First focus puts the ring on `zone:0` with the announcement and the callout. ArrowRight, ArrowDown, ArrowLeft, ArrowUp, wrapping both ways, End, Home, Page Down and Page Up (a step of `PAGE_STEP` = 10, clamped at both ends) each give the expected `data-focus-key` and the expected `Zone {label}, {Region}` string in `[data-canvas-live]`. From zone 10 Tab visits `syzygy:10:191`, `current:<name>`, `gate:<name>` with the `Syzygy`, `Current` and `Gate` strings, although the gate layer is off at base 202; `data-overlay-edges` is at least 1 on the gate and returns to 0 once Tab leaves the canvas; Shift+Tab returns to the canvas, steps back gate, current, syzygy, zone and then leaves. Enter on a zone announces `, selected` and adds it to the URL, the ring moving away and back says `, selected`, Enter again says `, not selected` and removes it; Enter on a syzygy says `, pinned` and selects nothing.
- **Auto-pan.** After six `+` presses the zoom is 3.8147 (1.25^6, under the ceiling of 5 that `zoomMax` gives for this window); five Page Down presses move the ring to zones 10 to 50 and after every press the zone's computed canvas point is at least 20 px inside the window on both axes; two of the five presses panned the view, so the assertion is not vacuous.
- **Reduced motion, mute, isolate, legend.** With `reducedMotion: 'reduce'` the canvas reaches `ready`, the root's `transition-duration` is at most 0.01 s (the global rule gives 0.01 ms) and flips back to 0.15 s without the preference, so the rule is the cause. Muting Plex (zones 0 and 201 at base 202) removes the Plex zone from hover picking (a Plex zone that showed `Zone ..., Plex` before the mute shows no Plex callout after it) and from the key order: End lands on zone 200, ArrowRight wraps to zone 1 skipping 201 and 0, ArrowLeft goes back to 200. Unmuted, isolating Torque A leaves a Plex zone and a Torque A zone both pickable and End still reaches zone 201. Clicking the Torque A row in the Regions panel makes `data-overlay-edges` greater than 0 and clicking it again returns it to 0.

## Task Commits

Each carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`):

1. **Production fix: window width on a phone** - `954ce13` fix(06-13)
2. **Task 1: narrow windows and touch** - `b7f37ea` test(06-13)
3. **Production fix: announce the ring's target on keyboard focus** - `b936206` fix(06-13)
4. **Task 2: keyboard, auto-pan, reduced motion, isolate/mute, legend** - `d233405` test(06-13)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP, deferred-items).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Canvas window was 343 px wide at 375 px, not 359, and clipped the diagram**
- **Found during:** Task 1, first run (`windowOf` reported "the canvas is 343 px wide, the footprint rule says 359").
- **Issue:** the page shell (`h-screen overflow-hidden ... flex`) pads its row by 16 px each side, so the content box at a 375 px viewport is 343 px. The canvas root has `width: 359` as an inline style but is a flex item with `flex-shrink: 1`, so it shrank to 343 px (at x = 16) while its layer stack and overlay stayed 359 px wide inside `overflow: hidden`. The right 16 px of the diagram were clipped and, because pick coordinates and the transform assume the 359 px window, the picture sat off-centre. The 06-10 summary's "375 px window (359 px canvas)" was measured on a probe route that did not have the shell's padding.
- **Fix:** `flexShrink: 0` on the root style in `CanvasDiagram.tsx`. The root is now 359 px at x = 8 (a flex row centres an item wider than its container equally on both sides), exactly the UI-SPEC narrow-window row ("8px inset each side"); the 1280 and 768 px layouts are unchanged (580 px fits).
- **Files modified:** app/components/canvas/CanvasDiagram.tsx. **Commit:** 954ce13.

**2. [Rule 2 - Missing critical functionality] The keyboard ring's first target was never announced**
- **Found during:** Task 2, first run (`[data-canvas-live]` was empty after Tab; the plan's test 5 expects the first zone's announcement).
- **Issue:** `handleFocus` put the ring on the first visible zone and hovered it but did not call `announce`, so a screen-reader user hearing the canvas `aria-label` never learned which zone the ring was on until they moved it, against D-08 ("an aria-live region announces the focused zone"). 06-10 recorded this as "no announcement beyond the aria-label", following its own plan literally.
- **Fix:** `handleFocus` (keyboard path only) now calls `announce(announcementFor(target, textSel))`, the same string a move uses, so it also announces on Shift+Tab back into the canvas. Pointer-initiated focus still seeds no ring and says nothing. This is the one behaviour change in the plan; if the 06-15 screen-reader pass finds the double read (label, then zone) too chatty it is a one-commit revert plus relaxing the first assertion of the keyboard test.
- **Files modified:** app/components/canvas/CanvasDiagram.tsx. **Commit:** b936206.

### Judgement calls and clarifications (no scope change)

1. **Regions buttons are pressed with focus and Space.** At the default desktop layout (1280 x 800, also 900, 1000 and 1440 x 900) the Regions panel is 235 px high at base 202 and its Warp, Plex and Time Circuit rows lie under the Currents panel header (y 227 to 297), which intercepts a mouse click on the Mute and Isolate buttons. The buttons work from the keyboard, so the spec's `press` helper activates them with focus and Space. The overlap is pre-existing and not a Canvas defect; it is recorded in `deferred-items.md`.
2. **The isolate test asserts pickability, the URL and the key order, not dimming.** At base 202 the ring's nodes overlap their neighbours (fitted radius 4.96 px), so a single node pixel cannot tell a dimmed zone from its neighbours; dimming is covered by the draw tests of 06-07 and 06-08 and the parity runs. The test title says what it asserts.
3. **`selected=` is read from the parsed URL.** The codec writes the list as `11%2C13`, so the spec splits `searchParams.get('selected')` rather than matching raw text.
4. **Pinch zoom is asserted to the exact finger ratio** (96 / 36 to two decimals) and the drag to 40 and 20 px; both are exact telescoping results of the pure transform when no clamp binds, and the logged values (2.666666666666666, 40, 20) show they are.
5. **The auto-pan assertion is also checked for being non-vacuous** (at least one of the five presses must have changed tx or ty).

**Total deviations:** 2 production fixes (one Rule 1, one Rule 2), each in its own commit, no assertion weakened or removed. **Impact on plan:** none beyond the two small component edits.

## Issues Encountered

- Shell quoting broke two attempts to patch the spec through `node -e`; the Edit tool was used instead. Throwaway probe specs (`e2e/zz-probe.spec.ts`) located the panel geometry and the 343 px width, and were deleted each time and never staged.
- The first `npm run build` after each component change was needed because the e2e suite serves the static export in `out/`.

## Verification

- `npx tsc --noEmit --incremental false`: clean after every spec edit; `npm run typecheck` (4x tsc plus lint) passed inside `verify`.
- `node scripts/check-repo.mjs --only base-ten`: OK (spec `git add`ed first).
- `npx playwright test e2e/canvas-interaction.spec.ts --project=chromium-utc`: **11 passed**, run three times after the final build (about 11 s to 16 s each), no flake. The first run of Task 1 showed the width failure before the fix (343 vs 359), the first run of Task 2 showed the missing announcement before the fix.
- `npx vitest run tests/app/canvasDiagramRender.test.ts tests/app/canvasDiagramModel.test.ts`: 82 passed after the component edits.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures`: empty throughout; no frozen oracle or manifest was edited or regenerated; Projection, PairGraphProjection, `app/presets/base10`, `useCanvasPan` and `engine/` untouched; `app/NumogramClient.tsx` untouched (so `test:swap` was not required; the full e2e run includes the 60 goldens and the behaviour baseline).
- `MSYS_NO_PATHCONV=1 npm run verify`: **exit 0.** check-repo 11 checks OK, typecheck, 88 files and 2411 unit tests in UTC and again in America/New_York, sub-path e2e 10 passed, build, `page-weight: OK (2 routes, 30 golden states within tolerance)` with no baseline update, e2e **224 passed and 154 skipped** (up exactly 11 passed and 11 skipped from 06-12's 213 and 143: the 11 new tests run in the UTC project and skip in the New York one), then `check-repo --clean-tree --static-out` OK (13 checks).

## Known Stubs

None.

## Threat Flags

None new. T-06-27 (gestures on small screens) is mitigated and proven: pinch, pan and tap return the state machine to `ready`, a second gesture works, and no page overflows at 375 px. T-06-28 (accessibility claim) is mitigated: every focus key and announcement is compared with a string computed from the engine and the view; the manual screen-reader pass stays in 06-15.

## Observations for 06-14 and 06-15

- **For the 06-15 manual narrow-window and screen-reader checkpoint:** the window width bug existed in the shipped 06-10 to 06-12 build and only the real viewer page shows it (the shell pads 16 px a side); check the right edge of the diagram at 375 px by eye. Listen for the first-focus announcement (aria-label, then "Zone 0, Plex") and decide whether it is acceptable.
- The Regions and Currents panel overlap at the default desktop layout (deferred-items.md) affects any spec that clicks the Plex or Warp buttons with the mouse at a base with 6 or more region rows.
- `e2e/canvas-interaction.spec.ts` shares the e2e port and `out/` directory with 06-14's specs: never run the two Playwright invocations at once.
- REN-02 stays Pending until 06-15 (the phase gate).

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-15*

## Self-Check: PASSED
