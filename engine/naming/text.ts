// Text rules for names (D-07, D-08): the one place that decides what a zone sound, a demon name and a seed may contain.
// Every string that reaches the naming model (typed, pasted, imported or read from a URL) passes through these functions,
// so they never throw and report a typed reason; the words shown to the user belong to the UI.
//
// A sound (or a name) is valid when, after NFC and trimming, it is 1..max user-perceived characters of letters of any script
// plus their combining marks: ^\p{L}[\p{L}\p{M}]*$. The marks matter: a bare \p{L}+ would refuse Devanagari, Thai and Arabic
// with vowel signs. Format characters (Persian ZWNJ, joiners, bidi overrides and isolates, the soft hyphen, tag characters)
// are neither letters nor marks, so they are refused as 'other'; that is deliberate, it keeps spoofing text out of the table.
//
// Reasons are reported in this order, first failure wins: empty, space (any whitespace inside), digit (any decimal digit),
// other (anything else that is not a letter or mark, or a string that starts with a mark), long.
//
// Length counts graphemes, but a string whose UTF-16 length is within the limit has at most that many graphemes, so the
// grapheme segmenter (about 9 microseconds a string) runs only for the rare string that is longer than the limit in code
// units. Every regex below is an anchored character class over a string the caller already bounds.

export const SOUND_MAX_LENGTH = 16
export const NAME_MAX_LENGTH = 32
export const SEED_MAX_LENGTH = 64

export type TextProblem = 'empty' | 'space' | 'digit' | 'other' | 'long'

export type TextCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: TextProblem }

const WHITESPACE = /\s/u
const DECIMAL_DIGIT = /\p{Nd}/u
const LETTERS_AND_MARKS = /^\p{L}[\p{L}\p{M}]*$/u
const SEED_FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u
// The fallback when Intl.Segmenter is missing: a base character with its combining marks, or a run of leading marks (so
// nothing is dropped). A Devanagari conjunct counts as more than one character here, which errs on the safe side.
const MARK_CLUSTER = /\P{M}\p{M}*|\p{M}+/gu

/** s in Unicode normal form C, so visually equal text compares equal. */
export function toNfc(s: string): string {
  return s.normalize('NFC')
}

// One lazily created segmenter for the whole module (construction is the expensive part).
let segmenter: Intl.Segmenter | undefined

function graphemeSegmenter(): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null
  if (segmenter === undefined) segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return segmenter
}

/** The user-perceived characters of s (after NFC): by Intl.Segmenter when the runtime has it, else by base letter plus marks. */
export function splitGraphemes(s: string): string[] {
  const text = toNfc(s)
  const seg = graphemeSegmenter()
  if (seg !== null) return Array.from(seg.segment(text), part => part.segment)
  return text.match(MARK_CLUSTER) ?? []
}

/** How many user-perceived characters s has (after NFC). */
export function graphemeCount(s: string): number {
  return splitGraphemes(s).length
}

function checkLetters(raw: string, max: number): TextCheck {
  const t = toNfc(raw).trim()
  if (t.length === 0) return { ok: false, reason: 'empty' }
  if (WHITESPACE.test(t)) return { ok: false, reason: 'space' }
  if (DECIMAL_DIGIT.test(t)) return { ok: false, reason: 'digit' }
  if (!LETTERS_AND_MARKS.test(t)) return { ok: false, reason: 'other' }
  if (t.length > max && graphemeCount(t) > max) return { ok: false, reason: 'long' }
  return { ok: true, text: t }
}

/** A zone sound: 1..SOUND_MAX_LENGTH letters (with their marks) of any script. Returns the NFC, trimmed text or the first reason it fails. */
export function validateSound(raw: string): TextCheck {
  return checkLetters(raw, SOUND_MAX_LENGTH)
}

/** A demon name (an override): the sound rule with NAME_MAX_LENGTH. */
export function validateName(raw: string): TextCheck {
  return checkLetters(raw, NAME_MAX_LENGTH)
}

/**
 * A seed: NFC and trimmed, 1..SEED_MAX_LENGTH UTF-16 units (no segmenter on the URL path), with no control, line-separator or
 * paragraph-separator character inside. Spaces and punctuation are fine. Returns null for anything else.
 */
export function normalizeSeed(raw: string): string | null {
  const t = toNfc(raw).trim()
  if (t.length < 1 || t.length > SEED_MAX_LENGTH) return null
  if (SEED_FORBIDDEN.test(t)) return null
  return t
}

/** s with its first character in upper case (D-08). Locale-independent; follows the built-in mapping, so a sharp s becomes SS. */
export function upperFirst(s: string): string {
  if (s.length === 0) return ''
  const first = String.fromCodePoint(s.codePointAt(0) as number)
  return first.toUpperCase() + s.slice(first.length)
}
