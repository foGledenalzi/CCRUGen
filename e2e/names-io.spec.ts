import { test, expect, type Page } from '@playwright/test'
import {
  NAMING_IMPORT_MAX_BYTES, SCHEMA_ID, canCertify, createNameResolver, createNaming, editSound, findCollisions, meshOf, netSpanOf,
  serializeNaming, setOverride, setSource, validateNamingJson,
  type CollisionReport, type NameResolver, type Naming,
} from '../engine/index'
import { netSpanLabel } from '../app/lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, type LabelScheme } from '../app/lib/labelScheme'
import {
  NAMES_COPY, collisionsAnnounceSome, collisionsNotChecked, collisionsSome, exportSeedOnly, exportSuccess, generated, importError,
  importSeedOnly, importSuccess, invalidEntries, jumpAriaLabel, moreJumps, nameFieldAria, renamed, savedLine as savedText, showingNames, summaryLine,
} from '../app/lib/namingCopy'
import { COLLISION_JUMPS_SHOWN, COLLISION_LINES_STEP, collisionScanLimit } from '../app/lib/namingLimits'
import { defaultNamingFor } from '../app/lib/namingSession'
import { INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { DIAGRAM, SUMMARY, openFor, openViewer, panel, selectionHeading } from './viewer-helpers'
import { openDemons, searchDemons } from './demons-helpers'
import {
  AUTOSAVE_WAIT_MS, NAMING_ENV, chooseFile, closeDemons, collisionToggle, collisionsBlock, collisionsLine, demonEditor, downloadText,
  exportButton, gotoField, importButton, importCopyContext, importInput, inlineUndo, jumpButton, liveLog, lockedOf, lockedZones,
  namesBody, namesBox, namesState, nameRow, openNames, pinFromOverlay, readBrowserNames, readSlot, readTable, recordLive, redoButton,
  renamePinned, seedSlot, savedLine, seedField, settleAnimations, settleFrames, slotKeyOf, soundField, spyStorageWrites, statusLine,
  storageWrites, switchBase, typeSound, undoButton, NAMES_LIVE,
} from './names-helpers'

// Plan 07-23's proof of Import and Export, autosave, the collision report and the CCRU preset in Chromium (ROADMAP Phase 7 criteria 3
// and 4, NAM-03, NAM-04, D-09, D-10, D-12, D-14): the real download and the real file input, hostile files, one browser slot per base,
// a failing store, the repeated-names report with its inline rename jump and its announcements, the cost of the scan at its limit
// under a throttled CPU, and the base-10 preset. Every expected value comes from the engine (createNaming and its edit operations,
// serializeNaming, validateNamingJson, createNameResolver, findCollisions), the copy module, the CCRU preset module or the tier
// table, never read back from the page. Bases come from the tier table. Neutral typed names (Zed, Qwerty, zz) stand in for edits; the
// canonical names come only through the preset module. Every reload is a fresh navigation (the viewer rewrites its own address as the
// state changes, so the browser's own reload would open a different state than the one to restore).

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const BASE = 28
const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the tier table sends to the Canvas tier
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
const SCAN_BASE = collisionScanLimit() // the largest base the collision scan covers
const SHARED = 'zz' // one sound typed into several zones: every demon pair that differs only in those zones then repeats a name
const UNIQUE = 'Qwerty'
const COUNT_AT_10 = 45

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

const defaultNaming = (base: number): Naming => defaultNamingFor(base, NAMING_ENV)
const resolverOf = (naming: Naming): NameResolver => createNameResolver(naming, CCRU_NAMING_PRESET)
const label = (zone: number, base: number, scheme: LabelScheme = DEFAULT_LABEL_SCHEME): string => formatZoneLabel(zone, base, scheme)
/** The browser's search text that finds one demon: its net-span as the page labels it. */
const pairSearch = (a: number, b: number, base: number): string => `${label(a, base)}::${label(b, base)}`
const soundsOf = (naming: Naming): readonly string[] => {
  if (naming.sounds === null) throw new Error('a seed-only naming has no sounds table')
  return naming.sounds
}
/** The default naming with `SHARED` typed into each zone: the names of demons that differ only in those zones are then equal. */
const sharedNaming = (base: number, zones: readonly number[]): Naming =>
  zones.reduce((n, zone) => editSound(n, zone, SHARED), defaultNaming(base))

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
  await settleFrames(page)
}

/** A label of the Names panel's radios (the radio input itself is sr-only, so the click goes to its label). */
const namesLabel =(page: Page, text: string) => namesBox(page).locator('label').filter({ hasText: new RegExp(`^${text}$`) })

/** Checks the whole zone list against an engine naming (sounds and locks), retrying while the list settles. */
async function expectTable(page: Page, naming: Naming, why: string): Promise<void> {
  await expect(async () => {
    const table = await readTable(page, naming.base)
    expect(table.sounds, `${why}: sounds`).toEqual(naming.sounds)
    expect(lockedZones(table.locked), `${why}: locks`).toEqual(lockedOf(naming))
  }).toPass({ timeout: 10_000 })
}

/** The sentence an import of `text` into `base` must show, from the engine's own validator and the copy module. */
function refusalText(text: string, base: number): string {
  const result = validateNamingJson(text, { base, interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET })
  if (result.ok) throw new Error('the fixture was expected to be refused')
  const ctx = importCopyContext(base)
  const first = result.issues[0]
  switch (first?.kind) {
    case 'not-json':
    case 'too-large':
    case 'unknown-version':
    case 'not-names-file':
    case 'seed-only-base':
    case 'wrong-base':
      return importError(first, ctx)
    default:
      return invalidEntries(result.issues, result.issueCount, ctx)
  }
}

// ── 1. export and import ──────────────────────────────────────────────────────────────────────────────────────────────

test('Export downloads ccrug-names-base28.json and a fresh browser imports it back to the same naming, undoably (NAM-03)', async ({
  page, browser, baseURL,
}) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  const mesh = meshOf(12, 3)
  const before = defaultNaming(BASE)
  const edited = setOverride(editSound(before, 3, 'gl'), mesh, 'Zed', CCRU_NAMING_PRESET)
  const defaultName = resolverOf(before).nameOf(12, 3)
  expect(defaultName).not.toBe('Zed')

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await typeSound(page, 3, 'gl')
  await pinFromOverlay(page, pairSearch(12, 3, BASE), mesh)
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()])
  expect(download.suggestedFilename()).toBe('ccrug-names-base28.json')
  const text = await downloadText(download)
  expect(text).toBe(serializeNaming(edited, { pretty: true }))
  const doc = JSON.parse(text) as { schema: string; base: number; zones: string[]; locks: number[]; overrides: Record<string, string> }
  expect(doc.schema).toBe(SCHEMA_ID)
  expect(doc.base).toBe(BASE)
  expect(doc.zones).toHaveLength(BASE)
  expect(doc.zones[3]).toBe('gl')
  expect(doc.locks).toEqual([3])
  expect(doc.overrides).toEqual({ [String(mesh)]: 'Zed' })
  await expect(statusLine(page)).toHaveText(exportSuccess(BASE))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'success')
  // an export changes nothing: no inline Undo is offered for it
  await expect(inlineUndo(page)).toHaveCount(0)

  // a fresh browser context has no saved slot: the import is the only way the edits can reach it
  const context = await browser.newContext({
    baseURL, viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'dark', timezoneId: 'UTC',
  })
  try {
    const fresh = await context.newPage()
    const freshErrors = trackErrors(fresh)
    await openViewer(fresh, `base=${BASE}`)
    await openNames(fresh)
    expect(await readSlot(fresh, BASE)).toBeNull()
    // the real path: the button opens the browser's file chooser (one file, JSON), and the chosen file is read from disk
    await expect(importInput(fresh)).toHaveAttribute('accept', '.json,application/json')
    const [chooser] = await Promise.all([fresh.waitForEvent('filechooser'), importButton(fresh).click()])
    expect(chooser.isMultiple()).toBe(false)
    await chooser.setFiles({ name: 'ccrug-names-base28.json', mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') })
    await expect(statusLine(fresh)).toHaveText(importSuccess(BASE, BASE, 1))
    await expect(statusLine(fresh)).toHaveAttribute('data-kind', 'success')
    await expect(soundField(fresh, 3)).toHaveValue('gl')
    await expect(nameRow(fresh, 3)).toHaveAttribute('data-locked', 'true')
    await expectTable(fresh, edited, 'after the import')
    await expect(namesBody(fresh)).toHaveAttribute('data-names-state', 'ready')
    // the input is cleared after the attempt, so the same file can be chosen again
    expect(await importInput(fresh).evaluate((el: HTMLInputElement) => [el.value, el.files?.length ?? 0])).toEqual(['', 0])

    await openDemons(fresh)
    await searchDemons(fresh, pairSearch(12, 3, BASE))
    await expect(browserNameCell(fresh, mesh)).toHaveText(`Zed*${NAMES_COPY.overriddenHidden}`)
    await expect(browserNameCell(fresh, mesh).locator('[data-name-overridden]')).toHaveCount(1)
    await closeDemons(fresh)

    // the import is saved like any edit: the slot is the compact form of the imported naming
    await expect.poll(() => readSlot(fresh, BASE), { timeout: 10_000 }).toBe(serializeNaming(edited))

    // the inline Undo restores the previous naming (the default) and the slot follows
    await inlineUndo(fresh).click()
    await expectTable(fresh, before, 'after Undo this change')
    await expect(inlineUndo(fresh)).toHaveCount(0)
    await openDemons(fresh)
    await searchDemons(fresh, pairSearch(12, 3, BASE))
    await expect(browserNameCell(fresh, mesh)).toHaveText(defaultName)
    await expect(browserNameCell(fresh, mesh).locator('[data-name-overridden]')).toHaveCount(0)
    await closeDemons(fresh)
    await expect.poll(() => readSlot(fresh, BASE), { timeout: 10_000 }).toBe(serializeNaming(before))
    expect(freshErrors).toEqual([])
  } finally {
    await context.close()
  }
  expect(errors).toEqual([])
})

/** The NAME cell of a demon in the open browser (kept as a function so the spec reads the same in both contexts). */
function browserNameCell(page: Page, mesh: number) {
  return page.locator(`[data-demon-list="browser"] [data-demon-row="${mesh}"] [role="gridcell"][data-col="name"]`)
}

test('a file for another base is refused with the base named; Use its seed here applies only the seed settings (NAM-03)', async ({ page }) => {
  const errors = trackErrors(page)
  const FILE_BASE = 30
  const fileNaming = editSound(
    createNaming({ base: FILE_BASE, interactiveMaxN: INTERACTIVE_MAX_N, seed: 'thirty', style: 'soft', join: 'lo-hi', smoothing: 1 }),
    3,
    'gl',
  )
  // what Use its seed here must give at base 28: the file's four settings and nothing else (no sound, lock or override of the file)
  const expected = createNaming({ base: BASE, interactiveMaxN: INTERACTIVE_MAX_N, seed: 'thirty', style: 'soft', join: 'lo-hi', smoothing: 1 })
  expect(soundsOf(expected)[3]).not.toBe('gl')
  const start = defaultNaming(BASE)

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await chooseFile(page, 'ccrug-names-base30.json', serializeNaming(fileNaming))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'error')
  await expect(statusLine(page)).toHaveText(importError({ kind: 'wrong-base', fileBase: FILE_BASE }, importCopyContext(BASE)))
  // the sentence of the UI-SPEC copy contract, typed out once so a change to the copy module is a visible decision
  await expect(statusLine(page)).toHaveText(
    'This file is for base 30, and you are on base 28. Nothing was imported. Switch to base 30 to import it.',
  )
  // nothing was applied
  await expectTable(page, start, 'after the refusal')
  await expect(seedField(page)).toHaveValue(start.seed)
  await expect(inlineUndo(page)).toHaveCount(0)

  const useSeed = namesBox(page).locator('button[data-names-use-seed]')
  await expect(useSeed).toBeVisible()
  await expect(useSeed).toHaveText(NAMES_COPY.useSeed)
  await useSeed.click()
  await expect(seedField(page)).toHaveValue('thirty')
  await expect(namesBox(page).locator('input[data-names-style="soft"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-join="lo-hi"]')).toBeChecked()
  await expect(namesBox(page).locator('input[data-names-smoothing]')).toBeChecked()
  await expectTable(page, expected, 'after Use its seed here')
  await expect(statusLine(page)).toHaveText(generated(BASE, 'thirty'))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'success')
  await expect(useSeed).toHaveCount(0)

  // a replace-all action: the inline Undo gives the previous naming back
  await inlineUndo(page).click()
  await expectTable(page, start, 'after Undo this change')
  await expect(seedField(page)).toHaveValue(start.seed)
  expect(errors).toEqual([])
})

// Hostile files (T-07-04d, T-07-05c): every refusal is all-or-nothing. The sentence each one must show comes from the validator of the
// engine and the copy module; the page must apply nothing, write no slot, offer no Undo, and clear its file input so the same file can
// be chosen again. `__proto__` is built as text (a JSON key of that name is an own property only when parsed from text).
function goodDoc(): Record<string, unknown> {
  return JSON.parse(serializeNaming(defaultNaming(BASE))) as Record<string, unknown>
}
const goodText = (): string => serializeNaming(defaultNaming(BASE))
/** `text` with `from` replaced by `to`; throws when `from` is absent, so a fixture can never silently stay valid. */
function swap(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`the fixture text has no ${from}`)
  return text.replace(from, to)
}

interface Hostile {
  readonly title: string
  readonly content: string | Buffer
  readonly expected: string
}

function hostileFiles(): Hostile[] {
  const out: Hostile[] = []
  out.push({ title: 'not JSON', content: 'not json', expected: importError({ kind: 'not-json' }) })
  out.push({
    title: 'a NaN literal (not JSON)',
    content: '{"schema":"ccrug.naming/1","base":NaN}',
    expected: importError({ kind: 'not-json' }),
  })
  out.push({
    title: 'bytes that are not UTF-8',
    content: Buffer.from([0x7b, 0xff, 0xfe, 0xfd, 0x7d]),
    expected: importError({ kind: 'not-json' }),
  })
  out.push({
    title: 'another format version',
    content: swap(goodText(), SCHEMA_ID, 'ccrug.naming/2'),
    expected: importError({ kind: 'unknown-version', version: '2' }),
  })
  out.push({
    title: 'not a names file',
    content: JSON.stringify({ schema: 'something.else/1', base: BASE }),
    expected: importError({ kind: 'not-names-file' }),
  })
  const proto = swap(goodText(), '"overrides":{}', '"overrides":{"__proto__":"X"}')
  out.push({
    title: 'a __proto__ override key',
    content: proto,
    expected: invalidEntries([{ kind: 'bad-override-key', key: '__proto__' }], 1, importCopyContext(BASE)),
  })
  const huge = swap(goodText(), '"base":28', '"base":1e999')
  out.push({ title: 'an enormous base', content: huge, expected: refusalText(huge, BASE) })
  const locks = swap(goodText(), '"locks":[]', '"locks":[1e999,-1,2.5,99]')
  out.push({ title: 'locks that are not zones', content: locks, expected: refusalText(locks, BASE) })
  const control = goodDoc()
  ;(control.zones as string[])[3] = 'a\u0007b'
  const controlText = JSON.stringify(control)
  out.push({ title: 'a control character in a sound', content: controlText, expected: refusalText(controlText, BASE) })
  const digit = goodDoc()
  ;(digit.zones as string[])[5] = 'g1'
  const digitText = JSON.stringify(digit)
  out.push({ title: 'a digit in a sound', content: digitText, expected: refusalText(digitText, BASE) })
  const short = goodDoc()
  ;(short.zones as string[]).pop()
  const shortText = JSON.stringify(short)
  out.push({ title: 'one zone too few', content: shortText, expected: refusalText(shortText, BASE) })
  return out
}

for (const hostile of hostileFiles()) {
  test(`a hostile file is refused and nothing is applied: ${hostile.title}`, async ({ page }) => {
    const errors = trackErrors(page)
    const start = defaultNaming(BASE)
    await spyStorageWrites(page)
    await openViewer(page, `base=${BASE}`)
    await openNames(page)
    const buffer = typeof hostile.content === 'string' ? Buffer.from(hostile.content, 'utf8') : hostile.content
    await importInput(page).setInputFiles({ name: 'names.json', mimeType: 'application/json', buffer })
    await expect(statusLine(page)).toHaveText(hostile.expected)
    await expect(statusLine(page)).toHaveAttribute('data-kind', 'error')
    await expect(namesBox(page).locator('button[data-names-use-seed]')).toHaveCount(0)
    await expect(inlineUndo(page)).toHaveCount(0)
    await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')
    // nothing applied: the table, the locks and the seed are the default's, and no overrides exist
    await expectTable(page, start, 'after the refusal')
    await expect(seedField(page)).toHaveValue(start.seed)
    await expect(namesBox(page).locator('[data-names-summary]')).toHaveText(summaryLine(0, 0))
    // the file input is cleared after every attempt, so the same file can be chosen again
    expect(await importInput(page).evaluate((el: HTMLInputElement) => [el.value, el.files?.length ?? 0])).toEqual(['', 0])
    // no slot is written: an import that applies nothing is not an edit
    await page.waitForTimeout(AUTOSAVE_WAIT_MS)
    expect(await readSlot(page, BASE)).toBeNull()
    expect(await storageWrites(page), 'nothing was written to the storage').toEqual([])
    await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
    expect(errors).toEqual([])
  })
}

test('the size cap: one byte over is refused before the file is read, exactly the cap is accepted', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  const start = defaultNaming(BASE)
  const wanted = editSound(start, 3, 'gl')
  const body = serializeNaming(wanted)
  // a valid names file padded with trailing spaces (ASCII, so a character is a byte): without the cap it would import
  const padTo = (bytes: number): string => body + ' '.repeat(bytes - body.length)
  const over = padTo(NAMING_IMPORT_MAX_BYTES + 1)
  const at = padTo(NAMING_IMPORT_MAX_BYTES)
  expect(over.length).toBe(NAMING_IMPORT_MAX_BYTES + 1)
  expect(at.length).toBe(NAMING_IMPORT_MAX_BYTES)
  expect(validateNamingJson(at, { base: BASE, interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }).ok).toBe(true)

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await chooseFile(page, 'big.json', over)
  const expected = importError({ kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES })
  await expect(statusLine(page)).toHaveText(expected)
  await expect(statusLine(page)).toContainText('8 MB')
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'error')
  await expectTable(page, start, 'after the oversize file')
  expect(await importInput(page).evaluate((el: HTMLInputElement) => [el.value, el.files?.length ?? 0])).toEqual(['', 0])
  await expect(inlineUndo(page)).toHaveCount(0)

  await chooseFile(page, 'edge.json', at)
  await expect(statusLine(page)).toHaveText(importSuccess(BASE, BASE, 0))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'success')
  await expectTable(page, wanted, 'after the file of exactly the cap')
  expect(errors).toEqual([])
})

test('a seed-only base: a file with zones is refused, a seed-only file is accepted and exports as seed and style only', async ({ page }) => {
  const errors = trackErrors(page)
  const start = createNaming({ base: SEED_ONLY_BASE, interactiveMaxN: INTERACTIVE_MAX_N })
  expect(start.sounds).toBeNull()
  const seedOnly = createNaming({ base: SEED_ONLY_BASE, interactiveMaxN: INTERACTIVE_MAX_N, seed: 'abc', style: 'soft' })
  const withZones = JSON.stringify({ ...(JSON.parse(serializeNaming(seedOnly)) as object), zones: ['aa', 'bb'] })

  await openFor(page, SEED_ONLY_BASE)
  await openNames(page)
  expect(await namesState(page)).toBe('seed-only')
  await chooseFile(page, 'zones.json', withZones)
  await expect(statusLine(page)).toHaveText(importError({ kind: 'seed-only-base' }, importCopyContext(SEED_ONLY_BASE)))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'error')
  await expect(seedField(page)).toHaveValue(start.seed)
  await expect(inlineUndo(page)).toHaveCount(0)

  await chooseFile(page, 'seed.json', serializeNaming(seedOnly))
  await expect(statusLine(page)).toHaveText(importSeedOnly(SEED_ONLY_BASE))
  await expect(statusLine(page)).toHaveAttribute('data-kind', 'success')
  await expect(seedField(page)).toHaveValue('abc')
  await expect(namesBox(page).locator('input[data-names-style="soft"]')).toBeChecked()
  await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe('seed:abc')
  expect(new URL(page.url()).searchParams.get('nstyle')).toBe('soft')

  // the export of a seed-only naming carries the seed and the settings, no zones, locks or overrides
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()])
  expect(download.suggestedFilename()).toBe(`ccrug-names-base${SEED_ONLY_BASE}.json`)
  const text = await downloadText(download)
  expect(text).toBe(serializeNaming(seedOnly, { pretty: true }))
  const doc = JSON.parse(text) as Record<string, unknown>
  expect(doc.schema).toBe(SCHEMA_ID)
  expect(doc.base).toBe(SEED_ONLY_BASE)
  for (const key of ['zones', 'locks', 'overrides']) expect(doc, key).not.toHaveProperty(key)
  await expect(statusLine(page)).toHaveText(exportSeedOnly(SEED_ONLY_BASE))

  // the inline Undo of the import is not offered after an export, but the header Undo still walks back the import
  await expect(undoButton(page)).toBeEnabled()
  await undoButton(page).click()
  await expect(seedField(page)).toHaveValue(start.seed)
  expect(errors).toEqual([])
})

// ── 2. autosave, one slot per base ────────────────────────────────────────────────────────────────────────────────────

test('autosave: one slot per base after the first edit only; a base switch never inherits it (D-09, D-10)', async ({ page }) => {
  const errors = trackErrors(page)
  const start = defaultNaming(BASE)
  const edited = editSound(start, 5, 'gl')
  await spyStorageWrites(page)
  await openViewer(page, `base=${BASE}`)
  await openNames(page)

  // before any edit: the quiet line says so and nothing is written, however long we wait
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
  await expect(savedLine(page)).toHaveText(NAMES_COPY.savedNone)
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, BASE)).toBeNull()
  expect(await storageWrites(page), 'an untouched base writes nothing').toEqual([])

  await typeSound(page, 5, 'gl')
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'saved')
  await expect(savedLine(page)).toHaveText(savedText(BASE))
  expect(await readSlot(page, BASE)).toBe(serializeNaming(edited))
  // the debounce gives one write for the edit, not one per keystroke or per render
  expect(await storageWrites(page)).toEqual([slotKeyOf(BASE)])

  // another base opens on its own default: the edit of base 28 is not carried, and a visit writes nothing
  await switchBase(page, 30)
  await expect(namesBody(page)).toHaveAttribute('data-names-base', '30')
  await expectTable(page, defaultNaming(30), 'base 30 after the switch')
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await readSlot(page, 30)).toBeNull()
  expect(await readSlot(page, BASE)).toBe(serializeNaming(edited))
  expect(await storageWrites(page), 'visiting another base writes nothing').toEqual([slotKeyOf(BASE)])

  // back at 28 the saved naming returns: the edit and its lock
  await switchBase(page, BASE)
  await expect(namesBody(page)).toHaveAttribute('data-names-base', String(BASE))
  // the list opens at its top (a base switch starts the body afresh): zone 5 is there before the whole table is walked
  await expect(soundField(page, 5)).toHaveValue('gl')
  await expect(nameRow(page, 5)).toHaveAttribute('data-locked', 'true')
  await expectTable(page, edited, 'base 28 after the switch back')
  await page.waitForTimeout(AUTOSAVE_WAIT_MS)
  expect(await storageWrites(page), 'restoring a slot writes nothing').toEqual([slotKeyOf(BASE)])
  expect(errors).toEqual([])
})

test('autosave: a fresh navigation restores the saved naming at base 28 and on a bare URL at base 10 (D-09)', async ({ page }) => {
  const errors = trackErrors(page)
  const edited = editSound(defaultNaming(BASE), 5, 'gl')

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await typeSound(page, 5, 'gl')
  await expect.poll(() => readSlot(page, BASE), { timeout: 10_000 }).toBe(serializeNaming(edited))

  await page.goto('/numogram/?base=28')
  await settle(page)
  await openNames(page)
  await expect(soundField(page, 5)).toHaveValue('gl')
  await expect(nameRow(page, 5)).toHaveAttribute('data-locked', 'true')
  await expectTable(page, edited, 'after a fresh navigation')
  await expect(namesBody(page)).toHaveAttribute('data-names-state', 'ready')

  // the bare address: pin the first demon from the overlay and rename it from the Selection editor (pinning writes demonFocus= into the
  // address, so that address is not reused: the bare one is opened afresh)
  const first = resolverOf(defaultNaming(10)).nameOf(...netSpanOf(0))
  await openViewer(page, '')
  expect(new URL(page.url()).search).toBe('')
  expect(await readSlot(page, 10)).toBeNull()
  await pinFromOverlay(page, '', 0)
  await expect(demonEditor(page, 'selection')).toBeVisible()
  await renamePinned(page, 'Zed')
  await expect(panel(page, 'Selection')).toContainText('Zed')
  await expect.poll(() => readSlot(page, 10), { timeout: 10_000 }).toContain('Zed')

  await page.goto('/numogram/')
  await settle(page)
  expect(new URL(page.url()).search).toBe('')
  await openDemons(page)
  await expect(browserNameCell(page, 0)).toHaveText(`Zed*${NAMES_COPY.overriddenHidden}`)
  await expect(browserNameCell(page, 0).locator('[data-name-overridden]')).toHaveCount(1)
  await closeDemons(page)
  expect(first).toBe(CCRU_NAMING_PRESET.names[0]) // the preset's name for this demon is what Zed replaced
  expect(errors).toEqual([])
})

// Review IN-04: an edit made less than the debounce before a base switch is written at the switch, and when that write fails (a full
// store) the visitor used to hear nothing: the switch reset the saved line to none. The failure now reaches the new base's panel (the
// saved line) and the live carrier.
test('a failed write at a base switch is reported, not dropped (full store)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    Storage.prototype.setItem = function setItem(): void {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
  })
  await openViewer(page, )
  await openNames(page)
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
  await typeSound(page, 3, 'gl')
  // no waiting: the switch comes inside the debounce time, so the write that fails is the one the switch flushes
  await switchBase(page, 30)
  await openNames(page)
  await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'failed')
  await expect(savedLine(page)).toHaveText(NAMES_COPY.savedFailed)
  await expect(page.locator(NAMES_LIVE)).toHaveText(NAMES_COPY.savedFailed)
  expect(errors).toEqual([])
})

for (const mode of ['quota', 'denied'] as const) {
  test(`a full or blocked store shows the Couldn't save line and breaks nothing (${mode})`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.addInitScript((m: 'quota' | 'denied') => {
      if (m === 'quota') {
        // every write fails the way a full store does
        Storage.prototype.setItem = function setItem(): void {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        }
      } else {
        // the store itself is not reachable (a blocked or sandboxed context): even reading the property throws
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get(): Storage {
            throw new DOMException('Access is denied for this document.', 'SecurityError')
          },
        })
      }
    }, mode)
    const first = editSound(defaultNaming(BASE), 3, 'gl')
    const second = editSound(first, 4, 'dt')

    await openViewer(page, `base=${BASE}`)
    await openNames(page)
    await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'none')
    await typeSound(page, 3, 'gl')
    await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'failed')
    await expect(savedLine(page)).toHaveText(NAMES_COPY.savedFailed)
    await expect(savedLine(page)).toHaveText("Couldn't save in this browser. Choose Export names to keep a copy.")
    await expect(savedLine(page)).toHaveCSS('color', 'rgb(248, 113, 113)')

    // the panel keeps working: a second edit applies, and Export still gives the visitor a copy (what the line says to do)
    await typeSound(page, 4, 'dt')
    await expect(savedLine(page)).toHaveAttribute('data-names-saved', 'failed')
    await expectTable(page, second, 'after two edits with no storage')
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()])
    expect(await downloadText(download)).toBe(serializeNaming(second, { pretty: true }))
    expect(errors).toEqual([])
  })
}

// ── 3. collisions ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface ShownLine {
  readonly name: string | null
  readonly text: string | null
  readonly jumps: ReadonlyArray<{ readonly mesh: number; readonly text: string | null; readonly aria: string | null }>
  readonly extra: string | null
}

/** The lines the report shows for its first `count` groups, from the engine's report: name, jump buttons (text and accessible name) and `+k more`. */
function expectedLines(report: CollisionReport, resolver: NameResolver, base: number, scheme: LabelScheme, count: number): ShownLine[] {
  const zoneLabel = (zone: number): string => label(zone, base, scheme)
  return report.list.slice(0, count).map(group => ({
    name: group.name,
    text: group.name,
    jumps: group.meshes.slice(0, COLLISION_JUMPS_SHOWN).map(mesh => {
      const [a, b] = netSpanOf(mesh)
      return { mesh, text: netSpanLabel(a, b, zoneLabel), aria: jumpAriaLabel(zoneLabel(a), zoneLabel(b), resolver.nameOf(a, b)) }
    }),
    extra: group.size > COLLISION_JUMPS_SHOWN ? moreJumps(group.size - COLLISION_JUMPS_SHOWN) : null,
  }))
}

/** What the page lists now, line by line. */
async function readLines(page: Page): Promise<ShownLine[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-names-collisions-list] [data-collision-name]')).map(li => ({
      name: li.getAttribute('data-collision-name'),
      text: li.querySelector('[data-collision-name-text]')?.textContent ?? null,
      jumps: Array.from(li.querySelectorAll('[data-collision-jump]')).map(button => ({
        mesh: Number(button.getAttribute('data-collision-jump')),
        text: button.textContent,
        aria: button.getAttribute('aria-label'),
      })),
      extra: li.querySelector('[data-collision-extra]')?.textContent ?? null,
    })),
  )
}

/** The Names box's top edge (the box is the fixed ancestor of the live carrier). */
async function namesTop(page: Page): Promise<number> {
  const box = await namesBox(page).boundingBox()
  if (box === null) throw new Error('the Names box has no bounding box')
  return box.y
}

interface FlowOptions {
  readonly base: number
  /** The zones that get the shared sound. */
  readonly zones: readonly number[]
  /** Extra query parameters of the address. */
  readonly extra?: string
  readonly scheme?: LabelScheme
  /** True when a zone is selected, so the Selection panel lists selected items (and cannot show a pinned demon). */
  readonly selected?: boolean
  /** True to end with a control for the Names-top measurement: a PIN does move the box, so the measurement can tell. */
  readonly control?: boolean
}

// One scenario for the three places a jump must work (nothing selected, a zone selected, a Canvas base): the repeated names are made by
// typing the shared sound into the panel's own list, the report must equal the engine's, the list shows its first page and `Show more
// names`, a jump opens the inline editor under the line with focus in its field WITHOUT moving the Names box or pinning the demon, and
// a unique name renames one demon: the counts, the line and the focus follow the engine's answer for the renamed naming.
async function collisionFlow(page: Page, o: FlowOptions): Promise<void> {
  const scheme = o.scheme ?? DEFAULT_LABEL_SCHEME
  const naming = sharedNaming(o.base, o.zones)
  const report = findCollisions(naming, CCRU_NAMING_PRESET)
  const resolver = resolverOf(naming)
  expect(report.groups, 'fixture: more than one page of repeated names').toBeGreaterThan(COLLISION_LINES_STEP)
  const group0 = (report.list[0] as CollisionReport['list'][number])
  const target = group0.meshes[0] as number
  const [a, b] = netSpanOf(target)
  const renamedNaming = setOverride(naming, target, UNIQUE, CCRU_NAMING_PRESET)
  const after = findCollisions(renamedNaming, CCRU_NAMING_PRESET)
  const keptMeshes = group0.meshes.filter(mesh => mesh !== target)
  const zoneLabel = (zone: number): string => label(zone, o.base, scheme)

  await openFor(page, o.base, o.extra ?? '')
  await openNames(page)
  await recordLive(page)
  // an untouched default has no repeated names, and the first answer is not announced
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await expect(collisionsLine(page)).toHaveText(NAMES_COPY.collisionsNone)
  await expect(page.locator(NAMES_LIVE)).toHaveText('')

  for (const zone of o.zones) await typeSound(page, zone, SHARED)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(report.groups))
  await expect(collisionsBlock(page)).toHaveAttribute('data-demons', String(report.demons))
  await expect(collisionsLine(page)).toHaveText(collisionsSome(report.groups, report.demons))
  await expect(page.locator(NAMES_LIVE)).toHaveText(collisionsAnnounceSome(report.groups))

  // the list: one page of lines, then `Showing {shown} of {g} names.` and `Show more names`
  await expect(collisionToggle(page)).toHaveText(NAMES_COPY.showCollisions)
  await expect(collisionToggle(page)).toHaveAttribute('aria-expanded', 'false')
  await collisionToggle(page).click()
  await expect(collisionToggle(page)).toHaveText(NAMES_COPY.hideCollisions)
  await expect(collisionToggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(namesBox(page).locator('[data-collision-name]')).toHaveCount(COLLISION_LINES_STEP)
  await expect(namesBox(page).locator('[data-collision-showing]')).toHaveText(showingNames(COLLISION_LINES_STEP, report.groups))
  expect(await readLines(page)).toEqual(expectedLines(report, resolver, o.base, scheme, COLLISION_LINES_STEP))
  const more = namesBox(page).locator('button[data-collision-more]')
  await expect(more).toHaveText(NAMES_COPY.showMoreNames)
  await more.click()
  const second = Math.min(report.list.length, 2 * COLLISION_LINES_STEP)
  await expect(namesBox(page).locator('[data-collision-name]')).toHaveCount(second)
  expect(await readLines(page)).toEqual(expectedLines(report, resolver, o.base, scheme, second))
  if (second < report.groups) {
    await expect(namesBox(page).locator('[data-collision-showing]')).toHaveText(showingNames(second, report.groups))
  } else {
    await expect(namesBox(page).locator('[data-collision-showing]')).toHaveCount(0)
    await expect(more).toHaveCount(0)
  }

  // the jump: the editor opens inline with focus in its field; Names does not move; nothing is pinned
  if (o.selected === true) await expect(selectionHeading(page)).toHaveText(/\(1\)/)
  await settleAnimations(page)
  await settleFrames(page)
  const top = await namesTop(page)
  const jump = jumpButton(page, target)
  await expect(jump).toHaveAttribute('aria-label', jumpAriaLabel(zoneLabel(a), zoneLabel(b), resolver.nameOf(a, b)))
  await expect(jump).toHaveText(netSpanLabel(a, b, zoneLabel))
  // the sentence of the UI-SPEC copy contract, typed out once (the lines above read the copy module that the page itself uses): the
  // visible net-span is inside the accessible name
  if (scheme.mode === 'digits') {
    await expect(jump).toHaveAttribute('aria-label', `Rename demon ${label(a, o.base)}::${label(b, o.base)}, currently ${resolver.nameOf(a, b)}`)
  }
  await jump.click()
  const editor = demonEditor(page, 'collision')
  await expect(editor).toHaveCount(1)
  await expect(editor).toBeVisible()
  // only one editor is open anywhere: the bare selector finds this one alone (nothing is pinned, so no other mount shows)
  await expect(page.locator('[data-demon-name-editor][data-demon-name-context="collision"]')).toHaveCount(1)
  await expect(page.locator('[data-demon-name-editor]')).toHaveCount(1)
  await expect(editor).toHaveAttribute('data-demon-name-state', 'generated')
  const input = editor.locator('input[data-demon-name-input]')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue(resolver.nameOf(a, b))
  await expect(input).toHaveAttribute('aria-label', nameFieldAria(zoneLabel(Math.max(a, b)), zoneLabel(Math.min(a, b))))
  await expect(namesBox(page).locator('[data-collision-editor-title]')).toContainText(netSpanLabel(a, b, zoneLabel))
  await expect(namesBox(page).locator('[data-collision-editor-title]')).toContainText(NAMES_COPY.tagGenerated)
  await settleFrames(page)
  expect(Math.abs((await namesTop(page)) - top), 'the Names box top while the editor opens').toBeLessThan(1)
  // the jump did not pin: the Selection panel shows no demon editor and the address names no demon
  await expect(demonEditor(page, 'selection')).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('demonFocus')).toBe(false)
  if (o.selected === true) await expect(selectionHeading(page)).toHaveText(/\(1\)/)

  // a unique name: the demon leaves its group and the counts follow the engine's report of the renamed naming
  await input.fill(UNIQUE)
  await editor.locator('button[data-demon-name-save]').click()
  await expect(editor).toHaveCount(0)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(after.groups))
  await expect(collisionsBlock(page)).toHaveAttribute('data-demons', String(after.demons))
  await expect(collisionsLine(page)).toHaveText(
    after.groups === 0 ? NAMES_COPY.collisionsNone : collisionsSome(after.groups, after.demons),
  )
  // focus never falls to the page: it goes to the next demon of the line that kept the name, or to the toggle when the line is gone
  if (keptMeshes.length >= 2) await expect(jumpButton(page, keptMeshes[0] as number)).toBeFocused()
  else await expect(collisionToggle(page)).toBeFocused()
  // the renamed demon shows the typed name; the Names box is where it was
  await settleFrames(page)
  expect(Math.abs((await namesTop(page)) - top), 'the Names box top after the save').toBeLessThan(1)
  const log = await liveLog(page)
  const renamedSentence = renamed(zoneLabel(a), zoneLabel(b), UNIQUE)
  expect(log, 'the carrier said the rename').toContain(renamedSentence)
  if (after.groups !== report.groups) {
    // the count changed: its sentence follows the rename's (the polite region replaces the text, so a reader may drop the first)
    expect(log.indexOf(collisionsAnnounceSome(after.groups))).toBeGreaterThan(log.indexOf(renamedSentence))
    console.log(`live carrier, in order: ${JSON.stringify(log)}`)
  }

  // a control for the measurement itself: pinning a demon DOES change the Selection panel's height and so the Names box top, which is
  // exactly what a jump must not do; if this did not move the box, the assertions above could never have failed
  if (o.control === true) {
    await pinFromOverlay(page, '', 0)
    await expect(demonEditor(page, 'selection')).toBeVisible()
    await settleAnimations(page)
    await settleFrames(page)
    expect(Math.abs((await namesTop(page)) - top), 'control: a pin moves the Names box').toBeGreaterThanOrEqual(1)
  }
}

test('collisions at base 28: the report equals the engine, a jump opens the inline editor without moving the Names box, a unique name resolves one group', async ({
  page,
}) => {
  const errors = trackErrors(page)
  await collisionFlow(page, { base: BASE, zones: [1, 2], control: true })
  expect(errors).toEqual([])
})

test('collisions at base 28, groups of three: a rename leaves the line and focus goes to its next demon', async ({ page }) => {
  const errors = trackErrors(page)
  await collisionFlow(page, { base: BASE, zones: [1, 2, 3] })
  expect(errors).toEqual([])
})

test('collisions with a zone selected: the Selection panel lists the selection, the jump still opens the editor and Names stays put', async ({
  page,
}) => {
  const errors = trackErrors(page)
  await collisionFlow(page, { base: BASE, zones: [1, 2], extra: 'selected=3', selected: true })
  expect(errors).toEqual([])
})

test('collisions at a Canvas base: the same report, list and jump', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await collisionFlow(page, { base: CANVAS_BASE, zones: [1, 2] })
  expect(errors).toEqual([])
})

test('the jump text and accessible name follow the active label scheme (xenotation)', async ({ page }) => {
  const errors = trackErrors(page)
  await collisionFlow(page, { base: BASE, zones: [1, 2], extra: 'labels=xeno', scheme: { mode: 'xeno' } })
  expect(errors).toEqual([])
})

test('the two collision sentences: N repeated names when the count appears, No repeated names when it ends, nothing for typing', async ({
  page,
}) => {
  const errors = trackErrors(page)
  const both = sharedNaming(BASE, [1, 2])
  const fixed = editSound(editSound(defaultNaming(BASE), 1, SHARED), 2, 'xk')
  const report = findCollisions(both, CCRU_NAMING_PRESET)
  expect(findCollisions(fixed, CCRU_NAMING_PRESET).groups, 'fixture: the second sound resolves every repeat').toBe(0)

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await recordLive(page)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await typeSound(page, 1, SHARED)
  await typeSound(page, 2, SHARED)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(report.groups))
  await expect(page.locator(NAMES_LIVE)).toHaveText(collisionsAnnounceSome(report.groups))
  await typeSound(page, 2, 'xk')
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await expect(collisionsLine(page)).toHaveText(NAMES_COPY.collisionsNone)
  await expect(page.locator(NAMES_LIVE)).toHaveText(NAMES_COPY.collisionsAnnounceNone)
  // exactly the two count sentences, once each: typing, locking and the first answer say nothing
  expect(await liveLog(page)).toEqual([collisionsAnnounceSome(report.groups), NAMES_COPY.collisionsAnnounceNone])
  expect(errors).toEqual([])
})

test('Undo after a rename: the restored sentence comes first, then the count of repeated names (the announcement overlap)', async ({ page }) => {
  const errors = trackErrors(page)
  const naming = sharedNaming(BASE, [1, 2])
  const report = findCollisions(naming, CCRU_NAMING_PRESET)
  const target = (report.list[0] as CollisionReport['list'][number]).meshes[0] as number
  const after = findCollisions(setOverride(naming, target, UNIQUE, CCRU_NAMING_PRESET), CCRU_NAMING_PRESET)
  expect(after.groups).not.toBe(report.groups)

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await typeSound(page, 1, SHARED)
  await typeSound(page, 2, SHARED)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(report.groups))
  await collisionToggle(page).click()
  await jumpButton(page, target).click()
  const editor = demonEditor(page, 'collision')
  await editor.locator('input[data-demon-name-input]').fill(UNIQUE)
  await editor.locator('button[data-demon-name-save]').click()
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(after.groups))
  // the header Undo takes the rename back; the carrier is recorded from here on
  await recordLive(page)
  await undoButton(page).click()
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(report.groups))
  await expect(page.locator(NAMES_LIVE)).toHaveText(collisionsAnnounceSome(report.groups))
  const log = await liveLog(page)
  console.log(`live carrier after Undo, in order: ${JSON.stringify(log)}`)
  expect(log).toEqual([NAMES_COPY.restored, collisionsAnnounceSome(report.groups)])
  await expect(redoButton(page)).toBeEnabled()
  expect(errors).toEqual([])
})

test('Tab order: smoothing, Show repeated names, the jump buttons, the inline editor, Export names, Import names, Go to zone', async ({ page }) => {
  const errors = trackErrors(page)
  // one repeated name between two demons: the override of 12::3 is the derived name of 5::4 (a saved slot, so the setup is exact)
  const [hiA, loA] = [12, 3]
  const [hiB, loB] = [5, 4]
  const naming = setOverride(defaultNaming(BASE), meshOf(hiA, loA), resolverOf(defaultNaming(BASE)).nameOf(hiB, loB), CCRU_NAMING_PRESET)
  const report = findCollisions(naming, CCRU_NAMING_PRESET)
  expect([report.groups, report.demons]).toEqual([1, 2])
  const [low, high] = [meshOf(hiB, loB), meshOf(hiA, loA)]
  expect((report.list[0] as CollisionReport['list'][number]).meshes).toEqual([low, high])
  await seedSlot(page, BASE, serializeNaming(naming))

  const focused = (): Promise<string> =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (el === null) return 'none'
      for (const attr of [
        'data-collision-toggle', 'data-collision-jump', 'data-demon-name-input', 'data-demon-name-save', 'data-demon-name-cancel',
        'data-names-export', 'data-names-import', 'data-names-undo', 'data-names-goto', 'data-names-smoothing', 'data-names-seed',
      ]) {
        if (el.hasAttribute(attr)) return `${attr}=${el.getAttribute(attr) ?? ''}`
      }
      return `${el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''}`
    })
  const press = async (key: string, expected: string): Promise<void> => {
    await page.keyboard.press(key)
    await expect.poll(focused, { message: `after ${key}` }).toBe(expected)
  }

  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '1')
  await namesBox(page).locator('input[data-names-smoothing]').focus()
  expect(await focused()).toBe('data-names-smoothing=')
  await press('Tab', 'data-collision-toggle=')
  // collapsed: the next stop is Export names; the keyboard opens the list
  await page.keyboard.press('Enter')
  await expect(collisionToggle(page)).toHaveAttribute('aria-expanded', 'true')
  expect(await focused()).toBe('data-collision-toggle=')
  await press('Tab', `data-collision-jump=${low}`)
  await press('Tab', `data-collision-jump=${high}`)
  await press('Tab', 'data-names-export=')
  await press('Tab', 'data-names-import=')
  await press('Tab', 'data-names-goto=')

  // with the inline editor open: jump, the editor's field, Save name, Cancel rename, then Export names; Shift+Tab walks back
  await jumpButton(page, high).focus()
  await page.keyboard.press('Enter')
  await expect(demonEditor(page, 'collision').locator('input[data-demon-name-input]')).toBeFocused()
  await press('Tab', 'data-demon-name-save=')
  await press('Tab', 'data-demon-name-cancel=')
  await press('Tab', 'data-names-export=')
  await press('Tab', 'data-names-import=')
  await press('Tab', 'data-names-goto=')
  await demonEditor(page, 'collision').locator('input[data-demon-name-input]').focus()
  await press('Shift+Tab', `data-collision-jump=${high}`)
  await press('Shift+Tab', `data-collision-jump=${low}`)
  await press('Shift+Tab', 'data-collision-toggle=')
  await press('Shift+Tab', 'data-names-smoothing=')
  expect(errors).toEqual([])
})

test('Tab order: Export names, Import names, Undo this change, Go to zone', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, `base=${BASE}`)
  await openNames(page)
  // a new seed is a replace-all action: its status carries the inline Undo
  await seedField(page).fill('tabtest')
  await seedField(page).press('Enter')
  await expect(inlineUndo(page)).toBeVisible()
  const focused = (): Promise<string> =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (el === null) return 'none'
      for (const attr of ['data-names-export', 'data-names-import', 'data-names-undo', 'data-names-goto']) if (el.hasAttribute(attr)) return attr
      return el.tagName.toLowerCase()
    })
  await exportButton(page).focus()
  await page.keyboard.press('Tab')
  await expect.poll(focused).toBe('data-names-import')
  await page.keyboard.press('Tab')
  await expect.poll(focused).toBe('data-names-undo')
  await page.keyboard.press('Tab')
  await expect.poll(focused).toBe('data-names-goto')
  await page.keyboard.press('Shift+Tab')
  await expect.poll(focused).toBe('data-names-undo')
  await expect(gotoField(page)).toBeVisible()
  expect(errors).toEqual([])
})

// The sliced scan (T-07-06d): at the largest base the report covers, a table the certificate cannot vouch for is scanned on the main
// thread in short slices. Under the shipped 6.3x CPU throttle the scan takes long, so the contract is what the page does while it runs:
// it paints, its tasks interleave with the slices, the Checking line shows after the grace, and the answer equals the engine's. The
// durations are logged, never asserted (repo convention T-05-38).
test('the scan at the limit under a 6.3x CPU throttle keeps the page responsive (sliced scan)', async ({ page, context }) => {
  test.setTimeout(240_000)
  const errors = trackErrors(page)
  const THROTTLE = 6.3
  const first = editSound(defaultNaming(SCAN_BASE), 1, SHARED)
  const both = editSound(first, 2, SHARED)
  expect(canCertify(first, CCRU_NAMING_PRESET), 'fixture: one typed sound is still certified, so no scan is running at the start').toBe(true)
  expect(canCertify(both, CCRU_NAMING_PRESET), 'fixture: a duplicate sound cannot be certified, so the scan runs').toBe(false)
  const report = findCollisions(both, CCRU_NAMING_PRESET)
  expect(report.groups).toBeGreaterThan(0)

  await openFor(page, SCAN_BASE)
  await openNames(page)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await typeSound(page, 1, SHARED)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(findCollisions(first, CCRU_NAMING_PRESET).groups))

  // the probe counts painted frames and task turns while the scan runs, and watches for the Checking state
  await page.evaluate(() => {
    const w = window as unknown as { __probe: { frames: number; ticks: number; sawChecking: boolean; stop: boolean; longestTaskMs: number } }
    const probe = { frames: 0, ticks: 0, sawChecking: false, stop: false, longestTaskMs: 0 }
    w.__probe = probe
    const frame = (): void => {
      probe.frames++
      if (!probe.stop) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      probe.ticks++
      if (!probe.stop) channel.port2.postMessage(0)
    }
    channel.port2.postMessage(0)
    new MutationObserver(records => {
      for (const record of records) {
        const target = record.target as HTMLElement
        if (target.hasAttribute('data-names-collisions') && target.getAttribute('aria-busy') === 'true') probe.sawChecking = true
      }
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-busy'] })
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) probe.longestTaskMs = Math.max(probe.longestTaskMs, entry.duration)
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // long task timing is a diagnostic only: a browser without it still gets the frame and task counts
    }
  })

  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const started = Date.now()
  let probe: { frames: number; ticks: number; sawChecking: boolean; longestTaskMs: number }
  try {
    const field = soundField(page, 2)
    await field.fill(SHARED)
    await field.press('Enter')
    await expect(collisionsBlock(page)).toHaveAttribute('data-count', String(report.groups), { timeout: 120_000 })
    await expect(collisionsBlock(page)).toHaveAttribute('data-demons', String(report.demons))
    probe = await page.evaluate(() => {
      const w = window as unknown as { __probe: { frames: number; ticks: number; sawChecking: boolean; stop: boolean; longestTaskMs: number } }
      w.__probe.stop = true
      return { ...w.__probe }
    })
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  const elapsed = Date.now() - started
  console.log(
    `scan at base ${SCAN_BASE} under ${THROTTLE}x throttle: ${elapsed} ms from Enter to the answer, ${probe.frames} frames and ${probe.ticks} task turns meanwhile, longest task ${Math.round(probe.longestTaskMs)} ms, Checking shown: ${probe.sawChecking}`,
  )
  // the contract: the scan is cut into slices, so frames are painted and other tasks run while it works
  expect(probe.sawChecking, 'the Checking line shows after the grace').toBe(true)
  expect(probe.frames, 'frames painted during the scan').toBeGreaterThanOrEqual(3)
  expect(probe.ticks, 'task turns that ran between the slices').toBeGreaterThanOrEqual(10)
  await expect(collisionsLine(page)).toHaveText(collisionsSome(report.groups, report.demons))
  expect(errors).toEqual([])
})

test('above the scan limit the report says it was not checked', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  const base = SCAN_BASE + 2
  await openFor(page, base)
  await openNames(page)
  await expect(collisionsBlock(page)).toHaveAttribute('data-count', '0')
  await typeSound(page, 1, SHARED)
  await typeSound(page, 2, SHARED)
  await expect(collisionsBlock(page)).toHaveAttribute('data-state', 'skip')
  await expect(collisionsLine(page)).toHaveText(collisionsNotChecked(SCAN_BASE))
  await expect(collisionToggle(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

// ── 4. the CCRU preset ────────────────────────────────────────────────────────────────────────────────────────────────

test('base 10 opens on the CCRU preset with the 45 canonical names; Generated and CCRU switch between them (NAM-04, D-14)', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  const canonical = Array.from({ length: COUNT_AT_10 }, (_, mesh) => CCRU_NAMING_PRESET.names[mesh] as string)
  expect(canonical.every(name => typeof name === 'string' && name !== '')).toBe(true)
  const generatedResolver = resolverOf(setSource(defaultNaming(10), 'generated', CCRU_NAMING_PRESET))
  const generatedNames = Array.from({ length: COUNT_AT_10 }, (_, mesh) => generatedResolver.nameOf(...netSpanOf(mesh)))
  expect(generatedNames[0]).not.toBe(canonical[0])

  await openViewer(page, '')
  await openNames(page)
  const source = namesBox(page).locator('[role="radiogroup"][aria-label="Naming source"]')
  await expect(source.locator('input[data-names-source="ccru"]')).toBeChecked()
  await expect(source.locator('input[data-names-source="generated"]')).not.toBeChecked()
  await openDemons(page)
  expect(await readBrowserNames(page, COUNT_AT_10)).toEqual(canonical)
  await closeDemons(page)

  await namesLabel(page, NAMES_COPY.sourceGenerated).click()
  await expect(source.locator('input[data-names-source="generated"]')).toBeChecked()
  await expect(statusLine(page)).toHaveText(generated(10, defaultNaming(10).seed))
  await openDemons(page)
  const shownGenerated = await readBrowserNames(page, COUNT_AT_10)
  expect(shownGenerated[0]).toBe(generatedNames[0])
  expect(shownGenerated).toEqual(generatedNames)
  await closeDemons(page)

  await namesLabel(page, NAMES_COPY.sourceCcru).click()
  await expect(source.locator('input[data-names-source="ccru"]')).toBeChecked()
  await expect(statusLine(page)).toHaveText(NAMES_COPY.loadedCcru)
  await openDemons(page)
  const shownBack = await readBrowserNames(page, COUNT_AT_10)
  expect(shownBack[0]).toBe(canonical[0])
  expect(shownBack).toEqual(canonical)
  await closeDemons(page)
  expect(errors).toEqual([])
})

test('canonical names never appear at another base: base 12 shows only generated names and no CCRU source (NAM-04, D-14)', async ({ page }) => {
  const errors = trackErrors(page)
  const total = (12 * 11) / 2
  const resolver = resolverOf(defaultNaming(12))
  const expected = Array.from({ length: total }, (_, mesh) => resolver.nameOf(...netSpanOf(mesh)))
  const canonical = new Set(Object.values(CCRU_NAMING_PRESET.names))
  expect(canonical.size).toBe(COUNT_AT_10)

  await openViewer(page, 'base=12')
  await openNames(page)
  await expect(namesBox(page).locator('[role="radiogroup"][aria-label="Naming source"]')).toHaveCount(0)
  await expect(namesBox(page).getByText(NAMES_COPY.ccruHint)).toBeVisible()
  await openDemons(page)
  const shown = await readBrowserNames(page, total)
  expect(shown).toEqual(expected)
  expect(shown.filter(name => canonical.has(name))).toEqual([])
  await closeDemons(page)
  expect(errors).toEqual([])
})
