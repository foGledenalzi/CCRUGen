// Tests for the Canvas paint surface (REN-02 follow-up: the zoomed diagram fills the viewport instead of being clipped to
// the 580 px window). The window stays the LOGICAL frame of every view-transform function; only the pixels the layers are
// painted on grow, to the union of the viewport and the window. surfaceOf is the pure rule, surfaceStore bounds the backing
// store of that surface (five layers, so a tighter limit than the table's per-window one). Expected values are derived
// from the union definition here, never copied from viewTransform.ts.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  CANVAS_SURFACE_AREA_LIMIT_PX,
  DPR_MAX,
  backingStore,
  surfaceOf,
  surfaceStore,
} from '../../app/lib/canvas/viewTransform'
import { CANVAS_AREA_LIMIT_PX } from '../../app/lib/tierBounds'

const windowOnly = (cssWidth: number, cssHeight: number) => ({ originX: 0, originY: 0, width: cssWidth, height: cssHeight })

describe('surfaceOf: the viewport united with the window', () => {
  it('a desktop window inside the viewport: the surface is the viewport, the window sits at its own page position', () => {
    // 1600 x 900, window 580 x 648 at (510, 150): the measured defect
    expect(surfaceOf(510, 150, 580, 648, 1600, 900)).toEqual({ originX: 510, originY: 150, width: 1600, height: 900 })
  })

  it('a phone: the window at (8, 8) in a 375 x 667 viewport', () => {
    expect(surfaceOf(8, 8, 359, 359, 375, 667)).toEqual({ originX: 8, originY: 8, width: 375, height: 667 })
  })

  it('a window as large as the viewport at the origin is its own surface', () => {
    expect(surfaceOf(0, 0, 800, 600, 800, 600)).toEqual({ originX: 0, originY: 0, width: 800, height: 600 })
  })

  it('a window larger than the viewport grows the surface to the window on that axis only', () => {
    // 580 wide in a 375 viewport (taller than the window needs: the viewport wins vertically)
    expect(surfaceOf(0, 0, 580, 300, 375, 667)).toEqual({ originX: 0, originY: 0, width: 580, height: 667 })
    expect(surfaceOf(0, 0, 200, 900, 375, 667)).toEqual({ originX: 0, originY: 0, width: 375, height: 900 })
  })

  it('a window hanging off the left and top edges: the surface starts at the floor of its position', () => {
    // left -20.5 -> x0 = -21, top -3.25 -> y0 = -4: the window top-left sits 0.5 / 0.75 inside the surface
    const s = surfaceOf(-20.5, -3.25, 580, 300, 1280, 800)
    expect(s.originX).toBe(0.5)
    expect(s.originY).toBe(0.75)
    expect(s.width).toBe(1280 + 21)
    expect(s.height).toBe(800 + 4)
  })

  it('a window past the right and bottom edges: the surface ends at the ceiling of its far edge', () => {
    // right edge 1000.5 + 400 = 1400.5 -> 1401; bottom 700.25 + 300 = 1000.25 -> 1001
    const s = surfaceOf(1000.5, 700.25, 400, 300, 1280, 800)
    expect(s).toEqual({ originX: 1000.5, originY: 700.25, width: 1401, height: 1001 })
  })

  it('a fractional window position keeps its fraction as the origin (the surface itself is integral)', () => {
    // the window of a 1281 px page: (1281 - 580) / 2 = 350.5
    const s = surfaceOf(350.5, 150.5, 580, 648, 1281, 900)
    expect(s.originX).toBe(350.5)
    expect(s.originY).toBe(150.5)
    expect(s.width).toBe(1281)
    expect(s.height).toBe(900)
    expect(Number.isInteger(s.width) && Number.isInteger(s.height)).toBe(true)
  })

  it('non-finite input yields the window itself, whatever the other arguments are', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(surfaceOf(bad, 150, 580, 648, 1600, 900)).toEqual(windowOnly(580, 648))
      expect(surfaceOf(510, bad, 580, 648, 1600, 900)).toEqual(windowOnly(580, 648))
      expect(surfaceOf(510, 150, 580, 648, bad, 900)).toEqual(windowOnly(580, 648))
      expect(surfaceOf(510, 150, 580, 648, 1600, bad)).toEqual(windowOnly(580, 648))
    }
  })

  it('a window size that is not a positive number gives a 0 size rather than NaN', () => {
    for (const bad of [Number.NaN, Infinity, -4, 0]) {
      const s = surfaceOf(510, 150, bad, 648, 1600, 900)
      expect(Number.isFinite(s.width) && Number.isFinite(s.height)).toBe(true)
      expect(s.originX + s.originY).toBeGreaterThanOrEqual(0)
    }
    expect(surfaceOf(Number.NaN, 0, Number.NaN, Number.NaN, 1600, 900)).toEqual(windowOnly(0, 0))
  })

  it('a negative viewport counts as 0: the surface then reaches from the page origin to the far edge of the window', () => {
    expect(surfaceOf(8, 8, 359, 300, -1, -1)).toEqual({ originX: 8, originY: 8, width: 367, height: 308 })
  })

  it('property: the surface contains the viewport and the window, starts on an integer and has integral sides', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -3000, max: 6000, noNaN: true }),
        fc.double({ min: -3000, max: 6000, noNaN: true }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 0, max: 8000 }),
        fc.integer({ min: 0, max: 8000 }),
        (left, top, cssW, cssH, vw, vh) => {
          const s = surfaceOf(left, top, cssW, cssH, vw, vh)
          const x0 = left - s.originX // the surface's page position
          const y0 = top - s.originY
          expect(Number.isInteger(s.width)).toBe(true)
          expect(Number.isInteger(s.height)).toBe(true)
          expect(Math.abs(x0 - Math.round(x0))).toBeLessThan(1e-9)
          expect(Math.abs(y0 - Math.round(y0))).toBeLessThan(1e-9)
          // the window top-left is inside the surface
          expect(s.originX).toBeGreaterThanOrEqual(0)
          expect(s.originY).toBeGreaterThanOrEqual(0)
          // the surface contains the viewport [0, vw] x [0, vh] and the window
          expect(x0).toBeLessThanOrEqual(Math.min(0, left) + 1e-9)
          expect(y0).toBeLessThanOrEqual(Math.min(0, top) + 1e-9)
          expect(x0 + s.width).toBeGreaterThanOrEqual(Math.max(vw, left + cssW) - 1e-9)
          expect(y0 + s.height).toBeGreaterThanOrEqual(Math.max(vh, top + cssH) - 1e-9)
          // and is tight: less than one pixel of slack beyond the union on every side
          expect(Math.min(0, left) - x0).toBeLessThan(1)
          expect(Math.min(0, top) - y0).toBeLessThan(1)
          expect(x0 + s.width - Math.max(vw, left + cssW)).toBeLessThan(1)
          expect(y0 + s.height - Math.max(vh, top + cssH)).toBeLessThan(1)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('property: a non-finite argument anywhere is the window and never NaN', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Number.NaN, Infinity, -Infinity),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 1, max: 2000 }),
        (bad, slot, cssW, cssH) => {
          const args = [100, 100, 1280, 800]
          args[slot] = bad
          expect(surfaceOf(args[0] as number, args[1] as number, cssW, cssH, args[2] as number, args[3] as number)).toEqual(windowOnly(cssW, cssH))
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('surfaceStore: the backing store of the paint surface', () => {
  it('the limit is 2^23 pixels per layer: five layers of 32 MiB at the worst', () => {
    expect(CANVAS_SURFACE_AREA_LIMIT_PX).toBe(2 ** 23)
    expect(CANVAS_SURFACE_AREA_LIMIT_PX).toBe(8_388_608)
    // tighter than the table's per-window limit, so it is the one that applies to a surface
    expect(CANVAS_SURFACE_AREA_LIMIT_PX).toBeLessThan(CANVAS_AREA_LIMIT_PX)
  })

  it('Full HD at a device pixel ratio of 2 keeps its ratio (8.29 M px is under the limit)', () => {
    const s = surfaceStore({ originX: 0, originY: 0, width: 1920, height: 1080 }, 2)
    expect(s).toEqual({ dpr: 2, pixelWidth: 3840, pixelHeight: 2160 })
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(CANVAS_SURFACE_AREA_LIMIT_PX)
  })

  it('4K at a device pixel ratio of 2 is reduced to about 1 so the area stays under the limit', () => {
    const s = surfaceStore({ originX: 0, originY: 0, width: 3840, height: 2160 }, 2)
    expect(s.dpr).toBeLessThan(2)
    expect(s.dpr).toBeGreaterThan(1)
    expect(s.dpr).toBeCloseTo(Math.sqrt(CANVAS_SURFACE_AREA_LIMIT_PX / (3840 * 2160)), 12)
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(CANVAS_SURFACE_AREA_LIMIT_PX)
  })

  it('Full HD at a device pixel ratio of 3 is reduced (the ratio cap alone would allow 18.7 M px)', () => {
    const s = surfaceStore({ originX: 0, originY: 0, width: 1920, height: 1080 }, 3)
    expect(s.dpr).toBeLessThan(3)
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(CANVAS_SURFACE_AREA_LIMIT_PX)
    expect(backingStore(1920, 1080, 3).dpr).toBe(DPR_MAX) // the table's limit alone would not have reduced it
  })

  it('a laptop viewport at a device pixel ratio of 2 or 1.25 keeps its ratio', () => {
    expect(surfaceStore({ originX: 0, originY: 0, width: 1280, height: 800 }, 2).dpr).toBe(2)
    expect(surfaceStore({ originX: 0, originY: 0, width: 1600, height: 900 }, 1.25).dpr).toBe(1.25)
  })

  it('the store follows the surface size, not the window: it is the surface x ratio', () => {
    const s = surfaceStore({ originX: 510, originY: 150, width: 1600, height: 900 }, 1)
    expect(s).toEqual({ dpr: 1, pixelWidth: 1600, pixelHeight: 900 })
  })

  it('a zero or invalid surface gives the 0 x 0 store the window rule gives', () => {
    expect(surfaceStore({ originX: 0, originY: 0, width: 0, height: 0 }, 2)).toEqual(backingStore(0, 0, 2))
    expect(surfaceStore({ originX: 0, originY: 0, width: Number.NaN, height: 10 }, 2)).toEqual({ dpr: 1, pixelWidth: 0, pixelHeight: 0 })
  })

  it('property: the area never exceeds the limit and a surface under it keeps its (capped) ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.double({ min: -2, max: 6, noNaN: true }),
        (w, h, ratio) => {
          const s = surfaceStore({ originX: 0, originY: 0, width: w, height: h }, ratio)
          expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(CANVAS_SURFACE_AREA_LIMIT_PX)
          const wanted = Math.min(DPR_MAX, ratio > 0 ? ratio : 1)
          if (w * h * wanted * wanted <= CANVAS_SURFACE_AREA_LIMIT_PX) expect(s.dpr).toBe(wanted)
        },
      ),
      { numRuns: 300 },
    )
  })
})
