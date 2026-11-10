// The pure rules behind the Names panel zone list (Phase 7, plan 19; D-02, D-07, NAM-01, 07-UI-SPEC "Zone List", T-07-03f, T-07-17e):
// how a pasted list is split and planned (all or nothing), which row a navigation key leads to, what a typed Go to zone text
// means, and the small decisions the list component makes (commit, message, tab stop, scroll once per pin, scroll after an undo).
// Every case is derived from the rules, not from CCRU data: no canonical sound, name or preset table appears here, and the bases
// are plain numbers chosen for the arithmetic (28 is just an even base with letter digits, 100 one with decimal digits).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatNumeral, type TextProblem } from '../../engine/index'
import { zoneIssue } from '../../app/lib/namingCopy'
import { SOUND_FIELD_MAX_INPUT, ZONE_PAGE_STEP } from '../../app/lib/namingLimits'
import {
  GOTO_MAX_LENGTH,
  listMessageOf,
  nextRowIndex,
  pinScrollTarget,
  planPaste,
  resolveGoTo,
  restoredScrollTarget,
  soundCommitOf,
  splitPaste,
  tabStopZone,
} from '../../app/lib/zoneListModel'

const MODEL_SOURCE = fileURLToPath(new URL('../../app/lib/zoneListModel.ts', import.meta.url))

/** The labels the list shows by default: each zone as a numeral of its own base. */
const numeralLabel = (base: number) => (zone: number) => formatNumeral(zone, base)

describe('splitPaste', () => {
  it('splits on commas, semicolons, tabs, newlines, carriage returns and spaces', () => {
    expect(splitPaste('a, b;c\td\ne f')).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(splitPaste('a\r\nb')).toEqual(['a', 'b'])
  })

  it('leaves a single token whole, so a one-word paste behaves like typing', () => {
    expect(splitPaste('gl')).toEqual(['gl'])
  })

  it('drops empty tokens made by runs, leading and trailing separators', () => {
    expect(splitPaste(',, a ;; b ,')).toEqual(['a', 'b'])
    expect(splitPaste('\n\n x \n')).toEqual(['x'])
    expect(splitPaste('')).toEqual([])
    expect(splitPaste(' ,;\t\n ')).toEqual([])
  })

  it('does not split on a dot, a hyphen, an underscore or a letter (those stay inside a token for validation to refuse)', () => {
    expect(splitPaste('a.b-c_d')).toEqual(['a.b-c_d'])
  })
})

describe('planPaste', () => {
  it('plans every token that has a zone, in order', () => {
    expect(planPaste(['aa', 'bb'], 3, 28)).toEqual({ ok: true, sounds: ['aa', 'bb'], used: 2, unused: 0 })
  })

  it('counts the tokens past the last zone as unused, and does not validate them', () => {
    // zones 26 and 27 are the last two of base 28: the third token has no zone, so a bad one there is not looked at
    expect(planPaste(['aa', 'bb', 'cc'], 26, 28)).toEqual({ ok: true, sounds: ['aa', 'bb'], used: 2, unused: 1 })
    expect(planPaste(['aa', 'bb', 'c1'], 26, 28)).toEqual({ ok: true, sounds: ['aa', 'bb'], used: 2, unused: 1 })
  })

  it('names the first bad zone and applies nothing (all or nothing)', () => {
    const plan = planPaste(['aa', 'b1', 'cc'], 3, 28)
    expect(plan).toEqual({ ok: false, zone: 4, reason: 'digit' })
    // a refusal carries no sounds at all: not even the valid prefix can leak through
    expect('sounds' in plan).toBe(false)
  })

  it('refuses at the first bad token even when a later one is bad for another reason', () => {
    expect(planPaste(['aa', 'b b', 'c1'], 0, 28)).toEqual({ ok: false, zone: 1, reason: 'space' })
    expect(planPaste(['1', 'bb'], 5, 28)).toEqual({ ok: false, zone: 5, reason: 'digit' })
  })

  it('reports each reason the sound rules give', () => {
    const reasons: readonly [string, TextProblem][] = [
      ['b-b', 'other'],
      ['x'.repeat(17), 'long'],
      ['b2', 'digit'],
    ]
    for (const [token, reason] of reasons) {
      expect(planPaste(['ok', token], 0, 28)).toEqual({ ok: false, zone: 1, reason })
    }
  })

  it('plans the NFC form of each token', () => {
    const decomposed = 'é' // e + combining acute
    const plan = planPaste([decomposed], 0, 28)
    expect(plan).toEqual({ ok: true, sounds: ['é'], used: 1, unused: 0 })
  })

  it('fits exactly one token into the last zone and leaves the rest unused', () => {
    expect(planPaste(['aa', 'bb'], 27, 28)).toEqual({ ok: true, sounds: ['aa'], used: 1, unused: 1 })
  })

  it('plans nothing for an empty list', () => {
    expect(planPaste([], 4, 28)).toEqual({ ok: true, sounds: [], used: 0, unused: 0 })
  })

  it('counts at the largest editable size without walking the whole list', () => {
    const tokens = Array.from({ length: 10 }, () => 'ab')
    const plan = planPaste(tokens, 3995, 4000)
    expect(plan).toEqual({ ok: true, sounds: ['ab', 'ab', 'ab', 'ab', 'ab'], used: 5, unused: 5 })
  })
})

describe('nextRowIndex', () => {
  it('steps one row with the arrow keys, clamped at both ends', () => {
    expect(nextRowIndex(5, 'ArrowDown', false, 28)).toBe(6)
    expect(nextRowIndex(5, 'ArrowUp', false, 28)).toBe(4)
    expect(nextRowIndex(27, 'ArrowDown', false, 28)).toBe(27)
    expect(nextRowIndex(0, 'ArrowUp', false, 28)).toBe(0)
  })

  it('jumps by the page step with Page Up and Page Down, clamped', () => {
    expect(ZONE_PAGE_STEP).toBe(10)
    expect(nextRowIndex(5, 'PageDown', false, 100)).toBe(5 + ZONE_PAGE_STEP)
    expect(nextRowIndex(50, 'PageUp', false, 100)).toBe(50 - ZONE_PAGE_STEP)
    expect(nextRowIndex(95, 'PageDown', false, 100)).toBe(99)
    expect(nextRowIndex(3, 'PageUp', false, 100)).toBe(0)
  })

  it('goes to the first and last row with Ctrl+Home and Ctrl+End', () => {
    expect(nextRowIndex(40, 'Home', true, 100)).toBe(0)
    expect(nextRowIndex(40, 'End', true, 100)).toBe(99)
  })

  it('leaves plain Home and End to the caret', () => {
    expect(nextRowIndex(40, 'Home', false, 100)).toBeNull()
    expect(nextRowIndex(40, 'End', false, 100)).toBeNull()
  })

  it('ignores every other key', () => {
    for (const key of ['a', 'Enter', 'Escape', 'Tab', ' ', 'ArrowLeft', 'ArrowRight']) {
      expect(nextRowIndex(5, key, false, 28), key).toBeNull()
    }
  })

  it('has nowhere to go in an empty list', () => {
    expect(nextRowIndex(0, 'ArrowDown', false, 0)).toBeNull()
    expect(nextRowIndex(0, 'End', true, 0)).toBeNull()
  })

  it('reaches the last of the largest list', () => {
    expect(nextRowIndex(0, 'End', true, 4000)).toBe(3999)
    expect(nextRowIndex(3995, 'PageDown', false, 4000)).toBe(3999)
  })
})

describe('resolveGoTo', () => {
  const label28 = numeralLabel(28)

  it('prefers the exact label shown for a zone', () => {
    expect(resolveGoTo('c', 28, label28)).toBe(12)
    expect(resolveGoTo('0', 28, label28)).toBe(0)
    expect(resolveGoTo('r', 28, label28)).toBe(27)
  })

  it('lets the shown label win over the numeral and the decimal reading', () => {
    // labels that are a permutation of the plain digits: the text '5' is the label of zone 7, which beats the value 5
    const shifted = (zone: number): string => String((zone + 2) % 28)
    expect(resolveGoTo('5', 28, shifted)).toBe(3)
    expect(resolveGoTo('0', 28, shifted)).toBe(26)
  })

  it('reads a numeral of the base when no label matches (the zones are shown as digits, say)', () => {
    const digits = (zone: number): string => String(zone)
    expect(resolveGoTo('c', 28, digits)).toBe(12)
  })

  it('falls back to a plain decimal when the text is no label and no numeral of the base in range', () => {
    // '12' is the numeral 1*28+2 = 30 at base 28: out of range, so the decimal reading 12 is used
    expect(resolveGoTo('12', 28, label28)).toBe(12)
    expect(resolveGoTo('27', 28, label28)).toBe(27)
  })

  it('refuses a number past the last zone, in either reading', () => {
    expect(resolveGoTo('28', 28, label28)).toBeNull()
    expect(resolveGoTo('99999', 28, label28)).toBeNull()
    expect(resolveGoTo('4000', 4000, numeralLabel(4000))).toBeNull()
    expect(resolveGoTo('3999', 4000, numeralLabel(4000))).toBe(3999)
  })

  it('refuses empty, blank and junk text', () => {
    for (const text of ['', '   ', 'z', '!', '-1', '1.5', 'c d', '١٢', '12abc']) {
      expect(resolveGoTo(text, 28, label28), JSON.stringify(text)).toBeNull()
    }
  })

  it('trims the text before reading it', () => {
    expect(resolveGoTo('  c \t', 28, label28)).toBe(12)
    expect(resolveGoTo(' 12 ', 28, label28)).toBe(12)
  })

  it('is bounded to the go-to length: a longer text is no zone, even one that would parse', () => {
    expect(GOTO_MAX_LENGTH).toBe(40)
    expect(resolveGoTo('0'.repeat(GOTO_MAX_LENGTH), 28, label28)).toBe(0)
    expect(resolveGoTo('0'.repeat(GOTO_MAX_LENGTH + 1), 28, label28)).toBeNull()
    expect(resolveGoTo(`  ${'0'.repeat(GOTO_MAX_LENGTH)}  `, 28, label28)).toBe(0)
  })

  it('reads zones of a decimal-digit base (above 36 each zone is one decimal digit)', () => {
    const label = numeralLabel(100)
    expect(resolveGoTo('65', 100, label)).toBe(65)
    expect(resolveGoTo('99', 100, label)).toBe(99)
    expect(resolveGoTo('100', 100, label)).toBeNull()
  })

  it('scans the labels at most once per zone', () => {
    let calls = 0
    const counting = (zone: number): string => {
      calls++
      return formatNumeral(zone, 4000)
    }
    expect(resolveGoTo('nope', 4000, counting)).toBeNull()
    expect(calls).toBeLessThanOrEqual(4000)
  })
})

describe('soundCommitOf', () => {
  it('has nothing to commit without a draft', () => {
    expect(soundCommitOf(undefined, 'gl')).toEqual({ kind: 'none' })
  })

  it('commits a valid draft, trimmed and in NFC', () => {
    expect(soundCommitOf('  eia ', 'gl')).toEqual({ kind: 'commit', text: 'eia' })
    expect(soundCommitOf('é', 'gl')).toEqual({ kind: 'commit', text: 'é' })
  })

  it('does nothing for the stored text, even when typed with spaces around it', () => {
    expect(soundCommitOf('gl', 'gl')).toEqual({ kind: 'unchanged' })
    expect(soundCommitOf(' gl ', 'gl')).toEqual({ kind: 'unchanged' })
  })

  it('keeps an invalid draft and says why, first failing rule first', () => {
    expect(soundCommitOf('', 'gl')).toEqual({ kind: 'invalid', reason: 'empty' })
    expect(soundCommitOf('   ', 'gl')).toEqual({ kind: 'invalid', reason: 'empty' })
    expect(soundCommitOf('a b', 'gl')).toEqual({ kind: 'invalid', reason: 'space' })
    expect(soundCommitOf('a1', 'gl')).toEqual({ kind: 'invalid', reason: 'digit' })
    expect(soundCommitOf('a-b', 'gl')).toEqual({ kind: 'invalid', reason: 'other' })
    expect(soundCommitOf('x'.repeat(17), 'gl')).toEqual({ kind: 'invalid', reason: 'long' })
  })

  it('accepts a sound at the length limit and is not fooled by the field cap', () => {
    expect(soundCommitOf('x'.repeat(16), 'gl')).toEqual({ kind: 'commit', text: 'x'.repeat(16) })
    expect(SOUND_FIELD_MAX_INPUT).toBeGreaterThan(16)
  })
})

describe('listMessageOf', () => {
  const label = (zone: number): string => `L${zone}`

  it('is empty when there is nothing to say', () => {
    expect(listMessageOf(null, null, new Map(), label)).toBe('')
  })

  it('shows a note (a refused paste, an unknown zone) over everything else', () => {
    const problems = new Map<number, TextProblem>([[3, 'digit']])
    expect(listMessageOf('No zone', 3, problems, label)).toBe('No zone')
  })

  it('names the row the message belongs to while that row is invalid', () => {
    const problems = new Map<number, TextProblem>([
      [3, 'digit'],
      [9, 'space'],
    ])
    expect(listMessageOf(null, 9, problems, label)).toBe(zoneIssue('L9', 'space'))
    expect(listMessageOf(null, 3, problems, label)).toBe(zoneIssue('L3', 'digit'))
  })

  it('clears when the row the message belonged to is valid again and no other row is invalid', () => {
    expect(listMessageOf(null, 9, new Map(), label)).toBe('')
  })

  it('falls back to the lowest invalid row when the message row is fixed but another is still invalid', () => {
    const problems = new Map<number, TextProblem>([
      [12, 'other'],
      [7, 'long'],
    ])
    expect(listMessageOf(null, 3, problems, label)).toBe(zoneIssue('L7', 'long'))
    expect(listMessageOf(null, null, problems, label)).toBe(zoneIssue('L7', 'long'))
  })
})

describe('tabStopZone', () => {
  it('is the active row while that row is on screen', () => {
    expect(tabStopZone(12, [10, 11, 12, 13])).toBe(12)
  })

  it('is the first rendered row when the active row has been scrolled out, so the list always has a Tab stop', () => {
    expect(tabStopZone(2, [10, 11, 12])).toBe(10)
  })

  it('keeps the active row when nothing is rendered', () => {
    expect(tabStopZone(2, [])).toBe(2)
  })
})

describe('pinScrollTarget', () => {
  it('scrolls to a newly pinned zone', () => {
    expect(pinScrollTarget(9, null, 28)).toBe(9)
    expect(pinScrollTarget(9, 4, 28)).toBe(9)
  })

  it('does not scroll again for the zone it already scrolled to (once per pin)', () => {
    expect(pinScrollTarget(9, 9, 28)).toBeNull()
  })

  it('does nothing without a pin, or for a pin outside the base', () => {
    expect(pinScrollTarget(null, null, 28)).toBeNull()
    expect(pinScrollTarget(null, 9, 28)).toBeNull()
    expect(pinScrollTarget(28, null, 28)).toBeNull()
    expect(pinScrollTarget(-1, null, 28)).toBeNull()
  })

  it('scrolls to the first zone', () => {
    expect(pinScrollTarget(0, null, 28)).toBe(0)
  })
})

describe('restoredScrollTarget', () => {
  it('scrolls to the single changed zone of a new restore', () => {
    expect(restoredScrollTarget({ tick: 3, zone: 14 }, 2)).toBe(14)
    expect(restoredScrollTarget({ tick: 1, zone: 0 }, 0)).toBe(0)
  })

  it('does not scroll for a restore it has already seen, nor for a multi-row change', () => {
    expect(restoredScrollTarget({ tick: 3, zone: 14 }, 3)).toBeNull()
    expect(restoredScrollTarget({ tick: 4, zone: null }, 3)).toBeNull()
  })
})

describe('the model file', () => {
  const source = readFileSync(MODEL_SOURCE, 'utf8')

  it('imports relatively, reads no DOM and types no zone count or page step as a literal', () => {
    expect(source).not.toMatch(/from '[^.]/)
    expect(source).not.toMatch(/\bdocument\b|\bwindow\b/)
    expect(source).not.toMatch(/<=?\s*9\b|>=?\s*10\b/)
    expect(source).toContain('ZONE_PAGE_STEP')
  })

  it('exports planPaste once', () => {
    expect(source.split('export function planPaste')).toHaveLength(2)
  })
})
