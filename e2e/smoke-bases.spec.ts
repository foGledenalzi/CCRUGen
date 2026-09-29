// MIG-02 smoke render: every even base 2..40 in the built static site.
import { test, expect, type Page } from '@playwright/test'
import { DIAGRAM, openViewer, panel } from './viewer-helpers'

// Fixed panel roots the frozen behaviour baseline and every other Phase 4 spec find through panel(): the diagram
// itself is checked separately (DIAGRAM), these are the list/detail panels that read the same view model.
const PANEL_NAMES = ['Zones', 'Syzygies', 'Currents', 'Gates', 'Regions', 'Selection']

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

/** The diagram's outer HTML plus the visible text of every fixed panel, concatenated for one NaN/undefined scan. */
async function collectRenderedText(page: Page): Promise<string> {
  const diagramHtml = await page.locator(DIAGRAM).first().evaluate(el => el.outerHTML)
  const panelTexts = await Promise.all(PANEL_NAMES.map(name => panel(page, name).innerText()))
  return [diagramHtml, ...panelTexts].join('\n')
}

function assertClean(text: string, errors: string[]): void {
  expect(text).not.toContain('NaN')
  expect(text).not.toContain('undefined')
  expect(errors).toEqual([])
}

// Every even base from 2 to 40 (20 bases): default (ring) layout, right zone count, no NaN/undefined anywhere
// the viewer shows text, no uncaught page error.
for (let n = 2; n <= 40; n += 2) {
  test(`base ${n}: ${n} zones render with no NaN or undefined text`, async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page, `base=${n}`)
    await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(n)
    assertClean(await collectRenderedText(page), errors)
  })
}

// Layout variants: ladder, spiral and pairGraph at a spread of bases (including two below the Torque/Warp/Plex
// full-structure cases and base 28, which has three Torque cycles).
const LAYOUT_BASES = [2, 4, 6, 28]
const LAYOUTS = ['ladder', 'spiral', 'pairGraph'] as const

for (const n of LAYOUT_BASES) {
  for (const layout of LAYOUTS) {
    test(`base ${n}, layout ${layout}: no NaN or undefined text`, async ({ page }) => {
      const errors = trackErrors(page)
      await openViewer(page, `base=${n}&layout=${layout}`)
      if (layout === 'pairGraph') {
        await expect(page.locator('[data-diagram="pairs"] [data-pair]')).toHaveCount(n / 2)
      } else {
        await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(n)
      }
      assertClean(await collectRenderedText(page), errors)
    })
  }
}
