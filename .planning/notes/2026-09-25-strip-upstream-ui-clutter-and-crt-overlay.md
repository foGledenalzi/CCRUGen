---
date: "2026-09-25 22:11"
promoted: false
---

See if we can strip away some of the upstream UI clutter and CRT overlay nonsense.

## Context (scan of the inherited shell, 2026-09-25; not a decision)

What is there today:

- `app/globals.css`: `body::after` is a full-viewport scanline overlay (z-index 9999) that runs `crt-flicker 0.08s infinite alternate` forever; `body::before` is a full-viewport "phosphor vignette" (z-index 9998). The `prefers-reduced-motion` block only covers the glitch classes, so the flicker is not motion-gated.
- Glitch effects: `.layout-switch-glitch` + overlay (fired by `triggerLayoutGlitch` in `NumogramClient.tsx`), `.page-nav-crt-glitch-*`, `app/components/navigation/CrtNavigationTransition.tsx` (wraps the whole app in `app/layout.tsx`; the site is now a single route, so route transitions do nothing useful), `app/components/ui/GlitchText.tsx` (random-character scramble on info-panel headings), `GlitchTransition.tsx`, and the orphan hook `app/hooks/useGlitchNavigate.ts` (referenced nowhere). The `.ui-glitch-*` CSS comment says "used in /components showcase", a page that no longer exists.
- Intro splash (`introPhase` in `NumogramClient.tsx`): logo + wordmark with blur and glow transitions, z-index 70.
- Chrome: the `Cyber*` component family in `app/components/ui/` (about 1,970 lines including panels, header, popovers, neon dividers) plus the neon glow and drop-shadow styling throughout the shell.

Why it may be worth stripping:

- High-base rendering: fixed full-screen overlays with an infinite animation make the browser recomposite every frame, which can confound the Phase 3 ceiling measurement (base 64 / 666). Measure with overlays off, or the "ceiling" measures the overlays.
- Accessibility and legibility: the flicker ignores reduced-motion, and text-dense views planned later (demon browser, naming builder) read worse under scanlines and vignette.
- Dead weight: the route-transition provider, the orphan hook and the showcase CSS have no remaining callers.

Constraints to respect:

- The frozen DOM goldens capture only the projection `<svg>`. Shell, overlay and CSS-rule changes are outside the oracle and safe. Anything inside the `<svg>` (classes, inline styles, filters) is compared, so leave that subtree untouched until the Phase 2 migration proves parity.
- The page-weight budget only fails on growth, so removals cannot trip it.
- Do not edit while a plan that touches `app/` is mid-flight; run the goldens (60/60) and `npm run check:weight` after any strip.

Open questions for the discuss step (probably Phase 4, Base Picker and Generator UI, with a Phase 3 note to benchmark overlay-off):

1. Remove outright, or keep an opt-in "retro" toggle that defaults to off?
2. Keep the intro splash, shorten it, or drop it?
3. Keep the `Cyber*` panel look, or simplify to a plainer panel set?
4. Whatever survives must honour `prefers-reduced-motion`.

Promote with `/gsd-note promote <N>` to turn this into a todo.
