import { test, expect, type Locator, type Page } from '@playwright/test'
import { createNameResolver, netSpanOf, serializeNaming, setSeed, setSource } from '../engine/index'
import { defaultNamingFor, type NamingEnv } from '../app/lib/namingSession'
import { NAMING_AUTOSAVE_DEBOUNCE_MS, NAMING_STORAGE_PREFIX } from '../app/lib/namingLimits'
import { NAMES_COPY } from '../app/lib/namingCopy'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { DIAGRAM, SUMMARY, panel } from './viewer-helpers'
import { demonRow, demonsDialog, openDemons, searchDemons } from './demons-helpers'

// Plan 07-18's behavioural proof (wave 8): the viewer holds one naming session per displayed base, so a rename from the Selection
// editor shows in the NAME column, joins undo and redo, is kept per base across a base switch, and survives a fresh page load (a
// bare URL included). The Names panel itself is mounted by plan 07-21, so every edit here goes through the demon editor in the
// Selection panel. Every expected text is computed from the engine's default naming or read from the CCRU preset by reference.
// Each reload is a fresh navigation (page.goto of the URL to open), never the browser's own reload: the viewer rewrites its address as
// the state changes (a pinned demon writes demonFocus= into it), so reloading it would open a different state than the one to restore.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const NAMING_ENV: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }
/** Time for the debounced autosave to land, with room to spare. */
const AUTOSAVE_WAIT_MS = NAMING_AUTOSAVE_DEBOUNCE_MS + 200

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const undoButton = (page: Page): Locator => page.locator('button[aria-label="Undo"]')
const redoButton = (page: Page): Locator => page.locator('button[aria-label="Redo"]')
const selectionEditor = (page: Page): Locator =>
  page.locator('[data-demon-name-editor][data-demon-name-context="selection"]')
/** The browser row's NAME cell of a demon (the overlay must be open on the browser tab). */
const nameCell = (page: Page, mesh: number): Locator => demonRow(page, 'browser', mesh).locator('[role="gridcell"][data-col="name"]')

/** What a fresh `page.goto` leaves to wait for: the diagram (or summary) is mounted and hydrated, then two paints have passed. */
async function settle(page: Page): Promise<void> {
  const selector = `${DIAGRAM}, ${SUMMARY}`
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

/** Opens the Demons overlay, finds the demon by a search text (none: it is among the first rows), clicks its row (the pin), and closes it. */
async function pinFromOverlay(page: Page, search: string, mesh: number): Promise<void> {
  await openDemons(page)
  if (search !== '') await searchDemons(page, search)
  await demonRow(page, 'browser', mesh).click()
  await demonsDialog(page).getByRole('button', { name: 'close' }).click()
  await expect(demonsDialog(page)).toBeHidden()
}

/** Renames the pinned demon from the Selection panel's editor. */
async function renamePinned(page: Page, name: string): Promise<void> {
  const editor = selectionEditor(page)
  await editor.locator('button[data-demon-rename]').click()
  await editor.locator('input[data-demon-name-input]').fill(name)
  await editor.locator('button[data-demon-name-save]').click()
}

/** The text the browser's NAME cell shows for a demon, checked in the overlay (opened and closed here). */
async function expectBrowserName(page: Page, search: string, mesh: number, expected: string, overridden: boolean): Promise<void> {
  await openDemons(page)
  if (search !== '') await searchDemons(page, search)
  // an overridden name carries the visible marker and its screen-reader suffix after the name itself
  await expect(nameCell(page, mesh)).toHaveText(overridden ? `${expected}*${NAMES_COPY.overriddenHidden}` : expected)
  await expect(demonRow(page, 'browser', mesh).locator('[data-name-overridden]')).toHaveCount(overridden ? 1 : 0)
  await demonsDialog(page).getByRole('button', { name: 'close' }).click()
  await expect(demonsDialog(page)).toBeHidden()
}

async function readSlot(page: Page, base: number): Promise<string | null> {
  return page.evaluate((key: string) => window.localStorage.getItem(key), `${NAMING_STORAGE_PREFIX}${base}`)
}

async function switchBase(page: Page, base: number): Promise<void> {
  const input = page.getByLabel('Base', { exact: true })
  await input.click()
  await input.fill(String(base))
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(base)
}

test('base 28: a rename from the Selection editor shows everywhere, undoes and redoes', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/numogram/?base=28')
  await settle(page)
  const [a, b] = netSpanOf(69)
  expect([a, b]).toEqual([12, 3])
  const engineName = createNameResolver(defaultNamingFor(28, NAMING_ENV), CCRU_NAMING_PRESET).nameOf(a, b)

  await pinFromOverlay(page, 'c::3', 69)
  await expect(selectionEditor(page)).toBeVisible()
  await expect(panel(page, 'Selection')).toContainText(engineName)

  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await expect(panel(page, 'Selection')).not.toContainText(engineName)
  await expectBrowserName(page, 'c::3', 69, 'Zed', true)

  // the rename is one history entry: Undo brings the engine's name back, Redo the typed one
  await expect(undoButton(page)).toBeEnabled()
  await undoButton(page).click()
  await expect(panel(page, 'Selection')).toContainText(engineName)
  await expect(panel(page, 'Selection')).not.toContainText('Zed')
  await expectBrowserName(page, 'c::3', 69, engineName, false)
  await expect(redoButton(page)).toBeEnabled()
  await redoButton(page).click()
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await expectBrowserName(page, 'c::3', 69, 'Zed', true)

  expect(errors).toEqual([])
})

test('base 28 to 30 and back: history is cleared by the switch and the slot of base 28 returns', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/numogram/?base=28')
  await settle(page)
  await pinFromOverlay(page, 'c::3', 69)
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await expect(undoButton(page)).toBeEnabled()

  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 28)).toContain('Zed')

  await switchBase(page, 30)
  await expect(undoButton(page)).toBeDisabled()
  expect(await readSlot(page, 30)).toBeNull()
  // base 30 opens on its own default naming: nothing carries the override of base 28
  await expectBrowserName(page, 'c::3', 69, createNameResolver(defaultNamingFor(30, NAMING_ENV), CCRU_NAMING_PRESET).nameOf(12, 3), false)

  await switchBase(page, 28)
  await expect(undoButton(page)).toBeDisabled()
  await expectBrowserName(page, 'c::3', 69, 'Zed', true)
  await expect(undoButton(page)).toBeDisabled()

  expect(errors).toEqual([])
})

test('base 28: a fresh load restores the saved naming and Undo never overwrites it', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/numogram/?base=28')
  await settle(page)
  await pinFromOverlay(page, 'c::3', 69)
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 28)).toContain('Zed')

  await page.goto('/numogram/?base=28')
  await settle(page)
  await expectBrowserName(page, 'c::3', 69, 'Zed', true)

  // a base= load leaves its post-load history entry (the pre-existing behaviour); that entry belongs to base 10, so Undo refuses it
  // and the restored naming stays
  if (await undoButton(page).isEnabled()) {
    await undoButton(page).click()
    await expectBrowserName(page, 'c::3', 69, 'Zed', true)
  }
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 28)).toContain('Zed')

  expect(errors).toEqual([])
})

test('base 10 on a bare URL: the saved naming returns, is not undoable and is not overwritten', async ({ page }) => {
  const errors = trackErrors(page)
  const lurgo = CCRU_NAMING_PRESET.names[0]
  await page.goto('/numogram/')
  await settle(page)
  // mesh 0 is the demon 1::0, the first row of the browser (no search needed); its default name is the CCRU preset's
  await pinFromOverlay(page, '', 0)
  await expect(selectionEditor(page)).toBeVisible()
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 10)).toContain('Zed')

  // pinning wrote demonFocus= into the address, so the bare URL is opened again (a fresh navigation) and not reloaded
  await page.goto('/numogram/')
  await settle(page)
  expect(new URL(page.url()).search).toBe('')
  await expectBrowserName(page, '', 0, 'Zed', true)
  // hydration changed only the naming, so nothing was pushed: nothing to undo
  await page.waitForTimeout(300)
  await expect(undoButton(page)).toBeDisabled()

  // one more change of any kind, then Undo once: the change is undone and the loaded naming is NOT (the pre-load naming never returns)
  const gates = page.locator('[data-gate]')
  const gatesBefore = await gates.count()
  expect(gatesBefore).toBeGreaterThan(0)
  await panel(page, 'Layers').getByText('Gates', { exact: true }).click()
  await expect(gates).toHaveCount(0)
  await expect(undoButton(page)).toBeEnabled()
  await undoButton(page).click()
  await expect(gates).toHaveCount(gatesBefore)
  await expectBrowserName(page, '', 0, 'Zed', true)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 10)).toContain('Zed')

  // Reset to the CCRU name returns the preset's name for the demon
  await pinFromOverlay(page, '', 0)
  await selectionEditor(page).locator('button[data-demon-name-reset]').click()
  await expect(panel(page, 'Selection')).toContainText(lurgo)
  await expectBrowserName(page, '', 0, lurgo, false)

  expect(errors).toEqual([])
})

test('base 10 with ?layout=labyrinth: the post-load undo entry never touches the saved naming', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/numogram/')
  await settle(page)
  await pinFromOverlay(page, '', 0)
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 10)).toContain('Zed')

  await page.goto('/numogram/?layout=labyrinth')
  await settle(page)
  await expectBrowserName(page, '', 0, 'Zed', true)
  // the frozen behaviour baseline records Undo enabled after a layout load: that entry is the layout change
  await expect(undoButton(page)).toBeEnabled()
  await expect(page).toHaveURL(/layout=labyrinth/)
  await undoButton(page).click()
  await expect(page).not.toHaveURL(/layout=labyrinth/)
  await expectBrowserName(page, '', 0, 'Zed', true)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 10)).toContain('Zed')

  expect(errors).toEqual([])
})

test('a base switch right after an edit still saves that edit (the pending write is flushed)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/numogram/?base=28')
  await settle(page)
  await pinFromOverlay(page, 'c::3', 69)
  await renamePinned(page, 'Zed')

  // no waiting: the switch comes well inside the debounce time, so the write is still pending when the base changes
  await switchBase(page, 30)
  expect(await readSlot(page, 28)).toContain('Zed')
  await switchBase(page, 28)
  await expectBrowserName(page, 'c::3', 69, 'Zed', true)

  expect(errors).toEqual([])
})

// D-13: the address always names the displayed naming. A saved slot whose link form the opening URL does not name (a seed other than the
// default) is shown at once, so the first URL sync writes names= even though it is otherwise only a record of the opening URL. The slot
// is seeded before the page loads from a naming the engine builds (a seed link carries only the four settings, never sounds or edits).
for (const [base, opening] of [[28, '/numogram/?base=28'], [10, '/numogram/']] as const) {
  test(`a saved slot with another link form puts names= into the address on load (base ${base})`, async ({ page }) => {
    const errors = trackErrors(page)
    const seeded = setSource(setSeed(defaultNamingFor(base, NAMING_ENV), 'zebra'), 'generated', CCRU_NAMING_PRESET)
    await page.addInitScript(
      ({ key, text }: { key: string; text: string }) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, text)
      },
      { key: `${NAMING_STORAGE_PREFIX}${base}`, text: serializeNaming(seeded) },
    )
    await page.goto(opening)
    await settle(page)
    await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe('seed:zebra')
    // the slot itself is shown (not a preview): the saved seed gives this base's names, and nothing was written back by the load
    const resolver = createNameResolver(seeded, CCRU_NAMING_PRESET)
    const [a, b] = netSpanOf(0)
    await expectBrowserName(page, '', 0, resolver.nameOf(a, b), false)
    expect(errors).toEqual([])
  })
}

// D-13 and D-09: a names= link over a saved slot of another link form opens as an unsaved preview: the link's naming is what the
// displays show, the address keeps the link, and the slot is never written (autosave refuses a preview). At base 28 the link is applied
// by the synchronous hydration; at base 666 (a Canvas base, computed by the worker) by the swap that lands the worker's result.
for (const base of [28, 666]) {
  test(`a names= link over a different saved slot previews the link and leaves the slot alone (base ${base})`, async ({ page }) => {
    const errors = trackErrors(page)
    const slot = serializeNaming(setSeed(defaultNamingFor(base, NAMING_ENV), 'alpha'))
    await page.addInitScript(
      ({ key, text }: { key: string; text: string }) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, text)
      },
      { key: `${NAMING_STORAGE_PREFIX}${base}`, text: slot },
    )
    await page.goto(`/numogram/?base=${base}&names=seed:zebra`)
    await settle(page)
    if (base > 200) await expect(page.locator('[data-render-tier="canvas"][data-canvas-state="ready"]')).toHaveAttribute('data-base', String(base))

    const previewed = setSeed(defaultNamingFor(base, NAMING_ENV), 'zebra')
    const [a, b] = netSpanOf(0)
    await expectBrowserName(page, '', 0, createNameResolver(previewed, CCRU_NAMING_PRESET).nameOf(a, b), false)
    expect(new URL(page.url()).searchParams.get('names')).toBe('seed:zebra')

    await page.waitForTimeout(AUTOSAVE_WAIT_MS)
    expect(await readSlot(page, base)).toBe(slot)
    expect(errors).toEqual([])
  })
}
