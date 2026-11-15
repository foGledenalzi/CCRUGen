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
// units, and even then it stops at the first grapheme past the limit (WR-01: a hostile file can make that string huge). Every
// regex below is an anchored character class, linear in the string a caller has already capped (the import size cap).

export const SOUND_MAX_LENGTH = 16
export const NAME_MAX_LENGTH = 32
export const SEED_MAX_LENGTH = 64

export type TextProblem = 'empty' | 'space' | 'digit' | 'other' | 'long'

export type TextCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: TextProblem }

const WHITESPACE = /\s/u
const DECIMAL_DIGIT = /\p{Nd}/u
const LETTERS_AND_MARKS = /^\p{L}[\p{L}\p{M}]*$/u
// A seed may hold spaces, punctuation and any script, but never: a control, a line or paragraph separator, a lone surrogate (a
// share link writes it as U+FFFD, so the recipient would get a different seed, WR-02), or a bidi control (it reorders the text
// around the seed wherever it is echoed, WR-03: the Arabic letter mark, LRM and RLM, the embeddings and overrides U+202A to
// U+202E, and the isolates U+2066 to U+2069). ZWNJ and ZWJ stay legal: Persian and Indic seeds need them.
const SEED_FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}\p{Cs}\u{61C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/u
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

/**
 * Whether s (already NFC) has more than max user-perceived characters. Unlike graphemeCount it stops at the first character past
 * the limit, so a hostile 8-million-letter string costs max+1 steps instead of one object per character (review WR-01).
 */
function exceedsGraphemes(s: string, max: number): boolean {
  let n = 0
  const seg = graphemeSegmenter()
  if (seg !== null) {
    const parts = seg.segment(s)[Symbol.iterator]()
    while (parts.next().done !== true) if (++n > max) return true
    return false
  }
  const clusters = new RegExp(MARK_CLUSTER.source, 'gu') // a fresh global regex: its lastIndex is its own
  while (clusters.exec(s) !== null) if (++n > max) return true
  return false
}

function checkLetters(raw: string, max: number): TextCheck {
  const t = toNfc(raw).trim()
  if (t.length === 0) return { ok: false, reason: 'empty' }
  if (WHITESPACE.test(t)) return { ok: false, reason: 'space' }
  if (DECIMAL_DIGIT.test(t)) return { ok: false, reason: 'digit' }
  if (!LETTERS_AND_MARKS.test(t)) return { ok: false, reason: 'other' }
  if (t.length > max && exceedsGraphemes(t, max)) return { ok: false, reason: 'long' }
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
 * A seed: NFC and trimmed, 1..SEED_MAX_LENGTH UTF-16 units (no segmenter on the URL path), with no control, line-separator,
 * paragraph-separator, lone-surrogate or bidi-control character inside. Spaces and punctuation are fine. Returns null for anything else.
 */
export function normalizeSeed(raw: string): string | null {
  const t = toNfc(raw).trim()
  if (t.length < 1 || t.length > SEED_MAX_LENGTH) return null
  if (SEED_FORBIDDEN.test(t)) return null
  return t
}

// Characters that must never reach a status sentence as they are (review WR-03): controls, format characters (the bidi overrides,
// embeddings and isolates among them), line and paragraph separators, and lone surrogates. ZWNJ and ZWJ are format characters
// too, but they neither reorder nor hide text and Persian and Indic text needs them, so they pass.
const UNSAFE_ECHO = /(?![\u{200C}\u{200D}])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/gu

/**
 * s with each control, format, line-separator, paragraph-separator and lone-surrogate character replaced by U+FFFD (ZWNJ and ZWJ
 * are kept). For text a file or a visitor supplied that is echoed inside a sentence: call it after clipping, so it only ever sees a
 * short string. React escapes markup; this stops a right-to-left override from reordering the words around it.
 */
export function safeEcho(s: string): string {
  return s.replace(UNSAFE_ECHO, '\u{FFFD}')
}

/** s with its first character in upper case (D-08). Locale-independent; follows the built-in mapping, so a sharp s becomes SS. */
export function upperFirst(s: string): string {
  if (s.length === 0) return ''
  const first = String.fromCodePoint(s.codePointAt(0) as number)
  return first.toUpperCase() + s.slice(first.length)
}
