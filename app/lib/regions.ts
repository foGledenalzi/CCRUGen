// Region identity and isolate/mute state (UI-05, D-19..D-24), derived from the engine's Cycle[]: never a
// single-Torque assumption. Original CCRUG code (MIT, NOTICE section 1).
//
// regionRows/zoneStates and the 'torque' umbrella branch of zonesOfRegion read every Torque cycle's zones() walk:
// callers must only use them for a base in the SVG tier (small n), never a huge base (D-16, T-04-08).
import { torqueLabel, type Numogram, type RegionKind } from '../../engine/index'

export type RegionId = 'plex' | 'warp' | 'torque' | `torque:${number}`

export interface RegionRow {
  readonly id: RegionId
  readonly kind: RegionKind
  readonly label: string
  readonly torqueIndex: number
  readonly lengthInPairs: number
  readonly zones: readonly number[]
}

const TORQUE_INDEX_RE = /^torque:(0|[1-9][0-9]*)$/

function ascending(zones: Iterable<number>): number[] {
  return Array.from(zones).sort((a, b) => a - b)
}

/**
 * Every region row of `g`: one row per Torque cycle (id 'torque', label 'Torque' when there is exactly one; else
 * 'torque:<index>', label `Torque ${torqueLabel(index)}`, in the engine's own canonical order — length descending,
 * D-24), then 'warp' if present, then 'plex' (D-23: every row gets identical isolate/mute treatment; only the
 * presentation order singles out Plex/Warp last). SVG-tier bases only (materializes every Torque cycle's zones).
 */
export function regionRows(g: Numogram): RegionRow[] {
  const rows: RegionRow[] = []
  const torqueCount = g.torqueCount
  for (let i = 0; i < torqueCount; i++) {
    const cycle = g.torques[i]
    if (cycle === undefined) throw new RangeError(`regionRows: base ${g.base} is missing Torque cycle ${i}`)
    const id: RegionId = torqueCount === 1 ? 'torque' : `torque:${i}`
    const label = torqueCount === 1 ? 'Torque' : `Torque ${torqueLabel(i)}`
    rows.push({ id, kind: 'torque', label, torqueIndex: i, lengthInPairs: cycle.lengthInPairs, zones: ascending(cycle.zones()) })
  }
  if (g.warp !== null) {
    rows.push({ id: 'warp', kind: 'warp', label: 'Warp', torqueIndex: -1, lengthInPairs: g.warp.lengthInPairs, zones: ascending(g.warp.zones()) })
  }
  rows.push({ id: 'plex', kind: 'plex', label: 'Plex', torqueIndex: -1, lengthInPairs: g.plex.lengthInPairs, zones: ascending(g.plex.zones()) })
  return rows
}

/**
 * Whether `value` is a region id valid for `g`: 'plex' always; 'warp' iff `g.warp` exists; 'torque' (the umbrella,
 * covering every Torque cycle) iff `g.torqueCount >= 1`; `torque:<index>` (a single-cycle row id) iff there are at
 * least two Torque cycles and `index < g.torqueCount`. Matched by exact string comparison and a strict regex only —
 * `value` is never used as a property key (T-04-07), so '__proto__'/'constructor' are ordinary rejected strings.
 */
export function isRegionId(value: string, g: Numogram): value is RegionId {
  if (value === 'plex') return true
  if (value === 'warp') return g.warp !== null
  if (value === 'torque') return g.torqueCount >= 1
  const match = TORQUE_INDEX_RE.exec(value)
  if (match === null) return false
  if (g.torqueCount < 2) return false
  const group = match[1]
  if (group === undefined) return false
  const index = Number(group)
  return index < g.torqueCount
}

export function parseRegionId(value: string | null | undefined, g: Numogram): RegionId | null {
  if (value === null || value === undefined) return null
  return isRegionId(value, g) ? value : null
}

/** The row id of the cycle `zone` belongs to. */
export function regionOfZone(g: Numogram, zone: number): RegionId {
  const cycle = g.cycleOfZone(zone)
  if (cycle.kind === 'plex') return 'plex'
  if (cycle.kind === 'warp') return 'warp'
  return g.torqueCount === 1 ? 'torque' : `torque:${cycle.torqueIndex}`
}

/** The zones of region `id`, ascending; 'torque' is the union of every Torque cycle's zones. SVG-tier bases only. */
export function zonesOfRegion(g: Numogram, id: RegionId): number[] {
  if (id === 'plex') return ascending(g.plex.zones())
  if (id === 'warp') {
    if (g.warp === null) throw new RangeError(`zonesOfRegion: base ${g.base} has no Warp cycle`)
    return ascending(g.warp.zones())
  }
  if (id === 'torque') {
    const zones: number[] = []
    for (const cycle of g.torques) zones.push(...cycle.zones())
    return ascending(zones)
  }
  const match = TORQUE_INDEX_RE.exec(id)
  const group = match?.[1]
  if (match === null || group === undefined) throw new RangeError(`zonesOfRegion: invalid region id ${JSON.stringify(id)}`)
  const index = Number(group)
  const cycle = g.torques[index]
  if (cycle === undefined) throw new RangeError(`zonesOfRegion: base ${g.base} has no Torque cycle ${index}`)
  return ascending(cycle.zones())
}

/** Isolate (spotlight) and mute (hard hide) are independent per-region sets (D-19, D-22). */
export interface RegionFilter {
  readonly isolate: ReadonlySet<RegionId>
  readonly mute: ReadonlySet<RegionId>
}

export const EMPTY_REGION_FILTER: RegionFilter = { isolate: new Set(), mute: new Set() }

function toggled(set: ReadonlySet<RegionId>, id: RegionId): Set<RegionId> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function toggleIsolate(f: RegionFilter, id: RegionId): RegionFilter {
  return { isolate: toggled(f.isolate, id), mute: f.mute }
}

export function toggleMute(f: RegionFilter, id: RegionId): RegionFilter {
  return { isolate: f.isolate, mute: toggled(f.mute, id) }
}

function sanitizedSet(set: ReadonlySet<RegionId>, g: Numogram): Set<RegionId> {
  const next = new Set<RegionId>()
  for (const id of set) if (isRegionId(id, g)) next.add(id)
  return next
}

/** Drops ids that are not valid for `g` (e.g. a stale `torque:5` after switching to a base with fewer cycles). */
export function sanitizeRegionFilter(f: RegionFilter, g: Numogram): RegionFilter {
  return { isolate: sanitizedSet(f.isolate, g), mute: sanitizedSet(f.mute, g) }
}

export function regionFilterActive(f: RegionFilter): boolean {
  return f.isolate.size > 0 || f.mute.size > 0
}

export const ZONE_HIDDEN = 0
export const ZONE_DIMMED = 1
export const ZONE_NORMAL = 2

/**
 * Per-zone isolate/mute state (D-19, D-22, D-23): muted -> ZONE_HIDDEN (wins over isolate); else, when isolate is
 * non-empty, a zone in no isolated region -> ZONE_DIMMED, one in an isolated region -> ZONE_NORMAL; an empty filter
 * -> ZONE_NORMAL everywhere. SVG-tier bases only (calls zonesOfRegion for every filtered id).
 */
export function zoneStates(g: Numogram, f: RegionFilter): Uint8Array {
  const states = new Uint8Array(g.zoneCount).fill(ZONE_NORMAL)
  if (f.isolate.size > 0) {
    states.fill(ZONE_DIMMED)
    for (const id of f.isolate) {
      if (!isRegionId(id, g)) continue
      for (const zone of zonesOfRegion(g, id)) states[zone] = ZONE_NORMAL
    }
  }
  for (const id of f.mute) {
    if (!isRegionId(id, g)) continue
    for (const zone of zonesOfRegion(g, id)) states[zone] = ZONE_HIDDEN
  }
  return states
}

/** The state of a multi-zone element (a syzygy, current or gate): the minimum (most-hidden) state of its zones. */
export function elementState(states: Uint8Array, zones: readonly number[]): 0 | 1 | 2 {
  let min: number = ZONE_NORMAL
  for (const zone of zones) {
    const state = states[zone]
    if (state !== undefined && state < min) min = state
  }
  return min as 0 | 1 | 2
}
