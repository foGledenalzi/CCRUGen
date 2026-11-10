import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  buildZoneScene, createNumogram, DEFAULT_LAYOUT_PARAMS, resolveLayout, routeCurrents, routeGates, splitGraphemes, type CanvasScene,
} from '../engine/index'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../app/lib/labelScheme'
import { NAMES_COPY, zoneSoundAria } from '../app/lib/namingCopy'
import { regionLabel, regionOfZone } from '../app/lib/regions'
import { fitSoundLabel } from '../app/lib/soundLabels'
import { INTERACTIVE_MAX_N, LABEL_MIN_RADIUS_PX, SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { layoutTarget } from '../app/lib/viewLayouts'
import { IDENTITY_TRANSFORM, ZOOM_MIN, ZOOM_STEP, canvasFootprint, onScreenRadius } from '../app/lib/canvas/viewTransform'
import { LABEL_SIZE, NODE_RADIUS } from '../app/presets/base10/layout-tables'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { CANVAS_READY, SUMMARY, openCanvas, openFor, openHeadless, openViewer, panel, radioLabel } from './viewer-helpers'
import { defaultResolver, openNames, soundField } from './names-helpers'

// Plan 07-22's proof of the sounds label mode (D-03) in Chromium, on both diagram tiers: the Sounds radio draws each zone's sound in the
// node label slot fitted to the node (the shared fitSoundLabel rule, with the full sound in data-sound-label and data-truncated when
// cut), keeps numerals on the pair graph and planetary layouts and at bases without a sound table, names the zone with its full sound
// for assistive technology, and round-trips through the URL. The Canvas tier is checked through what it says (the keyboard announcement
// and the painted text, recorded at fillText) because its labels are pixels. Expected sounds come from the CCRU preset module or the
// engine's default naming of the base, expected fits from fitSoundLabel, and geometry from the layout the engine computes; bases come from
// the tier table, never typed.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the tier table sends to the Canvas tier
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
const ZWSP = String.fromCodePoint(0x200b) // the live region appends one so a repeated announcement is a change
const ELLIPSIS = String.fromCodePoint(0x2026)
const SOUND_TEXT = '[data-sound-label]'

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const label = (zone: number, base: number): string => formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME)
const toolbar = (page: Page): Locator => page.locator('[role="toolbar"][aria-label="Diagram view"]')

async function openDropdown(page: Page): Promise<void> {
  await page.getByLabel('Base', { exact: true }).click()
}

/** The node label of a zone on the SVG tier in sounds mode. */
const soundLabel = (page: Page, zone: number): Locator => page.locator(`[data-zone="${zone}"] ${SOUND_TEXT}`)

/** CSS px per SVG world unit as drawn right now: the zoomed rendered width of the diagram over its viewBox width. */
async function pxPerUnit(page: Page): Promise<number> {
  const svg = page.locator('svg[data-diagram="zones"]')
  const box = await svg.boundingBox()
  const viewBox = await svg.getAttribute('viewBox')
  const width = Number((viewBox ?? '').split(/\s+/)[2])
  if (box === null || !(width > 0)) throw new Error('the zone diagram has no box or no viewBox')
  return box.width / width
}

/**
 * Checks one zone's label on the SVG tier against the fit rule: the cut flag, the drawn text and the font size (in CSS px, 0.5 px
 * tolerance) are what fitSoundLabel gives for the zone's sound at this node radius and layout label size (both in world units).
 */
async function expectFitted(
  page: Page, zone: number, sound: string, nodeRadius: number, labelSize: number, ppu: number,
): Promise<{ readonly text: string; readonly fontPx: number; readonly truncated: boolean }> {
  const fit = fitSoundLabel(sound, nodeRadius * ppu, labelSize * ppu)
  const node = soundLabel(page, zone)
  await expect(node, `zone ${zone} keeps the full sound`).toHaveAttribute('data-sound-label', sound)
  await expect(node, `zone ${zone} text`).toHaveText(fit.text)
  if (fit.truncated) await expect(node, `zone ${zone} is cut`).toHaveAttribute('data-truncated', 'true')
  else await expect(node, `zone ${zone} is whole`).not.toHaveAttribute('data-truncated', /.*/)
  const size = Number(await node.getAttribute('font-size'))
  expect(Math.abs(size * ppu - fit.fontPx), `zone ${zone} font ${size * ppu}px vs ${fit.fontPx}px`).toBeLessThan(0.5)
  return fit
}

// ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('base 10 original: the Sounds radio draws the preset sounds fitted to their nodes and round-trips the URL', async ({ page }) => {
  const errors = trackErrors(page)
  const sounds = CCRU_NAMING_PRESET.sounds
  await openViewer(page)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(0)

  await openDropdown(page)
  await radioLabel(page, 'Sounds').click()
  await expect(page).toHaveURL(/labels=sounds/)
  await expect(page.getByText(NAMES_COPY.soundsNote)).toBeVisible()
  await expect(page.locator('input[name="ccrug-labels"]').nth(2)).toBeChecked()

  // every zone of the original layout shows its own sound, drawn at the size the shared fit rule gives
  await expect(page.locator(SOUND_TEXT)).toHaveCount(CCRU_NAMING_PRESET.base)
  const ppu = await pxPerUnit(page)
  expect(Math.abs(ppu - 580 / 800), 'the 580 px column over the 800 unit frame').toBeLessThan(0.001)
  const fits: Array<{ truncated: boolean; fontPx: number }> = []
  for (let zone = 0; zone < CCRU_NAMING_PRESET.base; zone++) {
    fits.push(await expectFitted(page, zone, sounds[zone] as string, NODE_RADIUS, LABEL_SIZE, ppu))
  }
  // the fixture shows both cases: zone 0's long sound shrinks below the layout size, zone 1's short one keeps it
  expect(fits[0]?.fontPx).toBeLessThan(LABEL_SIZE * ppu - 1)
  expect(fits[1]?.fontPx).toBeCloseTo(LABEL_SIZE * ppu, 6)
  await expect(soundLabel(page, 1)).toHaveAttribute('font-size', String(LABEL_SIZE))

  // the zone's accessible name holds the full sound and the digits
  const region = regionLabel(regionOfZone(createNumogram(10), 0))
  await expect(page.locator('[data-zone="0"]').first()).toHaveAttribute('aria-label', zoneSoundAria(label(0, 10), sounds[0] as string, region, false))
  await expect(page.locator('[data-zone="0"]').first()).toHaveAttribute('aria-label', new RegExp('^Zone 0, sound '))

  // the Labels panel row that hid the numerals now says Sounds
  await expect(panel(page, 'Labels')).toContainText(NAMES_COPY.labelsRowSounds)
  await expect(panel(page, 'Labels')).not.toContainText('Numbers')

  // the mode survives a reload through the address
  await page.reload()
  await page.waitForSelector('[data-diagram="zones"] [data-zone]')
  await expect(page).toHaveURL(/labels=sounds/)
  await expect(soundLabel(page, 0)).toHaveAttribute('data-sound-label', sounds[0] as string)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(CCRU_NAMING_PRESET.base)

  // back to Digits: the numerals return and the address drops the parameter
  await openDropdown(page)
  await radioLabel(page, 'Digits').click()
  await expect(page).not.toHaveURL(/labels=/)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(0)
  await expect(panel(page, 'Labels')).toContainText('Numbers')
  await expect(page.getByText(NAMES_COPY.soundsNote)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('base 10 original: the fit follows the zoom, and preset layouts keep drawing at the smallest zoom', async ({ page }) => {
  const errors = trackErrors(page)
  const sounds = CCRU_NAMING_PRESET.sounds
  await openViewer(page, 'labels=sounds')
  const fitAt = async (zoomText: string): Promise<void> => {
    await expect(toolbar(page)).toContainText(zoomText)
    const ppu = await pxPerUnit(page)
    for (const zone of [0, 1, 2, 3]) await expectFitted(page, zone, sounds[zone] as string, NODE_RADIUS, LABEL_SIZE, ppu)
  }
  await fitAt('100%')

  // zooming in raises the node radius on screen: the long sound grows with it until it is shown whole
  const zoomIn = page.locator('button[aria-label="Zoom in"]')
  let zoom = 1
  for (let step = 0; step < 5; step++) {
    await zoomIn.click()
    zoom *= ZOOM_STEP
  }
  await fitAt(`${Math.round(zoom * 100)}%`)

  // zooming out to the floor: R_px falls to about 4.6, below the label threshold, and the preset layout still draws every label
  expect(NODE_RADIUS * (580 / 800) * ZOOM_MIN).toBeLessThan(LABEL_MIN_RADIUS_PX)
  const zoomOut = page.locator('button[aria-label="Zoom out"]')
  for (let step = 0; step < 12; step++) await zoomOut.click()
  await fitAt(`${Math.round(ZOOM_MIN * 100)}%`)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(CCRU_NAMING_PRESET.base)
  // at this size the long sounds are cut at a grapheme boundary and say so
  const ppu = await pxPerUnit(page)
  const cut = fitSoundLabel(sounds[0] as string, NODE_RADIUS * ppu, LABEL_SIZE * ppu)
  expect(cut.truncated).toBe(true)
  await expect(soundLabel(page, 0)).toHaveAttribute('data-truncated', 'true')
  expect(errors).toEqual([])
})

// ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

for (const layout of ['pairGraph', 'planetary']) {
  test(`the ${layout} layout keeps numerals in sounds mode and the note says so`, async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page, `labels=sounds&layout=${layout}`)
    await expect(page.locator('[data-diagram]')).toBeVisible()
    await expect(page.locator(SOUND_TEXT)).toHaveCount(0)
    await expect(page).toHaveURL(/labels=sounds/)
    await openDropdown(page)
    await expect(page.getByText(NAMES_COPY.numeralsNote)).toBeVisible()
    await expect(page.getByText(NAMES_COPY.soundsNote)).toHaveCount(0)
    // the zone names keep their numeral wording too (the pair graph has no zone nodes, only pair pills)
    if (layout === 'planetary') await expect(page.locator('[data-zone="0"]').first()).not.toHaveAttribute('aria-label', /sound/)
    expect(errors).toEqual([])
  })
}

// ── 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('base 28: every label is fitted by the shared rule and a typed 16-letter sound is cut with the full sound kept', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 28
  const naming = defaultResolver(base)
  const target = layoutTarget(createNumogram(base), 'ring', 'shelf', {})
  await openViewer(page, `base=${base}&layout=ring&labels=sounds`)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(base)
  const ppu = await pxPerUnit(page)
  expect(Math.abs(ppu - 580 / target.width), 'the column over the layout frame').toBeLessThan(0.001)

  for (let zone = 0; zone < base; zone++) {
    await expectFitted(page, zone, naming.soundOf(zone), target.nodeRadius, target.labelSize, ppu)
  }

  // a 16-letter sound typed into the Names panel: too long for any node at this size, so it is cut, and the name keeps all of it
  const long = 'abcdefghijklmnop'
  expect(splitGraphemes(long)).toHaveLength(16)
  await openNames(page)
  await soundField(page, 5).fill(long)
  await soundField(page, 5).press('Enter')
  const fit = await expectFitted(page, 5, long, target.nodeRadius, target.labelSize, ppu)
  expect(fit.truncated).toBe(true)
  expect(fit.text.endsWith(ELLIPSIS)).toBe(true)
  expect(long.startsWith(fit.text.slice(0, -1))).toBe(true)
  await expect(soundLabel(page, 5)).toHaveAttribute('data-truncated', 'true')
  const region = regionLabel(regionOfZone(createNumogram(base), 5))
  await expect(page.locator('[data-zone="5"]').first()).toHaveAttribute('aria-label', zoneSoundAria(label(5, base), long, region, false))
  // no other zone changed
  await expectFitted(page, 4, naming.soundOf(4), target.nodeRadius, target.labelSize, ppu)
  expect(errors).toEqual([])
})

// ── 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type ZoneLayoutId = 'ring' | 'ladder' | 'spiral'
function zoneScene(base: number, layout: ZoneLayoutId = 'ring'): CanvasScene {
  const g = createNumogram(base)
  const resolved = resolveLayout(g, layout, [], { packer: DEFAULT_LAYOUT_PARAMS.packer })
  return buildZoneScene(g, resolved, routeGates(g, resolved), routeCurrents(g, resolved))
}

const OVERLAY = 'canvas[data-diagram]'

/** Presses Tab until the overlay canvas (role="application") is the active element. */
async function tabToCanvas(page: Page, maxPresses = 150): Promise<void> {
  for (let i = 1; i <= maxPresses; i++) {
    await page.keyboard.press('Tab')
    const onCanvas = await page.evaluate(() => {
      const el = document.activeElement
      return el instanceof HTMLCanvasElement && el.getAttribute('role') === 'application'
    })
    if (onCanvas) return
  }
  throw new Error(`the canvas was not reached within ${maxPresses} Tab presses`)
}

/** What the canvas says for the focused target: the live region's text without its zero-width suffix. */
async function announced(page: Page): Promise<string> {
  return ((await page.locator('[data-canvas-live]').textContent()) ?? '').split(ZWSP).join('')
}

/** Moves the canvas keyboard ring onto zone 1 and checks what is announced, against the sound mode the page is in. */
async function expectZoneOneAnnounced(page: Page, base: number, sound: string | null): Promise<void> {
  await tabToCanvas(page)
  // the ring may be wherever the last visit left it: Home puts it on the first zone, the next arrow on zone 1
  await page.keyboard.press('Home')
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', 'zone:0')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(OVERLAY)).toHaveAttribute('data-focus-key', 'zone:1')
  const region = regionLabel(regionOfZone(createNumogram(base), 1))
  const expected = sound === null ? `Zone ${label(1, base)}, ${region}` : zoneSoundAria(label(1, base), sound, region, false)
  await expect.poll(() => announced(page)).toBe(expected)
  await expect(page.locator('[data-canvas-callout]')).toHaveText(expected)
}

test('Canvas base: a sounds link is built by the worker and the keyboard announcement names the zone by its sound', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 666
  const resolver = defaultResolver(base)
  await openCanvas(page, `base=${base}&labels=sounds`)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(base))
  await expect(page).toHaveURL(/labels=sounds/)
  await expectZoneOneAnnounced(page, base, resolver.soundOf(1))
  expect(await announced(page)).toContain(`, sound ${resolver.soundOf(1)}`)
  expect(errors).toEqual([])
})

test('Canvas base: choosing Sounds in the picker is accepted by the worker (no revert) and Digits brings the numerals back', async ({ page }) => {
  const errors = trackErrors(page)
  const base = 666
  const resolver = defaultResolver(base)
  await openCanvas(page, `base=${base}`)
  await expect(page).not.toHaveURL(/labels=/)

  await openDropdown(page)
  await radioLabel(page, 'Sounds').click()
  // the build for the new label scheme finishes, the page stays on the same base and the mode is not reverted
  await expect(page).toHaveURL(/labels=sounds/)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(base))
  await expect(page.locator('input[name="ccrug-labels"]').nth(2)).toBeChecked()
  await expectZoneOneAnnounced(page, base, resolver.soundOf(1))

  await openDropdown(page)
  await radioLabel(page, 'Digits').click()
  await expect(page).not.toHaveURL(/labels=/)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(base))
  await expectZoneOneAnnounced(page, base, null)
  expect(await announced(page)).not.toContain('sound')
  expect(errors).toEqual([])
})

test('Canvas base: sounds are painted only once a node is large enough, and numerals are not painted in their place', async ({ page }) => {
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

  const base = 666
  const resolver = defaultResolver(base)
  const numerals = new Set(Array.from({ length: base }, (_, z) => label(z, base)))
  // everything a fitted sound can be drawn as: the whole sound, or a whole-grapheme prefix of it with the ellipsis
  const painted = new Set<string>()
  for (let z = 0; z < base; z++) {
    const graphemes = splitGraphemes(resolver.soundOf(z))
    painted.add(graphemes.join(''))
    for (let kept = 1; kept < graphemes.length; kept++) painted.add(graphemes.slice(0, kept).join('') + ELLIPSIS)
  }
  const recorded = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __fillTexts: string[] }).__fillTexts.slice())
  const soundTexts = async (): Promise<string[]> => (await recorded()).filter(t => painted.has(t))

  await openCanvas(page, `base=${base}&labels=sounds`)
  const scene = zoneScene(base)
  const frame = { width: scene.width, height: scene.height, nodeRadius: scene.nodeRadius }
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport size')
  const { cssWidth, cssHeight } = canvasFootprint(frame, viewport.width, viewport.height)
  const fitRadius = onScreenRadius(IDENTITY_TRANSFORM, frame, cssWidth, cssHeight)
  expect(fitRadius, 'the fitted node radius is below the label threshold at this base').toBeLessThan(LABEL_MIN_RADIUS_PX)
  expect(await soundTexts()).toEqual([])
  expect((await recorded()).filter(t => numerals.has(t))).toEqual([])

  // wheel-zoom about the canvas centre until the node radius reaches the threshold
  const box = await page.locator(CANVAS_READY).boundingBox()
  if (box === null) throw new Error('the canvas wrapper has no bounding box')
  const needed = LABEL_MIN_RADIUS_PX / fitRadius
  await page.evaluate(() => {
    ;(window as unknown as { __fillTexts: string[] }).__fillTexts = []
  })
  await page.mouse.move(box.x + cssWidth / 2, box.y + cssHeight / 2)
  const wheels = Math.ceil(Math.log(needed * 1.1) / 0.15) + 1 // exp(100 x 0.0015) = 1.1618 per wheel step
  for (let i = 0; i < wheels; i++) await page.mouse.wheel(0, -100)
  await expect.poll(async () => Number(await page.locator(OVERLAY).getAttribute('data-zoom')), { timeout: 15_000 }).toBeGreaterThanOrEqual(needed)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-canvas-state', 'ready')
  await expect.poll(async () => (await soundTexts()).length, { timeout: 15_000 }).toBeGreaterThan(0)
  // the sounds replaced the numerals in the label slot
  expect((await recorded()).filter(t => numerals.has(t))).toEqual([])
  expect(errors).toEqual([])
})

// ── 5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a base above the ceiling keeps labels=sounds in the address and draws no sounds', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await openFor(page, SEED_ONLY_BASE, 'labels=sounds')
  await expect(page.locator(SUMMARY)).toBeVisible()
  await expect(page.locator('[data-diagram]')).toHaveCount(0)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('labels')).toBe('sounds')
  expect(new URL(page.url()).searchParams.get('base')).toBe(String(SEED_ONLY_BASE))
  expect(errors).toEqual([])
})

// The Canvas override cannot lift the ceiling either (the tier is clamped by the base), so there is no diagram at all in which a sound
// could be drawn: the summary stays and the mode stays in the address.
test('a Canvas tier override cannot draw sounds above the ceiling', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await openHeadless(page, `base=${SEED_ONLY_BASE}&labels=sounds&tier=canvas`)
  await expect(page.locator(SUMMARY)).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.locator(SOUND_TEXT)).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('labels')).toBe('sounds')
  expect(errors).toEqual([])
})

// ── 6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

for (const base of [10, 28]) {
  test(`Digits mode at base ${base} renders no sound label anywhere and no sounds note`, async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page, `base=${base}`)
    await expect(page.locator('[data-zone]').first()).toBeVisible()
    await expect(page.locator(SOUND_TEXT)).toHaveCount(0)
    await expect(page.locator('[data-truncated]')).toHaveCount(0)
    await openDropdown(page)
    await expect(page.getByText(NAMES_COPY.soundsNote)).toHaveCount(0)
    await expect(page.getByText(NAMES_COPY.numeralsNote)).toHaveCount(0)
    await expect(page.locator('input[name="ccrug-labels"]').first()).toBeChecked()
    await expect(page.locator('[data-zone="0"]').first()).not.toHaveAttribute('aria-label', /sound/)
    expect(errors).toEqual([])
  })
}
