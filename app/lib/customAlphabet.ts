// Custom zone-label alphabets (UI-03, D-10..D-12). Original CCRUG code (MIT, NOTICE section 1).
//
// One ordered, reusable character list stands in for the engine's own digit alphabet (D-11): curated presets or a
// free-typed set, validated as typed (D-12) before it ever reaches a label. Every check is typed and never throws,
// so a caller can render the exact UI-SPEC copy from a `reason` alone.

/** The largest free-typed alphabet accepted (T-04-06): bounds URL length and per-character validation/glyph-probe cost. */
export const MAX_ALPHABET = 1024

export const ALPHABET_PRESET_IDS = ['base62', 'base64url', 'ascii', 'latin1'] as const
export type AlphabetPresetId = (typeof ALPHABET_PRESET_IDS)[number]

export const ALPHABET_PRESET_LABELS: Readonly<Record<AlphabetPresetId, string>> = {
  base62: 'Base62',
  base64url: 'Base64 (URL-safe)',
  ascii: 'ASCII Printable',
  latin1: 'Latin-1 Printable',
}

const PRESET_ID_SET = new Set<string>(ALPHABET_PRESET_IDS)

/** Whether v names one of the four curated presets. */
export function isAlphabetPresetId(v: string): v is AlphabetPresetId {
  return PRESET_ID_SET.has(v)
}

function codePointRange(from: number, to: number, skip?: number): string[] {
  const out: string[] = []
  for (let cp = from; cp <= to; cp++) {
    if (cp === skip) continue
    out.push(String.fromCodePoint(cp))
  }
  return out
}

function buildPreset(id: AlphabetPresetId): readonly string[] {
  switch (id) {
    case 'base62':
      return Object.freeze([...codePointRange(0x30, 0x39), ...codePointRange(0x41, 0x5a), ...codePointRange(0x61, 0x7a)])
    case 'base64url':
      return Object.freeze([
        ...codePointRange(0x41, 0x5a),
        ...codePointRange(0x61, 0x7a),
        ...codePointRange(0x30, 0x39),
        '-',
        '_',
      ])
    case 'ascii':
      return Object.freeze(codePointRange(0x21, 0x7e))
    case 'latin1':
      return Object.freeze([...codePointRange(0x21, 0x7e), ...codePointRange(0xa1, 0xff, 0xad)])
  }
}

const PRESET_CACHE = new Map<AlphabetPresetId, readonly string[]>()

/** The characters of a curated preset, in order; memoized (the same frozen array object on every call). */
export function presetChars(id: AlphabetPresetId): readonly string[] {
  let chars = PRESET_CACHE.get(id)
  if (!chars) {
    chars = buildPreset(id)
    PRESET_CACHE.set(id, chars)
  }
  return chars
}

/** Splits text into user-perceived characters: NFC-normalized, one entry per code point (an astral character is one entry). */
export function splitAlphabet(text: string): string[] {
  return Array.from(text.normalize('NFC'))
}

// Control, format (includes bidi overrides U+202A-202E, U+2066-2069, and the zero-width joiner), separator/space,
// combining marks, surrogates, private-use and unassigned code points (T-04-04): characters that either carry no
// glyph of their own or can spoof/hide the characters around them.
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Z}\p{M}\p{Cs}\p{Co}\p{Cn}]/u

export type AlphabetProblem = 'empty' | 'too-long' | 'forbidden' | 'duplicate' | 'too-short'

export type AlphabetCheck =
  | { readonly ok: true; readonly chars: readonly string[] }
  | {
      readonly ok: false
      readonly reason: AlphabetProblem
      readonly message: string
      readonly char?: string
      readonly needed?: number
    }

function codePointHex(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0
  return cp.toString(16).toUpperCase().padStart(4, '0')
}

/** ch itself when it prints as its own glyph, else a 'U+XXXX' description (so a message never echoes a raw bidi/control char, T-04-05). */
export function describeChar(ch: string): string {
  return FORBIDDEN.test(ch) ? `U+${codePointHex(ch)}` : ch
}

function problem(reason: AlphabetProblem, message: string, extra?: { char?: string; needed?: number }): AlphabetCheck {
  return { ok: false, reason, message, ...extra }
}

/**
 * Checks a character list against the UI-SPEC's alphabet rules (D-12): empty, over MAX_ALPHABET, a forbidden
 * character, a duplicate, in that order (T-04-06: the length check runs before any per-character work). Does not
 * check length against a base — see validateAlphabet. Never throws.
 */
export function checkAlphabetChars(chars: readonly string[]): AlphabetCheck {
  if (chars.length === 0) return problem('empty', 'No custom alphabet set')
  if (chars.length > MAX_ALPHABET) return problem('too-long', `Use at most ${MAX_ALPHABET} characters.`)
  for (const ch of chars) {
    if (FORBIDDEN.test(ch)) {
      return problem(
        'forbidden',
        `'${describeChar(ch)}' can't be used — control, spacing and combining characters are not allowed.`,
        { char: ch },
      )
    }
  }
  const seen = new Set<string>()
  for (const ch of chars) {
    if (seen.has(ch)) return problem('duplicate', `'${ch}' repeats — every character must be unique.`, { char: ch })
    seen.add(ch)
  }
  return { ok: true, chars }
}

/** checkAlphabetChars, plus 'too-short' when chars can't cover every digit of base (D-11: one alphabet, any base). */
export function validateAlphabet(chars: readonly string[], base: number): AlphabetCheck {
  const check = checkAlphabetChars(chars)
  if (!check.ok) return check
  if (chars.length < base) {
    const needed = base - chars.length
    return problem('too-short', `Needs ${needed} more character(s) for base ${base}.`, { needed })
  }
  return check
}
