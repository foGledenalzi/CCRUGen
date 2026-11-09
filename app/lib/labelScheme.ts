// Zone label schemes (UI-03, D-08, D-09, D-11, D-13). Labels are display only: the integer zone stays the identity
// in URLs, JSON and demon keys. Original CCRUG code (MIT, NOTICE section 1).
import { formatNumeral } from '../../engine/index'
import {
  type AlphabetPresetId,
  checkAlphabetChars,
  isAlphabetPresetId,
  presetChars,
  splitAlphabet,
  validateAlphabet,
} from './customAlphabet'
import { formatXenotationForDisplay } from './xenotation'

export type LabelScheme =
  | { readonly mode: 'digits' }
  | { readonly mode: 'xeno' }
  // NAM-03 (D-03): the zone node shows the naming's sound. It is a label MODE only: the node label slot reads the naming's
  // sounds separately (plan 07-12); every other zone label stays numeric (UI-SPEC decision 10), so a formatter here
  // returns the digit label for it, and it has no alphabet.
  | { readonly mode: 'sounds' }
  | { readonly mode: 'preset'; readonly preset: AlphabetPresetId }
  | { readonly mode: 'custom'; readonly chars: readonly string[] }

/** The default zone-label style at any base (D-08): the engine's own numeral scheme, never a custom alphabet. */
export const DEFAULT_LABEL_SCHEME: LabelScheme = { mode: 'digits' }

/** The ordered character list a preset/custom scheme labels zones from, or null for digits/xeno/sounds (no alphabet). */
export function schemeAlphabet(s: LabelScheme): readonly string[] | null {
  if (s.mode === 'preset') return presetChars(s.preset)
  if (s.mode === 'custom') return s.chars
  return null
}

/**
 * The label for one zone under scheme, at base. digits: the engine numeral. xeno: the xenotation, falling back to
 * the numeral only when it's empty (zone 0, D-09). sounds: the numeral, exactly like digits (the node label slot reads
 * the naming's sounds separately, plan 07-12; every other label stays numeric, UI-SPEC decision 10). preset/custom: the
 * alphabet character at that zone's index when the alphabet covers the base (D-11), else the numeral fallback (never a
 * wrong label, per validateAlphabet).
 */
export function formatZoneLabel(zone: number, base: number, scheme: LabelScheme): string {
  if (scheme.mode === 'digits' || scheme.mode === 'sounds') return formatNumeral(zone, base)
  if (scheme.mode === 'xeno') return formatXenotationForDisplay(zone) || formatNumeral(zone, base)
  const alphabet = schemeAlphabet(scheme)
  if (alphabet !== null && validateAlphabet(alphabet, base).ok) return alphabet[zone]
  return formatNumeral(zone, base)
}

/** Every zone's label at base, in zone order. Callers use this only for the SVG tier (n <= svgRichMaxN). */
export function zoneLabelsFor(base: number, scheme: LabelScheme): string[] {
  // sounds keeps the digit labels in every slot (the node label slot reads the naming's sounds separately, plan 07-12).
  if (scheme.mode === 'digits' || scheme.mode === 'sounds') {
    const out: string[] = new Array(base)
    for (let z = 0; z < base; z++) out[z] = formatNumeral(z, base)
    return out
  }
  if (scheme.mode === 'xeno') {
    const out: string[] = new Array(base)
    for (let z = 0; z < base; z++) out[z] = formatXenotationForDisplay(z) || formatNumeral(z, base)
    return out
  }
  // preset/custom: check the alphabet's validity for this base once, not once per zone.
  const alphabet = schemeAlphabet(scheme)
  const usable = alphabet !== null && validateAlphabet(alphabet, base).ok
  const out: string[] = new Array(base)
  for (let z = 0; z < base; z++) out[z] = usable && alphabet ? alphabet[z] : formatNumeral(z, base)
  return out
}

/** The labels= URL value for scheme, or null when it's the default (omitted from the URL, D-13). */
export function formatLabelScheme(s: LabelScheme): string | null {
  switch (s.mode) {
    case 'digits':
      return null
    case 'xeno':
      return 'xeno'
    case 'sounds':
      return 'sounds'
    case 'preset':
      return `preset:${s.preset}`
    case 'custom':
      return `custom:${s.chars.join('')}`
  }
}

/**
 * Reads a labels= value back into a LabelScheme. Lenient (D-13): anything missing, empty or invalid falls back to
 * DEFAULT_LABEL_SCHEME rather than throwing — a stale/hostile URL never breaks the page. A custom alphabet is kept
 * as long as checkAlphabetChars accepts it, independent of the current base (validateAlphabet is applied per base
 * at label time, so a valid-but-short alphabet round-trips and simply falls back to numerals until the base fits).
 */
export function parseLabelScheme(raw: string | null | undefined): LabelScheme {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_LABEL_SCHEME
  if (raw === 'xeno') return { mode: 'xeno' }
  if (raw === 'sounds') return { mode: 'sounds' }
  if (raw.startsWith('preset:')) {
    const id = raw.slice('preset:'.length)
    return isAlphabetPresetId(id) ? { mode: 'preset', preset: id } : DEFAULT_LABEL_SCHEME
  }
  if (raw.startsWith('custom:')) {
    const chars = splitAlphabet(raw.slice('custom:'.length))
    return checkAlphabetChars(chars).ok ? { mode: 'custom', chars } : DEFAULT_LABEL_SCHEME
  }
  return DEFAULT_LABEL_SCHEME
}

/** A stable string key for scheme (mode + value), for comparison, memoization and React keys. */
export function labelSchemeKey(s: LabelScheme): string {
  switch (s.mode) {
    case 'digits':
      return 'digits'
    case 'xeno':
      return 'xeno'
    case 'sounds':
      return 'sounds'
    case 'preset':
      return `preset:${s.preset}`
    case 'custom':
      return `custom:${s.chars.join('')}`
  }
}
