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
  EMPTY_LIST_STATE,
  GOTO_MAX_LENGTH,
  hasRowEdit,
  listMessageOf,
  nextRowIndex,
  pinScrollTarget,
  planPaste,
  refuseRow,
  resolveGoTo,
  restoredScrollTarget,
  settleRow,
  pasteTextLimit,
  settleRows,
  soundCommitOf,
  splitPaste,
  tabStopZone,
  typeInto,
  withFocusedRow,
  withNote,
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

// Review IN-26: a bulk paste fills at most base - zone rows, but the whole clipboard text used to be split first, so a 100 MB paste became
// millions of tokens before the plan looked at the first few. The text is cut to what the rows can use before it is split.
describe('pasteTextLimit and the bounded splitPaste', () => {
  it('is a base-sized number of characters: room for every row to hold a longest sound field and its separator', () => {
    expect(pasteTextLimit(28)).toBe(28 * (SOUND_FIELD_MAX_INPUT + 1))
    expect(pasteTextLimit(1000)).toBe(1000 * (SOUND_FIELD_MAX_INPUT + 1))
  })

  it('cuts a huge text before it is split: 20 million characters give at most limit tokens, not ten million', () => {
    const huge = 'a '.repeat(10_000_000)
    const tokens = splitPaste(huge, pasteTextLimit(28))
    expect(tokens.length).toBeLessThanOrEqual(pasteTextLimit(28))
    expect(tokens.length).toBeGreaterThan(28) // still more tokens than rows, so the plan reports the unused ones
    expect(tokens.every(t => t === 'a')).toBe(true)
  })

  it('leaves every realistic paste whole: the same tokens, and so the same plan, with or without the bound', () => {
    const text = Array.from({ length: 30 }, (_, i) => 'q' + String.fromCharCode(97 + (i % 26))).join(', ')
    expect(splitPaste(text, pasteTextLimit(28))).toEqual(splitPaste(text))
    expect(planPaste(splitPaste(text, pasteTextLimit(28)), 20, 28)).toEqual(planPaste(splitPaste(text), 20, 28))
  })

  it('does not change the first bad token: a long word at the cut is still refused', () => {
    const limit = pasteTextLimit(28)
    const text = 'ok ' + 'x'.repeat(limit * 3) // one over-long token that runs past the cut
    const plan = planPaste(splitPaste(text, limit), 0, 28)
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.zone).toBe(1)
  })

  it('without a limit it is the old behaviour', () => {
    expect(splitPaste('a b c')).toEqual(['a', 'b', 'c'])
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

// Review WR-06: the row that has focus is rendered whatever the scroll does. The window picks rows; this adds the focused one when the
// window left it out, so a focused field is never unmounted (focus would fall to the page, with its shortcuts live).
describe('withFocusedRow', () => {
  it('keeps the window as it is when the focused row is inside it or there is no focused row', () => {
    expect(withFocusedRow([4, 5, 6, 7], 5, 28)).toEqual([4, 5, 6, 7])
    expect(withFocusedRow([4, 5, 6, 7], null, 28)).toEqual([4, 5, 6, 7])
  })

  it('adds a focused row below the window, after it in order', () => {
    expect(withFocusedRow([20, 21, 22], 0, 28)).toEqual([0, 20, 21, 22])
  })

  it('adds a focused row above the window and one between, always in ascending order and without a duplicate', () => {
    expect(withFocusedRow([0, 1, 2], 27, 28)).toEqual([0, 1, 2, 27])
    expect(withFocusedRow([0, 1, 20, 21], 10, 28)).toEqual([0, 1, 10, 20, 21])
    expect(new Set(withFocusedRow([0, 1, 20, 21], 10, 28)).size).toBe(5)
  })

  it('never adds a row that is not a row of the list (a stale focus after the list shrank)', () => {
    expect(withFocusedRow([0, 1, 2], 28, 28)).toEqual([0, 1, 2])
    expect(withFocusedRow([0, 1, 2], -1, 28)).toEqual([0, 1, 2])
    expect(withFocusedRow([0, 1, 2], 1.5, 28)).toEqual([0, 1, 2])
  })

  it('returns a new array and leaves its input alone', () => {
    const window = [3, 4]
    const out = withFocusedRow(window, 9, 28)
    expect(window).toEqual([3, 4])
    expect(out).not.toBe(window)
    expect(withFocusedRow(window, 3, 28)).not.toBe(window)
  })

  it('an empty window (nothing measured yet) still renders the focused row', () => {
    expect(withFocusedRow([], 6, 28)).toEqual([6])
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

describe('the list state', () => {
  const label = (zone: number): string => `L${zone}`

  it('starts empty', () => {
    expect(EMPTY_LIST_STATE.drafts.size).toBe(0)
    expect(EMPTY_LIST_STATE.problems.size).toBe(0)
    expect(EMPTY_LIST_STATE.messageZone).toBeNull()
    expect(EMPTY_LIST_STATE.note).toBeNull()
    expect(listMessageOf(EMPTY_LIST_STATE.note, EMPTY_LIST_STATE.messageZone, EMPTY_LIST_STATE.problems, label)).toBe('')
  })

  it('typing keeps a draft per zone without touching the others, and never mutates the state it was given', () => {
    const one = typeInto(EMPTY_LIST_STATE, 3, 'ab', 'gl')
    const two = typeInto(one, 9, 'cd', 'xy')
    expect(one.drafts.get(3)).toBe('ab')
    expect(two.drafts.get(3)).toBe('ab')
    expect(two.drafts.get(9)).toBe('cd')
    expect(one.drafts.has(9)).toBe(false)
    expect(EMPTY_LIST_STATE.drafts.size).toBe(0)
    expect(typeInto(two, 3, 'abc', 'gl').drafts.get(3)).toBe('abc')
    expect(two.drafts.get(3)).toBe('ab')
  })

  it('a draft is kept as typed, not trimmed (the commit trims)', () => {
    expect(typeInto(EMPTY_LIST_STATE, 1, ' ab ', 'gl').drafts.get(1)).toBe(' ab ')
  })

  it('typing does not mark a row invalid by itself: a refusal is made by a commit', () => {
    expect(typeInto(EMPTY_LIST_STATE, 1, 'a1', 'gl').problems.size).toBe(0)
  })

  it('a refusal marks the row, keeps its draft, and makes the message about it', () => {
    const typed = typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl')
    const refused = refuseRow(typed, 4, 'digit')
    expect(refused.problems.get(4)).toBe('digit')
    expect(refused.drafts.get(4)).toBe('a1')
    expect(refused.messageZone).toBe(4)
    expect(listMessageOf(refused.note, refused.messageZone, refused.problems, label)).toBe(zoneIssue('L4', 'digit'))
  })

  it('a refusal replaces a note, so the message says what is wrong with the row that is marked', () => {
    const noted = withNote(typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl'), 'Paste not applied.')
    const refused = refuseRow(noted, 4, 'digit')
    expect(refused.note).toBeNull()
    expect(listMessageOf(refused.note, refused.messageZone, refused.problems, label)).toBe(zoneIssue('L4', 'digit'))
  })

  it('a refusal on show follows the draft: it updates with the first failing rule and clears when the draft is valid', () => {
    const refused = refuseRow(typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl'), 4, 'digit')
    const spaced = typeInto(refused, 4, 'a b', 'gl')
    expect(spaced.problems.get(4)).toBe('space')
    const fixed = typeInto(spaced, 4, 'ab', 'gl')
    expect(fixed.problems.has(4)).toBe(false)
    expect(fixed.drafts.get(4)).toBe('ab')
    expect(listMessageOf(fixed.note, fixed.messageZone, fixed.problems, label)).toBe('')
    // typing the stored text back is valid too
    expect(typeInto(refused, 4, 'gl', 'gl').problems.has(4)).toBe(false)
  })

  it('settling a row drops its draft, its refusal and a message that was about it, and any note', () => {
    const refused = withNote(refuseRow(typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl'), 4, 'digit'), 'a note')
    const settled = settleRow(refused, 4)
    expect(settled.drafts.size).toBe(0)
    expect(settled.problems.size).toBe(0)
    expect(settled.messageZone).toBeNull()
    expect(settled.note).toBeNull()
  })

  it('settling a row leaves another row and the message about it alone', () => {
    const a = refuseRow(typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl'), 4, 'digit')
    const both = refuseRow(typeInto(a, 8, 'b2', 'xy'), 8, 'digit')
    const settled = settleRow(both, 4)
    expect(settled.drafts.get(8)).toBe('b2')
    expect(settled.problems.get(8)).toBe('digit')
    expect(settled.messageZone).toBe(8)
    expect(settled.drafts.has(4)).toBe(false)
  })

  it('settling a row that was never touched changes nothing but the note', () => {
    const state = typeInto(EMPTY_LIST_STATE, 2, 'ab', 'gl')
    const settled = settleRow(state, 99)
    expect(settled.drafts.get(2)).toBe('ab')
    expect(settled.problems.size).toBe(0)
  })

  it('settling a range clears every row of it (a paste overwrites them) and keeps the rows outside', () => {
    let state = typeInto(EMPTY_LIST_STATE, 5, 'aa', 'x')
    state = refuseRow(typeInto(state, 6, 'b1', 'x'), 6, 'digit')
    state = typeInto(state, 7, 'cc', 'x')
    state = typeInto(state, 4, 'before', 'x')
    state = typeInto(state, 8, 'after', 'x')
    state = typeInto(state, 9, 'dd', 'x')
    const settled = settleRows(state, 5, 3)
    expect([...settled.drafts.keys()].sort((a, b) => a - b)).toEqual([4, 8, 9])
    expect(settled.problems.size).toBe(0)
    expect(settled.messageZone).toBeNull()
    expect(settled.note).toBeNull()
  })

  it('a note is shown over a row refusal, and dropping it shows the refusal again', () => {
    const refused = refuseRow(typeInto(EMPTY_LIST_STATE, 4, 'a1', 'gl'), 4, 'digit')
    const noted = withNote(refused, 'No zone')
    expect(listMessageOf(noted.note, noted.messageZone, noted.problems, label)).toBe('No zone')
    const dropped = withNote(noted, null)
    expect(listMessageOf(dropped.note, dropped.messageZone, dropped.problems, label)).toBe(zoneIssue('L4', 'digit'))
  })

  it('setting the note it already has returns the same state (no needless render)', () => {
    const noted = withNote(EMPTY_LIST_STATE, 'x')
    expect(withNote(noted, 'x')).toBe(noted)
    expect(withNote(EMPTY_LIST_STATE, null)).toBe(EMPTY_LIST_STATE)
  })

  it('a keystroke drops a note', () => {
    const noted = withNote(EMPTY_LIST_STATE, 'x')
    expect(typeInto(noted, 1, 'a', 'gl').note).toBeNull()
  })

  it('knows whether Escape has anything to undo in a row', () => {
    const typed = typeInto(EMPTY_LIST_STATE, 3, 'ab', 'gl')
    expect(hasRowEdit(typed, 3)).toBe(true)
    expect(hasRowEdit(typed, 4)).toBe(false)
    expect(hasRowEdit(refuseRow(EMPTY_LIST_STATE, 5, 'long'), 5)).toBe(true)
    expect(hasRowEdit(EMPTY_LIST_STATE, 3)).toBe(false)
  })

  it('stays small at the largest list: only touched zones are held', () => {
    let state = EMPTY_LIST_STATE
    for (const zone of [0, 3999, 2000]) state = typeInto(state, zone, 'ab', 'gl')
    expect(state.drafts.size).toBe(3)
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
