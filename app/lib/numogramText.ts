// Plain-text numogram (UI-07 text view, D-14 fallback). Bounded: zone, syzygy and gate listings only up to
// TEXT_VIEW_ZONE_LIMIT zones, so huge bases stay cheap. Original CCRUG code (MIT, NOTICE section 1).
import { formatGateName, formatNumeral, torqueLabel, type Cycle, type Numogram } from '../../engine/index'
import { summarize } from './summary'
import { INTERACTIVE_MAX_N } from './tierBounds'

// U+2212 MINUS SIGN, built as data (never a typed escape) so the current-flow lines use the same character the
// base-10 preset's own labels use.
const MINUS = String.fromCodePoint(0x2212)

// follows the shipped interactive ceiling (data): the text view is complete at every Canvas base (Phase 6 UI-SPEC decision 4)
export const TEXT_VIEW_ZONE_LIMIT = INTERACTIVE_MAX_N

/** The over-limit message (Phase 6 D-01/D-02): the cutoff is the shipped interactive ceiling, always passed in, never a literal. */
export function overLimitMessage(base: number, interactiveMaxN: number): string {
  return `Base ${base} is above the interactive limit of ${interactiveMaxN}. Showing the summary and text view. To draw it, use headless export.`
}

/** The diagnostic tier=headless message for a base within the limit: never claims the base is over the limit. */
export function tierOverrideMessage(base: number): string {
  return `Tier override active. Showing the summary and text view for base ${base}.`
}

/** One Torque/Warp/Plex region line: its name, pair count, and its zone walk with the active zone labels. */
function regionLine(name: string, cycle: Cycle, zoneLabel: (zone: number) => string): string {
  const walk = Array.from(cycle.zones()).map(zoneLabel).join(' ')
  const pairWord = cycle.lengthInPairs === 1 ? 'pair' : 'pairs'
  return `${name}, ${cycle.lengthInPairs} ${pairWord}: ${walk}`
}

/**
 * A plain-text description of g using zoneLabel for every zone shown (the active label scheme, in-base numerals by
 * default). Bounded (T-04-21): above opts.zoneLimit (default TEXT_VIEW_ZONE_LIMIT) only the header block is produced
 * — no per-zone gate, no per-pair syzygy/current, no per-region zone walk — so an absurdly large base stays cheap.
 */
export function numogramText(g: Numogram, zoneLabel: (zone: number) => string, opts: { zoneLimit?: number } = {}): string {
  const n = g.base
  const zoneLimit = opts.zoneLimit ?? TEXT_VIEW_ZONE_LIMIT
  const summary = summarize(g)
  const lines: string[] = []

  lines.push(`CCRUG numogram, base ${n}`)
  lines.push(`Zones: ${n} (${zoneLabel(0)} to ${zoneLabel(n - 1)})`)
  lines.push(`Syzygies: ${n / 2}, each pair sums to ${formatNumeral(n - 1, n)}`)
  lines.push(`Warp: ${g.warp !== null ? 'yes' : 'no'}`)
  if (g.torqueCount > 0) {
    const lengths = summary.torqueLengths
    const more = g.torqueCount > lengths.length ? `, … +${g.torqueCount - lengths.length} more` : ''
    lines.push(`Torque cycles: ${g.torqueCount} (lengths in pairs: ${lengths.join(', ')}${more})`)
  } else {
    lines.push(`Torque cycles: ${g.torqueCount}`)
  }
  const tc = summary.typeCounts
  lines.push(`Demons: ${summary.demonCount} (chrono ${tc.chrono}, amphi ${tc.amphi}, xeno ${tc.xeno})`)

  if (n <= zoneLimit) {
    lines.push('')
    lines.push('Regions')
    g.torques.forEach((cycle, i) => {
      const name = g.torqueCount === 1 ? 'Torque' : `Torque ${torqueLabel(i)}`
      lines.push(regionLine(name, cycle, zoneLabel))
    })
    if (g.warp !== null) lines.push(regionLine('Warp', g.warp, zoneLabel))
    lines.push(regionLine('Plex', g.plex, zoneLabel))

    lines.push('')
    lines.push('Syzygies and currents')
    for (let q = 0; q < g.pairCount; q++) {
      const { lo, hi } = g.pair(q)
      const { to } = g.current(q)
      lines.push(
        `${zoneLabel(hi)}::${zoneLabel(lo)}  current ${formatNumeral(hi, n)}${MINUS}${formatNumeral(lo, n)}=${formatNumeral(to, n)}, flows to zone ${zoneLabel(to)}`,
      )
    }

    lines.push('')
    lines.push('Gates')
    for (let z = 0; z < g.zoneCount; z++) {
      const gate = g.gate(z)
      lines.push(
        `${formatGateName(gate.cumulation, n)}  zone ${zoneLabel(z)} -> zone ${zoneLabel(gate.to)}  (cumulation ${formatNumeral(gate.cumulation, n)})`,
      )
    }
  } else {
    lines.push('')
    lines.push(`Zone, syzygy and gate listings are shown up to ${zoneLimit} zones.`)
  }

  return lines.join('\n')
}
