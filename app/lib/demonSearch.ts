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

// ── Resolution to a row, and the exact UI-SPEC status copy ──────────────────

export type SearchOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'found'; readonly demon: DemonRef; readonly index: number } // index in the ordered (filter + sort + direction) source
  | { readonly kind: 'outside-filter'; readonly demon: DemonRef; readonly echo: string }
  | { readonly kind: 'not-found'; readonly echo: string }
  | { readonly kind: 'syntax'; readonly echo: string }

export interface StatusMessage {
  readonly heading: string
  readonly body: string
}

// Built as data (String.fromCodePoint), never as typed escapes in source (STATE Phase 2 P07 gotcha: the file-write
// tool decodes typed unicode escapes into raw characters, which then look identical to the correct text on screen
// but are easy to corrupt with an editor that "fixes" curly quotes).
const LQ = String.fromCodePoint(0x201c) // “
const RQ = String.fromCodePoint(0x201d) // ”
const DASH = String.fromCodePoint(0x2014) // —

/** clipEcho(clampQuery(raw).trim()): a pasted megabyte never becomes a megabyte of message text (T-05-11). */
function echoOf(raw: string): string {
  return clipEcho(clampQuery(raw).trim())
}

/**
 * Resolves a search query to a row under filter/sort (T-05-08): parses raw, looks the demon up by mesh/net-span/name,
 * reports it as outside-filter when filterContains(filter, demon) is false (a demon that exists is never silently
 * dropped), else returns its rank via rankOf (non-null by construction, since filterContains already passed). Never
 * throws: every mesh/pair/name query has already been range-checked by parseDemonQuery.
 */
export function resolveDemonSearch(raw: string, g: Numogram, filter: DemonFilter | null, sort: DemonSort): SearchOutcome {
  const query = parseDemonQuery(raw, g)
  if (query.kind === 'empty') return { kind: 'empty' }
  const echo = echoOf(raw)
  if (query.kind === 'syntax') return { kind: 'syntax', echo }
  if (query.kind === 'not-found') return { kind: 'not-found', echo }

  const demon: DemonRef = query.kind === 'pair' ? g.demons.ref(query.a, query.b) : g.demons.at(query.mesh)
  if (!filterContains(filter, demon)) return { kind: 'outside-filter', demon, echo }

  const index = rankOf(g, filter, sort, demon)
  if (index === null) throw new RangeError('resolveDemonSearch: rankOf returned null for a demon that passed filterContains')
  return { kind: 'found', demon, index }
}

/** The exact UI-SPEC status copy for outcome, or null for 'found'/'empty' (no status line to show). */
export function searchMessage(outcome: SearchOutcome, filter: DemonFilter | null, total: number): StatusMessage | null {
  switch (outcome.kind) {
    case 'empty':
    case 'found':
      return null
    case 'not-found':
      return {
        heading: `No demon found for ${LQ}${outcome.echo}${RQ}.`,
        body: 'Search by mesh number (e.g. 42) or net-span (e.g. 12::3).',
      }
    case 'syntax':
      return {
        heading: `Couldn't parse ${LQ}${outcome.echo}${RQ} ${DASH} try a mesh number (e.g. 108) or an a::b pair (e.g. 12::3).`,
        body: '',
      }
    case 'outside-filter':
      return {
        heading: `${LQ}${outcome.echo}${RQ} is not in the ${filterLabel(filter)} filter.`,
        body: `Clear the ${filterLabel(filter)} filter to see all ${total.toLocaleString('en-US')} demons.`,
      }
  }
}

/** The exact UI-SPEC copy for a filtered browser with zero rows: the filter excludes every demon at this base. */
export function emptyFilterMessage(filter: DemonFilter | null, total: number): StatusMessage {
  return {
    heading: 'No demons match this filter',
    body: `Clear the ${filterLabel(filter)} filter to see all ${total.toLocaleString('en-US')} demons.`,
  }
}
