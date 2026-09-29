import { test, expect } from '@playwright/test'
import { createNumogram } from '../engine/index'
import { DIAGRAM, openViewer, panel, stubClipboard } from './viewer-helpers'

// UI-06 at a generated base (28 and 100): layers toggle (including Pandemonium), zoom in/out/wheel/fit, alt-drag
// pan, real panel collapse (todo 003) and the Text panel's copy button (UI-07's final covering plan).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function parseScale(transform: string): number {
  const m = transform.match(/scale\(([-\d.]+)\)/)
  if (!m) throw new Error(`no scale() in transform: ${transform}`)
  return parseFloat(m[1])
}

function parseTranslate(transform: string): { x: number; y: number } {
  const m = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
  if (!m) throw new Error(`no translate() in transform: ${transform}`)
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) }
}

/** The scale wrapper (svgWrapRef): the immediate parent of the [data-diagram] svg. */
const scaleWrapper = (page: import('@playwright/test').Page) => page.locator(DIAGRAM).locator('xpath=..')
/** The pan wrapper: the scale wrapper's own parent, translated by canvasPan. */
const panWrapper = (page: import('@playwright/test').Page) => scaleWrapper(page).locator('xpath=..')

test('Gates layer toggles off and back on at base 28', async ({ page }) => {
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-gate]')).toHaveCount(28)
  await panel(page, 'Layers').getByText('Gates', { exact: true }).click()
  await expect(page.locator('[data-gate]')).toHaveCount(0)
  await panel(page, 'Layers').getByText('Gates', { exact: true }).click()
  await expect(page.locator('[data-gate]')).toHaveCount(28)
})

test('Syzygies layer toggles between 14 and 0 at base 28', async ({ page }) => {
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-syzygy]')).toHaveCount(14)
  await panel(page, 'Layers').getByText('Syzygies', { exact: true }).click()
  await expect(page.locator('[data-syzygy]')).toHaveCount(0)
  await panel(page, 'Layers').getByText('Syzygies', { exact: true }).click()
  await expect(page.locator('[data-syzygy]')).toHaveCount(14)
})

test('Currents layer toggles between 14 and 0 at base 28', async ({ page }) => {
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-current]')).toHaveCount(14)
  await panel(page, 'Layers').getByText('Currents', { exact: true }).click()
  await expect(page.locator('[data-current]')).toHaveCount(0)
  await panel(page, 'Layers').getByText('Currents', { exact: true }).click()
  await expect(page.locator('[data-current]')).toHaveCount(14)
})

test('Pandemonium layer at base 28 shows every non-syzygetic demon', async ({ page }) => {
  // Independent count from the engine (never the app's own view model): base 28 has C(28,2) = 378 demons total,
  // of which 14 are syzygetic (a + b === base - 1 === 27); the diagram never draws those as Pandemonium chords.
  const g = createNumogram(28)
  let nonSyzygyCount = 0
  for (let m = 0; m < g.demons.count; m++) {
    const d = g.demons.at(m)
    if (d.a + d.b !== 27) nonSyzygyCount++
  }
  expect(nonSyzygyCount).toBe(364)

  await openViewer(page, 'base=28')
  await expect(page.locator('[data-demon]')).toHaveCount(0)
  await panel(page, 'Layers').getByText('Pandemonium', { exact: true }).click()
  await expect(page.locator('[data-demon]')).toHaveCount(364)
})

test('Pandemonium is N/A at base 100 and adds no demon chords', async ({ page }) => {
  await openViewer(page, 'base=100')
  const row = panel(page, 'Layers').locator('div.cursor-pointer').filter({ hasText: 'Pandemonium' })
  await expect(row).toContainText('N/A')
  await row.click()
  await expect(page.locator('[data-demon]')).toHaveCount(0)
})

test('zoom in, zoom out and the mouse wheel change the diagram scale', async ({ page }) => {
  await openViewer(page, 'base=28')
  const wrapper = scaleWrapper(page)
  const readScale = async () => parseScale((await wrapper.getAttribute('style')) ?? '')

  expect(await readScale()).toBe(1)

  await page.getByRole('button', { name: 'Zoom in' }).click()
  expect(await readScale()).toBeCloseTo(1.25, 5)

  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.getByRole('button', { name: 'Zoom out' }).click()
  expect(await readScale()).toBeCloseTo(0.8, 5)

  const before = await readScale()
  const box = await page.locator(DIAGRAM).boundingBox()
  if (!box) throw new Error('diagram has no bounding box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -400)
  await expect.poll(readScale).toBeGreaterThan(before)
})

test('fit diagram to view frames every zone inside the viewport', async ({ page }) => {
  await openViewer(page, 'base=28')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Fit diagram to view' }).click()
  await page.waitForTimeout(150) // fitSelectionToView's rAF pan settle

  const boxes = await page.locator('[data-zone] circle').evaluateAll(nodes =>
    nodes.map(n => {
      const r = (n as SVGGraphicsElement).getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }),
  )
  expect(boxes.length).toBeGreaterThan(0)
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(-2)
    expect(b.top).toBeGreaterThanOrEqual(-2)
    expect(b.right).toBeLessThanOrEqual(1282)
    expect(b.bottom).toBeLessThanOrEqual(902)
  }
})

test('alt+drag pans the canvas by the mouse delta', async ({ page }) => {
  await openViewer(page, 'base=28')
  const wrap = panWrapper(page)
  const before = parseTranslate((await wrap.getAttribute('style')) ?? '')

  const box = await page.locator(DIAGRAM).boundingBox()
  if (!box) throw new Error('diagram has no bounding box')
  // The diagram's own centre: Alt+drag pans regardless of what element is under the cursor (it short-circuits
  // before any zone/current/gate click handling), but a corner risks landing on a fixed side panel instead of the
  // diagram itself, since panels visually overlap the diagram's bounding box.
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.keyboard.down('Alt')
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 80, startY + 40, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const after = parseTranslate((await wrap.getAttribute('style')) ?? '')
  expect(after.x - before.x).toBeCloseTo(80, 0)
  expect(after.y - before.y).toBeCloseTo(40, 0)
})

test('collapsing the Zones panel hides its rows, expanding restores them', async ({ page }) => {
  await openViewer(page, 'base=28')
  // Mirrors e2e/behaviour-collect.ts's own technique for panel open state: the collapsible body wrapper carries
  // max-height in its inline style, clipping (rather than unmounting) its rows when collapsed.
  const body = panel(page, 'Zones').locator('div[style*="max-height"]').first()
  const readMaxHeight = () => body.evaluate(el => parseFloat(getComputedStyle(el).maxHeight))

  await expect.poll(readMaxHeight).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Collapse Zones' }).click()
  await expect.poll(readMaxHeight).toBe(0)

  await page.getByRole('button', { name: 'Expand Zones' }).click()
  await expect.poll(readMaxHeight).toBeGreaterThan(0)
})

test('the Text panel shows the numogram text with a working copy button', async ({ page, context }) => {
  await stubClipboard(context)
  // The Text panel is stacked below Layers/Labels/Zones/Regions/Syzygies/Currents/Gates on the desktop layout
  // (position: fixed, following this plan's own placement formula); at base 28 that stack is taller than the
  // standard 900px test viewport, so a taller viewport is needed to reach its header chevron and copy button.
  await page.setViewportSize({ width: 1280, height: 1300 })
  await openViewer(page, 'base=28')

  await page.getByRole('button', { name: 'Expand Text' }).click()
  const pre = page.locator('pre[aria-label="Numogram text"]')
  await expect(pre).toBeVisible()
  await expect(pre).toContainText('CCRUG numogram, base 28')

  // A name-based role query would stop matching the instant the label flips to "Copied", so match either state.
  const copyBtn = page.getByRole('button', { name: /^(Copy numogram text|Copied)$/ })
  await copyBtn.click()
  await expect(copyBtn).toHaveText('Copied')
  const preText = await pre.textContent()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(preText)
})
