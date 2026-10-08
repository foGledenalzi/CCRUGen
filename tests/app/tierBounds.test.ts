// Tests for app/lib/tierBounds.ts (REN-01 data, D-14..D-18). Every threshold is read from the engine's TIER_TABLE,
// never a hard-coded number.
import { describe, expect, it } from 'vitest'
import { TIER_TABLE, gateLayerMode, interactiveCeiling, labelsVisible, tweenAllowed } from '../../engine/index'
import {
  ALL_CHORDS_MAX_N,
  CANVAS_AREA_LIMIT_PX,
  INTERACTIVE_MAX_N,
  LABEL_MIN_RADIUS_PX,
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

  it('INTERACTIVE_MAX_N is the shipped interactive ceiling of the table (D-01), not a constant of its own', () => {
    const im = TIER_TABLE.boundaries.interactiveMaxN
    if (im === undefined) throw new Error('interactiveMaxN is missing from the shipped table')
    expect(INTERACTIVE_MAX_N).toBe(im.n)
    expect(INTERACTIVE_MAX_N).toBe(interactiveCeiling(TIER_TABLE))
    expect(INTERACTIVE_MAX_N).toBeGreaterThan(SVG_RICH_MAX_N)
  })

  it('LABEL_MIN_RADIUS_PX and CANVAS_AREA_LIMIT_PX equal the table', () => {
    expect(LABEL_MIN_RADIUS_PX).toBe(TIER_TABLE.boundaries.labelVisibleMinRadiusPx)
    expect(CANVAS_AREA_LIMIT_PX).toBe(TIER_TABLE.boundaries.canvasAreaLimitPx)
  })

  it('the ceiling follows the data: an injected table changes interactiveCeiling', () => {
    const injected = {
      boundaries: { ...TIER_TABLE.boundaries, interactiveMaxN: { n: 1234, basedOn: 'sw-6x' as const, rule: 'x' } },
    }
    expect(interactiveCeiling(injected)).toBe(1234)
    expect(interactiveCeiling(injected)).not.toBe(INTERACTIVE_MAX_N)
  })
})

describe('tierFor', () => {
  it('svg at the rich boundary, not svg two zones past it, override wins', () => {
    expect(tierFor(SVG_RICH_MAX_N)).toBe('svg')
    expect(tierFor(SVG_RICH_MAX_N + 2)).not.toBe('svg')
    expect(tierFor(1024, 'svg')).toBe('svg')
  })

  it('canvas right after the rich boundary (no lean tier, D-03), up to the interactive ceiling', () => {
    expect(tierFor(SVG_RICH_MAX_N + 2)).toBe('canvas')
    expect(tierFor(INTERACTIVE_MAX_N)).toBe('canvas')
  })

  it('headless just above the interactive ceiling and at the engine maximum', () => {
    expect(tierFor(INTERACTIVE_MAX_N + 2)).toBe('headless')
    expect(tierFor(2 ** 26)).toBe('headless')
  })

  it('the tier= override still wins above the ceiling and below the rich boundary', () => {
    expect(tierFor(INTERACTIVE_MAX_N + 2, 'canvas')).toBe('canvas')
    expect(tierFor(INTERACTIVE_MAX_N + 2, 'svg')).toBe('svg')
    expect(tierFor(2, 'headless')).toBe('headless')
    expect(tierFor(INTERACTIVE_MAX_N + 2, null)).toBe('headless')
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
