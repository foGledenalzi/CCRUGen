import { test, expect, type Page } from '@playwright/test'
import { openViewer, panel } from './viewer-helpers'
import type { Locator } from '@playwright/test'
import { NAMES_BODY_MIN, NAMES_PANEL_WIDTH, namesBodyMax, namesX } from '../app/lib/panelStack'
import { INTERACTIVE_MAX_N, SVG_RICH_MAX_N, tierFor } from '../app/lib/tierBounds'
import { openFor, selectionHeading } from './viewer-helpers'
import { openDemons } from './demons-helpers'
import { closeDemons, namesBody, namesBox, namesScroll, openNames, settleAnimations } from './names-helpers'

// Phase 7 plan 07-07, the live desktop panel stack (07-UI-SPEC "Desktop Panel Stack Rule"): every panel the user has not dragged
// sits at the previous panel's measured bottom + 18 in its column and follows any height change (a base change, a collapse). At
// base 10 the placement is exactly what the one-shot layout effect used to produce. A dragged panel never jumps on the first
// move, keeps the position it was dropped at and its slot stays reserved. No panel's z-index passes 69, so the zoom toolbar (74)
// stays on top. Expected values are literals (the contract), never read back from app/lib/panelStack.ts.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const LEFT = ['Layers', 'Labels', 'Zones', 'Syzygies'] as const
const RIGHT = ['Regions', 'Currents', 'Gates', 'Text'] as const
const ALL = [...LEFT, ...RIGHT, 'Selection'] as const
const GAP = 18
const BASE_Y = 64
const LEFT_X = 12
const RIGHT_X = 216
const SLOT_TOLERANCE = 1.01 // each y is Math.round of an unrounded chain: previous top + previous height + 18 holds within 1 px

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, title: string): Promise<Box> {
  const b = await panel(page, title).boundingBox()
  if (!b) throw new Error(`panel ${title} has no bounding box`)
  return b
}

async function allBoxes(page: Page): Promise<Record<string, Box>> {
  const out: Record<string, Box> = {}
  for (const t of ALL) out[t] = await box(page, t)
  return out
}

/** Every way the nine panels break the stack rule right now (an empty list is a correct layout). */
async function layoutViolations(page: Page): Promise<string[]> {
  const vw = page.viewportSize()?.width ?? 0
  const b = await allBoxes(page)
  const bad: string[] = []
  const near = (what: string, got: number, want: number, tol = SLOT_TOLERANCE) => {
    if (Math.abs(got - want) > tol) bad.push(`${what}: ${got} (wanted ${want})`)
  }
  for (const [col, x] of [[LEFT, LEFT_X], [RIGHT, RIGHT_X]] as const) {
    near(`${col[0]} top`, b[col[0]].y, BASE_Y)
    for (let i = 0; i < col.length; i++) {
      near(`${col[i]} left`, b[col[i]].x, x, 0.01)
      near(`${col[i]} width`, b[col[i]].width, col[i] === 'Text' ? 320 : 180, 0.01)
      if (i > 0) near(`${col[i]} top (below ${col[i - 1]})`, b[col[i]].y, b[col[i - 1]].y + b[col[i - 1]].height + GAP)
    }
  }
  near('Selection top', b.Selection.y, BASE_Y)
  near('Selection width', b.Selection.width, 320, 0.01)
  if (b.Selection.x < 12 - 0.01 || b.Selection.x + b.Selection.width > vw - 12 + 0.01) bad.push(`Selection x ${b.Selection.x} leaves the window`)
  for (let i = 0; i < ALL.length; i++) {
    for (let j = i + 1; j < ALL.length; j++) {
      const p = b[ALL[i]]
      const q = b[ALL[j]]
      const w = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x)
      const h = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y)
      if (w > 0.5 && h > 0.5) bad.push(`${ALL[i]} and ${ALL[j]} overlap by ${w.toFixed(1)} x ${h.toFixed(1)} px`)
    }
  }
  return bad
}

async function styleOf(page: Page, title: string): Promise<{ left: number; top: number }> {
  return panel(page, title).evaluate((e: HTMLElement) => ({ left: parseFloat(e.style.left), top: parseFloat(e.style.top) }))
}

/** An integer point inside the panel's header title (any point of the header starts a drag). */
async function headerPoint(page: Page, title: string): Promise<{ x: number; y: number }> {
  const b = await panel(page, title).locator('header span').first().boundingBox()
  if (!b) throw new Error(`panel ${title} has no header box`)
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
}

function toggle(page: Page, title: string, verb: 'Collapse' | 'Expand') {
  return panel(page, title).getByRole('button', { name: `${verb} ${title}`, exact: true })
}

/** Wait until the panel's height satisfies `ok` and has stopped changing (the body animates for 200 ms), then return it. */
async function settledHeight(page: Page, title: string, ok: (h: number) => boolean): Promise<number> {
  let previous = -1
  await expect
    .poll(async () => {
      const h = (await box(page, title)).height
      const stable = h === previous && ok(h)
      previous = h
      return stable
    }, { intervals: [120], timeout: 10_000 })
    .toBe(true)
  return previous
}

for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768]] as const) {
  test(`base 10 at ${w}x${h}: first tops 64, lefts 12 and 216, each panel under the previous one + 18`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: w, height: h })
    await openViewer(page)
    // the pre-measure positions (Labels 206, Currents 258, ...) violate the rule, so this only passes once the stack is derived
    await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])
    expect(errors).toEqual([])
  })
}

test('base 10 keeps today\'s exact placement (the tops the one-shot effect produced) at 1280x900', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openViewer(page)
  const expected: Record<string, { x: number; y: number }> = {
    Layers: { x: 12, y: 64 }, Labels: { x: 12, y: 228 }, Zones: { x: 12, y: 347 }, Syzygies: { x: 12, y: 635 },
    Regions: { x: 216, y: 64 }, Currents: { x: 216, y: 227 }, Gates: { x: 216, y: 388 }, Text: { x: 216, y: 676 },
    Selection: { x: 942, y: 64 },
  }
  await expect
    .poll(async () => {
      const got: Record<string, { x: number; y: number }> = {}
      for (const t of ALL) {
        const b = await box(page, t)
        got[t] = { x: b.x, y: b.y }
      }
      return got
    }, { timeout: 10_000 })
    .toEqual(expected)
})

test('todo 008 trigger: base 10, then 28 through the picker, leaves every panel stacked and none overlapping (1280x800)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])
  const regionsBefore = await box(page, 'Regions')

  const base = page.getByLabel('Base', { exact: true })
  await base.click()
  await base.fill('28')
  await base.press('Enter')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)

  // base 28's Regions panel is taller than base 10's, which is what used to push its lower rows under the Currents header
  await expect.poll(async () => (await box(page, 'Regions')).height, { timeout: 10_000 }).toBeGreaterThan(regionsBefore.height + 20)
  await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])
  const regions = await box(page, 'Regions')
  const currents = await box(page, 'Currents')
  expect(currents.y).toBeGreaterThanOrEqual(regions.y + regions.height + GAP - 1)
  expect(errors).toEqual([])
})

for (const [dragged, below, collapser] of [['Labels', 'Zones', 'Layers'], ['Currents', 'Gates', 'Regions']] as const) {
  test(`drag ${dragged}: no jump on mouse down, exact mouse delta, slot stays reserved, panel keeps its place when ${collapser} collapses`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openViewer(page)
    await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])

    const start = await styleOf(page, dragged)
    const belowTop = (await box(page, below)).y
    const grab = await headerPoint(page, dragged)

    // mouse down and mouse up without a move: nothing moves (the stored position is not where a derived panel is drawn)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.up()
    expect(await styleOf(page, dragged)).toEqual(start)

    // the first move is 5 px: the panel follows the mouse exactly (it does not jump to its stored position first)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 5, grab.y + 5)
    const afterFive = await styleOf(page, dragged)
    expect(afterFive.left).toBeCloseTo(start.left + 5, 3)
    expect(afterFive.top).toBeCloseTo(start.top + 5, 3)
    await page.mouse.move(grab.x + 60, grab.y + 40, { steps: 6 })
    await page.mouse.up()
    const dropped = await styleOf(page, dragged)
    expect(dropped.left).toBeCloseTo(start.left + 60, 3)
    expect(dropped.top).toBeCloseTo(start.top + 40, 3)
    // the slot stays reserved: the panel below does not rise into the gap the dragged panel left
    expect((await box(page, below)).y).toBeCloseTo(belowTop, 3)

    // collapsing the panel above: the dragged panel keeps its place, the undragged one below follows the shorter stack
    const collapserHeight = (await box(page, collapser)).height
    await toggle(page, collapser, 'Collapse').click()
    const collapsedHeight = await settledHeight(page, collapser, h => h < collapserHeight - 50)
    await expect
      .poll(async () => Math.abs((await box(page, below)).y - (belowTop - (collapserHeight - collapsedHeight))), { timeout: 10_000 })
      .toBeLessThanOrEqual(1)
    expect(await styleOf(page, dragged)).toEqual(dropped)
    expect(errors).toEqual([])
  })
}

test('collapse and expand Layers: Labels, Zones and Syzygies follow the height change and come back (1280x800)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])

  const followers = ['Labels', 'Zones', 'Syzygies'] as const
  const tops = async () => Object.fromEntries(await Promise.all(followers.map(async t => [t, (await box(page, t)).y]))) as Record<(typeof followers)[number], number>
  const topsBefore = await tops()
  const layersOpen = (await box(page, 'Layers')).height

  await toggle(page, 'Layers', 'Collapse').click()
  const layersClosed = await settledHeight(page, 'Layers', h => h < layersOpen - 50)
  for (const t of followers) {
    await expect
      .poll(async () => Math.abs((await box(page, t)).y - (topsBefore[t] - (layersOpen - layersClosed))), { timeout: 10_000 })
      .toBeLessThanOrEqual(1)
  }
  await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])

  await toggle(page, 'Layers', 'Expand').click()
  await settledHeight(page, 'Layers', h => h > layersClosed + 50)
  for (const t of followers) {
    await expect
      .poll(async () => Math.abs((await box(page, t)).y - topsBefore[t]), { timeout: 10_000 })
      .toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
})

test('z cap: 80 header presses never push a panel above 69, the last pressed panel is on top and the zoom toolbar (74) stays above all', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await expect.poll(() => layoutViolations(page), { timeout: 10_000 }).toEqual([])

  const points = await Promise.all(ALL.map(t => headerPoint(page, t)))
  const zOf = async (title: string) => Number(await panel(page, title).evaluate((e: HTMLElement) => e.style.zIndex))
  const allZ = async () => Object.fromEntries(await Promise.all(ALL.map(async t => [t, await zOf(t)]))) as Record<(typeof ALL)[number], number>

  for (let i = 0; i < 80; i++) {
    const p = points[i % ALL.length]
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.up()
    if (i % 10 === 9) {
      for (const z of Object.values(await allZ())) expect(z).toBeLessThanOrEqual(69)
    }
  }

  const z = await allZ()
  for (const value of Object.values(z)) {
    expect(value).toBeLessThanOrEqual(69)
    expect(value).toBeGreaterThanOrEqual(40)
  }
  const last = ALL[79 % ALL.length]
  for (const t of ALL) if (t !== last) expect(z[last], `${last} above ${t}`).toBeGreaterThan(z[t])
  const toolbarZ = Number(await page.locator('[role="toolbar"][aria-label="Diagram view"]').evaluate(el => getComputedStyle(el).zIndex))
  expect(toolbarZ).toBe(74)
  for (const value of Object.values(z)) expect(toolbarZ).toBeGreaterThan(value)
  expect(errors).toEqual([])
})

// ===== Phase 7 plan 07-24: the Names panel in both stacks (07-UI-SPEC "Desktop Panel Stack Rule", "Narrow Windows and Touch", Verification Hooks) =====
//
// Everything above this line is the 07-07 proof of the nine-panel stack and is unchanged. What follows proves the tenth panel, Names, in
// the two stacks: no two of the ten panel boxes intersect at every UI-SPEC viewport, base and state; Names sits at its slot (under
// Selection on desktop, first at y 64 on mobile) and keeps its open box above the zoom toolbar and the shortcuts button; nothing
// overflows or is too small to tap at phone widths; the planetary controls stay clear; a drag never jumps and the z cap holds.
//
// Where the expectation is a number the UI-SPEC states (240 wide, x floor 548, 12 px edge gap, 96 px bottom reserve, 80 px minimum
// body, 560 maximum, the 18 px and 6 px gaps) it is written here as a literal, so a changed constant in app/lib/panelStack.ts is caught;
// the pure model's own functions (namesX, namesBodyMax) are checked against the measured page as well, so the two cannot drift apart.
// Panels are measured only after the 200 ms collapse transition has finished and the boxes have stopped changing (never a fixed sleep).

const NAMES_W = 240
const NAMES_X_FLOOR = 548 // 216 + 320 (the Text panel's open box) + 12
const EDGE_GAP = 12
const BOTTOM_RESERVE = 96
const BODY_MIN = 80
const BODY_MAX = 560
const HEADER_ALLOWANCE = 34 // the header height the body-room formula assumes
const SCROLL_INSET = 12 // the one scroller is this much shorter than the room handed to CyberPanel, so the panel wrapper never scrolls
const SHORT_WINDOW = 742 // below this height, with Selection at its cap, an open Names box may reach into the reserve band
const MOBILE_X = 8
const MOBILE_GAP = 6
const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the tier table sends to the Canvas tier
const TEN = [...ALL, 'Names'] as const
const MOBILE_ORDER = ['Names', 'Layers', 'Labels', 'Zones', 'Regions', 'Syzygies', 'Currents', 'Gates', 'Text', 'Selection'] as const
const TOOLBAR = '[role="toolbar"][aria-label="Diagram view"]'

/** Names x on the desktop stack: under Selection, never left of 548 and never closer than 12 px to the right edge. */
const contractNamesX = (selectionX: number, vw: number): number => Math.min(Math.max(selectionX, NAMES_X_FLOOR), vw - NAMES_W - EDGE_GAP)
/** The open Names body room: clamp(80, vh - (y + 34) - 96, 560). */
const contractBodyMax = (y: number, vh: number): number => Math.min(Math.max(vh - (y + HEADER_ALLOWANCE) - BOTTOM_RESERVE, BODY_MIN), BODY_MAX)
/** `selected=0,1,...,count-1` */
const selectedQuery = (count: number): string => `selected=${Array.from({ length: count }, (_, i) => i).join(',')}`

type Boxes = Record<string, Box>

const rectOf = async (locator: Locator, what: string): Promise<Box> => {
  const b = await locator.boundingBox()
  if (!b) throw new Error(`${what} has no bounding box`)
  return b
}
const toolbarOf = (page: Page): Locator => page.locator(TOOLBAR)
const shortcutsOf = (page: Page): Locator => page.getByRole('button', { name: 'shortcuts', exact: true })
/** The CyberPanel wrapper of Names: the parent of the panel's content root, the element whose max-height is the body room. */
const namesWrapper = (page: Page): Locator => namesBody(page).locator('xpath=..')

async function tenBoxes(page: Page): Promise<Boxes> {
  return { ...(await allBoxes(page)), Names: await rectOf(namesBox(page), 'the Names panel') }
}

/** The ten panel boxes once they have stopped changing: animations finished, then three equal samples in a row. */
async function settledTen(page: Page): Promise<Boxes> {
  await settleAnimations(page)
  let previous = ''
  let equal = 0
  let latest: Boxes = {}
  await expect
    .poll(async () => {
      latest = await tenBoxes(page)
      const now = JSON.stringify(latest)
      equal = now === previous ? equal + 1 : 0
      previous = now
      return equal >= 2
    }, { intervals: [100], timeout: 15_000 })
    .toBe(true)
  return latest
}

function crossing(p: Box, q: Box): { w: number; h: number; box: Box } | null {
  const w = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x)
  const h = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y)
  return w > 0.5 && h > 0.5 ? { w, h, box: { x: Math.max(p.x, q.x), y: Math.max(p.y, q.y), width: w, height: h } } : null
}

function overlapsAmong(b: Boxes, titles: readonly string[]): string[] {
  const bad: string[] = []
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const c = crossing(b[titles[i]], b[titles[j]])
      if (c) bad.push(`${titles[i]} and ${titles[j]} overlap by ${c.w.toFixed(1)} x ${c.h.toFixed(1)} px`)
    }
  }
  return bad
}

/**
 * True when the topmost element at the centre of `area` (default: the element's own box) is the element itself or one of its
 * descendants, i.e. nothing covers it there. Passing the part of its box another panel overlaps tests that very part.
 */
async function reachable(locator: Locator, area: Box | null = null): Promise<boolean> {
  return locator.evaluate((el: Element, within: Box | null) => {
    const r = within ?? el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return hit !== null && el.contains(hit)
  }, area)
}

/** What the open Names box must clear: the zoom toolbar and the shortcuts button (boxes), and both must stay clickable. */
async function clearanceViolations(page: Page, names: Box, strict: boolean): Promise<string[]> {
  const bad: string[] = []
  const toolbar = await rectOf(toolbarOf(page), 'the zoom toolbar')
  const shortcuts = await rectOf(shortcutsOf(page), 'the shortcuts button')
  const t = crossing(names, toolbar)
  const s = crossing(names, shortcuts)
  if (strict) {
    if (t) bad.push(`Names box overlaps the zoom toolbar by ${t.w.toFixed(1)} x ${t.h.toFixed(1)} px`)
    if (s) bad.push(`Names box overlaps the shortcuts button by ${s.w.toFixed(1)} x ${s.h.toFixed(1)} px`)
  }
  // clickable: nothing covers the middle of either control, and where the Names box does reach one (a short window with Selection
  // at its cap) the control is still on top there (z 74 against a panel's at most 69)
  if (!(await reachable(toolbarOf(page)))) bad.push('the zoom toolbar is covered at its centre')
  if (!(await reachable(shortcutsOf(page)))) bad.push('the shortcuts button is covered at its centre')
  if (t && !(await reachable(toolbarOf(page), t.box))) bad.push('the zoom toolbar is covered where the Names box overlaps it')
  if (s && !(await reachable(shortcutsOf(page), s.box))) bad.push('the shortcuts button is covered where the Names box overlaps it')
  return bad
}

function closeTo(bad: string[], what: string, got: number, want: number, tolerance = SLOT_TOLERANCE): void {
  if (!(Math.abs(got - want) <= tolerance)) bad.push(`${what}: ${got} (wanted ${want} within ${tolerance})`)
}

/**
 * Every way the ten panels break the DESKTOP rules right now (an empty list is a correct layout): the nine-panel stack of 07-07, no
 * intersection among the ten boxes, Names at its slot (x from the model and from the contract, width 240, top = Selection bottom + 18),
 * inside the window, clear of the zoom toolbar and the shortcuts button, and, open, a body room that is the clamp formula and keeps the
 * box above the bottom reserve (from a 742 px tall window; below that only the 80 px minimum is asserted and the two controls must
 * stay clickable, UI-SPEC "Names body room").
 */
async function desktopViolations(page: Page, o: { open: boolean }): Promise<string[]> {
  const { width: vw, height: vh } = page.viewportSize() as { width: number; height: number }
  const b = await settledTen(page)
  const names = b.Names
  const sel = b.Selection
  const bad = [...overlapsAmong(b, TEN), ...(await layoutViolations(page))]
  closeTo(bad, 'Names left (contract)', names.x, contractNamesX(sel.x, vw), 1)
  closeTo(bad, 'Names left (namesX)', names.x, namesX(sel.x, vw), 1)
  closeTo(bad, 'Names width', names.width, NAMES_W, 0.01)
  closeTo(bad, 'Names width (NAMES_PANEL_WIDTH)', names.width, NAMES_PANEL_WIDTH, 0.01)
  closeTo(bad, 'Names top (Selection bottom + 18)', names.y, sel.y + sel.height + GAP)
  if (names.x < NAMES_X_FLOOR - 0.01) bad.push(`Names left ${names.x} is left of ${NAMES_X_FLOOR} (the Text panel's open box plus the edge gap)`)
  if (names.x + names.width > vw - EDGE_GAP + 0.01) bad.push(`Names right edge ${names.x + names.width} is past ${vw - EDGE_GAP}`)
  if (names.y < sel.y + sel.height + GAP - 1.01) bad.push(`Names top ${names.y} is above Selection's bottom ${sel.y + sel.height} + ${GAP}`)
  bad.push(...(await clearanceViolations(page, names, vh >= SHORT_WINDOW)))
  if (o.open) {
    const wrapper = namesWrapper(page)
    const room = await wrapper.evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
    closeTo(bad, 'open body max-height (contract)', room, contractBodyMax(names.y, vh), 1)
    closeTo(bad, 'open body max-height (namesBodyMax)', room, namesBodyMax(names.y, vh), 1)
    // the scroller is 12 px shorter than the room, so at the 80 px minimum room the visible body is 68 px (UI-SPEC "Scrolling")
    const scrollerMax = await namesScroll(page).evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
    closeTo(bad, 'scroller max-height (room - 12)', scrollerMax, room - SCROLL_INSET, 1)
    const body = (await rectOf(wrapper, 'the Names body')).height
    if (body < BODY_MIN - SCROLL_INSET - 1) bad.push(`open body ${body} is under the ${BODY_MIN - SCROLL_INSET} px that the minimum room leaves the scroller`)
    if (NAMES_BODY_MIN !== BODY_MIN) bad.push(`NAMES_BODY_MIN is ${NAMES_BODY_MIN}, the contract says ${BODY_MIN}`)
    if (vh >= SHORT_WINDOW && names.y + names.height > vh - BOTTOM_RESERVE + 1) {
      bad.push(`open Names box ends at ${names.y + names.height}, below ${vh - BOTTOM_RESERVE} (window height ${vh} less the ${BOTTOM_RESERVE} px reserve)`)
    }
  }
  return bad
}

/**
 * Every way the ten panels break the MOBILE rules right now: one column at x 8, Names first at y 64 and 240 wide, each next panel
 * 6 px below the previous one's measured bottom, no intersection, Names inside the window, an open box that ends at or above
 * vh - 96 with the body room of the clamp formula at y 64, and clear of the zoom toolbar and the shortcuts button.
 */
async function mobileViolations(page: Page, o: { open: boolean }): Promise<string[]> {
  const { width: vw, height: vh } = page.viewportSize() as { width: number; height: number }
  const b = await settledTen(page)
  const names = b.Names
  const bad = overlapsAmong(b, TEN)
  closeTo(bad, 'Names left', names.x, MOBILE_X, 0.01)
  closeTo(bad, 'Names top', names.y, 64, 0.01)
  closeTo(bad, 'Names width', names.width, NAMES_W, 0.01)
  for (let i = 0; i < MOBILE_ORDER.length; i++) {
    closeTo(bad, `${MOBILE_ORDER[i]} left`, b[MOBILE_ORDER[i]].x, MOBILE_X, 0.01)
    if (i > 0) {
      const prev = b[MOBILE_ORDER[i - 1]]
      closeTo(bad, `${MOBILE_ORDER[i]} top (below ${MOBILE_ORDER[i - 1]})`, b[MOBILE_ORDER[i]].y, prev.y + prev.height + MOBILE_GAP)
    }
  }
  if (names.x + names.width > vw) bad.push(`Names right edge ${names.x + names.width} is past the window (${vw})`)
  bad.push(...(await clearanceViolations(page, names, true)))
  if (o.open) {
    const wrapper = namesWrapper(page)
    const room = await wrapper.evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
    closeTo(bad, 'open body max-height (contract)', room, contractBodyMax(64, vh), 1)
    closeTo(bad, 'open body max-height (namesBodyMax)', room, namesBodyMax(64, vh), 1)
    if (names.y + names.height > vh - BOTTOM_RESERVE + 1) {
      bad.push(`open Names box ends at ${names.y + names.height}, below ${vh - BOTTOM_RESERVE} (window height ${vh} less the ${BOTTOM_RESERVE} px reserve)`)
    }
  }
  return bad
}

/**
 * Inside the OPEN Names panel: nothing overflows horizontally (the page, the panel wrapper, the one scroller, every radio group, button
 * row, table row and list row), the wrapper does not scroll (the body has one scroller, UI-SPEC "Scrolling"), and every button, radio
 * label and checkbox label the panel adds is at least 24 x 24 (WCAG 2.5.8). The shared header toggle of CyberPanel is outside the
 * panel's content root and is not one of the controls this phase adds.
 */
async function contentViolations(page: Page): Promise<string[]> {
  await settleAnimations(page)
  return page.evaluate(() => {
    const out: string[] = []
    const vw = window.innerWidth
    const label = (el: Element): string => {
      const data = el.getAttributeNames().find(n => n.startsWith('data-names-') || n.startsWith('data-collision-'))
      const text = (el.textContent ?? '').trim().slice(0, 24)
      return `${el.tagName.toLowerCase()}${data ? `[${data}]` : ''}${text ? ` "${text}"` : ''}`
    }
    const doc = document.documentElement
    if (doc.scrollWidth > vw) out.push(`documentElement scrollWidth ${doc.scrollWidth} > window ${vw}`)
    if (document.body.scrollWidth > vw) out.push(`body scrollWidth ${document.body.scrollWidth} > window ${vw}`)
    const root = document.querySelector('[data-names-panel]') as HTMLElement | null
    const scroller = document.querySelector('[data-names-scroll]') as HTMLElement | null
    if (root === null || scroller === null || root.parentElement === null) return ['the Names panel is not open']
    const wrapper = root.parentElement
    if (wrapper.scrollHeight > wrapper.clientHeight + 1) out.push(`the panel wrapper scrolls: scrollHeight ${wrapper.scrollHeight} > clientHeight ${wrapper.clientHeight}`)
    if (wrapper.scrollWidth > wrapper.clientWidth + 1) out.push(`the panel wrapper scrolls sideways: scrollWidth ${wrapper.scrollWidth} > clientWidth ${wrapper.clientWidth}`)
    const wide = (el: Element, what: string): void => {
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${what} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`)
    }
    wide(scroller, 'data-names-scroll')
    for (const el of Array.from(root.querySelectorAll('[role="radiogroup"], [data-names-controls], [data-names-row], [data-names-preview-row], table'))) wide(el, label(el))
    for (const button of Array.from(root.querySelectorAll('button'))) {
      if (button.parentElement !== null) wide(button.parentElement, `the row of ${label(button)}`)
    }
    // a table row's own scrollWidth is not reliable, so every cell, control and row must also lie inside the body horizontally
    const s = scroller.getBoundingClientRect()
    for (const el of Array.from(root.querySelectorAll('table, tr, td, th, button, input, label, [role="radiogroup"], [data-names-row]'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.left < s.left - 1 || r.right > s.right + 1) out.push(`${label(el)} spans ${r.left.toFixed(1)}..${r.right.toFixed(1)}, outside the body ${s.left.toFixed(1)}..${s.right.toFixed(1)}`)
    }
    for (const el of Array.from(root.querySelectorAll('button, label, [role="radio"], [role="checkbox"]'))) {
      if (el.tagName === 'LABEL' && el.querySelector('input[type="radio"], input[type="checkbox"]') === null) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.width < 23.99 || r.height < 23.99) out.push(`${label(el)} is ${r.width.toFixed(1)} x ${r.height.toFixed(1)}, under 24 x 24`)
    }
    return out
  })
}

/** Expands the Text panel with a DOM click: at the shorter windows its header can lie below the fold, where no pointer click can reach it. */
async function openTextPanel(page: Page): Promise<void> {
  await toggle(page, 'Text', 'Expand').evaluate((el: HTMLElement) => el.click())
  await expect(toggle(page, 'Text', 'Collapse')).toHaveCount(1)
}

/**
 * Clears the selection and the pin, so Selection is empty again: the clear button drops the selected zones, and a click on the bare
 * diagram background (a point where the top element is the SVG itself, not a node, a panel or the top bar) drops the pinned element.
 */
async function emptySelection(page: Page): Promise<void> {
  await panel(page, 'Selection').getByRole('button', { name: 'clear', exact: true }).click()
  const point = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-diagram]') as SVGSVGElement | null
    if (svg === null) return null
    const r = svg.getBoundingClientRect()
    for (let y = r.top + 6; y < r.bottom; y += 12) {
      for (let x = r.left + 6; x < r.right; x += 12) if (document.elementFromPoint(x, y) === svg) return { x, y }
    }
    return null
  })
  if (point === null) throw new Error('no bare point on the diagram background')
  await page.mouse.click(point.x, point.y)
  await expect(selectionHeading(page)).toHaveText('Selected Elements')
}

const namesStyle = (page: Page): Promise<{ left: number; top: number }> =>
  namesBox(page).evaluate((e: HTMLElement) => ({ left: parseFloat(e.style.left), top: parseFloat(e.style.top) }))

async function namesHeaderPoint(page: Page): Promise<{ x: number; y: number }> {
  const b = await rectOf(namesBox(page).locator('header span').first(), 'the Names header title')
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
}

// ----- 1. no overlap at every UI-SPEC desktop viewport, four states, bases 10, 28, 64 and a Canvas base -----

const MATRIX_VIEWPORTS = [[821, 768], [900, 800], [991, 800], [1024, 768], [1280, 800], [1280, 900], [1440, 900]] as const

for (const base of [10, 28, 64, CANVAS_BASE]) {
  for (const [w, h] of MATRIX_VIEWPORTS) {
    test(`names matrix: base ${base} at ${w}x${h}, no two of the ten boxes intersect and Names clears the toolbar and shortcuts (defaults, Names open, Text open${base <= SVG_RICH_MAX_N ? ', 8 selected zones' : ''})`, async ({ page }) => {
      test.setTimeout(150_000)
      const errors = trackErrors(page)
      await page.setViewportSize({ width: w, height: h })
      await openFor(page, base)
      expect(tierFor(base) === 'svg', `base ${base} tier`).toBe(base <= SVG_RICH_MAX_N)

      expect(await desktopViolations(page, { open: false }), 'state: defaults').toEqual([])
      await openNames(page)
      expect(await desktopViolations(page, { open: true }), 'state: Names open').toEqual([])
      await openTextPanel(page)
      expect(await desktopViolations(page, { open: true }), 'state: Names open with Text open').toEqual([])

      if (tierFor(base) === 'svg') {
        // the SVG tier's Selection lists the selected items: eight selected zones make it taller and Names follows it down
        await openFor(page, base, selectedQuery(8))
        await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
        await openNames(page)
        expect(await desktopViolations(page, { open: true }), 'state: Names open with 8 selected zones').toEqual([])
      }
      expect(errors).toEqual([])
    })
  }
}

// the largest Canvas bases: the panels are far taller than at base 10 and the zone list holds thousands of rows (Canvas tier: no selected-zones state)
for (const base of [1000, INTERACTIVE_MAX_N]) {
  for (const [w, h] of [[821, 768], [1280, 800]] as const) {
    test(`names matrix: Canvas base ${base} at ${w}x${h}, no two of the ten boxes intersect and Names clears the toolbar and shortcuts (defaults, Names open, Text open)`, async ({ page }) => {
      test.setTimeout(150_000)
      const errors = trackErrors(page)
      await page.setViewportSize({ width: w, height: h })
      await openFor(page, base)
      expect(tierFor(base)).toBe('canvas')
      expect(await desktopViolations(page, { open: false }), 'state: defaults').toEqual([])
      await openNames(page)
      expect(await desktopViolations(page, { open: true }), 'state: Names open').toEqual([])
      await openTextPanel(page)
      expect(await desktopViolations(page, { open: true }), 'state: Names open with Text open').toEqual([])
      expect(errors).toEqual([])
    })
  }
}

// ----- 2. the slot rule and the body room at 1280x800 base 10, with the contract's own numbers -----

test('names slot at 1280x800 base 10: left = namesX(Selection left), top = Selection bottom + 18, body max-height = namesBodyMax(top, 800)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await openNames(page)
  expect(await desktopViolations(page, { open: true })).toEqual([])

  const b = await settledTen(page)
  expect(Math.abs(b.Names.x - namesX(b.Selection.x, 1280))).toBeLessThanOrEqual(1)
  expect(Math.abs(b.Names.y - (b.Selection.y + b.Selection.height + 18))).toBeLessThanOrEqual(1)
  const room = await namesWrapper(page).evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
  expect(Math.abs(room - namesBodyMax(b.Names.y, 800))).toBeLessThanOrEqual(1)
  // the UI-SPEC's worked numbers for this window: Selection x 942 with Names under it at x 942, body room 800 - (y + 34) - 96
  expect(b.Selection.x).toBe(942)
  expect(b.Names.x).toBe(942)
  expect(Math.abs(room - (800 - (b.Names.y + 34) - 96))).toBeLessThanOrEqual(1)
  expect(b.Names.y + b.Names.height).toBeLessThanOrEqual(800 - 96 + 1)
  // Selection was never moved or resized by opening Names
  expect(b.Selection.y).toBe(64)
  expect(errors).toEqual([])
})

// ----- 3. Selection growth moves Names -----

test('names follows Selection down as zones are selected on the diagram and back up on clear (1280x800, base 10, Names open)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await openNames(page)
  expect(await desktopViolations(page, { open: true })).toEqual([])

  const slotGap = async (): Promise<number> => {
    const b = await tenBoxes(page)
    return b.Names.y - (b.Selection.y + b.Selection.height)
  }
  const emptyHeight = (await box(page, 'Selection')).height
  const topBefore = (await tenBoxes(page)).Names.y

  // eight zones, one click each (the pointer is on the diagram, never inside the Names panel); the slot rule holds after every click
  for (const zone of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await page.locator(`[data-zone="${zone}"]`).click()
    await expect.poll(async () => Math.abs((await slotGap()) - GAP), { timeout: 10_000 }).toBeLessThanOrEqual(1.01)
  }
  await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
  const grownHeight = (await box(page, 'Selection')).height
  expect(grownHeight, 'Selection grew').toBeGreaterThan(emptyHeight + 40)
  expect(await desktopViolations(page, { open: true }), 'after eight selected zones').toEqual([])
  const topGrown = (await tenBoxes(page)).Names.y
  expect(topGrown, 'Names moved down with Selection').toBeGreaterThan(topBefore + 40)

  // clear drops the selected zones and a click on the bare background drops the pin: Selection is empty again and Names is back
  await emptySelection(page)
  await expect.poll(async () => Math.abs((await tenBoxes(page)).Names.y - topBefore), { timeout: 10_000 }).toBeLessThanOrEqual(1)
  expect((await box(page, 'Selection')).height).toBeCloseTo(emptyHeight, 0)
  expect(await desktopViolations(page, { open: true }), 'after clear').toEqual([])
  expect(errors).toEqual([])
})

// ----- 4. Selection at its 52vh cap: Names gets the 80 px minimum body and the body scrolls -----

for (const [w, h] of [[1280, 800], [1024, 768], [1280, 900], [1280, 700], [1024, 600]] as const) {
  test(`names with Selection at its 52vh cap at ${w}x${h}: the body room is never under 80 px and the body scrolls${h >= SHORT_WINDOW ? ', the box still ends at vh - 96' : ', toolbar and shortcuts stay clickable'}`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: w, height: h })
    await openViewer(page, `base=64&${selectedQuery(40)}`)
    await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
    await openNames(page)
    expect(await desktopViolations(page, { open: true })).toEqual([])

    // Selection really is at its cap: its own scroller is 52vh tall and has more to show
    const cap = panel(page, 'Selection').locator('div[style*="52vh"]')
    const capBox = await rectOf(cap, 'the Selection scroller')
    expect(Math.abs(capBox.height - 0.52 * h)).toBeLessThanOrEqual(1)
    expect(await cap.evaluate((el: Element) => el.scrollHeight > el.clientHeight)).toBe(true)

    const names = (await settledTen(page)).Names
    const wrapper = namesWrapper(page)
    const room = await wrapper.evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
    const wanted = contractBodyMax(names.y, h)
    expect(Math.abs(room - wanted)).toBeLessThanOrEqual(1)
    if (h >= SHORT_WINDOW) {
      // the 80 px minimum holds from 742 px, so the contract's bottom is kept even here
      expect(names.y + names.height).toBeLessThanOrEqual(h - BOTTOM_RESERVE + 1)
    } else {
      // below it the minimum wins over the reserve: the body is exactly the minimum
      expect(room).toBe(BODY_MIN)
    }
    // a body room this small scrolls inside its one scroller; the wrapper itself never does
    const scroller = namesScroll(page)
    expect(await scroller.evaluate((el: Element) => el.scrollHeight > el.clientHeight), 'the body scrolls').toBe(true)
    expect(await wrapper.evaluate((el: Element) => el.scrollHeight <= el.clientHeight + 1), 'the wrapper does not scroll').toBe(true)
    expect(await scroller.evaluate((el: Element) => el.clientHeight)).toBeGreaterThanOrEqual(BODY_MIN - 12 - 1)
    expect(errors).toEqual([])
  })
}

// ----- 4b. the todo 008 trigger again, now with Names open -----

test('todo 008 trigger with Names open: base 10, then 28 and back through the picker, the ten panels stay stacked (1280x800)', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await openNames(page)
  expect(await desktopViolations(page, { open: true }), 'base 10').toEqual([])

  const base = page.getByLabel('Base', { exact: true })
  for (const next of [28, 10]) {
    await base.click()
    await base.fill(String(next))
    await base.press('Enter')
    await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(next)
    await base.press('Escape')
    await openNames(page)
    await expect.poll(() => desktopViolations(page, { open: true }), { timeout: 15_000 }).toEqual([])
  }
  expect(errors).toEqual([])
})

// ----- 5. phone windows: Names first, nothing overlaps, no overflow, tap targets -----

for (const [w, h] of [[375, 667], [768, 1024]] as const) {
  test.describe(`names mobile ${w}x${h} with touch`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true })

    for (const base of [10, 28, CANVAS_BASE]) {
      test(`base ${base}: Names first at x 8, y 64, collapsed and open, nothing overlaps, nothing overflows, every control is at least 24x24`, async ({ page }) => {
        test.setTimeout(120_000)
        const errors = trackErrors(page)
        await openFor(page, base)

        expect(await mobileViolations(page, { open: false }), 'collapsed').toEqual([])
        await openNames(page)
        expect(await mobileViolations(page, { open: true }), 'open').toEqual([])
        expect(await contentViolations(page), 'open: overflow, single scroller, targets').toEqual([])
        // opening Names pushed every other panel down by its open height: the first of them starts below Names' bottom
        const b = await settledTen(page)
        expect(b.Layers.y).toBeGreaterThanOrEqual(b.Names.y + b.Names.height + MOBILE_GAP - 1.01)
        expect(errors).toEqual([])
      })
    }
  })
}

test.describe('names mobile 375x667: the base dropdown renders above the open Names panel', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  test('the dropdown (z 120) covers Names where they overlap, and Names (at most 69) never covers it', async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page)
    await openNames(page)
    await page.getByLabel('Base', { exact: true }).click()
    const dropdown = page.locator('div[class*="z-[120]"]').filter({ has: page.getByLabel('Base slider') })
    await expect(dropdown).toBeVisible()
    const d = await rectOf(dropdown, 'the base dropdown')
    const n = await rectOf(namesBox(page), 'the Names panel')
    const both = crossing(d, n)
    expect(both, 'at 375 wide the dropdown overlaps the Names panel, so the stacking order is observable').not.toBeNull()
    const covered = await page.evaluate(
      ({ x, y, w, h }) => {
        const hit = document.elementFromPoint(x + w / 2, y + h / 2)
        return hit !== null && hit.closest('div[class*="z-[120]"]') !== null
      },
      { x: Math.max(d.x, n.x), y: Math.max(d.y, n.y), w: both?.w ?? 0, h: both?.h ?? 0 },
    )
    expect(covered, 'the topmost element at the middle of the overlap belongs to the dropdown').toBe(true)
    expect(errors).toEqual([])
  })
})

// ----- 6. the planetary controls stay clear of Names -----

for (const w of [992, 1024, 1280, 1440]) {
  test(`names planetary clearance at ${w}x900: collapsed and open, Names covers none of the planetary controls`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: w, height: 900 })
    await openViewer(page, 'layout=planetary&date=2000-01-01')
    const date = page.locator('div.fixed.top-0 input[type="date"]')
    await expect(date).toBeVisible()
    const controls = page.locator('div.fixed.top-0 button, div.fixed.top-0 input[type="date"]')
    expect(await controls.count(), 'the layout buttons, orbit, today, reset, orbits and the date field').toBeGreaterThanOrEqual(5)

    const clear = async (state: string): Promise<void> => {
      const b = await settledTen(page)
      const bad: string[] = []
      const count = await controls.count()
      for (let i = 0; i < count; i++) {
        const r = await controls.nth(i).boundingBox()
        if (r === null) continue
        const c = crossing(b.Names, r)
        if (c) bad.push(`Names (${state}) covers planetary control ${i} by ${c.w.toFixed(1)} x ${c.h.toFixed(1)} px`)
      }
      expect(bad).toEqual([])
    }
    await clear('collapsed')
    await openNames(page)
    await clear('open')
    expect(await desktopViolations(page, { open: true })).toEqual([])
    expect(errors).toEqual([])
  })
}

// ----- 7. Names drag: no jump on mouse down, exact mouse delta, keeps its place when Selection above it changes -----

test('names drag: no jump on mouse down, exact mouse delta, body room follows the dragged y, keeps its place when Selection changes (1280x800)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  await openNames(page)
  expect(await desktopViolations(page, { open: true })).toEqual([])

  const start = await namesStyle(page)
  const grab = await namesHeaderPoint(page)

  // mouse down and up without a move: nothing moves (the stored position is not where a derived panel is drawn)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.up()
  expect(await namesStyle(page)).toEqual(start)

  // the first move is 5 px: the panel follows the mouse exactly, then 60 and 40 px in all
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 5, grab.y + 5)
  const afterFive = await namesStyle(page)
  expect(afterFive.left).toBeCloseTo(start.left + 5, 3)
  expect(afterFive.top).toBeCloseTo(start.top + 5, 3)
  await page.mouse.move(grab.x + 60, grab.y + 40, { steps: 6 })
  await page.mouse.up()
  const dropped = await namesStyle(page)
  expect(dropped.left).toBeCloseTo(start.left + 60, 3)
  expect(dropped.top).toBeCloseTo(start.top + 40, 3)

  // the body room follows the dragged panel's own y, so the open box still ends above the bottom reserve
  await settleAnimations(page)
  await expect
    .poll(async () => {
      const n = await rectOf(namesBox(page), 'the Names panel')
      const room = await namesWrapper(page).evaluate((el: Element) => parseFloat(getComputedStyle(el).maxHeight))
      return Math.abs(room - contractBodyMax(dropped.top, 800)) <= 1 && n.y + n.height <= 800 - BOTTOM_RESERVE + 1
    }, { timeout: 10_000 })
    .toBe(true)

  // Selection above it grows (one selected zone): the dragged panel keeps the place it was dropped at
  const before = (await box(page, 'Selection')).height
  await page.locator('[data-zone="3"]').click()
  await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
  await expect.poll(async () => (await box(page, 'Selection')).height, { timeout: 10_000 }).toBeGreaterThan(before + 20)
  await settleAnimations(page)
  expect(await namesStyle(page)).toEqual(dropped)

  // ... and shrinks back on clear and unpin: still where it was dropped
  await emptySelection(page)
  await expect.poll(async () => (await box(page, 'Selection')).height, { timeout: 10_000 }).toBeLessThanOrEqual(before + 1)
  await settleAnimations(page)
  expect(await namesStyle(page)).toEqual(dropped)
  expect(errors).toEqual([])
})

// ----- 8. stacking: the cap holds with Names among the panels and the overlay and dropdown render above it -----

test('names z cap: 80 header presses across all ten panels never pass 69, the last pressed (Names) is on top, and the Demons overlay and base dropdown render above Names (1280x800)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openViewer(page)
  expect(await desktopViolations(page, { open: false })).toEqual([])

  const points = [...(await Promise.all(ALL.map(t => headerPoint(page, t)))), await namesHeaderPoint(page)]
  const zOf = async (target: Locator): Promise<number> => Number(await target.evaluate((e: HTMLElement) => e.style.zIndex))
  const allZ = async (): Promise<number[]> => [...(await Promise.all(ALL.map(t => zOf(panel(page, t))))), await zOf(namesBox(page))]

  for (let i = 0; i < 80; i++) {
    const p = points[i % TEN.length]
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.up()
    if (i % 10 === 9) for (const z of await allZ()) expect(z).toBeLessThanOrEqual(69)
  }
  const z = await allZ()
  for (const value of z) {
    expect(value).toBeLessThanOrEqual(69)
    expect(value).toBeGreaterThanOrEqual(40)
  }
  const last = TEN.length - 1 // 80 presses cycle the ten panels exactly eight times: Names is the last one pressed
  expect(79 % TEN.length).toBe(last)
  z.forEach((value, i) => {
    if (i !== last) expect(z[last], `Names above ${TEN[i]}`).toBeGreaterThan(value)
  })
  const toolbarZ = Number(await toolbarOf(page).evaluate(el => getComputedStyle(el).zIndex))
  expect(toolbarZ).toBe(74)
  for (const value of z) expect(toolbarZ).toBeGreaterThan(value)
  expect(await desktopViolations(page, { open: false }), 'the presses moved nothing').toEqual([])

  // open Names, then the Demons overlay (z 80): the overlay covers the whole window, Names included
  await openNames(page)
  const n = await rectOf(namesBox(page), 'the Names panel')
  await openDemons(page)
  const overlayZ = Number(await page.locator('[data-demons-overlay]').evaluate((el: Element) => getComputedStyle(el).zIndex))
  expect(overlayZ).toBeGreaterThan(Math.max(...z))
  const coveredByOverlay = await page.evaluate(
    ({ x, y }) => (document.elementFromPoint(x, y)?.closest('[data-demons-overlay]') ?? null) !== null,
    { x: n.x + n.width / 2, y: n.y + n.height / 2 },
  )
  expect(coveredByOverlay, 'the element at the middle of the open Names box belongs to the Demons overlay').toBe(true)
  await closeDemons(page)

  // the base dropdown (z 120, a portal) is above every panel
  await page.getByLabel('Base', { exact: true }).click()
  const dropdown = page.locator('div[class*="z-[120]"]').filter({ has: page.getByLabel('Base slider') })
  await expect(dropdown).toBeVisible()
  expect(Number(await dropdown.evaluate((el: Element) => getComputedStyle(el).zIndex))).toBeGreaterThan(Math.max(...z))
  expect(errors).toEqual([])
})
