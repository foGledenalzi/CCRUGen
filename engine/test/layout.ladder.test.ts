// LAY-01/LAY-04 (D-04): ladderLayout reduces EXACTLY to the authored base-10 ladder (frame 800 x 870, centre
// (400, 450)) and satisfies the procedural ladder truths (two columns, lo zone left/hi zone right, one row per pair,
// highest pair on top) for every even base 2..400. Reads the frozen numeric oracle read-only, never writes it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { ladderDefaults, ladderLayout } from '../layout/ladder'

const MAX_MISMATCHES = 200

interface Base10Golden {
  layouts: { ladder: Record<string, { x: number; y: number }> }
  center: { ladder: { x: number; y: number } }
}

// Read the frozen file, never write it.
const FIXTURE = fileURLToPath(new URL('./fixtures/base10.golden.json', import.meta.url))
const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Base10Golden

describe('ladderLayout reduces exactly to the authored base-10 ladder', () => {
  it('matches golden.layouts.ladder, frame 800 x 870, centre (400, 450)', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const layout = ladderLayout(g)
    for (let z = 0; z < 10; z++) {
      const expected = golden.layouts.ladder[String(z)]
      expect(expected, `golden zone ${z}`).toBeDefined()
      expect(layout.x[z], `zone ${z} x`).toBe(expected?.x)
      expect(layout.y[z], `zone ${z} y`).toBe(expected?.y)
    }
    expect(layout.width).toBe(800)
    expect(layout.height).toBe(870)
    expect(layout.center).toEqual({ x: golden.center.ladder.x, y: golden.center.ladder.y })
    expect(layout.center).toEqual({ x: 400, y: 450 })
    expect(layout.scale).toBe(1)
    expect(layout.id).toBe('ladder')
    expect(layout.routingStyle).toBe('ladder')
  })
})

/** Checks the procedural-ladder truths for one base, appending short strings to `mismatches`. */
function checkLadder(n: number, mismatches: string[]): void {
  const tag = `n=${n}`
  const push = (msg: string): void => {
    if (mismatches.length < MAX_MISMATCHES) mismatches.push(`${tag} ${msg}`)
  }
  const g = createNumogram(n)
  const layout = ladderLayout(g)
  const { x, y, width, height, scale, nodeRadius } = layout
  const a = ladderDefaults(n)
  const P = n / 2

  for (let z = 0; z < n; z++) {
    const partner = n - 1 - z
    if (Math.abs((y[z] ?? 0) - (y[partner] ?? 0)) > 1e-9) push(`zone ${z} does not share y with partner ${partner}`)
  }

  for (let q = 0; q < P; q++) {
    const hi = n - 1 - q
    const expectedLeft = a.xLeft * scale
    const expectedRight = a.xRight * scale
    if (Math.abs((x[q] ?? 0) - expectedLeft) > 1e-9) push(`pair ${q} lo zone ${q} x ${x[q]} != ${expectedLeft}`)
    if (Math.abs((x[hi] ?? 0) - expectedRight) > 1e-9) push(`pair ${q} hi zone ${hi} x ${x[hi]} != ${expectedRight}`)
  }

  let prevY = Infinity
  for (let q = 0; q < P; q++) {
    const yy = y[q] ?? 0
    if (q > 0 && !(yy < prevY)) push(`row y at pair ${q} = ${yy} not strictly less than pair ${q - 1} = ${prevY}`)
    prevY = yy
  }

  for (let z = 0; z < n; z++) {
    const px = x[z] ?? 0
    const py = y[z] ?? 0
    if (px - nodeRadius < -1e-6 || px + nodeRadius > width + 1e-6) push(`zone ${z} x ${px} outside frame width ${width}`)
    if (py - nodeRadius < -1e-6 || py + nodeRadius > height + 1e-6) push(`zone ${z} y ${py} outside frame height ${height}`)
  }
  if (Math.max(width, height) > 4096 + 1e-9) push(`max(width,height) ${Math.max(width, height)} > 4096`)
}

describe('ladderLayout satisfies every procedural-ladder truth across every even base', () => {
  it('sweep even bases 2..400', () => {
    clearNumogramCache()
    const mismatches: string[] = []
    let covered = 0
    for (let n = 2; n <= 400; n += 2) {
      checkLadder(n, mismatches)
      covered++
    }
    expect(covered).toBe(200)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})

describe('ladderLayout: specific base structures', () => {
  it('base 28 has rowGap 100 and frame 800 x 1470', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const a = ladderDefaults(28)
    expect(a.rowGap).toBe(100)
    const layout = ladderLayout(g)
    expect(layout.width).toBe(800)
    expect(layout.height).toBe(1470)
  })

  it('base 100 shrinks by the cap: scale close to 4096 / 4286', () => {
    clearNumogramCache()
    const g = createNumogram(100)
    const layout = ladderLayout(g)
    expect(layout.scale).toBeCloseTo(4096 / 4286, 12)
  })
})

describe('ladderLayout determinism', () => {
  it('gives byte-identical x and y arrays on a second call', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const first = ladderLayout(g)
    const second = ladderLayout(g)
    expect(first.x).toEqual(second.x)
    expect(first.y).toEqual(second.y)
  })
})
