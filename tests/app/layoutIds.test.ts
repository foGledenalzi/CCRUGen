// Tests for app/lib/layoutIds.ts (LAY-02, D-05, T-03-19).
import { describe, expect, it } from 'vitest'
import {
  BASE10_PRESET_LAYOUT_IDS,
  LAYOUT_LABELS,
  VIEW_LAYOUT_IDS,
  defaultLayoutFor,
  isLayoutIdFor,
  isPresetLayoutId,
  layoutIdsForBase,
  layoutShortcut,
} from '../../app/lib/layoutIds'

describe('constants', () => {
  it('BASE10_PRESET_LAYOUT_IDS and VIEW_LAYOUT_IDS', () => {
    expect(BASE10_PRESET_LAYOUT_IDS).toEqual(['original', 'labyrinth', 'ladder', 'planetary'])
    expect(VIEW_LAYOUT_IDS).toEqual(['original', 'labyrinth', 'ladder', 'planetary', 'ring', 'spiral', 'pairGraph'])
  })
})

describe('layoutIdsForBase', () => {
  it('base 10: the four presets, then ring, spiral, pairGraph', () => {
    expect(layoutIdsForBase(10)).toEqual(['original', 'labyrinth', 'ladder', 'planetary', 'ring', 'spiral', 'pairGraph'])
  })

  it('base 28: no presets — ring, ladder, spiral, pairGraph', () => {
    expect(layoutIdsForBase(28)).toEqual(['ring', 'ladder', 'spiral', 'pairGraph'])
  })
})

describe('defaultLayoutFor', () => {
  it('base 10 defaults to original, every other base to ring', () => {
    expect(defaultLayoutFor(10)).toBe('original')
    expect(defaultLayoutFor(28)).toBe('ring')
  })
})

describe('isLayoutIdFor', () => {
  it('a base-10-only preset is not valid at another base', () => {
    expect(isLayoutIdFor('planetary', 28)).toBe(false)
  })

  it('an unrecognised string, including a prototype key, is never valid', () => {
    expect(isLayoutIdFor('__proto__', 10)).toBe(false)
  })
})

describe('isPresetLayoutId', () => {
  it('ladder is a preset only at base 10; ring is never a preset', () => {
    expect(isPresetLayoutId('ladder', 10)).toBe(true)
    expect(isPresetLayoutId('ladder', 28)).toBe(false)
    expect(isPresetLayoutId('ring', 10)).toBe(false)
  })
})

describe('LAYOUT_LABELS', () => {
  it('original is the topbar hover label the frozen baseline records', () => {
    expect(LAYOUT_LABELS.original).toBe('original')
  })
})

describe('layoutShortcut', () => {
  it('base 10: a/s/d/f for the four presets, null past that', () => {
    expect(layoutShortcut('original', 10)).toBe('a')
    expect(layoutShortcut('labyrinth', 10)).toBe('s')
    expect(layoutShortcut('ladder', 10)).toBe('d')
    expect(layoutShortcut('planetary', 10)).toBe('f')
    expect(layoutShortcut('ring', 10)).toBeNull()
  })

  it('base 28: a/s/d/f for ring/ladder/spiral/pairGraph', () => {
    expect(layoutShortcut('ring', 28)).toBe('a')
    expect(layoutShortcut('ladder', 28)).toBe('s')
    expect(layoutShortcut('spiral', 28)).toBe('d')
    expect(layoutShortcut('pairGraph', 28)).toBe('f')
  })
})
