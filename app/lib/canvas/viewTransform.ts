// Canvas view transform (Phase 6 REN-02): fit-relative zoom, pan, footprint and backing store. Fit-relative zoom supersedes the UI-SPEC scale rule (research P8). Pure; original CCRUG code (MIT, NOTICE section 1).
//
// World units are the layout's own frame (0 .. width, 0 .. height); screen units are CSS px inside the canvas window of
// w x h CSS px. The frame is letterboxed by fitScale = min(w / width, h / height) and the user's zoom is RELATIVE to that
// fit, so s = fitScale x zoom CSS px per world unit and a tall frame (the ladder is 19 x 4096 at n = 4000) never
// overflows the window at zoom 1. The zoom ceiling is derived from the label threshold in the tier table (never a literal)
// so a node can always be zoomed to twice the threshold. The window is the logical frame of every function here; the
// pixels are painted on a surface (the viewport united with the window, surfaceOf) whose backing store is bounded by an
// area limit (surfaceStore, T-06-02). Every function returns a finite, in-range result for any input: a non-finite transform
// falls back to the identity, a non-positive or non-finite zoom factor is a no-op (the demonMatrix conventions).

import { CANVAS_AREA_LIMIT_PX, LABEL_MIN_RADIUS_PX } from '../tierBounds'
import { DIAGRAM_CSS_WIDTH } from '../viewLayouts'

export const ZOOM_MIN = 0.3 // as the SVG tier's useCanvasZoom
export const ZOOM_MAX_CEILING = 100
export const ZOOM_FLOOR_MAX = 5 // the zoom ceiling is never below the SVG tier's 5
export const ZOOM_STEP = 1.25 // ViewControls step and the +/- keys
export const PAN_KEEP_PX = 24 // at least this much of the frame stays reachable inside the window on each axis
export const FOCUS_MARGIN_PX = 24 // auto-pan keeps a focused element this far inside the window edge (plus its radius)
export const DPR_MAX = 3
export const NARROW_INSET_PX = 16 // canvas width = min(DIAGRAM_CSS_WIDTH, viewport - 16) below 596 px (UI-SPEC [default])
export const HEIGHT_RESERVE_PX = 96 // canvas height <= viewport height - 96

const MIN_FIT = 1e-12 // fitScale never reaches 0 (zero-safe, as the demon matrix's fitScale)

export interface CanvasFrame {
  readonly width: number
  readonly height: number
  /** World radius of a node, used for level of detail (a pair graph passes pillHeight / 2). */
  readonly nodeRadius: number
}

/** zoom is relative to fit (1 = the whole frame letterboxed in the window); tx and ty are a pan in CSS px from centred. */
export interface CanvasTransform {
  readonly zoom: number
  readonly tx: number
  readonly ty: number
}

export const IDENTITY_TRANSFORM: CanvasTransform = Object.freeze({ zoom: 1, tx: 0, ty: 0 })

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function isFiniteTransform(t: CanvasTransform): boolean {
  return Number.isFinite(t.zoom) && Number.isFinite(t.tx) && Number.isFinite(t.ty)
}

/** CSS px per world unit with the whole frame letterboxed in a w x h window: min(w / width, h / height), never 0 or non-finite. */
export function fitScale(frame: CanvasFrame, w: number, h: number): number {
  const s = Math.min(w / frame.width, h / frame.height)
  return Number.isFinite(s) ? Math.max(MIN_FIT, s) : MIN_FIT
}

/** CSS px per world unit at transform t: fitScale x zoom. */
export function scaleOf(t: CanvasTransform, frame: CanvasFrame, w: number, h: number): number {
  return fitScale(frame, w, h) * t.zoom
}

/** On-screen node radius in CSS px (the level-of-detail input): the frame's node radius times the scale. */
export function onScreenRadius(t: CanvasTransform, frame: CanvasFrame, w: number, h: number): number {
  return frame.nodeRadius * scaleOf(t, frame, w, h)
}

/**
 * The zoom ceiling: max(5, 2 x label threshold / fitted node radius), capped at 100, so labels are reachable by zoom at
 * every Canvas base. The threshold comes from the tier table. A node radius that is 0, negative or NaN cannot be reasoned
 * about, so it gets the full ceiling; an infinite one needs no zoom and gets the floor.
 */
export function zoomMax(frame: CanvasFrame, w: number, h: number): number {
  const fittedRadius = frame.nodeRadius * fitScale(frame, w, h)
  const needed = fittedRadius > 0 ? (2 * LABEL_MIN_RADIUS_PX) / fittedRadius : ZOOM_MAX_CEILING
  return Math.min(ZOOM_MAX_CEILING, Math.max(ZOOM_FLOOR_MAX, needed))
}

function clampZoom(zoom: number, zm: number): number {
  return Math.min(zm, Math.max(ZOOM_MIN, zoom))
}

/** World point -> CSS px in the window. */
export function toScreen(
  t: CanvasTransform,
  frame: CanvasFrame,
  w: number,
  h: number,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const s = scaleOf(t, frame, w, h)
  return { x: w / 2 + t.tx + (wx - frame.width / 2) * s, y: h / 2 + t.ty + (wy - frame.height / 2) * s }
}

/** CSS px in the window -> world point (the inverse of toScreen). */
export function toWorld(
  t: CanvasTransform,
  frame: CanvasFrame,
  w: number,
  h: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const s = scaleOf(t, frame, w, h)
  return { x: frame.width / 2 + (sx - w / 2 - t.tx) / s, y: frame.height / 2 + (sy - h / 2 - t.ty) / s }
}

/** The pan limit on one axis: the frame may leave the window until only PAN_KEEP_PX of the window edge is still covered. */
function panLimit(frameExtent: number, s: number, window: number): number {
  const limit = (frameExtent * s) / 2 + window / 2 - PAN_KEEP_PX
  return Number.isFinite(limit) ? Math.max(0, limit) : 0
}

/**
 * zoom clamped to [ZOOM_MIN, zoomMax]; tx and ty clamped so the frame always reaches at least PAN_KEEP_PX into the window
 * from every side (a window too small for that centres the frame). Any non-finite field gives the identity transform
 * rather than propagating NaN (T-06-02).
 */
export function clampTransform(t: CanvasTransform, frame: CanvasFrame, w: number, h: number): CanvasTransform {
  if (!isFiniteTransform(t)) return IDENTITY_TRANSFORM
  const zoom = clampZoom(t.zoom, zoomMax(frame, w, h))
  const s = fitScale(frame, w, h) * zoom
  const limitX = panLimit(frame.width, s, w)
  const limitY = panLimit(frame.height, s, h)
  // + 0 turns a -0 (from clamping to a zero limit) into 0
  return { zoom, tx: clampNum(t.tx, -limitX, limitX) + 0, ty: clampNum(t.ty, -limitY, limitY) + 0 }
}

/**
 * Zoom about the window point (sx, sy): the world point under it stays under it whenever neither the zoom range nor the
 * pan limit intervenes. A factor that is not finite and positive is a no-op (returns t itself).
 */
export function zoomAt(
  t: CanvasTransform,
  factor: number,
  sx: number,
  sy: number,
  frame: CanvasFrame,
  w: number,
  h: number,
): CanvasTransform {
  if (!Number.isFinite(factor) || factor <= 0) return t
  if (!isFiniteTransform(t) || !Number.isFinite(sx) || !Number.isFinite(sy)) return clampTransform(t, frame, w, h)
  const zm = zoomMax(frame, w, h)
  const zoom0 = clampZoom(t.zoom, zm)
  const zoom1 = clampZoom(zoom0 * factor, zm)
  const ratio = zoom1 / zoom0
  const ux = sx - w / 2
  const uy = sy - h / 2
  return clampTransform({ zoom: zoom1, tx: ux - (ux - t.tx) * ratio, ty: uy - (uy - t.ty) * ratio }, frame, w, h)
}

/** Pans by (dx, dy) CSS px, then clamps. A non-finite delta leaves the view where it was (clamped), it never resets it. */
export function panBy(t: CanvasTransform, dx: number, dy: number, frame: CanvasFrame, w: number, h: number): CanvasTransform {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return clampTransform(t, frame, w, h)
  return clampTransform({ zoom: t.zoom, tx: t.tx + dx, ty: t.ty + dy }, frame, w, h)
}

/**
 * The transform that frames the chosen zones: their bounding box plus two node radii on every side, centred in the window
 * and zoomed to fit it (within the zoom range). Ids that are out of range or whose coordinates are not finite are
 * ignored; with none left this is the fit-everything transform.
 */
export function fitZones(
  x: Float64Array,
  y: Float64Array,
  zones: readonly number[],
  frame: CanvasFrame,
  w: number,
  h: number,
): CanvasTransform {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let used = 0
  const known = Math.min(x.length, y.length)
  for (const z of zones) {
    if (!Number.isInteger(z) || z < 0 || z >= known) continue
    const px = x[z] ?? NaN
    const py = y[z] ?? NaN
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
    used++
  }
  if (used === 0) return IDENTITY_TRANSFORM

  const pad = Number.isFinite(frame.nodeRadius) && frame.nodeRadius > 0 ? 2 * frame.nodeRadius : 0
  const boxW = maxX - minX + 2 * pad
  const boxH = maxY - minY + 2 * pad
  const fit = fitScale(frame, w, h)
  const zoom = clampZoom(Math.min(w / boxW, h / boxH) / fit, zoomMax(frame, w, h))
  const s = fit * zoom
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return clampTransform({ zoom, tx: -(cx - frame.width / 2) * s, ty: -(cy - frame.height / 2) * s }, frame, w, h)
}

/** The shift that brings screen coordinate p inside [inset, size - inset]; a window too small for the inset centres it. */
function shiftInto(p: number, inset: number, size: number): number {
  const hi = size - inset
  if (hi < inset) return size / 2 - p
  if (p < inset) return inset - p
  if (p > hi) return hi - p
  return 0
}

/**
 * Pans the minimum amount that puts the world point (wx, wy), drawn with a radius of radiusPx CSS px, at least
 * FOCUS_MARGIN_PX + radiusPx inside the window on every side (the keyboard ring and pinned targets auto-pan with this).
 * A point already that far inside leaves the transform unchanged.
 */
export function ensureVisible(
  t: CanvasTransform,
  wx: number,
  wy: number,
  radiusPx: number,
  frame: CanvasFrame,
  w: number,
  h: number,
): CanvasTransform {
  const base = clampTransform(t, frame, w, h)
  if (!isFiniteTransform(t) || !Number.isFinite(wx) || !Number.isFinite(wy)) return base
  const inset = FOCUS_MARGIN_PX + (Number.isFinite(radiusPx) && radiusPx > 0 ? radiusPx : 0)
  const p = toScreen(base, frame, w, h, wx, wy)
  const dx = shiftInto(p.x, inset, w)
  const dy = shiftInto(p.y, inset, h)
  if (dx === 0 && dy === 0) return base
  return clampTransform({ zoom: base.zoom, tx: base.tx + dx, ty: base.ty + dy }, frame, w, h)
}

/**
 * The canvas window in whole CSS px: the SVG tier's 580 px column on a desktop, min(580, viewport - 16) below 596 px,
 * height = width x frame aspect but at most viewport height - 96. A non-finite viewport counts as 0, so the result is
 * the 1 x 1 minimum rather than a huge canvas (T-06-02).
 */
export function canvasFootprint(
  frame: CanvasFrame,
  viewportW: number,
  viewportH: number,
): { cssWidth: number; cssHeight: number } {
  const vw = Number.isFinite(viewportW) ? viewportW : 0
  const vh = Number.isFinite(viewportH) ? viewportH : 0
  const cssWidth = Math.max(1, Math.floor(Math.min(DIAGRAM_CSS_WIDTH, vw - NARROW_INSET_PX)))
  const validFrame = Number.isFinite(frame.width) && frame.width > 0 && Number.isFinite(frame.height) && frame.height > 0
  const natural = validFrame ? (cssWidth * frame.height) / frame.width : cssWidth
  const cssHeight = Math.max(1, Math.floor(Math.min(natural, vh - HEIGHT_RESERVE_PX)))
  return { cssWidth, cssHeight }
}

/**
 * The most pixels one layer's backing store may hold when it is painted on the paint surface (the viewport united with the
 * window, see surfaceOf): 2^23. The Canvas tier keeps five layers, so the worst case is 5 x 32 MiB of bitmap. Full HD at a
 * device pixel ratio of 2 is 3840 x 2160 = 8.29 M px and keeps its ratio; 4K at a ratio of 2 (33 M px) is lowered to about
 * 1. Tighter than the table's per-window canvasAreaLimitPx, so it is the limit that applies to a surface.
 */
export const CANVAS_SURFACE_AREA_LIMIT_PX = 8_388_608

/** The pixels the Canvas layers are painted on, in CSS px: where the window's top-left sits inside it, and its size. */
export interface CanvasSurface {
  readonly originX: number
  readonly originY: number
  readonly width: number
  readonly height: number
}

/**
 * The paint surface of a window at page position (left, top) of cssWidth x cssHeight CSS px in a viewport of viewportW x
 * viewportH: the union of the viewport [0, vw] x [0, vh] and the window, so a zoomed diagram fills the viewport instead of
 * being cut off at the window's edge. The window stays the logical frame of every transform function (fit, zoom, clamp,
 * pan, pick); only the pixels grow. The surface starts at x0 = min(0, floor(left)) and y0 = min(0, floor(top)) (a whole
 * pixel, so the layer canvases land on the pixel grid) and ends at the ceiling of the larger far edge, so its size is whole
 * CSS px. originX = left - x0 and originY = top - y0 locate the window's top-left inside it (fractional when the window's
 * page position is). A non-finite position or viewport gives the window itself (origin 0, the window's own size): a layout
 * that cannot be measured paints what it always did (T-06-02). A negative viewport counts as 0.
 */
export function surfaceOf(
  left: number,
  top: number,
  cssWidth: number,
  cssHeight: number,
  viewportW: number,
  viewportH: number,
): CanvasSurface {
  const w = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 0
  const h = Number.isFinite(cssHeight) && cssHeight > 0 ? cssHeight : 0
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(viewportW) || !Number.isFinite(viewportH)) {
    return { originX: 0, originY: 0, width: w, height: h }
  }
  const x0 = Math.min(0, Math.floor(left))
  const y0 = Math.min(0, Math.floor(top))
  const x1 = Math.max(Math.max(0, viewportW), Math.ceil(left + w))
  const y1 = Math.max(Math.max(0, viewportH), Math.ceil(top + h))
  return { originX: left - x0, originY: top - y0, width: x1 - x0, height: y1 - y0 }
}

/**
 * The backing store for a cssW x cssH window: the device pixel ratio (a non-finite or non-positive one counts as 1)
 * capped at 3 and reduced when the area would exceed the limit (the table's canvasAreaLimitPx unless one is injected),
 * so pixelWidth x pixelHeight never exceeds it. The store covers the size it is given (the Canvas tier gives it the paint
 * surface, through surfaceStore), never the zoomed frame. An invalid size gives a 0 x 0 store.
 */
export function backingStore(
  cssW: number,
  cssH: number,
  devicePixelRatio: number,
  areaLimitPx: number = CANVAS_AREA_LIMIT_PX,
): { dpr: number; pixelWidth: number; pixelHeight: number } {
  if (!Number.isFinite(cssW) || !Number.isFinite(cssH) || cssW <= 0 || cssH <= 0) {
    return { dpr: 1, pixelWidth: 0, pixelHeight: 0 }
  }
  const limit = Number.isFinite(areaLimitPx) && areaLimitPx > 0 ? areaLimitPx : CANVAS_AREA_LIMIT_PX
  let dpr = Math.min(DPR_MAX, Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1)
  if (cssW * cssH * dpr * dpr > limit) dpr = Math.sqrt(limit / (cssW * cssH))
  return { dpr, pixelWidth: Math.floor(cssW * dpr), pixelHeight: Math.floor(cssH * dpr) }
}

/**
 * The backing store of a paint surface: backingStore for the surface's size, bounded by the tighter of the table's limit and
 * CANVAS_SURFACE_AREA_LIMIT_PX (five layers share the memory), so the device pixel ratio drops on a very large viewport
 * rather than the bitmaps growing without bound. The window's own footprint is untouched; this is only for the surface.
 */
export function surfaceStore(
  surface: CanvasSurface,
  devicePixelRatio: number,
): { dpr: number; pixelWidth: number; pixelHeight: number } {
  return backingStore(surface.width, surface.height, devicePixelRatio, Math.min(CANVAS_AREA_LIMIT_PX, CANVAS_SURFACE_AREA_LIMIT_PX))
}
