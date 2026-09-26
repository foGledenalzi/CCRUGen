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
  const srcs = await page.locator('img[src$="numogram-logo.svg"]').evaluateAll(els => els.map(e => e.getAttribute('src')))
  expect(srcs.length).toBeGreaterThan(0)
  for (const s of srcs) expect(s).toBe(`${BASE}/numogram-logo.svg`)
})
