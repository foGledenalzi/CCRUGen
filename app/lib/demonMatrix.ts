// Triangular demon matrix math (DEM-04, D-06): transform, exact resolve, raster fill. Original CCRUG code (MIT, NOTICE section 1).

// ── Transform, exact resolve, zoom/pan clamps, cursor stepping (Task 1) ─────

export interface MatrixTransform {
  readonly scale: number // CSS px per cell
  readonly tx: number // screen = t + cell * scale
  readonly ty: number
}
export type Cell = readonly [number, number] // [a, b] with 0 <= b < a < base
export interface Segment {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export const MATRIX_PAD_PX = 8
export const MATRIX_MAX_CELL_PX = 64

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function isFiniteTransform(t: MatrixTransform): boolean {
  return Number.isFinite(t.scale) && Number.isFinite(t.tx) && Number.isFinite(t.ty)
}

/** Math.max(1e-12, (min(w, h) - 2 * MATRIX_PAD_PX) / base): 0-safe (never 0 or negative) for tiny/zero viewports. */
export function fitScale(base: number, w: number, h: number): number {
  return Math.max(1e-12, (Math.min(w, h) - 2 * MATRIX_PAD_PX) / base)
}

/** The whole base x base square, centred and padded by MATRIX_PAD_PX on each side of the shorter dimension. */
export function fitTransform(base: number, w: number, h: number): MatrixTransform {
  const scale = fitScale(base, w, h)
  return { scale, tx: (w - base * scale) / 2, ty: (h - base * scale) / 2 }
}

/**
 * scale clamped to [fitScale, max(MATRIX_MAX_CELL_PX, fitScale)]; tx/ty then clamped so the viewport centre
 * (w/2, h/2) always lies inside the matrix square [tx, tx + base*scale] x [ty, ty + base*scale] (T-05-06: any
 * non-finite field falls back to fitTransform rather than propagating NaN).
 */
export function clampTransform(t: MatrixTransform, base: number, w: number, h: number): MatrixTransform {
  if (!isFiniteTransform(t)) return fitTransform(base, w, h)
  const fs = fitScale(base, w, h)
  const scale = clampNum(t.scale, fs, Math.max(MATRIX_MAX_CELL_PX, fs))
  const tx = clampNum(t.tx, w / 2 - base * scale, w / 2)
  const ty = clampNum(t.ty, h / 2 - base * scale, h / 2)
  return { scale, tx, ty }
}

/**
 * Zoom anchored at (px, py): the fractional cell position under the cursor is preserved whenever the new scale
 * isn't clamped. factor <= 0 or non-finite is a no-op (T-05-06).
 */
export function zoomAt(
  t: MatrixTransform,
  factor: number,
  px: number,
  py: number,
  base: number,
  w: number,
  h: number,
): MatrixTransform {
  if (!Number.isFinite(factor) || factor <= 0) return t
  const fs = fitScale(base, w, h)
  const s2 = clampNum(t.scale * factor, fs, Math.max(MATRIX_MAX_CELL_PX, fs))
  const ratio = s2 / t.scale
  const tx2 = px - (px - t.tx) * ratio
  const ty2 = py - (py - t.ty) * ratio
  return clampTransform({ scale: s2, tx: tx2, ty: ty2 }, base, w, h)
}

export function panBy(t: MatrixTransform, dx: number, dy: number, base: number, w: number, h: number): MatrixTransform {
  return clampTransform({ scale: t.scale, tx: t.tx + dx, ty: t.ty + dy }, base, w, h)
}

/**
 * Screen pixel -> the (a, b) grid cell it currently shows, or null outside the valid a > b triangle. This is the
 * ONLY way hover, click and keyboard resolve a cell — never from raster pixels (T-05-05).
 */
export function cellAtPixel(px: number, py: number, t: MatrixTransform, base: number): Cell | null {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !isFiniteTransform(t)) return null
  const a = Math.floor((px - t.tx) / t.scale)
  const b = Math.floor((py - t.ty) / t.scale)
  if (!(b >= 0 && b < a && a < base)) return null
  return [a, b]
}

export function cellCenter(a: number, b: number, t: MatrixTransform): { readonly x: number; readonly y: number } {
  return { x: t.tx + (a + 0.5) * t.scale, y: t.ty + (b + 0.5) * t.scale }
}

export function cellRect(
  a: number,
  b: number,
  t: MatrixTransform,
): { readonly x: number; readonly y: number; readonly size: number } {
  return { x: t.tx + a * t.scale, y: t.ty + b * t.scale, size: t.scale }
}

export type CursorKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** One step in the triangle, or the input cell unchanged when the step would leave it. */
export function stepCursor(cell: Cell, key: CursorKey, base: number): Cell {
  const [a, b] = cell
  switch (key) {
    case 'ArrowLeft':
      return a - 1 > b ? [a - 1, b] : cell
    case 'ArrowRight':
      return a + 1 < base ? [a + 1, b] : cell
    case 'ArrowUp':
      return b - 1 >= 0 ? [a, b - 1] : cell
    case 'ArrowDown':
      return b + 1 < a ? [a, b + 1] : cell
  }
}

/** Shifts tx/ty by the minimum amount that puts cellRect(a, b) inside [0, w] x [0, h], then re-clamps. */
export function ensureCellVisible(
  t: MatrixTransform,
  a: number,
  b: number,
  base: number,
  w: number,
  h: number,
): MatrixTransform {
  const rect = cellRect(a, b, t)
  let tx = t.tx
  let ty = t.ty
  if (rect.x < 0) tx += -rect.x
  else if (rect.x + rect.size > w) tx -= rect.x + rect.size - w
  if (rect.y < 0) ty += -rect.y
  else if (rect.y + rect.size > h) ty -= rect.y + rect.size - h
  return clampTransform({ scale: t.scale, tx, ty }, base, w, h)
}

/** Cells a + b = base - 1, a > b: from (base/2, base/2 - 1) to (base - 1, 0), through cell centres. */
export function syzygyLine(t: MatrixTransform, base: number): Segment {
  const p1 = cellCenter(base / 2, base / 2 - 1, t)
  const p2 = cellCenter(base - 1, 0, t)
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
}

/** Cells a + b = base, a > b: from (base/2 + 1, base/2 - 1) to (base - 1, 1); null below base 4 (written as `base < 4`). */
export function numodemonLine(t: MatrixTransform, base: number): Segment | null {
  if (base < 4) return null
  const p1 = cellCenter(base / 2 + 1, base / 2 - 1, t)
  const p2 = cellCenter(base - 1, 1, t)
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
}
