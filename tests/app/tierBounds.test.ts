// Tests for app/lib/tierBounds.ts (REN-01 data, D-14..D-18). Every threshold is read from the engine's TIER_TABLE,
// never a hard-coded number.
import { describe, expect, it } from 'vitest'
import { TIER_TABLE, gateLayerMode, labelsVisible, tweenAllowed } from '../../engine/index'
import {
  ALL_CHORDS_MAX_N,
  SVG_RICH_MAX_N,
  TIER_VIEW,
  gateMode,
  labelsShown,
  mayTween,
  tierFor,
  tierOverrideFrom,
} from '../../app/lib/tierBounds'

describe('TIER_VIEW', () => {
  it('deep-equals the boundaries and tierOverrideParam of TIER_TABLE', () => {
    expect(TIER_VIEW.boundaries).toEqual(TIER_TABLE.boundaries)
    expect(TIER_VIEW.tierOverrideParam).toEqual(TIER_TABLE.tierOverrideParam)
  })

  it('SVG_RICH_MAX_N and ALL_CHORDS_MAX_N equal the table', () => {
    expect(SVG_RICH_MAX_N).toBe(TIER_TABLE.boundaries.svgRichMaxN.n)
    expect(ALL_CHORDS_MAX_N).toBe(TIER_TABLE.boundaries.allChordsMaxN.n)
  })
})

describe('tierFor', () => {
  it('svg at the rich boundary, not svg two zones past it, override wins', () => {
    expect(tierFor(SVG_RICH_MAX_N)).toBe('svg')
    expect(tierFor(SVG_RICH_MAX_N + 2)).not.toBe('svg')
    expect(tierFor(1024, 'svg')).toBe('svg')
  })
})

describe('tierOverrideFrom', () => {
  it('accepts an allowed value, rejects an unknown one or null', () => {
    expect(tierOverrideFrom('svg')).toBe('svg')
    expect(tierOverrideFrom('bogus')).toBeNull()
    expect(tierOverrideFrom(null)).toBeNull()
    expect(tierOverrideFrom(undefined)).toBeNull()
  })
})

describe('mayTween / labelsShown / gateMode agree with the engine at boundary values', () => {
  it('mayTween matches tweenAllowed at and past the boundary', () => {
    const n = TIER_TABLE.boundaries.layoutTweenMaxN.n
    expect(mayTween(n)).toBe(tweenAllowed(n, TIER_TABLE))
    expect(mayTween(n + 2)).toBe(tweenAllowed(n + 2, TIER_TABLE))
  })

  it('labelsShown matches labelsVisible at and below the boundary', () => {
    const px = TIER_TABLE.boundaries.labelVisibleMinRadiusPx
    expect(labelsShown(px)).toBe(labelsVisible(px, TIER_TABLE))
    expect(labelsShown(px - 1)).toBe(labelsVisible(px - 1, TIER_TABLE))
  })

  it('gateMode matches gateLayerMode at the full and thin boundaries', () => {
    const full = TIER_TABLE.boundaries.gatesFullMaxN
    const thin = TIER_TABLE.boundaries.gatesThinMaxN
    expect(gateMode(full)).toBe(gateLayerMode(full, TIER_TABLE))
    expect(gateMode(thin)).toBe(gateLayerMode(thin, TIER_TABLE))
    expect(gateMode(thin + 2)).toBe(gateLayerMode(thin + 2, TIER_TABLE))
  })
})
