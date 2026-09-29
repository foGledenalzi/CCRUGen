import { test, expect, type Page } from '@playwright/test'
import tierTable from '../engine/scene/tier-table.json'
import { openViewer, selectionHeading } from './viewer-helpers'

// UI-02, D-14..D-18: the single URL codec drives the page. base= is the one strict field (a refused value falls
// back to base 10 without freezing); everything else is lenient. A valid base above the measured SVG ceiling shows
// the summary + text view instead of the diagram. tier= is a diagnostic URL-only override, never exercised here.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

const SVG_RICH_MAX_N = tierTable.boundaries.svgRichMaxN.n

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

test('?base=28 shows 28 zones, keeps base= in the URL, and survives reload', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  await expect(page).toHaveURL(/base=28/)

  await page.reload()
  await page.waitForSelector('[data-diagram="zones"] [data-zone]')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  await expect(page.locator('div.fixed.top-0 button')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('/numogram/?selected=5 keeps the legacy base-10 selection behaviour', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'selected=5')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(10)
  await expect(selectionHeading(page)).toHaveText(/\(1\)/)
  expect(errors).toEqual([])
})

test('/numogram/?layout=ladder&selected=5 renders the frozen ladder frame', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'layout=ladder&selected=5')
  await expect(page.locator('svg[viewBox="0 0 800 870"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('legacy /?base=28 redirect lands on /numogram/?base=28 with 28 zones', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/?base=28')
  await page.waitForURL(/\/numogram\/\?base=28$/)
  await page.waitForSelector('[data-diagram="zones"] [data-zone]')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  expect(errors).toEqual([])
})

for (const raw of ['99999999999', '27', '28abc']) {
  test(`?base=${raw} refuses without freezing and falls back to base 10`, async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page, `base=${raw}`)
    await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(10)
    expect(errors).toEqual([])
  })
}

test('?base=28&layout=planetary degrades to a procedural layout at 28 zones', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28&layout=planetary')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  expect(errors).toEqual([])
})

test('?base=1024 shows the summary card and text view, never the diagram', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=1024')

  const summary = page.locator('section[aria-label="Numogram summary"]')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('1024 zones')
  await expect(summary).toContainText(`(over ${SVG_RICH_MAX_N})`)
  await expect(page.locator('[data-diagram]')).toHaveCount(0)

  const text = page.locator('pre[aria-label="Numogram text"]')
  await expect(text).toHaveText(/^CCRUG numogram, base 1024/)
  expect(errors).toEqual([])
})

test('?base=28&layout=pairGraph renders 14 pair nodes', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28&layout=pairGraph')
  await expect(page.locator('[data-diagram="pairs"] [data-pair]')).toHaveCount(14)
  expect(errors).toEqual([])
})

test('?base=28: layout shortcuts switch layout, the digit shortcut is base-10 only', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  await page.keyboard.press('s')
  await page.waitForURL(/layout=ladder/)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)

  await page.keyboard.press('5')
  await expect(selectionHeading(page)).toHaveText('Selected Elements')
  expect(errors).toEqual([])
})

test('the diagram never emits NaN or undefined text (base 28, and ring at base 10)', async ({ page }) => {
  const errors = trackErrors(page)

  await openViewer(page, 'base=28')
  const html28 = await page.locator('[data-diagram]').first().evaluate(el => el.outerHTML)
  expect(html28).not.toContain('NaN')
  expect(html28).not.toContain('undefined')

  await openViewer(page, 'base=10&layout=ring')
  const html10Ring = await page.locator('[data-diagram]').first().evaluate(el => el.outerHTML)
  expect(html10Ring).not.toContain('NaN')
  expect(html10Ring).not.toContain('undefined')

  expect(errors).toEqual([])
})
