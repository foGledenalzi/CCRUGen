import { test, expect, type Page } from '@playwright/test'
import { createNumogram, torqueLabel } from '../engine/index'
import { openViewer, panel } from './viewer-helpers'

// UI-05, D-19..D-24: the region legend is a stable-id row per Torque cycle (then Warp, then Plex) at any base, each
// with independent Isolate (spotlight) and Mute (hard hide) toggles carried in the URL/history (isolate=/mute=) and
// cleared on a base change (UI-08). Base 10 keeps its frozen row text unchanged.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function isolateButton(page: Page, label: string) {
  return page.getByRole('button', { name: `Isolate ${label}`, exact: true })
}
function muteButton(page: Page, label: string) {
  return page.getByRole('button', { name: `Mute ${label}`, exact: true })
}
async function rowTexts(page: Page): Promise<string[]> {
  return panel(page, 'Regions').locator('div.cursor-pointer').allTextContents()
}
async function openBaseDropdown(page: Page): Promise<void> {
  await page.getByLabel('Base', { exact: true }).click()
}

test('?base=64: one row per Torque cycle (labelled A, B, ...), then Warp, then Plex, each with Isolate and Mute', async ({ page }) => {
  const g = createNumogram(64)
  await openViewer(page, 'base=64')

  const expectedRowCount = g.torqueCount + (g.warp !== null ? 1 : 0) + 1
  await expect(isolateButton(page, `Torque ${torqueLabel(0)}`)).toBeVisible()
  await expect(panel(page, 'Regions').getByRole('button', { name: /^Isolate / })).toHaveCount(expectedRowCount)
  await expect(panel(page, 'Regions').getByRole('button', { name: /^Mute / })).toHaveCount(expectedRowCount)

  const texts = await rowTexts(page)
  for (let i = 0; i < g.torqueCount; i++) {
    expect(texts[i]).toMatch(new RegExp(`^Torque ${torqueLabel(i)}`))
  }
})

test('?base=64: isolate, multi-isolate, mute-wins, independence and reload persistence (D-19, D-21, D-22)', async ({ page }) => {
  const g = createNumogram(64)
  const torque0Zone = Array.from(g.torques[0].zones())[0]
  const torque1Zone = Array.from(g.torques[1].zones())[0]

  await openViewer(page, 'base=64')

  await isolateButton(page, 'Torque A').click()
  await expect(isolateButton(page, 'Torque A')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/isolate=torque%3A0/)
  expect(await page.locator(`[data-zone="${torque0Zone}"]`).getAttribute('opacity')).toBeNull()
  expect(await page.locator('[data-zone="0"]').getAttribute('opacity')).toBe('0.2')

  // multi-isolate (D-22): isolating a second region normalizes it too, without clearing the first.
  await isolateButton(page, 'Plex').click()
  expect(await page.locator('[data-zone="0"]').getAttribute('opacity')).toBeNull()
  expect(await page.locator(`[data-zone="${torque1Zone}"]`).getAttribute('opacity')).toBe('0.2')

  // mute wins over isolate for the same region (D-19).
  await muteButton(page, 'Plex').click()
  await expect(page.locator('[data-zone="0"]')).toHaveCount(0)
  await expect(page.locator('[data-zone="63"]')).toHaveCount(0)
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel(page, 'Regions').locator('span').filter({ hasText: /^Plex$/ }))
    .toHaveCSS('text-decoration-line', 'line-through')

  // independence: un-isolating Torque A never touches Mute Plex.
  await isolateButton(page, 'Torque A').click()
  await expect(isolateButton(page, 'Torque A')).toHaveAttribute('aria-pressed', 'false')
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')

  // reload: the filter round-trips through the URL (D-21).
  await page.reload()
  await page.waitForSelector('[data-diagram="zones"] [data-zone]')
  await expect(isolateButton(page, 'Torque A')).toHaveAttribute('aria-pressed', 'false')
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-zone="0"]')).toHaveCount(0)
  await expect(page.locator('[data-zone="63"]')).toHaveCount(0)
})

test('?base=12&isolate=torque:5,warp&mute=plex: stale ids are dropped silently', async ({ page }) => {
  await openViewer(page, 'base=12&isolate=torque:5,warp&mute=plex')

  const isolateButtons = panel(page, 'Regions').getByRole('button', { name: /^Isolate / })
  const pressedStates = await isolateButtons.evaluateAll(els => els.map(el => el.getAttribute('aria-pressed')))
  expect(pressedStates.every(v => v === 'false')).toBe(true)
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')
})

test('?base=10: the legend text is unchanged (Torque, Warp, Plex, Time Circuit)', async ({ page }) => {
  await openViewer(page, 'base=10')

  const texts = await rowTexts(page)
  expect(texts[0]).toMatch(/^Torque/)
  expect(texts[0]).toContain('1 2 4 5 7 8')
  expect(texts[1]).toMatch(/^Warp/)
  expect(texts[2]).toMatch(/^Plex/)
  expect(texts[3]).toBe('Time Circuit')
})

test('?base=28&layout=pairGraph&mute=plex: the muted pair disappears, 13 pills remain', async ({ page }) => {
  await openViewer(page, 'base=28&layout=pairGraph&mute=plex')

  await expect(page.locator('[data-pair="0"]')).toHaveCount(0)
  await expect(page.locator('[data-diagram="pairs"] [data-pair]')).toHaveCount(13)
})

test('switching base clears the pressed states and removes isolate=/mute= from the URL (UI-08)', async ({ page }) => {
  await openViewer(page, 'base=64&isolate=torque:0&mute=plex')
  await expect(isolateButton(page, 'Torque A')).toHaveAttribute('aria-pressed', 'true')
  await expect(muteButton(page, 'Plex')).toHaveAttribute('aria-pressed', 'true')

  await openBaseDropdown(page)
  await page.getByRole('button', { name: '16', exact: true }).click()
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(16)

  await expect(page).not.toHaveURL(/isolate=/)
  await expect(page).not.toHaveURL(/mute=/)
  const anyPressed = await panel(page, 'Regions').locator('[aria-pressed="true"]').count()
  expect(anyPressed).toBe(0)
})
