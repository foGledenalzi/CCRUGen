import { test, expect, type Page } from '@playwright/test'
import { openViewer, panel } from './viewer-helpers'

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
