---
date: "2026-09-25 22:11"
promoted: false
updated: "2026-09-25 (decisions recorded)"
---

See if we can strip away some of the upstream UI clutter and CRT overlay nonsense.

## Decisions (user, 2026-09-25)

1. **Remove the CRT overlays outright** (no opt-in "retro" toggle).
2. **Drop the intro splash.**
3. **Streamline the panels without removing critical information.**

## What to remove (from a scan of the inherited shell, 2026-09-25)

- `app/globals.css`: `body::after` scanline overlay (z-index 9999, `crt-flicker 0.08s infinite alternate`) and `body::before` phosphor vignette (z-index 9998).
- Glitch effects: `.layout-switch-glitch` + overlay and `triggerLayoutGlitch` in `NumogramClient.tsx`; `.page-nav-crt-glitch-*`; `app/components/navigation/CrtNavigationTransition.tsx` (wraps the whole app in `app/layout.tsx`; the site is a single route now); `app/components/ui/GlitchText.tsx` (random-character scramble on info headings) and `GlitchTransition.tsx`; the orphan hook `app/hooks/useGlitchNavigate.ts`; the `.ui-glitch-*` CSS ("used in /components showcase", a page that no longer exists). Remove the matching `@keyframes` and the `prefers-reduced-motion` block that only existed for them.
- Intro splash: `useIntro()` / `introPhase` in `NumogramClient.tsx`, the splash block (logo + "CCRUG" wordmark, z-index 70) and the hook file. **Careful:** `introPhase` also gates the opacity of the projection wrapper (0 while the title shows, 0.8 while fading, then 1) and is passed to `PinnedBackground`. The steady state is opacity 1, so removal should render that immediately, but this is the one part that sits near the oracle: confirm with the goldens.

## Panels: streamline, but keep every datum and control

Current shell: header (undo, redo, share, layout switcher), panels Layers (layer toggles + particles), Labels (label visibility), Zones (per-zone toggles + hover info), Regions (region select + time-circuit toggle), Syzygies (pair toggles + hover info), Currents, Gates (select gate + toggle all), Selection (`InfoDisplay`: zone, syzygy, current, gate and demon details), the shortcuts modal, and the sources footer.

Rule for the streamlining work: write a before/after inventory first. Every value a panel shows today and every control it offers must still be readable or reachable afterwards, even if merged, reordered, collapsed by default or moved. What may go: neon glows and drop shadows, decorative frames and dividers, scramble text, heavy panel chrome, dead props and dead components. When unsure whether something is critical, keep it and flag it.

Constraints:

- The frozen DOM goldens capture only the projection `<svg>`. Shell, overlay and CSS-rule changes are outside the oracle. Anything inside the `<svg>` (classes, inline styles, filters) is compared, so leave that subtree untouched until the Phase 2 migration proves parity. Run the goldens (60/60) and `npm run check:weight` after each strip; removals cannot trip the size budget.
- Do not edit `app/` while another plan that touches it is mid-flight.
- Whatever motion remains must honour `prefers-reduced-motion`.

## Proposed sequencing (Claude's recommendation, not yet agreed)

- **Overlays and splash: right after Phase 1 closes**, as one small task (for example `/gsd-quick`). It is mechanical, verifiable by the goldens, and it removes the always-on overlays before the Phase 3 ceiling measurement so the ceiling is not confounded, and before Phase 2 starts editing the client.
- **Panel streamlining: in the Phase 4 discuss/plan** (Base Picker and Generator UI), because that phase reshapes the panels for the base picker anyway; streamlining first would be redone.

Promote with `/gsd-note promote <N>` to turn this into a todo.
