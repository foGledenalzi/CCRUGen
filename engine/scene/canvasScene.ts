// Canvas scene (Phase 6 REN-02, D-04, D-05): typed arrays a Canvas renderer draws and picks from, built from the engine's own layouts and routes. Pure; original CCRUG code (MIT, NOTICE section 1).
//
// The scene is a packaging step, not new geometry: coordinates come from the layout, every zone-layout route string
// (gate, current leg, current stem) is parsed ONCE into one quadratic curve of six numbers (x0 y0 cx cy x1 y1; a
// straight `L` stores its midpoint as the control), and syzygies reuse the exact endpoint trimming svgString.ts uses,
// so the SVG tier and the Canvas tier draw the same geometry. Flattened pick segments with per-edge boxes let a
// renderer hit-test every edge without re-routing.
//
// Trust boundary (T-06-15): parseRouteCurve is the only reader of route text on the Canvas path. It accepts a character
// whitelist and exactly `M x y L x y` or `M x y Q x y x y`; anything else throws a RangeError and an empty string
// becomes a NaN curve that drawing and picking skip. Transfer safety (T-06-13): every typed array is allocated on its
// own buffer and copied from the layout, so a transfer list never names a buffer twice or detaches a sibling.
// Cost (T-06-16): O(n) arrays, about 100k numbers at n = 4000; callers build a scene only up to the shipped ceiling.

import type { Numogram } from '../core/types'
import type { CurrentRoutes, GateRoutes, Layout, PairGraphLayout, PairGraphRoutes, RegionLabel } from '../layout/types'

export const CURVE_STRIDE = 6 // x0 y0 cx cy x1 y1
export const PICK_FLATTEN_STEPS = 8 // chords per quadratic for picking (research Pattern 6: 6 is within 0.4% of curve length; 8 for margin)
export const EDGE_KIND = Object.freeze({ syzygy: 0, current: 1, gate: 2 } as const)

const CURRENT_STRIDE = 3 * CURVE_STRIDE // legA, legB, stem per pair id

export type SceneKind = 'zones' | 'pairs'

export interface CanvasScene {
  readonly kind: SceneKind
  readonly base: number
  readonly layoutId: string
  readonly width: number
  readonly height: number
  readonly centerX: number
  readonly centerY: number
  readonly nodeRadius: number
  readonly labelSize: number
  readonly strokeScale: number
  readonly x: Float64Array // by zone (pairs: both members sit on their pill, as the layout says)
  readonly y: Float64Array
  readonly drawOrder: Int32Array // zones back to front
  readonly regionLabels: readonly RegionLabel[]
  readonly syzygySeg: Float64Array // 4 per pair id (zones only; length 0 for pairs)
  readonly currentCurves: Float64Array // 18 per pair id: legA, legB, stem (zones only)
  readonly currentKind: Uint8Array // by pair id (zones only)
  readonly junctionX: Float64Array
  readonly junctionY: Float64Array
  readonly currentTo: Int32Array // by pair id: g.current(q).to (both kinds)
  readonly gateCurves: Float64Array // 6 per origin zone (zones only)
  readonly gateLoop: Uint8Array
  readonly gateTo: Int32Array
  readonly gateLabelX: Float64Array
  readonly gateLabelY: Float64Array
  readonly px: Float64Array | null // pairs only: pill centre by pair id
  readonly py: Float64Array | null
  readonly pillWidth: number // 0 for zones
  readonly pillHeight: number
  readonly pairArc: readonly (string | null)[] | null // pairs only, drawn from the engine's own path strings
  readonly pairLoop: readonly (string | null)[] | null
  readonly edgeSegStart: Int32Array // CSR over edges: syzygies 0..P-1, currents P..2P-1, gates 2P..2P+n-1 (zones); Int32Array.of(0) for pairs
  readonly edgeBox: Float64Array // 4 per edge: minX minY maxX maxY (world units)
  readonly pickSegments: Float64Array // 4 per segment: x0 y0 x1 y1 (world units)
}

// ---------------------------------------------------------------------------------------------------------------
// Route parser

const ROUTE_SAFE = /^[MLQ0-9eE+\-., ]*$/
const ROUTE_TOKEN = /[MLQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
const MAX_ROUTE_TOKENS = 8 // `M x y Q cx cy x y` is eight tokens: the longest accepted path

function unsupportedPath(d: string): RangeError {
  return new RangeError(`parseRouteCurve: unsupported path ${JSON.stringify(d.slice(0, 80))}`)
}

/** Splits a whitelisted route string into command letters and number tokens; null on any unrecognised character. */
function tokenizeRoute(d: string): string[] | null {
  const tokens: string[] = []
  let i = 0
  while (i < d.length) {
    const c = d.charCodeAt(i)
    if (c === 32 || c === 44) {
      i += 1
      continue
    }
    ROUTE_TOKEN.lastIndex = i
    const m = ROUTE_TOKEN.exec(d)
    if (m === null || tokens.length === MAX_ROUTE_TOKENS) return null
    tokens.push(m[0])
    i = ROUTE_TOKEN.lastIndex
  }
  return tokens
}

/**
 * Parses one engine route string into a quadratic curve at `out[offset .. offset + 6)`. Accepts exactly `M x y L x y`
 * (stored with its midpoint as the control point) or `M x y Q cx cy x y`; the empty string writes six NaN and returns
 * false; anything else (a cubic, an arc, a stray character, a wrong count, a number that overflows) throws a RangeError.
 */
export function parseRouteCurve(d: string, out: Float64Array, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset + CURVE_STRIDE > out.length) {
    throw new RangeError(`parseRouteCurve: offset ${offset} does not fit an output of length ${out.length}`)
  }
  if (d.length === 0) {
    for (let i = 0; i < CURVE_STRIDE; i++) out[offset + i] = NaN
    return false
  }
  if (!ROUTE_SAFE.test(d)) throw unsupportedPath(d)
  const tokens = tokenizeRoute(d)
  if (tokens === null) throw unsupportedPath(d)
  const command = tokens[3]
  const expected = command === 'L' ? 6 : command === 'Q' ? 8 : 0
  if (tokens[0] !== 'M' || expected === 0 || tokens.length !== expected) throw unsupportedPath(d)
  const nums: number[] = []
  for (let i = 1; i < tokens.length; i++) {
    if (i === 3) continue
    // A command letter in a number slot ('M1 M2 ...') and an overflow ('1e999') are both non-finite here.
    const v = Number(tokens[i])
    if (!Number.isFinite(v)) throw unsupportedPath(d)
    nums.push(v)
  }
  const x0 = nums[0] ?? NaN
  const y0 = nums[1] ?? NaN
  if (command === 'L') {
    const x1 = nums[2] ?? NaN
    const y1 = nums[3] ?? NaN
    out[offset] = x0
    out[offset + 1] = y0
    out[offset + 2] = (x0 + x1) / 2
    out[offset + 3] = (y0 + y1) / 2
    out[offset + 4] = x1
    out[offset + 5] = y1
  } else {
    out[offset] = x0
    out[offset + 1] = y0
    out[offset + 2] = nums[2] ?? NaN
    out[offset + 3] = nums[3] ?? NaN
    out[offset + 4] = nums[4] ?? NaN
    out[offset + 5] = nums[5] ?? NaN
  }
  return true
}

/**
 * Flattens the quadratic at `curves[offset .. offset + 6)` into `steps` chords of four numbers (x0 y0 x1 y1) written at
 * `out[outOffset ..]`, evaluating the Bezier formula at t = i / steps so consecutive chords share their joint exactly
 * and the ends are the curve's own end points. Returns `steps`, or 0 (writing nothing) when the curve is NaN.
 */
export function flattenQuad(curves: Float64Array, offset: number, steps: number, out: Float64Array, outOffset: number): number {
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError(`flattenQuad: steps must be a positive integer, got ${steps}`)
  const x0 = curves[offset] ?? NaN
  if (Number.isNaN(x0)) return 0 // checked before the bounds: a NaN curve reserves no output, so it may sit past the end
  if (outOffset < 0 || outOffset + 4 * steps > out.length) {
    throw new RangeError(`flattenQuad: ${steps} chords do not fit at offset ${outOffset} of an output of length ${out.length}`)
  }
  const y0 = curves[offset + 1] ?? NaN
  const cx = curves[offset + 2] ?? NaN
  const cy = curves[offset + 3] ?? NaN
  const x1 = curves[offset + 4] ?? NaN
  const y1 = curves[offset + 5] ?? NaN
  let px = x0
  let py = y0
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const a = u * u
    const b = 2 * u * t
    const c = t * t
    const qx = a * x0 + b * cx + c * x1
    const qy = a * y0 + b * cy + c * y1
    const o = outOffset + 4 * (i - 1)
    out[o] = px
    out[o + 1] = py
    out[o + 2] = qx
    out[o + 3] = qy
    px = qx
    py = qy
  }
  return steps
}

/** The number of edges of a scene: pairs + pairs + zones for a zone layout (syzygies, currents, gates), 0 for the pair graph. */
export function edgeCount(scene: CanvasScene): number {
  return scene.edgeSegStart.length - 1
}

// ---------------------------------------------------------------------------------------------------------------
// Pick data

interface PickData {
  readonly edgeSegStart: Int32Array
  readonly edgeBox: Float64Array
  readonly pickSegments: Float64Array
}

/** Flattened pick segments over every edge in the order syzygies, currents (legA, legB, stem), gates, two passes (count, fill). */
function buildPickData(P: number, n: number, syzygySeg: Float64Array, currentCurves: Float64Array, gateCurves: Float64Array): PickData {
  const E = 2 * P + n
  const hasCurve = (curves: Float64Array, offset: number): number => (Number.isNaN(curves[offset]) ? 0 : 1)
  const segmentsOf = (e: number): number => {
    if (e < P) return 1
    if (e < 2 * P) {
      const o = CURRENT_STRIDE * (e - P)
      return (
        PICK_FLATTEN_STEPS *
        (hasCurve(currentCurves, o) + hasCurve(currentCurves, o + CURVE_STRIDE) + hasCurve(currentCurves, o + 2 * CURVE_STRIDE))
      )
    }
    return PICK_FLATTEN_STEPS * hasCurve(gateCurves, CURVE_STRIDE * (e - 2 * P))
  }

  const edgeSegStart = new Int32Array(E + 1)
  let total = 0
  for (let e = 0; e < E; e++) {
    total += segmentsOf(e)
    edgeSegStart[e + 1] = total
  }

  const pickSegments = new Float64Array(4 * total)
  const edgeBox = new Float64Array(4 * E)
  for (let e = 0; e < E; e++) {
    const from = edgeSegStart[e] ?? 0
    const to = edgeSegStart[e + 1] ?? 0
    if (e < P) {
      for (let i = 0; i < 4; i++) pickSegments[4 * from + i] = syzygySeg[4 * e + i] ?? NaN
    } else if (e < 2 * P) {
      const o = CURRENT_STRIDE * (e - P)
      let at = 4 * from
      for (let leg = 0; leg < 3; leg++) at += 4 * flattenQuad(currentCurves, o + CURVE_STRIDE * leg, PICK_FLATTEN_STEPS, pickSegments, at)
    } else {
      flattenQuad(gateCurves, CURVE_STRIDE * (e - 2 * P), PICK_FLATTEN_STEPS, pickSegments, 4 * from)
    }

    if (from === to) {
      for (let i = 0; i < 4; i++) edgeBox[4 * e + i] = NaN
      continue
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let s = from; s < to; s++) {
      for (let k = 0; k < 2; k++) {
        const x = pickSegments[4 * s + 2 * k] ?? NaN
        const y = pickSegments[4 * s + 2 * k + 1] ?? NaN
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    edgeBox[4 * e] = minX
    edgeBox[4 * e + 1] = minY
    edgeBox[4 * e + 2] = maxX
    edgeBox[4 * e + 3] = maxY
  }
  return { edgeSegStart, edgeBox, pickSegments }
}

// ---------------------------------------------------------------------------------------------------------------
// Builders

/** A layout built for another base would index every array wrongly: refuse it before anything is read. */
function assertLayoutBase(g: Numogram, layout: Layout): void {
  if (layout.base !== g.base) {
    throw new RangeError(`canvasScene: layout base ${layout.base} does not match numogram base ${g.base}`)
  }
}

/**
 * The scene of a zone layout (ring, ladder, spiral or a base-10 preset) with its gate and current routes: coordinates,
 * syzygy segments trimmed exactly as svgString.ts trims them, every gate and current route as one curve of six
 * numbers, the route side arrays, and flattened pick segments with per-edge boxes. Pure; deterministic. Throws a
 * RangeError for a layout of another base, a pair-graph layout (use buildPairScene) or routes of the wrong length.
 */
export function buildZoneScene(g: Numogram, layout: Layout, gates: GateRoutes, currents: CurrentRoutes): CanvasScene {
  assertLayoutBase(g, layout)
  if ('px' in layout) throw new RangeError('canvasScene: buildZoneScene got a pair-graph layout')
  const n = g.zoneCount
  const P = g.pairCount
  if (
    gates.d.length !== n ||
    currents.legA.length !== P ||
    currents.legB.length !== P ||
    currents.stem.length !== P
  ) {
    throw new RangeError(`canvasScene: routes do not match numogram base ${g.base}`)
  }
  const r = layout.nodeRadius

  const syzygySeg = new Float64Array(4 * P)
  const currentTo = new Int32Array(P)
  for (let q = 0; q < P; q++) {
    const info = g.pair(q)
    const x1 = layout.x[info.lo] ?? 0
    const y1 = layout.y[info.lo] ?? 0
    const x2 = layout.x[info.hi] ?? 0
    const y2 = layout.y[info.hi] ?? 0
    const rLo = layout.nodeRadii?.[info.lo] ?? r
    const rHi = layout.nodeRadii?.[info.hi] ?? r
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.hypot(dx, dy)
    if (dist <= 2 * r) {
      syzygySeg[4 * q] = x1
      syzygySeg[4 * q + 1] = y1
      syzygySeg[4 * q + 2] = x2
      syzygySeg[4 * q + 3] = y2
    } else {
      const ux = dx / dist
      const uy = dy / dist
      syzygySeg[4 * q] = x1 + ux * rLo
      syzygySeg[4 * q + 1] = y1 + uy * rLo
      syzygySeg[4 * q + 2] = x2 - ux * rHi
      syzygySeg[4 * q + 3] = y2 - uy * rHi
    }
    currentTo[q] = g.current(q).to
  }

  const currentCurves = new Float64Array(CURRENT_STRIDE * P)
  for (let q = 0; q < P; q++) {
    const o = CURRENT_STRIDE * q
    parseRouteCurve(currents.legA[q] ?? '', currentCurves, o)
    parseRouteCurve(currents.legB[q] ?? '', currentCurves, o + CURVE_STRIDE)
    parseRouteCurve(currents.stem[q] ?? '', currentCurves, o + 2 * CURVE_STRIDE)
  }

  const gateCurves = new Float64Array(CURVE_STRIDE * n)
  for (let z = 0; z < n; z++) parseRouteCurve(gates.d[z] ?? '', gateCurves, CURVE_STRIDE * z)

  const pick = buildPickData(P, n, syzygySeg, currentCurves, gateCurves)

  return {
    kind: 'zones',
    base: g.base,
    layoutId: layout.id,
    width: layout.width,
    height: layout.height,
    centerX: layout.center.x,
    centerY: layout.center.y,
    nodeRadius: layout.nodeRadius,
    labelSize: layout.labelSize,
    strokeScale: layout.strokeScale,
    x: layout.x.slice(),
    y: layout.y.slice(),
    drawOrder: layout.drawOrder.slice(),
    regionLabels: layout.regionLabels.slice(),
    syzygySeg,
    currentCurves,
    currentKind: currents.kind.slice(),
    junctionX: currents.junctionX.slice(),
    junctionY: currents.junctionY.slice(),
    currentTo,
    gateCurves,
    gateLoop: gates.loop.slice(),
    gateTo: gates.to.slice(),
    gateLabelX: gates.labelX.slice(),
    gateLabelY: gates.labelY.slice(),
    px: null,
    py: null,
    pillWidth: 0,
    pillHeight: 0,
    pairArc: null,
    pairLoop: null,
    edgeSegStart: pick.edgeSegStart,
    edgeBox: pick.edgeBox,
    pickSegments: pick.pickSegments,
  }
}

/**
 * The scene of the syzygy-collapsed pair graph: coordinates, pill centres and size, and the engine's own arc and loop
 * path strings (SVG `A` arcs, drawn from the strings; the arcs are not pickable, only the pills are). Every zone-only
 * array is a fresh empty array and there are no pick edges. Pure; deterministic. Throws a RangeError for a layout of
 * another base, a layout that is not a pair graph, or routes of the wrong length.
 */
export function buildPairScene(g: Numogram, layout: PairGraphLayout, routes: PairGraphRoutes): CanvasScene {
  assertLayoutBase(g, layout)
  if (!('px' in layout) || !('py' in layout)) throw new RangeError('canvasScene: buildPairScene needs a pair-graph layout')
  const P = g.pairCount
  if (layout.px.length !== P || layout.py.length !== P || routes.arc.length !== P || routes.loop.length !== P) {
    throw new RangeError(`canvasScene: pair-graph routes do not match numogram base ${g.base}`)
  }

  const currentTo = new Int32Array(P)
  for (let q = 0; q < P; q++) currentTo[q] = g.current(q).to

  return {
    kind: 'pairs',
    base: g.base,
    layoutId: layout.id,
    width: layout.width,
    height: layout.height,
    centerX: layout.center.x,
    centerY: layout.center.y,
    nodeRadius: layout.nodeRadius,
    labelSize: layout.labelSize,
    strokeScale: layout.strokeScale,
    x: layout.x.slice(),
    y: layout.y.slice(),
    drawOrder: layout.drawOrder.slice(),
    regionLabels: layout.regionLabels.slice(),
    syzygySeg: new Float64Array(0),
    currentCurves: new Float64Array(0),
    currentKind: new Uint8Array(0),
    junctionX: new Float64Array(0),
    junctionY: new Float64Array(0),
    currentTo,
    gateCurves: new Float64Array(0),
    gateLoop: new Uint8Array(0),
    gateTo: new Int32Array(0),
    gateLabelX: new Float64Array(0),
    gateLabelY: new Float64Array(0),
    px: layout.px.slice(),
    py: layout.py.slice(),
    pillWidth: layout.nodeWidth,
    pillHeight: layout.nodeHeight,
    pairArc: routes.arc.slice(),
    pairLoop: routes.loop.slice(),
    edgeSegStart: Int32Array.of(0),
    edgeBox: new Float64Array(0),
    pickSegments: new Float64Array(0),
  }
}
