// The one fit rule for a zone sound drawn inside a node (Phase 7 plan 07-12, 07-UI-SPEC "Fitting long sounds"). Original CCRUG code (MIT, NOTICE section 1).
//
// Shared by both render tiers and both Canvas passes (the static node pass and the highlight overlay), so a highlighted label never
// ghosts over the static one: every caller hands the same sound, the node radius and the layout label size in on-screen px and
// draws exactly the text and size that come back. Pure: no DOM, no clock, no global. The width is an ESTIMATE (an em per grapheme
// of the generic monospace family), never a measurement, so the result is the same on every machine and in every test.
//
// The rule, in order: the sound fits at the layout's own size when its estimated width is within 90% of the node diameter
// (1.8 x R_px); otherwise it shrinks to the size that does fit, but never below 6 px (the project's smallest legible text);
// below that it is cut at a grapheme boundary and ends in an ellipsis; when not even two graphemes fit, one grapheme is kept
// without an ellipsis. Text is never cut inside a grapheme.
import { splitGraphemes } from '../../engine/index'

/** Width of one grapheme in em: conservative for the generic monospace family. */
export const SOUND_EM_NARROW = 0.62
/** Width of one East Asian wide or fullwidth grapheme in em. */
export const SOUND_EM_WIDE = 1.0
/** The share of the node diameter a sound may fill: 1.8 x R_px is 90% of 2 x R_px. */
export const SOUND_FIT_BUDGET = 1.8
/** The smallest font size, in CSS px, a sound is shrunk to before it is cut (the project's smallest legible text). */
export const SOUND_MIN_FONT_PX = 6

// U+2026 HORIZONTAL ELLIPSIS, built from its code point (never a typed character).
const ELLIPSIS = String.fromCodePoint(0x2026)

// Scripts written with wide glyphs, tested on a grapheme's first code point.
const WIDE_SCRIPT = /^[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}\p{sc=Bopomofo}]/u
// Fullwidth forms: U+FF01..U+FF60 (letters, digits and punctuation) and U+FFE0..U+FFE6 (signs).
const FULLWIDTH_FORMS_FIRST = 0xff01
const FULLWIDTH_FORMS_LAST = 0xff60
const FULLWIDTH_SIGNS_FIRST = 0xffe0
const FULLWIDTH_SIGNS_LAST = 0xffe6

/** True when the grapheme is an East Asian wide or fullwidth one, judged by its first code point. */
export function isWideGrapheme(g: string): boolean {
  const cp = g.codePointAt(0)
  if (cp === undefined) return false
  if (WIDE_SCRIPT.test(g)) return true
  if (cp >= FULLWIDTH_FORMS_FIRST && cp <= FULLWIDTH_FORMS_LAST) return true
  return cp >= FULLWIDTH_SIGNS_FIRST && cp <= FULLWIDTH_SIGNS_LAST
}

/** What to draw for one sound: the text, the font size in px and whether the text is shorter than the sound. */
export interface SoundFit {
  readonly text: string
  readonly fontPx: number
  /** True only when graphemes were left out; a one-grapheme sound is never reported as cut. */
  readonly truncated: boolean
}

const emOf = (g: string): number => (isWideGrapheme(g) ? SOUND_EM_WIDE : SOUND_EM_NARROW)

/**
 * The text and font size to draw `sound` at inside a node whose on-screen radius is `rPx`, when the layout's own label size is
 * `fullPx` (both in CSS px). The caller converts the returned `fontPx` to its own units (the SVG tier divides by px per unit).
 */
export function fitSoundLabel(sound: string, rPx: number, fullPx: number): SoundFit {
  const graphemes = splitGraphemes(sound)
  if (graphemes.length === 0) return { text: sound, fontPx: fullPx, truncated: false }

  const widths = graphemes.map(emOf)
  const em = widths.reduce((sum, w) => sum + w, 0)
  const budget = SOUND_FIT_BUDGET * rPx

  if (em * fullPx <= budget) return { text: sound, fontPx: fullPx, truncated: false }

  const shrunk = budget / em
  if (shrunk >= SOUND_MIN_FONT_PX) return { text: sound, fontPx: shrunk, truncated: false }

  // Cut at the floor size: the longest whole-grapheme prefix that still leaves room for the ellipsis.
  let used = SOUND_EM_NARROW
  let kept = 0
  for (const w of widths) {
    // written as "does not fit" so a NaN radius keeps nothing, like a zero radius
    if (!((used + w) * SOUND_MIN_FONT_PX <= budget)) break
    used += w
    kept += 1
  }
  // Not even one grapheme and the ellipsis fit: keep the first grapheme alone, with no ellipsis.
  if (kept < 1) return { text: graphemes[0], fontPx: SOUND_MIN_FONT_PX, truncated: graphemes.length > 1 }
  return { text: graphemes.slice(0, kept).join('') + ELLIPSIS, fontPx: SOUND_MIN_FONT_PX, truncated: true }
}
