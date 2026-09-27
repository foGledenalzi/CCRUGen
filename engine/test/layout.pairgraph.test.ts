// LAY-04 (D-08): pairGraphLayout draws every Torque cycle as a clean anticlockwise ring of pair pills (base 64: six
// rings) and Plex/Warp as self-looping pills; routePairGraph's current arcs follow g.nextPair and its self loops mark
// exactly the fixed pairs. Sweep every even base 2..400 (T-03-08: a wrong flow direction cannot pass this sweep).
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { pairGraphLayout, routePairGraph } from '../layout/pairgraph'

const MAX_MISMATCHES = 200
const TAU = 2 * Math.PI
const NUM = String.raw`-?\d+(?:\.\d+)?`
const ARC_RE = new RegExp(`^M(${NUM}) (${NUM})A(${NUM}) (${NUM}) 0 0 0 (${NUM}) (${NUM})$`)

interface ArcPoints {
  readonly sx: number
  readonly sy: number
  readonly ex: number
  readonly ey: number
}

function parseArc(d: string): ArcPoints | null {
  const m = ARC_RE.exec(d)
  if (m === null) return null
  return { sx: Number(m[1]), sy: Number(m[2]), ex: Number(m[5]), ey: Number(m[6]) }
}

/** The pair id whose pill centre is closest to (x, y). */
function nearestPair(px: Float64Array, py: Float64Array, x: number, y: number): number {
  let best = -1
  let bestDistSq = Infinity
  for (let i = 0; i < px.length; i++) {
    const dx = (px[i] ?? 0) - x
    const dy = (py[i] ?? 0) - y
    const distSq = dx * dx + dy * dy
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = i
    }
  }
  return best
}

/** Checks the pair-graph truths for one base, appending short strings to `mismatches`. */
function checkBase(n: number, mismatches: string[]): void {
  const tag = `n=${n}`
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  const g = createNumogram(n)
  const layout = pairGraphLayout(g)
  const { px, py, nodeRadius, width, height, groups, x, y, id } = layout
  const P = n / 2

  if (px.length !== P) push(`px.length ${px.length} != ${P}`)
  if (id !== 'pairGraph') push(`id ${id} != pairGraph`)

  for (let z = 0; z < n; z++) {
    const pairId = g.pairOf(z)
    if ((x[z] ?? NaN) !== (px[pairId] ?? NaN)) push(`zone ${z} x != px[pairOf(z)]`)
    if ((y[z] ?? NaN) !== (py[pairId] ?? NaN)) push(`zone ${z} y != py[pairOf(z)]`)
  }

  const ringGroups = groups.filter(grp => grp.glyph === 'ring')
  for (const grp of ringGroups) {
    const cycle = g.cycleAt(grp.cycle)
    const L = grp.nodeCount
    let prevAngle: number | null = null
    for (let j = 0; j < L; j++) {
      const pairId = cycle.pairAt(j)
      const pxv = px[pairId] ?? 0
      const pyv = py[pairId] ?? 0
      const dist = Math.hypot(pxv - grp.cx, pyv - grp.cy)
      if (Math.abs(dist - grp.radius) / grp.radius > 1e-9) push(`ring ${grp.cycle} pair ${pairId} distance ${dist} != radius ${grp.radius}`)
      if (j === 0) {
        if (Math.abs(pxv - grp.cx) >= 1e-9) push(`ring ${grp.cycle} node 0 not at top (x)`)
        if (!(pyv < grp.cy)) push(`ring ${grp.cycle} node 0 not at top (y)`)
      }
      const angle = Math.atan2(-(pyv - grp.cy), pxv - grp.cx)
      if (prevAngle !== null) {
        let step = angle - prevAngle
        while (step <= 0) step += TAU
        while (step > TAU + 1e-6) step -= TAU
        if (Math.abs(step - TAU / L) > 1e-9) push(`ring ${grp.cycle} angle step at ${j} = ${step} != ${TAU / L}`)
      }
      prevAngle = angle
    }
  }

  const routes = routePairGraph(g, layout)
  for (let q = 0; q < P; q++) {
    const isFixed = g.nextPair(q) === q
    if (isFixed) {
      if (routes.loop[q] === null) push(`pair ${q} fixed but loop is null`)
      if (routes.arc[q] !== null) push(`pair ${q} fixed but arc is not null`)
    } else {
      const d = routes.arc[q] ?? null
      if (routes.loop[q] !== null) push(`pair ${q} not fixed but loop is not null`)
      if (d === null) {
        push(`pair ${q} not fixed but arc is null`)
      } else {
        if (!d.includes(' 0 0 0 ')) push(`pair ${q} arc missing flags '0 0 0': ${d}`)
        const parsed = parseArc(d)
        if (parsed === null) {
          push(`pair ${q} arc did not parse: ${d}`)
        } else {
          const nxt = g.nextPair(q)
          const nearestStart = nearestPair(px, py, parsed.sx, parsed.sy)
          const nearestEnd = nearestPair(px, py, parsed.ex, parsed.ey)
          if (nearestStart !== q) push(`pair ${q} arc start nearest pair ${nearestStart} != ${q}`)
          if (nearestEnd !== nxt) push(`pair ${q} arc end nearest pair ${nearestEnd} != ${nxt}`)
        }
      }
    }
  }

  for (let i = 0; i < P; i++) {
    for (let j = i + 1; j < P; j++) {
      const dx = (px[i] ?? 0) - (px[j] ?? 0)
      const dy = (py[i] ?? 0) - (py[j] ?? 0)
      const dist = Math.hypot(dx, dy)
      if (dist < 2 * nodeRadius - 1e-6) push(`pills ${i}/${j} overlap: distance ${dist} < ${2 * nodeRadius}`)
    }
    const pxv = px[i] ?? 0
    const pyv = py[i] ?? 0
    if (pxv - nodeRadius < -1e-6 || pxv + nodeRadius > width + 1e-6) push(`pair ${i} x ${pxv} outside frame width ${width}`)
    if (pyv - nodeRadius < -1e-6 || pyv + nodeRadius > height + 1e-6) push(`pair ${i} y ${pyv} outside frame height ${height}`)
  }
}

describe('pairGraphLayout and routePairGraph satisfy every LAY-04 truth across every even base', () => {
  it('sweep even bases 2..400', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    let covered = 0
    for (let n = 2; n <= 400; n += 2) {
      checkBase(n, mismatches)
      covered++
    }
    expect(covered).toBe(200)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('pairGraphLayout: specific base structures', () => {
  it('base 64 has six ring groups (torqueCount 6)', () => {
    clearNumogramCache()
    const g = createNumogram(64)
    expect(g.torqueCount).toBe(6)
    const layout = pairGraphLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    expect(rings.length).toBe(6)
  })

  it('base 28 has ring groups of 9 and 3 pairs plus plex and warp pills', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = pairGraphLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    expect(rings.map(r => r.nodeCount)).toEqual([9, 3])
    const capsules = layout.groups.filter(grp => grp.glyph === 'capsule')
    expect(capsules.map(c => c.nodeCount)).toEqual([1, 1])
    expect(capsules.map(c => c.kind).sort()).toEqual(['plex', 'warp'])
  })

  it('base 2 has exactly one capsule group (plex only)', () => {
    clearNumogramCache()
    const g = createNumogram(2)
    const layout = pairGraphLayout(g)
    expect(layout.groups.length).toBe(1)
    expect(layout.groups[0]?.kind).toBe('plex')
    expect(layout.groups[0]?.glyph).toBe('capsule')
    expect(layout.groups[0]?.nodeCount).toBe(1)
  })
})

describe('pairGraphLayout determinism', () => {
  it('gives byte-identical px and py arrays on a second call', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const first = pairGraphLayout(g)
    const second = pairGraphLayout(g)
    expect(first.px).toEqual(second.px)
    expect(first.py).toEqual(second.py)
  })
})
