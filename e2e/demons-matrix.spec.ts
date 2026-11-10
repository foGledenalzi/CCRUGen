import { test, expect, type Locator, type Page } from '@playwright/test'
import { createNameResolver, createNumogram, formatNumeral, type NameResolver, type Numogram } from '../engine/index'
import { SUBTYPE_LABEL } from '../app/lib/demonBrowser'
import { NAME_TOOLTIP_GRAPHEMES } from '../app/lib/namingLimits'
import { defaultNamingFor, type NamingEnv } from '../app/lib/namingSession'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { openFor } from './viewer-helpers'
import { matrixCellPoint, openDemons, waitRaster } from './demons-helpers'

// Proves DEM-04 (D-06) end to end against the static export: the triangular matrix identifies and pins the exact
// cell under the cursor at any zoom level (never from the raster, research A2), keyboard access, the syzygy
// diagonal overlay, base 666 beside the canvas diagram, and the matrix's raster-fill timings (research A1) logged for the
// SUMMARY rather than asserted against a threshold (T-05-38: tests never depend on this PC's speed).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 5 UI specs run once (UTC context)'))

const MIDDLE_DOT = String.fromCodePoint(0xb7)

const NAMING_ENV: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }
const ELLIPSIS = String.fromCodePoint(0x2026)

/** One resolver per base: the engine's own names for the default naming of the base (Phase 7 D-03), never the app's display code. */
const resolvers = new Map<number, NameResolver>()
function resolverFor(base: number): NameResolver {
  let resolver = resolvers.get(base)
  if (resolver === undefined) {
    resolver = createNameResolver(defaultNamingFor(base, NAMING_ENV), CCRU_NAMING_PRESET)
    resolvers.set(base, resolver)
  }
  return resolver
}

/** A name cut to NAME_TOOLTIP_GRAPHEMES user-perceived characters (the first limit minus one and an ellipsis), as the matrix cuts it. */
function cutName(name: string): string {
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name), s => s.segment)
  if (graphemes.length <= NAME_TOOLTIP_GRAPHEMES) return name
  return graphemes.slice(0, NAME_TOOLTIP_GRAPHEMES - 1).join('') + ELLIPSIS
}

/**
 * `A::B · Name · MESH · SubtypeLabel`, matching DemonMatrix.tsx's own `demonText` exactly (digits label scheme, default). The name is the
 * engine's name for the default naming of the base (Phase 7 D-03: every base has a naming now), cut like the tooltip cuts it.
 */
function cellText(g: Numogram, a: number, b: number, base: number): string {
  const d = g.demons.ref(a, b)
  const name = cutName(resolverFor(base).nameOf(a, b))
  return [`${formatNumeral(a, base)}::${formatNumeral(b, base)}`, name, d.mesh, SUBTYPE_LABEL[d.subtype]].join(` ${MIDDLE_DOT} `)
}

async function liveScale(matrix: Locator): Promise<number> {
  return parseFloat((await matrix.getAttribute('data-scale')) ?? '0')
}

/** Opens the viewer, the demons overlay, and switches to the Matrix tab, waiting for its first raster to finish. */
async function openMatrix(page: Page, base: number): Promise<Locator> {
  await openFor(page, base)
  const dialog = await openDemons(page)
  await dialog.getByRole('tab', { name: /^matrix$/i }).click()
  await waitRaster(page)
  return dialog
}

test('base 28: hover identifies the exact cell at fit and after zooming', async ({ page }) => {
  const g = createNumogram(28)
  const dialog = await openMatrix(page, 28)
  const matrix = dialog.locator('[data-demon-matrix]')
  const tooltip = dialog.locator('[data-matrix-tooltip]')

  let p = await matrixCellPoint(page, 12, 3)
  await page.mouse.move(p.x, p.y)
  // the pre-naming literal tooltip text (net-span, mesh, subtype) is gone: the tooltip now carries the demon's generated name between
  // the net-span and the mesh number, so the expected text is built from the engine's name for the default naming of the base
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
  const dialog = await openMatrix(page, 28)
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
  const dialog = await openMatrix(page, 28)
  await expect(dialog.locator('line[data-matrix-line="syzygy"]')).toHaveCount(1)
})

test('keyboard: arrows move the cursor, Enter pins', async ({ page }) => {
  const g = createNumogram(28)
  const dialog = await openMatrix(page, 28)
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

test('base 666 matrix renders beside the canvas diagram and resolves exactly after zooming in', async ({ page }) => {
  const g = createNumogram(666)
  const dialog = await openMatrix(page, 666)
  await expect(page.locator('[data-render-tier="canvas"] canvas[data-diagram="zones"]')).toHaveCount(1)

  for (let i = 0; i < 6; i++) {
    const p = await matrixCellPoint(page, 15, 3)
    await page.mouse.move(p.x, p.y)
    await page.mouse.wheel(0, -400)
  }
  await waitRaster(page)

  const p = await matrixCellPoint(page, 15, 3)
  await page.mouse.move(p.x, p.y)
  // the pre-naming literal tooltip text is gone for the same reason (the name now sits before the mesh number)
  await expect(dialog.locator('[data-matrix-tooltip]')).toHaveText(cellText(g, 15, 3, 666))
})

test('raster timings are recorded, not asserted', async ({ page }) => {
  for (const base of [28, 666, 4096]) {
    const dialog = await openMatrix(page, base)
    const matrix = dialog.locator('[data-demon-matrix]')
    const rasterMs = parseFloat((await matrix.getAttribute('data-raster-ms')) ?? 'NaN')
    const scale = await matrix.getAttribute('data-scale')
    // eslint-disable-next-line no-console -- research A1: the measured answer belongs in the SUMMARY, not a threshold.
    console.log(`raster-ms base=${base} ms=${rasterMs} scale=${scale}`)
    expect(Number.isFinite(rasterMs)).toBe(true)
    expect(rasterMs).toBeGreaterThanOrEqual(0)
  }
})
