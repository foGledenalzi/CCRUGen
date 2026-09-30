---
title: "Base 10's rendered layout doesn't match the canonical CCRU numogram shape"
status: pending
priority: P2
source: "user feedback, live local dev session, 2026-09-30"
created: 2026-09-30
theme: visual
---

## Goal

The user ran the current dev build locally and reported that base 10's diagram reads as "an odd shape" — it should visually match the canonical CCRU numogram (the well-known ten-zone diagram from the CCRU writings), not just be numerically/structurally correct.

## Context

No root cause has been diagnosed yet — this is a direct visual observation from the user, not a code investigation. Base 10 is supposed to be the reference preset that the engine reproduces exactly (`PROJECT.md`'s core value), and its DOM output is locked byte-identical to the frozen goldens (`e2e/__golden__/`) since Phase 1, so any fix here has to happen carefully:

- Likely relevant: `app/presets/base10/layouts.ts` / `layout-tables.ts` / `routes.ts` (the authored `P_ORIGINAL`/`P_LABYRINTH`/`P_LADDER` position tables and route geometry carried over from the original inherited viewer), `engine/layout/` (the procedural layout code introduced in Phase 3 for other bases, which base 10 does NOT use for its default "original" layout — it keeps the hand-authored preset).
- If the "odd shape" is in the **default/original** base-10 layout specifically, this is inherited, pre-existing geometry from the upstream `lumpenspace/ccru` viewer, not something any phase in this project introduced — worth confirming against `reference/` (the CCRU book/guide, gitignored) what the "correct" canonical shape actually looks like before changing anything.
- If it's specific to one of the newer layouts (ladder, ring, spiral, pair-graph — Phase 3/4 additions), it's more likely a genuine bug introduced in this project's own layout work.
- Any visual change to base 10's "original" layout is a frozen-oracle change: the 60 DOM goldens would need a deliberate, dated re-freeze (`node scripts/golden-manifest.mjs freeze ... --reason "..."`), never an `-u`/`--update-snapshots` fix. CLAUDE.md's frozen-oracle rule applies in full here.

## Acceptance Criteria

- [ ] Compare the current base-10 "original" layout against a canonical CCRU numogram reference image/description and identify exactly what reads as "odd" (proportions, angle, zone ordering, Warp/Plex placement, something else)
- [ ] Determine whether the discrepancy is inherited from upstream (pre-existing, not a regression) or introduced by this project's own work
- [ ] If a fix is warranted, get explicit user sign-off on the corrected shape before touching `app/presets/base10/*`, since this is the reference preset every other base is checked against
- [ ] If the fix touches the frozen "original" layout's rendered output, re-freeze the goldens deliberately with a dated reason — never regenerate silently
