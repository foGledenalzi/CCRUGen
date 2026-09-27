// Deterministic glyph packers and frame fit (Task 2, D-03/D-06): both packers stay overlap-free and bit-stable on
// fixed and seeded radius lists; fitFrame implements the margin, 800x600 minimum and 4096 cap.
import { describe, expect, it } from 'vitest'
import { applyFit, fitFrame } from '../layout/frame'
import { roundQ } from '../layout/format'
import { packShelf, packSpiral, type PackResult } from '../layout/pack'
import { DEFAULT_LAYOUT_PARAMS } from '../layout/params'

const GAP = 10
const FIXED_RADII = new Float64Array([300, 200, 200, 100, 100, 100, 50, 50, 25])

/** A small deterministic LCG (never Math.random, Pitfall 15): 40 descending radii, all multiples of 1/8. */
function seededRadii(count: number, seed: number): Float64Array {
  let s = seed >>> 0
  const radii: number[] = []
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) >>> 0
    const frac = (s % 8192) / 8192
    radii.push(roundQ(5 + frac * 95))
  }
  radii.sort((a, b) => b - a)
  return new Float64Array(radii)
}

function assertNoOverlap(Rb: Float64Array, result: PackResult, gap: number): void {
  const { x, y } = result
  for (let i = 0; i < Rb.length; i++) {
    for (let j = i + 1; j < Rb.length; j++) {
      const dx = (x[i] ?? 0) - (x[j] ?? 0)
      const dy = (y[i] ?? 0) - (y[j] ?? 0)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const limit = (Rb[i] ?? 0) + (Rb[j] ?? 0) + gap
      expect(dist).toBeGreaterThanOrEqual(limit - 1e-9)
    }
  }
}

function assertQuantized(values: Float64Array, denom: number): void {
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] ?? 0) * denom
    expect(Number.isInteger(v)).toBe(true)
  }
}

describe('packSpiral', () => {
  it('places glyph 0 at the origin and keeps every coordinate a multiple of 1/8', () => {
    const result = packSpiral(FIXED_RADII, GAP)
    expect(result.x[0]).toBe(0)
    expect(result.y[0]).toBe(0)
    assertQuantized(result.x, 8)
    assertQuantized(result.y, 8)
  })

  it('never overlaps for a fixed descending radius list', () => {
    assertNoOverlap(FIXED_RADII, packSpiral(FIXED_RADII, GAP), GAP)
  })

  it('never overlaps for 40 seeded radii', () => {
    const radii = seededRadii(40, 42)
    assertNoOverlap(radii, packSpiral(radii, GAP), GAP)
  })

  it('is deterministic across repeated calls', () => {
    const a = packSpiral(FIXED_RADII, GAP)
    const b = packSpiral(FIXED_RADII, GAP)
    expect(Array.from(a.x)).toEqual(Array.from(b.x))
    expect(Array.from(a.y)).toEqual(Array.from(b.y))
  })

  it('handles empty and single-glyph input', () => {
    const empty = packSpiral(new Float64Array(0), GAP)
    expect(empty.x.length).toBe(0)
    expect(empty.y.length).toBe(0)
    const one = packSpiral(new Float64Array([42]), GAP)
    expect(one.x[0]).toBe(0)
    expect(one.y[0]).toBe(0)
  })

  it('throws RangeError for a non-descending radius list', () => {
    expect(() => packSpiral(new Float64Array([10, 20]), GAP)).toThrow(RangeError)
  })
})

describe('packShelf', () => {
  it('keeps every coordinate a multiple of 1/16', () => {
    const result = packShelf(FIXED_RADII, GAP)
    assertQuantized(result.x, 16)
    assertQuantized(result.y, 16)
  })

  it('never overlaps for a fixed descending radius list', () => {
    assertNoOverlap(FIXED_RADII, packShelf(FIXED_RADII, GAP), GAP)
  })

  it('never overlaps for 40 seeded radii', () => {
    const radii = seededRadii(40, 7)
    assertNoOverlap(radii, packShelf(radii, GAP), GAP)
  })

  it('is deterministic across repeated calls', () => {
    const a = packShelf(FIXED_RADII, GAP)
    const b = packShelf(FIXED_RADII, GAP)
    expect(Array.from(a.x)).toEqual(Array.from(b.x))
    expect(Array.from(a.y)).toEqual(Array.from(b.y))
  })

  it('handles empty and single-glyph input', () => {
    const empty = packShelf(new Float64Array(0), GAP)
    expect(empty.x.length).toBe(0)
    expect(empty.y.length).toBe(0)
    const one = packShelf(new Float64Array([42]), GAP)
    expect(one.x[0]).toBe(0)
    expect(one.y[0]).toBe(0)
  })

  it('throws RangeError for a non-descending radius list', () => {
    expect(() => packShelf(new Float64Array([10, 20]), GAP)).toThrow(RangeError)
  })
})

describe('fitFrame / applyFit', () => {
  it('fits two nodes into the 800x600 minimum frame, centred, at scale 1', () => {
    const x = new Float64Array([-42, 42])
    const y = new Float64Array([0, 0])
    const fit = fitFrame(x, y, 21, DEFAULT_LAYOUT_PARAMS)
    expect(fit.width).toBe(800)
    expect(fit.height).toBe(600)
    expect(fit.scale).toBe(1)
    const { x: fx } = applyFit(fit, x, y)
    expect((fx[0] ?? 0) + (fx[1] ?? 0)).toBeCloseTo(fit.width, 9) // centred: the two x's are symmetric about width / 2
  })

  it('scales content wider than the cap down to fit, and never exceeds the cap', () => {
    const n = 200
    const x = new Float64Array(n)
    const y = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      x[i] = i * 100
      y[i] = 0
    }
    const fit = fitFrame(x, y, 21, DEFAULT_LAYOUT_PARAMS)
    const big = Math.max(fit.naturalWidth, fit.naturalHeight)
    expect(fit.scale).toBeCloseTo(DEFAULT_LAYOUT_PARAMS.cap / big, 9)
    expect(Math.max(fit.width, fit.height)).toBeLessThanOrEqual(DEFAULT_LAYOUT_PARAMS.cap + 1e-9)
  })

  it('applyFit maps every coordinate to v * scale + offset and does not mutate the inputs', () => {
    const x = new Float64Array([-42, 42])
    const y = new Float64Array([0, 10])
    const xBefore = Array.from(x)
    const yBefore = Array.from(y)
    const fit = fitFrame(x, y, 21, DEFAULT_LAYOUT_PARAMS)
    const { x: fx, y: fy } = applyFit(fit, x, y)
    for (let i = 0; i < x.length; i++) {
      expect(fx[i]).toBeCloseTo((x[i] ?? 0) * fit.scale + fit.offsetX, 9)
      expect(fy[i]).toBeCloseTo((y[i] ?? 0) * fit.scale + fit.offsetY, 9)
    }
    expect(Array.from(x)).toEqual(xBefore)
    expect(Array.from(y)).toEqual(yBefore)
    expect(fx).not.toBe(x)
    expect(fy).not.toBe(y)
  })

  it('throws RangeError for empty input', () => {
    expect(() => fitFrame(new Float64Array(0), new Float64Array(0), 21, DEFAULT_LAYOUT_PARAMS)).toThrow(RangeError)
  })
})
