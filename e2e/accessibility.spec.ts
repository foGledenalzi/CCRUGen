import { test, expect, type Page } from '@playwright/test'
import { openViewer, panel } from './viewer-helpers'

// UI-07: roving-tabindex keyboard traversal, ARIA names, non-colour cues and reduced-motion handling for both
// diagrams (Projection.tsx and PairGraphProjection.tsx). The text view lands in 04-15.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

/** Presses Tab (up to `maxPresses` times) until the active element carries `data-focus-key` — the diagram is one
 * Tab stop among the page's many other controls. */
async function tabIntoDiagram(page: Page, maxPresses = 80): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const key = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key') ?? null)
    if (key !== null) return
  }
  throw new Error(`did not reach a data-focus-key element within ${maxPresses} Tab presses`)
}

async function activeFocusKey(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-focus-key') ?? null)
}

test('base 28: Tab reaches the diagram, ArrowRight cycles through all 84 elements and wraps back to zone:0', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await tabIntoDiagram(page)

  expect(await page.locator('[data-diagram="zones"] [tabindex="0"]').count()).toBe(1)

  const keys: string[] = []
  for (let i = 0; i < 84; i++) {
    const key = await activeFocusKey(page)
    keys.push(key ?? '')
    await page.keyboard.press('ArrowRight')
  }
  const wrapped = await activeFocusKey(page)

  expect(new Set(keys).size).toBe(84)
  expect(keys[0]).toBe('zone:0')
  expect(keys).toContain('syzygy:13:14')
  expect(wrapped).toBe('zone:0')
  expect(await page.locator('[data-diagram="zones"] [tabindex="0"]').count()).toBe(1)
  expect(errors).toEqual([])
})

test('base 28: every focusable diagram element has role=button and a non-empty aria-label; zone 15 names its Torque', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')

  const roles = await page.locator('[data-focus-key]').evaluateAll(els => els.map(el => el.getAttribute('role')))
  expect(roles.length).toBe(84)
  expect(roles.every(r => r === 'button')).toBe(true)

  const labels = await page.locator('[data-focus-key]').evaluateAll(els => els.map(el => el.getAttribute('aria-label')))
  expect(labels.every(l => typeof l === 'string' && l.length > 0)).toBe(true)

  const zone15Label = await page.locator('[data-focus-key="zone:15"]').getAttribute('aria-label')
  expect(zone15Label).toMatch(/^Zone f, Torque/)
  expect(errors).toEqual([])
})

test('base 28: keyboard-focusing zone 15 and pressing Enter selects it like a click', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await tabIntoDiagram(page)
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight')
  expect(await activeFocusKey(page)).toBe('zone:15')

  await page.keyboard.press('Enter')

  await expect(page.locator('[data-focus-key="zone:15"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel(page, 'Selection')).toContainText('Zone f')
  await expect(page).toHaveURL(/selected=15/)
  expect(errors).toEqual([])
})

test('base 28 mute=plex: the muted zones are excluded from the traversal order', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28&mute=plex')
  await expect(page.locator('[data-focus-key="zone:0"]')).toHaveCount(0)
  await expect(page.locator('[data-focus-key="zone:27"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('base 28: the keyboard-focused diagram element shows a solid focus outline', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await tabIntoDiagram(page)
  const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)
  expect(outlineStyle).toBe('solid')
  expect(errors).toEqual([])
})

test('reduced motion: layout switch (key s) is instant — the sampled viewBox height is always 940 or 880', async ({ page }) => {
  const errors = trackErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openViewer(page)

  await page.keyboard.press('s')
  const samples = await page.evaluate(() => new Promise<string[]>(resolve => {
    const out: string[] = []
    const start = performance.now()
    const tick = () => {
      const svg = document.querySelector('[data-diagram="zones"]')
      const vb = svg?.getAttribute('viewBox')?.split(' ') ?? []
      out.push(vb[3] ?? '')
      if (performance.now() - start < 300) requestAnimationFrame(tick)
      else resolve(out)
    }
    requestAnimationFrame(tick)
  }))

  expect(samples.length).toBeGreaterThan(0)
  expect(samples.every(h => h === '940' || h === '880')).toBe(true)
  expect(errors).toEqual([])
})

test('reduced motion: ?particles=1 renders zero animateMotion elements', async ({ page }) => {
  const errors = trackErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openViewer(page, 'particles=1')
  expect(await page.locator('[data-diagram] animateMotion').count()).toBe(0)
  expect(errors).toEqual([])
})

test('without reduced motion, ?particles=1 renders more than zero animateMotion elements', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'particles=1')
  expect(await page.locator('[data-diagram] animateMotion').count()).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('reduced motion: the planetary orbit control is disabled', async ({ page }) => {
  const errors = trackErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openViewer(page, 'layout=planetary')
  const orbitButton = page.locator('button').filter({ hasText: 'Z' }).first()
  await expect(orbitButton).toBeDisabled()
  expect(errors).toEqual([])
})

test('digit-key gate shortcut stays base-10 only: base 10 selects zones 5 and 6', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)
  await page.keyboard.press('5')
  await expect(page).toHaveURL(/selected=5%2C6/)
  expect(errors).toEqual([])
})

test('digit-key gate shortcut stays base-10 only: base 28 leaves the URL unchanged', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await page.keyboard.press('5')
  await expect(page).not.toHaveURL(/selected=/)
  expect(errors).toEqual([])
})

test('base 28 pair graph: Tab reaches a pair pill, ArrowRight visits 14 distinct pairs', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28&layout=pairGraph')
  await tabIntoDiagram(page)

  const firstKey = await activeFocusKey(page)
  expect(firstKey).toMatch(/^pair:/)

  const keys = new Set<string>()
  for (let i = 0; i < 14; i++) {
    const key = await activeFocusKey(page)
    keys.add(key ?? '')
    await page.keyboard.press('ArrowRight')
  }
  expect(keys.size).toBe(14)
  expect(errors).toEqual([])
})
