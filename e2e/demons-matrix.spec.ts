import { test, expect, type Locator, type Page } from '@playwright/test'
import { createNumogram, formatNumeral, type Numogram } from '../engine/index'
import { SUBTYPE_LABEL } from '../app/lib/demonBrowser'
import { DIAGRAM, openViewer } from './viewer-helpers'
import { matrixCellPoint, openDemons, waitRaster } from './demons-helpers'

// Proves DEM-04 (D-06) end to end against the static export: the triangular matrix identifies and pins the exact
// cell under the cursor at any zoom level (never from the raster, research A2), keyboard access, the syzygy
// diagonal overlay, base 666 with no diagram, and the matrix's raster-fill timings (research A1) logged for the
// SUMMARY rather than asserted against a threshold (T-05-38: tests never depend on this PC's speed).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 5 UI specs run once (UTC context)'))

const MIDDLE_DOT = String.fromCodePoint(0xb7)

/** `A::B · MESH · SubtypeLabel`, matching DemonMatrix.tsx's own `demonText` exactly (digits label scheme, default). */
function cellText(g: Numogram, a: number, b: number, base: number): string {
  const d = g.demons.ref(a, b)
  return `${formatNumeral(a, base)}::${formatNumeral(b, base)} ${MIDDLE_DOT} ${d.mesh} ${MIDDLE_DOT} ${SUBTYPE_LABEL[d.subtype]}`
}

async function liveScale(matrix: Locator): Promise<number> {
  return parseFloat((await matrix.getAttribute('data-scale')) ?? '0')
}

/** Opens the viewer, the demons overlay, and switches to the Matrix tab, waiting for its first raster to finish. */
async function openMatrix(page: Page, query: string): Promise<Locator> {
  await openViewer(page, query)
  const dialog = await openDemons(page)
  await dialog.getByRole('tab', { name: /^matrix$/i }).click()
  await waitRaster(page)
  return dialog
}

test('base 28: hover identifies the exact cell at fit and after zooming', async ({ page }) => {
  const g = createNumogram(28)
  const dialog = await openMatrix(page, 'base=28')
  const matrix = dialog.locator('[data-demon-matrix]')
  const tooltip = dialog.locator('[data-matrix-tooltip]')

  let p = await matrixCellPoint(page, 12, 3)
  await page.mouse.move(p.x, p.y)
  await expect(tooltip).toHaveText('c::3 · 69 · Cyclic chrono')
  await expect(tooltip).toHaveText(cellText(g, 12, 3, 28))

  const beforeScale = await liveScale(matrix)
  await page.mouse.wheel(0, -400)
  await expect.poll(() => liveScale(matrix)).toBeGreaterThan(beforeScale)
  await waitRaster(page)

  p = await matrixCellPoint(page, 12, 3)
  await page.mouse.move(p.x, p.y)
  await expect(tooltip).toHaveText(cellText(g, 12, 3, 28))

  const p2 = await matrixCellPoint(page, 20, 7)
  await page.mouse.move(p2.x, p2.y)
  await expect(tooltip).toHaveText(cellText(g, 20, 7, 28))
})

test('click pins and focuses the demon', async ({ page }) => {
  const dialog = await openMatrix(page, 'base=28')
  const matrix = dialog.locator('[data-demon-matrix]')

  const p = await matrixCellPoint(page, 12, 3)
  await page.mouse.move(p.x, p.y)
  const beforeScale = await liveScale(matrix)
  await page.mouse.wheel(0, -400)
  await expect.poll(() => liveScale(matrix)).toBeGreaterThan(beforeScale)
  await waitRaster(page)

  const p2 = await matrixCellPoint(page, 12, 3)
  await page.mouse.click(p2.x, p2.y)

  const detail = dialog.locator('aside[data-demon-detail]')
  await expect(detail).toContainText('c::3')
  await expect(detail).toContainText('69')
  await expect(detail).toContainText('Cyclic chrono')
  await expect(dialog.locator('rect[data-matrix-pinned]')).toHaveCount(1)
  await expect(page).toHaveURL(/demonFocus=12%3A%3A3/)
})

test('the syzygy diagonal is an explicit overlay', async ({ page }) => {
  const dialog = await openMatrix(page, 'base=28')
  await expect(dialog.locator('line[data-matrix-line="syzygy"]')).toHaveCount(1)
})

test('keyboard: arrows move the cursor, Enter pins', async ({ page }) => {
  const g = createNumogram(28)
  const dialog = await openMatrix(page, 'base=28')
  const matrix = dialog.locator('[data-demon-matrix]')
  const live = dialog.locator('[data-matrix-live]')

  await matrix.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(live).toHaveText(cellText(g, 3, 0, 28))

  await page.keyboard.press('ArrowDown')
  await expect(live).toHaveText(cellText(g, 3, 1, 28))

  await page.keyboard.press('Enter')
  const detail = dialog.locator('aside[data-demon-detail]')
  await expect(detail).toContainText(String(g.demons.ref(3, 1).mesh))

  const beforeScale = await liveScale(matrix)
  await page.keyboard.press('+')
  await expect.poll(() => liveScale(matrix)).toBeGreaterThan(beforeScale)
})

test('base 666 matrix renders with no diagram and resolves exactly after zooming in', async ({ page }) => {
  const g = createNumogram(666)
  const dialog = await openMatrix(page, 'base=666')
  await expect(page.locator(DIAGRAM)).toHaveCount(0)

  for (let i = 0; i < 6; i++) {
    const p = await matrixCellPoint(page, 15, 3)
    await page.mouse.move(p.x, p.y)
    await page.mouse.wheel(0, -400)
  }
  await waitRaster(page)

  const p = await matrixCellPoint(page, 15, 3)
  await page.mouse.move(p.x, p.y)
  await expect(dialog.locator('[data-matrix-tooltip]')).toHaveText('15::3 · 108 · Cross-Torque chrono')
  await expect(dialog.locator('[data-matrix-tooltip]')).toHaveText(cellText(g, 15, 3, 666))
})

test('raster timings are recorded, not asserted', async ({ page }) => {
  for (const base of [28, 666, 4096]) {
    const dialog = await openMatrix(page, `base=${base}`)
    const matrix = dialog.locator('[data-demon-matrix]')
    const rasterMs = parseFloat((await matrix.getAttribute('data-raster-ms')) ?? 'NaN')
    const scale = await matrix.getAttribute('data-scale')
    // eslint-disable-next-line no-console -- research A1: the measured answer belongs in the SUMMARY, not a threshold.
    console.log(`raster-ms base=${base} ms=${rasterMs} scale=${scale}`)
    expect(Number.isFinite(rasterMs)).toBe(true)
    expect(rasterMs).toBeGreaterThanOrEqual(0)
  }
})
