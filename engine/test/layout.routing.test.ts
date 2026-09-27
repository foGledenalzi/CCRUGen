// LAY-01/LAY-03 (T-03-10, T-03-11): routeGates and routeCurrents are pure numeric-id functions of (g, layout) with no
// name checks, no refs and no per-frame angular search. Every truth in 03-04-PLAN.md's must_haves is checked by a
// mismatch-collector sweep (the pattern of engine/test/layout.ring.test.ts) over every even base 2..200 on
// ringLayout, plus targeted checks for lanes, self-loop direction, orientation overrides and determinism.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { ringLayout } from '../layout/ring'
import { routeGates } from '../layout/routing'
import type { RouteOptions } from '../layout/types'

const MAX_MISMATCHES = 200
const NUM_RE = /-?\d+(?:\.\d+)?/g

interface Endpoints {
  readonly sx: number
  readonly sy: number
  readonly ex: number
  readonly ey: number
}

/** First and last (x, y) pair printed in an SVG path 'd' string, regardless of whether it is 'M.L.' or 'M.Q..'. */
function endpoints(d: string): Endpoints {
  const nums = d.match(NUM_RE)
  if (nums === null || nums.length < 4) throw new Error(`path has too few numbers: ${d}`)
  return {
    sx: Number(nums[0]),
    sy: Number(nums[1]),
    ex: Number(nums[nums.length - 2]),
    ey: Number(nums[nums.length - 1]),
  }
}

/** The control point (cx, cy) of a 'M sx sy Q cx cy ex ey' path (the only shape routeGates ever prints). */
function gateControl(d: string): { readonly cx: number; readonly cy: number } {
  const nums = d.match(NUM_RE)
  if (nums === null || nums.length !== 6) throw new Error(`gate path is not M.Q.: ${d}`)
  return { cx: Number(nums[2]), cy: Number(nums[3]) }
}

function hasBadNumber(s: string): boolean {
  return s.includes('NaN') || s.includes('Infinity') || s.includes('undefined')
}

/** Checks every 03-04-PLAN.md gate-routing truth for one base; appends short strings to `mismatches`. */
function checkGates(n: number, mismatches: string[]): void {
  const tag = `gates n=${n}`
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  const g = createNumogram(n)
  const layout = ringLayout(g)
  const routes = routeGates(g, layout)
  const { d, labelX, labelY, loop, to, maxInDegree } = routes
  const r = layout.nodeRadius

  if (d.length !== n) push(`d.length ${d.length} != ${n}`)

  const destCount = new Map<number, number>()
  for (let z = 0; z < n; z++) {
    const dz = d[z] ?? ''
    if (!dz.startsWith('M')) push(`zone ${z} d does not start with M`)
    if (hasBadNumber(dz)) push(`zone ${z} d has a bad number: ${dz}`)
    const expectedTo = g.gate(z).to
    if ((to[z] ?? -1) !== expectedTo) push(`zone ${z} to ${to[z]} != gate.to ${expectedTo}`)
    const expectedLoop = expectedTo === z ? 1 : 0
    if ((loop[z] ?? -1) !== expectedLoop) push(`zone ${z} loop ${loop[z]} != ${expectedLoop}`)
    if (!Number.isFinite(labelX[z] ?? NaN) || !Number.isFinite(labelY[z] ?? NaN)) push(`zone ${z} label not finite`)
    if (expectedTo !== z) destCount.set(expectedTo, (destCount.get(expectedTo) ?? 0) + 1)
  }
  let expectedMaxInDegree = 0
  destCount.forEach(c => {
    if (c > expectedMaxInDegree) expectedMaxInDegree = c
  })
  if (maxInDegree !== expectedMaxInDegree) push(`maxInDegree ${maxInDegree} != ${expectedMaxInDegree}`)

  for (let z = 0; z < n; z++) {
    const dz = d[z] ?? ''
    const t = to[z] ?? 0
    const zx = layout.x[z] ?? 0
    const zy = layout.y[z] ?? 0
    const grpIdx = layout.zoneGroup[z] ?? -1
    const grp = grpIdx >= 0 ? layout.groups[grpIdx] : undefined

    if (t === z) {
      const { cx, cy } = gateControl(dz)
      const dist = Math.hypot(cx - zx, cy - zy)
      if (Math.abs(dist - 3.1 * r) > 0.02) push(`zone ${z} self loop reach ${dist} != ${3.1 * r}`)
      if (grp !== undefined && grp.glyph === 'capsule') {
        if (!(cy > zy)) push(`zone ${z} capsule self loop control not below node`)
        if (Math.abs(cx - zx) > 0.02) push(`zone ${z} capsule self loop control x drifted`)
      } else if (grp !== undefined && grp.glyph === 'ring') {
        const rdist = Math.hypot(zx - grp.cx, zy - grp.cy)
        if (rdist > 1e-6) {
          const ex0 = (zx - grp.cx) / rdist
          const ey0 = (zy - grp.cy) / rdist
          const actualDist = Math.hypot(cx - zx, cy - zy) || 1
          const ax0 = (cx - zx) / actualDist
          const ay0 = (cy - zy) / actualDist
          if (Math.hypot(ax0 - ex0, ay0 - ey0) > 0.02) push(`zone ${z} ring self loop not radial`)
        }
      }
      continue
    }

    const tx = layout.x[t] ?? 0
    const ty = layout.y[t] ?? 0
    const len = Math.hypot(tx - zx, ty - zy)
    if (len > 2 * r + 2) {
      const { sx, sy, ex, ey } = endpoints(dz)
      const startDist = Math.hypot(sx - zx, sy - zy)
      const endDist = Math.hypot(ex - tx, ey - ty)
      if (Math.abs(startDist - r) > 0.02) push(`zone ${z} gate start distance ${startDist} != ${r}`)
      if (Math.abs(endDist - r) > 0.02) push(`zone ${z} gate end distance ${endDist} != ${r}`)
    }
  }

  destCount.forEach((count, dest) => {
    if (count < 2) return
    const controls: Array<{ readonly cx: number; readonly cy: number }> = []
    for (let z = 0; z < n; z++) {
      if ((to[z] ?? -1) === dest) controls.push(gateControl(d[z] ?? ''))
    }
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const ci = controls[i]
        const cj = controls[j]
        if (ci === undefined || cj === undefined) continue
        if (Math.hypot(ci.cx - cj.cx, ci.cy - cj.cy) < 0.5) push(`dest ${dest} lanes ${i}/${j} share a control point`)
      }
    }
  })

  const second = routeGates(g, layout)
  if (JSON.stringify(second.d) !== JSON.stringify(d)) push('second call produced different d strings')
}

describe('routeGates satisfies every 03-04-PLAN.md gate truth across every even base', () => {
  it('sweep even bases 2..200', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    let covered = 0
    for (let n = 2; n <= 200; n += 2) {
      checkGates(n, mismatches)
      covered++
    }
    expect(covered).toBe(100)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('routeGates: orientation override flips the bulge side of a non-self, single-lane gate', () => {
  it('base 28', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const base = routeGates(g, layout)

    let z0 = -1
    for (let z = 0; z < 28; z++) {
      const t = base.to[z] ?? -1
      if (t === z) continue
      let inDegree = 0
      for (let zz = 0; zz < 28; zz++) {
        if ((base.to[zz] ?? -2) === t && zz !== t) inDegree++
      }
      if (inDegree === 1) {
        z0 = z
        break
      }
    }
    expect(z0).toBeGreaterThanOrEqual(0)

    const flip = new Int8Array(28)
    flip[z0] = base.orientation[z0] === 1 ? -1 : 1
    const opts: RouteOptions = { orientation: flip }
    const flipped = routeGates(g, layout, opts)

    expect(flipped.orientation[z0]).toBe(flip[z0])
    expect(flipped.d[z0]).not.toBe(base.d[z0])
    for (let z = 0; z < 28; z++) {
      if (z === z0) continue
      expect(flipped.d[z]).toBe(base.d[z])
    }
  })
})

describe('routeGates determinism', () => {
  it('gives identical arrays on a second call', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const a = routeGates(g, layout)
    const b = routeGates(g, layout)
    expect(a.d).toEqual(b.d)
    expect(a.labelX).toEqual(b.labelX)
    expect(a.orientation).toEqual(b.orientation)
  })
})
