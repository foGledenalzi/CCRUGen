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
  drawSyzygyLayer,
  edgeLayerOpacity,
  parseArcEnd,
  type Ctx2D,
  type DrawEnv,
  type DrawState,
  type SceneIndex,
} from '../../app/lib/canvas/draw'
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
import { syzTrianglePoints } from '../../app/lib/geometry'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../../app/lib/labelScheme'
import { buildNumogramView, type NumogramView } from '../../app/lib/numogramView'
import { ZONE_DIMMED, ZONE_HIDDEN, ZONE_NORMAL } from '../../app/lib/regions'
import { labelsShown } from '../../app/lib/tierBounds'
import type { Layer } from '../../app/data/types'

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
