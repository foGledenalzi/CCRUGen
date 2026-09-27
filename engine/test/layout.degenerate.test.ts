// Pitfall 10 (degenerate bases) and Pitfall 3 (determinism / no NaN) across every layout and the scene emitter:
// bases 2, 4 and 6 (no Torque cycles, or one small one) must lay out and route and emit cleanly in all four layouts
// (ring, ladder, spiral, pairGraph), and every even base up to 128 (plus the review-set bases 28, 64, 82, 100) must
// emit a single well-formed SVG document with no 'NaN', 'Infinity' or 'undefined' anywhere in it. Mismatches are
// collected as short strings (the pattern of layout.ring.test.ts) so a failure names the base and the layout.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import type { Numogram } from '../core/types'
import { ladderLayout } from '../layout/ladder'
import { pairGraphLayout, routePairGraph } from '../layout/pairgraph'
import { ringLayout } from '../layout/ring'
import { routeCurrents, routeGates } from '../layout/routing'
import { spiralLayout } from '../layout/spiral'
import type { Layout } from '../layout/types'
import { layoutToSvg, pairGraphToSvg } from '../scene/svgString'

const MAX_MISMATCHES = 200

function hasBadNumber(s: string): boolean {
  return s.includes('NaN') || s.includes('Infinity') || s.includes('undefined')
}

const ZONE_LAYOUT_BUILDERS: ReadonlyArray<{ readonly name: string; readonly build: (g: Numogram) => Layout }> = [
  { name: 'ring', build: g => ringLayout(g) },
  { name: 'ladder', build: g => ladderLayout(g) },
  { name: 'spiral', build: g => spiralLayout(g) },
]

/** Every coordinate finite and every node disc inside [0, width] x [0, height], for one already-built layout. */
function checkFinite(tag: string, layout: Layout, mismatches: string[]): void {
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  for (let z = 0; z < layout.base; z++) {
    const x = layout.x[z] ?? NaN
    const y = layout.y[z] ?? NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) push(`zone ${z} coordinate not finite`)
    const radius = layout.nodeRadii?.[z] ?? layout.nodeRadius
    if (x - radius < -1e-6 || x + radius > layout.width + 1e-6) push(`zone ${z} x outside frame width ${layout.width}`)
    if (y - radius < -1e-6 || y + radius > layout.height + 1e-6) push(`zone ${z} y outside frame height ${layout.height}`)
  }
}

describe('degenerate bases 2, 4 and 6 lay out, route and emit cleanly in every layout (Pitfall 10)', () => {
  const bases = [2, 4, 6]

  it('finite coordinates, node discs inside the frame, no bad numbers in any route or SVG string', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    for (const n of bases) {
      const g = createNumogram(n)

      for (const { name, build } of ZONE_LAYOUT_BUILDERS) {
        const tag = `n=${n} ${name}`
        const layout = build(g)
        checkFinite(tag, layout, mismatches)

        const gateRoutes = routeGates(g, layout)
        for (const d of gateRoutes.d) if (hasBadNumber(d)) mismatches.push(`${tag} gate d has a bad number: ${d}`)

        const currentRoutes = routeCurrents(g, layout)
        for (const d of currentRoutes.legA) if (hasBadNumber(d)) mismatches.push(`${tag} current legA has a bad number: ${d}`)
        for (const d of currentRoutes.legB) if (hasBadNumber(d)) mismatches.push(`${tag} current legB has a bad number: ${d}`)
        for (const d of currentRoutes.stem) if (hasBadNumber(d)) mismatches.push(`${tag} current stem has a bad number: ${d}`)

        const svg = layoutToSvg(g, layout, { labels: 'all', gateLabels: true })
        if (hasBadNumber(svg)) mismatches.push(`${tag} svg has a bad number`)
      }

      const pgTag = `n=${n} pairGraph`
      const pg = pairGraphLayout(g)
      checkFinite(pgTag, pg, mismatches)
      const routes = routePairGraph(g, pg)
      for (const d of routes.arc) if (d !== null && hasBadNumber(d)) mismatches.push(`${pgTag} arc has a bad number: ${d}`)
      for (const d of routes.loop) if (d !== null && hasBadNumber(d)) mismatches.push(`${pgTag} loop has a bad number: ${d}`)
      const pgSvg = pairGraphToSvg(g, pg, { labels: 'all' })
      if (hasBadNumber(pgSvg)) mismatches.push(`${pgTag} svg has a bad number`)
    }
    expect(mismatches.slice(0, 20)).toEqual([])
  })

  it('base 2 ring: exactly one group (the plex capsule, nodeCount 2), no ring', () => {
    clearNumogramCache()
    const g = createNumogram(2)
    const layout = ringLayout(g)
    expect(layout.groups.length).toBe(1)
    expect(layout.groups[0]?.kind).toBe('plex')
    expect(layout.groups[0]?.glyph).toBe('capsule')
    expect(layout.groups[0]?.nodeCount).toBe(2)
    expect(layout.groups.some(grp => grp.glyph === 'ring')).toBe(false)
  })

  it('base 4 ring: plex and warp capsule groups, no ring', () => {
    clearNumogramCache()
    const g = createNumogram(4)
    const layout = ringLayout(g)
    expect(layout.groups.some(grp => grp.glyph === 'ring')).toBe(false)
    expect(layout.groups.map(grp => grp.kind).sort()).toEqual(['plex', 'warp'])
    expect(layout.groups.every(grp => grp.glyph === 'capsule')).toBe(true)
  })

  it('base 6 ring: one ring group (nodeCount 4) plus the plex capsule, no warp', () => {
    clearNumogramCache()
    const g = createNumogram(6)
    expect(g.warp).toBeNull()
    const layout = ringLayout(g)
    const rings = layout.groups.filter(grp => grp.glyph === 'ring')
    const capsules = layout.groups.filter(grp => grp.glyph === 'capsule')
    expect(rings.map(grp => grp.nodeCount)).toEqual([4])
    expect(capsules.map(grp => grp.kind)).toEqual(['plex'])
  })

  it('base 2 pair graph: one capsule pill with a loop', () => {
    clearNumogramCache()
    const g = createNumogram(2)
    const pg = pairGraphLayout(g)
    expect(pg.groups.length).toBe(1)
    expect(pg.groups[0]?.glyph).toBe('capsule')
    const routes = routePairGraph(g, pg)
    expect(routes.loop[0]).not.toBeNull()
    expect(routes.arc[0]).toBeNull()
  })

  it('base 4 pair graph: two pills, both self-looping', () => {
    clearNumogramCache()
    const g = createNumogram(4)
    const pg = pairGraphLayout(g)
    expect(pg.groups.length).toBe(2)
    expect(pg.groups.every(grp => grp.glyph === 'capsule')).toBe(true)
    const routes = routePairGraph(g, pg)
    for (let q = 0; q < 2; q++) {
      expect(routes.loop[q]).not.toBeNull()
      expect(routes.arc[q]).toBeNull()
    }
  })

  it('base 6 pair graph: one ring of 2 pair nodes (two arcs) plus the plex pill', () => {
    clearNumogramCache()
    const g = createNumogram(6)
    const pg = pairGraphLayout(g)
    const rings = pg.groups.filter(grp => grp.glyph === 'ring')
    const capsules = pg.groups.filter(grp => grp.glyph === 'capsule')
    expect(rings.map(grp => grp.nodeCount)).toEqual([2])
    expect(capsules.map(grp => grp.kind)).toEqual(['plex'])
    const routes = routePairGraph(g, pg)
    const arcCount = routes.arc.filter(d => d !== null).length
    const loopCount = routes.loop.filter(d => d !== null).length
    expect(arcCount).toBe(2)
    expect(loopCount).toBe(1)
  })
})

describe('nan sweep: every even base up to 128 (plus 28, 64, 82, 100) emits one clean SVG per layout', () => {
  it('sweep', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    const bases = new Set<number>()
    for (let n = 2; n <= 128; n += 2) bases.add(n)
    for (const n of [28, 64, 82, 100]) bases.add(n)

    let covered = 0
    for (const n of bases) {
      covered++
      const g = createNumogram(n)

      for (const { name, build } of ZONE_LAYOUT_BUILDERS) {
        const tag = `n=${n} ${name}`
        const layout = build(g)
        const svg = layoutToSvg(g, layout, { labels: 'all', gateLabels: true })
        if (hasBadNumber(svg)) mismatches.push(`${tag} svg has a bad number`)
        const openCount = (svg.match(/<svg\b/g) ?? []).length
        const closeCount = (svg.match(/<\/svg>/g) ?? []).length
        if (openCount !== 1) mismatches.push(`${tag} <svg> count ${openCount} != 1`)
        if (closeCount !== 1) mismatches.push(`${tag} </svg> count ${closeCount} != 1`)
      }

      const pgTag = `n=${n} pairGraph`
      const pg = pairGraphLayout(g)
      const pgSvg = pairGraphToSvg(g, pg, { labels: 'all' })
      if (hasBadNumber(pgSvg)) mismatches.push(`${pgTag} svg has a bad number`)
      const openCount = (pgSvg.match(/<svg\b/g) ?? []).length
      const closeCount = (pgSvg.match(/<\/svg>/g) ?? []).length
      if (openCount !== 1) mismatches.push(`${pgTag} <svg> count ${openCount} != 1`)
      if (closeCount !== 1) mismatches.push(`${pgTag} </svg> count ${closeCount} != 1`)
    }

    expect(covered).toBe(bases.size)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})
