// Tests for app/lib/labelScheme.ts (UI-03, D-08, D-09, D-11, D-13): every zone label the app can show, and the
// labels= URL form. Behaviour pinned from 04-02-PLAN.md.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABEL_SCHEME,
  formatLabelScheme,
  formatZoneLabel,
  labelSchemeKey,
  parseLabelScheme,
  zoneLabelsFor,
} from '../../app/lib/labelScheme'
import type { LabelScheme } from '../../app/lib/labelScheme'

describe('formatZoneLabel', () => {
  it('digits mode uses the engine numeral scheme (0-9a-z to base 36, decimal groups beyond)', () => {
    expect(formatZoneLabel(5, 10, { mode: 'digits' })).toBe('5')
    expect(formatZoneLabel(15, 16, { mode: 'digits' })).toBe('f')
    expect(formatZoneLabel(35, 36, { mode: 'digits' })).toBe('z')
    expect(formatZoneLabel(36, 38, { mode: 'digits' })).toBe('36')
    expect(formatZoneLabel(57, 60, { mode: 'digits' })).toBe('57')
  })

  it('xeno mode replaces the numeral, falling back to it only when xenotation is empty (zone 0)', () => {
    expect(formatZoneLabel(0, 10, { mode: 'xeno' })).toBe('0')
    expect(formatZoneLabel(1, 10, { mode: 'xeno' })).toBe('n/a')
    expect(formatZoneLabel(4, 10, { mode: 'xeno' })).toBe('::')
    expect(formatZoneLabel(9, 10, { mode: 'xeno' })).toBe('(:)(:)')
  })

  it('a curated preset labels a zone when long enough for the base', () => {
    expect(formatZoneLabel(10, 40, { mode: 'preset', preset: 'base62' })).toBe('A')
    expect(formatZoneLabel(36, 40, { mode: 'preset', preset: 'base62' })).toBe('a')
    expect(formatZoneLabel(63, 64, { mode: 'preset', preset: 'base64url' })).toBe('_')
  })

  it('a preset shorter than the base falls back to the numeral scheme', () => {
    expect(formatZoneLabel(5, 1024, { mode: 'preset', preset: 'latin1' })).toBe('5')
  })

  it('a custom alphabet labels a zone when long enough for the base', () => {
    const chars = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ']
    expect(formatZoneLabel(3, 10, { mode: 'custom', chars })).toBe('δ')
  })

  it('a custom alphabet shorter than the base falls back to the numeral scheme (never a wrong label)', () => {
    const chars = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ']
    expect(formatZoneLabel(3, 12, { mode: 'custom', chars })).toBe('3')
  })
})

describe('zoneLabelsFor', () => {
  it('digits mode covers a full base', () => {
    expect(zoneLabelsFor(10, DEFAULT_LABEL_SCHEME)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('xeno mode covers a full base', () => {
    expect(zoneLabelsFor(4, { mode: 'xeno' })).toEqual(['0', 'n/a', ':', '(:)'])
  })
})

describe('URL form', () => {
  it('formatLabelScheme: digits is omitted (null), the others are one string form', () => {
    expect(formatLabelScheme({ mode: 'digits' })).toBeNull()
    expect(formatLabelScheme({ mode: 'xeno' })).toBe('xeno')
    expect(formatLabelScheme({ mode: 'preset', preset: 'base62' })).toBe('preset:base62')
    expect(formatLabelScheme({ mode: 'custom', chars: ['a', 'b', 'c'] })).toBe('custom:abc')
  })

  it('parseLabelScheme is lenient: anything invalid falls back to the default', () => {
    expect(parseLabelScheme(null)).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('')).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('xeno')).toEqual({ mode: 'xeno' })
    expect(parseLabelScheme('preset:ascii')).toEqual({ mode: 'preset', preset: 'ascii' })
    expect(parseLabelScheme('preset:nope')).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('custom:abc')).toEqual({ mode: 'custom', chars: ['a', 'b', 'c'] })
    expect(parseLabelScheme('custom:')).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('custom:a' + String.fromCodePoint(0x202e) + 'b')).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('custom:abca')).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('custom:' + Array.from({ length: 1025 }, () => 'a').join(''))).toEqual(DEFAULT_LABEL_SCHEME)
    expect(parseLabelScheme('zzz')).toEqual(DEFAULT_LABEL_SCHEME)
  })

  it('round-trips every mode through URLSearchParams', () => {
    const cases: LabelScheme[] = [
      { mode: 'digits' },
      { mode: 'xeno' },
      { mode: 'preset', preset: 'base62' },
      { mode: 'custom', chars: ['a', 'b', 'c'] },
    ]
    for (const scheme of cases) {
      const formatted = formatLabelScheme(scheme)
      const sent = new URLSearchParams()
      if (formatted !== null) sent.set('labels', formatted)
      const received = new URLSearchParams(sent.toString())
      expect(parseLabelScheme(received.get('labels'))).toEqual(scheme)
    }
  })

  it('labelSchemeKey is stable for equal schemes and distinct across modes/values', () => {
    const digits: LabelScheme = { mode: 'digits' }
    const xeno: LabelScheme = { mode: 'xeno' }
    const presetA: LabelScheme = { mode: 'preset', preset: 'base62' }
    const presetB: LabelScheme = { mode: 'preset', preset: 'ascii' }
    const customA: LabelScheme = { mode: 'custom', chars: ['a', 'b'] }
    const customB: LabelScheme = { mode: 'custom', chars: ['a', 'c'] }

    expect(labelSchemeKey(digits)).toBe(labelSchemeKey({ mode: 'digits' }))
    expect(labelSchemeKey(customA)).toBe(labelSchemeKey({ mode: 'custom', chars: ['a', 'b'] }))

    const keys = [digits, xeno, presetA, presetB, customA, customB].map(labelSchemeKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
