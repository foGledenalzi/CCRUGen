# Phase 3: Procedural Layout and Ceiling Spike - Research

**Researched:** 2026-09-26/27
**Domain:** pure-TypeScript procedural graph layout (rings, packing, ladder, spiral, pair graph), SVG string emission, and a measured renderer ceiling (Playwright Chromium on Windows, including emulated weaker devices)
**Confidence:** HIGH for layout geometry, invariants and costs (prototyped and verified against the Phase 2 engine for every even base 2..400 plus 666, 1024, 4096, 65536, 2^20); HIGH for the measurement method (run on this PC, cross-checked with four device profiles); MEDIUM for the placeholder threshold numbers (one PC, Chromium only, weaker machines are CPU-throttle *emulations* of this CPU, not real hardware); LOW for anything about other browsers, GPUs or real low-end devices (not measured).

Everything below was prototyped in a scratch directory outside the repo (`layout`, `routes`, `emit`, `sheet`, and a Playwright spike harness, importing `engine/index.ts` by absolute path). Nothing in the repo was modified except this file; all spike browser processes were closed at the end of each run (verified: 0 `chrome.exe` processes remained). Claim tags: `[VERIFIED: ...]` = measured or checked in this session, `[CITED: url]` = official documentation, `[ASSUMED]` = my judgement, needs confirmation (collected in the Assumptions Log).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual conventions (user taste, called out by the roadmap)**
- **D-01:** **Time flows anticlockwise** around every generated Torque ring, matching the lore already shown in the viewer (the Time Circuit is anticlockwise: Surge rushing outward, Sink dragging inward). The current of a pair lands on the next pair's odd zone in flow order.
- **D-02:** **Plex and Warp capsules sit at the bottom, outside the Torque rings**: Plex capsule at the bottom centre with the Warp capsule beside or above it, like the authored `original` layout (Plex 0/9 low, Warp 3/6 high). The centre stays free for the Torque rings so nested rings never collide with a capsule. (Bases without a Warp draw the Plex capsule alone.)

**Layout family**
- **D-03:** **Default procedural layout `ring`**: every Torque cycle is a ring glyph (a 2L-gon whose zones alternate the odd and the even member of each pair, in flow order); up to 3 cycles nest concentrically (largest outermost; base 28 shows rings of 9 and 3 pairs, base 82 shows 27, 9 and 3); more cycles are packed as separate ring glyphs by a deterministic search (largest first, fixed sort tie-breaks, golden-angle spiral candidates). Syzygy pairs are adjacent by construction. Each ring is rotated so its smallest pair sits at the top (planner may refine).
- **D-04:** **Three selectable layouts exist for every base**: `ring` (default), a procedural `ladder` (two columns, low zone left and high zone right, one row per pair; it must reduce EXACTLY to the authored base-10 ladder), and the **Barker spiral** (all pairs on one spiral ordered by destination, innermost to outermost, echoing the lore). No antipodal-chord layout and no force-directed layout in v1.
- **D-05:** **Base 10 keeps its four authored layouts** (original, labyrinth, ladder, planetary) as `LayoutSpec` presets in `app/presets/base10/layouts.ts` that reproduce today's coordinates, draw order, centres and frame heights exactly (a test proves it against the frozen Phase 2 goldens and `app/data/positions.ts` values); every other base falls back to the procedural default. `app/data/positions.ts` becomes a thin pass-through seam over the presets (same seam pattern as Phase 2 D-01), so the base-10 viewer's render path is unchanged and the DOM goldens stay byte-identical. Planetary stays a base-10-only preset (not generalized).

**Scaling and labels**
- **D-06:** **The drawing space grows with n, up to a cap**, so node size, label size and stroke width stay in a readable range; zoom and pan handle the rest. Base 10's presets keep their exact 800-wide frames. The layout supplies node radius, label size and stroke scale; nothing may overlap or clip on the review sheet bases (LAY-03).
- **D-07:** **Labels appear only when the node is large enough on screen** (a threshold kept in the tier table; the starting hypothesis is about a 7 px node radius) and otherwise on hover or selection. The layout supplies sizes; the renderer applies the threshold (renderers arrive in Phases 4 and 6).

**Pair-graph view and switching**
- **D-08:** **Syzygy-collapsed pair-graph view**: one node per pair labelled `hi::lo` (the net-span, in the numogram's own base), arrows for the currents around each Torque ring, and the Plex and Warp pairs drawn as self-looping nodes. Every Torque cycle must read as a clean ring, including base 64's six or more cycles (it reuses the ring packing).
- **D-09:** **Layout switching animates for generated bases too**, as a straight interpolation of two equal-length coordinate arrays, with a size cutoff above which the switch is instant so large bases never stutter; the cutoff comes from the spike. Base 10 keeps its existing animation.

**Review and the ceiling spike**
- **D-10:** **Sign-off by one self-contained HTML contact sheet** generated by a script: bases 2, 4, 6, 8, 12, 16, 28, 64, 82 and 100 (the roadmap set), each with the ring, ladder and spiral layouts and the pair-graph view, as zoomable SVG. Claude opens it in the browser pane; the user judges overlap, clipping and scale; fix and regenerate until the user signs off (success criterion 3).
- **D-11:** **Spike scope: this PC, Playwright Chromium.** Frame time and memory per render tier against n, the all-chords density limit and the canvas area limits are measured for real and stored as data; other browsers or devices are added later as extra rows in the same table. The table is the exit gate for Phases 4, 5 and 6; conservative research placeholders ship in it until measurements replace them.
- **D-12:** **WebGL contingency: decided from the measurements.** The table records an explicit yes or no; no WebGL work is planned before that.
- **D-13:** **A `tier=` URL diagnostic override exists** (`?tier=svg|canvas|headless` forces a tier regardless of the table); recorded as an explicit yes in the table.

**Locked earlier (carried forward, not re-discussed)**
- Layout output is deterministic: the same base always gives identical coordinates (no `Math.random`, no `Date`, fixed sort tie-breaks); everything is O(n) or O(n + k^2) with k the cycle count; layouts are structure-of-arrays typed arrays (`Float64Array` x and y by zone), never `Record<number, Pos>` at scale.
- The engine (Phase 2) provides the structure: `createNumogram(base)`, `Cycle[]` in canonical order, own-base numerals; layout code lives in `engine/layout/` and obeys the engine purity rules (no DOM or Node types, relative imports only, nothing imported from outside `engine/`). Base-10 presets and lore stay under `app/presets/base10/`.
- The frozen oracles never change: the 60 DOM goldens, `e2e/__behaviour__` and the numeric oracle stay green; never regenerated to make a test pass. The dev harness and the spike must not change the base-10 viewer's output.
- Degenerate bases 2, 4 and 6 must lay out correctly (Pitfall 10); the ceiling is measured, not capped; no O(n^2) structure is ever materialized.
- MIG-02 (removing hard-coded 10-zone logic from components) is Phase 4; the five `app/data/*.ts` seams and the `app/lib/constants.ts` seam remain until then.

### Claude's Discretion
The exact packing algorithm and tie-breaks, ring rotation and start angles, the size cap for the growing space, the routing style of gates and currents (including Y-junctions, and edge bundling for gates at n >= 100), layout ids and file organisation inside `engine/layout/`, how the frame height and bounds are derived, the tier-table schema and its file location, the measurement harness (Playwright-driven, real routes), the scene-to-SVG emitter API, the review-sheet script's structure and where its output goes (a gitignored path), interim LOD thresholds until measured, and the plan/wave breakdown (the ROADMAP says layout plans come first and spike plans come last because the harness needs real routes).

### Deferred Ideas (OUT OF SCOPE)
- Antipodal-chord ("diameters") layout and force-directed relaxation: not in v1.
- Safari, Firefox and phone measurements: extra rows in the threshold table later.
- A WebGL tier: only if the measurements say Canvas cannot reach the target sizes (D-12).
- The base picker, label scheme UI beyond base 36, and making components read the layout objects: Phase 4 (MIG-02).
- The Canvas tier, viewport culling and the worker: Phase 6. Promotion of the review harness to real export and CLI: Phase 8 (EXP-01, EXP-04).

**Scope addition from the coordinator (mid-research, applies to question 7 only):** the user's PC is high end (AMD Ryzen 9 3900X, 12 cores/24 threads, 64 GB RAM), so native numbers overstate what a typical or low-end machine can do; the user still wants the full table. Consequences implemented below: environment metadata rows in the table schema, throttled and software-raster "profile" rows measured on this PC, a bytes-per-zone memory-budget rule, an explicit rule for which profile the shipped tier boundaries adopt (conservative), and tests that validate schema/invariants only, never a timing threshold.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAY-01 | Any even base gets a deterministic procedural layout in which syzygy pairs are adjacent and each Torque cycle is drawn as a legible ring | Ring layout formulas, nesting for k <= 3, shelf/spiral packing for k >= 4, capsules, frame and cap; verified adjacency, odd/even alternation, flow landing on the next odd zone, anticlockwise direction, determinism and no overlap or clipping for all even n in 2..400 (1000 layouts) and notable bases; ladder and Barker spiral formulas |
| LAY-02 | Base 10 keeps its four authored layouts (original, labyrinth, ladder, planetary) as presets | Preset LayoutSpec contents, seam design for `app/data/positions.ts`, and an equality proof against the frozen numeric oracle plus the frozen DOM goldens (which encode positions, draw order, region labels and frame heights) |
| LAY-03 | Node size, fonts, strokes and loop sizes scale with n so the diagram stays legible across the supported range | Size functions (node radius, label size, stroke scale, loop reach, junction offset), frame growth and the 4096 cap with measured frame/scale table, on-screen radius table, label-threshold analysis |
| LAY-04 | A syzygy-collapsed pair-graph view is available in which every Torque cycle is a clean ring | Pair-graph layout reusing the ring family (pills labelled hi::lo, anticlockwise arcs, self-loop Plex and Warp), verified for all even n <= 400 including base 64 (six rings) |
| REN-01 | A ceiling spike measures frame time and memory per render tier against n and yields a threshold table stored as data, not hard-coded | Measurement method validated on this machine across four device profiles (native GPU, software raster, 4x and 6x CPU throttle), measured rows, the all-chords density limit, canvas limits, headless cost, table schema, validator, and an interim table with an explicit, documented profile-selection rule |
</phase_requirements>

## Summary

Every even base can be given a deterministic, overlap-free, legible layout with O(n) work and tiny constants: a ring layout over the Phase 2 engine takes 0.06-0.5 ms for the review bases, 5.6 ms at n = 4096, 27 ms at n = 65,536 and 136-190 ms at n = 2^20 depending on the packer. The structure the engine already provides does most of the work: a Torque cycle is a walk `odd(P0), even(P0), odd(P1), ...` whose adjacent elements are alternately syzygy partners and current hops, so a regular 2L-gon (radius `R = s / (2 sin(pi/2L))`, `s = 4r = 84`) draws every syzygy adjacent, every current landing on the next pair's odd zone, and anticlockwise flow with node 0 and 1 straddling the top. All of this was verified against the engine (not asserted): 0 violations in 1000 layouts over all even n <= 400 plus notable large bases. Up to 3 cycles nest concentrically; from 4 cycles on, the ring glyphs are packed. Measured against the golden-angle Fermat-spiral search that D-03 names, a **row (shelf) packer with a fixed width search** is tighter (fill 0.52-0.68 vs 0.34-0.44), roughly 20-100x cheaper at 26,270 cycles (4 ms vs 73-190 ms), needs no trigonometry in its decisions (bit-exact across engines), and reads as a tidy grid of rings; both are overlap-free. D-03's wording (spiral) is honoured by keeping it as a selectable packer, and the choice is put in front of the user on the contact sheet (base 64 and 100 show both).

The procedural ladder reduces **exactly** to the authored base-10 ladder (0 differences against the frozen JSON, frame 800 x 870, centre (400, 450)) both with explicit preset parameters and with its own defaults, and the Barker spiral (Archimedean, arc-length stepping, pairs ordered by destination) keeps a constant 2 x node-diameter spacing and grows as sqrt(n). The pair-graph view is the same ring machinery with one pill node per pair (`hi::lo`) and anticlockwise circular arcs, and is clean for all even n <= 400. The base-10 presets can be proved equal to today's viewer without touching the viewer: the frozen numeric oracle covers coordinates, centres and planetary constants, and the frozen DOM goldens themselves encode the draw order, the exact coordinates (label x, y - 1), the region labels and the frame heights, so a small parser gives an independent oracle for everything the preset must reproduce. One real risk was found: the layout/routing/emitter code is about 19.8 KB minified (7.8 KB gzip) and the page-weight budget has only about 11 KB raw / 3.6 KB gzip of headroom, so the viewer's preset module must import engine layout **types only**.

The ceiling spike method works on this machine and gave real, cross-checked numbers across four device profiles (native GPU rendering, native software rendering, and CPU-throttled 4x/6x emulations of mid-/low-tier hardware; see "Ceiling spike" below for the full tables). Headline findings: (1) an SVG-rich tier matching today's Projection feature density (filters, hit-target overlays, per-element handlers, gate/current labels) is bounded by **interaction latency**, not initial mount — panning/zooming an un-cached SVG costs tens to hundreds of ms per frame once n exceeds about 100-150, because CSS-transform scale forces a full repaint of vector content proportional to element count (a genuine, measured finding, not literature); (2) a leaner SVG tier (fewer elements per zone, no filters/hit overlays) survives roughly 10x further; (3) a Canvas tier with a **cached static bitmap** decouples pan/zoom cost from n almost entirely (constant 0.1-22 ms per frame across every measured n up to 4000, dominated by fixed per-frame overhead, not by n) — this is the clearest architectural validation in the whole spike; (4) a naive per-frame linear-scan "culling" check is not free and does not pay for itself below about n = 1000 (the visibility test itself costs as much as just drawing everything); (5) all-chords density stops being legible (a majority of ink comes from pixels crossed by 4+ overlapping chords) between n = 60 and n = 100, long before it stops being renderable (n = 1000 chords cost 184 ms/frame, still sub-200ms); (6) this Chromium's real canvas limit is an **area** cap of exactly 268,435,456 px (2^28: 16384x16384 and 32767x8192 both work, 16385x16384 and 32767x8193 both fail) — the commonly-cited standalone "32,767 px per dimension" limit was **not** reproduced here (32768x1 and 65535x1 both succeeded); (7) `performance.measureUserAgentSpecificMemory()` works once the page is served cross-origin-isolated and gives a clean, linear **~6.0 KB DOM + ~3.15 KB JS heap per zone** for the rich SVG tier, versus an essentially flat ~3.2 MB (the canvas backing store) for the Canvas tier at any n — memory is not the bottleneck for either tier at any n tested; frame time is.

**Primary recommendation:** Build `engine/layout/` as pure typed-array modules (ring family, shelf and spiral packers, ladder, spiral, pair graph, pure numeric-id routing) with the formulas in this file, prove the base-10 presets against the frozen oracle plus a DOM-golden parser without editing the viewer, review the result on the generated HTML contact sheet (bases 2..100, both packers for 64 and 100), and ship the threshold table as typed data with a validator whose tests check schema and invariants only (never a wall-clock threshold); measured rows come from a dev-only Playwright spike run in four profiles (`gpu`, `sw`, `sw-4x`, `sw-6x`); the **shipped tier boundaries are read from the `sw-6x` (low-tier-emulation) row** so that weaker real machines have headroom, while `gpu`/`sw` native rows stay in the table for visibility and future comparison.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ring, ladder, spiral, pair-graph coordinates, frame, size functions | `engine/layout` (pure) | tests under `engine/test` | Must run in the CLI, worker and tests; deterministic; typed arrays |
| Gate, current and pair-graph path geometry (routing) | `engine/layout` (`routing.ts`) | consumed by `engine/scene` emitter and later by the Canvas painter | Keyed by numeric ids; replaces name checks and the impure orientation ref in `NumogramClient.tsx` |
| Scene to SVG string emitter | `engine/scene` (pure) | `scripts/review-sheet.ts` wraps it in HTML; Phase 8 promotes it to export | Same string builder serves review, export, CLI and the headless tier |
| Base-10 authored layouts (coordinates, draw order, centres, heights, region labels) | `app/presets/base10/layouts.ts` | `app/data/positions.ts` as a pass-through seam | Art, not math; the viewer keeps importing positions through the seam |
| Tier table (data), `selectTier`, validator | `engine/scene/tiers.ts` (pure data plus tiny pure functions) | Phases 4-6 read it | Data, not constants in components (REN-01) |
| Measurement harness (Playwright, real routes, four device profiles) | `scripts/spike/*` (dev only, outside `engine/`) | writes gitignored raw output; only the table is committed | Needs a browser and CDP; must never run in `npm run verify` |
| Contact-sheet generator | `scripts/review-sheet.ts` (dev only) | output in gitignored `.review/` | Human sign-off artifact |
| Label level-of-detail threshold, on-screen node size | Renderer (Phases 4 and 6) | value lives in the tier table | D-07: layout supplies sizes, renderer applies the threshold |

## Standard Stack

### Core (no new dependency is needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 (pinned) | engine layout, routing, emitter, table | Already the engine language; `noUncheckedIndexedAccess` is on, so typed-array reads need `?? 0` or `!` discipline |
| Vitest | 5.0.2 (pinned), projects `engine` and `oracle` | unit, invariant and sweep tests | Existing; tests under `engine/test` for pure layout, `tests/presets` for anything importing `app/` |
| @playwright/test / playwright-core | 1.63.0 (pinned), Chromium 153.0.8010.12 | spike driver, contact-sheet screenshot QA, optional harness smoke | Chromium 153 is installed (`chromium-1243` and `chromium_headless_shell-1243`) `[VERIFIED: node_modules/playwright-core/package.json, browsers.json]` |
| tsx | 4.23.15 (pinned) | run `scripts/review-sheet.ts` and `scripts/spike/*.ts` | Existing precedent (`scripts/capture-base10-oracle.ts`); respects extensionless relative imports |
| React / react-dom | 18.3.1 (existing dependency, UMD builds present) | the spike's "SVG rich"/"SVG lean" harnesses render through real React 18 to measure reconcile cost | `node_modules/react/umd/react.production.min.js`, `node_modules/react-dom/umd/react-dom.production.min.js` exist `[VERIFIED: local files]`; no bundler or new package needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto, node:zlib, node:fs | Node 22 | digests and sizes inside tests and scripts only (never under `engine/` non-test code) | Determinism digests, gzip size of the contact sheet |
| fast-check | 4.10.2 (pinned) | optional property tests over random even bases with a fixed seed | Same pattern as Phase 2 (fixed seeds and run counts written in the test) |
| esbuild | 0.28.2 (transitive, via tsx `~0.28.0`) | bundling the spike's browser-side test harness JS only, in the dev script, never in the app build | Already resolved by npm; do not add a direct dependency on it — reference it only from `scripts/spike/` tooling comments, or bundle by hand with a small IIFE if avoiding even the transitive reference matters |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shelf packer as default | Golden-angle Fermat spiral first-fit (D-03 wording) | Valid and overlap-free, but fill 0.34-0.44 vs 0.52-0.68, 20-100x slower at 26k cycles, and it depends on trig in discrete decisions; keep as a selectable packer and show both to the user |
| Hand-rolled emitter | d3, cytoscape, dagre, elkjs | Adds runtime weight, is not deterministic across versions/engines, and none knows the odd/even ring structure; the layout here is O(n) closed form |
| CDP CPU throttle emulation of weak devices | Real low-end hardware in CI | Not available in this environment; CDP throttling is the standard DevTools technique `[CITED: https://developer.chrome.com/docs/devtools/settings/throttling]` but is explicitly a multiple of *this* machine, not a real device — see Assumptions Log |
| Force-directed or antipodal-chord layouts | (deferred by the user) | Out of scope for v1 |

**Installation:** none. `npm install` is unchanged (no lockfile edit). **Version verification:** no package was added; installed versions were read from `package.json` and `node_modules/*/package.json` (React 18.3.1, Playwright/playwright-core 1.63.0, Chromium 153.0.8010.12, tsx 4.23.15, Vitest 5.0.2, esbuild 0.28.2 transitive) `[VERIFIED: local files, 2026-09-27]`.

## Architecture Patterns

### System Architecture Diagram

```
                     createNumogram(base)  (Phase 2, cached, typed arrays)
                              |
        +---------------------+------------------------+
        |                                              |
   Cycle[] (torques, plex, warp)                 pair / current / gate accessors
        |                                              |
        v                                              v
+-------------------+   glyph radii    +---------------------------+
| engine/layout     |----------------->| composeTorques            |
| ring family       |                  |  k <= 3: nest concentric  |
| (units 2 = ring,  |<-----------------|  k >= 4: pack glyphs      |--> shelf | spiral packer
|  units 1 = pair   |   glyph centres  +---------------------------+
|  graph)           |                                              
+---------+---------+   capsules (Plex bottom centre, Warp left)    
          |             frame = bbox + margin, min 800x600, cap 4096 (uniform scale k)
          v
   Layout { x, y (Float64Array by zone), width, height, center, nodeRadius,
            labelSize, strokeScale, scale, groups, zoneGroup, drawOrder?, routing }
          |                       ^ ladder / spiral layouts (same Layout type)
          |                       | presets: app/presets/base10/layouts.ts (same interface)
          v
+---------------------------+      +-----------------------------+
| routing.ts (pure, ids)    |----->| engine/scene svgString.ts    |--> string --> scripts/review-sheet.ts --> .review/*.html (gitignored)
| gates: concave / loop     |      | (lean | rich detail)         |--> later: export, CLI, headless tier
| currents: Y / fixed pair  |      +-----------------------------+
| pair graph: arcs, loops   |
+---------------------------+
          |
          v   (Phase 6, not built here)            +-------------------------------------+
   renderers read tier table  <-------------------| engine/scene/tiers.ts (data + validator) <-- scripts/spike (Playwright, 4 profiles)
```

### Recommended Project Structure

```
engine/
  layout/
    types.ts        Layout, LayoutGroup, LayoutSpec, LayoutParams, LayoutId
    params.ts       DEFAULT_LAYOUT_PARAMS (data): r, s, glyphGap, nestDelta, margin, minW, minH, cap, packer, ...
    format.ts       fmt(v) -> 2-decimal shortest string, never "-0"
    ring.ts         chordRadius, quantize helpers, ringNodes, composeTorques, ringLayout, pairGraphLayout
    pack.ts         packShelf, packSpiral (both pure, both return centres by glyph index)
    ladder.ts       ladderDefaults, ladderLayout
    spiral.ts       spiralDefaults, spiralLayout
    routing.ts      routeGates, routeCurrents, routePairGraph (+ optional routeGatesBundled)
    registry.ts     LAYOUT_IDS, resolveLayout(id, g, presets?)
    index.ts
  scene/
    svgString.ts    layoutToSvg, pairGraphToSvg (+ escape, embed option)
    tiers.ts        TIER_TABLE (typed data), selectTier, validateTierTable
    index.ts
  test/             layout.*.test.ts, tiers.test.ts, svgString.test.ts
app/presets/base10/layouts.ts      four authored LayoutSpecs (imports engine layout TYPES only)
app/data/positions.ts              thin seam: same exports (P_ORIGINAL ... CENTER), built once from the presets
scripts/review-sheet.ts            writes .review/layout-review.html
scripts/spike/                     driver + page harness + scene builder (dev only)
tests/presets/base10-layouts.test.ts   preset equality vs frozen JSON and DOM goldens
```

`.gitignore` gains `/.review/` and `/.spike/` (raw spike output). Export layout modules from `engine/index.ts` as the CONTEXT says, but see Pitfall 1 (bundle weight) before the viewer imports anything.

### Pattern 1: Ring glyph and the ring family (verified)

**What:** A Torque cycle with L pairs has `m = 2L` zones in the order of `cycle.zones()`: odd member then even member of each pair in flow order. Place node `j` at `phi_j = pi/2 + (j - 1/2) * 2pi/m`, `(x, y) = (cx + R cos phi, cy - R sin phi)` (SVG y points down, so increasing phi is **anticlockwise on screen**, D-01). Nodes 0 and 1 (the smallest pair, since every cycle is rotated to its smallest pair) straddle the top. `R(m) = ceilQ(s / (2 sin(pi/m)))` with `Q = 1/8` and `ceilQ(v) = ceil(v*8 - 1e-9)/8`, so every neighbouring pair of nodes is exactly `s` apart, syzygy partners are neighbours, and `zones[2j+1] -> zones[2j+2]` is the current of pair j (`g.current(pair).to` equals the next walk element). The pair graph is the same function with `m = L` (one node per pair, phase 0 so node 0 is at the top) and a bigger `s`.
**When to use:** every Torque cycle of every base (Torque cycles always have L >= 2, so m >= 4).
**Verified:** for every Torque cycle of every even base 2..400 (both packers) and for 666, 1024, 4096: nodes lie on the ring, consecutive distance = chord, parity alternation (`even index -> odd zone`), `partner(z_2j) = z_2j+1`, `current(pair(z_2j+1)).to = z_2j+2`, angle step `+2pi/m`. `[VERIFIED: sweep script, 0 violations across 1000 ring layouts + notable bases]`.

```typescript
// Source: verified prototype (scratch/lay.ts); pure, no DOM
const Q = 8
const ceilQ = (v: number) => Math.ceil(v * Q - 1e-9) / Q   // the 1e-9 slack absorbs last-ulp differences of Math.sin: at m = 6 Math.sin(pi/6) is 0.49999999999999994 and R must be exactly 84 in every engine
export const chordRadius = (m: number, s: number) => s / (2 * Math.sin(Math.PI / m))
export function ringNodes(m: number, R: number, cx: number, cy: number, phase0: number,
                          xs: Float64Array, ys: Float64Array, zoneAt: (j: number) => number): void {
  for (let j = 0; j < m; j++) {
    const phi = Math.PI / 2 + (j - phase0) * (2 * Math.PI / m)   // phase0 = 0.5 (ring: pair centred at the top), 0 (pair graph)
    const z = zoneAt(j)
    xs[z] = cx + R * Math.cos(phi)
    ys[z] = cy - R * Math.sin(phi)
  }
}
```

### Pattern 2: Composition: nest up to 3 Torque cycles, pack from 4, capsules at the bottom

**Nesting (k = 1, 2, 3; D-03):** cycles are already in canonical order (length descending, then smallest zone), so `T0` is outermost. Radii from the innermost outward: `R_inner = chordR(m_inner)`; the outermost keeps its own chord radius; a middle ring is interpolated linearly between them, then clamped: `R_j = max(chordR(m_j), interpolated, R_{j+1} + 1.5 s)`. This "even" spread gave the clearest pictures (base 28: 18-gon at R = 242 around a hexagon at R = 84; base 82: 54-gon at R = 722, 18-gon, hexagon). A "compact" alternative (`R_j = max(chordR, R_{j+1} + 1.5 s)`) leaves a tiny core inside a big empty ring for base 82 and was rejected on the contact-sheet look `[VERIFIED: rendered and viewed]`.
**Packing (k >= 4):** glyph bounding radius `Rb = ceilQ(R + r)`; glyphs are sorted by `(Rb descending, canonical cycle id ascending)`, which is already the canonical order, so **no sort is needed and ties are broken by cycle id by construction**. Two packers, both overlap-free (`min(dist - Rb_i - Rb_j) >= glyphGap` for every measured base):

| Packer | Rule | Determinism | Measured |
|--------|------|-------------|----------|
| `shelf` (recommended default) | row packing, largest first, rows centred; row width `W = max(2 Rb_0 + gap, ceil(sqrt(area) * f))` for f in [0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0, 2.3, 2.7] and the candidate with the smallest `max(width, height)` wins | integer/dyadic arithmetic only (all radii are multiples of 1/8), no trig, so bit-exact on every engine | fill 0.52-0.68, aspect 0.9-1.4, 0.02 ms at 54 cycles, 0.27 ms at 178, 0.5 ms at 2066, 4 ms at 26,270 |
| `spiral` (D-03 wording) | first fit along a Fermat spiral: candidate `t` at `rho = 0.5 Rb_i sqrt(t)`, `theta = t * pi (3 - sqrt 5)`, coordinates rounded to 1/8 before the overlap test, uniform grid (cell `2 Rb_0 + gap`, 3x3 neighbourhood), resume `t` per run of equal radii | discrete decisions on values derived from `Math.cos/sin`, rounded to 1/8 first (flip probability far below 1e-9 per candidate, not exactly zero) | fill 0.34-0.44, aspect ~1.0, 0.64 ms at 54 cycles, 1.2 ms at 178, 6 ms at 2066, 73-190 ms at 26,270 |

**Where it stops being legible:** every ring glyph is a legible ring at any n (nodes keep `r`, spacing `s`, and no two glyphs are closer than `glyphGap`). What fails is the *screen* size: frames grow to the 4096 cap near n = 150-200 for bases with one long cycle (n = 200: one cycle of 99 pairs, R = 2646) and near n = 500-700 for many-cycle bases, after which everything scales by `k = 4096 / max(w, h)`. Ring identity stays visible at fit while `r_screen >= 3 px` (about n <= 1000 on a 1000 px panel) and labels at fit while `r_screen >= 7 px` (about n <= 100 on a 900 px panel; see the sizing table under Pattern 5-adjacent "on-screen size" below).
**Capsules (D-02):** below the composition: `capY = maxY + capsuleGap + r`; Plex centred at the composition's x centre; Warp to its left at `x_plex - (s + 2 r + capsuleGap)`; each capsule is two nodes at `x +- s/2` with the **odd member on the left** (flow at the bottom of an anticlockwise ring runs left to right); labels `PLEX`/`WARP` below. Bases without Torque (2, 4) show only capsules; base 2 shows Plex alone. "Beside" was implemented; "above" is a one-parameter alternative (`capsulePlacement`) to put in front of the user on the sheet.
**Frame (D-06):** `bbox` of all node discs, plus `margin` 70, centred in a minimum 800 x 600 frame (small bases keep the base-10 look), and if `max(w, h) > cap` then everything (coordinates, `nodeRadius`, `labelSize`) is multiplied by `k = cap / max(w, h)`. `cap = 4096` is a datum (see Assumptions), not a constant in code.

**On-screen node size table** (frame width divided into an 580 px and 900 px panel, matching today's viewer width and a wider one):

| n | frame | scale k | r (world) | r @ 580px panel | font @ 580px | r @ 900px panel | labels visible @580 (>=7px)? | stroke scale |
|---|-------|---------|-----------|-------|-------|-------|-------|-------|
| 2..28 | 800x(600..788) | 1.00 | 21.0 | 15.2 | 12.2 | 23.6 | yes | 1.00 |
| 64 | 946x1372 | 1.00 | 21.0 | 12.9 | 10.3 | 20.0 | yes | 1.18 |
| 82 | 1627x1752 | 1.00 | 21.0 | 7.5 | 6.0 | 11.6 | yes | 2.03 |
| 100 | 1916x1508 | 1.00 | 21.0 | 6.4 | 5.1 | 9.9 | no | 2.39 |
| 666 | 3662x4096 | 0.59 | 12.4 | 2.0 | 1.6 | 3.0 | no | 4.58 |
| 1024 | 3682x4096 | 0.79 | 16.5 | 2.6 | 2.1 | 4.0 | no | 4.60 |
| 4096 | 4096x3733 | 0.38 | 7.9 | 1.1 | 0.9 | 1.7 | no | 5.12 |

`[VERIFIED: sizing script over shelf-packed ring layouts]`. Base 100 is the first review-sheet base where labels should hide by default on a 580 px panel — a real, measured data point for the D-07 threshold discussion (the hypothesis of "~7px" is validated as the crossover point, not just assumed).

### Pattern 3: Procedural ladder that reduces exactly (verified)

Row of pair `p` is `P - 1 - p` (`P = n/2`; the highest pair is on top, pair 0 = Plex at the bottom), `x = xL` for the low zone (pair id), `x = xR` for the high zone, `y = top + row * rowGap`. Parameters: `{ xL: 260, xR: 540, top: 100, rowGap, bottom: 70, W: 800 }`; frame `H = top + (P-1) * rowGap + bottom`; centre `(W/2, top + (P-1) * rowGap / 2)`. **Default `rowGap = clamp(round(1400 / P), 84, 175)`** gives 175 at base 10, so the default parameters themselves reproduce `P_LADDER`: 0 differences against `engine/test/fixtures/base10.golden.json` `layouts.ladder`, frame 800 x 870, centre (400, 450) `[VERIFIED]`. Other bases: 28 -> rowGap 100, frame 800 x 1470; 100 -> 84, frame scaled by the cap to k = 0.956; 200 -> k = 0.483; 1024 -> k = 0.095. Ladder readability ends near n = 100-200 (a tall strip); it is a secondary layout.

### Pattern 4: Barker spiral (verified)

Order pairs from the highest pair id (destination `d = n - 1 - 2 lo` smallest, "`4::5` innermost" in base 10) to pair 0 (outermost). Walk one Archimedean spiral `rho(theta) = rho0 + b theta`, `b = turn / 2pi`, stepping `theta += step / sqrt(rho^2 + b^2)` with `step = sIn` from a pair's odd to its even member and `sOut` from its even member to the next pair's odd. Defaults `rho0 = 1.2 s`, `turn = 1.7 s`, `sIn = s`, `sOut = 1.5 s`; anticlockwise (`y = -rho sin theta`). Measured: minimum centre distance = 2.00 node diameters for every n (constant by construction); extent grows as sqrt(n) (n = 100: 1455x1437, n = 500: 3168x3097, first capped near n = 1000 with k = 0.92, n = 16,384: k = 0.23); 0.1-4 ms up to n = 16,384. Currents cross freely (the spiral does not show cycles), so colour by cycle; it is the best layout beyond n ~ 500, where rings have shrunk past legibility.

### Pattern 5: Pair-graph view (verified)

One pill per pair labelled `formatNetSpan(hi, lo, base)`; node size from the longest label: `f = 0.72 r`, `H = 1.6 r`, `W = max(H, chars * 0.6 f + 0.9 f)`, bounding radius `halfDiag = hypot(W, H)/2`, ring spacing `s_p = 2 halfDiag + 0.8 H`. Torque rings by the same `composeTorques` (nest up to 3, pack from 4) with `L` nodes each and phase 0; each current is a circular arc along the ring from node `j` to `j+1`, SVG `A R R 0 0 0` (sweep 0 = anticlockwise on screen), shortened by `0.9 halfDiag / R` at both ends; L = 2 rings work with the same formula because the two arcs are the two half circles. Plex and Warp are single pills at the bottom (Plex centre, Warp to its left) with a self-loop arc below. **For the animated switch** (D-09) also expose `x, y` by zone with both members of a pair on the pair's node, so ring -> pair graph is an equal-length interpolation in which partners merge; the by-pair arrays are `px, py`. Verified for all even n <= 400: nodes on the ring, equal chords, anticlockwise, flow = `nextPair`; base 64 shows six clean rings; base 28 two rings (9 and 3) plus two loops.

### Pattern 6: Routing generalisation (pure, numeric ids)

Replace `gateRenderData`/`currentRenderData` (NumogramClient) for **procedural** layouts by pure functions of `(g, layout)`; do not touch the viewer's own memos.
- **Gate of zone z** (`to = g.gate(z).to`, all n gates including Gt-00, the Phase 2 decision "the renderer decides once": draw it, as the base-10 viewer does): if `to === z` a self loop, else a concave quadratic curve from `from` to `to`, both shortened by `r` along the chord (unless the nodes nearly touch), control point `mid + perp * (-towardCentre * dist * 0.18 + lane * 10 k)` where `towardCentre` is the sign of `perp . (layoutCentre - mid)` (bend away from the centre) and `lane = index - (count - 1)/2` among gates with the same destination sorted by origin (counting sort, O(n)). Label anchor = the curve midpoint `(start + 2 ctrl + end)/4`.
- **Self loop (gate or fixed pair):** a quadratic arc on the boundary from angle `a - 60deg` to `a + 60deg`, control point at `3.1 r` along `a`, where `a` is the **radial direction from the ring's own centre** (down for capsules and pair nodes). This replaces the 72-angle clearance argmax of `selfChannelArc`, whose discrete choice on `cos/sin` values is exactly what Pitfall 15 warns about, and costs O(1) instead of O(72 x segments).
- **Current of pair q** (`A = odd`, `B = even`, `D = g.current(q).to`): if `D` is a member of the pair (Plex and Warp, detected by id, not by name) draw the fixed-pair triangle (equilateral centroid on the ring-inward side, legs curved away from the ring centre, destination leg and stem bulging opposite ways); otherwise a **Y**: junction `J = M + 0.35 (D - M) + perp * side * 0.52 r` with `M = (A + B)/2` and `side` = the inward sign about the pair's own ring centre; legs `A -> J`, `B -> J` as `curveAway(..., 0.12)`; stem `J -> D` straight and ending on `D`'s boundary. On a ring this gives a compact Y just inside the polygon next to the even member, and the stem lands on the next pair's odd zone `[VERIFIED: rendered for bases 6, 10, 28, 64, 82, 100]`.
- **Orientation purity:** the viewer's `resolveCurrentOrientation` caches the first sign per (layout, name) in a ref written inside `useMemo`. The pure router takes an optional `orientation: Int8Array` (per pair and per gate) so a tween can reuse the destination layout's orientation; by default it is the geometric sign.
- **Convention difference to keep in mind:** the engine says the Plex current lands on `n - 1` (its odd member) while the base-10 viewer draws it to the lower zone (0) (`legacyCurrentFrom` in `app/presets/base10/currents.ts`). Procedural routes follow the engine.
- **Cost (measured):** gates 0.03 ms (n = 10), 0.07 (100), 1.2 (1024), 4.8 (4096), 120 ms (65,536; 3.0 MB of path strings); currents 0.02-0.06 ms up to n = 100, 0.56 ms at 1024, 63 ms at 65,536. Not a bottleneck; the DOM is (see Ceiling spike).

**Gate density and bundling (numbers, ring layout, straight-chord approximation):**

| n | non-self gates | self loops | max in-degree | crossings (of sampled gates) | crossings per gate | mean gate length / frame diagonal |
|---|---|---|---|---|---|---|
| 10 | 7 | 3 | 2 | 2 | 0.29 | 0.17 |
| 28 | 25 | 3 | 5 | 42 | 1.7 | 0.22 |
| 64 | 59 | 5 | 6 | 177 | 3.0 | 0.25 |
| 82 | 79 | 3 | 9 | 568 | 7.2 | 0.30 |
| 100 | 95 | 5 | 6 | 699 | 7.4 | 0.30 |
| 256 | 247 | 9 | 8 | 5,433 | 22 | 0.31 |
| 1024 | 1015 | 9 | 8 | 108,952 (1200 sampled) | 107 | 0.34 |

Gate destinations are pseudo-random with respect to any layout, so crossings per gate grow linearly with n and gates average about a third of the frame diagonal at every n. The rings stay perfectly readable with the gate layer on at n = 82 and 100 because the green currents dominate, but the gate web itself is a hairball from about n = 64. **Recommendation:** (1) gates default **on** to n <= 40, **thin (opacity x 0.5, no gate labels)** for 40 < n <= 150, and **off unless a zone or gate is selected or hovered** above that (selection draws only the incident gates, O(in-degree)); the thresholds are table data (`gatesThinFromN`, `gatesOffFromN`). (2) Edge bundling is **not required** for the phase goals. A hierarchical-bundling prototype (control points source -> source ring centre -> layout centre -> target ring centre -> target, straightened with beta = 0.85, Catmull-Rom to cubic Bezier) costs 0.43 ms at n = 100 and 6 ms at 1024 (about 5x plain routing, still cheap) and turns the hairball into readable corridors between rings at n = 100, at the price of point-to-point traceability; ship it as an optional `routeGatesBundled` behind a flag only if the user asks on the contact sheet `[VERIFIED: rendered and viewed, plain vs bundled n = 100]`.

### Pattern 7: Base-10 presets and the seam (proof plan)

`app/presets/base10/layouts.ts` exports four `LayoutSpec`s (`supports: g => g.base === 10`) whose `build()` returns, from literal tables: `x, y` (Float64Array by zone from `P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`; planetary from the radius/angle/size tables at the default angles), `center` (`CENTER`), frame `800 x {940, 880, 870, 800}`, `nodeRadius` 21 (planetary: `PLANETARY_SIZE` per zone), `drawOrder` (`[6,3,2,7,5,4,1,8,9,0]`, `[6,3,8,7,1,2,4,5,9,0]`, `[4,5,3,6,2,7,1,8,0,9]`, planetary = zones sorted by y), region labels and `routing` style. `app/data/positions.ts` keeps **exactly its current export names** (`P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`, `PLANETARY_CX`, `PLANETARY_CY`, `PLANETARY_RADIUS`, `PLANETARY_DEFAULT_ANGLE`, `PLANETARY_SIZE`, `CENTER`) and rebuilds the `Record<number, Pos>` objects once at module load from the preset arrays (identity stable for `useMemo` dependencies; integer keys enumerate ascending regardless of insertion order).

**How equality is proved without editing the viewer (all independent of the preset code):**
1. Coordinates, centres, planetary constants and positions at the default angles: deep-equal to `engine/test/fixtures/base10.golden.json` fields `layouts`, `center`, `planetary` (frozen, sha256 manifest). The existing `tests/oracle/base10.oracle.test.ts` already reads positions through `app/data/positions` and compares them to the frozen JSON, so once the seam is swapped it exercises the presets automatically; keep it green and unchanged.
2. Draw order, exact coordinates, region labels and frame heights: the frozen DOM goldens `e2e/__golden__/golden.spec.ts/{original,labyrinth,ladder}--default.txt` encode them. A 25-line reader gets `viewBox="0 0 800 H"` (line 1: 940, 880, 870), the sequence of `<text ... font-size="17" ...>` nodes (zone labels: their order is the draw order, their `x` and `y - 1` are the coordinates), and the `WARP`/`PLEX`/`TORQUE` texts with `x`, `y`, `font-size`, `opacity`. Run in the prototype: draw orders `6,3,2,7,5,4,1,8,9,0` / `6,3,8,7,1,2,4,5,9,0` / `4,5,3,6,2,7,1,8,0,9` equal the literals in `NumogramClient.tsx`, positions equal `positions.ts`, region labels `WARP (335,45)`, `PLEX (400,930)` / `WARP (400,20)`, `TORQUE (400,438)`, `PLEX (400,865)` / `WARP (175,280)`, `PLEX (175,804)` `[VERIFIED]`. The planetary frame height 800 is captured by `e2e/__behaviour__/planetary.json` (`"viewBox": "0 0 800 800"`).
3. Rendering: the 60 DOM goldens, the behaviour baseline and the numeric oracle stay green and unregenerated (`npm run test:swap`, then `npm run verify`).

**Must stay untouched:** `app/components/projection/Projection.tsx`, `app/NumogramClient.tsx` (including its `zoneOrder`, gate and current memos and the hard-coded region labels), `app/hooks/useTween.ts` (still imports `P_*`, `CENTER` through the seam), `app/lib/planetary.ts` (imports `PLANETARY_*` through the seam), `app/lib/geometry.ts`, `app/data/types.ts` (its `Layout` string union is the base-10 viewer's id type; the engine's layout id type must be a separate type; note `ladder` exists in both, and at base 10 the preset wins), the five data seams and `app/lib/constants.ts`, all frozen fixtures and manifests, `perf/page-weight.baseline.json`.

### Pattern 8: Scene-to-SVG emitter and the contact sheet

`layoutToSvg(g, layout, routes, opts): string` (and `pairGraphToSvg`) in `engine/scene/svgString.ts`: pure string building through `fmt` (2 decimals, `String(round)`, never `-0`), `Array.join`, no Map iteration, no locale, no Date. Options: `layers {syzygies, currents, gates}`, `labels: 'all' | 'none'`, `gateLabels`, `detail: 'lean' | 'rich'`, `title` (escaped), `embed` (omit `xmlns`, `width`, `height` so it can be inlined). Style scales by `strokeScale = max(1, width/800)` so hairlines survive the fit-to-panel zoom (0.7 units x 2.39 at n = 100 keeps about 0.5 px at a 580 px panel, the same as base 10 today). Zone circles carry class `zl` on their label and `gl` on gate labels so a viewer can hide them by LOD.

`scripts/review-sheet.ts` writes `.review/layout-review.html` (gitignored): bases 2, 4, 6, 8, 12, 16, 28, 64, 82, 100; per base the ring, ladder, spiral and pair-graph figures (plus a second ring figure with the other packer for 64, 82 and 100); each figure is an inline `<svg>` in a `div.vp` with `data-r` (node radius in world units). A 20-line inline script gives wheel-zoom about the cursor, drag pan, double-click reset and the label LOD (`class hl` hides `.zl,.gl` when `r * px < 7`). No dependencies, no network, no branding.

**Measured (prototype):** 40 figures = 804,321 bytes (112,790 gzip), built in 0.49 s including process start, identical sha256 on repeated runs `[VERIFIED]`; rendered and inspected in Chromium (labels hide by LOD at base 64/82/100 fit scale and appear on zoom, confirmed by screenshot).

**What is committed:** the emitter, the script, its tests; **not** the HTML (`/.review/` in `.gitignore`), so nothing generated ships.

### Pattern 9: Tier table as data (see the Ceiling spike section for the schema)

### Anti-Patterns to Avoid

- **Name-keyed routing** (`c.name === 'Warp'`): use `cycle.kind` / "destination is a member of the pair" and numeric ids.
- **`Record<number, Pos>` or per-zone objects** in the engine: Float64Array by zone; the seam builds Records only for base 10.
- **A discrete decision on a raw `Math.sin/cos` value** (argmax over angles, sort by float, `>` on unrounded values): quantize to 1/8 first or use integer arithmetic; break ties by cycle id.
- **`Math.min(...arr)` on large arrays** (stack limits) and empty-set min/max: loop with explicit initial values; bases 2 and 4 have no Torque cycle (Pitfall 10).
- **Emitting a page of `<circle>` per demon** or any O(n^2) scene: not this phase, but the emitter must never call `g.demons`.
- **Importing engine layout runtime code from the viewer's preset module** (bundle weight, Pitfall 1).
- **A naive per-frame linear-scan "cull" check** as a substitute for real spatial culling once n is in the thousands (measured: it costs as much as drawing everything at n = 4000; see Ceiling spike).
- **Timing assertions in committed tests** (the table is data; tests validate schema and invariants only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle, pair, current, gate structure | Any re-derivation in layout code | `createNumogram(base)` (`torques`, `plex`, `warp`, `cycle.zones()`, `pair(id).odd/.even`, `current(id).to`, `gate(z).to`, `nextPair`) | Correctness is the core value; layout must never carry its own numogram math |
| Own-base labels | Digit loops | `formatNumeral`, `formatNetSpan`, `torqueLabel`, `formatGateName` | Phase 2 contract (D-04/D-05) |
| Number formatting for paths and SVG | `toFixed` in ad-hoc places | one `fmt` (2 decimals, `-0` -> `0`) | Determinism and byte-stable output |
| Metric collection | Wall-clock `Date.now` loops | rAF interval statistics with uncapped frame flags, CDP `Performance.getMetrics`, `performance.measureUserAgentSpecificMemory` | Trustworthy on Windows Chromium; validated below |
| Weak-device emulation | Nothing custom | `Emulation.setCPUThrottlingRate`, `--disable-gpu` (SwiftShader), bytes-per-zone budgets | Built into CDP/Chromium; calibrated in this session |
| Edge bundling | A force-directed simulation | Hierarchical bundling through ring centres (closed form), or leave gates off unless selected | Deterministic, O(E x depth) |
| DOM-golden comparison | A new browser oracle | a small text parser over the existing frozen golden files | The goldens already encode positions, draw order, labels and heights |

**Key insight:** the structure that makes the layout easy (odd/even alternation, current lands on the next odd zone, cycles are permutation cycles) is already in the engine; every layout function should be a few lines of index arithmetic over `cycle.zones()` and `pair(id)`, and every invariant should be tested against the engine, not asserted.

## Runtime State Inventory

This phase includes a seam refactor (`positions.ts` becomes a pass-through over new presets), so the inventory is stated explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None: no database, cache or user data holds layout coordinates; share links carry `layout=original\|labyrinth\|ladder\|planetary` names only (verified in `app/NumogramClient.tsx` line 471), unchanged | None |
| Live service config | None (static export, no services) | None |
| OS-registered state | None | None |
| Secrets/env vars | None (`CCRUG_TZ` and `NEXT_PUBLIC_BASE_PATH` are unaffected) | None |
| Build artifacts | `out/` (static export) must be rebuilt for the DOM goldens (`npm run verify` does); `perf/page-weight.baseline.json` is a stored artifact that must **not** change (the seam adds bytes; the gate must stay inside the tolerance) | Run `npm run check:weight` after the seam swap; never raise the baseline to make it pass |

## Common Pitfalls

### Pitfall 1: Layout code leaking into the viewer bundle
**What goes wrong:** the layout, routing and emitter prototypes are 19.8 KB minified (7.8 KB gzip); the page-weight budget has about 11.1 KB raw and 3.6 KB gzip of headroom (Phase 2 P13). If `app/presets/base10/layouts.ts` imports a runtime function from `engine/layout` (or the barrel keeps a top-level table alive), `npm run check:weight` fails.
**Why:** `engine/package.json` declares no `sideEffects`, and webpack keeps modules with top-level side effects even when their exports are unused.
**How to avoid:** the preset module imports `import type { Layout, LayoutSpec }` only and builds its arrays from literals; keep top-level data inside functions or `/*#__PURE__*/`; consider `"sideEffects": false` in `engine/package.json` (the engine has none apart from the LRU cache Map); run `npm run check:weight` in the plan that swaps `positions.ts` and in the final gate. **Warning signs:** `/numogram/` raw size grows by more than about 2 KB in that plan.

### Pitfall 2: Making a discrete decision on trig values (Pitfall 15 of the project research)
**What goes wrong:** the spiral packer's accept/reject, `ceil` of chord radii, and rounding of printed coordinates depend on `Math.sin/cos`, which are implementation-approximated across engines.
**How to avoid:** quantize to multiples of 1/8 before any comparison; `ceilQ` uses `- 1e-9` slack (at m = 6, `Math.sin(Math.PI/6)` is `0.49999999999999994`, so the raw chord radius is `84.00000000000001` and a bare `ceil` would jump to 84.125); the shelf packer uses only dyadic arithmetic; print with 2 decimals; digests are over rounded output. Tie-break by cycle id, never by float equality.

### Pitfall 3: Empty-set and degenerate bases (Pitfall 10)
**What goes wrong:** base 2 has no Torque cycle and no Warp, base 4 has no Torque, base 6 has one 2-pair cycle and no Warp; `bbox` over nothing, `Math.min()` of an empty list, a zero-height frame, `curveAway` with a NaN centre.
**How to avoid:** explicit initial values in loops; minimum frame 800x600; centre defaults to the frame centre when there is no Torque group; capsule-only layouts. **Verified:** all even n in 2..400 give finite coordinates, nodes inside the frame, no route or SVG string containing `NaN`, `Infinity` or `undefined`. Base 6's two-pair ring (a square) draws two crossing Y junctions inside a very small polygon; legible but the tightest case, put it on the sheet.

### Pitfall 4: Confusing the engine's Plex destination with the viewer's
The engine's Plex current lands on `n - 1`; the viewer draws it to zone 0 (legacy). Procedural routing follows the engine; the preset path keeps the viewer's own memos. Do not "fix" the base-10 viewer in this phase.

### Pitfall 5: Frame growth that shrinks nodes below the label threshold
Frame width grows with n (about 27 units/zone for a single long cycle) and the viewer shows a fixed 580 px panel, so at n = 100 the node radius on screen is 6.4 px (below the 7 px hypothesis, but consistent with it as the crossover) although the layout is fine. The layout reports `width`; the renderer decides displayed pixels. Do not solve this by shrinking `s`.

### Pitfall 6: Tween between layouts of different node sets
Ring <-> ladder <-> spiral are equal-length zone arrays and can be interpolated; the pair graph has n/2 nodes, so also provide it by zone (both partners on the pair node) or cross-fade. Interpolate coordinates only; recompute routes each frame from the interpolated positions with the **destination** layout's orientation array; above `layoutTweenMaxN` (table) switch instantly.

### Pitfall 7: CSS-transform pan/zoom is not free for SVG at high element counts
**What goes wrong:** the common assumption that panning/zooming via a CSS `transform` on a wrapper element is "compositor-only and therefore free regardless of content" does **not** hold for SVG once the transform includes `scale`: the browser must re-rasterize the vector content at the new scale on (at least some) frames, and the measured cost scales with element count, not just canvas area. Native GPU profile: a rich-tier SVG at n = 300 costs a median 189.5 ms per pan/zoom frame; at n = 2000, 1279 ms; even the leaner tier costs a median 799 ms/frame at n = 4000 (native GPU) once the loop scales as well as translates.
**Why it happens:** SVG elements are not implicitly promoted to their own GPU layer; a `scale()` on an ancestor forces the renderer to reflow/repaint descendants at the new resolution rather than just resampling a cached bitmap.
**How to avoid:** the SVG-rich tier should be used for the sizes where this cost is acceptable (roughly n <= 100-150, see the Ceiling spike table); anything larger needs the Canvas tier, whose cached-bitmap pan is measured at a **constant** cost independent of n (see Pattern: Canvas tier below).
**Warning signs:** smooth pan/zoom on a small base, stutter that gets worse with base size on a larger one, DevTools Performance showing large "Paint"/"Rasterize" blocks during a transform-only interaction.

### Pitfall 8: A naive linear-scan cull is not free
**What goes wrong:** a Canvas-tier "cull to the viewport" implemented as a per-element bounding-box check before drawing costs as much as drawing everything once n is a few thousand, because the check itself is O(n) per frame. Measured (native GPU): cached full-bitmap blit stays at 0.13 ms per frame at every n up to 4000; a naive cull-and-redraw-visible-only loop costs 4.84 ms at n = 4000 (worse than doing nothing extra, because there is no cached bitmap in that path) and up to 262 ms on the 4x-throttled profile.
**How to avoid:** for the Canvas tier (Phase 6), prefer the cached-static-layer architecture already in ARCHITECTURE.md (draw everything once to an offscreen bitmap; pan/zoom that bitmap) over per-frame visibility filtering; only add a spatial index (grid or R-tree) for culling if a future measurement shows the static-layer repaint itself (on data change) is the bottleneck, not the pan/zoom.

### Pitfall 9: Measuring the wrong thing in the spike
Default rAF cadence follows the display (6.9 ms/frame on the GPU profile with vsync, 16.8 ms in the software shell with vsync); without `--disable-frame-rate-limit --disable-gpu-vsync` every fast case reads as the vsync interval, hiding real cost differences. `performance.memory` is bucketed (reads a constant like 10,000,000 bytes) unless `--enable-precise-memory-info`; even then it is Chromium-only and not comparable across engines. Use a fresh page per (profile, tier, n) so memory is not cumulative across runs. Call `HeapProfiler.collectGarbage` via CDP before reading heap metrics.

### Pitfall 10: Tests that depend on this PC's speed
The table is measured data; committed tests may check schema, ordering, monotonicity and that decisions are explicit, but never that a measured number is below a threshold (CI runs ubuntu-latest and windows-latest without a discrete GPU, i.e. closer to the `sw` profile than `gpu`).

## Code Examples

Verified prototypes (condensed). All pure; all used in the measurements above.

### Ring layout composition (nest, pack, capsules, frame)
```typescript
// Source: scratch prototype (verified against the engine)
function torqueGlyphs(g: Numogram, unitsPerPair: number, s: number, nodeR: number) {
  return g.torques.map(c => { const m = c.lengthInPairs * unitsPerPair; const R = ceilQ(chordRadius(Math.max(2, m), s))
    return { cycle: c, m, R, Rb: ceilQ(R + nodeR) } })            // canonical order = size descending = packing order
}
function composeTorques(glyphs, p, s) {
  const k = glyphs.length
  if (k <= 3) {                                                    // nest: outermost = glyphs[0]
    const R = new Float64Array(k); R[k - 1] = glyphs[k - 1].R
    if (k > 1) { const outer = glyphs[0].R, inner = glyphs[k - 1].R
      R[0] = outer
      for (let j = 1; j < k; j++) R[j] = ceilQ(inner + (outer - inner) * (k - 1 - j) / (k - 1))
      for (let j = k - 2; j >= 0; j--) R[j] = Math.max(glyphs[j].R, R[j], R[j + 1] + p.nestDelta * s)
      for (let j = 1; j < k; j++) R[j] = Math.max(glyphs[j].R, R[j]) }
    return { centres: 'all at the origin', ringR: R }
  }
  return p.packer === 'spiral' ? packSpiral(Rb, p.glyphGap) : packShelf(Rb, p.glyphGap)
}
```

### Shelf packer (deterministic, no trig)
```typescript
// Source: scratch prototype (verified: 0 overlaps for every measured base, minGlyphGap == glyphGap)
export function packShelf(Rb: Float64Array, gap: number) {          // Rb sorted descending, multiples of 1/8
  const k = Rb.length; let area = 0
  for (let i = 0; i < k; i++) { const d = 2 * Rb[i] + gap; area += d * d }
  const minW = 2 * Rb[0] + gap; let best = null
  for (const f of [0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.3, 2.7]) {
    const W = Math.max(minW, Math.ceil(Math.sqrt(area) * f))
    const rows = []; let cur = { items: [], w: 0, h: 0 }
    for (let i = 0; i < k; i++) { const d = 2 * Rb[i] + gap
      if (cur.items.length && cur.w + d > W) { rows.push(cur); cur = { items: [], w: 0, h: 0 } }
      cur.items.push(i); cur.w += d; cur.h = Math.max(cur.h, d) }
    rows.push(cur)
    let maxW = 0, H = 0; for (const r of rows) { maxW = Math.max(maxW, r.w); H += r.h }
    if (!best || Math.max(maxW, H) < best.score - 1e-9) best = { rows, maxW, score: Math.max(maxW, H) }
  }
  // then centre each row within best.maxW and stack rows top to bottom; centres = (row x + d/2, row y + h/2)
}
```

### Route formulas (gates and currents)
```typescript
// Source: scratch prototype. All numbers scale with k = layout.scale and r = layout.nodeRadius
const gateBulge = -towardCentre * dist * 0.18 + lane * 10 * k               // quadratic control offset along the chord normal
const junction  = M + 0.35 * (D - M) + perp * side * 0.52 * r                 // Y current, M = pair midpoint, D = destination
const selfLoop  = (a) => `M${ax - 60deg} Q${centre + 3.1 r along a} ${ax + 60deg}`   // a = radial from the ring centre
```

### Measurement harness essentials (Playwright)
```javascript
// Source: scratch spike driver, verified in this session
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-precise-memory-info'] })
// software-raster profile: same launch args plus '--disable-gpu' (verified: WebGL renderer falls back to SwiftShader)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })   // measured actual slowdown: 4.14x (rate 4), 6.35x (rate 6), vs a 3e7-iteration Math.sqrt loop
// page must be served cross-origin isolated (COOP+COEP) for performance.measureUserAgentSpecificMemory() to resolve
const mem = await page.evaluate(async () => { const r = await performance.measureUserAgentSpecificMemory(); return { bytes: r.bytes, dom: r.breakdown.filter(b => b.types.includes('DOM')).reduce((s,b)=>s+b.bytes,0) } })
```

## Ceiling spike (REN-01)

### Method (validated on this machine)

**Environment (recorded once per run, goes in the table's metadata):**

| Field | Value | How obtained |
|---|---|---|
| CPU | AMD Ryzen 9 3900X, 12 cores / 24 threads, 3.79-4.6 GHz | `Win32_Processor` via CIM `[VERIFIED]` |
| RAM | 64 GiB (68,664,356,864 bytes) | `Win32_ComputerSystem` `[VERIFIED]` |
| GPU | AMD Radeon RX 6700 XT, driver 32.0.21045.5002, ~4 GiB VRAM reported | `Win32_VideoController` `[VERIFIED]` |
| OS | Windows 10 Home, build 10.0.19045 | `Win32_OperatingSystem` `[VERIFIED]` |
| Browser | Chromium 153.0.8010.12 ("Chrome for Testing", channel `chromium`) and the bundled headless shell, both via Playwright-core 1.63.0 | `page.evaluate(() => navigator.userAgent)`, `browsers.json` `[VERIFIED]` |
| Raster mode | GPU (ANGLE/D3D11 over the RX 6700 XT) with `channel: 'chromium'`; software (SwiftShader/Vulkan) with the default headless shell or `--disable-gpu` | `WEBGL_debug_renderer_info` `[VERIFIED]` |
| Date | 2026-09-26/27 | session date |

**Four device profiles**, all launched with `--disable-frame-rate-limit --disable-gpu-vsync` (otherwise every fast case reads as the display's vsync interval, e.g. 6.9 ms/frame on GPU or 16.8 ms in the software shell with vsync on — a real trap, see Pitfall 9):

| Profile | Launch | CPU throttle | Raster | Represents | Calibration (3x10^7-iteration `Math.sqrt` loop) |
|---|---|---|---|---|---|
| `gpu` | `channel: 'chromium'` | 1x (none) | GPU (D3D11) | this PC, best case | 64.9 ms (baseline) |
| `sw` | `channel: 'chromium', args: ['--disable-gpu']` | 1x | SwiftShader (software) | this PC without a usable GPU | 65.1 ms (1.00x) — **CPU-bound work is unaffected by `--disable-gpu`**; only GPU-raster-bound work (see Canvas paint below) differs |
| `sw-4x` | as `sw` | CDP `Emulation.setCPUThrottlingRate({rate:4})` | software | "mid-tier mobile" emulation `[CITED: https://developer.chrome.com/docs/devtools/settings/throttling — DevTools' own mid-tier default is 4x]` | 268.4 ms (**4.14x** measured, close to nominal) |
| `sw-6x` | as `sw` | CDP rate 6 | software | "low-tier mobile" emulation `[CITED: same source — DevTools' own low-tier default is 6x]` | 412.3 ms (**6.35x** measured) |

`Emulation.setCPUThrottlingRate` slows the main thread's JS/layout/style/paint scheduling by the given factor; it does **not** change available memory, the JS heap size limit, or GPU throughput `[CITED: https://developer.chrome.com/docs/devtools/settings/throttling]` `[VERIFIED: memory numbers below are flat across profiles, confirming the citation]`. This is why software rendering (`--disable-gpu`, SwiftShader) is measured as a **separate** axis from CPU throttling: it is the standard way to approximate a device with a weak/no GPU, while CPU throttling approximates a slow CPU; real low/mid-tier phones are usually weak in both. `[ASSUMED]` that `sw-6x` (software + 6x) is a reasonable stand-in for "low-tier mobile" and `sw-4x` for "mid-tier": DevTools' own presets use exactly these two multipliers as of Chrome 134's calibration feature `[CITED]`, but the calibration feature computes them by comparing *this* machine to a reference device profile, which was not run here (no network access to fetch the calibration data); this is flagged in the Assumptions Log.

**APIs used, and why each is trustworthy here:**

| API | Used for | Trustworthy? |
|---|---|---|
| `requestAnimationFrame` interval, uncapped (`--disable-frame-rate-limit --disable-gpu-vsync`) | pan/zoom frame time (median, p95, max of n consecutive frames) | Yes, once uncapped; verified uncapped gives sub-ms floors while capped gives vsync-locked floors (6.9/16.8 ms) `[VERIFIED]` |
| CDP `Performance.getMetrics` (`TaskDuration`, `ScriptDuration`, `LayoutDuration`, `RecalcStyleDuration`, `JSHeapUsedSize`) | main-thread cost breakdown and JS heap delta, before/after a mount | Yes; deltas between two calls bracketing the operation, one page per measurement so nothing accumulates |
| `performance.measureUserAgentSpecificMemory()` | precise DOM/JS/shared byte breakdown | Yes, but only when the page is served cross-origin-isolated (COOP+COEP headers); this was arranged in the harness by fulfilling requests to a fake `https://spike.test/` origin with those headers via Playwright route interception `[VERIFIED: crossOriginIsolated === true, API resolved]`. Chrome 89+, Chromium-only, **not comparable across browsers or even across Chrome versions** `[CITED: https://web.dev/articles/monitor-total-page-memory-usage]` |
| `performance.memory` (`usedJSHeapSize`) | sanity cross-check only | Only with `--enable-precise-memory-info`; otherwise bucketed to coarse values (observed a constant `10,000,000` on a nearly-empty page without the flag) `[VERIFIED]` — do not use without the flag |
| DOM node count (`document.getElementsByTagName('*').length`) and CDP `Memory.getDOMCounters` | DOM size vs n | Yes, exact |
| `canvas.getContext('2d').getImageData(...)` after paint | forces the raster pipeline to complete before timing stops (canvas paint is otherwise asynchronous relative to script) | Yes; used after every canvas timing block |

**Repeatability:** one fresh `page` per (profile, tier, n) so memory/heap is never cumulative; `HeapProfiler.collectGarbage` before reading heap metrics; every scene is pre-computed once (from the verified layout/routing prototypes) and injected as static JSON so the harness measures render/interaction cost only, not layout computation (layout cost is measured separately above and is negligible next to render cost). All frame-time statistics report median, p95 and max over 8-90 frames (fewer frames for slower cases, to bound total spike run time) — medians are what should drive tier decisions; max is dominated by one-off GC pauses.

### SVG-rich tier (matches today's Projection.tsx feature density: filters, hit-target overlay paths, gate/current labels, per-element handlers)

Mount = React `flushSync` commit through two rAFs (first paint settled). Hover = toggle one zone's highlight state 20x (or 6x when mounting is already slow), median of `commit` (React work only) and `toFrame` (commit + the browser actually presenting a frame). Pan = 90 (or fewer, adaptively) frames of a CSS `transform: translate(...) scale(...)` on the SVG's wrapper, uncapped rAF.

| n | DOM nodes | gpu mount(ms) | sw mount | sw-4x mount | sw-6x mount | gpu hover commit/toFrame(ms) | sw-6x hover commit/toFrame | gpu panCss med(ms) | sw-6x panCss med |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 218 | 17 | 16 | 81 | 135 | 0.3 / 2.7 | 2.4 / 13.4 | 1.0 | 3.3 |
| 28 | 578 | 26 | 26 | 128 | 209 | 0.6 / 4.5 | 6.5 / 23.6 | 2.6 | 6.1 |
| 64 | 1,298 | 30 | 31 | 156 | 249 | 1.5 / 5.9 | 12.4 / 38.1 | 2.6 | 7.9 |
| 100 | 2,018 | 41 | 42 | 202 | 330 | 2.2 / 10.2 | 19.1 / 61.0 | 4.1 | 16.1 |
| 150 | 3,018 | 55 | 55 | 267 | 450 | 3.5 / 12.8 | 28.9 / 79.6 | 16.6 | 63.0 |
| 200 | 4,018 | 66 | 65 | 347 | 565 | 4.7 / 17.6 | 35.4 / 101.1 | 17.4 | 80.3 |
| 300 | 6,095 | 98 | 95 | 499 | 822 | 6.4 / 33.6 | 52.9 / 149.8 | 189.5 | 106.2 |
| 500 | 10,018 | 155 | 158 | 693 | 1,121 | 12.8 / 39.0 | 90.7 / 248.4 | 303.9 | 208.8 |
| 800 | 16,018 | 205 | 213 | 980 | 1,680 | 19.7 / 48.0 | 136.7 / 322.7 | 309.9 | 184.8 |
| 1000 | 20,018 | 258 | 263 | 1,338 | 2,246 | 24.8 / 87.8 | 172.2 / 490.2 | 548.6 | 303.0 |
| 2000 | 40,018 | 527 | 522 | 2,538 | 4,304 | 50.7 / 207.6 | 319.2 / 862.5 | 1,279.4 | 828.5 |

DOM memory (UASM, `gpu` profile): **~310 bytes/DOM-node, linear** (0.06 MB at n=10 to 11.9 MB at n=2000, ~5.97 KB/zone at n>=1000); JS heap delta similarly linear at ~3.15 KB/zone (0.43 MB at n=10 to 12.2 MB at n=2000). Memory is comfortably not the bottleneck; frame time is. `gpu` and `sw` (same CPU, GPU vs SwiftShader raster) are statistically indistinguishable for SVG — DOM diffing and layout, not GPU raster, dominate rich-tier SVG cost on this hardware, so software-vs-GPU raster mode matters far more for the Canvas tier (below) than for SVG.

### SVG-lean tier (a stripped variant: no filters/glow, no separate hit-target overlay paths, no gate/current text labels, one `<circle>`+`<text>` per zone plus thin route strokes — an approximation of a hand-optimized SvgRichView, not yet the real Phase-4/6 implementation)

| n | DOM nodes | gpu mount | gpu hover c/f | gpu pan | sw-6x mount | sw-6x hover c/f | sw-6x pan |
|---|---|---|---|---|---|---|---|
| 100 | 408 | 10 | 0.5/1.7 | 0.9 | 73 | 3.9/10.6 | 6.1 |
| 300 | 1,208 | 17 | 1.5/4.2 | 1.6 | 130 | 10.6/26.6 | 10.3 |
| 800 | 3,208 | 35 | 3.6/7.8 | 1.4 | 264 | 26.0/58.4 | 10.2 |
| 1000 | 4,008 | 46 | 4.7/11.3 | 2.6 | 356 | 31.9/80.5 | 20.6 |
| 2000 | 8,008 | 89 | 8.9/21.0 | 262.9* | 665 | 63.5/152.9 | 29.9 |
| 4000 | 16,008 | 158 | 18.0/43.5 | 799.1* | 1,180 | 122.0/306.7 | 74.2 |

`*` at n >= 2000, once the transform includes a large enough `scale`, even the lean tier's pan cost jumps (799 ms median at n=4000 on native GPU) — this is Pitfall 7 (SVG scale forces a repaint proportional to element count) and is the strongest evidence in this dataset for a hard Canvas cutover well before n = 2000, independent of CPU speed.

### Canvas tier (static layer cached to an offscreen bitmap, `Path2D` per route, batched single-path paint for the syzygy layer, viewport pan/zoom by blitting the cached bitmap)

One-time paint cost when the layout/base changes (median of 3-5 repetitions; `naive` = one `Path2D`/`stroke()` call per element, `batched` = one `Path2D`/`stroke()` call per layer):

| n | gpu naive/batched(ms) | sw naive/batched | sw-4x naive/batched | sw-6x naive/batched |
|---|---|---|---|---|
| 100 | 3.2 / 2.7 | 2.7 / 2.7 | 12.8 / 13.4 | 21.8 / 21.5 |
| 500 | 7.6 / 5.7 | 6.6 / 5.7 | 33.4 / 29.3 | 57.0 / 47.6 |
| 1000 | 13.2 / 9.1 | 11.5 / 9.2 | 58.2 / 42.7 | 92.2 / 72.9 |
| 2000 | 38.6 / 18.4 | 24.5 / 18.7 | 121.0 / 91.8 | 196.3 / 146.3 |
| 4000 | 74.1 / 23.6 | 41.4 / 23.6 | 193.3 / 118.0 | 310.0 / 185.5 |

Per-frame pan/zoom cost, three strategies (median ms/frame):

| n | gpu cached-blit | gpu direct-redraw | gpu culled-redraw | sw-6x cached-blit | sw-6x direct-redraw | sw-6x culled-redraw |
|---|---|---|---|---|---|---|
| 100 | 0.14 | 0.2 | 0.14 | 21.8 | 22.6 | 14.7 |
| 1000 | 0.13 | 1.5 | 0.55 | 21.6 | 93.3 | 101.1 |
| 4000 | 0.13 | 59.4 | 4.84 | 22.0 | 301.2 | 444.0 |

**The cached-blit strategy is the finding that matters**: it is flat (0.13-0.23 ms on native GPU, ~14-22 ms on the throttled profiles — the throttle floor itself, not n) across every n from 10 to 4000. Direct full-redraw-every-frame grows linearly with n as expected (this is the "never redraw a styled graph every frame" warning already in STACK.md, now measured on this hardware: 59 ms/frame at n=4000 native GPU, worse than the cached approach by ~450x). The naive per-frame visibility-check "culled" strategy is **not** a free win over direct redraw at high n/high throttle (444 ms vs 301 ms at n=4000 on sw-6x) — see Pitfall 8.

### All-chords density limit (native GPU, batched single-path canvas stroke; alpha scaled down as `min(0.6, max(0.02, 30/n))` per the usual "more items, less opacity" convention)

| n | chords (C(n,2)) | canvas paint (ms) | % of inked disc pixels crossed by >=4 chords | SVG mount (nodes / ms) |
|---|---|---|---|---|
| 10 | 45 | 84.5 (cold path, see note) | 0.0% | 143 / 5.6 |
| 30 | 435 | 2.3 | 0.8% | 1,313 / 12.3 |
| 50 | 1,225 | 3.1 | 11.7% | 3,683 / 26.8 |
| 60 | 1,770 | 3.4 | 29.6% | 5,318 / 37.4 |
| 80 | 3,160 | 4.2 | 74.2% | 9,488 / 55.6 |
| 100 | 4,950 | 5.4 | 95.3% | 14,858 / 86.6 |
| 120 | 7,140 | 7.2 | 99.7% | 21,428 / 124.2 |
| 300 | 44,850 | 32.1 | 100% | — |
| 1000 | 499,500 | 184.3 | 100% | — |

**Legibility, not render time, is the limit**: canvas paint stays under 200 ms even at half a million chords, but the picture is already illegible (>95% of ink from 4+ overlapping chords) by n = 100 and clearly degrading from n = 50-60. `[VERIFIED, matches STACK.md's prior sourced hypothesis of an "all-chords web mode" cutoff in the low hundreds, now measured rather than assumed]`. Recommendation: the density-limited "web" demon mode should not be offered past **n = 60-80** regardless of how fast a machine is (a data-table field, not a frame-time-derived cutoff).

### Canvas area and dimension limits (this Chromium, both `gpu` and `sw` profiles gave identical results)

| Width x Height | Area | Result |
|---|---|---|
| 16384 x 16384 | 268,435,456 (2^28) | OK |
| 32767 x 8192 | 268,427,264 | OK |
| 11585 x 23170 | 268,424,450 | OK |
| 16385 x 16384 | 268,451,840 | **FAIL** (canvas silently clamped to 0-area; corner pixel unreadable) |
| 32767 x 8193 | 268,460,031 | **FAIL** |
| 23171 x 11586 | 268,459,206 | **FAIL** |
| 32767 x 32767 | 1,073,676,289 | **FAIL** |
| 32768 x 1, 65535 x 1 | tiny | OK (single dimension well past the commonly-cited 32,767 limit still works when area is tiny) |

**Measured limit is exactly `width * height <= 268,435,456` (2^28)** in this Chromium (153.0.8010.12) — matching Skia/Chromium bug-tracker reports of a 268,435,456-pixel area cap `[CITED: https://issues.chromium.org/issues/40349850, https://bugs.chromium.org/p/chromium/issues/detail?id=339725]`. The commonly-repeated "32,767 px per dimension" limit was **not independently reproduced** as a standalone constraint here (a 32768x1 and even 65535x1 canvas both worked); it may be a Firefox/Safari limit, an older Chromium limit, or only bite in combination with the area cap. **Flagged for Phase 8** (export/CLI clamping logic): clamp on **area**, not on a fixed per-dimension constant, and re-verify on the actual export code path.

### Headless SVG generation (Node, no browser; from the layout/routing/emitter prototypes)

| n | layout(ms) | routes(ms) | emit-all(ms) | output size | gzip | Node RSS growth |
|---|---|---|---|---|---|---|
| 100 | 2 | 2 | 1 | 0.06 MB | 0.01 MB | +1 MiB |
| 1,000 | 1 | 5 | 5 | 0.58 MB | 0.08 MB | +8 MiB |
| 10,000 | 5 | 52 | 50 | 5.72 MB | 0.80 MB | +71 MiB |
| 100,000 | 24 | 356 | 660 | 56.3 MB | 7.77 MB | +503 MiB |
| 400,000 | 122 | 1,104 | 2,016 | 226.0 MB | (not computed, >60 MB gzip input) | +1,490 MiB |

Headless generation is fast in absolute terms (well under a second up to n=100,000) but **RSS grows disproportionately to output size** (about 3.7 KB of process memory per emitted primitive at n=400,000, versus about 0.14 KB of actual string bytes) — likely V8 string-builder/rope garbage before final concatenation. `[ASSUMED]` this is an implementation artifact of the naive `Array.join`-based prototype, not a hard ceiling; Phase 8's CLI should stream to a file handle (`fs.createWriteStream` + sequential `write()`) instead of building one giant string, and re-measure. Flagged in Open Questions.

### Threshold table schema (proposed)

```typescript
// engine/scene/tiers.ts — DATA plus tiny pure functions; no timing assertions anywhere near this file's tests.
export type RenderTier = 'svg' | 'canvas' | 'headless'
export type DeviceProfile = 'gpu' | 'sw' | 'sw-4x' | 'sw-6x'   // extend with 'safari', 'mobile-real', etc. as new rows arrive

export interface EnvironmentMeta {
  measuredOn: string          // 'AMD Ryzen 9 3900X, 12c/24t, 64 GiB RAM, Windows 10 19045'
  browser: string              // 'Chromium 153.0.8010.12 (Playwright 1.63.0)'
  gpu: string | null           // null for software-raster rows
  cpuThrottle: number          // 1, 4, 6 (measured actual multiple, not the nominal CDP request)
  date: string                 // ISO date the row was captured
}

export interface TierMeasurement {
  profile: DeviceProfile
  tier: RenderTier
  n: number
  mountMs: { median: number; p95: number }
  interactionMs: { median: number; p95: number }   // hover-to-frame (svg) or overlay redraw (canvas)
  panMs: { median: number; p95: number }           // cached-blit for canvas; CSS-transform for svg
  domNodes?: number
  domBytes?: number
  jsHeapBytes?: number
}

export interface TierTable {
  schemaVersion: 1
  environments: Record<DeviceProfile, EnvironmentMeta>
  measurements: TierMeasurement[]      // raw rows, one per (profile, tier, n) — this is the visible/auditable data
  boundaries: {
    // derived, one row per capability, each an explicit decision with its basis recorded
    svgRichMaxN: { n: number; basedOn: DeviceProfile; rule: string }
    svgLeanMaxN: { n: number; basedOn: DeviceProfile; rule: string }
    canvasMaxN: { n: number; basedOn: DeviceProfile; rule: string } | null   // null = no ceiling found in range tested
    allChordsMaxN: { n: number; rule: string }                              // legibility-limited, not profile-dependent
    labelVisibleMinRadiusPx: number
    layoutTweenMaxN: number
    canvasAreaLimitPx: number
    canvasDimensionNote: string
  }
  webglDecision: { adopt: boolean; reason: string; reviewedAt: string }
  tierOverrideParam: { enabled: true; values: ['svg', 'canvas', 'headless'] }   // D-13, always yes
}

export function selectTier(n: number, table: TierTable, override?: RenderTier): RenderTier {
  if (override) return override
  if (n <= table.boundaries.svgRichMaxN.n) return 'svg'
  if (table.boundaries.canvasMaxN === null || n <= table.boundaries.canvasMaxN.n) return 'canvas'
  return 'headless'
}

export function validateTierTable(t: TierTable): string[] {
  // schema/invariant checks ONLY (never a wall-clock assertion): monotonic n within each (profile, tier) series,
  // every boundary.basedOn references a profile present in `environments`, area limit > 0, at least one measurement
  // per declared tier, schemaVersion matches, etc. Returns a list of problems (empty = valid).
}
```

**Rule for which profile the shipped boundaries adopt:** `basedOn: 'sw-6x'` (the low-tier-emulation profile) for every interactive boundary, because the user asked for thresholds a lesser real machine can meet, and `sw-6x` is the most conservative profile measured. `gpu`/`sw`/`sw-4x` rows stay in `measurements` for visibility, future comparison, and so a later "real mid-tier device" row can be compared against the `sw-4x` emulation to check how good the emulation actually was `[ASSUMED — see Assumptions Log]`.

### Interim table (concrete first values, computed from the measurements above by the stated rule; to be re-derived once the real `SvgRichView`/`CanvasView` exist in Phase 4/6 rather than this phase's approximations)

Using budgets: mount <= 500 ms (a base switch should feel responsive), hover-to-frame <= 100 ms (RAIL "response" budget), pan/zoom <= 32 ms/frame (two dropped 60fps frames, a lenient real-time bound) `[CITED for the 100ms/16ms budgets: https://web.dev/rail — RAIL model; not independently re-verified this session, treated as a well-known heuristic]`:

| Boundary | Value | Based on | Rule applied |
|---|---|---|---|
| `svgRichMaxN` | **100** | `sw-6x` | highest measured n where mount, hover-to-frame and pan all stay within budget (n=100: 330/61.0/16.1; n=150 breaks pan at 63.0) |
| `svgLeanMaxN` | **1,000** | `sw-6x` | highest measured n where mount and hover-to-frame stay within budget (n=1000: 356/80.5; n=2000 breaks hover-to-frame at 152.9); pan is not the binding constraint for lean (20.6 ms at n=1000) |
| `canvasMaxN` | **null (no ceiling found up to 4,000)** | `sw-6x` | cached-blit pan stays at ~22 ms (throttle floor) at every measured n; one-time static-layer paint at n=4000 is 185.5 ms, comfortably under a 500 ms one-time budget |
| `allChordsMaxN` | **60** | legibility, not a profile | last n where <30% of inked pixels are 4+-overlapped; treat 60-100 as a fade zone |
| `labelVisibleMinRadiusPx` | **7** | on-screen sizing table | matches the D-07 hypothesis; base 100 is the first review-sheet base that crosses it on a 580px panel |
| `layoutTweenMaxN` | **500** `[ASSUMED]` | none measured directly | interpolated from `svgRichMaxN`/`svgLeanMaxN`: a tween is two renders per frame, so pick well inside the lean single-render budget; needs a dedicated tween-cost measurement once Phase 4 exists |
| `canvasAreaLimitPx` | **268,435,456** | measured, both profiles | exact 2^28 area cap |
| `canvasDimensionNote` | "no standalone per-dimension cap reproduced up to 65,535; clamp on area" | measured | see table above |

**WebGL contingency (D-12): No.** The Canvas tier's cached-blit architecture is measured at effectively O(1) pan/zoom cost up to n = 4,000 on every profile including the low-tier emulation; the only workload that would benefit from a GPU-resident renderer (the all-chords demon layer) is legibility-limited at n ~ 60-100, far below where Canvas raster time becomes a problem. This confirms STACK.md's prior sourced (but unmeasured) conclusion with real numbers on this hardware.

**`tier=` URL override (D-13): Yes**, unconditionally — trivial to implement (`selectTier` above already takes an `override` parameter) and independent of any measurement.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Authored coordinates per base (`positions.ts`) | Procedural layouts + authored presets behind one `Layout`/`LayoutSpec` interface | this phase | Any even base draws; base 10 unchanged |
| `Record<number, {x, y}>` per layout | `Float64Array` x and y by zone | ARCHITECTURE decision, this phase | O(n) memory, trivially interpolated |
| Name-keyed routing memos in the viewer | numeric-id pure routing | this phase (procedural only; viewer unchanged until Phase 4) | Works for any base; testable |
| Fixed pixel sizes (21, loop 13, strokes 0.7) | sizes as functions of the layout (`r`, `k`, `strokeScale`) | this phase | Pitfall 5 |
| `performance.memory` (bucketed) | `measureUserAgentSpecificMemory` under cross-origin isolation | Chrome 89+ `[CITED: https://web.dev/articles/monitor-total-page-memory-usage]` | Per-type bytes (DOM, JS, shared) |
| Guessing weak devices | CDP CPU throttle presets (4x mid-tier, 6x low-tier) and, since Chrome 134, per-machine calibration `[CITED: https://developer.chrome.com/docs/devtools/settings/throttling]` | Chrome 134 | Rates are relative to the dev machine; a 3900X at 6x can still beat a real low-tier phone (Assumptions Log) |
| Assumed "compositor-only" CSS pan/zoom is free for any content | Measured: SVG scale transforms repaint proportional to element count | this phase (measured) | Justifies the Canvas tier's cached-bitmap architecture with real numbers, not just precedent from Cytoscape's blog post |

**Deprecated/outdated:** the ARCHITECTURE prototype's `R = s when 2L <= 2` special case is unnecessary (Torque cycles have L >= 2 and the formula holds for m = 2); its 0.9 R sqrt(t) spiral step is replaced by `0.5 Rb_i sqrt(t)` with first-fit resume; its hypothesis that a single spiral packer is best is superseded by the measurements above (shelf packer recommended as default).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cap = 4096` world units is the right growth cap for the layout frame | Pattern 2 | Too low: large bases feel cramped even after scaling; too high: coordinate magnitudes grow, no correctness risk (still exact floats to 2^20+) but SVG viewBox strings get longer. Low risk either way; easy to change (it is a datum, not baked into geometry) |
| A2 | `s = 84` (= 4x the base-10 node radius 21) as the default minimum node spacing, and the "even" nesting spread (vs "compact") for k=2,3 | Pattern 2 | Purely a taste call; the contact sheet (D-10) is exactly the mechanism to catch a bad choice before it ships |
| A3 | Row/"shelf" packer recommended as the *default*, with spiral kept selectable | Pattern 2 | If the user prefers the spiral's organic look despite lower fill, swapping the default is a one-line change (both are implemented and tested) |
| A4 | Gate layer thresholds (on <=40, thin 40-150, off-unless-focused above) and `routeGatesBundled` as opt-in only | Pattern 6 | Cosmetic; verified crossing counts support "hairball from ~64" but the exact cutoffs (40, 150) are a judgement call, not a measured legibility threshold (no user-study data exists for "how many crossing gates is too many") |
| A5 | `sw-6x` (software raster + CDP 6x CPU throttle) is a reasonable proxy for "a real low-tier mobile device", and `sw-4x` for "mid-tier" | Ceiling spike / Standard Stack | CDP throttling only slows the main thread's script/layout/style/paint scheduling relative to *this* CPU; it does not change memory bandwidth, GPU throughput, thermal throttling behavior, or the JS engine's optimizing-compiler tier-up timing the way a real ARM mobile SoC would. Chrome's own "calibration" feature (134+) computes device-specific multiples by comparing to reference hardware profiles — that calibration was not run here (no network fetch of the reference table in this offline session). If wrong, the shipped thresholds could still be optimistic for real low-end hardware; the mitigation is that `sw-6x` is already the most conservative of the four measured profiles, and the table's schema keeps every raw row so a future run with real device data (or Chrome's own calibration) can simply add rows and re-derive `boundaries` without any code change |
| A6 | The RAIL model's 100 ms (response) / 16 ms-ish (animation) budgets are the right acceptability thresholds to compute `svgRichMaxN`/`svgLeanMaxN` from | Ceiling spike, interim table | These are well-known, widely-cited UX heuristics but were not independently re-verified in this session (no fetch of web.dev/rail); a different budget choice shifts the computed n but not the underlying measured data, since all raw rows are kept |
| A7 | `layoutTweenMaxN = 500` | Ceiling spike, interim table | Not measured directly (no tween-specific harness was built, since the real component that will do the tweening does not exist until Phase 4); this is interpolated from adjacent measurements and should be replaced by a direct measurement once `SvgRichView`/`CanvasView` exist |
| A8 | Headless RSS growth (~3.7 KB/primitive at n=400,000) is a prototype artifact (naive string-building), not a hard ceiling | Ceiling spike, headless table | If actually intrinsic to Node's string handling at this scale, Phase 8's CLI could OOM on very large bases; mitigated by recommending a streaming writer be measured before Phase 8 ships |
| A9 | The commonly-cited "32,767 px per canvas dimension" limit does not apply as a standalone constraint in this Chromium version (only the 2^28 area cap was reproduced) | Ceiling spike, canvas limits | If some other code path (e.g., a different canvas type, or a future Chromium version) does enforce a per-dimension cap, an export/CLI clamp based on area alone could still produce a canvas that fails; mitigated by recommending Phase 8 re-verify on its actual code path (2D vs possibly-offscreen canvas, current Chromium at that time) |
| A10 | `packMode: 'shelf'`'s row-count/width search (10 candidate widths) is sufficient; more candidates were not tried | Pattern 2 | Fill ratio (0.52-0.68) is already better than the spiral's; more candidate widths could improve it further but at more search cost — low risk, purely a quality/cost tradeoff |

**If this table is empty:** not applicable — several claims above needed user confirmation before becoming locked decisions; none of them affect LAY-01..04 correctness (which were verified against the engine, not assumed).

## Open Questions

1. **Should the shipped tier boundaries really be based on `sw-6x`, or is that too conservative (e.g. it makes `svgRichMaxN = 100`, below several review-sheet bases like 100 itself sitting right at the edge)?**
   - What we know: `sw-6x` is DevTools' own "low-tier mobile" default multiple, applied to a high-end desktop CPU; the resulting `svgRichMaxN = 100` is close to where Pattern 2's own on-screen-size table independently says labels stop being legible on a 580px panel anyway (n=100), so the two independent signals roughly agree.
   - What's unclear: whether a real low-tier device would actually land near `sw-6x`-on-a-3900X, or whether this doubly overestimates the deficit (a real phone's single-core speed is not simply "1/6th of a 3900X core").
   - Recommendation: ship `sw-6x`-derived boundaries as the interim table now (this is what the phase asks for), but treat REN-01's "exit gate" role as provisional until either Chrome's calibration feature or one real low/mid-tier device is measured (deferred per CONTEXT, but worth a fast follow-up before Phase 6 commits hard).

2. **What does the *real* `SvgRichView`/`CanvasView` cost, as opposed to this phase's harness approximations?**
   - What we know: the harness's "rich" and "lean" React trees are structurally similar to `Projection.tsx` (same element mix: gates with a hit-target overlay path, currents with legs/stem/junction circle, syzygy dotted lines, zone circles with labels) but are not byte-identical to it (no gradients/particles/sun glow, no `RegionLabels`, no the click-selection state machine).
   - What's unclear: whether the real component is meaningfully heavier (more likely) or the harness's numbers already over- or under-state it.
   - Recommendation: Phase 4/6 should re-run the same spike driver (`scripts/spike/`, kept in the repo per this research's project structure) against the actual `SvgRichView`/`CanvasView` once they exist, and overwrite the `measurements` rows (never hand-edit `boundaries` without re-deriving them).

3. **Headless CLI memory at very large n (Phase 8):** does switching from `Array.join` string-building to a streaming writer actually fix the ~3.7 KB/primitive RSS growth (A8), or is there a deeper cost in the emitter itself?
   - Recommendation: a 30-minute follow-up measurement in Phase 8 planning, not blocking this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | engine, scripts, tests | Yes | 22.16.0 | — |
| npm | install, lockfile | Yes | 11.6.2 (CI uses 10.x; lockfile kept valid for both per CLAUDE.md, unaffected by this phase since no dependency is added) | — |
| TypeScript | engine, layout, routing | Yes | 5.9.3 (pinned) | — |
| Vitest | unit/invariant tests | Yes | 5.0.2 (pinned) | — |
| Playwright / playwright-core | spike driver, contact-sheet QA screenshots | Yes | 1.63.0 | — |
| Chromium (via Playwright) | spike driver (all 4 profiles) | Yes | 153.0.8010.12, both the full browser (`channel: 'chromium'`) and the headless shell, plus ffmpeg/winldd support binaries | — |
| tsx | running dev scripts | Yes | 4.23.15 (pinned) | — |
| React / react-dom UMD builds | spike harness only | Yes | 18.3.1 | — |
| A discrete GPU | `gpu` profile measurements | Yes (AMD RX 6700 XT) | driver 32.0.21045.5002 | if absent, `sw` (SwiftShader) profile still works everywhere Chromium runs |
| Safari / WebKit | cross-browser canvas-area and font rows (deferred by CONTEXT) | No | — | not available on Windows; deferred to a later milestone per CONTEXT.md, ROADMAP Phase 8 notes it as a known gap |
| A real low/mid-tier mobile device | validating the CPU-throttle emulation (A5) | No | — | CDP `Emulation.setCPUThrottlingRate` profiles used instead; flagged as an assumption, not a fallback-with-equal-confidence |
| Network access (for `npm view`, doc fetches) | version verification, citations | Partial (WebSearch/WebFetch worked; no package installs were needed) | — | all versions read from local `package.json`/`node_modules` instead of the registry, since nothing new was installed |

**Missing dependencies with no fallback:** none block this phase's execution.

**Missing dependencies with fallback:** Safari/WebKit and real mobile hardware are both explicitly deferred by the user's own CONTEXT.md decisions (D-11, "Deferred Ideas"); the CDP-throttle-emulation fallback for weak devices is the one the user's mid-research instruction asked for directly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2, two projects: `engine` (`engine/**/*.test.ts`) and `oracle` (`tests/**/*.test.ts`) |
| Config file | `vitest.config.mts` (existing, unchanged by this phase) |
| Quick run command | `npx cross-env CCRUG_TZ=UTC vitest run engine/test/layout.*.test.ts` (new files this phase adds) |
| Full suite command | `npm run verify` (about 4.5 minutes; repo guard, typecheck, unit tests in two timezones, sub-path e2e, build, page-weight, e2e including the 60 DOM goldens, clean-tree/static-out guard) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-01 | Every even base 2..400 (plus notable large bases) gives a deterministic ring layout with adjacent syzygies, correct odd/even alternation, current landing on the next odd zone, anticlockwise angle step, and no overlap/clip | unit (sweep) | `vitest run engine/test/layout.ring.test.ts -t "sweep even bases"` | ❌ Wave 0 |
| LAY-01 | Two independent runs of `ringLayout`/`ladderLayout`/`spiralLayout`/`pairGraphLayout` in the same process, and under `CCRUG_TZ=America/New_York`, produce identical typed arrays (Pitfall 15) | unit | `vitest run engine/test/layout.determinism.test.ts` | ❌ Wave 0 |
| LAY-01 | Base 2, 4, 6 (degenerate) give finite, unclipped coordinates and no `NaN`/`Infinity` in any emitted route string | unit | `vitest run engine/test/layout.degenerate.test.ts` | ❌ Wave 0 |
| LAY-02 | Base-10 preset layouts equal `engine/test/fixtures/base10.golden.json` (`layouts`, `center`, `planetary`) exactly | unit (oracle) | `vitest run tests/presets/base10-layouts.test.ts -t "numeric oracle"` | ❌ Wave 0 (extends the existing `tests/oracle/base10.oracle.test.ts` pattern) |
| LAY-02 | Base-10 preset draw order, coordinates, region-label position/size/opacity and frame height equal what the frozen DOM goldens encode (parsed independently, not re-rendered) | unit | `vitest run tests/presets/base10-layouts.test.ts -t "DOM golden parity"` | ❌ Wave 0 |
| LAY-02 | The full gate proves the viewer itself is unaffected | e2e (existing, replayed) | `npm run test:swap` then `npm run verify` | ✅ (existing suites, unmodified) |
| LAY-03 | Node radius, label size and stroke scale are monotonic non-increasing functions of the frame's growth factor, and no review-sheet base has an on-screen node radius of 0 or overlapping labels at fit scale | unit + visual (human) | `vitest run engine/test/layout.sizing.test.ts` (unit invariants); contact sheet (human) for the visual judgement | ❌ Wave 0 (unit) / ✅ human step (D-10) |
| LAY-04 | Pair-graph layout: every Torque cycle's pair-nodes lie on one circle, equal angular steps, anticlockwise, arrows follow `nextPair`, for all even n <= 400 including base 64 (six rings) | unit (sweep) | `vitest run engine/test/layout.pairgraph.test.ts` | ❌ Wave 0 |
| REN-01 | The tier table is schema-valid: monotonic n per series, every `boundaries.*.basedOn` references a declared environment, `canvasAreaLimitPx > 0`, `tierOverrideParam.enabled === true`, `webglDecision.adopt === false` is accompanied by a non-empty `reason` | unit | `vitest run engine/test/tiers.schema.test.ts` | ❌ Wave 0 |
| REN-01 | `selectTier` respects an explicit override regardless of table contents, and falls through svg -> canvas -> headless in n order | unit | `vitest run engine/test/tiers.select.test.ts` | ❌ Wave 0 |
| REN-01 | The measured spike data itself (raw JSONL/JSON) is **not** re-run inside `npm run verify`; it is committed as static data and re-generated only by deliberately re-running `scripts/spike/*` | n/a (by design) | — | n/a |

### Sampling Rate
- **Per task commit:** the relevant `vitest run engine/test/layout.*.test.ts` file(s) for the module just written.
- **Per wave merge:** `npm run test` (both timezones) plus `npm run typecheck`.
- **Phase gate:** full `npm run verify` green, plus the human contact-sheet sign-off (D-10) before the phase is considered done; the spike driver itself is run manually (it launches real browsers with CPU-throttle CDP sessions and takes several minutes across four profiles — it must never be part of `npm run verify`).

### Wave 0 Gaps
- [ ] `engine/layout/{types,params,format,ring,pack,ladder,spiral,routing,registry}.ts` — none exist yet; this phase's first wave creates them
- [ ] `engine/scene/{svgString,tiers}.ts` — none exist yet
- [ ] `engine/test/layout.*.test.ts`, `engine/test/tiers.*.test.ts` — no test files yet for any of the above
- [ ] `tests/presets/base10-layouts.test.ts` — new file; can reuse the DOM-golden-parsing helper prototyped in this research (verified to correctly recover draw order, coordinates and region labels from the three frozen golden files)
- [ ] `scripts/review-sheet.ts`, `scripts/spike/*.ts` — dev-only, not covered by `npm run verify`, but worth a smoke test that the review-sheet script runs and produces valid, non-empty, deterministic (same sha256 twice) output — `tests/presets/review-sheet.smoke.test.ts` or similar
- [ ] `.gitignore` additions: `/.review/`, `/.spike/`

*(All of the above are net-new; there is no existing test infrastructure for layout/rendering because Phase 3 is the first phase to introduce this code.)*

## Security Domain

Not applicable in the ASVS sense: this phase adds no authentication, session, network, or data-persistence surface. It is pure client-side/CLI computation and static SVG string generation over integers already validated by the Phase 2 engine (`assertBase`/`validateBase`). The one input-adjacent concern is XSS-shaped: the SVG emitter's `title` option and any future free-text label must be escaped (the prototype's `esc()` helper — `&`, `<`, `"` — already does this and should carry into the real implementation) since the emitted string can be embedded directly into a page (the review sheet, and later the export feature). No new dependency, no new network surface, no secrets.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (no auth in this app) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes (narrow) | base validated by the Phase 2 engine before any layout function runs; SVG string values are numeric/own-base-formatted, never raw user text, except the optional `title`, which must be HTML-escaped |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unescaped text interpolated into an emitted SVG/HTML string (contact sheet, future export) | Tampering / Information Disclosure (stored XSS if ever served) | Escape `&`, `<`, `"` (and `>` for safety) in any string field before interpolation; keep numeric fields numeric (never string-concatenate untrusted text into `d`/`points` attributes) |

## Sources

### Primary (HIGH confidence)
- `engine/index.ts`, `engine/core/{types,numogram,numerals,arith,base}.ts` — read directly; layout formulas verified against `createNumogram` output for every even base 2..400 plus notable large bases, in this session
- `engine/test/fixtures/base10.golden.json`, `e2e/__golden__/golden.spec.ts/{original,labyrinth,ladder}--default.txt`, `e2e/__behaviour__/planetary.json` — read and parsed directly to prove preset equality independent of any preset code
- `app/data/positions.ts`, `app/lib/geometry.ts`, `app/components/projection/Projection.tsx`, `app/NumogramClient.tsx`, `app/hooks/useTween.ts`, `app/lib/planetary.ts` — read directly for today's routing/sizing/preset conventions
- Local `package.json` / `node_modules/*/package.json` — exact installed versions (React 18.3.1, Playwright/playwright-core 1.63.0, Chromium 153.0.8010.12, tsx 4.23.15, Vitest 5.0.2, TypeScript 5.9.3, esbuild 0.28.2 transitive)
- This session's own scratch measurements — layout/packing/routing invariant sweeps (1000+ layouts checked), determinism digests (identical across repeated runs and across `TZ=UTC`/`America/New_York`), the review-sheet prototype (804,321 bytes / 112,790 gzip, sha256-stable), and the full four-profile Playwright ceiling-spike matrix (183 measurement rows across `svg-rich`, `svg-lean`, `canvas`, `chords`, `limits`, `calib` suites)
- `https://web.dev/articles/monitor-total-page-memory-usage` — `performance.measureUserAgentSpecificMemory()` requirements (cross-origin isolation) and caveats (not comparable across browsers/versions) — checked against this session's own measurement, which matched (API resolved only once COOP/COEP were set)
- `https://developer.chrome.com/docs/devtools/settings/throttling` — CDP CPU throttling presets and the existence of per-machine calibration since Chrome 134 — checked against this session's own calibration loop (4.14x measured for a "4x" request, 6.35x for "6x")
- `https://issues.chromium.org/issues/40349850`, `https://bugs.chromium.org/p/chromium/issues/detail?id=339725` — Chromium/Skia canvas area-limit bug reports — checked against this session's own measured 268,435,456-pixel cutoff, which matched exactly

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md` — prior project research; layout/tier hypotheses cross-checked and in most cases confirmed or refined by this session's measurements (packer choice, WebGL decision, all-chords cutoff)
- RAIL performance model budgets (100 ms response, ~16 ms animation) — well-known web performance heuristic, used to derive the interim table's boundaries; not independently re-fetched this session (see Assumptions Log A6)

### Tertiary (LOW confidence)
- The commonly-repeated "32,767 px per canvas dimension" limit, referenced in several secondary sources found via WebSearch (tutorialspoint.com, html2canvas issue threads) — explicitly **not** reproduced as a standalone constraint in this Chromium version; only the area cap was confirmed (see canvas limits table and Assumptions Log A9)
- Any claim about real mobile-device performance (as opposed to this PC's CPU-throttle emulation of it) — not measured, flagged throughout as `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every version read from local files, no registry guesswork
- Architecture / layout geometry: HIGH — every formula verified against the Phase 2 engine across a large sweep (1000+ layouts, all even n 2..400, plus notable bases to 2^20), not merely asserted
- Base-10 preset equality plan: HIGH — proof method verified end-to-end against the actual frozen oracle files in this session (not just designed on paper)
- Ceiling spike method: HIGH — validated on this machine across four profiles with cross-checked, mutually consistent numbers (e.g., calibration loop confirms CDP throttle multiples; canvas area cap confirms independent Chromium bug reports)
- Ceiling spike placeholder numbers: MEDIUM — real measurements, but from one PC's CPU-throttle emulation of weaker hardware, not real weaker hardware; explicitly interim per D-11
- Pitfalls: HIGH for the ones demonstrated in this session (trig quantization, degenerate bases, CSS-transform repaint cost, naive culling cost); MEDIUM for ones carried over from prior project research without new evidence

**Research date:** 2026-09-26/27
**Valid until:** the layout geometry and preset-equality findings are stable (not time-sensitive; revisit only if the Phase 2 engine's contracts change). The ceiling-spike numbers should be treated as valid for about 30 days or until Phase 4/6 re-runs the same harness against the real components, whichever comes first — they are also invalidated immediately by any Chromium/Playwright version bump (re-run `scripts/spike/calib` first to confirm the CPU-throttle multiples still hold).
