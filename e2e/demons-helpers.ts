import { expect, type Locator, type Page } from '@playwright/test'

// Shared helpers for the Phase 5 demons specs (never collected as a spec: playwright.config.ts's testMatch is
// /\.spec\.ts$/ only, so this file — like e2e/viewer-helpers.ts — is imported, not run directly).

/** The demons overlay's dialog root (`role="dialog"`, D-01). */
export const demonsDialog = (page: Page): Locator => page.locator('[role="dialog"][aria-label="Demons"]')

/** Clicks the header "Browse demons" button and waits for the overlay dialog to become visible. */
export async function openDemons(page: Page): Promise<Locator> {
  await page.locator('button[aria-label="Browse demons"]').click()
  const dialog = demonsDialog(page)
  await dialog.waitFor({ state: 'visible' })
  return dialog
}

/** A facet chip button by its `data-facet` id (`all`, a `DemonType`, or a `DemonSubtype`). */
export const facet = (page: Page, id: string): Locator => demonsDialog(page).locator(`button[data-facet="${id}"]`)

/** The browser or focus tab's virtualized row grid (`data-demon-list`). */
export const demonList = (page: Page, id: 'browser' | 'focus'): Locator =>
  demonsDialog(page).locator(`[data-demon-list="${id}"]`)

/** A single row inside a demon list, by its mesh number (`data-demon-row`). */
export const demonRow = (page: Page, id: 'browser' | 'focus', mesh: number): Locator =>
  demonList(page, id).locator(`[data-demon-row="${mesh}"]`)

/** Fills the browser's search box and presses Enter (bumps the reveal even when the query text is unchanged). */
export async function searchDemons(page: Page, text: string): Promise<void> {
  const input = demonsDialog(page).locator('input[aria-label="Search demons"]')
  await input.fill(text)
  await input.press('Enter')
}

/** Waits for the Matrix tab's progressive canvas raster to finish (`data-raster-state="done"`). */
export async function waitRaster(page: Page): Promise<void> {
  await expect(demonsDialog(page).locator('[data-demon-matrix]')).toHaveAttribute('data-raster-state', 'done', {
    timeout: 15_000,
  })
}

/**
 * Page coordinates of a matrix cell's centre, read from the live transform (`data-scale`/`data-tx`/`data-ty`, CSS
 * px from the container's own top-left) and the container's current bounding box. Never derived from the raster.
 */
export async function matrixCellPoint(page: Page, a: number, b: number): Promise<{ x: number; y: number }> {
  const matrix = demonsDialog(page).locator('[data-demon-matrix]')
  const box = await matrix.boundingBox()
  if (!box) throw new Error('[data-demon-matrix] has no bounding box')
  const scale = parseFloat((await matrix.getAttribute('data-scale')) ?? '0')
  const tx = parseFloat((await matrix.getAttribute('data-tx')) ?? '0')
  const ty = parseFloat((await matrix.getAttribute('data-ty')) ?? '0')
  return { x: box.x + tx + (a + 0.5) * scale, y: box.y + ty + (b + 0.5) * scale }
}
