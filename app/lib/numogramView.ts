// The base-generic view model the viewer renders from (MIG-02, UI-01). Base 10 returns the preset objects and the
// lore unchanged, so the frozen goldens keep seeing the same data; every other base gets structural lists with
// in-base numerals and no lore. Original CCRUG code (MIT, NOTICE section 1).
import { formatGateName, formatNetSpan, formatNumeral, type Numogram, type RegionKind } from '../../engine/index'
import type { CurrentData, Demon, GateData, SyzygyData, ZoneMeta } from '../data/types'
import { ALL_DEMONS, legacyKind } from '../presets/base10/demons'
import { CURRENTS } from '../presets/base10/currents'
import { GATE_LIST } from '../presets/base10/gates'
import { PLANET_SYMBOL, ZONE_CLR, ZONE_META, ZONE_PARTICLE } from '../presets/base10/lore'
import { TC, TC_CURRENTS, TC_EDGES, TC_SYZYGIES, ZONE_REGION } from '../presets/base10/regions'
import { SYZYGIES } from '../presets/base10/syzygies'
import { regionOfZone, type RegionId } from './regions'
import { ALL_CHORDS_MAX_N } from './tierBounds'
import { REGION_CLR } from './constants'

// U+2212 MINUS SIGN, built as data (never a typed escape) so the viewer's structural current labels use the same
// character as the base-10 preset's.
const MINUS = String.fromCodePoint(0x2212)

export const SUMMARY_TORQUE_LIMIT = 12

export interface NumogramSummary {
  readonly base: number
  readonly zoneCount: number
  readonly hasWarp: boolean
  readonly torqueCount: number
  readonly torqueLengths: readonly number[]
  readonly demonCount: number
  readonly typeCounts: Readonly<{ chrono: number; amphi: number; xeno: number }>
}

export interface Base10Lore {
  readonly zoneMeta: Readonly<Record<number, ZoneMeta>>
  readonly zoneParticle: Readonly<Record<number, string>>
  readonly planetSymbol: Readonly<Record<number, string>>
}

export interface NumogramView {
  readonly base: number
  readonly g: Numogram
  readonly zoneCount: number
  readonly zoneColors: readonly string[]
  readonly zoneKind: readonly RegionKind[]
  readonly zoneRegion: readonly RegionId[]
  readonly syzygies: readonly SyzygyData[]
  readonly currents: readonly CurrentData[]
  readonly gates: readonly GateData[]
  readonly demons: readonly Demon[] | null
  readonly torqueZones: ReadonlySet<number>
  readonly torqueEdges: readonly (readonly [number, number])[]
  readonly torqueWalks: readonly (readonly number[])[]
  readonly torqueCurrentNames: ReadonlySet<string>
  readonly torqueSyzygies: readonly (readonly [number, number])[]
  readonly lore: Base10Lore | null
  readonly summary: NumogramSummary
  partner(zone: number): number
  presetCurrentDest(c: CurrentData): number
}

/** The region-identity color of a cycle kind (torque cyan, warp green, plex brown). */
export function zoneColorFor(kind: RegionKind): string {
  return REGION_CLR[kind]
}

/**
 * A cheap summary of `g`: safe at any base, including a huge one, because it reads at most SUMMARY_TORQUE_LIMIT
 * Torque cycles through `cycleAt` (never materializing `g.torques`/`g.cycles`) and the virtual demon space's O(1)
 * `count`/`typeCounts()` (T-04-08).
 */
export function summarize(g: Numogram): NumogramSummary {
  const torqueCount = g.torqueCount
  const limit = Math.min(torqueCount, SUMMARY_TORQUE_LIMIT)
  const torqueLengths: number[] = []
  for (let i = 0; i < limit; i++) torqueLengths.push(g.cycleAt(i).lengthInPairs)
  const typeCounts = g.demons.typeCounts()
  return {
    base: g.base,
    zoneCount: g.zoneCount,
    hasWarp: g.warp !== null,
    torqueCount,
    torqueLengths,
    demonCount: g.demons.count,
    typeCounts: { chrono: typeCounts.chrono, amphi: typeCounts.amphi, xeno: typeCounts.xeno },
  }
}

/** Each Torque cycle's zone walk (flow order) with its first zone appended, closing the loop. */
function buildTorqueWalks(g: Numogram): number[][] {
  return g.torques.map(cycle => {
    const walk = Array.from(cycle.zones())
    return walk.length === 0 ? walk : [...walk, walk[0] as number]
  })
}

function buildTorqueZones(g: Numogram): Set<number> {
  const zones = new Set<number>()
  for (const cycle of g.torques) for (const zone of cycle.zones()) zones.add(zone)
  return zones
}

function buildTorqueEdges(g: Numogram): [number, number][] {
  const edges: [number, number][] = []
  for (const cycle of g.torques) {
    const walk = Array.from(cycle.zones())
    for (let i = 0; i < walk.length; i++) {
      edges.push([walk[i] as number, walk[(i + 1) % walk.length] as number])
    }
  }
  return edges
}

function buildTorqueSyzygies(g: Numogram): [number, number][] {
  const list: [number, number][] = []
  for (const cycle of g.torques) {
    for (let i = 0; i < cycle.lengthInPairs; i++) {
      const { lo, hi } = g.pair(cycle.pairAt(i))
      list.push([lo, hi])
    }
  }
  return list
}

function buildTorqueCurrentNames(g: Numogram): Set<string> {
  const names = new Set<string>()
  for (const cycle of g.torques) {
    for (let i = 0; i < cycle.lengthInPairs; i++) {
      const { lo, hi } = g.pair(cycle.pairAt(i))
      names.add(formatNetSpan(hi, lo, g.base))
    }
  }
  return names
}

/**
 * The zone a fixed-pair (non-Torque) current is drawn converging on is the lower member of its pair; a Torque
 * current keeps flowing to its engine-computed `to` (the base-10 authored drawing convention, generalized).
 */
function presetCurrentDestFor(g: Numogram, c: CurrentData): number {
  const cycle = g.cycleOfPair(g.pairOf(c.from))
  if (cycle.kind !== 'torque') return Math.min(c.from, g.partner(c.from))
  return c.to
}

/** Pair ids in view order: each Torque cycle's pairs in flow order, then the Warp pairs, then the Plex pairs. */
function structuralCurrentPairIds(g: Numogram): number[] {
  const ids: number[] = []
  for (const cycle of g.torques) {
    for (let i = 0; i < cycle.lengthInPairs; i++) ids.push(cycle.pairAt(i))
  }
  if (g.warp !== null) {
    for (let i = 0; i < g.warp.lengthInPairs; i++) ids.push(g.warp.pairAt(i))
  }
  for (let i = 0; i < g.plex.lengthInPairs; i++) ids.push(g.plex.pairAt(i))
  return ids
}

function buildStructuralSyzygies(g: Numogram): SyzygyData[] {
  const list: SyzygyData[] = []
  for (let q = g.pairCount - 1; q >= 0; q--) {
    const { lo, hi } = g.pair(q)
    list.push({ a: lo, b: hi, demon: formatNetSpan(hi, lo, g.base), desc: '' })
  }
  return list
}

function buildStructuralCurrents(g: Numogram): CurrentData[] {
  return structuralCurrentPairIds(g).map(q => {
    const { lo, hi } = g.pair(q)
    const { to } = g.current(q)
    const label = `${formatNumeral(hi, g.base)}${MINUS}${formatNumeral(lo, g.base)}=${formatNumeral(to, g.base)}`
    return { name: formatNetSpan(hi, lo, g.base), from: hi, to, label, desc: '' }
  })
}

function buildStructuralGates(g: Numogram): GateData[] {
  const list: GateData[] = []
  for (let z = 0; z < g.zoneCount; z++) {
    const gate = g.gate(z)
    list.push({ name: formatGateName(gate.cumulation, g.base), from: z, to: gate.to, cum: gate.cumulation, desc: '', detail: '' })
  }
  return list
}

function buildStructuralDemons(g: Numogram, allChordsMaxN: number): Demon[] | null {
  if (g.base > allChordsMaxN) return null
  const list: Demon[] = []
  const count = g.demons.count
  for (let m = 0; m < count; m++) {
    const d = g.demons.at(m)
    list.push({ a: d.a, b: d.b, name: formatNetSpan(d.a, d.b, g.base), kind: legacyKind(d.subtype) })
  }
  return list
}

function buildBase10View(g: Numogram, summary: NumogramSummary): NumogramView {
  const zoneColors: string[] = []
  const zoneKind: RegionKind[] = []
  const zoneRegion: RegionId[] = []
  for (let z = 0; z < g.zoneCount; z++) {
    const color = ZONE_CLR[z]
    const kind = ZONE_REGION[z]
    if (color === undefined || kind === undefined) throw new Error(`base-10 view: missing lore for zone ${z}`)
    zoneColors.push(color)
    zoneKind.push(kind)
    zoneRegion.push(regionOfZone(g, z))
  }

  return {
    base: g.base,
    g,
    zoneCount: g.zoneCount,
    zoneColors,
    zoneKind,
    zoneRegion,
    syzygies: SYZYGIES,
    currents: CURRENTS,
    gates: GATE_LIST,
    demons: ALL_DEMONS,
    torqueZones: TC,
    torqueEdges: TC_EDGES,
    torqueWalks: buildTorqueWalks(g),
    torqueCurrentNames: TC_CURRENTS,
    torqueSyzygies: TC_SYZYGIES,
    lore: { zoneMeta: ZONE_META, zoneParticle: ZONE_PARTICLE, planetSymbol: PLANET_SYMBOL },
    summary,
    partner: (zone: number) => g.partner(zone),
    presetCurrentDest: (c: CurrentData) => presetCurrentDestFor(g, c),
  }
}

function buildStructuralView(g: Numogram, summary: NumogramSummary, allChordsMaxN: number): NumogramView {
  const zoneColors: string[] = []
  const zoneKind: RegionKind[] = []
  const zoneRegion: RegionId[] = []
  for (let z = 0; z < g.zoneCount; z++) {
    const kind = g.cycleOfZone(z).kind
    zoneColors.push(zoneColorFor(kind))
    zoneKind.push(kind)
    zoneRegion.push(regionOfZone(g, z))
  }

  return {
    base: g.base,
    g,
    zoneCount: g.zoneCount,
    zoneColors,
    zoneKind,
    zoneRegion,
    syzygies: buildStructuralSyzygies(g),
    currents: buildStructuralCurrents(g),
    gates: buildStructuralGates(g),
    demons: buildStructuralDemons(g, allChordsMaxN),
    torqueZones: buildTorqueZones(g),
    torqueEdges: buildTorqueEdges(g),
    torqueWalks: buildTorqueWalks(g),
    torqueCurrentNames: buildTorqueCurrentNames(g),
    torqueSyzygies: buildTorqueSyzygies(g),
    lore: null,
    summary,
    partner: (zone: number) => g.partner(zone),
    presetCurrentDest: (c: CurrentData) => presetCurrentDestFor(g, c),
  }
}

/**
 * The view model of `g`: base 10 returns the preset objects and lore verbatim (byte-identical to the frozen
 * goldens); every other base gets structural lists built from the engine (no lore). SVG-tier bases only — this
 * builds O(n) lists (regionRows/zoneStates-scale), never call it for a huge base (D-16, T-04-08).
 */
export function buildNumogramView(g: Numogram, opts: { allChordsMaxN?: number } = {}): NumogramView {
  const allChordsMaxN = opts.allChordsMaxN ?? ALL_CHORDS_MAX_N
  const summary = summarize(g)
  return g.base === 10 ? buildBase10View(g, summary) : buildStructuralView(g, summary, allChordsMaxN)
}
