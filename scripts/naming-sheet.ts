// CLI wrapper for scripts/naming-sheet/build.ts (plan 07-06, orchestrator decision 1): writes the gitignored dev-only naming
// style contact sheet to .review/naming-sheet.html for the user's sign-off on the look of the harsh, soft and syllabic banks.
// Overwriting is expected (the sheet is a dev artifact regenerated on every review round, like the layout review sheet).
//
// CommonJS-safe (tsx runs .ts scripts as CommonJS because the root package.json has no "type" field): no top-level await,
// no import.meta.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildNamingSheet } from './naming-sheet/build'

if (!existsSync(resolve('engine/index.ts'))) {
  console.error('naming-sheet: run from the repository root')
  process.exit(2)
}

const OUT_DIR = resolve('.review')
const OUT_FILE = resolve(OUT_DIR, 'naming-sheet.html')

mkdirSync(OUT_DIR, { recursive: true })
const html = buildNamingSheet()
writeFileSync(OUT_FILE, html, 'utf8')
const bytes = Buffer.byteLength(html, 'utf8')
const sha = createHash('sha256').update(html, 'utf8').digest('hex')
console.log(`naming-sheet: wrote ${bytes} bytes, sha256 ${sha.slice(0, 12)} to ${OUT_FILE}`)
