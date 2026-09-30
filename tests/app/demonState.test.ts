// Tests for app/lib/demonState.ts: the shared demon focus/tab model, URL tokens, bounded chord list, base-switch
// sanitation rule (D-03, DEM-03, D-07, UI-08 precedent). T-05-12..T-05-15/T-05-26 hostile-input and DoS-bound cases
// are exercised directly here since this module is the one place they are enforced before any engine call.
import { describe, expect, it } from 'vitest'
import { createNumogram, DEMON_SUBTYPES, DEMON_TYPES } from '../../engine/index'
import { legacyDemon, type DemonFilter } from '../../app/lib/demonBrowser'
import {
  DEMON_PARAM_MAX_LENGTH,
  DEMON_TABS,
  DEMON_TAB_LABEL,
  FOCUS_CHORD_DRAW_MAX,
  demonFocusOf,
  demonsAfterBaseSwitch,
  focusChordList,
  focusDemonRef,
  focusDrawPlan,
  focusZones,
  formatDemonFocus,
  initialDemonTab,
  parseDemonFilter,
  parseDemonFocus,
  sameFocus,
  zoneFocus,
  type DemonFocus,
  type DemonSessionState,
} from '../../app/lib/demonState'

describe('DEMON_TABS / DEMON_TAB_LABEL', () => {
  it('are the three fixed tabs with labels', () => {
    expect(DEMON_TABS).toEqual(['browser', 'focus', 'matrix'])
    expect(DEMON_TAB_LABEL).toEqual({ browser: 'Browser', focus: 'Focus', matrix: 'Matrix' })
  })
})

describe('DEMON_PARAM_MAX_LENGTH / FOCUS_CHORD_DRAW_MAX', () => {
  it('are the documented constants', () => {
    expect(DEMON_PARAM_MAX_LENGTH).toBe(40)
    expect(FOCUS_CHORD_DRAW_MAX).toBe(4096)
  })
})

describe('zoneFocus / demonFocusOf / sameFocus', () => {
  it('zoneFocus builds a zone focus', () => {
    expect(zoneFocus(12)).toEqual({ kind: 'zone', zone: 12 })
  })

  it('demonFocusOf normalizes a > b regardless of input order', () => {
    expect(demonFocusOf({ a: 3, b: 12 })).toEqual({ kind: 'demon', a: 12, b: 3 })
    expect(demonFocusOf({ a: 12, b: 3 })).toEqual({ kind: 'demon', a: 12, b: 3 })
  })

  it('sameFocus compares by value, treats null as equal only to null', () => {
    expect(sameFocus(zoneFocus(3), zoneFocus(3))).toBe(true)
    expect(sameFocus(zoneFocus(3), demonFocusOf({ a: 3, b: 1 }))).toBe(false)
    expect(sameFocus(null, null)).toBe(true)
    expect(sameFocus(zoneFocus(3), null)).toBe(false)
    expect(sameFocus(null, zoneFocus(3))).toBe(false)
  })
})

describe('formatDemonFocus / parseDemonFocus round trip', () => {
  it('formats a zone focus as z:<zone> and a demon focus as <a>::<b>', () => {
    expect(formatDemonFocus(zoneFocus(12))).toBe('z:12')
    expect(formatDemonFocus(demonFocusOf({ a: 12, b: 3 }))).toBe('12::3')
  })

  it('round-trips through parseDemonFocus for every zone and every pair a > b at base 12', () => {
    const base = 12
    for (let zone = 0; zone < base; zone++) {
      const f = zoneFocus(zone)
      expect(parseDemonFocus(formatDemonFocus(f), base)).toEqual(f)
    }
    for (let a = 1; a < base; a++) {
      for (let b = 0; b < a; b++) {
        const f = demonFocusOf({ a, b })
        expect(parseDemonFocus(formatDemonFocus(f), base)).toEqual(f)
      }
    }
  })
})

describe('parseDemonFocus: zone tokens (T-05-13)', () => {
  it('parses a well-formed zone token, trimming whitespace', () => {
    expect(parseDemonFocus('z:12', 28)).toEqual({ kind: 'zone', zone: 12 })
    expect(parseDemonFocus(' z:5 ', 28)).toEqual({ kind: 'zone', zone: 5 })
  })

  it('rejects a zone at or beyond the base, negative, fractional or absurdly long', () => {
    expect(parseDemonFocus('z:28', 28)).toBeNull()
    expect(parseDemonFocus('z:-1', 28)).toBeNull()
    expect(parseDemonFocus('z:1.5', 28)).toBeNull()
    expect(parseDemonFocus('z:' + '9'.repeat(50), 28)).toBeNull()
  })
})

describe('parseDemonFocus: demon tokens (T-05-13)', () => {
  it('parses <a>::<b> in either order, normalizing to a > b', () => {
    expect(parseDemonFocus('12::3', 28)).toEqual({ kind: 'demon', a: 12, b: 3 })
    expect(parseDemonFocus('3::12', 28)).toEqual({ kind: 'demon', a: 12, b: 3 })
  })

  it('rejects equal zones, out-of-range zones, hostile strings, null, empty and overlong values', () => {
    expect(parseDemonFocus('3::3', 28)).toBeNull()
    expect(parseDemonFocus('28::3', 28)).toBeNull()
    expect(parseDemonFocus('__proto__', 28)).toBeNull()
    expect(parseDemonFocus(null, 28)).toBeNull()
    expect(parseDemonFocus('', 28)).toBeNull()
    expect(parseDemonFocus('1'.repeat(41), 28)).toBeNull()
  })

  it('never throws on any hostile input', () => {
    const hostiles = ['constructor', '::','z:', 'z:z', '1::', '::1', '9'.repeat(5000), '\u202e', 'z:\u202e']
    for (const raw of hostiles) {
      expect(() => parseDemonFocus(raw, 28)).not.toThrow()
    }
  })
})

describe('parseDemonFilter', () => {
  const ALL_FILTERS: readonly DemonFilter[] = [...DEMON_TYPES, ...DEMON_SUBTYPES]

  it('returns each of the 10 engine names for itself', () => {
    expect(ALL_FILTERS.length).toBe(10)
    for (const filter of ALL_FILTERS) {
      expect(parseDemonFilter(filter)).toBe(filter)
    }
  })

  it('trims whitespace around a valid name', () => {
    expect(parseDemonFilter(' chrono ')).toBe('chrono')
  })

  it('drops case-mismatched, hostile, empty and null values without ever using them as a property key', () => {
    for (const raw of ['Chrono', '__proto__', 'constructor', 'bogus', '']) {
      expect(parseDemonFilter(raw)).toBeNull()
    }
    expect(parseDemonFilter(null)).toBeNull()
  })
})

describe('focusZones', () => {
  it('null -> [], zone -> [zone], demon -> [a, b]', () => {
    expect(focusZones(null)).toEqual([])
    expect(focusZones(zoneFocus(7))).toEqual([7])
    expect(focusZones(demonFocusOf({ a: 12, b: 3 }))).toEqual([12, 3])
  })
})

describe('focusDemonRef', () => {
  it('resolves a demon focus to the engine ref, and is null for a zone focus or no focus', () => {
    const g28 = createNumogram(28)
    const ref = focusDemonRef(g28, demonFocusOf({ a: 12, b: 3 }))
    expect(ref).toEqual(g28.demons.ref(12, 3))
    expect(focusDemonRef(g28, zoneFocus(5))).toBeNull()
    expect(focusDemonRef(g28, null)).toBeNull()
  })
})

describe('focusDrawPlan', () => {
  it('a zone focus at a small base draws every incident demon (stride 1)', () => {
    expect(focusDrawPlan(28, zoneFocus(0))).toEqual({ total: 27, stride: 1, drawn: 27 })
    expect(focusDrawPlan(666, zoneFocus(0))).toEqual({ total: 665, stride: 1, drawn: 665 })
  })

  it('a zone focus at a huge base strides down to at most FOCUS_CHORD_DRAW_MAX', () => {
    const base = 1048576
    const total = base - 1
    const stride = Math.max(1, Math.ceil(total / FOCUS_CHORD_DRAW_MAX))
    const drawn = Math.ceil(total / stride)
    expect(focusDrawPlan(base, zoneFocus(0))).toEqual({ total, stride, drawn })
    expect(drawn).toBeLessThanOrEqual(FOCUS_CHORD_DRAW_MAX)
  })

  it('a demon focus is always exactly one chord, at any base', () => {
    expect(focusDrawPlan(28, demonFocusOf({ a: 12, b: 3 }))).toEqual({ total: 1, stride: 1, drawn: 1 })
    expect(focusDrawPlan(1048576, demonFocusOf({ a: 12, b: 3 }))).toEqual({ total: 1, stride: 1, drawn: 1 })
  })
})

describe('focusChordList', () => {
  it('a zone focus at base 28 matches g.demons.incident(zone) element for element', () => {
    const g28 = createNumogram(28)
    const expected = [...g28.demons.incident(12)].map(d => legacyDemon(d, 28))
    const list = focusChordList(g28, zoneFocus(12))
    expect(list).toEqual(expected)
    expect(list.length).toBe(27)
  })

  it('a demon focus at base 28 is a single legacy-demon entry', () => {
    const g28 = createNumogram(28)
    const list = focusChordList(g28, demonFocusOf({ a: 3, b: 12 }))
    expect(list).toEqual([{ a: 12, b: 3, name: 'c::3', kind: 'chrono' }])
  })

  it('a zone focus at base 10 carries base-10 lore names', () => {
    const g10 = createNumogram(10)
    const list = focusChordList(g10, zoneFocus(5))
    expect(list.length).toBe(9)
    for (const demon of list) {
      expect(typeof demon.name).toBe('string')
      expect(demon.name.length).toBeGreaterThan(0)
    }
  })

  it('never exceeds FOCUS_CHORD_DRAW_MAX entries, even at base 2^20', () => {
    const g = createNumogram(1048576)
    const list = focusChordList(g, zoneFocus(0))
    expect(list.length).toBeLessThanOrEqual(FOCUS_CHORD_DRAW_MAX)
  })
})

describe('demonsAfterBaseSwitch (T-05-15)', () => {
  it('clears the focus always, and drops a filter with 0 members at the new base', () => {
    const prev: DemonSessionState = { filter: 'warp-amphi', focus: zoneFocus(3) }
    const g666 = createNumogram(666)
    expect(demonsAfterBaseSwitch(prev, g666)).toEqual({ filter: null, focus: null })
  })

  it('keeps a filter that still has members at the new base', () => {
    const prev: DemonSessionState = { filter: 'cross-torque-chrono', focus: null }
    const g28 = createNumogram(28)
    expect(demonsAfterBaseSwitch(prev, g28)).toEqual({ filter: 'cross-torque-chrono', focus: null })
  })

  it('drops cross-torque-chrono at base 10 (single Torque cycle, 0 cross-Torque members)', () => {
    const prev: DemonSessionState = { filter: 'cross-torque-chrono', focus: null }
    const g10 = createNumogram(10)
    expect(demonsAfterBaseSwitch(prev, g10)).toEqual({ filter: null, focus: null })
  })

  it('a kept filter still clears an existing demon focus', () => {
    const prev: DemonSessionState = { filter: 'chrono', focus: demonFocusOf({ a: 5, b: 2 }) }
    const g28 = createNumogram(28)
    expect(demonsAfterBaseSwitch(prev, g28)).toEqual({ filter: 'chrono', focus: null })
  })
})

describe('initialDemonTab', () => {
  it('a zone focus opens the Focus tab; no focus or a demon focus opens the Browser tab', () => {
    expect(initialDemonTab(null)).toBe('browser')
    expect(initialDemonTab(zoneFocus(3))).toBe('focus')
    expect(initialDemonTab(demonFocusOf({ a: 5, b: 2 }))).toBe('browser')
  })
})
