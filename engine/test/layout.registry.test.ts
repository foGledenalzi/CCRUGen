// Registry (LAY-02, D-05, T-03-19) and tween (D-09) tests: resolveLayout's preset-then-procedural-then-default
// resolution order, layoutIdsFor's id list, and lerpPositions' straight interpolation and RangeErrors. Base-10 preset
// resolution against the real BASE10_LAYOUT_SPECS is proven separately in tests/presets/layout-registry.test.ts
// (03-07 Task 2), which is the only file allowed to import app/.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { ladderLayout } from '../layout/ladder'
import { pairGraphLayout } from '../layout/pairgraph'
import { layoutIdsFor, PROCEDURAL_LAYOUT_SPECS, resolveLayout } from '../layout/registry'
import { ringLayout } from '../layout/ring'
import { spiralLayout } from '../layout/spiral'
import { lerpPositions } from '../layout/tween'

describe('resolveLayout', () => {
  it('with no id and no presets returns the ring default', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(resolveLayout(g28).id).toBe('ring')
  })

  it('with a LAYOUT_IDS id and no presets returns that procedural layout', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(resolveLayout(g28, 'spiral').id).toBe('spiral')
  })

  it('with a preset id that no preset supports (no presets given) falls back to the base default', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(resolveLayout(g28, 'labyrinth').id).toBe('ring')
  })

  it('with an unknown id falls back to the base default (T-03-19: never evaluated, only compared)', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(resolveLayout(g28, 'nonsense').id).toBe('ring')
  })

  it('the ladder id with no presets equals ladderLayout(g) directly', () => {
    clearNumogramCache()
    const g10 = createNumogram(10)
    const resolved = resolveLayout(g10, 'ladder')
    const direct = ladderLayout(g10)
    expect(resolved).toEqual(direct)
  })

  it('PROCEDURAL_LAYOUT_SPECS is ring, ladder, spiral, each supporting every base', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(PROCEDURAL_LAYOUT_SPECS.map(spec => spec.id)).toEqual(['ring', 'ladder', 'spiral'])
    for (const spec of PROCEDURAL_LAYOUT_SPECS) expect(spec.supports(g28)).toBe(true)
  })
})

describe('layoutIdsFor', () => {
  it('with no presets is the three procedural ids in LAYOUT_IDS order', () => {
    clearNumogramCache()
    const g28 = createNumogram(28)
    expect(layoutIdsFor(g28)).toEqual(['ring', 'ladder', 'spiral'])
  })
})

describe('lerpPositions', () => {
  it('t=0 copies from, t=1 copies to, t=0.5 gives midpoints', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const a = ringLayout(g)
    const b = spiralLayout(g)
    const outX = new Float64Array(g.base)
    const outY = new Float64Array(g.base)

    lerpPositions(a, b, 0, outX, outY)
    expect(outX).toEqual(a.x)
    expect(outY).toEqual(a.y)

    lerpPositions(a, b, 1, outX, outY)
    expect(outX).toEqual(b.x)
    expect(outY).toEqual(b.y)

    lerpPositions(a, b, 0.5, outX, outY)
    for (let z = 0; z < g.base; z++) {
      expect(outX[z]).toBeCloseTo(((a.x[z] ?? 0) + (b.x[z] ?? 0)) / 2, 9)
      expect(outY[z]).toBeCloseTo(((a.y[z] ?? 0) + (b.y[z] ?? 0)) / 2, 9)
    }
  })

  it('ring -> pairGraph of one base interpolates as equal-length coordinate arrays', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const ring = ringLayout(g)
    const pg = pairGraphLayout(g)
    expect(pg.x.length).toBe(ring.x.length)
    const outX = new Float64Array(g.base)
    const outY = new Float64Array(g.base)
    expect(() => lerpPositions(ring, pg, 0.5, outX, outY)).not.toThrow()
  })

  it('throws RangeError for different bases', () => {
    clearNumogramCache()
    const a = ringLayout(createNumogram(10))
    const b = ringLayout(createNumogram(28))
    const outX = new Float64Array(10)
    const outY = new Float64Array(10)
    expect(() => lerpPositions(a, b, 0.5, outX, outY)).toThrow(RangeError)
  })

  it('throws RangeError for t outside [0, 1]', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const a = ringLayout(g)
    const b = spiralLayout(g)
    const outX = new Float64Array(10)
    const outY = new Float64Array(10)
    expect(() => lerpPositions(a, b, -0.001, outX, outY)).toThrow(RangeError)
    expect(() => lerpPositions(a, b, 1.001, outX, outY)).toThrow(RangeError)
  })

  it('throws RangeError for a NaN t', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const a = ringLayout(g)
    const b = spiralLayout(g)
    const outX = new Float64Array(10)
    const outY = new Float64Array(10)
    expect(() => lerpPositions(a, b, NaN, outX, outY)).toThrow(RangeError)
  })

  it('throws RangeError for wrong-length output arrays', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const a = ringLayout(g)
    const b = spiralLayout(g)
    expect(() => lerpPositions(a, b, 0.5, new Float64Array(9), new Float64Array(10))).toThrow(RangeError)
    expect(() => lerpPositions(a, b, 0.5, new Float64Array(10), new Float64Array(11))).toThrow(RangeError)
  })
})
