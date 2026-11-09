// The naming's link form (NAM-03, D-13): the URL carries only a preset or a seed, never sounds, locks or overrides.
// `names=ccru` selects the CCRU preset (honoured at base 10 only, D-14); `names=seed:<seed>` selects a generated naming,
// with the lenient companions `nstyle`, `njoin=lh` and `nsmooth=1`, each omitted at its default. `names=seed:` means the
// generator `names-gen@1` forever: a future generator must use a new prefix, or old links would silently change names.
// Parsing is total and needs no numogram, so it is safe at every base, including above the interactive ceiling where a
// seed-only naming is exactly what survives (T-07-02c). Original CCRUG code (MIT, NOTICE section 1).
import {
  DEFAULT_STYLE,
  SEED_MAX_LENGTH,
  isStyleId,
  normalizeSeed,
  type JoinOrder,
  type Smoothing,
  type StyleId,
} from '../../engine/index'

/** The shape of a naming a link can express: the CCRU preset, or a seed with its three generator settings. */
export type NamesLink =
  | { readonly kind: 'ccru' }
  | {
      readonly kind: 'seed'
      readonly seed: string
      readonly style: StyleId
      readonly join: JoinOrder
      readonly smoothing: Smoothing
    }

export const NAMES_PARAM = 'names'
export const NAMES_STYLE_PARAM = 'nstyle'
export const NAMES_JOIN_PARAM = 'njoin'
export const NAMES_SMOOTH_PARAM = 'nsmooth'

/**
 * The longest `names=` value read at all (T-07-07): `seed:` plus the longest seed plus 13 characters of slack for padding. It is
 * checked before any trimming or normalising, so a huge hostile value costs one length comparison.
 */
export const NAMES_PARAM_MAX_LENGTH = SEED_MAX_LENGTH + 13

/** The only base with a CCRU preset (D-14); `names=ccru` is ignored anywhere else. Plan 07-11 asserts it equals the preset's base. */
export const CCRU_LINK_BASE = 10

const SEED_PREFIX = 'seed:'
const CCRU_VALUE = 'ccru'
const JOIN_LO_HI = 'lh'
const SMOOTH_ON = '1'

// Control characters and the line and paragraph separators are refused anywhere in the value, before trimming: String.trim()
// strips U+2028, U+2029 and the common controls at the edges, so a check after it would quietly accept 'seed:a<U+2028>' as 'a'.
const HOSTILE = /[\p{Cc}\p{Zl}\p{Zp}]/u

/**
 * Reads the naming link from `params` for a viewer at `base`, or null when there is none or it is not well formed. Never throws.
 * The raw text is only compared against fixed prefixes and passed to normalizeSeed; it is never used as an object key.
 */
export function parseNamesLink(params: URLSearchParams, base: number): NamesLink | null {
  const raw = params.get(NAMES_PARAM)
  if (raw === null || raw.length > NAMES_PARAM_MAX_LENGTH) return null
  if (HOSTILE.test(raw)) return null
  const t = raw.trim()

  if (t === CCRU_VALUE) return base === CCRU_LINK_BASE ? { kind: 'ccru' } : null

  if (t.startsWith(SEED_PREFIX)) {
    const seed = normalizeSeed(t.slice(SEED_PREFIX.length))
    if (seed === null) return null
    const rawStyle = params.get(NAMES_STYLE_PARAM)
    return {
      kind: 'seed',
      seed,
      style: isStyleId(rawStyle) ? rawStyle : DEFAULT_STYLE,
      join: params.get(NAMES_JOIN_PARAM) === JOIN_LO_HI ? 'lo-hi' : 'hi-lo',
      smoothing: params.get(NAMES_SMOOTH_PARAM) === SMOOTH_ON ? 1 : 0,
    }
  }

  return null
}

/** Writes `link` into `params`: nothing for null, `names=ccru` for the preset, a seed link with each companion only off its default. */
export function writeNamesLink(params: URLSearchParams, link: NamesLink | null): void {
  if (link === null) return
  if (link.kind === 'ccru') {
    params.set(NAMES_PARAM, CCRU_VALUE)
    return
  }
  params.set(NAMES_PARAM, `${SEED_PREFIX}${link.seed}`)
  if (link.style !== DEFAULT_STYLE) params.set(NAMES_STYLE_PARAM, link.style)
  if (link.join === 'lo-hi') params.set(NAMES_JOIN_PARAM, JOIN_LO_HI)
  if (link.smoothing === 1) params.set(NAMES_SMOOTH_PARAM, SMOOTH_ON)
}

/** True when both are no link, or both express the same naming (every field of a seed link counts). */
export function sameNamesLink(a: NamesLink | null, b: NamesLink | null): boolean {
  if (a === null || b === null) return a === b
  if (a.kind === 'ccru') return b.kind === 'ccru'
  if (b.kind === 'ccru') return false
  return a.seed === b.seed && a.style === b.style && a.join === b.join && a.smoothing === b.smoothing
}
