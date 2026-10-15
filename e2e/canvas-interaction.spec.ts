import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test'
import {
  buildZoneScene,
  createNumogram,
  DEFAULT_LAYOUT_PARAMS,
  formatGateName,
  formatNetSpan,
  resolveLayout,
  routeCurrents,
  routeGates,
  torqueLabel,
  type CanvasScene,
  type Numogram,
} from '../engine/index'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../app/lib/labelScheme'
import { buildNumogramView, type NumogramView } from '../app/lib/numogramView'
import { regionLabel, regionOfZone } from '../app/lib/regions'
import { SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { PAGE_STEP } from '../app/lib/canvas/keyboardModel'
import { buildZoneGrid, pickAt, type PickFilter, type ZoneGrid } from '../app/lib/canvas/pickIndex'
import {
  IDENTITY_TRANSFORM,
  ZOOM_STEP,
  canvasFootprint,
  onScreenRadius,
  scaleOf,
  toScreen,
  toWorld,
  zoomMax,
  type CanvasFrame,
  type CanvasTransform,
} from '../app/lib/canvas/viewTransform'
import { CANVAS_READY, openCanvas, panel } from './viewer-helpers'

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
const LIVE = '[data-canvas-live]'
const ZWSP = String.fromCodePoint(0x200b) // the live region's repeat toggle (never typed as an escape)
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

// ── Expected text, from the engine and the view (never from the keyboard model under test) ───────────────────────────

interface BaseNames {
  readonly g: Numogram
  readonly view: NumogramView
  readonly labels: readonly string[]
}
const baseNames = new Map<number, BaseNames>()
function namesOf(base: number): BaseNames {
  let names = baseNames.get(base)
  if (names === undefined) {
    const g = createNumogram(base)
    names = { g, view: buildNumogramView(g), labels: zoneLabelsFor(base, DEFAULT_LABEL_SCHEME) }
    baseNames.set(base, names)
  }
  return names
}

/** The text the canvas shows for a zone (the SVG tier's own aria-label, UI-SPEC Copywriting) plus an optional announcement suffix. */
function zoneText(z: number, base: number, suffix = ''): string {
  const { g, labels } = namesOf(base)
  return `Zone ${labels[z]}, ${regionLabel(regionOfZone(g, z))}${suffix}`
}

interface Stop {
  readonly key: string // the data-focus-key
  readonly text: string // the announcement (the SVG tier's aria-label)
}

/** The syzygy, current and gate that Tab visits for zone z: keys and strings from the engine, checked against the view's own entries. */
function stopsOf(base: number, z: number): { syzygy: Stop; current: Stop; gate: Stop } {
  const { g, view, labels } = namesOf(base)
  const q = g.pairOf(z)
  const { lo, hi } = g.pair(q)
  const syzygy = view.syzygies.find(s => g.pairOf(s.a) === q)
  const current = view.currents.find(c => g.pairOf(c.from) === q)
  const gate = view.gates.find(t => t.from === z)
  if (syzygy === undefined || current === undefined || gate === undefined) throw new Error(`the view has no syzygy, current or gate for zone ${z}`)
  // the view agrees with the engine's own definitions before the page is compared with either
  expect([syzygy.a, syzygy.b]).toEqual([lo, hi])
  expect(current.name).toBe(formatNetSpan(hi, lo, base))
  expect(gate.name).toBe(formatGateName(g.gate(z).cumulation, base))
  expect(gate.to).toBe(g.gate(z).to)
  return {
    syzygy: { key: `syzygy:${lo}:${hi}`, text: `Syzygy ${labels[lo]}::${labels[hi]}` },
    current: { key: `current:${current.name}`, text: `Current ${current.name}: ${current.label}` },
    gate: { key: `gate:${gate.name}`, text: `Gate ${gate.name}: zone ${labels[z]} to zone ${labels[gate.to]}` },
  }
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

// ── Keyboard: helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

async function isCanvasActive(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement
    return active instanceof HTMLCanvasElement && active.getAttribute('role') === 'application'
  })
}

/** Presses Tab until the overlay canvas (role="application") is the active element: it is one Tab stop among the page's controls. */
async function tabToCanvas(page: Page, maxPresses = 150): Promise<number> {
  for (let i = 1; i <= maxPresses; i++) {
    await page.keyboard.press('Tab')
    if (await isCanvasActive(page)) return i
  }
  throw new Error(`the canvas was not reached within ${maxPresses} Tab presses`)
}

/** The live region's text without the zero-width space it appends to make a repeated announcement a change. */
async function announced(page: Page): Promise<string> {
  return ((await page.locator(LIVE).textContent()) ?? '').split(ZWSP).join('')
}

async function expectAnnouncement(page: Page, expected: string): Promise<void> {
  await expect.poll(() => announced(page), { message: 'the live region says' }).toBe(expected)
}

/** The ring is on `key` (data-focus-key) and the live region says `text`. */
async function expectRing(page: Page, key: string, text: string): Promise<void> {
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', key)
  await expectAnnouncement(page, text)
}

async function leaveToCorner(page: Page): Promise<void> {
  const corner = await emptyCorner(page)
  await page.mouse.move(corner.x, corner.y)
  await expect(page.locator(CALLOUT)).toHaveCount(0)
}

/** The first of `zones` whose centre reaches the overlay canvas at the current transform (page coordinates). */
async function reachableZone(page: Page, scene: CanvasScene, zones: readonly number[]): Promise<TapTarget> {
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const t = await liveTransform(page)
  for (const z of zones) {
    const p = toScreen(t, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    const x = box.x + p.x
    const y = box.y + p.y
    if (await reachesCanvas(page, x, y)) return { zone: z, x, y }
  }
  throw new Error(`no zone of ${zones.join(', ')} reaches the canvas (panels cover it)`)
}

/**
 * Presses a Regions panel button from the keyboard. In the default desktop layout the Regions panel (235 px high at this
 * base) runs under the Currents panel's header, which sits above the Warp and Plex rows' buttons and takes a mouse click
 * meant for them; the buttons themselves work, so the setup activates them with focus and Space.
 */
async function press(page: Page, button: Locator): Promise<void> {
  await button.focus()
  await page.keyboard.press('Space')
}

function isolateButton(page: Page, label: string) {
  return page.getByRole('button', { name: `Isolate ${label}`, exact: true })
}
function muteButton(page: Page, label: string) {
  return page.getByRole('button', { name: `Mute ${label}`, exact: true })
}

// ── Keyboard ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('keyboard: arrows, Home/End and the Page keys move between zones and each move is announced', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const last = base - 1
  await openCanvas(page, `base=${base}`)
  const presses = await tabToCanvas(page)
  console.log(`the canvas is Tab stop ${presses} on this page`)

  const canvas = page.locator(OVERLAY)
  await expect(canvas).toHaveAttribute('data-focus-key', 'zone:0')
  // the first visible zone is announced and named by the callout when the canvas takes focus
  await expectAnnouncement(page, zoneText(0, base))
  await expect(page.locator(CALLOUT)).toHaveText(zoneText(0, base))

  const steps: ReadonlyArray<readonly [string, number]> = [
    ['ArrowRight', 1],
    ['ArrowDown', 2],
    ['ArrowLeft', 1],
    ['ArrowUp', 0],
    ['ArrowLeft', last], // wraps backwards
    ['ArrowRight', 0], // and forwards
    ['End', last],
    ['Home', 0],
    ['PageDown', PAGE_STEP],
    ['PageDown', 2 * PAGE_STEP],
    ['PageUp', PAGE_STEP],
    ['End', last],
    ['PageDown', last], // clamped at the end
    ['PageUp', last - PAGE_STEP],
    ['Home', 0],
    ['PageUp', 0], // clamped at the start
  ]
  for (const [key, zone] of steps) {
    await page.keyboard.press(key)
    await expectRing(page, `zone:${zone}`, zoneText(zone, base))
  }

  expect(await isCanvasActive(page)).toBe(true)
  expect(errors).toEqual([])
})

test("keyboard: Tab steps through the zone's syzygy, current and gate, then leaves; Shift+Tab steps back", async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const z = PAGE_STEP
  const stops = stopsOf(base, z)
  const root = page.locator(CANVAS_READY)
  await openCanvas(page, `base=${base}`)
  await expect(root).toHaveAttribute('data-overlay-edges', '0') // the gate layer is off at this base: nothing is drawn at rest
  await tabToCanvas(page)

  await page.keyboard.press('PageDown')
  await expectRing(page, `zone:${z}`, zoneText(z, base))

  await page.keyboard.press('Tab')
  await expectRing(page, stops.syzygy.key, stops.syzygy.text)
  await page.keyboard.press('Tab')
  await expectRing(page, stops.current.key, stops.current.text)
  await page.keyboard.press('Tab')
  // the gate is reachable although its layer is not drawn at this base (D-04, D-08): keyboard focus counts as hover
  await expectRing(page, stops.gate.key, stops.gate.text)
  await expect.poll(() => numberAttr(page, CANVAS_READY, 'data-overlay-edges')).toBeGreaterThanOrEqual(1)

  // the next Tab leaves the canvas (never a trap) and focus no longer draws its edges
  await page.keyboard.press('Tab')
  expect(await isCanvasActive(page)).toBe(false)
  await expect(root).toHaveAttribute('data-overlay-edges', '0')

  // Shift+Tab comes back to the canvas, and steps back through the stops before it leaves again
  await page.keyboard.press('Shift+Tab')
  expect(await isCanvasActive(page)).toBe(true)
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', stops.gate.key)
  await page.keyboard.press('Shift+Tab')
  await expectRing(page, stops.current.key, stops.current.text)
  await page.keyboard.press('Shift+Tab')
  await expectRing(page, stops.syzygy.key, stops.syzygy.text)
  await page.keyboard.press('Shift+Tab')
  await expectRing(page, `zone:${z}`, zoneText(z, base))
  await page.keyboard.press('Shift+Tab')
  expect(await isCanvasActive(page)).toBe(false)

  expect(errors).toEqual([])
})

test('Enter selects a zone and announces it, Enter on an edge pins it', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const z = 3
  const stops = stopsOf(base, z)
  await openCanvas(page, `base=${base}`)
  await tabToCanvas(page)
  for (let i = 0; i < z; i++) await page.keyboard.press('ArrowRight')
  await expectRing(page, `zone:${z}`, zoneText(z, base))
  expect(selectedZones(page)).toEqual([])

  await page.keyboard.press('Enter')
  await expectAnnouncement(page, zoneText(z, base, ', selected'))
  await expect.poll(() => selectedZones(page)).toEqual([z])

  // moving away and back: the zone is now named as selected
  await page.keyboard.press('ArrowRight')
  await expectRing(page, `zone:${z + 1}`, zoneText(z + 1, base))
  await page.keyboard.press('ArrowLeft')
  await expectRing(page, `zone:${z}`, zoneText(z, base, ', selected'))

  await page.keyboard.press('Enter')
  await expectAnnouncement(page, zoneText(z, base, ', not selected'))
  await expect.poll(() => selectedZones(page)).toEqual([])

  // an edge is pinned, not selected
  await page.keyboard.press('Tab')
  await expectRing(page, stops.syzygy.key, stops.syzygy.text)
  await page.keyboard.press('Enter')
  await expectAnnouncement(page, `${stops.syzygy.text}, pinned`)
  expect(selectedZones(page)).toEqual([])

  expect(errors).toEqual([])
})

test('the focus ring target stays inside the window when keys would move it out (auto-pan)', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const scene = zoneScene(base)
  await openCanvas(page, `base=${base}`)
  await tabToCanvas(page) // the + key is only handled while the canvas has focus
  const { frame, cssWidth, cssHeight } = await windowOf(page, scene)
  const ceiling = zoomMax(frame, cssWidth, cssHeight)

  for (let i = 0; i < 6; i++) await page.keyboard.press('+')
  // six steps of 1.25, held at the canvas's own zoom ceiling
  await expect.poll(() => numberAttr(page, OVERLAY, 'data-zoom')).toBeCloseTo(Math.min(ceiling, ZOOM_STEP ** 6), 6)
  const zoom = await numberAttr(page, OVERLAY, 'data-zoom')
  expect(zoom).toBeGreaterThan(2)
  expect(zoom).toBeLessThanOrEqual(ceiling)

  const margin = 20 // UI-SPEC: 24 px inside the window edge, with 4 px of tolerance
  let panned = 0
  for (let i = 1; i <= 5; i++) {
    const before = await liveTransform(page)
    await page.keyboard.press('PageDown')
    const z = i * PAGE_STEP
    await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', `zone:${z}`)
    const t = await liveTransform(page)
    if (t.tx !== before.tx || t.ty !== before.ty) panned++
    const p = toScreen(t, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    expect(p.x, `zone ${z} x on screen`).toBeGreaterThanOrEqual(margin)
    expect(p.x, `zone ${z} x on screen`).toBeLessThanOrEqual(cssWidth - margin)
    expect(p.y, `zone ${z} y on screen`).toBeGreaterThanOrEqual(margin)
    expect(p.y, `zone ${z} y on screen`).toBeLessThanOrEqual(cssHeight - margin)
  }
  console.log(`auto-pan: zoom ${zoom} (ceiling ${ceiling}), ${panned} of 5 Page Down presses panned the view`)
  expect(panned, 'at this zoom the ring leaves the window, so the view must have panned').toBeGreaterThan(0)

  expect(errors).toEqual([])
})

test('reduced motion: the canvas reaches ready and the global rule collapses its transition', async ({ page }) => {
  const errors = trackErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCanvas(page, `base=${CANVAS_BASE}`)
  const root = page.locator(CANVAS_READY)
  await expect(root).toHaveAttribute('data-canvas-state', 'ready')

  const seconds = async (): Promise<number[]> =>
    root.evaluate(el =>
      getComputedStyle(el)
        .transitionDuration.split(',')
        .map(part => (part.trim().endsWith('ms') ? parseFloat(part) / 1000 : parseFloat(part))),
    )
  for (const duration of await seconds()) expect(duration).toBeLessThanOrEqual(0.01)

  // the rule is what does it: without the preference the same element keeps its 0.15 s opacity transition
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(seconds).toEqual([0.15])

  // and under the preference the canvas still answers keys at once
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await tabToCanvas(page)
  await page.keyboard.press('+')
  await expect.poll(() => numberAttr(page, OVERLAY, 'data-zoom')).toBe(ZOOM_STEP)

  expect(errors).toEqual([])
})

test('mute removes zones from picking and from the keyboard order; isolate keeps the other zones pickable and on the keys', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const { g } = namesOf(base)
  const scene = zoneScene(base)
  const plex = Array.from(g.plex.zones()).sort((a, b) => a - b)
  const visible = Array.from({ length: base }, (_, z) => z).filter(z => !plex.includes(z)) // the keyboard order with Plex muted
  const first = visible[0]
  const lastVisible = visible[visible.length - 1]
  if (first === undefined || lastVisible === undefined) throw new Error('the base has no zone outside Plex')
  const torqueRow = g.torqueCount === 1 ? 'Torque' : `Torque ${torqueLabel(0)}`

  await openCanvas(page, `base=${base}`)
  const plexZone = await reachableZone(page, scene, plex)
  const torqueZone = await reachableZone(page, scene, Array.from(g.torques[0].zones()))
  expect(plex).toContain(plexZone.zone)

  // before the mute: a Plex zone is picked
  await page.mouse.move(plexZone.x, plexZone.y)
  await expect(page.locator(CALLOUT)).toHaveText(zoneText(plexZone.zone, base))
  await leaveToCorner(page)

  // mute Plex: no Plex zone is picked any more, and the keyboard never lands on one
  await press(page, muteButton(page, 'Plex'))
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(plexZone.x, plexZone.y)
  await settleFrames(page)
  expect((await page.locator(CALLOUT).allTextContents()).join(' ')).not.toContain(', Plex')

  await page.locator(OVERLAY).focus()
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', `zone:${first}`)
  await page.keyboard.press('End')
  await expectRing(page, `zone:${lastVisible}`, zoneText(lastVisible, base))
  await page.keyboard.press('ArrowRight') // from the zone before a Plex zone: skips Plex and wraps
  await expectRing(page, `zone:${first}`, zoneText(first, base))
  await page.keyboard.press('ArrowLeft')
  await expectRing(page, `zone:${lastVisible}`, zoneText(lastVisible, base))
  await page.keyboard.press('Home')
  await expectRing(page, `zone:${first}`, zoneText(first, base))

  // clear the mute and isolate the first Torque row: the other regions are dimmed, but still picked and still on the keys
  await press(page, muteButton(page, 'Plex'))
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'false')
  await press(page, isolateButton(page, torqueRow))
  await expect(isolateButton(page, torqueRow)).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/isolate=/)

  await page.mouse.move(plexZone.x, plexZone.y)
  await expect(page.locator(CALLOUT)).toHaveText(zoneText(plexZone.zone, base)) // dimmed, not isolated
  await leaveToCorner(page)
  await page.mouse.move(torqueZone.x, torqueZone.y)
  await expect(page.locator(CALLOUT)).toHaveText(zoneText(torqueZone.zone, base)) // isolated
  await leaveToCorner(page)

  await page.locator(OVERLAY).focus()
  await page.keyboard.press('End')
  await expectRing(page, `zone:${base - 1}`, zoneText(base - 1, base)) // a Plex zone is still in the order

  expect(errors).toEqual([])
})

test('a Regions-row highlight draws on the overlay', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const { g } = namesOf(base)
  const torqueRow = g.torqueCount === 1 ? 'Torque' : `Torque ${torqueLabel(0)}`
  await openCanvas(page, `base=${base}`)
  const root = page.locator(CANVAS_READY)
  await expect(root).toHaveAttribute('data-overlay-edges', '0')

  const row = panel(page, 'Regions').locator('div.cursor-pointer').filter({ hasText: new RegExp(`^${torqueRow}`) }).first()
  await row.locator('span').first().click()
  await expect.poll(() => numberAttr(page, CANVAS_READY, 'data-overlay-edges')).toBeGreaterThan(0)

  // clicking the row again removes the highlight and what it drew
  await row.locator('span').first().click()
  await expect(root).toHaveAttribute('data-overlay-edges', '0')

  expect(errors).toEqual([])
})
