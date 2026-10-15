import { test, expect } from '@playwright/test'

// FND-03 / ROADMAP SC2: static export, no server route, no foreign or Vercel requests, legacy links land on the numogram.
const BASE = process.env.E2E_BASE_PATH ?? ''
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

test('legacy /?... link lands on /numogram/ with the query preserved', async ({ page }) => {
  await page.goto(`${BASE}/?layout=ladder&selected=5`)
  await page.waitForURL(new RegExp(`${esc(BASE)}/numogram/\\?layout=ladder&selected=5$`))
  await expect(page.locator('svg[viewBox="0 0 800 870"]')).toBeVisible()
})

test('/numogram/?... share link renders the requested layout', async ({ page }) => {
  await page.goto(`${BASE}/numogram/?layout=labyrinth`)
  await expect(page.locator('svg[viewBox="0 0 800 880"]')).toBeVisible()
})

test('no foreign, Vercel or API requests and no failed requests', async ({ page }) => {
  const seen: string[] = []
  const failed: string[] = []
  page.on('request', r => seen.push(r.url()))
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) failed.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`failed ${r.url()}`) })
  await page.goto(`${BASE}/?layout=ladder&selected=5`)
  await page.waitForURL(/\/numogram\/\?/)
  await page.goto(`${BASE}/numogram/?layout=labyrinth`)
  await expect(page.locator('svg[viewBox="0 0 800 880"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
  const origin = new URL(page.url()).origin
  expect(seen.filter(u => !u.startsWith(origin) && !u.startsWith('data:'))).toEqual([])
  expect(seen.filter(u => /vercel|\/api\/|blob/i.test(u))).toEqual([])
  expect(failed).toEqual([])
})

test('the logo URL goes through the basePath helper', async ({ page }) => {
  await page.goto(`${BASE}/numogram/`)
  const srcs = await page.locator('img[src$="ccrug-mark.svg"]').evaluateAll(els => els.map(e => e.getAttribute('src')))
  expect(srcs.length).toBeGreaterThan(0)
  for (const s of srcs) expect(s).toBe(`${BASE}/ccrug-mark.svg`)
})

// WR-01: with a base path, the header title link must stay on the numogram (never /ccrug/ccrug/numogram/).
test('the header title link keeps a single base path and drops the query', async ({ page }) => {
  const visited: string[] = []
  page.on('framenavigated', f => { if (f === page.mainFrame()) visited.push(f.url()) })
  await page.goto(`${BASE}/numogram/?selected=5`)
  const link = page.locator('header a[href$="/numogram/"]')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', `${BASE}/numogram/`)
  await page.waitForFunction(() => {                                   // React has hydrated the link (so the click is handled client-side)
    const a = document.querySelector('header a[href$="/numogram/"]')
    return !!a && Object.keys(a).some(k => k.startsWith('__reactProps$'))
  })
  await link.click()
  await page.waitForURL(u => u.pathname === `${BASE}/numogram/` && u.search === '')
  expect(new URL(page.url()).pathname).toBe(`${BASE}/numogram/`)
  if (BASE) for (const u of visited) expect(u).not.toContain(`${BASE}${BASE}`)
  await expect(page.locator('svg[viewBox^="0 0 800 "]')).toBeVisible()  // the numogram, not a 404 page
})

// REN-03 / ROADMAP criterion 5 (research A1): static files only; the one long-lived worker keeps answering offline (a first-ever
// offline new Worker() cannot fetch its chunk by platform design). Runs at the root and, through `npm run test:e2e:basepath`
// (which executes only this file), under /ccrug. Base 28 takes the worker path through the diagnostic ?tier=canvas override, so
// production behaviour at 28 stays synchronous (Phase 6 D-06).
test('the numogram worker loads from the site chunk path and keeps answering offline', async ({ page, context }) => {
  const urls: string[] = []
  page.on('worker', w => urls.push(w.url()))
  // Test-only: record every reply the worker really sends, so a main-thread fallback could never pass for the worker.
  await page.addInitScript(() => {
    const replies: number[] = []
    ;(window as unknown as { __workerReplies: number[] }).__workerReplies = replies
    const post = Worker.prototype.postMessage as unknown as (this: Worker, ...args: unknown[]) => void
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      const id = (args[0] as { id?: number }).id
      this.addEventListener('message', ev => {
        const d = ev.data as { id?: number; type?: string; base?: number }
        if (d.id === id && d.type === 'built' && d.base !== undefined) replies.push(d.base)
      })
      post.apply(this, args)
    } as unknown as typeof Worker.prototype.postMessage
  })
  await page.goto(`${BASE}/numogram/?base=64&tier=canvas`)
  await expect(page.locator('[data-render-tier="canvas"][data-canvas-state="ready"][data-base="64"]')).toBeVisible()
  expect(urls).toHaveLength(1)
  const origin = new URL(page.url()).origin
  expect(urls[0]).toMatch(new RegExp(`^${esc(origin)}${esc(BASE)}/_next/static/chunks/[^/]+\\.js$`))
  await context.setOffline(true)
  await page.locator('input[aria-label="Base"]').fill('28')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-render-tier="canvas"][data-canvas-state="ready"][data-base="28"]')).toBeVisible() // base 28 computed through the existing worker while offline
  expect(urls).toHaveLength(1)
  expect(await page.evaluate(() => (window as unknown as { __workerReplies: number[] }).__workerReplies)).toEqual([64, 28])
  await context.setOffline(false)
})
