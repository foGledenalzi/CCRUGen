// SEED MATERIAL, not a finished tool (kept from the todo-001 declutter task, 2026-09-26).
// Deterministic UI inventory of the built static app (4 layouts, panel text, hover popovers,
// Selection-panel text, URL state after each action). Phase 2 turns this into a committed,
// frozen behaviour baseline captured BEFORE the first data-source swap and re-run after each swap.
// Known to fix: it hard-codes an absolute require() path and a scratch base URL; parametrize before committing as a script.
//
// UI inventory: dumps every interactive element, panel text and behaviour outcome of the built static app.
// usage: node inventory.mjs <out.json> <baseUrl> <shotsDir|->
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Users/MJMC/Desktop/CCRUG/package.json')
const { chromium } = require('@playwright/test')

const [, , outFile, BASE = 'http://127.0.0.1:3777', shotsDir = '-'] = process.argv
const PANELS = ['Layers', 'Labels', 'Zones', 'Regions', 'Syzygies', 'Currents', 'Gates', 'Selection']
const TOGGLEABLE = PANELS.filter(p => p !== 'Selection')
const HEIGHT = { original: 940, labyrinth: 880, ladder: 870 }
const LAYOUTS = [
  { name: 'original', qs: '' },
  { name: 'labyrinth', qs: 'layout=labyrinth' },
  { name: 'ladder', qs: 'layout=ladder' },
  { name: 'planetary', qs: 'layout=planetary&date=2000-01-01' },
]
const mask = s => (typeof s === 'string' ? s.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE') : s)
const wait = ms => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- in-page collector
function collect(PANELS) {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim()
  const effCache = new Map()
  function eff(el) {
    if (!el || el.nodeType !== 1) return true
    if (effCache.has(el)) return effCache.get(el)
    let res = true
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) res = false
    else if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const r = el.getBoundingClientRect()
      if (r.height < 1 || r.width < 1) res = false
    }
    if (res && el.parentElement) res = eff(el.parentElement)
    effCache.set(el, res)
    return res
  }
  function visibleText(root) {
    if (!root) return null
    const parts = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      const t = norm(n.nodeValue)
      if (!t) continue
      const p = n.parentElement
      if (!p || p.closest('svg')) continue
      if (!eff(p)) continue
      parts.push(t)
    }
    return parts.join(' | ')
  }
  // ---- regions
  const fixedAncestor = h => { let e = h.parentElement; while (e) { if (e.style.position === 'fixed') return e; e = e.parentElement } return null }
  const regions = {}
  for (const h of document.querySelectorAll('header')) {
    const t = norm(h.textContent)
    const root = fixedAncestor(h)
    if (root && PANELS.includes(t)) regions[t] = root
  }
  const pageHeader = [...document.querySelectorAll('header')].find(h => !PANELS.includes(norm(h.textContent)))
  regions.header = pageHeader ? pageHeader.closest('div.fixed') : null
  regions.topbar = document.querySelector('div.fixed.top-0')
  regions.footer = document.querySelector('div[class*="bottom-2"]')
  regions.shortcutsTrigger = [...document.querySelectorAll('button')].find(b => norm(b.textContent) === 'shortcuts') || null
  regions.shortcutsModal = document.querySelector('div[class*="z-[84]"]')
  regions.splash = [...document.querySelectorAll('div[class*="z-[70]"]')].find(d => d.querySelector('h1')) || null
  regions.pinnedBackground = document.querySelector('div[class*="z-[1]"]')
  const regionOf = el => {
    for (const k of [...PANELS, 'header', 'topbar', 'footer', 'shortcutsTrigger', 'shortcutsModal', 'splash', 'pinnedBackground']) {
      const r = regions[k]
      if (r && (r === el || r.contains(el))) return k
    }
    return 'other'
  }
  // ---- interactive elements
  const SEL = 'button, a, input, select, textarea, [role=button], [tabindex], .cursor-pointer'
  let svgInteractive = 0
  const interactiveDetail = []
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('svg[viewBox^="0 0 800 "]')) { svgInteractive++; continue }
    const name = el.getAttribute('aria-label') || el.getAttribute('title') || norm(el.textContent) || (el.querySelector('svg') ? '[icon]' : '') || ''
    const flags = []
    if (el.disabled) flags.push('disabled')
    if (el.checked) flags.push('checked')
    if (el.getAttribute('aria-expanded') !== null) flags.push('expanded=' + el.getAttribute('aria-expanded'))
    if (el.getAttribute('aria-pressed') !== null) flags.push('pressed=' + el.getAttribute('aria-pressed'))
    interactiveDetail.push({
      region: regionOf(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      role: el.getAttribute('role') || '',
      tabindex: el.getAttribute('tabindex') || '',
      href: el.getAttribute('href') || '',
      name: name.slice(0, 120),
      title: el.getAttribute('title') || '',
      value: el.tagName === 'INPUT' ? el.value : '',
      flags: flags.join(','),
      visible: eff(el) && el.getClientRects().length > 0,
    })
  }
  const interactive = interactiveDetail.map(d =>
    [d.region, d.tag + (d.type ? `[${d.type}]` : '') + (d.role ? `{${d.role}}` : ''), JSON.stringify(d.name), d.href && 'href=' + d.href, d.title && 'title=' + JSON.stringify(d.title),
      d.value && 'value=' + d.value, d.flags, d.visible ? 'visible' : 'HIDDEN'].filter(Boolean).join(' | '))
  // ---- texts per region
  const texts = {}
  for (const k of Object.keys(regions)) texts[k] = regions[k] ? visibleText(regions[k]) : null
  texts.popovers = [...document.querySelectorAll('div[class*="z-[95]"]')].map(visibleText).join(' || ')
  // page text outside the projection svg and outside the named regions
  const named = Object.values(regions).filter(Boolean)
  {
    const parts = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      const t = norm(n.nodeValue)
      const p = n.parentElement
      if (!t || !p || p.closest('svg') || p.closest('script, style, noscript')) continue
      if (named.some(r => r.contains(p))) continue
      if (!eff(p)) continue
      parts.push(t)
    }
    texts.otherPageText = parts.join(' | ')
  }
  // ---- geometry and open state
  const geometry = {}
  for (const k of Object.keys(regions)) {
    const r = regions[k]
    if (!r) continue
    const b = r.getBoundingClientRect()
    geometry[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), z: getComputedStyle(r).zIndex }
  }
  const open = {}
  for (const k of PANELS) {
    const r = regions[k]
    if (!r) continue
    // the collapsible body wrapper is the element carrying maxHeight in its inline style
    const body = r.querySelector('div[style*="max-height"]')
    open[k] = body ? parseFloat(getComputedStyle(body).maxHeight) > 0 : true
  }
  // ---- overlays / motion
  const overlays = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue
    const cs = getComputedStyle(el)
    if (cs.position !== 'fixed') continue
    const b = el.getBoundingClientRect()
    if (b.width >= innerWidth - 2 && b.height >= innerHeight - 2) {
      overlays.push({ cls: (el.className || '').toString().slice(0, 80), z: cs.zIndex, pe: cs.pointerEvents, opacity: cs.opacity, text: norm(el.textContent).slice(0, 40) })
    }
  }
  const pseudo = {}
  for (const p of ['::before', '::after']) {
    const cs = getComputedStyle(document.body, p)
    pseudo['body' + p] = { content: cs.content, z: cs.zIndex, animation: cs.animationName }
  }
  const animations = document.getAnimations().map(a => a.animationName || a.transitionProperty || a.constructor.name)
  const svg = document.querySelector('svg[viewBox^="0 0 800 "]')
  // shadows / glows in the shell (outside the svg): count of elements with box-shadow, text-shadow or a filter
  let shadowEls = 0, textShadowEls = 0, filterEls = 0, clipPathEls = 0, gradientEls = 0
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue
    const cs = getComputedStyle(el)
    if (cs.boxShadow && cs.boxShadow !== 'none') shadowEls++
    if (cs.textShadow && cs.textShadow !== 'none') textShadowEls++
    if (cs.filter && cs.filter !== 'none') filterEls++
    if (cs.clipPath && cs.clipPath !== 'none') clipPathEls++
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) gradientEls++
  }
  const overflowX = document.documentElement.scrollWidth - innerWidth
  const offscreen = Object.entries(geometry).filter(([k, g]) => g.x < -1 || g.x + g.w > innerWidth + 1).map(([k]) => k)
  return {
    url: location.pathname + location.search,
    viewport: { w: innerWidth, h: innerHeight },
    svg: svg ? { viewBox: svg.getAttribute('viewBox'), interactive: svgInteractive } : null,
    interactive, interactiveDetail, texts, geometry, open,
    overlays, pseudo, animations,
    shellStyleCounts: { shadowEls, textShadowEls, filterEls, clipPathEls, gradientEls },
    overflowX, offscreen,
  }
}

// ---------------------------------------------------------------- driver
const browser = await chromium.launch()
const result = { meta: { base: BASE, when: new Date().toISOString() }, layouts: {}, mobile: {} }

async function settle(page, layoutName) {
  await page.waitForSelector('svg[viewBox^="0 0 800 "]')
  if (HEIGHT[layoutName]) await page.waitForSelector(`svg[viewBox="0 0 800 ${HEIGHT[layoutName]}"]`)
  await page.waitForFunction(() => {
    const el = document.querySelector('svg[viewBox^="0 0 800 "]')
    return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
  })
  await wait(4600) // the intro splash (2.2 s + 1.2 s) has finished
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {})
}
const snap = async page => {
  await wait(350)
  const s = await page.evaluate(collect, PANELS)
  s.url = mask(s.url)
  for (const k of Object.keys(s.texts)) s.texts[k] = mask(s.texts[k])
  s.interactive = s.interactive.map(mask)
  s.interactiveDetail = s.interactiveDetail.map(d => ({ ...d, value: mask(d.value) }))
  return s
}
const panel = (page, name) =>
  page.locator('header').filter({ hasText: new RegExp(`^${name}$`) }).first().locator('xpath=ancestor::div[contains(translate(@style," ",""),"position:fixed")][1]')
const stripGeo = s => JSON.stringify({ i: s.interactive, t: s.texts, o: s.open })

for (const L of LAYOUTS) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin }).catch(() => {})
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`${BASE}/numogram/?${L.qs}`)
  await settle(page, L.name)
  const out = { stages: {}, behaviours: [] }
  result.layouts[L.name] = out
  const B = (name, value) => { out.behaviours.push({ name, value }); console.log(L.name, '|', name, '=>', JSON.stringify(value)) }

  out.stages.initial = await snap(page)
  if (shotsDir !== '-' && L.name === 'original') await page.screenshot({ path: path.join(shotsDir, `desktop-1440x900.png`) })

  // hover readouts on the layout buttons
  const layoutButtons = page.locator('div.fixed.top-0 button').filter({ hasText: /^[ASDF]$/ })
  const nBtn = await layoutButtons.count()
  const hoverLabels = []
  for (let i = 0; i < nBtn; i++) {
    await layoutButtons.nth(i).hover()
    await wait(120)
    hoverLabels.push(await page.evaluate(() => (document.querySelector('div.fixed.top-0 .h-4')?.textContent || '').trim()))
  }
  await page.mouse.move(700, 500)
  B('layout-button hover labels', hoverLabels)

  // hover popover readouts
  const layerRow = panel(page, 'Layers').locator('div.cursor-pointer').first()
  await layerRow.hover(); await wait(150)
  B('hover Layers first row: popover text', await page.evaluate(() => [...document.querySelectorAll('div[class*="z-[95]"]')].map(d => d.textContent.trim()).join('||')))
  await page.mouse.move(700, 500); await wait(100)
  const zonePanel = panel(page, 'Zones')
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^1/ }).locator('span').nth(2).hover().catch(() => {})
  await wait(150)
  B('hover Zones row 1 xenotation: popover text', await page.evaluate(() => [...document.querySelectorAll('div[class*="z-[95]"]')].map(d => d.textContent.trim()).join('||')))
  await page.mouse.move(700, 500); await wait(100)
  // hover a zone row (drives the highlight state)
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^5/ }).hover(); await wait(150)
  B('hover Zones row 5: svg still present', !!(await page.$('svg[viewBox^="0 0 800 "]')))
  await page.mouse.move(700, 500); await wait(100)

  // panel open/close toggles
  const initialKey = stripGeo(out.stages.initial)
  for (const name of TOGGLEABLE) {
    const btn = panel(page, name).locator('header button').first()
    if ((await btn.count()) === 0) { B(`panel ${name}: has NO open/close toggle in the rendered DOM`, true); continue }
    await btn.click(); await wait(350)
    out.stages[`collapsed:${name}`] = await snap(page)
    await btn.click(); await wait(350)
    const back = await snap(page)
    B(`toggle ${name}: collapse then expand restores the initial dump`, stripGeo(back) === initialKey)
  }

  // panel drag
  {
    const root = panel(page, 'Layers')
    const before = await root.evaluate(e => ({ l: e.style.left, t: e.style.top, z: e.style.zIndex }))
    const box = await root.locator('header span').first().boundingBox()
    await page.mouse.move(box.x + 4, box.y + 4)
    await page.mouse.down()
    await page.mouse.move(box.x + 64, box.y + 44, { steps: 6 })
    await page.mouse.up()
    await wait(200)
    const after = await root.evaluate(e => ({ l: e.style.left, t: e.style.top, z: e.style.zIndex }))
    B('drag Layers header by (+60,+40): left/top delta', [parseFloat(after.l) - parseFloat(before.l), parseFloat(after.t) - parseFloat(before.t)])
    B('drag Layers header raises z-index', Number(after.z) > Number(before.z))
    // put it back so later stages compare like with like
    const box2 = await root.locator('header span').first().boundingBox()
    await page.mouse.move(box2.x + 4, box2.y + 4); await page.mouse.down(); await page.mouse.move(box2.x - 56, box2.y - 36, { steps: 6 }); await page.mouse.up()
    await wait(200)
  }

  // select zone 5, toggle one layer, undo/redo, clear
  const undoBtn = page.locator('button[aria-label="Undo"]')
  const redoBtn = page.locator('button[aria-label="Redo"]')
  B('undo/redo disabled at start', [await undoBtn.isDisabled(), await redoBtn.isDisabled()])
  // probe: a real mouse click on the row CENTRE (over a child span). Recorded as observed; see the SUMMARY (pre-existing remount-on-mousedown bug).
  {
    const heading0 = async () => mask(await page.locator('header').filter({ hasText: /^Selection$/ }).first().locator('xpath=ancestor::div[contains(translate(@style," ",""),"position:fixed")][1]').locator('span').filter({ hasText: /Selected Elements/ }).first().textContent())
    await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^5/ }).click(); await wait(500)
    B('real mouse click on Zones row 5 centre (child span): selection heading', await heading0())
  }
  await zonePanel.locator('div.cursor-pointer').filter({ hasText: /^5/ }).click({ position: { x: 1, y: 1 } }); await wait(500)
  out.stages['zone5-selected'] = await snap(page)
  B('after selecting zone 5: url', mask(await page.evaluate(() => location.search)))
  B('after selecting zone 5: undo enabled', !(await undoBtn.isDisabled()))
  await panel(page, 'Layers').locator('div.cursor-pointer').filter({ hasText: /^Syzygies/ }).click({ position: { x: 1, y: 1 } }); await wait(500)
  out.stages['zone5+syzygies-layer-toggled'] = await snap(page)
  B('after toggling Syzygies layer: url', mask(await page.evaluate(() => location.search)))
  await undoBtn.click(); await wait(500)
  out.stages['after-undo'] = await snap(page)
  B('undo: url', mask(await page.evaluate(() => location.search)))
  await redoBtn.click(); await wait(500)
  out.stages['after-redo'] = await snap(page)
  B('redo: url', mask(await page.evaluate(() => location.search)))
  // selection panel controls
  const sel = panel(page, 'Selection')
  const expandBtns = sel.locator('button[aria-label="Expand item"], button[aria-label="Collapse item"]')
  B('Selection panel expand/collapse buttons', await expandBtns.count())
  if (await expandBtns.count() > 1) { await expandBtns.nth(1).click().catch(() => {}); await wait(350) }
  out.stages['selection-item-expanded'] = await snap(page)
  const removeBtn = sel.locator('button[aria-label^="Remove"]')
  B('Selection panel remove buttons', await removeBtn.count())
  await sel.locator('button', { hasText: /^clear$/ }).click(); await wait(500)
  out.stages['selection-cleared'] = await snap(page)
  B('clear: url', mask(await page.evaluate(() => location.search)))

  // regions and time circuit
  await panel(page, 'Regions').locator('div.cursor-pointer').filter({ hasText: /^Torque/ }).click({ position: { x: 1, y: 1 } }); await wait(400)
  B('Regions: Torque url', mask(await page.evaluate(() => location.search)))
  await panel(page, 'Regions').locator('div.cursor-pointer').filter({ hasText: /^Time Circuit/ }).click({ position: { x: 1, y: 1 } }); await wait(400)
  B('Regions: Time Circuit url', mask(await page.evaluate(() => location.search)))
  await panel(page, 'Regions').locator('div.cursor-pointer').filter({ hasText: /^Time Circuit/ }).click({ position: { x: 1, y: 1 } }); await wait(400)
  // labels + particles
  await panel(page, 'Labels').locator('div.cursor-pointer').filter({ hasText: /^Tic Xenotation/ }).click({ position: { x: 1, y: 1 } }); await wait(400)
  out.stages['labels-xenotation-on'] = await snap(page)
  await panel(page, 'Layers').locator('div.cursor-pointer').filter({ hasText: /^Particles/ }).click({ position: { x: 1, y: 1 } }); await wait(400)
  B('Particles on: url', mask(await page.evaluate(() => location.search)))
  // gates + currents + syzygies list clicks
  await panel(page, 'Gates').locator('button', { hasText: /all|none|\/10/ }).first().click(); await wait(400)
  B('Gates panel count-toggle click: selection heading', mask(await sel.locator('span').filter({ hasText: /Selected Elements/ }).first().textContent()))
  await panel(page, 'Currents').locator('div.cursor-pointer').first().click({ position: { x: 1, y: 1 } }); await wait(300)
  await panel(page, 'Syzygies').locator('div.cursor-pointer').first().click({ position: { x: 1, y: 1 } }); await wait(300)
  B('after Gates toggle-all + Currents/Syzygies row clicks: selection heading', mask(await sel.locator('span').filter({ hasText: /Selected Elements/ }).first().textContent()))
  out.stages['many-selected'] = await snap(page)

  // keyboard shortcuts
  await page.mouse.move(700, 500)
  const vb = () => page.evaluate(() => document.querySelector('svg[viewBox^="0 0 800 "]')?.getAttribute('viewBox'))
  const heading = async () => mask(await sel.locator('span').filter({ hasText: /Selected Elements/ }).first().textContent())
  await page.keyboard.press('Escape'); await wait(300)
  B('key Escape clears selection: heading', await heading())
  if (L.name !== 'planetary') {
    for (const [key, lay] of [['s', 'labyrinth'], ['d', 'ladder'], ['a', 'original']]) {
      await page.keyboard.press(key); await wait(1500)
      B(`key ${key.toUpperCase()} -> ${lay}: viewBox`, await vb())
    }
    await page.keyboard.press('f'); await wait(1800)
    B('key F -> planetary: url + viewBox', [mask(await page.evaluate(() => location.search)), await vb()])
    out.stages['planetary-via-key'] = await snap(page)
    await page.keyboard.press('a'); await wait(1800)
    B('key A back -> original: viewBox', await vb())
  } else {
    for (const key of ['v', 'c', 'x']) {
      await page.keyboard.press(key); await wait(600)
      out.stages[`planetary-key-${key}`] = await snap(page)
      B(`planetary key ${key}: url`, mask(await page.evaluate(() => location.search)))
    }
    await page.keyboard.press('z'); await wait(600)
    out.stages['planetary-key-z'] = await snap(page)
    await page.keyboard.press('z'); await wait(300)
  }
  await page.keyboard.press('5'); await wait(400)
  B('key 5 toggles gate 5: url', mask(await page.evaluate(() => location.search)))
  await page.keyboard.press('Escape'); await wait(300)
  B('key digit then Escape: heading', await heading())
  await page.keyboard.press('Control+z'); await wait(400)
  B('Ctrl+Z after Escape: heading', await heading())
  await page.keyboard.press('Control+y'); await wait(400)
  B('Ctrl+Y: heading', await heading())
  await page.keyboard.press('Shift+Slash'); await wait(400)
  B('key Shift+/ opens shortcuts modal', await page.locator('div[class*="z-[84]"]').count())
  out.stages['shortcuts-modal-open'] = await snap(page)
  await page.keyboard.press('Escape'); await wait(300)
  B('Escape closes modal', await page.locator('div[class*="z-[84]"]').count())
  await page.locator('button', { hasText: /^shortcuts$/ }).click(); await wait(300)
  B('shortcuts trigger opens modal', await page.locator('div[class*="z-[84]"]').count())
  await page.locator('div[class*="z-[84]"] button', { hasText: /^close$/ }).click(); await wait(300)
  B('modal close button closes', await page.locator('div[class*="z-[84]"]').count())
  await page.locator('button', { hasText: /^shortcuts$/ }).click(); await wait(300)
  await page.locator('button[aria-label="Close shortcuts"]').click({ position: { x: 5, y: 5 } }); await wait(300)
  B('modal backdrop click closes', await page.locator('div[class*="z-[84]"]').count())

  // header: share + title link
  if (L.name === 'original') {
    await page.keyboard.press('5'); await wait(300)
    await page.locator('button[aria-label="Share current state"]').click(); await wait(400)
    B('share button: clipboard text', mask(await page.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message))))
    B('header title link href', await page.locator('header a').first().getAttribute('href'))
    await Promise.all([page.waitForURL(u => !u.search.includes('selected'), { timeout: 8000 }).catch(() => {}), page.locator('header a').first().click()])
    await wait(800)
    B('header title link click: pathname+search', mask(await page.evaluate(() => location.pathname + location.search)))
  }
  out.stages.final = await snap(page)
  B('page errors', errors)
  await context.close()
}

// ---------------------------------------------------------------- mobile 390x800
{
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC' })
  const page = await context.newPage()
  await page.goto(`${BASE}/numogram/`)
  await settle(page, 'original')
  result.mobile.initial = await snap(page)
  if (shotsDir !== '-') await page.screenshot({ path: path.join(shotsDir, 'narrow-390x800.png') })
  const hasToggle = (await panel(page, 'Layers').locator('header button').count()) > 0
  result.mobile.hasPanelToggle = hasToggle
  if (hasToggle) for (const name of ['Layers', 'Zones']) {
    await panel(page, name).locator('header button').first().click()
    await wait(500)
    result.mobile[`open:${name}`] = await snap(page)
    if (shotsDir !== '-') await page.screenshot({ path: path.join(shotsDir, `narrow-390x800-open-${name}.png`) })
    await panel(page, name).locator('header button').first().click()
    await wait(400)
  }
  await context.close()
}
await browser.close()
fs.writeFileSync(outFile, JSON.stringify(result, null, 1))
console.log('wrote', outFile)
