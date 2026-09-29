import type { BrowserContext, Locator, Page } from '@playwright/test'

// Shared Playwright helpers for Phase 4 UI specs (never collected as a spec: playwright.config.ts's testMatch is
// /\.spec\.ts$/ only). `panel` reuses e2e/behaviour.spec.ts's exact locator (header with exact text -> nearest
// fixed ancestor) so every new spec finds the same panel roots the frozen behaviour baseline does.

export const DIAGRAM = '[data-diagram]'
export const SUMMARY = 'section[aria-label="Numogram summary"]'

export function panel(page: Page, name: string): Locator {
  return page
    .locator('header')
    .filter({ hasText: new RegExp(`^${name}$`) })
    .first()
    .locator('xpath=ancestor::div[contains(translate(@style," ",""),"position:fixed")][1]')
}

export const selectionHeading = (page: Page) =>
  panel(page, 'Selection').locator('span').filter({ hasText: /Selected Elements/ }).first()

/**
 * Stub navigator.share (undefined) and navigator.clipboard (an in-memory store) so a spec can exercise the share
 * flow identically on every OS without touching the developer machine's clipboard or share sheet. Mirrors
 * e2e/behaviour.spec.ts's openPage init script.
 */
export async function stubClipboard(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    let store = ''
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t: unknown) => { store = String(t) }, readText: async () => store },
      configurable: true,
    })
  })
}

/** Navigate to the viewer, wait for the diagram (or the big-base summary) to mount and settle one paint. */
export async function openViewer(page: Page, query = ''): Promise<void> {
  await page.goto(`/numogram/${query ? '?' + query : ''}`)
  const root = page.locator(`${DIAGRAM}, ${SUMMARY}`).first()
  await root.waitFor()
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel)
      return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
    },
    `${DIAGRAM}, ${SUMMARY}`,
  )
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}
