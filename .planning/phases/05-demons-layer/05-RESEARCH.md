# Phase 5: Demons Layer - Research

**Researched:** 2026-09-29
**Domain:** Virtualized data browsing + custom 2D canvas raster visualization of a combinatorial space (C(n,2) demons), on top of an already-complete pure engine
**Confidence:** MEDIUM-HIGH (engine contract and stack choices are HIGH/VERIFIED; the matrix LOD algorithm is an original architecture proposal, MEDIUM, flagged for a planning-time spike)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (UI Placement):** The demons layer gets a dedicated large panel/overlay, separate from the existing small fixed-width side panels (Zones, Syzygies, Currents, Gates, Regions, Layers, Labels). It needs real estate a ~300px `CyberPanel` can't give a virtualized 221,445-row browser and a triangular matrix.
- **D-02 (Demon Browser, DEM-02/DEM-05):** Browser columns: `a::b`, mesh number, type/subtype, and a name column. The name column is always present in the table shape — it shows the CCRU name at base 10 and stays empty (not hidden) at every other base, so switching base never changes the table's column layout.
- **D-05 (Facets, DEM-01):** Type facets (closed-form counts per type/subtype, e.g. base 28: 378 demons, 108 cross-Torque chrono) are presented as clickable filter chips directly above the browser. The facet display and the filter control are the same UI element — clicking a chip filters the browser to that type/subtype, there is no separate read-only summary plus independent filter control.
- **D-03 (Focus Mode, DEM-03):** Focus mode has two entry points feeding one shared state: clicking a zone in the SVG diagram shows all n-1 of that zone's demons as chords; clicking a demon row in the browser shows that single demon's chord and highlights its two zones in the diagram. Both directions must work — diagram-to-browser and browser-to-diagram.
- **D-06 (Triangular Matrix, DEM-04):** The matrix is color-coded by demon type/subtype, using the same palette as the diagram's existing kind colors (chrono/amphi/xeno/syzygy). Hovering a cell shows `a::b` / mesh number / type in a tooltip; clicking pins it to the detail panel — mirrors the diagram's existing hover/pin interaction pattern from Phase 4 (`InfoDisplay.tsx`'s pin/hover model). Must support zoom/pan so no cell is ever un-inspectable at large n — the LOD/tiling mechanics for n >= ~4k are for research to determine (this phase's research task), but the color-by-type encoding and hover/click interaction model are locked now.
- **D-04 (All-Chords Web Ceiling):** Accept `allChordsMaxN = 80` (measured in Phase 3, `engine/scene/tier-table.json`) as a hard cutoff for the all-chords "web" view — no edge-bundling implementation in this phase. Above n=80, users rely on focus mode + matrix + search instead of the full web.
- **D-07 (URL State):** The active type/subtype filter and a focused/pinned demon or zone are shareable via URL, consistent with how `isolate=`/`mute=`/`selected=` already work. Matrix pan/zoom position is local-only, not part of the URL — matching how the main diagram's own zoom/pan state isn't in the URL either.

### Claude's Discretion

- Exact chip ordering/styling for type facets.
- Matrix LOD/tiling algorithm at n >= 4k (this phase's explicit research task — see Architecture Patterns below).
- Exact column widths and sort-affordance styling in the browser.
- Whether the demon panel's open/closed state is itself part of the URL (see D-07).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. No todos matched this phase (`gsd-sdk query todo.match-phase 5` returned zero matches). Worker offload of compute for very large n (Phase 6), Canvas tier for the *main diagram* (Phase 6), naming builder / user-assigned demon names (Phase 7), and export (Phase 8) are explicitly out of scope for Phase 5.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEM-01 | The demons layer shows type facets with closed-form counts at any base, including cross-Torque sub-facets | `g.demons.typeCounts()`/`g.demons.counts()` already implement this in closed form (`engine/core/demons.ts`'s `closedForms()`), O(number of Torque cycles), no new engine work — see Architecture Patterns and Don't Hand-Roll |
| DEM-02 | A virtualized demon browser supports sort, filter, and search by `a::b` or mesh number over C(n,2) rows without rendering them all | TanStack Virtual + the `{count, at(k)}` adapter over `DemonSpace`/`DemonSelection` (identical shapes) — see Standard Stack, Architecture Patterns, Code Examples |
| DEM-03 | Focus mode draws one zone's n-1 demons as chords, and a selected demon draws its own chord | `g.demons.incident(zone)` (generator, O(base) per zone) already exists; shared focus state via `NumogramViewContext` or a sibling context — see Architecture Patterns |
| DEM-04 | A triangular demon matrix with pick-by-pixel lets the user see and inspect every demon at large n | Viewport-resolution raster (Canvas 2D `ImageData`, no WebGL per Phase 3's D-12), exact hover/click resolve independent of raster LOD — see Architecture Patterns (matrix LOD spec, this phase's explicit research mandate) |
| DEM-05 | Base 10 shows its 45 canonical CCRU demon names | `app/presets/base10/lore.ts`'s `DEMON_NAMES[mesh]`, joined by id exactly as `app/presets/base10/demons.ts`'s `buildDemons()` already does (that file's own header comment says Phase 5 replaces it with the engine-driven browser) — see Code Examples |

</phase_requirements>

## Summary

Phase 5 is UI and rendering work on top of an already-complete, already-tested engine. `engine/core/demons.ts`'s `DemonSpace` gives O(1)-or-O(log C(n,2)) access to any demon by mesh number or net-span, closed-form counts per type and subtype (including the cross-Torque sub-facet named in DEM-01), and pre-built unranking (`group()`/`subtype()`) that returns a demon-selection object with the *exact same shape* as the full space: `{ count, at(k) }`, always in ascending mesh order. This structural identity is the single most important fact for planning Phase 5: a browser row source, a facet's filtered view, and the full unfiltered space are all interchangeable through one two-method interface, so "filter" is just swapping which object plays that role, and "sort" (per DEM-02's literal ask — sort by `a::b` or mesh number, which are the same total order) is just an ascending/descending toggle that reverses the index before calling `.at()`. No engine changes, no new sort algorithm, and no materialization are needed anywhere in this phase.

The other load-bearing fact is that `useNumogramView()` already exposes the raw `Numogram` (`g`) in context independent of `view`, and `view` is `null` above the measured SVG-tier ceiling (`svgRichMaxN = 200`). Base 666 — the phase's own headline example — is therefore a base with **no diagram rendered at all** in the current app (Phase 6 hasn't shipped the Canvas tier yet). The demons panel, its facets, its browser and its matrix must all be built from `g` directly, exactly the way `app/presets/base10/demons.ts`'s own header comment anticipates ("Phases 4 and 5 replace this list with the engine-driven demon browser"), and must remain reachable from the header/toolbar the same way Zones/Syzygies/Currents/Gates panels already are (those are not gated behind `showDiagram`).

The genuinely open problem — and this phase's explicit research mandate — is the triangular matrix's LOD at n >= ~4k. The roadmap's hypothesis ("viewport-resolution raster with dominant-subtype binning") is directionally validated by the closest real precedent, Hi-C contact-matrix browsers (HiGlass, Juicebox), which render exactly this shape of data (large symmetric/triangular numeric matrices) via tile pyramids sized to the viewport rather than the data. This project's situation is actually *simpler* than HiGlass's: HiGlass aggregates empirical counts that must be precomputed and stored, because computing a bin's contents requires reading real data; this project's demon classification is a pure O(1) function of two zone indices (`buildDemon` in `engine/core/demons.ts`), so a matrix tile can be rendered by direct point-sampling at render time, with no server, no precomputed pyramid, and no persistent cache required for a first implementation. The concrete, implementable design below (raw `ImageData` writes, sampled at canvas-pixel resolution, redrawn on pan/zoom-end, with exact hover/click resolution computed independently of the raster) keeps compute cost bounded by *viewport pixel count*, not by n or by demon count — the same complexity class the project already enforces everywhere else in `engine/`.

**Primary recommendation:** Build the demon browser on `@tanstack/react-virtual` (`count`-based, no row array) over a `{count, at(k): DemonRef}` source that is one of `g.demons`, `g.demons.group(type)` or `g.demons.subtype(subtype)`, reversed for descending sort by index arithmetic only. Build the matrix as a plain `<canvas>` (no WebGL — Phase 3 already decided `webglDecision.adopt = false`) that point-samples `buildDemon`-equivalent classification per output pixel into an `ImageData` buffer, redrawn on pan/zoom-end using the same hand-rolled pan/zoom state pattern the main diagram already uses (`app/hooks/useCanvasPan.ts`'s `useCanvasZoom`), with hover/click always resolving the exact cell from the current transform (never from the raster), so D-06's "no cell ever un-inspectable" holds at every zoom level by construction.

## Architectural Responsibility Map

This project is a static client-only app with no server tiers (FND-03: `output: 'export'`, no server routes). The standard Browser/SSR/API/CDN/DB tiers don't apply; the project's real architectural layers are **Engine** (pure, `engine/core`), **View-model adapter** (`app/lib`, joins engine output with lore/presets by id), and **UI/Rendering** (React components, SVG today, Canvas for the matrix in this phase). The table below maps Phase 5's capabilities onto those three layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Closed-form type/subtype counts (DEM-01) | Engine | — | `DemonSpace.typeCounts()`/`counts()` already closed-form; UI only reads and renders as chips |
| Demon-by-mesh / demon-by-net-span lookup (DEM-02) | Engine | — | `DemonSpace.at(mesh)` / `.ref(a,b)`, O(1) |
| Type/subtype-filtered ascending-mesh selection (DEM-02, D-05) | Engine | — | `DemonSpace.group(type)` / `.subtype(subtype)`, O(log C(n,2)) per `at(k)` (O(K log n) extra for cyclic/cross-torque — see Common Pitfalls) |
| Row virtualization / windowing (DEM-02) | UI/Rendering | View-model adapter | TanStack Virtual owns *which rows are in the DOM*; the adapter owns *which demon corresponds to index k* |
| Sort direction, active filter, search parse (DEM-02) | View-model adapter | UI/Rendering | Thin, custom glue (index-reversal, regex parse, binary search over `at(k).mesh`) — deliberately NOT a generic table library (see Don't Hand-Roll) |
| Name join for base 10 (DEM-05) | View-model adapter | — | `DEMON_NAMES[mesh]` from `app/presets/base10/lore.ts`, joined by id, exactly like every other Phase 2 swap |
| Focus-mode shared state (DEM-03) | UI/Rendering | View-model adapter | Needs a context reachable from both the SVG diagram and the browser table — same shape as existing `hlZones`/`selZones`/`pinnedInfo` state already threaded through `NumogramClient.tsx` |
| Chord drawing for a zone's incident demons or one demon (DEM-03) | UI/Rendering | Engine | `Projection.tsx`'s existing Pandemonium layer draws chords from `DemonRef`-shaped data already; generalize its data source, don't rebuild its rendering |
| Matrix raster classification (DEM-04) | Engine | UI/Rendering | Classification logic is `buildDemon`'s O(1) region-membership math; the canvas layer only samples it per pixel |
| Matrix pan/zoom/tiling/LOD (DEM-04) | UI/Rendering | — | Pure presentation concern; reuses the existing pan/zoom pattern (`useCanvasPan.ts`) |
| Matrix hover/click exact resolve (DEM-04, D-06) | UI/Rendering | Engine | Screen px -> (a,b) via the current transform (UI), then `g.demons.ref(a,b)` for the authoritative `DemonRef` (Engine) — never read back from the raster |
| URL state for active filter / focused demon (D-07) | View-model adapter | — | Extends `app/lib/shareParams.ts`'s existing lenient-per-field codec, same pattern as `isolate=`/`mute=`/`selected=` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-virtual` | ^3.14.13 [VERIFIED: npm registry, `npm view @tanstack/react-virtual version` → 3.14.13, checked 2026-09-29] | Windowed rendering of the demon browser table | Headless (no imposed markup, fits this project's hand-styled `CyberPanel` aesthetic); its core API is `count` + `getScrollElement` + `estimateSize` + `getVirtualItems()` [CITED: tanstack.com/virtual/latest/docs/framework/react/react-virtual, fetched 2026-09-29] — `count`-based, not array-based, which matches `DemonSpace`'s `{count, at(k)}` shape exactly with zero adapter glue; already the name-checked choice in `ROADMAP.md`'s Phase 5 notes |

**Installation:**
```bash
npm install @tanstack/react-virtual
```

### Supporting

None required. No new charting/table/gesture library is needed — see Don't Hand-Roll for why `@tanstack/react-table` and a pan/zoom library (e.g. `d3-zoom`) are both deliberately *not* added.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-virtual` | `react-window` (2.3.3, unpacked ~243 KB incl. all formats/types [VERIFIED: npm registry]) | Smaller conceptual surface, very mature, but fixed-size-only API, effectively unmaintained since ~2019 [MEDIUM confidence: WebSearch, multiple sources agree], and array-based (`itemData`) rather than `count`-based — would need an adapter shim anyway. Viable fallback if `@tanstack/react-virtual` hits an unexpected React 18/Next 14.2 issue, but no reason found to prefer it. |
| `@tanstack/react-virtual` | `react-virtuoso` | Richer built-in features (sticky headers, grouping, dynamic-height measurement) but heavier and more opinionated about markup; none of its extra features are needed since every row is fixed-height and the data source is already index-addressable [MEDIUM confidence: WebSearch comparison, not independently verified against this project's exact bundle] |
| Canvas 2D raster (matrix) | WebGL (PixiJS or raw) | Would render more pixels per frame, but Phase 3's ceiling spike already produced an explicit `webglDecision.adopt = false` (D-12, `engine/scene/tier-table.json`) because Canvas 2D stayed in budget to n=4000 for the *main diagram*; introducing WebGL for the matrix alone would contradict that locked project decision without new measurement to justify it [VERIFIED: engine/scene/tier-table.json, `.planning/STATE.md` Phase 3 P10 entry] |
| Canvas 2D raster (matrix) | SVG `<rect>` grid | Infeasible at scale — a rect per matrix cell reintroduces exactly the "one DOM/canvas primitive per demon" anti-pattern the phase notes explicitly forbid; at n=666 alone that's 221,445 nodes, worse than the already-rejected all-chords web |
| Hand-rolled sort/filter glue | `@tanstack/react-table` | Table libraries assume you can materialize/slice an array of rows to sort or filter it; this dataset is virtual (`DemonSpace` has no array to hand to a table engine), and the only sort axis that matters (mesh order) is already the space's native order, so a full table engine would add bundle weight to solve a problem this domain doesn't have — see Don't Hand-Roll |

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │   Numogram (g) — engine/core, from context   │
                         │   g.demons : DemonSpace                      │
                         │     .typeCounts() / .counts()  (closed-form) │
                         │     .at(mesh) / .ref(a,b)      (O(1))        │
                         │     .group(type) / .subtype(s) (O(log C))    │
                         │     .incident(zone)            (O(base))     │
                         └───────────────┬───────────────────────────────┘
                                         │ read-only, no allocation of C(n,2) rows ever
                                         ▼
                    ┌────────────────────────────────────────────────┐
                    │  app/lib/demonBrowser.ts  (new, view-model layer)│
                    │                                                  │
                    │  DemonRowSource = { count: number;               │
                    │                     at(k: number): DemonRef }    │
                    │  activeFacet(g, type|subtype|null) → RowSource   │
                    │  orderedIndex(source, k, descending) → DemonRef  │
                    │  rankOfMesh(source, mesh) → k | null  (binary    │
                    │              search over source.at(k).mesh)      │
                    │  toRow(demon, base, loreNames|null) → BrowserRow │
                    │        { a, b, mesh, type, subtype, name }       │
                    └───────┬───────────────────────┬──────────────────┘
                            │                        │
              facet chips /│                        │ orderedIndex(k)
              filter state │                        │ per visible row
                            ▼                        ▼
      ┌───────────────────────────┐    ┌───────────────────────────────────┐
      │  DemonFacets (D-05)        │    │  DemonBrowser (DEM-02)             │
      │  chips = clickable filter  │    │  @tanstack/react-virtual           │
      │  = the display, no second  │    │  useVirtualizer({ count: source.   │
      │  read-only summary         │    │    count, getScrollElement,        │
      │                            │    │    estimateSize })                 │
      └───────────────────────────┘    │  search: parse text → mesh/(a,b)   │
                                        │    → rankOfMesh → scrollToIndex    │
                                        └───────────┬─────────────────────────┘
                                                     │ row click → onPinInfo({type:'demon', demon})
                                                     ▼
      ┌──────────────────────────────────────────────────────────────────┐
      │  Shared focus/selection state (DEM-03)                            │
      │  existing hlZones / selZones / pinnedInfo in NumogramClient.tsx,   │
      │  or a sibling DemonFocusContext if it must live above that tree   │
      └───────┬───────────────────────────────────────┬────────────────────┘
              │ zone clicked in SVG (existing)          │ demon row clicked
              ▼                                         ▼
   ┌────────────────────────┐              ┌─────────────────────────────┐
   │ Projection.tsx          │              │ InfoDisplay.tsx DemonInfo   │
   │ Pandemonium layer        │◄────────────┤ (existing, extend data      │
   │ generalized: draws       │  same        │ source only)                │
   │ g.demons.incident(zone)  │  HoverInfo   └─────────────────────────────┘
   │ or a single g.demons.    │  shape
   │ ref(a,b) chord           │
   └────────────────────────┘

      ┌──────────────────────────────────────────────────────────────────┐
      │  DemonMatrix (DEM-04) — independent of the above, works even      │
      │  when `view` is null (base 666, no SVG diagram shown at all)      │
      │                                                                   │
      │  <canvas> sized to panel viewport, backed by ImageData            │
      │  pan/zoom state: { scale, tx, ty } (reuse useCanvasPan pattern)   │
      │                                                                   │
      │  on pan/zoom END (debounced):                                    │
      │    for each output pixel (px,py):                                │
      │      (a,b) = inverseTransform(px,py)      // O(1)                │
      │      if b >= a: background                                       │
      │      else: kind = pointClassify(g, a, b)  // O(1), buildDemon-eqv│
      │      writeImageData(px,py,paletteColor[kind])                    │
      │    ctx.putImageData(...)                                         │
      │                                                                   │
      │  on hover/click (always, any zoom level):                        │
      │    (a,b) = inverseTransform(mouseX,mouseY) // exact, O(1)         │
      │    demon = g.demons.ref(a,b)                // exact, O(1)        │
      │    → tooltip / onPinInfo                                          │
      └──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
app/
├── lib/
│   ├── demonBrowser.ts       # DemonRowSource, activeFacet, orderedIndex, rankOfMesh, toRow, search parse
│   └── demonMatrix.ts        # inverseTransform, pointClassify, palette, tile/raster fill (pure-ish, canvas-adjacent)
├── components/
│   └── demons/
│       ├── DemonsPanel.tsx    # D-01 dedicated large panel/overlay, built on CyberPanel
│       ├── DemonFacets.tsx    # D-05 clickable facet chips
│       ├── DemonBrowser.tsx   # DEM-02 virtualized table (TanStack Virtual)
│       └── DemonMatrix.tsx    # DEM-04 canvas + pan/zoom + hover/click
```

This mirrors the existing `app/components/panels/` (ZonesPanel.tsx etc.) / `app/lib/` split the rest of the app already uses — adapters and pure logic in `lib/`, presentation in `components/`.

### Pattern 1: Uniform `{count, at(k)}` row source (no materialization, no new engine surface)

**What:** Treat `DemonSpace` and every `DemonSelection` it returns as interchangeable implementations of one two-method shape. The active facet (all / a `DemonType` / a `DemonSubtype`) just picks which one backs the browser and the search/rank logic.

**When to use:** Anywhere Phase 5 needs "the k-th demon under the current filter" — the browser's virtualizer, the search jump, and (if ever needed) a paged export.

**Example:**
```typescript
// Source: engine/core/types.ts (DemonSpace, DemonSelection — both already have count/at(k))
import type { DemonRef, DemonSpace, DemonType, DemonSubtype, Numogram } from '../../engine/index'

export interface DemonRowSource {
  readonly count: number
  at(k: number): DemonRef
}

export type DemonFacet = { readonly kind: 'all' } | { readonly kind: 'type'; readonly type: DemonType }
  | { readonly kind: 'subtype'; readonly subtype: DemonSubtype }

export function rowSourceFor(g: Numogram, facet: DemonFacet): DemonRowSource {
  switch (facet.kind) {
    case 'all': return g.demons
    case 'type': return g.demons.group(facet.type)
    case 'subtype': return g.demons.subtype(facet.subtype)
  }
}

/** Ascending mesh order is native; descending is index arithmetic only — no separate sort code path. */
export function orderedAt(source: DemonRowSource, index: number, descending: boolean): DemonRef {
  return source.at(descending ? source.count - 1 - index : index)
}
```

### Pattern 2: Rank-of-mesh via binary search over `at(k).mesh` (search jump under an active filter)

**What:** `DemonSelection.at(k)` is documented to return members "in ascending mesh order" (`engine/core/types.ts`). That means `at(k).mesh` is a monotonically increasing function of `k`, which is exactly the precondition for binary search. This gives an O(log count) way to find *which row a known demon occupies under the current filter*, entirely from the public engine API — no new engine method needed, and no need to fall back to "clear the filter when jumping to a search result."

**When to use:** DEM-02's search-by-`a::b`-or-mesh, when a type/subtype facet chip (D-05) is active and the target demon belongs to that facet.

**Example:**
```typescript
// Original CCRUG code — derived from the documented ascending-mesh-order contract of DemonSelection (engine/core/types.ts)
export function rankOfMesh(source: DemonRowSource, mesh: number): number | null {
  let lo = 0, hi = source.count - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const m = source.at(mid).mesh
    if (m === mesh) return mid
    if (m < mesh) lo = mid + 1
    else hi = mid - 1
  }
  return null // the demon exists but isn't in the current facet — UI should say so, not silently no-op
}
```

### Pattern 3: Matrix point classification and exact interaction resolve (DEM-04, D-06)

**What:** Two independent code paths share the same underlying engine call, but at different resolutions: the raster fill samples one classification per *output pixel* (cheap, approximate at coarse zoom), while hover/click always computes the classification for the *exact* cell under the cursor from the pan/zoom transform, regardless of what the raster actually painted there. This is what makes D-06's "no cell ever un-inspectable at any zoom level" true by construction rather than by careful LOD engineering: the interaction layer never reads the raster back, it always re-derives the exact answer from `g.demons.ref(a,b)`.

**When to use:** The matrix canvas, at every zoom level.

**Example:**
```typescript
// Original CCRUG code
export interface MatrixTransform { readonly scale: number; readonly tx: number; readonly ty: number }

/** Screen pixel -> the (a,b) grid cell it currently shows, or null if outside the valid a>b triangle. */
export function cellAtPixel(px: number, py: number, t: MatrixTransform, base: number): [number, number] | null {
  const a = Math.floor((px - t.tx) / t.scale)
  const b = Math.floor((py - t.ty) / t.scale)
  if (a <= 0 || a >= base || b < 0 || b >= a) return null
  return [a, b]
}

// Hover handler — always exact, independent of raster resolution:
function onMatrixHover(g: Numogram, px: number, py: number, t: MatrixTransform) {
  const cell = cellAtPixel(px, py, t, g.base)
  if (cell === null) return null
  return g.demons.ref(cell[0], cell[1]) // O(1), authoritative
}
```

### Anti-Patterns to Avoid

- **Materializing `g.demons.at(m)` for `m = 0..count-1` anywhere in Phase 5 UI code:** this is exactly the O(n²) structure `engine/` was built to avoid, and the existing `buildStructuralDemons()` in `app/lib/numogramView.ts` already demonstrates the *wrong* pattern for anything above `allChordsMaxN` (it's fine there only because it's gated to n <= 80). Phase 5 code must never call it or its pattern for the browser/facets/matrix.
- **Introducing a generic table/data-grid library for sort+filter:** the dataset has no array to hand to one; see Don't Hand-Roll.
- **Reading demon classification back from rendered raster pixels for hover/click:** this would make interaction accuracy depend on raster LOD, directly violating D-06's zoom-independence requirement. Always recompute from `g.demons.ref(a,b)`.
- **Gating the demons panel's entry point behind `showDiagram`:** the phase's own headline example (base 666) has no diagram at all under the current tier table (`svgRichMaxN = 200`, Canvas tier not yet built). The Zones/Syzygies/Currents/Gates panels are already NOT gated behind `showDiagram` in `NumogramClient.tsx` — the demons panel must follow that precedent, not the Text-panel/ViewControls precedent (which *are* gated, because they need the diagram or its derived text).
- **Confusing the browser/facet taxonomy with the matrix color taxonomy:** D-02/D-05 map naturally onto the engine's own `DemonType`/`DemonSubtype` (3 types, 7 subtypes — the cross-Torque sub-facet literally is `'cross-torque-chrono'`), while D-06 explicitly locks the matrix's color coding to the *existing 4-bucket kind palette* (chrono/amphi/xeno/syzygy, from `legacyKind()` in `app/presets/base10/demons.ts`, already used by `InfoDisplay.tsx` and `Projection.tsx`). These are two different, both-already-determined taxonomies for two different UI elements — don't collapse them into one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering only the visible rows of a 221,445-row list | A scroll-position-to-row-range calculation from scratch | `@tanstack/react-virtual`'s `useVirtualizer` | Overscan, resize observation, and scroll-anchoring edge cases are exactly what this library has already solved; hand-rolling it is the same category of "deceptively complex problem" this section exists to flag |
| Closed-form demon counts per type/subtype | Any counting loop over demons | `g.demons.typeCounts()` / `g.demons.counts()` | Already implemented, already proven against an independent reference and brute-force counts up to n=2000 (`.planning/STATE.md` Phase 2 P05 entry) — re-deriving this in app code would duplicate tested logic and risk drifting from the engine's canonical classification |
| Demon-by-rank-under-a-filter | A materialized filtered array to index into | `DemonSelection.at(k)` (already O(log C(n,2))) plus the binary-search rank-of-mesh technique above | The engine already solved "k-th member of a type/subtype in mesh order" with a documented, tested unranking algorithm (`engine/core/unrank.ts`) — there is no reason for app code to duplicate or work around it |

**Key insight:** The single biggest risk in this phase is *not* recognizing that the engine already exposes everything DEM-01/DEM-02/DEM-05 need in the exact shape a virtualized UI wants (`count` + index accessor, ascending order, closed-form aggregates). The temptation to build a conventional "fetch all rows, sort/filter/paginate in JS" data layer — the default mental model for a table UI — is precisely the anti-pattern this domain cannot afford at n=666+ demons, and the phase notes' repeated "never one DOM or canvas primitive per demon" warning applies equally to "never one array element per demon" in JS memory.

## Common Pitfalls

### Pitfall 1: Subtype-filtered scrolling can freeze well before the engine's absolute ceiling
**What goes wrong:** A user filters the browser to a facet chip, then scrolls rapidly. If the chip is `cyclic-chrono` or `cross-torque-chrono`, each row's `at(k)` call costs O(K log n) extra (a binary search over a sorted per-Torque-cycle pair-id array), not the O(1)/O(log n) of every other type and subtype.
**Why it happens:** `engine/core/unrank.ts`'s own header comment documents this asymmetry explicitly: "cyclic-chrono and cross-torque-chrono add a sum over the K Torque cycles with two binary searches each." `.planning/STATE.md`'s Phase 2 P06 entry gives measured numbers: about 0.1 ms per rank at n=1024, 2 ms at n=65,536, 30 ms at n=2^20, **2 s at n=2^26** [VERIFIED: engine/core/unrank.ts inline documentation + STATE.md Phase 2 P06 entry].
**How to avoid:** At the phase's practical range (base 666 example, and realistically anything the SVG/Canvas tiers can show before Phase 6's worker lands), this cost is negligible — 0.1-2 ms per row is invisible during normal virtualized scrolling (TanStack Virtual only calls `at(k)` for rows entering the overscan window, at most a few dozen per scroll event). Do not add complexity to defend against the 2^20+ range in this phase; the phase notes explicitly defer "worker offload for very large n" to Phase 6. If the planner wants a defensive measure anyway, the cheapest one is capping how many new rows are unranked per animation frame during a fast scroll (not a new algorithm, just scheduling).
**Warning signs:** Janky scrolling specifically on the cross-Torque-chrono facet chip at large bases, absent on every other chip — a strong signal this exact cost model is being hit.

### Pitfall 2: Conflating `view.demons` (materialized, gated at n<=80) with `g.demons` (virtual, always available)
**What goes wrong:** `app/lib/numogramView.ts`'s `NumogramView.demons` field is `readonly Demon[] | null` — a *materialized array*, built only for the all-chords web layer, `null` above `allChordsMaxN = 80`, and `null` entirely whenever `view` itself is `null` (above `svgRichMaxN = 200`). Building the demon browser/facets/matrix from `view.demons` would silently break for every base above 80 (facets/browser empty) and above 200 (the whole feature vanishes, exactly where the phase's own base-666 example needs it most).
**Why it happens:** `view.demons` is the obvious-looking "list of demons" already in scope inside `Projection.tsx` and `InfoDisplay.tsx`, and it *is* the right source for the existing Pandemonium chord layer (which is legitimately n<=80-gated per D-04). It is the wrong source for anything Phase 5 adds.
**How to avoid:** Phase 5 code reads `g` (the `Numogram`) from `useNumogramView()`'s context value directly, and calls `g.demons` (the `DemonSpace`), never `view.demons`. `g` is present in context even when `view` is `null` (`NumogramViewContextValue.g: Numogram` is not optional; only `view` is nullable — `app/components/numogram/ViewContext.tsx`).
**Warning signs:** Facets/browser/matrix showing nothing (or throwing on `null`) as soon as base exceeds 80 or 200.

### Pitfall 3: Thin diagonal features (syzygy line, numodemon line) disappearing under coarse point-sampling
**What goes wrong:** At coarse zoom (many grid cells per output pixel), point-sampling one `(a,b)` per pixel will, by construction, usually miss a 1-cell-wide diagonal feature like the syzygy line (`a + b = n - 1`, which distinguishes `syzygetic-chrono`/`syzygetic-xeno` from the cyclic/chaotic subtypes sharing the same broad chrono/xeno color). The line would flicker in and out as the sampling grid shifts during pan, rather than reading as a stable line.
**Why it happens:** This is the standard "thin feature aliasing" problem in any point-sampled raster/heatmap, not specific to this codebase — a single-pixel-wide feature has near-zero probability of being hit by a coarse regular sampling grid.
**How to avoid:** Draw the syzygy diagonal (and, if visually useful, the numodemon diagonal `a+b=n`) as an explicit geometric line overlay computed from the current pan/zoom transform, on top of the point-sampled raster, rather than relying on the raster to represent it. This is a small, bounded, always-correct addition (one line segment, not per-cell work).
**Warning signs:** The visible syzygy line appearing broken/dotted or vanishing entirely at certain zoom levels during a prototype/spike.

### Pitfall 4: `formatNetSpan`'s numerals vs. the app's label-scheme (custom alphabet / xenotation)
**What goes wrong:** `engine/core/numerals.ts`'s `formatNetSpan(a, b, base)` always renders zone numbers via the engine's own base-N numeral scheme (`formatNumeral`), independent of the app-level label scheme (Digits/Xeno/Custom-alphabet, UI-03) the rest of the viewer already respects for zone labels. If the browser's `a::b` column uses `formatNetSpan` directly while the diagram uses `zoneLabel()` (which *does* respect the label scheme), the same zone could display differently in the two places simultaneously.
**Why it happens:** `formatNetSpan` predates UI-03's label-scheme work and was built for the engine's own generic numeral display, not the app's per-base-10 custom-alphabet/xenotation UI layer.
**How to avoid:** Build the browser's `a::b` column text from `zoneLabel(a)` / `zoneLabel(b)` (available from `useNumogramView()`), not `formatNetSpan`, for display consistency with the rest of the UI. `formatNetSpan`/`meshOf`/`parseNumeral` remain the right tools for *parsing* search input into zone numbers (label-scheme-aware parsing of custom alphabets is a larger, separate concern not in this phase's scope) — this is a display-vs-parse distinction worth resolving explicitly during planning, not left ambiguous.
**Warning signs:** A demon's `a::b` column showing plain base-N digits while the diagram's zone labels show a custom alphabet or xenotation for the same base.

## Code Examples

### Facet counts (DEM-01) — already closed-form, zero new engine work
```typescript
// Source: engine/core/demons.ts, DemonSpaceImpl (existing, verified against brute-force reference to n=2000)
const typeCounts = g.demons.typeCounts()      // { chrono, amphi, xeno }
const subtypeCounts = g.demons.counts()       // { 'cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono',
                                               //   'plex-amphi', 'warp-amphi', 'chaotic-xeno', 'syzygetic-xeno' }
// Base 28 example from CONTEXT.md: typeCounts.chrono === 378 (includes syzygetic+cyclic+cross-torque),
// subtypeCounts['cross-torque-chrono'] === 108
```

### Base-10 name join (DEM-05) — same pattern as the file this phase retires
```typescript
// Original CCRUG code, pattern taken directly from app/presets/base10/demons.ts's buildDemons()
// (that file's header comment: "Phases 4 and 5 replace this list with the engine-driven demon browser")
import { DEMON_NAMES } from '../presets/base10/lore'
import { legacyKind } from '../presets/base10/demons' // already base-generic: switches on DemonSubtype only

function demonName(base: number, mesh: number): string | undefined {
  return base === 10 ? DEMON_NAMES[mesh] : undefined // undefined -> render as empty cell, per D-02 ("empty, not hidden")
}
```

### TanStack Virtual over a `count`-based source (DEM-02)
```tsx
// Source: tanstack.com/virtual/latest/docs/framework/react/react-virtual (fetched 2026-09-29) + this phase's DemonRowSource
import { useVirtualizer } from '@tanstack/react-virtual'

function DemonBrowser({ source }: { source: DemonRowSource }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: source.count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22, // fixed row height, px
    overscan: 12,
  })
  return (
    <div ref={parentRef} style={{ height: 480, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(item => {
          const demon = source.at(item.index) // O(1) or O(log C(n,2)) — never materialized
          return (
            <div key={item.key} style={{ position: 'absolute', top: item.start, height: item.size, width: '100%' }}>
              {/* a::b via zoneLabel(), mesh, type/subtype, name */}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## State of the Art

Not applicable in the usual "library X replaced library Y" sense — this phase's engine dependencies (`DemonSpace`, `unrank.ts`) were built fresh in Phase 2 (2026-09-27) and are the current state of the art *for this project*. The one external pattern worth naming explicitly:

| Old Approach (naive) | Current Approach (this research) | When Changed | Impact |
|--------------------|-----------------------------------|---------------|--------|
| Materialize all demons into an array, render/filter/sort in JS (what `app/data/demons.ts` did pre-Phase-2, and what `buildStructuralDemons()` still does below n<=80) | Virtual `{count, at(k)}` source, windowed rendering, closed-form facet counts | Phase 2 (engine), this phase (UI) | Removes the O(n²) ceiling entirely from the UI layer; base 666's 221,445 demons and a hypothetical base 65536's ~2.1 billion demons are handled by the *same* code path |

**Deprecated/outdated:** `app/presets/base10/demons.ts`'s `ALL_DEMONS` list is explicitly documented (in its own header comment) as superseded by this phase's work; it should not be extended or copied as a pattern for other bases.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The matrix's "viewport-resolution point-sampled raster, redrawn on pan/zoom-end, with exact hover/click resolved independently of the raster" design will meet the `oneTimePaintMs` (500ms) / interaction budgets from `engine/scene/tier-table.json` at realistic panel sizes (up to a few million backing pixels) | Architecture Patterns (matrix), Pitfall 3 | If actual `ImageData` fill time exceeds budget at the chosen panel size, the plan needs a fallback (progressive/chunked fill across rAF frames, or a lower devicePixelRatio cap) — flagged as a planning-time spike, not measured in this research session |
| A2 | Point-sampling (one classification per output pixel, no averaging/majority-vote across sub-samples) is sufficient for "dominant-subtype binning" at coarse zoom, given the explicit diagonal-line overlay from Pitfall 3 | Architecture Patterns (matrix) | If broad region blocks look visually noisy/speckled at coarse zoom without at least 2x2 or 4x supersampling, the plan should budget for a small fixed supersample-and-majority step (still O(viewport pixels), just a small constant factor higher) |
| A3 | Reusing `app/hooks/useCanvasPan.ts`'s `useCanvasZoom` pattern (currently driving a CSS-transformed SVG wrapper) is adaptable to drive a canvas raster redraw rather than a CSS transform, without needing a new pan/zoom library | Architecture Patterns, Standard Stack (Alternatives) | This file was read only by name/grep in this session, not its full implementation — if its internals are tightly coupled to SVG-specific DOM operations, the plan may need a thinner from-scratch pan/zoom state hook instead (still no new dependency, just new code) |
| A4 | The browser's `a::b` column should use `zoneLabel()` (label-scheme-aware) for display and reserve `formatNetSpan`/`parseNumeral` for search-input parsing | Pitfall 4 | This is a design recommendation, not a locked decision — CONTEXT.md's D-02 doesn't specify which formatter; if the planner picks `formatNetSpan` for display instead, the only consequence is a minor label-scheme inconsistency versus the rest of the UI, not a functional break |

**All four assumptions above are architecture proposals derived from reading this codebase's actual contracts and measured tables, not external claims — flagged for confirmation/spike during planning rather than user discussion, since none of them touch a product decision CONTEXT.md already locked.**

## Open Questions

1. **Exact facet chip taxonomy depth (3 types vs. 7 subtypes, all shown at once vs. drill-down)**
   - What we know: D-05 wants "type facets... including the cross-Torque sub-facet" and explicitly frames it as a nested example ("378 demons, 108 of them cross-Torque"). The engine's `DEMON_TYPES` (3) and `DEMON_SUBTYPES` (7) are the natural source.
   - What's unclear: Whether all 7 subtype chips should always be visible, or only revealed as sub-chips under their parent type chip (2-level disclosure) — a pure UI-styling question CONTEXT.md leaves to "exact chip ordering/styling" (Claude's Discretion).
   - Recommendation: 2-level disclosure (3 type chips, each expandable to its subtypes) keeps the base-10 case (where several subtypes have 0 or few members) visually simple while still surfacing the cross-Torque number prominently at bases like 28/666 where it matters.

2. **Focus-mode shared state: extend `NumogramClient.tsx`'s existing local state, or a new sibling context?**
   - What we know: `hlZones`/`selZones`/`pinnedInfo`/`onHoverInfo`/`onPinInfo` already flow from `NumogramClient.tsx` into both `Projection.tsx` and the side panels today (Phase 4 pattern). The demons panel will need the same kind of two-way link (D-03).
   - What's unclear: Whether the demons panel is rendered as a sibling inside `NumogramClient.tsx` (simplest, reuses existing prop-threading) or as a separate overlay mounted elsewhere that would need a new context to avoid prop-drilling through the whole tree.
   - Recommendation: Given D-01 wants a "dedicated large panel/overlay" (implying it may need to escape the existing small-panel layout grid, e.g. as a full-viewport modal-like overlay), mount it as a sibling inside `NumogramClient.tsx` still (co-located with the other panels) but let its own internal layout be large/overlay-styled — avoids a new context unless the planner finds a concrete reason `NumogramClient.tsx`'s existing state can't reach it.

3. **Matrix raster caching between pan/zoom operations**
   - What we know: Compute cost is O(viewport pixels), independent of n, and classification is O(1) per pixel (region-membership arithmetic, no allocation).
   - What's unclear: Whether a persistent tile cache (HiGlass-style, keyed by zoom level + tile coordinates) is needed for a snappy feel during continuous drag, or whether "redraw the whole visible raster on pan/zoom-end, show the stale bitmap CSS-transformed during the drag itself" (matching the main diagram's own established interaction budget categories: `panMs`/`tweenMs` vs. `oneTimePaintMs`) is good enough for a first version.
   - Recommendation: Start without a persistent cache (simpler, fewer invalidation bugs); the CSS-transform-during-drag / recompute-on-release pattern is exactly what the project's existing `panMs: 32ms` (transform, cheap) vs. `oneTimePaintMs: 500ms` (recompute, more expensive) budget split already assumes for the main diagram — reuse that same mental model rather than inventing a new one.

## Environment Availability

Skipped — this phase's only new dependency is an npm package (`@tanstack/react-virtual`), already covered with a verified version in Standard Stack. There are no new CLIs, services, runtimes, or external tools to probe; the project's existing Node/npm/Playwright toolchain (already verified in prior phases per `CLAUDE.md`) is unchanged by this phase.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (unit/adapter tests) + Playwright 1.63.0 (e2e) [VERIFIED: package.json] |
| Config file | `vitest.config.mts` (unit), Playwright config implied by existing `e2e/*.spec.ts` + `test:e2e` script |
| Quick run command | `cross-env CCRUG_TZ=UTC vitest run tests/app/<new-file>.test.ts` |
| Full suite command | `npm run verify` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEM-01 | Base 28 facet counts equal 378 chrono / 108 cross-Torque-chrono, matching `g.demons.typeCounts()`/`counts()` directly | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonFacets.test.ts` | ❌ Wave 0 |
| DEM-02 | Browser windowing: `DemonRowSource` for `g.demons`/`group()`/`subtype()` returns correct `count`/`at(k)`; `rankOfMesh` binary search matches linear scan for small n; sort-direction index reversal correct at both ends | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonBrowserSource.test.ts` | ❌ Wave 0 |
| DEM-02 | Base 666 browser scrolls without materializing all rows; search jumps to the correct row under an active facet | e2e | `playwright test e2e/demons-browser.spec.ts` | ❌ Wave 0 |
| DEM-03 | Clicking a zone shows n-1 chords; clicking a demon row highlights its two zones; both directions round-trip | e2e | `playwright test e2e/demons-focus.spec.ts` | ❌ Wave 0 |
| DEM-04 | Matrix hover/click at multiple zoom levels resolves the exact same `a::b`/mesh/type `g.demons.ref(a,b)` would give directly, regardless of raster LOD | unit + e2e | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonMatrix.test.ts` + `playwright test e2e/demons-matrix.spec.ts` | ❌ Wave 0 |
| DEM-05 | Base 10 browser/detail panel shows all 45 canonical names; every other base's name column is present but empty | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonNames.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cross-env CCRUG_TZ=UTC vitest run <touched test files>`
- **Per wave merge:** `npm run typecheck && cross-env CCRUG_TZ=UTC vitest run && npm run test:e2e`
- **Phase gate:** `npm run verify` green before `/gsd-verify-work 5`

### Wave 0 Gaps

- [ ] `tests/app/demonFacets.test.ts` — DEM-01 closed-form facet display logic
- [ ] `tests/app/demonBrowserSource.test.ts` — DEM-02 `DemonRowSource`/`rankOfMesh`/sort-reversal adapter logic
- [ ] `tests/app/demonMatrix.test.ts` — DEM-04 `cellAtPixel`/exact-resolve logic
- [ ] `tests/app/demonNames.test.ts` — DEM-05 name join
- [ ] `e2e/demons-browser.spec.ts`, `e2e/demons-focus.spec.ts`, `e2e/demons-matrix.spec.ts` — end-to-end coverage of DEM-02/03/04 interaction
- [ ] Framework install: `npm install @tanstack/react-virtual` (no test-framework install needed — Vitest/Playwright already present)

## Security Domain

This is a static, client-only app with no authentication, sessions, backend, or persisted user data (FND-03), so most ASVS categories don't apply. The relevant surface is entirely V5 (input validation of user-typed search/filter text) and the existing XSS-safety pattern this codebase already established for free-text rendering.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts, no server |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No privileged operations |
| V5 Input Validation | Yes | Search-box text (mesh number / `a::b` / name substring) must be parsed defensively: regex-gate before `Number()`/split, reject malformed input by showing "not found" rather than throwing — mirror `app/lib/shareParams.ts`'s existing lenient-per-field pattern (`BASE_DIGITS_RE`, `clipRaw`/`MAX_ECHO` length clipping) rather than inventing a new validation style |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected content in the search box or demon name column | Tampering (of displayed content) | React's default text-content escaping already covers this (no `dangerouslySetInnerHTML` used anywhere in this codebase's rendering path); no new risk introduced by rendering user search text or demon names as plain JSX children |
| Oversized/malformed search input (e.g. a huge pasted string) causing a slow regex or unbounded array build | Denial of Service (client-side, single user) | Cap search-input length before processing (same `MAX_ECHO`/length-clip precedent as `shareParams.ts`); the binary-search rank lookup is already O(log count) regardless of input, so the only risk is in the *parsing* step, not the lookup |
| Future URL param for the active filter (D-07) accepting an arbitrary/unknown type or subtype string | Tampering (malformed shareable URL) | Validate against `DEMON_TYPES`/`DEMON_SUBTYPES` (both exported const tuples from `engine/index`) before calling `g.demons.group()`/`.subtype()` — those methods already throw `RangeError` on an unknown name, so the URL parser must catch/validate *before* calling them, exactly like every other lenient-per-field parser in `shareParams.ts` does today |

## Sources

### Primary (HIGH confidence)
- `engine/core/types.ts`, `engine/core/demons.ts`, `engine/core/unrank.ts` — the `DemonSpace`/`DemonSelection` contracts, closed-form counts, and documented unranking cost model (read in full this session)
- `engine/scene/tier-table.json`, `engine/scene/tiers.ts` — measured `allChordsMaxN = 80`, `svgRichMaxN = 200`, `canvasMaxN = null` (no ceiling to 4000), `webglDecision.adopt = false`, `selectTier` logic
- `app/lib/numogramView.ts`, `app/components/numogram/ViewContext.tsx` — confirms `g` (raw `Numogram`) is always available in context independent of `view` (nullable above `svgRichMaxN`)
- `app/presets/base10/demons.ts`, `app/presets/base10/lore.ts` — existing `legacyKind()` mapping and `DEMON_NAMES` join pattern, with the file's own header comment naming this phase as its successor
- `app/NumogramClient.tsx` — confirms existing panels (Zones/Syzygies/Currents/Gates/Info) are not gated behind `showDiagram`, only Text panel and `ViewControls` are
- `app/lib/shareParams.ts` — the lenient-per-field URL codec pattern to extend for D-07
- npm registry (`npm view @tanstack/react-virtual version`, `npm view react-window version`, `npm view @tanstack/virtual-core version`) — checked 2026-09-29

### Secondary (MEDIUM confidence)
- tanstack.com/virtual/latest/docs/framework/react/react-virtual (WebFetch, 2026-09-29) — confirmed `count`/`getScrollElement`/`estimateSize`/`getVirtualItems()` API shape; did not confirm the exact `scrollToIndex` method signature, which this research assumes from stable prior knowledge of the library's long-standing public API
- WebSearch: TanStack Virtual / react-window / react-virtuoso bundle-size and feature comparison (2026-09-29) — multiple independent sources agree on relative sizing and maintenance status
- WebSearch: HiGlass / Juicebox Hi-C contact-matrix tile-pyramid architecture (2026-09-29) — used as external validation of the "viewport-resolution tiling" family of approaches, not as a literal implementation template (this project's O(1) analytic classification makes a precomputed pyramid unnecessary, unlike HiGlass's empirical-data case)

### Tertiary (LOW confidence)
- None retained — all matrix-LOD design choices in this document are original architecture reasoning grounded in the codebase's own measured budgets (tier-table.json) and contracts (DemonSpace), flagged explicitly in the Assumptions Log rather than presented as externally verified fact

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — TanStack Virtual version/API verified via npm registry and official docs; the decision itself is also pre-steered by ROADMAP.md
- Architecture (browser/facets/focus mode): HIGH — every data-flow claim traces to an actual file read in this session, not assumed engine behavior
- Architecture (matrix LOD): MEDIUM — the design is internally consistent and grounded in this project's own measured performance budgets, but has no direct in-codebase precedent and is not benchmarked in this session; flagged for a planning-time spike (A1/A2 in Assumptions Log)
- Pitfalls: HIGH — sourced directly from engine inline documentation and STATE.md's own measured numbers, not external claims

**Research date:** 2026-09-29
**Valid until:** Stable for the lifetime of Phase 5 planning/execution (engine contracts are frozen per project convention); the matrix LOD design specifically should be re-validated against real measurements the moment a prototype exists, since A1/A2 are unverified performance assumptions
