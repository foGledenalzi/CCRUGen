// CLI wrapper for scripts/review-sheet/build.ts (D-10): writes the gitignored dev-only contact sheet to
// .review/layout-review.html and, with --shots, a per-base screenshot set via Playwright Chromium for Claude's own
// pre-check ahead of the human sign-off (plan 03-08 Task 2). Overwriting is expected here (unlike the frozen-oracle
// capture scripts): the sheet is a dev artifact, regenerated on every review round.
//
// CommonJS-safe (tsx runs .ts scripts as CommonJS because the root package.json has no "type" field): no top-level
// await, no import.meta; the optional Playwright work is wrapped in async function main().
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildReviewSheet } from './review-sheet/build'

if (!existsSync(resolve('engine/index.ts'))) {
  console.error('review-sheet: run from the repository root')
  process.exit(2)
}

const OUT_DIR = resolve('.review')
const OUT_FILE = resolve(OUT_DIR, 'layout-review.html')

mkdirSync(OUT_DIR, { recursive: true })
const html = buildReviewSheet()
writeFileSync(OUT_FILE, html, 'utf8')
const bytes = Buffer.byteLength(html, 'utf8')
const sha = createHash('sha256').update(html, 'utf8').digest('hex')
console.log(`review-sheet: wrote ${bytes} bytes, sha256 ${sha.slice(0, 12)} to ${OUT_FILE}`)

async function main(): Promise<void> {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
    await page.goto(pathToFileURL(OUT_FILE).href)
    const shotsDir = resolve(OUT_DIR, 'shots')
    mkdirSync(shotsDir, { recursive: true })
    const sections = page.locator('section')
    const count = await sections.count()
    for (let i = 0; i < count; i++) {
      const section = sections.nth(i)
      const id = await section.getAttribute('id')
      if (id === null) continue
      await section.screenshot({ path: resolve(shotsDir, `${id}.png`) })
    }
    console.log(`review-sheet: wrote ${count} screenshots to ${shotsDir}`)
  } finally {
    await browser.close()
  }
}

if (process.argv.includes('--shots')) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
