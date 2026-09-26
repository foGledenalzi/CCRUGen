#!/usr/bin/env node
// Page-weight baseline and budget (FND-02 / D-17). Zero dependencies; Windows/Linux safe.
//   node scripts/page-weight.mjs check                     exit 1 if any metric exceeds baseline + tolerance
//   node scripts/page-weight.mjs update --reason "<why>"   write perf/page-weight.baseline.json (refuses without a reason)
//   node scripts/page-weight.mjs print                     print the current measurement
//
// Bytes come from the static export in out/ (HTML plus every JS/CSS file the HTML references, raw and gzip).
// DOM node counts come from the frozen normalized goldens (element lines), so no browser runs at check time.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const OUT_DIR = path.join(ROOT, 'out')
export const GOLDEN_DIR = path.join(ROOT, 'e2e', '__golden__', 'golden.spec.ts')
export const BASELINE_PATH = path.join(ROOT, 'perf', 'page-weight.baseline.json')
export const DEFAULT_TOLERANCE = { bytesPct: 5, bytesMin: 1024, nodesPct: 2, nodesMin: 2 }
export const BYTE_METRICS = ['htmlBytes', 'htmlGzip', 'jsBytes', 'jsGzip', 'cssBytes', 'cssGzip']

const gz = b => gzipSync(b, { level: 9 }).length

function* walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const sortKeys = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/** Same definition as e2e/visual-dom.ts: one element per line, text lines start with #text. */
export function countElements(text) {
  return (text.match(/^ *</gm) || []).length
}

/**
 * Per-route byte sizes of the static export: for every index.html outside the 404 pages, the HTML itself plus
 * every /_next/static/*.js|css file it references (script tags AND the RSC flight payload), deduplicated.
 */
export function measureRoutes(outDir = OUT_DIR) {
  const routes = {}
  for (const f of walk(outDir)) {
    const rel = path.relative(outDir, f).split(path.sep).join('/')
    if (path.basename(f) !== 'index.html' || rel.startsWith('404')) continue
    const html = readFileSync(f)
    const text = html.toString('utf8')
    const assets = new Set()
    for (const m of text.matchAll(/\/_next\/static\/[A-Za-z0-9_\-./]+?\.(?:js|css)/g)) assets.add(m[0])
    const r = { htmlBytes: html.length, htmlGzip: gz(html), jsBytes: 0, jsGzip: 0, cssBytes: 0, cssGzip: 0 }
    for (const a of assets) {
      const file = path.join(outDir, a)
      if (!existsSync(file)) continue
      const b = readFileSync(file)
      if (a.endsWith('.js')) {
        r.jsBytes += b.length
        r.jsGzip += gz(b)
      } else {
        r.cssBytes += b.length
        r.cssGzip += gz(b)
      }
    }
    routes['/' + rel.replace(/index\.html$/, '')] = r
  }
  return sortKeys(routes)
}

/** DOM element count of every golden state: { '<layout>--<state>': count }. */
export function measureDomNodes(goldenDir = GOLDEN_DIR) {
  const nodes = {}
  for (const name of readdirSync(goldenDir)) {
    if (!name.endsWith('.txt')) continue
    nodes[name.slice(0, -'.txt'.length)] = countElements(readFileSync(path.join(goldenDir, name), 'utf8'))
  }
  return sortKeys(nodes)
}

export function measure(outDir = OUT_DIR, goldenDir = GOLDEN_DIR) {
  return { routes: measureRoutes(outDir), domNodes: measureDomNodes(goldenDir) }
}

/** Largest allowed value: base plus the larger of the absolute minimum and the (rounded-up) percentage. */
export function limitFor(base, pct, min) {
  return base + Math.max(min, Math.ceil((base * pct) / 100))
}

/** Returns one message per violation; an empty array means the measurement is within budget. */
export function compare(baseline, current, tolerance = baseline.tolerance ?? DEFAULT_TOLERANCE) {
  const tol = { ...DEFAULT_TOLERANCE, ...tolerance }
  const problems = []

  for (const [route, base] of Object.entries(baseline.routes ?? {})) {
    const cur = current.routes?.[route]
    if (!cur) {
      problems.push(`route ${route} is in the baseline but missing from out/`)
      continue
    }
    for (const metric of BYTE_METRICS) {
      if (typeof base[metric] !== 'number') {
        problems.push(`${route} ${metric} is missing from the baseline (update with --reason)`)
        continue
      }
      const limit = limitFor(base[metric], tol.bytesPct, tol.bytesMin)
      if (cur[metric] > limit) problems.push(`${route} ${metric} ${cur[metric]} > limit ${limit} (baseline ${base[metric]})`)
    }
  }
  for (const route of Object.keys(current.routes ?? {})) {
    if (!baseline.routes?.[route]) problems.push(`route ${route} has no baseline (update with --reason)`)
  }

  for (const [state, base] of Object.entries(baseline.domNodes ?? {})) {
    const cur = current.domNodes?.[state]
    if (typeof cur !== 'number') {
      problems.push(`golden state ${state} is in the baseline but missing from the goldens`)
      continue
    }
    const limit = limitFor(base, tol.nodesPct, tol.nodesMin)
    if (cur > limit) problems.push(`golden state ${state} ${cur} > limit ${limit} (baseline ${base})`)
  }
  for (const state of Object.keys(current.domNodes ?? {})) {
    if (!(state in (baseline.domNodes ?? {}))) problems.push(`golden state ${state} has no baseline (update with --reason)`)
  }

  return problems
}

/** Compact before/after summary kept in the history ledger. */
function summarize(m) {
  const routes = {}
  for (const [route, r] of Object.entries(m.routes)) routes[route] = { htmlGzip: r.htmlGzip, jsGzip: r.jsGzip, cssGzip: r.cssGzip }
  return { routes, domNodesTotal: Object.values(m.domNodes).reduce((a, b) => a + b, 0) }
}

/** The new baseline document; refuses (throws) without a written reason, and appends to the history ledger. */
export function nextBaseline(previous, current, reason, date) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('page-weight: update requires --reason "<why the budget changes>"')
  }
  return {
    version: 1,
    tolerance: previous?.tolerance ?? DEFAULT_TOLERANCE,
    routes: current.routes,
    domNodes: current.domNodes,
    history: [
      ...(previous?.history ?? []),
      { date, reason: reason.trim(), before: previous ? summarize(previous) : null, after: summarize(current) },
    ],
  }
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (e) {
    throw new Error(`page-weight: ${path.relative(ROOT, BASELINE_PATH)} is not valid JSON (${e.message})`)
  }
}

function reasonFromArgs(args) {
  const i = args.findIndex(a => a === '--reason' || a.startsWith('--reason='))
  if (i === -1) return ''
  return args[i].startsWith('--reason=') ? args[i].slice('--reason='.length) : (args[i + 1] ?? '')
}

function requireOut() {
  if (!existsSync(OUT_DIR)) throw new Error('page-weight: out/ not found: run npm run build first')
}

function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'print') {
    requireOut()
    console.log(JSON.stringify(measure(), null, 2))
    return 0
  }
  if (cmd === 'check') {
    requireOut()
    const baseline = readBaseline()
    if (!baseline) throw new Error('page-weight: no baseline at perf/page-weight.baseline.json (create it with: update --reason "<why>")')
    const current = measure()
    const problems = compare(baseline, current)
    if (problems.length > 0) {
      for (const p of problems) console.error(`page-weight: FAIL ${p}`)
      console.error('page-weight: if the growth is intended: node scripts/page-weight.mjs update --reason "<why>"')
      return 1
    }
    console.log(
      `page-weight: OK (${Object.keys(current.routes).length} routes, ${Object.keys(current.domNodes).length} golden states within tolerance)`,
    )
    return 0
  }
  if (cmd === 'update') {
    const reason = reasonFromArgs(rest)
    // Validate the reason before measuring or touching anything: a refusal must never write.
    nextBaseline(null, { routes: {}, domNodes: {} }, reason, '')
    requireOut()
    const next = nextBaseline(readBaseline(), measure(), reason, new Date().toISOString().slice(0, 10))
    mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n')
    console.log(`page-weight: wrote ${path.relative(ROOT, BASELINE_PATH)} (history entries: ${next.history.length})`)
    return 0
  }
  throw new Error('page-weight: usage: check | update --reason "<why>" | print')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(msg.startsWith('page-weight:') ? msg : `page-weight: ${msg}`)
    process.exitCode = 1
  }
}
