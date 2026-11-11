import { test, expect, type Page } from '@playwright/test'
import {
  DEFAULT_SEED, JOIN_ORDERS, SEED_MAX_LENGTH, STYLE_IDS, createNameResolver, createNaming, editSound, netSpanOf, serializeNaming, setSeed,
  setSource, toggleLock, type Naming,
} from '../engine/index'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../app/lib/labelScheme'
import { NAMES_COPY, exportSuccess, generated, noticeBody, savedLine as savedText, seedError } from '../app/lib/namingCopy'
import { REROLL_SEED_LENGTH } from '../app/lib/namingLimits'
import { defaultNamingFor } from '../app/lib/namingSession'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { openFor, openViewer, panel, selectionHeading } from './viewer-helpers'
import { openDemons } from './demons-helpers'
import {
  AUTOSAVE_WAIT_MS, NAMING_ENV, closeDemons, collisionToggle, collisionsBlock, collisionsLine, defaultResolver, demonEditor, downloadText,
  exportButton, gotoZone, importButton, inlineUndo, lockButton, lockedOf, lockedZones, nameCell, nameRow, namesBody, namesBox, namesHeaderTag,
  namesScroll, namesState, namesToggle, openNames, readSlot, readTable, rerollButton, savedLine, seedField, seedSlot, soundField, statusLine,
  stubRerollRandom, typeSound, undoButton, NAMES_LIVE,
} from './names-helpers'

// Plan 07-23's proof of the shared-link states in Chromium (ROADMAP Phase 7 criterion 3, NAM-03, D-13): a link with no saved slot is the
// working naming; a link that differs from the saved slot opens as an unsaved preview, with every editing control disabled and the slot
// untouched; Keep this naming replaces the slot and is undoable; Back to my saved naming restores it; the address carries only the
// preset or a seed with its three settings; a link past the ceiling is seed-only; and the honest-sharing note shows wherever edits
// exist that a link cannot carry. Every expected naming is built with the engine (createNaming and its edit operations), every sentence
// comes from the copy module, and the saved slots are seeded before the page loads from the engine's serializer. A link's naming never
// carries typed sounds, locks or overrides, so a previewed naming has no repeated names (the engine certifies generated tables): the
// collision jump in preview is covered by the render tests, the browser can only show that the block reads None there.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const BASE = 28
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
const LINK_SEED = 'abc'
const SAVED_SEED = 'mine'
const SAVED_ZONE = 5

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const defaultNaming = (base: number): Naming => defaultNamingFor(base, NAMING_ENV)
const label = (zone: number, base: number): string => formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME)
const fromLink = (base: number, seed: string, rest: { style?: 'harsh' | 'soft' | 'syllabic'; join?: 'hi-lo' | 'lo-hi'; smoothing?: 0 | 1 } = {}): Naming =>
  createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N, seed, ...rest })
/** What the link `names=seed:abc` shows at base 28 (a seed link carries the four generator settings only). */
const linked = (): Naming => fromLink(BASE, LINK_SEED)
/** The visitor's saved naming: another seed and one typed, locked sound. */
const saved = (): Naming => editSound(setSeed(defaultNaming(BASE), SAVED_SEED), SAVED_ZONE, 'gl')
const savedText28 = (): string => serializeNaming(saved())

/** A label of the Names panel's radios (the radio input itself is sr-only, so the click goes to its label). */
const namesLabel = (page: Page, text: string) => namesBox(page).locator('label').filter({ hasText: new RegExp(`^${text}$`) })
const shareButton = (page: Page) => page.locator('button[aria-label="Share current state"]')
const notice = (page: Page) => namesBox(page).locator('[data-names-preview-notice]')

/** Checks the whole zone list against an engine naming (sounds and locks), retrying while the list settles. */
async function expectTable(page: Page, naming: Naming, why: string): Promise<void> {
  await expect(async () => {
    const table = await readTable(page, naming.base)
    expect(table.sounds, `${why}: sounds`).toEqual(naming.sounds)
    expect(lockedZones(table.locked), `${why}: locks`).toEqual(lockedOf(naming))
  }).toPass({ timeout: 10_000 })
}

/** Opens base 28 on the link with the visitor's slot saved, and waits for the panel to be in the preview state. */
async function openPreview(page: Page, query = `base=${BASE}&names=seed:${LINK_SEED}`): Promise<void> {
  await seedSlot(page, BASE, savedText28())
  await openViewer(page, query)
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'preview')
}

// ── 1. no slot: the link is the working naming ───────────────────────────────────────────────────────────────────────

test('a seed link with no saved slot is the working naming, not a preview, and writes nothing until an edit', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, `base=${BASE}&names=seed:${LINK_SEED}`)
  expect(await namesState(page)).toBe('ready')
  // collapsed (a preview is the only thing that opens the panel by itself) and no tag: nothing a link cannot carry
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesHeaderTag(page)).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)

  await openNames(page)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expect(notice(page)).toHaveCount(0)
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
  await expectTable(page, linked(), 'the linked naming')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBeNull()

  // the first edit is what saves it, and the address keeps naming the seed (walking the table left the list at its end)
  await namesScroll(page).evaluate(el => {
    el.scrollTop = 0
  })
  await typeSound(page, 3, 'gl')
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(serializeNaming(editSound(linked(), 3, 'gl')))
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)
  expect(errors).toEqual([])
})

// ── 2. the preview ────────────────────────────────────────────────────────────────────────────────────────────────────

test('a link over a different saved slot opens as an unsaved preview: notice, tag, every editing control disabled, the slot untouched', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors = trackErrors(page)
  await openPreview(page)
  expect(await namesState(page)).toBe('preview')

  // the panel opened by itself, so the notice is seen; the address keeps naming the link
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Collapse Names')
  await expect(namesScroll(page)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)
  await expect(notice(page)).toBeVisible()
  await expect(notice(page)).toContainText(NAMES_COPY.noticeLabel)
  await expect(notice(page)).toContainText(noticeBody(BASE))
  await expect(notice(page).locator('button[data-names-keep]')).toHaveText(NAMES_COPY.keep)
  await expect(notice(page).locator('button[data-names-revert]')).toHaveText(NAMES_COPY.revert)
  await expect(namesHeaderTag(page)).toHaveAttribute('data-names-header-tag', 'preview')
  await expect(namesHeaderTag(page)).toHaveText(NAMES_COPY.tagPreview)
  await expect(namesHeaderTag(page)).toHaveText('unsaved preview')
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'preview')
  await expect(savedLine(page)).toHaveText(NAMES_COPY.savedPreview)

  // the link's naming is what the panel shows (its seed and its table, with none of the saved naming's lock), not the saved one
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expectTable(page, linked(), 'the previewed naming')

  // every editing control is disabled; the controls that only look or move are not
  await expect(seedField(page)).not.toBeEditable()
  await expect(seedField(page)).toHaveAttribute('readonly', '')
  await expect(rerollButton(page)).toBeDisabled()
  for (const style of STYLE_IDS) await expect(namesBox(page).locator(`input[data-names-style="${style}"]`)).toBeDisabled()
  for (const join of JOIN_ORDERS) await expect(namesBox(page).locator(`input[data-names-join="${join}"]`)).toBeDisabled()
  await expect(namesBox(page).locator('input[data-names-smoothing]')).toBeDisabled()
  await expect(importButton(page)).toBeDisabled()
  await expect(exportButton(page)).toBeEnabled()
  await expect(namesBox(page).locator('input[data-names-goto]')).toBeEnabled()
  await expect(collisionToggle(page)).toHaveCount(0)

  // every mounted sound field is read only and every lock disabled; typing into a field changes nothing
  await namesScroll(page).evaluate(el => {
    el.scrollTop = 0
  })
  const rows = await page.evaluate(() => ({
    sounds: Array.from(document.querySelectorAll<HTMLInputElement>('input[data-names-sound]')).map(i => i.readOnly),
    locks: Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-names-lock]')).map(b => b.disabled),
  }))
  expect(rows.sounds.length).toBeGreaterThan(0)
  expect(rows.sounds.every(readOnly => readOnly)).toBe(true)
  expect(rows.locks.length).toBe(rows.sounds.length)
  expect(rows.locks.every(disabled => disabled)).toBe(true)
  const field = soundField(page, 0)
  const before = await field.inputValue()
  await field.focus()
  await page.keyboard.type('qx')
  await page.keyboard.press('Enter')
  await expect(field).toHaveValue(before)
  await expect(nameRow(page, 0)).toHaveAttribute('data-locked', 'false')
  await expect(lockButton(page, 0)).toBeDisabled()
  await expect(statusLine(page)).toHaveCount(0)

  // a repeated-names block exists in preview and reads None: a link's naming never has a repeat, so no jump can be reached
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await expect(collisionsLine(page)).toHaveText(NAMES_COPY.collisionsNone)

  // Go to zone still moves through the previewed list
  const target = await gotoZone(page, label(7, BASE), 7)
  await expect(target).toHaveValue(linked().sounds?.[7] as string)

  // the demon displays show the previewed names, and their name editors are disabled
  const resolver = createNameResolver(linked(), CCRU_NAMING_PRESET)
  await openDemons(page)
  await expect(nameCell(page, 0)).toHaveText(resolver.nameOf(...netSpanOf(0)))
  await page.locator('[data-demon-list="browser"] [data-demon-row="0"]').click()
  await expect(demonEditor(page, 'overlay').locator('button[data-demon-rename]')).toBeDisabled()
  await closeDemons(page)
  await expect(demonEditor(page, 'selection')).toBeVisible()
  await expect(demonEditor(page, 'selection').locator('button[data-demon-rename]')).toBeDisabled()
  await expect(panel(page, 'Selection')).toContainText(resolver.nameOf(...netSpanOf(0)))

  // Export works and writes the PREVIEWED naming, not the saved one
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()])
  expect(download.suggestedFilename()).toBe(`ccrug-names-base${BASE}.json`)
  expect(await downloadText(download)).toBe(serializeNaming(linked(), { pretty: true }))
  await expect(statusLine(page)).toHaveText(exportSuccess(BASE))

  // nothing was written: the slot is byte for byte what the visitor saved, however long we wait (T-07-17f)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBe(savedText28())
  expect(await namesState(page)).toBe('preview')

  // collapsed, the header still says it
  await namesToggle(page).click()
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesHeaderTag(page)).toHaveText(NAMES_COPY.tagPreview)
  expect(errors).toEqual([])
})

// ── 3. Keep ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Keep this naming replaces the slot, says so, moves focus to the seed and is undoable (D-13, T-07-17f)', async ({ page }) => {
  const errors = trackErrors(page)
  await openPreview(page)
  await notice(page).locator('button[data-names-keep]').click()

  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')
  await expect(notice(page)).toHaveCount(0)
  await expect(namesHeaderTag(page)).toHaveCount(0)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expect(seedField(page)).toBeFocused()
  await expect(statusLine(page)).toHaveText(NAMES_COPY.kept)
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'success')
  await expect(inlineUndo(page)).toBeVisible()
  await expectTable(page, linked(), 'after Keep')
  // the slot is replaced after the quiet time, with the link's naming; the address still carries the seed only
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(serializeNaming(linked()))
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'saved')
  await expect(savedLine(page)).toHaveText(savedText(BASE))
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)
  // the editing controls are back
  await expect(rerollButton(page)).toBeEnabled()
  await expect(importButton(page)).toBeEnabled()

  // Undo this change brings the visitor's saved naming back, and the slot is written with it again
  await inlineUndo(page).click()
  await expect(seedField(page)).toHaveValue(SAVED_SEED)
  await expect(soundField(page, SAVED_ZONE)).toHaveValue('gl')
  await expect(nameRow(page, SAVED_ZONE)).toHaveAttribute('data-locked', 'true')
  await expectTable(page, saved(), 'after Undo this change')
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(savedText28())
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${SAVED_SEED}`)
  await expect(inlineUndo(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the header Undo also takes a Keep back', async ({ page }) => {
  const errors = trackErrors(page)
  await openPreview(page)
  await notice(page).locator('button[data-names-keep]').click()
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(serializeNaming(linked()))
  await expect(undoButton(page)).toBeEnabled()
  await undoButton(page).click()
  await expect(seedField(page)).toHaveValue(SAVED_SEED)
  await expectTable(page, saved(), 'after the header Undo')
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(savedText28())
  expect(errors).toEqual([])
})

// ── 4. Back ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Back to my saved naming restores the slot, drops the notice, moves focus to the seed and writes nothing (D-13)', async ({ page }) => {
  const errors = trackErrors(page)
  await openPreview(page)
  await notice(page).locator('button[data-names-revert]').click()

  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')
  await expect(notice(page)).toHaveCount(0)
  await expect(namesHeaderTag(page)).toHaveAttribute('data-names-header-tag', 'edits') // the saved naming has a typed, locked sound
  await expect(seedField(page)).toHaveValue(SAVED_SEED)
  await expect(seedField(page)).toBeFocused()
  await expect(statusLine(page)).toHaveText(NAMES_COPY.backToSaved)
  await expect(inlineUndo(page)).toHaveCount(0)
  await expect(soundField(page, SAVED_ZONE)).toHaveValue('gl')
  await expect(nameRow(page, SAVED_ZONE)).toHaveAttribute('data-locked', 'true')
  await expectTable(page, saved(), 'after Back')
  await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe(`seed:${SAVED_SEED}`)
  // the slot was never written, so it is still exactly what was saved
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBe(savedText28())
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
  // the editing controls are back
  await expect(rerollButton(page)).toBeEnabled()
  expect(errors).toEqual([])
})

// ── 5. the same link form: the slot wins ─────────────────────────────────────────────────────────────────────────────

test('a link of the same form as the saved slot is no preview: the slot, with its lock, wins', async ({ page }) => {
  const errors = trackErrors(page)
  const slot = toggleLock(fromLink(BASE, LINK_SEED), 7)
  await seedSlot(page, BASE, serializeNaming(slot))
  await openViewer(page, `base=${BASE}&names=seed:${LINK_SEED}`)
  expect(await namesState(page)).toBe('ready')
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesHeaderTag(page)).toHaveAttribute('data-names-header-tag', 'edits')
  await openNames(page)
  await expect(notice(page)).toHaveCount(0)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await gotoZone(page, label(7, BASE), 7)
  await expect(nameRow(page, 7)).toHaveAttribute('data-locked', 'true')
  await expectTable(page, slot, 'the saved slot')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBe(serializeNaming(slot))
  expect(errors).toEqual([])
})

test('base 10: a names=ccru link over a saved seed slot previews the CCRU preset; Keep makes it the saved naming', async ({ page }) => {
  const errors = trackErrors(page)
  const slot = editSound(setSeed(setSource(defaultNaming(10), 'generated', CCRU_NAMING_PRESET), SAVED_SEED), 4, 'gl')
  await seedSlot(page, 10, serializeNaming(slot))
  await openViewer(page, 'names=ccru')
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'preview')
  await expect(namesBox(page).locator('input[data-names-source="ccru"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-source="ccru"]')).toBeDisabled()
  await expect(namesBox(page).locator('input[data-names-source="generated"]')).toBeDisabled()
  expect(new URL(page.url()).searchParams.get('names')).toBe('ccru')
  await openDemons(page)
  await expect(nameCell(page, 0)).toHaveText(CCRU_NAMING_PRESET.names[0] as string)
  await closeDemons(page)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 10)).toBe(serializeNaming(slot))

  await notice(page).locator('button[data-names-keep]').click()
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')
  await expect.poll(() => readSlot(page, 10), { timeout: 10_000 }).toBe(serializeNaming(defaultNaming(10)))
  await expect(namesBox(page).locator('input[data-names-source="ccru"]')).toBeChecked()
  expect(errors).toEqual([])
})

// ── 6. link forms ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('base 10: the default address has no names parameter; choosing Generated writes names=seed:ccrug, choosing CCRU removes it', async ({
  page,
}) => {
  const errors = trackErrors(page)
  await openViewer(page, '')
  expect(new URL(page.url()).searchParams.has('names')).toBe(false)
  await openNames(page)
  await namesLabel(page, NAMES_COPY.sourceGenerated).click()
  await expect(statusLine(page)).toHaveText(generated(10, DEFAULT_SEED))
  await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe(`seed:${DEFAULT_SEED}`)
  const params = new URL(page.url()).searchParams
  for (const key of ['nstyle', 'njoin', 'nsmooth']) expect(params.has(key), key).toBe(false)
  await namesLabel(page, NAMES_COPY.sourceCcru).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('names')).toBe(false)
  expect(errors).toEqual([])
})

test('names=ccru is ignored away from base 10: the default generated naming, no error, no preview', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, `base=${BASE}&names=ccru`)
  expect(await namesState(page)).toBe('ready')
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await openNames(page)
  await expect(seedField(page)).toHaveValue(DEFAULT_SEED)
  await expect(notice(page)).toHaveCount(0)
  await expectTable(page, defaultNaming(BASE), 'the default naming')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBeNull()
  expect(errors).toEqual([])
})

test('a seed link carries its style, join order and smoothing; unknown companion values fall back to the defaults', async ({ page }) => {
  const errors = trackErrors(page)
  const wanted = fromLink(BASE, LINK_SEED, { style: 'soft', join: 'lo-hi', smoothing: 1 })
  await openViewer(page, `base=${BASE}&names=seed:${LINK_SEED}&nstyle=soft&njoin=lh&nsmooth=1`)
  expect(await namesState(page)).toBe('ready')
  await openNames(page)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expect(namesBox(page).locator('input[data-names-style="soft"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-join="lo-hi"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-smoothing]')).toBeChecked()
  await expectTable(page, wanted, 'the linked naming')
  const params = new URL(page.url()).searchParams
  expect([params.get('names'), params.get('nstyle'), params.get('njoin'), params.get('nsmooth')]).toEqual([`seed:${LINK_SEED}`, 'soft', 'lh', '1'])

  // companions this version does not know are ignored, one by one (the link stays well formed)
  await openViewer(page, `base=${BASE}&names=seed:${LINK_SEED}&nstyle=bogus&njoin=zz&nsmooth=2`)
  await openNames(page)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expect(namesBox(page).locator('input[data-names-style="harsh"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-join="hi-lo"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-smoothing]')).not.toBeChecked()
  await expectTable(page, linked(), 'the linked naming with the defaults')
  expect(errors).toEqual([])
})

const HOSTILE_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['a seed one character over the limit', `names=seed:${'a'.repeat(SEED_MAX_LENGTH + 1)}`],
  ['a seed with a control character', 'names=seed:ab%07c'],
  ['a seed with a line separator', 'names=seed:ab%E2%80%A8c'],
  ['an empty seed', 'names=seed:'],
]

for (const [title, names] of HOSTILE_LINKS) {
  test(`a link with ${title} falls back to the default naming and leaves the other parameters working`, async ({ page }) => {
    const errors = trackErrors(page)
    const resolver = defaultResolver(BASE)
    await openViewer(page, `base=${BASE}&${names}&selected=3&labels=sounds`)
    expect(await namesState(page)).toBe('ready')
    await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
    // the other parameters took effect: zone 3 is selected and the nodes show the default naming's sounds
    await expect(selectionHeading(page)).toHaveText(/\(1\)/)
    await expect(page.locator('[data-zone="12"] [data-sound-label]')).toHaveAttribute('data-sound-label', resolver.soundOf(12))
    await openNames(page)
    await expect(seedField(page)).toHaveValue(DEFAULT_SEED)
    await expect(notice(page)).toHaveCount(0)
    await expectTable(page, defaultNaming(BASE), 'the default naming')
    expect(errors).toEqual([])
  })
}

// ── 7. a link past the ceiling ───────────────────────────────────────────────────────────────────────────────────────

test('a seed link above the ceiling stays in the address, is seed-only and names the demons from the seed; no slot is ever written', async ({
  page,
}) => {
  const errors = trackErrors(page)
  const nameAt = (naming: Naming): string => createNameResolver(naming, CCRU_NAMING_PRESET).nameOf(...netSpanOf(0))
  const linkedNaming = fromLink(SEED_ONLY_BASE, LINK_SEED)
  const softNaming = fromLink(SEED_ONLY_BASE, LINK_SEED, { style: 'soft' })
  expect(linkedNaming.sounds).toBeNull()
  expect(nameAt(softNaming), 'fixture: the style changes the first demon name').not.toBe(nameAt(linkedNaming))

  await openFor(page, SEED_ONLY_BASE, `names=seed:${LINK_SEED}`)
  expect(await namesState(page)).toBe('seed-only')
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)
  // the Demons browser's first row is named from the seed at this base (names are derived lazily, there is no table)
  await openDemons(page)
  await expect(nameCell(page, 0)).toHaveText(nameAt(linkedNaming))
  await closeDemons(page)

  await openNames(page)
  await expect(seedField(page)).toHaveValue(LINK_SEED)
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'seed-only')
  await expect(savedLine(page)).toHaveText(NAMES_COPY.savedSeedOnly)
  await expect(namesBox(page).locator('[data-names-list]')).toHaveCount(0)
  // a change of style rewrites the address and renames the demons, and still writes nothing
  await namesLabel(page, NAMES_COPY.styleLabels.soft).click()
  await expect(namesBox(page).locator('input[data-names-style="soft"]')).toBeChecked()
  await expect.poll(() => new URL(page.url()).searchParams.get('nstyle')).toBe('soft')
  expect(new URL(page.url()).searchParams.get('names')).toBe(`seed:${LINK_SEED}`)
  await openDemons(page)
  await expect(nameCell(page, 0)).toHaveText(nameAt(softNaming))
  await closeDemons(page)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, SEED_ONLY_BASE)).toBeNull()
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'seed-only')
  expect(errors).toEqual([])
})

// ── 8. honest sharing ─────────────────────────────────────────────────────────────────────────────────────────────────

test('honest sharing: after a sound edit the header tag, the panel note and the Share title all say that links do not carry it', async ({
  page,
}) => {
  const errors = trackErrors(page)
  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  // nothing a link cannot carry yet: no tag, no note, the plain Share title
  await expect(namesHeaderTag(page)).toHaveCount(0)
  await expect(namesBox(page).locator('[data-names-share-note]')).toHaveCount(0)
  await expect(shareButton(page)).toHaveAttribute('title', NAMES_COPY.shareTitle)

  await typeSound(page, 3, 'gl')
  await expect(namesBox(page).locator('[data-names-share-note]')).toBeVisible()
  await expect(namesBox(page).locator('[data-names-share-note]')).toHaveText(NAMES_COPY.shareNote)
  await expect(namesHeaderTag(page)).toHaveAttribute('data-names-header-tag', 'edits')
  await expect(namesHeaderTag(page)).toHaveText(NAMES_COPY.tagEdits)
  await expect(namesHeaderTag(page)).toHaveText('edits not in links')
  // the button's behaviour and name are unchanged; only its title says it, and pressing it says the same through the carrier
  await expect(shareButton(page)).toHaveCount(1)
  await expect(shareButton(page)).toHaveAttribute('title', NAMES_COPY.shareTitleUncarried)
  await expect(shareButton(page)).toHaveAttribute('aria-label', 'Share current state')
  await shareButton(page).click()
  await expect(page.locator(NAMES_LIVE)).toHaveText(NAMES_COPY.shareTitleUncarried)

  // the tag stays when the panel is collapsed (the visitor who never opens the panel still meets it)
  await namesToggle(page).click()
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesHeaderTag(page)).toHaveText(NAMES_COPY.tagEdits)
  // and the link itself still carries no edit: the address names no sound
  const params = new URL(page.url()).searchParams
  expect([...params.keys()]).toEqual(['base'])
  expect(errors).toEqual([])
})

// ── 9. the seed field (what a link carries) ───────────────────────────────────────────────────────────────────────────

// The seed commits on Enter, on Tab and on a blur that lands anywhere but the field (a deferred check, like the base picker's), an
// Escape drops the draft, an empty seed is refused with its message and leaves the seed alone, the ends are trimmed, and a Reroll
// pressed over a draft wins over it. The address follows each committed seed.
test('the seed field commits on Enter, Tab and blur, refuses an empty seed, reverts on Escape; a link-carried seed follows', async ({ page }) => {
  const errors = trackErrors(page)
  await stubRerollRandom(page)
  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  const seedNow = (): Promise<string | null> => Promise.resolve(new URL(page.url()).searchParams.get('names'))
  const eyebrow = namesBox(page).locator('span').filter({ hasText: /^Style:$/ })

  await seedField(page).fill('first')
  await seedField(page).press('Enter')
  await expect(statusLine(page)).toHaveText(generated(BASE, 'first'))
  await expect.poll(seedNow).toBe('seed:first')
  await expectTable(page, fromLink(BASE, 'first'), 'after Enter')

  // a blur onto static text: the deferred check finds focus elsewhere and commits
  await namesScroll(page).evaluate(el => {
    el.scrollTop = 0
  })
  await seedField(page).fill('second')
  await expect(statusLine(page)).toHaveText(generated(BASE, 'first'))
  await eyebrow.click()
  await expect(statusLine(page)).toHaveText(generated(BASE, 'second'))
  await expect.poll(seedNow).toBe('seed:second')
  await expect(seedField(page)).toHaveValue('second')

  // Tab: the commit happens and focus moves on to the next control
  await seedField(page).fill('third')
  await seedField(page).press('Tab')
  await expect(statusLine(page)).toHaveText(generated(BASE, 'third'))
  await expect.poll(seedNow).toBe('seed:third')
  await expect(rerollButton(page)).toBeFocused()

  // Escape drops the draft: the field shows the committed seed again and nothing is applied
  await seedField(page).fill('nope')
  await seedField(page).press('Escape')
  await expect(seedField(page)).toHaveValue('third')
  await eyebrow.click()
  await page.waitForTimeout(100)
  await expect(statusLine(page)).toHaveText(generated(BASE, 'third'))
  expect(await seedNow()).toBe('seed:third')

  // an empty seed is refused with its message; fixing it clears the message
  await seedField(page).fill('')
  await seedField(page).press('Enter')
  const problem = namesBox(page).locator('[data-names-seed-error]')
  await expect(problem).toHaveText(seedError())
  await expect(seedField(page)).toHaveAttribute('aria-invalid', 'true')
  expect(await seedNow()).toBe('seed:third')
  await seedField(page).fill('ok')
  await expect(problem).toHaveCount(0)
  await expect(seedField(page)).not.toHaveAttribute('aria-invalid', /.*/)

  // the ends are trimmed
  await seedField(page).fill('  spaced  ')
  await seedField(page).press('Enter')
  await expect(seedField(page)).toHaveValue('spaced')
  await expect.poll(seedNow).toBe('seed:spaced')

  // a Reroll pressed over an unsent draft wins over the draft
  await seedField(page).fill('draftseed')
  await rerollButton(page).click()
  await expect(seedField(page)).toHaveValue(new RegExp(`^[0-9a-z]{${REROLL_SEED_LENGTH}}$`))
  const rerolled = await seedField(page).inputValue()
  expect(rerolled).not.toBe('draftseed')
  await expect.poll(seedNow).toBe(`seed:${rerolled}`)
  expect(errors).toEqual([])
})
