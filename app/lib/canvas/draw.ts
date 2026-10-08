// Canvas drawing (Phase 6 REN-02, D-04, D-05): paints the scene's layers and the overlay through an injected 2D context, with the SVG tier's palette and opacity table. Context dimming is layer opacity, never a repaint (research A3). Original CCRUG code (MIT, NOTICE section 1).
//
// Every function here is a pure "scene + state -> draw calls" step against an injected context (and an injected Path2D
// factory), so each parity rule of the UI-SPEC is a recorded-call test with no canvas package and no jsdom. The layers:
//
//   static layers (re-rastered on scene swap, committed zoom or pan, resize, layers, labels, isolate, mute):
//     drawSyzygyLayer, drawCurrentLayer, drawGateLayer, drawNodeLayer
//   interaction overlay (hover, pin, selection, focus chords, Time Circuit, keyboard ring): drawOverlay
//
// Edges are painted on their static layer at alpha 1 (isolate-dimmed ones at context over ambient). The layer's CSS
// opacity carries the table value (edgeLayerOpacity), so context dimming on hover is an opacity switch, never a repaint
// (a repaint per hover would cost 29 to 249 ms at n = 4000). Highlighted and on-demand edges live on the overlay.
//
// Geometry: world points map to CSS px through the view transform (the layer functions read toScreen once, at the world
// origin, and scaleOf; the map is affine so every drawn point is origin + world x scale). Widths follow the SVG tier's
// "world value x strokeScale", multiplied by the on-screen scale and floored at 1 CSS px; text sizes are world sizes
// times the scale. Level of detail goes through labelsShown(on-screen node radius) only, so the threshold stays data.
// No blur-based glow exists on Canvas: a highlighted element gets an underlay stroke instead. A NaN curve is skipped.

import type { CanvasScene } from '../../../engine/index'
import type { CurrentData, GateData, LabelVisibility, Layer, SyzygyData } from '../../data/types'
import { REGION_CLR } from '../constants'
import type { NumogramView } from '../numogramView'
import { ZONE_DIMMED, ZONE_HIDDEN, ZONE_NORMAL } from '../regions'
import { labelsShown } from '../tierBounds'
import { formatXenotationForDisplay } from '../xenotation'
import { onScreenRadius, scaleOf, toScreen, type CanvasFrame, type CanvasTransform } from './viewTransform'

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'clearRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'quadraticCurveTo'
  | 'arc'
  | 'closePath'
  | 'rect'
  | 'stroke'
  | 'fill'
  | 'fillText'
  | 'setLineDash'
  | 'strokeStyle'
  | 'fillStyle'
  | 'lineWidth'
  | 'globalAlpha'
  | 'lineCap'
  | 'lineJoin'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>

export interface DrawEnv {
  readonly ctx: Ctx2D
  readonly makePath: () => Path2D
  readonly pathFromSvg: (d: string) => Path2D
}

export interface DrawState {
  readonly scene: CanvasScene
  readonly view: NumogramView
  readonly zoneLabels: readonly string[]
  readonly transform: CanvasTransform
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly layers: ReadonlySet<Layer>
  readonly labelVisibility: LabelVisibility
  readonly gateMode: 'on' | 'thin' | 'off'
  /** Per zone: ZONE_HIDDEN (muted), ZONE_DIMMED (isolated out) or ZONE_NORMAL; null = no isolate or mute filter. */
  readonly zoneStates: Uint8Array | null
  readonly tcActive: boolean
}

/** The scene's edges joined by pair id and zone (never by view-array index, research Pattern 4). Built once per scene. */
export interface SceneIndex {
  readonly syzygyByPair: readonly (SyzygyData | undefined)[]
  readonly currentByPair: readonly (CurrentData | undefined)[]
  readonly gateByZone: readonly (GateData | undefined)[]
  readonly pairOfZone: Int32Array
  readonly pairLo: Int32Array
  readonly pairHi: Int32Array
  /** CSR: the pair ids whose current flows into zone z are currentsInto[currentsIntoStart[z] .. currentsIntoStart[z + 1]). */
  readonly currentsIntoStart: Int32Array
  readonly currentsInto: Int32Array
  /** CSR: the origin zones of the gates whose destination is zone z. */
  readonly gatesIntoStart: Int32Array
  readonly gatesInto: Int32Array
  /** 1 for a pair whose syzygy (or current) belongs to a Torque cycle, from the view's own Time Circuit data. */
  readonly torqueSyzygy: Uint8Array
  readonly torqueCurrent: Uint8Array
}

// ── Constants (every number named; the base-ten grep gate scans app/) ────────────────────────────────────────────────

/** The SVG tier's ambient and context opacities per edge kind. The layer's CSS opacity carries these, edges paint at alpha 1. */
export const EDGE_LAYER_ALPHA = Object.freeze({
  syzygy: Object.freeze({ ambient: 0.5, context: 0.1 }),
  current: Object.freeze({ ambient: 0.6, context: 0.08 }),
  gate: Object.freeze({ ambient: 0.5, context: 0.08 }),
})

/** Above this many highlighted edges the overlay draws plain batched strokes (no dots, arrowheads, junctions, underlays, text). */
export const HIGHLIGHT_FULL_FIDELITY_MAX = 400
export const CAPTION_MIN_PX = 6 // region captions are hidden when their on-screen size would be smaller
export const NODE_MIN_RADIUS_PX = 1.5 // a node disc is never smaller than this
export const STROKE_MIN_PX = 1 // no stroke is thinner than this
export const AMBIENT_ARROW_MIN_PX = 24 // an ambient edge gets an arrowhead only when at least this long on screen

const THIN_GATE_FACTOR = 0.5
const SYZYGY_AMBIENT_WIDTH_PX = 1.5
const SYZYGY_DOT_PERIOD_UNITS = 0.1 // dash length of the dotted round-cap line, CSS px
const SYZYGY_DOT_GAP_K = 3 // dot spacing, in k = nodeRadius / 21 world units

const CURRENT_WIDTH = 1.2
const CURRENT_LEG_RATIO = 0.7
const CURRENT_LEG_ALPHA = 0.7
const CURRENT_JUNCTION_R = 3.5
const CURRENT_JUNCTION_STROKE = 0.8
const JUNCTION_MIN_RADIUS_PX = 1.5
const GATE_WIDTH = 0.7
const GATE_SINGLE_DASH: readonly [number, number] = [5, 3] // x strokeScale
const GATE_LOOP_DASH: readonly [number, number] = [3, 2]
const PAIR_ARC_WIDTH = 1.4

const ZONE_FILL_SUFFIX = '18'
const ZONE_IDLE_STROKE_SUFFIX = '44'
const ZONE_LABEL_SUFFIX = 'aa'
const ZONE_XENO_SUFFIX = '70'
const ZONE_STROKE_IDLE = 0.7
const ZONE_DIMMED_ALPHA = 0.2
const TRIANGLE_ALPHA = 0.2
const TRIANGLE_TIP_K = 8
const TRIANGLE_BASE_K = 5
const TRIANGLE_BASE_ANGLE = Math.PI * 0.75
const REGION_DOT_R_K = 2
const REGION_DOT_OFFSET_K = 10
const REGION_DOT_ALPHA = 0.3
const LABEL_LINE_K = 8
const LABEL_LINE_PAD_K = 2
const XENO_SIZE_K = 6.5
const XENO_OFFSET_K = 24
const XENO_ALPHA = 0.44
const LABEL_BASELINE_NUDGE = 1 // world units: the SVG label sits at y + 1

const PILL_FILL_ALPHA = 0.12
const PILL_STROKE_ALPHA = 0.6
const PILL_STROKE_IDLE = 0.9

const CURRENT_MARKER = Object.freeze({ w: 9, h: 7 }) // marker box of arr-c and arr-pg (viewBox 8 x 6)
const GATE_MARKER = Object.freeze({ w: 8, h: 6 })
const MARKER_VIEW_W = 8
const MARKER_VIEW_H = 6
const MARKER_BACK = 7 // the marker tip sits 7 view units from its base
const MARKER_HALF = 2.5 // and its base is 2.5 view units either side

const EDGE_CULL_PAD_PX = 12 // room for line width, dots and arrowheads when culling edges against the window
const TWO_PI = Math.PI * 2

/** The data-identity palette carried from the SVG tier (UI-SPEC Color), byte-identical hexes. */
export const PALETTE = Object.freeze({
  syzygy: '#e8e8e8',
  current: '#22ee66',
  gate: '#cc44ff',
  timeCircuit: '#00ccff',
  focusRing: '#10ff50',
  white: '#ffffff',
})

/** The layer opacity the component applies to an edge layer: ambient, or context while some zone is highlighted. */
export function edgeLayerOpacity(kind: 'syzygy' | 'current' | 'gate', anyFocus: boolean, gateMode: 'on' | 'thin' | 'off'): number {
  const row = EDGE_LAYER_ALPHA[kind]
  const base = anyFocus ? row.context : row.ambient
  return kind === 'gate' && gateMode === 'thin' ? base * THIN_GATE_FACTOR : base
}

/** An isolate-dimmed edge is painted at this fraction of alpha 1, so (layer opacity x ratio) is the SVG's context value. */
function dimRatio(kind: 'syzygy' | 'current' | 'gate'): number {
  const row = EDGE_LAYER_ALPHA[kind]
  return row.context / row.ambient
}

// ── Scene index ──────────────────────────────────────────────────────────────────────────────────────────────────────

function buildCsr(count: number, owners: Int32Array, ownerCount: number): { start: Int32Array; items: Int32Array } {
  const start = new Int32Array(ownerCount + 1)
  for (let i = 0; i < count; i++) {
    const owner = owners[i] as number
    if (owner >= 0 && owner < ownerCount) start[owner + 1] = (start[owner + 1] as number) + 1
  }
  for (let z = 0; z < ownerCount; z++) start[z + 1] = (start[z + 1] as number) + (start[z] as number)
  const items = new Int32Array(start[ownerCount] as number)
  const fill = start.slice(0, ownerCount)
  for (let i = 0; i < count; i++) {
    const owner = owners[i] as number
    if (owner >= 0 && owner < ownerCount) {
      items[fill[owner] as number] = i
      fill[owner] = (fill[owner] as number) + 1
    }
  }
  return { start, items }
}

/**
 * Joins the scene's edges to the view's data by pair id (g.pairOf(c.from)) and origin zone, never by view-array index:
 * the view lists syzygies in descending pair id, currents in flow order and gates by origin zone. Also the reverse
 * lookups the overlay needs (which currents and gates flow into a zone) and the Torque flags for the Time Circuit.
 */
export function buildSceneIndex(scene: CanvasScene, view: NumogramView): SceneIndex {
  const g = view.g
  const n = scene.x.length
  const P = scene.currentTo.length

  const syzygyByPair = new Array<SyzygyData | undefined>(P).fill(undefined)
  const currentByPair = new Array<CurrentData | undefined>(P).fill(undefined)
  const gateByZone = new Array<GateData | undefined>(n).fill(undefined)
  const torqueSyzygy = new Uint8Array(P)
  const torqueCurrent = new Uint8Array(P)

  for (const s of view.syzygies) {
    const q = g.pairOf(s.a)
    if (q >= 0 && q < P) syzygyByPair[q] = s
  }
  for (const c of view.currents) {
    const q = g.pairOf(c.from)
    if (q >= 0 && q < P) {
      currentByPair[q] = c
      if (view.torqueCurrentNames.has(c.name)) torqueCurrent[q] = 1
    }
  }
  for (const gate of view.gates) {
    if (gate.from >= 0 && gate.from < n) gateByZone[gate.from] = gate
  }
  for (const [lo] of view.torqueSyzygies) {
    const q = g.pairOf(lo)
    if (q >= 0 && q < P) torqueSyzygy[q] = 1
  }

  const pairOfZone = new Int32Array(n)
  for (let z = 0; z < n; z++) pairOfZone[z] = g.pairOf(z)
  const pairLo = new Int32Array(P)
  const pairHi = new Int32Array(P)
  for (let q = 0; q < P; q++) {
    const info = g.pair(q)
    pairLo[q] = info.lo
    pairHi[q] = info.hi
  }

  const into = buildCsr(P, scene.currentTo, n)
  const gatesInto = buildCsr(scene.gateTo.length, scene.gateTo, n)
  return {
    syzygyByPair,
    currentByPair,
    gateByZone,
    pairOfZone,
    pairLo,
    pairHi,
    currentsIntoStart: into.start,
    currentsInto: into.items,
    gatesIntoStart: gatesInto.start,
    gatesInto: gatesInto.items,
    torqueSyzygy,
    torqueCurrent,
  }
}

// ── Shared geometry and state helpers ────────────────────────────────────────────────────────────────────────────────

interface Geo {
  readonly ok: boolean
  readonly s: number // CSS px per world unit
  readonly ox: number // CSS px of the world origin
  readonly oy: number
  readonly k: number // nodeRadius / 21, world units (the SVG tier's scale for dots, labels and triangles)
  readonly ss: number // layout strokeScale
  readonly w: number
  readonly h: number
  readonly rPx: number // on-screen node radius (pill half height for the pair graph): the level-of-detail input
  readonly lod: boolean // label level of detail, through labelsShown only
}

function frameOf(scene: CanvasScene): CanvasFrame {
  return { width: scene.width, height: scene.height, nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius }
}

function geoOf(st: DrawState): Geo {
  const scene = st.scene
  const frame = frameOf(scene)
  const s = scaleOf(st.transform, frame, st.cssWidth, st.cssHeight)
  const o = toScreen(st.transform, frame, st.cssWidth, st.cssHeight, 0, 0)
  const rPx = onScreenRadius(st.transform, frame, st.cssWidth, st.cssHeight)
  const ok = Number.isFinite(s) && s > 0 && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(rPx)
  return {
    ok,
    s,
    ox: o.x,
    oy: o.y,
    k: scene.nodeRadius / 21,
    ss: scene.strokeScale,
    w: st.cssWidth,
    h: st.cssHeight,
    rPx,
    lod: ok && labelsShown(rPx),
  }
}

/** A world width (x strokeScale) in CSS px, never thinner than STROKE_MIN_PX. */
function strokePx(world: number, geo: Geo): number {
  return Math.max(STROKE_MIN_PX, world * geo.ss * geo.s)
}

function zoneState(states: Uint8Array | null, z: number): number {
  return states === null ? ZONE_NORMAL : (states[z] ?? ZONE_NORMAL)
}
function minState2(states: Uint8Array | null, a: number, b: number): number {
  return Math.min(zoneState(states, a), zoneState(states, b))
}
function minState3(states: Uint8Array | null, a: number, b: number, c: number): number {
  return Math.min(zoneState(states, a), zoneState(states, b), zoneState(states, c))
}

/** Starts a layer: save, the dpr transform, a transparent clear of the window (never a background fill). */
function beginLayer(env: DrawEnv, st: DrawState): void {
  const { ctx } = env
  ctx.save()
  const dpr = Number.isFinite(st.dpr) && st.dpr > 0 ? st.dpr : 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, st.cssWidth, st.cssHeight)
}

/** True when the world box misses the window (a NaN box counts as missing: an edge without geometry draws nothing). */
function boxOutside(geo: Geo, minX: number, minY: number, maxX: number, maxY: number, pad: number): boolean {
  const x0 = geo.ox + minX * geo.s
  const x1 = geo.ox + maxX * geo.s
  const y0 = geo.oy + minY * geo.s
  const y1 = geo.oy + maxY * geo.s
  return !(x1 >= -pad && x0 <= geo.w + pad && y1 >= -pad && y0 <= geo.h + pad)
}

function edgeOutside(geo: Geo, scene: CanvasScene, edge: number): boolean {
  const o = 4 * edge
  const b = scene.edgeBox
  return boxOutside(geo, b[o] as number, b[o + 1] as number, b[o + 2] as number, b[o + 3] as number, EDGE_CULL_PAD_PX)
}

function discOutside(geo: Geo, cx: number, cy: number, radius: number): boolean {
  return !(cx + radius >= 0 && cx - radius <= geo.w && cy + radius >= 0 && cy - radius <= geo.h)
}

interface Bucket {
  readonly path: Path2D
  n: number
}
const bucketOf = (env: DrawEnv): Bucket => ({ path: env.makePath(), n: 0 })

function finite6(c: Float64Array, o: number): boolean {
  return (
    Number.isFinite(c[o]) &&
    Number.isFinite(c[o + 1]) &&
    Number.isFinite(c[o + 2]) &&
    Number.isFinite(c[o + 3]) &&
    Number.isFinite(c[o + 4]) &&
    Number.isFinite(c[o + 5])
  )
}

/** Adds the quadratic at curves[o .. o + 6) to the bucket in CSS px; false (and nothing added) for a NaN curve. */
function addCurve(geo: Geo, b: Bucket, c: Float64Array, o: number): boolean {
  if (!finite6(c, o)) return false
  b.path.moveTo(geo.ox + (c[o] as number) * geo.s, geo.oy + (c[o + 1] as number) * geo.s)
  b.path.quadraticCurveTo(
    geo.ox + (c[o + 2] as number) * geo.s,
    geo.oy + (c[o + 3] as number) * geo.s,
    geo.ox + (c[o + 4] as number) * geo.s,
    geo.oy + (c[o + 5] as number) * geo.s,
  )
  b.n++
  return true
}

/** Start-to-end distance of the curve at c[o ..], in CSS px. */
function chordPx(geo: Geo, c: Float64Array, o: number): number {
  return Math.hypot((c[o + 4] as number) - (c[o] as number), (c[o + 5] as number) - (c[o + 1] as number)) * geo.s
}

/** Adds a closed circle subpath in CSS px. */
function addCircle(path: Path2D, cx: number, cy: number, r: number): void {
  path.moveTo(cx + r, cy)
  path.arc(cx, cy, r, 0, TWO_PI)
}

/** Adds a stadium (a rectangle whose end caps are half circles) centred at (cx, cy), in CSS px. */
function addStadium(path: Path2D, cx: number, cy: number, width: number, height: number): void {
  const r = Math.min(height, width) / 2
  const x0 = cx - width / 2 + r
  const x1 = cx + width / 2 - r
  path.moveTo(x0, cy - r)
  path.lineTo(x1, cy - r)
  path.arc(x1, cy, r, -Math.PI / 2, Math.PI / 2, false)
  path.lineTo(x0, cy + r)
  path.arc(x0, cy, r, Math.PI / 2, Math.PI * 1.5, false)
  path.closePath()
}

/**
 * Adds the SVG marker triangle (0,0.5) (7,3) (0,5.5) scaled like markerUnits = strokeWidth: the marker box is
 * markerWidth x markerHeight stroke widths over a viewBox of 8 x 6, scaled uniformly (meet). The tip is at (tx, ty),
 * pointing along (dx, dy). Nothing is added for a zero direction.
 */
function addArrowhead(path: Path2D, tx: number, ty: number, dx: number, dy: number, widthPx: number, marker: { w: number; h: number }): boolean {
  const len = Math.hypot(dx, dy)
  if (!(len > 0) || !Number.isFinite(tx) || !Number.isFinite(ty)) return false
  const ux = dx / len
  const uy = dy / len
  const scale = Math.min(marker.w / MARKER_VIEW_W, marker.h / MARKER_VIEW_H) * widthPx
  const back = MARKER_BACK * scale
  const half = MARKER_HALF * scale
  const bx = tx - ux * back
  const by = ty - uy * back
  path.moveTo(tx, ty)
  path.lineTo(bx - uy * half, by + ux * half)
  path.lineTo(bx + uy * half, by - ux * half)
  path.closePath()
  return true
}

/** The direction a quadratic curve leaves its end point: end minus control, or end minus start when they coincide. */
function endTangent(c: Float64Array, o: number): { dx: number; dy: number } {
  let dx = (c[o + 4] as number) - (c[o + 2] as number)
  let dy = (c[o + 5] as number) - (c[o + 3] as number)
  if (Math.hypot(dx, dy) < 1e-9) {
    dx = (c[o + 4] as number) - (c[o] as number)
    dy = (c[o + 5] as number) - (c[o + 1] as number)
  }
  return { dx, dy }
}

/** Adds the arrowhead at the end of the curve at c[o ..] (CSS px), using the curve's own end tangent. */
function addCurveArrow(geo: Geo, path: Path2D, c: Float64Array, o: number, widthPx: number, marker: { w: number; h: number }): boolean {
  const t = endTangent(c, o)
  return addArrowhead(path, geo.ox + (c[o + 4] as number) * geo.s, geo.oy + (c[o + 5] as number) * geo.s, t.dx, t.dy, widthPx, marker)
}

function paintStroke(ctx: Ctx2D, b: Bucket, widthPx: number, alpha: number): void {
  if (b.n === 0) return
  ctx.lineWidth = widthPx
  ctx.globalAlpha = alpha
  ctx.stroke(b.path)
}

function paintFill(ctx: Ctx2D, b: Bucket, alpha: number): void {
  if (b.n === 0) return
  ctx.globalAlpha = alpha
  ctx.fill(b.path)
}

// ── SVG arc end points (pair-graph arrowheads) ───────────────────────────────────────────────────────────────────────

const ARC_TOKEN = /[MA]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g

export interface ArcEnd {
  readonly x: number
  readonly y: number
  /** The direction of travel at the end point. */
  readonly dx: number
  readonly dy: number
  /** The arc's extent in world units: its chord, or its diameter for a closed loop. */
  readonly span: number
}

/**
 * The end point, end tangent and extent of an engine pair-graph route: `M x y A r r 0 large sweep x y`, one circular
 * arc. Null for anything else (the caller then draws no arrowhead; the stroke itself goes through Path2D). The centre
 * follows the SVG implementation notes for endpoint-to-centre conversion with a zero rotation and a circular radius.
 */
export function parseArcEnd(d: string): ArcEnd | null {
  const t = d.match(ARC_TOKEN)
  if (t === null || t.length !== 11 || t[0] !== 'M' || t[3] !== 'A') return null
  const v = [1, 2, 4, 5, 6, 9, 10].map(i => Number(t[i]))
  if (v.some(n => !Number.isFinite(n))) return null
  const [x0, y0, rx, ry, , x1, y1] = v as [number, number, number, number, number, number, number]
  const large = Number(t[7]) !== 0
  const sweep = Number(t[8]) !== 0
  const hx = (x0 - x1) / 2
  const hy = (y0 - y1) / 2
  const d2 = hx * hx + hy * hy
  if (d2 === 0) return null
  let r = (Math.abs(rx) + Math.abs(ry)) / 2
  if (!(r > 0)) return null
  const lambda = d2 / (r * r)
  if (lambda > 1) r *= Math.sqrt(lambda)
  const f = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, (r * r - d2) / d2))
  const cx = f * hy + (x0 + x1) / 2
  const cy = -f * hx + (y0 + y1) / 2
  const rxv = x1 - cx
  const ryv = y1 - cy
  const dx = sweep ? -ryv : ryv
  const dy = sweep ? rxv : -rxv
  const chord = Math.hypot(x1 - x0, y1 - y0)
  return { x: x1, y: y1, dx, dy, span: chord > 1e-9 ? chord : 2 * r }
}

// ── Syzygy layer ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The syzygy layer of a zone layout: one dotted round-cap line per pair (setLineDash [0.1, 3 k s], 1.5 CSS px), batched
 * into one stroke at alpha 1 and one at context over ambient for isolate-dimmed pairs. A pair with a muted end is not
 * drawn; while the Time Circuit is active only its Torque syzygies are. The pair graph has no syzygy lines.
 */
export function drawSyzygyLayer(env: DrawEnv, st: DrawState, index: SceneIndex): void {
  const { ctx } = env
  beginLayer(env, st)
  const geo = geoOf(st)
  const scene = st.scene
  if (geo.ok && scene.kind === 'zones' && st.layers.has('syzygies')) {
    const live = bucketOf(env)
    const dim = bucketOf(env)
    const seg = scene.syzygySeg
    const P = seg.length / 4
    for (let q = 0; q < P; q++) {
      const state = minState2(st.zoneStates, index.pairLo[q] as number, index.pairHi[q] as number)
      if (state === ZONE_HIDDEN) continue
      if (st.tcActive && index.torqueSyzygy[q] !== 1) continue
      if (edgeOutside(geo, scene, q)) continue
      const x0 = seg[4 * q] as number
      const y0 = seg[4 * q + 1] as number
      const x1 = seg[4 * q + 2] as number
      const y1 = seg[4 * q + 3] as number
      if (!Number.isFinite(x0 + y0 + x1 + y1)) continue
      const b = state === ZONE_DIMMED ? dim : live
      b.path.moveTo(geo.ox + x0 * geo.s, geo.oy + y0 * geo.s)
      b.path.lineTo(geo.ox + x1 * geo.s, geo.oy + y1 * geo.s)
      b.n++
    }
    ctx.strokeStyle = PALETTE.syzygy
    ctx.lineCap = 'round'
    const gap = SYZYGY_DOT_GAP_K * geo.k * geo.s
    if (gap > 0 && Number.isFinite(gap)) ctx.setLineDash([SYZYGY_DOT_PERIOD_UNITS, gap])
    paintStroke(ctx, live, SYZYGY_AMBIENT_WIDTH_PX, 1)
    paintStroke(ctx, dim, SYZYGY_AMBIENT_WIDTH_PX, dimRatio('syzygy'))
  }
  ctx.restore()
}

// ── Current layer ────────────────────────────────────────────────────────────────────────────────────────────────────

const CURRENT_STRIDE = 18 // numbers per pair id in scene.currentCurves: legA, legB, stem
const CURVE_STRIDE = 6

/**
 * The current layer. A zone layout draws every current as the engine routes it: two legs from the pair's members (at
 * 0.7 of the width and alpha), the white junction circle (label level of detail only) and the stem with its arrowhead
 * (only when the stem is at least 24 CSS px long). The pair graph draws the engine's arcs and self loops through
 * Path2D, always (the SVG pair graph has no layer check), with an arrowhead when the arc is long enough.
 */
export function drawCurrentLayer(env: DrawEnv, st: DrawState, index: SceneIndex): void {
  const { ctx } = env
  beginLayer(env, st)
  const geo = geoOf(st)
  if (geo.ok) {
    if (st.scene.kind === 'pairs') drawPairArcs(env, st, index, geo)
    else if (st.layers.has('currents')) drawZoneCurrents(env, st, index, geo)
  }
  ctx.restore()
}

function drawZoneCurrents(env: DrawEnv, st: DrawState, index: SceneIndex, geo: Geo): void {
  const { ctx } = env
  const scene = st.scene
  const P = scene.currentTo.length
  const legsLive = bucketOf(env)
  const legsDim = bucketOf(env)
  const stemsLive = bucketOf(env)
  const stemsDim = bucketOf(env)
  const juncLive = bucketOf(env)
  const juncDim = bucketOf(env)
  const arrowLive = bucketOf(env)
  const arrowDim = bucketOf(env)
  const stemWidth = strokePx(CURRENT_WIDTH, geo)
  const juncR = Math.max(CURRENT_JUNCTION_R * geo.k * geo.s, JUNCTION_MIN_RADIUS_PX)
  const curves = scene.currentCurves

  for (let q = 0; q < P; q++) {
    const state = minState3(st.zoneStates, index.pairLo[q] as number, index.pairHi[q] as number, scene.currentTo[q] as number)
    if (state === ZONE_HIDDEN) continue
    if (st.tcActive && index.torqueCurrent[q] !== 1) continue
    if (edgeOutside(geo, scene, P + q)) continue
    const dim = state === ZONE_DIMMED
    const o = CURRENT_STRIDE * q
    addCurve(geo, dim ? legsDim : legsLive, curves, o)
    addCurve(geo, dim ? legsDim : legsLive, curves, o + CURVE_STRIDE)
    const stem = o + 2 * CURVE_STRIDE
    if (addCurve(geo, dim ? stemsDim : stemsLive, curves, stem) && chordPx(geo, curves, stem) >= AMBIENT_ARROW_MIN_PX) {
      const a = dim ? arrowDim : arrowLive
      if (addCurveArrow(geo, a.path, curves, stem, stemWidth, CURRENT_MARKER)) a.n++
    }
    if (geo.lod) {
      const jx = scene.junctionX[q] as number
      const jy = scene.junctionY[q] as number
      if (Number.isFinite(jx + jy)) {
        const j = dim ? juncDim : juncLive
        addCircle(j.path, geo.ox + jx * geo.s, geo.oy + jy * geo.s, juncR)
        j.n++
      }
    }
  }

  const ratio = dimRatio('current')
  ctx.strokeStyle = PALETTE.current
  const legWidth = strokePx(CURRENT_WIDTH * CURRENT_LEG_RATIO, geo)
  paintStroke(ctx, legsLive, legWidth, CURRENT_LEG_ALPHA)
  paintStroke(ctx, legsDim, legWidth, CURRENT_LEG_ALPHA * ratio)
  // the white junction discs with their green rim (label level of detail only)
  const rim = strokePx(CURRENT_JUNCTION_STROKE, geo)
  ctx.fillStyle = PALETTE.white
  paintFill(ctx, juncLive, 1)
  paintFill(ctx, juncDim, ratio)
  paintStroke(ctx, juncLive, rim, 1)
  paintStroke(ctx, juncDim, rim, ratio)
  paintStroke(ctx, stemsLive, stemWidth, 1)
  paintStroke(ctx, stemsDim, stemWidth, ratio)
  ctx.fillStyle = PALETTE.current
  paintFill(ctx, arrowLive, 1)
  paintFill(ctx, arrowDim, ratio)
}

function drawPairArcs(env: DrawEnv, st: DrawState, index: SceneIndex, geo: Geo): void {
  const { ctx } = env
  const scene = st.scene
  const arcs = scene.pairArc ?? []
  const loops = scene.pairLoop ?? []
  const live = bucketOf(env)
  const dim = bucketOf(env)
  const arrowLive = bucketOf(env)
  const arrowDim = bucketOf(env)
  const matrix = { a: geo.s, b: 0, c: 0, d: geo.s, e: geo.ox, f: geo.oy }
  const width = strokePx(PAIR_ARC_WIDTH, geo)
  const P = Math.max(arcs.length, loops.length)
  for (let q = 0; q < P; q++) {
    const state = minState2(st.zoneStates, index.pairLo[q] as number, index.pairHi[q] as number)
    if (state === ZONE_HIDDEN) continue
    const dimmed = state === ZONE_DIMMED
    for (const d of [arcs[q] ?? null, loops[q] ?? null]) {
      if (d === null) continue
      const b = dimmed ? dim : live
      b.path.addPath(env.pathFromSvg(d), matrix)
      b.n++
      const end = parseArcEnd(d)
      if (end !== null && end.span * geo.s >= AMBIENT_ARROW_MIN_PX) {
        const a = dimmed ? arrowDim : arrowLive
        if (addArrowhead(a.path, geo.ox + end.x * geo.s, geo.oy + end.y * geo.s, end.dx, end.dy, width, CURRENT_MARKER)) a.n++
      }
    }
  }
  const ratio = dimRatio('current')
  ctx.strokeStyle = PALETTE.current
  paintStroke(ctx, live, width, 1)
  paintStroke(ctx, dim, width, ratio)
  ctx.fillStyle = PALETTE.current
  paintFill(ctx, arrowLive, 1)
  paintFill(ctx, arrowDim, ratio)
}

// ── Gate layer ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The gate layer (zone layouts): drawn only when the Layers panel has gates on, the Time Circuit is off and the gate
 * mode is not 'off'. Single routes are dashed 5 / 3 strokeScale, self gates 3 / 2, in #cc44ff at 0.7 strokeScale; the
 * 'thin' mode is the layer opacity (edgeLayerOpacity), not a different paint. A gate longer than 24 CSS px gets its
 * arrowhead. Hovered zones draw their own gate on the overlay whatever this layer does (D-04).
 */
export function drawGateLayer(env: DrawEnv, st: DrawState, index: SceneIndex): void {
  const { ctx } = env
  beginLayer(env, st)
  const geo = geoOf(st)
  const scene = st.scene
  if (geo.ok && scene.kind === 'zones' && st.layers.has('gates') && !st.tcActive && st.gateMode !== 'off') {
    void index
    const n = scene.gateTo.length
    const P = scene.currentTo.length
    const singleLive = bucketOf(env)
    const singleDim = bucketOf(env)
    const loopLive = bucketOf(env)
    const loopDim = bucketOf(env)
    const arrowLive = bucketOf(env)
    const arrowDim = bucketOf(env)
    const width = strokePx(GATE_WIDTH, geo)
    for (let z = 0; z < n; z++) {
      const state = minState2(st.zoneStates, z, scene.gateTo[z] as number)
      if (state === ZONE_HIDDEN) continue
      if (edgeOutside(geo, scene, 2 * P + z)) continue
      const dim = state === ZONE_DIMMED
      const loop = scene.gateLoop[z] === 1
      const b = loop ? (dim ? loopDim : loopLive) : dim ? singleDim : singleLive
      const o = CURVE_STRIDE * z
      if (addCurve(geo, b, scene.gateCurves, o) && chordPx(geo, scene.gateCurves, o) >= AMBIENT_ARROW_MIN_PX) {
        const a = dim ? arrowDim : arrowLive
        if (addCurveArrow(geo, a.path, scene.gateCurves, o, width, GATE_MARKER)) a.n++
      }
    }
    const ratio = dimRatio('gate')
    ctx.strokeStyle = PALETTE.gate
    ctx.setLineDash([GATE_SINGLE_DASH[0] * geo.ss * geo.s, GATE_SINGLE_DASH[1] * geo.ss * geo.s])
    paintStroke(ctx, singleLive, width, 1)
    paintStroke(ctx, singleDim, width, ratio)
    ctx.setLineDash([GATE_LOOP_DASH[0] * geo.ss * geo.s, GATE_LOOP_DASH[1] * geo.ss * geo.s])
    paintStroke(ctx, loopLive, width, 1)
    paintStroke(ctx, loopDim, width, ratio)
    ctx.setLineDash([])
    ctx.fillStyle = PALETTE.gate
    paintFill(ctx, arrowLive, 1)
    paintFill(ctx, arrowDim, ratio)
  }
  ctx.restore()
}

// ── Node layer ───────────────────────────────────────────────────────────────────────────────────────────────────────

const ANCHOR_TO_ALIGN = { start: 'left', middle: 'center', end: 'right' } as const

/** Region captions (layout.regionLabels): their own world size times the scale, hidden under CAPTION_MIN_PX. */
function drawRegionCaptions(env: DrawEnv, st: DrawState, geo: Geo): void {
  const { ctx } = env
  for (const l of st.scene.regionLabels) {
    const px = l.size * geo.s
    if (!(px >= CAPTION_MIN_PX) || !Number.isFinite(l.x + l.y)) continue
    ctx.fillStyle = REGION_CLR[l.kind]
    ctx.globalAlpha = l.opacity
    ctx.font = `${px}px monospace`
    ctx.textAlign = ANCHOR_TO_ALIGN[l.anchor]
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(l.text, geo.ox + l.x * geo.s, geo.oy + l.y * geo.s)
  }
}

/**
 * The node layer: region captions, then the zone discs (or the pair pills). Below the label threshold a node is a disc
 * at max(R_px, 1.5) with the idle fill and stroke and nothing else; at or above it the SVG node is complete: syzygy
 * triangle, bold zone label (and the xenotation when its toggle is on) and the region dot. Muted zones never draw,
 * isolate-dimmed ones draw at 0.2, zones outside the window are culled.
 */
export function drawNodeLayer(env: DrawEnv, st: DrawState, index: SceneIndex): void {
  const { ctx } = env
  beginLayer(env, st)
  const geo = geoOf(st)
  if (geo.ok) {
    drawRegionCaptions(env, st, geo)
    if (st.scene.kind === 'pairs') drawPills(env, st, index, geo)
    else drawZones(env, st, geo)
  }
  ctx.restore()
}

interface ZoneBatch {
  readonly discs: Bucket
  readonly triangles: Bucket
}

interface VisibleZone {
  readonly z: number
  readonly cx: number
  readonly cy: number
  readonly color: string
  readonly dim: boolean
}

/** The triangle (tip toward the partner) of syzTrianglePoints, from screen-space centres; k s is the screen scale of k. */
function addTriangle(path: Path2D, cx: number, cy: number, px: number, py: number, ks: number): void {
  const angle = Math.atan2(py - cy, px - cx)
  path.moveTo(cx + Math.cos(angle) * TRIANGLE_TIP_K * ks, cy + Math.sin(angle) * TRIANGLE_TIP_K * ks)
  path.lineTo(cx + Math.cos(angle + TRIANGLE_BASE_ANGLE) * TRIANGLE_BASE_K * ks, cy + Math.sin(angle + TRIANGLE_BASE_ANGLE) * TRIANGLE_BASE_K * ks)
  path.lineTo(cx + Math.cos(angle - TRIANGLE_BASE_ANGLE) * TRIANGLE_BASE_K * ks, cy + Math.sin(angle - TRIANGLE_BASE_ANGLE) * TRIANGLE_BASE_K * ks)
  path.closePath()
}

function drawZones(env: DrawEnv, st: DrawState, geo: Geo): void {
  const { ctx } = env
  const scene = st.scene
  const view = st.view
  const rDraw = Math.max(geo.rPx, NODE_MIN_RADIUS_PX)
  const pad = rDraw * 4 + EDGE_CULL_PAD_PX
  const ks = geo.k * geo.s
  const idleWidth = strokePx(ZONE_STROKE_IDLE, geo)

  const live = new Map<string, ZoneBatch>()
  const dimmed = new Map<string, ZoneBatch>()
  const visible: VisibleZone[] = []
  const order = scene.drawOrder
  for (let i = 0; i < order.length; i++) {
    const z = order[i] as number
    const state = zoneState(st.zoneStates, z)
    if (state === ZONE_HIDDEN) continue
    const wx = scene.x[z] as number
    const wy = scene.y[z] as number
    if (!Number.isFinite(wx + wy)) continue
    const cx = geo.ox + wx * geo.s
    const cy = geo.oy + wy * geo.s
    if (discOutside(geo, cx, cy, pad)) continue
    const color = view.zoneColors[z] as string
    const dim = state === ZONE_DIMMED
    const map = dim ? dimmed : live
    let batch = map.get(color)
    if (batch === undefined) {
      batch = { discs: bucketOf(env), triangles: bucketOf(env) }
      map.set(color, batch)
    }
    addCircle(batch.discs.path, cx, cy, rDraw)
    batch.discs.n++
    visible.push({ z, cx, cy, color, dim })
    if (geo.lod) {
      const partner = view.partner(z)
      const ax = scene.x[partner] as number
      const ay = scene.y[partner] as number
      if (Number.isFinite(ax + ay) && partner !== z) {
        addTriangle(batch.triangles.path, cx, cy, geo.ox + ax * geo.s, geo.oy + ay * geo.s, ks)
        batch.triangles.n++
      }
    }
  }

  for (const [map, alpha] of [[live, 1], [dimmed, ZONE_DIMMED_ALPHA]] as const) {
    for (const [color, batch] of map) {
      ctx.fillStyle = `${color}${ZONE_FILL_SUFFIX}`
      paintFill(ctx, batch.discs, alpha)
      ctx.strokeStyle = `${color}${ZONE_IDLE_STROKE_SUFFIX}`
      paintStroke(ctx, batch.discs, idleWidth, alpha)
    }
  }
  if (!geo.lod) return

  for (const [map, alpha] of [[live, 1], [dimmed, ZONE_DIMMED_ALPHA]] as const) {
    for (const [color, batch] of map) {
      ctx.fillStyle = color
      paintFill(ctx, batch.triangles, TRIANGLE_ALPHA * alpha)
    }
  }

  const showNumber = st.labelVisibility.numbers
  const showXeno = st.labelVisibility.xenotation
  const xeno = new Map<number, string>()
  if (showXeno) for (const v of visible) xeno.set(v.z, formatXenotationForDisplay(v.z))

  // region dots, below the label lines the node carries (the SVG's regionDotY)
  const dotR = REGION_DOT_R_K * ks
  const dots = new Map<string, Bucket>()
  const dimDots = new Map<string, Bucket>()
  for (const v of visible) {
    const lines = (showNumber ? 1 : 0) + ((xeno.get(v.z) ?? '').length > 0 ? 1 : 0)
    const offset = scene.nodeRadius + REGION_DOT_OFFSET_K * geo.k + (lines > 0 ? lines * LABEL_LINE_K * geo.k + LABEL_LINE_PAD_K * geo.k : 0)
    const color = REGION_CLR[view.zoneKind[v.z] as keyof typeof REGION_CLR]
    const map = v.dim ? dimDots : dots
    let b = map.get(color)
    if (b === undefined) {
      b = bucketOf(env)
      map.set(color, b)
    }
    addCircle(b.path, v.cx, v.cy + offset * geo.s, dotR)
    b.n++
  }
  for (const [map, alpha] of [[dots, 1], [dimDots, ZONE_DIMMED_ALPHA]] as const) {
    for (const [color, b] of map) {
      ctx.fillStyle = color
      paintFill(ctx, b, REGION_DOT_ALPHA * alpha)
    }
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (showNumber) {
    ctx.font = `bold ${scene.labelSize * geo.s}px monospace`
    for (const v of visible) {
      ctx.fillStyle = `${v.color}${ZONE_LABEL_SUFFIX}`
      ctx.globalAlpha = v.dim ? ZONE_DIMMED_ALPHA : 1
      ctx.fillText(st.zoneLabels[v.z] ?? '', v.cx, v.cy + LABEL_BASELINE_NUDGE * geo.s)
    }
  }
  if (showXeno) {
    ctx.font = `italic ${XENO_SIZE_K * geo.k * geo.s}px monospace`
    for (const v of visible) {
      const text = xeno.get(v.z) ?? ''
      if (text.length === 0) continue
      ctx.fillStyle = `${v.color}${ZONE_XENO_SUFFIX}`
      ctx.globalAlpha = XENO_ALPHA * (v.dim ? ZONE_DIMMED_ALPHA : 1)
      ctx.fillText(text, v.cx, v.cy + XENO_OFFSET_K * ks)
    }
  }
}

function drawPills(env: DrawEnv, st: DrawState, index: SceneIndex, geo: Geo): void {
  const { ctx } = env
  const scene = st.scene
  const view = st.view
  const px = scene.px
  const py = scene.py
  if (px === null || py === null) return
  const W = scene.pillWidth * geo.s
  const H = scene.pillHeight * geo.s
  const pad = EDGE_CULL_PAD_PX + W / 2
  const strokeWidth = strokePx(PILL_STROKE_IDLE, geo)

  const live = new Map<string, Bucket>()
  const dimmed = new Map<string, Bucket>()
  const visible: { q: number; cx: number; cy: number; color: string; dim: boolean }[] = []
  for (let q = 0; q < px.length; q++) {
    const lo = index.pairLo[q] as number
    const hi = index.pairHi[q] as number
    const state = minState2(st.zoneStates, lo, hi)
    if (state === ZONE_HIDDEN) continue
    const wx = px[q] as number
    const wy = py[q] as number
    if (!Number.isFinite(wx + wy)) continue
    const cx = geo.ox + wx * geo.s
    const cy = geo.oy + wy * geo.s
    if (discOutside(geo, cx, cy, pad)) continue
    const color = view.zoneColors[lo] as string
    const dim = state === ZONE_DIMMED
    const map = dim ? dimmed : live
    let b = map.get(color)
    if (b === undefined) {
      b = bucketOf(env)
      map.set(color, b)
    }
    addStadium(b.path, cx, cy, W, H)
    b.n++
    visible.push({ q, cx, cy, color, dim })
  }
  for (const [map, alpha] of [[live, 1], [dimmed, ZONE_DIMMED_ALPHA]] as const) {
    for (const [color, b] of map) {
      ctx.fillStyle = color
      paintFill(ctx, b, PILL_FILL_ALPHA * alpha)
      ctx.strokeStyle = color
      paintStroke(ctx, b, strokeWidth, PILL_STROKE_ALPHA * alpha)
    }
  }
  if (!geo.lod) return
  ctx.font = `bold ${scene.labelSize * geo.s}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const v of visible) {
    const lo = index.pairLo[v.q] as number
    const hi = index.pairHi[v.q] as number
    ctx.fillStyle = v.color
    ctx.globalAlpha = v.dim ? ZONE_DIMMED_ALPHA : 1
    ctx.fillText(`${st.zoneLabels[hi] ?? ''}::${st.zoneLabels[lo] ?? ''}`, v.cx, v.cy + LABEL_BASELINE_NUDGE * geo.s)
  }
}
