import { test, expect, type Page } from '@playwright/test'
import tierTable from '../engine/scene/tier-table.json'
import { DIAGRAM, SUMMARY, openViewer, radioLabel } from './viewer-helpers'

// UI-01, UI-02: the header base picker (04-12) is the way a visitor changes base — typed/stepped/slid/chipped, all
// through one sanitized commit path (app/lib/baseSwitch.ts). base= is the one strict URL field (D-06): a refused
// candidate never freezes the picker and always echoes the exact UI-SPEC copy next to it.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

const SVG_RICH_MAX_N = tierTable.boundaries.svgRichMaxN.n

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

function baseInput(page: Page) {
  return page.getByLabel('Base', { exact: true })
}

async function openDropdown(page: Page): Promise<void> {
  await baseInput(page).click()
}

async function typeCandidate(page: Page, text: string): Promise<void> {
  await openDropdown(page)
  await baseInput(page).fill(text)
}

// The live-preview `<output aria-live="polite">` also carries the implicit ARIA "status" role, same as the refusal
// paragraph/span — scope to the refusal's own copy ("Showing base ...") so this never matches the candidate echo.
function refusalStatus(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Showing base' }).first()
}

test('default: base 10, live summary matches the engine', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)

  const input = baseInput(page)
  await expect(input).toHaveValue('10')
  const describedBy = await input.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('10 zones · Warp yes · Torque [3] · 45 demons')
  expect(errors).toEqual([])
})

test('type: 28 shows 28 zones, the live summary and base= in the URL', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)

  await typeCandidate(page, '28')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  const describedBy = await baseInput(page).getAttribute('aria-describedby')
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('28 zones · Warp yes · Torque [9,3] · 378 demons')
  await expect(page).toHaveURL(/base=28/)
  expect(errors).toEqual([])
})

test('odd: 27 is refused with the exact UI-SPEC copy and keeps the last valid base (D-06)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  await typeCandidate(page, '27')
  await expect(refusalStatus(page)).toHaveText(
    'Base 27 is odd — numograms need an even base. Showing base 28.',
  )
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  expect(errors).toEqual([])
})

test('absurd: an astronomically large candidate is refused and the picker keeps responding', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  // Even (not just large): validateBase checks oddness before the ceiling, so an odd huge candidate would be refused
  // as 'odd' first, never reaching 'too-large'.
  await typeCandidate(page, '99999999998')
  await expect(refusalStatus(page)).toHaveText(
    'Base 99999999998 is above the safe ceiling (2^26). Showing base 28.',
  )

  await page.getByRole('button', { name: '64', exact: true }).click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(64)
  expect(errors).toEqual([])
})

test('steppers: +/- change the base by 2 (D-05)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  await baseInput(page).focus()
  await page.getByLabel('Increase base by 2').click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(30)

  await page.getByLabel('Decrease base by 2').click()
  await page.getByLabel('Decrease base by 2').click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(26)
  expect(errors).toEqual([])
})

test('slider: ArrowRight steps by 2 per press, debounced', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=26')

  await baseInput(page).focus()
  const slider = page.getByLabel('Base slider')
  await slider.focus()
  for (let i = 0; i < 7; i++) await slider.press('ArrowRight')
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(40)
  expect(errors).toEqual([])
})

test('chips: the notable-base strip, in order, and clicking one commits it (D-07)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)

  await openDropdown(page)
  const chips = page.locator('div.flex.gap-1.overflow-x-auto').first().locator('button')
  await expect(chips).toHaveText(['2', '4', '6', '8', '10', '12', '16', '22', '28', '64', '80', '82', '100', '1024'])

  await chips.filter({ hasText: /^64$/ }).click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(64)

  await chips.filter({ hasText: /^1024$/ }).click()
  const summary = page.locator(SUMMARY)
  await expect(summary).toBeVisible()
  await expect(summary).toContainText(`(over ${SVG_RICH_MAX_N})`)
  await expect(page.locator(DIAGRAM)).toHaveCount(0)

  await chips.filter({ hasText: /^10$/ }).click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(10)
  expect(errors).toEqual([])
})

test('URL refusal: ?base=27 shows the on-load refusal and falls back to base 10 (UI-02)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=27')

  await expect(refusalStatus(page)).toHaveText(
    'Base 27 is odd — numograms need an even base. Showing base 10.',
  )
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(10)
  expect(errors).toEqual([])
})

test('packer: switching to Spiral at base 64 moves the zones and updates the URL (todo 005)', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=64')

  const shelfCx = await page.locator('[data-zone="1"] circle').first().getAttribute('cx')

  await openDropdown(page)
  await radioLabel(page, 'Spiral').click()
  await expect(page).toHaveURL(/packer=spiral/)

  const spiralCx = await page.locator('[data-zone="1"] circle').first().getAttribute('cx')
  expect(spiralCx).not.toBe(shelfCx)
  expect(errors).toEqual([])
})

test('layout: the header never overlaps the fixed layout switcher at 1280x900', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)

  const headerBox = await page.locator('header').filter({ hasText: 'CCRUG' }).first().boundingBox()
  const switcherBox = await page.locator('div.fixed.top-0 div.inline-flex').first().boundingBox()
  expect(headerBox).not.toBeNull()
  expect(switcherBox).not.toBeNull()
  if (headerBox && switcherBox) {
    const overlapsX = headerBox.x < switcherBox.x + switcherBox.width && switcherBox.x < headerBox.x + headerBox.width
    const overlapsY = headerBox.y < switcherBox.y + switcherBox.height && switcherBox.y < headerBox.y + headerBox.height
    expect(overlapsX && overlapsY).toBe(false)
  }
  expect(errors).toEqual([])
})
