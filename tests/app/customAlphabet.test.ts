// Tests for app/lib/customAlphabet.ts (UI-03, D-10..D-12). Behaviour pinned from 04-02-PLAN.md and the UI-SPEC
// Copywriting Contract; messages here are asserted verbatim, including the em dash.
import { describe, expect, it } from 'vitest'
import {
  ALPHABET_PRESET_IDS,
  ALPHABET_PRESET_LABELS,
  MAX_ALPHABET,
  checkAlphabetChars,
  describeChar,
  isAlphabetPresetId,
  presetChars,
  splitAlphabet,
  validateAlphabet,
} from '../../app/lib/customAlphabet'

describe('presets', () => {
  it('MAX_ALPHABET is 1024', () => {
    expect(MAX_ALPHABET).toBe(1024)
  })

  it('base62 is digits then uppercase then lowercase, 62 characters', () => {
    const chars = presetChars('base62')
    expect(chars).toHaveLength(62)
    expect(chars[10]).toBe('A')
    expect(chars[36]).toBe('a')
    expect(chars[61]).toBe('z')
  })

  it('base64url is the RFC 4648 URL-safe alphabet, 64 characters', () => {
    const chars = presetChars('base64url')
    expect(chars).toHaveLength(64)
    expect(chars[0]).toBe('A')
    expect(chars[62]).toBe('-')
    expect(chars[63]).toBe('_')
  })

  it('ascii is the 94 visible non-space ASCII codepoints', () => {
    const chars = presetChars('ascii')
    expect(chars).toHaveLength(94)
    expect(chars[0]).toBe('!')
    expect(chars[93]).toBe('~')
  })

  it('latin1 extends ascii with the Latin-1 Supplement, skipping the soft hyphen', () => {
    const chars = presetChars('latin1')
    expect(chars).toHaveLength(188)
    expect(chars[94]).toBe(String.fromCodePoint(0xa1))
    expect(chars).not.toContain(String.fromCodePoint(0xad))
    expect(chars[187]).toBe(String.fromCodePoint(0xff))
  })

  it('returns the same array object on repeated calls', () => {
    expect(presetChars('base62')).toBe(presetChars('base62'))
    expect(presetChars('latin1')).toBe(presetChars('latin1'))
  })

  it('every preset passes checkAlphabetChars', () => {
    for (const id of ALPHABET_PRESET_IDS) {
      expect(checkAlphabetChars(presetChars(id)).ok).toBe(true)
    }
  })

  it('isAlphabetPresetId recognizes only the four curated ids', () => {
    for (const id of ALPHABET_PRESET_IDS) expect(isAlphabetPresetId(id)).toBe(true)
    expect(isAlphabetPresetId('nope')).toBe(false)
    expect(isAlphabetPresetId('')).toBe(false)
  })

  it('has a human label for every preset id', () => {
    for (const id of ALPHABET_PRESET_IDS) expect(typeof ALPHABET_PRESET_LABELS[id]).toBe('string')
  })
})

describe('splitAlphabet', () => {
  it('NFC-normalizes a combining sequence into one character', () => {
    const text = 'e' + String.fromCodePoint(0x0301)
    expect(splitAlphabet(text)).toEqual(['é'])
  })

  it('counts an astral emoji as one character', () => {
    const emoji = String.fromCodePoint(0x1f600)
    expect(splitAlphabet(emoji)).toEqual([emoji])
    expect(splitAlphabet(emoji)).toHaveLength(1)
  })
})

describe('checkAlphabetChars', () => {
  it('reports empty for an empty list', () => {
    expect(checkAlphabetChars([])).toEqual({ ok: false, reason: 'empty', message: 'No custom alphabet set' })
  })

  it('reports too-long at 1025 distinct characters, before any per-character check', () => {
    const chars = Array.from({ length: 1025 }, (_, i) => String.fromCodePoint(0x3400 + i))
    expect(checkAlphabetChars(chars)).toEqual({
      ok: false,
      reason: 'too-long',
      message: 'Use at most 1024 characters.',
    })
  })

  it('accepts exactly MAX_ALPHABET distinct characters', () => {
    const chars = Array.from({ length: MAX_ALPHABET }, (_, i) => String.fromCodePoint(0x3400 + i))
    expect(checkAlphabetChars(chars).ok).toBe(true)
  })

  const forbiddenCases: Array<[string, string]> = [
    ['bidi override U+202E', String.fromCodePoint(0x202e)],
    ['null control U+0000', String.fromCodePoint(0x0000)],
    ['space', ' '],
    ['lone combining mark U+0301', String.fromCodePoint(0x0301)],
    ['private use U+E000', String.fromCodePoint(0xe000)],
    ['zero width joiner U+200D', String.fromCodePoint(0x200d)],
  ]

  it.each(forbiddenCases)('reports forbidden for %s', (_label, ch) => {
    const check = checkAlphabetChars(['a', ch, 'b'])
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.reason).toBe('forbidden')
      expect(check.char).toBe(ch)
    }
  })

  it('reports the first duplicate, by character', () => {
    expect(checkAlphabetChars(['a', 'b', 'c', 'a'])).toEqual({
      ok: false,
      reason: 'duplicate',
      char: 'a',
      message: "'a' repeats — every character must be unique.",
    })
  })

  it('accepts a valid alphabet', () => {
    expect(checkAlphabetChars(['a', 'b', 'c'])).toEqual({ ok: true, chars: ['a', 'b', 'c'] })
  })
})

describe('validateAlphabet', () => {
  it('reports too-short with the exact needed count and message', () => {
    const chars = Array.from({ length: 10 }, (_, i) => String.fromCharCode(97 + i))
    expect(validateAlphabet(chars, 16)).toEqual({
      ok: false,
      reason: 'too-short',
      needed: 6,
      message: 'Needs 6 more character(s) for base 16.',
    })
  })

  it('accepts an alphabet at least as long as the base', () => {
    const chars = Array.from({ length: 16 }, (_, i) => String.fromCharCode(97 + i))
    expect(validateAlphabet(chars, 16).ok).toBe(true)
  })

  it('still reports duplicate before checking length', () => {
    const check = validateAlphabet(['a', 'a'], 16)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toBe('duplicate')
  })
})

describe('describeChar', () => {
  it('returns a printable character unchanged', () => {
    expect(describeChar('a')).toBe('a')
    expect(describeChar('!')).toBe('!')
  })

  it('returns U+XXXX (uppercase hex, 4+ digits) for forbidden or invisible characters', () => {
    expect(describeChar(String.fromCodePoint(0x202e))).toBe('U+202E')
    expect(describeChar(String.fromCodePoint(0x0000))).toBe('U+0000')
    expect(describeChar(String.fromCodePoint(0xe000))).toBe('U+E000')
    expect(describeChar(' ')).toBe('U+0020')
  })
})
