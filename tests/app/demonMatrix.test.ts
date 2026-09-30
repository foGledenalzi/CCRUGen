// Tests for app/lib/demonMatrix.ts (DEM-04, D-06): transform, exact resolve, zoom/pan clamps, cursor stepping,
// diagonal overlays (Task 1), raster sizing/palette/rasterizer (Task 2). cellAtPixel is the ONLY way hover, click and
// keyboard resolve a cell (T-05-05) — proven here to hold exactly, independent of what any raster paints.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  MATRIX_MAX_CELL_PX,
  MATRIX_PAD_PX,
  cellAtPixel,
  cellCenter,
  cellRect,
  clampTransform,
  ensureCellVisible,
  fitScale,
  fitTransform,
  numodemonLine,
  panBy,
  stepCursor,
  syzygyLine,
  zoomAt,
  type CursorKey,
  type MatrixTransform,
} from '../../app/lib/demonMatrix'

describe('fitScale / fitTransform', () => {
  it('fitTransform(28, 800, 600) matches the documented formula (MATRIX_PAD_PX on each side of the shorter dimension)', () => {
    expect(MATRIX_PAD_PX).toBe(8)
    const scale = fitScale(28, 800, 600)
    expect(scale).toBeCloseTo((600 - 16) / 28, 9)
    const t = fitTransform(28, 800, 600)
    expect(t.scale).toBe(scale)
    expect(t.tx).toBeCloseTo((800 - 28 * scale) / 2, 6)
    expect(t.ty).toBeCloseTo((600 - 28 * scale) / 2, 6)
    // the shorter dimension (600) is padded by exactly MATRIX_PAD_PX on each side
    expect(t.ty).toBeCloseTo(MATRIX_PAD_PX, 6)
  })

  it('fitScale is 0-safe for tiny or zero viewports', () => {
    expect(fitScale(28, 16, 16)).toBeGreaterThan(0)
    expect(Number.isFinite(fitScale(28, 0, 0))).toBe(true)
    expect(fitScale(28, 0, 0)).toBeGreaterThan(0)
  })
})

describe('clampTransform', () => {
  it('falls back to fitTransform on any non-finite field (T-05-06)', () => {
    const base = 28
    const w = 800
    const h = 600
    const fit = fitTransform(base, w, h)
    expect(clampTransform({ scale: NaN, tx: 0, ty: 0 }, base, w, h)).toEqual(fit)
    expect(clampTransform({ scale: 10, tx: Infinity, ty: 0 }, base, w, h)).toEqual(fit)
    expect(clampTransform({ scale: 10, tx: 0, ty: -Infinity }, base, w, h)).toEqual(fit)
  })

  it('property: the viewport centre stays inside the matrix square after any panBy(dx, dy)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (halfBase, w, h, dx, dy) => {
          const base = halfBase * 2
          const t0 = fitTransform(base, w, h)
          const t1 = panBy(t0, dx, dy, base, w, h)
          expect(t1.tx).toBeLessThanOrEqual(w / 2)
          expect(t1.tx + base * t1.scale).toBeGreaterThanOrEqual(w / 2)
          expect(t1.ty).toBeLessThanOrEqual(h / 2)
          expect(t1.ty + base * t1.scale).toBeGreaterThanOrEqual(h / 2)
        },
      ),
      { numRuns: 300 },
    )
  })
})

describe('zoomAt', () => {
  it('is a no-op for a non-positive or non-finite factor', () => {
    const t = fitTransform(28, 800, 600)
    expect(zoomAt(t, 0, 400, 300, 28, 800, 600)).toEqual(t)
    expect(zoomAt(t, -1, 400, 300, 28, 800, 600)).toEqual(t)
    expect(zoomAt(t, NaN, 400, 300, 28, 800, 600)).toEqual(t)
  })

  it('property: anchors the cell under the cursor when unclamped; scale stays within [fitScale, max(64, fitScale)]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 0.25, max: 4, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (halfBase, w, h, factor, aFrac, bFrac) => {
          const base = halfBase * 2
          const t0 = fitTransform(base, w, h)
          const a = 1 + Math.floor(aFrac * (base - 1))
          const b = Math.floor(bFrac * a)
          const center = cellCenter(a, b, t0)
          const t1 = zoomAt(t0, factor, center.x, center.y, base, w, h)
          const fs = fitScale(base, w, h)
          const maxScale = Math.max(MATRIX_MAX_CELL_PX, fs)
          expect(t1.scale).toBeGreaterThanOrEqual(fs)
          expect(t1.scale).toBeLessThanOrEqual(maxScale)
          if (t0.scale * factor >= fs && t0.scale * factor <= maxScale) {
            expect(cellAtPixel(center.x, center.y, t1, base)).toEqual([a, b])
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})

describe('cellAtPixel / cellCenter / cellRect', () => {
  const base = 28
  const w = 800
  const h = 600
  const t = fitTransform(base, w, h)

  it('resolves the exact cell at its own centre', () => {
    const c = cellCenter(12, 3, t)
    expect(cellAtPixel(c.x, c.y, t, base)).toEqual([12, 3])
  })

  it('returns null for a pixel with b >= a inside the square (the empty lower triangle)', () => {
    const p = cellCenter(3, 10, t) // a=3 < b=10: not a valid demon cell
    expect(cellAtPixel(p.x, p.y, t, base)).toBeNull()
  })

  it('returns null left of tx or above ty', () => {
    expect(cellAtPixel(t.tx - 1, t.ty + 5, t, base)).toBeNull()
    expect(cellAtPixel(t.tx + 5, t.ty - 1, t, base)).toBeNull()
  })

  it('returns null for NaN or Infinity in any input, including the transform', () => {
    expect(cellAtPixel(NaN, 10, t, base)).toBeNull()
    expect(cellAtPixel(10, Infinity, t, base)).toBeNull()
    expect(cellAtPixel(-Infinity, 10, t, base)).toBeNull()
    expect(cellAtPixel(10, 10, { scale: NaN, tx: 0, ty: 0 }, base)).toBeNull()
  })

  it('cellRect gives the top-left corner and size in CSS px', () => {
    const rt: MatrixTransform = { scale: 10, tx: 5, ty: 7 }
    expect(cellRect(3, 1, rt)).toEqual({ x: 35, y: 17, size: 10 })
  })

  it('property: cellCenter -> cellAtPixel round-trips exactly for every even base up to 2^26, any clamped transform', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 25 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (halfBase, scaleFrac, rawTx, rawTy, aFrac, bFrac) => {
          const testBase = halfBase * 2
          const vw = 800
          const vh = 600
          const fs = fitScale(testBase, vw, vh)
          const maxScale = Math.max(MATRIX_MAX_CELL_PX, fs)
          const scale = fs + scaleFrac * (maxScale - fs)
          const transform = clampTransform({ scale, tx: rawTx, ty: rawTy }, testBase, vw, vh)
          const a = 1 + Math.floor(aFrac * (testBase - 1))
          const b = Math.floor(bFrac * a)
          const center = cellCenter(a, b, transform)
          expect(cellAtPixel(center.x, center.y, transform, testBase)).toEqual([a, b])
        },
      ),
      { numRuns: 300 },
    )
  })

  it('resolves the exact base 2^26 corner cell at max zoom (64 px/cell)', () => {
    const bigBase = 2 ** 26
    const bigT: MatrixTransform = { scale: 64, tx: 137, ty: -58 }
    const a = bigBase - 1 // 67108863
    const b = bigBase - 2 // 67108862
    const center = cellCenter(a, b, bigT)
    expect(cellAtPixel(center.x, center.y, bigT, bigBase)).toEqual([67108863, 67108862])
  })
})

describe('stepCursor', () => {
  it('matches the documented boundary and interior moves at base 28', () => {
    expect(stepCursor([1, 0], 'ArrowLeft', 28)).toEqual([1, 0])
    expect(stepCursor([5, 0], 'ArrowUp', 28)).toEqual([5, 0])
    expect(stepCursor([5, 4], 'ArrowDown', 28)).toEqual([5, 4])
    expect(stepCursor([27, 3], 'ArrowRight', 28)).toEqual([27, 3])
    expect(stepCursor([5, 2], 'ArrowRight', 28)).toEqual([6, 2])
    expect(stepCursor([5, 2], 'ArrowDown', 28)).toEqual([5, 3])
    expect(stepCursor([5, 2], 'ArrowLeft', 28)).toEqual([4, 2])
    expect(stepCursor([5, 2], 'ArrowUp', 28)).toEqual([5, 1])
  })

  it('property: every result keeps 0 <= b < a < base', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.constantFrom<CursorKey>('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'),
        (halfBase, aFrac, bFrac, key) => {
          const base = halfBase * 2
          const a = 1 + Math.floor(aFrac * (base - 1))
          const b = Math.floor(bFrac * a)
          const [a2, b2] = stepCursor([a, b], key, base)
          expect(b2).toBeGreaterThanOrEqual(0)
          expect(b2).toBeLessThan(a2)
          expect(a2).toBeLessThan(base)
        },
      ),
      { numRuns: 300 },
    )
  })
})

describe('ensureCellVisible', () => {
  const base = 28
  const w = 800
  const h = 600

  it('leaves an already-visible transform unchanged', () => {
    const t0 = fitTransform(base, w, h)
    expect(ensureCellVisible(t0, 5, 2, base, w, h)).toEqual(t0)
  })

  it('brings an off-screen cell fully inside [0, w] x [0, h] when zoomed in far enough to push it off-screen', () => {
    const t0 = fitTransform(base, w, h)
    const zoomed = zoomAt(t0, 30, w / 2, h / 2, base, w, h)
    // sanity: zooming in this far actually pushes the top-right corner cell off-screen first
    const before = cellRect(base - 1, 0, zoomed)
    expect(before.x + before.size > w || before.y < 0).toBe(true)

    const fixed = ensureCellVisible(zoomed, base - 1, 0, base, w, h)
    const after = cellRect(base - 1, 0, fixed)
    expect(after.x).toBeGreaterThanOrEqual(0)
    expect(after.x + after.size).toBeLessThanOrEqual(w)
    expect(after.y).toBeGreaterThanOrEqual(0)
    expect(after.y + after.size).toBeLessThanOrEqual(h)
  })
})

describe('syzygyLine / numodemonLine', () => {
  it('matches the documented segments and degenerate cases', () => {
    const t28 = fitTransform(28, 800, 600)
    const syz28 = syzygyLine(t28, 28)
    const syzP1 = cellCenter(14, 13, t28)
    const syzP2 = cellCenter(27, 0, t28)
    expect(syz28).toEqual({ x1: syzP1.x, y1: syzP1.y, x2: syzP2.x, y2: syzP2.y })

    const num28 = numodemonLine(t28, 28)
    const numP1 = cellCenter(15, 13, t28)
    const numP2 = cellCenter(27, 1, t28)
    expect(num28).toEqual({ x1: numP1.x, y1: numP1.y, x2: numP2.x, y2: numP2.y })

    const t2 = fitTransform(2, 800, 600)
    const syz2 = syzygyLine(t2, 2)
    const degeneratePoint = cellCenter(1, 0, t2)
    expect(syz2).toEqual({ x1: degeneratePoint.x, y1: degeneratePoint.y, x2: degeneratePoint.x, y2: degeneratePoint.y })
    expect(numodemonLine(t2, 2)).toBeNull()

    const t4 = fitTransform(4, 800, 600)
    const num4 = numodemonLine(t4, 4)
    const cell31 = cellCenter(3, 1, t4)
    expect(num4).toEqual({ x1: cell31.x, y1: cell31.y, x2: cell31.x, y2: cell31.y })
  })
})
