import { test, expect } from '@playwright/test'
import { createNumogram } from '../engine/index'
import { DIAGRAM, openViewer, panel } from './viewer-helpers'
import { demonList, demonRow, openDemons, searchDemons } from './demons-helpers'

// Proves DEM-03 (D-03, both focus-mode entry points) end to end against the static export: a zone click in the
// base-28 diagram drawing its incident demons as chords and showing in the overlay's Focus tab, a demon chosen in
// the overlay drawing its one chord and highlighting its two zones in the diagram, the old (non-focus-mode) zone
// click staying intact, the toggle clearing state, base 666 (no diagram at all) still working through the Focus
// tab's own zone input, and a `demonFocus=` URL reloading to the same view. Every expected count/label below is
// computed independently from `createNumogram(...)`, never from the app's own view model (see
// e2e/demons-browser.spec.ts for the same convention).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 5 UI specs run once (UTC context)'))

const DEMON_FOCUS_TOGGLE = 'button[aria-label="Demon focus"]'

test('diagram -> overlay: a zone click in Demon focus mode draws its base - 1 chords', async ({ page }) => {
  const g = createNumogram(28)
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-demon-focus]')).toHaveCount(0)

  await page.locator(DEMON_FOCUS_TOGGLE).click()
  await expect(page.locator(DEMON_FOCUS_TOGGLE)).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-zone="12"]').first().dispatchEvent('click')
  await expect(page.locator('[data-demon-focus]')).toHaveCount(g.base - 1)
  await expect(page).toHaveURL(/demonFocus=z%3A12/)
  await expect(page).not.toHaveURL(/selected=/)

  const dialog = await openDemons(page)
  await expect(dialog.getByRole('tab', { name: /^focus$/i })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.locator('canvas[data-focus-chords]')).toHaveAttribute('data-chord-count', String(g.base - 1))
  await expect(dialog.locator('[data-focus-summary]')).toContainText('Zone c')
  await expect(dialog.locator('[data-focus-summary]')).toContainText('27 demons')
  await expect(demonList(page, 'focus')).toHaveAttribute('aria-rowcount', String(g.base))
})

test('overlay -> diagram: choosing a demon draws its chord and highlights its zones', async ({ page }) => {
  await openViewer(page, 'base=28')
  await openDemons(page)
  await searchDemons(page, 'c::3')
  await demonRow(page, 'browser', 69).click()
  await page.keyboard.press('Escape')

  await expect(page.locator('[data-demon-focus]')).toHaveCount(1)
  await expect(page.locator('[data-demon-focus="12:3"]')).toHaveCount(1)

  const zone12Stroke = await page.locator('[data-zone="12"]').first().locator('circle').first().getAttribute('stroke')
  const zone3Stroke = await page.locator('[data-zone="3"]').first().locator('circle').first().getAttribute('stroke')
  const zone5Stroke = await page.locator('[data-zone="5"]').first().locator('circle').first().getAttribute('stroke')
  expect(zone12Stroke).not.toMatch(/44$/)
  expect(zone3Stroke).not.toMatch(/44$/)
  expect(zone5Stroke).toMatch(/44$/)

  await expect(page.locator(DEMON_FOCUS_TOGGLE)).toHaveAttribute('aria-pressed', 'true')
  await expect(panel(page, 'Selection')).toContainText('c::3')
})

test('mode off keeps the old zone click', async ({ page }) => {
  await openViewer(page, 'base=28')
  await page.locator('[data-zone="12"]').first().dispatchEvent('click')
  await expect(page).toHaveURL(/selected=12/)
  await expect(page.locator('[data-demon-focus]')).toHaveCount(0)
})

test('turning Demon focus off clears the chords and the URL', async ({ page }) => {
  const g = createNumogram(28)
  await openViewer(page, 'base=28')
  await page.locator(DEMON_FOCUS_TOGGLE).click()
  await page.locator('[data-zone="12"]').first().dispatchEvent('click')
  await expect(page.locator('[data-demon-focus]')).toHaveCount(g.base - 1)
  await expect(page).toHaveURL(/demonFocus=z%3A12/)

  await page.locator(DEMON_FOCUS_TOGGLE).click()
  await expect(page.locator(DEMON_FOCUS_TOGGLE)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-demon-focus]')).toHaveCount(0)
  await expect(page).not.toHaveURL(/demonFocus/)
})

test('base 666 has no diagram but focus still works', async ({ page }) => {
  const g = createNumogram(666)
  expect(g.base - 1).toBe(665)

  await openViewer(page, 'base=666')
  await expect(page.locator(DIAGRAM)).toHaveCount(0)
  const dialog = await openDemons(page)
  await dialog.getByRole('tab', { name: /^focus$/i }).click()

  const zoneInput = dialog.locator('input[aria-label="Focus zone"]')
  await zoneInput.fill('12')
  await zoneInput.press('Enter')

  const canvas = dialog.locator('canvas[data-focus-chords]')
  await expect(canvas).toHaveAttribute('data-chord-total', '665')
  await expect(canvas).toHaveAttribute('data-chord-count', '665')
  await expect(demonList(page, 'focus')).toHaveAttribute('aria-rowcount', '666')

  const firstRow = demonList(page, 'focus').locator('[data-demon-row]').first()
  await firstRow.click()
  await expect(dialog.locator('aside[data-demon-detail]')).toContainText('MESH')

  await dialog.locator('button[data-clear-focus]').click()
  await expect(dialog.locator('canvas[data-focus-chords]')).toHaveCount(0)

  await zoneInput.fill('700')
  await zoneInput.press('Enter')
  await expect(dialog.locator('[data-focus-error]')).toContainText("Couldn't parse")
})

test('a demon focus link reloads to the same view', async ({ page }) => {
  await openViewer(page, 'base=28&demonFocus=12%3A%3A3')
  await expect(page.locator('[data-demon-focus="12:3"]')).toHaveCount(1)
  await expect(panel(page, 'Selection')).toContainText('c::3')
})
