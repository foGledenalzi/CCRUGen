import { test, expect, type Page } from '@playwright/test'
import { extractTree, normalizeTree } from './visual-dom'

// FND-02 DOM oracle (D-14): 3 non-planetary layouts x 10 static states, captured from the untouched viewer.
const HEIGHT = { original: 940, labyrinth: 880, ladder: 870 } as const   // svgHeight targets in app/hooks/useTween.ts
const PIN = 'date=2000-01-01&orbits=0&particles=0'   // date/orbits are inert outside planetary; particles=0 keeps SMIL out
const STATES: Record<string, string> = {
  default: '', 'layer-syzygies': 'layers=syzygies', 'layer-currents': 'layers=currents',
  'layer-gates': 'layers=gates', 'layer-pandemonium': 'layers=pandemonium',
  'region-plex': 'region=plex', 'region-warp': 'region=warp', 'region-torque': 'region=torque',
  'zone-5': 'selected=5', 'time-circuit': 'tc=1',
}
const SVG = 'svg[viewBox^="0 0 800 "]'
const visualDom = async (page: Page) => normalizeTree(await page.evaluate(extractTree, SVG))

async function settle(page: Page, height: number) {
  await expect(page.locator(SVG)).toHaveAttribute('viewBox', `0 0 800 ${height}`)   // right layout (SSR always paints 940)
  await page.waitForFunction((sel) => {                                               // React has hydrated the svg
    const el = document.querySelector(sel); return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
  }, SVG)
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  let prev = ''; let stableSince = Date.now()                                         // 300 ms without any change
  await expect.poll(async () => {
    const cur = await visualDom(page)
    if (cur !== prev) { prev = cur; stableSince = Date.now() }
    return Date.now() - stableSince >= 300
  }, { intervals: [50], timeout: 10_000 }).toBe(true)
}

for (const layout of ['original', 'labyrinth', 'ladder'] as const) {
  for (const [name, qs] of Object.entries(STATES)) {
    test(`${layout} / ${name}`, async ({ page }) => {
      const q = [layout === 'original' ? '' : `layout=${layout}`, qs, PIN].filter(Boolean).join('&')
      await page.goto(`/numogram/?${q}`)               // dev 308-redirects to /numogram?..., serve out serves /numogram/index.html
      await settle(page, HEIGHT[layout])
      expect(await visualDom(page)).toMatchSnapshot(`${layout}--${name}.txt`)   // hyphens survive name sanitization
    })
  }
}
