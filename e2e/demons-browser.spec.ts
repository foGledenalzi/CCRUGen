import { test, expect } from '@playwright/test'
import { createNumogram } from '../engine/index'
import { DIAGRAM, openViewer } from './viewer-helpers'
import { demonList, demonRow, demonsDialog, facet, openDemons, searchDemons } from './demons-helpers'

// Proves the Browser half of Phase 5 end to end against the static export: facets (DEM-01), the virtualized browser
// with sort/filter/search (DEM-02), base-10 names (DEM-05), the D-07 URL contract and D-01 overlay dismissal.
// Every expected count/label below is computed independently from `createNumogram(...)`, never from the app's own
// view model (see e2e/layers-zoom.spec.ts / e2e/hover-pin.spec.ts for the same convention at a generated base).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 5 UI specs run once (UTC context)'))

test('base 28 facets show closed-form counts incl. the cross-Torque sub-facet', async ({ page }) => {
  const g = createNumogram(28)
  const typeCounts = g.demons.typeCounts()
  const subtypeCounts = g.demons.counts()
  expect(g.demons.count).toBe(378)
  expect(typeCounts.chrono).toBe(276)
  expect(typeCounts.amphi).toBe(96)
  expect(typeCounts.xeno).toBe(6)
  expect(subtypeCounts['cross-torque-chrono']).toBe(108)

  await openViewer(page, 'base=28')
  const dialog = await openDemons(page)
  await expect(dialog.locator('[data-demons-total="378"]')).toBeVisible()
  await expect(facet(page, 'all')).toHaveAttribute('data-count', String(378))
  await expect(facet(page, 'chrono')).toHaveAttribute('data-count', String(typeCounts.chrono))
  await expect(facet(page, 'amphi')).toHaveAttribute('data-count', String(typeCounts.amphi))
  await expect(facet(page, 'xeno')).toHaveAttribute('data-count', String(typeCounts.xeno))

  await facet(page, 'chrono').click()
  await expect(facet(page, 'chrono')).toHaveAttribute('aria-pressed', 'true')
  const crossChip = facet(page, 'cross-torque-chrono')
  await expect(crossChip).toHaveAttribute('data-count', String(subtypeCounts['cross-torque-chrono']))
  await expect(crossChip).toContainText('108')

  await crossChip.click()
  await expect(demonList(page, 'browser')).toHaveAttribute('aria-rowcount', String(subtypeCounts['cross-torque-chrono'] + 1))
  await expect(page).toHaveURL(/demonFilter=cross-torque-chrono/)
  await expect(page).toHaveURL(/demonsOpen=1/)
})

test('base 666 opens with no diagram and shows 221,445 demons instantly', async ({ page }) => {
  const g = createNumogram(666)
  const typeCounts = g.demons.typeCounts()
  const subtypeCounts = g.demons.counts()
  expect(g.demons.count).toBe(221445)
  expect(typeCounts.chrono).toBe(220116)
  expect(subtypeCounts['cross-torque-chrono']).toBe(199884)

  await openViewer(page, 'base=666')
  await expect(page.locator(DIAGRAM)).toHaveCount(0)
  const dialog = await openDemons(page)

  await expect(dialog.locator('[data-demons-total="221445"]')).toBeVisible()
  await expect(facet(page, 'all')).toContainText('221,445')
  await expect(facet(page, 'chrono')).toHaveAttribute('data-count', '220116')

  await facet(page, 'chrono').click()
  await expect(facet(page, 'cross-torque-chrono')).toHaveAttribute('data-count', '199884')
})

test('base 666 virtualizes 221,445 rows', async ({ page }) => {
  await openViewer(page, 'base=666')
  const dialog = await openDemons(page)
  const list = demonList(page, 'browser')
  await expect(list).toHaveAttribute('aria-rowcount', '221446')

  const spacer = list.locator('[data-demon-rows-spacer]')
  const height = await spacer.evaluate(el => parseFloat((el as HTMLElement).style.height))
  expect(height).toBe(4871790)

  const beforeCount = await list.locator('[data-demon-row]').count()
  expect(beforeCount).toBeGreaterThanOrEqual(1)
  expect(beforeCount).toBeLessThanOrEqual(80)

  // `[data-demon-pager]` is a sibling of the `[data-demon-list]` grid (DemonRowList.tsx), not a descendant.
  await expect(dialog.locator('[data-demon-pager]')).toHaveCount(0)

  await list.evaluate(el => {
    el.scrollTop = el.scrollHeight
  })

  const lastRow = demonRow(page, 'browser', 221444)
  await expect(lastRow).toBeVisible()
  await expect(lastRow.locator('[data-col="ab"]')).toHaveText('665::664')

  const afterCount = await list.locator('[data-demon-row]').count()
  expect(afterCount).toBeLessThanOrEqual(80)
})

test('sort toggles direction and sorts by type', async ({ page }) => {
  await openViewer(page, 'base=28')
  await openDemons(page)
  const list = demonList(page, 'browser')

  await list.locator('[data-sort-col="mesh"]').click()
  await expect(list.locator('[role="columnheader"][data-col="mesh"]')).toHaveAttribute('aria-sort', 'descending')
  await expect(list.locator('[data-demon-row]').first()).toHaveAttribute('data-demon-row', '377')

  await list.locator('[data-sort-col="type"]').click()
  await expect(list.locator('[data-demon-row]').first().locator('[data-col="type"]')).toHaveText('Cyclic chrono')
})

test('search by mesh and a::b under a filter', async ({ page }) => {
  await openViewer(page, 'base=666')
  await openDemons(page)

  await facet(page, 'chrono').click()
  await facet(page, 'cross-torque-chrono').click()

  await searchDemons(page, '108')
  const row108 = demonRow(page, 'browser', 108)
  await expect(row108).toBeVisible()
  await expect(row108).toHaveAttribute('data-active', 'true')
  await expect(row108.locator('[data-col="ab"]')).toHaveText('15::3')

  await searchDemons(page, '15::3')
  await expect(demonRow(page, 'browser', 108)).toHaveAttribute('data-active', 'true')

  const status = demonsDialog(page).locator('[data-demon-search-status]')

  await searchDemons(page, '1::0')
  await expect(status).toContainText('is not in the Cross-Torque chrono filter.')

  await searchDemons(page, '221445')
  await expect(status).toContainText('No demon found for')

  await searchDemons(page, '1e3')
  await expect(status).toContainText("Couldn't parse")
})

test('clicking a row pins it in the detail pane', async ({ page }) => {
  await openViewer(page, 'base=28')
  await openDemons(page)

  await searchDemons(page, 'c::3')
  const row = demonRow(page, 'browser', 69)
  await row.click()
  await expect(row).toHaveAttribute('aria-selected', 'true')

  const detail = demonsDialog(page).locator('aside[data-demon-detail]')
  await expect(detail).toContainText('c::3')
  await expect(detail).toContainText('MESH')
  await expect(detail).toContainText('69')
  await expect(detail).toContainText('Cyclic chrono')
})
