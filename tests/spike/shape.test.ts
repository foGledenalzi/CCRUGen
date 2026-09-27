// Pure-shaping tests for scripts/spike/shape.ts (REN-01, D-09, D-11, D-12, D-14): shapeTierTable turns raw
// .spike/raw/*.jsonl records into the measured TierTable that engine/scene/tiers.ts's own deriveBoundaries and
// validateTierTable already govern. No test here reads a clock, launches a browser, or compares a measured number
// with a timing threshold -- every millisecond value below is chosen by the test itself (D-14, research Pitfall 10).
import { describe, expect, it } from 'vitest'
import { DEVICE_PROFILES, MEASURED_SUITES, TIER_TABLE, deriveBoundaries, validateTierTable } from '../../engine/index'
import type { TierTable } from '../../engine/index'
import { parseJsonl, shapeTierTable } from '../../scripts/spike/shape'

type ShapeInput = Parameters<typeof shapeTierTable>[0]

const PROFILES = ['gpu', 'sw', 'sw-4x', 'sw-6x'] as const
const CALIB_MS: Record<(typeof PROFILES)[number], number> = { gpu: 100, sw: 100, 'sw-4x': 414, 'sw-6x': 635 }

function env(profile: string, throttleNominal: number): Record<string, unknown> {
  return {
    profile,
    cpu: 'Test CPU',
    physicalCores: 6,
    logicalThreads: 12,
    ramBytes: 17179869184,
    os: 'Test OS',
    browser: 'Test Browser',
    raster: profile === 'gpu' ? 'gpu' : 'software',
    gpu: profile === 'gpu' ? 'Test GPU' : 'SwiftShader',
    cpuThrottleNominal: throttleNominal,
    crossOriginIsolated: true,
    date: '2026-09-27',
  }
}

function envs(): Record<string, unknown>[] {
  return [env('gpu', 1), env('sw', 1), env('sw-4x', 4), env('sw-6x', 6)]
}

function calibRecords(): Record<string, unknown>[] {
  return PROFILES.map(p => ({ suite: 'calib', profile: p, n: null, jsLoopMs: CALIB_MS[p] }))
}

function stat(median: number): { median: number; p95: null } {
  return { median, p95: null }
}

// sw-6x svg-rich rows: n=10/28/64 pass the carried-over placeholder budgets (mount<=500, interaction<=100,
// pan<=32 ms); n=100 fails on interaction (150 > 100) so the longest passing prefix ends at n=64.
const SW6X_SVG_RICH: ReadonlyArray<{ n: number; mount: number; interaction: number; pan: number }> = [
  { n: 10, mount: 135, interaction: 13.4, pan: 3.3 },
  { n: 28, mount: 209, interaction: 23.6, pan: 6.1 },
  { n: 64, mount: 249, interaction: 38.1, pan: 7.9 },
  { n: 100, mount: 330, interaction: 150, pan: 16.1 },
]

function svgRow(
  profile: string,
  suite: 'svg-rich' | 'svg-lean',
  n: number,
  opts: { mount: number; interaction: number; pan: number; tween?: number; domNodes?: number; domBytes?: number; jsHeapBytes?: number },
): Record<string, unknown> {
  return {
    suite,
    profile,
    n,
    computeMs: stat(1),
    mountMs: stat(opts.mount),
    interactionMs: stat(opts.interaction),
    panMs: stat(opts.pan),
    tweenMs: opts.tween === undefined ? null : stat(opts.tween),
    domNodes: opts.domNodes ?? n * 20,
    domBytes: opts.domBytes ?? null,
    jsHeapBytes: opts.jsHeapBytes ?? null,
  }
}

function canvasRow(profile: string, n: number, opts: { mount: number; pan?: number; tween?: number; jsHeapBytes?: number }): Record<string, unknown> {
  return {
    suite: 'canvas',
    profile,
    n,
    computeMs: stat(1),
    mountMs: stat(opts.mount),
    interactionMs: null,
    panMs: opts.pan === undefined ? null : stat(opts.pan),
    tweenMs: opts.tween === undefined ? null : stat(opts.tween),
    domNodes: null,
    domBytes: null,
    jsHeapBytes: opts.jsHeapBytes ?? null,
  }
}

/** Every profile gets the same easily-passing shape except sw-6x, which carries the boundary-setting numbers. */
function baseMeasurementRecords(): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []
  for (const p of PROFILES) {
    for (const row of SW6X_SVG_RICH) {
      const vals = p === 'sw-6x' ? row : { n: row.n, mount: 5, interaction: 1, pan: 1 }
      records.push(svgRow(p, 'svg-rich', vals.n, vals))
      records.push(svgRow(p, 'svg-lean', vals.n, vals))
      records.push(canvasRow(p, vals.n, { mount: vals.mount, pan: vals.pan }))
    }
  }
  return records
}

function chordRecords(): Record<string, unknown>[] {
  return [
    { suite: 'chords', profile: 'gpu', n: 10, chords: 45, paintMs: 84.5, overlapShare: 0.0 },
    { suite: 'chords', profile: 'gpu', n: 30, chords: 435, paintMs: 2.3, overlapShare: 0.008 },
    { suite: 'chords', profile: 'gpu', n: 60, chords: 1770, paintMs: 3.4, overlapShare: 0.296 },
    { suite: 'chords', profile: 'gpu', n: 80, chords: 3160, paintMs: 4.2, overlapShare: 0.742 },
  ]
}

function limitsRecord(): Record<string, unknown> {
  return {
    suite: 'limits',
    profile: 'gpu',
    n: null,
    probes: [
      { width: 16384, height: 16384, ok: true },
      { width: 65535, height: 1, ok: true },
      { width: 16385, height: 16384, ok: false },
    ],
  }
}

function headlessRecords(): Record<string, unknown>[] {
  return [
    { suite: 'headless', n: 100, layoutMs: 2, routeMs: 2, emitMs: 1, svgBytes: 60000, rssDeltaBytes: 1048576 },
    { suite: 'headless', n: 1000, layoutMs: 1, routeMs: 5, emitMs: 5, svgBytes: 580000, rssDeltaBytes: 8388608 },
  ]
}

function baseInput(): ShapeInput {
  return {
    records: [...calibRecords(), ...baseMeasurementRecords(), ...chordRecords(), limitsRecord()],
    envs: envs(),
    headless: headlessRecords(),
    previous: TIER_TABLE as TierTable,
  }
}

function lexLE(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av < bv
  }
  return true
}

describe('parseJsonl', () => {
  it('ignores blank lines and returns one object per line', () => {
    const text = '{"a":1}\n\n{"b":2}\n   \n{"c":3}\n'
    expect(parseJsonl(text)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseJsonl('')).toEqual([])
  })
})

describe('shapeTierTable', () => {
  it('shapes a full four-profile run into a table that validates with no problems', () => {
    const table = shapeTierTable(baseInput())
    expect(table.status).toBe('measured')
    expect(table.shippedProfile).toBe('sw-6x')
    for (const p of PROFILES) expect(table.environments[p].placeholder).toBe(false)
    expect(table.environments.gpu.cpuThrottleMeasured).toBe(1)
    expect(table.environments.sw.cpuThrottleMeasured).toBe(1)
    expect(table.environments['sw-4x'].cpuThrottleMeasured).toBe(4.14)
    expect(table.environments['sw-6x'].cpuThrottleMeasured).toBe(6.35)
    expect(validateTierTable(table)).toEqual([])
  })

  it('sets schemaVersion 1 and the tier= override unconditionally enabled', () => {
    const table = shapeTierTable(baseInput())
    expect(table.schemaVersion).toBe(1)
    expect(table.tierOverrideParam).toEqual({ enabled: true, name: 'tier', values: ['svg', 'canvas', 'headless'] })
  })

  it('derives boundaries from its own shaped rows via the engine\'s own deriveBoundaries, sw-6x-based', () => {
    const table = shapeTierTable(baseInput())
    const derived = deriveBoundaries({
      measurements: table.measurements,
      chords: table.chords,
      canvasProbes: table.canvasProbes,
      budgets: table.budgets,
      shippedProfile: table.shippedProfile,
    })
    expect(table.boundaries.svgRichMaxN.n).toBe(derived.svgRichMaxN)
    expect(table.boundaries.svgRichMaxN.basedOn).toBe('sw-6x')
    expect(table.boundaries.svgRichMaxN.n).toBe(64)
  })

  it('sorts measurement rows by profile order, then suite order, then n', () => {
    const table = shapeTierTable(baseInput())
    for (let i = 1; i < table.measurements.length; i++) {
      const prev = table.measurements[i - 1]
      const cur = table.measurements[i]
      if (prev === undefined || cur === undefined) throw new Error('expected adjacent rows')
      const prevKey = [DEVICE_PROFILES.indexOf(prev.profile), MEASURED_SUITES.indexOf(prev.suite), prev.n]
      const curKey = [DEVICE_PROFILES.indexOf(cur.profile), MEASURED_SUITES.indexOf(cur.suite), cur.n]
      expect(lexLE(prevKey, curKey)).toBe(true)
    }
  })

  it('duplicates: the last non-error, non-skipped record for a (profile, suite, n) key wins', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [
        ...base.records,
        svgRow('sw-6x', 'svg-rich', 10, { mount: 999, interaction: 5, pan: 5 }), // later duplicate: wins
        { suite: 'svg-rich', profile: 'sw-6x', n: 10, error: 'boom' }, // even later, but excluded entirely
        { suite: 'svg-rich', profile: 'sw-6x', n: 10, skipped: 'previous n too slow' }, // also excluded
      ],
    }
    const table = shapeTierTable(input)
    const row = table.measurements.find(m => m.profile === 'sw-6x' && m.suite === 'svg-rich' && m.n === 10)
    expect(row?.mountMs?.median).toBe(999)
  })

  it('carries budgets and the non-derived boundary numbers over from the previous table unchanged', () => {
    const table = shapeTierTable(baseInput())
    expect(table.budgets).toEqual(TIER_TABLE.budgets)
    expect(table.boundaries.labelVisibleMinRadiusPx).toBe(TIER_TABLE.boundaries.labelVisibleMinRadiusPx)
    expect(table.boundaries.gatesFullMaxN).toBe(TIER_TABLE.boundaries.gatesFullMaxN)
    expect(table.boundaries.gatesThinMaxN).toBe(TIER_TABLE.boundaries.gatesThinMaxN)
  })

  it('webglDecision.adopt is false when the canvas tier never leaves budget in the measured range', () => {
    const table = shapeTierTable(baseInput())
    expect(table.boundaries.canvasMaxN).toBeNull()
    expect(table.webglDecision.adopt).toBe(false)
    expect(table.webglDecision.reason.length).toBeGreaterThan(0)
    expect(table.webglDecision.reason).toContain(String(table.budgets.canvasTargetN))
    expect(table.webglDecision.reviewedAt).toBe(table.environments['sw-6x'].date)
  })

  it('webglDecision.adopt is true when a sw-6x canvas row fails below canvasTargetN', () => {
    const base = baseInput()
    const input: ShapeInput = { ...base, records: [...base.records, canvasRow('sw-6x', 200, { mount: 9999, pan: 5 })] }
    const table = shapeTierTable(input)
    expect(table.boundaries.canvasMaxN).not.toBeNull()
    expect(table.boundaries.canvasMaxN?.n).toBe(100)
    expect(table.webglDecision.adopt).toBe(true)
    expect(table.webglDecision.reason).toContain(String(table.boundaries.canvasMaxN?.n))
  })

  it('webglDecision.adopt stays false when the first failure is at or beyond canvasTargetN', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [...base.records, canvasRow('sw-6x', 4000, { mount: 185.5, pan: 22.0 }), canvasRow('sw-6x', 5000, { mount: 9999, pan: 5 })],
    }
    const table = shapeTierTable(input)
    expect(table.boundaries.canvasMaxN?.n).toBe(4000)
    expect(table.webglDecision.adopt).toBe(false)
  })

  it('memory.svgRichDomBytesPerZone and canvasFixedBytes are null when no gpu row qualifies', () => {
    const table = shapeTierTable(baseInput())
    expect(table.memory.svgRichDomBytesPerZone).toBeNull()
    expect(table.memory.svgRichJsHeapBytesPerZone).toBeNull()
    expect(table.memory.canvasFixedBytes).toBeNull()
    expect(table.memory.basedOn).toBe('gpu')
  })

  it('memory.svgRichDomBytesPerZone/JsHeapBytesPerZone is the rounded median of domBytes|jsHeapBytes / n over gpu svg-rich rows with n >= 500', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [
        ...base.records,
        svgRow('gpu', 'svg-rich', 500, { mount: 5, interaction: 1, pan: 1, domBytes: 3000000, jsHeapBytes: 1600000 }),
        svgRow('gpu', 'svg-rich', 1000, { mount: 5, interaction: 1, pan: 1, domBytes: 5000000, jsHeapBytes: 3000000 }),
      ],
    }
    const table = shapeTierTable(input)
    expect(table.memory.svgRichDomBytesPerZone).toBe(5500)
    expect(table.memory.svgRichJsHeapBytesPerZone).toBe(3100)
  })

  it('memory.canvasFixedBytes is the rounded median of jsHeapBytes over gpu canvas rows', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [...base.records, canvasRow('gpu', 500, { mount: 5, pan: 1, jsHeapBytes: 3000000 }), canvasRow('gpu', 1000, { mount: 5, pan: 1, jsHeapBytes: 3400000 })],
    }
    const table = shapeTierTable(input)
    expect(table.memory.canvasFixedBytes).toBe(3200000)
  })

  it('memory.note names the date and the measurement method', () => {
    const table = shapeTierTable(baseInput())
    expect(table.memory.note).toContain(table.environments.gpu.date)
    expect(table.memory.note).toContain('measureUserAgentSpecificMemory')
    expect(table.memory.note).toContain('JSHeapUsedSize')
  })

  it('canvasDimensionNote reports the max ok dimension when it exceeds 32767', () => {
    const table = shapeTierTable(baseInput())
    expect(table.boundaries.canvasDimensionNote).toBe('no standalone per-dimension cap reproduced up to 65535 px; clamp on area')
  })

  it('canvasDimensionNote falls back to the per-dimension-cap wording when no ok probe exceeds 32767', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: base.records.map(r =>
        r.suite === 'limits'
          ? {
              ...r,
              probes: [
                { width: 16384, height: 16384, ok: true },
                { width: 16385, height: 16384, ok: false },
              ],
            }
          : r,
      ),
    }
    const table = shapeTierTable(input)
    expect(table.boundaries.canvasDimensionNote).toBe('a per-dimension cap at or below 32767 px was observed; clamp on area and on each dimension')
  })

  it('shapes chords rows from gpu records, deduped last-per-n and sorted by n', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [...base.records, { suite: 'chords', profile: 'gpu', n: 30, chords: 435, paintMs: 999, overlapShare: 0.5 }],
    }
    const table = shapeTierTable(input)
    const ns = table.chords.map(c => c.n)
    expect(ns).toEqual([...ns].sort((a, b) => a - b))
    expect(table.chords.find(c => c.n === 30)?.paintMs).toBe(999)
  })

  it('canvasProbes come from the last gpu limits record', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      records: [...base.records, { suite: 'limits', profile: 'gpu', n: null, probes: [{ width: 1, height: 1, ok: true }] }],
    }
    const table = shapeTierTable(input)
    expect(table.canvasProbes).toEqual([{ width: 1, height: 1, ok: true }])
  })

  it('shapes headless rows from the headless list, deduped last-per-n and sorted by n', () => {
    const base = baseInput()
    const input: ShapeInput = {
      ...base,
      headless: [...base.headless, { suite: 'headless', n: 100, layoutMs: 999, routeMs: 999, emitMs: 999, svgBytes: 1, rssDeltaBytes: 1 }],
    }
    const table = shapeTierTable(input)
    expect(table.headless.map(h => h.n)).toEqual([100, 1000])
    expect(table.headless.find(h => h.n === 100)?.layoutMs).toBe(999)
  })

  it('is deterministic: two shapes of the same input produce identical JSON', () => {
    const input = baseInput()
    const a = shapeTierTable(input)
    const b = shapeTierTable(input)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('throws when an environment is missing for a device profile', () => {
    const base = baseInput()
    const input: ShapeInput = { ...base, envs: base.envs.filter(e => e.profile !== 'sw-4x') }
    expect(() => shapeTierTable(input)).toThrow('shape: missing environment for sw-4x')
  })
})
