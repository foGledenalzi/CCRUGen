import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  DEFAULT_SEED, DEFAULT_STYLE, createGenerator, createNameResolver, deriveName, editSound, generateSounds, meshOf, netSpanOf,
  serializeNaming, setJoin, setOverride, setSeed, setSmoothing, setStyle, smoothingInert, toggleLock, type Naming,
} from '../engine/index'
import tierTable from '../engine/scene/tier-table.json'
import { defaultNamingFor } from '../app/lib/namingSession'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../app/lib/labelScheme'
import {
  NAMES_COPY, generated, importSuccess, nameFieldAria, renamingUnavailable, rerolled, seedOnlySentence, zoneIssue,
} from '../app/lib/namingCopy'
import { REROLL_SEED_LENGTH, ZONE_PAGE_STEP } from '../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { openFor, openHeadless, openViewer, panel } from './viewer-helpers'
import { demonRow, demonsDialog, openDemons, searchDemons } from './demons-helpers'
import {
  NAMING_ENV, closeDemons, defaultResolver, demonEditor, gotoZone, inlineUndo, listMessage, lockButton, lockedOf, lockedZones, nameCell, nameRow,
  namesBody, namesBox, namesScroll, namesState, namesToggle, openNames, pinFromOverlay, readTable, redoButton, rerollButton, seedField,
  settleAnimations, settleFrames, soundField, statusLine, stubRerollRandom, switchBase, undoButton,
} from './names-helpers'

// Plan 07-22's behavioural proof of the Names panel in Chromium (ROADMAP Phase 7 criteria 1 and 2, NAM-01, NAM-02): editing a sound
// locks its zone and changes the demon names that use it, Reroll and a new seed keep the locked rows and regenerate the rest, one seed
// always gives one table, the join order and smoothing change the derived names exactly as the engine computes them, a rename changes
// one demon and Reset restores it, the editor stays on its demon while the pointer crosses other rows, the history undoes naming edits
// in reverse order, and the zone list stays windowed at the interactive ceiling. Every expected sound, name and table below is computed
// through the engine (createNaming and its edit operations, createNameResolver, generateSounds, deriveName), the copy module or the tier
// table, never read back from the page. Bases come from the tier table, never typed. The Reroll button's random source is replaced by a
// fixed sequence (stubRerollRandom) so that the seed it writes, and which zones change with it, is certain rather than likely.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const BASE = 28
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
/** The overlay mount of the demon name editor (the bare selector is ambiguous: three mounts share it). */
const OVERLAY_EDITOR = '[data-demon-name-editor][data-demon-name-context="overlay"]'
/** The demon this spec renames: 12::3, mesh 69 at base 28 (a Cyclic chronodemon of the default ring). */
const MESH = meshOf(12, 3)

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const label = (zone: number, base: number): string => formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME)
const defaultNaming = (base: number): Naming => defaultNamingFor(base, NAMING_ENV)
const resolverOf = (naming: Naming) => createNameResolver(naming, CCRU_NAMING_PRESET)
const soundsOf = (naming: Naming): readonly string[] => {
  if (naming.sounds === null) throw new Error('a seed-only naming has no sounds table')
  return naming.sounds
}

/** The browser's search text that finds one demon: its net-span as the page labels it. */
const pairSearch = (a: number, b: number, base: number): string => `${label(a, base)}::${label(b, base)}`

/** A label of the Names panel's radios and checkbox (the radio input itself is sr-only, so the click goes to its label). */
const namesLabel = (page: Page, text: string): Locator =>
  namesBox(page).locator('label').filter({ hasText: new RegExp(`^${text}$`) })

/** The overlay's detail aside (the overlay mount of the editor lives in it). */
const detailAside = (page: Page): Locator => demonsDialog(page).locator('aside[data-demon-detail]')

/** The selection, as `[start, end, length]` of an input: the caret state the editor leaves it in. */
const selectionOf = (input: Locator): Promise<[number | null, number | null, number]> =>
  input.evaluate((el: HTMLInputElement): [number | null, number | null, number] => [el.selectionStart, el.selectionEnd, el.value.length])

/** Checks the whole zone list, the seed field and the name of demon 12::3 (Selection mount) against an engine naming. */
async function expectNaming(page: Page, naming: Naming, why: string): Promise<void> {
  await expect(async () => {
    const table = await readTable(page, BASE)
    expect(table.sounds, `${why}: sounds`).toEqual(naming.sounds)
    expect(lockedZones(table.locked), `${why}: locks`).toEqual(lockedOf(naming))
  }).toPass({ timeout: 10_000 })
  await expect(seedField(page), `${why}: seed`).toHaveValue(naming.seed)
  const resolver = resolverOf(naming)
  await expect(demonEditor(page, 'selection'), `${why}: name state of 12::3`).toHaveAttribute('data-demon-name-state', resolver.stateOf(12, 3))
  await expect(panel(page, 'Selection'), `${why}: name of 12::3`).toContainText(resolver.nameOf(12, 3))
}

// ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('editing a sound locks its zone and changes the demon names that use it; a bad draft stays until Escape (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  const before = defaultNaming(BASE)
  const edited = editSound(before, 3, 'gl')
  const names0 = resolverOf(before)
  const names1 = resolverOf(edited)
  // the demon 3::0 uses zone 3, the demon 5::4 does not
  expect(names1.nameOf(3, 0)).not.toBe(names0.nameOf(3, 0))
  expect(names1.nameOf(5, 4)).toBe(names0.nameOf(5, 4))

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  const field = soundField(page, 3)
  await expect(field).toHaveValue(soundsOf(before)[3] as string)
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'false')
  await expect(lockButton(page, 3)).toHaveAttribute('aria-pressed', 'false')

  await field.fill('gl')
  await field.press('Enter')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')
  await expect(lockButton(page, 3)).toHaveAttribute('aria-pressed', 'true')
  await expect(field).toHaveValue('gl')
  await expect(nameRow(page, 4)).toHaveAttribute('data-locked', 'false')

  // the browser's NAME cells and the detail pane read the new sound; a demon that does not use zone 3 is unchanged
  await openDemons(page)
  await expect(nameCell(page, meshOf(3, 0))).toHaveText(names1.nameOf(3, 0))
  await expect(nameCell(page, meshOf(5, 4))).toHaveText(names0.nameOf(5, 4))
  await demonRow(page, 'browser', meshOf(3, 0)).click()
  await expect(detailAside(page)).toContainText(names1.nameOf(3, 0))
  await closeDemons(page)

  // an invalid draft stays in the field with its message; Escape restores the stored sound
  expect(zoneIssue('3', 'digit')).toBe("Zone 3: Sounds can't contain digits.")
  await field.fill('g1')
  await field.press('Enter')
  await expect(field).toHaveValue('g1')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toBeFocused()
  await expect(listMessage(page)).toHaveText(zoneIssue(label(3, BASE), 'digit'))
  await field.press('Escape')
  await expect(field).toHaveValue('gl')
  await expect(field).not.toHaveAttribute('aria-invalid', /.*/)
  await expect(listMessage(page)).toHaveText('')
  await expect(field).toBeFocused()

  expect(errors).toEqual([])
})

// ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Reroll and a new seed keep the locked rows and regenerate the rest (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  await stubRerollRandom(page)
  const start = defaultNaming(BASE)
  const old = soundsOf(start)
  await openViewer(page, `base=${BASE}`)
  await openNames(page)

  await lockButton(page, 7).click()
  await expect(nameRow(page, 7)).toHaveAttribute('data-locked', 'true')
  await expect(soundField(page, 7)).toHaveValue(old[7] as string)
  await expect(soundField(page, 8)).toHaveValue(old[8] as string)

  await rerollButton(page).click()
  await expect(seedField(page)).toHaveValue(new RegExp(`^[0-9a-z]{${REROLL_SEED_LENGTH}}$`))
  const rerolledSeed = await seedField(page).inputValue()
  expect(rerolledSeed).not.toBe(DEFAULT_SEED)
  const generator = createGenerator(rerolledSeed, DEFAULT_STYLE)
  const expected = generateSounds(generator, BASE, new Map([[7, old[7] as string]]))
  // the fixture is certain: without its lock zone 7 would have changed, and zone 8 does change
  expect(generator.soundAt(7)).not.toBe(old[7])
  expect(expected[7]).toBe(old[7])
  expect(expected[8]).not.toBe(old[8])
  await expect(namesBox(page).locator('[data-names-status]')).toHaveText(rerolled(BASE - 1, 1))
  let table = await readTable(page, BASE)
  expect(table.sounds).toEqual(expected)
  expect(lockedZones(table.locked)).toEqual([7])

  // a changed seed does the same, from the seed field
  await seedField(page).fill('second-seed')
  await seedField(page).press('Enter')
  await expect(seedField(page)).toHaveValue('second-seed')
  const second = generateSounds(createGenerator('second-seed', DEFAULT_STYLE), BASE, new Map([[7, old[7] as string]]))
  await expect(async () => {
    table = await readTable(page, BASE)
    expect(table.sounds).toEqual(second)
  }).toPass({ timeout: 10_000 })
  expect(lockedZones(table.locked)).toEqual([7])
  expect(second[8]).not.toBe(expected[8])

  expect(errors).toEqual([])
})

// ── 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the same seed always gives the same table (two fresh browser contexts)', async ({ browser, baseURL }) => {
  const SEED = 'hollow-vector'
  const expected = generateSounds(createGenerator(SEED, DEFAULT_STYLE), BASE)
  const tables: string[][] = []
  for (let load = 0; load < 2; load++) {
    // a fresh context has no saved slot, so the second table is built from the seed again and not restored from the first
    const context = await browser.newContext({
      baseURL, viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'dark', timezoneId: 'UTC',
    })
    try {
      const page = await context.newPage()
      const errors = trackErrors(page)
      await openViewer(page, `base=${BASE}`)
      await openNames(page)
      await seedField(page).fill(SEED)
      await seedField(page).press('Enter')
      await expect(seedField(page)).toHaveValue(SEED)
      await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe(`seed:${SEED}`)
      const table = await readTable(page, BASE)
      expect(table.sounds).toEqual(expected)
      expect(lockedZones(table.locked)).toEqual([])
      tables.push([...table.sounds])
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }
  expect(tables[0]).toEqual(tables[1])
})

// ── 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('join order and smoothing change derived names exactly as the engine computes them (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  const hiLo = defaultNaming(BASE)
  const sounds = soundsOf(hiLo)
  const [a, b] = netSpanOf(MESH)
  const hiName = deriveName(sounds[a] as string, sounds[b] as string, 'hi-lo', 0)
  const loName = deriveName(sounds[a] as string, sounds[b] as string, 'lo-hi', 0)
  expect(loName).not.toBe(hiName)
  expect(resolverOf(setJoin(hiLo, 'lo-hi')).nameOf(a, b)).toBe(loName)

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await expect(namesBox(page).locator('[data-names-join-description]')).toHaveText(NAMES_COPY.joinDescriptions['hi-lo'])
  await namesLabel(page, 'Low then high').click()
  await expect(namesBox(page).locator('input[data-names-join="lo-hi"]')).toBeChecked()
  await expect(namesBox(page).locator('[data-names-join-description]')).toHaveText(NAMES_COPY.joinDescriptions['lo-hi'])
  await openDemons(page)
  await searchDemons(page, pairSearch(a, b, BASE))
  await expect(nameCell(page, MESH)).toHaveText(loName)
  await closeDemons(page)
  // the join order changes derived names only: the sound table is untouched
  expect((await readTable(page, BASE)).sounds).toEqual(sounds)

  // smoothing: the Smoothed column is the one in use, and every preview cell is the engine's raw and smoothed name of its demon
  const smoothed = setSmoothing(setJoin(hiLo, 'lo-hi'), 1)
  const smoothedName = deriveName(sounds[a] as string, sounds[b] as string, 'lo-hi', 1)
  expect(smoothedName).not.toBe(loName)
  await expect(namesBox(page).locator('th[data-col="raw"]')).toHaveAttribute('aria-current', 'true')
  await namesLabel(page, 'Smooth names').click()
  await expect(namesBox(page).locator('input[data-names-smoothing]')).toBeChecked()
  await expect(namesBox(page).locator('th[data-col="smoothed"]')).toHaveAttribute('aria-current', 'true')
  await expect(namesBox(page).locator('th[data-col="raw"]')).not.toHaveAttribute('aria-current', /.*/)
  for (const mesh of [0, 1, 2]) {
    const [hi, lo] = netSpanOf(mesh)
    const row = namesBox(page).locator(`tr[data-names-preview-row="${mesh}"] td`)
    await expect(row.nth(1)).toHaveText(deriveName(sounds[hi] as string, sounds[lo] as string, 'lo-hi', 0))
    await expect(row.nth(2)).toHaveText(deriveName(sounds[hi] as string, sounds[lo] as string, 'lo-hi', 1))
  }
  await openDemons(page)
  await searchDemons(page, pairSearch(a, b, BASE))
  await expect(nameCell(page, MESH)).toHaveText(smoothedName)
  expect(resolverOf(smoothed).nameOf(a, b)).toBe(smoothedName)
  await closeDemons(page)

  // a style whose sounds never make clusters says that smoothing changes nothing there
  const soft = setStyle(smoothed, 'soft')
  expect(smoothingInert(soundsOf(soft))).toBe(true)
  await namesLabel(page, 'Soft').click()
  await expect(namesBox(page).locator('input[data-names-style="soft"]')).toBeChecked()
  await expect(namesBox(page).locator('[data-names-smoothing-note]')).toHaveText(NAMES_COPY.smoothingInert)
  await expect(namesBox(page).locator('[data-names-style-description]')).toHaveText(NAMES_COPY.styleDescriptions.soft)
  await openDemons(page)
  await searchDemons(page, pairSearch(a, b, BASE))
  await expect(nameCell(page, MESH)).toHaveText(resolverOf(soft).nameOf(a, b))
  await closeDemons(page)

  expect(errors).toEqual([])
})

// ── 5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a rename from the Selection editor changes that demon only and Reset restores it (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  const names0 = defaultResolver(BASE)
  const [a, b] = netSpanOf(MESH)
  const name0 = names0.nameOf(a, b)
  const search = pairSearch(a, b, BASE)
  const neighbours = [meshOf(12, 4), meshOf(11, 3)] // demons that share a zone with the renamed one

  await openViewer(page, `base=${BASE}`)
  await pinFromOverlay(page, search, MESH)
  const editor = demonEditor(page, 'selection')
  await expect(editor).toBeVisible()
  await expect(editor).toHaveAttribute('data-demon-name-state', 'generated')
  await expect(panel(page, 'Selection')).toContainText(name0)
  const rename = editor.locator('button[data-demon-rename]')
  const input = editor.locator('input[data-demon-name-input]')

  // entering edit mode puts the caret in the field with the whole name selected; Escape cancels and returns focus to Rename
  await rename.click()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue(name0)
  expect(await selectionOf(input)).toEqual([0, name0.length, name0.length])
  await input.fill('Qux')
  await input.press('Escape')
  await expect(input).toHaveCount(0)
  await expect(rename).toBeFocused()
  await expect(panel(page, 'Selection')).toContainText(name0)
  await expect(panel(page, 'Selection')).not.toContainText('Qux')

  // Save name: the heading shows the typed name, focus returns to Rename, the editor says overridden
  await rename.click()
  await input.fill('Zed')
  await editor.locator('button[data-demon-name-save]').click()
  await expect(input).toHaveCount(0)
  await expect(rename).toBeFocused()
  await expect(editor).toHaveAttribute('data-demon-name-state', 'overridden')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await expect(panel(page, 'Selection')).not.toContainText(name0)

  // the browser cell shows the override with its marker; every other demon is unchanged
  await openDemons(page)
  await searchDemons(page, search)
  await expect(nameCell(page, MESH)).toHaveText(`Zed*${NAMES_COPY.overriddenHidden}`)
  await expect(demonRow(page, 'browser', MESH).locator('[data-name-overridden]')).toHaveCount(1)
  for (const mesh of neighbours) {
    const [hi, lo] = netSpanOf(mesh)
    await searchDemons(page, pairSearch(hi, lo, BASE))
    await expect(nameCell(page, mesh)).toHaveText(names0.nameOf(hi, lo))
    await expect(demonRow(page, 'browser', mesh).locator('[data-name-overridden]')).toHaveCount(0)
  }
  // a fresh overlay lists from the top: the first rows are unchanged too
  await closeDemons(page)
  await openDemons(page)
  for (let mesh = 0; mesh < 12; mesh++) {
    const [hi, lo] = netSpanOf(mesh)
    await expect(nameCell(page, mesh)).toHaveText(names0.nameOf(hi, lo))
  }
  await closeDemons(page)

  // Reset to the generated name restores the engine's name; focus is back on Rename
  await editor.locator('button[data-demon-name-reset]').click()
  await expect(editor).toHaveAttribute('data-demon-name-state', 'generated')
  await expect(panel(page, 'Selection')).toContainText(name0)
  await expect(panel(page, 'Selection')).not.toContainText('Zed')
  await expect(rename).toBeFocused()
  await openDemons(page)
  await searchDemons(page, search)
  await expect(nameCell(page, MESH)).toHaveText(name0)
  await expect(demonRow(page, 'browser', MESH).locator('[data-name-overridden]')).toHaveCount(0)
  await closeDemons(page)

  // Enter saves from the keyboard
  await rename.click()
  await input.fill('Aaa')
  await input.press('Enter')
  await expect(input).toHaveCount(0)
  await expect(panel(page, 'Selection')).toContainText('Aaa')
  await expect(rename).toBeFocused()

  expect(errors).toEqual([])
})

// ── 6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the overlay editor stays on its demon while the pointer crosses other rows; Escape closes the editor, not the overlay (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  const names0 = defaultResolver(BASE)
  const bound = meshOf(4, 1)
  const others = [bound + 1, bound + 2, bound + 3]
  const [a, b] = netSpanOf(bound)
  await openViewer(page, `base=${BASE}`)
  await openDemons(page)
  await demonRow(page, 'browser', bound).click()
  const editor = page.locator(OVERLAY_EDITOR)
  await expect(editor).toBeVisible()
  await expect(detailAside(page)).toContainText(names0.nameOf(a, b))

  const input = editor.locator('input[data-demon-name-input]')
  await editor.locator('button[data-demon-rename]').click()
  await expect(input).toBeFocused()
  expect(await selectionOf(input)).toEqual([0, names0.nameOf(a, b).length, names0.nameOf(a, b).length])
  await input.fill('Qux')
  const aria = nameFieldAria(label(a, BASE), label(b, BASE))
  await expect(input).toHaveAttribute('aria-label', aria)

  // without the binding the pane would follow the pointer: the draft stays, so does the demon
  for (const mesh of others) {
    const [hi, lo] = netSpanOf(mesh)
    await demonRow(page, 'browser', mesh).hover()
    await settleFrames(page)
    await expect(input).toHaveValue('Qux')
    await expect(input).toHaveAttribute('aria-label', aria)
    await expect(detailAside(page)).toContainText(names0.nameOf(a, b))
    await expect(detailAside(page)).not.toContainText(names0.nameOf(hi, lo))
  }

  // Cancel rename closes the editor and returns focus to Rename; the pane follows the pointer again
  await editor.locator('button[data-demon-name-cancel]').click()
  await expect(input).toHaveCount(0)
  await expect(editor.locator('button[data-demon-rename]')).toBeFocused()
  const [hi, lo] = netSpanOf(others[0] as number)
  await demonRow(page, 'browser', others[0] as number).hover()
  await expect(detailAside(page)).toContainText(names0.nameOf(hi, lo))

  // Escape inside the field closes the editor only: the overlay stays open
  await demonRow(page, 'browser', bound).click()
  await editor.locator('button[data-demon-rename]').click()
  await expect(input).toBeFocused()
  await input.fill('Zed')
  await input.press('Escape')
  await expect(input).toHaveCount(0)
  await expect(demonsDialog(page)).toBeVisible()
  await expect(editor.locator('button[data-demon-rename]')).toBeFocused()
  await expect(detailAside(page)).toContainText(names0.nameOf(a, b))

  // Enter saves in the overlay mount too, and the browser row shows the override
  await editor.locator('button[data-demon-rename]').click()
  await input.fill('Zed')
  await input.press('Enter')
  await expect(input).toHaveCount(0)
  await expect(demonsDialog(page)).toBeVisible()
  await expect(nameCell(page, bound)).toHaveText(`Zed*${NAMES_COPY.overriddenHidden}`)
  // a second Escape, now with no editor open, closes the overlay as it always did
  await page.keyboard.press('Escape')
  await expect(demonsDialog(page)).toBeHidden()

  expect(errors).toEqual([])
})

// ── 7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the header Undo walks a sound edit, a lock, an override, a Reroll and an import back in reverse order; a base switch clears it', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await stubRerollRandom(page)

  // the states the page must show, each built with the engine's own edit operations
  const s0 = defaultNaming(BASE)
  const s1 = editSound(s0, 3, 'gl')
  const s2 = toggleLock(s1, 5)
  const s3 = setOverride(s2, MESH, 'Zed', CCRU_NAMING_PRESET)
  const imported = editSound(setSeed(s0, 'file-seed'), 20, 'imp')

  // starting at base 10 and switching through the picker leaves no history behind
  await openViewer(page)
  await switchBase(page, BASE)
  await expect(undoButton(page)).toBeDisabled()
  await openNames(page)

  // 1: a sound edit
  await soundField(page, 3).fill('gl')
  await soundField(page, 3).press('Enter')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')
  // 2: a lock
  await lockButton(page, 5).click()
  await expect(nameRow(page, 5)).toHaveAttribute('data-locked', 'true')
  // 3: an override, from the Selection editor of the pinned demon 12::3
  const [a, b] = netSpanOf(MESH)
  await pinFromOverlay(page, pairSearch(a, b, BASE), MESH)
  const editor = demonEditor(page, 'selection')
  await editor.locator('button[data-demon-rename]').click()
  await editor.locator('input[data-demon-name-input]').fill('Zed')
  await editor.locator('button[data-demon-name-save]').click()
  await expectNaming(page, s3, 'after the override')
  // 4: a Reroll (the stubbed random source makes its seed a fixed function of the press)
  await rerollButton(page).click()
  await expect(seedField(page)).not.toHaveValue(DEFAULT_SEED)
  const rerolledSeed = await seedField(page).inputValue()
  const s4 = setSeed(s3, rerolledSeed)
  await expectNaming(page, s4, 'after the Reroll')
  // 5: an import of a file the spec itself serialises with the engine
  const file = serializeNaming(imported)
  await namesBox(page).locator('input[data-names-import-input]').setInputFiles({
    name: `ccrug-names-base${BASE}.json`, mimeType: 'application/json', buffer: Buffer.from(file, 'utf8'),
  })
  await expect(namesBox(page).locator('[data-names-status][data-kind="success"]')).toHaveText(
    importSuccess(BASE, soundsOf(imported).length, imported.overrides.size),
  )
  await expectNaming(page, imported, 'after the import')

  // the header Undo, five times: each press restores the state before the last edit
  const backwards: Array<[Naming, string]> = [
    [s4, 'undo 1 (the import)'], [s3, 'undo 2 (the Reroll)'], [s2, 'undo 3 (the override)'], [s1, 'undo 4 (the lock)'], [s0, 'undo 5 (the sound edit)'],
  ]
  for (const [naming, why] of backwards) {
    await undoButton(page).click()
    await expectNaming(page, naming, why)
  }
  await expect(undoButton(page)).toBeDisabled()
  // and Redo walks forward through the same five states
  const forwards: Array<[Naming, string]> = [
    [s1, 'redo 1'], [s2, 'redo 2'], [s3, 'redo 3'], [s4, 'redo 4'], [imported, 'redo 5'],
  ]
  for (const [naming, why] of forwards) {
    await redoButton(page).click()
    await expectNaming(page, naming, why)
  }
  await expect(redoButton(page)).toBeDisabled()
  await expect(undoButton(page)).toBeEnabled()

  // a base switch to 30 and back clears the history, and the saved naming of base 28 returns
  await switchBase(page, 30)
  await expect(undoButton(page)).toBeDisabled()
  await expect(redoButton(page)).toBeDisabled()
  await switchBase(page, BASE)
  await expect(undoButton(page)).toBeDisabled()
  await expect(redoButton(page)).toBeDisabled()
  await openNames(page)
  await expect(async () => {
    const table = await readTable(page, BASE)
    expect(table.sounds).toEqual(imported.sounds)
    expect(lockedZones(table.locked)).toEqual(lockedOf(imported))
  }).toPass({ timeout: 10_000 })
  await expect(seedField(page)).toHaveValue('file-seed')

  expect(errors).toEqual([])
})

test('Ctrl+Z inside a sound field undoes the typed text only; outside a field it undoes the last committed edit', async ({ page }) => {
  const errors = trackErrors(page)
  const s0 = defaultNaming(BASE)
  const sounds = soundsOf(s0)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)

  await soundField(page, 3).fill('gl')
  await soundField(page, 3).press('Enter')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')
  await expect(undoButton(page)).toBeEnabled()

  // typed text in another field is undone by the browser's own text undo; the committed edit of zone 3 is not touched
  const other = soundField(page, 9)
  await other.fill('xyz')
  await expect(other).toHaveValue('xyz')
  await other.press('Control+z')
  await expect(other).not.toHaveValue('xyz')
  await expect(other).toHaveValue(sounds[9] as string)
  await expect(soundField(page, 3)).toHaveValue('gl')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')
  await expect(undoButton(page)).toBeEnabled()
  await expect(redoButton(page)).toBeDisabled()

  // with focus outside any field the same keys undo the committed edit
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Control+z')
  await expect(soundField(page, 3)).toHaveValue(sounds[3] as string)
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'false')
  await expect(redoButton(page)).toBeEnabled()
  expect(errors).toEqual([])
})

// Review WR-05: the inline `Undo this change` names a naming change, so it must undo a naming change and nothing else. Every state change
// of the viewer (a layer, a selection, a layout...) is a history entry too, so the newest entry after "Reroll, then toggle a layer" is the
// layer toggle: the inline button used to undo THAT while the names stayed rerolled. It now refuses, drops its stale status, and leaves
// the header Undo (which walks every entry in order) as the way back.
test('the inline Undo this change undoes the naming change only: after a layer toggle it refuses and the toggle stays', async ({ page }) => {
  const errors = trackErrors(page)
  await stubRerollRandom(page)
  const s0 = defaultNaming(BASE)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)

  const gates = page.locator('[data-gate]')
  const gatesAll = await gates.count()
  expect(gatesAll).toBeGreaterThan(0)

  /** The zone list's sounds and the seed field against an engine naming. */
  const expectNames = async (naming: Naming, why: string): Promise<void> => {
    await expect(async () => {
      expect((await readTable(page, BASE)).sounds, `${why}: sounds`).toEqual(naming.sounds)
    }).toPass({ timeout: 10_000 })
    await expect(seedField(page), `${why}: seed`).toHaveValue(naming.seed)
  }

  // a Reroll offers the inline Undo
  await rerollButton(page).click()
  await expect(seedField(page)).not.toHaveValue(DEFAULT_SEED)
  const s1 = setSeed(s0, await seedField(page).inputValue())
  await expectNames(s1, 'after the Reroll')
  await expect(inlineUndo(page)).toHaveCount(1)

  // a layer toggle is the newest history entry; the status and its button are still there
  await panel(page, 'Layers').getByText('Gates', { exact: true }).click()
  await expect(gates).toHaveCount(0)
  await expect(inlineUndo(page)).toHaveCount(1)

  // the inline Undo refuses: the toggle is not undone, the rerolled names stay, and the stale status and button go
  await inlineUndo(page).click()
  await expect(inlineUndo(page)).toHaveCount(0)
  await expect(statusLine(page)).toHaveCount(0)
  await expect(gates).toHaveCount(0)
  await expectNames(s1, 'after the refused inline Undo')
  await expect(undoButton(page)).toBeEnabled()
  await expect(redoButton(page)).toBeDisabled()

  // the header Undo still walks back in order: the toggle first, then the Reroll
  await undoButton(page).click()
  await expect(gates).toHaveCount(gatesAll)
  await expectNames(s1, 'after the first header Undo')
  await undoButton(page).click()
  await expectNames(s0, 'after the second header Undo')

  // and the inline Undo works whenever the naming change IS the newest entry: Reroll, then straight to Undo this change
  await rerollButton(page).click()
  await expect(seedField(page)).not.toHaveValue(s0.seed)
  await expect(inlineUndo(page)).toHaveCount(1)
  await inlineUndo(page).click()
  await expectNames(s0, 'after the inline Undo of the second Reroll')
  await expect(inlineUndo(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

// Review WR-07: Enter and Escape in the seed field must not commit or discard a seed an input method is still composing (a visitor typing
// Chinese, Japanese or Korean confirms a candidate with Enter). The composing keydown is dispatched as the browser would send it: with
// isComposing set (Chromium, Firefox) and with keyCode 229 (Safari). The real keys still commit and revert.
test('the seed field ignores Enter and Escape while an input method is composing, and takes dir=auto', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)
  const seed = seedField(page)
  const start = await seed.inputValue()

  const keydown = (init: KeyboardEventInit): Promise<void> =>
    seed.evaluate((el, i) => { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...i })) }, init)

  await seed.fill('composing')
  await keydown({ key: 'Enter', isComposing: true })
  await keydown({ key: 'Enter', keyCode: 229 })
  await expect(statusLine(page)).toHaveCount(0)
  await expect(seed).toHaveValue('composing')
  expect(await readTable(page, BASE).then(t => t.sounds)).toEqual(soundsOf(defaultNaming(BASE))) // nothing was applied
  await keydown({ key: 'Escape', isComposing: true })
  await keydown({ key: 'Escape', keyCode: 229 })
  await expect(seed).toHaveValue('composing') // the half-composed draft was not thrown away

  // the plain keys keep their meaning: Enter commits the seed, and Escape on a new draft goes back to the committed seed
  await seed.press('Enter')
  await expect(statusLine(page)).toHaveText(generated(BASE, 'composing'))
  await seed.fill('other')
  await seed.press('Escape')
  await expect(seed).toHaveValue('composing')
  expect(start).not.toBe('composing')
  await expect(seed).toHaveAttribute('dir', 'auto')
  expect(errors).toEqual([])
})

test('an open rename survives Undo and Redo of another edit and then saves onto the restored naming', async ({ page }) => {
  const errors = trackErrors(page)
  const s0 = defaultNaming(BASE)
  const s1 = editSound(s0, 3, 'gl')
  const [a, b] = netSpanOf(MESH)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)
  await soundField(page, 3).fill('gl')
  await soundField(page, 3).press('Enter')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')

  await pinFromOverlay(page, pairSearch(a, b, BASE), MESH)
  const editor = demonEditor(page, 'selection')
  const input = editor.locator('input[data-demon-name-input]')
  await editor.locator('button[data-demon-rename]').click()
  await input.fill('Zed')

  // Undo and Redo from the header while the editor is open: the draft stays, the name shown behind it follows the naming
  await undoButton(page).click()
  await expect(input).toHaveValue('Zed')
  await expect(panel(page, 'Selection')).toContainText(resolverOf(s0).nameOf(a, b))
  await redoButton(page).click()
  await expect(input).toHaveValue('Zed')
  await expect(panel(page, 'Selection')).toContainText(resolverOf(s1).nameOf(a, b))
  await undoButton(page).click()
  await expect(input).toHaveValue('Zed')
  await editor.locator('button[data-demon-name-save]').click()
  await expect(input).toHaveCount(0)
  await expectNaming(page, setOverride(s0, MESH, 'Zed', CCRU_NAMING_PRESET), 'the draft saved onto the undone naming')
  // the new edit replaced the redo branch
  await expect(redoButton(page)).toBeDisabled()
  expect(errors).toEqual([])
})

// ── 8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('at the interactive ceiling the list stays windowed, Go to zone reaches the last zone and Reroll keeps a lock', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = trackErrors(page)
  await stubRerollRandom(page)
  const base = INTERACTIVE_MAX_N
  const naming = defaultNaming(base)
  const sounds = soundsOf(naming)
  const last = base - 1
  await openFor(page, base)
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready', { timeout: 60_000 })
  await expect(namesBody(page)).toHaveAttribute('data-names-base', String(base))

  // the time from the Expand click to the first mounted row, measured in the page
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const button = document.querySelector('button[aria-label="Expand Names"]') as HTMLElement | null
        if (button === null) {
          reject(new Error('no Expand Names button'))
          return
        }
        let start = 0
        button.addEventListener('click', () => { start = performance.now() }, { capture: true, once: true })
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-names-row]') !== null) {
            observer.disconnect()
            resolve(performance.now() - start)
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        button.click()
      }),
  )
  // Logged only, never asserted (T-05-38: tests do not depend on this PC's speed); 23 to 28 ms measured against the 100 ms budget.
  console.log(`names-open-ms base=${base} ms=${ms.toFixed(1)} budget=${tierTable.budgets.interactionMs}`)

  await namesScroll(page).waitFor()
  const windowed = async (): Promise<number> => page.locator('[data-names-row]').count()
  expect(await windowed()).toBeGreaterThan(0)
  expect(await windowed()).toBeLessThan(80)
  await expect(nameRow(page, 0)).toHaveAttribute('aria-setsize', String(base))
  await expect(nameRow(page, 0)).toHaveAttribute('aria-posinset', '1')

  // Go to zone with the last zone's label scrolls that row in and focuses its field
  const lastField = await gotoZone(page, label(last, base), last)
  await expect(nameRow(page, last)).toBeVisible()
  await expect(nameRow(page, last)).toHaveAttribute('aria-posinset', String(base))
  await expect(lastField).toHaveValue(sounds[last] as string)
  expect(await windowed()).toBeLessThan(80)

  // lock zone 0 and Reroll: zone 0 keeps its sound, the rest follow the new seed, at the first and the last zone alike
  await gotoZone(page, label(0, base), 0)
  await lockButton(page, 0).click()
  await expect(nameRow(page, 0)).toHaveAttribute('data-locked', 'true')
  await rerollButton(page).click()
  await expect(seedField(page)).toHaveValue(new RegExp(`^[0-9a-z]{${REROLL_SEED_LENGTH}}$`))
  const rerolledSeed = await seedField(page).inputValue()
  const expected = generateSounds(createGenerator(rerolledSeed, DEFAULT_STYLE), base, new Map([[0, sounds[0] as string]]))
  expect(expected[1]).not.toBe(sounds[1])
  expect(createGenerator(rerolledSeed, DEFAULT_STYLE).soundAt(0)).not.toBe(sounds[0])
  for (const zone of [0, 1, last]) {
    const field = await gotoZone(page, label(zone, base), zone)
    await expect(field).toHaveValue(expected[zone] as string)
  }
  // the last row is where the list was left, so the first one is out of the window
  await expect(nameRow(page, last)).toHaveCount(1)
  await expect(nameRow(page, 0)).toHaveCount(0)
  expect(await windowed()).toBeLessThan(80)

  expect(errors).toEqual([])
})

// ── 9 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('above the ceiling the panel is seed-only and the demon browser still shows lazy names', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  const base = SEED_ONLY_BASE
  const naming = defaultNaming(base)
  expect(naming.sounds).toBeNull()
  const names0 = resolverOf(naming)

  await openFor(page, base)
  expect(await namesState(page)).toBe('seed-only')
  await openNames(page)
  expect(await namesState(page)).toBe('seed-only')
  await expect(namesBox(page).locator('[data-names-seed-only]')).toHaveText(seedOnlySentence())
  await expect(page.locator('[data-names-list]')).toHaveCount(0)
  await expect(page.locator('[data-names-row]')).toHaveCount(0)
  await expect(seedField(page)).toHaveValue(DEFAULT_SEED)

  await openDemons(page)
  for (const mesh of [0, 1, 2, 3]) {
    const [hi, lo] = netSpanOf(mesh)
    await expect(nameCell(page, mesh)).toHaveText(names0.nameOf(hi, lo))
  }
  // a pinned demon's Selection editor offers no rename here
  await demonRow(page, 'browser', 0).click()
  await closeDemons(page)
  await expect(demonEditor(page, 'selection')).toContainText(renamingUnavailable())
  await expect(demonEditor(page, 'selection').locator('button[data-demon-rename]')).toHaveCount(0)

  // the names still come from the seed: a new seed changes them lazily, and the link carries it
  const reseeded = setSeed(naming, 'hollow-vector')
  await seedField(page).fill('hollow-vector')
  await seedField(page).press('Enter')
  await expect(seedField(page)).toHaveValue('hollow-vector')
  await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe('seed:hollow-vector')
  await openDemons(page)
  for (const mesh of [0, 1, 2, 3]) {
    const [hi, lo] = netSpanOf(mesh)
    await expect(nameCell(page, mesh)).toHaveText(resolverOf(reseeded).nameOf(hi, lo))
  }
  expect(resolverOf(reseeded).nameOf(1, 0)).not.toBe(names0.nameOf(1, 0))
  await closeDemons(page)

  expect(errors).toEqual([])
})

// A diagnostic tier override never changes what the panel can do: a base within the ceiling drawn headless is still ready, with the zone
// list and full editing, and an edit there reaches the names the browser shows.
test('a base within the ceiling shown headless is still ready with the zone list and editing (tier=headless)', async ({ page }) => {
  const errors = trackErrors(page)
  const before = defaultNaming(BASE)
  const edited = editSound(before, 3, 'gl')
  await openHeadless(page, `base=${BASE}&tier=headless`)
  expect(await namesState(page)).toBe('ready')
  await openNames(page)
  await expect(page.locator('[data-names-list]')).toHaveCount(1)
  await expect(nameRow(page, 0)).toHaveAttribute('aria-setsize', String(BASE))
  await expect(soundField(page, 3)).toHaveValue(soundsOf(before)[3] as string)
  await soundField(page, 3).fill('gl')
  await soundField(page, 3).press('Enter')
  await expect(nameRow(page, 3)).toHaveAttribute('data-locked', 'true')
  await openDemons(page)
  await expect(nameCell(page, meshOf(3, 0))).toHaveText(resolverOf(edited).nameOf(3, 0))
  await closeDemons(page)
  expect(errors).toEqual([])
})

// ── 10 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Playwright starts headless Chromium with --hide-scrollbars, which gives the scroller a 0px bar; the real page has the thin bar that
// globals.css asks for (about 8px). Each size is measured both ways: the hidden-bar run is the plain layout, the visible-bar run (its own
// browser, started without that flag) is the width a visitor gets (the UI-SPEC "Field width check"), and its guard proves the bar was there.
async function expectFieldFits(page: Page, width: number, height: number, scrollbars: boolean): Promise<void> {
  await page.setViewportSize({ width, height })
  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await settleAnimations(page)
  const field = soundField(page, 0)
  await expect(field).toBeVisible()
  const sample = 'abcdefghijklmnop'
  expect(sample).toHaveLength(16)

  const measured = await page.evaluate(() => {
    const scroller = document.querySelector('[data-names-scroll]') as HTMLElement
    const style = getComputedStyle(scroller)
    const input = document.querySelector('input[data-names-sound="0"]') as HTMLInputElement
    const wrapper = input.parentElement as HTMLElement
    return {
      bar: scroller.offsetWidth - scroller.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
      scrollerClient: scroller.clientWidth,
      scrollerScroll: scroller.scrollWidth,
      content: scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      wrapper: wrapper.getBoundingClientRect().width,
      field: input.clientWidth,
      font: getComputedStyle(input).fontSize,
    }
  })
  await field.fill(sample)
  const fit = await field.evaluate((el: HTMLInputElement) => ({ client: el.clientWidth, scroll: el.scrollWidth }))
  console.log(
    `field-width scrollbar=${scrollbars ? 'real' : 'hidden'} viewport=${width}x${height} bar=${measured.bar} content=${measured.content} ` +
      `wrapper=${measured.wrapper.toFixed(1)} field=${measured.field} font=${measured.font} sample16 scroll=${fit.scroll} client=${fit.client}`,
  )
  if (scrollbars) expect(measured.bar, 'the real run has a scrollbar').toBeGreaterThan(0)
  else expect(measured.bar).toBe(0)
  expect(measured.font).toBe('14px')
  expect(measured.field).toBeGreaterThanOrEqual(134)
  expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1)
  // nothing in the panel scrolls sideways
  expect(measured.scrollerScroll).toBeLessThanOrEqual(measured.scrollerClient)
  await field.press('Escape')
  await expect(field).not.toHaveValue(sample)
}

for (const [width, height] of [[1280, 800], [375, 667]] as const) {
  test(`a 16-letter sound fits the zone field at ${width} x ${height} (hidden scrollbars)`, async ({ page }) => {
    const errors = trackErrors(page)
    await expectFieldFits(page, width, height, false)
    expect(errors).toEqual([])
  })

  test(`a 16-letter sound fits the zone field at ${width} x ${height} (the real scrollbar)`, async ({ playwright, baseURL }) => {
    const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
    try {
      const context = await browser.newContext({ baseURL, viewport: { width, height }, locale: 'en-US', colorScheme: 'dark', timezoneId: 'UTC' })
      const page = await context.newPage()
      const errors = trackErrors(page)
      await expectFieldFits(page, width, height, true)
      expect(errors).toEqual([])
    } finally {
      await browser.close()
    }
  })
}

// ── 11 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the zone list keyboard: Arrow, Page and Ctrl+End keys move the focus, and the list is one Tab stop (base 28)', async ({ page }) => {
  const errors = trackErrors(page)
  const last = BASE - 1
  await openViewer(page, `base=${BASE}`)
  await openNames(page)

  await soundField(page, 0).focus()
  await expect(soundField(page, 0)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(soundField(page, 1)).toBeFocused()
  await page.keyboard.press('PageDown')
  await expect(soundField(page, 1 + ZONE_PAGE_STEP)).toBeFocused()
  await page.keyboard.press('Control+End')
  await expect(soundField(page, last)).toBeFocused()
  // exactly one field is in the Tab order, and it is the row that has the focus
  await expect(page.locator('input[data-names-sound][tabindex="0"]')).toHaveCount(1)
  await expect(soundField(page, last)).toHaveAttribute('tabindex', '0')
  await expect(page.locator('button[data-names-lock][tabindex="0"]')).toHaveCount(1)
  await expect(lockButton(page, last)).toHaveAttribute('tabindex', '0')
  // and back up: Page Up, Arrow Up and Ctrl+Home
  await page.keyboard.press('PageUp')
  await expect(soundField(page, last - ZONE_PAGE_STEP)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(soundField(page, last - ZONE_PAGE_STEP - 1)).toBeFocused()
  await page.keyboard.press('Control+Home')
  await expect(soundField(page, 0)).toBeFocused()
  await expect(soundField(page, 0)).toHaveAttribute('tabindex', '0')

  // a plain End moves the caret, not the row
  await page.keyboard.press('End')
  await expect(soundField(page, 0)).toBeFocused()

  // Tab goes from the field to its lock, Space toggles it, and the next Tab leaves the list
  await page.keyboard.press('Tab')
  await expect(lockButton(page, 0)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(nameRow(page, 0)).toHaveAttribute('data-locked', 'true')
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-names-list] :focus')).toHaveCount(0)
  expect(errors).toEqual([])
})

// ── 12 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A short name for the focused element: its tag and the Names or demon hooks it carries (the value too for a radio group's option). */
async function focusedHook(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (el === null) return 'none'
    const hooks = el
      .getAttributeNames()
      .filter(n => n.startsWith('data-names-') || n.startsWith('data-demon-'))
      .map(n => {
        const v = el.getAttribute(n)
        return v === null || v === '' ? `[${n}]` : `[${n}=${v}]`
      })
    return `${el.tagName.toLowerCase()}${hooks.join('')}`
  })
}

for (const base of [10, BASE]) {
  test(`Tab visits the panel's controls in the contract's order (base ${base})`, async ({ page }) => {
    const errors = trackErrors(page)
    await openViewer(page, `base=${base}`)
    await openNames(page)
    await namesToggle(page).focus()
    await expect(namesToggle(page)).toBeFocused()
    const visited: string[] = []
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      visited.push(await focusedHook(page))
      if (visited[visited.length - 1] === 'button[data-names-lock=0]') break
    }
    const expected = [
      ...(base === 10 ? ['input[data-names-source=ccru]'] : []),
      'input[data-names-seed]',
      'button[data-names-reroll]',
      'input[data-names-style=harsh]',
      'input[data-names-join=hi-lo]',
      'input[data-names-smoothing]',
      'button[data-names-export]',
      'button[data-names-import]',
      'input[data-names-goto]',
      'input[data-names-sound=0]',
      'button[data-names-lock=0]',
    ]
    expect(visited).toEqual(expected)
    expect(errors).toEqual([])
  })
}

// ── 13 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Review WR-06 (this replaces the plan 07-19 test that pinned the opposite, "a focused row scrolled out of the window loses focus but
// keeps its draft"): the row whose field has focus stays mounted, wherever the wheel takes the list, so the focus does not fall to the
// page (where the global shortcuts are live), the typed draft is not orphaned, and it commits when the focus leaves, as it always did.
// Once nothing in the row has focus the row is windowed again like any other.
test('a focused row wheel-scrolled far out of the window stays mounted and focused, and its draft commits on blur', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)
  const field = soundField(page, 0)
  await field.fill('abc')
  await expect(field).toBeFocused()

  // a real wheel over the panel, far more than the window (the visible rows plus 8) can follow
  await field.hover() // the pointer is over a field of the list itself (another panel may cover the middle of the scroller)
  const remaining = (): Promise<number> => namesScroll(page).evaluate(el => Math.round(el.scrollHeight - el.clientHeight - el.scrollTop))
  for (let i = 0; i < 40 && (await remaining()) >= 2; i++) {
    await page.mouse.wheel(0, 1000)
    await settleFrames(page)
  }
  expect(await remaining()).toBeLessThan(2)
  await settleFrames(page)
  await expect(nameRow(page, BASE - 1)).toHaveCount(1) // the window followed the wheel to the last rows
  await expect(nameRow(page, 1)).toHaveCount(0) // and its neighbour of row 0 is gone, so the window really did move away

  // the focused row is still in the DOM with its draft, and the focus is still on its field (not on the page)
  await expect(nameRow(page, 0)).toHaveCount(1)
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('abc')
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-names-sound') ?? null)).toBe('0')
  await expect(undoButton(page)).toBeDisabled() // typed, not committed yet

  // moving the focus to a visible field commits the draft (the blur), and the row is then windowed away like the others
  await soundField(page, BASE - 1).click()
  await expect(soundField(page, BASE - 1)).toBeFocused()
  await expect(nameRow(page, 0)).toHaveCount(0)
  await expect(undoButton(page)).toBeEnabled()
  await namesScroll(page).evaluate(el => { el.scrollTop = 0 })
  await expect(nameRow(page, 0)).toHaveCount(1)
  await expect(nameRow(page, 0)).toHaveAttribute('data-locked', 'true')
  await expect(soundField(page, 0)).toHaveValue('abc')
  expect(errors).toEqual([])
})

// An invalid draft that the blur could not commit is not lost either: it stays in the list state when its row is windowed away and
// comes back, still marked invalid, with the row (the contract of plan 07-19 that WR-06 leaves as it was).
test('an invalid draft left in a row that is then scrolled out of the window comes back with the row', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)
  await switchBase(page, BASE)
  await openNames(page)
  await soundField(page, 0).fill('a1')
  await namesScroll(page).evaluate(el => { el.scrollTop = el.scrollHeight })
  await soundField(page, BASE - 1).click()
  await expect(soundField(page, BASE - 1)).toBeFocused()
  await expect(nameRow(page, 0)).toHaveCount(0)

  await namesScroll(page).evaluate(el => { el.scrollTop = 0 })
  await expect(nameRow(page, 0)).toHaveCount(1)
  await expect(soundField(page, 0)).toHaveValue('a1')
  await expect(soundField(page, 0)).toHaveAttribute('aria-invalid', 'true')
  await expect(nameRow(page, 0)).toHaveAttribute('data-locked', 'false')
  await expect(undoButton(page)).toBeDisabled()
  expect(errors).toEqual([])
})
