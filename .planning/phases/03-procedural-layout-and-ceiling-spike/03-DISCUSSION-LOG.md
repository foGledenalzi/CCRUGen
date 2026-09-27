# Phase 3: Procedural Layout and Ceiling Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-27
**Phase:** 3 - Procedural Layout and Ceiling Spike
**Areas discussed:** Flow and Plex placement, Layout family, Scaling with n, Review sheet and spike, plus a second round (pair-graph view, layout-switch animation)

Gray areas offered: the four above (all selected). Todo cross-reference: none matched.

---

## Flow and Plex placement

**Q: Which way should time flow around each Torque ring?**

| Option | Description | Selected |
|--------|-------------|----------|
| Anticlockwise (Recommended) | Matches the lore already in the viewer (anticlockwise Time Circuit) | ✓ |
| Clockwise | Conventional clock direction; contradicts the existing descriptions | |

**Q: Where do the Plex and Warp capsules sit relative to the Torque rings?**

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom, outside the rings (Recommended) | Plex bottom centre, Warp beside or above it, like the authored original; centre stays free for the rings | ✓ |
| Centre of the composition | Capsules in the middle with rings nested around them; cramped with tiny Torque cycles | |
| Warp above, Plex below | Split vertically as the authored layout does; stretches the drawing vertically | |

---

## Layout family

**Q: Default procedural look for many Torque cycles?**

| Option | Description | Selected |
|--------|-------------|----------|
| Ring glyphs, packed (Recommended) | One ring per Torque cycle, up to 3 nested concentrically, more packed by a deterministic spiral search | ✓ |
| One Barker spiral | All pairs on one spiral; cheap but cycles no longer visible as rings | (kept as a selectable option) |

User's answer: "Ring glyphs, packed as default. with a barker spiral option."

**Q: Which selectable layouts exist for every base besides the default?**

| Option | Description | Selected |
|--------|-------------|----------|
| Ring plus ladder (Recommended) | Procedural ladder that reduces exactly to the authored ladder at base 10 | ✓ |
| Ring only | Fewer things to review | |
| Ring, ladder, spiral and chord diagram | More variety, more to tune | |

Resulting set (with the user's note above): ring (default), ladder, Barker spiral.

---

## Scaling with n

**Q: How does the drawing space behave as the base grows?**

| Option | Description | Selected |
|--------|-------------|----------|
| Grow the space, keep nodes readable (Recommended) | viewBox grows with n up to a cap; zoom and pan handle the rest; base 10 keeps its 800-wide frames | ✓ |
| Fixed frame, shrink everything | Whole diagram always on screen; tiny nodes and labels at base 64 and 100 | |

**Q: How do labels behave with many zones?**

| Option | Description | Selected |
|--------|-------------|----------|
| Show only when big enough (Recommended) | Threshold in the tier table (about 7 px radius); otherwise hover or selection | ✓ |
| Always show, scaled down | Complete but collides and becomes unreadable before base 100 | |

---

## Review sheet and spike

**Q: How do you sign off the generated layouts?**

| Option | Description | Selected |
|--------|-------------|----------|
| One HTML contact sheet (Recommended) | Self-contained, zoomable SVG for bases 2, 4, 6, 8, 12, 16, 28, 64, 82, 100 | ✓ |
| PNG images per base | Easy to page through; not zoomable | |

**Q: Which browsers and devices does the spike measure?**

| Option | Description | Selected |
|--------|-------------|----------|
| This PC, Chromium (Recommended) | Real measurements here; other devices later as extra rows | ✓ |
| This PC plus Firefox | Another ~100 MB download | |

**Q: WebGL fallback tier?**

| Option | Description | Selected |
|--------|-------------|----------|
| Decide from the measurements (Recommended) | Recorded yes/no in the threshold table | ✓ |
| Yes, plan it regardless | Add now | |
| No, Canvas and headless only | Rule out now | |

**Q: A `tier=` URL override?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, diagnostic override (Recommended) | `?tier=svg|canvas|headless`; recorded as yes | ✓ |
| No override | Simpler URLs, harder to compare tiers | |

---

## Second round (user chose "Explore more gray areas")

**Q: How is each pair drawn in the pair-graph view?**

| Option | Description | Selected |
|--------|-------------|----------|
| One node per pair, labelled hi::lo (Recommended) | Circle per pair, currents as arrows, Plex and Warp as self-looping nodes | ✓ |
| A capsule holding both zones | Wider, packs less tightly | |

**Q: Should layout switching animate for generated bases?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with a size cutoff (Recommended) | Interpolate two equal-length arrays; instant above the measured cutoff | ✓ |
| No, switch instantly | Simpler; base 10 keeps its animation | |

---

## Claude's Discretion

Packing algorithm and tie-breaks, ring rotation, the size cap for the growing space, routing style of gates and currents (Y-junctions, bundling at n >= 100), layout ids and file layout in engine/layout, frame height and bounds derivation, the tier-table schema and location, the measurement harness, the scene-to-SVG emitter API, the review-sheet script, interim LOD thresholds, and the plan/wave breakdown.

## Deferred Ideas

Chord-diagram and force layouts; Safari, Firefox and phone measurements; a WebGL tier (pending measurements); base picker and label scheme UI (Phase 4); Canvas tier and worker (Phase 6); export and CLI promotion (Phase 8).
