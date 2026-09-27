// CLI: shapes .spike/raw/*.jsonl (never committed) into the committed, validator-clean engine/scene/tier-table.json
// (REN-01, D-09, D-11, D-12, D-14). Dev-only: never part of npm run verify. Writes only when validateTierTable
// returns no problems (T-03-28); otherwise prints every problem and exits 1 without touching the committed file.
//
// CommonJS-safe (tsx runs .ts scripts as CommonJS because the root package.json has no "type" field): no top-level
// await, no import.meta.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { DEVICE_PROFILES, MEASURED_SUITES, validateTierTable } from '../../engine/index'
import type { DeviceProfile, MeasuredSuite, TierTable } from '../../engine/index'
import { parseJsonl, shapeTierTable } from './shape'

if (!existsSync(path.resolve('engine/index.ts'))) {
  console.error('write-table: run from the repository root')
  process.exit(2)
}

const RAW_DIR = path.resolve('.spike/raw')
const TABLE_PATH = path.resolve('engine/scene/tier-table.json')
const REPORT_PATH = path.resolve('.spike/report.txt')

const RAW_PROFILES: readonly DeviceProfile[] = ['gpu', 'sw', 'sw-4x', 'sw-6x']

function readJsonlIfExists(file: string): Record<string, unknown>[] {
  if (!existsSync(file)) return []
  return parseJsonl(readFileSync(file, 'utf8'))
}

function readJsonIfExists(file: string): Record<string, unknown> | null {
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

function fmtMs(v: number | null | undefined): string {
  return v === null || v === undefined ? '-' : v.toFixed(1)
}

function buildSuiteTable(table: TierTable, suite: MeasuredSuite): string {
  const ns = [...new Set(table.measurements.filter(m => m.suite === suite).map(m => m.n))].sort((a, b) => a - b)
  const lines: string[] = []
  lines.push(`  n${' '.repeat(9)}${DEVICE_PROFILES.map(p => p.padEnd(28)).join('')}`)
  for (const n of ns) {
    const cells = DEVICE_PROFILES.map(p => {
      const row = table.measurements.find(m => m.profile === p && m.suite === suite && m.n === n)
      if (row === undefined) return '-'.padEnd(28)
      const cell = `${fmtMs(row.mountMs?.median)}/${fmtMs(row.interactionMs?.median)}/${fmtMs(row.panMs?.median)}/${fmtMs(row.tweenMs?.median)}`
      return cell.padEnd(28)
    })
    lines.push(`  ${String(n).padEnd(9)}${cells.join('')}`)
  }
  return lines.join('\n')
}

function buildReport(table: TierTable): string {
  const lines: string[] = []
  lines.push('CCRUG ceiling spike report (mount/interaction/pan/tween ms, medians; native rows kept for reference, D-14)')
  lines.push(`status: ${table.status}  shippedProfile: ${table.shippedProfile}`)
  lines.push('')
  lines.push('Environments:')
  for (const p of DEVICE_PROFILES) {
    const e = table.environments[p]
    lines.push(
      `  ${p}: ${e.cpu}, ${e.physicalCores ?? '?'} cores / ${e.logicalThreads} threads, ${(e.ramBytes / 1e9).toFixed(1)} GB RAM, ` +
        `${e.os}, ${e.browser}, raster=${e.raster}, gpu=${e.gpu ?? 'n/a'}, throttle nominal=${e.cpuThrottleNominal}x measured=${e.cpuThrottleMeasured}x, date=${e.date}`,
    )
  }
  lines.push('')
  lines.push('Boundaries (shipped/default, all basedOn the conservative sw-6x profile, D-14):')
  lines.push(`  svgRichMaxN = ${table.boundaries.svgRichMaxN.n} (${table.boundaries.svgRichMaxN.basedOn}): ${table.boundaries.svgRichMaxN.rule}`)
  lines.push(`  svgLeanMaxN = ${table.boundaries.svgLeanMaxN.n} (${table.boundaries.svgLeanMaxN.basedOn}): ${table.boundaries.svgLeanMaxN.rule}`)
  lines.push(
    table.boundaries.canvasMaxN === null
      ? '  canvasMaxN = null (no ceiling found in the measured range)'
      : `  canvasMaxN = ${table.boundaries.canvasMaxN.n} (${table.boundaries.canvasMaxN.basedOn}): ${table.boundaries.canvasMaxN.rule}`,
  )
  lines.push(`  layoutTweenMaxN = ${table.boundaries.layoutTweenMaxN.n} (${table.boundaries.layoutTweenMaxN.basedOn}): ${table.boundaries.layoutTweenMaxN.rule}`)
  lines.push(`  allChordsMaxN = ${table.boundaries.allChordsMaxN.n}: ${table.boundaries.allChordsMaxN.rule}`)
  lines.push(`  canvasAreaLimitPx = ${table.boundaries.canvasAreaLimitPx} (${table.boundaries.canvasDimensionNote})`)
  lines.push(`  labelVisibleMinRadiusPx = ${table.boundaries.labelVisibleMinRadiusPx}, gatesFullMaxN = ${table.boundaries.gatesFullMaxN}, gatesThinMaxN = ${table.boundaries.gatesThinMaxN}`)
  lines.push('')
  lines.push('WebGL decision (D-12):')
  lines.push(`  adopt = ${table.webglDecision.adopt}`)
  lines.push(`  ${table.webglDecision.reason}`)
  lines.push('')
  lines.push('tier= diagnostic override (D-13):')
  lines.push(`  ${JSON.stringify(table.tierOverrideParam)}`)
  lines.push('')
  for (const suite of MEASURED_SUITES) {
    lines.push(`${suite}:`)
    lines.push(buildSuiteTable(table, suite))
    lines.push('')
  }
  lines.push('Chords (all-chords legibility probe, gpu):')
  for (const c of table.chords) lines.push(`  n=${c.n} chords=${c.chords} paintMs=${c.paintMs} overlapShare=${c.overlapShare}`)
  lines.push('')
  lines.push('Headless:')
  for (const h of table.headless) lines.push(`  n=${h.n} layoutMs=${h.layoutMs} routeMs=${h.routeMs} emitMs=${h.emitMs} svgBytes=${h.svgBytes} rssDeltaBytes=${h.rssDeltaBytes}`)
  lines.push('')
  lines.push('Memory (gpu):')
  lines.push(
    `  svgRichDomBytesPerZone=${table.memory.svgRichDomBytesPerZone ?? 'null'} svgRichJsHeapBytesPerZone=${table.memory.svgRichJsHeapBytesPerZone ?? 'null'} canvasFixedBytes=${table.memory.canvasFixedBytes ?? 'null'}`,
  )
  lines.push(`  ${table.memory.note}`)
  return `${lines.join('\n')}\n`
}

async function main(): Promise<number> {
  const records = RAW_PROFILES.flatMap(p => readJsonlIfExists(path.join(RAW_DIR, `${p}.jsonl`)))
  const envs = RAW_PROFILES.map(p => readJsonIfExists(path.join(RAW_DIR, `env-${p}.json`))).filter(
    (e): e is Record<string, unknown> => e !== null,
  )
  const headless = readJsonlIfExists(path.join(RAW_DIR, 'headless.jsonl'))
  const previous = JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as TierTable

  const table = shapeTierTable({ records, envs, headless, previous })
  const problems = validateTierTable(table)
  if (problems.length > 0) {
    console.error('write-table: the shaped table failed validation; engine/scene/tier-table.json was NOT written:')
    for (const p of problems) console.error(`  - ${p}`)
    return 1
  }

  writeFileSync(TABLE_PATH, `${JSON.stringify(table, null, 2)}\n`)
  console.log(`write-table: wrote ${path.relative(process.cwd(), TABLE_PATH)}`)

  const report = buildReport(table)
  writeFileSync(REPORT_PATH, report)
  console.log('')
  console.log(report)
  console.log(`write-table: wrote ${path.relative(process.cwd(), REPORT_PATH)}`)
  return 0
}

main().then(
  code => {
    process.exitCode = code
  },
  e => {
    console.error(e)
    process.exitCode = 1
  },
)
