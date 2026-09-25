# Architecture Research

**Domain:** Arbitrary-base numogram generator (pure math engine + procedural layout + tiered renderers) integrated into an existing base-10 Next.js 14 viewer
**Researched:** 2026-09-25
**Confidence:** HIGH on engine math and static-export constraints (prototyped against the reference text and existing data; official Next.js docs). MEDIUM on layout/worker/canvas design (own design, verified for cycle statistics and packing cost, not yet for visual quality). LOW on renderer tier thresholds (must be measured by the ceiling spike; numbers here are starting hypotheses only).

Scope note: this file covers how the *new* capabilities integrate with the existing code. The existing system is described in `.planning/codebase/ARCHITECTURE.md`; it is not re-researched here.

## Facts Verified During This Research (they drive the design)

All checked with throwaway scripts against `reference/genius-guide-diy-numogram-demonology.txt` and the existing `app/data/*` and `app/lib/constants.ts`.

| Fact | Evidence | Architectural consequence |
|------|----------|---------------------------|
| Pair->pair map (pair `lo` -> pair `min(d, n-1-d)`, `d = n-1-2*lo`) is a permutation for every even n tested (2..4000); the only fixed points are `lo=0` (Plex) and `lo=(n-1)/3` (Warp, when integral and odd) | script over all even n <= 4000 | Regions are cycles; whole structure is O(n) and can be built eagerly |
| A current's destination `d` is always **odd**, and is always the **odd member of the next pair** in the cycle | script, n in {10,12,28,82,1000,4096}; parity argument (`n-1` odd, `2*lo` even) | Every pair has exactly one odd (arrival) and one even (departure) zone; the Torque is an alternating syzygy/current loop of `2L` zones. This directly dictates the ring layout |
| Derived Torque walk `odd(P0) -syz- even(P0) -cur- odd(P1) ...` for base 10 = `1>8, 8>7, 7>2, 2>5, 5>4, 4>1` | script | Identical to hand-authored `TC_EDGES` in `app/lib/constants.ts`; `TC_EDGES`, `TC_SYZYGIES`, `TC_CURRENTS` become derived and golden-testable |
| Number of Torque cycles is **not** small at large n: max 130 for even n <= 4000; n=1024 -> 54, n=2048 -> 93, n=4096 -> 178. Of 2000 even bases <= 4000: 736 have <=3 cycles, 646 have 4-10, 566 have 11-50, 52 have >50 | script | "One concentric ring per cycle" only works for <=3 cycles. Layout **must** pack many small ring glyphs |
| Cycle lengths are small when there are many cycles (n=1024: max length 10; n=4096: 12) | script | Ring glyphs are tiny; packing is cheap (measured 0.1-6 ms for up to 180 glyphs) |
| Closed-form demon counts equal full enumeration for n = 10, 12, 28. Base 10: 12 cyclic + 3 syzygetic chrono, 12 Plex + 12 Warp amphi, 4 chaotic + **2** syzygetic xeno = 45 | script vs enumeration | Type counts are O(1) with no enumeration. See pitfall below about the guide's typo |
| The guide text says "4 Syzygetic Xenodemons", but its own list sums to 47, not 45. Combinatorics give 2 (9::0 and 6::3) | guide lines 144 vs 140; script | Golden tests must be derived from the definition, not copied from the prose count |
| Existing `ALL_DEMONS.kind` taxonomy is {syzygy: 5, chrono: 12, amphi: 24, xeno: 4} (all five syzygies lumped as `syzygy`) | `app/data/demons.ts`; script reproduces 5/12/24/4 | Engine has the richer 3-type + 6-subtype taxonomy; a one-line `legacyKind()` adapter maps it for golden tests and for Projection during migration |
| Mesh number `a(a-1)/2 + b` inverts in O(1) with an integer-sqrt correction; round-trips exactly (n=10, 1000, 100000 sampled). Max mesh at n=100000 is 4,999,949,999, `8m+1` ~ 4e10, all `< 2^53` | script | Random access to any demon without materialization; safe in plain `number` up to n ~ 6.7e7 (guard, do not use BigInt) |
| Gate self-loops (`k -> k`) are rare: n=10: 3, n=1000: 5, n=4096: 17 | script | The O(segments x 72-angle) clearance search in `selfChannelArc` is not a hot spot |
| `tsconfig.json` has `target: "es5"`; `for...of` over `Set`/generators and `[...new Set()]` fail with TS2802 under it; clean under `es2017` | reproduced with `tsc` 5.x | Engine cannot use iterators/generators until the root target is raised (or `downlevelIteration`). Existing code already dodges this (`Array.from(set)`, `Map.forEach`) |
| Local Node is 22.16.0; Vitest 5.0.2 requires Node `^22.12`; TS type-stripping is default-on only from Node 22.18 (behind `--experimental-strip-types` on 22.6-22.17) and requires explicit `.ts` import specifiers and erasable-only syntax | `node --version`, `npm view vitest engines`, Node 22.18.0 release notes | OK for Vitest 5. Run the CLI via `tsx` (respects extensionless relative imports), not bare `node`; revisit native stripping only if the engine is later published as a workspace package |

## Standard Architecture

### System Overview

```
+-------------------------------------------------------------------------------+
|  UI (Next.js client, app/)                                                    |
|  NumogramClient (shrinks) | panels (virtualized) | base picker | naming editor   |
|  useUrlState  useNumogramModel  useSelection  useHistory                       |
+----------------------------------+--------------------------------------------+
                                   | NumogramViewProps (one contract, N tiers)
+----------------------------------v--------------------------------------------+
|  Render tiers (app/render/)                                                    |
|  SvgRichView (React SVG, today's Projection generalized)                       |
|  CanvasView  (2D canvas, cached layers, picking buffer)                        |
|  Headless    (engine/scene: sceneToSvg, sceneToJson)  -> export + CLI          |
+----------------------------------+--------------------------------------------+
                                   | Scene = model + view + interaction state
+----------------------------------v--------------------------------------------+
|  engine/  (pure TS, zero deps, no DOM/Node types, relative imports only)       |
|                                                                                |
|  scene/   display-list helpers, SVG string emitter, demon-matrix RGBA raster,  |
|           LOD + tier selection table                                           |
|      ^                                                                         |
|  layout/  layout registry, ring / spiral / ladder / diameters, cycle packing,  |
|           routing (gate + current paths), bounds                               |
|      ^                                                                         |
|  core/    base, digits, pairs, cycles/regions, currents, gates,                |
|           demons (lazy DemonSpace, mesh, type classifier), labels              |
|      ^                                                                         |
|  naming/  sound map, seeded generator, euphony, derive names, JSON schema      |
+----------------------------------+--------------------------------------------+
                                   | (only consumers of engine/, never the reverse)
+----------------------------------v--------------------------------------------+
|  Presets (app/presets/base10/): hand-authored layouts, region labels, lore,    |
|  CCRU zone phonemes + demon names, planetary mode. Art and content, not math.  |
+-------------------------------------------------------------------------------+
|  Compute placement: inline for small n, Web Worker (workers/engine.worker.ts)  |
|  for large n; same pure functions either way.                                  |
+-------------------------------------------------------------------------------+
     Also consumers of engine/: Vitest suites, CLI (engine/cli, run with tsx)
```

Dependency rule (enforced, see "Package boundary"): `core <- layout <- scene <- (app | cli)`, `core <- naming`. Nothing in `engine/` imports React, DOM, Node built-ins, or anything from `app/`.

### Component Responsibilities

| Component | Responsibility | Talks to |
|-----------|----------------|----------|
| `engine/core` | Everything derivable from `n` alone: zone/pair algebra, current destination, cycles and region classification, gates, digit reduction and in-base formatting, the lazy `DemonSpace` (mesh, type, counts, unranking). Returns typed arrays. No geometry. | nothing |
| `engine/layout` | Zone coordinates for a chosen layout id; cycle-ring glyphs and packing; routing (gate/current/syzygy path geometry); bounds and viewBox. Deterministic. No DOM. | `core` |
| `engine/scene` | Backend-neutral scene helpers: SVG string emitter (headless export, CLI, worker), pandemonium-matrix RGBA raster, LOD rules, tier selection table. | `core`, `layout` |
| `engine/naming` | Sound-per-zone map, seeded generator, euphony pass, demon-name derivation, JSON schema + validator. Names computed on demand, never stored per demon. | `core` |
| `engine/cli` | `tsx engine/cli/main.ts --base 28 --layout ring --format svg|json`. Node-only file I/O lives here alone. | `core`, `layout`, `scene`, `naming` |
| `app/presets/base10` | Hand-authored `original`/`labyrinth`/`planetary` layouts (positions, zone order, region labels, heights), lore (`ZONE_META`, syzygy/current/gate descriptions), CCRU phonemes and the 45 demon names, planetary tables. Registered through the same `LayoutSpec` interface as procedural layouts. | `engine/*` types |
| `app/model` | `useNumogramModel(base, layoutId)`: builds and caches `NumogramModel = {g, layout, routes, naming}`; chooses inline vs worker; drops stale results by request id. | `engine/*`, worker |
| `app/render/*` | Tiered views implementing the same props contract; hit-testing; culling; canvas caching. | `engine/scene` |
| `app/lib/urlState.ts` | The single URL codec (parse, validate against base, canonical serialize). Replaces three divergent parsers. | `engine/core` (validation only) |
| `NumogramClient` | State hub reduced to interaction state (selection, hover, layers, view, panels, history). No graph knowledge. | `app/model`, render tiers, panels |

## Recommended Project Structure

```
engine/                              # new; promotable to an npm workspace later
  package.json                       # {"name":"@ccrug/engine","private":true,"type":"module"}
  tsconfig.json                      # lib: ["es2022"], types: [], strict; NO dom, NO node
  core/    base.ts digits.ts pairs.ts cycles.ts currents.ts gates.ts
           demons.ts mesh.ts labels.ts types.ts index.ts
  layout/  types.ts registry.ts ring.ts spiral.ts ladder.ts diameters.ts
           pack.ts routing.ts bounds.ts index.ts
  scene/   types.ts svgString.ts demonMatrix.ts lod.ts tiers.ts index.ts
  naming/  schema.v1.json schema.ts validate.ts prng.ts generator.ts
           euphony.ts derive.ts index.ts
  cli/     main.ts
  test/    fixtures/base10.golden.json  *.test.ts
app/
  model/       useNumogramModel.ts  computeClient.ts (inline | worker)
  presets/base10/  layouts.ts lore.ts naming.ts planetary.ts regionLabels.ts
  render/      svg/SvgRichView.tsx  canvas/CanvasView.tsx  canvas/picking.ts  tier.ts
  lib/         urlState.ts  share.ts (ShareImageProvider)  (existing files stay)
  data/        types.ts (UI types, adapters)  -> other files shrink to lore-only, then move to presets/
workers/
  engine.worker.ts                   # outside app/ so the router ignores it; ends with `export {}`
tsconfig.json                        # target -> es2017; paths add "@engine/*": ["./engine/*"]
vitest.config.ts
```

### Package boundary: recommendation is folder + alias, not a workspace

| Option | For | Against | Verdict |
|--------|-----|---------|---------|
| **A. `engine/` folder + tsconfig path alias** | Zero new tooling. Next compiles any imported top-level folder with SWC and reads `paths` natively; the repo already uses `@/*` and already has the same pattern (`component-library/` built with a separate `tsconfig.components.json`). No lockfile change. Boundary is enforceable by config (below). | Boundary is by convention plus lint, not by module resolution. | **Recommended** |
| B. npm/yarn workspace (`packages/engine`) | True package boundary; independently publishable CLI. | Repo has `yarn.lock` but the environment runs npm 11 (lockfile ambiguity is already a hazard); Next 14 needs `transpilePackages` for TS-source workspace packages; the root `prepare` script already fires a build on every install; Windows symlink/junction friction; more CI surface. Buys nothing until something is actually published. | Defer |
| C. Separate repo / published package | Cleanest | Splits golden tests from the app that consumes them; premature | No |

Enforcement (this is what makes A safe):
1. `engine/tsconfig.json` with `"lib": ["es2022"]`, `"types": []`. Add `npm run typecheck:engine` (`tsc -p engine --noEmit`) to CI. Any DOM/Node reference in the engine fails there. The root Next type-check will **not** catch this, so the script is mandatory.
2. ESLint override for `engine/**`: `no-restricted-imports` forbidding `react`, `next/*`, `node:*`, `../app/**`, `@/*`. (Existing `.eslintrc.json` is just `next/core-web-vitals` + `next/typescript`; add an `overrides` entry.)
3. Engine files use **relative imports only**. That lets Vitest, `tsx` and Node run them without alias plugins (Vite does not read tsconfig `paths` by default) and makes a later move to a workspace mechanical.
4. `engine/package.json` exists from day one (name, `type: module`, `exports`) so promotion is a move, not a redesign.
5. Root `tsconfig.json`: raise `target` to `es2017` (verified necessary, see facts table). `tsconfig.components.json` already overrides to `es2019` and only includes specific files; `app/lib/xenotation.ts` is one of them, so **do not make `xenotation.ts` import from `engine/`**. Generalize it in place with an optional `count` parameter.

### Structure Rationale

- `layout` and `scene` live in `engine/` (not `app/`) because they are pure and must run in the CLI, the worker, and tests. The Canvas painter stays in `app/` because it needs DOM types; the demon-matrix raster lives in `engine/scene` because it only fills a `Uint8ClampedArray` and can run in a worker.
- Base-10 hand art and lore are **not** engine content. They move to `app/presets/base10` and plug in through the same interfaces, which keeps "base-10 is one preset" literally true.

## Data Model (question 2): never materialize O(n^2)

### Core object (eager, O(n) memory, built once per base)

```typescript
// engine/core/types.ts  (sketch; typed arrays because n reaches 1e5)
export type RegionKind = 'plex' | 'warp' | 'torque'

export interface Cycle {
  id: number                 // 0 = plex, 1 = warp if present, then torque by length desc, min-lo asc
  kind: RegionKind
  torqueIndex: number        // -1 for plex/warp, else 0-based (Torque-A = 0)
  pairs: Int32Array          // pair ids (= lo zone) in FLOW order, starting at min lo
}

export interface Numogram {
  readonly base: number                  // even, >= 2
  readonly pairCount: number             // base / 2
  partner(z: number): number             // base - 1 - z         (no array)
  currentDest(pair: number): number      // base - 1 - 2*pair    (always odd)
  readonly nextPair: Int32Array          // permutation over pairs
  readonly cycles: readonly Cycle[]
  readonly zoneCycle: Int32Array         // zone -> Cycle.id     (O(n))
  readonly gateTarget: Int32Array        // k -> digital root in base of T(k)
  readonly demons: DemonSpace            // lazy; see below
}
```

Zone id is the digit value (`number`). Pair id is its `lo` zone. Odd/even members: `odd(p) = p%2 ? p : n-1-p`. In-base arithmetic: digital root of `T(k)` in base `n` is `T==0 ? 0 : ((T-1) mod (n-1)) + 1` (verified against `gates.ts`, and base-12 gate 8 -> 3 per the guide). A separate `digitsOf(value, base): number[]` supports displaying the reduction chain (generalizing `plexExpr`, which today hard-codes `< 10`).

Numeric guard: `assertSafeBase(n)` rejects `n > 2^26`. Below that, `T(k)` and `8*mesh+1` stay under `2^53`; no BigInt path is needed.

### DemonSpace (lazy; the only O(n^2) structure is virtual)

```typescript
export type DemonType = 'chrono' | 'amphi' | 'xeno'
export type DemonSubtype =
  | 'cyclic-chrono' | 'syzygetic-chrono'
  | 'plex-amphi'    | 'warp-amphi'
  | 'chaotic-xeno'  | 'syzygetic-xeno'

export interface DemonRef {
  a: number; b: number           // a > b  (net-span a::b)
  mesh: number                   // a(a-1)/2 + b
  type: DemonType; subtype: DemonSubtype
  syzygy: boolean                // a + b === n-1
  numodemon: boolean             // a + b === n   (n/2 - 1 of them; 4 in base 10)
  torqueA: number; torqueB: number   // -1 if not in a Torque; enables optional Torque-I/II splits
}

export interface DemonSpace {
  readonly count: number                          // n(n-1)/2
  at(mesh: number): DemonRef                      // O(1)
  ref(a: number, b: number): DemonRef             // O(1), order-normalizing
  meshOf(a: number, b: number): number
  netSpanOf(mesh: number): [number, number]       // isqrt + integer correction
  counts(): Readonly<Record<DemonSubtype, number>>// closed form, O(#cycles)
  incident(z: number): Iterable<DemonRef>         // n-1 items
  numodemons(): Iterable<DemonRef>                // n/2-1 items
  group(t: DemonType): { count: number; at(k: number): DemonRef }  // O(1) unranking
  subtype(s: DemonSubtype): { count: number; at(k: number): DemonRef } // O(log n), see below
}
```

**Type classification without enumeration.** `zoneCycle[z]` gives each zone a class (Plex, Warp, or Torque i). Both zones of a syzygy share a class (regions are unions of pairs). For `a > b`:
- both Torque -> `chrono`; `syzygetic` iff `a+b === n-1`, else `cyclic`
- one Torque -> `amphi`; `plex-amphi` / `warp-amphi` by the other zone's class
- neither Torque -> `xeno`; same class -> `syzygetic-xeno`, different -> `chaotic-xeno`

Closed-form counts with `T` = Torque zones, `W` = 2 if Warp exists else 0, `P = n - T` (verified against enumeration): syz-chrono `T/2`; cyclic-chrono `C(T,2) - T/2`; plex-amphi `2T`; warp-amphi `T*W`; syz-xeno `W ? 2 : 1`; chaotic-xeno `W ? 4 : 0`. Sum check: `C(T,2) + T*P + C(P,2) = C(n,2)` (asserted in property tests).

**Unranking by group.** Chrono demons are the triangular mesh over the sorted Torque zone list (`k -> (j,i)` with the same isqrt formula, then map through the list); xeno likewise over the non-Torque list; amphi is a `T x P` grid (`k -> (k div P, k mod P)`). All O(1). `subtype()` for cyclic-chrono removes the `T/2` syzygy positions; precompute their sorted mesh indices (O(T)) and adjust the rank by binary search, so `at(k)` is O(log T). Nothing ever scans n^2 items to answer "show me demons of type X".

**What is deliberately NOT supported at large n:** sort-by-name and name search over all demons (needs all n^2 names). Support search by net-span (`a::b`) and mesh number always; support name search only when `count <= ~50k`, via a worker-built index.

Migration note: the current `app/data/demons.ts` builds `ALL_DEMONS` in a module-level `for` loop that runs at import time and stores `name` and `kind` strings per demon. That pattern must not survive: `Demon` becomes `{a,b}` and everything else is derived on demand. Keep `ALL_DEMONS` only as a base-10 compatibility export computed from `demons.at(i)` for `i < 45`.

### Layers over the core (all keyed by numeric id, not by name)

The current code keys render data by display name (`gateRenderData[g.name]`, `c.name === 'Warp' || 'Plex'`). Replace with numeric keys: gate by origin zone `k`, current/syzygy by pair id, cycle by `Cycle.id`. Base-10 names (Surge, Hold, Sink, Warp, Plex; `Gt-45`) become lore lookups keyed by pair id or zone. Note `CurrentData.from` in the existing data is **not canonical** (Surge from 8, Hold from 2, Sink from 4, Warp from 6, Plex from 9); the golden test must normalize to `(pair lo, destination)`.

## Procedural Layout (question 3)

### Interfaces

```typescript
export interface Layout {
  id: string
  x: Float64Array; y: Float64Array          // by zone; SoA, not Record<number,{x,y}>
  bounds: { w: number; h: number }          // viewBox = 0 0 w h  (presets keep 800 x {940|880|870|800})
  center: { x: number; y: number }
  nodeRadius: number                        // uniform; renderer LODs labels by screen size
  drawOrder?: Int32Array                    // back-to-front (preset `zoneOrder`)
  groups: Array<{ cycle: number; cx: number; cy: number; r: number }>  // for region labels/highlight
  regionLabels?: Array<{ text: string; x: number; y: number; size: number; opacity: number }>
  routing: { style: 'default' | 'ladder' | 'planetary' }  // replaces `layout === 'ladder'` string checks
}
export interface LayoutSpec {
  id: string; label: string
  supports(g: Numogram): boolean            // presets: g.base === 10
  build(g: Numogram, opts?: LayoutOpts): Layout   // deterministic, pure
}
```

`resolveLayout(id, g)`: exact preset match for `(base, id)` first, then a procedural spec of the same id, else the base default (base 10 -> `original`, else `ring`). Interpolation for the existing animated switch is a lerp between two `Float64Array`s of equal length; switching *base* is a crossfade (different n), not a tween.

### Candidate algorithms (all O(n) or O(n + k^2), k = cycle count)

**L1. Ring (recommended default for n >= 6): each Torque cycle is a self-contained glyph.**
The Torque cycle with `L` pairs is a `2L`-gon whose zones alternate `odd(P0), even(P0), odd(P1), even(P1), ...` (verified: current always lands on the next pair's odd zone). Place node `j` of `2L` at angle `2*pi*j/(2L)` (direction chosen so time flows anticlockwise as in the existing Surge description), radius `R = s / (2 sin(pi / 2L))` for min node spacing `s` (`R = s` when `2L <= 2`). Result: syzygy edges are polygon sides, current edges are the alternating sides, and a Y-shaped current's two legs come from adjacent nodes. For base 10 this reproduces the original hexagon order `1,8,7,2,5,4`.
- Plex: a two-node capsule (self-loop current) at the center of the composition; Warp: a second capsule beside it, both labelled as regions "outside time".
- <= 3 Torque cycles: nest concentric (largest outermost), each rotated so its min-lo pair sits at the top. Matches the base-28 `[9,3]` and base-82 `[27,9,3]` descriptions.
- More cycles: pack glyphs (circle of radius `R + margin`) with a deterministic Fermat-spiral search (sort by radius desc; for each glyph walk candidate points `r = 0.9*R*sqrt(t)`, `theta = t*golden_angle` until no overlap). Prototype timings: 0.1 ms (n=82) to 6.3 ms (n=1024, 54 cycles, 56 glyphs); 5.4 ms (n=4096, 178 cycles). Extent with `s = 24 px`: 205x202 (n=10), 669x574 (n=82), 2229x2266 (n=1024), 4955x4975 (n=4096).
- Complexity O(n + k^2). Fully deterministic. Highest legibility of Torque structure; the pair-adjacency requirement holds by construction.

**L2. Spiral ("Barker spiral"): scale-free, cheap, always the same look.**
The repo's own lore calls `4::5` the "innermost curve of the Barker spiral" and `0::9` the "outermost" (`app/data/syzygies.ts` descriptions). Generalize: order pairs by destination `d = n-1-2*lo` ascending (pair `n/2-1` innermost, pair `0` outermost); radius grows with pair index, angle by a fixed step or golden angle; the two members are radially adjacent (`pairStyle: 'adjacent'`) or antipodal (`'opposed'`). O(n). Does not show cycles as rings (color-code by cycle instead), so it is the secondary layout and the best "poster" layout at very large n.

**L3. Ladder (generalizes the preset): two columns, `lo` left and `hi` right, rows by pair.**
`P_LADDER` in `app/data/positions.ts` is exactly this with `x = 260/540`, rows spaced 175 from y=100 to 800. Implement as a parametrized procedural spec and add a test that `ladder(g10, presetParams)` equals `P_LADDER`. Option `rowOrder: 'index' | 'cycle'` (cycle order makes currents short). O(n); rows are `n/2` tall, so it needs zoom at large n.

**L4. Diameters (circle with antipodal syzygies): compact "chord diagram".**
All zones on one circle; each pair antipodal; pairs ordered by cycle within region blocks. O(n). Good for n <= ~200.

**L5. Force relaxation (defer past v1).** Seeded init from L1, fixed iteration count (so it stays deterministic), grid-accelerated repulsion, in a worker. Only if L1/L2 prove insufficient visually.

### Base-10 "original" as a preset

`app/presets/base10/layouts.ts` exports `original`, `labyrinth`, `planetary` as `LayoutSpec`s with `supports: g => g.base === 10`, returning the existing hand-authored coordinates, `zoneOrder` (currently three literal arrays in `NumogramClient`), heights (940/880/870/800), `CENTER`, and region labels (currently literal `<text>` coordinates in `RegionLabels` inside `Projection.tsx`). Planetary mode (orbits, dates, `useOrbitalAnimation`, particles) stays base-10-only; the UI hides it when `base !== 10` (PROJECT.md already scopes it out of generalization).

### Routing (gate and current path geometry)

Today ~350 lines in `NumogramClient.tsx` (`gateRenderData` and `currentRenderData` memos) build SVG path strings from positions, with:
- name-based special cases (`'Warp'`, `'Plex'` converge to the lower syzygy zone; `layout === 'ladder'` / `'planetary'` constants),
- `9 - c.from` partner arithmetic,
- a mutable `currentOrientationRef` written inside `useMemo` (impure).

Extract to `engine/layout/routing.ts` as a pure function `buildRoutes(g, layout, orientationCache) -> RouteSet` keyed by numeric id, replacing name checks with `cycle.kind !== 'torque'` and the style flags on `Layout.routing`. Keep **path strings** as the interchange format for cold layers (gates, currents, syzygies: O(n) items): SVG uses them directly, Canvas uses `new Path2D(d)` (cached per route), headless embeds them. Use numeric control points only for the hot demon layer (below). Path number formatting: keep raw `${x} ${y}` for base-10 output so the DOM-dump golden stays byte-identical; add an optional `fmt` (fixed precision) for procedural layouts and exports.

## Rendering Tiers (question 4)

### One props contract, N implementations

```typescript
// app/render/types.ts
export interface NumogramViewProps {
  model: NumogramModel                       // g + layout + routes + naming (immutable)
  view: { tx: number; ty: number; k: number }
  layers: ReadonlySet<Layer>
  focus: { selected: ReadonlySet<number>; highlight: Uint8Array | ReadonlySet<number> }
  demonMode: 'off' | 'focus' | 'matrix' | 'web'
  labels: LabelScheme
  onHover(f: Focus | null): void
  onPin(f: Focus): void
  onZoneClick(z: number): void
}
export type Focus =
  | { type: 'zone'; zone: number }
  | { type: 'syzygy'; pair: number }
  | { type: 'current'; pair: number }
  | { type: 'gate'; zone: number }
  | { type: 'demon'; a: number; b: number }
  | { type: 'cycle'; cycle: number }
```
This replaces `HoverInfo`, which currently carries whole data objects (`SyzygyData`, `GateData`, `Demon`). Migrate with `toHoverInfo(focus, model)` so `InfoDisplay` and panels keep working while lore is joined by id.

Headless is a function, not a component: `sceneToSvg(model, opts): string` and `sceneToJson(model): string` in `engine/scene`.

| Tier | Implementation | When | Notes |
|------|----------------|------|-------|
| T1 `SvgRichView` | Today's `Projection.tsx`, taking `model` instead of module imports; viewBox from `layout.bounds` instead of literal `800` | Base 10 always (fidelity); small n. Starting hypothesis: full effects to ~64 zones, reduced (no filters, no particles, demons in focus mode) to ~150 | Web guidance is "a few thousand SVG elements, then it degrades; >5,000 nodes lags" (LOW, blog sources); the spike sets the real number. Filters/gradients (`gl`, `sphere-N`) are the first things to drop |
| T2 `CanvasView` | 2D canvas: static layer cached to an offscreen bitmap (zones, syzygies, currents, gates), dynamic overlay for hover/selection; viewport culling; LOD | Medium to large n. Hypothesis: up to ~10^4 zones interactive, dot-mode beyond | Picking: uniform-grid index for zones; for edges an offscreen "id-color" picking canvas read via `getImageData` (O(1) hit-test at any edge count). Cache `Path2D` per route; invalidate on layout change only |
| T3 Headless | `sceneToSvg` / `sceneToJson`; CLI; export | Beyond interactive capacity, or export | At n=1e5 there are ~3e5 primitives; warn on file size, offer JSON |

`selectTier(n, override)` reads a **data table** (`engine/scene/tiers.ts`) filled from the ceiling spike, not constants scattered in components. A `tier=` URL param overrides for diagnostics.

**Culling and LOD (Canvas).** Precompute one `Float32Array` of route AABBs; per frame, linear scan `O(E)` (E ~ 2n; ~1 ms at n=1e5). Zoomed out: zones as 1-2 px `fillRect`, skip labels and gates, thin alpha edges. Label rule: render text only when screen node radius > ~7 px.

### Demon layer strategy (the real ceiling)

Never create one DOM/canvas primitive per demon by default. Four modes, all backed by `DemonSpace`:

1. **`off`**: default at any n >= ~40.
2. **`focus`**: draw only demons incident to selected/hovered zones (`incident(z)`, n-1 chords per zone) or a hovered type group; hard-cap at `maxDrawn` and sample. Works in SVG and Canvas.
3. **`matrix`** (the "Pandemonium Matrix"): a triangular raster where cell `(a,b)` is demon `a::b`. Fill a `Uint8ClampedArray` in `engine/scene/demonMatrix.ts` colored by subtype, hit-test by pixel -> `(a,b)` in O(1), zoom/pan by tile LOD (bin cells per pixel above ~2048 px, color by dominant subtype). n=1000 is 1M pixels for 499,500 cells. Compute in the worker for n >= ~2048. This is the only mode that shows *all* demons at n in the thousands.
4. **`web`** (all chords): Canvas only, n <= ~150 (~11k chords), drawn once into a cached offscreen bitmap and re-drawn only on layout/view change; hover highlight is a separate overlay. In SVG tier at n=10 it equals today's layer (40 non-syzygy paths).

Panels: replace list-all panels (Zones, Syzygies, Currents, Gates; today they map over module constants) with one windowed `VirtualList` (row height x index math; ~40 lines, no dependency) reading `g.*` lazily. The demon browser is a windowed list over `count = C(n,2)` rows via `at(mesh)`, sortable by mesh (native) or type group (unranking); no full materialization.

### Web Worker offloading

- Pure functions (`buildNumogram`, `layout.build`, `buildRoutes`, `demonMatrix`, `sceneToSvg`) run identically inline or in a worker. `computeClient` exposes one async API with an `InlineClient` (SSR, tests, small n) and a `WorkerClient`.
- Request/response are plain data (typed arrays, transferred, not cloned). Never send functions (DataCloneError). A monotonically increasing `requestId` discards stale replies when the user drags the base picker.
- Worker file at repo root `workers/engine.worker.ts` (outside `app/`, ends with `export {}`), created client-side only: `new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' })` with the `URL` expression literally inside the constructor (bundler static analysis; MEDIUM confidence, community field notes + Next's webpack5 note that web workers are supported). Use plain `next dev` (webpack); do not adopt `--turbo` without re-checking worker support.
- What actually needs the worker (measured cost is O(n) for everything except the matrix): matrix raster for n >= ~2048, name index (O(n^2), only when `count <= ~50k`), routing + layout at n >= ~5k, large SVG export. Engine build is ~30 ms at n=100,000, so it never needs one on its own.

## State and URL Model (question 6)

Today three places parse URLs independently: `NumogramClient` (inline `useEffect` on `window.location.search`), `app/lib/shareParams.ts` (strict canonicalizer used by the API route; throws on unknown keys; zone range hard-coded 0-9, max 10 entries), `app/numogram/page.tsx` (`parseSelectedIds`, 0-9), plus `NUMOGRAM_QUERY_KEYS` in `app/page.tsx`. Replace with **one** codec.

```typescript
// app/lib/urlState.ts
export interface UrlState { base: number; layout: string; selected: number[]; layers: Layer[]; region: RegionSel | null;
  tc: boolean; particles: boolean; date?: string; orbits?: boolean; digits: LabelScheme; demons: DemonMode;
  names?: string; tier?: 'auto' | 'svg' | 'canvas' }
export function parseUrlState(search: string): UrlState        // tolerant: unknown keys ignored, invalid values -> defaults
export function serializeUrlState(s: UrlState): string          // canonical: sorted keys, defaults omitted
```

| Param | Values | Default (omitted) | Compatibility note |
|-------|--------|-------------------|--------------------|
| `base` | even int >= 2 | 10 | **New.** Parsed first; everything else validates against it. Absent = 10, so every existing link keeps working |
| `layout` | base 10: `original|labyrinth|ladder|planetary`; any base: `ring|spiral|ladder|diameters` | base 10 -> `original`, else `ring` | Existing values unchanged. `ladder` means the hand preset at base 10, the procedural one elsewhere. Preset names at other bases fall back to the default with a visible notice |
| `selected` | comma list with ranges, e.g. `1-5,9,12-40` | none | Old plain lists parse identically. Ranges keep URLs short at large n; cap length and truncate with a notice |
| `layers` | `syzygies,currents,gates,pandemonium` | `syzygies,currents,gates` | unchanged |
| `region` | `torque|warp|plex|torque.N` | none | `torque` keeps its meaning (all Torque cycles); `.N` selects one cycle |
| `tc` | `1` | off | unchanged; means "all Torque zones" |
| `particles`, `date`, `orbits` | as today | as today | Honored only when `base=10 && layout=planetary` (particles too); ignored otherwise |
| `digits` | `alnum|dec|glyph` | `alnum` if base <= 36 else `dec` | **New.** Label scheme; open decision for bases > 36 |
| `demons` | `off|focus|matrix|web` | `off` (n >= 40) / `web` (n < 40) | **New** |
| `names` | `ccru` or `seed:<string>` | `ccru` at base 10 else `seed:0` | **New.** Full sound maps travel as JSON files, not URLs |
| `tier` | `auto|svg|canvas` | `auto` | **New**, diagnostic |
| `img` | url | - | Legacy; parsed and ignored (share-image backend removed) |

Add every new key to `NUMOGRAM_QUERY_KEYS` in `app/page.tsx` or shared links from `/` will not redirect. Keep live sync with `history.replaceState` (already what `NumogramClient` does; no history spam while dragging a base slider). Tests: a fixture corpus of legacy base-10 URLs must parse to the same state as the old inline code, plus round-trip property tests.

State hub decomposition (strangler, not rewrite): `NumogramClient` (1,943 lines today, not ~1,500) sheds, in this order, `useUrlState`, `useNumogramModel`, `useSelection` (selection, hover, region highlight derived from `g` instead of `ZONE_REGION`), `useHistory` (undo/redo). History snapshots gain `base`/`layout`; store large selections range-compressed (today `snapshotKey` is `JSON.stringify` of the whole snapshot). Load the client with `dynamic(..., { ssr: false })` (or a mounted gate) so first paint reads the URL before rendering instead of flashing base 10, and to avoid hydration mismatches in the static shell.

## Migration Plan (question 5): strangler with the base-10 golden as the net

Rule: **freeze the oracle before touching anything, then keep base 10 byte-identical at every step.**

| Step | Change | Safety net | Exit criterion |
|------|--------|-----------|----------------|
| M0 | Add Vitest 5 (`test.projects` or one node project) + `tsconfig` target es2017. **Freeze oracle**: dump old `SYZYGIES`, `CURRENTS` (normalized), `GATE_LIST`, `ALL_DEMONS` (with `kind`), `ZONE_REGION`, `TC`, `TC_EDGES`, `TC_SYZYGIES`, `TC_CURRENTS` to `engine/test/fixtures/base10.golden.json`. Capture Projection DOM (`outerHTML` of the `<svg>`) for 4 layouts x ~5 states (layers on, selection `{1,8}`, `tc`, pandemonium, region highlight) with a Playwright script run against the pre-refactor commit | Fixtures are committed and immutable (the live `app/data` will be refactored, so it cannot be the oracle) | Fixtures generated; tests run |
| M1 | Engine core + golden tests + property tests (all even n 2..2000 for structure; enumeration checks n <= 200; sampled `at`/`meshOf` round-trip beyond) | Fixtures | Engine equals oracle at base 10; guide facts hold (12/28/82/80; warp iff `n = 3o+1`, o odd; count `C(n,2)`) |
| M2 | Swap **data sources** behind unchanged component props: `app/data/{syzygies,currents,gates,demons}.ts` become views over the engine joined with lore by id; `TC`, `ZONE_REGION`, `TC_*` derived; `legacyKind()` adapter; `ALL_DEMONS` from `demons.at(0..44)` | DOM dump identical | Zero UI diff |
| M3 | **Extract** the two routing memos from `NumogramClient` into `engine/layout/routing.ts` verbatim first (pass `orientationCache`), then generalize (numeric keys, `cycle.kind`, `partner()`) | DOM dump identical after extraction, again after generalization | Zero UI diff; `NumogramClient` -350 lines |
| M4 | Add `base` to state and `urlState`; replace the ~40 `for (z <= 9)` loops and every `9 - x` with `g.base`/`partner`; `Projection` takes `model` instead of importing module constants; viewBox from `layout.bounds`; base-10 layouts move to `app/presets/base10` behind `LayoutSpec`; `hlZones` derived from `g` | DOM dump identical; legacy-URL corpus | Base 10 unchanged; `?base=` accepted but only 10 reachable in UI |
| M5 | Enable other bases: procedural `ring`, `spiral`, `ladder`, `diameters`; base picker + summary panel; label schemes; virtualized panels; SVG tier only, with tier warning past its threshold | Layout invariant tests; visual review of bases 2, 4, 6, 8, 12, 16, 28, 82 | Correct, legible diagrams for small/medium bases |
| M6 | Demon modes; Canvas tier; worker; tier table from the spike; export; naming UI | Perf harness from the spike | Degrades gracefully past thresholds |

Known base-10 hard-coding inventory to sweep in M4 (from `.planning/codebase/CONCERNS.md` plus this pass): `zonesForRegion`, `getShareFocusZones` (literal `[1,2,4,5,7,8]`), `hlZones`, `finalizeSelection`, `zoneOrder` literals, `zoneRadius` constants, `fitSelectionToView` and share crop (literal `800`), `useTween` (`z <= 9`, `P_ORIGINAL` initial refs), `useOrbitalAnimation`, `xenotationByZone` (`z <= 9`), `plexExpr` (`< 10`), `syzMidBiased` and `syzTrianglePoints` (`9 - zone`), the planetary gradient defs (`[1..9]`), `shareParams` (`n > 9`, `parts.length > 10`), and the `numogram/page.tsx` parser. Generalize `xenotationByZone` with an optional `count` param **without** importing the engine (component-library build constraint above).

## Static-Export Data Flow (question 7)

Everything is client-side: URL -> `parseUrlState` -> `buildNumogram(base)` (ms) -> `layout.build` -> `buildRoutes` -> `NumogramModel` -> renderer. No build-time data. Optional precomputed presets are unnecessary because the math is instant (30 ms at n=100,000).

Constraints confirmed in the official Next.js static-exports guide: unsupported are Route Handlers that rely on `Request`, dynamic routes without `generateStaticParams`, cookies, rewrites, redirects, headers, ISR, default image optimization, Server Actions; only `GET` handlers marked `dynamic = 'force-static'` work. Reading `searchParams` opts a page into dynamic rendering.

| Coupled piece | Location | Action |
|---------------|----------|--------|
| `POST /api/share-image` (uses `@vercel/blob`, `crypto`, `NextRequest`) | `app/api/share-image/route.ts` | **Delete.** A `POST` handler cannot export. Also delete `@vercel/blob`, `scripts/share-image-self-check.mjs`, the `test:share-image` script |
| `@vercel/analytics` `<Analytics/>` | `app/layout.tsx` | Remove, or gate behind `NEXT_PUBLIC_ANALYTICS=1` via `next/dynamic` so the default build has no dependency |
| `generateMetadata({ searchParams })` | `app/numogram/page.tsx` | Replace with static `metadata`. Per-share OG tags cannot exist in a static site; `img=` becomes ignored |
| Server-side `redirect()` on `searchParams` | `app/page.tsx` | Replace with a tiny client component that calls `location.replace('/numogram' + search)` in an effect |
| Share flow `fetch('/api/share-image')` + `captureShareDataUrl` | `NumogramClient` (~lines 945-1123) | Introduce `ShareImageProvider` (`null` default). Copy canonical URL; keep the SVG->Image->Canvas rasterizer as the basis of **PNG export** (it already exists and works) |
| `metadataBase: new URL('https://num.qliphoth.systems')` | `app/layout.tsx` | Read from `NEXT_PUBLIC_SITE_URL` |
| `next.config.js` | root | `output: 'export'` **unconditionally**, `trailingSlash: true`, `basePath` from env. Unconditional is a feature: any future API route or dynamic API fails `next build`, which is the guardrail for the "static, no server" constraint |
| `sitemap.ts`, `robots.ts` | `app/` | Verify they export under `output: 'export'` (may need `export const dynamic = 'force-static'`); check in step 0 |
| `build` = `build:plugin-zip && next build` and `prepare` = `build:components` | `package.json` | Split `build:static` (`next build` only). The gematria plugin zip is unrelated to this project; keep it only if that page is deployed |
| Lockfile: `yarn.lock` present, environment is npm 11 | root | Pick one and add `packageManager` before adding dependencies |

Verify empirically in the first phase: run `next build` with `output: 'export'` after the removals and record any remaining error (the exact Next 14.2 behavior for `searchParams` in export mode was not tested here; the docs state it forces dynamic rendering). Also `SHARE_PARAM_KEYS`/`canonicalizeShareParams` can stay as the canonical-URL builder once generalized; it no longer needs to throw.

## Naming Builder Data Model (question 8)

The guide's rule: give each zone a sound; a demon's name is the two zones' sounds joined, then edited for euphony. Base 10 already has the sounds: `ZONE_PARTICLE` in `app/data/zones.ts` (`eiaoung, gl, dt, zx, skr, ktt, tch, pb, mnm, tn`) matches the guide's phoneme list, and `DEMON_NAMES` holds the 45 canonical, partly-euphonized names.

```typescript
// engine/naming/schema.ts   (schema id "ccrug.naming/1")
export interface SoundMap {
  schema: 'ccrug.naming/1'
  base: number                          // even
  zones: string[]                       // length === base; zones[z] = sound for zone z
  join: { order: 'hi-lo' | 'lo-hi'; euphony: 'none' | 'vowel-epenthesis' }   // default hi-lo, matching a::b and the (9::8) example
  overrides?: Record<string, string>    // sparse; key "a::b" (decimal zone numbers), value = final name
  seed?: string                         // present iff auto-generated
  generator?: { id: string; version: number; style: string }
  meta?: { title?: string; author?: string; notes?: string; created?: string }
}
export const nameOf: (m: SoundMap, a: number, b: number) => string   // O(1); overrides win
```

Decisions:
- **Derived, never stored per demon.** `nameOf` is O(1); `overrides` is sparse. At n=1000 no 499,500-name array exists. The CCRU base-10 preset = `zones` from `ZONE_PARTICLE` + `overrides` = the 45 `DEMON_NAMES` (they are not derivable by rule; the guide says they are "partly explainable").
- **Keyed by zone index, not label.** Zone label schemes (`alnum`/`dec`/`glyph`) are a display concern in `engine/core/labels.ts`.
- **Seeded generator, deterministic across platforms:** 32-bit integer PRNG (`mulberry32`/`sfc32` seeded from a string hash via `Math.imul`), never `Math.random`. Recommended construction: `sound(z) = decode(perm_seed(z))`, where `perm_seed` is a seeded bijection on `[0, M)` (Feistel network with cycle-walking) over a phoneme inventory of size `M >= n`. This gives distinctness by construction, O(1) lazy per-zone generation, and prefix stability (changing `?base=` does not rename surviving zones). Treat this as a design proposal to validate in the naming phase; the fallback is a seeded Fisher-Yates over a lazily extended syllable inventory (loses prefix stability).
- **Euphony** is a deterministic rule pass (vowel epenthesis between consonant clusters, style table). The guide's own example ("Xthnlghth" -> "Xathnalgaheth") is a target shape, not a spec.
- **Validation:** hand-written `validateSoundMap(json): Result<SoundMap, Issue[]>` (engine stays dependency-free) plus a published `schema.v1.json` for external tools; test that both agree on a fixture corpus. Import with a mismatched `base` is refused with an explanatory message (offer "regenerate from seed").
- **Persistence/sharing:** JSON export/import via `Blob` download and file input; optional `localStorage` keyed `ccrug.naming.v1.<base>`; URL carries only `names=ccru|seed:<s>`.

## Suggested Build Order and Dependencies

```
0a test infra + tsconfig + engine scaffold + lint rules ---+
0b freeze oracle (fixtures + DOM dumps) -------------------+--> 1 engine core + golden tests
0c static-export decoupling (independent) ------------------ (parallel, no dependency on engine)
                                                              |
                     1 engine core --> 2 swap base-10 data sources (strangler)
                                              |
                                        3 layout + routing: extract, generalize, procedural layouts, preset registry
                                              |                         \
                                              |                          3b CEILING SPIKE (harness on synthetic scenes; needs 3 only)
                                              v                                   |
                              4 UI generalization: model prop, urlState, base picker, labels, virtualized panels (SVG tier)
                                              |                                   |
                        +---------------------+------------------+                v
                        v                                        v          6 Canvas tier + worker + tier table
                  5 demons layer (focus, list, matrix)      7 naming builder UI  (pure naming module can start right after 1)
                        \                                        |                 |
                         +---------------------------------------+-----------------+
                                              v
                                       8 export (SVG/PNG/JSON) + CLI    (CLI only needs 3; export PNG needs 4/6)
                                              v
                                       9 hardening: history with base, a11y, docs
```

| # | Phase | Depends on | Delivers | Research flag |
|---|-------|-----------|----------|---------------|
| 0a | Test infra + scaffold | none | Vitest 5, es2017 target, `engine/` skeleton, lint boundary, `typecheck:engine` | Standard |
| 0b | Freeze oracle | none | Golden JSON + DOM dumps from the pre-refactor commit | Standard; do it **first**, before any refactor |
| 0c | Static decoupling | none | `output: 'export'` builds; route/analytics/redirect/metadata removed | Verify Next 14.2 export behavior with a real build |
| 1 | Engine core + golden | 0a, 0b | Zones, pairs, cycles, gates, demon space, counts, labels; property tests | Standard (math verified) |
| 2 | Base-10 data swap | 1, 0b | App data derived from engine; zero UI diff | Standard |
| 3 | Layout + routing | 2 | Extracted pure routing; `ring`/`spiral`/`ladder`/`diameters`; preset registry; layout invariant tests | **Needs visual iteration** (legibility is subjective; core value says unreadable = failure) |
| 3b | Ceiling spike | 3 | Measured thresholds table for tiers; frame time and memory per tier | **Yes**: all thresholds here are hypotheses. Do this *before* committing to Canvas details |
| 4 | UI generalization (SVG tier) | 3 | `?base=`, base picker, summary, labels, virtual panels | Label scheme for bases > 36 (open decision) |
| 5 | Demons layer | 1, 4 | Focus mode, virtual list, matrix raster, hit-testing | Matrix tiling/LOD at n >= 4k |
| 6 | Canvas tier + worker | 3b, 4 | `CanvasView`, picking buffer, worker client, `selectTier` | Picking approach and worker bundling in Next 14 |
| 7 | Naming builder | 1 (pure), 4-5 (UI) | Schema, generator, euphony, editor, import/export | Generator quality; Feistel construction |
| 8 | Export + CLI | 3 (CLI), 4/6 (PNG) | SVG, PNG, JSON; `tsx` CLI | Standard |
| 9 | Hardening | all | History across bases, a11y, perf regressions, docs | Standard |

Ordering rationale: correctness (core value) gates everything, so 0b/1/2 come first and stay green. 0c is free parallel work and de-risks deployment early. The spike (3b) needs only layout and routes, and its output decides Canvas and worker scope, so it belongs right after 3 rather than at the end. Naming's pure module depends only on the engine and can run in parallel with 2-4.

## Architectural Patterns

### Pattern 1: Eager O(n) core, virtual O(n^2) periphery
**What:** Materialize only per-zone/per-pair typed arrays; expose demons as index math (`at`, `meshOf`, `group`, `incident`).
**When:** Any structure whose size is quadratic in the base.
**Trade-offs:** No cheap "list all demons sorted by name" at large n; accepted, documented, and gated by `count`.

```typescript
// mesh <-> net-span, exact for a > b, m < 2^53/8
const isqrt = (x: number) => { let r = Math.floor(Math.sqrt(x)); while (r*r > x) r--; while ((r+1)*(r+1) <= x) r++; return r }
export const meshOf = (a: number, b: number) => (a * (a - 1)) / 2 + b
export function netSpanOf(m: number): [number, number] {
  let a = Math.floor((1 + isqrt(8 * m + 1)) / 2)
  while ((a * (a - 1)) / 2 > m) a--
  while ((a * (a + 1)) / 2 <= m) a++
  return [a, m - (a * (a - 1)) / 2]
}
```

### Pattern 2: Pure scene pipeline with swappable backends
**What:** `model -> scene -> backend`; cold layers carry SVG path strings (portable to SVG, `Path2D`, export), the hot demon layer carries numeric primitives.
**When:** Same diagram must render interactively, as a file, and in a worker.
**Trade-offs:** Two geometry representations; contained because only the demon layer uses numeric control points.

### Pattern 3: Preset as a plug-in of the same interface
**What:** Hand-authored base-10 art registers as `LayoutSpec`/lore/naming providers. Procedural and preset share `resolveLayout`.
**When:** Preserving bespoke content inside a generalized system.
**Trade-offs:** The preset must express its quirks (zone order, region labels, heights) as data, which is a small one-time cost and is exactly what makes the DOM-dump golden possible.

### Pattern 4: Frozen oracle + strangler
**What:** Freeze old outputs as immutable fixtures; replace one data source or function at a time; diff DOM after each step.
**When:** Refactoring a 1,900-line stateful component with no tests.
**Trade-offs:** Up-front cost in step M0; pays for itself at the first regression.

## Data Flow

```
URL ?base=&layout=&selected=...
  --> parseUrlState (tolerant, validates against base)
  --> useNumogramModel(base, layoutId)
        [inline if n small | Worker if n large; drop stale by requestId]
        buildNumogram(base)         O(n)   typed arrays
        layout.build(g)             O(n) or O(n + k^2)
        buildRoutes(g, layout)      O(n)   path strings keyed by pair/zone id
        naming(seed | ccru preset)  O(1) per name, lazy
      --> NumogramModel (immutable, cached; LRU of ~3 bases)
  --> Scene = model + view(tx,ty,k) + interaction(selected, hover, layers, demonMode)
  --> selectTier(n, override) --> SvgRichView | CanvasView   (or sceneToSvg for export/CLI)
  <-- Focus events (hover/pin/click) --> useSelection/useHistory --> replaceState(serializeUrlState)
Panels/InfoDisplay: read g.* lazily (virtualized), join base-10 lore by id
```

### Key Data Flows

1. **Base change:** picker -> `UrlState.base` -> new model request -> stale results dropped -> crossfade (no position tween across different n).
2. **Hover a demon:** renderer hit-test (DOM event in SVG; pixel/grid/picking buffer in Canvas) -> `Focus{demon a,b}` -> `DemonSpace.ref(a,b)` -> `nameOf(map,a,b)` -> `InfoDisplay`. No per-demon objects exist beforehand.
3. **Export:** current model -> `sceneToSvg` (pure; worker for large n) -> download; PNG via rasterize (SVG tier) or `canvas.toBlob` (Canvas tier); JSON via `sceneToJson`.

## Scaling Considerations

| Scale (base n) | Architecture adjustments |
|----------------|--------------------------|
| n <= 36 | T1 SVG with full effects; alnum labels; demons in `web` mode up to ~n=20, `focus` beyond; ring layout; all inline (no worker) |
| n ~ 100-150 | SVG without filters/particles or Canvas (spike decides); demons focus + matrix; 4,950-11,175 demons virtual; multiple Torque cycles (base 100: 6) packed |
| n ~ 1,000 | Canvas + LOD; matrix raster 1,000 x 1,000 (500k demons); worker for layout/routes optional; dozens of cycles (n=1024: 54) |
| n ~ 10,000 | Canvas dot-mode LOD; matrix binned to <= 2,048 px; worker required for matrix/layout; ~50M demons stay virtual |
| n >= 100,000 | Headless (SVG/JSON export, CLI); interactive view is overview only; engine still ~30 ms. `assertSafeBase` at 2^26 |

### Scaling Priorities

1. **First bottleneck:** demon layer, then SVG node count (`ALL_DEMONS` as DOM: 4,950 demons -> ~9,900 paths at base 100 even before zones). Fix: demon modes + never one primitive per demon.
2. **Second:** React re-render churn on the state hub (object-identity props into a memoized `Projection`, `JSON.stringify` history keys). Fix: stable memoized `model`, range-compressed selections, canvas overlay layer for hover.
3. **Third:** cycle count at high base (n=4096: 178 rings). Fix: glyph packing (already cheap).

## Anti-Patterns

### Anti-Pattern 1: Module-level materialization of demons
**What people do:** Keep `ALL_DEMONS` (a top-level `for` loop storing `{a,b,name,kind}` objects) and generalize the loop bound.
**Why it's wrong:** 499,500 objects at n=1000 allocated at import time even if the layer is off; blocks first paint.
**Do this instead:** `DemonSpace` with index math; `Demon = {a,b}` at most; names and types derived on demand.

### Anti-Pattern 2: Generalizing by name-keyed special cases
**What people do:** Extend `c.name === 'Warp' || c.name === 'Plex'` and `layout === 'ladder'` string checks.
**Why it's wrong:** Names are base-10 lore; there is no "Warp" current at base 12, and there can be dozens of Torque cycles.
**Do this instead:** Key by numeric id; branch on `cycle.kind` and `Layout.routing.style`.

### Anti-Pattern 3: Impure state inside memo/extraction seams
**What people do:** Keep `currentOrientationRef` mutation inside `useMemo`.
**Why it's wrong:** Cannot move to a worker or a CLI; results depend on call history.
**Do this instead:** Pass an explicit `orientationCache` into `buildRoutes`; make it part of the model cache.

### Anti-Pattern 4: `Record<number, Pos>` and `Set` everywhere at scale
**What people do:** Keep per-zone object maps.
**Why it's wrong:** GC pressure and slow structured clone at 1e5 zones.
**Do this instead:** `Float64Array` SoA in the engine; adapters only at the small-n SVG boundary.

### Anti-Pattern 5: Using the live hand-authored data as the golden oracle
**What people do:** Compare engine output to `app/data/*` that is simultaneously being refactored.
**Why it's wrong:** The oracle moves with the refactor; a shared bug passes.
**Do this instead:** Frozen fixtures committed before step M2.

### Anti-Pattern 6: Copying counts from the guide's prose
**What people do:** Encode "4 syzygetic xenodemons" from the text.
**Why it's wrong:** The guide's own tally sums to 47; the combinatorial count is 2.
**Do this instead:** Assert closed forms against enumeration and `C(n,2)`.

### Anti-Pattern 7: Building a workspace before there is anything to publish
**What people do:** `packages/engine` plus `transpilePackages` and lockfile juggling on day one.
**Why it's wrong:** Adds tooling risk in a repo with an ambiguous lockfile and install-time build hooks.
**Do this instead:** Folder + alias with enforced boundary; convert when publishing.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel Blob / `/api/share-image` | Removed; optional `ShareImageProvider` behind an env-configured endpoint | Static export forbids `POST` handlers |
| Vercel Analytics | Removed or env-gated dynamic import | Not needed for generator |
| Browser: Web Worker, Canvas 2D, `Path2D`, `CompressionStream` (optional) | Feature-detect; inline fallback for workers | OffscreenCanvas optional for worker-side raster |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `engine/*` <-> `app/*` | Import one direction only (`app` -> `engine`); typed arrays and plain data | Enforced by lint + `typecheck:engine`; engine relative imports only |
| `app/model` <-> worker | `postMessage` of plain data, transferables, `requestId` | Worker file outside `app/`; no functions in messages |
| Presets <-> engine | Presets implement `LayoutSpec`, lore lookups by numeric id, `SoundMap` JSON | Presets never import engine internals beyond public `index.ts` |
| `NumogramClient` <-> render tiers | `NumogramViewProps` | Same contract for SVG and Canvas; tier chosen by `selectTier` |
| `urlState` <-> everything | Single codec; `serialize` on state change, `parse` once on load | Replaces `shareParams.ts` parsing, `page.tsx` parsing, and inline hydration |
| `xenotation.ts` <-> component library | Self-contained; do not import `engine/` | `tsconfig.components.json` compiles it separately |

## Open Questions and Gaps

- **Tier thresholds** (zones, paths, demons vs frame time and memory): hypotheses only. The spike (3b) must produce the table before Canvas details are fixed.
- **Ring layout visual quality** at 10-60 cycles: packing is cheap and correct-by-construction for adjacency, but legibility (label collision, routing of currents between adjacent glyph nodes, Y-shape junction placement) needs visual iteration.
- **Multi-Torque demon subtypes**: the guide allows splitting chrono/amphi by Torque index or leaving them merged; the model carries `torqueA/torqueB` so either can be chosen in UI. Product decision needed.
- **Zone labels beyond base 36**: recommend decimal numerals with `alnum` up to 36; glyph set optional. Open decision from PROJECT.md.
- **Next 14.2 export behavior** for `searchParams`, `redirect()`, `sitemap.ts`, `robots.ts` was taken from docs, not from a build; confirm in phase 0c.
- **Worker bundling under Next 14 webpack** is documented for webpack 5 generally; confirm with a real build including `type: 'module'`.
- **Naming generator** Feistel/cycle-walking construction is a proposal; validate distinctness and pronounceability in the naming phase.
- **Direction of Torque flow around the ring** (anticlockwise per existing lore text) and whether Plex sits at the center vs bottom (as in the base-10 `original`) are aesthetic choices to confirm with the user.

## Sources

- `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONCERNS}.md` (HIGH: project's own analysis)
- `reference/INDEX.md` and `reference/genius-guide-diy-numogram-demonology.txt` (HIGH for math; note the "4 Syzygetic Xenodemons" typo at line 144)
- Existing code read for this pass: `app/NumogramClient.tsx` (state, URL hydration, gate/current memos, share flow), `app/components/projection/Projection.tsx` (props, module imports, viewBox 800), `app/data/{types,demons,gates,currents,syzygies,positions,zones}.ts`, `app/lib/{shareParams,geometry,numogram,constants,xenotation}.ts`, `app/hooks/useTween.ts`, `app/page.tsx`, `app/numogram/page.tsx`, `app/layout.tsx`, `app/api/share-image/route.ts`, `package.json`, `tsconfig.json`, `tsconfig.components.json`, `next.config.js`, `.eslintrc.json`
- Next.js static exports guide and Route Handler docs (Context7 `/websites/nextjs`; https://nextjs.org/docs/app/guides/static-exports) (HIGH)
- Next.js `searchParams` opts into dynamic rendering (Context7 `/websites/nextjs`, layouts-and-pages) (HIGH)
- Next.js webpack 5 message noting web worker and `new URL(..., import.meta.url)` support: https://nextjs.org/docs/messages/webpack5 (MEDIUM)
- Web Workers in the Next.js App Router field notes (literal `new URL` in constructor, `{type:'module'}`, worker outside `app/`, `export {}`, DataCloneError): https://dev.to/ahmed_mahmoud360/web-workers-in-the-nextjs-app-router-field-notes-on-importmetaurl-datacloneerror-and-what-a-ood (MEDIUM)
- Vitest projects config and `vite-tsconfig-paths` guidance (Context7 `/vitest-dev/vitest`); `npm view vitest` = 5.0.2, engines Node `^22.12 || ^24 || >=26` (HIGH)
- Node.js type stripping default-on in 22.18.0, behind a flag on 22.6-22.17: https://github.com/nodejs/node/releases/tag/v22.18.0 and https://nodejs.org/api/typescript.html (HIGH)
- SVG vs Canvas guidance (few thousand SVG nodes then degradation; cache `Path2D`): https://dev.to/vitalf/svg-vs-canvas-vs-webgl-for-diagram-viewers-tradeoffs-bottlenecks-and-how-to-measure-34n7 and https://www.sitepoint.com/canvas-vs-svg/ (LOW; general guidance, to be replaced by the spike)
- Throwaway verification scripts (session scratchpad): cycle structure over even n <= 4000, demon type closed forms vs enumeration, mesh round-trip, torque circuit walk vs `TC_EDGES`, gate table vs `GATE_LIST`, ring radius and circle-packing timings, TS2802 reproduction under `target: es5` (HIGH: reproduced)

---
*Architecture research for: arbitrary-base numogram generator integrated into lumpenspace/ccru*
*Researched: 2026-09-25*
