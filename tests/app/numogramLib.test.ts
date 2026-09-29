// Tests for the MIG-02 fixes in app/lib/numogram.ts (plexExpr), app/lib/geometry.ts (syzMidBiased/syzTrianglePoints)
// and app/lib/xenotation.ts (xenotationByZone). The old base-10-literal formulas are recomputed inline here on
// purpose (tests are not scanned by the MIG-02 grep gate) to prove the generalized functions still agree with them
// at base 10.
import { describe, expect, it } from 'vitest'
import { createNumogram, formatNumeral } from '../../engine/index'
import { plexExpr } from '../../app/lib/numogram'
import { syzMidBiased, syzTrianglePoints } from '../../app/lib/geometry'
import { xenotationByZone } from '../../app/lib/xenotation'
import { P_ORIGINAL } from '../../app/presets/base10/layout-tables'
import type { Pos } from '../../app/data/types'

describe('plexExpr: in-base digit sums, never decimal', () => {
  it('base 10 examples (only the first reduction step shows its digit breakdown, matching the frozen behaviour baseline captured from the pre-existing implementation)', () => {
    expect(plexExpr(45, 10)).toBe('4+5=9')
    expect(plexExpr(28, 10)).toBe('2+8=10=1')
    expect(plexExpr(9, 10)).toBeNull()
    expect(plexExpr(0, 10)).toBeNull()
  })

  it('other bases write digits and sums in their own numerals', () => {
    expect(plexExpr(120, 16)).toBe('7+8=f')
    expect(plexExpr(66, 12)).toBe('5+6=b')
  })

  it('agrees with the engine gate destination for every even base 2..64', () => {
    for (let n = 2; n <= 64; n += 2) {
      const g = createNumogram(n)
      for (let z = 0; z < n; z++) {
        const gate = g.gate(z)
        const cum = gate.cumulation
        if (cum < n) continue
        const expr = plexExpr(cum, n)
        expect(expr).not.toBeNull()
        const tail = (expr as string).split('=').pop()
        expect(tail).toBe(formatNumeral(gate.to, n))
      }
    }
  })
})

// The old base-10-only formulas, recomputed here as the independent oracle for the generalized functions.
function oldSyzMidBiased(zone: number, pos: Record<number, Pos>): Pos {
  const a = pos[zone], b = pos[9 - zone]
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  return { x: mx + (a.x - mx) * 0.15, y: my + (a.y - my) * 0.15 }
}

function oldSyzTrianglePoints(zone: number, pos: Record<number, Pos>): string {
  const partner = 9 - zone
  const p = pos[zone], pp = pos[partner]
  const dx = pp.x - p.x, dy = pp.y - p.y
  const angle = Math.atan2(dy, dx)
  const tipDist = 8, baseSize = 5
  const tipX = p.x + Math.cos(angle) * tipDist
  const tipY = p.y + Math.sin(angle) * tipDist
  const b1x = p.x + Math.cos(angle + Math.PI * 0.75) * baseSize
  const b1y = p.y + Math.sin(angle + Math.PI * 0.75) * baseSize
  const b2x = p.x + Math.cos(angle - Math.PI * 0.75) * baseSize
  const b2y = p.y + Math.sin(angle - Math.PI * 0.75) * baseSize
  return `${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`
}

describe('geometry: partner-aware, base 10 unchanged', () => {
  for (let z = 0; z <= 9; z++) {
    it(`syzMidBiased(${z}, 9-${z}, P_ORIGINAL) matches the old formula`, () => {
      expect(syzMidBiased(z, 9 - z, P_ORIGINAL)).toEqual(oldSyzMidBiased(z, P_ORIGINAL))
    })

    it(`syzTrianglePoints(${z}, 9-${z}, P_ORIGINAL) matches the old formula`, () => {
      expect(syzTrianglePoints(z, 9 - z, P_ORIGINAL)).toBe(oldSyzTrianglePoints(z, P_ORIGINAL))
    })
  }

  it('syzTrianglePoints scale=2 puts the tip at twice the default distance', () => {
    const zone = 6
    const partner = 9 - zone
    const p = P_ORIGINAL[zone]
    const tipOf = (points: string): Pos => {
      const [tip] = points.split(' ')
      const [x, y] = (tip as string).split(',').map(Number)
      return { x: x as number, y: y as number }
    }
    const dist = (a: Pos, b: Pos) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

    const at1 = tipOf(syzTrianglePoints(zone, partner, P_ORIGINAL))
    const at2 = tipOf(syzTrianglePoints(zone, partner, P_ORIGINAL, 2))

    expect(dist(p, at1)).toBeCloseTo(8, 9)
    expect(dist(p, at2)).toBeCloseTo(16, 9)
  })
})

describe('xenotationByZone(zoneCount)', () => {
  it('base 4 (0..3)', () => {
    expect(xenotationByZone(4)).toEqual({ 0: '', 1: 'n/a', 2: ':', 3: '(:)' })
  })
})
