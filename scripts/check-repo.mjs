#!/usr/bin/env node
// Repository policy guard (FND-01, FND-02, FND-05, D-04). Exit 1 on any failed check.
//   node scripts/check-repo.mjs [--only a,b] [--clean-tree] [--static-out]
//
// Default checks: reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow.
// Extra checks (only when flagged): --clean-tree (build/test left no tracked file modified, frozen oracle
// dirs pristine) and --static-out (the exported out/ tree is clean). --only restricts the run to the named
// checks (any of the twelve).
//
// Zero dependencies, ESM. git is always run without a shell, and only local read commands are used: this
// script never contacts a remote (D-05).

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, verifyManifestFile } from './golden-manifest.mjs'
import { isMain } from './is-main.mjs'

export const LORE_FILES = ['app/data/zones.ts', 'app/data/gates.ts', 'app/data/currents.ts', 'app/data/syzygies.ts', 'app/data/demons.ts']
export const LORE_HEADER = '// CCRU-derived lore. Not covered by the MIT license; see NOTICE.'
export const MANIFESTS = ['e2e/__golden__/MANIFEST.json', 'engine/test/fixtures/MANIFEST.json']
export const LF_DIRS = ['e2e/__golden__', 'engine/test/fixtures', 'perf']
// Markers that must never appear in the static export: Vercel leftovers, the deleted share-image route and,
// by user order (2026-09-25), the old upstream branding.
export const FORBIDDEN_OUT = [
  /_vercel/,
  /vercel-scripts/,
  /vercel-storage/,
  /@vercel\//,
  /api\/share-image/,
  /qliphoth/i,
  /delight nexus/i,
]

const TEXT_EXT = /\.(html|js|css|txt|json|xml|svg)$/i

// ----- pure helpers -----

/**
 * Tracked paths under reference/ (local, copyrighted, never committed).
 * @param {string[]} files
 * @returns {string[]}
 */
export function findTrackedReference(files) {
  return files.filter((f) => {
    const lower = f.toLowerCase()
    return lower === 'reference' || lower.startsWith('reference/')
  })
}

/**
 * True when a remote URL points at lumpenspace/ccru (https, ssh or scp-like, with or without .git).
 * @param {string} url
 * @returns {boolean}
 */
export function isUpstreamOrigin(url) {
  return /(^|[/:])lumpenspace\/ccru(\.git)?\/?$/i.test(url.trim())
}

/**
 * Tracked build output and OS junk (D-10): dist/, demo.mov, yarn.lock, every .DS_Store.
 * @param {string[]} files
 * @returns {string[]}
 */
export function findTrackedJunk(files) {
  return files.filter(
    (f) => f.startsWith('dist/') || f === 'demo.mov' || f === 'yarn.lock' || f === '.DS_Store' || f.endsWith('/.DS_Store'),
  )
}

/**
 * Entries NOTICE must name: the five CCRU-derived lore files and the upstream credit.
 * @param {string} text
 * @returns {string[]} the missing entries
 */
export function missingNoticeEntries(text) {
  return [...LORE_FILES, 'lumpenspace/ccru'].filter((entry) => !text.includes(entry))
}

/**
 * @param {string} text LICENSE contents
 * @returns {string[]}
 */
export function licenseProblems(text) {
  /** @type {string[]} */
  const problems = []
  if (!text.includes('MIT License')) problems.push('LICENSE lacks "MIT License"')
  if (!text.includes('Permission is hereby granted, free of charge')) problems.push('LICENSE lacks the MIT grant text')
  return problems
}

/**
 * Drop YAML comments (a `#` at the start of a line or after whitespace) and normalise CRLF, so a comment can
 * never satisfy or trip a structural check. Over-stripping a `#` inside a quoted scalar is harmless here.
 * @param {string} yml
 * @returns {string[]} the comment-free lines
 */
function stripYamlComments(yml) {
  return yml.split(/\r?\n/).map((line) => line.replace(/(^|\s)#.*$/, ''))
}

/**
 * The CI workflow must call the single verify entry point on both OSes with a read-only token (D-07).
 * Matched structurally on the comment-free text (review WR-03): a `run: npm run verify` step, a top-level
 * `permissions:` block that holds `contents: read`, no write permission anywhere, both runner OSes and no
 * pull_request_target trigger.
 * @param {string} yml
 * @returns {string[]}
 */
export function workflowProblems(yml) {
  /** @type {string[]} */
  const problems = []
  const lines = stripYamlComments(yml)
  const body = lines.join('\n')

  if (!/^[ \t]*(?:-[ \t]+)?run:[ \t]*["']?npm run verify["']?[ \t]*$/m.test(body)) {
    problems.push('workflow has no "run: npm run verify" step')
  }

  const start = lines.findIndex((line) => /^permissions:[ \t]*$/.test(line))
  /** @type {string[]} */
  const block = []
  if (start !== -1) {
    for (const line of lines.slice(start + 1)) {
      if (line.trim() !== '' && !/^[ \t]/.test(line)) break // next top-level key
      block.push(line)
    }
  }
  if (!block.some((line) => /^[ \t]+contents:[ \t]*read[ \t]*$/.test(line))) {
    problems.push('workflow lacks a top-level "permissions:" block with "contents: read"')
  }
  if (/\bwrite-all\b|:[ \t]*["']?write\b/.test(body)) problems.push('workflow requests write permissions')

  for (const os of ['ubuntu-latest', 'windows-latest']) {
    if (!new RegExp(`\\b${os}\\b`).test(body)) problems.push(`workflow lacks "${os}"`)
  }
  if (/\bpull_request_target\b/.test(body)) problems.push('workflow uses pull_request_target')
  return problems
}

/**
 * @param {string} text .gitattributes contents
 * @returns {string[]}
 */
export function gitattributesProblems(text) {
  const ok = text.split(/\r?\n/).some((line) => line.trim() === '* text=auto eol=lf')
  return ok ? [] : ['.gitattributes lacks the line "* text=auto eol=lf"']
}

/**
 * Every lore file must carry the CCRU-derived header on line 1.
 * @param {(repoPath: string) => string} read returns the file text or throws
 * @returns {string[]}
 */
export function loreProblems(read) {
  /** @type {string[]} */
  const problems = []
  for (const file of LORE_FILES) {
    /** @type {string} */
    let text
    try {
      text = read(file)
    } catch {
      problems.push(`${file} is missing or unreadable`)
      continue
    }
    if (text.split(/\r?\n/, 1)[0] !== LORE_HEADER) problems.push(`${file} does not start with the lore header`)
  }
  return problems
}

/**
 * Files under a directory whose bytes contain a carriage return (frozen goldens and fixtures are LF only).
 * @param {string} absDir
 * @returns {string[]} paths relative to absDir, forward slashes, sorted
 */
export function findCarriageReturns(absDir) {
  /** @type {string[]} */
  const out = []
  /** @param {string} dir @param {string} rel */
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const child = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(child, childRel)
      else if (entry.isFile() && readFileSync(child).includes(13)) out.push(childRel)
    }
  }
  if (existsSync(absDir)) walk(absDir, '')
  return out.sort()
}

/**
 * Scan an exported out/ tree: index.html and numogram/index.html present; no api directory, no .DS_Store,
 * no forbidden marker in any text file. Problems name the offending relative path.
 * @param {string} outDir
 * @returns {string[]}
 */
export function scanStaticOut(outDir) {
  if (!existsSync(outDir)) return [`static export missing: ${outDir}`]
  /** @type {string[]} */
  const problems = []
  for (const required of ['index.html', 'numogram/index.html']) {
    if (!existsSync(path.join(outDir, ...required.split('/')))) problems.push(`missing ${required}`)
  }
  /** @param {string} dir @param {string} rel */
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const child = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'api') problems.push(`${childRel}/ is an api directory (no server routes)`)
        walk(child, childRel)
      } else if (entry.isFile()) {
        if (entry.name === '.DS_Store') problems.push(`${childRel} is OS junk`)
        else if (TEXT_EXT.test(entry.name)) {
          const text = readFileSync(child, 'utf8')
          const hits = FORBIDDEN_OUT.filter((re) => re.test(text))
          if (hits.length > 0) problems.push(`${childRel} contains forbidden text: ${hits.join(' ')}`)
        }
      }
    }
  }
  walk(outDir, '')
  return problems
}

/**
 * Non-empty lines of `git status --porcelain` output (the two status columns are kept).
 * @param {string} porcelain
 * @returns {string[]}
 */
export function parseDirtyStatus(porcelain) {
  return porcelain.split(/\r?\n/).filter((line) => line.trim() !== '')
}

// ----- checks against the real repository -----

/** @param {string[]} args @returns {string} */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  })
}

/** @type {string[] | null} */
let trackedCache = null
/** @returns {string[]} */
function trackedFiles() {
  trackedCache ??= git(['ls-files', '-z']).split('\0').filter(Boolean)
  return trackedCache
}

/** @param {string} rel @returns {string} */
const readText = (rel) => readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8')

/**
 * @param {string} rel
 * @param {(text: string) => string[]} fn
 * @returns {string[]}
 */
function fileCheck(rel, fn) {
  return existsSync(path.join(ROOT, ...rel.split('/'))) ? fn(readText(rel)) : [`${rel} is missing`]
}

/** @returns {string[]} */
function checkOrigin() {
  /** @type {string} */
  let url
  try {
    url = git(['remote', 'get-url', 'origin'])
  } catch {
    return [] // no origin at all: nothing points at upstream
  }
  return isUpstreamOrigin(url) ? [`origin still points at upstream: ${url.trim()}`] : []
}

/** @returns {string[]} */
function checkCleanTree() {
  return [
    ...parseDirtyStatus(git(['status', '--porcelain', '--untracked-files=no', '--', '.', ':(exclude).planning'])).map(
      (line) => `tracked file changed: ${line}`,
    ),
    ...parseDirtyStatus(git(['status', '--porcelain', '--untracked-files=all', '--', ...LF_DIRS])).map(
      (line) => `frozen oracle directory not pristine: ${line}`,
    ),
  ]
}

/** @type {Record<string, () => string[]>} */
const CHECKS = {
  reference: () => findTrackedReference(trackedFiles()).map((f) => `tracked: ${f}`),
  origin: checkOrigin,
  junk: () => findTrackedJunk(trackedFiles()).map((f) => `tracked: ${f}`),
  license: () => fileCheck('LICENSE', licenseProblems),
  notice: () => fileCheck('NOTICE', (text) => missingNoticeEntries(text).map((entry) => `NOTICE does not name ${entry}`)),
  lore: () => loreProblems(readText),
  goldens: () => MANIFESTS.flatMap((manifest) => verifyManifestFile(manifest)),
  lf: () => LF_DIRS.flatMap((dir) => findCarriageReturns(path.join(ROOT, dir)).map((f) => `CR in ${dir}/${f}`)),
  gitattributes: () => fileCheck('.gitattributes', gitattributesProblems),
  workflow: () => fileCheck('.github/workflows/ci.yml', workflowProblems),
  'clean-tree': checkCleanTree,
  'static-out': () => scanStaticOut(path.join(ROOT, 'out')),
}
export const DEFAULT_CHECKS = ['reference', 'origin', 'junk', 'license', 'notice', 'lore', 'goldens', 'lf', 'gitattributes', 'workflow']

// ----- CLI -----

/**
 * @param {string[]} argv
 * @returns {number} the exit code
 */
export function run(argv) {
  /** @type {string[] | null} */
  let only = null
  /** @type {string[]} */
  const extras = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--only' || arg.startsWith('--only=')) {
      const value = arg === '--only' ? (argv[++i] ?? '') : arg.slice('--only='.length)
      only = value.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (arg === '--clean-tree') extras.push('clean-tree')
    else if (arg === '--static-out') extras.push('static-out')
    else {
      console.error(`check-repo: unknown argument "${arg}"`)
      return 1
    }
  }
  const names = [...new Set([...(only ?? DEFAULT_CHECKS), ...extras])]
  const unknown = names.filter((name) => !Object.prototype.hasOwnProperty.call(CHECKS, name))
  if (unknown.length > 0 || names.length === 0) {
    console.error(`check-repo: unknown check "${unknown.join(', ')}" (known: ${Object.keys(CHECKS).join(', ')})`)
    return 1
  }

  /** @type {string[]} */
  const failed = []
  for (const name of names) {
    /** @type {string[]} */
    let problems
    try {
      problems = CHECKS[name]()
    } catch (err) {
      problems = [`check crashed: ${err instanceof Error ? err.message : String(err)}`]
    }
    for (const problem of problems) console.error(`check-repo: FAIL ${name}: ${problem}`)
    if (problems.length > 0) failed.push(name)
  }
  if (failed.length > 0) {
    console.error(`check-repo: FAILED (${failed.join(', ')})`)
    return 1
  }
  console.log(`check-repo: OK (${names.join(', ')})`)
  return 0
}

if (isMain(import.meta.url)) {
  process.chdir(ROOT)
  process.exitCode = run(process.argv.slice(2))
}
