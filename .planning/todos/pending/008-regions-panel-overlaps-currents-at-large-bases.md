---
title: "Desktop panel stack does not re-measure after a base change, so the Regions panel overlaps the Currents header (and other panels drift)"
status: pending
priority: P2
source: "Phase 6 execution, plan 06-13 e2e run, 2026-10-15 (logged first in .planning/phases/06-canvas-tier-and-worker/deferred-items.md)"
created: 2026-10-15
theme: ui-layout
---

## Goal

Stop the default desktop panel stack from overlapping when the Regions panel grows tall, so every Regions row (including Warp, Plex and Time Circuit) and its Isolate/Mute buttons are mouse-clickable.

## Context

Found while writing `e2e/canvas-interaction.spec.ts` (plan 06-13). At 1280 px wide with heights 800, 900 and 1000, and at 1440 x 900, base 202:

- The Regions panel (positioned about 216,64, 180 x 235) has 6 rows plus Time Circuit at base 202, so its bottom 70 px overlap the Currents panel (about 216,227, 180 x 70).
- The Currents header sits above the Warp and Plex rows' Isolate and Mute buttons. A mouse click meant for them lands on the Currents header (Playwright reports "header ... intercepts pointer events"). The buttons still work from the keyboard, and the panels can be dragged apart.
- Nothing in Phase 6 changed the panel stack; the cause is the fixed desktop stacking positions (`DESKTOP_PANEL_*` constants and the panel-group layout in `app/NumogramClient.tsx`), which do not follow the Regions panel's real height at bases with several rows. It was observed, not investigated further.

This is the same family of problem as the narrow-window Selection/Zones overlap fixed in `43760fb` (there the mobile stack ignored the Selection panel's real height; here the desktop stack ignores the Regions panel's).

## Root-cause evidence (measured 2026-10-18 in the built-in browser, 1280x800, dev server)

The overlap is **not specific to large bases or to the Canvas tier**. It follows how the viewer reached the base:

| Route to base 28 | Regions | Currents | Zones | Syzygies | Gates | Result |
|---|---|---|---|---|---|---|
| Direct load `?base=28&tier=svg` | y64-250 | y268 | y326 | y874 | y618 | correct stack, 18 px gaps |
| Load `/numogram/` (base 10), then type 28 in the picker (plain synchronous SVG-tier switch, no worker) | y64-250 | **y227** | y347 | y635 | y388 | **Currents overlaps Regions by 23 px** |
| Direct load `?base=28&tier=canvas` (hydrates at base 10, then swaps to 28) | y64-250 | **y227** | y347 | y635 | y388 | same overlap |

The post-switch offsets (Currents 227, Zones 347, Gates 388, Syzygies 635) are the ones the stack computes from the **base-10-era panel heights**: Labels then had one more row (101 px vs 80), Regions had fewer rows (about 145 px vs 186). So the desktop stack keeps the heights it measured at the first render and does not re-stack after a base change changes a panel's content height. It is a Phase 4-era layout bug that Phase 6 merely made easier to see, because Canvas-tier bases are always reached after a base-10 first render. Likely area: `desktopPanelHeights` / `onPanelHeight` in `app/NumogramClient.tsx` and the `usePanelGroupLayout` stack (the mobile stack re-measures through `CyberPanel`'s `ResizeObserver` and does not show this).

## Suggested fix

Place each panel below the measured height of the one above it in its column (the mobile layout already does this through `usePanelGroupLayout` and `CyberPanel`'s `onHeightChange`), or cap the Regions list to the room the Currents panel leaves with an internal scroll. Then add a mouse-click assertion on a Warp or Plex Isolate/Mute button to `e2e/region-legend.spec.ts` at a base with 6 or more rows.

## Constraints

- The 60 DOM goldens capture only the projection `<svg>` and the behaviour baseline reads named regions and `data-post-baseline` subtrees, so a panel-position change may still touch the frozen behaviour baseline's panel text/geometry facts: check with `npm run test:swap` before assuming it is safe, and use a new dated frozen set (never `-u`) if an intentional visual change requires it.
- Work around in tests today: `e2e/canvas-interaction.spec.ts` presses those buttons with focus and Space.

## Acceptance Criteria

- [ ] At 1280x800 and 1440x900, base 202 (and a base with 6+ regions), a mouse click on the Warp, Plex and each Torque row's Isolate and Mute buttons toggles that region
- [ ] No panel overlaps another panel's header at the default layout for any base the picker offers up to the interactive ceiling
- [ ] `npm run test:swap` and `npm run verify` stay green without regenerating any frozen oracle
