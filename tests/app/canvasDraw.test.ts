// Tests for app/lib/canvas/draw.ts (REN-02, 06-08): the Canvas drawing module, asserted through a recording 2D context
// (a Proxy that logs method calls and property sets; no canvas package, no jsdom). Every parity rule of the UI-SPEC is a
// recorded-call assertion: palette hexes, widths with their floors, the opacity table, dashes, level of detail through
// the tier table's label threshold, gate modes, on-demand edges, the overlay fidelity switch and a NaN scan. Expected
// numbers are derived from the scene and the transform here, never copied from draw.ts.
import { describe, expect, it } from 'vitest'
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  parseRouteCurve,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
} from '../../engine/index'
import type { CanvasScene, Numogram } from '../../engine/index'
import {
  AMBIENT_ARROW_MIN_PX,
  CAPTION_MIN_PX,
  EDGE_LAYER_ALPHA,
  HIGHLIGHT_FULL_FIDELITY_MAX,
  NODE_MIN_RADIUS_PX,
  PALETTE,
  STROKE_MIN_PX,
  buildSceneIndex,
  drawCurrentLayer,
  drawGateLayer,
  drawNodeLayer,
  drawOverlay,
  drawSyzygyLayer,
  edgeLayerOpacity,
  parseArcEnd,
  type Ctx2D,
  type DrawEnv,
  type DrawState,
  type OverlayReport,
  type OverlayState,
  type SceneIndex,
} from '../../app/lib/canvas/draw'
import type { RingTarget } from '../../app/lib/canvas/keyboardModel'
import {
  IDENTITY_TRANSFORM,
  canvasFootprint,
  fitZones,
  onScreenRadius,
  scaleOf,
  toScreen,
  type CanvasFrame,
  type CanvasTransform,
} from '../../app/lib/canvas/viewTransform'
import { REGION_CLR } from '../../app/lib/constants'
import { KIND_COLOR } from '../../app/lib/demonBrowser'
import { curveAway, syzTrianglePoints } from '../../app/lib/geometry'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../../app/lib/labelScheme'
import { buildNumogramView, type NumogramView } from '../../app/lib/numogramView'
import { formatXenotationForDisplay } from '../../app/lib/xenotation'
import { ZONE_DIMMED, ZONE_HIDDEN, ZONE_NORMAL } from '../../app/lib/regions'
import { fitSoundLabel } from '../../app/lib/soundLabels'
import { labelsShown } from '../../app/lib/tierBounds'
import type { Demon, Layer } from '../../app/data/types'

// ── Recording 2D context ─────────────────────────────────────────────────────────────────────────────────────────────

const REC = Symbol('path-record')
const PROPS = new Set(['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin', 'font', 'textAlign', 'textBaseline'])

interface PathRec {
  readonly id: number
  readonly d: string | null
  readonly ops: { op: string; args: unknown[] }[]
}

interface Style {
  strokeStyle: string
  fillStyle: string
  lineWidth: number
  globalAlpha: number
  lineCap: string
  lineJoin: string
  font: string
  textAlign: string
  textBaseline: string
  lineDash: number[]
}

interface Ev {
  readonly i: number
  readonly type: string
  readonly args: unknown[]
  readonly path: PathRec | null
  readonly style: Style
}

function makeRecorder() {
  const events: Ev[] = []
  const paths: PathRec[] = []
  const svgCalls: string[] = []
  const stack: Style[] = []
  let style: Style = {
    strokeStyle: '#000000',
    fillStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineDash: [],
  }
  const newPath = (d: string | null): PathRec => {
    const rec: PathRec = { id: paths.length, d, ops: [] }
    paths.push(rec)
    return rec
  }
  let current = newPath(null)
  const snap = (): Style => ({ ...style, lineDash: [...style.lineDash] })
  const recOf = (a: unknown): PathRec | null =>
    typeof a === 'object' && a !== null ? ((a as Record<symbol, PathRec | undefined>)[REC] ?? null) : null
  const push = (type: string, args: unknown[], path: PathRec | null = null): void => {
    events.push({ i: events.length, type, args, path, style: snap() })
  }
  const pathProxy = (rec: PathRec): Path2D =>
    new Proxy(
      {},
      {
        get: (_t, k) => {
          if (k === REC) return rec
          return (...args: unknown[]) => {
            rec.ops.push({ op: String(k), args: args.map(a => (recOf(a) !== null ? { path: (recOf(a) as PathRec).id } : a)) })
          }
        },
      },
    ) as unknown as Path2D

  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        const name = String(k)
        if (PROPS.has(name)) return (style as unknown as Record<string, unknown>)[name]
        return (...args: unknown[]) => {
          switch (name) {
            case 'save':
              stack.push(snap())
              push(name, args)
              return
            case 'restore': {
              const prev = stack.pop()
              if (prev !== undefined) style = prev
              push(name, args)
              return
            }
            case 'setLineDash':
              style.lineDash = [...(args[0] as number[])]
              push(name, args)
              return
            case 'beginPath':
              current = newPath(null)
              push(name, args)
              return
            case 'moveTo':
            case 'lineTo':
            case 'quadraticCurveTo':
            case 'arc':
            case 'closePath':
            case 'rect':
              current.ops.push({ op: name, args })
              push(name, args)
              return
            case 'stroke':
            case 'fill': {
              const given = args.length > 0 ? recOf(args[0]) : null
              push(name, args, given ?? current)
              return
            }
            default:
              push(name, args)
          }
        }
      },
      set: (_t, k, v) => {
        ;(style as unknown as Record<string, unknown>)[String(k)] = v
        return true
      },
    },
  )

  const env: DrawEnv = {
    ctx: ctx as unknown as Ctx2D,
    makePath: () => pathProxy(newPath(null)),
    pathFromSvg: (d: string) => {
      svgCalls.push(d)
      return pathProxy(newPath(d))
    },
  }
  return { env, events, paths, svgCalls }
}

type Recorder = ReturnType<typeof makeRecorder>

const ofType = (events: readonly Ev[], type: string): Ev[] => events.filter(e => e.type === type)
const strokesOf = (events: readonly Ev[]): Ev[] => ofType(events, 'stroke')
const fillsOf = (events: readonly Ev[]): Ev[] => ofType(events, 'fill')
const opsOf = (e: Ev, op: string): { op: string; args: unknown[] }[] => e.path?.ops.filter(o => o.op === op) ?? []
const nums = (args: readonly unknown[]): number[] => args.map(a => Number(a))

/** Every number a recording carries: call arguments, path operations, style snapshots, dash entries. */
function collectNumbers(rec: Recorder): number[] {
  const out: number[] = []
  const visit = (v: unknown): void => {
    if (typeof v === 'number') out.push(v)
    else if (Array.isArray(v)) v.forEach(visit)
    else if (typeof v === 'object' && v !== null) Object.values(v).forEach(visit)
  }
  for (const e of rec.events) {
    visit(e.args)
    visit(e.style.lineWidth)
    visit(e.style.globalAlpha)
    visit(e.style.lineDash)
  }
  for (const p of rec.paths) for (const o of p.ops) visit(o.args)
  return out
}

function expectAllFinite(rec: Recorder): void {
  const bad = collectNumbers(rec).filter(n => !Number.isFinite(n))
  expect(bad).toEqual([])
}

// ── Fixtures: real engine scenes, views and a window, built once ────────────────────────────────────────────────────

interface Fx {
  readonly g: Numogram
  readonly view: NumogramView
  readonly scene: CanvasScene
  readonly labels: readonly string[]
  readonly frame: CanvasFrame
  readonly w: number
  readonly h: number
  readonly index: SceneIndex
}

const fixtures = new Map<string, Fx>()

function finish(g: Numogram, scene: CanvasScene): Fx {
  const view = buildNumogramView(g)
  const frame: CanvasFrame = {
    width: scene.width,
    height: scene.height,
    nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius,
  }
  const { cssWidth, cssHeight } = canvasFootprint(frame, 1280, 800)
  return {
    g,
    view,
    scene,
    labels: zoneLabelsFor(g.base, DEFAULT_LABEL_SCHEME),
    frame,
    w: cssWidth,
    h: cssHeight,
    index: buildSceneIndex(scene, view),
  }
}

function zoneFx(base: number, id: 'ring' | 'ladder' | 'spiral' = 'ring'): Fx {
  const key = `z:${base}:${id}`
  let fx = fixtures.get(key)
  if (fx === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, id, [], { packer: 'shelf' })
    fx = finish(g, buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout)))
    fixtures.set(key, fx)
  }
  return fx
}

function pairFx(base: number): Fx {
  const key = `p:${base}`
  let fx = fixtures.get(key)
  if (fx === undefined) {
    const g = createNumogram(base)
    const layout = pairGraphLayout(g, { packer: 'shelf' })
    fx = finish(g, buildPairScene(g, layout, routePairGraph(g, layout)))
    fixtures.set(key, fx)
  }
  return fx
}

const ALL_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['syzygies', 'currents', 'gates'])

function stateFor(fx: Fx, over: Partial<DrawState> = {}): DrawState {
  return {
    scene: fx.scene,
    view: fx.view,
    zoneLabels: fx.labels,
    transform: IDENTITY_TRANSFORM,
    cssWidth: fx.w,
    cssHeight: fx.h,
    dpr: 1,
    layers: ALL_LAYERS,
    labelVisibility: { numbers: true, xenotation: false, planets: false },
    gateMode: 'on',
    zoneStates: null,
    tcActive: false,
    ...over,
  }
}

const scaleFor = (fx: Fx, t: CanvasTransform = IDENTITY_TRANSFORM): number => scaleOf(t, fx.frame, fx.w, fx.h)

/** A transform at the given zoom that puts the world point (wx, wy) at the centre of the window. */
function centerOn(fx: Fx, wx: number, wy: number, zoom: number): CanvasTransform {
  const s = scaleFor(fx, { zoom, tx: 0, ty: 0 })
  return { zoom, tx: -(wx - fx.frame.width / 2) * s, ty: -(wy - fx.frame.height / 2) * s }
}
const screenOf = (fx: Fx, wx: number, wy: number, t: CanvasTransform = IDENTITY_TRANSFORM): { x: number; y: number } =>
  toScreen(t, fx.frame, fx.w, fx.h, wx, wy)

/** The state override that removes the layout's own region captions, so text counts see only zone or pill labels. */
const bare = (fx: Fx): Partial<DrawState> => ({ scene: { ...fx.scene, regionLabels: [] } })

/** The stroke of the current stems: alpha 1, a batch of quadratic curves (the junction rims are alpha 1 too, but arcs). */
const stemStroke = (events: readonly Ev[]): Ev =>
  events.find(
    e => e.type === 'stroke' && e.style.globalAlpha === 1 && e.style.strokeStyle === '#22ee66' && opsOf(e, 'quadraticCurveTo').length > 0,
  ) as Ev

/** The font size in CSS px out of a canvas font string such as "bold 12.5px monospace". */
const fontPx = (font: string): number => Number(/([\d.]+)px/.exec(font)?.[1])

/** States with every zone normal except the listed ones. */
function statesWith(n: number, set: Record<number, number>): Uint8Array {
  const states = new Uint8Array(n).fill(ZONE_NORMAL)
  for (const [z, v] of Object.entries(set)) states[Number(z)] = v
  return states
}

// ── Constants and the opacity table ──────────────────────────────────────────────────────────────────────────────────

describe('draw constants and edgeLayerOpacity', () => {
  it('names the numbers the UI-SPEC fixes', () => {
    expect(HIGHLIGHT_FULL_FIDELITY_MAX).toBe(400)
    expect(CAPTION_MIN_PX).toBe(6)
    expect(NODE_MIN_RADIUS_PX).toBe(1.5)
    expect(STROKE_MIN_PX).toBe(1)
    expect(AMBIENT_ARROW_MIN_PX).toBe(24)
  })

  it('carries the SVG tier ambient and context opacities per kind, frozen', () => {
    expect(EDGE_LAYER_ALPHA.syzygy).toEqual({ ambient: 0.5, context: 0.1 })
    expect(EDGE_LAYER_ALPHA.current).toEqual({ ambient: 0.6, context: 0.08 })
    expect(EDGE_LAYER_ALPHA.gate).toEqual({ ambient: 0.5, context: 0.08 })
    expect(Object.isFrozen(EDGE_LAYER_ALPHA)).toBe(true)
  })

  it('the layer opacity is ambient without focus, context with it, and gates are halved when thin', () => {
    expect(edgeLayerOpacity('syzygy', false, 'off')).toBe(0.5)
    expect(edgeLayerOpacity('syzygy', true, 'off')).toBe(0.1)
    expect(edgeLayerOpacity('current', false, 'off')).toBe(0.6)
    expect(edgeLayerOpacity('current', true, 'off')).toBe(0.08)
    expect(edgeLayerOpacity('gate', false, 'on')).toBe(0.5)
    expect(edgeLayerOpacity('gate', false, 'thin')).toBe(0.25)
    expect(edgeLayerOpacity('gate', true, 'thin')).toBe(0.04)
    expect(edgeLayerOpacity('gate', true, 'on')).toBe(0.08)
    // the gate mode never touches syzygies or currents
    expect(edgeLayerOpacity('syzygy', false, 'thin')).toBe(0.5)
    expect(edgeLayerOpacity('current', true, 'thin')).toBe(0.08)
  })
})

describe('palette', () => {
  it('carries the SVG tier hexes byte for byte', () => {
    expect(PALETTE.syzygy).toBe('#e8e8e8')
    expect(PALETTE.current).toBe('#22ee66')
    expect(PALETTE.gate).toBe('#cc44ff')
    expect(PALETTE.timeCircuit).toBe('#00ccff')
    expect(PALETTE.focusRing).toBe('#10ff50')
    expect(Object.isFrozen(PALETTE)).toBe(true)
  })
})

describe('parseArcEnd (pair-graph arrowheads)', () => {
  it('a quarter turn: end point, tangent by sweep, extent = chord', () => {
    const cw = parseArcEnd('M1 0A1 1 0 0 1 0 1')
    expect(cw).not.toBeNull()
    expect(cw?.x).toBe(0)
    expect(cw?.y).toBe(1)
    expect(cw?.dx).toBeCloseTo(-1, 9)
    expect(cw?.dy).toBeCloseTo(0, 9)
    expect(cw?.span).toBeCloseTo(Math.SQRT2, 9)
    const ccw = parseArcEnd('M1 0A1 1 0 0 0 0 1')
    expect(ccw?.dx).toBeCloseTo(0, 9)
    expect(ccw?.dy).toBeCloseTo(1, 9)
  })

  it('a large arc (the loop under a pill): the centre lies on the far side of the chord', () => {
    const loop = parseArcEnd('M-0.8 0A1 1 0 1 0 0.8 0')
    expect(loop?.x).toBeCloseTo(0.8, 9)
    expect(loop?.dx).toBeCloseTo(-0.6, 9)
    expect(loop?.dy).toBeCloseTo(-0.8, 9)
    expect(loop?.span).toBeCloseTo(1.6, 9)
  })

  it('every engine pair-graph route parses, with a finite tangent along the circle', () => {
    const fx = pairFx(28)
    const strings = [...(fx.scene.pairArc ?? []), ...(fx.scene.pairLoop ?? [])].filter((d): d is string => d !== null)
    expect(strings.length).toBeGreaterThan(0)
    for (const d of strings) {
      const end = parseArcEnd(d)
      expect(end).not.toBeNull()
      expect(Number.isFinite((end?.dx ?? NaN) + (end?.dy ?? NaN) + (end?.x ?? NaN) + (end?.y ?? NaN))).toBe(true)
      expect(Math.hypot(end?.dx ?? 0, end?.dy ?? 0)).toBeGreaterThan(0)
    }
  })

  it('anything that is not one circular arc is null', () => {
    for (const d of ['', 'M0 0L1 1', 'M0 0Q1 1 2 2', 'M0 0A1 1 0 0 1', 'M0 0A1 1 0 0 1 0 0', 'M0 0A0 0 0 0 1 1 1', 'M0 0A1 1 0 0 1 1e999 1', 'M0 0A1 1 0 0 1 1 1A1 1 0 0 1 2 2']) {
      expect(parseArcEnd(d)).toBeNull()
    }
  })
})

// ── The scene index (joins by pair id and zone, never by view-array index) ───────────────────────────────────────────

describe('buildSceneIndex', () => {
  for (const base of [4, 28, 202]) {
    it(`base ${base}: every join is by pair id or zone`, () => {
      const fx = zoneFx(base)
      const { g, scene, index, view } = fx
      const P = g.pairCount
      expect(index.pairOfZone).toHaveLength(base)
      for (let z = 0; z < base; z++) {
        expect(index.pairOfZone[z]).toBe(g.pairOf(z))
        expect(index.gateByZone[z]?.from).toBe(z)
        expect(index.gateByZone[z]?.to).toBe(g.gate(z).to)
      }
      for (let q = 0; q < P; q++) {
        const { lo, hi } = g.pair(q)
        expect(index.pairLo[q]).toBe(lo)
        expect(index.pairHi[q]).toBe(hi)
        expect(g.pairOf(index.syzygyByPair[q]?.a ?? -1)).toBe(q)
        expect(g.pairOf(index.currentByPair[q]?.from ?? -1)).toBe(q)
        expect(index.currentByPair[q]?.to).toBe(scene.currentTo[q])
      }
      // the lists are the view's own entries, only re-keyed
      expect(new Set(index.syzygyByPair)).toEqual(new Set(view.syzygies))
      expect(new Set(index.currentByPair)).toEqual(new Set(view.currents))
    })

    it(`base ${base}: the currents-into and gates-into lists are the inverse of currentTo and gateTo`, () => {
      const fx = zoneFx(base)
      const { g, scene, index } = fx
      const P = g.pairCount
      let total = 0
      for (let z = 0; z < base; z++) {
        const into: number[] = []
        for (let i = index.currentsIntoStart[z] ?? 0; i < (index.currentsIntoStart[z + 1] ?? 0); i++) into.push(index.currentsInto[i] ?? -1)
        const expected: number[] = []
        for (let q = 0; q < P; q++) if (scene.currentTo[q] === z) expected.push(q)
        expect(into.sort((a, b) => a - b)).toEqual(expected)
        total += into.length
        const gatesInto: number[] = []
        for (let i = index.gatesIntoStart[z] ?? 0; i < (index.gatesIntoStart[z + 1] ?? 0); i++) gatesInto.push(index.gatesInto[i] ?? -1)
        const expectedGates: number[] = []
        for (let w = 0; w < base; w++) if (scene.gateTo[w] === z) expectedGates.push(w)
        expect(gatesInto.sort((a, b) => a - b)).toEqual(expectedGates)
      }
      expect(total).toBe(P)
    })
  }

  it('flags the Torque syzygies and currents from the view data', () => {
    const fx = zoneFx(28)
    const { g, view, index } = fx
    let syz = 0
    let cur = 0
    for (let q = 0; q < g.pairCount; q++) {
      syz += index.torqueSyzygy[q] ?? 0
      cur += index.torqueCurrent[q] ?? 0
    }
    expect(syz).toBe(view.torqueSyzygies.length)
    expect(cur).toBe(view.torqueCurrentNames.size)
    for (const [lo] of view.torqueSyzygies) expect(index.torqueSyzygy[g.pairOf(lo)]).toBe(1)
  })
})

// ── Syzygy layer ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('drawSyzygyLayer', () => {
  it('clears to transparent first (setTransform with the dpr, then clearRect of the window) and never fills a background', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx, { dpr: 2 }), fx.index)
    const setT = rec.events.findIndex(e => e.type === 'setTransform')
    const clear = rec.events.findIndex(e => e.type === 'clearRect')
    const firstStroke = rec.events.findIndex(e => e.type === 'stroke')
    expect(setT).toBeGreaterThanOrEqual(0)
    expect(setT).toBeLessThan(clear)
    expect(clear).toBeLessThan(firstStroke)
    expect(rec.events[setT]?.args).toEqual([2, 0, 0, 2, 0, 0])
    expect(rec.events[clear]?.args).toEqual([0, 0, fx.w, fx.h])
    expect(rec.events.some(e => e.type === 'fillRect')).toBe(false)
  })

  it('base 28: one dotted round-cap batch at alpha 1 in #e8e8e8, 1.5 CSS px wide, spaced 3 k s', () => {
    const fx = zoneFx(28)
    const st = stateFor(fx)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, st, fx.index)
    const strokes = strokesOf(rec.events)
    expect(strokes).toHaveLength(1)
    const e = strokes[0] as Ev
    expect(e.style.strokeStyle).toBe('#e8e8e8')
    expect(e.style.lineCap).toBe('round')
    expect(e.style.lineWidth).toBe(1.5)
    expect(e.style.globalAlpha).toBe(1)
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    expect(e.style.lineDash).toHaveLength(2)
    expect(e.style.lineDash[0]).toBeCloseTo(0.1, 12)
    expect(e.style.lineDash[1]).toBeCloseTo(3 * k * s, 9)
    // one segment per pair, from the scene's trimmed end points through toScreen
    expect(opsOf(e, 'moveTo')).toHaveLength(fx.g.pairCount)
    expect(opsOf(e, 'lineTo')).toHaveLength(fx.g.pairCount)
    const first = nums((opsOf(e, 'moveTo')[0] as { args: unknown[] }).args)
    const a = screenOf(fx, fx.scene.syzygySeg[0] as number, fx.scene.syzygySeg[1] as number)
    expect(first[0]).toBeCloseTo(a.x, 9)
    expect(first[1]).toBeCloseTo(a.y, 9)
    const last = nums((opsOf(e, 'lineTo')[fx.g.pairCount - 1] as { args: unknown[] }).args)
    const q = fx.g.pairCount - 1
    const b = screenOf(fx, fx.scene.syzygySeg[4 * q + 2] as number, fx.scene.syzygySeg[4 * q + 3] as number)
    expect(last[0]).toBeCloseTo(b.x, 9)
    expect(last[1]).toBeCloseTo(b.y, 9)
  })

  it('without the syzygies layer it only clears', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx, { layers: new Set<Layer>(['currents', 'gates']) }), fx.index)
    expect(ofType(rec.events, 'clearRect')).toHaveLength(1)
    expect(strokesOf(rec.events)).toHaveLength(0)
    expect(ofType(rec.events, 'setLineDash')).toHaveLength(0)
  })

  it('a pair with a muted end is not drawn', () => {
    const fx = zoneFx(28)
    const muted = 3
    const states = statesWith(28, { [muted]: ZONE_HIDDEN })
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx, { zoneStates: states }), fx.index)
    const e = strokesOf(rec.events)[0] as Ev
    expect(opsOf(e, 'moveTo')).toHaveLength(fx.g.pairCount - 1)
    const q = fx.g.pairOf(muted)
    const gone = screenOf(fx, fx.scene.syzygySeg[4 * q] as number, fx.scene.syzygySeg[4 * q + 1] as number)
    const starts = opsOf(e, 'moveTo').map(o => nums(o.args))
    expect(starts.some(p => Math.abs((p[0] as number) - gone.x) < 1e-9 && Math.abs((p[1] as number) - gone.y) < 1e-9)).toBe(false)
  })

  it('isolate-dimmed pairs are stroked on their own batch at context over ambient (0.2), the rest at alpha 1', () => {
    const fx = zoneFx(28)
    const all = makeRecorder()
    drawSyzygyLayer(all.env, stateFor(fx, { zoneStates: new Uint8Array(28).fill(ZONE_DIMMED) }), fx.index)
    const onlyDim = strokesOf(all.events)
    expect(onlyDim).toHaveLength(1)
    expect(onlyDim[0]?.style.globalAlpha).toBeCloseTo(0.2, 12)

    const mixed = makeRecorder()
    drawSyzygyLayer(mixed.env, stateFor(fx, { zoneStates: statesWith(28, { 3: ZONE_DIMMED }) }), fx.index)
    const strokes = strokesOf(mixed.events)
    expect(strokes).toHaveLength(2)
    const live = strokes.find(e => e.style.globalAlpha === 1) as Ev
    const dim = strokes.find(e => e.style.globalAlpha !== 1) as Ev
    expect(opsOf(live, 'moveTo')).toHaveLength(fx.g.pairCount - 1)
    expect(opsOf(dim, 'moveTo')).toHaveLength(1)
    expect(dim.style.globalAlpha).toBeCloseTo(0.2, 12)
  })

  it('while the Time Circuit is active only the Torque syzygies draw', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx, { tcActive: true }), fx.index)
    const e = strokesOf(rec.events)[0] as Ev
    expect(opsOf(e, 'moveTo')).toHaveLength(fx.view.torqueSyzygies.length)
  })

  it('culls pairs that lie outside the window when zoomed in', () => {
    const fx = zoneFx(202)
    const full = makeRecorder()
    drawSyzygyLayer(full.env, stateFor(fx), fx.index)
    const zoomed = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    expect(zoomed.zoom).toBeGreaterThan(2)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx, { transform: zoomed }), fx.index)
    const total = opsOf(strokesOf(full.events)[0] as Ev, 'moveTo').length
    const drawn = opsOf(strokesOf(rec.events)[0] as Ev, 'moveTo').length
    expect(total).toBe(fx.g.pairCount)
    expect(drawn).toBeGreaterThan(0)
    expect(drawn).toBeLessThan(total / 2)
  })

  it('a pair-graph scene has no syzygy lines: it only clears', () => {
    const fx = pairFx(28)
    const rec = makeRecorder()
    drawSyzygyLayer(rec.env, stateFor(fx), fx.index)
    expect(ofType(rec.events, 'clearRect')).toHaveLength(1)
    expect(strokesOf(rec.events)).toHaveLength(0)
  })
})

// ── Current layer ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The on-screen chord length of the stem of pair q. */
function stemLengthPx(fx: Fx, q: number, t: CanvasTransform = IDENTITY_TRANSFORM): number {
  const c = fx.scene.currentCurves
  const o = 18 * q + 12
  return Math.hypot((c[o + 4] as number) - (c[o] as number), (c[o + 5] as number) - (c[o + 1] as number)) * scaleFor(fx, t)
}

describe('drawCurrentLayer (zone layouts)', () => {
  it('base 28 at fit: one stem batch (a curve per pair), one leg batch at alpha 0.7 (two per pair), one white junction disc per current', () => {
    const fx = zoneFx(28)
    const st = stateFor(fx)
    const s = scaleFor(fx)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(true) // precondition: label level of detail
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, st, fx.index)
    const strokes = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#22ee66')
    const stems = strokes.filter(e => e.style.globalAlpha === 1 && opsOf(e, 'quadraticCurveTo').length > 0)
    const legs = strokes.filter(e => e.style.globalAlpha === 0.7)
    expect(stems).toHaveLength(1)
    expect(legs).toHaveLength(1)
    expect(opsOf(stems[0] as Ev, 'quadraticCurveTo')).toHaveLength(fx.g.pairCount)
    expect(opsOf(legs[0] as Ev, 'quadraticCurveTo')).toHaveLength(2 * fx.g.pairCount)
    // the white junction discs: one arc per current, filled #ffffff
    const white = fillsOf(rec.events).filter(e => e.style.fillStyle === '#ffffff')
    expect(white).toHaveLength(1)
    expect(opsOf(white[0] as Ev, 'arc')).toHaveLength(fx.g.pairCount)
    const r = nums((opsOf(white[0] as Ev, 'arc')[0] as { args: unknown[] }).args)[2]
    expect(r).toBeCloseTo(3.5 * (fx.scene.nodeRadius / 21) * s, 9)
  })

  it('zoomed in the stems are 1.2 ss s wide and the legs 0.7 of that (the 1 px floor no longer binds)', () => {
    const fx = zoneFx(28)
    const t: CanvasTransform = { zoom: 2, tx: 0, ty: 0 }
    const s = scaleFor(fx, t)
    const ss = fx.scene.strokeScale
    const stemWidth = Math.max(1, 1.2 * ss * s)
    const legWidth = Math.max(1, 0.7 * 1.2 * ss * s)
    expect(legWidth).toBeGreaterThan(1)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { transform: t }), fx.index)
    const stem = stemStroke(rec.events)
    const legs = strokesOf(rec.events).find(e => e.style.globalAlpha === 0.7) as Ev
    expect(stem.style.lineWidth).toBeCloseTo(stemWidth, 9)
    expect(legs.style.lineWidth).toBeCloseTo(legWidth, 9)
    expect(legs.style.lineWidth / stem.style.lineWidth).toBeCloseTo(0.7, 9)
    // the floor itself: at fit both are 1 px
    const fit = makeRecorder()
    drawCurrentLayer(fit.env, stateFor(fx), fx.index)
    expect(stemStroke(fit.events).style.lineWidth).toBe(STROKE_MIN_PX)
  })

  it('the first stem curve is the scene curve of pair 0 mapped through toScreen', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx), fx.index)
    const stems = stemStroke(rec.events)
    const c = fx.scene.currentCurves
    const p0 = screenOf(fx, c[12] as number, c[13] as number)
    const pc = screenOf(fx, c[14] as number, c[15] as number)
    const p1 = screenOf(fx, c[16] as number, c[17] as number)
    const mv = nums((opsOf(stems, 'moveTo')[0] as { args: unknown[] }).args)
    const qd = nums((opsOf(stems, 'quadraticCurveTo')[0] as { args: unknown[] }).args)
    expect(mv[0]).toBeCloseTo(p0.x, 9)
    expect(mv[1]).toBeCloseTo(p0.y, 9)
    expect(qd[0]).toBeCloseTo(pc.x, 9)
    expect(qd[1]).toBeCloseTo(pc.y, 9)
    expect(qd[2]).toBeCloseTo(p1.x, 9)
    expect(qd[3]).toBeCloseTo(p1.y, 9)
  })

  it('draws an arrowhead only for stems that are at least 24 CSS px long on screen', () => {
    const fx = zoneFx(28)
    const longEnough = (t: CanvasTransform): number => {
      let count = 0
      for (let q = 0; q < fx.g.pairCount; q++) if (stemLengthPx(fx, q, t) >= AMBIENT_ARROW_MIN_PX) count++
      return count
    }
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx), fx.index)
    const arrows = fillsOf(rec.events).filter(e => e.style.fillStyle === '#22ee66')
    const expected = longEnough(IDENTITY_TRANSFORM)
    expect(expected).toBeGreaterThan(0)
    expect(arrows).toHaveLength(1)
    expect(opsOf(arrows[0] as Ev, 'closePath')).toHaveLength(expected)

    // a base 202 fit: every stem is shorter than 24 px, so no arrowhead path at all
    const small = zoneFx(202)
    let longest = 0
    for (let q = 0; q < small.g.pairCount; q++) longest = Math.max(longest, stemLengthPx(small, q))
    expect(longest).toBeLessThan(AMBIENT_ARROW_MIN_PX)
    const rec2 = makeRecorder()
    drawCurrentLayer(rec2.env, stateFor(small), small.index)
    expect(fillsOf(rec2.events).filter(e => e.style.fillStyle === '#22ee66')).toHaveLength(0)
  })

  it('an arrowhead is the 9 x 7 marker scaled to the stem width, tip on the stem end', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx), fx.index)
    const arrow = fillsOf(rec.events).find(e => e.style.fillStyle === '#22ee66') as Ev
    const tip = nums((opsOf(arrow, 'moveTo')[0] as { args: unknown[] }).args)
    const corners = opsOf(arrow, 'lineTo').slice(0, 2).map(o => nums(o.args))
    const width = Math.max(1, 1.2 * fx.scene.strokeScale * scaleFor(fx))
    const scale = Math.min(9 / 8, 7 / 6) * width
    const midBase = [((corners[0] as number[])[0] as number + (corners[1] as number[])[0]!) / 2, ((corners[0] as number[])[1] as number + (corners[1] as number[])[1]!) / 2]
    expect(Math.hypot(tip[0]! - midBase[0]!, tip[1]! - midBase[1]!)).toBeCloseTo(7 * scale, 6)
    expect(Math.hypot(corners[0]![0]! - corners[1]![0]!, corners[0]![1]! - corners[1]![1]!)).toBeCloseTo(5 * scale, 6)
  })

  it('draws junction circles only at label level of detail', () => {
    const small = zoneFx(202)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, small.frame, small.w, small.h))).toBe(false)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(small), small.index)
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#ffffff')).toHaveLength(0)
    expect(strokesOf(rec.events).length).toBeGreaterThan(0)
  })

  it('without the currents layer it only clears', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { layers: new Set<Layer>(['syzygies', 'gates']) }), fx.index)
    expect(ofType(rec.events, 'clearRect')).toHaveLength(1)
    expect(strokesOf(rec.events)).toHaveLength(0)
  })

  it('while the Time Circuit is active only the Torque currents draw', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { tcActive: true }), fx.index)
    const stems = stemStroke(rec.events)
    expect(opsOf(stems, 'quadraticCurveTo')).toHaveLength(fx.view.torqueCurrentNames.size)
  })

  it('a muted zone removes its current; an isolate-dimmed current is stroked at context over ambient', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { zoneStates: statesWith(28, { 5: ZONE_HIDDEN }) }), fx.index)
    const stems = stemStroke(rec.events)
    // zone 5 is a member of one pair (its current is hidden) and may be the destination of others
    let hidden = 0
    for (let q = 0; q < fx.g.pairCount; q++) {
      const { lo, hi } = fx.g.pair(q)
      if (lo === 5 || hi === 5 || fx.scene.currentTo[q] === 5) hidden++
    }
    expect(hidden).toBeGreaterThan(0)
    expect(opsOf(stems, 'quadraticCurveTo')).toHaveLength(fx.g.pairCount - hidden)

    const rec2 = makeRecorder()
    drawCurrentLayer(rec2.env, stateFor(fx, { zoneStates: new Uint8Array(28).fill(ZONE_DIMMED) }), fx.index)
    const alphas = new Set(strokesOf(rec2.events).map(e => e.style.globalAlpha))
    const ratio = EDGE_LAYER_ALPHA.current.context / EDGE_LAYER_ALPHA.current.ambient
    expect([...alphas].sort()).toEqual([ratio * 0.7, ratio].sort())
  })

  it('skips a curve whose numbers are NaN without emitting a NaN', () => {
    const fx = zoneFx(28)
    const broken = new Float64Array(fx.scene.currentCurves)
    for (let i = 0; i < 6; i++) broken[12 + i] = NaN // the stem of pair 0
    const scene: CanvasScene = { ...fx.scene, currentCurves: broken }
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { scene }), fx.index)
    expectAllFinite(rec)
    const stems = stemStroke(rec.events)
    expect(opsOf(stems, 'quadraticCurveTo')).toHaveLength(fx.g.pairCount - 1)
  })
})

// ── Gate layer ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('drawGateLayer', () => {
  it("gate mode 'off' only clears", () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawGateLayer(rec.env, stateFor(fx, { gateMode: 'off' }), fx.index)
    expect(ofType(rec.events, 'clearRect')).toHaveLength(1)
    expect(strokesOf(rec.events)).toHaveLength(0)
    expect(ofType(rec.events, 'setLineDash')).toHaveLength(0)
  })

  it('layers without gates, or an active Time Circuit, only clear', () => {
    const fx = zoneFx(28)
    const noLayer = makeRecorder()
    drawGateLayer(noLayer.env, stateFor(fx, { layers: new Set<Layer>(['syzygies', 'currents']) }), fx.index)
    expect(strokesOf(noLayer.events)).toHaveLength(0)
    const tc = makeRecorder()
    drawGateLayer(tc.env, stateFor(fx, { tcActive: true }), fx.index)
    expect(strokesOf(tc.events)).toHaveLength(0)
    expect(ofType(tc.events, 'clearRect')).toHaveLength(1)
  })

  for (const mode of ['on', 'thin'] as const) {
    it(`gate mode '${mode}': #cc44ff, dashes 5/3 ss s for single routes and 3/2 ss s for loops, width max(1, 0.7 ss s) at alpha 1`, () => {
      const fx = zoneFx(28)
      const s = scaleFor(fx)
      const ss = fx.scene.strokeScale
      const rec = makeRecorder()
      drawGateLayer(rec.env, stateFor(fx, { gateMode: mode }), fx.index)
      const strokes = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#cc44ff')
      expect(strokes).toHaveLength(2)
      const single = strokes.find(e => e.style.lineDash[0]! > 4 * ss * s) as Ev
      const loop = strokes.find(e => e.style.lineDash[0]! <= 4 * ss * s) as Ev
      expect(single.style.lineDash[0]).toBeCloseTo(5 * ss * s, 9)
      expect(single.style.lineDash[1]).toBeCloseTo(3 * ss * s, 9)
      expect(loop.style.lineDash[0]).toBeCloseTo(3 * ss * s, 9)
      expect(loop.style.lineDash[1]).toBeCloseTo(2 * ss * s, 9)
      for (const e of strokes) {
        expect(e.style.lineWidth).toBeCloseTo(Math.max(1, 0.7 * ss * s), 9)
        expect(e.style.globalAlpha).toBe(1)
      }
      let loops = 0
      for (let z = 0; z < 28; z++) loops += fx.scene.gateLoop[z] ?? 0
      expect(opsOf(loop, 'quadraticCurveTo')).toHaveLength(loops)
      expect(opsOf(single, 'quadraticCurveTo')).toHaveLength(28 - loops)
    })
  }

  it('the thin and on layers differ only in the layer opacity the component applies', () => {
    expect(edgeLayerOpacity('gate', false, 'thin')).toBe(edgeLayerOpacity('gate', false, 'on') * 0.5)
  })

  it('muted and isolate-dimmed gates', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawGateLayer(rec.env, stateFor(fx, { zoneStates: statesWith(28, { 2: ZONE_HIDDEN }) }), fx.index)
    let hidden = 0
    for (let z = 0; z < 28; z++) if (z === 2 || fx.scene.gateTo[z] === 2) hidden++
    const drawn = strokesOf(rec.events).reduce((n, e) => n + opsOf(e, 'moveTo').length, 0)
    expect(drawn).toBe(28 - hidden)

    const dim = makeRecorder()
    drawGateLayer(dim.env, stateFor(fx, { zoneStates: new Uint8Array(28).fill(ZONE_DIMMED) }), fx.index)
    for (const e of strokesOf(dim.events)) expect(e.style.globalAlpha).toBeCloseTo(0.16, 12)
  })

  it('draws an 8 x 6 arrowhead only for gates at least 24 CSS px long', () => {
    const fx = zoneFx(28)
    const c = fx.scene.gateCurves
    let expected = 0
    for (let z = 0; z < 28; z++) {
      const len = Math.hypot((c[6 * z + 4] as number) - (c[6 * z] as number), (c[6 * z + 5] as number) - (c[6 * z + 1] as number)) * scaleFor(fx)
      if (len >= AMBIENT_ARROW_MIN_PX) expected++
    }
    const rec = makeRecorder()
    drawGateLayer(rec.env, stateFor(fx), fx.index)
    const arrows = fillsOf(rec.events).filter(e => e.style.fillStyle === '#cc44ff')
    expect(expected).toBeGreaterThan(0)
    expect(arrows.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(expected)
  })
})

// ── Node layer ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('drawNodeLayer (zone layouts)', () => {
  it('below the label threshold: no text, discs at max(R_px, 1.5) with the idle fill, stroke and 1 px stroke floor', () => {
    const fx = zoneFx(4000)
    const t = IDENTITY_TRANSFORM
    const rPx = onScreenRadius(t, fx.frame, fx.w, fx.h)
    expect(rPx).toBeLessThan(NODE_MIN_RADIUS_PX)
    expect(labelsShown(rPx)).toBe(false)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx), fx.index)
    expect(ofType(rec.events, 'fillText')).toHaveLength(0)
    const discs = fillsOf(rec.events).filter(e => e.style.fillStyle.endsWith('18'))
    expect(discs.length).toBeGreaterThan(0)
    let arcs = 0
    for (const e of discs) {
      for (const a of opsOf(e, 'arc')) {
        arcs++
        expect(nums(a.args)[2]).toBe(NODE_MIN_RADIUS_PX)
      }
    }
    expect(arcs).toBe(4000)
    const rings = strokesOf(rec.events).filter(e => e.style.strokeStyle.endsWith('44'))
    expect(rings.length).toBeGreaterThan(0)
    for (const e of rings) expect(e.style.lineWidth).toBe(STROKE_MIN_PX)
    // the fills carry the zone colour with the 18 suffix, strokes the 44 suffix
    for (const e of discs) expect(Object.values(fx.view.zoneColors)).toContain(e.style.fillStyle.slice(0, 7))
  })

  it('base 202 at fit (R_px between the floor and the threshold): discs at R_px itself, still no text, triangles or region dots', () => {
    const fx = zoneFx(202)
    const rPx = onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h)
    expect(rPx).toBeGreaterThan(NODE_MIN_RADIUS_PX)
    expect(labelsShown(rPx)).toBe(false)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx), fx.index)
    const discs = fillsOf(rec.events).filter(e => e.style.fillStyle.endsWith('18'))
    const radii = discs.flatMap(e => opsOf(e, 'arc').map(a => nums(a.args)[2] as number))
    expect(radii).toHaveLength(202)
    for (const r of radii) expect(r).toBeCloseTo(rPx, 9)
    expect(ofType(rec.events, 'fillText')).toHaveLength(0)
    // no triangle path and no region dot: only the idle discs are filled
    expect(fillsOf(rec.events).every(e => e.style.fillStyle.endsWith('18'))).toBe(true)
  })

  it('at or above the threshold: one bold monospace label per visible zone when numbers are on, none when off', () => {
    const fx = zoneFx(28)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(true)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, bare(fx)), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts).toHaveLength(28)
    expect(new Set(texts.map(e => e.args[0]))).toEqual(new Set(fx.labels))
    const s = scaleFor(fx)
    for (const e of texts) {
      expect(e.style.font).toContain('bold')
      expect(e.style.font).toContain('monospace')
      expect(fontPx(e.style.font)).toBeCloseTo(fx.scene.labelSize * s, 9)
      expect(e.style.textAlign).toBe('center')
    }
    // the first label sits at the zone centre (y + 1 world unit), coloured `${clr}aa`
    const z0 = texts.find(e => e.args[0] === fx.labels[0]) as Ev
    const p = screenOf(fx, fx.scene.x[0] as number, (fx.scene.y[0] as number) + 1)
    expect(nums(z0.args.slice(1))[0]).toBeCloseTo(p.x, 9)
    expect(nums(z0.args.slice(1))[1]).toBeCloseTo(p.y, 9)
    expect(z0.style.fillStyle).toBe(`${fx.view.zoneColors[0]}aa`)

    const off = makeRecorder()
    drawNodeLayer(off.env, stateFor(fx, { ...bare(fx), labelVisibility: { numbers: false, xenotation: false, planets: false } }), fx.index)
    expect(ofType(off.events, 'fillText')).toHaveLength(0)
    // with the layout's own captions kept (base 28 at fit shows all four) they are the only text left
    const caps = makeRecorder()
    drawNodeLayer(caps.env, stateFor(fx, { labelVisibility: { numbers: false, xenotation: false, planets: false } }), fx.index)
    expect(ofType(caps.events, 'fillText').map(e => e.args[0])).toEqual(fx.scene.regionLabels.map(l => l.text))
  })

  it('the xenotation label follows its own toggle: italic 6.5 k s at y + 24 k, alpha 0.44', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), labelVisibility: { numbers: false, xenotation: true, planets: false } }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts.length).toBeGreaterThan(0)
    expect(texts.length).toBeLessThan(28) // zone 0 has no xenotation
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    for (const e of texts) {
      expect(e.style.font).toContain('italic')
      expect(fontPx(e.style.font)).toBeCloseTo(6.5 * k * s, 9)
      expect(e.style.globalAlpha).toBeCloseTo(0.44, 12)
    }
    // zone 7: the xenotation text, in the zone colour at suffix 70, 24 k below the centre
    const seven = texts.find(e => e.args[0] === formatXenotationForDisplay(7)) as Ev
    const at = screenOf(fx, fx.scene.x[7] as number, (fx.scene.y[7] as number) + 24 * k)
    expect(seven.style.fillStyle).toBe(`${fx.view.zoneColors[7]}70`)
    expect(nums(seven.args.slice(1))[0]).toBeCloseTo(at.x, 9)
    expect(nums(seven.args.slice(1))[1]).toBeCloseTo(at.y, 9)
  })

  it('zoomed in, where the 1 px floor no longer binds, the idle zone stroke is 0.7 ss s, the current junction rim 0.8 ss s and the gate 0.7 ss s', () => {
    const fx = zoneFx(28)
    const zone = 5
    const ss = fx.scene.strokeScale
    const t = centerOn(fx, fx.scene.x[zone] as number, fx.scene.y[zone] as number, 3)
    const s = scaleFor(fx, t)
    expect(0.7 * ss * s).toBeGreaterThan(1)
    const nodes = makeRecorder()
    drawNodeLayer(nodes.env, stateFor(fx, { transform: t }), fx.index)
    const rim = strokesOf(nodes.events).find(e => e.style.strokeStyle === `${fx.view.zoneColors[zone]}44`) as Ev
    expect(rim.style.lineWidth).toBeCloseTo(0.7 * ss * s, 9)

    const gates = makeRecorder()
    drawGateLayer(gates.env, stateFor(fx, { transform: t }), fx.index)
    const gate = strokesOf(gates.events).find(e => e.style.strokeStyle === '#cc44ff') as Ev
    expect(gate.style.lineWidth).toBeCloseTo(0.7 * ss * s, 9)

    const q = fx.g.pairOf(zone)
    const tj = centerOn(fx, fx.scene.junctionX[q] as number, fx.scene.junctionY[q] as number, 3)
    const sj = scaleFor(fx, tj)
    const cur = makeRecorder()
    drawCurrentLayer(cur.env, stateFor(fx, { transform: tj }), fx.index)
    const juncRim = strokesOf(cur.events).find(e => e.style.strokeStyle === '#22ee66' && e.style.globalAlpha === 1 && opsOf(e, 'arc').length > 0) as Ev
    expect(juncRim.style.lineWidth).toBeCloseTo(0.8 * ss * sj, 9)
  })

  it('draws the syzygy triangle (0.2) and the region dot (r = 2 k s, 0.3, region colour) at label level of detail', () => {
    const fx = zoneFx(28)
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx), fx.index)
    const triangles = fillsOf(rec.events).filter(e => e.style.globalAlpha === 0.2 && opsOf(e, 'closePath').length > 0)
    expect(triangles.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(28)
    // one triangle matches syzTrianglePoints (zone 3), mapped to screen
    const pos: Record<number, { x: number; y: number }> = {}
    for (let z = 0; z < 28; z++) pos[z] = { x: fx.scene.x[z] as number, y: fx.scene.y[z] as number }
    const expected = syzTrianglePoints(3, fx.view.partner(3), pos, k)
      .split(' ')
      .map(p => p.split(',').map(Number) as [number, number])
      .map(([x, y]) => screenOf(fx, x, y))
    const allTriangles = triangles.flatMap(e => {
      const moves = opsOf(e, 'moveTo').map(o => nums(o.args))
      const lines = opsOf(e, 'lineTo').map(o => nums(o.args))
      return moves.map((m, i) => [m, lines[2 * i] as number[], lines[2 * i + 1] as number[]])
    })
    const hit = allTriangles.some(tri =>
      tri.every((pt, i) => Math.abs((pt[0] as number) - (expected[i] as { x: number }).x) < 1e-6 && Math.abs((pt[1] as number) - (expected[i] as { y: number }).y) < 1e-6),
    )
    expect(hit).toBe(true)

    const dots = fillsOf(rec.events).filter(e => e.style.globalAlpha === 0.3)
    expect(dots.reduce((n, e) => n + opsOf(e, 'arc').length, 0)).toBe(28)
    for (const e of dots) {
      expect(Object.values(REGION_CLR)).toContain(e.style.fillStyle)
      for (const a of opsOf(e, 'arc')) expect(nums(a.args)[2]).toBeCloseTo(2 * k * s, 9)
    }
    // the dot sits below the node by nodeRadius + 10 k plus the label line (8 k + 2 k) when a number label shows
    const first = fx.scene.drawOrder[0] as number
    const centre = screenOf(fx, fx.scene.x[first] as number, 0).x
    const below = screenOf(fx, 0, (fx.scene.y[first] as number) + fx.scene.nodeRadius + 10 * k + 8 * k + 2 * k).y
    const arcs = dots.flatMap(e => opsOf(e, 'arc').map(a => nums(a.args)))
    expect(arcs.some(a => Math.abs((a[0] as number) - centre) < 1e-6 && Math.abs((a[1] as number) - below) < 1e-6)).toBe(true)
  })

  it('region captions follow their own size: hidden under 6 CSS px, drawn from 6 in the region colour', () => {
    const fx = zoneFx(28)
    const s = scaleFor(fx)
    const tiny = { kind: 'torque' as const, text: 'TINY', x: 100, y: 100, size: (CAPTION_MIN_PX - 0.5) / s, opacity: 0.5, anchor: 'middle' as const }
    const edge = { kind: 'warp' as const, text: 'EDGE', x: 200, y: 100, size: CAPTION_MIN_PX / s, opacity: 0.45, anchor: 'start' as const }
    const big = { kind: 'plex' as const, text: 'BIG', x: 300, y: 100, size: 12 / s, opacity: 0.45, anchor: 'end' as const }
    const scene: CanvasScene = { ...fx.scene, regionLabels: [tiny, edge, big] }
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { scene, labelVisibility: { numbers: false, xenotation: false, planets: false } }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts.map(e => e.args[0])).toEqual(['EDGE', 'BIG'])
    expect(texts[0]?.style.fillStyle).toBe(REGION_CLR.warp)
    expect(texts[1]?.style.fillStyle).toBe(REGION_CLR.plex)
    expect(texts[0]?.style.globalAlpha).toBeCloseTo(0.45, 12)
    expect(texts[0]?.style.textAlign).toBe('left')
    expect(texts[1]?.style.textAlign).toBe('right')
    expect(texts[1]?.style.font).toContain('monospace')
    expect(fontPx(texts[1]?.style.font as string)).toBeCloseTo(12, 9)
  })

  it('culls zones outside the window when zoomed into a corner', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    expect(near.zoom).toBeGreaterThan(2)
    const full = makeRecorder()
    drawNodeLayer(full.env, stateFor(fx), fx.index)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { transform: near }), fx.index)
    const arcs = (r: Recorder): number => fillsOf(r.events).filter(e => e.style.fillStyle.endsWith('18')).reduce((n, e) => n + opsOf(e, 'arc').length, 0)
    expect(arcs(full)).toBe(202)
    expect(arcs(rec)).toBeGreaterThan(0)
    expect(arcs(rec)).toBeLessThan(40)
  })

  it('a muted zone is not drawn; an isolate-dimmed zone is drawn at alpha 0.2', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneStates: statesWith(28, { 4: ZONE_HIDDEN, 6: ZONE_DIMMED }) }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts).toHaveLength(27)
    expect(texts.some(e => e.args[0] === fx.labels[4])).toBe(false)
    const dim = texts.find(e => e.args[0] === fx.labels[6]) as Ev
    expect(dim.style.globalAlpha).toBeCloseTo(0.2, 12)
    const live = texts.find(e => e.args[0] === fx.labels[7]) as Ev
    expect(live.style.globalAlpha).toBe(1)
  })
})

// ── Pair graph ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('pair-graph scenes', () => {
  it('drawCurrentLayer strokes one pathFromSvg(d) per non-null arc and loop in #22ee66 at max(1, 1.4 ss s)', () => {
    const fx = pairFx(28)
    const scene = fx.scene
    const expected = [...(scene.pairArc ?? []), ...(scene.pairLoop ?? [])].filter((d): d is string => d !== null)
    expect(expected).toHaveLength(14)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx), fx.index)
    expect(rec.svgCalls.slice().sort()).toEqual(expected.slice().sort())
    const strokes = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#22ee66')
    expect(strokes).toHaveLength(1)
    expect(strokes[0]?.style.lineWidth).toBeCloseTo(Math.max(1, 1.4 * scene.strokeScale * scaleFor(fx)), 9)
    expect(strokes[0]?.style.globalAlpha).toBe(1)
    expect(opsOf(strokes[0] as Ev, 'addPath')).toHaveLength(14)
    // the arcs are drawn whatever the Layers toggles say (the SVG pair graph has no layer check)
    const off = makeRecorder()
    drawCurrentLayer(off.env, stateFor(fx, { layers: new Set<Layer>() }), fx.index)
    expect(off.svgCalls).toHaveLength(14)
  })

  it('isolate-dimmed pairs draw their arcs at context over ambient', () => {
    const fx = pairFx(28)
    const rec = makeRecorder()
    drawCurrentLayer(rec.env, stateFor(fx, { zoneStates: new Uint8Array(28).fill(ZONE_DIMMED) }), fx.index)
    const strokes = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#22ee66')
    expect(strokes).toHaveLength(1)
    expect(strokes[0]?.style.globalAlpha).toBeCloseTo(0.08 / 0.6, 12)
  })

  it('drawNodeLayer draws one stadium pill per visible pair: fill alpha 0.12, stroke alpha 0.6, width max(1, 0.9 ss s)', () => {
    const fx = pairFx(28)
    const s = scaleFor(fx)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx), fx.index)
    const fills = fillsOf(rec.events).filter(e => e.style.globalAlpha === 0.12)
    const strokes = strokesOf(rec.events).filter(e => e.style.globalAlpha === 0.6)
    expect(fills.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(14)
    expect(strokes.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(14)
    for (const e of strokes) expect(e.style.lineWidth).toBeCloseTo(Math.max(1, 0.9 * fx.scene.strokeScale * s), 9)
    for (const e of fills) expect(fx.view.zoneColors).toContain(e.style.fillStyle)
    for (const e of strokes) expect(fx.view.zoneColors).toContain(e.style.strokeStyle)
    // the pill is the stadium of the scene's size: its width on screen is pillWidth x s
    const e = fills[0] as Ev
    const lines = opsOf(e, 'lineTo').map(o => nums(o.args))
    const move = nums((opsOf(e, 'moveTo')[0] as { args: unknown[] }).args)
    const r = (fx.scene.pillHeight * s) / 2
    expect(Math.abs((lines[0] as number[])[0]! - move[0]!) + 2 * r).toBeCloseTo(fx.scene.pillWidth * s, 6)
  })

  it('pill labels are hi::lo, drawn only at label level of detail (the pill half height is the radius)', () => {
    const fx = pairFx(28)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(true)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, bare(fx)), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts).toHaveLength(14)
    for (let q = 0; q < 14; q++) {
      const { lo, hi } = fx.g.pair(q)
      expect(texts.some(e => e.args[0] === `${fx.labels[hi]}::${fx.labels[lo]}`)).toBe(true)
    }
    for (const e of texts) expect(e.style.font).toContain('bold')

    const far = pairFx(202)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, far.frame, far.w, far.h))).toBe(false)
    const small = makeRecorder()
    drawNodeLayer(small.env, stateFor(far), far.index)
    expect(ofType(small.events, 'fillText')).toHaveLength(0)
  })

  it('a muted pair is not drawn and an isolate-dimmed pair is drawn at 0.2 of the pill alphas', () => {
    const fx = pairFx(28)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { zoneStates: statesWith(28, { 0: ZONE_HIDDEN, 1: ZONE_DIMMED }) }), fx.index)
    const live = fillsOf(rec.events).filter(e => e.style.globalAlpha === 0.12)
    const dim = fillsOf(rec.events).filter(e => Math.abs(e.style.globalAlpha - 0.12 * 0.2) < 1e-12)
    expect(live.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(12)
    expect(dim.reduce((n, e) => n + opsOf(e, 'closePath').length, 0)).toBe(1)
  })
})

// ── No NaN anywhere ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('NaN scan over the static layers', () => {
  const cases: [string, () => Fx][] = [
    ['ring 2', () => zoneFx(2)],
    ['ring 4', () => zoneFx(4)],
    ['ring 6', () => zoneFx(6)],
    ['ring 28', () => zoneFx(28)],
    ['ring 202', () => zoneFx(202)],
    ['ring 4000', () => zoneFx(4000)],
    ['ladder 28', () => zoneFx(28, 'ladder')],
    ['spiral 28', () => zoneFx(28, 'spiral')],
    ['pairGraph 28', () => pairFx(28)],
    ['pairGraph 4000', () => pairFx(4000)],
  ]
  for (const [name, make] of cases) {
    it(`${name}: every recorded number is finite, at fit and zoomed in`, () => {
      const fx = make()
      const zoomed = fitZones(fx.scene.x, fx.scene.y, [0, 1], fx.frame, fx.w, fx.h)
      for (const transform of [IDENTITY_TRANSFORM, zoomed]) {
        const rec = makeRecorder()
        const st = stateFor(fx, {
          transform,
          dpr: 2,
          labelVisibility: { numbers: true, xenotation: true, planets: false },
        })
        drawSyzygyLayer(rec.env, st, fx.index)
        drawCurrentLayer(rec.env, st, fx.index)
        drawGateLayer(rec.env, st, fx.index)
        drawNodeLayer(rec.env, st, fx.index)
        expectAllFinite(rec)
      }
    })
  }

  it('also with isolate and mute states and the Time Circuit on', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    const st = stateFor(fx, {
      zoneStates: statesWith(28, { 1: ZONE_DIMMED, 2: ZONE_HIDDEN, 9: ZONE_DIMMED }),
      tcActive: true,
    })
    drawSyzygyLayer(rec.env, st, fx.index)
    drawCurrentLayer(rec.env, st, fx.index)
    drawGateLayer(rec.env, st, fx.index)
    drawNodeLayer(rec.env, st, fx.index)
    expectAllFinite(rec)
  })
})

// ── Overlay ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function overlayFor(fx: Fx, over: Partial<OverlayState> = {}): OverlayState {
  return {
    ...stateFor(fx),
    hlZones: new Set<number>(),
    selZones: new Set<number>(),
    anyFocus: false,
    focusChords: null,
    ring: null,
    ...over,
  }
}

/** Every curve [x0, y0, cx, cy, x1, y1] a recorded stroke carries (a moveTo followed by quadraticCurveTo), in CSS px. */
function curvesOf(e: Ev): number[][] {
  const out: number[][] = []
  let start: number[] | null = null
  for (const o of e.path?.ops ?? []) {
    if (o.op === 'moveTo') start = nums(o.args)
    else if (o.op === 'quadraticCurveTo' && start !== null) out.push([...start, ...nums(o.args)])
  }
  return out
}

/** The scene curve at curves[off ..] mapped through the transform, in the same layout as curvesOf. */
function sceneCurve(fx: Fx, curves: Float64Array, off: number, t: CanvasTransform = IDENTITY_TRANSFORM): number[] {
  const a = screenOf(fx, curves[off] as number, curves[off + 1] as number, t)
  const c = screenOf(fx, curves[off + 2] as number, curves[off + 3] as number, t)
  const b = screenOf(fx, curves[off + 4] as number, curves[off + 5] as number, t)
  return [a.x, a.y, c.x, c.y, b.x, b.y]
}

const sameCurve = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] as number)) < 1e-6)

/** Whether some stroke accepted by `pick` carries the scene curve at curves[off ..]. */
function drawnCurve(
  events: readonly Ev[],
  fx: Fx,
  curves: Float64Array,
  off: number,
  pick: (e: Ev) => boolean = () => true,
  t: CanvasTransform = IDENTITY_TRANSFORM,
): boolean {
  const want = sceneCurve(fx, curves, off, t)
  return strokesOf(events).some(e => pick(e) && curvesOf(e).some(c => sameCurve(c, want)))
}

const HL = { syzygy: 0.7, current: 0.85, gate: 0.8 }
const isStem = (e: Ev): boolean => e.style.strokeStyle === '#22ee66' && e.style.globalAlpha === HL.current
const isLeg = (e: Ev): boolean => e.style.strokeStyle === '#22ee66' && Math.abs(e.style.globalAlpha - HL.current * 0.7) < 1e-12
const dashedGate = (e: Ev): boolean => e.style.strokeStyle === '#cc44ff' && e.style.lineDash.length > 0

/** The demons incident to a zone, as the app's zone focus builds them (every pair containing it). */
function incidentChords(fx: Fx, zone: number): Demon[] {
  return (fx.view.demons ?? []).filter(d => d.a === zone || d.b === zone)
}

describe('drawOverlay: the empty overlay', () => {
  it('clears to transparent, draws nothing, and reports zero edges and chords at full fidelity', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { dpr: 2 }), fx.index)
    expect(report).toEqual({ highlightedEdges: 0, fidelity: 'full', chords: 0 })
    const setT = rec.events.findIndex(e => e.type === 'setTransform')
    const clear = rec.events.findIndex(e => e.type === 'clearRect')
    expect(rec.events[setT]?.args).toEqual([2, 0, 0, 2, 0, 0])
    expect(rec.events[clear]?.args).toEqual([0, 0, fx.w, fx.h])
    expect(setT).toBeLessThan(clear)
    expect(strokesOf(rec.events)).toHaveLength(0)
    expect(fillsOf(rec.events)).toHaveLength(0)
    expect(ofType(rec.events, 'fillText')).toHaveLength(0)
  })

  it('hover costs only an overlay redraw: a handful of calls even at base 4000', () => {
    const fx = zoneFx(4000)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', hlZones: new Set([123]) }), fx.index)
    expect(report.fidelity).toBe('full')
    expect(rec.events.length).toBeLessThan(120)
    expect(rec.paths.reduce((n, p) => n + p.ops.length, 0)).toBeLessThan(400)
    expectAllFinite(rec)
  })

  it('context dimming is layer opacity, so anyFocus changes nothing the overlay draws', () => {
    const fx = zoneFx(28)
    const record = (anyFocus: boolean) => {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { anyFocus, hlZones: new Set([5]), selZones: new Set([5]) }), fx.index)
      return JSON.stringify(rec.events.map(e => [e.type, e.args, e.style]))
    }
    expect(record(true)).toBe(record(false))
  })

  it('ignores zones that are out of range or not integers', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { hlZones: new Set([-1, 28, 9999, 1.5, Number.NaN]), selZones: new Set([-3, 100]) }), fx.index)
    expect(report.highlightedEdges).toBe(0)
    expect(strokesOf(rec.events)).toHaveLength(0)
    expectAllFinite(rec)
  })
})

describe('drawOverlay: edges on demand (D-04)', () => {
  it('base 202, gate mode off, zone 5 hovered: its syzygy, its current, the currents into it and its own gate, though the gate layer draws nothing', () => {
    const fx = zoneFx(202)
    const layer = makeRecorder()
    drawGateLayer(layer.env, stateFor(fx, { gateMode: 'off' }), fx.index)
    expect(strokesOf(layer.events)).toHaveLength(0)

    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', hlZones: new Set([5]) }), fx.index)
    const q = fx.g.pairOf(5)
    const currents = new Set<number>([q])
    for (let w = 0; w < fx.g.pairCount; w++) if (fx.scene.currentTo[w] === 5) currents.add(w)
    for (const c of currents) {
      expect(drawnCurve(rec.events, fx, fx.scene.currentCurves, 18 * c + 12, isStem)).toBe(true)
      expect(drawnCurve(rec.events, fx, fx.scene.currentCurves, 18 * c, isLeg)).toBe(true)
      expect(drawnCurve(rec.events, fx, fx.scene.currentCurves, 18 * c + 6, isLeg)).toBe(true)
    }
    // exactly one dashed gate stroke, and it is zone 5's own gate (the gates into 5 stay with the layer, which is off)
    const gates = strokesOf(rec.events).filter(dashedGate)
    expect(gates).toHaveLength(1)
    expect(drawnCurve(rec.events, fx, fx.scene.gateCurves, 6 * 5, dashedGate)).toBe(true)
    expect(gates.reduce((n, e) => n + opsOf(e, 'quadraticCurveTo').length, 0)).toBe(1)
    // the syzygy of the pair of 5: dots on its scene segment
    const dots = fillsOf(rec.events).filter(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy)
    expect(dots).toHaveLength(1)
    const { lo, hi } = fx.g.pair(q)
    const k = fx.scene.nodeRadius / 21
    const dist = Math.hypot((fx.scene.x[hi] as number) - (fx.scene.x[lo] as number), (fx.scene.y[hi] as number) - (fx.scene.y[lo] as number))
    const numDots = Math.max(3, Math.min(10, Math.round(dist / (30 * k))))
    const arcs = opsOf(dots[0] as Ev, 'arc').map(o => nums(o.args))
    expect(arcs).toHaveLength(numDots)
    const seg = fx.scene.syzygySeg
    for (let i = 0; i < numDots; i++) {
      const t = (i + 1) / (numDots + 1)
      const at = screenOf(fx, (seg[4 * q] as number) + ((seg[4 * q + 2] as number) - (seg[4 * q] as number)) * t, (seg[4 * q + 1] as number) + ((seg[4 * q + 3] as number) - (seg[4 * q + 1] as number)) * t)
      expect((arcs[i] as number[])[0]).toBeCloseTo(at.x, 6)
      expect((arcs[i] as number[])[1]).toBeCloseTo(at.y, 6)
    }
    expect(report).toEqual({ highlightedEdges: 1 + currents.size + 1, fidelity: 'full', chords: 0 })
  })

  it('layers that are switched off draw nothing on demand either', () => {
    const fx = zoneFx(202)
    const only = (...layers: Layer[]) => {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(layers), hlZones: new Set([5]) }), fx.index)
      return rec
    }
    const noGates = only('syzygies', 'currents')
    expect(strokesOf(noGates.events).filter(e => e.style.strokeStyle === '#cc44ff')).toHaveLength(0)
    expect(strokesOf(noGates.events).filter(e => e.style.strokeStyle === '#22ee66').length).toBeGreaterThan(0)
    const noCurrents = only('syzygies', 'gates')
    expect(strokesOf(noCurrents.events).filter(e => e.style.strokeStyle === '#22ee66')).toHaveLength(0)
    expect(strokesOf(noCurrents.events).filter(dashedGate)).toHaveLength(1)
    const noSyzygies = only('currents', 'gates')
    expect(fillsOf(noSyzygies.events).filter(e => e.style.fillStyle === '#e8e8e8')).toHaveLength(0)
    const none = only()
    expect(strokesOf(none.events).filter(e => e.style.strokeStyle === '#22ee66' || e.style.strokeStyle === '#cc44ff')).toHaveLength(0)
    expect(fillsOf(none.events).filter(e => e.style.fillStyle === '#e8e8e8')).toHaveLength(0)
    // the report counts only what is drawn
    const rec = makeRecorder()
    expect(drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(), hlZones: new Set([5]) }), fx.index).highlightedEdges).toBe(0)
  })

  it('with the gate layer on, the gates that end in the hovered zone are drawn too', () => {
    const fx = zoneFx(28)
    // a zone that some other zone's gate ends in
    const zone = Array.from({ length: 28 }, (_, z) => z).find(z => Array.from({ length: 28 }, (_, w) => w).some(w => w !== z && fx.scene.gateTo[w] === z)) as number
    expect(zone).toBeDefined()
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { gateMode: 'on', hlZones: new Set([zone]) }), fx.index)
    const gates = new Set<number>([zone])
    for (let w = 0; w < 28; w++) if (fx.scene.gateTo[w] === zone) gates.add(w)
    expect(gates.size).toBeGreaterThan(1)
    const dashed = strokesOf(rec.events).filter(dashedGate)
    expect(dashed.reduce((n, e) => n + opsOf(e, 'quadraticCurveTo').length, 0)).toBe(gates.size)
    for (const w of gates) expect(drawnCurve(rec.events, fx, fx.scene.gateCurves, 6 * w, dashedGate)).toBe(true)
    const currents = new Set<number>([fx.g.pairOf(zone)])
    for (let w = 0; w < fx.g.pairCount; w++) if (fx.scene.currentTo[w] === zone) currents.add(w)
    expect(report.highlightedEdges).toBe(1 + currents.size + gates.size)
    // with the gate mode off the same zone draws only its own gate
    const off = makeRecorder()
    drawOverlay(off.env, overlayFor(fx, { gateMode: 'off', hlZones: new Set([zone]) }), fx.index)
    expect(strokesOf(off.events).filter(dashedGate).reduce((n, e) => n + opsOf(e, 'quadraticCurveTo').length, 0)).toBe(1)
  })

  it('a muted zone draws nothing; an isolate-dimmed zone still gets its edges at the highlighted alpha', () => {
    const fx = zoneFx(28)
    const muted = makeRecorder()
    const r1 = drawOverlay(muted.env, overlayFor(fx, { zoneStates: statesWith(28, { 5: ZONE_HIDDEN }), hlZones: new Set([5]) }), fx.index)
    expect(r1.highlightedEdges).toBe(0)
    expect(strokesOf(muted.events)).toHaveLength(0)
    expect(fillsOf(muted.events)).toHaveLength(0)

    const dimmed = makeRecorder()
    const r2 = drawOverlay(dimmed.env, overlayFor(fx, { zoneStates: statesWith(28, { 5: ZONE_DIMMED }), hlZones: new Set([5]) }), fx.index)
    expect(r2.highlightedEdges).toBeGreaterThan(0)
    expect(strokesOf(dimmed.events).some(isStem)).toBe(true)
  })

  it('an edge with a muted far end is not drawn', () => {
    const fx = zoneFx(28)
    const q = fx.g.pairOf(5)
    const dest = fx.scene.currentTo[q] as number
    const other = fx.g.partner(5)
    const victim = dest !== 5 && dest !== other ? dest : -1
    expect(victim).toBeGreaterThanOrEqual(0)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { zoneStates: statesWith(28, { [victim]: ZONE_HIDDEN }), hlZones: new Set([5]) }), fx.index)
    expect(drawnCurve(rec.events, fx, fx.scene.currentCurves, 18 * q + 12, isStem)).toBe(false)
  })

  it('while the Time Circuit is active gates are off and only Torque edges are drawn', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { tcActive: true, hlZones: new Set([5]) }), fx.index)
    expect(strokesOf(rec.events).filter(e => e.style.strokeStyle === '#cc44ff')).toHaveLength(0)
  })
})

describe('drawOverlay: nodes', () => {
  it('a selected zone gets the outer ring (R + 7 k, alpha 0.3) and the 1.6 ss s stroke; a hovered one only 1.2 ss s', () => {
    const fx = zoneFx(28)
    const zone = 7
    const t = fitZones(fx.scene.x, fx.scene.y, [zone], fx.frame, fx.w, fx.h)
    const s = scaleFor(fx, t)
    const ss = fx.scene.strokeScale
    const k = fx.scene.nodeRadius / 21
    const color = fx.view.zoneColors[zone] as string
    const radius = fx.scene.nodeRadius * s
    const ringsOf = (rec: Recorder) => strokesOf(rec.events).filter(e => e.style.strokeStyle === color)

    const sel = makeRecorder()
    drawOverlay(sel.env, overlayFor(fx, { transform: t, selZones: new Set([zone]), hlZones: new Set([zone]) }), fx.index)
    const ring = ringsOf(sel).find(e => e.style.globalAlpha === 1 && opsOf(e, 'arc').length > 0) as Ev
    expect(ring.style.lineWidth).toBeCloseTo(1.6 * ss * s, 9)
    expect(nums((opsOf(ring, 'arc')[0] as { args: unknown[] }).args)[2]).toBeCloseTo(radius, 9)
    const outer = ringsOf(sel).find(e => e.style.globalAlpha === 0.3) as Ev
    expect(nums((opsOf(outer, 'arc')[0] as { args: unknown[] }).args)[2]).toBeCloseTo(radius + 7 * k * s, 9)
    expect(outer.style.lineWidth).toBeCloseTo(Math.max(1, 0.5 * ss * s), 9)

    const hov = makeRecorder()
    drawOverlay(hov.env, overlayFor(fx, { transform: t, hlZones: new Set([zone]) }), fx.index)
    const ring2 = ringsOf(hov).find(e => e.style.globalAlpha === 1 && opsOf(e, 'arc').length > 0) as Ev
    expect(ring2.style.lineWidth).toBeCloseTo(1.2 * ss * s, 9)
    expect(ringsOf(hov).some(e => e.style.globalAlpha === 0.3)).toBe(false)
  })

  it('the selected ring never falls under the 1 px floor and the outer ring keeps a visible gap at tiny sizes', () => {
    const fx = zoneFx(4000)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(), selZones: new Set([10]) }), fx.index)
    const color = fx.view.zoneColors[10] as string
    const rings = strokesOf(rec.events).filter(e => e.style.strokeStyle === color)
    expect(rings.length).toBeGreaterThan(0)
    for (const e of rings) expect(e.style.lineWidth).toBeGreaterThanOrEqual(STROKE_MIN_PX)
    const ring = rings.find(e => e.style.globalAlpha === 1) as Ev
    const outer = rings.find(e => e.style.globalAlpha === 0.3) as Ev
    const r1 = nums((opsOf(ring, 'arc')[0] as { args: unknown[] }).args)[2] as number
    const r2 = nums((opsOf(outer, 'arc')[0] as { args: unknown[] }).args)[2] as number
    expect(r1).toBe(NODE_MIN_RADIUS_PX)
    expect(r2 - r1).toBeGreaterThanOrEqual(2)
  })

  it('at label level of detail a highlighted zone gets its label in the full colour, the triangle at 0.5 and the xenotation at 0.82', () => {
    const fx = zoneFx(28)
    const zone = 7
    const color = fx.view.zoneColors[zone] as string
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { hlZones: new Set([zone]), labelVisibility: { numbers: true, xenotation: true, planets: false } }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    const label = texts.find(e => e.args[0] === fx.labels[zone] && e.style.font.startsWith('bold')) as Ev
    expect(label.style.fillStyle).toBe(color)
    expect(label.style.globalAlpha).toBe(1)
    const xeno = texts.find(e => e.style.font.startsWith('italic') && e.style.fillStyle === color && e.style.globalAlpha === 0.82) as Ev
    expect(xeno).toBeDefined()
    const triangles = fillsOf(rec.events).filter(e => e.style.fillStyle === color && e.style.globalAlpha === 0.5 && opsOf(e, 'closePath').length > 0)
    expect(triangles).toHaveLength(1)
    // below the threshold nothing of that is painted
    const small = zoneFx(202)
    const rec2 = makeRecorder()
    drawOverlay(rec2.env, overlayFor(small, { layers: new Set<Layer>(), hlZones: new Set([7]) }), small.index)
    expect(ofType(rec2.events, 'fillText')).toHaveLength(0)
    expect(fillsOf(rec2.events)).toHaveLength(0)
  })

  it('an isolate-dimmed highlighted zone draws at alpha 0.2', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(), zoneStates: statesWith(28, { 7: ZONE_DIMMED }), hlZones: new Set([7]) }), fx.index)
    const color = fx.view.zoneColors[7] as string
    const ring = strokesOf(rec.events).find(e => e.style.strokeStyle === color) as Ev
    expect(ring.style.globalAlpha).toBeCloseTo(0.2, 12)
    const muted = makeRecorder()
    drawOverlay(muted.env, overlayFor(fx, { layers: new Set<Layer>(), zoneStates: statesWith(28, { 7: ZONE_HIDDEN }), selZones: new Set([7]) }), fx.index)
    expect(strokesOf(muted.events)).toHaveLength(0)
  })
})

describe('drawOverlay: demon focus chords', () => {
  it('a demon focus draws one chord in its kind colour, 1.2 ss s wide at alpha 0.75, and reports it', () => {
    const fx = zoneFx(28)
    const demon: Demon = { a: 12, b: 3, name: 'x', kind: 'chrono' }
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { focusChords: [demon] }), fx.index)
    expect(report.chords).toBe(1)
    const strokes = strokesOf(rec.events)
    expect(strokes).toHaveLength(1)
    const e = strokes[0] as Ev
    expect(e.style.strokeStyle).toBe(KIND_COLOR.chrono)
    expect(e.style.lineWidth).toBeCloseTo(Math.max(1, 1.2 * fx.scene.strokeScale * scaleFor(fx)), 9)
    expect(e.style.globalAlpha).toBe(0.75)
    // the chord runs between the two zone centres
    const [curve] = curvesOf(e) as [number[]]
    const a = screenOf(fx, fx.scene.x[12] as number, fx.scene.y[12] as number)
    const b = screenOf(fx, fx.scene.x[3] as number, fx.scene.y[3] as number)
    expect(curve[0]).toBeCloseTo(a.x, 6)
    expect(curve[1]).toBeCloseTo(a.y, 6)
    expect(curve[4]).toBeCloseTo(b.x, 6)
    expect(curve[5]).toBeCloseTo(b.y, 6)
  })

  it('each kind has its own colour, an isolate-dimmed end drops the alpha to 0.15, a muted end removes the chord', () => {
    const fx = zoneFx(28)
    const kinds = ['chrono', 'amphi', 'xeno', 'syzygy'] as const
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { focusChords: kinds.map((kind, i) => ({ a: 10 + i, b: 20 + i, name: kind, kind })) }), fx.index)
    expect(report.chords).toBe(4)
    expect(strokesOf(rec.events).map(e => e.style.strokeStyle).sort()).toEqual(kinds.map(kind => KIND_COLOR[kind]).sort())

    const demon: Demon = { a: 12, b: 3, name: 'x', kind: 'chrono' }
    const dim = makeRecorder()
    drawOverlay(dim.env, overlayFor(fx, { focusChords: [demon], zoneStates: statesWith(28, { 3: ZONE_DIMMED }) }), fx.index)
    expect(strokesOf(dim.events)[0]?.style.globalAlpha).toBe(0.15)

    const gone = makeRecorder()
    const r = drawOverlay(gone.env, overlayFor(fx, { focusChords: [demon], zoneStates: statesWith(28, { 3: ZONE_HIDDEN }) }), fx.index)
    expect(r.chords).toBe(0)
    expect(strokesOf(gone.events)).toHaveLength(0)
  })

  it('a zone focus draws base - 1 chords; none and an empty list draw none', () => {
    const fx = zoneFx(28)
    expect(fx.view.demons).not.toBeNull()
    const chords = incidentChords(fx, 3)
    expect(chords).toHaveLength(27)
    const rec = makeRecorder()
    expect(drawOverlay(rec.env, overlayFor(fx, { focusChords: chords }), fx.index).chords).toBe(27)
    expectAllFinite(rec)
    expect(drawOverlay(makeRecorder().env, overlayFor(fx, { focusChords: [] }), fx.index).chords).toBe(0)
    expect(drawOverlay(makeRecorder().env, overlayFor(fx, { focusChords: null }), fx.index).chords).toBe(0)
  })

  it('skips a chord with an out-of-range zone and never emits a NaN', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { focusChords: [{ a: -1, b: 3, name: 'bad', kind: 'xeno' }, { a: 3, b: 999, name: 'bad', kind: 'xeno' }, { a: 3, b: 4, name: 'ok', kind: 'xeno' }] }), fx.index)
    expect(report.chords).toBe(1)
    expectAllFinite(rec)
  })
})

describe('drawOverlay: the Time Circuit', () => {
  it('strokes every Torque walk segment in #00ccff at 1.5 ss s and alpha 0.6, statically', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { tcActive: true }), fx.index)
    const tc = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#00ccff')
    expect(tc).toHaveLength(1)
    const e = tc[0] as Ev
    expect(e.style.globalAlpha).toBe(0.6)
    expect(e.style.lineWidth).toBeCloseTo(Math.max(1, 1.5 * fx.scene.strokeScale * scaleFor(fx)), 9)
    const segments = fx.view.torqueWalks.reduce((n, walk) => n + walk.length - 1, 0)
    expect(opsOf(e, 'lineTo')).toHaveLength(segments)
    expect(opsOf(e, 'moveTo')).toHaveLength(segments)
    // a muted zone removes its segments
    const muted = makeRecorder()
    drawOverlay(muted.env, overlayFor(fx, { tcActive: true, zoneStates: statesWith(28, { 1: ZONE_HIDDEN }) }), fx.index)
    const left = strokesOf(muted.events).find(x => x.style.strokeStyle === '#00ccff') as Ev
    expect(opsOf(left, 'lineTo').length).toBeLessThan(segments)
    // and nothing is drawn without it
    const off = makeRecorder()
    drawOverlay(off.env, overlayFor(fx), fx.index)
    expect(strokesOf(off.events)).toHaveLength(0)
  })
})

describe('drawOverlay: the keyboard focus ring', () => {
  it('a zone ring is a #10ff50 circle of radius max(R_px + 3, 6), 2 px wide', () => {
    for (const base of [202, 4000]) {
      const fx = zoneFx(base)
      const ring: RingTarget = { kind: 'zone', zone: 9 }
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { ring }), fx.index)
      const e = strokesOf(rec.events).find(x => x.style.strokeStyle === '#10ff50') as Ev
      expect(e.style.lineWidth).toBe(2)
      expect(e.style.globalAlpha).toBe(1)
      const arc = nums((opsOf(e, 'arc')[0] as { args: unknown[] }).args)
      const rPx = fx.scene.nodeRadius * scaleFor(fx)
      expect(arc[2]).toBeCloseTo(Math.max(rPx + 3, 6), 9)
      const c = screenOf(fx, fx.scene.x[9] as number, fx.scene.y[9] as number)
      expect(arc[0]).toBeCloseTo(c.x, 9)
      expect(arc[1]).toBeCloseTo(c.y, 9)
    }
    // the 6 px floor binds at base 4000 (R_px well under 3)
    const tiny = zoneFx(4000)
    expect(tiny.scene.nodeRadius * scaleFor(tiny)).toBeLessThan(3)
  })

  it('an edge ring draws a #10ff50 underlay (edge width + 4 px, alpha 0.9) before the edge itself', () => {
    const fx = zoneFx(28)
    const t: CanvasTransform = IDENTITY_TRANSFORM
    const s = scaleFor(fx, t)
    const ss = fx.scene.strokeScale
    const cases: { ring: RingTarget; width: number; edge: (e: Ev) => boolean }[] = [
      { ring: { kind: 'current', zone: 9 }, width: Math.max(1, 1.8 * ss * s), edge: isStem },
      { ring: { kind: 'gate', zone: 9 }, width: Math.max(1, 1.2 * ss * s), edge: dashedGate },
    ]
    for (const c of cases) {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { ring: c.ring }), fx.index)
      const strokes = strokesOf(rec.events)
      const under = strokes.find(e => e.style.strokeStyle === '#10ff50') as Ev
      const edge = strokes.find(c.edge) as Ev
      expect(under).toBeDefined()
      expect(edge).toBeDefined()
      expect(under.style.lineWidth).toBeCloseTo(c.width + 4, 9)
      expect(under.style.globalAlpha).toBe(0.9)
      expect(under.i).toBeLessThan(edge.i)
      // the underlay follows the very edge it marks
      const curve = c.ring.kind === 'current' ? sceneCurve(fx, fx.scene.currentCurves, 18 * fx.g.pairOf(9) + 12) : sceneCurve(fx, fx.scene.gateCurves, 6 * 9)
      expect(curvesOf(under).some(x => sameCurve(x, curve))).toBe(true)
    }
    // the syzygy ring: the underlay comes before the dots
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { ring: { kind: 'syzygy', zone: 9 } }), fx.index)
    const under = strokesOf(rec.events).find(e => e.style.strokeStyle === '#10ff50') as Ev
    const dots = fillsOf(rec.events).find(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy) as Ev
    expect(under.i).toBeLessThan(dots.i)
    expect(under.style.globalAlpha).toBe(0.9)
  })

  it('draws nothing for a ring on a muted zone, a missing layer, or the wrong layout kind', () => {
    const fx = zoneFx(28)
    const none = (over: Partial<OverlayState>) => {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, over), fx.index)
      return strokesOf(rec.events).filter(e => e.style.strokeStyle === '#10ff50')
    }
    expect(none({ ring: { kind: 'zone', zone: 9 }, zoneStates: statesWith(28, { 9: ZONE_HIDDEN }) })).toHaveLength(0)
    expect(none({ ring: { kind: 'gate', zone: 9 }, layers: new Set<Layer>(['syzygies', 'currents']) })).toHaveLength(0)
    expect(none({ ring: { kind: 'pair', pair: 3 } })).toHaveLength(0)
    expect(none({ ring: { kind: 'zone', zone: 99 } })).toHaveLength(0)
    expect(none({ ring: null })).toHaveLength(0)
  })

  it('draws in order: Time Circuit, edges, node rings, chords, and the focus ring last', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawOverlay(
      rec.env,
      overlayFor(fx, {
        tcActive: true,
        hlZones: new Set([5]),
        focusChords: [{ a: 12, b: 3, name: 'x', kind: 'amphi' }],
        ring: { kind: 'zone', zone: 9 },
      }),
      fx.index,
    )
    const strokes = strokesOf(rec.events)
    const tc = strokes.find(e => e.style.strokeStyle === '#00ccff') as Ev
    const edge = strokes.find(isStem) as Ev
    const node = strokes.find(e => e.style.strokeStyle === (fx.view.zoneColors[5] as string) && opsOf(e, 'arc').length > 0 && e.style.strokeStyle !== '#00ccff') as Ev | undefined
    const chord = strokes.find(e => e.style.strokeStyle === KIND_COLOR.amphi) as Ev
    const ring = strokes.find(e => e.style.strokeStyle === '#10ff50') as Ev
    expect(tc.i).toBeLessThan(edge.i)
    if (node !== undefined) expect(edge.i).toBeLessThan(node.i)
    expect(edge.i).toBeLessThan(chord.i)
    expect(chord.i).toBeLessThan(ring.i)
    expect(strokes[strokes.length - 1]).toBe(ring)
  })

  it('a pair ring on the pair graph is a stadium outline with a 3 px gap, 2 px wide', () => {
    const fx = pairFx(28)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { ring: { kind: 'pair', pair: 4 } }), fx.index)
    const e = strokesOf(rec.events).find(x => x.style.strokeStyle === '#10ff50') as Ev
    expect(e.style.lineWidth).toBe(2)
    const s = scaleFor(fx)
    const arcs = opsOf(e, 'arc').map(o => nums(o.args))
    expect(arcs).toHaveLength(2)
    for (const a of arcs) expect(a[2]).toBeCloseTo((fx.scene.pillHeight * s) / 2 + 3, 9)
    expect(opsOf(e, 'closePath')).toHaveLength(1)
    // the zone ring is ignored on the pair graph
    const none = makeRecorder()
    drawOverlay(none.env, overlayFor(fx, { ring: { kind: 'zone', zone: 4 } }), fx.index)
    expect(strokesOf(none.events)).toHaveLength(0)
  })
})

describe('drawOverlay: full fidelity decorations', () => {
  it('a highlighted syzygy draws 3 to 10 graded dots, the radius growing toward the destination', () => {
    const fx = zoneFx(28)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(['syzygies']), hlZones: new Set([5]) }), fx.index)
    const dots = fillsOf(rec.events).find(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy) as Ev
    const radii = opsOf(dots, 'arc').map(o => nums(o.args)[2] as number)
    expect(radii.length).toBeGreaterThanOrEqual(3)
    expect(radii.length).toBeLessThanOrEqual(10)
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    radii.forEach((r, i) => expect(r).toBeCloseTo((1 + ((i + 1) / (radii.length + 1)) * 1.5) * k * s, 9))
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1] as number)
    // the glow substitute: the same dots, 1 px larger, at a quarter of the opacity, drawn first
    const under = fillsOf(rec.events).find(e => Math.abs(e.style.globalAlpha - 0.25 * HL.syzygy) < 1e-12) as Ev
    expect(under.i).toBeLessThan(dots.i)
    expect(opsOf(under, 'arc').map(o => nums(o.args)[2] as number)).toEqual(radii.map(r => r + 1))
  })

  it('a highlighted current draws legs, the white junction circle (5 k s) and the 9 x 7 arrowhead on the stem end', () => {
    const fx = zoneFx(28)
    const zone = 5
    const q = fx.g.pairOf(zone)
    const s = scaleFor(fx)
    const k = fx.scene.nodeRadius / 21
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(['currents']), hlZones: new Set([zone]) }), fx.index)
    const white = fillsOf(rec.events).filter(e => e.style.fillStyle === '#ffffff')
    expect(white).toHaveLength(1)
    const circles = opsOf(white[0] as Ev, 'arc').map(o => nums(o.args))
    const j = screenOf(fx, fx.scene.junctionX[q] as number, fx.scene.junctionY[q] as number)
    const mine = circles.find(a => Math.abs((a[0] as number) - j.x) < 1e-6 && Math.abs((a[1] as number) - j.y) < 1e-6) as number[]
    expect(mine[2]).toBeCloseTo(5 * k * s, 9)
    expect(white[0]?.style.globalAlpha).toBe(HL.current)
    // the arrowhead: 9 x 7 marker, scaled to the stem width, tip on the stem end
    const width = Math.max(1, 1.8 * fx.scene.strokeScale * s)
    const arrows = fillsOf(rec.events).filter(e => e.style.fillStyle === '#22ee66' && e.style.globalAlpha === HL.current && opsOf(e, 'closePath').length > 0)
    expect(arrows).toHaveLength(1)
    const end = screenOf(fx, fx.scene.currentCurves[18 * q + 16] as number, fx.scene.currentCurves[18 * q + 17] as number)
    const moves = opsOf(arrows[0] as Ev, 'moveTo').map(o => nums(o.args))
    const tipIndex = moves.findIndex(m => Math.abs((m[0] as number) - end.x) < 1e-6 && Math.abs((m[1] as number) - end.y) < 1e-6)
    expect(tipIndex).toBeGreaterThanOrEqual(0)
    const corners = opsOf(arrows[0] as Ev, 'lineTo').map(o => nums(o.args)).slice(2 * tipIndex, 2 * tipIndex + 2)
    const mid = [((corners[0] as number[])[0] as number + ((corners[1] as number[])[0] as number)) / 2, ((corners[0] as number[])[1] as number + ((corners[1] as number[])[1] as number)) / 2]
    const scale = Math.min(9 / 8, 7 / 6) * width
    expect(Math.hypot((moves[tipIndex] as number[])[0]! - mid[0]!, (moves[tipIndex] as number[])[1]! - mid[1]!)).toBeCloseTo(7 * scale, 6)
    // the glow substitute is the whole current, 2 px wider, at a quarter of the opacity, drawn before the stem
    const under = strokesOf(rec.events).find(e => Math.abs(e.style.globalAlpha - 0.25 * HL.current) < 1e-12) as Ev
    const into = new Set<number>([q])
    for (let w = 0; w < fx.g.pairCount; w++) if (fx.scene.currentTo[w] === zone) into.add(w)
    expect(under.style.lineWidth).toBeCloseTo(width + 2, 9)
    expect(under.i).toBeLessThan((strokesOf(rec.events).find(isStem) as Ev).i)
    expect(curvesOf(under)).toHaveLength(3 * into.size)
  })

  it('a highlighted gate draws the 8 x 6 arrowhead at its end, dashed 5 / 3 ss s for a single route and 3 / 2 for a loop', () => {
    const fx = zoneFx(28)
    const s = scaleFor(fx)
    const ss = fx.scene.strokeScale
    const single = [...Array(28).keys()].find(z => fx.scene.gateLoop[z] === 0) as number
    const loop = [...Array(28).keys()].find(z => fx.scene.gateLoop[z] === 1) as number
    for (const [zone, dash] of [
      [single, [5, 3]],
      [loop, [3, 2]],
    ] as const) {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(['gates']), hlZones: new Set([zone]) }), fx.index)
      const e = strokesOf(rec.events).find(dashedGate) as Ev
      expect(e.style.lineDash[0]).toBeCloseTo((dash[0] as number) * ss * s, 9)
      expect(e.style.lineDash[1]).toBeCloseTo((dash[1] as number) * ss * s, 9)
      expect(e.style.lineWidth).toBeCloseTo(Math.max(1, 1.2 * ss * s), 9)
      expect(e.style.globalAlpha).toBe(HL.gate)
      const arrows = fillsOf(rec.events).filter(x => x.style.fillStyle === '#cc44ff' && opsOf(x, 'closePath').length > 0)
      expect(arrows).toHaveLength(1)
      const width = Math.max(1, 1.2 * ss * s)
      const end = screenOf(fx, fx.scene.gateCurves[6 * zone + 4] as number, fx.scene.gateCurves[6 * zone + 5] as number)
      const tip = nums((opsOf(arrows[0] as Ev, 'moveTo')[0] as { args: unknown[] }).args)
      expect(tip[0]).toBeCloseTo(end.x, 6)
      expect(tip[1]).toBeCloseTo(end.y, 6)
      const corners = opsOf(arrows[0] as Ev, 'lineTo').map(o => nums(o.args))
      const mid = [((corners[0] as number[])[0]! + (corners[1] as number[])[0]!) / 2, ((corners[0] as number[])[1]! + (corners[1] as number[])[1]!) / 2]
      expect(Math.hypot(tip[0]! - mid[0]!, tip[1]! - mid[1]!)).toBeCloseTo(7 * Math.min(8 / 8, 6 / 6) * width, 6)
    }
  })

  it('edge text (current name and label, syzygy demon name, gate label) only at label level of detail', () => {
    const fx = zoneFx(28)
    const zone = 5
    const q = fx.g.pairOf(zone)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', hlZones: new Set([zone]) }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    const current = fx.index.currentByPair[q]
    expect(texts.some(e => e.args[0] === current?.name && e.style.font.startsWith('bold') && e.style.fillStyle === '#22ee66')).toBe(true)
    expect(texts.some(e => e.args[0] === current?.label && e.style.fillStyle === '#22ee66')).toBe(true)
    expect(texts.some(e => e.args[0] === fx.index.syzygyByPair[q]?.demon && e.style.font.startsWith('italic'))).toBe(true)
    expect(texts.some(e => e.args[0] === fx.labels[zone] && e.style.font.startsWith('italic') && e.style.fillStyle === '#cc44ff')).toBe(true)

    // base 202 at fit is under the threshold: no edge text at all
    const small = zoneFx(202)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, small.frame, small.w, small.h))).toBe(false)
    const rec2 = makeRecorder()
    drawOverlay(rec2.env, overlayFor(small, { gateMode: 'off', hlZones: new Set([5]) }), small.index)
    expect(ofType(rec2.events, 'fillText')).toHaveLength(0)
  })
})

describe('drawOverlay: geometry details', () => {
  it('a chord is the SVG tier route: curveAway from the layout centre with factor 0.25', () => {
    const fx = zoneFx(28)
    const a = 12
    const b = 3
    const route = curveAway(
      { x: fx.scene.x[a] as number, y: fx.scene.y[a] as number },
      { x: fx.scene.x[b] as number, y: fx.scene.y[b] as number },
      fx.scene.centerX,
      fx.scene.centerY,
      0.25,
    )
    const expected = new Float64Array(6)
    expect(parseRouteCurve(route, expected, 0)).toBe(true)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { focusChords: [{ a, b, name: 'x', kind: 'xeno' }] }), fx.index)
    const [curve] = curvesOf(strokesOf(rec.events)[0] as Ev) as [number[]]
    expect(sameCurve(curve, sceneCurve(fx, expected, 0))).toBe(true)
  })

  it('syzygy dots: the count is round(dist / 30 k), clamped to 3 .. 10', () => {
    const fx = zoneFx(28, 'ladder')
    const q = fx.g.pairOf(5)
    const { lo, hi } = fx.g.pair(q)
    const k = fx.scene.nodeRadius / 21
    const dotsFor = (f: Fx): number => {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(f, { layers: new Set<Layer>(['syzygies']), hlZones: new Set([5]) }), f.index)
      const dots = fillsOf(rec.events).find(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy) as Ev
      return opsOf(dots, 'arc').length
    }
    // the real ladder rung is 9.33 spacings long: 9 dots
    const dist = Math.hypot((fx.scene.x[hi] as number) - (fx.scene.x[lo] as number), (fx.scene.y[hi] as number) - (fx.scene.y[lo] as number))
    expect(dist / (30 * k)).toBeCloseTo(9.333, 2)
    expect(dotsFor(fx)).toBe(9)
    // synthetic partners at chosen distances (the dots follow the scene's segment, the count follows the centres)
    const apart = (spacings: number): Fx => {
      const x = Float64Array.from(fx.scene.x)
      const y = Float64Array.from(fx.scene.y)
      x[hi] = (x[lo] as number) + spacings * 30 * k
      y[hi] = y[lo] as number
      return { ...fx, scene: { ...fx.scene, x, y } }
    }
    expect(dotsFor(apart(5.4))).toBe(5)
    expect(dotsFor(apart(7.6))).toBe(8)
    expect(dotsFor(apart(14))).toBe(10)
    expect(dotsFor(apart(0))).toBe(3)
    expect(dotsFor(apart(1.2))).toBe(3)
  })

  it('at a tiny scale the dots keep a 0.75 px radius, and their glow substitute is 1 px larger', () => {
    const fx = zoneFx(4000)
    expect((fx.scene.nodeRadius / 21) * scaleFor(fx)).toBeLessThan(0.1)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(['syzygies']), hlZones: new Set([10]) }), fx.index)
    const dots = fillsOf(rec.events).find(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy) as Ev
    for (const o of opsOf(dots, 'arc')) expect(nums(o.args)[2]).toBe(0.75)
    const under = fillsOf(rec.events).find(e => Math.abs(e.style.globalAlpha - 0.25 * HL.syzygy) < 1e-12) as Ev
    for (const o of opsOf(under, 'arc')) expect(nums(o.args)[2]).toBe(1.75)
  })

  it('edge text sits where the SVG tier puts it: current name and label beside the junction, syzygy name off the midpoint, gate label on its meeting point', () => {
    const fx = zoneFx(28)
    const zone = 5
    const q = fx.g.pairOf(zone)
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', hlZones: new Set([zone]) }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    const at = (text: string, font: string): Ev => texts.find(e => e.args[0] === text && e.style.font.startsWith(font)) as Ev

    const dest = fx.scene.currentTo[q] as number
    const jx = fx.scene.junctionX[q] as number
    const jy = fx.scene.junctionY[q] as number
    const dx = (fx.scene.x[dest] as number) - jx
    const dy = (fx.scene.y[dest] as number) - jy
    const len = Math.hypot(dx, dy) || 1
    const tx = jx + (-dy / len) * 18 * k
    const ty = jy + (dx / len) * 18 * k
    const current = fx.index.currentByPair[q]
    const name = at(current?.name as string, 'bold')
    const nameAt = screenOf(fx, tx, ty - 3 * k)
    expect(nums(name.args.slice(1))[0]).toBeCloseTo(nameAt.x, 9)
    expect(nums(name.args.slice(1))[1]).toBeCloseTo(nameAt.y, 9)
    expect(fontPx(name.style.font)).toBeCloseTo(8 * k * s, 9)
    expect(name.style.textBaseline).toBe('alphabetic')
    const label = at(current?.label as string, '')
    const labelAt = screenOf(fx, tx, ty + 7 * k)
    expect(nums(label.args.slice(1))[1]).toBeCloseTo(labelAt.y, 9)
    expect(fontPx(label.style.font)).toBeCloseTo(6 * k * s, 9)
    expect(label.style.globalAlpha).toBeCloseTo(0.6, 12)

    const { lo, hi } = fx.g.pair(q)
    const sx = (fx.scene.x[hi] as number) - (fx.scene.x[lo] as number)
    const sy = (fx.scene.y[hi] as number) - (fx.scene.y[lo] as number)
    const dist = Math.hypot(sx, sy) || 1
    const mid = { x: ((fx.scene.x[lo] as number) + (fx.scene.x[hi] as number)) / 2, y: ((fx.scene.y[lo] as number) + (fx.scene.y[hi] as number)) / 2 }
    const demon = at(fx.index.syzygyByPair[q]?.demon as string, 'italic')
    const demonAt = screenOf(fx, mid.x + (-sy / dist) * 14 * k, mid.y + (sx / dist) * 14 * k)
    expect(nums(demon.args.slice(1))[0]).toBeCloseTo(demonAt.x, 9)
    expect(nums(demon.args.slice(1))[1]).toBeCloseTo(demonAt.y, 9)
    expect(fontPx(demon.style.font)).toBeCloseTo(7 * k * s, 9)

    const gate = texts.find(e => e.args[0] === fx.labels[zone] && e.style.fillStyle === '#cc44ff') as Ev
    const gateAt = screenOf(fx, fx.scene.gateLabelX[zone] as number, fx.scene.gateLabelY[zone] as number)
    expect(nums(gate.args.slice(1))[0]).toBeCloseTo(gateAt.x, 9)
    expect(nums(gate.args.slice(1))[1]).toBeCloseTo(gateAt.y, 9)
    expect(fontPx(gate.style.font)).toBeCloseTo(7 * k * s, 9)
    // its background disc: #060609, radius 9 k s, on the same point
    const bg = fillsOf(rec.events).find(e => e.style.fillStyle === '#060609') as Ev
    const disc = nums((opsOf(bg, 'arc')[0] as { args: unknown[] }).args)
    expect(disc[0]).toBeCloseTo(gateAt.x, 9)
    expect(disc[1]).toBeCloseTo(gateAt.y, 9)
    expect(disc[2]).toBeCloseTo(9 * k * s, 9)
  })

  it('the ladder has no gate meeting label (as in the SVG tier), but the other edge text stays', () => {
    const fx = zoneFx(28, 'ladder')
    const t = fitZones(fx.scene.x, fx.scene.y, [5], fx.frame, fx.w, fx.h)
    expect(labelsShown(onScreenRadius(t, fx.frame, fx.w, fx.h))).toBe(true)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { transform: t, gateMode: 'off', hlZones: new Set([5]) }), fx.index)
    const texts = ofType(rec.events, 'fillText')
    expect(texts.some(e => e.style.fillStyle === '#cc44ff')).toBe(false)
    expect(fillsOf(rec.events).some(e => e.style.fillStyle === '#060609')).toBe(false)
    expect(texts.some(e => e.style.fillStyle === '#22ee66')).toBe(true)
  })

  it('a loop gate label also gets its outer ring (12 k s)', () => {
    const fx = zoneFx(28)
    const loop = Array.from({ length: 28 }, (_, z) => z).find(z => fx.scene.gateLoop[z] === 1) as number
    const k = fx.scene.nodeRadius / 21
    const s = scaleFor(fx)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(['gates']), hlZones: new Set([loop]) }), fx.index)
    const ring = strokesOf(rec.events).find(e => e.style.strokeStyle === '#cc44ff66') as Ev
    expect(ring).toBeDefined()
    expect(nums((opsOf(ring, 'arc')[0] as { args: unknown[] }).args)[2]).toBeCloseTo(12 * k * s, 9)
    expect(ring.style.globalAlpha).toBeCloseTo(0.8, 12)
    const rim = strokesOf(rec.events).find(e => e.style.strokeStyle === '#cc44ff33') as Ev
    expect(rim.style.lineWidth).toBeCloseTo(Math.max(1, 0.5 * fx.scene.strokeScale * s), 9)
  })
})

describe('drawOverlay: widths without the floor, and muted or Time Circuit edges', () => {
  it('zoomed in the chord is 1.2 ss s, the highlighted gate 1.2 ss s and the gate label rim 0.5 ss s wide', () => {
    const fx = zoneFx(28)
    const ss = fx.scene.strokeScale
    const a = 12
    const b = 3
    const mx = ((fx.scene.x[a] as number) + (fx.scene.x[b] as number)) / 2
    const my = ((fx.scene.y[a] as number) + (fx.scene.y[b] as number)) / 2
    const t = centerOn(fx, mx, my, 3)
    const s = scaleFor(fx, t)
    expect(1.2 * ss * s).toBeGreaterThan(1)
    const chord = makeRecorder()
    drawOverlay(chord.env, overlayFor(fx, { transform: t, focusChords: [{ a, b, name: 'x', kind: 'xeno' }] }), fx.index)
    expect((strokesOf(chord.events)[0] as Ev).style.lineWidth).toBeCloseTo(1.2 * ss * s, 9)

    const loop = Array.from({ length: 28 }, (_, z) => z).find(z => fx.scene.gateLoop[z] === 1) as number
    const tg = centerOn(fx, fx.scene.gateLabelX[loop] as number, fx.scene.gateLabelY[loop] as number, 3)
    const sg = scaleFor(fx, tg)
    const gate = makeRecorder()
    drawOverlay(gate.env, overlayFor(fx, { transform: tg, gateMode: 'off', layers: new Set<Layer>(['gates']), hlZones: new Set([loop]) }), fx.index)
    const dashed = strokesOf(gate.events).find(dashedGate) as Ev
    expect(dashed.style.lineWidth).toBeCloseTo(1.2 * ss * sg, 9)
    const rim = strokesOf(gate.events).find(e => e.style.strokeStyle === '#cc44ff33') as Ev
    expect(rim.style.lineWidth).toBeCloseTo(0.5 * ss * sg, 9)
    const label = ofType(gate.events, 'fillText').find(e => e.style.fillStyle === '#cc44ff') as Ev
    expect(label.style.globalAlpha).toBeCloseTo(0.92, 12)
  })

  it('a pair with a muted partner draws no syzygy, and a gate whose destination is muted draws no gate', () => {
    const fx = zoneFx(28)
    const zone = 5
    const partner = fx.g.partner(zone)
    const syz = makeRecorder()
    drawOverlay(syz.env, overlayFor(fx, { layers: new Set<Layer>(['syzygies']), zoneStates: statesWith(28, { [partner]: ZONE_HIDDEN }), hlZones: new Set([zone]) }), fx.index)
    expect(fillsOf(syz.events).filter(e => e.style.fillStyle === '#e8e8e8')).toHaveLength(0)
    expect(drawOverlay(makeRecorder().env, overlayFor(fx, { layers: new Set<Layer>(['syzygies']), zoneStates: statesWith(28, { [partner]: ZONE_HIDDEN }), hlZones: new Set([zone]) }), fx.index).highlightedEdges).toBe(0)

    const dest = fx.scene.gateTo[zone] as number
    expect(dest).not.toBe(zone)
    const gate = makeRecorder()
    const report = drawOverlay(gate.env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(['gates']), zoneStates: statesWith(28, { [dest]: ZONE_HIDDEN }), hlZones: new Set([zone]) }), fx.index)
    expect(strokesOf(gate.events).filter(dashedGate)).toHaveLength(0)
    expect(report.highlightedEdges).toBe(0)
  })

  it('while the Time Circuit is active a pair outside the Torque cycles draws neither syzygy nor current', () => {
    const fx = zoneFx(28)
    const outside = Array.from({ length: 28 }, (_, z) => z).find(z => fx.index.torqueSyzygy[fx.g.pairOf(z)] === 0) as number
    const inside = Array.from({ length: 28 }, (_, z) => z).find(z => fx.index.torqueSyzygy[fx.g.pairOf(z)] === 1) as number
    expect(outside).toBeDefined()
    expect(fx.index.torqueCurrent[fx.g.pairOf(outside)]).toBe(0)
    const none = makeRecorder()
    const r0 = drawOverlay(none.env, overlayFor(fx, { tcActive: true, hlZones: new Set([outside]) }), fx.index)
    const q = fx.g.pairOf(outside)
    // only currents flowing into the zone can still belong to the Torque cycles
    let into = 0
    for (let w = 0; w < fx.g.pairCount; w++) if (fx.scene.currentTo[w] === outside && fx.index.torqueCurrent[w] === 1) into++
    expect(r0.highlightedEdges).toBe(into)
    expect(fillsOf(none.events).filter(e => e.style.fillStyle === '#e8e8e8')).toHaveLength(0)
    expect(drawnCurve(none.events, fx, fx.scene.currentCurves, 18 * q + 12, isStem)).toBe(false)
    const some = makeRecorder()
    const r1 = drawOverlay(some.env, overlayFor(fx, { tcActive: true, hlZones: new Set([inside]) }), fx.index)
    expect(r1.highlightedEdges).toBeGreaterThanOrEqual(2)
    expect(fillsOf(some.events).filter(e => e.style.fillStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy)).toHaveLength(1)
  })

  it('an isolate-dimmed edge keeps its dots but gets no demon name', () => {
    const fx = zoneFx(28)
    const zone = 5
    const names = (zoneStates: Uint8Array | null): string[] => {
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { layers: new Set<Layer>(['syzygies']), zoneStates, hlZones: new Set([zone]) }), fx.index)
      return ofType(rec.events, 'fillText')
        .filter(e => e.style.font.startsWith('italic'))
        .map(e => String(e.args[0]))
    }
    const demon = fx.index.syzygyByPair[fx.g.pairOf(zone)]?.demon as string
    expect(names(null)).toContain(demon)
    expect(names(statesWith(28, { [fx.g.partner(zone)]: ZONE_DIMMED }))).not.toContain(demon)
  })
})

describe('drawOverlay: the fidelity switch (T-06-10)', () => {
  const everyZone = (n: number): Set<number> => new Set(Array.from({ length: n }, (_, z) => z))

  it('reports the highlighted edge count and fidelity full up to HIGHLIGHT_FULL_FIDELITY_MAX, plain above', () => {
    const fx = zoneFx(4000)
    const only = (count: number): OverlayReport =>
      drawOverlay(makeRecorder().env, overlayFor(fx, { gateMode: 'off', layers: new Set<Layer>(['gates']), hlZones: new Set(Array.from({ length: count }, (_, z) => z)) }), fx.index)
    // with only the gates layer on and the gate mode off, every zone adds exactly its own gate
    expect(only(HIGHLIGHT_FULL_FIDELITY_MAX)).toEqual({ highlightedEdges: HIGHLIGHT_FULL_FIDELITY_MAX, fidelity: 'full', chords: 0 })
    expect(only(HIGHLIGHT_FULL_FIDELITY_MAX + 1)).toEqual({ highlightedEdges: HIGHLIGHT_FULL_FIDELITY_MAX + 1, fidelity: 'plain', chords: 0 })
  })

  it('base 4000 select-all: plain, every edge counted, a bounded number of stroke calls, no arrowhead, junction or text', () => {
    const fx = zoneFx(4000)
    const all = everyZone(4000)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { gateMode: 'off', hlZones: all, selZones: all }), fx.index)
    expect(report.fidelity).toBe('plain')
    // 2000 syzygies + 2000 currents + 4000 own gates
    expect(report.highlightedEdges).toBe(2 * fx.g.pairCount + 4000)
    expect(strokesOf(rec.events).length).toBeLessThanOrEqual(16)
    expect(strokesOf(rec.events).length).toBeGreaterThan(0)
    expect(fillsOf(rec.events).filter(e => opsOf(e, 'closePath').length > 0)).toHaveLength(0) // no arrowheads
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#ffffff')).toHaveLength(0) // no junction discs
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#e8e8e8')).toHaveLength(0) // no graded dots
    expect(ofType(rec.events, 'fillText')).toHaveLength(0)
    // the plain strokes use the highlighted alphas per kind
    const alphasOf = (color: string): number[] => [...new Set(strokesOf(rec.events).filter(e => e.style.strokeStyle === color).map(e => e.style.globalAlpha))]
    expect(alphasOf('#22ee66')).toEqual([HL.current])
    expect(alphasOf('#cc44ff')).toEqual([HL.gate])
    // no glow substitute in plain fidelity: the outer-ring underlay (alpha 0.25 x 0.3) is absent
    expect(strokesOf(rec.events).some(e => Math.abs(e.style.globalAlpha - 0.25 * 0.3) < 1e-12)).toBe(false)
    // the plain syzygy stays a dotted round-cap line, 2 px wide
    const syz = strokesOf(rec.events).find(e => e.style.strokeStyle === '#e8e8e8' && e.style.globalAlpha === HL.syzygy) as Ev
    expect(syz.style.lineWidth).toBe(2)
    expect(syz.style.lineCap).toBe('round')
    expect(syz.style.lineDash[0]).toBeCloseTo(0.1, 12)
    expect(syz.style.lineDash[1]).toBeCloseTo(3 * (fx.scene.nodeRadius / 21) * scaleFor(fx), 9)
    // the plain gates stay dashed 5 / 3 and 3 / 2
    const ss = fx.scene.strokeScale
    const s = scaleFor(fx)
    const dashes = strokesOf(rec.events)
      .filter(e => e.style.strokeStyle === '#cc44ff')
      .map(e => e.style.lineDash.map(v => Math.round((v / (ss * s)) * 1e6) / 1e6))
    expect(dashes).toContainEqual([5, 3])
    expect(dashes).toContainEqual([3, 2])
    expectAllFinite(rec)
  })

  it('plain mode never draws edge text, even where the zoom reaches label level of detail', () => {
    const fx = zoneFx(202)
    const t: CanvasTransform = { zoom: 3, tx: 0, ty: 0 }
    expect(labelsShown(onScreenRadius(t, fx.frame, fx.w, fx.h))).toBe(true)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { transform: t, gateMode: 'off', hlZones: everyZone(202) }), fx.index)
    expect(report.fidelity).toBe('plain')
    for (const e of ofType(rec.events, 'fillText')) expect(e.style.font.startsWith('bold')).toBe(true) // only node labels
  })

  it('the same select-all in full fidelity (few edges) draws the decorations', () => {
    const fx = zoneFx(28)
    const all = everyZone(28)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { hlZones: all, selZones: all }), fx.index)
    expect(report.fidelity).toBe('full')
    expect(report.highlightedEdges).toBeLessThanOrEqual(HIGHLIGHT_FULL_FIDELITY_MAX)
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#ffffff').length).toBeGreaterThan(0)
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#22ee66' && opsOf(e, 'closePath').length > 0).length).toBeGreaterThan(0)
    // and the selected rings have their glow substitute (alpha 0.25 x 0.3)
    expect(strokesOf(rec.events).some(e => Math.abs(e.style.globalAlpha - 0.25 * 0.3) < 1e-12)).toBe(true)
  })
})

describe('drawOverlay: pair graph', () => {
  const pairOf3 = (fx: Fx): { q: number; strings: string[] } => {
    const q = fx.g.pairOf(3)
    const strings = [fx.scene.pairArc?.[q] ?? null, fx.scene.pairLoop?.[q] ?? null].filter((d): d is string => d !== null)
    return { q, strings }
  }

  it('hovering a pair member raises its arc to alpha 0.85 and the pill stroke to alpha 1', () => {
    const fx = pairFx(28)
    const { q, strings } = pairOf3(fx)
    expect(strings).toHaveLength(1)
    const t = fitZones(fx.scene.x, fx.scene.y, [3], fx.frame, fx.w, fx.h)
    const s = scaleFor(fx, t)
    const ss = fx.scene.strokeScale
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { transform: t, hlZones: new Set([3]) }), fx.index)
    expect(report).toEqual({ highlightedEdges: 1, fidelity: 'full', chords: 0 })
    expect(rec.svgCalls).toEqual(strings)
    const arcs = strokesOf(rec.events).filter(e => e.style.strokeStyle === '#22ee66' && e.style.globalAlpha === 0.85)
    expect(arcs).toHaveLength(1)
    expect(arcs[0]?.style.lineWidth).toBeCloseTo(Math.max(1, 1.4 * ss * s), 9)
    const color = fx.view.zoneColors[q] as string
    const pill = strokesOf(rec.events).find(e => e.style.strokeStyle === color) as Ev
    expect(pill.style.globalAlpha).toBe(1)
    expect(pill.style.lineWidth).toBeCloseTo(Math.max(1, 0.9 * ss * s), 9)
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === color && e.style.globalAlpha === 0.3)).toHaveLength(0)
    // the arrowhead of the full fidelity arc
    expect(fillsOf(rec.events).filter(e => e.style.fillStyle === '#22ee66' && opsOf(e, 'closePath').length > 0).length).toBeGreaterThan(0)
  })

  it('a selected pair (both members) gets the fill at alpha 0.3 and the 1.6 ss s stroke', () => {
    const fx = pairFx(28)
    const { q } = pairOf3(fx)
    const { lo, hi } = fx.g.pair(q)
    const t = fitZones(fx.scene.x, fx.scene.y, [3], fx.frame, fx.w, fx.h)
    const s = scaleFor(fx, t)
    const rec = makeRecorder()
    drawOverlay(rec.env, overlayFor(fx, { transform: t, hlZones: new Set([lo, hi]), selZones: new Set([lo, hi]) }), fx.index)
    const color = fx.view.zoneColors[q] as string
    const fill = fillsOf(rec.events).find(e => e.style.fillStyle === color && e.style.globalAlpha === 0.3) as Ev
    expect(fill).toBeDefined()
    expect(opsOf(fill, 'closePath')).toHaveLength(1)
    const pill = strokesOf(rec.events).find(e => e.style.strokeStyle === color) as Ev
    expect(pill.style.lineWidth).toBeCloseTo(Math.max(1, 1.6 * fx.scene.strokeScale * s), 9)
    expect(pill.style.globalAlpha).toBe(1)
    // only one member selected: not a selected pair
    const half = makeRecorder()
    drawOverlay(half.env, overlayFor(fx, { transform: t, hlZones: new Set([lo]), selZones: new Set([lo]) }), fx.index)
    expect(fillsOf(half.events).filter(e => e.style.fillStyle === color && e.style.globalAlpha === 0.3)).toHaveLength(0)
  })

  it('a muted pair draws nothing; focus chords are not drawn on the pair graph', () => {
    const fx = pairFx(28)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { zoneStates: statesWith(28, { 3: ZONE_HIDDEN }), hlZones: new Set([3]) }), fx.index)
    expect(report.highlightedEdges).toBe(0)
    expect(strokesOf(rec.events)).toHaveLength(0)
    const chords = makeRecorder()
    expect(drawOverlay(chords.env, overlayFor(fx, { focusChords: [{ a: 1, b: 2, name: 'x', kind: 'chrono' }] }), fx.index).chords).toBe(0)
    expect(strokesOf(chords.events)).toHaveLength(0)
  })

  it('the pair graph switches fidelity at exactly HIGHLIGHT_FULL_FIDELITY_MAX highlighted arcs and loops', () => {
    const fx = pairFx(4000)
    const strings = (q: number): number => ((fx.scene.pairArc?.[q] ?? null) !== null ? 1 : 0) + ((fx.scene.pairLoop?.[q] ?? null) !== null ? 1 : 0)
    const zones: number[] = []
    let total = 0
    for (let q = 0; total < HIGHLIGHT_FULL_FIDELITY_MAX; q++) {
      zones.push(q) // the pair id is its lower member
      total += strings(q)
    }
    expect(total).toBe(HIGHLIGHT_FULL_FIDELITY_MAX)
    const at = (list: number[]): OverlayReport => drawOverlay(makeRecorder().env, overlayFor(fx, { hlZones: new Set(list) }), fx.index)
    expect(at(zones)).toEqual({ highlightedEdges: HIGHLIGHT_FULL_FIDELITY_MAX, fidelity: 'full', chords: 0 })
    let next = zones.length
    while (strings(next) === 0) next++
    const over = at([...zones, next])
    expect(over.highlightedEdges).toBeGreaterThan(HIGHLIGHT_FULL_FIDELITY_MAX)
    expect(over.fidelity).toBe('plain')
  })

  it('select-all at base 4000 on the pair graph is plain with a bounded number of strokes', () => {
    const fx = pairFx(4000)
    const all = everyZoneSet(4000)
    const rec = makeRecorder()
    const report = drawOverlay(rec.env, overlayFor(fx, { hlZones: all, selZones: all }), fx.index)
    expect(report.fidelity).toBe('plain')
    expect(report.highlightedEdges).toBe((fx.scene.pairArc ?? []).filter(d => d !== null).length + (fx.scene.pairLoop ?? []).filter(d => d !== null).length)
    expect(strokesOf(rec.events).length).toBeLessThanOrEqual(16)
    expect(rec.svgCalls).toHaveLength(report.highlightedEdges)
    expectAllFinite(rec)
  })
})

function everyZoneSet(n: number): Set<number> {
  return new Set(Array.from({ length: n }, (_, z) => z))
}

describe('NaN scan over the overlay', () => {
  const cases: [string, () => Fx][] = [
    ['ring 2', () => zoneFx(2)],
    ['ring 4', () => zoneFx(4)],
    ['ring 6', () => zoneFx(6)],
    ['ring 28', () => zoneFx(28)],
    ['ring 202', () => zoneFx(202)],
    ['ring 4000', () => zoneFx(4000)],
    ['ladder 28', () => zoneFx(28, 'ladder')],
    ['spiral 28', () => zoneFx(28, 'spiral')],
    ['pairGraph 28', () => pairFx(28)],
    ['pairGraph 202', () => pairFx(202)],
  ]
  for (const [name, make] of cases) {
    it(`${name}: every recorded number is finite with highlights, selection, chords, Time Circuit and a ring`, () => {
      const fx = make()
      const n = fx.g.base
      const zones = [0, 1, Math.min(2, n - 1), n - 1]
      const zoomed = fitZones(fx.scene.x, fx.scene.y, [0, 1], fx.frame, fx.w, fx.h)
      const rings: (RingTarget | null)[] =
        fx.scene.kind === 'pairs'
          ? [{ kind: 'pair', pair: 0 }]
          : [{ kind: 'zone', zone: 1 }, { kind: 'syzygy', zone: 1 }, { kind: 'current', zone: 1 }, { kind: 'gate', zone: 1 }]
      for (const transform of [IDENTITY_TRANSFORM, zoomed]) {
        for (const ring of rings) {
          const rec = makeRecorder()
          drawOverlay(
            rec.env,
            overlayFor(fx, {
              transform,
              dpr: 2,
              hlZones: new Set(zones),
              selZones: new Set([0, 1]),
              tcActive: name.startsWith('ring') && n > 2,
              focusChords: [{ a: 0, b: n - 1, name: 'x', kind: 'amphi' }, { a: 1, b: 0, name: 'y', kind: 'syzygy' }],
              ring,
              labelVisibility: { numbers: true, xenotation: true, planets: false },
            }),
            fx.index,
          )
          expectAllFinite(rec)
        }
      }
    })
  }

  it('select-all at base 4000 (plain) and base 28 (full) with isolate and mute states', () => {
    for (const base of [28, 4000]) {
      const fx = zoneFx(base)
      const states = new Uint8Array(base).fill(ZONE_NORMAL)
      states[1] = ZONE_DIMMED
      states[2] = ZONE_HIDDEN
      const rec = makeRecorder()
      drawOverlay(rec.env, overlayFor(fx, { zoneStates: states, hlZones: everyZoneSet(base), selZones: everyZoneSet(base) }), fx.index)
      expectAllFinite(rec)
    }
  })
})

// ── Sounds label mode (Phase 7 plan 07-14): both zone-label passes paint the one shared fit ─────────────────────────────

describe('sounds label mode: zoneSounds on the Canvas tier', () => {
  const LONG = 'abcdefghijklmnop' // 16 letters: cut at the 6 px floor
  const MID = 'tomari' // 6 letters: shrinks to fit
  const SHORT = 'ka' // fits at the layout's own label size
  /** One sound per zone: zone 12 the long one, zones 5 and 7 the mid one, every other zone the short one. */
  const soundsFor = (n: number): readonly string[] =>
    Array.from({ length: n }, (_, z) => (z === 12 ? LONG : z === 5 || z === 7 ? MID : SHORT))
  const near = (a: unknown, b: number): boolean => Math.abs(Number(a) - b) < 1e-9

  /** The label fillText at a zone's centre (one world unit below it, the digits label's own spot). */
  function labelAt(events: readonly Ev[], fx: Fx, z: number, t: CanvasTransform = IDENTITY_TRANSFORM): Ev | undefined {
    const p = screenOf(fx, fx.scene.x[z] as number, (fx.scene.y[z] as number) + 1, t)
    return ofType(events, 'fillText').find(e => near(e.args[1], p.x) && near(e.args[2], p.y))
  }

  /** Every text call with the style it was made under, for whole-list equality between two recordings. */
  const textCalls = (events: readonly Ev[]) =>
    ofType(events, 'fillText').map(e => ({
      args: e.args,
      font: e.style.font,
      fill: e.style.fillStyle,
      alpha: e.style.globalAlpha,
      align: e.style.textAlign,
      base: e.style.textBaseline,
    }))

  const fitFor = (fx: Fx, sound: string, t: CanvasTransform = IDENTITY_TRANSFORM): ReturnType<typeof fitSoundLabel> =>
    fitSoundLabel(sound, onScreenRadius(t, fx.frame, fx.w, fx.h), fx.scene.labelSize * scaleFor(fx, t))

  it('the static pass paints, per visible zone, the fitted sound in the fitted font, at the digits label spot', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(true)
    const full = fx.scene.labelSize * scaleFor(fx)
    const fits = sounds.map(s => fitFor(fx, s))
    // all three outcomes of the fit occur, so the per-label font is genuinely exercised
    expect(fits[12]?.truncated).toBe(true)
    expect(fits[5]?.truncated).toBe(false)
    expect(fits[5]?.fontPx).toBeLessThan(full)
    expect(fits[0]?.fontPx).toBe(full)

    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneSounds: sounds }), fx.index)
    expect(ofType(rec.events, 'fillText')).toHaveLength(28)
    for (let z = 0; z < 28; z++) {
      const e = labelAt(rec.events, fx, z) as Ev
      expect(e, `zone ${z}`).toBeDefined()
      expect(e.args[0]).toBe((fits[z] as { text: string }).text)
      expect(e.style.font).toBe(`bold ${(fits[z] as { fontPx: number }).fontPx}px monospace`)
      expect(e.style.textAlign).toBe('center')
      expect(e.style.fillStyle).toBe(`${fx.view.zoneColors[z]}aa`)
    }
    // none of the digits labels is painted any more
    expect(ofType(rec.events, 'fillText').some(e => fx.labels.includes(e.args[0] as string) && !sounds.includes(e.args[0] as string))).toBe(false)
  })

  it('the highlight overlay paints the same text and the same font string as the static pass for the same zone (no ghosting)', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28)
    const hl = [0, 5, 12]
    const cases: [string, CanvasTransform, number[]][] = [
      ['at fit', IDENTITY_TRANSFORM, hl],
      ['zoomed to the long sound', centerOn(fx, fx.scene.x[12] as number, fx.scene.y[12] as number, 2), [12]],
    ]
    for (const [name, t, zones] of cases) {
      const st = rec2(fx, t, sounds, new Set(zones))
      for (const z of zones) {
        const a = labelAt(st.statics.events, fx, z, t) as Ev
        const b = labelAt(st.overlay.events, fx, z, t) as Ev
        expect(a, `${name}: static ${z}`).toBeDefined()
        expect(b, `${name}: overlay ${z}`).toBeDefined()
        expect(b.args[0], `${name}: text of zone ${z}`).toBe(a.args[0])
        expect(b.style.font, `${name}: font of zone ${z}`).toBe(a.style.font)
        expect(a.args[0]).toBe(fitFor(fx, sounds[z] as string, t).text)
        // the overlay label is in the full zone colour, the static one in the aa suffix colour
        expect(b.style.fillStyle).toBe(fx.view.zoneColors[z])
      }
      expect(ofType(st.overlay.events, 'fillText')).toHaveLength(zones.length)
    }
    // the long sound really is cut at fit and shows more of itself zoomed in: the two cases differ
    expect(fitFor(fx, LONG).text).not.toBe(fitFor(fx, LONG, centerOn(fx, fx.scene.x[12] as number, fx.scene.y[12] as number, 2)).text)

    function rec2(f: Fx, t: CanvasTransform, soundTable: readonly string[], hlSet: ReadonlySet<number>) {
      const statics = makeRecorder()
      drawNodeLayer(statics.env, stateFor(f, { ...bare(f), transform: t, zoneSounds: soundTable }), f.index)
      const overlay = makeRecorder()
      drawOverlay(
        overlay.env,
        overlayFor(f, { transform: t, layers: new Set<Layer>(), hlZones: hlSet, zoneSounds: soundTable }),
        f.index,
      )
      return { statics, overlay }
    }
  })

  it('an isolate-dimmed zone paints its sound at alpha 0.2 and a muted zone paints none, in both passes', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28)
    const zoneStates = statesWith(28, { 1: ZONE_DIMMED, 2: ZONE_HIDDEN })
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneStates, zoneSounds: sounds }), fx.index)
    expect((labelAt(rec.events, fx, 1) as Ev).style.globalAlpha).toBeCloseTo(0.2, 12)
    expect(labelAt(rec.events, fx, 2)).toBeUndefined()
    expect((labelAt(rec.events, fx, 3) as Ev).style.globalAlpha).toBe(1)

    const ov = makeRecorder()
    drawOverlay(ov.env, overlayFor(fx, { layers: new Set<Layer>(), zoneStates, hlZones: new Set([1, 2, 3]), zoneSounds: sounds }), fx.index)
    expect((labelAt(ov.events, fx, 1) as Ev).style.globalAlpha).toBeCloseTo(0.2, 12)
    expect(labelAt(ov.events, fx, 2)).toBeUndefined()
    expect(ofType(ov.events, 'fillText')).toHaveLength(2)
  })

  it('without zoneSounds (undefined or null) every text call is what the digits path made before, in both passes', () => {
    const fx = zoneFx(28)
    const plain = makeRecorder()
    drawNodeLayer(plain.env, stateFor(fx, { labelVisibility: { numbers: true, xenotation: true, planets: false } }), fx.index)
    const plainOv = makeRecorder()
    drawOverlay(plainOv.env, overlayFor(fx, { hlZones: new Set([5, 12]), labelVisibility: { numbers: true, xenotation: true, planets: false } }), fx.index)
    for (const zoneSounds of [undefined, null] as const) {
      const rec = makeRecorder()
      drawNodeLayer(rec.env, stateFor(fx, { zoneSounds, labelVisibility: { numbers: true, xenotation: true, planets: false } }), fx.index)
      expect(textCalls(rec.events)).toEqual(textCalls(plain.events))
      expect(rec.events.length).toBe(plain.events.length)
      const ov = makeRecorder()
      drawOverlay(ov.env, overlayFor(fx, { zoneSounds, hlZones: new Set([5, 12]), labelVisibility: { numbers: true, xenotation: true, planets: false } }), fx.index)
      expect(textCalls(ov.events)).toEqual(textCalls(plainOv.events))
      expect(ov.events.length).toBe(plainOv.events.length)
    }
    // and the digits themselves are painted at the layout's label size, one font for the whole pass
    const digits = textCalls(plain.events).filter(c => c.font.startsWith('bold'))
    expect(new Set(digits.map(c => c.font)).size).toBe(1)
  })

  it('level of detail is unchanged: below the label threshold neither pass paints any sound text', () => {
    for (const base of [202, 4000]) {
      const fx = zoneFx(base)
      expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(false)
      const sounds = soundsFor(base)
      const rec = makeRecorder()
      drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneSounds: sounds }), fx.index)
      expect(ofType(rec.events, 'fillText')).toHaveLength(0)
      const ov = makeRecorder()
      drawOverlay(ov.env, overlayFor(fx, { layers: new Set<Layer>(), hlZones: new Set([5, 12]), selZones: new Set([7]), zoneSounds: sounds }), fx.index)
      expect(ofType(ov.events, 'fillText')).toHaveLength(0)
    }
  })

  it('the numbers toggle hides the sounds in both passes', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28)
    const off = { numbers: false, xenotation: false, planets: false }
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), labelVisibility: off, zoneSounds: sounds }), fx.index)
    expect(ofType(rec.events, 'fillText')).toHaveLength(0)
    const ov = makeRecorder()
    drawOverlay(ov.env, overlayFor(fx, { layers: new Set<Layer>(), hlZones: new Set([5, 12]), labelVisibility: off, zoneSounds: sounds }), fx.index)
    expect(ofType(ov.events, 'fillText')).toHaveLength(0)
  })

  it('the xenotation labels are untouched by sounds mode in both passes', () => {
    const fx = zoneFx(28)
    const xenoOnly = { numbers: false, xenotation: true, planets: false }
    const without = makeRecorder()
    drawNodeLayer(without.env, stateFor(fx, { labelVisibility: xenoOnly }), fx.index)
    const withSounds = makeRecorder()
    drawNodeLayer(withSounds.env, stateFor(fx, { labelVisibility: xenoOnly, zoneSounds: soundsFor(28) }), fx.index)
    expect(ofType(withSounds.events, 'fillText').length).toBeGreaterThan(0)
    expect(textCalls(withSounds.events)).toEqual(textCalls(without.events))

    const ovWithout = makeRecorder()
    drawOverlay(ovWithout.env, overlayFor(fx, { hlZones: new Set([7]), labelVisibility: xenoOnly }), fx.index)
    const ovWith = makeRecorder()
    drawOverlay(ovWith.env, overlayFor(fx, { hlZones: new Set([7]), labelVisibility: xenoOnly, zoneSounds: soundsFor(28) }), fx.index)
    expect(textCalls(ovWith.events)).toEqual(textCalls(ovWithout.events))
  })

  it('a zone with no sound (an empty or a missing entry) keeps its digits label at the layout size, in both passes', () => {
    const fx = zoneFx(28)
    const full = fx.scene.labelSize * scaleFor(fx)
    const sounds = soundsFor(28).slice(0, 20) // zones 20 to 27 have no entry
    const holey = sounds.map((s, z) => (z === 3 ? '' : s))
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneSounds: holey }), fx.index)
    const ov = makeRecorder()
    drawOverlay(ov.env, overlayFor(fx, { layers: new Set<Layer>(), hlZones: new Set([3, 24, 12]), zoneSounds: holey }), fx.index)
    for (const z of [3, 24]) {
      for (const events of [rec.events, ov.events]) {
        const e = labelAt(events, fx, z) as Ev
        expect(e.args[0]).toBe(fx.labels[z])
        expect(e.style.font).toBe(`bold ${full}px monospace`)
      }
    }
    // the neighbours that do have a sound still paint it, and every zone paints exactly one label (no empty text on top)
    expect((labelAt(rec.events, fx, 12) as Ev).args[0]).toBe(fitFor(fx, LONG).text)
    expect((labelAt(ov.events, fx, 12) as Ev).args[0]).toBe(fitFor(fx, LONG).text)
    expect(ofType(rec.events, 'fillText')).toHaveLength(28)
    expect(ofType(ov.events, 'fillText')).toHaveLength(3)
    expect(ofType(rec.events, 'fillText').some(e => e.args[0] === '')).toBe(false)
  })

  it('a sound is painted as one plain text argument, never as markup', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28).map((s, z) => (z === 0 ? '<b>x' : s))
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneSounds: sounds }), fx.index)
    const e = labelAt(rec.events, fx, 0) as Ev
    expect(e.args[0]).toBe(fitFor(fx, '<b>x').text)
    expect(typeof e.args[0]).toBe('string')
  })

  it('the pair graph ignores zoneSounds: pills keep their hi::lo numerals in both passes', () => {
    const fx = pairFx(28)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(true)
    const sounds = soundsFor(28)
    const plain = makeRecorder()
    drawNodeLayer(plain.env, stateFor(fx, bare(fx)), fx.index)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { ...bare(fx), zoneSounds: sounds }), fx.index)
    expect(textCalls(rec.events)).toEqual(textCalls(plain.events))
    for (let q = 0; q < 14; q++) {
      const { lo, hi } = fx.g.pair(q)
      expect(ofType(rec.events, 'fillText').some(e => e.args[0] === `${fx.labels[hi]}::${fx.labels[lo]}`)).toBe(true)
    }
    const plainOv = makeRecorder()
    drawOverlay(plainOv.env, overlayFor(fx, { hlZones: new Set([0, 1, 5]) }), fx.index)
    const ov = makeRecorder()
    drawOverlay(ov.env, overlayFor(fx, { hlZones: new Set([0, 1, 5]), zoneSounds: sounds }), fx.index)
    expect(textCalls(ov.events)).toEqual(textCalls(plainOv.events))
  })

  it('the gate labels and the layout captions keep their numerals and fonts with sounds on', () => {
    const fx = zoneFx(28)
    const sounds = soundsFor(28)
    // layout captions stay (only the zone slot changes): the caption texts are identical to the digits run
    const plain = makeRecorder()
    drawNodeLayer(plain.env, stateFor(fx), fx.index)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { zoneSounds: sounds }), fx.index)
    const captions = fx.scene.regionLabels.map(l => l.text)
    expect(captions.length).toBeGreaterThan(0)
    const captionCalls = (events: readonly Ev[]) => textCalls(events).filter(c => captions.includes(c.args[0] as string) && !c.font.startsWith('bold '))
    expect(captionCalls(rec.events)).toEqual(captionCalls(plain.events))
    // gate meeting labels come from the overlay's edge text: hovering a zone with sounds on leaves those calls as they were
    const g0 = makeRecorder()
    drawOverlay(g0.env, overlayFor(fx, { hlZones: new Set([5]) }), fx.index)
    const g1 = makeRecorder()
    drawOverlay(g1.env, overlayFor(fx, { hlZones: new Set([5]), zoneSounds: sounds }), fx.index)
    const edgeText = (events: readonly Ev[]) => textCalls(events).filter(c => !(c.font.startsWith('bold ') && c.fill === fx.view.zoneColors[5]))
    expect(edgeText(g1.events)).toEqual(edgeText(g0.events))
    expect(edgeText(g0.events).length).toBeGreaterThan(0)
  })
})

// ── The paint surface: layers painted on more than the window (origin and surface fields) ────────────────────────────

// The window stays the logical frame of every transform; the optional originX, originY, surfaceWidth and surfaceHeight say
// where the window's top-left sits inside a larger paint surface and how big that surface is (CSS px). Geometry stays in
// window coordinates; only the clear, the dpr transform and the culling bounds follow the surface, so a node or an edge that
// lies outside the window but inside the surface IS painted, and one beyond the surface is not.
describe('paint surface: origin and surface fields', () => {
  const MARGIN = { left: 300.5, top: 120.25, right: 260, bottom: 90 }
  const HUGE = 1_000_000
  const EVERYTHING = { originX: HUGE, originY: HUGE, surfaceWidth: 3 * HUGE, surfaceHeight: 3 * HUGE }

  /** The state override of a surface that extends the window by the margins (fractional left and top on purpose). */
  const wideSurface = (fx: Fx, m = MARGIN): Partial<DrawState> => ({
    originX: m.left,
    originY: m.top,
    surfaceWidth: m.left + fx.w + m.right,
    surfaceHeight: m.top + fx.h + m.bottom,
  })

  /** Each layer's draw call, so a rule is asserted for all five painters the same way. */
  const painters: readonly (readonly [string, (env: DrawEnv, fx: Fx, over: Partial<DrawState>) => void])[] = [
    ['syzygy layer', (env, fx, over) => drawSyzygyLayer(env, stateFor(fx, over), fx.index)],
    ['current layer', (env, fx, over) => drawCurrentLayer(env, stateFor(fx, over), fx.index)],
    ['gate layer', (env, fx, over) => drawGateLayer(env, stateFor(fx, over), fx.index)],
    ['node layer', (env, fx, over) => drawNodeLayer(env, stateFor(fx, over), fx.index)],
    ['overlay', (env, fx, over) => void drawOverlay(env, overlayFor(fx, { hlZones: new Set([5]), ...over }), fx.index)],
  ]

  /** What a recording did, as plain data: type, scalar arguments, style and path operations (no proxies, so toEqual is safe). */
  const signature = (rec: Recorder): string[] =>
    rec.events.map(e =>
      JSON.stringify({
        type: e.type,
        args: e.args.map(a => (typeof a === 'number' || typeof a === 'string' || Array.isArray(a) ? a : 'object')),
        style: e.style,
        ops: e.path?.ops ?? null,
      }),
    )

  for (const [name, paint] of painters) {
    it(`${name}: the dpr transform puts the window origin at origin x dpr and the clear covers the whole surface`, () => {
      const fx = zoneFx(28)
      const rec = makeRecorder()
      paint(rec.env, fx, { dpr: 2, ...wideSurface(fx) })
      const setT = rec.events.findIndex(e => e.type === 'setTransform')
      const clear = rec.events.findIndex(e => e.type === 'clearRect')
      expect(setT).toBeGreaterThanOrEqual(0)
      expect(setT).toBeLessThan(clear)
      expect(rec.events[setT]?.args).toEqual([2, 0, 0, 2, 2 * MARGIN.left, 2 * MARGIN.top])
      expect(rec.events[clear]?.args).toEqual([-MARGIN.left, -MARGIN.top, MARGIN.left + fx.w + MARGIN.right, MARGIN.top + fx.h + MARGIN.bottom])
      expect(ofType(rec.events, 'clearRect')).toHaveLength(1)
      expect(rec.events.some(e => e.type === 'fillRect')).toBe(false)
    })

    it(`${name}: absent fields and the window's own origin and size are the same drawing, call for call (and +0, never -0)`, () => {
      const fx = zoneFx(28)
      const plain = makeRecorder()
      paint(plain.env, fx, { dpr: 2 })
      const same = makeRecorder()
      paint(same.env, fx, { dpr: 2, originX: 0, originY: 0, surfaceWidth: fx.w, surfaceHeight: fx.h })
      expect(signature(same)).toEqual(signature(plain))
      const clear = plain.events.find(e => e.type === 'clearRect')
      expect(clear?.args).toEqual([0, 0, fx.w, fx.h])
      expect(Object.is(clear?.args[0], 0) && Object.is(clear?.args[1], 0)).toBe(true)
    })

    it(`${name}: a surface that is not finite or not positive falls back to the window`, () => {
      const fx = zoneFx(28)
      const plain = makeRecorder()
      paint(plain.env, fx, { dpr: 1 })
      for (const bad of [Number.NaN, Infinity, -Infinity]) {
        const rec = makeRecorder()
        paint(rec.env, fx, { dpr: 1, originX: bad, originY: bad, surfaceWidth: bad, surfaceHeight: bad })
        expect(signature(rec)).toEqual(signature(plain))
      }
      const zero = makeRecorder()
      paint(zero.env, fx, { dpr: 1, originX: 0, originY: 0, surfaceWidth: 0, surfaceHeight: -5 })
      expect(signature(zero)).toEqual(signature(plain))
    })
  }

  const discCentres = (rec: Recorder): { x: number; y: number }[] =>
    fillsOf(rec.events)
      .filter(e => e.style.fillStyle.endsWith('18'))
      .flatMap(e => opsOf(e, 'arc').map(o => nums(o.args)))
      .map(a => ({ x: a[0] as number, y: a[1] as number }))

  it('node layer: a zone outside the window but inside the surface is painted, one beyond the surface is culled', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    expect(near.zoom).toBeGreaterThan(2)
    const rDraw = Math.max(onScreenRadius(near, fx.frame, fx.w, fx.h), NODE_MIN_RADIUS_PX)
    const room = 4 * rDraw + 12 // the documented cull room around a disc (its radius x 4 plus 12 CSS px)
    const windowOnly = makeRecorder()
    drawNodeLayer(windowOnly.env, stateFor(fx, { transform: near }), fx.index)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { transform: near, ...wideSurface(fx) }), fx.index)

    const inWindow = (p: { x: number; y: number }): boolean => p.x >= 0 && p.x <= fx.w && p.y >= 0 && p.y <= fx.h
    const left = -MARGIN.left
    const right = fx.w + MARGIN.right
    const top = -MARGIN.top
    const bottom = fx.h + MARGIN.bottom
    const painted = discCentres(rec)
    const screen = Array.from({ length: 202 }, (_, z) => screenOf(fx, fx.scene.x[z] as number, fx.scene.y[z] as number, near))
    const sameCentre = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
    const beyond = (p: { x: number; y: number }): boolean => p.x < left - room || p.x > right + room || p.y < top - room || p.y > bottom + room
    let inMargin = 0
    for (const p of screen) {
      const insideSurface = p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
      const isPainted = painted.some(c => sameCentre(c, p))
      if (insideSurface) expect(isPainted, `a zone at (${p.x}, ${p.y}) inside the surface is painted`).toBe(true)
      if (beyond(p)) expect(isPainted, `a zone at (${p.x}, ${p.y}) beyond the surface is culled`).toBe(false)
      if (insideSurface && !inWindow(p)) inMargin++
    }
    expect(inMargin, 'the fixture has zones in the margin').toBeGreaterThan(0)
    expect(screen.some(beyond), 'the fixture has zones beyond the surface').toBe(true)
    expect(painted.length).toBeGreaterThan(discCentres(windowOnly).length)
    expect(painted.some(c => !inWindow(c))).toBe(true)
    expect(painted.length).toBeLessThan(202)
  })

  it('node layer: a surface that contains the whole zoomed frame paints every zone', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    const rec = makeRecorder()
    drawNodeLayer(rec.env, stateFor(fx, { transform: near, ...EVERYTHING }), fx.index)
    expect(discCentres(rec)).toHaveLength(202)
  })

  it('syzygy layer: edges in the margin are painted, and a surface that contains the frame paints all of them', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    const count = (over: Partial<DrawState>): number => {
      const rec = makeRecorder()
      drawSyzygyLayer(rec.env, stateFor(fx, { transform: near, ...over }), fx.index)
      return opsOf(strokesOf(rec.events)[0] as Ev, 'moveTo').length
    }
    const windowOnly = count({})
    const wide = count(wideSurface(fx))
    const all = count(EVERYTHING)
    expect(windowOnly).toBeGreaterThan(0)
    expect(wide).toBeGreaterThan(windowOnly)
    expect(all).toBe(fx.g.pairCount)
    expect(wide).toBeLessThan(all)
  })

  it('current layer: stems in the margin are painted, and a surface that contains the frame paints all of them', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    const count = (over: Partial<DrawState>): number => {
      const rec = makeRecorder()
      drawCurrentLayer(rec.env, stateFor(fx, { transform: near, ...over }), fx.index)
      return opsOf(stemStroke(rec.events), 'quadraticCurveTo').length
    }
    const windowOnly = count({})
    const wide = count(wideSurface(fx))
    const all = count(EVERYTHING)
    expect(wide).toBeGreaterThan(windowOnly)
    expect(all).toBe(fx.g.pairCount)
    expect(wide).toBeLessThan(all)
  })

  it('gate layer: gates in the margin are painted, and a surface that contains the frame paints all of them', () => {
    const fx = zoneFx(202)
    const near = fitZones(fx.scene.x, fx.scene.y, [0], fx.frame, fx.w, fx.h)
    const count = (over: Partial<DrawState>): number => {
      const rec = makeRecorder()
      drawGateLayer(rec.env, stateFor(fx, { transform: near, ...over }), fx.index)
      return strokesOf(rec.events).reduce((n, e) => n + opsOf(e, 'quadraticCurveTo').length, 0)
    }
    const windowOnly = count({})
    const wide = count(wideSurface(fx))
    const all = count(EVERYTHING)
    expect(wide).toBeGreaterThan(windowOnly)
    expect(all).toBe(fx.scene.gateTo.length)
    expect(wide).toBeLessThan(all)
  })

  it('pair graph: pills in the margin are painted, and a surface that contains the frame paints all of them', () => {
    const fx = pairFx(64)
    const px = fx.scene.px as Float64Array
    const py = fx.scene.py as Float64Array
    const near = fitZones(px, py, [0], fx.frame, fx.w, fx.h)
    expect(near.zoom).toBeGreaterThan(2)
    const pills = (over: Partial<DrawState>): number => {
      const rec = makeRecorder()
      drawNodeLayer(rec.env, stateFor(fx, { transform: near, ...over }), fx.index)
      return fillsOf(rec.events)
        .filter(e => Math.abs(e.style.globalAlpha - 0.12) < 1e-12)
        .reduce((n, e) => n + opsOf(e, 'closePath').length, 0)
    }
    const windowOnly = pills({})
    const wide = pills(wideSurface(fx))
    const all = pills(EVERYTHING)
    expect(windowOnly).toBeGreaterThan(0)
    expect(wide).toBeGreaterThan(windowOnly)
    expect(all).toBe(px.length)
    expect(wide).toBeLessThan(all)
  })

  it('overlay: a highlighted zone left of the window is drawn when the surface reaches it, and not when only the window is painted', () => {
    const fx = zoneFx(202)
    const t = centerOn(fx, fx.scene.x[0] as number, fx.scene.y[0] as number, 40)
    const rDraw = Math.max(onScreenRadius(t, fx.frame, fx.w, fx.h), NODE_MIN_RADIUS_PX)
    // a zone whose centre is left of the window, past the cull room, but inside the margin
    let target = -1
    for (let z = 0; z < 202; z++) {
      const p = screenOf(fx, fx.scene.x[z] as number, fx.scene.y[z] as number, t)
      if (p.x < -(4 * rDraw + 12) - 5 && p.x > -MARGIN.left + 10 && p.y > 0 && p.y < fx.h) {
        target = z
        break
      }
    }
    expect(target, 'a zone left of the window inside the margin').toBeGreaterThanOrEqual(0)
    const p = screenOf(fx, fx.scene.x[target] as number, fx.scene.y[target] as number, t)
    const hasDisc = (rec: Recorder): boolean =>
      rec.paths.some(path => path.ops.some(o => o.op === 'arc' && Math.hypot((o.args[0] as number) - p.x, (o.args[1] as number) - p.y) < 1e-6))
    const windowOnly = makeRecorder()
    drawOverlay(windowOnly.env, overlayFor(fx, { transform: t, hlZones: new Set([target]) }), fx.index)
    const wide = makeRecorder()
    drawOverlay(wide.env, overlayFor(fx, { transform: t, hlZones: new Set([target]), ...wideSurface(fx) }), fx.index)
    expect(hasDisc(windowOnly), 'only the window: the zone beyond it is culled').toBe(false)
    expect(hasDisc(wide), 'the surface reaches it: it is drawn').toBe(true)
  })

  it('level of detail is the same on a larger surface: labels still follow the on-screen node radius only', () => {
    const fx = zoneFx(202)
    const t = centerOn(fx, fx.scene.x[0] as number, fx.scene.y[0] as number, 40)
    const labelled = (over: Partial<DrawState>, transform: CanvasTransform): boolean => {
      const rec = makeRecorder()
      drawNodeLayer(rec.env, stateFor(fx, { transform, ...bare(fx), ...over }), fx.index)
      return ofType(rec.events, 'fillText').length > 0
    }
    expect(labelsShown(onScreenRadius(t, fx.frame, fx.w, fx.h))).toBe(true)
    expect(labelled({}, t)).toBe(true)
    expect(labelled(wideSurface(fx), t)).toBe(true)
    expect(labelsShown(onScreenRadius(IDENTITY_TRANSFORM, fx.frame, fx.w, fx.h))).toBe(false)
    expect(labelled({}, IDENTITY_TRANSFORM)).toBe(false)
    expect(labelled(wideSurface(fx), IDENTITY_TRANSFORM)).toBe(false)
  })

  it('every number a surface drawing carries is finite', () => {
    const fx = zoneFx(202)
    const t = centerOn(fx, fx.scene.x[0] as number, fx.scene.y[0] as number, 20)
    const rec = makeRecorder()
    const over = { transform: t, ...wideSurface(fx), dpr: 2 }
    drawSyzygyLayer(rec.env, stateFor(fx, over), fx.index)
    drawCurrentLayer(rec.env, stateFor(fx, over), fx.index)
    drawGateLayer(rec.env, stateFor(fx, over), fx.index)
    drawNodeLayer(rec.env, stateFor(fx, over), fx.index)
    drawOverlay(rec.env, overlayFor(fx, { ...over, hlZones: new Set([0, 1, 2]) }), fx.index)
    expectAllFinite(rec)
  })
})
