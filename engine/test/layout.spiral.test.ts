// LAY-01/LAY-04 (D-04): spiralLayout puts every pair on one anticlockwise Archimedean spiral ordered by destination,
// innermost pair n/2 - 1 to outermost pair 0, odd member then even member, for every even base 2..400.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import type { Numogram } from '../core/types'
import { spiralLayout } from '../layout/spiral'

const MAX_MISMATCHES = 200
const TAU = 2 * Math.PI

/** The spiral's walk order: pair n/2 - 1 down to pair 0, odd member then even member of each pair. */
function walkOrder(g: Numogram): number[] {
  const n = g.base
  const P = n / 2
  const order: number[] = []
  for (let i = 0; i < P; i++) {
    const q = P - 1 - i
    const info = g.pair(q)
    order.push(info.odd, info.even)
  }
  return order
}

/** Checks the Barker-spiral truths for one base, appending short strings to `mismatches`. */
function checkSpiral(n: number, mismatches: string[]): void {
  const tag = `n=${n}`
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  const g = createNumogram(n)
  const layout = spiralLayout(g)
  const { x, y, width, height, nodeRadius, center } = layout
  const order = walkOrder(g)

  let prevDistSq = -Infinity
  let prevAngle: number | null = null
  let minDistSq = Infinity
  for (const z of order) {
    const px = x[z] ?? 0
    const py = y[z] ?? 0
    const dx = px - center.x
    const dy = py - center.y
    const distSq = dx * dx + dy * dy
    if (!(distSq > prevDistSq + 1e-9)) push(`zone ${z} distance from centre not strictly increasing`)
    prevDistSq = distSq
    if (distSq < minDistSq) minDistSq = distSq

    const angle = Math.atan2(-dy, dx)
    if (prevAngle !== null) {
      let step = angle - prevAngle
      while (step <= 0) step += TAU
      while (step > TAU + 1e-6) step -= TAU
      if (!(step > 0)) push(`zone ${z} angle step not anticlockwise`)
    }
    prevAngle = angle

    if (px - nodeRadius < -1e-6 || px + nodeRadius > width + 1e-6) push(`zone ${z} x ${px} outside frame width ${width}`)
    if (py - nodeRadius < -1e-6 || py + nodeRadius > height + 1e-6) push(`zone ${z} y ${py} outside frame height ${height}`)
  }

  const minAllowed = 3 * nodeRadius
  if (Math.sqrt(minDistSq) < minAllowed - 1e-6) push(`min centre distance ${Math.sqrt(minDistSq)} < ${minAllowed}`)
}

describe('spiralLayout satisfies every Barker-spiral truth across every even base', () => {
  it('sweep even bases 2..400', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    let covered = 0
    for (let n = 2; n <= 400; n += 2) {
      checkSpiral(n, mismatches)
      covered++
    }
    expect(covered).toBe(200)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('spiralLayout: base 10 structure', () => {
  it('zones 4 and 5 are nearest the centre, zones 0 and 9 farthest', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const layout = spiralLayout(g)
    const { x, y, center } = layout
    const distSq = (z: number): number => {
      const dx = (x[z] ?? 0) - center.x
      const dy = (y[z] ?? 0) - center.y
      return dx * dx + dy * dy
    }
    const distances = Array.from({ length: 10 }, (_, z) => ({ z, d: distSq(z) })).sort((p, q) => p.d - q.d)
    const nearest = distances
      .slice(0, 2)
      .map(e => e.z)
      .sort((p, q) => p - q)
    const farthest = distances
      .slice(-2)
      .map(e => e.z)
      .sort((p, q) => p - q)
    expect(nearest).toEqual([4, 5])
    expect(farthest).toEqual([0, 9])
  })
})

describe('spiralLayout determinism', () => {
  it('gives byte-identical x and y arrays on a second call', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const first = spiralLayout(g)
    const second = spiralLayout(g)
    expect(first.x).toEqual(second.x)
    expect(first.y).toEqual(second.y)
  })
})
