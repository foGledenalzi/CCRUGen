import { test, expect, type Page } from '@playwright/test'
import { openViewer, radioLabel } from './viewer-helpers'

// UI-03 (interactive half, D-08..D-13): Digits/Xeno/preset/custom label schemes are live session state, changing the
// diagram immediately and round-tripping the labels= URL field. Zone identity in the URL always stays the integer
// (selected=), never the current label, even when that label is a letter.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

async function openDropdown(page: Page): Promise<void> {
  await page.getByLabel('Base', { exact: true }).click()
}

function boldLabel(page: Page, zone: number) {
  return page.locator(`[data-zone="${zone}"] text[font-weight="bold"]`).first()
}

test('Xeno labels zone 4 as :: at base 40, round-trips the URL and survives reload', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=40')

  await openDropdown(page)
  await radioLabel(page, 'Xeno').click()
  await expect(boldLabel(page, 4)).toHaveText('::')
  await expect(page).toHaveURL(/labels=xeno/)

  await page.reload()
  await page.waitForSelector('[data-diagram="zones"] [data-zone]')
  await expect(boldLabel(page, 4)).toHaveText('::')
  expect(errors).toEqual([])
})

test('Custom -> Base62 preset labels zone 36 as a and updates the URL', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=40')

  await openDropdown(page)
  await radioLabel(page, 'Custom').click()
  await page.getByRole('button', { name: 'Base62', exact: true }).click()

  await expect(boldLabel(page, 36)).toHaveText('a')
  await expect(page).toHaveURL(/labels=preset%3Abase62/)
  expect(errors).toEqual([])
})

test('a repeated custom character is refused and never applied (D-12)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=40')

  await openDropdown(page)
  await radioLabel(page, 'Custom').click()
  await page.getByRole('button', { name: 'Base62', exact: true }).click()
  await expect(boldLabel(page, 36)).toHaveText('a')

  await page.getByLabel('Custom characters').fill('abca')
  await expect(page.getByText("'a' repeats — every character must be unique.")).toBeVisible()
  await expect(boldLabel(page, 36)).toHaveText('a')
  expect(errors).toEqual([])
})

test('a too-short custom alphabet falls back to numerals until it covers the base', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=12')

  await openDropdown(page)
  await radioLabel(page, 'Custom').click()

  const before = await boldLabel(page, 11).textContent()
  const input = page.getByLabel('Custom characters')
  await input.fill('ABCDEFGHIJ')
  await expect(page.getByText('Needs 2 more character(s) for base 12.')).toBeVisible()
  await expect(boldLabel(page, 11)).toHaveText(before ?? '')

  await input.fill('ABCDEFGHIJKL')
  await expect(boldLabel(page, 11)).toHaveText('L')
  await expect(page).toHaveURL(/labels=custom%3A/)
  expect(errors).toEqual([])
})

test('zone identity in the URL stays the integer even under a letter label', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=40')

  await openDropdown(page)
  await radioLabel(page, 'Custom').click()
  await page.getByRole('button', { name: 'Base62', exact: true }).click()
  await expect(boldLabel(page, 36)).toHaveText('a')

  await page.locator('[data-zone="36"]').click()
  await expect(page).toHaveURL(/selected=36/)
  expect(errors).toEqual([])
})

test('Digits mode: the engine\'s own numerals at base 16 and base 40', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=16')
  await expect(boldLabel(page, 15)).toHaveText('f')

  await openViewer(page, 'base=40')
  await expect(boldLabel(page, 36)).toHaveText('36')
  expect(errors).toEqual([])
})
