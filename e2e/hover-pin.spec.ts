import { test, expect } from '@playwright/test'
import { formatGateName, createNumogram } from '../engine/index'
import { openViewer, panel } from './viewer-helpers'

// UI-04 at a generated base (28): hover/pin/select behaviour for a zone, syzygy, current and gate, plus UI-06's
// layer toggle, replayed at a procedural base rather than the frozen base-10 preset.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 4 UI specs run once (UTC context)'))

test('hovering a zone at base 28 changes its stroke-width, clicking selects it', async ({ page }) => {
  await openViewer(page, 'base=28')
  const zone = page.locator('[data-zone="15"]').first()
  const circle = zone.locator('circle').first()
  const before = await circle.getAttribute('stroke-width')

  await zone.hover()
  await expect(circle).not.toHaveAttribute('stroke-width', before ?? '')

  await zone.dispatchEvent('click')
  await expect(panel(page, 'Selection')).toContainText('Zone f')
  await expect(page).toHaveURL(/selected=15/)
})

test('clicking a syzygy at base 28 shows its in-base label', async ({ page }) => {
  await openViewer(page, 'base=28')
  await page.locator('[data-syzygy="13:14"]').first().dispatchEvent('click')
  await expect(panel(page, 'Selection')).toContainText('Syzygy d::e')
})

test('clicking a current at base 28 shows its title', async ({ page }) => {
  await openViewer(page, 'base=28')
  const currentGroup = page.locator('[data-current]').first()
  const currentName = await currentGroup.getAttribute('data-current')
  await currentGroup.locator('path[stroke="transparent"]').first().dispatchEvent('click')
  await expect(panel(page, 'Selection')).toContainText(`${currentName} Current`)
})

test('clicking zone 5\'s gate at base 28 shows its own-base gate name', async ({ page }) => {
  await openViewer(page, 'base=28')
  const g = createNumogram(28)
  const gateName = formatGateName(g.gate(5).cumulation, 28)
  const gateGroup = page.locator(`[data-gate="${gateName}"]`).first()
  await gateGroup.locator('path[stroke="transparent"]').first().dispatchEvent('click')
  await expect(panel(page, 'Selection')).toContainText(gateName)
})

test('toggling the Gates layer off at base 28 removes every gate element', async ({ page }) => {
  await openViewer(page, 'base=28')
  await expect(page.locator('[data-gate]').first()).toBeVisible()
  await panel(page, 'Layers').getByText('Gates', { exact: true }).click()
  await expect(page.locator('[data-gate]')).toHaveCount(0)
})
