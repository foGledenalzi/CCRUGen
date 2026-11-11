import { expect, type Download, type Locator, type Page } from '@playwright/test'
import { createNameResolver, netSpanOf, type NameResolver, type Naming } from '../engine/index'
import { netSpanLabel } from '../app/lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../app/lib/labelScheme'
import type { ImportCopyContext } from '../app/lib/namingCopy'
import { NAMING_AUTOSAVE_DEBOUNCE_MS, NAMING_STORAGE_PREFIX } from '../app/lib/namingLimits'
import { defaultNamingFor, type NamingEnv } from '../app/lib/namingSession'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { demonRow, demonsDialog, openDemons, searchDemons } from './demons-helpers'

// Shared helpers for the Phase 7 Names specs (never collected as a spec: playwright.config.ts's testMatch is /\.spec\.ts$/ only, so this
// file, like e2e/viewer-helpers.ts, is imported and not run directly).
//
// The Names panel is NEVER located with the `panel` helper of viewer-helpers: that helper filters a header by its exact text, and the
// panel's header tag (`unsaved preview`, `edits not in links`) sits inside the same header, so the match fails while a tag is showing
// (07-PATTERNS alert 2). The panel's box is the position:fixed ancestor of the always-mounted live carrier instead.

/** The live carrier: persistent and sr-only, mounted whether the panel is collapsed or open (research Pitfall 13). */
export const NAMES_LIVE = '[data-names-live]'

/** The Names panel's fixed box (header and body): the position:fixed ancestor of the live carrier. */
export const namesBox = (page: Page): Locator =>
  page.locator(NAMES_LIVE).locator('xpath=ancestor::div[contains(translate(@style," ",""),"position:fixed")][1]')

/** The panel's content root (`data-names-panel`); it carries `data-names-state` and `data-names-base`. */
export const namesBody = (page: Page): Locator => page.locator('[data-names-panel]')

/** The panel's single scroll container: mounted only while the panel is open. */
export const namesScroll = (page: Page): Locator => page.locator('[data-names-scroll]')

/** The collapse/expand toggle in the panel header (its label follows the state: `Expand Names` or `Collapse Names`). */
export const namesToggle = (page: Page): Locator =>
  namesBox(page).locator('header button[aria-label="Expand Names"], header button[aria-label="Collapse Names"]')

/** The one tag the collapsed header may show (`data-names-header-tag` is `preview` or `edits`). */
export const namesHeaderTag = (page: Page): Locator => namesBox(page).locator('[data-names-header-tag]')

/** Opens the panel from its header toggle and waits for the scroll container. A no-op when it is already open. */
export async function openNames(page: Page): Promise<void> {
  const expand = namesBox(page).locator('header button[aria-label="Expand Names"]')
  if ((await expand.count()) > 0) await expand.click()
  await namesScroll(page).waitFor()
}

/** The panel state the page exposes: `ready`, `pending`, `seed-only` or `preview` (null when the panel is not mounted). */
export async function namesState(page: Page): Promise<string | null> {
  return namesBody(page).getAttribute('data-names-state')
}

/** The naming environment of the app (the ceiling from the tier table, the CCRU preset by reference), for the default naming of a base. */
export const NAMING_ENV: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }

/** The default naming's resolver of a base, built from the engine and the CCRU preset by reference (the expectations never type a name). */
export function defaultResolver(base: number): NameResolver {
  return createNameResolver(defaultNamingFor(base, NAMING_ENV), CCRU_NAMING_PRESET)
}

// ----- Phase 7 plan 07-22: the zone list, the seed field, the demon editors and the history buttons -----

/** The row of one zone in the Names zone list (mounted only while it is inside the list's window). */
export const nameRow = (page: Page, zone: number): Locator => page.locator(`[data-names-row="${zone}"]`)
/** The sound field of one zone. */
export const soundField = (page: Page, zone: number): Locator => page.locator(`input[data-names-sound="${zone}"]`)
/** The lock toggle of one zone. */
export const lockButton = (page: Page, zone: number): Locator => page.locator(`button[data-names-lock="${zone}"]`)
/** The seed field of the panel. */
export const seedField = (page: Page): Locator => namesBox(page).locator('input[data-names-seed]')
/** The Reroll button of the panel. */
export const rerollButton = (page: Page): Locator => namesBox(page).locator('button[data-names-reroll]')
/** The list-level message line (empty text while nothing is wrong). */
export const listMessage = (page: Page): Locator => page.locator('[data-names-list-message]')
/** The Go to zone field. */
export const gotoField = (page: Page): Locator => page.locator('input[data-names-goto]')

/** The header Undo and Redo buttons (never the panel's inline `Undo this change`). */
export const undoButton = (page: Page): Locator => page.locator('button[aria-label="Undo"]')
export const redoButton = (page: Page): Locator => page.locator('button[aria-label="Redo"]')

/** One demon name editor, told apart by its mount: `selection`, `overlay` or `collision` (the bare selector is ambiguous). */
export const demonEditor = (page: Page, context: 'selection' | 'overlay' | 'collision'): Locator =>
  page.locator(`[data-demon-name-editor][data-demon-name-context="${context}"]`)

/** The browser row's NAME cell of a demon (the Demons overlay must be open on its browser tab). */
export const nameCell = (page: Page, mesh: number): Locator =>
  demonRow(page, 'browser', mesh).locator('[role="gridcell"][data-col="name"]')

/** Two animation frames: enough for a layout, a scroll and the virtualizer's window to follow. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}

/**
 * Waits until every running finite CSS transition or animation has finished (an endless one never would). The panel opens with a 200 ms
 * max-height transition during which its wrapper (overflow-y: auto) can show a bar of its own, so any measurement of widths or boxes
 * waits for this first.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.effect === null || a.effect.getComputedTiming().iterations !== Infinity)
        .map(a => a.finished.catch(() => undefined)),
    ).then(() => undefined),
  )
}

/** Types a zone into the Go to zone field and presses Enter: the row scrolls to the top of the list and its sound field takes focus. */
export async function gotoZone(page: Page, text: string, zone: number): Promise<Locator> {
  const field = gotoField(page)
  await field.fill(text)
  await field.press('Enter')
  const sound = soundField(page, zone)
  await expect(sound).toBeFocused()
  return sound
}

/** What the zone list shows for every zone: the text of each sound field and each row's lock flag, read by scrolling the one scroller through the list. */
export interface ListTable {
  readonly sounds: readonly string[]
  readonly locked: readonly boolean[]
}

/**
 * Reads every row of the (virtualized) zone list of a small base by walking the panel's single scroller from the top to the bottom and
 * collecting the mounted rows at each stop. It throws when a zone was never seen, so a window that skips a row can never pass as equal.
 */
export async function readTable(page: Page, base: number): Promise<ListTable> {
  const raw = await page.evaluate(async (n: number) => {
    const scroller = document.querySelector('[data-names-scroll]') as HTMLElement | null
    if (scroller === null) throw new Error('the Names panel is not open')
    const sounds: Array<string | null> = new Array<string | null>(n).fill(null)
    const locked: boolean[] = new Array<boolean>(n).fill(false)
    const frames = (): Promise<void> => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const collect = (): void => {
      for (const row of Array.from(document.querySelectorAll('[data-names-row]'))) {
        const zone = Number(row.getAttribute('data-names-row'))
        const input = row.querySelector('input[data-names-sound]') as HTMLInputElement | null
        if (input === null || !Number.isInteger(zone) || zone < 0 || zone >= n) continue
        sounds[zone] = input.value
        locked[zone] = row.getAttribute('data-locked') === 'true'
      }
    }
    scroller.scrollTop = 0
    await frames()
    collect()
    const step = Math.max(60, scroller.clientHeight - 60)
    while (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1) {
      scroller.scrollTop += step
      await frames()
      collect()
    }
    scroller.scrollTop = scroller.scrollHeight
    await frames()
    collect()
    return { sounds, locked }
  }, base)
  const missing = raw.sounds.findIndex(s => s === null)
  if (missing >= 0) throw new Error(`zone ${missing} was never mounted while walking the list`)
  return { sounds: raw.sounds as string[], locked: raw.locked }
}

/** The ordered list of zones a naming holds locked. */
export function lockedZones(locked: readonly boolean[]): number[] {
  const out: number[] = []
  locked.forEach((on, zone) => {
    if (on) out.push(zone)
  })
  return out
}

/** The zones of a naming in the order of `locks`, ascending (the form lockedZones gives of a table read from the page). */
export function lockedOf(naming: Naming): number[] {
  return Array.from(naming.locks).sort((a, b) => a - b)
}

/** The base picker's field: opens the dropdown and commits a base through the picker (the history of the previous base is cleared). */
export async function switchBase(page: Page, base: number): Promise<void> {
  const input = page.getByLabel('Base', { exact: true })
  await input.click()
  await input.fill(String(base))
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(base)
}

/** Opens the Demons overlay, finds the demon by a search text (none: it is among the first rows), clicks its row (the pin) and closes it. */
export async function pinFromOverlay(page: Page, search: string, mesh: number): Promise<void> {
  await openDemons(page)
  if (search !== '') await searchDemons(page, search)
  await demonRow(page, 'browser', mesh).click()
  await demonsDialog(page).getByRole('button', { name: 'close' }).click()
  await expect(demonsDialog(page)).toBeHidden()
}

/** Closes the Demons overlay with its close button. */
export async function closeDemons(page: Page): Promise<void> {
  await demonsDialog(page).getByRole('button', { name: 'close' }).click()
  await expect(demonsDialog(page)).toBeHidden()
}

/**
 * Replaces `crypto.getRandomValues` for the two-word request the Reroll button makes with a deterministic sequence, so the seed a Reroll
 * writes is a fixed function of the press count (the spec can then pick expectations that are certain, not merely likely). Every other
 * request goes to the real source. Call before the first navigation.
 */
export async function stubRerollRandom(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto) as (array: unknown) => unknown
    let presses = 0
    const stub = (array: unknown): unknown => {
      if (array instanceof Uint32Array && array.length === 2) {
        presses += 1
        array[0] = (0x1badb002 + presses * 0x3d4d51cb) >>> 0
        array[1] = (0x9e3779b1 ^ (presses * 0x85ebca6b)) >>> 0
        return array
      }
      return real(array)
    }
    crypto.getRandomValues = stub as typeof crypto.getRandomValues
  })
}

// ----- Phase 7 plan 07-23: files, the browser slot, the status line, the live carrier and the Demons browser's NAME column -----

/** Time for the debounced autosave to land, with room to spare. Used to prove that something was NOT written; a write is awaited by polling. */
export const AUTOSAVE_WAIT_MS = NAMING_AUTOSAVE_DEBOUNCE_MS + 200

/** The Export and Import buttons, the hidden file input, the status line and the autosave line of the panel (the panel must be open). */
export const exportButton = (page: Page): Locator => namesBox(page).locator('button[data-names-export]')
export const importButton = (page: Page): Locator => namesBox(page).locator('button[data-names-import]')
export const importInput = (page: Page): Locator => page.locator('input[data-names-import-input]')
export const statusLine = (page: Page): Locator => namesBox(page).locator('[data-names-status]')
export const savedLine = (page: Page): Locator => namesBox(page).locator('[data-names-saved]')
/** The panel's inline `Undo this change` button (never the header Undo). */
export const inlineUndo = (page: Page): Locator => namesBox(page).locator('button[data-names-undo]')

/** The collision block, its count line, its toggle and its jump buttons (the panel must be open). */
export const collisionsBlock = (page: Page): Locator => namesBox(page).locator('[data-names-collisions]')
export const collisionsLine = (page: Page): Locator => namesBox(page).locator('[data-names-collisions-line]')
export const collisionToggle = (page: Page): Locator => namesBox(page).locator('button[data-collision-toggle]')
export const jumpButton = (page: Page, mesh: number): Locator => namesBox(page).locator(`button[data-collision-jump="${mesh}"]`)

/** The text a download carries (UTF-8). */
export async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array))
  return Buffer.concat(chunks).toString('utf8')
}

/** Hands a file to the panel's hidden file input, exactly as the browser's file chooser would. */
export async function chooseFile(page: Page, name: string, content: string | Buffer): Promise<void> {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
  await importInput(page).setInputFiles({ name, mimeType: 'application/json', buffer })
}

/** What the sentences of an import refusal need from the page: the base and the digits labels (the default scheme). */
export function importCopyContext(base: number): ImportCopyContext {
  const zoneLabel = (zone: number): string => formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME)
  return {
    base,
    zoneLabel,
    netSpan: mesh => {
      const [a, b] = netSpanOf(mesh)
      return netSpanLabel(a, b, zoneLabel)
    },
  }
}

/** The text of the browser slot of a base (null when none was written). */
export async function readSlot(page: Page, base: number): Promise<string | null> {
  return page.evaluate((key: string) => window.localStorage.getItem(key), `${NAMING_STORAGE_PREFIX}${base}`)
}

/**
 * Puts `text` into the slot of `base` before the page loads, only while the slot is empty: a later navigation of the same context
 * (after a Keep, say) then keeps what the page wrote instead of being reset. Call before the first navigation.
 */
export async function seedSlot(page: Page, base: number, text: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value)
    },
    { key: `${NAMING_STORAGE_PREFIX}${base}`, value: text },
  )
}

/** Types a sound into the zone's field and commits it with Enter; the row's lock turns on (an edit locks its zone). */
export async function typeSound(page: Page, zone: number, text: string): Promise<void> {
  const field = soundField(page, zone)
  await field.fill(text)
  await field.press('Enter')
  await expect(nameRow(page, zone)).toHaveAttribute('data-locked', 'true')
  await expect(field).toHaveValue(text)
}

/** Renames the pinned demon from the Selection panel's editor. */
export async function renamePinned(page: Page, name: string): Promise<void> {
  const editor = demonEditor(page, 'selection')
  await editor.locator('button[data-demon-rename]').click()
  await editor.locator('input[data-demon-name-input]').fill(name)
  await editor.locator('button[data-demon-name-save]').click()
}

/** Starts recording every non-empty text the live carrier takes, in order (consecutive duplicates once). Call after each navigation. */
export async function recordLive(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.querySelector('[data-names-live]')
    if (el === null) throw new Error('the live carrier is not mounted')
    const w = window as unknown as { __namesLive?: string[] }
    const log: string[] = []
    w.__namesLive = log
    new MutationObserver(() => {
      const text = el.textContent ?? ''
      if (text !== '' && log[log.length - 1] !== text) log.push(text)
    }).observe(el, { childList: true, characterData: true, subtree: true })
  })
}

/** The texts recorded since recordLive, in order. */
export async function liveLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __namesLive?: string[] }).__namesLive ?? [])
}

/**
 * Reads the NAME cell of every demon of the (virtualized) Demons browser by walking its one scroller from the top to the bottom,
 * and throws when a mesh was never mounted, so a window that skips a row can never pass as equal. The overlay must be open on its
 * browser tab. The text is the whole cell: the name, and for an overridden name the marker and its hidden words.
 */
export async function readBrowserNames(page: Page, total: number): Promise<string[]> {
  const raw = await page.evaluate(async (count: number) => {
    const list = document.querySelector('[data-demon-list="browser"]') as HTMLElement | null
    if (list === null) throw new Error('the Demons browser is not open')
    const names: Array<string | null> = new Array<string | null>(count).fill(null)
    const frames = (): Promise<void> => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const collect = (): void => {
      for (const row of Array.from(list.querySelectorAll('[data-demon-row]'))) {
        const mesh = Number(row.getAttribute('data-demon-row'))
        const cell = row.querySelector('[role="gridcell"][data-col="name"]')
        if (cell === null || !Number.isInteger(mesh) || mesh < 0 || mesh >= count) continue
        names[mesh] = cell.textContent ?? ''
      }
    }
    list.scrollTop = 0
    await frames()
    collect()
    const step = Math.max(60, list.clientHeight - 60)
    while (list.scrollTop + list.clientHeight < list.scrollHeight - 1) {
      list.scrollTop += step
      await frames()
      collect()
    }
    list.scrollTop = list.scrollHeight
    await frames()
    collect()
    return names
  }, total)
  const missing = raw.findIndex(s => s === null)
  if (missing >= 0) throw new Error(`demon ${missing} was never mounted while walking the browser`)
  return raw as string[]
}

/**
 * Records every key written to the browser storage by the page (any writer, identical bytes included), so "nothing is written" is a
 * fact about the writes and not only about the slot's value. Call AFTER seedSlot and before the first navigation (the init scripts run in
 * the order they were added, so a seeded slot is not counted); the list starts empty in every document.
 */
export async function spyStorageWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __storageWrites?: string[] }
    const writes: string[] = []
    w.__storageWrites = writes
    const real = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(this: Storage, key: string, value: string): void {
      writes.push(key)
      real.call(this, key, value)
    }
  })
}

/** The keys written since the page loaded (see spyStorageWrites), in order. */
export async function storageWrites(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __storageWrites?: string[] }).__storageWrites ?? [])
}

/** The storage key of the slot of a base. */
export const slotKeyOf = (base: number): string => `${NAMING_STORAGE_PREFIX}${base}`
