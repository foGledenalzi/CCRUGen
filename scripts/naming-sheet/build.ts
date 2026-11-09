// The naming style contact sheet (plan 07-06, orchestrator decision 1, NAM-01 / D-04): a pure, deterministic HTML string
// builder with no file I/O, no clock and no randomness. For each of the three syllable styles and two fixed seeds it shows the
// generator's zone sounds and the derived demon names at bases 10, 28, 64, 666 and 4000, each name raw and smoothed
// (euphony@1) side by side, with a few shape statistics and lazy samples far above any table, so the user can judge the LOOK
// of the harsh, soft and syllabic banks before any digest of a sound table is pinned. The CLI wrapper that writes this to
// disk is ../naming-sheet.ts (output under the gitignored /.review/).
//
// Trust boundary (T-07-12b): every string that reaches the page goes through esc() below or is one of this file's own
// literals; nothing embeds a network reference or a script, and no canonical demon name is read or shown (the sounds come
// only from the generator, the names only from joining them).
//
// Imports are by relative path to the naming modules (not through engine/index.ts), so the sheet does not depend on the barrel.

import { netSpanOf } from '../../engine/core/demons'
import { SYLLABLE_BANKS, STYLE_IDS } from '../../engine/naming/banks'
import type { StyleId } from '../../engine/naming/banks'
import { smoothName, smoothingInert } from '../../engine/naming/euphony'
import { DEFAULT_SEED, GENERATOR_MAX_DEPTH, createGenerator, generateSounds } from '../../engine/naming/generate'
import type { SoundGenerator } from '../../engine/naming/generate'
import { upperFirst } from '../../engine/naming/text'

/** The bases the sheet shows (07-VALIDATION manual row 1): the CCRU base, a Warp base, a packer base and two tier extremes. */
export const NAMING_SHEET_BASES = [10, 28, 64, 666, 4000] as const

/** The default seed and a second fixed one, so the user sees that a seed changes the sounds and not the look. */
export const NAMING_SHEET_SEEDS: readonly string[] = [DEFAULT_SEED, 'hollow-vector']

/** Zones far above any table, rendered through the lazy generator (D-11). */
export const LAZY_SAMPLE_ZONES = [65535, 1048576, 67108863] as const

const GRID_MAX = 64 // a base shows at most this many leading zones
const SPREAD_ZONES = 16 // evenly spaced zones for the two large bases
const LAST_ZONES = 4 // and the last few
const NAMES_LOW = 12 // the lowest mesh numbers
const NAMES_SPREAD = 12 // evenly spaced meshes above them
const NAME_STAT_SAMPLE = 400 // names behind the statistics (research Appendix A used 400)

const NOTE =
  'Draft banks (07-RESEARCH Appendix A), harsh bank revised once after review (07-06): it no longer contains the verbatim CCRU zone sounds. ' +
  "This is the generator's inventory, not the CCRU zone table."

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isVowelLetter(ch: string): boolean {
  return 'aeiouy'.includes(ch.toLowerCase())
}

function vowelCount(s: string): number {
  let n = 0
  for (const ch of s) if (isVowelLetter(ch)) n++
  return n
}

/** True when two equal letters are adjacent (case-insensitive). */
function hasDoubledLetter(s: string): boolean {
  return /(.)\1/i.test(s)
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : ((100 * part) / whole).toFixed(1) + '%'
}

/** `count` whole numbers spread evenly over [first, last], first and last included (all of them when the range is small). */
function spread(first: number, last: number, count: number): number[] {
  const span = last - first
  if (span + 1 <= count) {
    const all: number[] = []
    for (let v = first; v <= last; v++) all.push(v)
    return all
  }
  const out: number[] = []
  for (let k = 0; k < count; k++) out.push(first + Math.floor((k * span) / (count - 1)))
  return out
}

/** Marks the letters smoothing inserted (insert-only pass, greedy left-to-right match; cosmetic if a vowel repeats). */
function markInserted(raw: string, smooth: string): string {
  let i = 0
  let html = ''
  for (const ch of smooth) {
    if (i < raw.length && raw.charAt(i).toLowerCase() === ch.toLowerCase()) {
      html += esc(ch)
      i++
    } else {
      html += '<b>' + esc(ch) + '</b>'
    }
  }
  return i === raw.length ? html : esc(smooth) // not insert-only (cannot happen): show it plain
}

interface NamePair {
  readonly mesh: number
  readonly a: number
  readonly b: number
  readonly raw: string
  readonly smooth: string
}

/** The demon with mesh number m: the join of the higher zone's sound then the lower's, raw and smoothed, first letter upper case. */
function nameOf(sounds: readonly string[], mesh: number): NamePair {
  const [a, b] = netSpanOf(mesh)
  const joined = (sounds[a] ?? '') + (sounds[b] ?? '')
  return { mesh, a, b, raw: upperFirst(joined), smooth: upperFirst(smoothName(joined)) }
}

function zoneGrid(sounds: readonly string[], zones: readonly number[]): string {
  const cells = zones.map(z => '<span class="z"><i>' + z + '</i>' + esc(sounds[z] ?? '') + '</span>')
  return '<div class="grid">' + cells.join('') + '</div>'
}

function statsTable(sounds: readonly string[], base: number): string {
  let min = Infinity
  let max = 0
  let total = 0
  let doubled = 0
  for (const s of sounds) {
    if (s.length < min) min = s.length
    if (s.length > max) max = s.length
    total += s.length
    if (hasDoubledLetter(s)) doubled++
  }

  const demonCount = (base * (base - 1)) / 2
  const sample = spread(0, demonCount - 1, NAME_STAT_SAMPLE).map(m => nameOf(sounds, m))
  const shape = (pick: (p: NamePair) => string): { mean: string; vowels: string; doubled: string } => {
    let letters = 0
    let vowels = 0
    let withDouble = 0
    for (const p of sample) {
      const name = pick(p)
      letters += name.length
      vowels += vowelCount(name)
      if (hasDoubledLetter(name)) withDouble++
    }
    return {
      mean: (letters / sample.length).toFixed(2),
      vowels: pct(vowels, letters),
      doubled: pct(withDouble, sample.length),
    }
  }
  const raw = shape(p => p.raw)
  const smooth = shape(p => p.smooth)
  const inert = smoothingInert(sounds)

  const row = (label: string, value: string): string => '<tr><th>' + esc(label) + '</th><td>' + esc(value) + '</td></tr>'
  return (
    '<table class="stats"><tbody>' +
    row('sound length min / mean / max', `${min} / ${(total / sounds.length).toFixed(2)} / ${max}`) +
    row('sounds with a doubled letter', pct(doubled, sounds.length)) +
    row(`names sampled (of ${demonCount})`, String(sample.length)) +
    row('raw names: mean length', raw.mean) +
    row('raw names: vowel density', raw.vowels) +
    row('raw names: with a doubled letter', raw.doubled) +
    row('smoothed names: mean length', smooth.mean) +
    row('smoothed names: vowel density', smooth.vowels) +
    row('smoothed names: with a doubled letter', smooth.doubled) +
    row('smoothing inert for this table', inert ? 'yes (smoothing changes no join)' : 'no (smoothing can change joins)') +
    '</tbody></table>'
  )
}

function namesTable(sounds: readonly string[], base: number): string {
  const demonCount = (base * (base - 1)) / 2
  const meshes: number[] = []
  for (let m = 0; m < NAMES_LOW; m++) meshes.push(m)
  for (let k = 0; k < NAMES_SPREAD; k++) {
    meshes.push(NAMES_LOW + Math.floor((k * (demonCount - 1 - NAMES_LOW)) / (NAMES_SPREAD - 1)))
  }
  const rows = meshes.map(m => {
    const p = nameOf(sounds, m)
    return (
      '<tr><td class="dim">' +
      p.mesh +
      '</td><td class="dim">' +
      p.a +
      '::' +
      p.b +
      '</td><td>' +
      esc(p.raw) +
      '</td><td>' +
      markInserted(p.raw, p.smooth) +
      '</td></tr>'
    )
  })
  return (
    '<table class="names"><thead><tr><th>mesh</th><th>zones</th><th>raw (hi-lo)</th><th>smoothed</th></tr></thead><tbody>' +
    rows.join('') +
    '</tbody></table>'
  )
}

function baseBlock(gen: SoundGenerator, base: number): string {
  const sounds = generateSounds(gen, base)
  const firstZones = spread(0, Math.min(base, GRID_MAX) - 1, GRID_MAX)
  let parts =
    '<h3>Base ' +
    base +
    ': ' +
    base +
    ' zones</h3><h4>zones 0 to ' +
    (Math.min(base, GRID_MAX) - 1) +
    '</h4>' +
    zoneGrid(sounds, firstZones)
  if (base > GRID_MAX) {
    parts += '<h4>' + SPREAD_ZONES + ' evenly spaced zones</h4>' + zoneGrid(sounds, spread(0, base - 1, SPREAD_ZONES))
    const last: number[] = []
    for (let z = base - LAST_ZONES; z < base; z++) last.push(z)
    parts += '<h4>the last ' + LAST_ZONES + ' zones</h4>' + zoneGrid(sounds, last)
  }
  parts += '<h4>demon names: the ' + NAMES_LOW + ' lowest mesh numbers, then ' + NAMES_SPREAD + ' evenly spaced</h4>'
  parts += namesTable(sounds, base)
  parts += '<h4>shape statistics</h4>' + statsTable(sounds, base)
  return '<div class="base">' + parts + '</div>'
}

function styleSection(style: StyleId, seed: string): string {
  const gen = createGenerator(seed, style)
  const bank = SYLLABLE_BANKS[style]
  const id = style + '-' + seed
  const lazyCells = LAZY_SAMPLE_ZONES.map(z => '<span class="z"><i>' + z + '</i>' + esc(gen.soundAt(z)) + '</span>').join('')
  const header =
    '<h2>' +
    esc(style) +
    ', seed ' +
    esc(seed) +
    '</h2><p class="dim">bank sizes: ' +
    bank.internal.length +
    ' internal / ' +
    bank.leaf.length +
    ' leaf syllables; depth classes up to ' +
    GENERATOR_MAX_DEPTH +
    '; ' +
    gen.limit +
    ' distinct sounds</p>'
  const blocks = NAMING_SHEET_BASES.map(base => baseBlock(gen, base)).join('\n')
  const lazy = '<div class="base"><h3>Lazy samples (soundAt)</h3><div class="grid">' + lazyCells + '</div></div>'
  return '<section id="' + esc(id) + '">' + header + blocks + lazy + '</section>'
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px 20px 48px; background: #060609; color: #ccd; font-family: monospace; font-size: 13px; }
h1 { font-size: 16px; color: #dde; margin: 0 0 6px; }
p { margin: 4px 0 10px; }
.dim { color: #889; }
nav { position: sticky; top: 0; z-index: 10; background: #0a0a10; border-bottom: 1px solid #223; padding: 8px 4px; margin: 0 -20px 16px; }
nav a { color: #8ad8ff; text-decoration: none; margin: 0 10px 0 20px; font-size: 12px; }
nav a:hover { text-decoration: underline; }
section { scroll-margin-top: 48px; border-top: 1px solid #223; margin-top: 28px; padding-top: 10px; }
h2 { font-size: 15px; color: #9ad; margin: 14px 0 4px; }
h3 { font-size: 13px; color: #bdf; margin: 20px 0 6px; border-bottom: 1px solid #223; padding-bottom: 3px; }
h4 { font-size: 12px; font-weight: normal; color: #889; margin: 12px 0 4px; }
.base { max-width: 1180px; }
.grid { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.z { background: #10121a; border: 1px solid #223; border-radius: 3px; padding: 2px 6px; color: #e8ecff; }
.z i { color: #667; font-style: normal; font-size: 10px; margin-right: 5px; }
table { border-collapse: collapse; }
.names th, .names td { text-align: left; padding: 1px 16px 1px 0; }
.names th { color: #889; font-weight: normal; border-bottom: 1px solid #223; }
.names td { color: #e8ecff; }
.names td.dim { color: #667; }
.names b { color: #ffb86b; font-weight: normal; }
.stats th { text-align: left; font-weight: normal; color: #889; padding: 1px 18px 1px 0; }
.stats td { color: #e8ecff; }
`

/** The whole contact sheet as one self-contained HTML document: three styles, two seeds, five bases, raw and smoothed names. */
export function buildNamingSheet(): string {
  const ids: string[] = []
  const sections: string[] = []
  for (const style of STYLE_IDS) {
    for (const seed of NAMING_SHEET_SEEDS) {
      ids.push(style + '-' + seed)
      sections.push(styleSection(style, seed))
    }
  }
  const nav = ids.map(id => '<a href="#' + esc(id) + '">' + esc(id) + '</a>').join('')
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>CCRUG naming style contact sheet</title><style>' +
    STYLE +
    '</style></head><body>\n<nav>' +
    nav +
    '</nav>\n<h1>CCRUG naming style contact sheet</h1>\n<p class="dim">' +
    esc(NOTE) +
    '</p>\n<p class="dim">raw = the plain join of the two zone sounds (higher zone first), first letter capitalised; smoothed = euphony@1, ' +
    'inserted vowels in orange. Sounds are the generator output; names are joins of sounds only.</p>\n' +
    sections.join('\n') +
    '\n</body></html>\n'
  )
}
