// Tests for app/lib/basePicker.ts (UI-01, D-04..D-07). Candidate evaluation through validateBase, the exact
// UI-SPEC refusal copy, stepping/slider clamping and the picker's live summary/type-count lines. Pure logic only —
// the component (app/components/numogram/BasePicker.tsx) is exercised in Phase 4's later e2e plans (04-12).
import { describe, expect, it } from 'vitest'
import { createNumogram, validateBase } from '../../engine/index'
import type { NumogramSummary } from '../../app/lib/numogramView'
import { summarize } from '../../app/lib/numogramView'
import {
  BASE_DEBOUNCE_MS,
  BASE_STEP,
  NOTABLE_BASES,
  SLIDER_MAX,
  SLIDER_MIN,
  evaluateCandidate,
  evaluateCustomAlphabet,
  refusalFromUrl,
  refusalMessage,
  sliderPosition,
  stepBase,
  summaryLine,
  typeCountsLine,
} from '../../app/lib/basePicker'

describe('constants', () => {
  it('NOTABLE_BASES is the user-amended UI-01 chip set, in ascending order', () => {
    expect(NOTABLE_BASES).toEqual([2, 4, 6, 8, 10, 12, 16, 22, 28, 64, 80, 82, 100, 1024])
  })

  it('BASE_STEP, SLIDER_MIN, SLIDER_MAX, BASE_DEBOUNCE_MS', () => {
    expect(BASE_STEP).toBe(2)
    expect(SLIDER_MIN).toBe(2)
    expect(SLIDER_MAX).toBe(1024)
    expect(BASE_DEBOUNCE_MS).toBe(200)
  })
})

describe('evaluateCandidate', () => {
  it('a plain even integer commits', () => {
    expect(evaluateCandidate('28', 10)).toEqual({ kind: 'ok', base: 28 })
  })

  it('empty or whitespace-only text previews nothing', () => {
    expect(evaluateCandidate('', 10)).toEqual({ kind: 'empty' })
    expect(evaluateCandidate('   ', 10)).toEqual({ kind: 'empty' })
  })

  it('an odd base refuses with the exact UI-SPEC copy', () => {
    const r = evaluateCandidate('27', 26)
    expect(r).toEqual({
      kind: 'refused',
      reason: 'odd',
      message: 'Base 27 is odd — numograms need an even base. Showing base 26.',
    })
  })

  it('a base above the safe ceiling refuses with the exact UI-SPEC copy', () => {
    const r = evaluateCandidate('67108866', 28)
    expect(r).toEqual({
      kind: 'refused',
      reason: 'too-large',
      message: 'Base 67108866 is above the safe ceiling (2^26). Showing base 28.',
    })
  })

  it('a non-integer refuses with the exact UI-SPEC copy', () => {
    const r = evaluateCandidate('27.5', 10)
    expect(r).toEqual({
      kind: 'refused',
      reason: 'not-integer',
      message: "Base 27.5 isn't a whole number. Showing base 10.",
    })
  })

  it('zero and negative bases refuse as too small', () => {
    expect(evaluateCandidate('0', 10)).toEqual({
      kind: 'refused',
      reason: 'zero',
      message: 'Base 0 is too small — a numogram needs at least 2 zones. Showing base 10.',
    })
    expect(evaluateCandidate('-4', 10)).toEqual({
      kind: 'refused',
      reason: 'negative',
      message: 'Base -4 is too small — a numogram needs at least 2 zones. Showing base 10.',
    })
  })

  it('malformed text (non-numeric, hex, scientific notation) never reaches validateBase', () => {
    for (const raw of ['abc', '0x10', '1e3']) {
      const r = evaluateCandidate(raw, 10)
      expect(r).toEqual({
        kind: 'refused',
        reason: 'malformed',
        message: `'${raw}' isn't a number. Showing base 10.`,
      })
    }
  })

  it('a long malformed input is echoed clipped to 40 characters plus an ellipsis', () => {
    const raw = 'a'.repeat(60)
    const r = evaluateCandidate(raw, 10)
    expect(r.kind).toBe('refused')
    if (r.kind === 'refused') {
      expect(r.message).toBe(`'${'a'.repeat(40)}...' isn't a number. Showing base 10.`)
    }
  })
})

describe('refusalMessage', () => {
  it('covers every RefusalReason with the exact UI-SPEC copy', () => {
    expect(refusalMessage('odd', '27', 26)).toBe('Base 27 is odd — numograms need an even base. Showing base 26.')
    expect(refusalMessage('too-large', '67108866', 28)).toBe(
      'Base 67108866 is above the safe ceiling (2^26). Showing base 28.',
    )
    expect(refusalMessage('not-integer', '27.5', 10)).toBe("Base 27.5 isn't a whole number. Showing base 10.")
    expect(refusalMessage('zero', '0', 10)).toBe('Base 0 is too small — a numogram needs at least 2 zones. Showing base 10.')
    expect(refusalMessage('negative', '-4', 10)).toBe(
      'Base -4 is too small — a numogram needs at least 2 zones. Showing base 10.',
    )
    expect(refusalMessage('not-a-number', 'NaN', 10)).toBe("'NaN' isn't a number. Showing base 10.")
    expect(refusalMessage('infinite', 'Infinity', 10)).toBe("'Infinity' isn't a number. Showing base 10.")
    expect(refusalMessage('malformed', 'abc', 10)).toBe("'abc' isn't a number. Showing base 10.")
  })
})

describe('refusalFromUrl', () => {
  it('a refused BaseCheck mentions the reason and the fallback base', () => {
    const message = refusalFromUrl('27', validateBase(27), 10)
    expect(message).toContain('Base 27 is odd')
    expect(message).toContain('Showing base 10.')
  })

  it('a null check (text that never reached validateBase) is malformed', () => {
    expect(refusalFromUrl('28abc', null)).toBe("'28abc' isn't a number. Showing base 10.")
  })
})

describe('stepBase', () => {
  it('steps by exactly 2 in either direction', () => {
    expect(stepBase(10, 1)).toBe(12)
    expect(stepBase(10, -1)).toBe(8)
  })

  it('clamps at the floor (2) and the ceiling (2^26)', () => {
    expect(stepBase(2, -1)).toBe(2)
    expect(stepBase(67108864, 1)).toBe(67108864)
  })
})

describe('sliderPosition', () => {
  it('clamps to the slider range, pinning a huge base to the end', () => {
    expect(sliderPosition(4096)).toBe(1024)
    expect(sliderPosition(28)).toBe(28)
  })
})

describe('summaryLine', () => {
  it('base 28: 9-length and 3-length Torque cycles, 378 demons', () => {
    expect(summaryLine(summarize(createNumogram(28)))).toBe('28 zones · Warp yes · Torque [9,3] · 378 demons')
  })

  it('base 10: the frozen oracle', () => {
    expect(summaryLine(summarize(createNumogram(10)))).toBe('10 zones · Warp yes · Torque [3] · 45 demons')
  })

  it('base 12 has no Warp cycle', () => {
    expect(summaryLine(summarize(createNumogram(12)))).toContain('Warp no')
  })

  it('truncates listed Torque lengths with an ellipsis count past the summary limit', () => {
    const s: NumogramSummary = {
      base: 2,
      zoneCount: 0,
      hasWarp: false,
      torqueCount: 15,
      torqueLengths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      demonCount: 0,
      typeCounts: { chrono: 0, amphi: 0, xeno: 0 },
    }
    expect(summaryLine(s)).toContain('Torque [1,1,1,1,1,1,1,1,1,1,1,1,…+3]')
  })

  it('no Torque cycles reads "Torque none"', () => {
    const s: NumogramSummary = {
      base: 2,
      zoneCount: 2,
      hasWarp: false,
      torqueCount: 0,
      torqueLengths: [],
      demonCount: 0,
      typeCounts: { chrono: 0, amphi: 0, xeno: 0 },
    }
    expect(summaryLine(s)).toContain('Torque none')
  })

  it('thousands-separates large numbers via toLocaleString', () => {
    const s: NumogramSummary = {
      base: 2000,
      zoneCount: 2000,
      hasWarp: true,
      torqueCount: 1,
      torqueLengths: [1],
      demonCount: 221445,
      typeCounts: { chrono: 0, amphi: 0, xeno: 0 },
    }
    expect(summaryLine(s)).toContain('221,445 demons')
    expect(summaryLine(s)).toContain('2,000 zones')
  })
})

describe('typeCountsLine', () => {
  it('base 10: the frozen oracle demon-type split', () => {
    expect(typeCountsLine(summarize(createNumogram(10)))).toBe('chrono 15 · amphi 24 · xeno 6')
  })
})

describe('evaluateCustomAlphabet', () => {
  it('a repeated character is a duplicate', () => {
    const { check } = evaluateCustomAlphabet('abca', 10)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toBe('duplicate')
  })

  it('ten unique digit characters cover base 10', () => {
    expect(evaluateCustomAlphabet('0123456789', 10).check.ok).toBe(true)
  })

  it('empty text is the empty reason', () => {
    const { check } = evaluateCustomAlphabet('', 10)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toBe('empty')
  })
})
