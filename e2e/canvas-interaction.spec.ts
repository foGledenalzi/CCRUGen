import { test, expect, type CDPSession, type Page } from '@playwright/test'
import { buildZoneScene, createNumogram, DEFAULT_LAYOUT_PARAMS, resolveLayout, routeCurrents, routeGates, type CanvasScene } from '../engine/index'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../app/lib/labelScheme'
import { regionLabel, regionOfZone } from '../app/lib/regions'
import { SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { buildZoneGrid, pickAt, type PickFilter, type ZoneGrid } from '../app/lib/canvas/pickIndex'
import {
  IDENTITY_TRANSFORM,
  canvasFootprint,
  onScreenRadius,
  scaleOf,
  toScreen,
  toWorld,
  type CanvasFrame,
  type CanvasTransform,
} from '../app/lib/canvas/viewTransform'
import { CANVAS_READY, openCanvas } from './viewer-helpers'

// Proves the Canvas tier's input surface in Chromium (REN-02, D-08, D-09): narrow windows (375 x 667 and 768 x 1024),
// touch (a CDP two-finger pinch, a one-finger pan, a tap that pins the nearest element within 12 px), keyboard traversal
// with its announcements, auto-pan, reduced motion, and isolate / mute / the Regions legend. Every expected string and
// position is computed from the engine and the same pure modules the app uses (createNumogram, resolveLayout,
// buildZoneScene, pickAt, toScreen), never read back from the app; the DOM is only read for what the app publishes
// (data-zoom, data-tx, data-ty, data-focus-key, data-overlay-*, [data-canvas-live], [data-canvas-callout]).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 6 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const OVERLAY = 'canvas[data-diagram]'
const CALLOUT = '[data-canvas-callout]'
const PACKER = DEFAULT_LAYOUT_PARAMS.packer
const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the table sends to the Canvas tier
const HEIGHT_RESERVE = 96 // UI-SPEC: the canvas is at most the viewport height minus 96 px
const PANEL_RIGHT_EDGE = 260 // UI-SPEC narrow-window table: the 240 px panels at x = 8 end at 248; taps stay right of 260

// ── Errors ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

// ── Scenes built with the engine (the same calls the worker core makes) ──────────────────────────────────────────────

const zoneScenes = new Map<number, CanvasScene>()
function zoneScene(base: number): CanvasScene {
  let scene = zoneScenes.get(base)
  if (scene === undefined) {
    const g = createNumogram(base)
    const resolved = resolveLayout(g, 'ring', [], { packer: PACKER })
    scene = buildZoneScene(g, resolved, routeGates(g, resolved), routeCurrents(g, resolved))
    zoneScenes.set(base, scene)
  }
  return scene
}

function frameOf(scene: CanvasScene): CanvasFrame {
  return { width: scene.width, height: scene.height, nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius }
}

function at(a: Float64Array, i: number): number {
  const v = a[i]
  if (v === undefined) throw new Error(`index ${i} is out of range (length ${a.length})`)
  return v
}

/** The callout text the canvas shows for a zone (the SVG tier's own aria-label, UI-SPEC Copywriting). */
function zoneText(z: number, base: number): string {
  const labels = zoneLabelsFor(base, DEFAULT_LABEL_SCHEME)
  return `Zone ${labels[z]}, ${regionLabel(regionOfZone(createNumogram(base), z))}`
}

// ── Canvas geometry: where a world point is on the page ─────────────────────────────────────────────────────────────

interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

async function canvasBox(page: Page): Promise<Box> {
  const box = await page.locator(CANVAS_READY).boundingBox()
  if (box === null) throw new Error('the canvas wrapper has no bounding box')
  return box
}

async function numberAttr(page: Page, selector: string, name: string): Promise<number> {
  return Number(await page.locator(selector).getAttribute(name))
}

/** The committed transform the page reports on the overlay canvas. */
async function liveTransform(page: Page): Promise<CanvasTransform> {
  return {
    zoom: await numberAttr(page, OVERLAY, 'data-zoom'),
    tx: await numberAttr(page, OVERLAY, 'data-tx'),
    ty: await numberAttr(page, OVERLAY, 'data-ty'),
  }
}

/** The canvas window size the footprint rule gives for this scene at the page's viewport (checked against the DOM box). */
async function windowOf(page: Page, scene: CanvasScene): Promise<{ frame: CanvasFrame; cssWidth: number; cssHeight: number; box: Box }> {
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport size')
  const frame = frameOf(scene)
  const { cssWidth, cssHeight } = canvasFootprint(frame, viewport.width, viewport.height)
  const box = await canvasBox(page)
  expect(Math.abs(box.width - cssWidth), `the canvas is ${box.width} px wide, the footprint rule says ${cssWidth}`).toBeLessThan(0.5)
  expect(Math.abs(box.height - cssHeight), `the canvas is ${box.height} px high, the footprint rule says ${cssHeight}`).toBeLessThan(0.5)
  return { frame, cssWidth, cssHeight, box }
}

/** Whether the topmost element at a page point is the overlay canvas (panels and the toolbar sit above the diagram). */
async function reachesCanvas(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(([px, py]) => document.elementFromPoint(px as number, py as number)?.hasAttribute('data-diagram') ?? false, [x, y])
}

/**
 * A canvas corner that reaches the overlay canvas. The fixed panels sit above the left strip of the diagram (UI-SPEC:
 * panels are above the canvas in z-order), so the right-hand corners are tried first. Every corner of a ring layout is
 * empty of picks.
 */
async function emptyCorner(page: Page, inset = 4): Promise<{ x: number; y: number }> {
  const box = await canvasBox(page)
  const candidates = [
    { x: box.x + box.width - inset, y: box.y + inset },
    { x: box.x + box.width - inset, y: box.y + box.height - inset },
    { x: box.x + inset, y: box.y + box.height - inset },
    { x: box.x + inset, y: box.y + inset },
  ]
  for (const c of candidates) if (await reachesCanvas(page, c.x, c.y)) return c
  throw new Error('every corner of the canvas is covered by other DOM')
}

/** Two animation frames: enough for the rAF-coalesced work (hover pick, commit, announcement) to have run. */
async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}

const allowAllButGates: PickFilter = { zoneAllowed: () => true, edgeAllowed: kind => kind !== 'gate' }

/** What the tap rule picks (the spec's own pickAt) for a zone, or null. */
function pickedZone(scene: CanvasScene, grid: ZoneGrid, t: CanvasTransform, frame: CanvasFrame, w: number, h: number, sx: number, sy: number): number | null {
  const s = scaleOf(t, frame, w, h)
  const world = toWorld(t, frame, w, h, sx, sy)
  const hit = pickAt(scene, grid, world.x, world.y, s, allowAllButGates)
  return hit !== null && hit.kind === 'zone' ? hit.id : null
}

interface TapTarget {
  readonly zone: number
  readonly x: number // page coordinates
  readonly y: number
}

/**
 * A zone right of the panels (x > PANEL_RIGHT_EDGE) whose point reaches the canvas and that the spec's own pick resolves to
 * itself, tapped `distance` CSS px beyond its node edge in the first direction that still picks it (0 = its centre).
 */
async function tapTarget(page: Page, scene: CanvasScene, distance: number, exclude: readonly number[] = []): Promise<TapTarget> {
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const t = await liveTransform(page)
  const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)
  const radiusPx = onScreenRadius(t, frame, cssWidth, cssHeight)
  for (let z = 0; z < scene.x.length; z++) {
    if (exclude.includes(z)) continue
    const c = toScreen(t, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    for (let k = 0; k < (distance === 0 ? 1 : 24); k++) {
      const angle = (k * 2 * Math.PI) / 24 + 0.07
      const sx = c.x + (distance === 0 ? 0 : Math.cos(angle) * (radiusPx + distance))
      const sy = c.y + (distance === 0 ? 0 : Math.sin(angle) * (radiusPx + distance))
      const x = box.x + sx
      const y = box.y + sy
      if (x <= PANEL_RIGHT_EDGE || sx < 6 || sy < 6 || sx > cssWidth - 6 || sy > cssHeight - 6) continue
      if (pickedZone(scene, grid, t, frame, cssWidth, cssHeight, sx, sy) !== z) continue
      if (await reachesCanvas(page, x, y)) return { zone: z, x, y }
    }
  }
  throw new Error(`no zone right of x = ${PANEL_RIGHT_EDGE} picks itself ${distance} px beyond its edge`)
}

/** The zones the URL says are selected (the codec writes them as a comma list under selected=). */
function selectedZones(page: Page): number[] {
  const raw = new URL(page.url()).searchParams.get('selected')
  return raw === null || raw === '' ? [] : raw.split(',').map(Number)
}

// ── Touch through the Chrome DevTools Protocol (RESEARCH: two-finger pinch recipe) ───────────────────────────────────

interface TouchPoint {
  readonly x: number
  readonly y: number
  readonly id: number
}

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: readonly TouchPoint[]): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touchPoints] })
}

/** Two fingers on one horizontal line about (cx, cy), `from` px each side of the centre at the start and `to` at the end. */
async function pinch(cdp: CDPSession, cx: number, cy: number, from: number, to: number, steps = 5): Promise<void> {
  await touch(cdp, 'touchStart', [
    { x: cx - from, y: cy, id: 1 },
    { x: cx + from, y: cy, id: 2 },
  ])
  for (let i = 1; i <= steps; i++) {
    const half = from + ((to - from) * i) / steps
    await touch(cdp, 'touchMove', [
      { x: cx - half, y: cy, id: 1 },
      { x: cx + half, y: cy, id: 2 },
    ])
  }
  await touch(cdp, 'touchEnd', [])
}

/** One finger from (x, y) moved by (dx, dy) in equal steps (each above the 8 px pan threshold in total). */
async function drag(cdp: CDPSession, x: number, y: number, dx: number, dy: number, steps = 4): Promise<void> {
  await touch(cdp, 'touchStart', [{ x, y, id: 1 }])
  for (let i = 1; i <= steps; i++) await touch(cdp, 'touchMove', [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 1 }])
  await touch(cdp, 'touchEnd', [])
}

// ── Narrow windows ────────────────────────────────────────────────────────────────────────────────────────────────────

async function pageOverflow(page: Page): Promise<{ doc: number; body: number }> {
  return page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
}

/** The overlay canvas and the wrapper agree on width and left edge: nothing of the diagram is clipped by the wrapper. */
async function expectDiagramNotClipped(page: Page): Promise<void> {
  const root = await canvasBox(page)
  const overlay = await page.locator(OVERLAY).boundingBox()
  if (overlay === null) throw new Error('the overlay canvas has no bounding box')
  expect(Math.abs(overlay.width - root.width), 'the diagram is wider than its window: its right edge is clipped').toBeLessThan(0.5)
  expect(Math.abs(overlay.x - root.x)).toBeLessThan(0.5)
}

test.describe('375 x 667 phone window with touch', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  test('375 x 667: the canvas fits the window', async ({ page }) => {
    const errors = trackErrors(page)
    await openCanvas(page, `base=${CANVAS_BASE}`)

    const scene = zoneScene(CANVAS_BASE)
    const { cssWidth, box } = await windowOf(page, scene) // the footprint rule and the DOM agree
    expect(box.width, 'UI-SPEC: 100vw - 16 = 359 CSS px').toBe(359)
    expect(cssWidth).toBe(359)
    expect(box.height).toBeLessThanOrEqual(667 - HEIGHT_RESERVE)
    // the whole canvas is on screen with a margin on each side, and none of the diagram is clipped
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    await expectDiagramNotClipped(page)

    const overflow = await pageOverflow(page)
    expect(overflow.doc).toBeLessThanOrEqual(375)
    expect(overflow.body).toBeLessThanOrEqual(375)
    expect(errors).toEqual([])
  })

  test('pinch zooms and one finger pans', async ({ page, context }) => {
    const errors = trackErrors(page)
    await openCanvas(page, `base=${CANVAS_BASE}`)
    const root = page.locator(CANVAS_READY)
    const box = await canvasBox(page)
    const cdp = await context.newCDPSession(page)

    // the part of the canvas the 240 px panels leave uncovered: both fingers must land on the canvas, not on a panel
    const cx = box.x + box.width - 60
    const cy = box.y + box.height / 2
    expect(await reachesCanvas(page, cx - 18, cy)).toBe(true)
    expect(await reachesCanvas(page, cx + 18, cy)).toBe(true)

    const start = await liveTransform(page)
    expect(start).toEqual(IDENTITY_TRANSFORM)

    // spread the fingers from 36 px apart to 96 px apart: the zoom follows the ratio
    await pinch(cdp, cx, cy, 18, 48)
    await expect.poll(async () => numberAttr(page, OVERLAY, 'data-zoom'), { timeout: 10_000 }).toBeGreaterThan(start.zoom)
    await expect(root).toHaveAttribute('data-canvas-state', 'ready')
    const zoomed = await liveTransform(page)
    console.log(`pinch spread 36 -> 96 px: zoom ${start.zoom} -> ${zoomed.zoom} (ratio ${(96 / 36).toFixed(4)}), tx ${zoomed.tx} ty ${zoomed.ty}`)
    expect(zoomed.zoom).toBeCloseTo(96 / 36, 2)

    // one finger: the content follows the finger by the distance it moved
    await drag(cdp, cx - 20, cy, 40, 20)
    await expect.poll(async () => numberAttr(page, OVERLAY, 'data-tx'), { timeout: 10_000 }).toBeGreaterThan(zoomed.tx)
    await expect(root).toHaveAttribute('data-canvas-state', 'ready')
    const panned = await liveTransform(page)
    console.log(`drag +40,+20 px: tx ${zoomed.tx} -> ${panned.tx}, ty ${zoomed.ty} -> ${panned.ty}`)
    expect(panned.zoom).toBe(zoomed.zoom)
    expect(panned.tx - zoomed.tx).toBeCloseTo(40, 0)
    expect(panned.ty - zoomed.ty).toBeCloseTo(20, 0)

    // and the fingers can come back together: the same state machine, a second gesture
    await pinch(cdp, cx, cy, 48, 18)
    await expect.poll(async () => numberAttr(page, OVERLAY, 'data-zoom'), { timeout: 10_000 }).toBeLessThan(zoomed.zoom)
    await expect(root).toHaveAttribute('data-canvas-state', 'ready')
    expect((await liveTransform(page)).zoom).toBeCloseTo(1, 2)

    expect(errors).toEqual([])
  })

  test('a tap pins the nearest element within 12 px and an empty tap clears it', async ({ page }) => {
    const errors = trackErrors(page)
    const base = CANVAS_BASE
    const scene = zoneScene(base)
    await openCanvas(page, `base=${base}`)

    // at this window the fitted node radius is already above 2 CSS px, so no zoom is needed to tap a zone
    const { frame, cssWidth, cssHeight } = await windowOf(page, scene)
    expect(onScreenRadius(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)).toBeGreaterThanOrEqual(2)

    // tap a zone's centre: the callout names it, stays after the tap (touch has no hover) and the selection follows
    const first = await tapTarget(page, scene, 0)
    await page.touchscreen.tap(first.x, first.y)
    await expect(page.locator(CALLOUT)).toHaveText(zoneText(first.zone, base))
    await expect.poll(() => selectedZones(page)).toEqual([first.zone])
    await settleFrames(page)
    await expect(page.locator(CALLOUT)).toHaveText(zoneText(first.zone, base))

    // a tap a few px beside another zone's node still pins that zone (the 12 px rule, shared with the mouse)
    const second = await tapTarget(page, scene, 5, [first.zone])
    await page.touchscreen.tap(second.x, second.y)
    await expect(page.locator(CALLOUT)).toHaveText(zoneText(second.zone, base))
    await expect.poll(() => selectedZones(page)).toContain(second.zone)

    // a tap on empty canvas clears the pin
    const corner = await emptyCorner(page)
    await page.touchscreen.tap(corner.x, corner.y)
    await expect(page.locator(CALLOUT)).toHaveCount(0)

    expect(errors).toEqual([])
  })
})

test('768 x 1024: the canvas keeps the 580 px column', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 768, height: 1024 })
  await openCanvas(page, `base=${CANVAS_BASE}`)

  const scene = zoneScene(CANVAS_BASE)
  const { box } = await windowOf(page, scene)
  expect(box.width, 'UI-SPEC: the 580 px column below the 820 px breakpoint').toBe(580)
  expect(box.height).toBeLessThanOrEqual(1024 - HEIGHT_RESERVE)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(768)
  await expectDiagramNotClipped(page)

  const overflow = await pageOverflow(page)
  expect(overflow.doc).toBeLessThanOrEqual(768)
  expect(overflow.body).toBeLessThanOrEqual(768)
  expect(errors).toEqual([])
})
