import { test, expect, type Page } from '@playwright/test'
import { DEFAULT_SEED, editSound, serializeNaming } from '../engine/index'
import { defaultNamingFor, type NamingEnv } from '../app/lib/namingSession'
import { NAMING_STORAGE_PREFIX } from '../app/lib/namingLimits'
import { NAMES_COPY } from '../app/lib/namingCopy'
import { INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'
import { openFor, openHeadless, openViewer } from './viewer-helpers'
import { NAMES_LIVE, defaultResolver, namesBody, namesBox, namesHeaderTag, namesScroll, namesState, namesToggle, openNames } from './names-helpers'

// Plan 07-21's smoke proof: the Names panel mounts at every tier and base (SVG, Canvas, headless, and a `?tier=` override that must not
// change it), is collapsed on first load with no header tag, opens to the state the base decides, and in labels=sounds mode the zone
// node labels show the naming's sounds on the zone layouts and numerals on the pair graph. Bases come from the tier table, never typed;
// every expected sound is read from the engine's default naming of the base. The detailed behaviour of each block is 07-22's.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 7 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })

const CANVAS_BASE = SVG_RICH_MAX_N + 2 // the first even base the tier table sends to the Canvas tier
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2 // the first even base above the shipped ceiling
const NAMING_ENV: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }
/** The Share button: its aria-label never changes, its title does while the naming holds edits a link cannot carry. */
const shareButton = (page: Page) => page.locator('button[aria-label="Share current state"]')

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

async function expectCollapsedAndMounted(page: Page): Promise<void> {
  await expect(page.locator(NAMES_LIVE)).toHaveCount(1)
  await expect(namesBox(page)).toBeVisible()
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesScroll(page)).toHaveCount(0)
  await expect(namesHeaderTag(page)).toHaveCount(0)
}

test('base 10: mounted and collapsed with no tag; opens ready with the CCRU source checked', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page)
  await expectCollapsedAndMounted(page)
  expect(await namesState(page)).toBe('ready')

  await openNames(page)
  expect(await namesState(page)).toBe('ready')
  const source = namesBox(page).locator('[role="radiogroup"][aria-label="Naming source"]')
  await expect(source).toBeVisible()
  await expect(source.locator('input[data-names-source="ccru"]')).toBeChecked()
  await expect(source.locator('input[data-names-source="generated"]')).not.toBeChecked()

  // the toggle collapses it again, and the live carrier stays mounted either way
  await namesToggle(page).click()
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesScroll(page)).toHaveCount(0)
  await expect(page.locator(NAMES_LIVE)).toHaveCount(1)
  expect(errors).toEqual([])
})

test('base 28: ready with no Source row and the default seed', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, 'base=28')
  await expectCollapsedAndMounted(page)
  expect(await namesState(page)).toBe('ready')
  await expect(namesBody(page)).toHaveAttribute('data-names-base', '28')
  // nothing a link cannot carry: the Share title is the plain one
  await expect(shareButton(page)).toHaveAttribute('title', NAMES_COPY.shareTitle)

  await openNames(page)
  expect(await namesState(page)).toBe('ready')
  await expect(namesBox(page).locator('[role="radiogroup"][aria-label="Naming source"]')).toHaveCount(0)
  await expect(namesBox(page).locator('input[data-names-seed]')).toHaveValue(DEFAULT_SEED)
  expect(errors).toEqual([])
})

// Honest sharing (D-13): a saved naming with an edited sound is something a link cannot carry. The collapsed header says so with its one
// tag, the Share button's title says so, and pressing Share puts the same sentence into the panel's live carrier (the button's label and
// its sharing are unchanged). The slot is seeded before the page loads from a naming the engine builds.
test('a saved edit a link cannot carry: the header tag, the Share title and the Share announcement say so', async ({ page }) => {
  const errors = trackErrors(page)
  const edited = editSound(defaultNamingFor(28, NAMING_ENV), 5, 'qzx')
  await page.addInitScript(
    ({ key, text }: { key: string; text: string }) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, text)
    },
    { key: `${NAMING_STORAGE_PREFIX}28`, text: serializeNaming(edited) },
  )
  await openViewer(page, 'base=28')
  await expect(namesToggle(page)).toHaveAttribute('aria-label', 'Expand Names')
  await expect(namesHeaderTag(page)).toHaveCount(1)
  await expect(namesHeaderTag(page)).toHaveAttribute('data-names-header-tag', 'edits')
  await expect(namesHeaderTag(page)).toHaveText(NAMES_COPY.tagEdits)
  await expect(shareButton(page)).toHaveCount(1)
  await expect(shareButton(page)).toHaveAttribute('title', NAMES_COPY.shareTitleUncarried)
  await expect(page.locator(NAMES_LIVE)).toHaveText('')

  await shareButton(page).click()
  await expect(page.locator(NAMES_LIVE)).toHaveText(NAMES_COPY.shareTitleUncarried)
  expect(errors).toEqual([])
})

test('a Canvas-tier base: the panel mounts and is ready', async ({ page }) => {
  const errors = trackErrors(page)
  await openFor(page, CANVAS_BASE)
  await expectCollapsedAndMounted(page)
  expect(await namesState(page)).toBe('ready')
  await expect(namesBody(page)).toHaveAttribute('data-names-base', String(CANVAS_BASE))

  await openNames(page)
  expect(await namesState(page)).toBe('ready')
  await expect(namesBox(page).locator('input[data-names-seed]')).toHaveValue(DEFAULT_SEED)
  expect(errors).toEqual([])
})

test('the first base above the ceiling: the panel mounts in the headless tier and is seed-only', async ({ page }) => {
  const errors = trackErrors(page)
  await openFor(page, SEED_ONLY_BASE)
  await expectCollapsedAndMounted(page)
  expect(await namesState(page)).toBe('seed-only')
  await expect(namesBody(page)).toHaveAttribute('data-names-base', String(SEED_ONLY_BASE))

  await openNames(page)
  expect(await namesState(page)).toBe('seed-only')
  await expect(namesBox(page).locator('[data-names-seed-only]')).toBeVisible()
  expect(errors).toEqual([])
})

test('a tier override never changes the panel: base 28 under tier=headless is ready (the base decides)', async ({ page }) => {
  const errors = trackErrors(page)
  await openHeadless(page, 'base=28&tier=headless')
  await expectCollapsedAndMounted(page)
  expect(await namesState(page)).toBe('ready')
  await expect(namesBody(page)).toHaveAttribute('data-names-base', '28')

  await openNames(page)
  expect(await namesState(page)).toBe('ready')
  expect(errors).toEqual([])
})

test('labels=sounds at base 28 shows the engine sound on the zone node; the pair graph keeps numerals', async ({ page }) => {
  const errors = trackErrors(page)
  const resolver = defaultResolver(28)
  await openViewer(page, 'base=28&labels=sounds')
  await expect(page.locator('[data-zone="12"] [data-sound-label]')).toHaveAttribute('data-sound-label', resolver.soundOf(12))
  await expect(page.locator('[data-diagram="zones"] [data-sound-label]')).toHaveCount(28)

  await openViewer(page, 'base=28&labels=sounds&layout=pairGraph')
  await expect(page.locator('[data-diagram="pairs"]')).toBeVisible()
  await expect(page.locator('[data-sound-label]')).toHaveCount(0)
  expect(errors).toEqual([])
})
