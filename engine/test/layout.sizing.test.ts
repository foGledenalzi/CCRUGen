// LAY-03 size invariants (D-06): node radius, label size, stroke scale and the growth-cap scale follow the stated
// formulas and never increase as the natural (pre-cap) frame grows, across ring (both packers), ladder and spiral;
// the pair graph's pill height follows its own formula. The review-set bases additionally prove every node disc (a
// pill's bounding circle for the pair graph) stays inside the frame, minimum centre spacing holds, every region
// label anchor stays inside the frame, and the on-screen radius is positive. O(n^2) distance checks are kept to the
// review-set bases only (n <= 100); the formula and monotonic checks below are O(n) per layout.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { ladderLayout } from '../layout/ladder'
import { pairGraphLayout } from '../layout/pairgraph'
import { ringLayout } from '../layout/ring'
import { spiralLayout } from '../layout/spiral'
import type { Layout } from '../layout/types'

const MAX_MISMATCHES = 200
const NODE_R = 21 // DEFAULT_LAYOUT_PARAMS.r

const SIZING_BASES: readonly number[] = (() => {
  const bases: number[] = []
  for (let n = 2; n <= 400; n += 2) bases.push(n)
  bases.push(666, 1024, 4096)
  return bases
})()
const REVIEW_BASES = [2, 4, 6, 8, 12, 16, 28, 64, 82, 100]

interface Sample {
  readonly id: string
  readonly n: number
  readonly layout: Layout
}

const BUILDERS: ReadonlyArray<{ readonly id: string; readonly build: (n: number) => Layout }> = [
  { id: 'ring-spiral', build: n => ringLayout(createNumogram(n), { packer: 'spiral' }) },
  { id: 'ring-shelf', build: n => ringLayout(createNumogram(n), { packer: 'shelf' }) },
  { id: 'ladder', build: n => ladderLayout(createNumogram(n)) },
  { id: 'spiral', build: n => spiralLayout(createNumogram(n)) },
]

// Built once (module scope) and reused by both the "sizing" and "monotonic" describe blocks below, instead of
// rebuilding every base twice: layout construction is pure and does not depend on the numogram cache's contents.
const SAMPLES: ReadonlyMap<string, readonly Sample[]> = (() => {
  clearNumogramCache()
  const map = new Map<string, Sample[]>()
  for (const { id, build } of BUILDERS) {
    map.set(
      id,
      SIZING_BASES.map(n => ({ id, n, layout: build(n) })),
    )
  }
  clearNumogramCache()
  return map
})()

function push(mismatches: string[], msg: string): void {
  if (mismatches.length < MAX_MISMATCHES) mismatches.push(msg)
}

describe('sizing: nodeRadius, labelSize, strokeScale and scale follow the stated formulas', () => {
  it('holds for ring (both packers), ladder and spiral over every even n in [2, 400] plus 666, 1024, 4096', () => {
    const mismatches: string[] = []
    for (const { id } of BUILDERS) {
      const samples = SAMPLES.get(id) ?? []
      for (const { n, layout } of samples) {
        const tag = `${id} n=${n}`
        const expectedRadius = NODE_R * layout.scale
        if (Math.abs(layout.nodeRadius - expectedRadius) / expectedRadius > 1e-12) {
          push(mismatches, `${tag} nodeRadius ${layout.nodeRadius} != 21 * scale (${expectedRadius})`)
        }
        if (Math.abs(layout.labelSize - 0.8 * layout.nodeRadius) > 1e-9) {
          push(mismatches, `${tag} labelSize ${layout.labelSize} != 0.8 * nodeRadius`)
        }
        const expectedStroke = Math.max(1, layout.width / 800)
        if (Math.abs(layout.strokeScale - expectedStroke) > 1e-9) {
          push(mismatches, `${tag} strokeScale ${layout.strokeScale} != max(1, width/800)`)
        }
        if (!(layout.scale > 0 && layout.scale <= 1)) push(mismatches, `${tag} scale ${layout.scale} not within (0, 1]`)
        const bigSide = Math.max(layout.width, layout.height)
        if (bigSide > 4096 + 1e-9) push(mismatches, `${tag} max(width,height) ${bigSide} > 4096`)
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([])
  })

  it('pair graph: nodeHeight === 1.6 * 21 * scale', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    for (const n of SIZING_BASES) {
      const pg = pairGraphLayout(createNumogram(n))
      const expected = 1.6 * NODE_R * pg.scale
      if (Math.abs(pg.nodeHeight - expected) > 1e-9) {
        push(mismatches, `pairGraph n=${n} nodeHeight ${pg.nodeHeight} != ${expected}`)
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('monotonic: within each layout id, scale and nodeRadius never increase as the natural frame grows', () => {
  it('holds for ring (both packers), ladder and spiral', () => {
    const mismatches: string[] = []
    for (const { id } of BUILDERS) {
      const samples = (SAMPLES.get(id) ?? []).slice()
      samples.sort(
        (a, b) =>
          Math.max(a.layout.natural.width, a.layout.natural.height) - Math.max(b.layout.natural.width, b.layout.natural.height),
      )
      for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1]
        const cur = samples[i]
        if (prev === undefined || cur === undefined) continue
        if (cur.layout.scale > prev.layout.scale + 1e-9) {
          push(mismatches, `${id}: scale increased from n=${prev.n} (${prev.layout.scale}) to n=${cur.n} (${cur.layout.scale})`)
        }
        if (cur.layout.nodeRadius > prev.layout.nodeRadius + 1e-9) {
          push(
            mismatches,
            `${id}: nodeRadius increased from n=${prev.n} (${prev.layout.nodeRadius}) to n=${cur.n} (${cur.layout.nodeRadius})`,
          )
        }
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

function checkZoneLayout(tag: string, layout: Layout, mismatches: string[]): void {
  const r = layout.nodeRadius
  for (let z = 0; z < layout.base; z++) {
    const x = layout.x[z] ?? 0
    const y = layout.y[z] ?? 0
    const radius = layout.nodeRadii?.[z] ?? r
    if (x - radius < -1e-6 || x + radius > layout.width + 1e-6) push(mismatches, `${tag} zone ${z} x outside frame`)
    if (y - radius < -1e-6 || y + radius > layout.height + 1e-6) push(mismatches, `${tag} zone ${z} y outside frame`)
  }

  const minAllowed = 3 * r
  const minAllowedSq = minAllowed * minAllowed
  let minDistSq = Infinity
  for (let a = 0; a < layout.base; a++) {
    const ax = layout.x[a] ?? 0
    const ay = layout.y[a] ?? 0
    for (let b = a + 1; b < layout.base; b++) {
      const dx = ax - (layout.x[b] ?? 0)
      const dy = ay - (layout.y[b] ?? 0)
      const distSq = dx * dx + dy * dy
      if (distSq < minDistSq) minDistSq = distSq
    }
  }
  if (layout.base >= 2 && minDistSq < minAllowedSq - 1e-6) {
    push(mismatches, `${tag} min centre distance sq ${minDistSq} < ${minAllowedSq} (3 * nodeRadius)^2`)
  }

  for (const label of layout.regionLabels) {
    if (label.x < -1e-6 || label.x > layout.width + 1e-6) push(mismatches, `${tag} region label "${label.text}" x outside frame`)
    if (label.y < -1e-6 || label.y > layout.height + 1e-6) push(mismatches, `${tag} region label "${label.text}" y outside frame`)
  }

  const onScreenRadius = r * Math.min(580 / layout.width, 560 / layout.height)
  if (!(onScreenRadius > 0)) push(mismatches, `${tag} on-screen radius ${onScreenRadius} not positive`)
}

function checkPairGraph(tag: string, pg: ReturnType<typeof pairGraphLayout>, mismatches: string[]): void {
  const br = pg.nodeRadius // the pill's bounding-circle radius (halfDiag * scale)
  const P = pg.px.length
  for (let q = 0; q < P; q++) {
    const x = pg.px[q] ?? 0
    const y = pg.py[q] ?? 0
    if (x - br < -1e-6 || x + br > pg.width + 1e-6) push(mismatches, `${tag} pair ${q} x outside frame`)
    if (y - br < -1e-6 || y + br > pg.height + 1e-6) push(mismatches, `${tag} pair ${q} y outside frame`)
  }

  const minAllowed = 2 * br
  const minAllowedSq = minAllowed * minAllowed
  let minDistSq = Infinity
  for (let a = 0; a < P; a++) {
    const ax = pg.px[a] ?? 0
    const ay = pg.py[a] ?? 0
    for (let b = a + 1; b < P; b++) {
      const dx = ax - (pg.px[b] ?? 0)
      const dy = ay - (pg.py[b] ?? 0)
      const distSq = dx * dx + dy * dy
      if (distSq < minDistSq) minDistSq = distSq
    }
  }
  if (P >= 2 && minDistSq < minAllowedSq - 1e-6) {
    push(mismatches, `${tag} min pair centre distance sq ${minDistSq} < ${minAllowedSq} (2 * nodeRadius)^2`)
  }

  for (const label of pg.regionLabels) {
    if (label.x < -1e-6 || label.x > pg.width + 1e-6) push(mismatches, `${tag} region label "${label.text}" x outside frame`)
    if (label.y < -1e-6 || label.y > pg.height + 1e-6) push(mismatches, `${tag} region label "${label.text}" y outside frame`)
  }

  const onScreenRadius = br * Math.min(580 / pg.width, 560 / pg.height)
  if (!(onScreenRadius > 0)) push(mismatches, `${tag} on-screen radius ${onScreenRadius} not positive`)
}

describe('review bases: every node disc inside the frame, minimum spacing, region labels inside the frame, positive on-screen radius', () => {
  it('holds for the review-set bases across ring (both packers), ladder, spiral and the pair graph', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    for (const n of REVIEW_BASES) {
      for (const { id, build } of BUILDERS) {
        checkZoneLayout(`${id} n=${n}`, build(n), mismatches)
      }
      checkPairGraph(`pairGraph n=${n}`, pairGraphLayout(createNumogram(n)), mismatches)
    }
    expect(mismatches.slice(0, 30)).toEqual([])
  })
})
