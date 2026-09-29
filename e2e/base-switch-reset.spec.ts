import { test, expect, type Page } from '@playwright/test'
import { openViewer, panel, selectionHeading } from './viewer-helpers'

// UI-08 (research Pattern 4): switching the base clears selection, pin, region highlight, Time Circuit, orbiting,
// pending share-fit, the orientation cache and the whole undo/redo history in one batched commit, and never tweens
// across two bases. Undo after a switch can never bring back the previous base's state.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

async function commitBaseViaInput(page: Page, base: number): Promise<void> {
  const input = page.getByLabel('Base', { exact: true })
  await input.click()
  await input.fill(String(base))
}

test('switching base clears selection and the undo stack; undo cannot restore the old base', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  await page.locator('[data-zone="3"]').click()
  await page.locator('[data-zone="5"]').click()
  await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
  await expect(page.locator('button[aria-label="Undo"]')).toBeEnabled()

  await commitBaseViaInput(page, 12)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(12)
  await expect(selectionHeading(page)).toHaveText('Selected Elements')
  await expect(page.locator('button[aria-label="Undo"]')).toBeDisabled()
  await expect(page).not.toHaveURL(/selected=/)

  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(12)
  expect(errors).toEqual([])
})

test('switching base drops a stale region= from the URL', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28&region=torque:0')

  await commitBaseViaInput(page, 16)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(16)
  await expect(page).not.toHaveURL(/region=/)
  expect(errors).toEqual([])
})

test('pinning a zone then switching base leaves only the Numogram intro item', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  await page.locator('[data-zone="3"]').click()
  await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)

  await commitBaseViaInput(page, 12)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(12)
  await expect(selectionHeading(page)).toHaveText('Selected Elements')
  await expect(panel(page, 'Selection').getByText('Numogram', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('committing a base mid-tween interrupts the tween and never mixes two bases', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=10')

  await page.keyboard.press('s')

  const input = page.getByLabel('Base', { exact: true })
  await input.click()
  await input.fill('28')
  await input.press('Enter')

  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  await expect.poll(
    () => page.locator('[data-diagram="zones"]').getAttribute('viewBox'),
    { timeout: 700 },
  ).not.toBe('0 0 800 880')
  expect(errors).toEqual([])
})
