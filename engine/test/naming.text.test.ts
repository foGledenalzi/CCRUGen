// NAM-01 / NAM-02 text rules (D-07, D-08): what a zone sound, a demon name and a seed may contain. The engine returns typed
// reasons only; the words shown to the user belong to the UI (plan 07-11). Every non-ASCII string is built with
// String.fromCodePoint so no invisible or escaped character lives in this source.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NAME_MAX_LENGTH,
  SEED_MAX_LENGTH,
  SOUND_MAX_LENGTH,
  graphemeCount,
  normalizeSeed,
  splitGraphemes,
  toNfc,
  upperFirst,
  validateName,
  validateSound,
} from '../naming/text'

function cp(...codes: number[]): string {
  return String.fromCodePoint(...codes)
}

const ACUTE = cp(0x301)
const E_ACUTE = cp(0xe9)
const ZWNJ = cp(0x200c)
const ZWJ = cp(0x200d)
const LRM = cp(0x200e)
const RLO = cp(0x202e)
const ISOLATE = cp(0x2066)
const SOFT_HYPHEN = cp(0xad)
const BOM = cp(0xfeff)
const NBSP = cp(0xa0)
const IDEOGRAPHIC_SPACE = cp(0x3000)
const LS = cp(0x2028)
const PS = cp(0x2029)
const NUL = cp(0)

const ok = (text: string) => ({ ok: true, text })
const bad = (reason: string) => ({ ok: false, reason })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('limits', () => {
  it('are the three documented constants', () => {
    expect(SOUND_MAX_LENGTH).toBe(16)
    expect(NAME_MAX_LENGTH).toBe(32)
    expect(SEED_MAX_LENGTH).toBe(64)
  })
})

describe('toNfc', () => {
  it('composes e + combining acute', () => {
    expect(toNfc('e' + ACUTE)).toBe(E_ACUTE)
  })
  it('leaves an already composed or plain string alone', () => {
    expect(toNfc(E_ACUTE)).toBe(E_ACUTE)
    expect(toNfc('tnmnm')).toBe('tnmnm')
  })
})

describe('validateSound', () => {
  const devanagari = cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947)
  const thaiTone = cp(0xe21, 0xe49, 0xe32)
  const arabicHarakat = cp(0x628, 0x64e, 0x628, 0x64e)
  const cjk16 = Array.from({ length: 16 }, (_, i) => cp(0x4e00 + i)).join('')
  const cjk17 = cjk16 + cp(0x4e10)
  const astral16 = Array.from({ length: 16 }, (_, i) => cp(0x20000 + i)).join('')
  const astral17 = astral16 + cp(0x20010)
  const marked = (n: number) => ('q' + ACUTE).repeat(n)

  it.each([
    ['plain letters', 'gl', ok('gl')],
    ['trimmed', '  skr ', ok('skr')],
    ['empty', '', bad('empty')],
    ['blank', '   ', bad('empty')],
    ['only tabs and newlines', '\t\n ', bad('empty')],
    ['interior space', 'g l', bad('space')],
    ['interior no-break space', 'g' + NBSP + 'l', bad('space')],
    ['interior ideographic space', 'g' + IDEOGRAPHIC_SPACE + 'l', bad('space')],
    ['interior tab', 'g\tl', bad('space')],
    ['interior byte order mark counts as whitespace', 'g' + BOM + 'l', bad('space')],
    ['digit', 'g1', bad('digit')],
    ['arabic-indic digit', 'g' + cp(0x663), bad('digit')],
    ['hyphen', 'g-l', bad('other')],
    ['apostrophe', "g'l", bad('other')],
    ['zero width non-joiner', 'g' + ZWNJ + 'l', bad('other')],
    ['zero width joiner', 'g' + ZWJ + 'l', bad('other')],
    ['left-to-right mark', 'g' + LRM + 'l', bad('other')],
    ['right-to-left override', RLO + 'gl', bad('other')],
    ['bidi isolate', 'g' + ISOLATE + 'l', bad('other')],
    ['soft hyphen', 'g' + SOFT_HYPHEN + 'l', bad('other')],
    ['tag character', 'g' + cp(0xe0041) + 'l', bad('other')],
    ['control character', 'g' + NUL + 'l', bad('other')],
    ['emoji', cp(0x1f600), bad('other')],
    ['a mark with no base letter', ACUTE + 'a', bad('other')],
    ['a roman numeral is not a letter', cp(0x2160), bad('other')],
    ['a lone surrogate', 'g' + String.fromCharCode(0xd800) + 'l', bad('other')],
    ['space wins over digit', 'g1 l', bad('space')],
    ['digit wins over other', 'g-1', bad('digit')],
    ['space wins over other', 'g- l', bad('space')],
    ['16 ASCII letters', 'a'.repeat(16), ok('a'.repeat(16))],
    ['17 ASCII letters', 'a'.repeat(17), bad('long')],
    ['e plus acute composes', 'e' + ACUTE, ok(E_ACUTE)],
    ['16 graphemes of 2 code units', marked(16), ok(marked(16))],
    ['17 graphemes of 2 code units', marked(17), bad('long')],
    ['16 CJK ideographs', cjk16, ok(cjk16)],
    ['17 CJK ideographs', cjk17, bad('long')],
    ['16 astral ideographs (32 code units)', astral16, ok(astral16)],
    ['17 astral ideographs', astral17, bad('long')],
    ['devanagari with virama and vowel sign', devanagari, ok(devanagari)],
    ['thai with a tone mark', thaiTone, ok(thaiTone)],
    ['arabic with harakat', arabicHarakat, ok(arabicHarakat)],
    ['greek', cp(0x3a9, 0x3bc, 0x3ad, 0x3b3, 0x3b1), ok(cp(0x3a9, 0x3bc, 0x3ad, 0x3b3, 0x3b1))],
  ])('%s', (_label, input, expected) => {
    expect(validateSound(input)).toEqual(expected)
  })

  it('reports the length after normalisation, not before', () => {
    // 16 letters that decompose to 32 code units are still 16 characters once composed
    expect(validateSound('e'.repeat(15) + 'e' + ACUTE)).toEqual(ok('e'.repeat(15) + E_ACUTE))
  })

  it('never throws and always returns a typed result', () => {
    for (const s of ['', ' ', 'a', NUL, RLO, ZWNJ, cp(0x1f600).repeat(500), 'x'.repeat(100000)]) {
      const r = validateSound(s)
      expect(typeof r.ok).toBe('boolean')
      if (!r.ok) expect(['empty', 'space', 'digit', 'other', 'long']).toContain(r.reason)
    }
  })
})

describe('validateName', () => {
  it('uses the same character rule with a limit of 32', () => {
    expect(validateName('Ummnu')).toEqual(ok('Ummnu'))
    expect(validateName('  Ummnu ')).toEqual(ok('Ummnu'))
    expect(validateName('a'.repeat(32))).toEqual(ok('a'.repeat(32)))
    expect(validateName('a'.repeat(33))).toEqual(bad('long'))
    expect(validateName('')).toEqual(bad('empty'))
    expect(validateName('a b')).toEqual(bad('space'))
    expect(validateName('a2')).toEqual(bad('digit'))
    expect(validateName('a' + ZWNJ + 'b')).toEqual(bad('other'))
    expect(validateName(cp(0x4e00).repeat(32))).toEqual(ok(cp(0x4e00).repeat(32)))
    expect(validateName(cp(0x4e00).repeat(33))).toEqual(bad('long'))
  })
  it('accepts a name longer than a sound can be', () => {
    expect(validateSound('a'.repeat(20))).toEqual(bad('long'))
    expect(validateName('a'.repeat(20))).toEqual(ok('a'.repeat(20)))
  })
})

describe('normalizeSeed', () => {
  it.each([
    ['trims', '  abc ', 'abc'],
    ['empty', '', null],
    ['blank', '  ', null],
    ['64 units', 'x'.repeat(64), 'x'.repeat(64)],
    ['65 units', 'x'.repeat(65), null],
    ['NFC', 'e' + ACUTE, E_ACUTE],
    ['interior spaces are allowed', 'seed with spaces', 'seed with spaces'],
    ['a trailing newline is trimmed', 'abc\n', 'abc'],
    ['a NUL control', 'a' + NUL + 'b', null],
    ['an interior newline', 'a\nb', null],
    ['an interior tab', 'a\tb', null],
    ['an interior line separator', 'a' + LS + 'b', null],
    ['an interior paragraph separator', 'a' + PS + 'b', null],
    ['a leading line separator is trimmed like any edge whitespace', LS + 'a', 'a'],
    ['only a line separator', LS, null],
    ['only a paragraph separator', PS, null],
    ['a delete control', 'a' + cp(0x7f), null],
    ['a C1 control', 'a' + cp(0x85) + 'b', null],
    ['CJK and emoji are fine', cp(0x4e2d, 0x6587, 0x1f600), cp(0x4e2d, 0x6587, 0x1f600)],
    ['hyphens and punctuation are fine', 'hollow-vector', 'hollow-vector'],
  ])('%s', (_label, input, expected) => {
    expect(normalizeSeed(input)).toBe(expected)
  })

  it('counts UTF-16 units after normalisation (a surrogate pair is two)', () => {
    expect(normalizeSeed(cp(0x1f600).repeat(32))).toBe(cp(0x1f600).repeat(32))
    expect(normalizeSeed(cp(0x1f600).repeat(33))).toBeNull()
    // 64 decomposed pairs compose to 64 units, so they fit; the 65th does not
    expect(normalizeSeed(('e' + ACUTE).repeat(64))).toBe(E_ACUTE.repeat(64))
    expect(normalizeSeed(('e' + ACUTE).repeat(65))).toBeNull()
  })

  it('is idempotent on its own output', () => {
    for (const s of ['  abc ', 'e' + ACUTE, 'hollow-vector', LS + 'a']) {
      const once = normalizeSeed(s)
      expect(once).not.toBeNull()
      expect(normalizeSeed(once as string)).toBe(once)
    }
  })
})

describe('upperFirst', () => {
  it('capitalises the first letter', () => {
    expect(upperFirst('tnmnm')).toBe('Tnmnm')
    expect(upperFirst('Ummnu')).toBe('Ummnu')
    expect(upperFirst('')).toBe('')
    expect(upperFirst('x')).toBe('X')
  })
  it('follows the built-in mapping for sharp s (becomes SS) and for astral letters', () => {
    expect(upperFirst(cp(0xdf) + 'a')).toBe('SSa')
    expect(upperFirst(cp(0x10428) + 'ab')).toBe(cp(0x10400) + 'ab')
  })
  it('is independent of the runtime locale (dotless and dotted i)', () => {
    expect(upperFirst('i')).toBe('I')
    expect(upperFirst(cp(0x131))).toBe('I')
  })
  it('leaves scripts without case alone', () => {
    const cjk = cp(0x4e00, 0x4e01)
    expect(upperFirst(cjk)).toBe(cjk)
  })
})

describe('splitGraphemes / graphemeCount', () => {
  const samples: ReadonlyArray<readonly [string, string]> = [
    ['ASCII', 'tnmnm'],
    ['CJK', cp(0x4e00, 0x4e01, 0x4e02)],
    ['combining marks', 'q' + ACUTE + 'x' + cp(0x308) + 'z'],
    ['empty', ''],
  ]

  it.each(samples)('splits %s into whole characters', (_label, text) => {
    const parts = splitGraphemes(text)
    expect(parts.join('')).toBe(toNfc(text))
    expect(graphemeCount(text)).toBe(parts.length)
  })

  it('keeps a base letter and its combining marks together', () => {
    expect(splitGraphemes('q' + ACUTE + 'x')).toEqual(['q' + ACUTE, 'x'])
    expect(graphemeCount('q' + ACUTE + 'x')).toBe(2)
  })

  it('normalises to NFC before splitting', () => {
    expect(splitGraphemes('e' + ACUTE)).toEqual([E_ACUTE])
  })

  it('falls back to a mark-aware regex when Intl.Segmenter is missing, with the same split', () => {
    const withSegmenter = samples.map(([, t]) => splitGraphemes(t))
    vi.stubGlobal('Intl', Object.assign(Object.create(Intl), { Segmenter: undefined }))
    expect(typeof (globalThis as { Intl: { Segmenter?: unknown } }).Intl.Segmenter).toBe('undefined')
    const without = samples.map(([, t]) => splitGraphemes(t))
    expect(without).toEqual(withSegmenter)
    expect(graphemeCount('q' + ACUTE + 'x')).toBe(2)
  })

  it('does not drop a leading mark in the fallback', () => {
    vi.stubGlobal('Intl', Object.assign(Object.create(Intl), { Segmenter: undefined }))
    expect(splitGraphemes(ACUTE + 'a').join('')).toBe(ACUTE + 'a')
  })

  it('uses Intl.Segmenter only for strings longer than the limit in UTF-16 units', async () => {
    let calls = 0
    class Counting extends Intl.Segmenter {
      override segment(input: string): Intl.Segments {
        calls++
        return super.segment(input)
      }
    }
    vi.stubGlobal('Intl', Object.assign(Object.create(Intl), { Segmenter: Counting }))
    vi.resetModules()
    const fresh = await import('../naming/text')

    // short strings never reach the Segmenter, in any script, however many are checked
    for (let i = 0; i < 4000; i++) fresh.validateSound('tn')
    fresh.validateSound(cp(0x4e00).repeat(16))
    fresh.validateSound('a'.repeat(16))
    fresh.validateName('a'.repeat(32))
    expect(calls).toBe(0)

    // longer than the limit in code units: one segmentation, and the grapheme count decides
    expect(fresh.validateSound('a'.repeat(17))).toEqual({ ok: false, reason: 'long' })
    expect(calls).toBe(1)
    expect(fresh.validateSound(('q' + ACUTE).repeat(16)).ok).toBe(true)
    expect(calls).toBe(2)
    // rejected for another reason first: no segmentation at all
    fresh.validateSound('g-' + 'a'.repeat(30))
    expect(calls).toBe(2)
  })
})
