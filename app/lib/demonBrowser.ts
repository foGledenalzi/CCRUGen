// Demon browser data layer (DEM-01, DEM-02, DEM-05): taxonomy, facets, names, row sources. Original CCRUG code (MIT, NOTICE section 1).
import {
  DEMON_SUBTYPES,
  DEMON_TYPES,
  formatNetSpan,
  type DemonRef,
  type DemonSubtype,
  type DemonType,
  type Numogram,
} from '../../engine/index'
import type { Demon } from '../data/types'
import { legacyKind, type LegacyDemonKind } from '../presets/base10/demons'
import { DEMON_NAMES } from '../presets/base10/lore'

// ── Taxonomy ───────────────────────────────────────────────────────────────

export type DemonFilter = DemonType | DemonSubtype
export type FacetId = 'all' | DemonFilter

export const KIND_COLOR: Readonly<Record<LegacyDemonKind, string>> = Object.freeze({
  chrono: '#00ccff',
  amphi: '#cc8833',
  xeno: '#cc3333',
  syzygy: '#e8e8e8',
})
export const KIND_LABEL: Readonly<Record<LegacyDemonKind, string>> = Object.freeze({
  chrono: 'Chrono',
  amphi: 'Amphi',
  xeno: 'Xeno',
  syzygy: 'Syzygetic',
})
export const LEGACY_KINDS: readonly LegacyDemonKind[] = Object.freeze(['chrono', 'amphi', 'xeno', 'syzygy'])
export const NEUTRAL_FACET_COLOR = '#6b7280'
export const TYPE_COLOR: Readonly<Record<DemonType, string>> = Object.freeze({
  chrono: '#00ccff',
  amphi: '#cc8833',
  xeno: '#cc3333',
})
export const TYPE_LABEL: Readonly<Record<DemonType, string>> = Object.freeze({
  chrono: 'Chrono',
  amphi: 'Amphi',
  xeno: 'Xeno',
})
export const SUBTYPE_CHIP_LABEL: Readonly<Record<DemonSubtype, string>> = Object.freeze({
  'cyclic-chrono': 'Cyclic',
  'cross-torque-chrono': 'Cross-Torque',
  'syzygetic-chrono': 'Syzygetic',
  'plex-amphi': 'Plex',
  'warp-amphi': 'Warp',
  'chaotic-xeno': 'Chaotic',
  'syzygetic-xeno': 'Syzygetic',
})
export const SUBTYPE_LABEL: Readonly<Record<DemonSubtype, string>> = Object.freeze({
  'cyclic-chrono': 'Cyclic chrono',
  'cross-torque-chrono': 'Cross-Torque chrono',
  'syzygetic-chrono': 'Syzygetic chrono',
  'plex-amphi': 'Plex amphi',
  'warp-amphi': 'Warp amphi',
  'chaotic-xeno': 'Chaotic xeno',
  'syzygetic-xeno': 'Syzygetic xeno',
})
export const SUBTYPES_OF: Readonly<Record<DemonType, readonly DemonSubtype[]>> = Object.freeze({
  chrono: ['cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono'],
  amphi: ['plex-amphi', 'warp-amphi'],
  xeno: ['chaotic-xeno', 'syzygetic-xeno'],
})

/** Exact membership against the engine's own DEMON_TYPES tuple; `value` is never used as a property key. */
export function isDemonType(value: unknown): value is DemonType {
  return typeof value === 'string' && (DEMON_TYPES as readonly string[]).includes(value)
}

/** Exact membership against the engine's own DEMON_SUBTYPES tuple; `value` is never used as a property key. */
export function isDemonSubtype(value: unknown): value is DemonSubtype {
  return typeof value === 'string' && (DEMON_SUBTYPES as readonly string[]).includes(value)
}

export function isDemonFilter(value: unknown): value is DemonFilter {
  return isDemonType(value) || isDemonSubtype(value)
}

/** A type returns itself; a subtype is looked up by iterating DEMON_TYPES/SUBTYPES_OF (never string splitting). */
export function parentType(filter: DemonFilter): DemonType {
  for (const type of DEMON_TYPES) {
    if (filter === type) return type
    if ((SUBTYPES_OF[type] as readonly string[]).includes(filter)) return type
  }
  throw new RangeError(`parentType: unknown demon filter ${JSON.stringify(filter)}`)
}

export function filterLabel(filter: DemonFilter | null): string {
  if (filter === null) return 'All'
  if (isDemonType(filter)) return TYPE_LABEL[filter]
  return SUBTYPE_LABEL[filter]
}

export function filterContains(filter: DemonFilter | null, d: DemonRef): boolean {
  if (filter === null) return true
  if (isDemonType(filter)) return d.type === filter
  return d.subtype === filter
}

/** The ONLY way any Phase 5 surface colors a demon: reduces the 7 subtypes to the 4-bucket legacy kind palette. */
export function kindColor(subtype: DemonSubtype): string {
  return KIND_COLOR[legacyKind(subtype)]
}

export function facetCount(g: Numogram, filter: DemonFilter | null): number {
  if (filter === null) return g.demons.count
  if (isDemonType(filter)) return g.demons.typeCounts()[filter]
  return g.demons.counts()[filter]
}

export interface FacetChip {
  readonly id: FacetId
  readonly filter: DemonFilter | null
  readonly label: string
  readonly count: number
  readonly color: string
  readonly level: 'type' | 'subtype'
  readonly active: boolean
  readonly disabled: boolean
}

export interface FacetModel {
  readonly total: number
  readonly top: readonly FacetChip[]
  readonly sub: readonly FacetChip[]
}

/**
 * top = All (never disabled: every even base has at least one demon) followed by one chip per DEMON_TYPES entry.
 * sub = [] when active is null, else the chips of SUBTYPES_OF[parentType(active)] in order. Counts come from exactly
 * one call each to g.demons.typeCounts()/counts() (closed forms, T-05-02) — never a loop over demons.
 */
export function facetModel(g: Numogram, active: DemonFilter | null): FacetModel {
  const total = g.demons.count
  const typeCounts = g.demons.typeCounts()
  const subtypeCounts = g.demons.counts()

  const top: FacetChip[] = [
    {
      id: 'all',
      filter: null,
      label: 'All',
      count: total,
      color: NEUTRAL_FACET_COLOR,
      level: 'type',
      active: active === null,
      disabled: false,
    },
    ...DEMON_TYPES.map(
      (type): FacetChip => ({
        id: type,
        filter: type,
        label: TYPE_LABEL[type],
        count: typeCounts[type],
        color: TYPE_COLOR[type],
        level: 'type',
        active: active === type,
        disabled: typeCounts[type] === 0,
      }),
    ),
  ]

  const sub: FacetChip[] =
    active === null
      ? []
      : SUBTYPES_OF[parentType(active)].map(
          (subtype): FacetChip => ({
            id: subtype,
            filter: subtype,
            label: SUBTYPE_CHIP_LABEL[subtype],
            count: subtypeCounts[subtype],
            color: kindColor(subtype),
            level: 'subtype',
            active: active === subtype,
            disabled: subtypeCounts[subtype] === 0,
          }),
        )

  return { total, top, sub }
}

// ── Names (DEM-05) and the legacy Demon adapter ─────────────────────────────

/** base === 10 -> the lore module's own table by identity; every other base has no name table. */
export function demonNameTable(base: number): Readonly<Record<number, string>> | null {
  return base === 10 ? DEMON_NAMES : null
}

/** base 10 only: the CCRU name at this mesh number, or null (D-02: empty, not hidden) at every other base or mesh. */
export function demonName(base: number, mesh: number): string | null {
  return base === 10 ? (DEMON_NAMES[mesh] ?? null) : null
}

/** Label-scheme-aware display join for a net-span (research Pitfall 4): `${zoneLabel(a)}::${zoneLabel(b)}`. */
export function netSpanLabel(a: number, b: number, zoneLabel: (zone: number) => string): string {
  return `${zoneLabel(a)}::${zoneLabel(b)}`
}

/** DemonRef -> the legacy Demon shape InfoDisplay/Projection consume: base-10 lore name, else a net-span fallback. */
export function legacyDemon(d: DemonRef, base: number): Demon {
  return {
    a: d.a,
    b: d.b,
    name: demonName(base, d.mesh) ?? formatNetSpan(d.a, d.b, base),
    kind: legacyKind(d.subtype),
  }
}

// ── Row sources, sort, rank and window paging (DEM-02) ──────────────────────

export type DemonSortKey = 'mesh' | 'type'
export type SortDirection = 'asc' | 'desc'
export interface DemonSort {
  readonly key: DemonSortKey
  readonly direction: SortDirection
}
export const DEFAULT_DEMON_SORT: DemonSort = Object.freeze({ key: 'mesh', direction: 'asc' })

/** Two-method shape every full space and every filtered selection implements identically: never materialized. */
export interface DemonRowSource {
  readonly count: number
  at(k: number): DemonRef
}

// Rows one virtualized window may hold; 250,000 x 22px = 5.5M px stays under every browser's element-height cap
// and bounds TanStack Virtual's own O(count) geometry cache (T-05-17); base 666 (221,445) fits in one window.
export const BROWSER_WINDOW_ROWS = 250_000
export const ROW_HEIGHT_PX = 22 // UI-SPEC fixed row height

function checkRowIndex(k: number, count: number, label: string): number {
  if (!Number.isInteger(k) || k < 0 || k >= count) {
    throw new RangeError(`${label}: index ${k} outside [0, ${count})`)
  }
  return k
}

/** The parts (in order) a 'type' sort concatenates: every subtype (null), a type's subtypes, or one subtype alone. */
function typeSortParts(filter: DemonFilter | null): readonly DemonSubtype[] {
  if (filter === null) return DEMON_SUBTYPES
  if (isDemonType(filter)) return SUBTYPES_OF[filter]
  return [filter]
}

/**
 * The row source backing the browser/facet/rank logic for `filter` under sort key `key`. Mesh key: the engine's own
 * selection object by identity (null -> g.demons, a type -> g.demons.group(type), a subtype -> g.demons.subtype(s)).
 * Type key: the filter's subtypes concatenated in SUBTYPES_OF order (a lone subtype returns g.demons.subtype(s)
 * directly rather than a 1-part concatSources wrapper). Only ever calls group()/subtype() with a name that has
 * already passed isDemonType/isDemonSubtype (T-05-01).
 */
export function rowSourceFor(g: Numogram, filter: DemonFilter | null, key: DemonSortKey): DemonRowSource {
  if (key === 'mesh') {
    if (filter === null) return g.demons
    if (isDemonType(filter)) return g.demons.group(filter)
    return g.demons.subtype(filter)
  }
  const parts = typeSortParts(filter)
  const only = parts.length === 1 ? parts[0] : undefined
  if (only !== undefined) return g.demons.subtype(only)
  return concatSources(parts.map(subtype => g.demons.subtype(subtype)))
}

/** count = sum of part counts; at(k) delegates exactly one underlying at() call, after one range check. */
export function concatSources(parts: readonly DemonRowSource[]): DemonRowSource {
  const count = parts.reduce((sum, part) => sum + part.count, 0)
  return {
    count,
    at(k: number): DemonRef {
      checkRowIndex(k, count, 'concatSources')
      let offset = k
      for (const part of parts) {
        if (offset < part.count) return part.at(offset)
        offset -= part.count
      }
      throw new RangeError(`concatSources: index ${k} outside [0, ${count})`)
    },
  }
}

/** Ascending mesh order is native (`source` itself); descending is index arithmetic only, no separate sort code path. */
export function orderedSource(source: DemonRowSource, direction: SortDirection): DemonRowSource {
  if (direction === 'asc') return source
  const count = source.count
  return {
    count,
    at(k: number): DemonRef {
      checkRowIndex(k, count, 'orderedSource')
      return source.at(count - 1 - k)
    },
  }
}

/** The n-1 demons incident to `zone`, other zone ascending, O(1) per at(k) via g.demons.ref (never enumerated). */
export function incidentSource(g: Numogram, zone: number): DemonRowSource {
  const count = g.base - 1
  return {
    count,
    at(k: number): DemonRef {
      checkRowIndex(k, count, 'incidentSource')
      return g.demons.ref(zone, k < zone ? k : k + 1)
    },
  }
}

/** A one-row source wrapping a single already-known demon (e.g. a browser-to-diagram single-demon focus). */
export function singleSource(d: DemonRef): DemonRowSource {
  return {
    count: 1,
    at(k: number): DemonRef {
      checkRowIndex(k, 1, 'singleSource')
      return d
    },
  }
}

/**
 * The row of `mesh` in `source` (mesh-ordered, per DemonSelection's documented ascending-mesh-order contract), or
 * null when absent: binary search over source.at(k).mesh, O(log count), never a linear scan.
 */
export function rankOfMesh(source: DemonRowSource, mesh: number): number | null {
  let lo = 0
  let hi = source.count - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const m = source.at(mid).mesh
    if (m === mesh) return mid
    if (m < mesh) lo = mid + 1
    else hi = mid - 1
  }
  return null
}

/**
 * The row of demon `d` under `filter`/`sort`, or null when `d` is outside the filter. Mesh key: rankOfMesh over the
 * mesh-ordered source. Type key: the sum of the preceding parts' counts (closed-form .count reads, never enumerated)
 * plus rankOfMesh within d's own subtype. Descending direction flips the ascending rank via count - 1 - r.
 */
export function rankOf(g: Numogram, filter: DemonFilter | null, sort: DemonSort, d: DemonRef): number | null {
  if (!filterContains(filter, d)) return null
  let ascending: number | null
  if (sort.key === 'mesh') {
    ascending = rankOfMesh(rowSourceFor(g, filter, 'mesh'), d.mesh)
  } else {
    let offset = 0
    for (const subtype of typeSortParts(filter)) {
      if (subtype === d.subtype) break
      offset += g.demons.subtype(subtype).count
    }
    const within = rankOfMesh(g.demons.subtype(d.subtype), d.mesh)
    ascending = within === null ? null : offset + within
  }
  if (ascending === null) return null
  if (sort.direction === 'asc') return ascending
  return rowSourceFor(g, filter, sort.key).count - 1 - ascending
}

export interface BrowserWindow {
  readonly start: number
  readonly size: number
  readonly count: number
}

/** The number of 250,000-row windows `count` rows need; at least 1 even when count is 0. */
export function windowCount(count: number): number {
  return Math.max(1, Math.ceil(count / BROWSER_WINDOW_ROWS))
}

/** The window at `page` (clamped to [0, windowCount(count) - 1]): start = page * W, size = min(W, count - start). */
export function windowAt(count: number, page: number): BrowserWindow {
  const pages = windowCount(count)
  const clamped = Math.min(Math.max(page, 0), pages - 1)
  const start = clamped * BROWSER_WINDOW_ROWS
  const size = count === 0 ? 0 : Math.min(BROWSER_WINDOW_ROWS, count - start)
  return { start, size, count }
}

/** The window containing row `index` of `count` total rows. */
export function windowFor(count: number, index: number): BrowserWindow {
  return windowAt(count, Math.floor(index / BROWSER_WINDOW_ROWS))
}
