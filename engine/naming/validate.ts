// The reader of the naming file `ccrug.naming/1` (NAM-03, D-09, D-11, D-13, 07-RESEARCH Pattern 6, Pitfalls 10 and 17). One
// hand-written validator reads every untrusted naming text: an imported file and a browser storage slot (which another tab, an older
// version or a manual edit can leave with anything in it). It is all-or-nothing, so nothing is half-applied; it never throws; and it
// never recurses, so a hostile file cannot overflow the stack (V8's JSON.parse is iterative, and this code only ever reads typeof,
// array lengths and the keys of the objects the format defines).
//
// Rule order (one check per rule, issues are collected rather than stopping at the first):
//   1 size cap, 2 JSON, 3 an object, 4 the schema id (another ccrug.naming/N is an unknown version),
//   5 base (an invalid base is a bad field; another valid base is refused with a seed offer),
//   then, for a file of this base: an unknown generator or smoothing version, generator, source, join, seed-only bases, zones,
//   locks, overrides, meta, and the unknown keys. Rules 1 to 5 and an unknown version end the read at once; the others are collected
//   (at most ISSUES_MAX are kept, the exact total is counted).
//
// Prototype safety: an override key must be a decimal mesh number (OVERRIDE_KEY below: digits only, at most 16, no leading zero)
// under base(base-1)/2 and the accepted pairs go into a Map, so a key such as __proto__, constructor or toString (JSON.parse creates
// an own __proto__ property, and a naive copy[key] = value would then reach the prototype) is refused as an invalid key and never
// assigned. Every field of the file is read through `own`, which ignores anything that is not an own property.
//
// Every sound and every name passes the text rules (validateSound, validateName), so no control or format character enters a table
// (T-07-03c). The words shown to the user belong to the UI: this module returns typed issues. The few texts an issue repeats from the
// file (a key, a version) are clipped and made safe to echo (clip below, WR-03).

import { validateBase } from '../core/base'
import { isStyleId } from './banks'
import type { StyleId } from './banks'
import { EUPHONY_VERSION } from './euphony'
import { GENERATOR_ID, createGenerator, generateSounds } from './generate'
import { PRNG_ALGO } from './prng'
import { ISSUES_MAX, META_MAX_LENGTH, NAMING_IMPORT_MAX_BYTES, NAMING_MAX_OVERRIDES, SCHEMA_ID, SCHEMA_PREFIX, UNKNOWN_KEYS_MAX } from './schema'
import type { SeedRecord } from './schema'
import { normalizeSeed, safeEcho, validateName, validateSound } from './text'
import type { TextCheck, TextProblem } from './text'
import { isJoinOrder } from './types'
import type { JoinOrder, Naming, NamingMeta, NamingPreset, NamingSource, Smoothing } from './types'

/** Why a file or slot was refused. The UI builds one sentence from each (plan 07-11). */
export type NamingIssue =
  | { readonly kind: 'not-json' }
  | { readonly kind: 'not-names-file' }
  | { readonly kind: 'too-large'; readonly maxBytes: number }
  /** `version` is the suffix of the schema id, or the generator id, or `euphony@{n}`; clipped to 40 characters. */
  | { readonly kind: 'unknown-version'; readonly version: string }
  | { readonly kind: 'wrong-base'; readonly fileBase: number }
  | { readonly kind: 'seed-only-base' }
  | { readonly kind: 'bad-sound'; readonly zone: number; readonly reason: TextProblem }
  /** `key` is the file's key, clipped to 40 characters. */
  | { readonly kind: 'bad-override-key'; readonly key: string }
  | { readonly kind: 'bad-override-name'; readonly mesh: number; readonly reason: TextProblem }
  /** `path` is a dotted field path such as `generator.seed`. */
  | { readonly kind: 'bad-field'; readonly path: string }

export type NamingImport =
  | {
      readonly ok: true
      readonly naming: Naming
      /** Dotted paths of keys this version does not know (at most UNKNOWN_KEYS_MAX, each clipped); they never block an import. */
      readonly unknownKeys: readonly string[]
      /** The exact number of unknown keys, which can be more than `unknownKeys` lists. */
      readonly unknownKeyCount: number
    }
  | {
      readonly ok: false
      /** At most ISSUES_MAX issues, in rule order. */
      readonly issues: readonly NamingIssue[]
      /** The exact number of issues found, which can be more than `issues` keeps ("And {k} more."). */
      readonly issueCount: number
      /** For a file of another base that carries a valid generator record: the seed, style, join and smoothing it could be offered with. */
      readonly offerSeed: SeedRecord | null
    }

export interface ValidateNamingOptions {
  /** The base the naming is for: a file of another base is refused. */
  readonly base: number
  /** The interactive ceiling: above it only a seed-only file is accepted. */
  readonly interactiveMaxN: number
  /** The CCRU preset the application has (or null): a file with source ccru is accepted only for the base of this preset. */
  readonly preset: NamingPreset | null
  /** Largest text, counted in UTF-16 units (callers read File.size first for a file); defaults to NAMING_IMPORT_MAX_BYTES. */
  readonly maxBytes?: number
}

// Digits only, no sign, no leading zero, at most 16 of them: a decimal mesh number, so no prototype name can pass.
const OVERRIDE_KEY = /^(0|[1-9][0-9]{0,15})$/

const TOP_KEYS: ReadonlySet<string> = new Set(['schema', 'base', 'source', 'generator', 'join', 'zones', 'locks', 'overrides', 'meta'])
const GENERATOR_KEYS: ReadonlySet<string> = new Set(['prng', 'gen', 'seed', 'style'])
const JOIN_KEYS: ReadonlySet<string> = new Set(['order', 'smoothing'])
const META_KEYS: ReadonlySet<string> = new Set(['title', 'notes'])

/** Longest text of a file's own key or version that an issue repeats. */
const ECHO_MAX = 40

const HIGH_SURROGATE_FIRST = 0xd800
const HIGH_SURROGATE_LAST = 0xdbff

/**
 * s cut to ECHO_MAX UTF-16 units without leaving half of a surrogate pair at the end, and made safe to repeat in a sentence: a
 * control, a bidi or other format character, a line or paragraph separator and a lone surrogate become U+FFFD (WR-03).
 */
function clip(s: string): string {
  if (s.length <= ECHO_MAX) return safeEcho(s)
  const cut = s.slice(0, ECHO_MAX)
  const last = cut.charCodeAt(ECHO_MAX - 1)
  return safeEcho(last >= HIGH_SURROGATE_FIRST && last <= HIGH_SURROGATE_LAST ? cut.slice(0, -1) : cut)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The own property `key` of rec, or undefined: an inherited property (a polluted Object.prototype) is never read. */
function own(rec: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined
}

function refuse(issues: readonly NamingIssue[], issueCount: number = issues.length, offerSeed: SeedRecord | null = null): NamingImport {
  return { ok: false, issues: issues.slice(0, ISSUES_MAX), issueCount, offerSeed }
}

const NOT_A_NAMES_FILE: readonly NamingIssue[] = [{ kind: 'not-names-file' }]

/** The seed record of a file: only when the generator ids are the ones this code knows and the seed, style, join and smoothing are all valid. */
function seedRecordOf(root: Record<string, unknown>): SeedRecord | null {
  const generator = own(root, 'generator')
  const join = own(root, 'join')
  if (!isRecord(generator) || !isRecord(join)) return null
  if (own(generator, 'prng') !== PRNG_ALGO || own(generator, 'gen') !== GENERATOR_ID) return null
  const rawSeed = own(generator, 'seed')
  const seed = typeof rawSeed === 'string' ? normalizeSeed(rawSeed) : null
  if (seed === null) return null
  const style = own(generator, 'style')
  if (!isStyleId(style)) return null
  const order = own(join, 'order')
  if (!isJoinOrder(order)) return null
  const smoothing = own(join, 'smoothing')
  if (smoothing !== 0 && smoothing !== 1) return null
  return { seed, style, join: order, smoothing: smoothing === 0 ? 0 : 1 }
}

/** The id of a format version this code does not know (an unknown generator or smoothing version), or null. */
function unknownVersionOf(root: Record<string, unknown>): string | null {
  const generator = own(root, 'generator')
  if (isRecord(generator)) {
    const prng = own(generator, 'prng')
    if (typeof prng === 'string' && prng !== PRNG_ALGO) return clip(prng)
    const gen = own(generator, 'gen')
    if (typeof gen === 'string' && gen !== GENERATOR_ID) return clip(gen)
  }
  const join = own(root, 'join')
  if (isRecord(join)) {
    const smoothing = own(join, 'smoothing')
    if (typeof smoothing === 'number' && Number.isInteger(smoothing) && smoothing > EUPHONY_VERSION) return `euphony@${clip(String(smoothing))}`
  }
  return null
}

/** A set of unique whole zone numbers below base, or null when the value is anything else. */
function readLocks(raw: unknown, base: number): Set<number> | null {
  if (!Array.isArray(raw) || raw.length > base) return null
  const locks = new Set<number>()
  for (const zone of raw as unknown[]) {
    if (typeof zone !== 'number' || !Number.isInteger(zone) || zone < 0 || zone >= base || locks.has(zone)) return null
    locks.add(zone)
  }
  return locks
}

const OTHER: TextCheck = { ok: false, reason: 'other' }

function readNaming(text: unknown, opts: ValidateNamingOptions): NamingImport {
  // 1 size, 2 JSON, 3 an object, 4 schema id: each ends the read
  if (typeof text !== 'string') return refuse(NOT_A_NAMES_FILE)
  const maxBytes = opts.maxBytes ?? NAMING_IMPORT_MAX_BYTES
  if (text.length > maxBytes) return refuse([{ kind: 'too-large', maxBytes }])
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch {
    return refuse([{ kind: 'not-json' }])
  }
  if (!isRecord(root)) return refuse(NOT_A_NAMES_FILE)
  const schema = own(root, 'schema')
  if (typeof schema !== 'string' || !schema.startsWith(SCHEMA_PREFIX)) return refuse(NOT_A_NAMES_FILE)
  if (schema !== SCHEMA_ID) return refuse([{ kind: 'unknown-version', version: clip(schema.slice(SCHEMA_PREFIX.length)) }])

  // 5 base
  const checkedBase = validateBase(own(root, 'base'))
  if (!checkedBase.ok) return refuse([{ kind: 'bad-field', path: 'base' }])
  const base = checkedBase.base
  if (base !== opts.base) return refuse([{ kind: 'wrong-base', fileBase: base }], 1, seedRecordOf(root))

  // a file written by a newer generator or euphony version is refused as such: nothing else about it can be trusted to mean the same
  const version = unknownVersionOf(root)
  if (version !== null) return refuse([{ kind: 'unknown-version', version }])

  const issues: NamingIssue[] = []
  let issueCount = 0
  const report = (issue: NamingIssue): void => {
    issueCount++
    if (issues.length < ISSUES_MAX) issues.push(issue)
  }

  // 6 generator: always present, the seed field of the panel always has a value
  const generator = own(root, 'generator')
  let seed: string | null = null
  let style: StyleId | null = null
  if (!isRecord(generator)) {
    report({ kind: 'bad-field', path: 'generator' })
  } else {
    // an id that is a string and not ours was refused above, so a mismatch here is a missing or non-text id
    if (own(generator, 'prng') !== PRNG_ALGO) report({ kind: 'bad-field', path: 'generator.prng' })
    if (own(generator, 'gen') !== GENERATOR_ID) report({ kind: 'bad-field', path: 'generator.gen' })
    const rawSeed = own(generator, 'seed')
    seed = typeof rawSeed === 'string' ? normalizeSeed(rawSeed) : null
    if (seed === null) report({ kind: 'bad-field', path: 'generator.seed' })
    const rawStyle = own(generator, 'style')
    if (isStyleId(rawStyle)) style = rawStyle
    else report({ kind: 'bad-field', path: 'generator.style' })
  }

  // 7 source
  const rawSource = own(root, 'source')
  let source: NamingSource | null = null
  let preset: NamingPreset | null = null
  if (rawSource === 'generated') {
    source = 'generated'
  } else if (rawSource === 'ccru' && opts.preset != null && opts.preset.base === opts.base && opts.preset.sounds.length === opts.base) {
    source = 'ccru'
    preset = opts.preset
  } else {
    report({ kind: 'bad-field', path: 'source' })
  }

  // 8 join
  const join = own(root, 'join')
  let order: JoinOrder | null = null
  let smoothing: Smoothing | null = null
  if (!isRecord(join)) {
    report({ kind: 'bad-field', path: 'join' })
  } else {
    const rawOrder = own(join, 'order')
    if (isJoinOrder(rawOrder)) order = rawOrder
    else report({ kind: 'bad-field', path: 'join.order' })
    const rawSmoothing = own(join, 'smoothing')
    if (rawSmoothing === 0 || rawSmoothing === 1) smoothing = rawSmoothing === 0 ? 0 : 1 // -0 reads as 0
    else report({ kind: 'bad-field', path: 'join.smoothing' })
  }

  // 9 to 12: the per-zone data, which exists only up to the interactive ceiling
  const rawZones = own(root, 'zones')
  const rawLocks = own(root, 'locks')
  const rawOverrides = own(root, 'overrides')
  const seedOnly = opts.base > opts.interactiveMaxN
  let zones: string[] | null = null
  let locks = new Set<number>()
  const overrides = new Map<number, string>()

  if (seedOnly) {
    if (rawZones !== undefined || rawLocks !== undefined || rawOverrides !== undefined) report({ kind: 'seed-only-base' })
  } else {
    // 10 zones
    if (rawZones !== undefined) {
      if (!Array.isArray(rawZones) || rawZones.length !== base) {
        report({ kind: 'bad-field', path: 'zones' })
      } else {
        const table = new Array<string>(base)
        let sound = true
        for (let zone = 0; zone < base; zone++) {
          const entry: unknown = rawZones[zone]
          const check: TextCheck = typeof entry === 'string' ? validateSound(entry) : OTHER
          if (check.ok) {
            table[zone] = check.text
          } else {
            sound = false
            report({ kind: 'bad-sound', zone, reason: check.reason })
          }
        }
        if (sound) zones = table
      }
    }

    // 11 locks: they pick zones out of a table the file carries
    if (rawLocks !== undefined) {
      const read = rawZones === undefined ? null : readLocks(rawLocks, base)
      if (read === null) report({ kind: 'bad-field', path: 'locks' })
      else locks = read
    }

    // 12 overrides: keys are decimal mesh numbers, stored in a Map, never copied into a plain object
    if (rawOverrides !== undefined) {
      if (!isRecord(rawOverrides)) {
        report({ kind: 'bad-field', path: 'overrides' })
      } else {
        const keys = Object.keys(rawOverrides)
        if (keys.length > NAMING_MAX_OVERRIDES) {
          report({ kind: 'bad-field', path: 'overrides' })
        } else {
          const meshCount = (base * (base - 1)) / 2
          for (const key of keys) {
            if (!OVERRIDE_KEY.test(key) || Number(key) >= meshCount) {
              report({ kind: 'bad-override-key', key: clip(key) })
              continue
            }
            const mesh = Number(key)
            const value: unknown = rawOverrides[key] // key is digits only: never __proto__ or a prototype name
            const check: TextCheck = typeof value === 'string' ? validateName(value) : OTHER
            if (check.ok) overrides.set(mesh, check.text)
            else report({ kind: 'bad-override-name', mesh, reason: check.reason })
          }
        }
      }
    }
  }

  // 13 meta: only typeof and length are read, a nested value is just a bad field
  const rawMeta = own(root, 'meta')
  let meta: NamingMeta | null = null
  if (rawMeta !== undefined) {
    if (!isRecord(rawMeta)) {
      report({ kind: 'bad-field', path: 'meta' })
    } else {
      const title = own(rawMeta, 'title')
      const notes = own(rawMeta, 'notes')
      const titleOk = title === undefined || (typeof title === 'string' && title.length <= META_MAX_LENGTH)
      const notesOk = notes === undefined || (typeof notes === 'string' && notes.length <= META_MAX_LENGTH)
      if (!titleOk) report({ kind: 'bad-field', path: 'meta.title' })
      if (!notesOk) report({ kind: 'bad-field', path: 'meta.notes' })
      if (titleOk && notesOk) meta = { title: (title as string | undefined) ?? '', notes: (notes as string | undefined) ?? '' }
    }
  }

  if (issueCount > 0) return refuse(issues, issueCount)
  if (seed === null || style === null || source === null || order === null || smoothing === null) return refuse(NOT_A_NAMES_FILE)

  // a file without zones at an editable base is regenerated from its seed (or taken from the preset when its source is ccru)
  let sounds: readonly string[] | null = null
  if (!seedOnly) {
    sounds = zones ?? (preset !== null ? [...preset.sounds] : generateSounds(createGenerator(seed, style), base))
  }

  // 14 unknown keys never block
  const unknownKeys: string[] = []
  let unknownKeyCount = 0
  const noteUnknown = (prefix: string, rec: Record<string, unknown>, known: ReadonlySet<string>): void => {
    for (const key of Object.keys(rec)) {
      if (known.has(key)) continue
      unknownKeyCount++
      if (unknownKeys.length < UNKNOWN_KEYS_MAX) unknownKeys.push(prefix + clip(key))
    }
  }
  noteUnknown('', root, TOP_KEYS)
  if (isRecord(generator)) noteUnknown('generator.', generator, GENERATOR_KEYS)
  if (isRecord(join)) noteUnknown('join.', join, JOIN_KEYS)
  if (isRecord(rawMeta)) noteUnknown('meta.', rawMeta, META_KEYS)

  const naming: Naming = Object.freeze({
    base,
    source,
    seed,
    style,
    join: order,
    smoothing,
    sounds: sounds === null ? null : Object.freeze(sounds),
    locks,
    overrides,
    meta,
  })
  return { ok: true, naming, unknownKeys, unknownKeyCount }
}

/**
 * Reads a naming from untrusted text (an imported file or a storage slot) for the given base. All or nothing: a refusal carries at
 * most ISSUES_MAX typed issues plus their exact count, and a success carries a frozen Naming plus the unknown keys it ignored. Never
 * throws and never recurses.
 */
export function validateNamingJson(text: string, opts: ValidateNamingOptions): NamingImport {
  try {
    return readNaming(text, opts)
  } catch {
    return refuse(NOT_A_NAMES_FILE)
  }
}
