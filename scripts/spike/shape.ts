// Pure shaper (REN-01, D-09, D-11, D-14): turns raw .spike/raw/*.jsonl records plus environment metadata into the
// measured TierTable that engine/scene/tiers.ts's own deriveBoundaries and validateTierTable already govern. No file
// I/O here (that is write-table.ts's job) and no clock read: every number below comes from the caller's records.
import {
  DEVICE_PROFILES,
  MEASURED_SUITES,
  deriveBoundaries,
} from '../../engine/index'
import type {
  Boundary,
  CanvasProbe,
  ChordMeasurement,
  DeviceProfile,
  EnvironmentMeta,
  HeadlessMeasurement,
  MeasuredSuite,
  MemoryModel,
  Stat,
  TierBoundaries,
  TierMeasurement,
  TierTable,
} from '../../engine/index'

/** One JSON object per non-blank line; blank/whitespace-only lines are ignored. */
export function parseJsonl(text: string): Record<string, unknown>[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

export interface ShapeInput {
  readonly records: readonly Record<string, unknown>[]
  readonly envs: readonly Record<string, unknown>[]
  readonly headless: readonly Record<string, unknown>[]
  readonly previous: TierTable
}

function isUsable(r: Record<string, unknown>): boolean {
  return !('error' in r) && !('skipped' in r)
}

/** Keeps, for each key, only the LAST record sharing it (original array order decides "last"). */
function dedupeLastBy<T>(items: readonly T[], keyFn: (t: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of items) map.set(keyFn(item), item)
  return [...map.values()]
}

function statOrNull(v: unknown): Stat | null {
  return v === undefined || v === null ? null : (v as Stat)
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null
}

function toMeasurement(r: Record<string, unknown>): TierMeasurement {
  return {
    profile: r.profile as DeviceProfile,
    suite: r.suite as MeasuredSuite,
    n: r.n as number,
    mountMs: statOrNull(r.mountMs),
    interactionMs: statOrNull(r.interactionMs),
    panMs: statOrNull(r.panMs),
    tweenMs: statOrNull(r.tweenMs),
    computeMs: statOrNull(r.computeMs),
    domNodes: numOrNull(r.domNodes),
    domBytes: numOrNull(r.domBytes),
    jsHeapBytes: numOrNull(r.jsHeapBytes),
  }
}

/** Rounded median (average of the two middle values when the count is even); null for an empty input. */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const lo = sorted[mid - 1]
  const hi = sorted[mid]
  const raw = sorted.length % 2 === 0 && lo !== undefined && hi !== undefined ? (lo + hi) / 2 : (hi ?? lo ?? 0)
  return Math.round(raw)
}

function shapeEnvironments(
  envs: readonly Record<string, unknown>[],
  calibUsable: readonly Record<string, unknown>[],
): Readonly<Record<DeviceProfile, EnvironmentMeta>> {
  function lastCalibFor(p: DeviceProfile): number {
    const rows = calibUsable.filter(r => r.profile === p)
    const last = rows[rows.length - 1]
    if (last === undefined) throw new Error(`shape: missing calibration for ${p}`)
    return last.jsLoopMs as number
  }

  const environments = {} as Record<DeviceProfile, EnvironmentMeta>
  const gpuCalib = lastCalibFor('gpu')
  for (const p of DEVICE_PROFILES) {
    const rec = envs.find(e => e.profile === p)
    if (rec === undefined) throw new Error(`shape: missing environment for ${p}`)
    const calib = lastCalibFor(p)
    const cpuThrottleMeasured = Math.round((calib / gpuCalib) * 100) / 100
    environments[p] = {
      cpu: rec.cpu as string,
      physicalCores: (rec.physicalCores as number | null | undefined) ?? null,
      logicalThreads: rec.logicalThreads as number,
      ramBytes: rec.ramBytes as number,
      os: rec.os as string,
      browser: rec.browser as string,
      raster: rec.raster as 'gpu' | 'software',
      gpu: (rec.gpu as string | null | undefined) ?? null,
      cpuThrottleNominal: rec.cpuThrottleNominal as number,
      cpuThrottleMeasured,
      date: rec.date as string,
      placeholder: false,
    }
  }
  return environments
}

function shapeMemory(measurements: readonly TierMeasurement[], gpuDate: string): MemoryModel {
  const gpuSvgRich500 = measurements.filter(m => m.profile === 'gpu' && m.suite === 'svg-rich' && m.n >= 500)
  const domPerZone = median(gpuSvgRich500.filter(m => m.domBytes !== null).map(m => (m.domBytes as number) / m.n))
  const heapPerZone = median(gpuSvgRich500.filter(m => m.jsHeapBytes !== null).map(m => (m.jsHeapBytes as number) / m.n))
  const gpuCanvas = measurements.filter(m => m.profile === 'gpu' && m.suite === 'canvas' && m.jsHeapBytes !== null)
  const canvasFixedBytes = median(gpuCanvas.map(m => m.jsHeapBytes as number))
  return {
    svgRichDomBytesPerZone: domPerZone,
    svgRichJsHeapBytesPerZone: heapPerZone,
    canvasFixedBytes,
    basedOn: 'gpu',
    note:
      `spike ${gpuDate}: memory per zone from measureUserAgentSpecificMemory (DOM) and CDP JSHeapUsedSize deltas ` +
      'on the gpu profile; CPU throttling does not change memory',
  }
}

/**
 * Turns raw records, environment metadata and the current committed table (used only as the source of budgets and
 * of the boundary numbers this run does not re-derive) into a fresh, validator-clean TierTable with status
 * 'measured'. Boundaries are always computed by deriveBoundaries -- never hand-set (T-03-28).
 */
export function shapeTierTable(input: ShapeInput): TierTable {
  const { records, envs, headless, previous } = input
  const usable = records.filter(isUsable)

  const calibUsable = usable.filter(r => r.suite === 'calib')
  const environments = shapeEnvironments(envs, calibUsable)

  const measuredRaw = usable.filter(r => (MEASURED_SUITES as readonly string[]).includes(r.suite as string))
  const dedupedMeasurements = dedupeLastBy(measuredRaw, r => `${r.profile as string}\u0000${r.suite as string}\u0000${r.n as number}`)
  const measurements = dedupedMeasurements.map(toMeasurement).sort((a, b) => {
    const pd = DEVICE_PROFILES.indexOf(a.profile) - DEVICE_PROFILES.indexOf(b.profile)
    if (pd !== 0) return pd
    const sd = MEASURED_SUITES.indexOf(a.suite) - MEASURED_SUITES.indexOf(b.suite)
    if (sd !== 0) return sd
    return a.n - b.n
  })

  const chordsRaw = usable.filter(r => r.suite === 'chords' && r.profile === 'gpu')
  const dedupedChords = dedupeLastBy(chordsRaw, r => String(r.n))
  const chords: ChordMeasurement[] = dedupedChords
    .map(r => ({ n: r.n as number, chords: r.chords as number, paintMs: r.paintMs as number, overlapShare: r.overlapShare as number }))
    .sort((a, b) => a.n - b.n)

  const limitsRaw = usable.filter(r => r.suite === 'limits' && r.profile === 'gpu')
  const lastLimits = limitsRaw[limitsRaw.length - 1]
  const canvasProbes: CanvasProbe[] = lastLimits === undefined ? [] : ((lastLimits.probes as CanvasProbe[]) ?? [])

  const headlessUsable = headless.filter(isUsable)
  const dedupedHeadless = dedupeLastBy(headlessUsable, r => String(r.n))
  const headlessRows: HeadlessMeasurement[] = dedupedHeadless
    .map(r => ({
      n: r.n as number,
      layoutMs: r.layoutMs as number,
      routeMs: r.routeMs as number,
      emitMs: r.emitMs as number,
      svgBytes: r.svgBytes as number,
      rssDeltaBytes: r.rssDeltaBytes as number,
    }))
    .sort((a, b) => a.n - b.n)

  const budgets = previous.budgets
  const shipped = previous.shippedProfile
  const memory = shapeMemory(measurements, environments.gpu.date)

  const d = deriveBoundaries({ measurements, chords, canvasProbes, budgets, shippedProfile: shipped })

  const svgRichMaxN: Boundary = {
    n: d.svgRichMaxN,
    basedOn: shipped,
    rule: `highest n of the longest passing prefix of ${shipped} svg-rich rows with mount <= ${budgets.mountMs} ms, interaction <= ${budgets.interactionMs} ms and pan <= ${budgets.panMs} ms (medians)`,
  }
  const svgLeanMaxN: Boundary = {
    n: d.svgLeanMaxN,
    basedOn: shipped,
    rule: `same rule over ${shipped} svg-lean rows`,
  }
  const canvasMaxN: Boundary | null =
    d.canvasMaxN === null
      ? null
      : {
          n: d.canvasMaxN,
          basedOn: shipped,
          rule: `highest n of the longest passing prefix of ${shipped} canvas rows with one-time paint <= ${budgets.oneTimePaintMs} ms and cached-blit pan <= ${budgets.panMs} ms`,
        }
  const layoutTweenMaxN: Boundary = {
    n: d.layoutTweenMaxN,
    basedOn: shipped,
    rule: `highest n of the longest passing prefix of ${shipped} tween frames (svg-rich up to svgRichMaxN, canvas above) with median <= ${budgets.tweenMs} ms`,
  }
  const allChordsMaxN = { n: d.allChordsMaxN, rule: previous.boundaries.allChordsMaxN.rule }

  const maxOkDimension = canvasProbes.filter(p => p.ok).reduce((max, p) => Math.max(max, p.width, p.height), 0)
  const canvasDimensionNote =
    maxOkDimension > 32767
      ? `no standalone per-dimension cap reproduced up to ${maxOkDimension} px; clamp on area`
      : 'a per-dimension cap at or below 32767 px was observed; clamp on area and on each dimension'

  const boundaries: TierBoundaries = {
    svgRichMaxN,
    svgLeanMaxN,
    canvasMaxN,
    layoutTweenMaxN,
    allChordsMaxN,
    labelVisibleMinRadiusPx: previous.boundaries.labelVisibleMinRadiusPx,
    gatesFullMaxN: previous.boundaries.gatesFullMaxN,
    gatesThinMaxN: previous.boundaries.gatesThinMaxN,
    canvasAreaLimitPx: d.canvasAreaLimitPx,
    canvasDimensionNote,
  }

  const sw6xDate = environments['sw-6x'].date
  const target = budgets.canvasTargetN
  const adopt = d.canvasMaxN !== null && d.canvasMaxN < target
  const reason = adopt
    ? `Measured ${sw6xDate} on sw-6x: the Canvas tier leaves its budget after n = ${d.canvasMaxN}, below canvasTargetN ${target}. A WebGL tier is warranted; Phase 6 plans it.`
    : `Measured ${sw6xDate} on sw-6x: the Canvas tier stays within budget over every measured n up to ${d.maxMeasuredN} (canvasTargetN ${target}); the all-chords layer is legibility-limited at n = ${d.allChordsMaxN}. No WebGL tier.`

  return {
    schemaVersion: 1,
    status: 'measured',
    shippedProfile: shipped,
    budgets,
    environments,
    measurements,
    chords,
    canvasProbes,
    headless: headlessRows,
    memory,
    boundaries,
    webglDecision: { adopt, reason, reviewedAt: sw6xDate },
    tierOverrideParam: { enabled: true, name: 'tier', values: ['svg', 'canvas', 'headless'] },
  }
}
