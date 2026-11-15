import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  DEFAULT_LAYOUT_PARAMS,
  formatGateName,
  formatNumeral,
  pairGraphLayout,
  parseRouteCurve,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
  type CanvasScene,
} from '../engine/index'
import type { Demon } from '../app/data/types'
import { curveAway } from '../app/lib/geometry'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../app/lib/labelScheme'
import { regionLabel, regionOfZone } from '../app/lib/regions'
import { SELECTION_LIST_MAX } from '../app/lib/selectionList'
import { INTERACTIVE_MAX_N, LABEL_MIN_RADIUS_PX, SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { CALLOUT_OFFSET_PX, gestureMapping } from '../app/lib/canvas/diagramModel'
import { wheelZoomFactor } from '../app/lib/canvas/interaction'
import { buildZoneGrid, flattenChords, pickAt, PICK_RADIUS_PX, zonesInWorldRect, type PickFilter, type ZoneGrid } from '../app/lib/canvas/pickIndex'
import {
  CANVAS_SURFACE_AREA_LIMIT_PX,
  IDENTITY_TRANSFORM,
  ZOOM_STEP,
  canvasFootprint,
  fitZones,
  onScreenRadius,
  panBy,
  scaleOf,
  surfaceOf,
  surfaceStore,
  toScreen,
  toWorld,
  zoomAt,
  type CanvasFrame,
  type CanvasTransform,
} from '../app/lib/canvas/viewTransform'
import { CANVAS_READY, SUMMARY, openCanvas, openHeadless, openViewer, panel } from './viewer-helpers'

// Proves REN-02 / ROADMAP criteria 1 and 2 in Chromium for the Canvas tier: the tier follows the table (boundaries are
// read from engine/scene/tier-table.json through app/lib/tierBounds: svgRichMaxN and the interactiveMaxN ceiling, never
// typed here), all four layouts draw, node centres agree with the SVG tier, level of detail follows the label threshold,
// picks follow the 12 px rule, hover/pin/clear and the on-demand gate behave like the SVG tier, the toolbar and the
// shared-link fit drive the canvas transform, select-all at the ceiling downgrades the overlay, and Demon focus chords
// draw and pick. Expected geometry and picks are computed from the engine and the same pure modules the app uses
// (createNumogram, resolveLayout, buildZoneScene, pickAt, toScreen), never read back from the app. Timings are logged
// with console.log and never asserted (T-05-38: tests do not depend on this PC's speed).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 6 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const OVERLAY = 'canvas[data-diagram]'
const PACKER = DEFAULT_LAYOUT_PARAMS.packer
const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the table sends to the Canvas tier
const HEADLESS_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
const CALLOUT = '[data-canvas-callout]'

// ── Errors ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

// ── Scenes built with the engine (the same calls the worker core makes) ──────────────────────────────────────────────

type ZoneLayoutId = 'ring' | 'ladder' | 'spiral'
const zoneScenes = new Map<string, CanvasScene>()
function zoneScene(base: number, layout: ZoneLayoutId = 'ring'): CanvasScene {
  const key = `${base}:${layout}`
  let scene = zoneScenes.get(key)
  if (scene === undefined) {
    const g = createNumogram(base)
    const resolved = resolveLayout(g, layout, [], { packer: PACKER })
    scene = buildZoneScene(g, resolved, routeGates(g, resolved), routeCurrents(g, resolved))
    zoneScenes.set(key, scene)
  }
  return scene
}

function pairScene(base: number): CanvasScene {
  const g = createNumogram(base)
  const pg = pairGraphLayout(g, { packer: PACKER })
  return buildPairScene(g, pg, routePairGraph(g, pg))
}

function frameOf(scene: CanvasScene): CanvasFrame {
  return { width: scene.width, height: scene.height, nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius }
}

function at(a: Float64Array, i: number): number {
  const v = a[i]
  if (v === undefined) throw new Error(`index ${i} is out of range (length ${a.length})`)
  return v
}

const label = (z: number, base: number): string => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME)

/** The callout text the canvas shows for a zone (the SVG tier's own aria-label, UI-SPEC Copywriting). */
function zoneText(z: number, base: number): string {
  return `Zone ${label(z, base)}, ${regionLabel(regionOfZone(createNumogram(base), z))}`
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

async function numberAttr(loc: Locator, name: string): Promise<number> {
  return Number(await loc.getAttribute(name))
}

/** The committed transform the page reports on the overlay canvas. */
async function liveTransform(page: Page): Promise<CanvasTransform> {
  const overlay = page.locator(OVERLAY)
  return { zoom: await numberAttr(overlay, 'data-zoom'), tx: await numberAttr(overlay, 'data-tx'), ty: await numberAttr(overlay, 'data-ty') }
}

/** The canvas window size the footprint rule gives for this scene at the page's viewport (checked against the DOM box). */
async function windowOf(page: Page, scene: CanvasScene): Promise<{ frame: CanvasFrame; cssWidth: number; cssHeight: number; box: Box }> {
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport size')
  const frame = frameOf(scene)
  const { cssWidth, cssHeight } = canvasFootprint(frame, viewport.width, viewport.height)
  const box = await canvasBox(page)
  expect(Math.abs(box.width - cssWidth)).toBeLessThan(0.5)
  expect(Math.abs(box.height - cssHeight)).toBeLessThan(0.5)
  return { frame, cssWidth, cssHeight, box }
}

/** Page coordinates (and canvas-relative ones) of a zone's centre, from the engine scene and the transform the canvas reports. */
async function canvasPoint(page: Page, scene: CanvasScene, zone: number): Promise<{ x: number; y: number; sx: number; sy: number }> {
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const t = await liveTransform(page)
  const p = toScreen(t, frame, cssWidth, cssHeight, at(scene.x, zone), at(scene.y, zone))
  const point = { x: box.x + p.x, y: box.y + p.y, sx: p.x, sy: p.y }
  // the point must reach the overlay canvas, not a panel or the toolbar above it
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x as number, y as number)?.getAttribute('data-diagram') ?? null, [point.x, point.y])
  expect(hit).toBe(scene.kind)
  return point
}

/** Two animation frames: enough for the rAF-coalesced hover pick to have run (used before an ABSENCE assertion). */
async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}

/**
 * A canvas corner that reaches the overlay canvas. At a desktop width the fixed panels sit above the left strip of the
 * diagram (UI-SPEC: panels are above the canvas in z-order), so the right-hand corners are tried first and a corner under
 * other DOM is skipped. Every corner of a ring layout is empty of picks.
 */
async function emptyCorner(page: Page, inset = 4): Promise<{ x: number; y: number }> {
  const box = await canvasBox(page)
  const candidates = [
    { x: box.x + box.width - inset, y: box.y + inset },
    { x: box.x + box.width - inset, y: box.y + box.height - inset },
    { x: box.x + inset, y: box.y + box.height - inset },
    { x: box.x + inset, y: box.y + inset },
  ]
  for (const c of candidates) {
    const reaches = await page.evaluate(([x, y]) => document.elementFromPoint(x as number, y as number)?.hasAttribute('data-diagram') ?? false, [c.x, c.y])
    if (reaches) return c
  }
  throw new Error('every corner of the canvas is covered by other DOM')
}

/** Moves the pointer to an empty corner of the canvas and waits until no callout is left (the hover and the pin are separate). */
async function leaveToCorner(page: Page, expectNoCallout = true): Promise<void> {
  const corner = await emptyCorner(page)
  await page.mouse.move(corner.x, corner.y)
  if (expectNoCallout) await expect(page.locator(CALLOUT)).toHaveCount(0)
}

const allowAllButGates: PickFilter = { zoneAllowed: () => true, edgeAllowed: kind => kind !== 'gate' }

/** A zone the spec's own pick resolves to itself at its centre (a few zones can overlap at a large base). */
function zoneThatPicksItself(scene: CanvasScene, from: number): number {
  const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)
  for (let z = from; z < scene.x.length; z++) {
    const hit = pickAt(scene, grid, at(scene.x, z), at(scene.y, z), 1, allowAllButGates)
    if (hit !== null && hit.kind === 'zone' && hit.id === z) return z
  }
  throw new Error(`no zone from ${from} picks itself at its centre`)
}

// ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('tier follows the table: SVG at svgRichMaxN, Canvas just above it and at the ceiling, headless above', async ({ page }) => {
  const errors = trackErrors(page)

  await openViewer(page, `base=${SVG_RICH_MAX_N}`)
  await expect(page.locator('[data-render-tier="svg"]')).toHaveCount(1)
  await expect(page.locator('[data-zone]')).toHaveCount(SVG_RICH_MAX_N)
  await expect(page.locator('canvas[data-diagram]')).toHaveCount(0)

  await openCanvas(page, `base=${CANVAS_BASE}`)
  await expect(page.locator('canvas[data-diagram="zones"]')).toHaveCount(1)
  await expect(page.locator('[data-render-tier="svg"]')).toHaveCount(0)

  await openCanvas(page, `base=${INTERACTIVE_MAX_N}`)
  await expect(page.locator('canvas[data-diagram="zones"]')).toHaveCount(1)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(INTERACTIVE_MAX_N))

  await openHeadless(page, `base=${HEADLESS_BASE}`)
  await expect(page.locator(SUMMARY)).toBeVisible()
  await expect(page.locator('[data-diagram]')).toHaveCount(0)

  expect(errors).toEqual([])
})

// ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('all four layouts draw on Canvas', async ({ page }) => {
  const errors = trackErrors(page)
  const cases: Array<[string, 'zones' | 'pairs']> = [
    ['ring', 'zones'],
    ['ladder', 'zones'],
    ['spiral', 'zones'],
    ['pairGraph', 'pairs'],
  ]
  for (const [layout, kind] of cases) {
    await openCanvas(page, `base=${CANVAS_BASE}&layout=${layout}`)
    await expect(page.locator(OVERLAY)).toHaveAttribute('data-diagram', kind)
    await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-canvas-state', 'ready')
  }
  expect(errors).toEqual([])
})

// ── 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A zone's SVG-tier centre relative to its diagram's own box (CSS px). */
async function svgCentre(page: Page, zone: number): Promise<{ x: number; y: number }> {
  const svgBox = await page.locator('[data-diagram="zones"]').boundingBox()
  const circleBox = await page.locator(`[data-diagram="zones"] [data-zone="${zone}"]`).first().locator('circle').first().boundingBox()
  if (svgBox === null || circleBox === null) throw new Error(`zone ${zone} has no SVG box`)
  return { x: circleBox.x + circleBox.width / 2 - svgBox.x, y: circleBox.y + circleBox.height / 2 - svgBox.y }
}

/**
 * Alpha (0..255) of the node layer's pixel under a window-relative CSS point (the window is the root element). The layer is
 * the paint surface, larger than the window, so the point is first offset by where the window sits inside the canvas.
 */
async function nodeAlpha(page: Page, sx: number, sy: number): Promise<number> {
  return page.evaluate(
    ([x, y]) => {
      const c = document.querySelector('canvas[data-canvas-layer="node"]') as HTMLCanvasElement
      const root = document.querySelector('[data-render-tier="canvas"]') as HTMLElement
      const cr = c.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      const ctx = c.getContext('2d') as CanvasRenderingContext2D
      const lx = (x as number) + (rr.left - cr.left)
      const ly = (y as number) + (rr.top - cr.top)
      const px = Math.min(c.width - 1, Math.max(0, Math.round((lx * c.width) / c.clientWidth)))
      const py = Math.min(c.height - 1, Math.max(0, Math.round((ly * c.height) / c.clientHeight)))
      return ctx.getImageData(px, py, 1, 1).data[3] ?? 0
    },
    [sx, sy],
  )
}

async function parityAt(page: Page, base: number, zones: number[], tolerance: number): Promise<void> {
  const g = createNumogram(base)
  const scene = zoneScene(base, 'ring')

  await openViewer(page, `base=${base}&layout=ring`)
  const svg = new Map<number, { x: number; y: number }>()
  for (const z of zones) svg.set(z, await svgCentre(page, z))

  await openCanvas(page, `base=${base}&layout=ring&tier=canvas`)
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-diagram', 'zones')
  let worst = 0
  for (const z of zones) {
    const p = await canvasPoint(page, scene, z)
    const s = svg.get(z)
    if (s === undefined) throw new Error('missing SVG centre')
    expect(Math.abs(p.sx - s.x), `zone ${z} x: canvas ${p.sx} vs svg ${s.x}`).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(p.sy - s.y), `zone ${z} y: canvas ${p.sy} vs svg ${s.y}`).toBeLessThanOrEqual(tolerance)
    worst = Math.max(worst, Math.abs(p.sx - s.x), Math.abs(p.sy - s.y))

    // the raster agrees too: the node layer is painted under the SVG tier's centre and empty in the corner
    expect(await nodeAlpha(page, s.x, s.y), `zone ${z} node pixel`).toBeGreaterThan(0)

    // hovering the point names the zone, as the SVG tier's aria-label does
    await page.mouse.move(p.x, p.y)
    await expect(page.locator(CALLOUT)).toHaveText(zoneText(z, base))
    await leaveToCorner(page)
  }
  expect(await nodeAlpha(page, 2, 2)).toBe(0)
  console.log(`parity base=${base} zones=${zones.join(',')} maxDeltaPx=${worst.toFixed(3)} tolerancePx=${tolerance}`)
  expect(g.base).toBe(base)
}

test('parity with the SVG tier at base 28 (node centres within 1 CSS px, hover names the zone)', async ({ page }) => {
  const errors = trackErrors(page)
  await parityAt(page, 28, [0, 5, 13, 27], 1)
  expect(errors).toEqual([])
})

test('parity with the SVG tier at base 64 (within 1.5 CSS px at 1280 x 1000, where the height clamp does not engage)', async ({ page }) => {
  const errors = trackErrors(page)
  // the base-64 ring frame is tall: at 800 px the canvas height clamp (viewport - 96) would engage, and parity is only
  // measured where the shrink and the clamp do not (UI-SPEC Verification Hooks)
  await page.setViewportSize({ width: 1280, height: 1000 })
  await parityAt(page, 64, [0, 31, 63], 1.5)
  expect(errors).toEqual([])
})

// ── 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('level of detail: no zone labels at fit below the table threshold, labels once zoomed past it', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    const w = window as unknown as { __fillTexts: string[] }
    w.__fillTexts = []
    const proto = CanvasRenderingContext2D.prototype
    const original = proto.fillText
    proto.fillText = function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D['fillText']>) {
      w.__fillTexts.push(String(args[0]))
      return original.apply(this, args)
    }
  })

  const base = CANVAS_BASE
  const scene = zoneScene(base, 'ring')
  const labels = new Set(Array.from({ length: base }, (_, z) => label(z, base)))
  const recorded = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __fillTexts: string[] }).__fillTexts.slice())

  await openCanvas(page, `base=${base}`)
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const fitRadius = onScreenRadius(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)
  expect(fitRadius, 'the fitted radius is below the label threshold at this base').toBeLessThan(LABEL_MIN_RADIUS_PX)

  const atFit = await recorded()
  expect(atFit.filter(t => labels.has(t))).toEqual([])

  // wheel-zoom about the canvas centre until the zoom reaches threshold / fitted radius
  const needed = LABEL_MIN_RADIUS_PX / fitRadius
  await page.evaluate(() => {
    ;(window as unknown as { __fillTexts: string[] }).__fillTexts = []
  })
  await page.mouse.move(box.x + cssWidth / 2, box.y + cssHeight / 2)
  const wheels = Math.ceil(Math.log(needed * 1.1) / 0.15) + 1 // exp(100 x 0.0015) = 1.1618 per wheel step
  for (let i = 0; i < wheels; i++) await page.mouse.wheel(0, -100)
  await expect.poll(async () => numberAttr(page.locator(OVERLAY), 'data-zoom'), { timeout: 15_000 }).toBeGreaterThanOrEqual(needed)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-canvas-state', 'ready')
  await expect.poll(async () => (await recorded()).filter(t => labels.has(t)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  expect(errors).toEqual([])
})

// ── 5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('picks follow the 12 px rule exactly (5 and 11 px pick the zone, 13 px does not)', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const scene = zoneScene(base, 'ring')
  const grid: ZoneGrid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)

  await openCanvas(page, `base=${base}`)
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const s = scaleOf(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)
  const radiusPx = onScreenRadius(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)

  // The pick the app makes with nothing hovered (the gate layer is off at this base, so no gate is a candidate).
  const pickFrom = (z: number, angle: number, distance: number): { x: number; y: number; id: number | null; kind: string | null } => {
    const dx = Math.cos(angle) * (radiusPx + distance)
    const dy = Math.sin(angle) * (radiusPx + distance)
    const wx = at(scene.x, z) + dx / s
    const wy = at(scene.y, z) + dy / s
    const hit = pickAt(scene, grid, wx, wy, s, allowAllButGates)
    const p = toScreen(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight, wx, wy)
    return { x: p.x, y: p.y, id: hit === null ? null : hit.id, kind: hit === null ? null : hit.kind }
  }
  const inside = (p: { x: number; y: number }): boolean => p.x > 4 && p.y > 4 && p.x < cssWidth - 4 && p.y < cssHeight - 4

  let found: { z: number; angle: number } | null = null
  for (let z = 0; z < base && found === null; z++) {
    for (let k = 0; k < 16 && found === null; k++) {
      const angle = (k * 2 * Math.PI) / 16 + 0.07
      const near = pickFrom(z, angle, 5)
      const far = pickFrom(z, angle, 11)
      const out = pickFrom(z, angle, 13)
      const isZone = (r: { id: number | null; kind: string | null }): boolean => r.kind === 'zone' && r.id === z
      if (isZone(near) && isZone(far) && !isZone(out) && out.kind === null && inside(near) && inside(far) && inside(out)) found = { z, angle }
    }
  }
  if (found === null) throw new Error('no zone and direction pick at 5 and 11 px and release at 13 px')
  const { z, angle } = found
  console.log(`pick-radius base=${base} zone=${z} fittedRadiusPx=${radiusPx.toFixed(2)} angle=${angle.toFixed(3)}`)

  const expected = zoneText(z, base)
  for (const distance of [5, 11]) {
    await leaveToCorner(page)
    const p = pickFrom(z, angle, distance)
    await page.mouse.move(box.x + p.x, box.y + p.y)
    await expect(page.locator(CALLOUT)).toHaveText(expected)
  }
  await leaveToCorner(page)
  const outside = pickFrom(z, angle, 13)
  await page.mouse.move(box.x + outside.x, box.y + outside.y)
  await settleFrames(page)
  await expect(page.locator(CALLOUT)).toHaveCount(0)

  expect(errors).toEqual([])
})

// ── 6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('hover, pin and clear at base 1024', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 1024
  const scene = zoneScene(base, 'ring')
  const z = zoneThatPicksItself(scene, 300)

  await openCanvas(page, `base=${base}`)
  const p = await canvasPoint(page, scene, z)

  await page.mouse.move(p.x, p.y)
  await expect(page.locator(CALLOUT)).toHaveText(zoneText(z, base))

  await page.mouse.click(p.x, p.y)
  await expect(panel(page, 'Selection')).toContainText(`Zone ${label(z, base)}`)
  await expect(page).toHaveURL(new RegExp(`selected=${z}(&|$)`))

  // away from the node the pin still names it; an empty-space click clears hover and pin
  await leaveToCorner(page, false)
  await expect(page.locator(CALLOUT)).toHaveCount(1)
  const corner = await emptyCorner(page)
  await page.mouse.click(corner.x, corner.y)
  await expect(page.locator(CALLOUT)).toHaveCount(0)

  expect(errors).toEqual([])
})

// ── 7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a hovered zone's own gate is drawn with the gate layer off", async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const g = createNumogram(base)
  const scene = zoneScene(base, 'ring')
  const z = zoneThatPicksItself(scene, 40)

  await openCanvas(page, `base=${base}`)
  const root = page.locator(CANVAS_READY)
  await expect(root).toHaveAttribute('data-overlay-edges', '0')

  // its syzygy, the current of its pair together with every current flowing into it (one per pair id), and its own gate
  const currents = new Set<number>([g.pairOf(z)])
  for (let q = 0; q < g.pairCount; q++) if (g.current(q).to === z) currents.add(q)
  const expectedEdges = 1 + currents.size + 1

  const p = await canvasPoint(page, scene, z)
  await page.mouse.move(p.x, p.y)
  await expect(root).toHaveAttribute('data-overlay-edges', String(expectedEdges))
  await leaveToCorner(page)
  await expect(root).toHaveAttribute('data-overlay-edges', '0')

  expect(errors).toEqual([])
})

// ── 8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('panels and toolbar at the Canvas tier', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 1024
  const g = createNumogram(base)
  // the Text panel is stacked below the list panels on the desktop layout: a taller viewport reaches its header
  await page.setViewportSize({ width: 1280, height: 1300 })
  await openCanvas(page, `base=${base}`)

  const expand = async (name: string): Promise<void> => {
    const button = page.getByRole('button', { name: `Expand ${name}` })
    if ((await button.count()) > 0) await button.click()
  }
  await expand('Zones')
  await expect(panel(page, 'Zones')).toContainText(`Listed up to ${SVG_RICH_MAX_N} zones. Pick elements on the diagram.`)

  await expand('Text')
  const pre = page.locator('pre[aria-label="Numogram text"]')
  await expect(pre).toBeVisible()
  const text = (await pre.textContent()) ?? ''
  expect(text.startsWith(`CCRUG numogram, base ${base}`)).toBe(true)
  const gate = g.gate(5)
  await expect(pre).toContainText(`${formatGateName(gate.cumulation, base)} zone ${label(5, base)} -> zone ${label(gate.to, base)}`)

  const overlay = page.locator(OVERLAY)
  const toolbar = page.locator('[role="toolbar"][aria-label="Diagram view"]')
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  await expect(toolbar).toContainText('100%')
  await page.locator('button[aria-label="Zoom in"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', '1.25')
  await expect(toolbar).toContainText('125%')
  await page.locator('button[aria-label="Fit diagram to view"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  await expect(toolbar).toContainText('100%')

  expect(errors).toEqual([])
})

// ── 9 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('select-all at the ceiling downgrades overlay fidelity and caps the Selection list', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = trackErrors(page)
  const base = INTERACTIVE_MAX_N
  const g = createNumogram(base)
  await openCanvas(page, `base=${base}`)
  const root = page.locator(CANVAS_READY)
  const box = await canvasBox(page)

  // A rubber band from one corner of the canvas to past the diagonally opposite one selects every zone. It starts at a
  // corner that reaches the canvas (the fixed panels cover the left strip at this width), 1 px in, and the spec proves
  // from the engine scene that every node centre lies inside the rectangle (the Plex row sits within a few px of the edge).
  const scene = zoneScene(base, 'ring')
  const { frame, cssWidth, cssHeight } = await windowOf(page, scene)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let z = 0; z < base; z++) {
    const p = toScreen(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const start = await emptyCorner(page, 1)
  const fromRight = start.x > box.x + box.width / 2
  const fromTop = start.y < box.y + box.height / 2
  const end = { x: fromRight ? box.x - 10 : box.x + box.width + 10, y: fromTop ? box.y + box.height + 10 : box.y - 10 }
  const sx = start.x - box.x
  const sy = start.y - box.y
  if (fromRight) expect(sx, 'the start is right of every node').toBeGreaterThanOrEqual(maxX)
  else expect(sx, 'the start is left of every node').toBeLessThanOrEqual(minX)
  if (fromTop) expect(sy, 'the start is above every node').toBeLessThanOrEqual(minY)
  else expect(sy, 'the start is below every node').toBeGreaterThanOrEqual(maxY)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
  await page.mouse.move(end.x, end.y, { steps: 4 })
  await page.mouse.up()

  await expect(root).toHaveAttribute('data-overlay-fidelity', 'plain', { timeout: 60_000 })
  const edges = await numberAttr(root, 'data-overlay-edges')
  expect(edges).toBeGreaterThan(400)
  // every zone is highlighted: one syzygy and one current per pair, one gate per zone
  expect(edges).toBe(2 * g.pairCount + g.zoneCount)
  console.log(
    `overlay-ms base=${base} edges=${edges} fidelity=${await root.getAttribute('data-overlay-fidelity')} ms=${await root.getAttribute('data-overlay-ms')}`,
  )

  // The Selection panel lists zones, syzygies, currents and gates by key (a gate is named by its cumulation), so the
  // entry count is derived from the engine the same way: every key of a full selection.
  const keys = new Set<string>()
  for (let z = 0; z < base; z++) {
    keys.add(`zone:${z}`)
    keys.add(`gate:${formatGateName(g.gate(z).cumulation, base)}`)
  }
  for (let q = 0; q < g.pairCount; q++) {
    const { lo, hi } = g.pair(q)
    keys.add(`syzygy:${lo}:${hi}`)
    keys.add(`current:${formatNumeral(hi, base)}::${formatNumeral(lo, base)}`)
  }
  const entries = keys.size
  expect(entries).toBeGreaterThan(SELECTION_LIST_MAX)

  const selection = panel(page, 'Selection')
  await expect(selection).toContainText(`Selected Elements (${entries})`, { timeout: 60_000 })
  const more = selection.locator('[data-selection-more]')
  await expect(more).toHaveCount(1, { timeout: 60_000 })
  await expect(more).toHaveText(/^and \d+ more selected$/)
  await expect(more).toHaveText(`and ${entries - SELECTION_LIST_MAX} more selected`)
  expect(await selection.locator('button[aria-label^="Remove "]').count()).toBeLessThanOrEqual(SELECTION_LIST_MAX)

  // the page is still responsive: the toolbar answers (the canvas takes the click and re-rasters)
  await page.locator('button[aria-label="Zoom in"]').click()
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-zoom', '1.25')

  expect(errors).toEqual([])
})

// ── 10 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('demon focus chords draw and pick on the canvas (D-05)', async ({ page }) => {
  const errors = trackErrors(page)
  const base = CANVAS_BASE
  const scene = zoneScene(base, 'ring')
  const z = zoneThatPicksItself(scene, 20)

  await openCanvas(page, `base=${base}`)
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const s = scaleOf(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)
  const radiusPx = onScreenRadius(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)

  await page.locator('button[aria-label="Demon focus"]').click()
  await expect(page.locator('button[aria-label="Demon focus"]')).toHaveAttribute('aria-pressed', 'true')
  const p = await canvasPoint(page, scene, z)
  await page.mouse.click(p.x, p.y)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-overlay-chords', String(base - 1)) // below FOCUS_CHORD_DRAW_MAX
  await leaveToCorner(page, false)

  // The chords the app draws for a zone focus: one demon (hi::lo) per other zone, each the curveAway(..., 0.25) route.
  const chords: Demon[] = []
  for (let w = 0; w < base; w++) {
    if (w === z) continue
    const hi = Math.max(z, w)
    const lo = Math.min(z, w)
    chords.push({ a: hi, b: lo, name: `${formatNumeral(hi, base)}::${formatNumeral(lo, base)}`, kind: 'chrono' })
  }
  const flat = flattenChords(chords, scene.x, scene.y, scene.centerX, scene.centerY)
  const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)

  const nearestNodePx = (wx: number, wy: number): number => {
    let best = Infinity
    for (let k = 0; k < base; k++) best = Math.min(best, Math.hypot(wx - at(scene.x, k), wy - at(scene.y, k)) * s - radiusPx)
    return best
  }
  let chosen: { index: number; sx: number; sy: number } | null = null
  for (let index = 0; index < chords.length && chosen === null; index++) {
    const chord = chords[index] as Demon
    const route = curveAway(
      { x: at(scene.x, chord.a), y: at(scene.y, chord.a) },
      { x: at(scene.x, chord.b), y: at(scene.y, chord.b) },
      scene.centerX,
      scene.centerY,
      0.25,
    )
    const q = new Float64Array(6)
    if (!parseRouteCurve(route, q, 0)) continue
    const wx = 0.25 * at(q, 0) + 0.5 * at(q, 2) + 0.25 * at(q, 4) // the curve's midpoint, t = 0.5
    const wy = 0.25 * at(q, 1) + 0.5 * at(q, 3) + 0.25 * at(q, 5)
    if (nearestNodePx(wx, wy) < PICK_RADIUS_PX) continue // at least 12 px from every node
    // the pick with the gates of both ends on demand (hovering the chord highlights both of its zones)
    const filter: PickFilter = { zoneAllowed: () => true, edgeAllowed: (kind, id) => kind !== 'gate' || id === chord.a || id === chord.b }
    const hit = pickAt(scene, grid, wx, wy, s, filter, flat)
    const screen = toScreen(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight, wx, wy)
    if (hit !== null && hit.kind === 'chord' && hit.id === index && screen.x > 4 && screen.y > 4 && screen.x < cssWidth - 4 && screen.y < cssHeight - 4) {
      chosen = { index, sx: screen.x, sy: screen.y }
    }
  }
  if (chosen === null) throw new Error('no chord midpoint is pickable away from every node')
  const target = chords[chosen.index] as Demon
  console.log(`chord pick base=${base} focus=${z} demon=${target.name} at ${chosen.sx.toFixed(1)},${chosen.sy.toFixed(1)}`)

  await expect(panel(page, 'Selection')).not.toContainText(target.name) // nothing names the demon until the chord is clicked
  await page.mouse.click(box.x + chosen.sx, box.y + chosen.sy)
  await expect(panel(page, 'Selection')).toContainText(target.name)

  expect(errors).toEqual([])
})

// ── 11 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a shared link with selected zones fits them on the canvas', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 1024
  const scene = zoneScene(base, 'ring')
  const selected = [5, 6, 40]

  await openCanvas(page, `base=${base}&selected=${selected.join(',')}`)
  const { frame, cssWidth, cssHeight } = await windowOf(page, scene)
  const expected = fitZones(scene.x, scene.y, selected, frame, cssWidth, cssHeight)
  expect(expected.zoom).toBeGreaterThan(1)

  const overlay = page.locator(OVERLAY)
  await expect.poll(async () => numberAttr(overlay, 'data-zoom'), { timeout: 15_000 }).toBeGreaterThan(1)
  const t = await liveTransform(page)
  expect(t.zoom).toBeCloseTo(expected.zoom, 6)
  expect(t.tx).toBeCloseTo(expected.tx, 3)
  expect(t.ty).toBeCloseTo(expected.ty, 3)

  // Fit (every visible zone) returns to the whole frame
  await page.locator('button[aria-label="Fit diagram to view"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', '1')

  // every selected zone sits inside the window at the fitted transform
  for (const z of selected) {
    const inWindow = toScreen(expected, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    expect(inWindow.x).toBeGreaterThan(0)
    expect(inWindow.x).toBeLessThan(cssWidth)
    expect(inWindow.y).toBeGreaterThan(0)
    expect(inWindow.y).toBeLessThan(cssHeight)
  }

  expect(errors).toEqual([])
})

// ── 12 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Phase 6 review WR-02: CanvasDiagram stays mounted across a canvas-to-canvas swap and only its scene changes. A zoom committed
// for scene A used to stay in the stored box, so coming back to A (after any scene that committed no zoom of its own) revived
// it while the live view had been reset to the identity: the layers were rastered at the old zoom, the CSS gesture transform
// shrank them to a patch on a blank window, and data-zoom and the toolbar percentage lied. Every step is a deterministic state
// read: data-zoom, the toolbar percentage and the layer stack's CSS transform (empty when the live view is the committed one).
test('returning to a zoomed Canvas scene shows the fit view, not the stale zoom', async ({ page }) => {
  const errors = trackErrors(page)
  const baseA = CANVAS_BASE
  const baseB = CANVAS_BASE + 2
  await openCanvas(page, `base=${baseA}`)
  const overlay = page.locator(OVERLAY)
  const stack = overlay.locator('xpath=..') // the layer stack: it carries the CSS gesture transform
  const toolbar = page.locator('[role="toolbar"][aria-label="Diagram view"]')
  const stackTransform = () => stack.evaluate(el => (el as HTMLElement).style.transform)
  const commitBase = async (base: number): Promise<void> => {
    const input = page.locator('input[aria-label="Base"]')
    await input.fill(String(base))
    await input.press('Enter')
    await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(base))
  }

  await page.locator('button[aria-label="Zoom in"]').click()
  await page.locator('button[aria-label="Zoom in"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', String(1.25 * 1.25))
  await expect(toolbar).toContainText('156%')

  // scene B commits no zoom of its own
  await commitBase(baseB)
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  await expect(toolbar).toContainText('100%')
  expect(await stackTransform()).toBe('')

  // back to scene A: the fit view again, never the zoom that was committed before the visit to B
  await commitBase(baseA)
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  await expect(toolbar).toContainText('100%')
  expect(await stackTransform()).toBe('')

  // the zoom machinery of the returned scene still works from the fit view
  await page.locator('button[aria-label="Zoom in"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', '1.25')
  await expect(toolbar).toContainText('125%')
  expect(await stackTransform()).toBe('')

  expect(errors).toEqual([])
})

test('returning to a zoomed Canvas layout shows the fit view too (ring, pair graph, ring)', async ({ page }) => {
  const errors = trackErrors(page)
  await openCanvas(page, `base=${CANVAS_BASE}&layout=ring`)
  const overlay = page.locator(OVERLAY)
  const stack = overlay.locator('xpath=..')
  const toolbar = page.locator('[role="toolbar"][aria-label="Diagram view"]')
  const stackTransform = () => stack.evaluate(el => (el as HTMLElement).style.transform)

  await page.locator('button[aria-label="Zoom in"]').click()
  await expect(overlay).toHaveAttribute('data-zoom', '1.25')

  // the A/S/D/F layout shortcuts: the first offered layout is the ring, the last of the four the pair graph
  await page.locator('body').press('f')
  await expect(overlay).toHaveAttribute('data-diagram', 'pairs')
  await expect(page.locator(CANVAS_READY)).toBeVisible()
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  expect(await stackTransform()).toBe('')

  await page.locator('body').press('a')
  await expect(overlay).toHaveAttribute('data-diagram', 'zones')
  await expect(page.locator(CANVAS_READY)).toBeVisible()
  await expect(overlay).toHaveAttribute('data-zoom', '1')
  await expect(toolbar).toContainText('100%')
  expect(await stackTransform()).toBe('')

  expect(errors).toEqual([])
})

// ── 13 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Phase 6 review IN-02: finalizeSelection armed `suppressNextCanvasClickRef` for every drag, but only the SVG wrapper's onClick ever
// consumes it, so a Canvas rubber band left it armed and the first background click of the next SVG-tier base was swallowed
// (clearInfoFocus skipped once). The pin is shown by PinnedBackground (a fixed, pointer-less layer naming the pinned element).
test('a Canvas rubber band does not swallow the first background click of the next SVG base', async ({ page }) => {
  const errors = trackErrors(page)
  const pinned = page.locator('div.fixed.inset-0.pointer-events-none.font-mono', { hasText: 'Zone f' })
  await openCanvas(page, `base=${CANVAS_BASE}`)

  // a rubber band of a few tens of px from an empty corner of the canvas (it may select nothing; only the drag matters)
  const start = await emptyCorner(page, 1)
  const box = await canvasBox(page)
  const towardsCentre = { x: start.x > box.x + box.width / 2 ? -40 : 40, y: start.y > box.y + box.height / 2 ? -40 : 40 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + towardsCentre.x / 2, start.y + towardsCentre.y / 2, { steps: 3 })
  await page.mouse.move(start.x + towardsCentre.x, start.y + towardsCentre.y, { steps: 3 })
  await page.mouse.up()

  // the SVG tier at base 28: pin zone 15, then one click on the empty diagram background must clear the pin
  const input = page.locator('input[aria-label="Base"]')
  await input.fill('28')
  await input.press('Enter')
  await expect(page.locator('[data-render-tier="svg"] [data-diagram="zones"] [data-zone]')).toHaveCount(28)
  await page.locator('[data-zone="15"]').first().dispatchEvent('click')
  await expect(pinned).toHaveCount(1)

  await page.locator('[data-render-tier="svg"] svg[data-diagram]').dispatchEvent('click')
  await expect(pinned).toHaveCount(0)

  expect(errors).toEqual([])
})

// ── 14 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// A zoomed Canvas diagram fills the viewport (as the SVG tier's CSS transform does) instead of being clipped to a box. The
// window (the SVG tier's 580 px column) stays the LOGICAL frame: the root element keeps its rectangle and every transform is
// in its coordinates. Only the paint surface grows: the five canvases are the viewport united with the window, and the overlay
// on them takes hover, click, wheel, pan and rubber band wherever zoomed content shows. Expected positions come from the
// engine scene, the transform the overlay reports and the pure view functions (surfaceOf, toScreen, zoomAt, panBy), never
// from the app's own numbers; the DOM is read for boxes, pixels and what the app publishes (data-zoom, [data-canvas-callout]).
// Timings are never asserted.

const ZOOM_IN = 'button[aria-label="Zoom in"]'
const LAYER = 'canvas[data-canvas-layer]'
const FILL_ZOOM_STEPS = 3
const EDGE_MARGIN_PX = 6 // a zone this close to the viewport edge is not used (its disc and chip would meet the edge)
const WINDOW_MARGIN_PX = 8 // a zone this far outside the window counts as outside it (a node's own disc is inside)

type Side = 'left' | 'right' | 'above' | 'below'
const SIDES: readonly Side[] = ['left', 'right', 'above', 'below']

/** Zooms in with the toolbar and waits for the committed zoom (the re-raster ran in the same commit, before paint). */
async function zoomInSteps(page: Page, steps: number): Promise<void> {
  for (let i = 0; i < steps; i++) await page.locator(ZOOM_IN).click()
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-zoom', String(ZOOM_STEP ** steps))
}

async function viewportOf(page: Page): Promise<{ width: number; height: number }> {
  const vp = page.viewportSize()
  if (vp === null) throw new Error('no viewport size')
  return vp
}

async function boxOf(loc: Locator): Promise<Box> {
  const b = await loc.boundingBox()
  if (b === null) throw new Error('no bounding box')
  return b
}

/**
 * What is wrong with the paint surface, as messages (empty when right): the overlay and the four layer canvases each contain
 * the window and cover the viewport, and are the size surfaceOf gives for the window's page position.
 */
async function surfaceProblems(page: Page, scene: CanvasScene): Promise<string[]> {
  const vp = await viewportOf(page)
  const root = await canvasBox(page)
  const frame = frameOf(scene)
  const { cssWidth, cssHeight } = canvasFootprint(frame, vp.width, vp.height)
  const expected = surfaceOf(root.x, root.y, cssWidth, cssHeight, vp.width, vp.height)
  const problems: string[] = []
  const canvases = [page.locator(OVERLAY), ...(await page.locator(LAYER).all())]
  if (canvases.length !== 5) problems.push(`${canvases.length} canvases, not 5`)
  for (const [i, loc] of canvases.entries()) {
    const b = await boxOf(loc)
    const tag = i === 0 ? 'overlay' : `layer ${i}`
    if (b.x > root.x + 0.5 || b.y > root.y + 0.5) problems.push(`${tag} starts after the window's top-left`)
    if (b.x + b.width < root.x + root.width - 0.5 || b.y + b.height < root.y + root.height - 0.5) problems.push(`${tag} ends before the window's far corner`)
    if (b.x > 0.5 || b.y > 0.5) problems.push(`${tag} starts at (${b.x}, ${b.y}), not the viewport's top-left`)
    if (b.x + b.width < vp.width - 0.5 || b.y + b.height < vp.height - 0.5) problems.push(`${tag} ends at (${b.x + b.width}, ${b.y + b.height}), short of the viewport`)
    if (Math.abs(b.width - expected.width) > 0.5 || Math.abs(b.height - expected.height) > 0.5) {
      problems.push(`${tag} is ${b.width} x ${b.height}, surfaceOf says ${expected.width} x ${expected.height}`)
    }
  }
  return problems
}

/** How many pixels of a layer canvas are not fully transparent inside a page rectangle (CSS px); -1 when it lies off the canvas. */
async function paintedPixels(page: Page, layer: string, rect: Box): Promise<number> {
  return page.evaluate(
    ({ layer: name, rect: r }) => {
      const c = document.querySelector(`canvas[data-canvas-layer="${name}"]`) as HTMLCanvasElement | null
      if (c === null) return -2
      const b = c.getBoundingClientRect()
      const kx = c.width / b.width
      const ky = c.height / b.height
      const x0 = Math.max(0, Math.floor((r.x - b.left) * kx))
      const y0 = Math.max(0, Math.floor((r.y - b.top) * ky))
      const x1 = Math.min(c.width, Math.ceil((r.x + r.width - b.left) * kx))
      const y1 = Math.min(c.height, Math.ceil((r.y + r.height - b.top) * ky))
      if (x1 <= x0 || y1 <= y0) return -1
      const ctx = c.getContext('2d')
      if (ctx === null) return -3
      const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      let n = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++
      return n
    },
    { layer, rect },
  )
}

interface OutsideZone {
  readonly zone: number
  readonly side: Side
  readonly x: number // page coordinates of the zone's centre
  readonly y: number
  readonly sx: number // window coordinates of the same point
  readonly sy: number
}

/** Every zone whose centre is outside the window (by more than a node) and inside the viewport, from the engine and the reported transform. */
async function zonesOutsideWindow(page: Page, scene: CanvasScene): Promise<OutsideZone[]> {
  const vp = await viewportOf(page)
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const t = await liveTransform(page)
  const out: OutsideZone[] = []
  for (let z = 0; z < scene.x.length; z++) {
    const p = toScreen(t, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
    const x = box.x + p.x
    const y = box.y + p.y
    if (x < EDGE_MARGIN_PX || x > vp.width - EDGE_MARGIN_PX || y < EDGE_MARGIN_PX || y > vp.height - EDGE_MARGIN_PX) continue
    const side: Side | null =
      p.x < -WINDOW_MARGIN_PX ? 'left' : p.x > cssWidth + WINDOW_MARGIN_PX ? 'right' : p.y < -WINDOW_MARGIN_PX ? 'above' : p.y > cssHeight + WINDOW_MARGIN_PX ? 'below' : null
    if (side !== null) out.push({ zone: z, side, x, y, sx: p.x, sy: p.y })
  }
  return out
}

/** Whether the spec's own pick (the 12 px rule) at a window point resolves to the zone. */
function picksZone(scene: CanvasScene, grid: ZoneGrid, t: CanvasTransform, frame: CanvasFrame, w: number, h: number, sx: number, sy: number, zone: number): boolean {
  const world = toWorld(t, frame, w, h, sx, sy)
  const hit = pickAt(scene, grid, world.x, world.y, scaleOf(t, frame, w, h), allowAllButGates)
  return hit !== null && hit.kind === 'zone' && hit.id === zone
}

async function reaches(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(([px, py]) => document.elementFromPoint(px as number, py as number)?.hasAttribute('data-diagram') ?? false, [x, y])
}

/** For each side of the window with one, a zone outside it that picks itself and whose point reaches the overlay (no panel above it). */
async function reachableZonePerSide(page: Page, scene: CanvasScene): Promise<OutsideZone[]> {
  const { frame, cssWidth, cssHeight } = await windowOf(page, scene)
  const t = await liveTransform(page)
  const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)
  const all = await zonesOutsideWindow(page, scene)
  const chosen: OutsideZone[] = []
  for (const side of SIDES) {
    for (const o of all) {
      if (o.side !== side || !picksZone(scene, grid, t, frame, cssWidth, cssHeight, o.sx, o.sy, o.zone)) continue
      if (!(await reaches(page, o.x, o.y))) continue
      chosen.push(o)
      break
    }
  }
  return chosen
}

/** The bands of the viewport outside the window, as page rectangles (empty ones left out). */
async function bandsOutsideWindow(page: Page): Promise<Box[]> {
  const vp = await viewportOf(page)
  const root = await canvasBox(page)
  const bands: Box[] = [
    { x: 0, y: root.y, width: root.x, height: root.height }, // left of the window
    { x: root.x + root.width, y: root.y, width: vp.width - (root.x + root.width), height: root.height }, // right
    { x: 0, y: 0, width: vp.width, height: root.y }, // above
    { x: 0, y: root.y + root.height, width: vp.width, height: vp.height - (root.y + root.height) }, // below
  ]
  return bands.filter(b => b.width > 24 && b.height > 24)
}

/** A point outside the window that reaches the overlay (the first on a coarse grid over the bands, clear of the viewport edge). */
async function emptyPointOutsideWindow(page: Page, scene: CanvasScene): Promise<{ x: number; y: number }> {
  const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
  const t = await liveTransform(page)
  const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)
  for (const band of await bandsOutsideWindow(page)) {
    for (let y = Math.ceil(band.y) + 20; y < band.y + band.height - 10; y += 24) { // whole CSS px: a synthetic wheel event truncates a fractional clientY
      for (let x = Math.ceil(band.x) + 20; x < band.x + band.width - 10; x += 24) {
        const world = toWorld(t, frame, cssWidth, cssHeight, x - box.x, y - box.y)
        const hit = pickAt(scene, grid, world.x, world.y, scaleOf(t, frame, cssWidth, cssHeight), allowAllButGates)
        if (hit === null && (await reaches(page, x, y))) return { x, y }
      }
    }
  }
  throw new Error('no point outside the window reaches the overlay')
}

function selectedZoneIds(page: Page): number[] {
  const raw = new URL(page.url()).searchParams.get('selected')
  return raw === null || raw === '' ? [] : raw.split(',').map(Number).sort((a, b) => a - b)
}

const FILL_VIEWPORTS = [
  { name: '1600 x 900', width: 1600, height: 900 },
  { name: '375 x 667', width: 375, height: 667 },
] as const

for (const vp of FILL_VIEWPORTS) {
  test.describe(`a zoomed Canvas diagram fills the viewport at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('the five canvases are the paint surface, before and after zooming; the root keeps the window rectangle', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      await windowOf(page, scene) // the footprint rule and the root's box agree
      await expect.poll(() => surfaceProblems(page, scene)).toEqual([])

      await zoomInSteps(page, FILL_ZOOM_STEPS)
      await windowOf(page, scene) // still the window: only the pixels grew
      await expect.poll(() => surfaceProblems(page, scene)).toEqual([])
      expect(errors).toEqual([])
    })

    test('zoomed content is painted outside the window, where the engine puts every node', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      await zoomInSteps(page, FILL_ZOOM_STEPS)

      const outside = await zonesOutsideWindow(page, scene)
      expect(outside.length, 'zones outside the window and inside the viewport').toBeGreaterThan(0)
      // the node canvas has a disc at the centre of every one of them (a window-sized canvas would have nothing there)
      const missing: number[] = []
      for (const o of outside) if ((await paintedPixels(page, 'node', { x: o.x - 2, y: o.y - 2, width: 5, height: 5 })) <= 0) missing.push(o.zone)
      expect(missing, 'zones outside the window with no disc painted at their centre').toEqual([])

      // and the dotted syzygy lines run on into every band that has zones in it
      const bands = await bandsOutsideWindow(page)
      let checked = 0
      for (const band of bands) {
        const hasZone = outside.some(o => o.x >= band.x && o.x <= band.x + band.width && o.y >= band.y && o.y <= band.y + band.height)
        if (!hasZone) continue
        checked++
        expect(await paintedPixels(page, 'syzygy', band), `the syzygy layer in the band at (${band.x}, ${band.y})`).toBeGreaterThan(0)
      }
      expect(checked, 'bands with zones').toBeGreaterThan(0)
      expect(errors).toEqual([])
    })

    test('hover names and a click selects a zone outside the window, with the chip beside the pointer', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      await zoomInSteps(page, FILL_ZOOM_STEPS)

      const chosen = await reachableZonePerSide(page, scene)
      console.log(`fills-viewport ${vp.name}: zones outside the window by side ${chosen.map(c => `${c.side}=${c.zone}`).join(' ')}`)
      expect(chosen.length, 'sides of the window with a pickable zone that no panel covers').toBeGreaterThanOrEqual(2)
      for (const [i, o] of chosen.entries()) {
        if (i > 0) {
          // a click opens the Selection panel, which can cover the next zone: every side starts from a fresh page (same layout)
          await openCanvas(page, `base=${CANVAS_BASE}`)
          await zoomInSteps(page, FILL_ZOOM_STEPS)
        }
        await page.mouse.move(o.x, o.y)
        await expect(page.locator(CALLOUT)).toHaveText(zoneText(o.zone, CANVAS_BASE))
        // the chip sits CALLOUT_OFFSET_PX beside the pointer (flipped at the surface edge), also left of and above the window
        await expect
          .poll(async () => {
            const chip = await boxOf(page.locator(CALLOUT))
            const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1.5
            const horizontal = near(chip.x, o.x + CALLOUT_OFFSET_PX) || near(chip.x + chip.width, o.x - CALLOUT_OFFSET_PX)
            const vertical = near(chip.y, o.y + CALLOUT_OFFSET_PX) || near(chip.y + chip.height, o.y - CALLOUT_OFFSET_PX)
            return horizontal && vertical
          }, { message: `the chip for zone ${o.zone} (${o.side} of the window) is beside the pointer` })
          .toBe(true)

        await page.mouse.click(o.x, o.y)
        await expect.poll(() => selectedZoneIds(page)).toEqual([o.zone])
      }
      expect(errors).toEqual([])
    })

    test('a wheel turn over the surface outside the window zooms about the pointer, and the stack pivots on the window', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      await zoomInSteps(page, FILL_ZOOM_STEPS)
      const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
      const t = await liveTransform(page)
      const point = await emptyPointOutsideWindow(page, scene)
      const sx = point.x - box.x
      const sy = point.y - box.y
      const inWindow = sx >= 0 && sx <= cssWidth && sy >= 0 && sy <= cssHeight
      expect(inWindow, 'the wheel point lies outside the window').toBe(false)

      // the live gesture, synchronously: the CSS transform of the stack maps the window as the pure functions say, pivoting on
      // the window's top-left (a stack pivoting on its own corner would land elsewhere for any zoom but 1)
      const deltaY = -200
      const factor = wheelZoomFactor(deltaY, 0)
      const live = zoomAt(t, factor, sx, sy, frame, cssWidth, cssHeight)
      const m = gestureMapping(t, live, cssWidth, cssHeight)
      expect(m.k, 'the wheel turn changes the zoom').toBeGreaterThan(1)
      const vpSize = await viewportOf(page)
      const surface = surfaceOf(box.x, box.y, cssWidth, cssHeight, vpSize.width, vpSize.height)
      const got = await page.evaluate(
        ({ x, y, dy }) => {
          const overlay = document.querySelector('canvas[data-diagram]') as HTMLElement
          const stack = overlay.parentElement as HTMLElement
          const event = new WheelEvent('wheel', { deltaY: dy, deltaMode: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })
          const notPrevented = overlay.dispatchEvent(event) // the root's listener prevents the page scroll
          const r = stack.getBoundingClientRect()
          return { notPrevented, left: r.left, top: r.top, width: r.width, height: r.height, origin: getComputedStyle(stack).transformOrigin }
        },
        { x: point.x, y: point.y, dy: deltaY },
      )
      expect(got.notPrevented, 'the wheel event from the overlay reached the root listener (it is a DOM child)').toBe(false)
      // Chromium snaps the pivot of a transformed element to a whole pixel when the window's page position is fractional (the
      // 169.5 of a 900 px viewport), so the live mapping may be off by up to half a pixel of the extra scale; a pivot on the
      // stack's own corner would be off by originX x (k - 1), tens of pixels
      const snap = 0.5 * Math.abs(m.k - 1) + 0.01
      expect(Math.abs(got.left - (box.x + m.tx - m.k * surface.originX))).toBeLessThanOrEqual(snap)
      expect(Math.abs(got.top - (box.y + m.ty - m.k * surface.originY))).toBeLessThanOrEqual(snap)
      expect(got.width).toBeCloseTo(m.k * surface.width, 2)
      expect(got.height).toBeCloseTo(m.k * surface.height, 2)
      expect(got.origin).toBe(`${surface.originX}px ${surface.originY}px`)

      // the committed zoom follows (the burst commits when the wheel is idle), about the same point
      const overlay = page.locator(OVERLAY)
      await expect.poll(async () => Number(await overlay.getAttribute('data-zoom'))).toBeCloseTo(live.zoom, 9)
      expect(Number(await overlay.getAttribute('data-tx'))).toBeCloseTo(live.tx, 3)
      expect(Number(await overlay.getAttribute('data-ty'))).toBeCloseTo(live.ty, 3)

      // and a real wheel turn over the surface does the same, from the new committed view
      const before = await liveTransform(page)
      const next = await emptyPointOutsideWindow(page, scene)
      await page.mouse.move(next.x, next.y)
      await page.mouse.wheel(0, -240)
      await expect.poll(async () => Number(await overlay.getAttribute('data-zoom'))).toBeGreaterThan(before.zoom)
      expect(errors).toEqual([])
    })

    test('a middle-button drag pans and a rubber band selects, both started outside the window', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      await zoomInSteps(page, FILL_ZOOM_STEPS)
      const { frame, cssWidth, cssHeight, box } = await windowOf(page, scene)
      const t = await liveTransform(page)
      const overlay = page.locator(OVERLAY)

      // pan: the pure panBy gives the committed transform
      const start = await emptyPointOutsideWindow(page, scene)
      const dx = -40
      const dy = 24
      const panned = panBy(t, dx, dy, frame, cssWidth, cssHeight)
      expect(panned.tx).not.toBe(t.tx)
      await page.mouse.move(start.x, start.y)
      await page.mouse.down({ button: 'middle' })
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 })
      await page.mouse.up({ button: 'middle' })
      await expect.poll(async () => Number(await overlay.getAttribute('data-tx'))).toBeCloseTo(panned.tx, 3)
      expect(Number(await overlay.getAttribute('data-ty'))).toBeCloseTo(panned.ty, 3)

      // rubber band: a box around a zone outside the window, pressed on empty space outside the window
      const t2 = await liveTransform(page)
      const grid = buildZoneGrid(scene.x, scene.y, scene.nodeRadius)
      const half = 22
      const candidates = await zonesOutsideWindow(page, scene)
      let plan: { from: { x: number; y: number }; to: { x: number; y: number }; expected: number[] } | null = null
      for (const o of candidates) {
        const corners = [
          [o.x + half, o.y + half, o.x - half, o.y - half],
          [o.x - half, o.y + half, o.x + half, o.y - half],
          [o.x + half, o.y - half, o.x - half, o.y + half],
          [o.x - half, o.y - half, o.x + half, o.y + half],
        ] as const
        for (const [fx, fy, tx, ty] of corners) {
          const vpSize = await viewportOf(page)
          if (fx < 10 || fx > vpSize.width - 10 || fy < 10 || fy > vpSize.height - 10) continue
          const a = toWorld(t2, frame, cssWidth, cssHeight, fx - box.x, fy - box.y)
          const b = toWorld(t2, frame, cssWidth, cssHeight, tx - box.x, ty - box.y)
          if (pickAt(scene, grid, a.x, a.y, scaleOf(t2, frame, cssWidth, cssHeight), allowAllButGates) !== null) continue
          if (!(await reaches(page, fx, fy))) continue
          // no zone centre within 2 px of the band's edge (the inclusive rectangle rule is not under test)
          const lo = { x: Math.min(fx, tx), y: Math.min(fy, ty) }
          const hi = { x: Math.max(fx, tx), y: Math.max(fy, ty) }
          let clear = true
          for (let z = 0; z < scene.x.length && clear; z++) {
            const p = toScreen(t2, frame, cssWidth, cssHeight, at(scene.x, z), at(scene.y, z))
            const px = box.x + p.x
            const py = box.y + p.y
            const nearEdge = (v: number, e: number): boolean => Math.abs(v - e) < 2
            const inX = px > lo.x - 2 && px < hi.x + 2
            const inY = py > lo.y - 2 && py < hi.y + 2
            if (inX && inY && (nearEdge(px, lo.x) || nearEdge(px, hi.x) || nearEdge(py, lo.y) || nearEdge(py, hi.y))) clear = false
          }
          if (!clear) continue
          const expected = zonesInWorldRect(scene, a.x, a.y, b.x, b.y, allowAllButGates)
          if (!expected.includes(o.zone)) continue
          plan = { from: { x: fx, y: fy }, to: { x: tx, y: ty }, expected }
          break
        }
        if (plan !== null) break
      }
      if (plan === null) throw new Error('no band around a zone outside the window starts on empty space that reaches the overlay')
      console.log(`fills-viewport ${vp.name}: rubber band from (${plan.from.x}, ${plan.from.y}) to (${plan.to.x}, ${plan.to.y}) selects ${plan.expected.join(',')}`)
      await page.mouse.move(plan.from.x, plan.from.y)
      await page.mouse.down()
      await page.mouse.move((plan.from.x + plan.to.x) / 2, (plan.from.y + plan.to.y) / 2, { steps: 3 })
      await page.mouse.move(plan.to.x, plan.to.y, { steps: 3 })
      await page.mouse.up()
      await expect.poll(() => selectedZoneIds(page)).toEqual(plan.expected)
      expect(errors).toEqual([])
    })
  })
}

test.describe('the surface follows the window', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('resizing the viewport moves the window and the surface still covers it and the new viewport', async ({ page }) => {
    const errors = trackErrors(page)
    const scene = zoneScene(CANVAS_BASE)
    await openCanvas(page, `base=${CANVAS_BASE}`)
    await expect.poll(() => surfaceProblems(page, scene)).toEqual([])
    const before = await canvasBox(page)

    await page.setViewportSize({ width: 1400, height: 800 })
    await expect.poll(async () => (await canvasBox(page)).x, { message: 'the window re-centres' }).not.toBe(before.x)
    await expect.poll(() => surfaceProblems(page, scene)).toEqual([])
    await page.setViewportSize({ width: 1000, height: 700 })
    await expect.poll(() => surfaceProblems(page, scene)).toEqual([])
    expect(errors).toEqual([])
  })
})

// The backing store of the surface is bounded (five layers share the memory): a big viewport at a high device pixel ratio gets a lower
// ratio, a laptop keeps its own. The expected store is the pure surfaceStore of the surface surfaceOf gives, never the app's numbers.
test.describe('the paint surface backing store', () => {
  const storesOf = (page: Page): Promise<{ width: number; height: number; cssWidth: number; cssHeight: number }[]> =>
    page.locator(`${OVERLAY}, ${LAYER}`).evaluateAll(els =>
      els.map(e => ({ width: (e as HTMLCanvasElement).width, height: (e as HTMLCanvasElement).height, cssWidth: e.getBoundingClientRect().width, cssHeight: e.getBoundingClientRect().height })),
    )

  test.describe('Full HD at a device pixel ratio of 3', () => {
    test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 })

    test('every canvas is under the surface area limit and its ratio is lowered', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      const root = await canvasBox(page)
      const { cssWidth, cssHeight } = canvasFootprint(frameOf(scene), 1920, 1080)
      const expected = surfaceStore(surfaceOf(root.x, root.y, cssWidth, cssHeight, 1920, 1080), 3)
      expect(expected.dpr).toBeLessThan(3)
      await expect
        .poll(async () => (await storesOf(page)).map(s => [s.width, s.height]))
        .toEqual(Array.from({ length: 5 }, () => [expected.pixelWidth, expected.pixelHeight]))
      for (const s of await storesOf(page)) expect(s.width * s.height).toBeLessThanOrEqual(CANVAS_SURFACE_AREA_LIMIT_PX)
      console.log(`surface store 1920 x 1080 at dpr 3: ${expected.pixelWidth} x ${expected.pixelHeight} px per layer (dpr ${expected.dpr.toFixed(4)}), limit ${CANVAS_SURFACE_AREA_LIMIT_PX}`)
      expect(errors).toEqual([])
    })
  })

  test.describe('a 1280 x 800 laptop at a device pixel ratio of 2', () => {
    test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })

    test('keeps its ratio of 2', async ({ page }) => {
      const errors = trackErrors(page)
      const scene = zoneScene(CANVAS_BASE)
      await openCanvas(page, `base=${CANVAS_BASE}`)
      const root = await canvasBox(page)
      const { cssWidth, cssHeight } = canvasFootprint(frameOf(scene), 1280, 800)
      const expected = surfaceStore(surfaceOf(root.x, root.y, cssWidth, cssHeight, 1280, 800), 2)
      expect(expected).toEqual({ dpr: 2, pixelWidth: 2560, pixelHeight: 1600 })
      await expect
        .poll(async () => (await storesOf(page)).map(s => [s.width, s.height]))
        .toEqual(Array.from({ length: 5 }, () => [2560, 1600]))
      expect(errors).toEqual([])
    })
  })
})
