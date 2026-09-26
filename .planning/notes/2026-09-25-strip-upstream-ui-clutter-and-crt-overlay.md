---
date: "2026-09-25 22:11"
promoted: true
updated: "2026-09-25 (decisions recorded)"
---

See if we can strip away some of the upstream UI clutter and CRT overlay nonsense.

## Decisions (user, 2026-09-25)

1. **Remove the CRT overlays outright** (no opt-in "retro" toggle).
2. **Drop the intro splash.**
3. **Streamline the panels without removing critical information.** Clarified by the user: "critical information" means functionality. **Do not remove any functionality; only remove clutter.**

## What to remove (from a scan of the inherited shell, 2026-09-25)

- `app/globals.css`: `body::after` scanline overlay (z-index 9999, `crt-flicker 0.08s infinite alternate`) and `body::before` phosphor vignette (z-index 9998).
- Glitch effects: `.layout-switch-glitch` + overlay and `triggerLayoutGlitch` in `NumogramClient.tsx`; `.page-nav-crt-glitch-*`; `app/components/navigation/CrtNavigationTransition.tsx` (wraps the whole app in `app/layout.tsx`; the site is a single route now); `app/components/ui/GlitchText.tsx` (random-character scramble on info headings) and `GlitchTransition.tsx`; the orphan hook `app/hooks/useGlitchNavigate.ts`; the `.ui-glitch-*` CSS ("used in /components showcase", a page that no longer exists). Remove the matching `@keyframes` and the `prefers-reduced-motion` block that only existed for them.
- Intro splash: `useIntro()` / `introPhase` in `NumogramClient.tsx`, the splash block (logo + "CCRUG" wordmark, z-index 70) and the hook file. **Careful:** `introPhase` also gates the opacity of the projection wrapper (0 while the title shows, 0.8 while fading, then 1) and is passed to `PinnedBackground`. The steady state is opacity 1, so removal should render that immediately, but this is the one part that sits near the oracle: confirm with the goldens.

## Panels: remove clutter, keep all functionality

Current shell: header (undo, redo, share, layout switcher), panels Layers (layer toggles + particles), Labels (label visibility), Zones (per-zone toggles + hover info), Regions (region select + time-circuit toggle), Syzygies (pair toggles + hover info), Currents, Gates (select gate + toggle all), Selection (`InfoDisplay`: zone, syzygy, current, gate and demon details), the shortcuts modal, and the sources footer.

Rule (user, 2026-09-25): **no functionality is removed.** Every control, toggle, hover readout, selection detail, keyboard shortcut, panel behaviour (open/close, drag) and URL-state feature that works today must work the same afterwards, and no readout may end up hidden by default or behind an extra click. This is a visual declutter, not a redesign: do not merge, drop or relocate panels or controls (any such structural change belongs to the Phase 4 UI work, decided there).

Clutter that may go: neon glows and drop shadows, decorative frames and dividers, scramble text (replace with the same static text), heavy chrome and ornamental borders, extra spacing, and code that belongs only to the removed effects (their CSS, keyframes, hooks and components). Leave other unused code alone (for example `shareParams.ts`, `cyberColors.ts`, kept for Phase 4). When unsure whether something is functionality, keep it and flag it.

Verification: before starting, write a short before/after inventory of every control and readout, and tick each one off after. Run the goldens (60/60) and the static-export specs too.

Constraints:

- The frozen DOM goldens capture only the projection `<svg>`. Shell, overlay and CSS-rule changes are outside the oracle. Anything inside the `<svg>` (classes, inline styles, filters) is compared, so leave that subtree untouched until the Phase 2 migration proves parity. Run the goldens (60/60) and `npm run check:weight` after each strip; removals cannot trip the size budget.
- Do not edit `app/` while another plan that touches it is mid-flight.
- Whatever motion remains must honour `prefers-reduced-motion`.

## Sequencing (agreed by the user, 2026-09-25: do the declutter after Phase 1 completes)

- **All of the declutter as one task right after Phase 1 closes** (for example `/gsd-quick`): overlays, glitch effects, intro splash, and the visual clutter in the panels (glows, frames, scramble text, heavy chrome). Because it removes no functionality and restructures nothing, it is mechanical and verifiable by the goldens, the static-export specs and the before/after inventory. It also removes the always-on overlays before the Phase 3 ceiling measurement, so the ceiling is not confounded, and before Phase 2 starts editing the client.
- **Structural panel changes** (merging, moving or redesigning panels for the base picker) stay in the Phase 4 discuss/plan, where they are decided separately.

Tracked as todo `.planning/todos/pending/001-declutter-ui-after-phase-1.md`.
