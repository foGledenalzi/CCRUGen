// Canvas pick index (Phase 6 D-09): 12 CSS px nearest-wins picking over a zone grid, flattened edge segments, pair pills and demon chords. Hover, click, tap and keyboard all resolve here, never from pixels. Pure; original CCRUG code (MIT, NOTICE section 1).
//
// Distances are measured in CSS px at the current scale (scalePx = CSS px per world unit), so the radius is the same at
// every zoom. A zone is a disc (distance 0 on it), an edge is its flattened polyline (the scene's own pick segments, so
// the hit shape is the drawn shape), a pair is the stadium of its pill, a chord is its flattened curve. Candidates
// beyond PICK_RADIUS_PX are ignored; the nearest wins; equal distances (a disc hit is 0, so are several edges through
// it) resolve zone, syzygy, current, gate, demon chord, then the lower id, because nodes paint over edges. Muted
// elements are never candidates (the caller's filter says so), isolate-dimmed ones are, and a gate is a candidate only
// when the caller reports it drawn (D-04). Cost is the zone grid query plus a per-edge box reject: O(segments) worst
// case, about 0.2 to 1.4 ms at n = 4000 in the research measurements (T-06-19); a non-finite point returns null.

import { PICK_FLATTEN_STEPS, flattenQuad, parseRouteCurve } from '../../../engine/index'
import type { CanvasScene } from '../../../engine/index'
import type { Demon } from '../../data/types'
import { curveAway } from '../geometry'

export const PICK_RADIUS_PX = 12 // D-09: minimum hit radius in CSS px at any zoom (a 24 px WCAG 2.5.8 target)
export const TIE_ORDER = ['zone', 'syzygy', 'current', 'gate', 'chord'] as const

const GRID_CELL_NODES = 4 // a grid cell is this many node radii wide
const MIN_GRID_CELL = 1e-6
const MAX_GRID_CELLS_PER_ZONE = 8 // the grid never has more cells than this per zone (plus MIN_GRID_CELLS)
const MIN_GRID_CELLS = 64
const QUERY_SLACK = 1e-9 // relative margin on the world-space query so a boundary element is never lost to rounding
const CHORD_CURVE_FACTOR = 0.25 // the demon focus chord's curveAway factor in the SVG tier

export type PickKind = 'zone' | 'pair' | 'syzygy' | 'current' | 'gate' | 'chord'

/** id: the zone (zone), the pair id (pair, syzygy, current), the origin zone (gate) or the chord's index (chord). */
export interface PickHit {
  readonly kind: PickKind
  readonly id: number
  readonly distancePx: number
}

/** CSR uniform grid over zone centres: cell (col, row) holds items[cellStart[row * cols + col] .. cellStart[... + 1]). */
export interface ZoneGrid {
  readonly cellSize: number
  readonly minX: number
  readonly minY: number
  readonly cols: number
  readonly rows: number
  readonly cellStart: Int32Array
  readonly items: Int32Array
}

/**
 * What may be picked right now. zoneAllowed(zone) is false for a muted zone; edgeAllowed says whether an edge is a
 * candidate (muted endpoints excluded, and a gate only when it is drawn).
 */
export interface PickFilter {
  zoneAllowed(zone: number): boolean
  edgeAllowed(kind: 'syzygy' | 'current' | 'gate', id: number): boolean
}

/** Flattened demon chords: CSR over chords (chordStart indexes segments), four numbers per segment, and each chord's end zones. */
export interface FlatChords {
  readonly segments: Float64Array
  readonly chordStart: Int32Array
  readonly zoneA: Int32Array
  readonly zoneB: Int32Array
}

const RANK: Readonly<Record<PickKind, number>> = {
  zone: TIE_ORDER.indexOf('zone'),
  pair: TIE_ORDER.indexOf('zone'), // a pill ranks with a zone: it is the node of the pair graph
  syzygy: TIE_ORDER.indexOf('syzygy'),
  current: TIE_ORDER.indexOf('current'),
  gate: TIE_ORDER.indexOf('gate'),
  chord: TIE_ORDER.indexOf('chord'),
}

// ---------------------------------------------------------------------------------------------------------------
// Distances

function segDistSq(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const ex = px - (x0 + t * dx)
  const ey = py - (y0 + t * dy)
  return ex * ex + ey * ey
}

/** Distance from a point to a segment; Infinity when any input is not finite. */
export function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
    return Infinity
  }
  return Math.sqrt(segDistSq(px, py, x0, y0, x1, y1))
}

/**
 * Distance from a point to the outside of a pair pill, 0 inside it: the pill is a stadium (a rounded rectangle whose
 * corner radius is half its height), so this is the distance to its core segment minus that radius. Infinity when any
 * input is not finite.
 */
export function distToStadium(px: number, py: number, cx: number, cy: number, width: number, height: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return Infinity
  }
  const radius = Math.min(width, height) / 2
  const half = Math.max(0, (width - height) / 2)
  const qx = px < cx - half ? cx - half : px > cx + half ? cx + half : px
  return Math.max(0, Math.hypot(px - qx, py - cy) - radius)
}

// ---------------------------------------------------------------------------------------------------------------
// Zone grid

function cellOf(v: number, min: number, cell: number, count: number): number {
  const c = Math.floor((v - min) / cell)
  return c >= 0 ? Math.min(c, count - 1) : 0 // also maps NaN to 0
}

/**
 * The CSR zone grid: a cell is max(4 x nodeRadius, 1e-6) wide, grown by doubling when that would make more than
 * 8 cells per zone (a tiny or zero radius over a large frame), so the grid size is bounded by the zone count. Zones with
 * a non-finite coordinate are left out. Items inside a cell are in ascending zone order.
 */
export function buildZoneGrid(x: Float64Array, y: Float64Array, nodeRadius: number): ZoneGrid {
  const n = Math.min(x.length, y.length)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let used = 0
  for (let i = 0; i < n; i++) {
    const px = x[i] ?? NaN
    const py = y[i] ?? NaN
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
    used++
  }
  if (used === 0) {
    return { cellSize: 1, minX: 0, minY: 0, cols: 1, rows: 1, cellStart: new Int32Array(2), items: new Int32Array(0) }
  }

  const extentX = maxX - minX
  const extentY = maxY - minY
  let cell = Math.max(GRID_CELL_NODES * (Number.isFinite(nodeRadius) && nodeRadius > 0 ? nodeRadius : 0), MIN_GRID_CELL)
  const maxCells = Math.max(MIN_GRID_CELLS, MAX_GRID_CELLS_PER_ZONE * n)
  if (Number.isFinite(extentX) && Number.isFinite(extentY)) {
    while ((Math.floor(extentX / cell) + 1) * (Math.floor(extentY / cell) + 1) > maxCells) cell *= 2
  }
  const cols = Number.isFinite(extentX) ? Math.floor(extentX / cell) + 1 : 1
  const rows = Number.isFinite(extentY) ? Math.floor(extentY / cell) + 1 : 1

  const cellStart = new Int32Array(cols * rows + 1)
  for (let i = 0; i < n; i++) {
    const px = x[i] ?? NaN
    const py = y[i] ?? NaN
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    cellStart[cellOf(py, minY, cell, rows) * cols + cellOf(px, minX, cell, cols) + 1]++
  }
  for (let c = 0; c < cols * rows; c++) cellStart[c + 1] = (cellStart[c + 1] ?? 0) + (cellStart[c] ?? 0)
  const items = new Int32Array(used)
  const cursor = cellStart.slice(0, cols * rows)
  for (let i = 0; i < n; i++) {
    const px = x[i] ?? NaN
    const py = y[i] ?? NaN
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    const c = cellOf(py, minY, cell, rows) * cols + cellOf(px, minX, cell, cols)
    items[cursor[c] ?? 0] = i
    cursor[c] = (cursor[c] ?? 0) + 1
  }
  return { cellSize: cell, minX, minY, cols, rows, cellStart, items }
}

// ---------------------------------------------------------------------------------------------------------------
// Demon chords

/**
 * Flattens demon focus chords for picking: each chord is the curveAway(from, to, centre, 0.25) route the SVG tier draws,
 * parsed with parseRouteCurve and flattened into PICK_FLATTEN_STEPS segments. A chord with an out-of-range zone, a
 * non-finite coordinate or a route that does not parse has no segments (and so is never picked).
 */
export function flattenChords(chords: readonly Demon[], x: Float64Array, y: Float64Array, cx: number, cy: number): FlatChords {
  const count = chords.length
  const known = Math.min(x.length, y.length)
  const curves = new Float64Array(6 * count)
  const valid: boolean[] = new Array<boolean>(count).fill(false)
  const zoneA = new Int32Array(count).fill(-1)
  const zoneB = new Int32Array(count).fill(-1)
  let validCount = 0
  const scratch = new Float64Array(6)
  for (let c = 0; c < count; c++) {
    const demon = chords[c]
    if (demon === undefined) continue
    const { a, b } = demon
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= known || b >= known) continue
    zoneA[c] = a
    zoneB[c] = b
    const ax = x[a] ?? NaN
    const ay = y[a] ?? NaN
    const bx = x[b] ?? NaN
    const by = y[b] ?? NaN
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(cx) || !Number.isFinite(cy)) continue
    try {
      const route = curveAway({ x: ax, y: ay }, { x: bx, y: by }, cx, cy, CHORD_CURVE_FACTOR)
      if (!parseRouteCurve(route, scratch, 0)) continue
    } catch {
      continue // a route that overflows or does not parse is not pickable
    }
    curves.set(scratch, 6 * c)
    valid[c] = true
    validCount++
  }

  const segments = new Float64Array(4 * PICK_FLATTEN_STEPS * validCount)
  const chordStart = new Int32Array(count + 1)
  let at = 0
  for (let c = 0; c < count; c++) {
    if (valid[c] === true) {
      flattenQuad(curves, 6 * c, PICK_FLATTEN_STEPS, segments, 4 * at)
      at += PICK_FLATTEN_STEPS
    }
    chordStart[c + 1] = at
  }
  return { segments, chordStart, zoneA, zoneB }
}

// ---------------------------------------------------------------------------------------------------------------
// Picking

/** The two member zones of pair q: the engine's pair id is the lower member and the pair's zones sum to base - 1. */
function pairMembers(base: number, q: number): readonly [number, number] {
  return [q, base - 1 - q]
}

/**
 * The element under a world point, or null. scalePx is CSS px per world unit (fitScale x zoom), so the pick radius is
 * PICK_RADIUS_PX CSS px at any zoom. The filter reports muted zones and edges that are not drawn; chords are the
 * flattened demon focus chords currently drawn, if any (a chord is skipped when either end zone is not allowed).
 */
export function pickAt(
  scene: CanvasScene,
  grid: ZoneGrid,
  wx: number,
  wy: number,
  scalePx: number,
  filter: PickFilter,
  chords: FlatChords | null = null,
): PickHit | null {
  if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(scalePx) || scalePx <= 0) return null
  const radiusWorld = (PICK_RADIUS_PX / scalePx) * (1 + QUERY_SLACK)
  const best: { kind: PickKind | null; id: number; d: number; rank: number } = { kind: null, id: -1, d: Infinity, rank: Infinity }

  const wins = (kind: PickKind, id: number, d: number): boolean => {
    if (!(d <= PICK_RADIUS_PX)) return false
    if (best.kind === null || d < best.d) return true
    if (d > best.d) return false
    const rank = RANK[kind]
    return rank < best.rank || (rank === best.rank && id < best.id)
  }
  const take = (kind: PickKind, id: number, d: number): void => {
    best.kind = kind
    best.id = id
    best.d = d
    best.rank = RANK[kind]
  }

  if (scene.kind === 'zones') {
    // zones: the grid cells that overlap the query square around the point
    const radius = scene.nodeRadius
    const reach = (radius > 0 ? radius : 0) + radiusWorld
    const c0 = Math.floor((wx - reach - grid.minX) / grid.cellSize)
    const c1 = Math.floor((wx + reach - grid.minX) / grid.cellSize)
    const r0 = Math.floor((wy - reach - grid.minY) / grid.cellSize)
    const r1 = Math.floor((wy + reach - grid.minY) / grid.cellSize)
    if (c1 >= 0 && c0 <= grid.cols - 1 && r1 >= 0 && r0 <= grid.rows - 1) {
      const colFrom = Math.max(0, c0)
      const colTo = Math.min(grid.cols - 1, c1)
      const rowFrom = Math.max(0, r0)
      const rowTo = Math.min(grid.rows - 1, r1)
      for (let row = rowFrom; row <= rowTo; row++) {
        for (let col = colFrom; col <= colTo; col++) {
          const cell = row * grid.cols + col
          const end = grid.cellStart[cell + 1] ?? 0
          for (let k = grid.cellStart[cell] ?? 0; k < end; k++) {
            const z = grid.items[k] ?? -1
            const d = Math.max(0, Math.hypot(wx - (scene.x[z] ?? NaN), wy - (scene.y[z] ?? NaN)) * scalePx - radius * scalePx)
            if (wins('zone', z, d) && filter.zoneAllowed(z)) take('zone', z, d)
          }
        }
      }
    }

    // edges: syzygies 0..P-1, currents P..2P-1, gates 2P.. (the scene's CSR order); the edge box rejects most edges
    const P = scene.currentTo.length
    const edges = scene.edgeSegStart.length - 1
    for (let e = 0; e < edges; e++) {
      const from = scene.edgeSegStart[e] ?? 0
      const to = scene.edgeSegStart[e + 1] ?? 0
      if (from >= to) continue
      const minX = scene.edgeBox[4 * e] ?? NaN
      const minY = scene.edgeBox[4 * e + 1] ?? NaN
      const maxX = scene.edgeBox[4 * e + 2] ?? NaN
      const maxY = scene.edgeBox[4 * e + 3] ?? NaN
      if (!(wx >= minX - radiusWorld && wx <= maxX + radiusWorld && wy >= minY - radiusWorld && wy <= maxY + radiusWorld)) continue
      const kind: 'syzygy' | 'current' | 'gate' = e < P ? 'syzygy' : e < 2 * P ? 'current' : 'gate'
      const id = e < P ? e : e < 2 * P ? e - P : e - 2 * P
      let minSq = Infinity
      for (let s = from; s < to; s++) {
        const sq = segDistSq(
          wx,
          wy,
          scene.pickSegments[4 * s] ?? NaN,
          scene.pickSegments[4 * s + 1] ?? NaN,
          scene.pickSegments[4 * s + 2] ?? NaN,
          scene.pickSegments[4 * s + 3] ?? NaN,
        )
        if (sq < minSq) minSq = sq
      }
      const d = Math.sqrt(minSq) * scalePx
      if (wins(kind, id, d) && filter.edgeAllowed(kind, id)) take(kind, id, d)
    }
  } else if (scene.px !== null && scene.py !== null) {
    // pair pills: brute force with a box reject (the pair graph has at most base / 2 pills)
    const halfW = scene.pillWidth / 2 + radiusWorld
    const halfH = scene.pillHeight / 2 + radiusWorld
    for (let q = 0; q < scene.px.length; q++) {
      const cx = scene.px[q] ?? NaN
      const cy = scene.py[q] ?? NaN
      if (Math.abs(wx - cx) > halfW || Math.abs(wy - cy) > halfH) continue
      const d = distToStadium(wx, wy, cx, cy, scene.pillWidth, scene.pillHeight) * scalePx
      if (!wins('pair', q, d)) continue
      const [lo, hi] = pairMembers(scene.base, q)
      if (filter.zoneAllowed(lo) && filter.zoneAllowed(hi)) take('pair', q, d)
    }
  }

  if (chords !== null) {
    const count = chords.chordStart.length - 1
    for (let c = 0; c < count; c++) {
      const from = chords.chordStart[c] ?? 0
      const to = chords.chordStart[c + 1] ?? 0
      if (from >= to) continue
      let minSq = Infinity
      for (let s = from; s < to; s++) {
        const sq = segDistSq(
          wx,
          wy,
          chords.segments[4 * s] ?? NaN,
          chords.segments[4 * s + 1] ?? NaN,
          chords.segments[4 * s + 2] ?? NaN,
          chords.segments[4 * s + 3] ?? NaN,
        )
        if (sq < minSq) minSq = sq
      }
      const d = Math.sqrt(minSq) * scalePx
      if (wins('chord', c, d) && filter.zoneAllowed(chords.zoneA[c] ?? -1) && filter.zoneAllowed(chords.zoneB[c] ?? -1)) take('chord', c, d)
    }
  }

  return best.kind === null ? null : { kind: best.kind, id: best.id, distancePx: best.d }
}

/**
 * The allowed zones whose centres lie in the world rectangle (inclusive; corners in any order), in ascending order: the
 * rubber-band selection resolves through this. A non-finite rectangle selects nothing.
 */
export function zonesInWorldRect(
  scene: CanvasScene,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  filter: PickFilter,
): number[] {
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return []
  const x0 = Math.min(minX, maxX)
  const x1 = Math.max(minX, maxX)
  const y0 = Math.min(minY, maxY)
  const y1 = Math.max(minY, maxY)
  const out: number[] = []
  const n = Math.min(scene.x.length, scene.y.length)
  for (let z = 0; z < n; z++) {
    const px = scene.x[z] ?? NaN
    const py = scene.y[z] ?? NaN
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1 && filter.zoneAllowed(z)) out.push(z)
  }
  return out
}
