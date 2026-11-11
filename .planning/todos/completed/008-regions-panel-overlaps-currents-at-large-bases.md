---
title: "Desktop panel stack does not re-measure after a base change, so the Regions panel overlaps the Currents header (and other panels drift)"
status: completed
priority: P2
source: "Phase 6 execution, plan 06-13 e2e run, 2026-10-15 (logged first in .planning/phases/06-canvas-tier-and-worker/deferred-items.md)"
created: 2026-10-15
completed: 2026-11-11
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

- [x] At 1280x800 and 1440x900, base 202 (and a base with 6+ regions), a mouse click on the Warp, Plex and each Torque row's Isolate and Mute buttons toggles that region (07-07, `e2e/region-legend.spec.ts`: the two `todo 008: a real mouse click on Warp and Plex Isolate/Mute toggles the region at base 202` tests at 1280x800 and 1440x900; passed in the 07-25 gate)
- [x] No panel overlaps another panel's header at the default layout for any base the picker offers up to the interactive ceiling (proven at the sampled bases 10, 28, 64 and the Canvas bases 202, 1000 and 4000, and after a base change through the picker; by construction for any base, because the stack is derived from the measured panel heights, not from per-base constants)
- [x] `npm run test:swap` and `npm run verify` stay green without regenerating any frozen oracle (`MSYS_NO_PATHCONV=1 npm run verify` exit 0 on 2026-11-11 in the 07-25 gate; the 60 DOM goldens, the behaviour baseline and the fixtures are byte-identical to the pre-Phase-7 commit `0f25f1b`)

## Resolution (Phase 7, plans 07-03, 07-07, 07-24)

Fixed by deriving the desktop stack from measured heights instead of the one-shot, first-render layout effect:

- **The fix.** `app/lib/panelStack.ts` (`computeDesktopStack`, 07-03) is a pure function of the measured panel heights; `NumogramClient.tsx` feeds it the live heights, so every height change (a base change that adds Regions rows, a collapse, Names opening or Selection growing) re-stacks the column. `app/hooks/usePanelDrag.ts` (07-07) was rebuilt on the pure drag and z reducers so a dragged panel keeps its own position and an untouched one keeps following the stack. Base 10's placement stayed byte-for-byte what the old effect gave (checked at four viewports against the old formula and 20,000 random height sets).
- **The proof.** `e2e/panel-stack.spec.ts` (62 tests, 9 from 07-07 and 53 from 07-24): the todo 008 trigger itself (base 10, then 28 through the picker; and again with Names open), and a no-overlap matrix at bases 10, 28, 64 and the Canvas base 202 (plus Canvas bases 1000 and 4000 at two viewports) across seven desktop viewports and four panel states, plus the mobile stack, planetary clearance, drag and z-cap cases. In `e2e/region-legend.spec.ts` two `todo 008` tests: base 10 then 28 through the picker leaves Regions and Currents apart, and at base 202 at 1280x800 and 1440x900 a real mouse click on the Isolate and Mute buttons of every Torque row, Warp and Plex toggles that region (the earlier work-around of pressing them by keyboard in `e2e/canvas-interaction.spec.ts` is no longer needed but was left in place).
- **Criterion 2, worded as proven.** No overlap at the sampled bases (including a Canvas base) and after a base change; by construction for any base, because the stack is derived from measured heights. No sweep over every base the picker offers was run.
- **Frozen oracles.** The change touched no golden, behaviour baseline or fixture: `npm run test:swap` passed after the wiring plan (07-07) and `npm run verify` exits 0 with them byte-identical (07-25).
