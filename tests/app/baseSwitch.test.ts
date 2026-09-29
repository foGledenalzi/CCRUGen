// Tests for app/lib/baseSwitch.ts (UI-08, research Pattern 4).
import { describe, expect, it } from 'vitest'
import { nextLayoutForBase, sessionAfterBaseSwitch, type SessionResetState } from '../../app/lib/baseSwitch'

describe('nextLayoutForBase', () => {
  it('keeps a layout that is still offered at the new base', () => {
    expect(nextLayoutForBase('ring', 28)).toBe('ring')
    expect(nextLayoutForBase('pairGraph', 12)).toBe('pairGraph')
    expect(nextLayoutForBase('labyrinth', 10)).toBe('labyrinth')
    expect(nextLayoutForBase('ring', 10)).toBe('ring')
  })

  it('falls back to the new base\'s default when the layout no longer applies', () => {
    expect(nextLayoutForBase('planetary', 28)).toBe('ring')
    expect(nextLayoutForBase('original', 28)).toBe('ring')
  })
})

describe('sessionAfterBaseSwitch', () => {
  it('clears every base-shaped field and keeps a still-valid layout', () => {
    const prev: SessionResetState = {
      layout: 'labyrinth',
      selected: [3, 5],
      hlRegion: 'torque',
      tcActive: true,
      orbiting: true,
      pinned: true,
      isolate: ['torque:0'],
      mute: ['plex'],
    }
    expect(sessionAfterBaseSwitch(prev, 28)).toEqual({
      layout: 'ring',
      selected: [],
      hlRegion: null,
      tcActive: false,
      orbiting: false,
      pinned: false,
      isolate: [],
      mute: [],
    })
  })

  it('keeps the layout when it is still offered at the new base', () => {
    const prev: SessionResetState = {
      layout: 'ring',
      selected: [],
      hlRegion: null,
      tcActive: false,
      orbiting: false,
      pinned: false,
      isolate: [],
      mute: [],
    }
    expect(sessionAfterBaseSwitch(prev, 28).layout).toBe('ring')
  })

  it('clears a non-empty isolate/mute filter even when the layout stays the same', () => {
    const prev: SessionResetState = {
      layout: 'ring',
      selected: [],
      hlRegion: null,
      tcActive: false,
      orbiting: false,
      pinned: false,
      isolate: ['torque:2', 'warp'],
      mute: ['torque:0'],
    }
    const next = sessionAfterBaseSwitch(prev, 64)
    expect(next.isolate).toEqual([])
    expect(next.mute).toEqual([])
  })
})
