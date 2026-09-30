# Phase 5: Demons Layer - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 15 new/modified (7 new components/libs, 3 modified, 5 new test files, 3 new e2e specs, 1 dependency-only change)
**Analogs found:** 12 / 15 (2 partial-match "no strong analog" flagged for the canvas raster; 1 config-only change)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/demonBrowser.ts` (new) | utility / view-model adapter | CRUD (index-based read) + transform | `app/lib/regions.ts` | role-match |
| `app/lib/demonMatrix.ts` (new) | utility / transform | transform (pixel <-> cell math) | `app/hooks/useCanvasPan.ts` (`useCanvasZoom`) + `engine/core/demons.ts` (`buildDemon`) | partial-match |
| `app/components/demons/DemonsOverlay.tsx` (new) | component (modal/overlay shell) | request-response (open/close, focus trap) | `app/components/numogram/ShortcutsModal.tsx` | exact |
| `app/components/demons/DemonFacets.tsx` (new) | component (filter chips) | event-driven (click to filter) | `app/components/panels/RegionsPanel.tsx` (Isolate/Mute buttons) + `app/components/ui/Pill.tsx` | role-match |
| `app/components/demons/DemonBrowser.tsx` (new) | component (virtualized table) | streaming/windowed read + CRUD (sort/filter) | `app/components/panels/shared.tsx` (`SelectableListPanel`) | partial-match (no virtualization precedent exists; TanStack Virtual is new) |
| `app/components/demons/DemonFocusView.tsx` (new) | component (chord visualization) | event-driven + transform | `app/components/projection/Projection.tsx` (Pandemonium layer, ~line 271) | role-match |
| `app/components/demons/DemonMatrix.tsx` (new) | component (canvas + pan/zoom) | event-driven + transform | `app/hooks/useCanvasPan.ts` (`useCanvasZoom`) + `app/components/info/InfoDisplay.tsx` (hover/pin plumbing) | partial-match (no canvas-raster precedent exists in this SVG-only app) |
| `app/components/numogram/NumogramIcons.tsx` (modified: add `DemonsIcon`) | component (icon) | n/a (pure render) | `UndoIcon`/`ShareIcon` (same file, lines 109-135) | exact |
| `app/lib/shareParams.ts` (modified: add `demonFilter=`/`demonFocus=`/`demonsOpen=`) | utility (URL codec) | transform (parse/build) | same file's `parseRegionList`/`parsePacker` + `app/lib/regions.ts`'s `isRegionId` | exact |
| `app/NumogramClient.tsx` (modified: entry point + state + mount) | component (page controller) | event-driven / state orchestration | itself — Undo/Redo/Share button block (~lines 1379-1422) + `ZonesPanel` wiring (~lines 1463-1464) | exact |
| `tests/app/demonBrowserSource.test.ts` (new) | test | n/a | `tests/app/regions.test.ts` | exact |
| `tests/app/demonFacets.test.ts` (new) | test | n/a | `tests/app/regions.test.ts` | exact |
| `tests/app/demonMatrix.test.ts` (new) | test | n/a | `tests/app/regions.test.ts` (pure function, multi-base) | role-match |
| `tests/app/demonNames.test.ts` (new) | test | n/a | `app/presets/base10/demons.ts` (`buildDemons`) pattern + `tests/app/regions.test.ts` style | role-match |
| `e2e/demons-focus.spec.ts` / `demons-browser.spec.ts` / `demons-matrix.spec.ts` (new) | test (e2e) | n/a | `e2e/hover-pin.spec.ts` | role-match |
| `package.json` / `package-lock.json` (modified: add `@tanstack/react-virtual`) | config | n/a | n/a | config-only, no pattern needed |

## Pattern Assignments

### `app/lib/demonBrowser.ts` (utility / view-model adapter, CRUD + transform)

**Analog:** `app/lib/regions.ts` (adapter pattern) + `app/presets/base10/demons.ts` (name-join pattern) + `engine/core/types.ts`/`engine/core/demons.ts` (the authoritative data contract)

**CRITICAL — read the raw Numogram, never the materialized view** (`app/lib/numogramView.ts` lines 38-58, 184-193, and `app/components/numogram/ViewContext.tsx` lines 9-22):
```typescript
// NumogramView.demons (app/lib/numogramView.ts:48) is `readonly Demon[] | null` — a MATERIALIZED array, built only
// for the base<=80 Pandemonium web, and `view` itself is null above svgRichMaxN=200. Base 666 (this phase's own
// headline example) has view === null, so view.demons is unreachable.
// NumogramViewContextValue.g (ViewContext.tsx:11) is NOT optional — it is always the raw Numogram.
const { g } = useNumogramView()
g.demons.typeCounts()   // always available, closed-form, any base
g.demons.group('chrono').at(k)   // always available, O(log C(n,2))
```
This is Pitfall 2 from 05-RESEARCH.md verbatim — the single highest-risk mistake in this phase.

**Adapter/validation pattern to copy** (`app/lib/regions.ts` lines 31-46, 54-60):
```typescript
// Non-materializing iteration over engine structures (regionRows), and strict-match validation that never uses a
// caller string as a property key (isRegionId) — the same discipline demonBrowser.ts's facet-name validation needs
// against DEMON_TYPES/DEMON_SUBTYPES.
export function regionRows(g: Numogram): RegionRow[] {
  const rows: RegionRow[] = []
  const torqueCount = g.torqueCount
  for (let i = 0; i < torqueCount; i++) {
    const cycle = g.torques[i]
    if (cycle === undefined) throw new RangeError(`regionRows: base ${g.base} is missing Torque cycle ${i}`)
    // ...
  }
  return rows
}

export function isRegionId(value: string, g: Numogram): value is RegionId {
  if (value === 'plex') return true
  if (value === 'warp') return g.warp !== null
  // exact string comparison + strict regex only, never `value` as a property key
}
```

**Name-join pattern (DEM-05) to copy exactly** (`app/presets/base10/demons.ts` lines 19-48):
```typescript
export function legacyKind(subtype: DemonSubtype): LegacyDemonKind {
  switch (subtype) {
    case 'syzygetic-chrono':
    case 'syzygetic-xeno':
      return 'syzygy'
    case 'cyclic-chrono':
    case 'cross-torque-chrono':
      return 'chrono'
    case 'plex-amphi':
    case 'warp-amphi':
      return 'amphi'
    case 'chaotic-xeno':
      return 'xeno'
    default: {
      const unknown: never = subtype
      throw new Error('base-10 preset: unknown demon subtype ' + String(unknown))
    }
  }
}
// buildDemons() shows the exact join-by-mesh-id pattern: DEMON_NAMES[mesh] from lore.ts, never duplicated into
// engine data. demonBrowser.ts's toRow() does the same: name = base === 10 ? DEMON_NAMES[demon.mesh] : undefined.
```

**Core `{count, at(k)}` uniform-source pattern (from 05-RESEARCH.md Pattern 1, grounded in `engine/core/types.ts` lines 79-107 — this is the authoritative engine contract, already built, just consumed here):**
```typescript
import type { DemonRef, DemonType, DemonSubtype, Numogram } from '../../engine/index'

export interface DemonRowSource { readonly count: number; at(k: number): DemonRef }
export type DemonFacet = { readonly kind: 'all' } | { readonly kind: 'type'; readonly type: DemonType }
  | { readonly kind: 'subtype'; readonly subtype: DemonSubtype }

export function rowSourceFor(g: Numogram, facet: DemonFacet): DemonRowSource {
  switch (facet.kind) {
    case 'all': return g.demons
    case 'type': return g.demons.group(facet.type)
    case 'subtype': return g.demons.subtype(facet.subtype)
  }
}

export function orderedAt(source: DemonRowSource, index: number, descending: boolean): DemonRef {
  return source.at(descending ? source.count - 1 - index : index)
}

// Rank-of-mesh via binary search (search-jump under an active facet), from engine/core/types.ts:80's documented
// "ascending mesh order" contract on DemonSelection.at(k):
export function rankOfMesh(source: DemonRowSource, mesh: number): number | null {
  let lo = 0, hi = source.count - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const m = source.at(mid).mesh
    if (m === mesh) return mid
    if (m < mesh) lo = mid + 1
    else hi = mid - 1
  }
  return null
}
```

**Display formatter note (Pitfall 4):** the browser's `A::B` column must use `zoneLabel()` from `useNumogramView()` (label-scheme-aware: Digits/Xeno/Custom-alphabet), not `formatNetSpan` from `engine/index` — the diagram's own zone labels already go through `zoneLabel()`, and using a different formatter in the browser would make the same zone display two different ways simultaneously.

**Closed-form facet counts (DEM-01) — zero new engine work, just read:**
```typescript
// engine/core/demons.ts lines 212-218 (already implemented, already proven to n=2000)
const typeCounts = g.demons.typeCounts()      // { chrono, amphi, xeno }
const subtypeCounts = g.demons.counts()       // 7 keys incl. 'cross-torque-chrono'
```

---

### `app/lib/demonMatrix.ts` (utility / transform, pixel <-> cell math)

**Analog:** `app/hooks/useCanvasPan.ts`'s `useCanvasZoom` (lines 1-68, the app's only existing pan/zoom state hook — currently drives a CSS-transformed SVG wrapper, not a canvas) + `engine/core/demons.ts`'s `buildDemon` (lines 71-100, the O(1) classification math to point-sample per pixel).

**Zoom/pan state pattern to copy** (`app/hooks/useCanvasPan.ts` lines 3-8, 40-43, 56-65):
```typescript
export function useCanvasZoom(wrapRef: RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const clamp = useCallback((v: number, min: number, max: number) => Math.min(max, Math.max(min, v)), [])
  // wheel handler: normalize deltaY across deltaMode, debounce gesture-active state, exponential zoom factor
  const factor = Math.exp(-step * 0.0015)
  setZoom(prev => clamp(prev * factor, 0.3, 5))
  // ...
  const setZoomValue = useCallback((nextZoom: number) => setZoom(clamp(nextZoom, 0.3, 5)), [clamp])
  return { zoom, zoomOrigin, setZoom: setZoomValue, setZoomOrigin: setZoomOriginValue }
}
```
This hook currently targets a CSS-transformed SVG wrapper (Assumption A3 in 05-RESEARCH.md flags this file was only read by grep, not fully, in the research session — it has now been read in full above and its state shape is directly reusable; only the *consumer* changes from a CSS transform to a canvas redraw-on-end).

**Classification to point-sample per pixel** (`engine/core/demons.ts` lines 71-100 — read, never reimplement):
```typescript
function buildDemon(s: NumogramInternals, n1: number, a: number, b: number): DemonRef {
  const cycleA = s.pairCycle[a < n1 - a ? a : n1 - a] ?? 0
  const cycleB = s.pairCycle[b < n1 - b ? b : n1 - b] ?? 0
  const torqueA = cycleA < s.torqueCount
  const torqueB = cycleB < s.torqueCount
  const syzygetic = a + b === n1
  // ... chrono/amphi/xeno + subtype branching
}
```
`demonMatrix.ts` must call the public `g.demons.ref(a, b)` (O(1), `engine/core/types.ts` line 90), never reimplement this switch — the matrix's per-pixel raster fill and its hover/click exact-resolve both go through `g.demons.ref(a, b)`, exactly as 05-RESEARCH.md's Pattern 3 (Architecture Patterns) specifies:
```typescript
export interface MatrixTransform { readonly scale: number; readonly tx: number; readonly ty: number }

export function cellAtPixel(px: number, py: number, t: MatrixTransform, base: number): [number, number] | null {
  const a = Math.floor((px - t.tx) / t.scale)
  const b = Math.floor((py - t.ty) / t.scale)
  if (a <= 0 || a >= base || b < 0 || b >= a) return null
  return [a, b]
}
```

**Color-by-kind palette must reuse `legacyKind()` + the exact hexes already in `InfoDisplay.tsx`'s `DemonInfo`** (lines 292-294 — the app's one canonical kind-color mapping, do not re-derive):
```typescript
const kindClr = d.kind === 'chrono' ? '#00ccff'
  : d.kind === 'xeno' ? '#cc3333'
  : d.kind === 'amphi' ? '#cc8833' : '#e8e8e8'
```

**No analog found for the actual `<canvas>`/`ImageData` raster-fill mechanics** — this app is SVG-only today (no Canvas tier has shipped; Phase 6 is a different, later canvas effort for the main diagram). Build this part fresh from 05-RESEARCH.md's Architecture Patterns section (viewport-resolution point-sampled raster, redrawn on pan/zoom-end, exact hover/click independent of the raster per D-06) — there is nothing in the current codebase to copy for the `ctx.putImageData` loop itself.

---

### `app/components/demons/DemonsOverlay.tsx` (component, modal/overlay shell)

**Analog:** `app/components/numogram/ShortcutsModal.tsx` (full file, 56 lines — read in full above; this is the UI-SPEC's own explicitly named precedent: "the direct visual precedent for D-01's 'dedicated large panel/overlay'; scale it up, do not redesign it")

**Shell pattern to copy verbatim, scaled** (`ShortcutsModal.tsx` lines 13-39):
```tsx
return (
  <div className="fixed inset-0 z-[84] flex items-center justify-center px-4">
    <button
      className="absolute inset-0"
      style={{ background: 'rgba(0,0,0,0.62)' }}
      onClick={onClose}
      aria-label="Close shortcuts"
    />
    <div
      className="relative w-full max-w-[540px] px-4 py-4 font-mono"
      style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(8,8,15,0.97)' }}
    >
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[10px] tracking-[0.22em] uppercase" style={{ color: '#10ff50' }}>Shortcuts</span>
        <button
          className="text-[8px] uppercase tracking-[0.14em] px-2 py-1"
          style={{ color: '#6b7280', border: '1px solid rgba(107,114,128,0.35)' }}
          onClick={onClose}
        >close</button>
      </div>
      {/* body */}
    </div>
  </div>
)
```
UI-SPEC's exact deltas for `DemonsOverlay`: `z-[80]` (below ShortcutsModal's 84), backdrop `rgba(0,0,0,0.62)` unchanged, content box `width: min(94vw, 1100px); height: min(88vh, 860px)` (desktop) / `100vw`x`100vh` (mobile breakpoint), `close` button copy lowercase unchanged, dismiss on backdrop click + close button + `Escape` (all three, matching `ShortcutsModal`), plus a `Metric` total-count readout next to the title (see `BigBaseSummary.tsx` below) and a conventional focus trap (not the diagram's roving-tabindex model, since this is a modal).

**Total-count readout — reuse verbatim** (`app/components/numogram/BigBaseSummary.tsx` lines 12-19):
```tsx
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.3em] text-gray-400">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none text-gray-100">{value}</div>
    </div>
  )
}
// Usage: <Metric label="Total" value={summary.demonCount.toLocaleString('en-US')} />
```

**Tab switch — build from existing primitives, not new ones** (`app/components/ui/CyberButtonGroup.tsx` full file + `app/components/ui/CyberButton.tsx` lines 20-99, `active` prop already gives the exact `rgba(16,255,80,...)` selected treatment):
```tsx
<div className={`inline-flex border border-white/10 ${className}`}>{children}</div>
// CyberButton's active state (lines 80-83):
className={`... ${active ? 'bg-[#10ff50]/[0.08]' : 'bg-transparent hover:bg-white/[0.03]'} ...`}
style={active ? { boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } : undefined}
```

---

### `app/components/demons/DemonFacets.tsx` (component, filter chips)

**Analog:** `app/components/panels/RegionsPanel.tsx` (Isolate/Mute toggle buttons, lines 81-108) for the exact active/inactive selected-state treatment, plus `app/components/ui/Pill.tsx` (full file) for the chip shell itself.

**Chip shell to copy** (`Pill.tsx` lines 14-53):
```tsx
export function Pill({ children, accent, onClose, closeLabel = 'Remove', className = '', title }: PillProps) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full border border-[#334155] bg-[#0b111a] px-1.5 py-[2px] text-[10px] leading-none text-gray-200 ${className}`}
      style={accent ? { color: accent, borderColor: `${accent}88`, background: `${accent}1a` } : undefined}
      title={title}
    >
      <span>{children}</span>
      {/* optional close button */}
    </span>
  )
}
```

**Active/selected treatment to copy exactly** (`RegionsPanel.tsx` lines 84-95 — the same `rgba(16,255,80,0.08)` + inset-border token the UI-SPEC reuses for pinned browser rows and active tabs; "never invent a new selection color"):
```tsx
<button
  type="button"
  aria-pressed={isolated}
  className="-my-1 inline-flex h-6 w-6 items-center justify-center"
  style={isolated ? { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } : undefined}
  onClick={e => { e.stopPropagation(); onToggleIsolate(row.id) }}
>
  <IsolateIcon clr={isolated ? '#10ff50' : '#6b7280'} />
</button>
```

**Data source — closed-form, already built** (`engine/core/demons.ts` lines 212-218, `engine/core/types.ts` lines 55-67 for the `DEMON_TYPES`/`DEMON_SUBTYPES` tuples the chip taxonomy is built from):
```typescript
export const DEMON_TYPES = ['chrono', 'amphi', 'xeno'] as const
export const DEMON_SUBTYPES = [
  'cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono',
  'plex-amphi', 'warp-amphi', 'chaotic-xeno', 'syzygetic-xeno',
] as const
```
Disabled-chip-at-count-0 styling (UI-SPEC Copywriting Contract: "Same label, rendered at 40% opacity, `aria-disabled=\"true\"`, still visible — never hidden") has no existing exact analog; apply Tailwind `opacity-40` + `aria-disabled` directly to the `Pill`.

---

### `app/components/demons/DemonBrowser.tsx` (component, virtualized table)

**Analog:** `app/components/panels/shared.tsx`'s `SelectableListPanel`/`PanelRow` (lines 20-105) for the row-interaction *shape* (hover -> callback, click -> callback, per-item opacity) — **not** for virtualization, which this component materializes nothing for (it renders every item). TanStack Virtual (`@tanstack/react-virtual`, new dependency, not yet in `package.json`) is the piece with no existing in-repo precedent.

**Row interaction shape to mirror** (`shared.tsx` lines 20-40, 86-104):
```tsx
export function PanelRow({ children, onClick, onMouseEnter, onMouseLeave, opacity = 1, className = '', style }: PanelRowProps) {
  return (
    <div
      className={`flex items-center gap-2 py-0.5 cursor-pointer ${className}`}
      style={{ opacity, transition: 'opacity 0.15s', ...style }}
      onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    >{children}</div>
  )
}
```

**Virtualizer wiring — from 05-RESEARCH.md's Code Examples section, over the `DemonRowSource` from `demonBrowser.ts`:**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function DemonBrowser({ source }: { source: DemonRowSource }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: source.count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22, // UI-SPEC's fixed row height, px
    overscan: 12,
  })
  return (
    <div ref={parentRef} style={{ height: 480, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(item => {
          const demon = source.at(item.index) // O(1) or O(log C(n,2)) — never materialized
          return (
            <div key={item.key} style={{ position: 'absolute', top: item.start, height: item.size, width: '100%' }}>
              {/* A::B via zoneLabel(), MESH, TYPE, NAME */}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Selected-row treatment — same token as everywhere else** (UI-SPEC Layout Contract: `rgba(16,255,80,0.08)` background + `box-shadow: inset 0 -1px 0 rgba(16,255,80,0.4)` on the pinned row — identical to `CyberButton`'s `active` state and `RegionsPanel`'s isolate/mute active state above; do not invent a fourth variant of this token).

**Search box** — `app/components/ui/CyberInput.tsx` (full file, 27 lines) used as-is:
```tsx
<CyberInput label="" value={query} onChange={setQuery} placeholder="mesh number or a::b" />
```

**Row-click -> shared detail panel, Demon-shape adapter is required** — see "Shared Patterns > DemonRef -> Demon adapter" below; `DemonBrowser.tsx` must not pass a raw `DemonRef` into `onPinInfo`.

---

### `app/components/demons/DemonFocusView.tsx` (component, chord visualization)

**Analog:** `app/components/projection/Projection.tsx`'s Pandemonium layer (lines 271-292, read in full above) — the existing chord-drawing code for demons, and `app/lib/geometry.ts`'s `curveAway`/`quadPath` (lines 13-37) it calls.

**Chord path + hover/click pattern to reuse (math, not DOM)** (`Projection.tsx` lines 272-291):
```tsx
{layers.has('pandemonium') && !tcActive && demons !== null && demons.filter(d => d.kind !== 'syzygy').map(d => {
  const pathD = curveAway(pos[d.a], pos[d.b], ctr.x, ctr.y, 0.25)
  return (
    <g key={`d-${d.a}:${d.b}`} data-demon={`${d.a}:${d.b}`}>
      <path d={pathD} fill="none" stroke={clr} strokeWidth={...} opacity={...} />
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={12 * ss}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => onHoverInfo({ type: 'demon', demon: d })}
        onMouseLeave={() => onHoverInfo(null)}
        onClick={() => onPinInfo({ type: 'demon', demon: d })} />
    </g>
  )
})}
```
UI-SPEC's explicit requirement: `DemonFocusView` "must render its own compact chord visualization independent of whether the main SVG diagram is mounted — reusing the Pandemonium layer's chord math (not its DOM)". Concretely: extract/reuse `curveAway`/`quadPath` from `app/lib/geometry.ts` with a small self-contained `pos` map (zones placed on a circle for the focus-view's own compact SVG), not `Projection.tsx`'s full zone-position pipeline. Feed it from `g.demons.incident(zone)` (a zone focus, `n-1` chords) or a single `g.demons.ref(a, b)` (a demon focus, one chord) per `engine/core/types.ts` line 93.

**Underlying data — already exists, generator, never materialize:**
```typescript
incident(zone: number): Iterable<DemonRef>   // base - 1 demons, other zone ascending (engine/core/types.ts:93)
```

---

### `app/components/demons/DemonMatrix.tsx` (component, canvas + pan/zoom + hover/click)

**Analog:** `app/hooks/useCanvasPan.ts`'s `useCanvasZoom` for the pan/zoom state slice (see `demonMatrix.ts` section above for the excerpt — this component is the consumer of that hook plus the new `demonMatrix.ts` transform helpers) and `InfoDisplay.tsx`'s hover/pin plumbing (`onHoverInfo`/`onPinInfo` callback shape, used identically here).

**No analog found for the `<canvas>` element and its `ImageData`/`putImageData` draw loop** — no canvas rendering exists anywhere in this SVG-only app yet. Build from 05-RESEARCH.md's Architecture Patterns "DemonMatrix (DEM-04)" block: redraw the full visible raster on pan/zoom-END (debounced), one `g.demons.ref(a,b)` classification per output pixel via `demonMatrix.ts`'s `cellAtPixel`, `ctx.putImageData(...)` once per redraw; during an active drag, CSS-transform the stale bitmap (same `panMs`/`oneTimePaintMs` budget-split mental model the main diagram already uses, per `engine/scene/tier-table.json`).

**Hover/click must always re-derive from the transform, never read the raster back** (D-06's zoom-independence requirement, 05-RESEARCH.md Pattern 3):
```typescript
function onMatrixHover(g: Numogram, px: number, py: number, t: MatrixTransform) {
  const cell = cellAtPixel(px, py, t, g.base)
  if (cell === null) return null
  return g.demons.ref(cell[0], cell[1]) // O(1), authoritative — never sampled from ImageData
}
```

**Thin-diagonal overlay (Pitfall 3):** draw the syzygy diagonal (`a + b = n - 1`) as an explicit geometric line on top of the raster (one line segment from the current transform), not relying on point-sampling to represent it — a 1-cell-wide feature will alias/flicker under coarse sampling otherwise.

**Legend + tooltip styling** — `Pill.tsx` for the four legend swatches (per UI-SPEC: `accent` = kind hex, `gap-2`), floating tooltip styled per UI-SPEC (`background: rgba(8,8,15,0.95)`, `border: 1px solid {kindColor}88`, 10px text, `A::B · MESH · SubtypeLabel`) — no exact existing tooltip component to copy verbatim; closest precedent is `shared.tsx`'s `SidePopover` (lines 172-195, a `createPortal`-based floating card) for the "portal a small box near the cursor" mechanics.

---

### `app/components/numogram/NumogramIcons.tsx` (modified: add `DemonsIcon`)

**Analog:** same file, `UndoIcon`/`ShareIcon` (lines 109-135) — the 12x12 secondary-toolbar icon size class this new icon must match (UI-SPEC: "Rendered at 12x12, matches its row-mates: UndoIcon/RedoIcon/ShareIcon, not 18x18").

```tsx
export function ShareIcon({ clr }: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="12" r="2" stroke={clr} strokeWidth="1.2" />
      <circle cx="18" cy="6" r="2" stroke={clr} strokeWidth="1.2" />
      <circle cx="18" cy="18" r="2" stroke={clr} strokeWidth="1.2" />
      <path d="M8 11L16 7" stroke={clr} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 13L16 17" stroke={clr} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
```
UI-SPEC's exact `DemonsIcon` spec: viewBox `0 0 24 24`, three small filled circles (r=2, `fill={clr}`) at approximately `(7,7)`, `(17,7)`, `(12,17)` connected by three straight strokes (`strokeWidth 1.1`, `stroke={clr}`, `opacity 0.6`) — a triangle, visual echo of `PairGraphIcon` (lines 161-169, also read above) — rendered at 12x12 like `ShareIcon`, not 18x18 like `PairGraphIcon`.

---

### `app/lib/shareParams.ts` (modified: add `demonFilter=`, `demonFocus=`, `demonsOpen=`)

**Analog:** the file's own existing lenient-per-field parsers — `parsePacker` (lines 155-158) for a closed-enum field, `parseRegionList` (lines 131-141) for a validated-against-a-Numogram field — plus `app/lib/regions.ts`'s `isRegionId` (lines 54-60) for the exact-match-never-property-key validation discipline.

**Closed-enum field pattern to copy** (`shareParams.ts` lines 155-158):
```typescript
function parsePacker(raw: string | null): Packer {
  if (raw !== null && (PACKERS as readonly string[]).includes(raw)) return raw as Packer
  return DEFAULT_LAYOUT_PARAMS.packer
}
// demonFilter= follows this exactly: validate raw against DEMON_TYPES/DEMON_SUBTYPES (both exported const tuples
// from engine/index per 05-RESEARCH.md's Security Domain section) before calling g.demons.group()/.subtype() —
// those methods THROW RangeError on an unknown name, so validation must happen before the call, never rely on a
// try/catch around the engine call.
```

**Numogram-validated field pattern to copy** (`shareParams.ts` lines 131-141, 182-187 — only builds a `Numogram` when the param is actually present, exactly the pattern `demonFocus=`'s `z:<zone>` form needs for range-checking against `base`):
```typescript
function parseRegionList(raw: string | null, g: Numogram): readonly RegionId[] {
  if (raw === null) return []
  const set = new Set<RegionId>()
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    if (trimmed === '') continue
    const id = parseRegionId(trimmed, g)
    if (id !== null) set.add(id)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}
// ...
if (rawRegion !== null || rawIsolate !== null || rawMute !== null) {
  const g = createNumogram(base)
  // only construct g when actually needed
}
```

**Omit-at-default convention to follow in the build side** (`shareParams.ts` lines 219-251, `buildShareParams`): every field is written only when it differs from its default — `demonFilter=`/`demonFocus=`/`demonsOpen=` must follow the same rule (omit when "All"/no focus/closed), so a base-10 default-everything state still builds an empty query.

**Test analog:** `tests/app/shareParams.test.ts` (existing) is the direct test-file precedent for round-trip parse/build assertions on the new fields.

---

### `app/NumogramClient.tsx` (modified: entry point button, state, mount `DemonsOverlay`)

**Analog:** itself. The Undo/Redo/Share icon-button block (lines 1379-1422, read in full above) is the exact template for the new "Browse demons" button; the `ZonesPanel`/`RegionsPanel` mounting + `onHoverInfo`/`onPinInfo` prop-threading (lines 1463-1464, 1287-1329) is the template for wiring the demons panel into the existing `hlZones`/`selZones`/`pinnedInfo` state machine (per 05-RESEARCH.md Open Question 2's recommendation: mount as a sibling inside `NumogramClient.tsx`, reuse existing state, no new context needed).

**Entry-point button — copy structure, swap icon/copy/state:**
```tsx
<button
  className="px-1.5 py-1"
  style={{
    color: shareCopied ? '#10ff50' : '#6b7280',
    border: `1px solid ${shareCopied ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
    background: shareCopied ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
  }}
  onClick={onShareExplanation}
  title="Share current state"
  aria-label="Share current state"
>
  <ShareIcon clr={shareCopied ? '#10ff50' : '#6b7280'} />
</button>
```
New button per UI-SPEC: same box treatment, active (overlay open) state uses the identical `rgba(16,255,80,...)` tokens, placed after the Share button in the same `<div className="flex flex-wrap items-center gap-1">` (line 1367), `title`/`aria-label="Browse demons"`, `aria-pressed={open}`, **icon-only, never gated behind `showDiagram`** (unlike `ViewControls`/Text panel, which line 1520/1586's `{showDiagram && (...)}` guards already show are the *wrong* precedent to copy here — Zones/Syzygies/Currents/Gates panels at lines 1463+ are ungated, and that is the precedent to follow).

**State wiring — same shape as existing panels:**
```tsx
const [selZones, setSelZones] = useState<Set<number>>(new Set())   // line 148, existing
const [pinnedInfo, setPinnedInfo] = useState<HoverInfo | null>(null) // line 156, existing
const onHoverInfo = useCallback((info: HoverInfo | null) => { ... }, [])   // line 454, existing
const onPinInfo = useCallback((info: HoverInfo) => { ... }, [])           // line 457, existing
// New: const [demonsOpen, setDemonsOpen] = useState(false)
//      const [demonFilter, setDemonFilter] = useState<DemonFacet>({ kind: 'all' })
//      const [demonFocus, setDemonFocus] = useState<DemonFocusState | null>(null)
// Feed DemonsOverlay the same onHoverInfo/onPinInfo used by ZonesPanel/Projection.tsx today.
```

---

## Shared Patterns

### DemonRef -> Demon shape adapter (CRITICAL — required by every entry point into the shared detail panel)
**Source:** `app/data/types.ts` lines 36-38, 40-45; `app/lib/numogramView.ts` lines 184-193 (`buildStructuralDemons`); `app/presets/base10/demons.ts` lines 19-48 (`legacyKind`)
**Apply to:** `DemonBrowser.tsx` (row click), `DemonMatrix.tsx` (cell click), `DemonFocusView.tsx` (demon-focus click) — anywhere Phase 5 code calls `onPinInfo`/`onHoverInfo` with a demon.

`HoverInfo`'s `'demon'` variant (`app/data/types.ts` line 45) expects the **legacy** `Demon` shape:
```typescript
export interface Demon { a: number; b: number; name: string; kind: string }  // kind: LegacyDemonKind
```
This is **not** the engine's `DemonRef` shape (`{a,b,mesh,type,subtype,syzygetic,numodemon,cycleA,cycleB}`, `engine/core/types.ts` lines 70-77). `InfoDisplay.tsx`'s `DemonInfo` function (lines 288-349, read in full above) is written against the legacy shape and must not be forked (per UI-SPEC: "Do not fork it"). Every new Phase 5 component must convert at the boundary, exactly as `buildStructuralDemons` already does for the existing Pandemonium layer:
```typescript
// app/lib/numogramView.ts lines 184-193, the exact conversion pattern to reuse:
const d = g.demons.at(m)  // or g.demons.ref(a,b), or a DemonRowSource's .at(k)
const legacy: Demon = { a: d.a, b: d.b, name: formatNetSpan(d.a, d.b, g.base), kind: legacyKind(d.subtype) }
onPinInfo({ type: 'demon', demon: legacy })
```
For base 10, `name` should be the CCRU lore name (`DEMON_NAMES[d.mesh]`) when available, falling back to `formatNetSpan`/`zoneLabel`-based net-span text otherwise — matching D-02's "name column empty, not hidden" rule extended to the detail panel.

### Hover-to-preview / click-to-pin interaction model
**Source:** `app/components/info/InfoDisplay.tsx` (whole file, the `onHoverInfo`/`onPinInfo` contract used by every existing layer) and `app/components/projection/Projection.tsx` lines 285-289 (the SVG event-pair example)
**Apply to:** `DemonBrowser.tsx` row hover/click, `DemonMatrix.tsx` cell hover/click, `DemonFocusView.tsx` chord hover/click — D-06 explicitly requires continuing this exact model, never inventing a second one.
```tsx
onMouseEnter={() => onHoverInfo({ type: 'demon', demon: legacyDemon })}
onMouseLeave={() => onHoverInfo(null)}
onClick={() => onPinInfo({ type: 'demon', demon: legacyDemon })}
```

### Selected/active accent token (`#10ff50` family)
**Source:** `app/components/ui/CyberButton.tsx` lines 80-83; `app/components/panels/RegionsPanel.tsx` lines 90-91, 103; `app/NumogramClient.tsx` lines 1412-1421 (Share "copied" state)
**Apply to:** the entry-point button's open state, the active Browser/Focus/Matrix tab, the pinned/selected browser row, the active facet chip.
```
background: 'rgba(16,255,80,0.08)'
boxShadow / box-shadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)'
color: '#10ff50'
```
UI-SPEC is explicit: "never invent a second 'active' treatment" — this is the one and only token for "currently active/selected" anywhere in Phase 5's new UI.

### Demon-kind color taxonomy (separate from the UI accent above — do not conflate)
**Source:** `app/components/info/InfoDisplay.tsx` lines 292-294 (`DemonInfo`'s kind-color switch, the canonical mapping) and `app/presets/base10/demons.ts`'s `legacyKind()` (lines 19-37, the subtype -> kind reduction)
**Apply to:** `DemonFacets.tsx` chip colors, `DemonBrowser.tsx`'s TYPE column, `DemonMatrix.tsx`'s per-cell color and legend, `DemonFocusView.tsx`'s chord color.
```typescript
const kindClr = d.kind === 'chrono' ? '#00ccff'
  : d.kind === 'xeno' ? '#cc3333'
  : d.kind === 'amphi' ? '#cc8833' : '#e8e8e8'  // syzygy
```
Per UI-SPEC's explicit warning: always derive color via `legacyKind(subtype)` (4 buckets), never via the engine's 3-value `DemonType` directly — a `syzygetic-chrono` subtype is `#e8e8e8` (syzygy), not `#00ccff` (chrono), even though its parent type chip is "Chrono."

### Panel-unavailable-at-scale guard
**Source:** `app/components/panels/shared.tsx` lines 108-112 (`PanelUnavailable`)
**Apply to:** any Phase 5 surface that would otherwise need `view` (not `g`) — per Pitfall 2, this should be rare/never in Phase 5's own new components (they all read `g` directly), but if any sub-view accidentally depends on `view`, this is the existing "explain why, don't crash" fallback to reuse rather than inventing a new one.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/lib/demonMatrix.ts` (the `<canvas>`/`ImageData` raster-fill loop specifically, not the pixel<->cell math which has partial analogs above) | utility | transform | No canvas rendering exists anywhere in this SVG-only app yet; Phase 6's Canvas tier for the main diagram hasn't shipped. Build from 05-RESEARCH.md's Architecture Patterns matrix-LOD spec (flagged there as MEDIUM confidence, this phase's own research task). |
| `app/components/demons/DemonMatrix.tsx` (the `<canvas>` element itself and its draw loop) | component | event-driven + transform | Same reason — no precedent component to copy the canvas/raster mechanics from; the pan/zoom *state* (`useCanvasZoom`) and the hover/click *resolve* (`g.demons.ref`, `InfoDisplay` plumbing) both have analogs, but the middle (drawing the raster) does not. |

## Metadata

**Analog search scope:** `app/components/`, `app/lib/`, `app/hooks/`, `app/presets/base10/`, `app/data/`, `engine/core/`, `tests/app/`, `e2e/`
**Files read in full or in targeted excerpts:** `CyberPanel.tsx`, `ShortcutsModal.tsx`, `InfoDisplay.tsx`, `app/presets/base10/demons.ts`, `app/lib/shareParams.ts`, `engine/core/types.ts`, `engine/core/demons.ts`, `ViewContext.tsx`, `app/lib/numogramView.ts`, `NumogramIcons.tsx` (icon rows), `NumogramClient.tsx` (header actions block + state declarations), `Projection.tsx` (Pandemonium layer), `Pill.tsx`, `CyberButtonGroup.tsx`, `CyberInput.tsx`, `CyberButton.tsx`, `BigBaseSummary.tsx`, `useCanvasPan.ts`, `ZonesPanel.tsx`, `RegionsPanel.tsx`, `app/components/panels/shared.tsx`, `app/data/types.ts`, `app/lib/regions.ts`, `app/lib/geometry.ts`, `app/lib/tierBounds.ts`, `tests/app/regions.test.ts`, `e2e/hover-pin.spec.ts`
**Pattern extraction date:** 2026-09-29
