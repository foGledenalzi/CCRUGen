#!/usr/bin/env node
// Reports the numogram worker chunks in a static export (they are not referenced by HTML, so page-weight.mjs cannot see them) and fails if one carries base-10 lore. Usage: node scripts/worker-chunks.mjs [outDir]. Original CCRUG code (MIT, NOTICE section 1).
//
// A worker chunk is a .js file under <out>/_next/static/chunks/ whose file name appears in no HTML of the export and whose text
// carries the worker's own marks: webpack's importScripts loader or the protocol tag of the numogram worker. The worker must stay
// lore-free (research P11): base-10 demon names in it would mean the preset data leaked into the worker bundle.
// Node built-ins only.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain } from './is-main.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_MARKS = ['importScripts', 'ccrug-numogram-worker/1']
const LORE_NAMES = ['Lurgo', 'Djynxx'] // base-10 demon names, never part of the generic worker

/** @param {string} dir @returns {Generator<string>} every file below dir */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/**
 * @param {string} outDir the exported site
 * @returns {{ rel: string, raw: number, gzip: number, lore: string[] }[]} the worker chunks, sorted by path
 */
export function findWorkerChunks(outDir) {
  const chunksDir = path.join(outDir, '_next', 'static', 'chunks')
  if (!existsSync(chunksDir)) return []
  let html = ''
  for (const file of walk(outDir)) if (file.endsWith('.html')) html += readFileSync(file, 'utf8') + '\n'
  const found = []
  for (const file of walk(chunksDir)) {
    if (!file.endsWith('.js') || html.includes(path.basename(file))) continue
    const bytes = readFileSync(file)
    const text = bytes.toString('utf8')
    if (!WORKER_MARKS.some((mark) => text.includes(mark))) continue
    found.push({
      rel: path.relative(outDir, file).split(path.sep).join('/'),
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
      lore: LORE_NAMES.filter((name) => text.includes(name)),
    })
  }
  return found.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
}

/** @param {string[]} argv @returns {number} the exit code */
export function run(argv) {
  const outDir = path.resolve(ROOT, argv[0] ?? 'out')
  const chunks = findWorkerChunks(outDir)
  if (chunks.length === 0) {
    console.error(`worker-chunks: FAIL no worker chunk found under ${path.relative(ROOT, outDir) || '.'} (was the site built, and does the viewer import the worker hook?)`)
    return 1
  }
  for (const c of chunks) console.log(`worker-chunk ${c.rel} raw=${c.raw} gzip=${c.gzip}`)
  console.log(`worker-chunks total: ${chunks.length} chunk(s) raw=${chunks.reduce((s, c) => s + c.raw, 0)} gzip=${chunks.reduce((s, c) => s + c.gzip, 0)}`)
  const leaks = chunks.filter((c) => c.lore.length > 0)
  for (const c of leaks) console.error(`worker-chunks: FAIL ${c.rel} carries base-10 lore (${c.lore.join(', ')})`)
  return leaks.length > 0 ? 1 : 0
}

if (isMain(import.meta.url)) process.exitCode = run(process.argv.slice(2))
