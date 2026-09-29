// Renderer threshold table (REN-01): schema, pure selection helpers, boundary derivation and a schema/invariant
// validator. DATA lives in tier-table.json; nothing here measures time.
//
// "Longest passing prefix" (used throughout deriveBoundaries): sort a profile/suite's rows by n, walk them in order
// and stop at the first row that fails its budget; the boundary is the n of the last row that passed (0 if the very
// first row fails). Nothing here reads a clock or a random source: every number below comes from rows the caller
// supplies (D-11, D-14, research Pitfall 10).

export const RENDER_TIERS = ['svg', 'canvas', 'headless'] as const
export type RenderTier = (typeof RENDER_TIERS)[number]
export const DEVICE_PROFILES = ['gpu', 'sw', 'sw-4x', 'sw-6x'] as const // gpu = this PC; sw = --disable-gpu (SwiftShader); sw-4x / sw-6x = sw plus CDP CPU throttle 4x / 6x
export type DeviceProfile = (typeof DEVICE_PROFILES)[number]
export const MEASURED_SUITES = ['svg-rich', 'svg-lean', 'canvas'] as const
export type MeasuredSuite = (typeof MEASURED_SUITES)[number]

export interface Stat {
  readonly median: number
  readonly p95: number | null
}

export interface EnvironmentMeta {
  readonly cpu: string
  readonly physicalCores: number | null
  readonly logicalThreads: number
  readonly ramBytes: number
  readonly os: string
  readonly browser: string
  readonly raster: 'gpu' | 'software'
  readonly gpu: string | null // WebGL unmasked renderer string as reported, null if unavailable
  readonly cpuThrottleNominal: number // CDP rate requested (1, 4, 6)
  readonly cpuThrottleMeasured: number // calibration loop time / the gpu profile's loop time
  readonly date: string // YYYY-MM-DD of the run
  readonly placeholder: boolean // true = carried from the research prototype, not re-measured
}

export interface TierMeasurement {
  readonly profile: DeviceProfile
  readonly suite: MeasuredSuite
  readonly n: number
  readonly mountMs: Stat | null // svg: render + 2 frames; canvas: one-time static-layer paint
  readonly interactionMs: Stat | null // svg: hover state change to presented frame; canvas: overlay redraw
  readonly panMs: Stat | null // svg: CSS transform frame; canvas: cached-bitmap blit frame
  readonly tweenMs: Stat | null // one layout-switch frame: interpolate, recompute routes, re-render
  readonly computeMs: Stat | null // numogram + layout + routes inside the page (throttled with it)
  readonly domNodes: number | null
  readonly domBytes: number | null
  readonly jsHeapBytes: number | null
}

export interface ChordMeasurement {
  readonly n: number
  readonly chords: number
  readonly paintMs: number
  readonly overlapShare: number // share (0..1) of inked pixels crossed by >= 4 chords
}

export interface CanvasProbe {
  readonly width: number
  readonly height: number
  readonly ok: boolean
}

export interface HeadlessMeasurement {
  readonly n: number
  readonly layoutMs: number
  readonly routeMs: number
  readonly emitMs: number
  readonly svgBytes: number
  readonly rssDeltaBytes: number
}

export interface TierBudgets {
  readonly mountMs: number
  readonly interactionMs: number
  readonly panMs: number
  readonly tweenMs: number
  readonly oneTimePaintMs: number
  readonly chordsOverlapMax: number
  readonly canvasTargetN: number
  readonly source: string
}

export interface Boundary {
  readonly n: number
  readonly basedOn: DeviceProfile
  readonly rule: string
}

export interface TierBoundaries {
  readonly svgRichMaxN: Boundary
  readonly svgLeanMaxN: Boundary
  readonly canvasMaxN: Boundary | null // null = no ceiling found in the measured range
  readonly layoutTweenMaxN: Boundary
  readonly allChordsMaxN: { readonly n: number; readonly rule: string }
  readonly labelVisibleMinRadiusPx: number
  readonly gatesFullMaxN: number
  readonly gatesThinMaxN: number
  readonly canvasAreaLimitPx: number
  readonly canvasDimensionNote: string
}

export interface MemoryModel {
  readonly svgRichDomBytesPerZone: number | null
  readonly svgRichJsHeapBytesPerZone: number | null
  readonly canvasFixedBytes: number | null
  readonly basedOn: DeviceProfile
  readonly note: string
}

export interface TierTable {
  readonly schemaVersion: 1
  readonly status: 'placeholder' | 'measured'
  readonly shippedProfile: DeviceProfile
  readonly budgets: TierBudgets
  readonly environments: Readonly<Record<DeviceProfile, EnvironmentMeta>>
  readonly measurements: readonly TierMeasurement[]
  readonly chords: readonly ChordMeasurement[]
  readonly canvasProbes: readonly CanvasProbe[]
  readonly headless: readonly HeadlessMeasurement[]
  readonly memory: MemoryModel
  readonly boundaries: TierBoundaries
  readonly webglDecision: { readonly adopt: boolean; readonly reason: string; readonly reviewedAt: string }
  readonly tierOverrideParam: { readonly enabled: boolean; readonly name: string; readonly values: readonly string[] }
}

// ---- selection helpers (D-07, D-09, D-13) ----

/** The tier for n zones: an explicit override wins, else svg -> canvas -> headless by the table's boundaries. */
export function selectTier(n: number, table: Pick<TierTable, 'boundaries'>, override?: RenderTier): RenderTier {
  if (override !== undefined) return override
  if (n <= table.boundaries.svgRichMaxN.n) return 'svg'
  const canvasMax = table.boundaries.canvasMaxN
  if (canvasMax === null || n <= canvasMax.n) return 'canvas'
  return 'headless'
}

/** A `tier=` URL value as a RenderTier, or null when the diagnostic override is off or the value is not allowed (D-13, T-03-05). */
export function parseTierOverride(value: string | null | undefined, table: Pick<TierTable, 'tierOverrideParam'>): RenderTier | null {
  if (value === null || value === undefined) return null
  if (!table.tierOverrideParam.enabled) return null
  if (!table.tierOverrideParam.values.includes(value)) return null
  if (!(RENDER_TIERS as readonly string[]).includes(value)) return null
  return value as RenderTier
}

/** Whether a layout switch of n zones may animate rather than cut instantly (D-09). */
export function tweenAllowed(n: number, table: Pick<TierTable, 'boundaries'>): boolean {
  return n <= table.boundaries.layoutTweenMaxN.n
}

/** Whether a zone label may be drawn, given its on-screen node radius in pixels (D-07). */
export function labelsVisible(onScreenRadiusPx: number, table: Pick<TierTable, 'boundaries'>): boolean {
  return onScreenRadiusPx >= table.boundaries.labelVisibleMinRadiusPx
}

/** How densely the gate layer draws at n zones: full, thinned, or off. */
export function gateLayerMode(n: number, table: Pick<TierTable, 'boundaries'>): 'on' | 'thin' | 'off' {
  if (n <= table.boundaries.gatesFullMaxN) return 'on'
  if (n <= table.boundaries.gatesThinMaxN) return 'thin'
  return 'off'
}

// ---- boundary derivation (D-11, D-14, T-03-04) ----

export interface DerivedBoundaries {
  readonly svgRichMaxN: number
  readonly svgLeanMaxN: number
  readonly canvasMaxN: number | null
  readonly layoutTweenMaxN: number
  readonly allChordsMaxN: number
  readonly canvasAreaLimitPx: number
  readonly maxMeasuredN: number
}

function rowsFor(measurements: readonly TierMeasurement[], profile: DeviceProfile, suite: MeasuredSuite): TierMeasurement[] {
  return measurements
    .filter(m => m.profile === profile && m.suite === suite)
    .slice()
    .sort((a, b) => a.n - b.n)
}

/** The n of the last row of a passing prefix of `rows` (already sorted by n): 0 if the first row fails or none exist. */
function longestPassingPrefix(rows: readonly TierMeasurement[], passes: (row: TierMeasurement) => boolean): number {
  let boundary = 0
  for (const row of rows) {
    if (!passes(row)) break
    boundary = row.n
  }
  return boundary
}

function passesSvg(row: TierMeasurement, budgets: TierBudgets): boolean {
  if (row.mountMs === null || row.mountMs.median > budgets.mountMs) return false
  if (row.interactionMs === null || row.interactionMs.median > budgets.interactionMs) return false
  if (row.panMs === null || row.panMs.median > budgets.panMs) return false
  return true
}

function passesCanvas(row: TierMeasurement, budgets: TierBudgets): boolean {
  if (row.mountMs === null || row.mountMs.median > budgets.oneTimePaintMs) return false
  if (row.panMs === null || row.panMs.median > budgets.panMs) return false
  if (row.interactionMs !== null && row.interactionMs.median > budgets.interactionMs) return false
  return true
}

/**
 * Boundaries derived from measured rows and budgets: the "longest passing prefix" of the shipped profile's rows for
 * each suite (never a hand-edited number). Never asserts anything about wall-clock time itself: it only compares
 * numbers the caller already measured against numbers the caller already chose as budgets (D-14).
 */
export function deriveBoundaries(input: {
  readonly measurements: readonly TierMeasurement[]
  readonly chords: readonly ChordMeasurement[]
  readonly canvasProbes: readonly CanvasProbe[]
  readonly budgets: TierBudgets
  readonly shippedProfile: DeviceProfile
}): DerivedBoundaries {
  const { measurements, chords, canvasProbes, budgets, shippedProfile } = input

  const richRows = rowsFor(measurements, shippedProfile, 'svg-rich')
  const leanRows = rowsFor(measurements, shippedProfile, 'svg-lean')
  const canvasRows = rowsFor(measurements, shippedProfile, 'canvas')

  const svgRichMaxN = longestPassingPrefix(richRows, row => passesSvg(row, budgets))
  const svgLeanMaxN = longestPassingPrefix(leanRows, row => passesSvg(row, budgets))

  const canvasPrefixN = longestPassingPrefix(canvasRows, row => passesCanvas(row, budgets))
  const allCanvasPass = canvasRows.length > 0 && canvasRows.every(row => passesCanvas(row, budgets))
  const canvasMaxN = allCanvasPass ? null : canvasPrefixN
  const lastCanvasRow = canvasRows[canvasRows.length - 1]
  const maxMeasuredN = lastCanvasRow === undefined ? 0 : lastCanvasRow.n

  const tweenRows = [...richRows.filter(row => row.n <= svgRichMaxN), ...canvasRows.filter(row => row.n > svgRichMaxN)].sort(
    (a, b) => a.n - b.n,
  )
  const layoutTweenMaxN = longestPassingPrefix(tweenRows, row => row.tweenMs !== null && row.tweenMs.median <= budgets.tweenMs)

  const sortedChords = chords.slice().sort((a, b) => a.n - b.n)
  let allChordsMaxN = 0
  for (const row of sortedChords) {
    if (!(row.overlapShare < budgets.chordsOverlapMax)) break
    allChordsMaxN = row.n
  }

  let canvasAreaLimitPx = 0
  for (const probe of canvasProbes) {
    if (!probe.ok) continue
    const area = probe.width * probe.height
    if (area > canvasAreaLimitPx) canvasAreaLimitPx = area
  }

  return { svgRichMaxN, svgLeanMaxN, canvasMaxN, layoutTweenMaxN, allChordsMaxN, canvasAreaLimitPx, maxMeasuredN }
}

// ---- validator (T-03-04): schema and invariants only, never a timing assertion ----

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

/**
 * Every problem with `t` as a list of strings (empty = valid). One `if` per rule, one specific message per rule (the
 * validateBase idiom of engine/core/base.ts): never a generic "invalid".
 */
export function validateTierTable(t: TierTable): string[] {
  const problems: string[] = []

  if (t.schemaVersion !== 1) problems.push('schemaVersion must be 1')
  if (t.status !== 'placeholder' && t.status !== 'measured') problems.push("status must be 'placeholder' or 'measured'")

  for (const p of DEVICE_PROFILES) {
    const env = t.environments[p]
    if (env === undefined) {
      problems.push(`environment ${p} is missing`)
      continue
    }
    if (!isNonEmptyString(env.cpu) || !isNonEmptyString(env.os) || !isNonEmptyString(env.browser)) {
      problems.push(`environment ${p}: cpu, os, browser must be non-empty`)
    }
    if (!(env.ramBytes > 0) || !(env.logicalThreads > 0)) {
      problems.push(`environment ${p}: ramBytes and logicalThreads must be positive`)
    }
    if (!YMD_RE.test(env.date)) problems.push(`environment ${p}: date must be YYYY-MM-DD`)
    if (!(env.cpuThrottleNominal >= 1) || !(env.cpuThrottleMeasured > 0)) {
      problems.push(`environment ${p}: cpuThrottleNominal must be >= 1 and cpuThrottleMeasured > 0`)
    }
    if (env.raster !== 'gpu' && env.raster !== 'software') problems.push(`environment ${p}: raster must be 'gpu' or 'software'`)
  }

  const shippedEnv = t.environments[t.shippedProfile]
  if (shippedEnv === undefined) {
    problems.push(`shippedProfile ${t.shippedProfile} has no environment`)
  } else {
    let maxThrottle = -Infinity
    for (const p of DEVICE_PROFILES) {
      const nominal = t.environments[p]?.cpuThrottleNominal
      if (nominal !== undefined && nominal > maxThrottle) maxThrottle = nominal
    }
    const isConservative = shippedEnv.raster === 'software' && shippedEnv.cpuThrottleNominal === maxThrottle
    if (!isConservative) problems.push(`shippedProfile ${t.shippedProfile} is not the most conservative profile`)
  }

  const seriesRows = new Map<string, TierMeasurement[]>()
  for (let i = 0; i < t.measurements.length; i++) {
    const m = t.measurements[i]
    if (m === undefined) continue
    const tag = `measurement ${i} (${m.profile} ${m.suite} n=${m.n})`
    if (!Number.isInteger(m.n) || m.n < 2 || m.n % 2 !== 0) problems.push(`${tag}: n must be an even integer >= 2`)
    const knownProfile = (DEVICE_PROFILES as readonly string[]).includes(m.profile)
    const knownSuite = (MEASURED_SUITES as readonly string[]).includes(m.suite)
    if (!knownProfile || !knownSuite) problems.push(`${tag}: unknown profile or suite`)
    const stats: Array<Stat | null> = [m.mountMs, m.interactionMs, m.panMs, m.tweenMs, m.computeMs]
    let statsOk = true
    for (const s of stats) {
      if (s === null) continue
      if (!Number.isFinite(s.median) || s.median < 0) statsOk = false
      if (s.p95 !== null && s.p95 < s.median) statsOk = false
    }
    if (!statsOk) problems.push(`${tag}: stat medians must be finite and >= 0 and p95 null or >= median`)

    const key = `${m.profile}\u0000${m.suite}`
    const rows = seriesRows.get(key)
    if (rows === undefined) seriesRows.set(key, [m])
    else rows.push(m)
  }
  for (const [key, rows] of seriesRows) {
    const [profile, suite] = key.split('\u0000')
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const cur = rows[i]
      if (prev !== undefined && cur !== undefined && cur.n <= prev.n) {
        problems.push(`series ${profile} ${suite} is not strictly increasing in n at n=${cur.n}`)
      }
    }
  }

  const namedBoundaries: ReadonlyArray<readonly [string, Boundary | null]> = [
    ['svgRichMaxN', t.boundaries.svgRichMaxN],
    ['svgLeanMaxN', t.boundaries.svgLeanMaxN],
    ['canvasMaxN', t.boundaries.canvasMaxN],
    ['layoutTweenMaxN', t.boundaries.layoutTweenMaxN],
  ]
  for (const [name, b] of namedBoundaries) {
    if (b === null) continue
    if (b.basedOn !== t.shippedProfile) {
      problems.push(`boundary ${name} basedOn ${b.basedOn} differs from shippedProfile ${t.shippedProfile}`)
    }
    if (!Number.isInteger(b.n) || b.n < 0) problems.push(`boundary ${name}.n must be a non-negative integer`)
    if (!isNonEmptyString(b.rule)) problems.push(`boundary ${name}.rule must be non-empty`)
  }

  if (t.boundaries.svgRichMaxN.n > t.boundaries.svgLeanMaxN.n) {
    problems.push(`boundary svgRichMaxN (${t.boundaries.svgRichMaxN.n}) exceeds svgLeanMaxN (${t.boundaries.svgLeanMaxN.n})`)
  }
  if (t.boundaries.canvasMaxN !== null && t.boundaries.canvasMaxN.n < t.boundaries.svgRichMaxN.n) {
    problems.push(`boundary canvasMaxN (${t.boundaries.canvasMaxN.n}) is below svgRichMaxN (${t.boundaries.svgRichMaxN.n})`)
  }

  if (!(t.boundaries.labelVisibleMinRadiusPx > 0)) problems.push('labelVisibleMinRadiusPx must be positive')
  if (!(t.boundaries.gatesFullMaxN < t.boundaries.gatesThinMaxN)) problems.push('gatesFullMaxN must be below gatesThinMaxN')
  if (!Number.isInteger(t.boundaries.canvasAreaLimitPx) || t.boundaries.canvasAreaLimitPx <= 0) {
    problems.push('canvasAreaLimitPx must be a positive integer')
  }
  for (const probe of t.canvasProbes) {
    const area = probe.width * probe.height
    const shouldBeOk = area <= t.boundaries.canvasAreaLimitPx
    if (probe.ok !== shouldBeOk) problems.push(`canvas probe ${probe.width}x${probe.height} contradicts canvasAreaLimitPx`)
  }
  if (!isNonEmptyString(t.boundaries.canvasDimensionNote)) problems.push('canvasDimensionNote must be non-empty')

  for (const suite of MEASURED_SUITES) {
    const has = t.measurements.some(m => m.profile === t.shippedProfile && m.suite === suite)
    if (!has) problems.push(`missing ${suite} rows for shipped profile ${t.shippedProfile}`)
  }

  for (const row of t.chords) {
    if (!(row.overlapShare >= 0 && row.overlapShare <= 1)) problems.push(`chord row n=${row.n}: overlapShare must be within [0, 1]`)
  }
  if (!Number.isInteger(t.boundaries.allChordsMaxN.n) || t.boundaries.allChordsMaxN.n < 0) {
    problems.push('allChordsMaxN.n must be a non-negative integer')
  }

  if (!isNonEmptyString(t.webglDecision.reason)) problems.push('webglDecision.reason must be non-empty')
  if (!YMD_RE.test(t.webglDecision.reviewedAt)) problems.push('webglDecision.reviewedAt must be YYYY-MM-DD')

  const wantValues: readonly string[] = ['svg', 'canvas', 'headless']
  const tierOk =
    t.tierOverrideParam.enabled === true &&
    t.tierOverrideParam.name === 'tier' &&
    t.tierOverrideParam.values.length === wantValues.length &&
    wantValues.every((v, i) => t.tierOverrideParam.values[i] === v)
  if (!tierOk) problems.push("tierOverrideParam must be enabled with name 'tier' and values svg, canvas, headless")

  const budgetNumbers: readonly number[] = [
    t.budgets.mountMs,
    t.budgets.interactionMs,
    t.budgets.panMs,
    t.budgets.tweenMs,
    t.budgets.oneTimePaintMs,
    t.budgets.chordsOverlapMax,
    t.budgets.canvasTargetN,
  ]
  const budgetsOk = budgetNumbers.every(v => typeof v === 'number' && v > 0) && t.budgets.chordsOverlapMax <= 1
  if (!budgetsOk) problems.push('budgets must be positive numbers')

  if (t.status === 'measured') {
    for (const p of DEVICE_PROFILES) {
      const env = t.environments[p]
      if (env !== undefined && env.placeholder) problems.push(`measured table: environment ${p} is still a placeholder`)
    }
    for (const p of DEVICE_PROFILES) {
      for (const suite of MEASURED_SUITES) {
        const has = t.measurements.some(m => m.profile === p && m.suite === suite)
        if (!has) problems.push(`measured table: missing ${p} ${suite} rows`)
      }
    }
    if (t.headless.length === 0) problems.push('measured table: no headless rows')
    if (t.chords.length === 0) problems.push('measured table: no chord rows')
    const hasOkProbe = t.canvasProbes.some(p => p.ok)
    const hasFailProbe = t.canvasProbes.some(p => !p.ok)
    if (!hasOkProbe || !hasFailProbe) problems.push('measured table: canvas probes need at least one ok and one failing probe')

    const derived = deriveBoundaries({
      measurements: t.measurements,
      chords: t.chords,
      canvasProbes: t.canvasProbes,
      budgets: t.budgets,
      shippedProfile: t.shippedProfile,
    })
    if (t.boundaries.svgRichMaxN.n !== derived.svgRichMaxN) {
      problems.push(`measured table: boundary svgRichMaxN is ${t.boundaries.svgRichMaxN.n} but the measurements derive ${derived.svgRichMaxN}`)
    }
    if (t.boundaries.svgLeanMaxN.n !== derived.svgLeanMaxN) {
      problems.push(`measured table: boundary svgLeanMaxN is ${t.boundaries.svgLeanMaxN.n} but the measurements derive ${derived.svgLeanMaxN}`)
    }
    const tableCanvasN = t.boundaries.canvasMaxN === null ? null : t.boundaries.canvasMaxN.n
    if (tableCanvasN !== derived.canvasMaxN) {
      problems.push(`measured table: boundary canvasMaxN is ${tableCanvasN} but the measurements derive ${derived.canvasMaxN}`)
    }
    if (t.boundaries.layoutTweenMaxN.n !== derived.layoutTweenMaxN) {
      problems.push(`measured table: boundary layoutTweenMaxN is ${t.boundaries.layoutTweenMaxN.n} but the measurements derive ${derived.layoutTweenMaxN}`)
    }
    if (t.boundaries.allChordsMaxN.n !== derived.allChordsMaxN) {
      problems.push(`measured table: boundary allChordsMaxN is ${t.boundaries.allChordsMaxN.n} but the measurements derive ${derived.allChordsMaxN}`)
    }
    if (t.boundaries.canvasAreaLimitPx !== derived.canvasAreaLimitPx) {
      problems.push(`measured table: boundary canvasAreaLimitPx is ${t.boundaries.canvasAreaLimitPx} but the measurements derive ${derived.canvasAreaLimitPx}`)
    }
  }

  return problems
}
