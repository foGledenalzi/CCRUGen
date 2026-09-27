# Phase 3: Procedural Layout and Ceiling Spike - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Give every even base a deterministic, legible layout; keep base 10's four authored layouts as presets that match the Phase 2 goldens; add a syzygy-collapsed pair-graph view; make node, label, stroke and loop sizes scale with n; and measure the renderer ceiling on real hardware into a threshold table stored as data (LAY-01..LAY-04, REN-01; ROADMAP Phase 3 success criteria 1-5).

Built here: pure layout modules in `engine/layout/` (no DOM, deterministic, O(n) or O(n + k^2)), the base-10 preset layouts in `app/presets/base10/`, a dev-only review harness (scene-to-SVG string emitter plus a script that writes a review sheet) that later becomes the export deliverables of Phase 8, and the ceiling spike with its threshold table (`engine/scene/tiers.ts`-style data, not constants in components).

Not built here: the base-generic viewer, the base picker and label scheme UI (Phase 4; the viewer stays a base-10 viewer until then, and `NumogramClient.tsx` / `Projection.tsx` are not edited), the demon browser (Phase 5), the Canvas tier and worker (Phase 6), the naming builder (Phase 7), and the real export and CLI (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Visual conventions (user taste, called out by the roadmap)
- **D-01:** **Time flows anticlockwise** around every generated Torque ring, matching the lore already shown in the viewer (the Time Circuit is anticlockwise: Surge rushing outward, Sink dragging inward). The current of a pair lands on the next pair's odd zone in flow order.
- **D-02:** **Plex and Warp capsules sit at the bottom, outside the Torque rings**: Plex capsule at the bottom centre with the Warp capsule beside or above it, like the authored `original` layout (Plex 0/9 low, Warp 3/6 high). The centre stays free for the Torque rings so nested rings never collide with a capsule. (Bases without a Warp draw the Plex capsule alone.)

### Layout family
- **D-03:** **Default procedural layout `ring`**: every Torque cycle is a ring glyph (a 2L-gon whose zones alternate the odd and the even member of each pair, in flow order); up to 3 cycles nest concentrically (largest outermost; base 28 shows rings of 9 and 3 pairs, base 82 shows 27, 9 and 3); more cycles are packed as separate ring glyphs by a deterministic search (largest first, fixed sort tie-breaks, golden-angle spiral candidates). Syzygy pairs are adjacent by construction. Each ring is rotated so its smallest pair sits at the top (planner may refine).
- **D-04:** **Three selectable layouts exist for every base**: `ring` (default), a procedural `ladder` (two columns, low zone left and high zone right, one row per pair; it must reduce EXACTLY to the authored base-10 ladder), and the **Barker spiral** (all pairs on one spiral ordered by destination, innermost to outermost, echoing the lore). No antipodal-chord layout and no force-directed layout in v1.
- **D-05:** **Base 10 keeps its four authored layouts** (original, labyrinth, ladder, planetary) as `LayoutSpec` presets in `app/presets/base10/layouts.ts` that reproduce today's coordinates, draw order, centres and frame heights exactly (a test proves it against the frozen Phase 2 goldens and `app/data/positions.ts` values); every other base falls back to the procedural default. `app/data/positions.ts` becomes a thin pass-through seam over the presets (same seam pattern as Phase 2 D-01), so the base-10 viewer's render path is unchanged and the DOM goldens stay byte-identical. Planetary stays a base-10-only preset (not generalized).

### Scaling and labels
- **D-06:** **The drawing space grows with n, up to a cap**, so node size, label size and stroke width stay in a readable range; zoom and pan handle the rest. Base 10's presets keep their exact 800-wide frames. The layout supplies node radius, label size and stroke scale; nothing may overlap or clip on the review sheet bases (LAY-03).
- **D-07:** **Labels appear only when the node is large enough on screen** (a threshold kept in the tier table; the starting hypothesis is about a 7 px node radius) and otherwise on hover or selection. The layout supplies sizes; the renderer applies the threshold (renderers arrive in Phases 4 and 6).

### Pair-graph view and switching
- **D-08:** **Syzygy-collapsed pair-graph view**: one node per pair labelled `hi::lo` (the net-span, in the numogram's own base), arrows for the currents around each Torque ring, and the Plex and Warp pairs drawn as self-looping nodes. Every Torque cycle must read as a clean ring, including base 64's six or more cycles (it reuses the ring packing).
- **D-09:** **Layout switching animates for generated bases too**, as a straight interpolation of two equal-length coordinate arrays, with a size cutoff above which the switch is instant so large bases never stutter; the cutoff comes from the spike. Base 10 keeps its existing animation.

### Review and the ceiling spike
- **D-10:** **Sign-off by one self-contained HTML contact sheet** generated by a script: bases 2, 4, 6, 8, 12, 16, 28, 64, 82 and 100 (the roadmap set), each with the ring, ladder and spiral layouts and the pair-graph view, as zoomable SVG. Claude opens it in the browser pane; the user judges overlap, clipping and scale; fix and regenerate until the user signs off (success criterion 3).
- **D-11:** **Spike scope: this PC, Playwright Chromium** (with the profiles of D-14). Frame time and memory per render tier against n, the all-chords density limit and the canvas area limits are measured for real and stored as data; other browsers or devices are added later as extra rows in the same table. The table is the exit gate for Phases 4, 5 and 6; conservative research placeholders ship in it until measurements replace them.
- **D-12:** **WebGL contingency: decided from the measurements.** The table records an explicit yes or no; no WebGL work is planned before that.
- **D-13:** **A `tier=` URL diagnostic override exists** (`?tier=svg|canvas|headless` forces a tier regardless of the table); recorded as an explicit yes in the table.

### Hardware caveat (user note, 2026-09-27)
- **D-14:** **This PC is high-end (AMD Ryzen 9, 12 cores, 64 GB RAM)**, so native measurements overstate what typical or low-end machines can do; maxing out this machine would obliterate a lesser one. The spike therefore (a) records environment metadata in the table (CPU model and cores, RAM, OS, Chromium version, GPU/raster mode, date); (b) measures a native profile plus throttled profiles that emulate weaker devices (for example CDP CPU throttling at 4x and 6x and software rendering without GPU acceleration, with their known limits stated: throttling slows the main thread but not memory or the GPU); (c) reports memory as bytes per node or per zone so budgets can be applied to lower-RAM devices; and (d) has the app's shipped tier boundaries adopt the CONSERVATIVE profile so a lesser machine can meet them, while the native rows stay visible in the table. The user still wants to see the full table, including the native numbers. Automated tests never depend on this PC's speed (the table is measured data; tests validate its schema and invariants only).

### Locked earlier (carried forward, not re-discussed)
- Layout output is deterministic: the same base always gives identical coordinates (no `Math.random`, no `Date`, fixed sort tie-breaks); everything is O(n) or O(n + k^2) with k the cycle count; layouts are structure-of-arrays typed arrays (`Float64Array` x and y by zone), never `Record<number, Pos>` at scale.
- The engine (Phase 2) provides the structure: `createNumogram(base)`, `Cycle[]` in canonical order, own-base numerals; layout code lives in `engine/layout/` and obeys the engine purity rules (no DOM or Node types, relative imports only, nothing imported from outside `engine/`). Base-10 presets and lore stay under `app/presets/base10/`.
- The frozen oracles never change: the 60 DOM goldens, `e2e/__behaviour__` and the numeric oracle stay green; never regenerated to make a test pass. The dev harness and the spike must not change the base-10 viewer's output.
- Degenerate bases 2, 4 and 6 must lay out correctly (Pitfall 10); the ceiling is measured, not capped; no O(n^2) structure is ever materialized.
- MIG-02 (removing hard-coded 10-zone logic from components) is Phase 4; the five `app/data/*.ts` seams and the `app/lib/constants.ts` seam remain until then.

### Claude's Discretion
The exact packing algorithm and tie-breaks, ring rotation and start angles, the size cap for the growing space, the routing style of gates and currents (including Y-junctions, and edge bundling for gates at n >= 100), layout ids and file organisation inside `engine/layout/`, how the frame height and bounds are derived, the tier-table schema and its file location, the measurement harness (Playwright-driven, real routes), the scene-to-SVG emitter API, the review-sheet script's structure and where its output goes (a gitignored path), interim LOD thresholds until measured, and the plan/wave breakdown (the ROADMAP says layout plans come first and spike plans come last because the harness needs real routes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (section "Phase 3: Procedural Layout and Ceiling Spike") - goal, five success criteria, research flag and notes
- `.planning/REQUIREMENTS.md` - LAY-01..LAY-04 and REN-01 (this phase); REN-02/REN-03 are Phases 6, UI-* Phase 4
- `.planning/PROJECT.md` - core value, verified math, key decisions
- `CLAUDE.md` - project rules (engine purity, frozen oracle, no upstream branding)
- `.planning/phases/02-engine-core-and-base-10-migration/02-CONTEXT.md` and `02-VERIFICATION.md` - the engine API this phase builds on, the adapter/seam pattern, deferred items (positions.ts moves here)

### Design and pitfalls
- `.planning/research/ARCHITECTURE.md` - "Procedural Layout" (Layout and LayoutSpec interfaces, candidate algorithms L1 ring, L2 spiral, L3 ladder, base-10 presets, routing), "Rendering Tiers", "Demon layer strategy", "Web Worker offloading"
- `.planning/research/PITFALLS.md` - Pitfall 9 (labels, node size and layout capacity at large n), Pitfall 10 (degenerate bases 2, 4, 6), Pitfall 15 (determinism of layouts, PRNGs and sort orders)
- `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md`, `.planning/research/STACK.md` - feature priorities, pinned stack, build order

### Code and frozen oracles
- `app/data/positions.ts` - the authored layouts (original, labyrinth, ladder, planetary constants) to become presets
- `app/lib/geometry.ts`, `app/components/projection/Projection.tsx`, `app/NumogramClient.tsx`, `app/hooks/useTween.ts` - how coordinates, gate and current routing and layout switching work today (read-only reference here; not edited in this phase)
- `engine/core/*` (Phase 2 API: `createNumogram`, `Cycle`, `PairInfo`, numerals) and `engine/index.ts`
- `e2e/__golden__/**` and its manifest (60 DOM comparisons), `e2e/__behaviour__/**` and its manifest, `engine/test/fixtures/base10.golden.json` (`layouts`, `center` fields) - frozen, never regenerated
- `tests/oracle/deriveBase10.ts` - how the frozen numeric oracle reads positions today

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/core` (Phase 2): typed-array numogram with pair, cycle and zone accessors, canonical Torque order, own-base numerals; the layout modules consume it directly.
- `tests/bruteforce/numogramReference.ts`: an independent structure reference usable to check that layouts respect pairs and cycles.
- `app/data/positions.ts`: the four authored layouts as literal coordinate tables (`P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`, planetary radii, angles and sizes, and the per-layout `CENTER`), frame heights 940/880/870/800.
- Playwright Chromium (1.63.0), `serve`, the page-weight tooling and the Phase 1/2 guard scripts are in place for the spike harness and the review sheet.
- `app/lib/geometry.ts` (52 lines): generic gate and current curve geometry that works for any coordinates.

### Established Patterns
- Thin pass-through seams over adapters (Phase 2) keep the viewer's render path and the DOM goldens unchanged.
- Frozen sets have their own sha256 manifests and never-regenerate rules; new frozen data gets a new manifest set.
- Engine files: relative imports only, no DOM or Node types, deterministic, tests with fixed seeds under both timezones; `npm run verify` is the single gate (about 4.5 minutes) and CI runs it on ubuntu-latest and windows-latest (npm 10 lockfile rule).

### Integration Points
- New `engine/layout/` (and later `engine/scene/`) modules export through `engine/index.ts`; `app/presets/base10/layouts.ts` implements the preset `LayoutSpec`s over the same coordinates `app/data/positions.ts` holds today.
- The base-10 viewer keeps importing positions through the `app/data/positions.ts` seam; nothing in the viewer's render path may change in this phase.
- The review-sheet script and the spike harness run outside the app (tsx and Playwright) and write to gitignored output paths; only the threshold table and its schema are committed.

</code_context>

<specifics>
## Specific Ideas

- Base 28 is the reference picture for the ring layout: two rings (9 and 3 pairs) plus the Plex and Warp capsules; base 82 adds a third ring (27, 9, 3); base 64 (six or more cycles) and 100 are the stress cases for packing.
- "Barker spiral" wording comes from the lore already in the app (`4::5` is the innermost curve, `0::9` the outermost).
- The layout interface should make the animated switch trivial: two layouts of the same base are two equal-length coordinate arrays.

</specifics>

<deferred>
## Deferred Ideas

- Antipodal-chord ("diameters") layout and force-directed relaxation: not in v1.
- Safari, Firefox and phone measurements: extra rows in the threshold table later.
- A WebGL tier: only if the measurements say Canvas cannot reach the target sizes (D-12).
- The base picker, label scheme UI beyond base 36, and making components read the layout objects: Phase 4 (MIG-02).
- The Canvas tier, viewport culling and the worker: Phase 6. Promotion of the review harness to real export and CLI: Phase 8 (EXP-01, EXP-04).

### Reviewed Todos (not folded)
None matched Phase 3. Pending todos 002 and 004 (deferred review findings) and 003 (dropped row clicks and mobile overlap) belong to hardening and Phase 4.

</deferred>

---

*Phase: 03-procedural-layout-and-ceiling-spike*
*Context gathered: 2026-09-27*
