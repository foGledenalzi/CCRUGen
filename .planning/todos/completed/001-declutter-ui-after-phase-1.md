---
title: "Strip upstream UI clutter and CRT overlay (no functionality removed) after Phase 1 completes"
status: completed
priority: P2
source: "promoted from /gsd-note"
created: 2026-09-25
completed: 2026-09-26
theme: ui
---

## Goal

Strip the inherited UI clutter and CRT overlay nonsense as one small task, run **after Phase 1 is complete and verified** (before Phase 2 is discussed). User decisions (2026-09-25): remove the overlays outright, drop the intro splash, streamline the panels; "critical information" means functionality, so **do not remove any functionality, only clutter**. Full scan, caveats and rules: `.planning/notes/2026-09-25-strip-upstream-ui-clutter-and-crt-overlay.md` (read it first).

## Context

Promoted from the quick note captured on 2026-09-25 22:11. Suggested route: `/gsd-quick`. Not a new phase, and structural panel changes (merging, moving, redesigning) stay in Phase 4.

## Acceptance Criteria

- [x] Before-inventory written first: every control, toggle, hover readout, selection detail, shortcut and panel behaviour in the current shell (`.planning/notes/2026-09-25-ui-declutter-inventory.md`, commit 1316ca7)
- [x] `body::before` vignette, `body::after` scanlines and the `crt-flicker` animation removed from `app/globals.css`
- [x] Glitch effects removed: layout-switch glitch (`triggerLayoutGlitch` and overlay), `CrtNavigationTransition` provider (unwrapped in `app/layout.tsx`), `GlitchText` (same static text kept), `GlitchTransition`, orphan `useGlitchNavigate`, and their CSS, keyframes and the now-empty `prefers-reduced-motion` block (a single generic reduced-motion guard now covers the remaining hover/expand transitions)
- [x] Intro splash and `useIntro` removed; the projection wrapper renders at full opacity immediately; `PinnedBackground` updated for the missing `introPhase`
- [x] Visual panel clutter removed (neon glows and drop shadows, decorative frames and dividers, heavy chrome) with no control or readout removed, hidden by default or moved
- [x] After-inventory ticked off item by item against the before-inventory (same note; zero lost controls or readouts, every difference explained)
- [x] The 60 DOM goldens still pass unchanged (no `-u`, no `GOLDEN_CAPTURE`), both manifests verify, the projection `<svg>` subtree is untouched
- [x] Static-export specs pass (default and `/ccrug` sub-path), `npm run check:weight` OK, `npm run typecheck`, `npm run test` and `npm run test:tz` pass
- [x] Review finding WR-01 closed: with `NEXT_PUBLIC_BASE_PATH=/ccrug`, clicking the "CCRUG" header title from `/ccrug/numogram/?selected=5` lands on `/ccrug/numogram/` (not `/ccrug/ccrug/numogram/`); add that click case to `e2e/static-export.spec.ts` (added; passes at the root and under `/ccrug`)
- [x] Looked at in a real browser at desktop width; nothing pushed (reviewed as Playwright Chromium screenshots at 1440x900 and 390x800, not by eye in a window; nothing pushed)
