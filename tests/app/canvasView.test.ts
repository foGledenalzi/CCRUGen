// Tests for app/lib/canvas/viewTransform.ts (REN-02, 06-05 Task 1): the Canvas view transform. Fit is
// min(W / width, H / height) and zoom is relative to fit (research P8), so a tall ladder (19 x 4096 at n = 4000)
// letterboxes inside the window instead of overflowing it; the zoom ceiling is computed from the label threshold in the
// tier table (never a literal), so labels are reachable at every Canvas base; the backing store is bounded by the
// table's area limit (T-06-02). Properties use the demonMatrix idiom: a tiny epsilon absorbs 1-ULP misses at a boundary.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
} from '../../engine/index'
import type { CanvasScene } from '../../engine/index'
import {
  DPR_MAX,
  FOCUS_MARGIN_PX,
  HEIGHT_RESERVE_PX,
  IDENTITY_TRANSFORM,
  NARROW_INSET_PX,
  PAN_KEEP_PX,
  ZOOM_FLOOR_MAX,
  ZOOM_MAX_CEILING,
  ZOOM_MIN,
  ZOOM_STEP,
  backingStore,
  canvasFootprint,
  clampTransform,
  ensureVisible,
  fitScale,
  fitZones,
  onScreenRadius,
  panBy,
  scaleOf,
  toScreen,
  toWorld,
  zoomAt,
  zoomMax,
  type CanvasFrame,
  type CanvasTransform,
} from '../../app/lib/canvas/viewTransform'
import { DIAGRAM_CSS_WIDTH } from '../../app/lib/viewLayouts'
import { CANVAS_AREA_LIMIT_PX, LABEL_MIN_RADIUS_PX } from '../../app/lib/tierBounds'

const EPS = 1e-9

/** Frame whose fitted node radius in a w x h window is exactly `fittedRadiusPx` (a square frame, so fit = min(w, h) / size). */
function frameWithFittedRadius(fittedRadiusPx: number, w: number, h: number): CanvasFrame {
  const size = 1000
  const fit = Math.min(w, h) / size
  return { width: size, height: size, nodeRadius: fittedRadiusPx / fit }
}

// ── Real scenes (built once): the ring, ladder and spiral at the Canvas bases and the pair graph ──────────────────────

const zoneFrames = new Map<string, CanvasFrame>()
function zoneFrame(base: number, id: 'ring' | 'ladder' | 'spiral'): CanvasFrame {
  const key = `${base}:${id}`
  let f = zoneFrames.get(key)
  if (f === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, id, [], { packer: 'shelf' })
    const scene = buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
    f = { width: scene.width, height: scene.height, nodeRadius: scene.nodeRadius }
    zoneFrames.set(key, f)
  }
  return f
}

const ringScenes = new Map<number, CanvasScene>()
function ringScene(base: number): CanvasScene {
  let s = ringScenes.get(base)
  if (s === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    s = buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
    ringScenes.set(base, s)
  }
  return s
}

const pairFrames = new Map<number, CanvasFrame>()
/** The pair graph's frame as 06-10's frameOf builds it: the node radius for level of detail is the pill's half-height. */
function pairFrame(base: number): CanvasFrame {
  let f = pairFrames.get(base)
  if (f === undefined) {
    const g = createNumogram(base)
    const layout = pairGraphLayout(g, { packer: 'shelf' })
    const scene = buildPairScene(g, layout, routePairGraph(g, layout))
    f = { width: scene.width, height: scene.height, nodeRadius: scene.pillHeight / 2 }
    pairFrames.set(base, f)
  }
  return f
}

// ── Constants ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('match the UI-SPEC and the plan', () => {
    expect(ZOOM_MIN).toBe(0.3)
    expect(ZOOM_MAX_CEILING).toBe(100)
    expect(ZOOM_FLOOR_MAX).toBe(5)
    expect(ZOOM_STEP).toBe(1.25)
    expect(PAN_KEEP_PX).toBe(24)
    expect(FOCUS_MARGIN_PX).toBe(24)
    expect(DPR_MAX).toBe(3)
    expect(NARROW_INSET_PX).toBe(16)
    expect(HEIGHT_RESERVE_PX).toBe(96)
    expect(IDENTITY_TRANSFORM).toEqual({ zoom: 1, tx: 0, ty: 0 })
  })
})

// ── fit ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('fitScale', () => {
  it('is height-bound for the tall ladder (19 x 4096 at n = 4000) and width-bound for a wide frame', () => {
    expect(fitScale({ width: 19, height: 4096, nodeRadius: 0.5 }, 580, 700)).toBe(700 / 4096)
    expect(fitScale({ width: 4000, height: 100, nodeRadius: 1 }, 580, 700)).toBe(580 / 4000)
  })

  it('letterboxes a square 1000 x 1000 frame in a 580 x 580 window at 0.58', () => {
    expect(fitScale({ width: 1000, height: 1000, nodeRadius: 1 }, 580, 580)).toBe(0.58)
  })

  it('is 0-safe: a zero frame, a zero or non-finite window never gives 0, a negative or a non-finite scale', () => {
    const bad: CanvasFrame[] = [
      { width: 0, height: 0, nodeRadius: 1 },
      { width: NaN, height: 100, nodeRadius: 1 },
      { width: 100, height: Infinity, nodeRadius: 1 },
    ]
    for (const f of bad) {
      const s = fitScale(f, 580, 580)
      expect(Number.isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
    for (const [w, h] of [[0, 0], [NaN, 580], [580, -3], [Infinity, Infinity]] as const) {
      const s = fitScale({ width: 100, height: 100, nodeRadius: 1 }, w, h)
      expect(Number.isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
  })

  it('scaleOf is fit times zoom and onScreenRadius is the node radius times that', () => {
    const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
    const t: CanvasTransform = { zoom: 4, tx: 3, ty: -5 }
    expect(scaleOf(t, frame, 580, 580)).toBeCloseTo(0.58 * 4, 12)
    expect(onScreenRadius(t, frame, 580, 580)).toBeCloseTo(10 * 0.58 * 4, 12)
  })
})

// ── mapping ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('toScreen / toWorld', () => {
  it('maps the frame centre to the window centre at the identity transform', () => {
    const frame: CanvasFrame = { width: 2451.5, height: 2576.25, nodeRadius: 21 }
    const p = toScreen(IDENTITY_TRANSFORM, frame, 580, 609, frame.width / 2, frame.height / 2)
    expect(p.x).toBe(290)
    expect(p.y).toBe(304.5)
  })

  it('applies pan in CSS px and zoom about the frame centre', () => {
    const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
    const t: CanvasTransform = { zoom: 2, tx: 10, ty: -20 }
    // s = 0.5 * 2 = 1: the frame centre lands on the window centre plus the pan; a point 100 world units right of centre is 100 px right
    expect(toScreen(t, frame, 500, 500, 500, 500)).toEqual({ x: 260, y: 230 })
    expect(toScreen(t, frame, 500, 500, 600, 500)).toEqual({ x: 360, y: 230 })
  })

  it('property: toWorld inverts toScreen within 1e-9 (relative to the magnitudes involved)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 5000, noNaN: true }),
        fc.double({ min: 10, max: 5000, noNaN: true }),
        fc.double({ min: 50, max: 2000, noNaN: true }),
        fc.double({ min: 50, max: 2000, noNaN: true }),
        fc.double({ min: ZOOM_MIN, max: ZOOM_MAX_CEILING, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        fc.double({ min: -1000, max: 6000, noNaN: true }),
        fc.double({ min: -1000, max: 6000, noNaN: true }),
        (fw, fh, w, h, zoom, tx, ty, wx, wy) => {
          const frame: CanvasFrame = { width: fw, height: fh, nodeRadius: 1 }
          const t: CanvasTransform = { zoom, tx, ty }
          const p = toScreen(t, frame, w, h, wx, wy)
          const q = toWorld(t, frame, w, h, p.x, p.y)
          expect(Math.abs(q.x - wx)).toBeLessThanOrEqual(EPS * Math.max(1, Math.abs(wx)))
          expect(Math.abs(q.y - wy)).toBeLessThanOrEqual(EPS * Math.max(1, Math.abs(wy)))
        },
      ),
      { numRuns: 400 },
    )
  })
})

// ── zoom range and label reachability ─────────────────────────────────────────────────────────────────────────────────

describe('zoomMax', () => {
  it('for a fitted radius of 0.63 px it is min(100, max(5, 2 * threshold / 0.63)), the threshold read from the table', () => {
    const frame = frameWithFittedRadius(0.63, 580, 580)
    const expected = Math.min(100, Math.max(5, (2 * LABEL_MIN_RADIUS_PX) / 0.63))
    expect(zoomMax(frame, 580, 580)).toBeCloseTo(expected, 6)
    expect(zoomMax(frame, 580, 580)).toBeLessThanOrEqual(ZOOM_MAX_CEILING)
  })

  it('for a fitted radius of 20 px it stays at the SVG tier floor of 5', () => {
    expect(zoomMax(frameWithFittedRadius(20, 580, 580), 580, 580)).toBe(5)
  })

  it('never exceeds the ceiling of 100, even for a sub-pixel or a zero or non-finite node radius', () => {
    for (const r of [0.0001, 0, -1, NaN]) {
      const z = zoomMax({ width: 1000, height: 1000, nodeRadius: r }, 580, 580)
      expect(z).toBe(ZOOM_MAX_CEILING)
    }
  })

  it('is never below the floor of 5, even for an infinite node radius', () => {
    expect(zoomMax({ width: 1000, height: 1000, nodeRadius: Infinity }, 580, 580)).toBe(ZOOM_FLOOR_MAX)
  })

  it('property: at zoomMax the on-screen radius reaches twice the label threshold whenever the cap of 100 does not bind', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.15, max: 60, noNaN: true }),
        fc.double({ min: 100, max: 1500, noNaN: true }),
        fc.double({ min: 100, max: 1500, noNaN: true }),
        (fittedRadius, w, h) => {
          const frame = frameWithFittedRadius(fittedRadius, w, h)
          const z = zoomMax(frame, w, h)
          expect(z).toBeGreaterThanOrEqual(ZOOM_FLOOR_MAX)
          expect(z).toBeLessThanOrEqual(ZOOM_MAX_CEILING)
          const px = onScreenRadius({ zoom: z, tx: 0, ty: 0 }, frame, w, h)
          expect(px).toBeGreaterThanOrEqual(2 * LABEL_MIN_RADIUS_PX - EPS * 100)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('when the cap binds the radius at zoomMax still comes from the cap (no more than 100 x the fitted radius)', () => {
    const frame = frameWithFittedRadius(0.05, 580, 580)
    expect(zoomMax(frame, 580, 580)).toBe(ZOOM_MAX_CEILING)
    expect(onScreenRadius({ zoom: ZOOM_MAX_CEILING, tx: 0, ty: 0 }, frame, 580, 580)).toBeCloseTo(5, 9)
  })

  it('labels are reachable by zoom for the pair graph at 202, 1024 and 4000 in the 580 x 704 footprint', () => {
    for (const base of [202, 1024, 4000]) {
      const frame = pairFrame(base)
      const fp = canvasFootprint(frame, 1280, 800)
      expect(fp.cssWidth).toBe(DIAGRAM_CSS_WIDTH)
      expect(fp.cssHeight).toBeLessThanOrEqual(800 - HEIGHT_RESERVE_PX)
      const z = zoomMax(frame, fp.cssWidth, fp.cssHeight)
      const px = onScreenRadius({ zoom: z, tx: 0, ty: 0 }, frame, fp.cssWidth, fp.cssHeight)
      expect(px, `pair graph n = ${base}`).toBeGreaterThanOrEqual(LABEL_MIN_RADIUS_PX - EPS)
    }
  })

  it('labels are reachable by zoom for the ring, ladder and spiral at 202, 666, 1024 and 4000', () => {
    const fitted: string[] = []
    for (const id of ['ring', 'ladder', 'spiral'] as const) {
      for (const base of [202, 666, 1024, 4000]) {
        const frame = zoneFrame(base, id)
        const fp = canvasFootprint(frame, 1280, 800)
        const z = zoomMax(frame, fp.cssWidth, fp.cssHeight)
        const px = onScreenRadius({ zoom: z, tx: 0, ty: 0 }, frame, fp.cssWidth, fp.cssHeight)
        if (!(px >= LABEL_MIN_RADIUS_PX - EPS)) fitted.push(`${id} n = ${base}: ${px}`)
      }
    }
    expect(fitted).toEqual([])
  })

  it('at the ring of n = 4000 the fitted radius is below the label threshold, so labels need a zoom', () => {
    const frame = zoneFrame(4000, 'ring')
    const fp = canvasFootprint(frame, 1280, 800)
    expect(onScreenRadius(IDENTITY_TRANSFORM, frame, fp.cssWidth, fp.cssHeight)).toBeLessThan(LABEL_MIN_RADIUS_PX)
  })
})

// ── zoomAt ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('zoomAt', () => {
  const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }

  it('is a no-op (the same transform) for a non-positive or non-finite factor', () => {
    const t: CanvasTransform = { zoom: 2, tx: 5, ty: 6 }
    for (const f of [0, -1, NaN, Infinity, -Infinity]) expect(zoomAt(t, f, 250, 250, frame, 500, 500)).toBe(t)
  })

  it('property: zooming in about a cursor over the frame keeps the world point under the cursor fixed (within 1e-6)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 1, max: 20, noNaN: true }),
        (w, h, u, v, factor) => {
          const f: CanvasFrame = { width: 1000, height: 600, nodeRadius: 5 }
          // a cursor inside both the window and the frame's letterboxed extent at the identity transform
          const s = fitScale(f, w, h)
          const left = Math.max(0, w / 2 - (f.width * s) / 2)
          const right = Math.min(w, w / 2 + (f.width * s) / 2)
          const top = Math.max(0, h / 2 - (f.height * s) / 2)
          const bottom = Math.min(h, h / 2 + (f.height * s) / 2)
          const sx = left + u * (right - left)
          const sy = top + v * (bottom - top)
          const before = toWorld(IDENTITY_TRANSFORM, f, w, h, sx, sy)
          const t2 = zoomAt(IDENTITY_TRANSFORM, factor, sx, sy, f, w, h)
          fc.pre(t2.zoom < zoomMax(f, w, h) - 1e-9) // a clamp at the ceiling moves the anchor by design
          const after = toWorld(t2, f, w, h, sx, sy)
          expect(Math.abs(after.x - before.x)).toBeLessThan(1e-6)
          expect(Math.abs(after.y - before.y)).toBeLessThan(1e-6)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('zooming out about the window centre keeps the centre fixed', () => {
    const t = zoomAt(IDENTITY_TRANSFORM, 0.5, 250, 250, frame, 500, 500)
    expect(t.zoom).toBe(0.5)
    expect(t.tx).toBeCloseTo(0, 9)
    expect(t.ty).toBeCloseTo(0, 9)
  })

  it('property: the zoom always lands inside [ZOOM_MIN, zoomMax], for any positive finite factor', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        (factor, sx, sy) => {
          const zm = zoomMax(frame, 500, 500)
          const t = zoomAt({ zoom: 1, tx: 0, ty: 0 }, factor, sx, sy, frame, 500, 500)
          expect(t.zoom).toBeGreaterThanOrEqual(ZOOM_MIN - EPS)
          expect(t.zoom).toBeLessThanOrEqual(zm + EPS)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('reaches exactly ZOOM_MIN and zoomMax at the extremes', () => {
    const lo = zoomAt(IDENTITY_TRANSFORM, 1e-9, 250, 250, frame, 500, 500)
    expect(lo.zoom).toBe(ZOOM_MIN)
    const hi = zoomAt(IDENTITY_TRANSFORM, 1e9, 250, 250, frame, 500, 500)
    expect(hi.zoom).toBe(zoomMax(frame, 500, 500))
  })
})

// ── clamp and pan ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('clampTransform', () => {
  const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }

  it('falls back to the identity transform on any non-finite field', () => {
    expect(clampTransform({ zoom: NaN, tx: 0, ty: 0 }, frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
    expect(clampTransform({ zoom: 2, tx: Infinity, ty: 0 }, frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
    expect(clampTransform({ zoom: 2, tx: 0, ty: -Infinity }, frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
  })

  it('clamps the zoom into [ZOOM_MIN, zoomMax], including a zero or negative zoom', () => {
    const zm = zoomMax(frame, 500, 500)
    expect(clampTransform({ zoom: 0, tx: 0, ty: 0 }, frame, 500, 500).zoom).toBe(ZOOM_MIN)
    expect(clampTransform({ zoom: -4, tx: 0, ty: 0 }, frame, 500, 500).zoom).toBe(ZOOM_MIN)
    expect(clampTransform({ zoom: 1e9, tx: 0, ty: 0 }, frame, 500, 500).zoom).toBe(zm)
  })

  it('leaves a transform inside the limits unchanged', () => {
    const t: CanvasTransform = { zoom: 2, tx: 40, ty: -30 }
    expect(clampTransform(t, frame, 500, 500)).toEqual(t)
  })

  it('property: after any panBy at least PAN_KEEP_PX of the frame stays inside the window on each axis', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 5000, noNaN: true }),
        fc.double({ min: 10, max: 5000, noNaN: true }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        fc.double({ min: ZOOM_MIN, max: 5, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (fw, fh, w, h, zoom, dx, dy) => {
          const f: CanvasFrame = { width: fw, height: fh, nodeRadius: 1 }
          const t = panBy({ zoom, tx: 0, ty: 0 }, dx, dy, f, w, h)
          const s = scaleOf(t, f, w, h)
          const left = w / 2 + t.tx - (fw * s) / 2
          const right = w / 2 + t.tx + (fw * s) / 2
          const top = h / 2 + t.ty - (fh * s) / 2
          const bottom = h / 2 + t.ty + (fh * s) / 2
          // the frame reaches at least PAN_KEEP_PX into the window from each side (w and h are at least 100 here)
          expect(right).toBeGreaterThanOrEqual(PAN_KEEP_PX - 1e-6)
          expect(left).toBeLessThanOrEqual(w - PAN_KEEP_PX + 1e-6)
          expect(bottom).toBeGreaterThanOrEqual(PAN_KEEP_PX - 1e-6)
          expect(top).toBeLessThanOrEqual(h - PAN_KEEP_PX + 1e-6)
        },
      ),
      { numRuns: 400 },
    )
  })

  it('centres a frame in a window too small to keep 24 px of it on either side', () => {
    // a 30 x 30 window at the minimum zoom shows the 10 x 10 frame 9 px wide: (9 / 2) + (30 / 2) - 24 is below 0, so no pan is allowed
    const tiny: CanvasFrame = { width: 10, height: 10, nodeRadius: 1 }
    const t = panBy({ zoom: ZOOM_MIN, tx: 0, ty: 0 }, 500, -500, tiny, 30, 30)
    expect(t.zoom).toBe(ZOOM_MIN)
    expect(t.tx).toBe(0)
    expect(t.ty).toBe(0)
    // the same window at zoom 1 shows the frame 30 px wide, so it may pan until 24 px of the window edge is still covered
    expect(panBy(IDENTITY_TRANSFORM, 500, -500, tiny, 30, 30)).toEqual({ zoom: 1, tx: 6, ty: -6 })
  })

  it('a pan by a non-finite delta leaves the view where it was instead of resetting it', () => {
    const t: CanvasTransform = { zoom: 2, tx: 40, ty: -30 }
    expect(panBy(t, NaN, 5, frame, 500, 500)).toEqual(t)
    expect(panBy(t, 5, Infinity, frame, 500, 500)).toEqual(t)
  })

  it('a pan moves the view by exactly the delta while it stays inside the limits', () => {
    const t = panBy({ zoom: 2, tx: 10, ty: 10 }, 15, -25, frame, 500, 500)
    expect(t).toEqual({ zoom: 2, tx: 25, ty: -15 })
  })
})

// ── fit to a zone subset ──────────────────────────────────────────────────────────────────────────────────────────────

describe('fitZones', () => {
  it('frames the bounding box of two zones plus two node radii (hand-computed)', () => {
    const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
    const x = Float64Array.of(100, 300)
    const y = Float64Array.of(200, 200)
    // box = [80, 320] x [180, 220] -> 240 x 40; s = min(500 / 240, 500 / 40); fit = 0.5
    const t = fitZones(x, y, [0, 1], frame, 500, 500)
    const s = 500 / 240
    expect(scaleOf(t, frame, 500, 500)).toBeCloseTo(s, 9)
    const c = toScreen(t, frame, 500, 500, 200, 200)
    expect(c.x).toBeCloseTo(250, 6)
    expect(c.y).toBeCloseTo(250, 6)
  })

  it('a single zone is centred and zoomed to the ceiling', () => {
    const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
    const t = fitZones(Float64Array.of(900), Float64Array.of(100), [0], frame, 500, 500)
    expect(t.zoom).toBe(zoomMax(frame, 500, 500))
    const c = toScreen(t, frame, 500, 500, 900, 100)
    expect(c.x).toBeCloseTo(250, 6)
    expect(c.y).toBeCloseTo(250, 6)
  })

  it('no zones, or zones with non-finite or out-of-range ids, give the fit-everything transform', () => {
    const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
    expect(fitZones(Float64Array.of(1), Float64Array.of(1), [], frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
    expect(fitZones(Float64Array.of(NaN), Float64Array.of(1), [0], frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
    expect(fitZones(Float64Array.of(1), Float64Array.of(1), [5, -1, 1.5], frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
  })

  it('property: every chosen zone of the ring at 202 ends up inside the window with its disc', () => {
    const scene = ringScene(202)
    const frame: CanvasFrame = { width: scene.width, height: scene.height, nodeRadius: scene.nodeRadius }
    const fp = canvasFootprint(frame, 1280, 800)
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 201 }), { minLength: 1, maxLength: 40 }), zones => {
        const t = fitZones(scene.x, scene.y, zones, frame, fp.cssWidth, fp.cssHeight)
        const r = onScreenRadius(t, frame, fp.cssWidth, fp.cssHeight)
        for (const z of zones) {
          const p = toScreen(t, frame, fp.cssWidth, fp.cssHeight, scene.x[z] ?? NaN, scene.y[z] ?? NaN)
          expect(p.x - r).toBeGreaterThanOrEqual(-1e-6)
          expect(p.y - r).toBeGreaterThanOrEqual(-1e-6)
          expect(p.x + r).toBeLessThanOrEqual(fp.cssWidth + 1e-6)
          expect(p.y + r).toBeLessThanOrEqual(fp.cssHeight + 1e-6)
        }
      }),
      { numRuns: 120 },
    )
  })
})

// ── ensureVisible ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('ensureVisible', () => {
  const frame: CanvasFrame = { width: 1000, height: 1000, nodeRadius: 10 }
  const t4: CanvasTransform = { zoom: 4, tx: 0, ty: 0 } // s = 0.5 * 4 = 2, window 500 x 500

  it('leaves a point already 30 px inside the window unchanged', () => {
    // screen x = 250 + (wx - 500) * 2 = 30 at wx = 390
    expect(toScreen(t4, frame, 500, 500, 390, 500).x).toBe(30)
    expect(ensureVisible(t4, 390, 500, 0, frame, 500, 500)).toEqual(t4)
  })

  it('pans a point outside the window to exactly FOCUS_MARGIN_PX + radius inside (right and left)', () => {
    const radius = 6
    const right = ensureVisible(t4, 800, 500, radius, frame, 500, 500)
    expect(toScreen(right, frame, 500, 500, 800, 500).x).toBeCloseTo(500 - (FOCUS_MARGIN_PX + radius), 9)
    expect(toScreen(right, frame, 500, 500, 800, 500).y).toBeCloseTo(250, 9)
    const left = ensureVisible(t4, 200, 500, radius, frame, 500, 500)
    expect(toScreen(left, frame, 500, 500, 200, 500).x).toBeCloseTo(FOCUS_MARGIN_PX + radius, 9)
  })

  it('pans a point within the margin of an edge (top and bottom)', () => {
    // screen y = 250 + (wy - 500) * 2: wy = 389 -> 28 (inside the 24 + 6 margin), wy = 610 -> 470
    const top = ensureVisible(t4, 500, 389, 6, frame, 500, 500)
    expect(toScreen(top, frame, 500, 500, 500, 389).y).toBeCloseTo(FOCUS_MARGIN_PX + 6, 9)
    const bottom = ensureVisible(t4, 500, 610, 6, frame, 500, 500)
    expect(toScreen(bottom, frame, 500, 500, 500, 610).y).toBeCloseTo(500 - (FOCUS_MARGIN_PX + 6), 9)
  })

  it('a point 30 px in is panned when its radius needs more room', () => {
    const t = ensureVisible(t4, 390, 500, 10, frame, 500, 500)
    expect(toScreen(t, frame, 500, 500, 390, 500).x).toBeCloseTo(FOCUS_MARGIN_PX + 10, 9)
  })

  it('a non-finite point returns the clamped input and a non-finite transform falls back to the identity', () => {
    expect(ensureVisible(t4, NaN, 500, 0, frame, 500, 500)).toEqual(t4)
    expect(ensureVisible({ zoom: NaN, tx: 0, ty: 0 }, 500, 500, 0, frame, 500, 500)).toEqual(IDENTITY_TRANSFORM)
  })

  it('property: after ensureVisible the point sits inside the window by the margin (frame points, window of 100 or more)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1500, noNaN: true }),
        fc.double({ min: 100, max: 1500, noNaN: true }),
        fc.double({ min: 1, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        (w, h, zoom, wx, wy, radius) => {
          const t = ensureVisible({ zoom, tx: 0, ty: 0 }, wx, wy, radius, frame, w, h)
          const p = toScreen(t, frame, w, h, wx, wy)
          const inset = FOCUS_MARGIN_PX + radius
          expect(p.x).toBeGreaterThanOrEqual(inset - 1e-6)
          expect(p.x).toBeLessThanOrEqual(w - inset + 1e-6)
          expect(p.y).toBeGreaterThanOrEqual(inset - 1e-6)
          expect(p.y).toBeLessThanOrEqual(h - inset + 1e-6)
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ── footprint ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('canvasFootprint', () => {
  it('is 580 x 580 for a square frame on a desktop viewport', () => {
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 1280, 800)).toEqual({ cssWidth: 580, cssHeight: 580 })
  })

  it('shrinks to the viewport minus 16 below 596 px wide (375 -> 359) and keeps the aspect ratio', () => {
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 375, 667)).toEqual({ cssWidth: 359, cssHeight: 359 })
    expect(canvasFootprint({ width: 1000, height: 500, nodeRadius: 1 }, 375, 667)).toEqual({ cssWidth: 359, cssHeight: 179 })
  })

  it('is exactly the nominal width at and above 596 px', () => {
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 596, 800).cssWidth).toBe(580)
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 595, 800).cssWidth).toBe(579)
  })

  it('clamps a tall ladder frame (19 x 4096) to the viewport height minus 96 (800 -> 704)', () => {
    expect(canvasFootprint({ width: 19, height: 4096, nodeRadius: 0.5 }, 1280, 800)).toEqual({ cssWidth: 580, cssHeight: 704 })
  })

  it('rounds down to whole CSS px', () => {
    const fp = canvasFootprint({ width: 3, height: 2, nodeRadius: 1 }, 1280, 800)
    expect(fp.cssWidth).toBe(580)
    expect(fp.cssHeight).toBe(386) // floor(580 * 2 / 3 = 386.67)
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 500.9, 800).cssWidth).toBe(484)
  })

  it('never returns less than 1 px and survives a degenerate frame or a non-finite viewport (T-06-02)', () => {
    expect(canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, 5, 5)).toEqual({ cssWidth: 1, cssHeight: 1 })
    for (const [vw, vh] of [[NaN, 800], [1280, NaN], [Infinity, Infinity], [-50, -50]] as const) {
      const fp = canvasFootprint({ width: 1000, height: 1000, nodeRadius: 1 }, vw, vh)
      expect(Number.isInteger(fp.cssWidth) && fp.cssWidth >= 1).toBe(true)
      expect(Number.isInteger(fp.cssHeight) && fp.cssHeight >= 1).toBe(true)
      expect(fp.cssWidth).toBeLessThanOrEqual(DIAGRAM_CSS_WIDTH)
    }
    const bad = canvasFootprint({ width: 0, height: 0, nodeRadius: 1 }, 1280, 800)
    expect(bad.cssWidth).toBe(580)
    expect(bad.cssHeight).toBeGreaterThanOrEqual(1)
    expect(bad.cssHeight).toBeLessThanOrEqual(800 - HEIGHT_RESERVE_PX)
  })
})

// ── backing store ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('backingStore', () => {
  it('multiplies the CSS size by the device pixel ratio', () => {
    expect(backingStore(580, 580, 2)).toEqual({ dpr: 2, pixelWidth: 1160, pixelHeight: 1160 })
    expect(backingStore(580, 580, 1)).toEqual({ dpr: 1, pixelWidth: 580, pixelHeight: 580 })
  })

  it('caps the ratio at 3', () => {
    expect(backingStore(580, 580, 5).dpr).toBe(DPR_MAX)
    expect(backingStore(580, 580, 5)).toEqual({ dpr: 3, pixelWidth: 1740, pixelHeight: 1740 })
  })

  it('treats a NaN, zero, negative or infinite ratio as 1', () => {
    for (const bad of [NaN, 0, -2, Infinity, -Infinity]) expect(backingStore(580, 580, bad).dpr).toBe(1)
  })

  it('reduces the ratio so the area stays within an injected limit', () => {
    const s = backingStore(1000, 1000, 2, 1_000_000)
    expect(s.dpr).toBeCloseTo(1, 9)
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(1_000_000)
    const tight = backingStore(1000, 1000, 3, 250_000)
    expect(tight.pixelWidth * tight.pixelHeight).toBeLessThanOrEqual(250_000)
    expect(tight.dpr).toBeLessThan(1)
  })

  it('leaves a store under the limit alone', () => {
    expect(backingStore(100, 100, 2, 1_000_000)).toEqual({ dpr: 2, pixelWidth: 200, pixelHeight: 200 })
  })

  it('reads the default limit from the table: a huge window is reduced under CANVAS_AREA_LIMIT_PX', () => {
    const s = backingStore(30_000, 30_000, 1)
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(CANVAS_AREA_LIMIT_PX)
    expect(s).toEqual(backingStore(30_000, 30_000, 1, CANVAS_AREA_LIMIT_PX))
    // the shipped footprint at DPR 3 is nowhere near the limit, so it is untouched
    expect(backingStore(580, 704, 3).dpr).toBe(3)
  })

  it('an invalid size or limit is safe: a 0 x 0 store for a bad size, the table limit for a bad limit', () => {
    for (const [w, h] of [[0, 580], [580, 0], [NaN, 580], [580, -1], [Infinity, 580]] as const) {
      expect(backingStore(w, h, 2)).toEqual({ dpr: 1, pixelWidth: 0, pixelHeight: 0 })
    }
    for (const bad of [0, -5, NaN]) {
      expect(backingStore(580, 580, 2, bad)).toEqual(backingStore(580, 580, 2, CANVAS_AREA_LIMIT_PX))
    }
  })

  it('property: the area never exceeds the limit, the ratio never exceeds 3, and a store under the limit keeps its ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6000 }),
        fc.integer({ min: 1, max: 6000 }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.integer({ min: 10_000, max: 100_000_000 }),
        (cssW, cssH, ratio, limit) => {
          const s = backingStore(cssW, cssH, ratio, limit)
          expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(limit)
          expect(s.dpr).toBeLessThanOrEqual(DPR_MAX)
          expect(s.dpr).toBeGreaterThan(0)
          const wanted = Math.min(DPR_MAX, ratio > 0 ? ratio : 1)
          if (cssW * cssH * wanted * wanted <= limit) {
            expect(s.dpr).toBe(wanted)
            expect(s.pixelWidth).toBe(Math.floor(cssW * wanted))
            expect(s.pixelHeight).toBe(Math.floor(cssH * wanted))
          }
        },
      ),
      { numRuns: 400 },
    )
  })
})
