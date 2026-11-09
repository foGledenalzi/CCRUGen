// The shared fit rule for a zone sound inside a node (Phase 7 plan 07-12, 07-UI-SPEC "Fitting long sounds"). One pure function
// decides the text and the font size, so the SVG tier and both Canvas passes always agree. The figures below are the UI-SPEC's
// worked example (base 10 original layout: R_px 15.2, full size 12.3 px, budget 27.36 px); the sounds are neutral stand-ins with
// the same grapheme counts (no canonical zone sound is quoted in a test). Every non-ASCII character is built from a code point.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { splitGraphemes } from '../../engine/index'
import {
  SOUND_EM_NARROW,
  SOUND_EM_WIDE,
  SOUND_FIT_BUDGET,
  SOUND_MIN_FONT_PX,
  fitSoundLabel,
  isWideGrapheme,
} from '../../app/lib/soundLabels'

const ELLIPSIS = String.fromCodePoint(0x2026)
const COMBINING_ACUTE = String.fromCodePoint(0x301)
const R_PX = 15.2
const FULL_PX = 12.3

/** The estimate the production rule uses, recomputed here from its own named constants: sum of em times the font size. */
function estimatedWidth(text: string, fontPx: number): number {
  return splitGraphemes(text).reduce((sum, g) => sum + (isWideGrapheme(g) ? SOUND_EM_WIDE : SOUND_EM_NARROW), 0) * fontPx
}

describe('the named constants', () => {
  it('are the UI-SPEC figures', () => {
    expect(SOUND_EM_NARROW).toBe(0.62)
    expect(SOUND_EM_WIDE).toBe(1)
    expect(SOUND_FIT_BUDGET).toBe(1.8)
    expect(SOUND_MIN_FONT_PX).toBe(6)
  })
})

describe('fitSoundLabel: the worked example', () => {
  it('a 2-grapheme sound stays at full size', () => {
    expect(fitSoundLabel('ab', R_PX, FULL_PX)).toEqual({ text: 'ab', fontPx: FULL_PX, truncated: false })
  })

  it('a 7-grapheme sound shrinks to about 6.3 px, whole', () => {
    const fit = fitSoundLabel('abcdefg', R_PX, FULL_PX)
    expect(fit.text).toBe('abcdefg')
    expect(fit.truncated).toBe(false)
    expect(Math.abs(fit.fontPx - (SOUND_FIT_BUDGET * R_PX) / (SOUND_EM_NARROW * 7))).toBeLessThan(1e-9)
    expect(Math.abs(fit.fontPx - 6.31)).toBeLessThan(0.5)
  })

  it('a 16-grapheme sound is 6 px, 7 graphemes, the last one the ellipsis', () => {
    const sound = 'abcdefghijklmnop'
    const fit = fitSoundLabel(sound, R_PX, FULL_PX)
    expect(fit.fontPx).toBe(6)
    expect(fit.truncated).toBe(true)
    const kept = splitGraphemes(fit.text)
    expect(kept).toHaveLength(7)
    expect(kept[6]).toBe(ELLIPSIS)
    expect(fit.text).toBe('abcdef' + ELLIPSIS)
  })

  it('the cut starts exactly where the shrunk size would fall below the floor', () => {
    // 7 graphemes shrink to 27.36 / (0.62 x 7) = 6.30 px, which is above the 6 px floor: whole.
    // 8 graphemes would need 27.36 / (0.62 x 8) = 5.52 px, below the floor: cut at 6 px.
    expect(fitSoundLabel('abcdefg', R_PX, FULL_PX).truncated).toBe(false)
    expect(fitSoundLabel('abcdefgh', R_PX, FULL_PX)).toEqual({ text: 'abcdef' + ELLIPSIS, fontPx: 6, truncated: true })
  })
})

describe('fitSoundLabel: small nodes', () => {
  it('at R_px 7 a long sound keeps 3 graphemes, two letters and the ellipsis, at 6 px', () => {
    const fit = fitSoundLabel('abcdefg', 7, 5.7)
    expect(fit.text).toBe('ab' + ELLIPSIS)
    expect(splitGraphemes(fit.text)).toHaveLength(3)
    expect(fit.fontPx).toBe(6)
    expect(fit.truncated).toBe(true)
  })

  it('at R_px 7 a short sound still fits at the layout size', () => {
    expect(fitSoundLabel('ab', 7, 5.7)).toEqual({ text: 'ab', fontPx: 5.7, truncated: false })
  })

  it('below R_px 3.4 only one grapheme fits: that grapheme, no ellipsis, at 6 px', () => {
    const fit = fitSoundLabel('abcdefg', 3, 2.4)
    expect(fit).toEqual({ text: 'a', fontPx: 6, truncated: true })
    expect(fit.text).not.toContain(ELLIPSIS)
  })

  it('a one-grapheme sound is never reported as cut, even when it does not fit', () => {
    const fit = fitSoundLabel('a', 1, 12)
    expect(fit.text).toBe('a')
    expect(fit.fontPx).toBe(6)
    expect(fit.truncated).toBe(false)
  })

  it('an empty sound returns an empty text and never throws', () => {
    expect(fitSoundLabel('', 0, 12)).toEqual({ text: '', fontPx: 12, truncated: false })
  })

  it('a zero or non-finite radius keeps one grapheme', () => {
    expect(fitSoundLabel('abc', 0, 12).text).toBe('a')
    expect(fitSoundLabel('abc', Number.NaN, 12).text).toBe('a')
  })
})

describe('fitSoundLabel: graphemes', () => {
  const marked = ('q' + COMBINING_ACUTE).repeat(16)
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467).repeat(8)
  const cjk = String.fromCodePoint(0x4e00, 0x4e8c, 0x4e09, 0x56db, 0x4e94, 0x516d, 0x4e03, 0x516b, 0x4e5d, 0x5341)

  for (const [name, sound] of [
    ['letters with a combining mark', marked],
    ['a ZWJ family emoji sequence', family],
    ['CJK text', cjk],
  ] as const) {
    it(`never cuts inside a grapheme: ${name}`, () => {
      const all = splitGraphemes(sound)
      const fit = fitSoundLabel(sound, R_PX, FULL_PX)
      expect(fit.truncated).toBe(true)
      const kept = splitGraphemes(fit.text)
      expect(kept[kept.length - 1]).toBe(ELLIPSIS)
      const prefix = kept.slice(0, -1)
      expect(prefix.length).toBeGreaterThan(0)
      // every kept unit is a whole element of the original, in order from the start
      expect(prefix).toEqual(all.slice(0, prefix.length))
    })
  }

  it('a sequence of marked letters counts one grapheme per letter', () => {
    const fit = fitSoundLabel(marked, R_PX, FULL_PX)
    expect(fit.text).toBe(('q' + COMBINING_ACUTE).repeat(6) + ELLIPSIS)
  })
})

describe('isWideGrapheme and wide text', () => {
  it('is true for Han, Hiragana, Hangul and a fullwidth letter, false for Latin', () => {
    expect(isWideGrapheme(String.fromCodePoint(0x4e00))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0x3042))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xac00))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xff21))).toBe(true)
    expect(isWideGrapheme('a')).toBe(false)
    expect(isWideGrapheme(String.fromCodePoint(0xe9))).toBe(false)
  })

  it('covers Katakana, Bopomofo and the fullwidth sign range, and ends at the range edges', () => {
    expect(isWideGrapheme(String.fromCodePoint(0x30a2))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0x3105))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xffe0))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xffe6))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xff01))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xff60))).toBe(true)
    expect(isWideGrapheme(String.fromCodePoint(0xff00))).toBe(false)
    expect(isWideGrapheme(String.fromCodePoint(0xff61))).toBe(false)
    expect(isWideGrapheme(String.fromCodePoint(0xffdf))).toBe(false)
    expect(isWideGrapheme(String.fromCodePoint(0xffe7))).toBe(false)
  })

  it('judges a grapheme by its first code point (a letter with a mark stays narrow)', () => {
    expect(isWideGrapheme('q' + COMBINING_ACUTE)).toBe(false)
    expect(isWideGrapheme(String.fromCodePoint(0x4e00) + COMBINING_ACUTE)).toBe(true)
  })

  it('four ideographs count 1.0 em each: 27.36 / 4 = 6.84 px', () => {
    const sound = String.fromCodePoint(0x4e00, 0x4e8c, 0x4e09, 0x56db)
    const fit = fitSoundLabel(sound, R_PX, FULL_PX)
    expect(fit.text).toBe(sound)
    expect(fit.truncated).toBe(false)
    expect(Math.abs(fit.fontPx - 6.84)).toBeLessThan(1e-9)
  })

  it('two ideographs fit at full size, three do not (3 x 12.3 = 36.9 > 27.36)', () => {
    expect(fitSoundLabel(String.fromCodePoint(0x4e00, 0x4e8c), R_PX, FULL_PX).fontPx).toBe(FULL_PX)
    expect(fitSoundLabel(String.fromCodePoint(0x4e00, 0x4e8c, 0x4e09), R_PX, FULL_PX).fontPx).toBeLessThan(FULL_PX)
  })
})

describe('fitSoundLabel: properties', () => {
  // letters, marks, CJK and an emoji sequence, so the properties exercise both widths and multi-code-point graphemes
  const unit = fc.constantFrom(
    'a', 'b', 'k', 'z', 'q' + COMBINING_ACUTE, String.fromCodePoint(0x4e00), String.fromCodePoint(0xac00),
    String.fromCodePoint(0xff21), String.fromCodePoint(0x1f468, 0x200d, 0x1f469),
  )
  const sounds = fc.array(unit, { maxLength: 24 }).map(parts => parts.join(''))
  const radii = fc.double({ min: 0.5, max: 60, noNaN: true })
  const fullSizes = fc.double({ min: 2, max: 40, noNaN: true })

  it('the estimated width never exceeds 1.8 x R_px, except for one grapheme that has to be kept', () => {
    fc.assert(
      fc.property(sounds, radii, fullSizes, (sound, rPx, fullPx) => {
        const fit = fitSoundLabel(sound, rPx, fullPx)
        const units = splitGraphemes(fit.text).length
        if (units <= 1) return true
        return estimatedWidth(fit.text, fit.fontPx) <= SOUND_FIT_BUDGET * rPx + 1e-9
      }),
      { numRuns: 400 },
    )
  })

  it('the font size is never above the layout size (unless the 6 px floor applies) and never below the floor once shrunk', () => {
    fc.assert(
      fc.property(sounds, radii, fullSizes, (sound, rPx, fullPx) => {
        const fit = fitSoundLabel(sound, rPx, fullPx)
        if (fit.fontPx === fullPx) return true
        return fit.fontPx >= SOUND_MIN_FONT_PX - 1e-9 && fit.fontPx <= Math.max(fullPx, SOUND_MIN_FONT_PX) + 1e-9
      }),
      { numRuns: 400 },
    )
  })

  it('what is kept is always a whole-grapheme prefix, plus an ellipsis only when a cut left more than one grapheme', () => {
    fc.assert(
      fc.property(sounds, radii, fullSizes, (sound, rPx, fullPx) => {
        const fit = fitSoundLabel(sound, rPx, fullPx)
        const all = splitGraphemes(sound)
        const kept = splitGraphemes(fit.text)
        if (!fit.truncated) return fit.text === sound || all.length <= 1
        const body = kept[kept.length - 1] === ELLIPSIS && kept.length > 1 ? kept.slice(0, -1) : kept
        return body.length >= 1 && body.every((g, i) => g === all[i])
      }),
      { numRuns: 400 },
    )
  })
})
