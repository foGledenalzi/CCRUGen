// REN-01: selectTier, parseTierOverride, tweenAllowed, labelsVisible, gateLayerMode and deriveBoundaries, exercised
// against small synthetic TierTable objects built by the local factory below (never the interim research table:
// engine/test/tiers.schema.test.ts owns that). No assertion here compares a measured number against a timing
// threshold; every number is chosen by the test, not by a clock (D-14, research Pitfall 10).
import { describe, expect, it } from 'vitest'
import {
  deriveBoundaries,
  gateLayerMode,
  labelsVisible,
  parseTierOverride,
  selectTier,
  tweenAllowed,
} from '../scene/tiers'
import type {
  Boundary,
  CanvasProbe,
  ChordMeasurement,
  DeviceProfile,
  EnvironmentMeta,
  MeasuredSuite,
  Stat,
  TierBudgets,
  TierMeasurement,
  TierTable,
} from '../scene/tiers'

// ---- local factory: the smallest complete TierTable, with per-test overrides ----

function makeStat(median: number): Stat {
  return { median, p95: null }
}

function makeEnv(overrides: Partial<EnvironmentMeta> = {}): EnvironmentMeta {
  return {
    cpu: 'Test CPU',
    physicalCores: 4,
    logicalThreads: 8,
    ramBytes: 17179869184,
    os: 'Test OS',
    browser: 'Test Browser',
    raster: 'software',
    gpu: null,
    cpuThrottleNominal: 1,
    cpuThrottleMeasured: 1,
    date: '2026-09-27',
    placeholder: true,
    ...overrides,
  }
}

function makeBoundary(n: number, basedOn: DeviceProfile = 'sw-6x', rule = 'test rule'): Boundary {
  return { n, basedOn, rule }
}

const DEFAULT_BUDGETS: TierBudgets = {
  mountMs: 500,
  interactionMs: 100,
  panMs: 32,
  tweenMs: 32,
  oneTimePaintMs: 500,
  chordsOverlapMax: 0.3,
  canvasTargetN: 4000,
  source: 'test budgets',
}

function makeTable(overrides: Partial<TierTable> = {}): TierTable {
  const environments: Record<DeviceProfile, EnvironmentMeta> = {
    gpu: makeEnv({ raster: 'gpu', cpuThrottleNominal: 1 }),
    sw: makeEnv({ cpuThrottleNominal: 1 }),
    'sw-4x': makeEnv({ cpuThrottleNominal: 4 }),
    'sw-6x': makeEnv({ cpuThrottleNominal: 6 }),
  }
  return {
    schemaVersion: 1,
    status: 'placeholder',
    shippedProfile: 'sw-6x',
    budgets: DEFAULT_BUDGETS,
    environments,
    measurements: [],
    chords: [],
    canvasProbes: [],
    headless: [],
    memory: {
      svgRichDomBytesPerZone: null,
      svgRichJsHeapBytesPerZone: null,
      canvasFixedBytes: null,
      basedOn: 'gpu',
      note: 'test',
    },
    boundaries: {
      svgRichMaxN: makeBoundary(100),
      svgLeanMaxN: makeBoundary(1000),
      canvasMaxN: null,
      layoutTweenMaxN: makeBoundary(500),
      allChordsMaxN: { n: 60, rule: 'test' },
      labelVisibleMinRadiusPx: 7,
      gatesFullMaxN: 40,
      gatesThinMaxN: 150,
      canvasAreaLimitPx: 268435456,
      canvasDimensionNote: 'test note',
    },
    webglDecision: { adopt: false, reason: 'test reason', reviewedAt: '2026-09-27' },
    tierOverrideParam: { enabled: true, name: 'tier', values: ['svg', 'canvas', 'headless'] },
    ...overrides,
  }
}

function measurementRow(
  profile: DeviceProfile,
  suite: MeasuredSuite,
  n: number,
  opts: { mount?: number | null; interaction?: number | null; pan?: number | null; tween?: number | null } = {},
): TierMeasurement {
  const stat = (v: number | null | undefined): Stat | null => (v === null || v === undefined ? null : makeStat(v))
  return {
    profile,
    suite,
    n,
    mountMs: stat(opts.mount ?? null),
    interactionMs: stat(opts.interaction ?? null),
    panMs: stat(opts.pan ?? null),
    tweenMs: stat(opts.tween ?? null),
    computeMs: null,
    domNodes: null,
    domBytes: null,
    jsHeapBytes: null,
  }
}

// ---- selectTier (D-13) ----

describe('selectTier', () => {
  it('an explicit override wins regardless of n or table', () => {
    const table = makeTable()
    for (const n of [2, 10 ** 6]) {
      expect(selectTier(n, table, 'canvas')).toBe('canvas')
      expect(selectTier(n, table, 'svg')).toBe('svg')
      expect(selectTier(n, table, 'headless')).toBe('headless')
    }
  })

  it('falls through svg -> canvas -> headless in n order when canvasMaxN is null', () => {
    const table = makeTable({
      boundaries: { ...makeTable().boundaries, svgRichMaxN: makeBoundary(100), canvasMaxN: null },
    })
    expect(selectTier(100, table)).toBe('svg')
    expect(selectTier(102, table)).toBe('canvas')
    expect(selectTier(10 ** 6, table)).toBe('canvas')
  })

  it('falls through to headless once canvasMaxN is set', () => {
    const table = makeTable({
      boundaries: { ...makeTable().boundaries, svgRichMaxN: makeBoundary(100), canvasMaxN: makeBoundary(4000) },
    })
    expect(selectTier(4000, table)).toBe('canvas')
    expect(selectTier(4002, table)).toBe('headless')
  })
})

// ---- parseTierOverride (D-13, T-03-05) ----

describe('parseTierOverride', () => {
  it('accepts an allowed tier string', () => {
    expect(parseTierOverride('canvas', makeTable())).toBe('canvas')
  })

  it('rejects a value outside RENDER_TIERS even if it looked plausible', () => {
    expect(parseTierOverride('webgl', makeTable())).toBeNull()
  })

  it('returns null for null or undefined', () => {
    const table = makeTable()
    expect(parseTierOverride(null, table)).toBeNull()
    expect(parseTierOverride(undefined, table)).toBeNull()
  })

  it('returns null when the override param is disabled', () => {
    const disabled = makeTable({ tierOverrideParam: { enabled: false, name: 'tier', values: ['svg', 'canvas', 'headless'] } })
    expect(parseTierOverride('svg', disabled)).toBeNull()
  })
})

// ---- tweenAllowed, labelsVisible, gateLayerMode (D-07, D-09) ----

describe('tweenAllowed', () => {
  it('true at the cutoff, false just above', () => {
    const table = makeTable({ boundaries: { ...makeTable().boundaries, layoutTweenMaxN: makeBoundary(500) } })
    expect(tweenAllowed(500, table)).toBe(true)
    expect(tweenAllowed(502, table)).toBe(false)
  })
})

describe('labelsVisible', () => {
  it('true at the threshold, false just below', () => {
    const table = makeTable({ boundaries: { ...makeTable().boundaries, labelVisibleMinRadiusPx: 7 } })
    expect(labelsVisible(7, table)).toBe(true)
    expect(labelsVisible(6.99, table)).toBe(false)
  })
})

describe('gateLayerMode', () => {
  it('on up to the full cutoff, thin between the cutoffs, off beyond both', () => {
    const table = makeTable({ boundaries: { ...makeTable().boundaries, gatesFullMaxN: 40, gatesThinMaxN: 150 } })
    expect(gateLayerMode(40, table)).toBe('on')
    expect(gateLayerMode(41, table)).toBe('thin')
    expect(gateLayerMode(150, table)).toBe('thin')
    expect(gateLayerMode(151, table)).toBe('off')
  })
})

// ---- deriveBoundaries: "longest passing prefix" of the shipped profile's rows (D-11, D-14) ----

describe('deriveBoundaries', () => {
  it('svg-rich: the boundary is the highest n of the longest passing prefix; other profiles are ignored', () => {
    const rows: TierMeasurement[] = [
      measurementRow('sw-6x', 'svg-rich', 10, { mount: 135, interaction: 13.4, pan: 3.3 }),
      measurementRow('sw-6x', 'svg-rich', 28, { mount: 209, interaction: 23.6, pan: 6.1 }),
      measurementRow('sw-6x', 'svg-rich', 64, { mount: 249, interaction: 38.1, pan: 7.9 }),
      measurementRow('sw-6x', 'svg-rich', 100, { mount: 330, interaction: 61.0, pan: 16.1 }),
      measurementRow('sw-6x', 'svg-rich', 150, { mount: 450, interaction: 79.6, pan: 63.0 }), // pan exceeds the 32 ms budget
      measurementRow('gpu', 'svg-rich', 10, { mount: 1, interaction: 1, pan: 1 }), // other profile: ignored
    ]
    const derived = deriveBoundaries({ measurements: rows, chords: [], canvasProbes: [], budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.svgRichMaxN).toBe(100)
  })

  it('a null required metric fails the row', () => {
    const rows: TierMeasurement[] = [
      measurementRow('sw-6x', 'svg-rich', 10, { mount: 100, interaction: 10, pan: 1 }),
      measurementRow('sw-6x', 'svg-rich', 20, { mount: 100, pan: 1 }), // interaction omitted -> null
    ]
    const derived = deriveBoundaries({ measurements: rows, chords: [], canvasProbes: [], budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.svgRichMaxN).toBe(10)
  })

  it('a failing first row gives 0', () => {
    const rows: TierMeasurement[] = [measurementRow('sw-6x', 'svg-rich', 10, { mount: 9999, interaction: 9999, pan: 9999 })]
    const derived = deriveBoundaries({ measurements: rows, chords: [], canvasProbes: [], budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.svgRichMaxN).toBe(0)
  })

  it('canvas: all rows passing gives canvasMaxN null and maxMeasuredN the largest measured n', () => {
    const rows: TierMeasurement[] = [
      measurementRow('sw-6x', 'canvas', 100, { mount: 21.5, pan: 21.8 }),
      measurementRow('sw-6x', 'canvas', 1000, { mount: 72.9, pan: 21.6 }),
      measurementRow('sw-6x', 'canvas', 4000, { mount: 185.5, pan: 22.0 }),
    ]
    const derived = deriveBoundaries({ measurements: rows, chords: [], canvasProbes: [], budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.canvasMaxN).toBeNull()
    expect(derived.maxMeasuredN).toBe(4000)
  })

  it('canvas: a row whose one-time paint exceeds the budget ends the prefix', () => {
    const rows: TierMeasurement[] = [
      measurementRow('sw-6x', 'canvas', 100, { mount: 21.5, pan: 21.8 }),
      measurementRow('sw-6x', 'canvas', 1000, { mount: 9999, pan: 21.6 }),
      measurementRow('sw-6x', 'canvas', 4000, { mount: 185.5, pan: 22.0 }),
    ]
    const derived = deriveBoundaries({ measurements: rows, chords: [], canvasProbes: [], budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.canvasMaxN).toBe(100)
  })

  it('tween: uses svg-rich rows up to the derived svgRichMaxN and canvas rows above it, in n order', () => {
    const rich = [
      measurementRow('sw-6x', 'svg-rich', 10, { mount: 100, interaction: 10, pan: 5, tween: 20 }),
      measurementRow('sw-6x', 'svg-rich', 100, { mount: 100, interaction: 10, pan: 5, tween: 25 }),
    ]
    const canvas = [
      measurementRow('sw-6x', 'canvas', 200, { mount: 50, pan: 10, tween: 30 }),
      measurementRow('sw-6x', 'canvas', 300, { mount: 50, pan: 10, tween: 40 }), // exceeds the 32 ms tween budget
    ]
    const derived = deriveBoundaries({
      measurements: [...rich, ...canvas],
      chords: [],
      canvasProbes: [],
      budgets: DEFAULT_BUDGETS,
      shippedProfile: 'sw-6x',
    })
    expect(derived.svgRichMaxN).toBe(100)
    expect(derived.layoutTweenMaxN).toBe(200)
  })

  it('chords: the boundary is the last n before overlapShare reaches the budget', () => {
    const chords: ChordMeasurement[] = [
      { n: 10, chords: 45, paintMs: 84.5, overlapShare: 0.0 },
      { n: 30, chords: 435, paintMs: 2.3, overlapShare: 0.008 },
      { n: 50, chords: 1225, paintMs: 3.1, overlapShare: 0.117 },
      { n: 60, chords: 1770, paintMs: 3.4, overlapShare: 0.296 },
      { n: 80, chords: 3160, paintMs: 4.2, overlapShare: 0.742 },
    ]
    const derived = deriveBoundaries({
      measurements: [],
      chords,
      canvasProbes: [],
      budgets: { ...DEFAULT_BUDGETS, chordsOverlapMax: 0.3 },
      shippedProfile: 'sw-6x',
    })
    expect(derived.allChordsMaxN).toBe(60)
  })

  it('area: the limit is the largest width x height among ok probes', () => {
    const canvasProbes: CanvasProbe[] = [
      { width: 16384, height: 16384, ok: true },
      { width: 32767, height: 8192, ok: true },
      { width: 16385, height: 16384, ok: false },
    ]
    const derived = deriveBoundaries({ measurements: [], chords: [], canvasProbes, budgets: DEFAULT_BUDGETS, shippedProfile: 'sw-6x' })
    expect(derived.canvasAreaLimitPx).toBe(268435456)
  })
})
