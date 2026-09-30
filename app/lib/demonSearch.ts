// Demon browser search (DEM-02): defensive mesh / a::b / name parsing and resolution. Original CCRUG code (MIT, NOTICE section 1).
import { parseNumeral, type DemonRef, type Numogram } from '../../engine/index'
import { clipEcho } from '../../engine/core/base'
import { demonNameTable, filterContains, filterLabel, rankOf, type DemonFilter, type DemonSort } from './demonBrowser'

/** A pasted/typed query is clamped to this many characters before any regex or parse ever sees it (T-05-07). */
export const SEARCH_MAX_LENGTH = 64

/** Name-based search (base 10 only today) runs only when the demon count is at most this (T-05-10, ROADMAP Phase 5 note). */
export const NAME_SEARCH_MAX_COUNT = 50_000

export type DemonQuery =
  | { readonly kind: 'empty' }
  | { readonly kind: 'mesh'; readonly mesh: number }
  | { readonly kind: 'pair'; readonly a: number; readonly b: number } // a > b
  | { readonly kind: 'name'; readonly mesh: number }
  | { readonly kind: 'not-found' } // well formed, but no such demon (mesh >= count, zone >= base, a === b, unknown name)
  | { readonly kind: 'syntax' } // none of the accepted forms

/** Whole numbers 0..999,999,999,999,999 (16 digits): the decimal mesh-id shape, always read as a plain integer. */
const MESH_RE = /^\d{1,16}$/

/** A single-character-per-digit numeral (base <= 36), lower-cased before this test. */
const ZONE_LETTER_RE = /^[0-9a-z]{1,64}$/

/** Dot-separated decimal digit groups (base > 36), matching engine/core/numerals.ts's own formatNumeral scheme. */
const ZONE_DOTTED_RE = /^\d{1,16}(?:\.\d{1,16}){0,15}$/

/** A base-10 name candidate: letters only, 1..32 of them (every CCRU name is well under this). */
const NAME_RE = /^[a-z]{1,32}$/i

// The largest base numerals.ts still writes with one character per digit (0-9a-z); above it, numerals are
// dot-separated decimal digit groups. Kept in sync with (but not imported from) engine/core/numerals.ts's own
// internal LETTER_BASE_LIMIT, which is not exported (it is an implementation detail of formatNumeral/parseNumeral).
const LETTER_BASE_LIMIT = 36

/** raw clamped to at most SEARCH_MAX_LENGTH characters (T-05-07): a pasted megabyte is never read past this. */
export function clampQuery(raw: string): string {
  return raw.slice(0, SEARCH_MAX_LENGTH)
}

/** text (already trimmed), regex-gated and case-normalized for base, or null if it does not even look like a numeral. */
function normalizeZoneCandidate(text: string, base: number): string | null {
  if (base <= LETTER_BASE_LIMIT) {
    const lower = text.toLowerCase()
    return ZONE_LETTER_RE.test(lower) ? lower : null
  }
  return ZONE_DOTTED_RE.test(text) ? text : null
}

/**
 * text as an in-base zone numeral (T-05-08): regex-gated first, then parsed inside a try/catch (parseNumeral throws
 * RangeError on an over-long numeral, a digit at or above the base, or an over-large value), and finally range-checked
 * against base. null for anything malformed, unparseable, or not below base. Never throws.
 */
export function parseZoneNumeral(text: string, base: number): number | null {
  const candidate = normalizeZoneCandidate(text.trim(), base)
  if (candidate === null) return null
  let value: number
  try {
    value = parseNumeral(candidate, base)
  } catch {
    return null
  }
  return Number.isSafeInteger(value) && value < base ? value : null
}

/**
 * Parses a demon search query against g (T-05-08, T-05-09): a decimal mesh id, an a::b net-span in the numogram's own
 * base (either order), or (base 10 only, count <= NAME_SEARCH_MAX_COUNT, T-05-10) a CCRU name, exact or first prefix
 * match in mesh order. Every regex is anchored with bounded quantifiers over the <= 64-char clamped text (T-05-09), so
 * matching is linear; the name loop only ever runs over a table that exists (45 entries today). Never throws.
 */
export function parseDemonQuery(raw: string, g: Numogram): DemonQuery {
  const text = clampQuery(raw).trim()
  if (text === '') return { kind: 'empty' }

  if (MESH_RE.test(text)) {
    const mesh = Number(text)
    return Number.isSafeInteger(mesh) && mesh < g.demons.count ? { kind: 'mesh', mesh } : { kind: 'not-found' }
  }

  const sep = text.indexOf('::')
  if (sep !== -1) {
    const left = text.slice(0, sep)
    const right = text.slice(sep + 2)
    if (right.includes('::')) return { kind: 'syntax' }
    const leftTrim = left.trim()
    const rightTrim = right.trim()
    if (leftTrim === '' || rightTrim === '') return { kind: 'syntax' }

    const leftCandidate = normalizeZoneCandidate(leftTrim, g.base)
    const rightCandidate = normalizeZoneCandidate(rightTrim, g.base)
    if (leftCandidate === null || rightCandidate === null) return { kind: 'syntax' }

    const aVal = parseZoneNumeral(leftTrim, g.base)
    const bVal = parseZoneNumeral(rightTrim, g.base)
    if (aVal === null || bVal === null) return { kind: 'not-found' }
    if (aVal === bVal) return { kind: 'not-found' }
    return { kind: 'pair', a: Math.max(aVal, bVal), b: Math.min(aVal, bVal) }
  }

  if (NAME_RE.test(text)) {
    const table = demonNameTable(g.base)
    if (table === null || g.demons.count > NAME_SEARCH_MAX_COUNT) return { kind: 'syntax' }
    const query = text.toLowerCase()
    let prefixMesh: number | null = null
    for (let mesh = 0; mesh < g.demons.count; mesh++) {
      const name = table[mesh]
      if (name === undefined) continue
      const lower = name.toLowerCase()
      if (lower === query) return { kind: 'name', mesh }
      if (prefixMesh === null && lower.startsWith(query)) prefixMesh = mesh
    }
    return prefixMesh !== null ? { kind: 'name', mesh: prefixMesh } : { kind: 'not-found' }
  }

  return { kind: 'syntax' }
}
