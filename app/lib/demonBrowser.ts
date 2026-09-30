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
