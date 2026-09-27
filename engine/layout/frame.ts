// Frame fit (D-06): the margin around every node disc, the 800x600 minimum frame (small bases keep the base-10
// look) and the 4096 growth cap beyond which everything scales uniformly. Pure; the bbox loop uses explicit initial
// values (never a min/max spread call over an array, which would blow the call stack at large n).

import type { LayoutParams, Point } from './types'

export interface FrameFit {
  readonly scale: number // (0, 1]: uniform shrink applied when the natural size exceeds the cap
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number // >= params.minWidth
  readonly height: number // >= params.minHeight
  readonly naturalWidth: number // content size before the cap and the minimum frame
  readonly naturalHeight: number
}

/**
 * Fits node centres `x`/`y` (uniform node radius `nodeRadius`) into a frame: the bbox of every node disc plus
 * `params.margin + extraPad`, shrunk by `params.cap / max(naturalWidth, naturalHeight)` if that exceeds 1, then
 * grown to at least `params.minWidth` x `params.minHeight` and centred. RangeError on empty input: every base has
 * at least 2 zones, so an empty layout is always a caller bug, never a legitimate degenerate case.
 */
export function fitFrame(x: Float64Array, y: Float64Array, nodeRadius: number, params: LayoutParams, extraPad = 0): FrameFit {
  if (x.length === 0) throw new RangeError('fitFrame: at least one node is required')
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < x.length; i++) {
    const px = x[i] ?? 0
    const py = y[i] ?? 0
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  minX -= nodeRadius
  maxX += nodeRadius
  minY -= nodeRadius
  maxY += nodeRadius

  const pad = params.margin + extraPad
  const naturalWidth = maxX - minX + 2 * pad
  const naturalHeight = maxY - minY + 2 * pad
  const big = Math.max(naturalWidth, naturalHeight)
  const scale = big > params.cap ? params.cap / big : 1
  const width = Math.max(params.minWidth, naturalWidth * scale)
  const height = Math.max(params.minHeight, naturalHeight * scale)
  const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale
  const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale
  return { scale, offsetX, offsetY, width, height, naturalWidth, naturalHeight }
}

/** `xs`/`ys` mapped through `fit` (`v * scale + offset`); returns new arrays, the inputs are never mutated. */
export function applyFit(fit: FrameFit, xs: Float64Array, ys: Float64Array): { x: Float64Array; y: Float64Array } {
  const x = new Float64Array(xs.length)
  const y = new Float64Array(ys.length)
  for (let i = 0; i < xs.length; i++) {
    x[i] = (xs[i] ?? 0) * fit.scale + fit.offsetX
    y[i] = (ys[i] ?? 0) * fit.scale + fit.offsetY
  }
  return { x, y }
}

/** One point (for example a group centre) mapped through `fit` the same way as applyFit. */
export function fitPoint(fit: FrameFit, px: number, py: number): Point {
  return { x: px * fit.scale + fit.offsetX, y: py * fit.scale + fit.offsetY }
}
