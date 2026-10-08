// URL codec never builds a numogram for a base above the interactive ceiling (Phase 6 P6, plan 06-09, T-06-01d):
// `region=`, `isolate=` and `mute=` need a Numogram to validate their ids, and building one on the main thread at
// 2^26 zones is a freeze (about 0.6 s and +271 MiB measured). Above the ceiling there is no diagram and no region
// view, so those three fields are dropped; the guard keys on the NATURAL tier (the `tier=` diagnostic override is
// ignored) so small-base URLs keep their exact codec behaviour and tests/app/shareParams.test.ts stays untouched.
// createNumogram is spied through vi.mock, so "not built" is proven by call count, not by timing.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../engine/index', async importOriginal => {
  const m = await importOriginal<typeof import('../../engine/index')>()
  return { ...m, createNumogram: vi.fn(m.createNumogram) }
})

import { createNumogram } from '../../engine/index'
import { parseShareParams } from '../../app/lib/shareParams'
import { INTERACTIVE_MAX_N, tierFor } from '../../app/lib/tierBounds'

const MAX_SAFE_BASE = 67_108_864 // 2^26, the engine's own ceiling for a typed base

const spy = vi.mocked(createNumogram)

beforeEach(() => {
  spy.mockClear()
})

describe('parseShareParams above the interactive ceiling', () => {
  it('the bases used here really are headless at their natural tier', () => {
    expect(tierFor(INTERACTIVE_MAX_N)).toBe('canvas')
    expect(tierFor(INTERACTIVE_MAX_N + 2)).toBe('headless')
    expect(tierFor(MAX_SAFE_BASE)).toBe('headless')
  })

  it('drops region=, isolate= and mute= one step above the ceiling and never builds a numogram', () => {
    const { state } = parseShareParams(`?base=${INTERACTIVE_MAX_N + 2}&region=plex&isolate=plex&mute=warp`)
    expect(state.base).toBe(INTERACTIVE_MAX_N + 2)
    expect(state.region).toBeNull()
    expect(state.isolate).toEqual([])
    expect(state.mute).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('drops them at 2^26 too, without the 0.6 s build', () => {
    const { state } = parseShareParams(`?base=${MAX_SAFE_BASE}&region=plex&isolate=plex&mute=warp`)
    expect(state.base).toBe(MAX_SAFE_BASE)
    expect(state.region).toBeNull()
    expect(state.isolate).toEqual([])
    expect(state.mute).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps every other field: base, selected, layers, labels and tier still parse', () => {
    const { state, baseRefusal } = parseShareParams(`?base=${MAX_SAFE_BASE}&selected=5&tc=1`)
    expect(baseRefusal).toBeNull()
    expect(state.base).toBe(MAX_SAFE_BASE)
    expect(state.selected).toEqual([5])
    expect(state.tc).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores the tier= override in the guard: a huge base stays guarded even with tier=svg', () => {
    const { state } = parseShareParams(`?base=${INTERACTIVE_MAX_N + 2}&tier=svg&region=plex`)
    expect(state.tier).toBe('svg')
    expect(state.region).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('parseShareParams at the canvas and svg tiers', () => {
  it('still validates region ids against a built numogram (svg tier)', () => {
    const { state } = parseShareParams('?base=28&region=plex')
    expect(state.region).toBe('plex')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('still validates region, isolate and mute at the top of the canvas tier', () => {
    const { state } = parseShareParams(`?base=${INTERACTIVE_MAX_N}&region=plex&isolate=plex&mute=plex`)
    expect(state.region).toBe('plex')
    expect(state.isolate).toEqual(['plex'])
    expect(state.mute).toEqual(['plex'])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('builds nothing when no region field is present', () => {
    parseShareParams('?base=28&selected=3')
    expect(spy).not.toHaveBeenCalled()
  })

  it('uses the NATURAL tier only: tier=headless at a small base keeps today\'s region behaviour', () => {
    const { state } = parseShareParams('?base=28&tier=headless&region=plex')
    expect(state.tier).toBe('headless')
    expect(state.region).toBe('plex')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
