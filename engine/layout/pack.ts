// Deterministic glyph packers (D-03, research Pattern 2): pack ring-glyph bounding circles without overlap, in
// canonical cycle order (length descending, then cycle id) so ties are broken by cycle id by construction and no sort
// is needed here. Both packers are pure and dyadic-first: every discrete decision is made on a value rounded to 1/8
// BEFORE it is compared (research Pitfall 15), so packing is bit-stable across engines.

import { roundQ } from './format'

/** Centres relative to the composition origin, by glyph index. */
export interface PackResult { readonly x: Float64Array; readonly y: Float64Array }

/** Throws unless Rb is sorted in non-increasing order (the canonical glyph order both packers require). */
function assertDescending(Rb: Float64Array): void {
  for (let i = 1; i < Rb.length; i++) {
    const prev = Rb[i - 1] ?? 0
    const cur = Rb[i] ?? 0
    if (cur > prev) throw new RangeError('pack: radii must be sorted in non-increasing order')
  }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const GRID_OFFSET = 1048576 // 2^20: recentres a signed cell index before packing it into a single map key
const GRID_STRIDE = 2097152 // 2^21: wide enough that (ix + GRID_OFFSET) never collides with a different iy

/**
 * Golden-angle first fit (D-03, the user's locked wording): glyph 0 sits at the origin; every later glyph walks
 * candidate points along a Fermat spiral (`rho = 0.5 R sqrt(t)`, `theta = t * GOLDEN_ANGLE`), restarting `t` at 1
 * whenever its radius differs from the previous glyph's and otherwise resuming after the previous glyph's accepted
 * `t`, until a candidate (rounded to 1/8 BEFORE the overlap test) clears every already-placed glyph found in a
 * uniform grid's 3x3 neighbourhood. Only `get`/`set` are used on the grid map, never an iteration over it.
 */
export function packSpiral(Rb: Float64Array, gap: number): PackResult {
  assertDescending(Rb)
  const k = Rb.length
  const x = new Float64Array(k)
  const y = new Float64Array(k)
  if (k === 0) return { x, y }
  if (k === 1) return { x, y } // glyph 0 is already at (0, 0)

  const cell = 2 * (Rb[0] ?? 0) + gap
  const grid = new Map<number, number[]>()
  const cellOf = (v: number): number => Math.floor(v / cell)
  const keyOf = (ix: number, iy: number): number => (ix + GRID_OFFSET) * GRID_STRIDE + (iy + GRID_OFFSET)

  function place(i: number, px: number, py: number): void {
    x[i] = px
    y[i] = py
    const key = keyOf(cellOf(px), cellOf(py))
    const bucket = grid.get(key)
    if (bucket === undefined) grid.set(key, [i])
    else bucket.push(i)
  }
  place(0, 0, 0)

  function fits(px: number, py: number, R: number): boolean {
    const ix = cellOf(px)
    const iy = cellOf(py)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(keyOf(ix + dx, iy + dy))
        if (bucket === undefined) continue
        for (const j of bucket) {
          const ddx = px - (x[j] ?? 0)
          const ddy = py - (y[j] ?? 0)
          const limit = R + (Rb[j] ?? 0) + gap
          if (ddx * ddx + ddy * ddy < limit * limit) return false
        }
      }
    }
    return true
  }

  let t = 1
  let prevR = Rb[0] ?? 0
  for (let i = 1; i < k; i++) {
    const R = Rb[i] ?? 0
    if (R !== prevR) t = 1
    prevR = R
    for (;;) {
      const rho = 0.5 * R * Math.sqrt(t)
      const theta = t * GOLDEN_ANGLE
      const px = roundQ(rho * Math.cos(theta))
      const py = roundQ(rho * Math.sin(theta))
      if (fits(px, py, R)) {
        place(i, px, py)
        t++
        break
      }
      t++
    }
  }
  return { x, y }
}

const SHELF_WIDTH_FACTORS = [0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0, 2.3, 2.7]

interface ShelfRow { readonly items: number[]; w: number; h: number }
interface ShelfCandidate { readonly x: Float64Array; readonly y: Float64Array; readonly score: number }

/** One shelf-packing attempt at row width `W`: rows filled left to right (largest first, by construction), centred, stacked top to bottom. */
function packAtWidth(Rb: Float64Array, gap: number, W: number): ShelfCandidate {
  const k = Rb.length
  const x = new Float64Array(k)
  const y = new Float64Array(k)
  const rows: ShelfRow[] = []
  let row: ShelfRow = { items: [], w: 0, h: 0 }
  for (let i = 0; i < k; i++) {
    const d = 2 * (Rb[i] ?? 0) + gap
    if (row.items.length > 0 && row.w + d > W) {
      rows.push(row)
      row = { items: [], w: 0, h: 0 }
    }
    row.items.push(i)
    row.w += d
    if (d > row.h) row.h = d
  }
  rows.push(row)

  let maxRowWidth = 0
  let totalHeight = 0
  for (const r of rows) {
    if (r.w > maxRowWidth) maxRowWidth = r.w
    totalHeight += r.h
  }

  let rowTop = 0
  for (const r of rows) {
    let xx = (maxRowWidth - r.w) / 2
    for (const i of r.items) {
      const d = 2 * (Rb[i] ?? 0) + gap
      x[i] = xx + d / 2
      y[i] = rowTop + r.h / 2
      xx += d
    }
    rowTop += r.h
  }

  return { x, y, score: Math.max(maxRowWidth, totalHeight) }
}

/**
 * Row packing (research Pattern 2, the tighter/cheaper alternative kept selectable, D-03): tries ten row-width
 * candidates derived from the total glyph area and keeps the first strictly best one (`score < best - 1e-9`).
 * Dyadic arithmetic only (every radius a multiple of 1/8): no trig, bit-exact on every engine.
 */
export function packShelf(Rb: Float64Array, gap: number): PackResult {
  assertDescending(Rb)
  const k = Rb.length
  if (k === 0) return { x: new Float64Array(0), y: new Float64Array(0) }
  if (k === 1) return { x: new Float64Array([0]), y: new Float64Array([0]) }

  let area = 0
  for (let i = 0; i < k; i++) {
    const d = 2 * (Rb[i] ?? 0) + gap
    area += d * d
  }
  const minW = 2 * (Rb[0] ?? 0) + gap

  let best: ShelfCandidate | null = null
  for (const f of SHELF_WIDTH_FACTORS) {
    const W = Math.max(minW, Math.ceil(Math.sqrt(area) * f))
    const candidate = packAtWidth(Rb, gap, W)
    if (best === null || candidate.score < best.score - 1e-9) best = candidate
  }
  if (best === null) throw new Error('internal: no shelf candidate was produced')
  return { x: best.x, y: best.y }
}
