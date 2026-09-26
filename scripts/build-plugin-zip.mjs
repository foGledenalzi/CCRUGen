#!/usr/bin/env node

// Optional (not part of `npm run build`): compiles the gematria plugin and packages it into
// artifacts/ccru-gematria-plugin.zip with fflate. Deterministic: sorted entries and a fixed LOCAL-time
// mtime give identical bytes in every timezone (verified UTC / America/New_York / Asia/Tokyo).
// No `zip` binary, and nothing is written into app/ or public/ (a ZIP in public/ would ship inside out/).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

// Lets the determinism check vary the zone on Windows (a process-start TZ=Zone/Name is ignored there).
// Must run before FIXED_MTIME is created.
if (process.env.CCRUG_TZ) process.env.TZ = process.env.CCRUG_TZ

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_DIR = resolve(ROOT, 'gematria/plugin')
const OUT_DIR = resolve(ROOT, 'artifacts')
const ZIP_NAME = 'ccru-gematria-plugin.zip'

// Local-time components on purpose: the DOS time stored in the ZIP is then the same in every timezone.
// (Date.UTC(...) would encode a different local time per TZ.)
const FIXED_MTIME = new Date(2000, 0, 1, 0, 0, 0)

// 1. Compile TypeScript with the repo's own compiler (no npx, no shell)
console.log('[plugin-zip] Compiling TypeScript...')
execFileSync(process.execPath, [resolve(ROOT, 'node_modules/typescript/bin/tsc'), '--project', 'gematria/plugin/tsconfig.json'], {
  cwd: ROOT,
  stdio: 'inherit',
})

// 2. Package the runtime files only, in sorted order, with a fixed mtime
console.log('[plugin-zip] Creating zip...')
const includes = [
  'manifest.json',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'dist/src/background.js',
  'dist/src/ciphers.js',
  'dist/src/gematria.js',
  'dist/src/cyber-ui.js',
  'dist/src/content.js',
  'dist/popup/popup.js',
  'popup/popup.html',
  'popup/popup.css',
  'src/cyber-ui.css',
]

const entries = {}
for (const rel of [...includes].sort()) {
  entries[rel] = [new Uint8Array(readFileSync(resolve(PLUGIN_DIR, rel))), { level: 9, mtime: FIXED_MTIME }]
}
const zip = zipSync(entries)

// 3. Write to the gitignored artifacts/ directory and print the digest
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(resolve(OUT_DIR, ZIP_NAME), zip)
console.log(`[plugin-zip] sha256 ${createHash('sha256').update(zip).digest('hex')}`)
console.log(`[plugin-zip] wrote artifacts/${ZIP_NAME}`)
