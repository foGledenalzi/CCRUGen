# Architecture

**Analysis Date:** 2026-09-25

## Pattern Overview

**Overall:** Layered React client application with four distinct layers: data (hand-authored constants), computation (pure math algorithms), rendering (SVG projection), and state management (interactive UI with undo/redo).

**Key Characteristics:**
- **Base-10 hardcoded** — Currently optimized for decimal (base-10) numogram only; positions, metadata, planetary data all assume exactly 10 zones
- **Separation of hand-authored vs. derivable data** — Zones, demons, positions are hand-authored; syzygies (a+b=9), currents (difference flow), gates (cumulative reduction) are algorithmically derived from constants
- **Layout-agnostic geometry engine** — SVG path generation (`geometry.ts`) works for any zone coordinates; layout switching is pure position remapping
- **Multi-mode rendering** — Four layout modes (original, labyrinth, ladder, planetary) with switching via CSS transitions and state recomputation
- **Stateful interactive viewer** — URL state synchronization, undo/redo history, panel dragging, zoom, and share image generation

## Layers

**Data Layer:**
- Purpose: Static numogram constants—zone metadata, hand-authored positions, demon names, planetary data
- Location: `app/data/`
- Contains: Type definitions, zone colors/regions/particles/metadata, hand-authored positions for each layout, syzygy/current/gate definitions, demon name mappings
- Depends on: Nothing (pure data)
- Used by: Rendering layer, state management layer (NumogramClient)

**Computation Layer:**
- Purpose: Layout-agnostic algorithms for geometry, notation, planetary mechanics, and digital reduction
- Location: `app/lib/`
- Contains: SVG path builders, prime factorization (xenotation), orbit calculations, digital-root/plex expressions
- Depends on: Data layer (positions, constants) for input values
- Used by: Rendering layer (Projection) and state management (NumogramClient)

**Rendering Layer:**
- Purpose: Transform computed data into interactive SVG visualization with hover/selection states
- Location: `app/components/projection/Projection.tsx`, `app/components/panels/`, `app/components/ui/`
- Contains: Main SVG renderer (gates, currents, syzygies, zones, planets), interactive info panels, cyber-themed UI controls
- Depends on: Data layer (zone colors, metadata), Computation layer (paths, angles), State layer (current selections/layout)
- Used by: NumogramClient (main coordinator)

**State Management Layer:**
- Purpose: Coordinate user interactions, manage view state, handle history, generate shareable URLs
- Location: `app/NumogramClient.tsx`, `app/hooks/`
- Contains: React hooks for animations (useTween, useOrbitalAnimation), UI interactions (usePanelDrag, useCanvasPan), state snapshots (undo/redo), URL sync
- Depends on: All layers below
- Used by: Nothing (top-level orchestrator)

## Data Flow

**User Selection → Hover Info:**

1. User clicks/hovers over zone in Projection SVG
2. `onHoverInfo(zone)` → NumogramClient updates `hoverInfo` state
3. NumogramClient derives which currents/gates/syzygies connect the hovered zone
4. Info panels display related entities with descriptions

**Layout Switch:**

1. User clicks layout button (OriginalIcon, LabyrinthIcon, etc.)
2. NumogramClient calls `switchLayout()` (from useTween hook)
3. useTween interpolates zone positions from current layout to target layout
4. CSS class `layout-glitching` applied for 360ms visual feedback
5. Projection re-renders with new positions; gate/current paths auto-recompute

**Selection → Share URL:**

1. User selects zones (multi-select with toggle logic in `toggleTerminalSelection`)
2. NumogramClient builds share params: layout, selected zones, layers, region, tc flag, etc.
3. Share URL constructed via `buildShareParams()` and `toQueryString()`
4. On page load, `hasNumogramQuery()` checks if URL contains numogram params and redirects from home to `/numogram?...`
5. On numogram page, URL hydration syncs state from query params

**Gate/Current Rendering Pipeline:**

1. NumogramClient memoizes `gateRenderData` and `currentRenderData` on every layout/position change
2. For gates: `gateEndpoints()` calculates start/end positions with zone-radius clearance
3. `concaveGatePath()` computes quadratic Bézier curves, using connection-vector-based lane assignment to avoid overlaps
4. For currents: similar flow but with Y-shape rendering for split-pair routes (from/partner → destination)
5. Projection renders all paths, applies layer visibility, responds to hover/selection for highlighting

**State Management:**

- State is centralized in NumogramClient component (~1500 lines)
- History snapshots capture: layout, layers, selected zones, region highlight, TC active flag, particles, planetary date, orbits, label visibility
- Undo/redo stacks managed via `snapshotState()` / `applySnapshot()` with JSON stringification for equality checks

## Key Abstractions

**Layout:**
- Purpose: Abstract zone coordinate system; switching layout updates positions without changing the underlying graph
- Examples: `type Layout = 'labyrinth' | 'ladder' | 'original' | 'planetary'`
- Pattern: Switch via `useTween` hook which interpolates positions; all downstream rendering uses `pos[zone]` for coordinates

**HoverInfo:**
- Purpose: Union type representing any hoverable entity (zone, syzygy, current, gate, demon)
- Examples: `{ type: 'zone'; zone: 0 }`, `{ type: 'syzygy'; data: SyzygyData }`, `{ type: 'gate'; gate: GateData }`
- Pattern: Rendered in InfoDisplay panel; linked to visual highlight in Projection

**Layer:**
- Purpose: Toggle-able visual layers (syzygies, currents, gates, pandemonium)
- Examples: `type Layer = 'syzygies' | 'currents' | 'gates' | 'pandemonium'`
- Pattern: Stored as Set<Layer> in state; Projection filters rendering based on `layers.has(layer)`

**Region:**
- Purpose: Partition zones into named groups (torque, warp, plex)
- Examples: `type Region = 'torque' | 'warp' | 'plex'`
- Pattern: Hand-authored in `ZONE_REGION` mapping; used for collective selection and highlight

**GateRender / CurrentRender:**
- Purpose: Computed rendering data (SVG paths, midpoints for labels)
- Examples: `{ type: 'loop'; loop: string; mid?: Pos }`, `{ type: 'yshape'; legA: string; legB: string; stem: string; junction: Pos }`
- Pattern: Memoized in NumogramClient; Projection consumes and renders with filters for opacity/color based on state

## Entry Points

**`app/page.tsx`:**
- Location: `app/page.tsx`
- Triggers: User visits `/` root or any query param recognized in `NUMOGRAM_QUERY_KEYS`
- Responsibilities: Home page router; if numogram query detected, redirects to `/numogram?...`; otherwise shows feature cards

**`app/numogram/page.tsx` (implied):**
- Location: App Router page for `/numogram` route (not explicitly shown in provided files)
- Triggers: User navigates to `/numogram` or follows redirected URL from home
- Responsibilities: Server-side layout; renders `<NumogramClient>` as client component

**`NumogramClient.tsx` (root client component):**
- Location: `app/NumogramClient.tsx`
- Triggers: Mounted in `/numogram` page
- Responsibilities: Manages all interactive state, coordinates data flow between Projection and panels, syncs URL

**`Projection.tsx` (main renderer):**
- Location: `app/components/projection/Projection.tsx`
- Triggers: Rendered by NumogramClient whenever props change
- Responsibilities: Renders SVG with zones, gates, currents, syzygies, demons, planets; handles zone click/hover

**Panel Components:**
- Location: `app/components/panels/` (LayersPanel, ZonesPanel, SyzygiesPanel, CurrentsPanel, GatesPanel, LabelsPanel, RegionsPanel)
- Triggers: Rendered conditionally in NumogramClient based on open/collapsed state
- Responsibilities: Display filterable lists of entities; allow selection; trigger state updates

## Error Handling

**Strategy:** Minimal error handling; mostly defensive null checks and type narrowing.

**Patterns:**
- **Type safety:** TypeScript strict mode for most runtime errors caught at compile time
- **Null checks:** Render guards like `if (!svgWrapRef.current) return null` in SVG capture
- **Parsing:** URL param parsing with type coercion in `shareParams.ts` (safe defaults if missing)
- **Share image generation:** Wrapped in try/catch; returns `null` on failure, share proceeds without image
- **History:** Equality check via `snapshotKey()` to avoid duplicate consecutive snapshots

## Cross-Cutting Concerns

**Logging:** Console logging minimal; no structured logging framework. Key events (layout switch, share) silent unless debugging.

**Validation:** Input validation on URL params (e.g., validating selected zone IDs are 0-9) done implicitly via type coercion and filtering.

**Authentication:** None. App is read-only public viewer.

**Persistence:** URL as primary state persistence mechanism. Local browser state (undo/redo, panel positions) not persisted across sessions.

**Animations:**
- Layout transition: CSS fade + interpolation via useTween (400ms typical)
- Orbital animation: requestAnimationFrame-based (useOrbitalAnimation)
- Panel drag: delta tracking via usePanelDrag

**Performance:**
- SVG memoization: `gateRenderData`, `currentRenderData`, etc. memoized to avoid re-computing paths on every render
- Zone order optimization: `zoneOrder` sorted by distance from center to control SVG rendering order (further back first)
- Layer visibility: Filtered at render time, not stored separately

## Critical Coupling for Arbitrary-Base Generator

**Hard Constraints (Base-10 Specific):**
- Zone positions (`P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`, `PLANETARY_RADIUS`) are hand-authored for 10 zones only
- Zone metadata (lemurs, spinal, mesh tags, lore) assume exactly 10 zones
- Planetary data (orbital periods, J2000 longitudes, sizes) are hand-tuned for decimal system
- Syzygy definition: `a + b = 9` (base - 1 formula)
- Region partition: hardcoded torque/warp/plex split

**Computable Across Any Even Base:**
- Current differences: `|from - to|` formula works for any base
- Gate indices: triangular numbers T(k) = k*(k+1)/2 generalize to any base
- Demon classification: TC zones concept could be redefined per base
- SVG path generation: pure geometry, independent of base
- Digital reduction (plex): works for any base (sum digits → repeat until single digit in base-n)

**Xenotation (Prime Factorization):**
- Location: `app/lib/xenotation.ts`
- Status: **Base-agnostic** — Works for any integer regardless of base
- Impact: Can render xenotation labels for any base's gates/currents/zones

**Numogram Math (`app/lib/numogram.ts`):**
- Location: `app/lib/numogram.ts`
- Function: `plexExpr(cum: number)` computes digital reduction in decimal
- Status: **Partially base-agnostic** — Algorithm works for any base, but hardcoded to base-10 in output
- Refactor needed: Add `base` parameter; adapt digit summing to base-n

---

*Architecture analysis: 2026-09-25*
