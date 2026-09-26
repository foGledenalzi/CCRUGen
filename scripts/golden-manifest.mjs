#!/usr/bin/env node
// Freeze and verify golden sets (FND-02, D-15). A frozen file is never overwritten.
// Usage:
//   node scripts/golden-manifest.mjs freeze <manifest.json> --set <YYYY-MM-DD-slug> --reason "<why>" [--strict-dir <dir>] <file-or-dir>...
//   node scripts/golden-manifest.mjs verify <manifest.json>...
//
// A manifest is { version: 1, strictDir: string | null, sets: [{ set, date, reason, files: { repoPath: sha256 } }] }.
// The pre-refactor baseline is never overwritten: an intentional visual change adds a NEW dated set with a
// written reason. Zero dependencies, ESM, Windows and Linux safe. All paths are repo-relative with forward
// slashes; targets and manifest paths are resolved against the repo root.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * @typedef {{ set: string, date: string, reason: string, files: Record<string, string> }} GoldenSet
 * @typedef {{ version: number, strictDir: string | null, sets: GoldenSet[] }} Manifest
 */

/** Repo root, resolved from this file's location (scripts/..). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const MANIFEST_NAME = 'MANIFEST.json'
const SET_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/

/**
 * Hex sha256 digest.
 * @param {Uint8Array} buf
 * @returns {string}
 */
export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Repo-relative path with forward slashes.
 * @param {string} p absolute, or relative to the repo root
 * @returns {string}
 */
export function toRepoPath(p) {
  return path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/')
}

const byCodeUnit = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? -1 : a > b ? 1 : 0)

/** @param {string} abs @param {string[]} out */
function walk(abs, out) {
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(abs, entry.name)
    if (entry.isDirectory()) walk(child, out)
    else if (entry.isFile() && entry.name !== MANIFEST_NAME) out.push(toRepoPath(child))
  }
}

/**
 * Files under the given targets (files or directories, relative to the repo root): directories are
 * walked recursively, any file named MANIFEST.json is skipped, the result is sorted and de-duplicated.
 * @param {...string} targets
 * @returns {string[]}
 */
export function listFiles(...targets) {
  /** @type {string[]} */
  const out = []
  for (const target of targets) {
    const abs = path.resolve(ROOT, target)
    if (!fs.existsSync(abs)) throw new Error(`not found: ${target}`)
    if (fs.statSync(abs).isDirectory()) walk(abs, out)
    else if (path.basename(abs) !== MANIFEST_NAME) out.push(toRepoPath(abs))
  }
  return [...new Set(out)].sort(byCodeUnit)
}

/**
 * @param {string | null} [strictDir]
 * @returns {Manifest}
 */
export function emptyManifest(strictDir) {
  return { version: 1, strictDir: strictDir ?? null, sets: [] }
}

/**
 * Append a frozen set and return a NEW manifest. Refuses to reuse a set name, to re-freeze any file that an
 * earlier set already froze, to accept a set without a written reason, or a set name that is not YYYY-MM-DD-slug.
 * @param {Manifest} manifest
 * @param {{ set: string, date: string, reason: string, files: Record<string, string> }} entry
 * @returns {Manifest}
 */
export function addSet(manifest, { set, date, reason, files }) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('a written reason is required: pass --reason "<why this set exists>"')
  }
  if (typeof set !== 'string' || !SET_NAME.test(set)) {
    throw new Error(`set name must match YYYY-MM-DD-slug (lowercase letters, digits, hyphens), got "${set}"`)
  }
  if (manifest.sets.some((s) => s.set === set)) {
    throw new Error(`set ${set} already exists`)
  }
  const names = Object.keys(files ?? {})
  if (names.length === 0) {
    throw new Error('no files to freeze')
  }
  for (const file of names) {
    const earlier = manifest.sets.find((s) => Object.prototype.hasOwnProperty.call(s.files, file))
    if (earlier) {
      throw new Error(
        `${file} is already frozen, never overwritten (set ${earlier.set}); an intentional change adds NEW files under a new dated set`,
      )
    }
  }
  return { ...manifest, sets: [...manifest.sets, { set, date, reason: reason.trim(), files }] }
}

/**
 * Pure verification. Returns a list of problems ([] when intact).
 * @param {Manifest} manifest
 * @param {(repoPath: string) => Uint8Array} readFile returns the bytes or throws
 * @param {(dir: string) => string[]} listDir returns the repo paths under a directory
 * @returns {string[]}
 */
export function verifyManifest(manifest, readFile, listDir) {
  /** @type {string[]} */
  const problems = []
  const frozen = new Set()
  for (const s of manifest.sets) {
    for (const [file, hash] of Object.entries(s.files)) {
      frozen.add(file)
      /** @type {Uint8Array} */
      let buf
      try {
        buf = readFile(file)
      } catch {
        problems.push(`missing: ${file} (set ${s.set})`)
        continue
      }
      if (buf.includes(13)) problems.push(`CR in ${file}`)
      if (sha256(buf) !== hash) problems.push(`changed: ${file} (set ${s.set})`)
    }
  }
  if (manifest.strictDir) {
    for (const file of listDir(manifest.strictDir)) {
      if (path.posix.basename(file) === MANIFEST_NAME) continue
      if (!frozen.has(file)) problems.push(`unfrozen file in ${manifest.strictDir}: ${file}`)
    }
  }
  return problems
}

/**
 * Verify a manifest file on disk. Safe to pass to Array#flatMap (extra arguments are ignored).
 * @param {string} manifestPath relative to the repo root (or absolute)
 * @returns {string[]}
 */
export function verifyManifestFile(manifestPath) {
  const abs = path.resolve(ROOT, manifestPath)
  if (!fs.existsSync(abs)) return [`manifest missing: ${manifestPath}`]
  /** @type {Manifest} */
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch (err) {
    return [`manifest unreadable: ${manifestPath} (${err instanceof Error ? err.message : String(err)})`]
  }
  return verifyManifest(
    manifest,
    (file) => fs.readFileSync(path.resolve(ROOT, file)),
    (dir) => {
      try {
        return listFiles(dir)
      } catch {
        return []
      }
    },
  )
}

// ----- CLI (only when run directly) -----

/** @param {string[]} args */
function parseArgs(args) {
  /** @type {Record<string, string>} */
  const flags = {}
  /** @type {string[]} */
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq !== -1) flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      else flags[arg.slice(2)] = args[++i] ?? ''
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}

/** @param {string[]} args */
function freeze(args) {
  const { flags, positional } = parseArgs(args)
  const [manifestPath, ...targets] = positional
  if (!manifestPath || targets.length === 0) {
    throw new Error('usage: freeze <manifest.json> --set <YYYY-MM-DD-slug> --reason "<why>" [--strict-dir <dir>] <file-or-dir>...')
  }
  const abs = path.resolve(ROOT, manifestPath)
  const manifest = fs.existsSync(abs)
    ? JSON.parse(fs.readFileSync(abs, 'utf8'))
    : emptyManifest(flags['strict-dir'] ? toRepoPath(flags['strict-dir']) : null)

  /** @type {Record<string, string>} */
  const files = {}
  for (const file of listFiles(...targets)) {
    const buf = fs.readFileSync(path.resolve(ROOT, file))
    if (buf.includes(13)) {
      throw new Error(`refusing to freeze ${file}: it contains a carriage return (CR); goldens are LF only, see .gitattributes`)
    }
    files[file] = sha256(buf)
  }
  const next = addSet(manifest, {
    set: flags.set,
    date: new Date().toISOString().slice(0, 10),
    reason: flags.reason,
    files,
  })
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, JSON.stringify(next, null, 2) + '\n')
  console.log(`golden-manifest: froze ${Object.keys(files).length} files as ${flags.set}`)
}

/** @param {string[]} args */
function verify(args) {
  const { positional } = parseArgs(args)
  if (positional.length === 0) throw new Error('usage: verify <manifest.json>...')
  let failed = false
  for (const manifestPath of positional) {
    const problems = verifyManifestFile(manifestPath)
    for (const problem of problems) console.error(`golden-manifest: ${problem}`)
    if (problems.length > 0) {
      failed = true
      continue
    }
    const manifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, manifestPath), 'utf8'))
    const count = manifest.sets.reduce((n, s) => n + Object.keys(s.files).length, 0)
    console.log(`golden-manifest: OK ${count} files in ${manifest.sets.length} sets`)
  }
  if (failed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...rest] = process.argv.slice(2)
  try {
    if (command === 'freeze') freeze(rest)
    else if (command === 'verify') verify(rest)
    else throw new Error('usage: golden-manifest.mjs <freeze|verify> <manifest.json> ...')
  } catch (err) {
    console.error(`golden-manifest: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}
