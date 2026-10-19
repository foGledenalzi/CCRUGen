# Deferred items — Phase 6 (canvas-tier-and-worker)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 2026-10-15 — `next lint --dir e2e` reports two errors in files outside plan 06-14 (found during 06-14)

- **Where:** `e2e/canvas-tier.spec.ts:78` (`pairScene` is defined but never used) and `e2e/visual-dom.ts:50` (an expression statement,
  `@typescript-eslint/no-unused-expressions`).
- **Why deferred:** the repo's lint gate (`npm run lint`) covers `app`, `engine` and `workers` only, so `npm run verify` is unaffected;
  `e2e/visual-dom.ts` belongs to the frozen DOM-golden harness (a change there needs care), and neither file was touched by 06-14.
- **Suggested fix:** delete the unused `pairScene` binding in `canvas-tier.spec.ts`; leave `visual-dom.ts` alone unless the harness is
  ever re-captured, or add `e2e` to the lint script only after both are clean.

## 2026-10-15 — Regions panel lower rows sit under the Currents panel header at the default desktop layout (found during 06-13)

- **Where:** the viewer's initial draggable panel positions (the `DESKTOP_PANEL_*` constants and the panel-group stacking
  in `app/NumogramClient.tsx`), at 1280 px wide and heights 800, 900 and 1000, and at 1440 x 900, base 202.
- **Symptom:** the Regions panel (216,64, 180 x 235) has 6 rows plus Time Circuit at base 202, so its bottom 70 px
  overlap the Currents panel (216,227, 180 x 70). The Currents header is above the Warp and Plex rows' Isolate and Mute
  buttons: a mouse click meant for them lands on the Currents header (Playwright reports "header ... intercepts pointer
  events"). The buttons work from the keyboard, and the panels can be dragged apart.
- **Why deferred:** nothing in Phase 6 changed the panel stack, and no Canvas-tier file is implicated; the cause was later measured (2026-10-18): the desktop
  panel stack keeps the heights it measured at the first render (base 10) and does not re-stack after a base change; it
  reproduces on a plain SVG-tier switch 10 to 28, so it is a pre-existing Phase 4-era bug. See
  `.planning/todos/pending/008-regions-panel-overlaps-currents-at-large-bases.md`. It is a layout decision for the panel stack, not for this plan.
- **How 06-13 works around it:** `e2e/canvas-interaction.spec.ts` activates the Plex and first-Torque buttons with focus
  and Space (the `press` helper), which also exercises the keyboard path.
- **Suggested fix for whoever picks this up:** place each panel below the measured height of the one above it in its
  column (or cap the Regions list to the room the Currents panel leaves), then add a mouse-click assertion on a Warp or
  Plex button to `e2e/region-legend.spec.ts` at a base with 6 or more rows.
