import { expect } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { tierFor } from '../app/lib/tierBounds'

// Shared Playwright helpers for Phase 4 UI specs (never collected as a spec: playwright.config.ts's testMatch is
// /\.spec\.ts$/ only). `panel` reuses e2e/behaviour.spec.ts's exact locator (header with exact text -> nearest
// fixed ancestor) so every new spec finds the same panel roots the frozen behaviour baseline does.

export const DIAGRAM = '[data-diagram]'
export const SUMMARY = 'section[aria-label="Numogram summary"]'
/** The Canvas tier's wrapper once it has painted the scene it was given (never the transient base-10 SVG, research P7). */
export const CANVAS_READY = '[data-render-tier="canvas"][data-canvas-state="ready"]'
/** The over-limit summary inside the headless tier wrapper. */
export const HEADLESS = `[data-render-tier="headless"] ${SUMMARY}`

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
 * A CyberRadio's wrapping `<label>` (by its exact visible text), clickable in place of `getByLabel`/`getByRole`:
 * the radio `<input>` itself is `sr-only` (visually 1px, positioned under its own decorative indicator `<span>`),
 * so Playwright's actionability check on the input directly reports the indicator "intercepts pointer events" and
 * times out. Clicking the label relies on the native HTML label-forwards-click-to-its-control behaviour instead.
 */
export function radioLabel(page: Page, text: string): Locator {
  return page.locator('label').filter({ hasText: new RegExp(`^${text}$`) })
}

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

// Waits until `selector` exists, one of its nodes is hydrated by React, and two animation frames have passed.
async function settleOn(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().waitFor()
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel)
      return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
    },
    selector,
  )
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}

/** The base named by a query string, or null when it names none (the viewer then opens at base 10). */
function queryBase(query: string): number | null {
  const raw = new URLSearchParams(query).get('base')
  return raw === null ? null : Number(raw)
}

/**
 * Navigate and wait for the Canvas tier to finish painting the requested base. openViewer would resolve on the transient
 * base-10 SVG that every page renders first (research P7), so this waits on the canvas wrapper's ready state instead and
 * checks that the wrapper belongs to the base the query names.
 */
export async function openCanvas(page: Page, query: string): Promise<void> {
  await page.goto(`/numogram/${query ? '?' + query : ''}`)
  await settleOn(page, CANVAS_READY)
  const base = queryBase(query)
  if (base !== null) await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', String(base))
}

/** Navigate and wait for the over-limit summary of the requested base (never the transient base-10 SVG). */
export async function openHeadless(page: Page, query: string): Promise<void> {
  await page.goto(`/numogram/${query ? '?' + query : ''}`)
  await settleOn(page, HEADLESS)
  const base = queryBase(query)
  if (base !== null) {
    // the text view's own header lines (whitespace is normalised by the matcher): the base is named exactly, never a prefix of another
    await expect(page.locator(`${HEADLESS} pre[aria-label="Numogram text"]`)).toContainText(`CCRUG numogram, base ${base} Zones: ${base} (`)
  }
}

/** openViewer, openCanvas or openHeadless, chosen by the tier table's own answer for `base` (no override). */
export async function openFor(page: Page, base: number, extra = ''): Promise<void> {
  const query = `base=${base}${extra ? '&' + extra : ''}`
  const tier = tierFor(base)
  if (tier === 'svg') await openViewer(page, query)
  else if (tier === 'canvas') await openCanvas(page, query)
  else await openHeadless(page, query)
}
