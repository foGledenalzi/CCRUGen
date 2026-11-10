import type { Locator, Page } from '@playwright/test'
import { createNameResolver, type NameResolver } from '../engine/index'
import { defaultNamingFor } from '../app/lib/namingSession'
import { INTERACTIVE_MAX_N } from '../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../app/presets/base10/naming'

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

/** The default naming's resolver of a base, built from the engine and the CCRU preset by reference (the expectations never type a name). */
export function defaultResolver(base: number): NameResolver {
  return createNameResolver(
    defaultNamingFor(base, { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }),
    CCRU_NAMING_PRESET,
  )
}
