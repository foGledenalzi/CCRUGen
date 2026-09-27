---
title: "Expose packer choice (shelf vs. spiral) in the Phase 4 generator UI"
status: pending
priority: P3
source: "Phase 3 plan 03-08 contact-sheet sign-off (2026-09-27)"
created: 2026-09-27
theme: ui
---

## Goal

Phase 3 implements and tests two packing algorithms for arranging multiple Torque-cycle ring
glyphs on the canvas when a base has 4 or more rings that can't all nest concentrically (bases
like 64 and 100): `shelf` (tidy rows, tighter fill, cheaper to compute) and `spiral`
(golden-angle spiral, more organic-looking, research-measured as less space-efficient and
20-100x costlier at scale). The user reviewed both on the Phase 3 layout contact sheet and
chose `shelf` as the shipped default (`engine/layout/params.ts`'s `DEFAULT_LAYOUT_PARAMS`,
plan 03-08), confirming the choice is purely a rendering/layout decision with zero effect on
the numogram's structure (each ring's zones, syzygies, flow direction and demons are identical
under either packer) — no lore trade-off either way.

`spiral` stays selectable at the engine/params level and via the dev-only review-sheet contact
sheet (`scripts/review-sheet.ts`), but there is currently no way for an end user of the actual
generator to choose it — the live viewer will just always render `shelf`.

## Solution

When Phase 4 (Base Picker and Generator UI) builds the interactive viewer, add a user-facing
control (e.g. a toggle or a setting alongside the base picker) that lets the user switch a
generated base's layout between `shelf` (default) and `spiral` packing. This only visibly
matters for bases with 4+ Torque cycles (64, 100, and similar), since bases with 3 or fewer
rings always nest concentrically regardless of packer. Should reuse `engine/layout/registry.ts`'s
existing packer parameter — no new engine work should be needed, just UI plumbing and state
(likely alongside whatever mechanism Phase 4 uses for other per-base display choices, and a
candidate for URL state per the project's existing conventions).
