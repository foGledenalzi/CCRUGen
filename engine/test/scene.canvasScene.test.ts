// REN-02 (Phase 6, D-04, D-05, T-06-13, T-06-15): the Canvas scene is a pure typed-array packaging of the engine's own
// layouts and routes. Every truth of 06-02-PLAN.md is checked by a mismatch-collector sweep (the pattern of
// layout.routing.test.ts) over every even base 2..64 on ring, ladder and spiral plus 202, 666, 1024 and 4000, with the
// geometry recomputed independently: route endpoints through a regex over the engine's own route strings, syzygy
// trimming from the definition (and against the SVG tier's emitted lines), pick data from flattenQuad.
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../index'
import type { Numogram } from '../core/types'
import { fmt } from '../layout/format'
import { pairGraphLayout, routePairGraph } from '../layout/pairgraph'
import { resolveLayout } from '../layout/registry'
import { routeCurrents, routeGates } from '../layout/routing'
import type { CurrentRoutes, GateRoutes, Layout, PairGraphLayout, PairGraphRoutes } from '../layout/types'
import {
  CURVE_STRIDE,
  EDGE_KIND,
  PICK_FLATTEN_STEPS,
  buildPairScene,
  buildZoneScene,
  edgeCount,
  flattenQuad,
  parseRouteCurve,
} from '../scene/canvasScene'
import type { CanvasScene } from '../scene/canvasScene'
import { layoutToSvg } from '../scene/svgString'

const MAX_MISMATCHES = 200
const NUM_RE = /-?\d+(?:\.\d+)?/g
const CURRENT_STRIDE = 3 * CURVE_STRIDE

type ZoneLayoutId = 'ring' | 'ladder' | 'spiral'
const ZONE_LAYOUT_IDS: readonly ZoneLayoutId[] = ['ring', 'ladder', 'spiral']

interface ZoneCase {
  readonly base: number
  readonly id: ZoneLayoutId
}

const ZONE_CASES: ZoneCase[] = []
for (let n = 2; n <= 64; n += 2) for (const id of ZONE_LAYOUT_IDS) ZONE_CASES.push({ base: n, id })
for (const n of [202, 666, 1024]) ZONE_CASES.push({ base: n, id: 'ring' })
for (const id of ZONE_LAYOUT_IDS) ZONE_CASES.push({ base: 4000, id })

interface Built {
  readonly g: Numogram
  readonly layout: Layout
  readonly gates: GateRoutes
  readonly currents: CurrentRoutes
  readonly scene: CanvasScene
}

function buildFresh(c: ZoneCase): Built {
  const g = createNumogram(c.base)
  const layout = resolveLayout(g, c.id, [], { packer: 'shelf' })
  const gates = routeGates(g, layout)
  const currents = routeCurrents(g, layout)
  return { g, layout, gates, currents, scene: buildZoneScene(g, layout, gates, currents) }
}

const memo = new Map<string, Built>()
function built(c: ZoneCase): Built {
  const key = `${c.base}:${c.id}`
  let b = memo.get(key)
  if (b === undefined) {
    b = buildFresh(c)
    memo.set(key, b)
  }
  return b
}

function tagOf(c: ZoneCase): string {
  return `n=${c.base} ${c.id}`
}

/** Runs `check` over every case with a capped collector; asserts the collector is empty once, at the end. */
function sweep(check: (c: ZoneCase, b: Built, push: (msg: string) => void) => void): void {
  const mismatches: string[] = []
  for (const c of ZONE_CASES) {
    const tag = tagOf(c)
    const push = (msg: string): void => {
      if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
    }
    check(c, built(c), push)
  }
  expect(mismatches.slice(0, 20)).toEqual([])
}

interface Endpoints {
  readonly sx: number
  readonly sy: number
  readonly ex: number
  readonly ey: number
  readonly cx: number
  readonly cy: number
}

/** First and last (x, y) of an engine route string, and its control point: the printed one for Q, the midpoint for L. */
function endpoints(d: string): Endpoints {
  const nums = d.match(NUM_RE)
  if (nums === null || (nums.length !== 4 && nums.length !== 6)) throw new Error(`unexpected route grammar: ${d}`)
  const sx = Number(nums[0])
  const sy = Number(nums[1])
  const ex = Number(nums[nums.length - 2])
  const ey = Number(nums[nums.length - 1])
  if (nums.length === 6) return { sx, sy, ex, ey, cx: Number(nums[2]), cy: Number(nums[3]) }
  return { sx, sy, ex, ey, cx: (sx + ex) / 2, cy: (sy + ey) / 2 }
}

function sameNumbers(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

/** The syzygy trimming of the SVG tier, recomputed from its definition (engine/scene/svgString.ts). */
function expectedSyzygy(g: Numogram, layout: Layout, q: number): [number, number, number, number] {
  const info = g.pair(q)
  const r = layout.nodeRadius
  const x1 = layout.x[info.lo] ?? 0
  const y1 = layout.y[info.lo] ?? 0
  const x2 = layout.x[info.hi] ?? 0
  const y2 = layout.y[info.hi] ?? 0
  const rLo = layout.nodeRadii?.[info.lo] ?? r
  const rHi = layout.nodeRadii?.[info.hi] ?? r
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)
  if (dist <= 2 * r) return [x1, y1, x2, y2]
  const ux = dx / dist
  const uy = dy / dist
  return [x1 + ux * rLo, y1 + uy * rLo, x2 - ux * rHi, y2 - uy * rHi]
}

function typedArraysOf(scene: CanvasScene): ArrayBufferView[] {
  return Object.values(scene).filter((v): v is ArrayBufferView => ArrayBuffer.isView(v))
}

describe('parseRouteCurve', () => {
  it('an L stores its midpoint as the control and returns true', () => {
    const out = new Float64Array(6)
    expect(parseRouteCurve('M1 2L3 4', out, 0)).toBe(true)
    expect(Array.from(out)).toEqual([1, 2, 2, 3, 3, 4])
  })

  it('a Q stores its own control, writes at the given offset and leaves other slots alone', () => {
    const out = new Float64Array(12).fill(-7)
    expect(parseRouteCurve('M1 2Q5 6 7 8', out, 6)).toBe(true)
    expect(Array.from(out.subarray(0, 6))).toEqual([-7, -7, -7, -7, -7, -7])
    expect(Array.from(out.subarray(6))).toEqual([1, 2, 5, 6, 7, 8])
  })

  it('negative and decimal numbers parse exactly', () => {
    const out = new Float64Array(6)
    expect(parseRouteCurve('M-1.5 2.25Q0 -3 4.75 5', out, 0)).toBe(true)
    expect(Array.from(out)).toEqual([-1.5, 2.25, 0, -3, 4.75, 5])
  })

  it('an empty string writes six NaN and returns false', () => {
    const out = new Float64Array(6).fill(1)
    expect(parseRouteCurve('', out, 0)).toBe(false)
    expect(Array.from(out).every(Number.isNaN)).toBe(true)
  })

  it('a cubic or an arc throws a RangeError naming the string', () => {
    const out = new Float64Array(6)
    expect(() => parseRouteCurve('M1 2C3 4 5 6 7 8', out, 0)).toThrow(RangeError)
    expect(() => parseRouteCurve('M1 2C3 4 5 6 7 8', out, 0)).toThrow('M1 2C3 4 5 6 7 8')
    expect(() => parseRouteCurve('M1 2A1 1 0 0 1 3 4', out, 0)).toThrow(RangeError)
    expect(() => parseRouteCurve('M1 2A1 1 0 0 1 3 4', out, 0)).toThrow('M1 2A1 1 0 0 1 3 4')
  })

  it('any character outside the whitelist throws (T-06-15)', () => {
    const out = new Float64Array(6)
    for (const bad of ['M1 2L3 4Z', 'M1 2L3 4;', 'M1 2L3 <4', 'm1 2l3 4', 'M1 2L3 4\n', 'M1 2L3\t4', 'M１ 2L3 4']) {
      expect(() => parseRouteCurve(bad, out, 0)).toThrow(RangeError)
    }
  })

  it('a wrong command order, a wrong count or a stray token throws', () => {
    const out = new Float64Array(6)
    for (const bad of [
      'L1 2M3 4',
      'L1 2L3 4',
      'Q1 2Q5 6 7 8',
      '0 1 2L3 4',
      'M1 2',
      'M1 2L3',
      'M1 2L3 4 5',
      'M1 2Q5 6 7',
      'M1 2Q5 6 7 8 9',
      'M1 2LL3 4',
      'M1 2L3 4L5 6',
      'M1 M2L3 4',
      'M1 2Q5 6 L7 8',
      'M1 2L3 4e',
      'M1 2L3 .',
      'M1 2L3 --4',
      'ML3 4',
    ]) {
      expect(() => parseRouteCurve(bad, out, 0), bad).toThrow(RangeError)
    }
  })

  it('a number that overflows to Infinity throws instead of storing it', () => {
    const out = new Float64Array(6)
    expect(() => parseRouteCurve('M1 2L1e999 4', out, 0)).toThrow(RangeError)
  })

  it('an offset that does not fit in the output throws', () => {
    const out = new Float64Array(6)
    expect(() => parseRouteCurve('M1 2L3 4', out, 1)).toThrow(RangeError)
    expect(() => parseRouteCurve('M1 2L3 4', out, -1)).toThrow(RangeError)
  })

  it('accepts commas and extra spaces between numbers', () => {
    const out = new Float64Array(6)
    expect(parseRouteCurve('M1,2 Q5,6,7,8', out, 0)).toBe(true)
    expect(Array.from(out)).toEqual([1, 2, 5, 6, 7, 8])
  })
})

describe('flattenQuad', () => {
  it('yields PICK_FLATTEN_STEPS (8) chords that follow the quadratic Bezier formula at t = i / 8', () => {
    expect(PICK_FLATTEN_STEPS).toBe(8)
    const curves = new Float64Array([9, 9, 9, 9, 9, 9, 1, 2, 5, 14, 11, 3])
    const out = new Float64Array(4 * PICK_FLATTEN_STEPS + 4).fill(-1)
    const wrote = flattenQuad(curves, 6, PICK_FLATTEN_STEPS, out, 4)
    expect(wrote).toBe(8)
    expect(Array.from(out.subarray(0, 4))).toEqual([-1, -1, -1, -1])
    const point = (i: number): [number, number] => {
      const t = i / 8
      const u = 1 - t
      return [u * u * 1 + 2 * u * t * 5 + t * t * 11, u * u * 2 + 2 * u * t * 14 + t * t * 3]
    }
    for (let i = 0; i < 8; i++) {
      const [ax, ay] = point(i)
      const [bx, by] = point(i + 1)
      expect(Math.abs((out[4 + 4 * i] ?? NaN) - ax)).toBeLessThan(1e-9)
      expect(Math.abs((out[5 + 4 * i] ?? NaN) - ay)).toBeLessThan(1e-9)
      expect(Math.abs((out[6 + 4 * i] ?? NaN) - bx)).toBeLessThan(1e-9)
      expect(Math.abs((out[7 + 4 * i] ?? NaN) - by)).toBeLessThan(1e-9)
    }
    expect(out[4]).toBe(1)
    expect(out[5]).toBe(2)
    expect(out[4 + 4 * 7 + 2]).toBe(11)
    expect(out[4 + 4 * 7 + 3]).toBe(3)
  })

  it('consecutive chords share their joint exactly', () => {
    const curves = new Float64Array([0.1, 0.7, 3.3, -4.1, 9.9, 2.2])
    const out = new Float64Array(4 * 6)
    expect(flattenQuad(curves, 0, 6, out, 0)).toBe(6)
    for (let i = 0; i < 5; i++) {
      expect(out[4 * i + 2]).toBe(out[4 * i + 4])
      expect(out[4 * i + 3]).toBe(out[4 * i + 5])
    }
  })

  it('writes nothing and returns 0 for a NaN curve', () => {
    const curves = new Float64Array(6).fill(NaN)
    const out = new Float64Array(4 * PICK_FLATTEN_STEPS).fill(5)
    expect(flattenQuad(curves, 0, PICK_FLATTEN_STEPS, out, 0)).toBe(0)
    expect(out.every(v => v === 5)).toBe(true)
  })

  it('a NaN curve returns 0 even when the output has no room at all (it reserves none)', () => {
    const curves = new Float64Array(6).fill(NaN)
    expect(flattenQuad(curves, 0, PICK_FLATTEN_STEPS, new Float64Array(0), 0)).toBe(0)
    expect(flattenQuad(curves, 0, PICK_FLATTEN_STEPS, new Float64Array(4), 12)).toBe(0)
  })

  it('rejects a non-positive or non-integer step count and an output that is too small', () => {
    const curves = new Float64Array([0, 0, 1, 1, 2, 0])
    const out = new Float64Array(8)
    expect(() => flattenQuad(curves, 0, 0, out, 0)).toThrow(RangeError)
    expect(() => flattenQuad(curves, 0, 2.5, out, 0)).toThrow(RangeError)
    expect(() => flattenQuad(curves, 0, 3, out, 0)).toThrow(RangeError)
  })

  it('the output bound is exact: room for 4 * steps numbers works, one fewer or a shifted start throws', () => {
    const curves = new Float64Array([0, 0, 1, 1, 2, 0])
    expect(flattenQuad(curves, 0, 2, new Float64Array(8), 0)).toBe(2)
    expect(() => flattenQuad(curves, 0, 2, new Float64Array(7), 0)).toThrow(RangeError)
    expect(() => flattenQuad(curves, 0, 2, new Float64Array(8), 1)).toThrow(RangeError)
    expect(() => flattenQuad(curves, 0, 2, new Float64Array(8), -1)).toThrow(RangeError)
    expect(flattenQuad(curves, 0, 2, new Float64Array(9), 1)).toBe(2)
  })
})

describe('buildZoneScene: coordinates, frame and region labels', () => {
  it('x, y and drawOrder equal the layout and sit on their own buffers; the frame fields are copied', () => {
    sweep((c, b, push) => {
      const { layout, scene, g } = b
      if (scene.kind !== 'zones') push(`kind ${scene.kind}`)
      if (scene.base !== c.base) push(`base ${scene.base}`)
      if (scene.layoutId !== layout.id) push(`layoutId ${scene.layoutId} != ${layout.id}`)
      if (!sameNumbers(scene.x, layout.x)) push('x differs')
      if (!sameNumbers(scene.y, layout.y)) push('y differs')
      if (!sameNumbers(scene.drawOrder, layout.drawOrder)) push('drawOrder differs')
      if (scene.x === layout.x || scene.x.buffer === layout.x.buffer) push('x aliases the layout array')
      if (scene.y.buffer === layout.y.buffer) push('y aliases the layout array')
      if (scene.drawOrder.buffer === layout.drawOrder.buffer) push('drawOrder aliases the layout array')
      if (scene.width !== layout.width || scene.height !== layout.height) push('frame differs')
      if (scene.centerX !== layout.center.x || scene.centerY !== layout.center.y) push('centre differs')
      if (scene.nodeRadius !== layout.nodeRadius) push('nodeRadius differs')
      if (scene.labelSize !== layout.labelSize) push('labelSize differs')
      if (scene.strokeScale !== layout.strokeScale) push('strokeScale differs')
      if (scene.pillWidth !== 0 || scene.pillHeight !== 0) push('pill size is not 0 for zones')
      if (scene.px !== null || scene.py !== null || scene.pairArc !== null || scene.pairLoop !== null) {
        push('pair-only fields are not null')
      }
      if (JSON.stringify(scene.regionLabels) !== JSON.stringify(layout.regionLabels)) push('regionLabels differ')
      if (scene.x.length !== g.zoneCount) push('x length')
    })
  })
})

describe('buildZoneScene: syzygies', () => {
  it('syzygySeg (4 per pair) equals the svgString trimming recomputed from its definition', () => {
    sweep((c, b, push) => {
      const { g, layout, scene } = b
      const P = g.pairCount
      if (scene.syzygySeg.length !== 4 * P) {
        push(`syzygySeg length ${scene.syzygySeg.length} != ${4 * P}`)
        return
      }
      for (let q = 0; q < P; q++) {
        const want = expectedSyzygy(g, layout, q)
        for (let i = 0; i < 4; i++) {
          if (scene.syzygySeg[4 * q + i] !== want[i]) {
            push(`pair ${q} component ${i}: ${scene.syzygySeg[4 * q + i]} != ${want[i]}`)
            break
          }
        }
      }
    })
  })

  it('trims by each member\'s own radius and draws centre to centre up to and including 2r', () => {
    const g = createNumogram(10)
    const base = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const r = base.nodeRadius
    const x = base.x.slice()
    const y = base.y.slice()
    // pair 0 = zones 0 and 9: exactly 2r apart; pair 1 = zones 1 and 8: 1.5r apart; pair 2 = zones 2 and 7: 2r + 0.5 apart
    x[0] = 100
    y[0] = 100
    x[9] = 100 + 2 * r
    y[9] = 100
    x[1] = 200
    y[1] = 200
    x[8] = 200 + 1.5 * r
    y[8] = 200
    x[2] = 300
    y[2] = 300
    x[7] = 300 + 2 * r + 0.5
    y[7] = 300
    // distinct radii everywhere, so a lo/hi mix-up shows on every diagonal pair too; pair 2 gets two explicit ones
    const nodeRadii = Float64Array.from({ length: 10 }, (_, z) => r + 0.25 * z)
    nodeRadii[2] = r + 3 // the low member of pair 2
    nodeRadii[7] = r - 2 // the high member of pair 2
    const custom: Layout = { ...base, x, y, nodeRadii }
    const scene = buildZoneScene(g, custom, routeGates(g, custom), routeCurrents(g, custom))
    const seg = (q: number): number[] => Array.from(scene.syzygySeg.subarray(4 * q, 4 * q + 4))
    expect(seg(0)).toEqual([100, 100, 100 + 2 * r, 100])
    expect(seg(1)).toEqual([200, 200, 200 + 1.5 * r, 200])
    expect(seg(2)).toEqual([300 + (r + 3), 300, 300 + 2 * r + 0.5 - (r - 2), 300])
    for (let q = 0; q < g.pairCount; q++) expect(seg(q)).toEqual(expectedSyzygy(g, custom, q))
  })

  it('draws the same lines as the SVG tier (rounded as the emitter rounds)', () => {
    const picks: ZoneCase[] = [
      { base: 2, id: 'ring' },
      { base: 4, id: 'spiral' },
      { base: 10, id: 'ring' },
      { base: 10, id: 'ladder' },
      { base: 28, id: 'ring' },
      { base: 28, id: 'spiral' },
      { base: 64, id: 'ladder' },
      { base: 202, id: 'ring' },
    ]
    const mismatches: string[] = []
    for (const c of picks) {
      const { g, layout, scene } = buildFresh(c)
      const svg = layoutToSvg(g, layout, { gates: 'off', currents: false, labels: 'none' })
      const group = /<g class="syzygies"[^>]*>([\s\S]*?)<\/g>/.exec(svg)
      if (group === null) {
        mismatches.push(`${tagOf(c)} no syzygies group`)
        continue
      }
      const lines = [...(group[1] ?? '').matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"\/>/g)]
      if (lines.length !== g.pairCount) {
        mismatches.push(`${tagOf(c)} ${lines.length} lines != ${g.pairCount} pairs`)
        continue
      }
      lines.forEach((m, q) => {
        for (let i = 0; i < 4; i++) {
          const got = fmt(scene.syzygySeg[4 * q + i] ?? NaN)
          if (got !== m[i + 1]) mismatches.push(`${tagOf(c)} pair ${q} component ${i}: ${got} != ${m[i + 1]}`)
        }
      })
    }
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('buildZoneScene: currents and gates are the engine routes', () => {
  it('currentCurves (18 per pair) and gateCurves (6 per zone) have the route string endpoints and control', () => {
    sweep((c, b, push) => {
      const { g, gates, currents, scene } = b
      const P = g.pairCount
      const n = g.zoneCount
      if (scene.currentCurves.length !== CURRENT_STRIDE * P) push(`currentCurves length ${scene.currentCurves.length}`)
      if (scene.gateCurves.length !== CURVE_STRIDE * n) push(`gateCurves length ${scene.gateCurves.length}`)
      const compare = (what: string, curves: Float64Array, offset: number, d: string): void => {
        const e = endpoints(d)
        const got = Array.from(curves.subarray(offset, offset + CURVE_STRIDE))
        const want = [e.sx, e.sy, e.cx, e.cy, e.ex, e.ey]
        for (let i = 0; i < CURVE_STRIDE; i++) {
          if (got[i] !== want[i]) {
            push(`${what}: [${got.join(',')}] != [${want.join(',')}] for ${d}`)
            return
          }
        }
      }
      for (let q = 0; q < P; q++) {
        compare(`pair ${q} legA`, scene.currentCurves, CURRENT_STRIDE * q, currents.legA[q] ?? '')
        compare(`pair ${q} legB`, scene.currentCurves, CURRENT_STRIDE * q + CURVE_STRIDE, currents.legB[q] ?? '')
        compare(`pair ${q} stem`, scene.currentCurves, CURRENT_STRIDE * q + 2 * CURVE_STRIDE, currents.stem[q] ?? '')
      }
      for (let z = 0; z < n; z++) compare(`gate ${z}`, scene.gateCurves, CURVE_STRIDE * z, gates.d[z] ?? '')
    })
  })

  it('kind, junction, loop, to and label arrays equal the route arrays; currentTo is g.current(q).to', () => {
    sweep((c, b, push) => {
      const { g, gates, currents, scene } = b
      if (!sameNumbers(scene.currentKind, currents.kind)) push('currentKind differs')
      if (!sameNumbers(scene.junctionX, currents.junctionX)) push('junctionX differs')
      if (!sameNumbers(scene.junctionY, currents.junctionY)) push('junctionY differs')
      if (!sameNumbers(scene.gateLoop, gates.loop)) push('gateLoop differs')
      if (!sameNumbers(scene.gateTo, gates.to)) push('gateTo differs')
      if (!sameNumbers(scene.gateLabelX, gates.labelX)) push('gateLabelX differs')
      if (!sameNumbers(scene.gateLabelY, gates.labelY)) push('gateLabelY differs')
      if (scene.currentTo.length !== g.pairCount) push('currentTo length')
      for (let q = 0; q < g.pairCount; q++) {
        if (scene.currentTo[q] !== g.current(q).to) push(`currentTo[${q}] ${scene.currentTo[q]} != ${g.current(q).to}`)
      }
    })
  })

  it('NaN appears only in curves whose route string is empty, and Infinity never appears', () => {
    sweep((c, b, push) => {
      const { gates, currents, scene } = b
      const empties =
        gates.d.filter(d => d === '').length +
        currents.legA.filter(d => d === '').length +
        currents.legB.filter(d => d === '').length +
        currents.stem.filter(d => d === '').length
      let nanCurves = 0
      for (const arr of [scene.currentCurves, scene.gateCurves]) for (const v of arr) if (Number.isNaN(v)) nanCurves += 1
      if (nanCurves !== CURVE_STRIDE * empties) push(`${nanCurves} NaN curve values for ${empties} empty strings`)
      for (const [name, value] of Object.entries(scene)) {
        if (!ArrayBuffer.isView(value) || value instanceof Int32Array || value instanceof Uint8Array) continue
        const arr = value as unknown as Float64Array
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i] ?? 0
          if (v === Infinity || v === -Infinity) {
            push(`${name}[${i}] is infinite`)
            break
          }
          if (Number.isNaN(v) && name !== 'currentCurves' && name !== 'gateCurves') {
            push(`${name}[${i}] is NaN outside a curve array`)
            break
          }
        }
      }
    })
  })

  it('an empty route string becomes a NaN curve with no pick segments; a bad one throws', () => {
    const g = createNumogram(10)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const gates = routeGates(g, layout)
    const currents = routeCurrents(g, layout)
    const blankGates: GateRoutes = { ...gates, d: gates.d.map((d, z) => (z === 3 ? '' : d)) }
    const blankCurrents: CurrentRoutes = { ...currents, legB: currents.legB.map((d, q) => (q === 1 ? '' : d)) }
    const scene = buildZoneScene(g, layout, blankGates, blankCurrents)
    const P = g.pairCount
    expect(Array.from(scene.gateCurves.subarray(18, 24)).every(Number.isNaN)).toBe(true)
    expect(Array.from(scene.currentCurves.subarray(CURRENT_STRIDE + 6, CURRENT_STRIDE + 12)).every(Number.isNaN)).toBe(true)
    const gateEdge = 2 * P + 3
    expect(scene.edgeSegStart[gateEdge + 1]).toBe(scene.edgeSegStart[gateEdge])
    expect(Array.from(scene.edgeBox.subarray(4 * gateEdge, 4 * gateEdge + 4)).every(Number.isNaN)).toBe(true)
    const currentEdge = P + 1
    expect((scene.edgeSegStart[currentEdge + 1] ?? 0) - (scene.edgeSegStart[currentEdge] ?? 0)).toBe(2 * PICK_FLATTEN_STEPS)
    expect(Array.from(scene.pickSegments).some(Number.isNaN)).toBe(false)

    const cubic: GateRoutes = { ...gates, d: gates.d.map((d, z) => (z === 0 ? 'M1 2C3 4 5 6 7 8' : d)) }
    expect(() => buildZoneScene(g, layout, cubic, currents)).toThrow(RangeError)
  })

  it('an empty route string on the very last edge builds too (a NaN curve reserves no pick space)', () => {
    const g = createNumogram(10)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const gates = routeGates(g, layout)
    const currents = routeCurrents(g, layout)
    const n = g.zoneCount
    const lastGates: GateRoutes = { ...gates, d: gates.d.map((d, z) => (z === n - 1 ? '' : d)) }
    const scene = buildZoneScene(g, layout, lastGates, currents)
    const E = edgeCount(scene)
    expect(E).toBe(2 * g.pairCount + n)
    expect(scene.edgeSegStart[E]).toBe(scene.edgeSegStart[E - 1])
    expect(scene.edgeSegStart[E]).toBe(scene.pickSegments.length / 4)
    expect(Array.from(scene.edgeBox.subarray(4 * (E - 1))).every(Number.isNaN)).toBe(true)

    // every curve of every pair blank, and the last gate too: the whole tail of the CSR is empty
    const blank = (list: readonly string[]): string[] => list.map(() => '')
    const allBlank: CurrentRoutes = { ...currents, legA: blank(currents.legA), legB: blank(currents.legB), stem: blank(currents.stem) }
    const emptyScene = buildZoneScene(g, layout, { ...gates, d: blank(gates.d) }, allBlank)
    expect(emptyScene.pickSegments.length).toBe(4 * g.pairCount) // only the syzygies remain
    expect(emptyScene.edgeSegStart[edgeCount(emptyScene)]).toBe(g.pairCount)
  })

  it('routes of the wrong length throw instead of reading past them', () => {
    const g = createNumogram(10)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const gates = routeGates(g, layout)
    const currents = routeCurrents(g, layout)
    expect(() => buildZoneScene(g, layout, { ...gates, d: gates.d.slice(1) }, currents)).toThrow(RangeError)
    expect(() => buildZoneScene(g, layout, gates, { ...currents, stem: currents.stem.slice(1) })).toThrow(RangeError)
    expect(() => buildZoneScene(g, layout, gates, { ...currents, legA: currents.legA.slice(1) })).toThrow(RangeError)
    expect(() => buildZoneScene(g, layout, gates, { ...currents, legB: currents.legB.slice(1) })).toThrow(RangeError)
    expect(() => buildZoneScene(g, layout, { ...gates, d: [...gates.d, 'M0 0L1 1'] }, currents)).toThrow(RangeError)
  })
})

describe('buildZoneScene: pick segments and edge boxes', () => {
  it('edge order is syzygies, currents, gates; segment counts and the CSR index are exact', () => {
    sweep((c, b, push) => {
      const { g, scene } = b
      const P = g.pairCount
      const n = g.zoneCount
      const E = 2 * P + n
      if (edgeCount(scene) !== E) push(`edgeCount ${edgeCount(scene)} != ${E}`)
      if (edgeCount(scene) !== 2 * (n / 2) + n) push('edgeCount is not 2 * pairs + zones')
      if (scene.edgeSegStart.length !== E + 1) {
        push(`edgeSegStart length ${scene.edgeSegStart.length}`)
        return
      }
      if (scene.edgeSegStart[0] !== 0) push('edgeSegStart does not start at 0')
      if (scene.edgeSegStart[E] !== scene.pickSegments.length / 4) push('edgeSegStart does not end at the segment count')
      if (scene.edgeBox.length !== 4 * E) push('edgeBox length')
      const countOf = (e: number): number => (scene.edgeSegStart[e + 1] ?? 0) - (scene.edgeSegStart[e] ?? 0)
      const nonNaN = (arr: Float64Array, o: number): number => (Number.isNaN(arr[o]) ? 0 : 1)
      for (let e = 0; e < E; e++) {
        if (countOf(e) < 0) push(`edge ${e} has a negative segment count`)
        let want: number
        if (e < P) want = 1
        else if (e < 2 * P) {
          const o = CURRENT_STRIDE * (e - P)
          want =
            PICK_FLATTEN_STEPS *
            (nonNaN(scene.currentCurves, o) + nonNaN(scene.currentCurves, o + CURVE_STRIDE) + nonNaN(scene.currentCurves, o + 2 * CURVE_STRIDE))
        } else want = PICK_FLATTEN_STEPS * nonNaN(scene.gateCurves, CURVE_STRIDE * (e - 2 * P))
        if (countOf(e) !== want) push(`edge ${e} has ${countOf(e)} segments, expected ${want}`)
      }
      if (EDGE_KIND.syzygy !== 0 || EDGE_KIND.current !== 1 || EDGE_KIND.gate !== 2) push('EDGE_KIND values')
    })
  })

  it('syzygy edges are their own segment; current and gate edges are the flattened curves in order', () => {
    sweep((c, b, push) => {
      const { g, scene } = b
      const P = g.pairCount
      const n = g.zoneCount
      const want = new Float64Array(4 * PICK_FLATTEN_STEPS)
      const edgeStart = (e: number): number => 4 * (scene.edgeSegStart[e] ?? 0)
      for (let q = 0; q < P; q++) {
        const o = edgeStart(q)
        for (let i = 0; i < 4; i++) {
          if (scene.pickSegments[o + i] !== scene.syzygySeg[4 * q + i]) {
            push(`syzygy edge ${q} segment differs`)
            break
          }
        }
      }
      for (let q = 0; q < P; q++) {
        let o = edgeStart(P + q)
        for (let leg = 0; leg < 3; leg++) {
          flattenQuad(scene.currentCurves, CURRENT_STRIDE * q + CURVE_STRIDE * leg, PICK_FLATTEN_STEPS, want, 0)
          for (let i = 0; i < want.length; i++) {
            if (scene.pickSegments[o + i] !== want[i]) {
              push(`current edge ${q} leg ${leg} chord data differs at ${i}`)
              break
            }
          }
          o += want.length
        }
      }
      for (let z = 0; z < n; z++) {
        const o = edgeStart(2 * P + z)
        flattenQuad(scene.gateCurves, CURVE_STRIDE * z, PICK_FLATTEN_STEPS, want, 0)
        for (let i = 0; i < want.length; i++) {
          if (scene.pickSegments[o + i] !== want[i]) {
            push(`gate edge ${z} chord data differs at ${i}`)
            break
          }
        }
        const gx0 = scene.gateCurves[CURVE_STRIDE * z] ?? NaN
        const gy1 = scene.gateCurves[CURVE_STRIDE * z + 5] ?? NaN
        if (scene.pickSegments[o] !== gx0) push(`gate edge ${z} does not start at the curve start`)
        if (scene.pickSegments[o + want.length - 1] !== gy1) push(`gate edge ${z} does not end at the curve end`)
      }
    })
  })

  it('every segment endpoint lies inside its edge box', () => {
    sweep((c, b, push) => {
      const { g, scene } = b
      const E = 2 * g.pairCount + g.zoneCount
      const eps = 1e-9
      for (let e = 0; e < E; e++) {
        const from = scene.edgeSegStart[e] ?? 0
        const to = scene.edgeSegStart[e + 1] ?? 0
        const minX = scene.edgeBox[4 * e] ?? NaN
        const minY = scene.edgeBox[4 * e + 1] ?? NaN
        const maxX = scene.edgeBox[4 * e + 2] ?? NaN
        const maxY = scene.edgeBox[4 * e + 3] ?? NaN
        if (from === to) {
          push(`edge ${e} has no segments`)
          continue
        }
        if (!(minX <= maxX && minY <= maxY)) push(`edge ${e} box is inverted`)
        for (let s = from; s < to; s++) {
          for (let k = 0; k < 2; k++) {
            const x = scene.pickSegments[4 * s + 2 * k] ?? NaN
            const y = scene.pickSegments[4 * s + 2 * k + 1] ?? NaN
            if (!(x >= minX - eps && x <= maxX + eps && y >= minY - eps && y <= maxY + eps)) {
              push(`edge ${e} segment ${s} point ${k} (${x}, ${y}) is outside its box`)
            }
          }
        }
      }
    })
  })
})

describe('buildZoneScene: determinism and transferable buffers', () => {
  it('two builds of the same input are element-wise identical', () => {
    const picks: ZoneCase[] = [
      { base: 2, id: 'ladder' },
      { base: 28, id: 'ring' },
      { base: 64, id: 'spiral' },
      { base: 666, id: 'ring' },
      { base: 4000, id: 'ladder' },
    ]
    const mismatches: string[] = []
    for (const c of picks) {
      const a = buildFresh(c).scene
      const b = buildFresh(c).scene
      for (const [name, value] of Object.entries(a)) {
        const other = (b as unknown as Record<string, unknown>)[name]
        if (ArrayBuffer.isView(value)) {
          if (!sameNumbers(value as unknown as Float64Array, other as Float64Array)) mismatches.push(`${tagOf(c)} ${name} differs`)
        } else if (JSON.stringify(value) !== JSON.stringify(other)) {
          mismatches.push(`${tagOf(c)} ${name} differs`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('every typed array owns a whole buffer of its own, and none is a layout or route array (T-06-13)', () => {
    sweep((c, b, push) => {
      const { layout, gates, currents, scene } = b
      const arrays = typedArraysOf(scene)
      if (arrays.length !== 17) push(`expected 17 typed arrays, found ${arrays.length}`)
      const buffers = new Set(arrays.map(a => a.buffer))
      if (buffers.size !== arrays.length) push(`${buffers.size} distinct buffers for ${arrays.length} typed arrays`)
      for (const a of arrays) {
        if (a.byteOffset !== 0 || a.byteLength !== a.buffer.byteLength) push('a typed array is a view onto part of a buffer')
      }
      const foreign = new Set<ArrayBufferLike>([
        layout.x.buffer,
        layout.y.buffer,
        layout.drawOrder.buffer,
        gates.labelX.buffer,
        gates.labelY.buffer,
        gates.loop.buffer,
        gates.to.buffer,
        currents.kind.buffer,
        currents.junctionX.buffer,
        currents.junctionY.buffer,
      ])
      for (const a of arrays) if (foreign.has(a.buffer)) push('a scene array shares a buffer with the layout or the routes')
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The pair-graph scene (Task 2) and the guards of both builders

const PAIR_BASES: number[] = []
for (let n = 2; n <= 64; n += 2) PAIR_BASES.push(n)
PAIR_BASES.push(202, 666, 1024, 4000)

interface PairBuilt {
  readonly g: Numogram
  readonly layout: PairGraphLayout
  readonly routes: PairGraphRoutes
  readonly scene: CanvasScene
}

function pairBuildFresh(base: number): PairBuilt {
  const g = createNumogram(base)
  const layout = pairGraphLayout(g, { packer: 'shelf' })
  const routes = routePairGraph(g, layout)
  return { g, layout, routes, scene: buildPairScene(g, layout, routes) }
}

const pairMemo = new Map<number, PairBuilt>()
function pairBuilt(base: number): PairBuilt {
  let b = pairMemo.get(base)
  if (b === undefined) {
    b = pairBuildFresh(base)
    pairMemo.set(base, b)
  }
  return b
}

function pairSweep(check: (base: number, b: PairBuilt, push: (msg: string) => void) => void): void {
  const mismatches: string[] = []
  for (const base of PAIR_BASES) {
    const push = (msg: string): void => {
      if (mismatches.length < MAX_MISMATCHES) mismatches.push(`n=${base} pairGraph ${msg}`)
    }
    check(base, pairBuilt(base), push)
  }
  expect(mismatches.slice(0, 20)).toEqual([])
}

describe('buildPairScene', () => {
  it('copies the layout: x, y, drawOrder, px, py, pill size, frame and region labels, each on its own buffer', () => {
    pairSweep((base, b, push) => {
      const { g, layout, scene } = b
      if (scene.kind !== 'pairs') push(`kind ${scene.kind}`)
      if (scene.base !== base) push(`base ${scene.base}`)
      if (scene.layoutId !== 'pairGraph' || scene.layoutId !== layout.id) push(`layoutId ${scene.layoutId}`)
      if (!sameNumbers(scene.x, layout.x)) push('x differs')
      if (!sameNumbers(scene.y, layout.y)) push('y differs')
      if (!sameNumbers(scene.drawOrder, layout.drawOrder)) push('drawOrder differs')
      if (scene.px === null || scene.py === null) {
        push('px or py is null')
        return
      }
      if (!sameNumbers(scene.px, layout.px)) push('px differs')
      if (!sameNumbers(scene.py, layout.py)) push('py differs')
      if (scene.px.length !== g.pairCount) push('px length')
      if (scene.px === layout.px || scene.px.buffer === layout.px.buffer) push('px aliases the layout array')
      if (scene.py.buffer === layout.py.buffer) push('py aliases the layout array')
      if (scene.x.buffer === layout.x.buffer || scene.y.buffer === layout.y.buffer) push('x or y aliases the layout')
      if (scene.drawOrder.buffer === layout.drawOrder.buffer) push('drawOrder aliases the layout')
      if (scene.pillWidth !== layout.nodeWidth) push(`pillWidth ${scene.pillWidth} != ${layout.nodeWidth}`)
      if (scene.pillHeight !== layout.nodeHeight) push(`pillHeight ${scene.pillHeight} != ${layout.nodeHeight}`)
      if (scene.width !== layout.width || scene.height !== layout.height) push('frame differs')
      if (scene.centerX !== layout.center.x || scene.centerY !== layout.center.y) push('centre differs')
      if (scene.nodeRadius !== layout.nodeRadius) push('nodeRadius differs')
      if (scene.labelSize !== layout.labelSize) push('labelSize differs')
      if (scene.strokeScale !== layout.strokeScale) push('strokeScale differs')
      if (JSON.stringify(scene.regionLabels) !== JSON.stringify(layout.regionLabels)) push('regionLabels differ')
    })
  })

  it('pairArc and pairLoop hold the routes\' own strings in new arrays', () => {
    pairSweep((base, b, push) => {
      const { routes, scene } = b
      if (scene.pairArc === null || scene.pairLoop === null) {
        push('pairArc or pairLoop is null')
        return
      }
      if (scene.pairArc === routes.arc || scene.pairLoop === routes.loop) push('a route array is shared')
      if (scene.pairArc.length !== routes.arc.length || scene.pairLoop.length !== routes.loop.length) push('length differs')
      for (let q = 0; q < routes.arc.length; q++) {
        if (scene.pairArc[q] !== routes.arc[q]) push(`arc ${q} differs`)
        if (scene.pairLoop[q] !== routes.loop[q]) push(`loop ${q} differs`)
      }
    })
  })

  it('currentTo is g.current(q).to; every zone-only array is empty; there are no edges to pick', () => {
    pairSweep((base, b, push) => {
      const { g, scene } = b
      if (scene.currentTo.length !== g.pairCount) push('currentTo length')
      for (let q = 0; q < g.pairCount; q++) {
        if (scene.currentTo[q] !== g.current(q).to) push(`currentTo[${q}] ${scene.currentTo[q]} != ${g.current(q).to}`)
      }
      const empties: ReadonlyArray<readonly [string, ArrayLike<number>]> = [
        ['syzygySeg', scene.syzygySeg],
        ['currentCurves', scene.currentCurves],
        ['currentKind', scene.currentKind],
        ['junctionX', scene.junctionX],
        ['junctionY', scene.junctionY],
        ['gateCurves', scene.gateCurves],
        ['gateLoop', scene.gateLoop],
        ['gateTo', scene.gateTo],
        ['gateLabelX', scene.gateLabelX],
        ['gateLabelY', scene.gateLabelY],
        ['pickSegments', scene.pickSegments],
        ['edgeBox', scene.edgeBox],
      ]
      for (const [name, arr] of empties) if (arr.length !== 0) push(`${name} has length ${arr.length}, expected 0`)
      if (!sameNumbers(scene.edgeSegStart, Int32Array.of(0))) push('edgeSegStart is not Int32Array.of(0)')
      if (edgeCount(scene) !== 0) push(`edgeCount ${edgeCount(scene)}`)
    })
  })

  it('every typed array (the empty ones included) owns a whole buffer of its own (T-06-13)', () => {
    pairSweep((base, b, push) => {
      const { layout, scene } = b
      const arrays = typedArraysOf(scene)
      if (arrays.length !== 19) push(`expected 19 typed arrays, found ${arrays.length}`)
      const buffers = new Set(arrays.map(a => a.buffer))
      if (buffers.size !== arrays.length) push(`${buffers.size} distinct buffers for ${arrays.length} typed arrays`)
      for (const a of arrays) {
        if (a.byteOffset !== 0 || a.byteLength !== a.buffer.byteLength) push('a typed array is a view onto part of a buffer')
      }
      const foreign = new Set<ArrayBufferLike>([
        layout.x.buffer,
        layout.y.buffer,
        layout.drawOrder.buffer,
        layout.px.buffer,
        layout.py.buffer,
      ])
      for (const a of arrays) if (foreign.has(a.buffer)) push('a scene array shares a buffer with the layout')
    })
  })

  it('two builds of the same input are element-wise identical', () => {
    const mismatches: string[] = []
    for (const base of [2, 28, 64, 666, 4000]) {
      const a = pairBuildFresh(base).scene
      const b = pairBuildFresh(base).scene
      for (const [name, value] of Object.entries(a)) {
        const other = (b as unknown as Record<string, unknown>)[name]
        if (ArrayBuffer.isView(value)) {
          if (!sameNumbers(value as unknown as Float64Array, other as Float64Array)) mismatches.push(`n=${base} ${name} differs`)
        } else if (JSON.stringify(value) !== JSON.stringify(other)) {
          mismatches.push(`n=${base} ${name} differs`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('a layout that is not a pair graph, or routes of the wrong length, throw a RangeError', () => {
    const g = createNumogram(10)
    const ring = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const pg = pairGraphLayout(g, { packer: 'shelf' })
    const routes = routePairGraph(g, pg)
    expect(() => buildPairScene(g, ring as unknown as PairGraphLayout, routes)).toThrow(RangeError)
    expect(() => buildPairScene(g, pg, { arc: routes.arc.slice(1), loop: routes.loop })).toThrow(RangeError)
    expect(() => buildPairScene(g, pg, { arc: routes.arc, loop: routes.loop.slice(1) })).toThrow(RangeError)
    expect(() => buildPairScene(g, { ...pg, px: pg.px.slice(1) }, routes)).toThrow(RangeError)
    expect(() => buildPairScene(g, { ...pg, py: pg.py.slice(1) }, routes)).toThrow(RangeError)
  })
})

describe('canvasScene guards: a layout must belong to the numogram and to the right builder', () => {
  it('buildPairScene and buildZoneScene reject a layout of another base', () => {
    const g10 = createNumogram(10)
    const g12 = createNumogram(12)
    const ring12 = resolveLayout(g12, 'ring', [], { packer: 'shelf' })
    const pg12 = pairGraphLayout(g12, { packer: 'shelf' })
    const message = /^canvasScene: layout base 12 does not match numogram base 10$/
    expect(() => buildZoneScene(g10, ring12, routeGates(g12, ring12), routeCurrents(g12, ring12))).toThrow(RangeError)
    expect(() => buildZoneScene(g10, ring12, routeGates(g12, ring12), routeCurrents(g12, ring12))).toThrow(message)
    expect(() => buildPairScene(g10, pg12, routePairGraph(g12, pg12))).toThrow(RangeError)
    expect(() => buildPairScene(g10, pg12, routePairGraph(g12, pg12))).toThrow(message)
  })

  it('buildZoneScene rejects a pair-graph layout so a caller cannot mix kinds', () => {
    const g = createNumogram(10)
    const pg = pairGraphLayout(g, { packer: 'shelf' })
    const gates = routeGates(g, pg)
    const currents = routeCurrents(g, pg)
    expect(() => buildZoneScene(g, pg, gates, currents)).toThrow(RangeError)
    expect(() => buildZoneScene(g, pg, gates, currents)).toThrow('canvasScene: buildZoneScene got a pair-graph layout')
  })

  it('a base mismatch is reported before the kind', () => {
    const g10 = createNumogram(10)
    const g12 = createNumogram(12)
    const pg12 = pairGraphLayout(g12, { packer: 'shelf' })
    expect(() => buildZoneScene(g10, pg12, routeGates(g12, pg12), routeCurrents(g12, pg12))).toThrow(/layout base 12 does not match/)
  })
})
