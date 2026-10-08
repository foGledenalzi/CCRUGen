// Tests for app/lib/canvas/pickIndex.ts (REN-02, D-09, 06-05 Task 2): the geometric pick index. Hover, click, tap and
// keyboard all resolve through pickAt, never from raster pixels (the DemonMatrix cellAtPixel contract). Every truth is
// checked against an independent brute-force reference written here with its own distance formulas: the grid zone pick
// equals a brute-force nearest search, the whole pick (zones, syzygies, currents, gates, pills, chords, tie order)
// equals a brute-force pick for random points, filters and chords. The spec radius is pinned as the literal below, so
// a changed PICK_RADIUS_PX cannot move the reference with it.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  PICK_FLATTEN_STEPS,
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
} from '../../engine/index'
import type { CanvasScene } from '../../engine/index'
import { curveAway } from '../../app/lib/geometry'
import type { Demon } from '../../app/data/types'
import {
  PICK_RADIUS_PX,
  TIE_ORDER,
  buildZoneGrid,
  distToSegment,
  distToStadium,
  flattenChords,
  pickAt,
  zonesInWorldRect,
  type FlatChords,
  type PickFilter,
  type PickHit,
  type PickKind,
  type ZoneGrid,
} from '../../app/lib/canvas/pickIndex'

const SPEC_RADIUS_PX = 12 // UI-SPEC "Pick radius 12 CSS px" (D-09), pinned here independently of the module's constant
const EPS = 1e-9

const allowAll: PickFilter = { zoneAllowed: () => true, edgeAllowed: () => true }
const noEdges: PickFilter = { zoneAllowed: () => true, edgeAllowed: () => false }
const noGates: PickFilter = { zoneAllowed: () => true, edgeAllowed: kind => kind !== 'gate' }

// ── Scenes (built once) ───────────────────────────────────────────────────────────────────────────────────────────────

interface Ring {
  readonly scene: CanvasScene
  readonly grid: ZoneGrid
}
const rings = new Map<number, Ring>()
function ring(base: number): Ring {
  let r = rings.get(base)
  if (r === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const scene = buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
    r = { scene, grid: buildZoneGrid(scene.x, scene.y, scene.nodeRadius) }
    rings.set(base, r)
  }
  return r
}

const ladders = new Map<number, Ring>()
function ladder(base: number): Ring {
  let r = ladders.get(base)
  if (r === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, 'ladder', [], { packer: 'shelf' })
    const scene = buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
    r = { scene, grid: buildZoneGrid(scene.x, scene.y, scene.nodeRadius) }
    ladders.set(base, r)
  }
  return r
}

const pairScenes = new Map<number, Ring>()
function pairs(base: number): Ring {
  let r = pairScenes.get(base)
  if (r === undefined) {
    const g = createNumogram(base)
    const layout = pairGraphLayout(g, { packer: 'shelf' })
    const scene = buildPairScene(g, layout, routePairGraph(g, layout))
    r = { scene, grid: buildZoneGrid(scene.x, scene.y, scene.nodeRadius) }
    pairScenes.set(base, r)
  }
  return r
}

// A hand-made zones scene on a base-6 template (3 pairs, 6 zones, 12 edges: syzygies 0..2, currents 3..5, gates 6..11).
const SYN_P = 3
const SYN_SYZ = (q: number): number => q
const SYN_CUR = (q: number): number => SYN_P + q
const SYN_GATE = (z: number): number => 2 * SYN_P + z
interface Syn {
  readonly x: number[]
  readonly y: number[]
  readonly radius: number
  readonly segs?: Readonly<Record<number, readonly (readonly number[])[]>> // edge index -> segments [x0, y0, x1, y1]
}
function synthetic(spec: Syn): { scene: CanvasScene; grid: ZoneGrid } {
  const template = ring(6).scene
  const edges = 2 * SYN_P + 6
  const starts = new Int32Array(edges + 1)
  const flat: number[] = []
  const boxes = new Float64Array(4 * edges)
  for (let e = 0; e < edges; e++) {
    const segs = spec.segs?.[e] ?? []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const s of segs) {
      flat.push(s[0] ?? NaN, s[1] ?? NaN, s[2] ?? NaN, s[3] ?? NaN)
      minX = Math.min(minX, s[0] ?? NaN, s[2] ?? NaN)
      maxX = Math.max(maxX, s[0] ?? NaN, s[2] ?? NaN)
      minY = Math.min(minY, s[1] ?? NaN, s[3] ?? NaN)
      maxY = Math.max(maxY, s[1] ?? NaN, s[3] ?? NaN)
    }
    starts[e + 1] = (starts[e] ?? 0) + segs.length
    if (segs.length === 0) boxes.fill(NaN, 4 * e, 4 * e + 4)
    else boxes.set([minX, minY, maxX, maxY], 4 * e)
  }
  const scene: CanvasScene = {
    ...template,
    x: Float64Array.from(spec.x),
    y: Float64Array.from(spec.y),
    nodeRadius: spec.radius,
    edgeSegStart: starts,
    edgeBox: boxes,
    pickSegments: Float64Array.from(flat),
  }
  return { scene, grid: buildZoneGrid(scene.x, scene.y, scene.nodeRadius) }
}
const FAR = 100_000 // zones parked far from the action
const FAR_ZONES = { x: [FAR, FAR + 100, FAR + 200, FAR + 300, FAR + 400, FAR + 500], y: [FAR, FAR, FAR, FAR, FAR, FAR] }

// ── Independent brute-force reference ─────────────────────────────────────────────────────────────────────────────────

const REF_RANK: Readonly<Record<PickKind, number>> = { zone: 0, pair: 0, syzygy: 1, current: 2, gate: 3, chord: 4 }

function refSegDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy) / len2))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

function refStadiumDist(px: number, py: number, cx: number, cy: number, w: number, h: number): number {
  const half = Math.max(0, (w - h) / 2)
  const qx = Math.min(cx + half, Math.max(cx - half, px))
  return Math.max(0, Math.hypot(px - qx, py - cy) - h / 2)
}

interface Cand {
  readonly kind: PickKind
  readonly id: number
  readonly d: number
}

function pairMembersOf(base: number, q: number): [number, number] {
  return [q, base - 1 - q]
}

/** Every candidate with its distance in CSS px (no radius cut), by brute force. */
function refCandidates(scene: CanvasScene, wx: number, wy: number, s: number, filter: PickFilter, chords: FlatChords | null = null): Cand[] {
  const out: Cand[] = []
  const R = scene.nodeRadius
  if (scene.kind === 'zones') {
    for (let z = 0; z < scene.x.length; z++) {
      if (!filter.zoneAllowed(z)) continue
      out.push({ kind: 'zone', id: z, d: Math.max(0, Math.hypot(wx - (scene.x[z] ?? NaN), wy - (scene.y[z] ?? NaN)) * s - R * s) })
    }
    const P = scene.currentTo.length
    for (let e = 0; e < scene.edgeSegStart.length - 1; e++) {
      const kind = e < P ? 'syzygy' : e < 2 * P ? 'current' : 'gate'
      const id = e < P ? e : e < 2 * P ? e - P : e - 2 * P
      const a = scene.edgeSegStart[e] ?? 0
      const b = scene.edgeSegStart[e + 1] ?? 0
      if (a === b || !filter.edgeAllowed(kind, id)) continue
      let best = Infinity
      for (let k = a; k < b; k++) {
        best = Math.min(
          best,
          refSegDist(wx, wy, scene.pickSegments[4 * k] ?? NaN, scene.pickSegments[4 * k + 1] ?? NaN, scene.pickSegments[4 * k + 2] ?? NaN, scene.pickSegments[4 * k + 3] ?? NaN),
        )
      }
      out.push({ kind, id, d: best * s })
    }
  } else if (scene.px !== null && scene.py !== null) {
    for (let q = 0; q < scene.px.length; q++) {
      const [lo, hi] = pairMembersOf(scene.base, q)
      if (!filter.zoneAllowed(lo) || !filter.zoneAllowed(hi)) continue
      out.push({ kind: 'pair', id: q, d: refStadiumDist(wx, wy, scene.px[q] ?? NaN, scene.py[q] ?? NaN, scene.pillWidth, scene.pillHeight) * s })
    }
  }
  if (chords !== null) {
    for (let c = 0; c < chords.chordStart.length - 1; c++) {
      const a = chords.chordStart[c] ?? 0
      const b = chords.chordStart[c + 1] ?? 0
      if (a === b || !filter.zoneAllowed(chords.zoneA[c] ?? -1) || !filter.zoneAllowed(chords.zoneB[c] ?? -1)) continue
      let best = Infinity
      for (let k = a; k < b; k++) {
        best = Math.min(
          best,
          refSegDist(wx, wy, chords.segments[4 * k] ?? NaN, chords.segments[4 * k + 1] ?? NaN, chords.segments[4 * k + 2] ?? NaN, chords.segments[4 * k + 3] ?? NaN),
        )
      }
      out.push({ kind: 'chord', id: c, d: best * s })
    }
  }
  return out
}

function refPick(scene: CanvasScene, wx: number, wy: number, s: number, filter: PickFilter, chords: FlatChords | null = null): Cand | null {
  let best: Cand | null = null
  for (const c of refCandidates(scene, wx, wy, s, filter, chords)) {
    if (!(c.d <= SPEC_RADIUS_PX)) continue
    if (
      best === null ||
      c.d < best.d ||
      (c.d === best.d && (REF_RANK[c.kind] < REF_RANK[best.kind] || (REF_RANK[c.kind] === REF_RANK[best.kind] && c.id < best.id)))
    ) {
      best = c
    }
  }
  return best
}

function sameHit(hit: PickHit | null, ref: Cand | null): void {
  if (ref === null) {
    expect(hit).toBeNull()
    return
  }
  expect(hit).not.toBeNull()
  expect(hit?.kind).toBe(ref.kind)
  expect(hit?.id).toBe(ref.id)
  expect(Math.abs((hit?.distancePx ?? NaN) - ref.d)).toBeLessThan(1e-6)
}

/** The smallest brute-force distance over every candidate except the target (Infinity when there is none). */
function nearestOther(cands: Cand[], target: { kind: PickKind; id: number }): number {
  let best = Infinity
  for (const c of cands) if (!(c.kind === target.kind && c.id === target.id)) best = Math.min(best, c.d)
  return best
}
function distOf(cands: Cand[], target: { kind: PickKind; id: number }): number {
  const c = cands.find(k => k.kind === target.kind && k.id === target.id)
  return c === undefined ? NaN : c.d
}

function* around(cx: number, cy: number, radius: number, steps = 16): Generator<[number, number]> {
  for (let k = 0; k < steps; k++) {
    const a = (k * 2 * Math.PI) / steps
    yield [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]
  }
}

/** Points offset `offsetPx` to either side of the midpoint of each segment of edge `e` (world coordinates). */
function* besideEdge(scene: CanvasScene, e: number, offsetPx: number, s: number): Generator<[number, number]> {
  const a = scene.edgeSegStart[e] ?? 0
  const b = scene.edgeSegStart[e + 1] ?? 0
  for (let k = a; k < b; k++) {
    const x0 = scene.pickSegments[4 * k] ?? NaN
    const y0 = scene.pickSegments[4 * k + 1] ?? NaN
    const x1 = scene.pickSegments[4 * k + 2] ?? NaN
    const y1 = scene.pickSegments[4 * k + 3] ?? NaN
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (!(len > 0)) continue
    const nx = -(y1 - y0) / len
    const ny = (x1 - x0) / len
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    yield [mx + (nx * offsetPx) / s, my + (ny * offsetPx) / s]
    yield [mx - (nx * offsetPx) / s, my - (ny * offsetPx) / s]
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('the pick radius is 12 CSS px (D-09) and the tie order is zone, syzygy, current, gate, demon chord', () => {
    expect(PICK_RADIUS_PX).toBe(SPEC_RADIUS_PX)
    expect([...TIE_ORDER]).toEqual(['zone', 'syzygy', 'current', 'gate', 'chord'])
  })
})

// ── distances (closed form) ───────────────────────────────────────────────────────────────────────────────────────────

describe('distToSegment', () => {
  it('matches closed-form values: perpendicular foot, both end caps, and a degenerate segment', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3)
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBe(5)
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5)
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBe(0)
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5)
    expect(distToSegment(0, 0, 0, 0, 10, 10)).toBe(0)
    expect(distToSegment(10, 0, 0, 0, 10, 10)).toBeCloseTo(Math.SQRT1_2 * 10, 12)
  })

  it('returns Infinity for any non-finite input', () => {
    expect(distToSegment(NaN, 0, 0, 0, 1, 1)).toBe(Infinity)
    expect(distToSegment(0, Infinity, 0, 0, 1, 1)).toBe(Infinity)
    expect(distToSegment(0, 0, NaN, 0, 1, 1)).toBe(Infinity)
    expect(distToSegment(0, 0, 0, 0, 1, -Infinity)).toBe(Infinity)
  })
})

describe('distToStadium', () => {
  // a pill 20 wide and 10 high centred on the origin: a core from (-5, 0) to (5, 0) with a radius of 5
  it('matches closed-form values: inside, tip, above the core, around an end cap, far along the axis', () => {
    expect(distToStadium(0, 0, 0, 0, 20, 10)).toBe(0)
    expect(distToStadium(8, 0, 0, 0, 20, 10)).toBe(0)
    expect(distToStadium(10, 0, 0, 0, 20, 10)).toBe(0)
    expect(distToStadium(0, 8, 0, 0, 20, 10)).toBe(3)
    expect(distToStadium(0, -9, 0, 0, 20, 10)).toBe(4)
    expect(distToStadium(15, 0, 0, 0, 20, 10)).toBe(5)
    expect(distToStadium(10, 5, 0, 0, 20, 10)).toBeCloseTo(Math.hypot(5, 5) - 5, 12)
    expect(distToStadium(-10, -5, 0, 0, 20, 10)).toBeCloseTo(Math.hypot(5, 5) - 5, 12)
  })

  it('follows the centre', () => {
    expect(distToStadium(100, 208, 100, 200, 20, 10)).toBe(3)
    expect(distToStadium(110, 208, 100, 200, 20, 10)).toBeCloseTo(Math.hypot(5, 8) - 5, 12)
  })

  it('returns Infinity for any non-finite input', () => {
    expect(distToStadium(NaN, 0, 0, 0, 20, 10)).toBe(Infinity)
    expect(distToStadium(0, 0, 0, Infinity, 20, 10)).toBe(Infinity)
    expect(distToStadium(0, 0, 0, 0, NaN, 10)).toBe(Infinity)
    expect(distToStadium(0, 0, 0, 0, 20, NaN)).toBe(Infinity)
  })
})

// ── zone grid ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('buildZoneGrid', () => {
  it('holds every zone exactly once, in a CSR whose cell holds the zones that fall in it', () => {
    const { scene, grid } = ring(202)
    expect(grid.cellStart.length).toBe(grid.cols * grid.rows + 1)
    expect(grid.cellStart[0]).toBe(0)
    expect(grid.cellStart[grid.cols * grid.rows]).toBe(scene.x.length)
    expect(grid.items.length).toBe(scene.x.length)
    for (let i = 1; i < grid.cellStart.length; i++) expect(grid.cellStart[i] ?? 0).toBeGreaterThanOrEqual(grid.cellStart[i - 1] ?? 0)
    expect([...grid.items].sort((a, b) => a - b)).toEqual(Array.from({ length: scene.x.length }, (_, z) => z))
    for (let c = 0; c < grid.cols * grid.rows; c++) {
      const col = c % grid.cols
      const row = Math.floor(c / grid.cols)
      for (let k = grid.cellStart[c] ?? 0; k < (grid.cellStart[c + 1] ?? 0); k++) {
        const z = grid.items[k] ?? -1
        expect(Math.min(grid.cols - 1, Math.floor(((scene.x[z] ?? NaN) - grid.minX) / grid.cellSize))).toBe(col)
        expect(Math.min(grid.rows - 1, Math.floor(((scene.y[z] ?? NaN) - grid.minY) / grid.cellSize))).toBe(row)
      }
    }
  })

  it('uses a cell about four nodes wide', () => {
    const { scene, grid } = ring(202)
    expect(grid.cellSize).toBeGreaterThanOrEqual(4 * scene.nodeRadius - EPS)
    expect(grid.cellSize).toBeLessThan(40 * scene.nodeRadius)
  })

  it('bounds the number of cells for a tiny or zero node radius (no 1e-6 cell over a 4000 unit frame)', () => {
    const { scene } = ladder(4000)
    for (const r of [0, 1e-9, scene.nodeRadius / 1000]) {
      const grid = buildZoneGrid(scene.x, scene.y, r)
      expect(grid.cols * grid.rows).toBeLessThanOrEqual(8 * scene.x.length + 64)
      expect(grid.items.length).toBe(scene.x.length)
    }
  })

  it('skips zones with a non-finite coordinate and survives an empty or all-bad input', () => {
    const grid = buildZoneGrid(Float64Array.of(0, NaN, 5, 1), Float64Array.of(0, 0, Infinity, 1), 1)
    expect([...grid.items].sort()).toEqual([0, 3])
    const empty = buildZoneGrid(new Float64Array(0), new Float64Array(0), 1)
    expect(empty.items.length).toBe(0)
    expect(empty.cols * empty.rows).toBeGreaterThanOrEqual(1)
    const bad = buildZoneGrid(Float64Array.of(NaN), Float64Array.of(NaN), 1)
    expect(bad.items.length).toBe(0)
  })
})

// ── zone picking ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('zone pick (base 202 ring, a node is 2 px on screen)', () => {
  const { scene, grid } = ring(202)
  const s = 2 / scene.nodeRadius // CSS px per world unit: R_px = 2

  /** A point `distPx` from a node's surface with every other element at least `minOtherPx` away. */
  function pointAt(distPx: number, minOtherPx: number): { z: number; x: number; y: number } {
    for (let z = 0; z < scene.x.length; z++) {
      for (const [x, y] of around(scene.x[z] ?? NaN, scene.y[z] ?? NaN, scene.nodeRadius + distPx / s)) {
        const cands = refCandidates(scene, x, y, s, allowAll)
        if (Math.abs(distOf(cands, { kind: 'zone', id: z }) - distPx) < EPS && nearestOther(cands, { kind: 'zone', id: z }) >= minOtherPx) return { z, x, y }
      }
    }
    throw new Error(`no free point ${distPx} px from a node found`)
  }

  it('a point 5 px from a node picks that zone', () => {
    const p = pointAt(5, 5.2)
    const hit = pickAt(scene, grid, p.x, p.y, s, allowAll)
    expect(hit).toEqual({ kind: 'zone', id: p.z, distancePx: expect.closeTo(5, 6) })
  })

  it('a point 11 px from a node picks that zone', () => {
    const p = pointAt(11, 11.2)
    const hit = pickAt(scene, grid, p.x, p.y, s, allowAll)
    expect(hit).toEqual({ kind: 'zone', id: p.z, distancePx: expect.closeTo(11, 6) })
  })

  it('a point 13 px from the nearest node surface, and 13 px or more from every other element, picks nothing', () => {
    const p = pointAt(13, 13)
    expect(pickAt(scene, grid, p.x, p.y, s, allowAll)).toBeNull()
  })

  it('a point inside the disc has distance 0', () => {
    const hit = pickAt(scene, grid, scene.x[7] ?? NaN, scene.y[7] ?? NaN, s, noEdges)
    expect(hit).toEqual({ kind: 'zone', id: 7, distancePx: 0 })
  })

  it('the 12 px radius holds at any zoom: the same on-screen distance picks at every scale', () => {
    for (const scale of [0.05, 0.5, 2, 40]) {
      const R = scene.nodeRadius
      // 8 px of surface distance at this scale, along +x from zone 7 (edges off so only the zone can answer)
      const wx = (scene.x[7] ?? NaN) + R + 8 / scale
      const wy = scene.y[7] ?? NaN
      const cands = refCandidates(scene, wx, wy, scale, noEdges)
      const nearest = cands.reduce((a, b) => (b.d < a.d ? b : a))
      const hit = pickAt(scene, grid, wx, wy, scale, noEdges)
      if (nearest.d <= SPEC_RADIUS_PX) expect(hit?.id).toBe(nearest.id)
      else expect(hit).toBeNull()
    }
  })

  it('two zones within range: the nearer wins; at equal distance the lower id wins', () => {
    const near = synthetic({ x: [0, 20, ...FAR_ZONES.x.slice(2)], y: [0, 0, ...FAR_ZONES.y.slice(2)], radius: 2 })
    // point at x = 12: zone 1 is 8 away, zone 0 is 12 away (surface distance 6 and 10 at scale 1)
    expect(pickAt(near.scene, near.grid, 12, 0, 1, allowAll)).toEqual({ kind: 'zone', id: 1, distancePx: 6 })
    // point at x = 10: both are 10 away, so 8 px of surface distance each: zone 0 wins
    expect(pickAt(near.scene, near.grid, 10, 0, 1, allowAll)).toEqual({ kind: 'zone', id: 0, distancePx: 8 })
    // and in the other order of ids the lower id still wins (swap the positions)
    const swapped = synthetic({ x: [20, 0, ...FAR_ZONES.x.slice(2)], y: [0, 0, ...FAR_ZONES.y.slice(2)], radius: 2 })
    expect(pickAt(swapped.scene, swapped.grid, 10, 0, 1, allowAll)).toEqual({ kind: 'zone', id: 0, distancePx: 8 })
  })

  it('a point beyond the radius of every zone is null even far outside the grid', () => {
    expect(pickAt(scene, grid, -1e7, 1e7, s, allowAll)).toBeNull()
  })

  it('property: the grid zone pick equals a brute-force nearest-zone search (bases 202 and 666)', () => {
    for (const base of [202, 666]) {
      const r = ring(base)
      const zoneOnly = noEdges
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: base - 1 }),
          fc.double({ min: -1, max: 1, noNaN: true }),
          fc.double({ min: -1, max: 1, noNaN: true }),
          fc.double({ min: -1.5, max: 1.2, noNaN: true }),
          (z, du, dv, logScale) => {
            const scale = Math.pow(10, logScale)
            const reach = r.scene.nodeRadius + 20 / scale
            const wx = (r.scene.x[z] ?? NaN) + du * reach
            const wy = (r.scene.y[z] ?? NaN) + dv * reach
            sameHit(pickAt(r.scene, r.grid, wx, wy, scale, zoneOnly), refPick(r.scene, wx, wy, scale, zoneOnly))
          },
        ),
        { numRuns: 600 },
      )
      fc.assert(
        fc.property(
          fc.double({ min: -0.1, max: 1.1, noNaN: true }),
          fc.double({ min: -0.1, max: 1.1, noNaN: true }),
          fc.double({ min: -1.5, max: 1.2, noNaN: true }),
          (u, v, logScale) => {
            const scale = Math.pow(10, logScale)
            const wx = u * r.scene.width
            const wy = v * r.scene.height
            sameHit(pickAt(r.scene, r.grid, wx, wy, scale, zoneOnly), refPick(r.scene, wx, wy, scale, zoneOnly))
          },
        ),
        { numRuns: 600 },
      )
    }
  })
})

describe('zone pick on hand-made clouds', () => {
  it('the radius is inclusive: exactly 12 px picks, a hair beyond does not', () => {
    // zone 0 at the origin with a 2 px radius at scale 1: the point (14, 0) is exactly 12 px from its surface
    const { scene, grid } = synthetic({ ...FAR_ZONES, x: [0, ...FAR_ZONES.x.slice(1)], y: [0, ...FAR_ZONES.y.slice(1)], radius: 2 })
    expect(pickAt(scene, grid, 14, 0, 1, allowAll)).toEqual({ kind: 'zone', id: 0, distancePx: SPEC_RADIUS_PX })
    expect(pickAt(scene, grid, 14.000001, 0, 1, allowAll)).toBeNull()
    expect(pickAt(scene, grid, 8, 0, 2, allowAll)).toEqual({ kind: 'zone', id: 0, distancePx: SPEC_RADIUS_PX }) // 12 px again at twice the scale (the 2 world unit radius is 4 px)
  })

  it('property: the grid pick equals brute force for zone clouds anywhere in the plane (offset origins, any radius and scale)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        fc.array(fc.tuple(fc.double({ min: 0, max: 300, noNaN: true }), fc.double({ min: 0, max: 300, noNaN: true })), { minLength: 6, maxLength: 6 }),
        fc.double({ min: 0.5, max: 30, noNaN: true }),
        fc.integer({ min: 0, max: 5 }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1.2, noNaN: true }),
        (ox, oy, cloud, radius, z, du, dv, logScale) => {
          const { scene, grid } = synthetic({ x: cloud.map(c => ox + c[0]), y: cloud.map(c => oy + c[1]), radius })
          const scale = Math.pow(10, logScale)
          const reach = radius + 20 / scale
          const wx = (scene.x[z] ?? NaN) + du * reach
          const wy = (scene.y[z] ?? NaN) + dv * reach
          sameHit(pickAt(scene, grid, wx, wy, scale, noEdges), refPick(scene, wx, wy, scale, noEdges))
        },
      ),
      { numRuns: 600 },
    )
  })

  it('a zone cloud whose y range sits far from its x range is found (the grid origin is per axis)', () => {
    const { scene, grid } = synthetic({ x: [0, 40, 80, 120, 160, 200], y: [3000, 3040, 3080, 3120, 3160, 3200], radius: 5 })
    for (let z = 0; z < 6; z++) expect(pickAt(scene, grid, scene.x[z] ?? NaN, scene.y[z] ?? NaN, 1, noEdges)).toEqual({ kind: 'zone', id: z, distancePx: 0 })
    const flipped = synthetic({ x: [3000, 3040, 3080, 3120, 3160, 3200], y: [0, 40, 80, 120, 160, 200], radius: 5 })
    for (let z = 0; z < 6; z++) expect(pickAt(flipped.scene, flipped.grid, flipped.scene.x[z] ?? NaN, flipped.scene.y[z] ?? NaN, 1, noEdges)).toEqual({ kind: 'zone', id: z, distancePx: 0 })
  })
})

// ── edge picking ──────────────────────────────────────────────────────────────────────────────────────────────────────

// The ladder, because its syzygies are long rungs (11 node radii): on the ring the two members of a pair sit next to each
// other, so a syzygy there is a stub between two nodes and no point can be 6 px from it and 20 px from every node.
describe('edge pick (base 202 ladder, a node is 12 px on screen so the edges are apart)', () => {
  const { scene, grid } = ladder(202)
  const s = 12 / scene.nodeRadius
  const P = scene.currentTo.length

  const only = (kind: 'syzygy' | 'current' | 'gate'): PickFilter => ({ zoneAllowed: () => true, edgeAllowed: k => k === kind })

  /**
   * The first point `offsetPx` beside edge e (a point within 0.5 px of that distance from the edge, measured by brute
   * force) whose nearest other candidate under `filter` is at least `minOtherPx` away and whose nearest node surface is
   * at least `minNodePx` away.
   */
  function pointBeside(filter: PickFilter, e: number, kind: PickKind, id: number, offsetPx: number, minOtherPx: number, minNodePx = 0): [number, number] | null {
    for (const [x, y] of besideEdge(scene, e, offsetPx, s)) {
      const cands = refCandidates(scene, x, y, s, filter)
      if (!(Math.abs(distOf(cands, { kind, id }) - offsetPx) < 0.5)) continue
      if (nearestOther(cands, { kind, id }) < minOtherPx) continue
      if (Math.min(...refCandidates(scene, x, y, s, noEdges).map(c => c.d)) < minNodePx) continue
      return [x, y]
    }
    return null
  }

  function firstEdge(filter: PickFilter, range: [number, number], kind: PickKind, offsetPx: number, minOtherPx: number, minNodePx = 0): { id: number; x: number; y: number } {
    for (let e = range[0]; e < range[1]; e++) {
      const id = kind === 'syzygy' ? e : kind === 'current' ? e - P : e - 2 * P
      const pt = pointBeside(filter, e, kind, id, offsetPx, minOtherPx, minNodePx)
      if (pt !== null) return { id, x: pt[0], y: pt[1] }
    }
    throw new Error(`no free point beside any ${kind} edge`)
  }

  it('a point 6 px from a syzygy segment and 20 px from every node picks { syzygy, q }', () => {
    const p = firstEdge(only('syzygy'), [0, P], 'syzygy', 6, 8, 20)
    const hit = pickAt(scene, grid, p.x, p.y, s, only('syzygy'))
    expect(hit?.kind).toBe('syzygy')
    expect(hit?.id).toBe(p.id)
    expect(Math.abs((hit?.distancePx ?? NaN) - 6)).toBeLessThan(0.5)
    // and every syzygy is a candidate through allowAll too: the answer there is whatever is nearest (the brute-force property below)
    sameHit(pickAt(scene, grid, p.x, p.y, s, allowAll), refPick(scene, p.x, p.y, s, allowAll))
  })

  it('a point 6 px from a current leg picks { current, pair id }', () => {
    const p = firstEdge(only('current'), [P, 2 * P], 'current', 6, 8)
    const hit = pickAt(scene, grid, p.x, p.y, s, only('current'))
    expect(hit?.kind).toBe('current')
    expect(hit?.id).toBe(p.id)
    expect(Math.abs((hit?.distancePx ?? NaN) - 6)).toBeLessThan(0.5)
  })

  it('a gate is a candidate only when the filter says it is drawn', () => {
    const p = firstEdge(only('gate'), [2 * P, 2 * P + scene.x.length], 'gate', 6, 8)
    const hit = pickAt(scene, grid, p.x, p.y, s, only('gate'))
    expect(hit?.kind).toBe('gate')
    expect(hit?.id).toBe(p.id)
    expect(Math.abs((hit?.distancePx ?? NaN) - 6)).toBeLessThan(0.5)
    // gates not drawn (the table's gate layer is off above 150 zones): the gate is not a candidate
    expect(pickAt(scene, grid, p.x, p.y, s, noGates)?.kind).not.toBe('gate')
    expect(pickAt(scene, grid, p.x, p.y, s, noEdges)?.kind).not.toBe('gate')
    // only this zone's own gate drawn (a hovered zone's on-demand gate): it is a candidate, every other gate is not
    const ownGate: PickFilter = { zoneAllowed: () => true, edgeAllowed: (kind, id) => kind === 'gate' && id === p.id }
    expect(pickAt(scene, grid, p.x, p.y, s, ownGate)).toEqual({ kind: 'gate', id: p.id, distancePx: expect.closeTo(hit?.distancePx ?? NaN, 9) })
    const otherGates: PickFilter = { zoneAllowed: () => true, edgeAllowed: (kind, id) => kind === 'gate' && id !== p.id }
    const elsewhere = pickAt(scene, grid, p.x, p.y, s, otherGates)
    expect(elsewhere !== null && elsewhere.kind === 'gate' && elsewhere.id === p.id).toBe(false)
  })

  it('does not ask the filter about edges far from the point (the box rejects them first)', () => {
    const asked: Array<[string, number]> = []
    const spy: PickFilter = {
      zoneAllowed: () => true,
      edgeAllowed: (kind, id) => {
        asked.push([kind, id])
        return true
      },
    }
    expect(pickAt(scene, grid, -1e6, -1e6, s, spy)).toBeNull()
    expect(asked).toEqual([])
    pickAt(scene, grid, scene.width / 2, scene.height / 2, s, spy)
    expect(asked.length).toBeLessThan(scene.edgeSegStart.length - 1)
  })
})

// ── muted and dimmed elements ─────────────────────────────────────────────────────────────────────────────────────────

describe('filters', () => {
  const { scene, grid } = ring(202)
  const s = 2 / scene.nodeRadius

  it('a muted zone is never returned, and the pick falls to the next element', () => {
    const z = 40
    const muted: PickFilter = { zoneAllowed: id => id !== z, edgeAllowed: () => false }
    const at = pickAt(scene, grid, scene.x[z] ?? NaN, scene.y[z] ?? NaN, s, muted)
    expect(at === null || (at.kind === 'zone' && at.id !== z)).toBe(true)
    // a dimmed (isolate) zone is allowed, so it still picks
    const dimmed: PickFilter = { zoneAllowed: () => true, edgeAllowed: () => false }
    expect(pickAt(scene, grid, scene.x[z] ?? NaN, scene.y[z] ?? NaN, s, dimmed)).toEqual({ kind: 'zone', id: z, distancePx: 0 })
  })

  it('a muted zone is never returned for any point (property, with the edges of muted zones excluded as the caller does)', () => {
    const r = ring(202)
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 201 }), { minLength: 0, maxLength: 60 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 201 }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        (mutedList, gatesOn, z, du, dv, logScale) => {
          const muted = new Set(mutedList)
          const filter: PickFilter = {
            zoneAllowed: id => !muted.has(id),
            edgeAllowed: (kind, id) => {
              if (kind === 'gate') return gatesOn && !muted.has(id)
              const [a, b] = pairMembersOf(202, id)
              return !muted.has(a) && !muted.has(b)
            },
          }
          const scale = Math.pow(10, logScale)
          const reach = r.scene.nodeRadius + 20 / scale
          const wx = (r.scene.x[z] ?? NaN) + du * reach
          const wy = (r.scene.y[z] ?? NaN) + dv * reach
          const hit = pickAt(r.scene, r.grid, wx, wy, scale, filter)
          if (hit !== null && hit.kind === 'zone') expect(muted.has(hit.id)).toBe(false)
          sameHit(hit, refPick(r.scene, wx, wy, scale, filter))
        },
      ),
      { numRuns: 400 },
    )
  })
})

// ── tie order and nearest wins (hand-made scenes) ─────────────────────────────────────────────────────────────────────

describe('tie order (zone, syzygy, current, gate, demon chord) and nearest-wins', () => {
  const THROUGH_ORIGIN = [[-50, 0, 50, 0]] as const

  it('a point inside a disc has distance 0 and returns the zone even when an edge passes through it', () => {
    const { scene, grid } = synthetic({ ...FAR_ZONES, x: [0, ...FAR_ZONES.x.slice(1)], y: [0, ...FAR_ZONES.y.slice(1)], radius: 10, segs: { [SYN_SYZ(1)]: THROUGH_ORIGIN } })
    expect(pickAt(scene, grid, 0, 0, 1, allowAll)).toEqual({ kind: 'zone', id: 0, distancePx: 0 })
  })

  // Zones 0 and 1 sit 0.5 either side of the origin with a 0.01 radius, so a straight chord (a chord shorter than 2 is
  // drawn straight) joins them through the origin; each zone is 0.49 px from the origin, farther than any element at 0.
  const CHORD_ZONES = { x: [-0.5, 0.5, 0, 0, ...FAR_ZONES.x.slice(4)], y: [0, 0, -0.5, 0.5, ...FAR_ZONES.y.slice(4)] }

  it('syzygy beats current, gate and chord at equal distance (and current beats gate, gate beats chord)', () => {
    const all = synthetic({
      ...CHORD_ZONES,
      radius: 0.01,
      segs: { [SYN_SYZ(1)]: THROUGH_ORIGIN, [SYN_CUR(1)]: THROUGH_ORIGIN, [SYN_GATE(1)]: THROUGH_ORIGIN },
    })
    const chords = flattenChords([{ a: 0, b: 1, name: 'c', kind: 'chrono' }], all.scene.x, all.scene.y, 0, 1e6)
    expect(chords.segments.length).toBe(4 * PICK_FLATTEN_STEPS) // present, and straight through the origin
    const at = (filter: PickFilter): PickHit | null => pickAt(all.scene, all.grid, 0, 0, 1, filter, chords)
    expect(at(allowAll)).toEqual({ kind: 'syzygy', id: 1, distancePx: 0 })
    expect(at({ zoneAllowed: () => true, edgeAllowed: kind => kind !== 'syzygy' })).toEqual({ kind: 'current', id: 1, distancePx: 0 })
    expect(at({ zoneAllowed: () => true, edgeAllowed: kind => kind === 'gate' })).toEqual({ kind: 'gate', id: 1, distancePx: 0 })
    expect(at(noEdges)).toEqual({ kind: 'chord', id: 0, distancePx: 0 })
  })

  it('at equal distance the lower id wins within a kind', () => {
    const { scene, grid } = synthetic({
      ...FAR_ZONES,
      radius: 10,
      segs: { [SYN_SYZ(2)]: THROUGH_ORIGIN, [SYN_SYZ(0)]: THROUGH_ORIGIN, [SYN_CUR(2)]: THROUGH_ORIGIN, [SYN_CUR(1)]: THROUGH_ORIGIN, [SYN_GATE(5)]: THROUGH_ORIGIN, [SYN_GATE(3)]: THROUGH_ORIGIN },
    })
    expect(pickAt(scene, grid, 0, 0, 1, allowAll)).toEqual({ kind: 'syzygy', id: 0, distancePx: 0 })
    expect(pickAt(scene, grid, 0, 0, 1, { zoneAllowed: () => true, edgeAllowed: kind => kind === 'current' })).toEqual({ kind: 'current', id: 1, distancePx: 0 })
    expect(pickAt(scene, grid, 0, 0, 1, { zoneAllowed: () => true, edgeAllowed: kind => kind === 'gate' })).toEqual({ kind: 'gate', id: 3, distancePx: 0 })
  })

  it('at equal distance the lower chord index wins', () => {
    const { scene, grid } = synthetic({ ...CHORD_ZONES, radius: 0.01 })
    // chord 0 is the vertical one (zones 2 and 3), chord 1 the horizontal one (zones 0 and 1): both pass through the origin
    const chords = flattenChords(
      [
        { a: 2, b: 3, name: 'v', kind: 'chrono' },
        { a: 0, b: 1, name: 'h', kind: 'amphi' },
      ],
      scene.x,
      scene.y,
      0,
      1e6,
    )
    expect(pickAt(scene, grid, 0, 0, 1, noEdges, chords)).toEqual({ kind: 'chord', id: 0, distancePx: 0 })
  })

  it('the nearer element wins over a higher-ranked one: a syzygy at 3 px beats a zone at 8 px', () => {
    const { scene, grid } = synthetic({
      ...FAR_ZONES,
      x: [0, ...FAR_ZONES.x.slice(1)],
      y: [-18, ...FAR_ZONES.y.slice(1)],
      radius: 10,
      segs: { [SYN_SYZ(0)]: [[-50, 3, 50, 3]] },
    })
    // zone 0 centre is 18 below the point: surface distance 8; the syzygy runs 3 above it
    expect(pickAt(scene, grid, 0, 0, 1, allowAll)).toEqual({ kind: 'syzygy', id: 0, distancePx: 3 })
    // with the syzygy not drawn the zone answers
    expect(pickAt(scene, grid, 0, 0, 1, noEdges)).toEqual({ kind: 'zone', id: 0, distancePx: 8 })
  })

  it('edge distance is measured in CSS px: the same segment is 6 px away at scale 2 and 3 px away at scale 1', () => {
    const { scene, grid } = synthetic({ ...FAR_ZONES, radius: 1, segs: { [SYN_CUR(2)]: [[-50, 3, 50, 3]] } })
    expect(pickAt(scene, grid, 0, 0, 1, allowAll)).toEqual({ kind: 'current', id: 2, distancePx: 3 })
    expect(pickAt(scene, grid, 0, 0, 2, allowAll)).toEqual({ kind: 'current', id: 2, distancePx: 6 })
    expect(pickAt(scene, grid, 0, 0, 5, allowAll)).toBeNull() // 15 px
  })

  it('an edge far from the point is not a candidate even when its filter allows it', () => {
    const { scene, grid } = synthetic({ ...FAR_ZONES, radius: 1, segs: { [SYN_SYZ(0)]: [[1000, 1000, 1010, 1010]] } })
    expect(pickAt(scene, grid, 0, 0, 1, allowAll)).toBeNull()
  })

  it('TIE_ORDER is what ranks the kinds: a different order would change the answer (checked through the pick)', () => {
    // syzygy and current both at distance 0: the answer is the one TIE_ORDER lists first
    const { scene, grid } = synthetic({ ...FAR_ZONES, radius: 10, segs: { [SYN_SYZ(0)]: THROUGH_ORIGIN, [SYN_CUR(0)]: THROUGH_ORIGIN } })
    const hit = pickAt(scene, grid, 0, 0, 1, allowAll)
    const first = TIE_ORDER.indexOf('syzygy') < TIE_ORDER.indexOf('current') ? 'syzygy' : 'current'
    expect(hit?.kind).toBe(first)
    expect(hit?.kind).toBe('syzygy')
  })
})

// ── pair graph pills ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('pill pick (pair graph at base 202)', () => {
  const { scene, grid } = pairs(202)
  const s = 24 / scene.pillHeight // a pill is 24 px high

  function pillPoint(distPx: number, minOtherPx: number): { q: number; x: number; y: number } {
    const px = scene.px
    const py = scene.py
    if (px === null || py === null) throw new Error('not a pair scene')
    for (let q = 0; q < px.length; q++) {
      const cx = px[q] ?? NaN
      const cy = py[q] ?? NaN
      const reach = [
        [cx + scene.pillWidth / 2 + distPx / s, cy],
        [cx - scene.pillWidth / 2 - distPx / s, cy],
        [cx, cy + scene.pillHeight / 2 + distPx / s],
        [cx, cy - scene.pillHeight / 2 - distPx / s],
      ] as const
      for (const [x, y] of reach) {
        const cands = refCandidates(scene, x, y, s, allowAll)
        if (Math.abs(distOf(cands, { kind: 'pair', id: q }) - distPx) < EPS && nearestOther(cands, { kind: 'pair', id: q }) >= minOtherPx) return { q, x, y }
      }
    }
    throw new Error(`no free point ${distPx} px outside a pill found`)
  }

  it('a point inside a pill picks it with distance 0', () => {
    const q = 17
    const hit = pickAt(scene, grid, scene.px?.[q] ?? NaN, scene.py?.[q] ?? NaN, s, allowAll)
    expect(hit).toEqual({ kind: 'pair', id: q, distancePx: 0 })
  })

  it('a point 11 px outside the stadium edge still picks it', () => {
    const p = pillPoint(11, 11.2)
    const hit = pickAt(scene, grid, p.x, p.y, s, allowAll)
    expect(hit).toEqual({ kind: 'pair', id: p.q, distancePx: expect.closeTo(11, 6) })
  })

  it('a point 13 px outside the stadium edge does not (and no other pill is within 13 px)', () => {
    const p = pillPoint(13, 13)
    expect(pickAt(scene, grid, p.x, p.y, s, allowAll)).toBeNull()
  })

  it('the stadium edge is round at the ends: 5 px from the tip along the axis is 5 px, not the box corner distance', () => {
    const q = 3
    const cx = scene.px?.[q] ?? NaN
    const cy = scene.py?.[q] ?? NaN
    const x = cx + scene.pillWidth / 2 + 5 / s
    expect(distToStadium(x, cy, cx, cy, scene.pillWidth, scene.pillHeight) * s).toBeCloseTo(5, 9)
  })

  it('a pill is a candidate only when both of its member zones are allowed', () => {
    const g = createNumogram(202)
    for (const q of [0, 5, 60, 100]) {
      const info = g.pair(q)
      const at = (filter: PickFilter): PickHit | null => pickAt(scene, grid, scene.px?.[q] ?? NaN, scene.py?.[q] ?? NaN, s, filter)
      expect(at(allowAll)).toEqual({ kind: 'pair', id: q, distancePx: 0 })
      const loMuted = at({ zoneAllowed: z => z !== info.lo, edgeAllowed: () => true })
      expect(loMuted !== null && loMuted.kind === 'pair' && loMuted.id === q).toBe(false)
      const hiMuted = at({ zoneAllowed: z => z !== info.hi, edgeAllowed: () => true })
      expect(hiMuted !== null && hiMuted.kind === 'pair' && hiMuted.id === q).toBe(false)
    }
  })

  it('pair ids agree with the engine: the members of pair q are q and base - 1 - q', () => {
    for (const base of [2, 4, 10, 28, 202, 4000]) {
      const g = createNumogram(base)
      for (const q of new Set([0, 1, base / 2 - 1].filter(id => id < base / 2))) {
        const info = g.pair(q)
        expect([info.lo, info.hi]).toEqual(pairMembersOf(base, q))
      }
    }
  })

  it('property: the pill pick equals a brute-force pick for random points and filters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1.2, noNaN: true }),
        fc.uniqueArray(fc.integer({ min: 0, max: 201 }), { minLength: 0, maxLength: 30 }),
        (q, du, dv, logScale, mutedList) => {
          const muted = new Set(mutedList)
          const filter: PickFilter = { zoneAllowed: z => !muted.has(z), edgeAllowed: () => true }
          const scale = Math.pow(10, logScale)
          const reach = scene.pillWidth / 2 + 20 / scale
          const wx = (scene.px?.[q] ?? NaN) + du * reach
          const wy = (scene.py?.[q] ?? NaN) + dv * reach
          sameHit(pickAt(scene, grid, wx, wy, scale, filter), refPick(scene, wx, wy, scale, filter))
        },
      ),
      { numRuns: 500 },
    )
  })

  it('a pill beats a demon chord at equal distance (a pill ranks with a zone, whatever the ids)', () => {
    // pill 2 sits at the origin (the others far away) and a straight chord passes through it: both are at distance 0
    const template = pairs(6).scene
    const hand: CanvasScene = { ...template, px: Float64Array.of(FAR, FAR + 500, 0), py: Float64Array.of(FAR, FAR, 0), pillWidth: 40, pillHeight: 20 }
    const handGrid = buildZoneGrid(hand.x, hand.y, hand.nodeRadius)
    const chords = flattenChords([{ a: 0, b: 1, name: 'c', kind: 'chrono' }], Float64Array.of(-0.5, 0.5, 100, 100, 100, 100), new Float64Array(6), 0, 1e6)
    expect(chords.segments.length).toBe(4 * PICK_FLATTEN_STEPS)
    expect(pickAt(hand, handGrid, 0, 0, 1, allowAll, chords)).toEqual({ kind: 'pair', id: 2, distancePx: 0 })
    // a chord alone (the pill muted through its member zones) is what is left
    expect(pickAt(hand, handGrid, 0, 0, 1, { zoneAllowed: z => z !== 2 && z !== 3 ? true : false, edgeAllowed: () => true }, chords)).toEqual({
      kind: 'chord',
      id: 0,
      distancePx: 0,
    })
  })

  it('a pair scene has no edges: a point far from every pill picks nothing', () => {
    expect(pickAt(scene, grid, -1e6, -1e6, s, allowAll)).toBeNull()
  })
})

// ── demon chords ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('flattenChords and the chord pick', () => {
  const { scene, grid } = ring(28)
  const demon: Demon = { a: 12, b: 3, name: 'x', kind: 'chrono' }

  it('produces PICK_FLATTEN_STEPS segments that start at zone a and end at zone b', () => {
    const fcs = flattenChords([demon], scene.x, scene.y, scene.centerX, scene.centerY)
    expect([...fcs.chordStart]).toEqual([0, PICK_FLATTEN_STEPS])
    expect(fcs.segments.length).toBe(4 * PICK_FLATTEN_STEPS)
    expect([fcs.segments[0], fcs.segments[1]]).toEqual([scene.x[12], scene.y[12]])
    const last = 4 * (PICK_FLATTEN_STEPS - 1)
    expect([fcs.segments[last + 2], fcs.segments[last + 3]]).toEqual([scene.x[3], scene.y[3]])
    expect([...fcs.zoneA]).toEqual([12])
    expect([...fcs.zoneB]).toEqual([3])
  })

  it('follows the curveAway(..., 0.25) route the SVG tier draws (the middle of the curve is the Bezier point)', () => {
    const fcs = flattenChords([demon], scene.x, scene.y, scene.centerX, scene.centerY)
    const d = curveAway({ x: scene.x[12] ?? NaN, y: scene.y[12] ?? NaN }, { x: scene.x[3] ?? NaN, y: scene.y[3] ?? NaN }, scene.centerX, scene.centerY, 0.25)
    const nums = (d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g) ?? []).map(Number)
    expect(nums.length).toBe(6) // M x0 y0 Q cx cy x1 y1
    const [x0, y0, cx, cy, x1, y1] = nums as [number, number, number, number, number, number]
    const mid = PICK_FLATTEN_STEPS / 2
    const at = 4 * (mid - 1) // the segment that ends at t = 1/2
    expect(fcs.segments[at + 2]).toBeCloseTo(0.25 * x0 + 0.5 * cx + 0.25 * x1, 9)
    expect(fcs.segments[at + 3]).toBeCloseTo(0.25 * y0 + 0.5 * cy + 0.25 * y1, 9)
  })

  it('several chords are a CSR: each is PICK_FLATTEN_STEPS segments in order', () => {
    const fcs = flattenChords(
      [demon, { a: 1, b: 2, name: 'y', kind: 'amphi' }, { a: 5, b: 20, name: 'z', kind: 'xeno' }],
      scene.x,
      scene.y,
      scene.centerX,
      scene.centerY,
    )
    expect([...fcs.chordStart]).toEqual([0, PICK_FLATTEN_STEPS, 2 * PICK_FLATTEN_STEPS, 3 * PICK_FLATTEN_STEPS])
    expect([...fcs.zoneA]).toEqual([12, 1, 5])
    expect([...fcs.zoneB]).toEqual([3, 2, 20])
  })

  it('a chord with an out-of-range zone or a non-finite coordinate has no segments (and is never picked)', () => {
    const fcs = flattenChords(
      [{ a: 999, b: 3, name: 'o', kind: 'chrono' }, demon, { a: -1, b: 2, name: 'n', kind: 'chrono' }],
      scene.x,
      scene.y,
      scene.centerX,
      scene.centerY,
    )
    expect([...fcs.chordStart]).toEqual([0, 0, PICK_FLATTEN_STEPS, PICK_FLATTEN_STEPS])
    const nan = flattenChords([demon], Float64Array.of(NaN), Float64Array.of(0), 0, 0)
    expect(nan.segments.length).toBe(0)
    const badCentre = flattenChords([demon], scene.x, scene.y, NaN, 0)
    expect(badCentre.segments.length).toBe(0)
    const none = flattenChords([], scene.x, scene.y, 0, 0)
    expect([...none.chordStart]).toEqual([0])
  })

  it('a chord between a zone and itself flattens to zero-length segments without throwing', () => {
    const fcs = flattenChords([{ a: 4, b: 4, name: 's', kind: 'chrono' }], scene.x, scene.y, scene.centerX, scene.centerY)
    expect(fcs.segments.length).toBe(4 * PICK_FLATTEN_STEPS)
    for (let i = 0; i < fcs.segments.length; i += 4) {
      expect(fcs.segments[i]).toBe(scene.x[4])
      expect(fcs.segments[i + 2]).toBe(scene.x[4])
    }
  })

  it('a point 4 px from the chord and 30 px from anything else picks { chord, index }', () => {
    const fcs = flattenChords([demon], scene.x, scene.y, scene.centerX, scene.centerY)
    const R = scene.nodeRadius
    for (const scale of [16, 20, 24, 32, 48].map(px => px / R)) {
      const s = scale
      for (let k = 0; k < PICK_FLATTEN_STEPS; k++) {
        const x0 = fcs.segments[4 * k] ?? NaN
        const y0 = fcs.segments[4 * k + 1] ?? NaN
        const x1 = fcs.segments[4 * k + 2] ?? NaN
        const y1 = fcs.segments[4 * k + 3] ?? NaN
        const len = Math.hypot(x1 - x0, y1 - y0)
        for (const sign of [1, -1]) {
          const x = (x0 + x1) / 2 + (sign * (-(y1 - y0) / len) * 4) / s
          const y = (y0 + y1) / 2 + (sign * ((x1 - x0) / len) * 4) / s
          const cands = refCandidates(scene, x, y, s, noEdges, fcs)
          if (Math.abs(distOf(cands, { kind: 'chord', id: 0 }) - 4) > 0.3 || nearestOther(cands, { kind: 'chord', id: 0 }) < 30) continue
          const hit = pickAt(scene, grid, x, y, s, noEdges, fcs)
          expect(hit?.kind).toBe('chord')
          expect(hit?.id).toBe(0)
          expect(Math.abs((hit?.distancePx ?? NaN) - 4)).toBeLessThan(0.3)
          return
        }
      }
    }
    throw new Error('no point 4 px from the chord and 30 px from everything else was found')
  })

  it('a chord whose end zone is muted is not a candidate', () => {
    const fcs = flattenChords([demon], scene.x, scene.y, scene.centerX, scene.centerY)
    const s = 8 / scene.nodeRadius
    const x = (fcs.segments[0] ?? NaN) + 0 // zone 12's own end of the chord: inside its disc
    const y = fcs.segments[1] ?? NaN
    const hitFree = pickAt(scene, grid, x, y, s, { zoneAllowed: z => z !== 12, edgeAllowed: () => false }, fcs)
    expect(hitFree === null || hitFree.kind !== 'chord').toBe(true)
    const hitMid = fcs.segments.length > 0 ? pickAt(scene, grid, fcs.segments[8] ?? NaN, fcs.segments[9] ?? NaN, s, { zoneAllowed: z => z !== 3, edgeAllowed: () => false }, fcs) : null
    expect(hitMid === null || hitMid.kind !== 'chord').toBe(true)
  })

  it('property: the whole pick (zones, edges and chords) equals a brute-force pick for random points, filters and chords', () => {
    const r = ring(202)
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 201 }), fc.integer({ min: 0, max: 201 })), { minLength: 0, maxLength: 4 }),
        fc.integer({ min: 0, max: 201 }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1.2, noNaN: true }),
        fc.boolean(),
        (chordEnds, z, du, dv, logScale, gatesOn) => {
          const demons: Demon[] = chordEnds.map(([a, b], i) => ({ a, b, name: `d${i}`, kind: 'chrono' }))
          const flat = flattenChords(demons, r.scene.x, r.scene.y, r.scene.centerX, r.scene.centerY)
          const filter: PickFilter = { zoneAllowed: () => true, edgeAllowed: kind => (kind === 'gate' ? gatesOn : true) }
          const scale = Math.pow(10, logScale)
          const reach = r.scene.nodeRadius + 20 / scale
          const wx = (r.scene.x[z] ?? NaN) + du * reach
          const wy = (r.scene.y[z] ?? NaN) + dv * reach
          sameHit(pickAt(r.scene, r.grid, wx, wy, scale, filter, flat), refPick(r.scene, wx, wy, scale, filter, flat))
        },
      ),
      { numRuns: 500 },
    )
  })
})

// ── whole-pick property over the other layouts, rubber band, guards, cost ─────────────────────────────────────────────

describe('pickAt over the ladder and guards', () => {
  it('property: the whole pick equals brute force on the ladder at n = 666 (many edges per cell)', () => {
    const r = ladder(666)
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 665 }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1.5, noNaN: true }),
        (z, du, dv, logScale) => {
          const scale = Math.pow(10, logScale)
          const reach = r.scene.nodeRadius + 20 / scale
          const wx = (r.scene.x[z] ?? NaN) + du * reach
          const wy = (r.scene.y[z] ?? NaN) + dv * reach
          sameHit(pickAt(r.scene, r.grid, wx, wy, scale, allowAll), refPick(r.scene, wx, wy, scale, allowAll))
        },
      ),
      { numRuns: 400 },
    )
  })

  it('a non-finite point, or a non-positive or non-finite scale, returns null', () => {
    const { scene, grid } = ring(202)
    expect(pickAt(scene, grid, NaN, 0, 1, allowAll)).toBeNull()
    expect(pickAt(scene, grid, 0, Infinity, 1, allowAll)).toBeNull()
    expect(pickAt(scene, grid, 0, 0, 0, allowAll)).toBeNull()
    expect(pickAt(scene, grid, 0, 0, -1, allowAll)).toBeNull()
    expect(pickAt(scene, grid, 0, 0, NaN, allowAll)).toBeNull()
    expect(pickAt(scene, grid, scene.x[0] ?? 0, scene.y[0] ?? 0, Infinity, allowAll)).toBeNull()
  })

  it('stays fast at the ceiling: 100 picks on the ladder at n = 4000 (about 80,000 segments) finish well inside a generous bound', () => {
    const { scene, grid } = ladder(4000)
    expect(scene.pickSegments.length / 4).toBeGreaterThan(50_000)
    const s = 700 / scene.height
    const t0 = performance.now()
    let hits = 0
    for (let i = 0; i < 100; i++) {
      const hit = pickAt(scene, grid, scene.width / 2, ((i + 0.5) / 100) * scene.height, s, allowAll)
      if (hit !== null) hits++
    }
    const elapsed = performance.now() - t0
    expect(hits).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(3000) // research measured about 0.2 to 1.4 ms per pick; this only guards against a quadratic regression
  })
})

describe('zonesInWorldRect', () => {
  const { scene } = ring(202)

  it('returns exactly the allowed zones whose centres are in the rectangle, in ascending order (property, with random filters)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.uniqueArray(fc.integer({ min: 0, max: 201 }), { minLength: 0, maxLength: 80 }),
        (a, b, c, d, mutedList) => {
          const muted = new Set(mutedList)
          const filter: PickFilter = { zoneAllowed: z => !muted.has(z), edgeAllowed: () => true }
          const minX = Math.min(a, c) * scene.width
          const maxX = Math.max(a, c) * scene.width
          const minY = Math.min(b, d) * scene.height
          const maxY = Math.max(b, d) * scene.height
          const expected: number[] = []
          for (let z = 0; z < scene.x.length; z++) {
            const x = scene.x[z] ?? NaN
            const y = scene.y[z] ?? NaN
            if (!muted.has(z) && x >= minX && x <= maxX && y >= minY && y <= maxY) expected.push(z)
          }
          expect(zonesInWorldRect(scene, minX, minY, maxX, maxY, filter)).toEqual(expected)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('the whole frame returns every allowed zone; a rectangle given with its corners swapped is the same rectangle', () => {
    expect(zonesInWorldRect(scene, -1, -1, scene.width + 1, scene.height + 1, allowAll).length).toBe(scene.x.length)
    const a = zonesInWorldRect(scene, 100, 200, 1500, 1800, allowAll)
    expect(zonesInWorldRect(scene, 1500, 1800, 100, 200, allowAll)).toEqual(a)
  })

  it('a non-finite rectangle selects nothing', () => {
    expect(zonesInWorldRect(scene, NaN, 0, 10, 10, allowAll)).toEqual([])
    expect(zonesInWorldRect(scene, 0, 0, Infinity, 10, allowAll)).toEqual([])
  })

  it('works for the pair graph, where both members of a pair sit on their pill', () => {
    const p = pairs(28).scene
    const all = zonesInWorldRect(p, -1, -1, p.width + 1, p.height + 1, allowAll)
    expect(all.length).toBe(28)
  })
})
