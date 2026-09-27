---
date: "2026-09-27"
promoted: false
---

Look into the feasibility of making diagram nodes repositionable (drag a zone/pair node to a
custom position, rather than only the procedural/preset layout).

## Context (2026-09-27, during Phase 3 execution)

Raised right after the Phase 3 layout contact-sheet sign-off (plan 03-08), where the current
architecture landed: deterministic procedural layouts (`engine/layout/{ring,ladder,spiral,
pairgraph}.ts`) compute every node's position from the base and layout id alone, base-10's four
authored layouts are frozen `LayoutSpec` presets, and the signed-off coordinates for all 40
review-base/layout combinations are pinned by sha256 digest in `engine/test/layout.digest.test.ts`
(changes only with a fresh user sign-off, never to make a test pass).

Not scoped or decided anywhere yet — v1's locked scope (`.planning/PROJECT.md`) is core diagram +
demons + naming builder + export, with no mention of interactive layout editing, and this wasn't
one of the gray areas discussed in Phase 3 (03-CONTEXT.md's Deferred Ideas covers "base picker and
label scheme UI (Phase 4)" but not draggable/custom node positions).

## Things a feasibility look should cover

- Where custom positions would live: per-viewer state only (like a local override layer on top of
  the computed `Layout`), vs. persisted (localStorage, URL state, or export/import alongside the
  naming-builder's JSON) — each has very different scope.
- Interaction with the frozen digest pin from 03-08: a user-dragged position must never touch the
  procedural engine's own output or the pinned base-10 presets; it would need to be a separate
  override applied on top, so the existing frozen tests keep meaning what they mean.
- Interaction with the "growing space" model (D-06: viewBox grows with n up to a cap) and the
  layout-switch tween (D-09, `engine/layout/tween.ts`'s `lerpPositions`): what happens to a
  manually-moved node when the base or layout changes, or when animating between two layouts.
- Whether this is a per-node drag (simple) or implies a force-directed/physics re-layout of
  neighbors (much bigger scope, and was explicitly deferred already — "Chord-diagram and force
  layouts" is in Phase 3's Deferred Ideas).
- Likely home if it goes forward: Phase 4 (Base Picker and Generator UI) at the earliest, as an
  addition to that phase's interactive surface — not a Phase 3 concern.
