import { test, expect } from '@playwright/test'
import { openViewer, panel, selectionHeading } from './viewer-helpers'

// todo 003 regression: real mouse clicks on panel row text. A DOM click() dispatches no mousedown, so it cannot
// reproduce the bug; page.mouse does. Confirmed root cause (04-RESEARCH.md Pitfall 1): the four panels defined
// their row component inside render and passed it as ItemDisplayComponent, so CyberPanel's onMouseDownCapture
// (bring-to-front) re-render remounted the row before mouseup landed, and the browser's click never fired.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

const CASES: [string, string][] = [
  ['Zones', '5'],
  ['Syzygies', '4::5'],
  ['Currents', 'Surge'],
  ['Gates', 'Gt-15'],
]

for (const [panelName, text] of CASES) {
  test(`real mouse click on ${panelName} row text selects it`, async ({ page }) => {
    await openViewer(page)
    const target = panel(page, panelName).getByText(text, { exact: true }).first()
    const box = await target.boundingBox()
    if (!box) throw new Error(`${panelName} row "${text}" has no bounding box`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await expect(selectionHeading(page)).toHaveText(/Selected Elements \(\d+\)/)
    await expect(page).toHaveURL(/selected=/)
  })
}
