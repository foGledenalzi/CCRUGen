// LAY-01 sweep (D-01, D-02, D-03, D-06): ringLayout is checked, per base, against every truth in 03-01-PLAN.md's
// must_haves for every even base 2..400 (both packers) plus 666, 1024 and 4096. Mismatches are collected as short
// strings (the mismatch-collector pattern of structure.sweep.test.ts) so a failure names the base, the packer and the
// item; one expect per sweep. Distance comparisons prefer squared distances over sqrt/hypot in the O(n^2) checks so
// the base-4096 case stays fast.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { DEFAULT_LAYOUT_PARAMS } from '../layout/params'
import { ringLayout } from '../layout/ring'
import type { Packer } from '../layout/types'

const MAX_MISMATCHES = 200
const TAU = 2 * Math.PI
const { s: S, nestDelta: NEST_DELTA, glyphGap: GLYPH_GAP } = DEFAULT_LAYOUT_PARAMS

/** Checks every must_have truth of 03-01-PLAN.md for one base and one packer; appends short strings to `mismatches`. */
function checkBase(n: number, packer: Packer, mismatches: string[]): void {
  const tag = `n=${n} packer=${packer}`
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  const g = createNumogram(n)
  const layout = ringLayout(g, { packer })
  const { x, y, width, height, natural, nodeRadius, labelSize, strokeScale, scale, groups } = layout

  for (let z = 0; z < n; z++) {
    const px = x[z] ?? NaN
    const py = y[z] ?? NaN
    if (!Number.isFinite(px) || !Number.isFinite(py)) push(`zone ${z} coordinate not finite`)
  }

  const ringGroups = groups.filter(grp => grp.glyph === 'ring')
  const capsuleGroups = groups.filter(grp => grp.glyph === 'capsule')
  let maxRingY = -Infinity

  for (const grp of ringGroups) {
    const cycle = g.cycleAt(grp.cycle)
    const zs = cycle.zones()
    const m = zs.length
    if (m !== grp.nodeCount) push(`ring ${grp.cycle} nodeCount ${grp.nodeCount} != zones ${m}`)

    for (let j = 0; j < m; j++) {
      const z = zs[j] ?? 0
      const px = x[z] ?? 0
      const py = y[z] ?? 0
      if (py > maxRingY) maxRingY = py
      const dist = Math.hypot(px - grp.cx, py - grp.cy)
      if (Math.abs(dist - grp.radius) / grp.radius > 1e-9) push(`ring ${grp.cycle} zone ${z} distance ${dist} != radius ${grp.radius}`)
      const isOdd = z % 2 === 1
      const expectOdd = j % 2 === 0
      if (isOdd !== expectOdd) push(`ring ${grp.cycle} walk parity at ${j}: zone ${z}`)
    }

    let neighbour0 = -1
    for (let j = 0; j < m; j++) {
      const za = zs[j] ?? 0
      const zb = zs[(j + 1) % m] ?? 0
      const dist = Math.hypot((x[za] ?? 0) - (x[zb] ?? 0), (y[za] ?? 0) - (y[zb] ?? 0))
      if (neighbour0 < 0) neighbour0 = dist
      else if (Math.abs(dist - neighbour0) / neighbour0 > 1e-9) push(`ring ${grp.cycle} neighbour distance at ${j} not uniform`)

      const angA = Math.atan2(-((y[za] ?? 0) - grp.cy), (x[za] ?? 0) - grp.cx)
      const angB = Math.atan2(-((y[zb] ?? 0) - grp.cy), (x[zb] ?? 0) - grp.cx)
      let step = angB - angA
      while (step <= 0) step += TAU
      while (step > TAU + 1e-9) step -= TAU
      if (Math.abs(step - TAU / m) > 1e-9) push(`ring ${grp.cycle} angle step at ${j} = ${step} != ${TAU / m}`)
    }
    const minNeighbour = S * scale * (1 - 1e-9)
    if (neighbour0 >= 0 && neighbour0 < minNeighbour) push(`ring ${grp.cycle} neighbour distance ${neighbour0} < ${minNeighbour}`)

    const pairCount = m / 2
    for (let jp = 0; jp < pairCount; jp++) {
      const zOdd = zs[2 * jp] ?? 0
      const zEven = zs[2 * jp + 1] ?? 0
      if (g.partner(zOdd) !== zEven) push(`ring ${grp.cycle} partner(${zOdd}) != ${zEven}`)
      const nextZone = zs[(2 * jp + 2) % m] ?? 0
      const cur = g.current(g.pairOf(zEven))
      if (cur.to !== nextZone) push(`ring ${grp.cycle} current.to at pair ${jp} = ${cur.to} != ${nextZone}`)
    }

    const z0 = zs[0] ?? 0
    const z1 = zs[1] ?? 0
    if (!((x[z0] ?? 0) > grp.cx && grp.cx > (x[z1] ?? 0))) push(`ring ${grp.cycle} smallest pair not straddling top (x)`)
    if (Math.abs((y[z0] ?? 0) - (y[z1] ?? 0)) >= 1e-9) push(`ring ${grp.cycle} smallest pair not straddling top (y)`)
  }

  if (ringGroups.length > 0 && ringGroups.length <= 3) {
    const cx0 = ringGroups[0]?.cx ?? 0
    const cy0 = ringGroups[0]?.cy ?? 0
    for (let i = 0; i < ringGroups.length; i++) {
      const grp = ringGroups[i]
      if (grp === undefined) continue
      if (Math.abs(grp.cx - cx0) > 1e-6 || Math.abs(grp.cy - cy0) > 1e-6) push(`nested ring ${grp.cycle} centre mismatch`)
      if (i > 0) {
        const prev = ringGroups[i - 1]
        if (prev !== undefined) {
          if (!(prev.radius > grp.radius)) push(`nested ring ${grp.cycle} radius not strictly smaller than previous`)
          const gap = prev.radius - grp.radius
          const minGap = NEST_DELTA * S * scale - 1e-9
          if (gap < minGap) push(`nested ring ${grp.cycle} gap ${gap} < ${minGap}`)
        }
      }
    }
  } else if (ringGroups.length >= 4) {
    for (let i = 0; i < ringGroups.length; i++) {
      for (let j = i + 1; j < ringGroups.length; j++) {
        const a = ringGroups[i]
        const b = ringGroups[j]
        if (a === undefined || b === undefined) continue
        const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy)
        const clearance = dist - a.boundRadius - b.boundRadius
        const minClearance = GLYPH_GAP * scale - 1e-6
        if (clearance < minClearance) push(`packed rings ${a.cycle}/${b.cycle} clearance ${clearance} < ${minClearance}`)
      }
    }
  }

  const plexGroups = capsuleGroups.filter(grp => grp.kind === 'plex')
  const warpGroups = capsuleGroups.filter(grp => grp.kind === 'warp')
  if (plexGroups.length !== 1) push(`plex capsule count ${plexGroups.length} != 1`)
  if (warpGroups.length !== (g.warp !== null ? 1 : 0)) push(`warp capsule count ${warpGroups.length} != ${g.warp !== null ? 1 : 0}`)

  for (const grp of capsuleGroups) {
    const cycle = g.cycleAt(grp.cycle)
    const zs = cycle.zones()
    const zOdd = zs[0] ?? 0
    const zEven = zs[1] ?? 0
    if (Math.abs((y[zOdd] ?? 0) - (y[zEven] ?? 0)) >= 1e-9) push(`capsule ${grp.cycle} members do not share y`)
    if (!((x[zOdd] ?? 0) < (x[zEven] ?? 0))) push(`capsule ${grp.cycle} odd member does not have the smaller x`)
    if (ringGroups.length > 0) {
      if (!((y[zOdd] ?? 0) - nodeRadius > maxRingY + nodeRadius)) push(`capsule ${grp.cycle} zone ${zOdd} not below every ring node`)
      if (!((y[zEven] ?? 0) - nodeRadius > maxRingY + nodeRadius)) push(`capsule ${grp.cycle} zone ${zEven} not below every ring node`)
    }
  }

  for (let z = 0; z < n; z++) {
    const px = x[z] ?? 0
    const py = y[z] ?? 0
    if (px - nodeRadius < -1e-6 || px + nodeRadius > width + 1e-6) push(`zone ${z} x ${px} outside frame width ${width}`)
    if (py - nodeRadius < -1e-6 || py + nodeRadius > height + 1e-6) push(`zone ${z} y ${py} outside frame height ${height}`)
  }
  if (width < 800 - 1e-9) push(`width ${width} < 800`)
  if (height < 600 - 1e-9) push(`height ${height} < 600`)
  if (Math.max(width, height) > 4096 + 1e-9) push(`max(width,height) ${Math.max(width, height)} > 4096`)

  const minAllowed = 3 * nodeRadius
  const minAllowedSq = minAllowed * minAllowed
  let minCentreDistSq = Infinity
  for (let a = 0; a < n; a++) {
    const ax = x[a] ?? 0
    const ay = y[a] ?? 0
    for (let b = a + 1; b < n; b++) {
      const dx = ax - (x[b] ?? 0)
      const dy = ay - (y[b] ?? 0)
      const distSq = dx * dx + dy * dy
      if (distSq < minCentreDistSq) minCentreDistSq = distSq
    }
  }
  if (minCentreDistSq < minAllowedSq - 1e-6) push(`min centre distance sq ${minCentreDistSq} < ${minAllowedSq}`)

  if (Math.abs(nodeRadius - 21 * scale) > 1e-9) push(`nodeRadius ${nodeRadius} != 21 * scale`)
  if (Math.abs(labelSize - 0.8 * nodeRadius) / nodeRadius > 1e-12) push(`labelSize ${labelSize} != 0.8 * nodeRadius`)
  if (Math.abs(strokeScale - Math.max(1, width / 800)) > 1e-9) push(`strokeScale ${strokeScale} != max(1, width/800)`)
  const expectedScale = Math.min(1, 4096 / Math.max(natural.width, natural.height))
  if (Math.abs(scale - expectedScale) > 1e-9) push(`scale ${scale} != ${expectedScale}`)
}

describe('ringLayout satisfies every LAY-01/LAY-03 truth across every even base', () => {
  const packers: readonly Packer[] = ['spiral', 'shelf']
  for (const packer of packers) {
    it(`sweep even bases 2..400 plus 666, 1024, 4096 (packer ${packer})`, () => {
      clearNumogramCache()
      const mismatches: string[] = []
      let covered = 0
      for (let n = 2; n <= 400; n += 2) {
        checkBase(n, packer, mismatches)
        covered++
      }
      for (const n of [666, 1024, 4096]) checkBase(n, packer, mismatches)
      expect(covered).toBe(200)
      expect(mismatches.slice(0, 20)).toEqual([])
    })
  }
})

describe('ringLayout: specific base structures', () => {
  it('base 28 has two ring groups (18 and 6 zones) sharing a centre', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    expect(rings.map(r => r.nodeCount)).toEqual([18, 6])
    expect(rings[0]?.cx).toBeCloseTo(rings[1]?.cx ?? NaN, 9)
    expect(rings[0]?.cy).toBeCloseTo(rings[1]?.cy ?? NaN, 9)
  })

  it('base 82 has three ring groups (54, 18 and 6 zones)', () => {
    clearNumogramCache()
    const g = createNumogram(82)
    const layout = ringLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    expect(rings.map(r => r.nodeCount)).toEqual([54, 18, 6])
  })

  it('base 64 has six packed ring groups (torqueCount 6)', () => {
    clearNumogramCache()
    const g = createNumogram(64)
    expect(g.torqueCount).toBe(6)
    const layout = ringLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    expect(rings.length).toBe(6)
  })

  it('base 2 has exactly one group (the plex capsule) and 2 nodes', () => {
    clearNumogramCache()
    const g = createNumogram(2)
    const layout = ringLayout(g)
    expect(layout.groups.length).toBe(1)
    expect(layout.groups[0]?.kind).toBe('plex')
    expect(layout.groups[0]?.glyph).toBe('capsule')
    expect(layout.base).toBe(2)
  })

  it('base 4 has plex and warp capsules and no ring', () => {
    clearNumogramCache()
    const g = createNumogram(4)
    const layout = ringLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    const capsules = layout.groups.filter(grp => grp.glyph === 'capsule')
    expect(rings.length).toBe(0)
    expect(capsules.map(c => c.kind).sort()).toEqual(['plex', 'warp'])
  })

  it('capsulePlacement "above" puts the warp capsule above the plex capsule at the same x', () => {
    clearNumogramCache()
    const g = createNumogram(10) // torqueCount 1, warp present
    const layout = ringLayout(g, { capsulePlacement: 'above' })
    const plex = layout.groups.find(grp => grp.kind === 'plex')
    const warp = layout.groups.find(grp => grp.kind === 'warp')
    expect(plex).toBeDefined()
    expect(warp).toBeDefined()
    if (plex !== undefined && warp !== undefined) {
      expect(warp.cx).toBeCloseTo(plex.cx, 9)
      expect(warp.cy).toBeLessThan(plex.cy)
    }
  })
})

describe('ringLayout determinism', () => {
  it('gives byte-identical x and y arrays on a second call', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const a = ringLayout(g)
    const b = ringLayout(g)
    expect(a.x).toEqual(b.x)
    expect(a.y).toEqual(b.y)
  })
})
