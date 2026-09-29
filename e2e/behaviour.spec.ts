import { test, expect, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { collect, PANELS } from './behaviour-collect'
import { baselineAction, diffBaseline, normalizeDeep } from './behaviour-compare'

// Behaviour and text baseline (MIG-01, D-15). The DOM goldens capture only the projection <svg>; this spec
// replays a fixed user script against the built static export and compares what the panels, hover popovers,
// Selection panel, URL and shortcuts show with frozen JSON under e2e/__behaviour__/. Only text, attribute
// and computed-style facts are recorded (see behaviour-collect.ts), so the baseline captured on Windows holds
// on any OS. A baseline is written only by BEHAVIOUR_CAPTURE=1 when its file is missing (it never overwrites);
// a correction is a NEW dated set from a checkout of the pre-swap viewer, never -u.

// Marker contract (Phase 4, plan 04-01): locators below exclude [data-post-baseline] subtrees; see
// behaviour-collect.ts for the full contract.
const SVG = 'svg[viewBox^="0 0 800 "]'
const HEIGHT: Record<string, number> = { original: 940, labyrinth: 880, ladder: 870 } // svgHeight targets in app/hooks/useTween.ts
const PLANETARY_HEIGHT = 800
const TOGGLEABLE = PANELS.filter(p => p !== 'Selection')
const LAYOUTS = [
  { name: 'original', qs: '' },
  { name: 'labyrinth', qs: 'layout=labyrinth' },
  { name: 'ladder', qs: 'layout=ladder' },
  { name: 'planetary', qs: 'layout=planetary&date=2000-01-01' },
]

type Stages = Record<string, unknown>
type Behaviour = { name: string; value: unknown }
interface Baseline { schema: 1; layout: string; stages: Stages; behaviours: Behaviour[] }

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Poll `read` every 50 ms; return its value once JSON.stringify of it has not changed for quietMs. */
async function stable<T>(read: () => Promise<T>, quietMs = 300, timeoutMs = 10_000): Promise<T> {
  const t0 = Date.now()
  let value = await read()
  let key = JSON.stringify(value)
  let since = Date.now()
  for (;;) {
    if (Date.now() - since >= quietMs) return value
    if (Date.now() - t0 > timeoutMs) throw new Error(`stable: no ${quietMs} ms of quiet within ${timeoutMs} ms (last: ${String(key).slice(0, 300)})`)
    await wait(50)
    const next = await read()
    const nextKey = JSON.stringify(next)
    if (nextKey !== key) {
      value = next
      key = nextKey
      since = Date.now()
    }
  }
}

async function openPage(browser: Browser, baseURL: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC', baseURL })
  // The share flow reads navigator.share, then navigator.clipboard: stub both so it is identical on every OS
  // and never touches the developer machine's clipboard or share sheet (no clipboard permission is requested).
  await context.addInitScript(() => {
    let store = ''
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t: unknown) => { store = String(t) }, readText: async () => store },
      configurable: true,
    })
  })
  const page = await context.newPage()
  return { context, page }
}

const panel = (page: Page, name: string) =>
  page.locator('header').filter({ hasText: new RegExp(`^${name}$`) }).first().locator('xpath=ancestor::div[contains(translate(@style," ",""),"position:fixed")][1]')

/** The collected snapshot, dates and the origin already masked, read until it stops changing. */
const snapshot = (page: Page, origin: string) => stable(async () => normalizeDeep(await page.evaluate(collect, PANELS), origin))

async function settle(page: Page, layout: string, origin: string) {
  await page.waitForSelector(SVG)
  if (HEIGHT[layout]) await page.waitForSelector(`svg[viewBox="0 0 800 ${HEIGHT[layout]}"]`)
  else await page.waitForFunction(() => document.querySelector('svg[viewBox^="0 0 800 "]')?.getAttribute('viewBox') !== '0 0 800 940') // SSR paints 940, planetary tweens away from it
  await page.waitForFunction(() => {
    const el = document.querySelector('svg[viewBox^="0 0 800 "]')
    return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
  })
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  await snapshot(page, origin)
}

/** Wait until the layout tween has reached its final svg height. */
const waitViewBoxHeight = (page: Page, height: number) =>
  page.waitForFunction(h => document.querySelector('svg[viewBox^="0 0 800 "]')?.getAttribute('viewBox') === `0 0 800 ${h}`, height)

async function driveLayout(page: Page, L: { name: string; qs: string }, origin: string): Promise<Baseline> {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`/numogram/?${L.qs}`)
  await settle(page, L.name, origin)

  const stages: Stages = {}
  const behaviours: Behaviour[] = []
  const B = (name: string, value: unknown) => { behaviours.push({ name, value }) }
  const R = async <T>(name: string, read: () => Promise<T>) => { B(name, await stable(read)) }
  const snap = () => snapshot(page, origin)
  const search = () => page.evaluate(() => location.search)
  const popovers = () => page.evaluate(() => Array.from(document.querySelectorAll('div[class*="z-[95]"]:not([data-post-baseline])')).map(d => (d.textContent ?? '').trim()).join('||'))
  const modalCount = () => page.locator('div[class*="z-[84]"]').count()
  const away = async () => { await page.mouse.move(700, 500); await stable(popovers) }

  stages.initial = await snap()

  // marker-contract guard (T-04-01): marking any pre-existing region fails the spec, so the skip in
  // behaviour-collect.ts can never be used to hide an element that already existed at capture time.
  const markedRegions = await page.evaluate((names: string[]) => {
    const bad: string[] = []
    for (const h of Array.from(document.querySelectorAll('header'))) {
      const t = (h.textContent || '').replace(/\s+/g, ' ').trim()
      if (names.includes(t) && h.closest('[data-post-baseline]')) bad.push(t)
    }
    const svg = document.querySelector('svg[viewBox^="0 0 800 "]')
    if (svg && svg.closest('[data-post-baseline]')) bad.push('svg')
    const hdr = Array.from(document.querySelectorAll('header')).find(h => !names.includes((h.textContent || '').replace(/\s+/g, ' ').trim()) && !h.closest('[data-post-baseline]'))
    if (!hdr) bad.push('page header')
    return bad
  }, [...PANELS])
  expect(markedRegions).toEqual([])

  // hover readouts on the layout buttons
  const layoutButtons = page.locator('div.fixed.top-0 button:not([data-post-baseline])').filter({ hasText: /^[ASDF]$/ })
  const nBtn = await layoutButtons.count()
  const hoverLabels: string[] = []
  for (let i = 0; i < nBtn; i++) {
    await layoutButtons.nth(i).hover()
    hoverLabels.push(await stable(() => page.evaluate(() => (document.querySelector('div.fixed.top-0 .h-4')?.textContent || '').trim())))
  }
  await page.mouse.move(700, 500)
  B('layout-button hover labels', hoverLabels)

  // hover popover readouts
  const layerRow = panel(page, 'Layers').locator('div.cursor-pointer').first()
  await layerRow.hover()
  await R('hover Layers first row: popover text', popovers)
  await away()
  const zonePanel = panel(page, 'Zones')
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^1/ }).locator('span').nth(2).hover().catch(() => {})
  await R('hover Zones row 1 xenotation: popover text', popovers)
  await away()
  // hover a zone row (drives the highlight state)
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^5/ }).hover()
  await R('hover Zones row 5: svg still present', async () => !!(await page.$(SVG)))
  await page.mouse.move(700, 500)
  await stable(popovers)

  // lore sweep (original layout): the lore of a zone, syzygy, current or gate is only shown in the Selection panel
  // (hovering a row shows nothing but a highlight), so select each row of the four lore panels, open its own item
  // and record every visible text: a wrong lore key on any of them changes the baseline. Rows are clicked at their
  // top-left corner (the row's own padding, todo 003) so the hit target never depends on font metrics. The
  // selection is cleared after each row and the page is reloaded afterwards, so the undo history the sweep made
  // does not leak into the behaviours below.
  const sel = panel(page, 'Selection')
  if (L.name === 'original') {
    const allTexts = async () => (await page.evaluate(collect, PANELS)).texts
    for (const name of ['Zones', 'Syzygies', 'Currents', 'Gates']) {
      const rows = panel(page, name).locator('div.cursor-pointer')
      const count = await rows.count()
      for (let i = 0; i < count; i++) {
        const first = ((await rows.nth(i).locator('span').first().textContent()) ?? '').trim()
        const title = name === 'Zones' ? `Zone ${first}` : name === 'Syzygies' ? `Syzygy ${first}` : name === 'Currents' ? `${first} Current` : first
        await rows.nth(i).click({ position: { x: 1, y: 1 } })
        const titleBtn = sel.locator('button').filter({ hasText: new RegExp(`^${title}$`) })
        await titleBtn.waitFor()
        const closed = titleBtn.locator('xpath=..').locator('button[aria-label="Expand item"]')
        if ((await closed.count()) > 0) await closed.click()
        await R(`lore sweep ${name} row ${i}`, allTexts)
        await sel.locator('button', { hasText: /^clear$/ }).click()
        await stable(allTexts)
      }
    }
    await page.goto(`/numogram/?${L.qs}`)
    await settle(page, L.name, origin)
  }

  // panel open/close toggles
  const stripLayout = (s: { interactive: string[]; texts: unknown; open: unknown }) => JSON.stringify({ i: s.interactive, t: s.texts, o: s.open })
  const initialKey = stripLayout(stages.initial as { interactive: string[]; texts: unknown; open: unknown })
  for (const name of TOGGLEABLE) {
    const btn = panel(page, name).locator('header button:not([data-post-baseline])').first()
    if ((await btn.count()) === 0) {
      B(`panel ${name}: has NO open/close toggle in the rendered DOM`, true)
      continue
    }
    await btn.click()
    stages[`collapsed:${name}`] = await snap()
    await btn.click()
    const back = await snap()
    B(`toggle ${name}: collapse then expand restores the initial dump`, stripLayout(back) === initialKey)
  }

  // panel drag: the panel's left/top delta equals the mouse delta (no layout metric is recorded)
  {
    const root = panel(page, 'Layers')
    const style = () => root.evaluate((e: HTMLElement) => ({ l: e.style.left, t: e.style.top, z: e.style.zIndex }))
    const grab = async () => {
      const box = await root.locator('header span').first().boundingBox()
      if (!box) throw new Error('Layers header has no box to drag')
      return box
    }
    const before = await stable(style)
    const box = await grab()
    await page.mouse.move(box.x + 4, box.y + 4)
    await page.mouse.down()
    await page.mouse.move(box.x + 64, box.y + 44, { steps: 6 })
    await page.mouse.up()
    const after = await stable(style)
    B('drag Layers header by (+60,+40): left/top delta', [parseFloat(after.l) - parseFloat(before.l), parseFloat(after.t) - parseFloat(before.t)])
    B('drag Layers header raises z-index', Number(after.z) > Number(before.z))
    // put it back so later stages compare like with like
    const box2 = await grab()
    await page.mouse.move(box2.x + 4, box2.y + 4)
    await page.mouse.down()
    await page.mouse.move(box2.x - 56, box2.y - 36, { steps: 6 })
    await page.mouse.up()
    await stable(style)
  }

  // select zone 5, toggle one layer, undo/redo, clear
  const undoBtn = page.locator('button[aria-label="Undo"]')
  const redoBtn = page.locator('button[aria-label="Redo"]')
  await R('undo/redo disabled at start', async () => [await undoBtn.isDisabled(), await redoBtn.isDisabled()])
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^5/ }).click({ position: { x: 1, y: 1 } })
  stages['zone5-selected'] = await snap()
  await R('after selecting zone 5: url', search)
  await R('after selecting zone 5: undo enabled', async () => !(await undoBtn.isDisabled()))
  await panel(page, 'Layers').locator('div.cursor-pointer').filter({ hasText: /^Syzygies/ }).click({ position: { x: 1, y: 1 } })
  stages['zone5+syzygies-layer-toggled'] = await snap()
  await R('after toggling Syzygies layer: url', search)
  await undoBtn.click()
  stages['after-undo'] = await snap()
  await R('undo: url', search)
  await redoBtn.click()
  stages['after-redo'] = await snap()
  await R('redo: url', search)

  // selection panel controls
  const heading = () => sel.locator('span').filter({ hasText: /Selected Elements/ }).first().textContent()
  const expandBtns = sel.locator('button[aria-label="Expand item"], button[aria-label="Collapse item"]')
  await R('Selection panel expand/collapse buttons', () => expandBtns.count())
  if ((await expandBtns.count()) > 1) await expandBtns.nth(1).click().catch(() => {})
  stages['selection-item-expanded'] = await snap()
  const removeBtn = sel.locator('button[aria-label^="Remove"]')
  await R('Selection panel remove buttons', () => removeBtn.count())
  await sel.locator('button', { hasText: /^clear$/ }).click()
  stages['selection-cleared'] = await snap()
  await R('clear: url', search)

  // regions and time circuit
  const regionRow = (label: RegExp) => panel(page, 'Regions').locator('div.cursor-pointer').filter({ hasText: label })
  await regionRow(/^Torque/).click({ position: { x: 1, y: 1 } })
  await R('Regions: Torque url', search)
  await regionRow(/^Time Circuit/).click({ position: { x: 1, y: 1 } })
  await R('Regions: Time Circuit url', search)
  await regionRow(/^Time Circuit/).click({ position: { x: 1, y: 1 } })
  await stable(search)
  // labels + particles
  await panel(page, 'Labels').locator('div.cursor-pointer').filter({ hasText: /^Tic Xenotation/ }).click({ position: { x: 1, y: 1 } })
  stages['labels-xenotation-on'] = await snap()
  await panel(page, 'Layers').locator('div.cursor-pointer').filter({ hasText: /^Particles/ }).click({ position: { x: 1, y: 1 } })
  await R('Particles on: url', search)
  // gates + currents + syzygies list clicks
  await panel(page, 'Gates').locator('button', { hasText: /all|none|\/10/ }).first().click()
  await R('Gates panel count-toggle click: selection heading', heading)
  await panel(page, 'Currents').locator('div.cursor-pointer').first().click({ position: { x: 1, y: 1 } })
  await panel(page, 'Syzygies').locator('div.cursor-pointer').first().click({ position: { x: 1, y: 1 } })
  await R('after Gates toggle-all + Currents/Syzygies row clicks: selection heading', heading)
  stages['many-selected'] = await snap()

  // keyboard shortcuts
  await page.mouse.move(700, 500)
  const viewBox = () => page.evaluate(() => document.querySelector('svg[viewBox^="0 0 800 "]')?.getAttribute('viewBox'))
  await page.keyboard.press('Escape')
  await R('key Escape clears selection: heading', heading)
  if (L.name !== 'planetary') {
    for (const [key, lay] of [['s', 'labyrinth'], ['d', 'ladder'], ['a', 'original']] as const) {
      await page.keyboard.press(key)
      await waitViewBoxHeight(page, HEIGHT[lay])
      await R(`key ${key.toUpperCase()} -> ${lay}: viewBox`, viewBox)
    }
    await page.keyboard.press('f')
    await waitViewBoxHeight(page, PLANETARY_HEIGHT)
    await R('key F -> planetary: url + viewBox', async () => [await search(), await viewBox()])
    stages['planetary-via-key'] = await snap()
    await page.keyboard.press('a')
    await waitViewBoxHeight(page, HEIGHT.original)
    await R('key A back -> original: viewBox', viewBox)
  } else {
    for (const key of ['v', 'c', 'x']) {
      await page.keyboard.press(key)
      stages[`planetary-key-${key}`] = await snap()
      await R(`planetary key ${key}: url`, search)
    }
    await page.keyboard.press('z')
    stages['planetary-key-z'] = await snap()
    await page.keyboard.press('z')
    await snap()
  }
  await page.keyboard.press('5')
  await R('key 5 toggles gate 5: url', search)
  await page.keyboard.press('Escape')
  await R('key digit then Escape: heading', heading)
  await page.keyboard.press('Control+z')
  await R('Ctrl+Z after Escape: heading', heading)
  await page.keyboard.press('Control+y')
  await R('Ctrl+Y: heading', heading)
  await page.keyboard.press('Shift+Slash')
  await R('key Shift+/ opens shortcuts modal', modalCount)
  stages['shortcuts-modal-open'] = await snap()
  await page.keyboard.press('Escape')
  await R('Escape closes modal', modalCount)
  await page.locator('button', { hasText: /^shortcuts$/ }).click()
  await R('shortcuts trigger opens modal', modalCount)
  await page.locator('div[class*="z-[84]"] button', { hasText: /^close$/ }).click()
  await R('modal close button closes', modalCount)
  await page.locator('button', { hasText: /^shortcuts$/ }).click()
  await stable(modalCount)
  await page.locator('button[aria-label="Close shortcuts"]').click({ position: { x: 5, y: 5 } })
  await R('modal backdrop click closes', modalCount)

  // header: share + title link
  if (L.name === 'original') {
    await page.keyboard.press('5')
    await stable(search)
    await page.locator('button[aria-label="Share current state"]').click()
    await R('share button: clipboard text', () => page.evaluate(() => navigator.clipboard.readText().catch((e: Error) => 'ERR ' + e.message)))
    await R('header title link href', () => page.locator('header a').first().getAttribute('href'))
    await Promise.all([page.waitForURL(u => !u.search.includes('selected'), { timeout: 8000 }).catch(() => {}), page.locator('header a').first().click()])
    await R('header title link click: pathname+search', () => page.evaluate(() => location.pathname + location.search))
  }
  stages.final = await snap()
  B('page errors', [...errors])
  return { schema: 1, layout: L.name, stages, behaviours }
}

async function driveMobile(page: Page, origin: string): Promise<Baseline> {
  await page.goto('/numogram/')
  await settle(page, 'original', origin)
  const stages: Stages = { initial: await snapshot(page, origin) }
  const markedRegions = await page.evaluate((names: string[]) => {
    const bad: string[] = []
    for (const h of Array.from(document.querySelectorAll('header'))) {
      const t = (h.textContent || '').replace(/\s+/g, ' ').trim()
      if (names.includes(t) && h.closest('[data-post-baseline]')) bad.push(t)
    }
    const svg = document.querySelector('svg[viewBox^="0 0 800 "]')
    if (svg && svg.closest('[data-post-baseline]')) bad.push('svg')
    const hdr = Array.from(document.querySelectorAll('header')).find(h => !names.includes((h.textContent || '').replace(/\s+/g, ' ').trim()) && !h.closest('[data-post-baseline]'))
    if (!hdr) bad.push('page header')
    return bad
  }, [...PANELS])
  expect(markedRegions).toEqual([])
  const behaviours: Behaviour[] = []
  const hasToggle = (await panel(page, 'Layers').locator('header button:not([data-post-baseline])').count()) > 0
  behaviours.push({ name: 'has panel toggle', value: hasToggle })
  if (hasToggle) {
    for (const name of ['Layers', 'Zones']) {
      await panel(page, name).locator('header button:not([data-post-baseline])').first().click()
      stages[`open:${name}`] = await snapshot(page, origin)
      await panel(page, name).locator('header button:not([data-post-baseline])').first().click()
      await snapshot(page, origin)
    }
  }
  return { schema: 1, layout: 'original@mobile', stages, behaviours }
}

/** Compare with the frozen file, or (BEHAVIOUR_CAPTURE=1 and no file yet) write it. Never overwrites. */
function checkBaseline(name: string, baseline: Baseline, origin: string) {
  const info = test.info()
  const file = path.join(info.project.testDir, '__behaviour__', `${name}.json`)
  const text = JSON.stringify(normalizeDeep(baseline, origin), null, 1) + '\n'
  const actual: unknown = JSON.parse(text)
  const action = baselineAction(fs.existsSync(file), process.env.BEHAVIOUR_CAPTURE)
  if (action === 'capture') {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
    throw new Error(`captured e2e/__behaviour__/${name}.json; rerun without BEHAVIOUR_CAPTURE to compare`)
  }
  if (action === 'fail-missing') throw new Error(`behaviour baseline missing: e2e/__behaviour__/${name}.json`)
  const expected: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
  const diffs = diffBaseline(expected, actual)
  if (diffs.length > 0) fs.writeFileSync(info.outputPath(`actual-${name}.json`), text)
  expect(diffs).toEqual([])
}

const originOf = () => {
  const baseURL = test.info().project.use.baseURL
  if (!baseURL) throw new Error('no baseURL configured')
  return { baseURL, origin: new URL(baseURL).origin }
}

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'the behaviour baseline runs once; its contexts pin UTC'))

for (const L of LAYOUTS) {
  test(`behaviour: ${L.name}`, async ({ browser }) => {
    test.setTimeout(240_000)
    const { baseURL, origin } = originOf()
    const { context, page } = await openPage(browser, baseURL, { width: 1440, height: 900 })
    try {
      checkBaseline(L.name, await driveLayout(page, L, origin), origin)
    } finally {
      await context.close()
    }
  })
}

test('behaviour: mobile', async ({ browser }) => {
  test.setTimeout(240_000)
  const { baseURL, origin } = originOf()
  const { context, page } = await openPage(browser, baseURL, { width: 390, height: 800 })
  try {
    checkBaseline('mobile', await driveMobile(page, origin), origin)
  } finally {
    await context.close()
  }
})
