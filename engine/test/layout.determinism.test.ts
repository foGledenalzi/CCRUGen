// LAY-01 determinism (D-09, D-14, D-15, Pitfall 15): the same base gives byte-identical coordinates, routes and SVG
// strings across repeated runs and after clearNumogramCache(), in every timezone (this file also runs under
// CCRUG_TZ=America/New_York via `npm run test:tz`). A source scan proves no layout or scene module ever reads a
// clock or the platform locale (T-03-21): none of Math.random, new Date, Date.now, Intl., toLocaleString appears
// anywhere under engine/layout or engine/scene.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { ladderLayout } from '../layout/ladder'
import { pairGraphLayout, routePairGraph } from '../layout/pairgraph'
import { ringLayout } from '../layout/ring'
import { routeCurrents, routeGates } from '../layout/routing'
import { spiralLayout } from '../layout/spiral'
import type { Layout } from '../layout/types'
import { layoutToSvg, pairGraphToSvg } from '../scene/svgString'

const BASES = [2, 4, 6, 8, 10, 12, 16, 28, 64, 82, 100, 256, 666, 1024]

const ZONE_BUILDERS: ReadonlyArray<{ readonly name: string; readonly build: (n: number) => Layout }> = [
  { name: 'ring-spiral', build: n => ringLayout(createNumogram(n), { packer: 'spiral' }) },
  { name: 'ring-shelf', build: n => ringLayout(createNumogram(n), { packer: 'shelf' }) },
  { name: 'ladder', build: n => ladderLayout(createNumogram(n)) },
  { name: 'spiral', build: n => spiralLayout(createNumogram(n)) },
]

/** Byte-identical comparison of two Float64Arrays (stricter than toEqual's value-wise compare: catches a -0/+0 or NaN-bit difference too). */
function sameBytes(a: Float64Array, b: Float64Array): boolean {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))
}

describe('determinism: repeated builds and cache clears give byte-identical output', () => {
  it('zone layouts (ring both packers, ladder, spiral): x/y byte-identical, groups/regionLabels/center/width/height equal, routes and SVG identical', () => {
    for (const n of BASES) {
      for (const { name, build } of ZONE_BUILDERS) {
        const tag = `${name} n=${n}`
        clearNumogramCache()
        const a = build(n)
        const b = build(n)
        expect(sameBytes(a.x, b.x), `${tag} x`).toBe(true)
        expect(sameBytes(a.y, b.y), `${tag} y`).toBe(true)
        expect(a.groups).toEqual(b.groups)
        expect(a.regionLabels).toEqual(b.regionLabels)
        expect(a.center).toEqual(b.center)
        expect(a.width).toBe(b.width)
        expect(a.height).toBe(b.height)

        clearNumogramCache()
        const c = build(n)
        expect(sameBytes(a.x, c.x), `${tag} x after cache clear`).toBe(true)
        expect(sameBytes(a.y, c.y), `${tag} y after cache clear`).toBe(true)

        const g = createNumogram(n)
        const gatesA = routeGates(g, a)
        const gatesB = routeGates(g, b)
        expect(gatesA.d).toEqual(gatesB.d)
        expect(gatesA.orientation).toEqual(gatesB.orientation)

        const currentsA = routeCurrents(g, a)
        const currentsB = routeCurrents(g, b)
        expect(currentsA.legA).toEqual(currentsB.legA)
        expect(currentsA.legB).toEqual(currentsB.legB)
        expect(currentsA.stem).toEqual(currentsB.stem)

        const svgA = layoutToSvg(g, a, { labels: 'all', gateLabels: true })
        const svgB = layoutToSvg(g, b, { labels: 'all', gateLabels: true })
        expect(svgA).toBe(svgB)
      }
    }
  })

  it('pairGraph: px/py byte-identical, arcs/loops and SVG identical, including after a cache clear', () => {
    for (const n of BASES) {
      const tag = `pairGraph n=${n}`
      clearNumogramCache()
      const g1 = createNumogram(n)
      const a = pairGraphLayout(g1)
      const b = pairGraphLayout(g1)
      expect(sameBytes(a.px, b.px), `${tag} px`).toBe(true)
      expect(sameBytes(a.py, b.py), `${tag} py`).toBe(true)
      expect(a.groups).toEqual(b.groups)
      expect(a.regionLabels).toEqual(b.regionLabels)
      expect(a.center).toEqual(b.center)
      expect(a.width).toBe(b.width)
      expect(a.height).toBe(b.height)

      clearNumogramCache()
      const g2 = createNumogram(n)
      const c = pairGraphLayout(g2)
      expect(sameBytes(a.px, c.px), `${tag} px after cache clear`).toBe(true)
      expect(sameBytes(a.py, c.py), `${tag} py after cache clear`).toBe(true)

      const routesA = routePairGraph(g1, a)
      const routesB = routePairGraph(g1, b)
      expect(routesA.arc).toEqual(routesB.arc)
      expect(routesA.loop).toEqual(routesB.loop)

      const svgA = pairGraphToSvg(g1, a, { labels: 'all' })
      const svgB = pairGraphToSvg(g1, b, { labels: 'all' })
      expect(svgA).toBe(svgB)
    }
  })
})

describe('source scan: engine/layout and engine/scene never read a clock or a locale (T-03-21)', () => {
  const FORBIDDEN = ['Math.random', 'new Date', 'Date.now', 'Intl.', 'toLocaleString']

  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) yield* walk(full)
      else if (entry.name.endsWith('.ts')) yield full
    }
  }

  it('contains none of Math.random, new Date, Date.now, Intl., toLocaleString', () => {
    const here = path.dirname(fileURLToPath(import.meta.url)) // engine/test
    const root = path.resolve(here, '..', '..') // repo root
    const dirs = [path.join(root, 'engine', 'layout'), path.join(root, 'engine', 'scene')]
    const mismatches: string[] = []
    let filesScanned = 0
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        filesScanned++
        const text = readFileSync(file, 'utf8')
        for (const token of FORBIDDEN) {
          if (text.includes(token)) mismatches.push(`${path.relative(root, file)} contains "${token}"`)
        }
      }
    }
    expect(filesScanned).toBeGreaterThan(0)
    expect(mismatches).toEqual([])
  })
})
