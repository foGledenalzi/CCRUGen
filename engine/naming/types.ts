// The naming data contract (NAM-01, NAM-02, plan 07-05). A Naming is an immutable value: the per-zone sounds (dense up to the
// interactive ceiling, absent above it), the locks, the sparse per-demon overrides and the rule settings. A demon's name is NOT
// stored here: it is derived at read time (derive.ts), so nothing per-demon exists at 221,445 demons or at 2^26 zones.
//
// Override keys are decimal mesh numbers a(a-1)/2 + b (meshOf in engine/core), the same demon id at every base, in memory and in
// JSON. The history key `rev` is not part of a Naming; the application session owns it.

import type { StyleId } from './banks'

/** How the two zone sounds of a demon are joined: the higher zone first (the default) or the lower zone first. */
export type JoinOrder = 'hi-lo' | 'lo-hi'

export const JOIN_ORDERS: readonly JoinOrder[] = Object.freeze(['hi-lo', 'lo-hi'] as JoinOrder[])

export function isJoinOrder(v: unknown): v is JoinOrder {
  return typeof v === 'string' && (JOIN_ORDERS as readonly string[]).includes(v)
}

/** Where the zone sounds came from: the seeded generator, or the base-10 CCRU preset (which also names the 45 demons). */
export type NamingSource = 'generated' | 'ccru'

/** 0 = off, 1 = euphony@1 (EUPHONY_VERSION). */
export type Smoothing = 0 | 1

export interface NamingMeta {
  readonly title: string
  readonly notes: string
}

export interface Naming {
  readonly base: number
  readonly source: NamingSource
  /** Normalised (normalizeSeed), always present: the seed field of the panel always has a value. */
  readonly seed: string
  readonly style: StyleId
  readonly join: JoinOrder
  readonly smoothing: Smoothing
  /** Dense table, length base, when base <= the interactive ceiling; null = seed-only (names derive lazily from the generator). */
  readonly sounds: readonly string[] | null
  /** Zones whose sound survives regeneration (a typed or pasted sound locks its zone). */
  readonly locks: ReadonlySet<number>
  /** Sparse per-demon names, key = mesh number a(a-1)/2 + b, value = the text exactly as typed (NFC, trimmed). */
  readonly overrides: ReadonlyMap<number, string>
  readonly meta: NamingMeta | null
}

/** The CCRU preset enters the engine only as an argument; the engine owns no preset table and no canonical name. */
export interface NamingPreset {
  readonly id: 'ccru'
  readonly base: number
  /** One sound per zone, length base. */
  readonly sounds: readonly string[]
  /** Canonical demon names keyed by mesh number. */
  readonly names: Readonly<Record<number, string>>
}

/** Which layer a demon's name comes from. */
export type NameState = 'generated' | 'preset' | 'overridden'

export interface NameResolver {
  readonly base: number
  /** The sound of a zone: the dense entry, or the generator's lazy sound above the ceiling. RangeError outside [0, base). */
  soundOf(zone: number): string
  /** The name of the demon on zones a and b (either order). RangeError for a zone outside [0, base) and for a === b. */
  nameOf(a: number, b: number): string
  /** The join, smoothing and capital rule applied to the two sounds, ignoring overrides and the preset. */
  ruleNameOf(a: number, b: number, smoothing: Smoothing): string
  /** The preset's name for the demon, non-null only when the preset layer applies (source ccru, a preset of this base, a named demon). */
  presetNameOf(a: number, b: number): string | null
  stateOf(a: number, b: number): NameState
}

export interface CreateNamingOptions {
  readonly base: number
  /** The interactive ceiling from the tier table: above it a naming is seed-only. */
  readonly interactiveMaxN: number
  readonly source?: NamingSource
  readonly seed?: string
  readonly style?: StyleId
  readonly join?: JoinOrder
  readonly smoothing?: Smoothing
  readonly preset?: NamingPreset | null
}
