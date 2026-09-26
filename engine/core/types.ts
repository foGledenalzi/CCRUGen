// Public contracts of the engine. Later Phase 2 plans (02-04 cycles and gates, 02-05 demon space, 02-06 demon groups)
// implement against these shapes. Pure types plus two constant tuples: no behaviour lives here.
//
// Units are always stated: a "pair" is a syzygy {z, base - 1 - z} (base / 2 of them), a "zone" is one of the base
// digits 0..base-1. A Cycle has lengthInPairs pairs and 2 * lengthInPairs zones.

export type RegionKind = 'plex' | 'warp' | 'torque'

/** One cycle of the pair -> next-pair permutation (a region). Lengths are stated in pairs AND zones. */
export interface Cycle {
  readonly id: number            // index in Numogram.cycles (canonical order)
  readonly kind: RegionKind
  readonly torqueIndex: number   // 0-based among Torque cycles in canonical order; -1 for Plex and Warp (numeric identity)
  readonly lengthInPairs: number
  readonly zoneCount: number     // 2 * lengthInPairs
  readonly firstPair: number     // smallest pair id (= smallest zone) of the cycle; flow order starts here
  pairAt(i: number): number      // pair id at flow position i, O(1)
  zoneAt(i: number): number      // zone at walk position i (0 <= i < zoneCount): odd member then even member of each pair in flow order
  pairs(): Int32Array            // fresh copy, O(lengthInPairs)
  zones(): Int32Array            // fresh copy of the walk, O(zoneCount)
}

/** A syzygy. id = lo = min(zone, base - 1 - zone), hi = base - 1 - lo; odd and even are its members by parity. */
export interface PairInfo { readonly id: number; readonly lo: number; readonly hi: number; readonly odd: number; readonly even: number }

/** The current of a pair {lo, hi}: it flows to the zone `to` = hi - lo, which is always odd (hi + lo = base - 1 is odd). */
export interface CurrentInfo { readonly pair: number; readonly lo: number; readonly hi: number; readonly to: number }

/** The gate of a zone: from = the zone, cumulation = T(from) = from(from+1)/2 in decimal, to = its digital root in the base. */
export interface GateInfo { readonly from: number; readonly to: number; readonly cumulation: number }

export interface Numogram {
  readonly base: number
  readonly zoneCount: number        // = base
  readonly pairCount: number        // = base / 2
  readonly cycleCount: number
  readonly torqueCount: number
  readonly cycles: readonly Cycle[] // canonical order: lengthInPairs descending, then smallest zone ascending (Torque cycles first, then Plex, then Warp)
  readonly torques: readonly Cycle[]
  readonly plex: Cycle
  readonly warp: Cycle | null
  readonly storageBytes: number     // bytes held in typed arrays (the eager O(n) part)
  readonly demons: DemonSpace       // lazy and virtual: created on first read, O(1) per query, no per-demon structure ever built
  cycleAt(id: number): Cycle
  partner(zone: number): number     // base - 1 - zone
  pairOf(zone: number): number      // pair id = min(zone, base - 1 - zone)
  pair(id: number): PairInfo
  current(pairId: number): CurrentInfo
  nextPair(pairId: number): number
  gate(zone: number): GateInfo
  cycleOfPair(pairId: number): Cycle
  cycleOfZone(zone: number): Cycle
}

export const DEMON_TYPES = ['chrono', 'amphi', 'xeno'] as const
export type DemonType = (typeof DEMON_TYPES)[number]

export const DEMON_SUBTYPES = [
  'cyclic-chrono',
  'cross-torque-chrono',
  'syzygetic-chrono',
  'plex-amphi',
  'warp-amphi',
  'chaotic-xeno',
  'syzygetic-xeno',
] as const
export type DemonSubtype = (typeof DEMON_SUBTYPES)[number]

/** One demon, the net-span a::b of two distinct zones. Derived on demand from the mesh number; never stored. */
export interface DemonRef {
  readonly a: number; readonly b: number   // a > b, net-span a::b
  readonly mesh: number                     // a(a-1)/2 + b
  readonly type: DemonType; readonly subtype: DemonSubtype
  readonly syzygetic: boolean               // a + b === base - 1
  readonly numodemon: boolean               // a + b === base
  readonly cycleA: number; readonly cycleB: number   // Cycle.id of zone a and of zone b
}

/** A selection of demons in ascending mesh order; never materialized as an array of all members. */
export interface DemonSelection { readonly count: number; at(k: number): DemonRef }   // k-th member in ascending mesh order

/** The virtual set of all base(base-1)/2 demons, served by index math over mesh numbers (no O(n^2) structure). */
export interface DemonSpace {
  readonly base: number
  readonly count: number                    // base(base-1)/2
  readonly numodemonCount: number           // base/2 - 1
  meshOf(a: number, b: number): number      // order-normalizing, a !== b
  netSpanOf(mesh: number): readonly [number, number]
  at(mesh: number): DemonRef
  ref(a: number, b: number): DemonRef
  counts(): Readonly<Record<DemonSubtype, number>>
  typeCounts(): Readonly<Record<DemonType, number>>
  incident(zone: number): Iterable<DemonRef>   // base - 1 demons, other zone ascending
  numodemons(): Iterable<DemonRef>             // b = 1 .. base/2 - 1, demon (base - b)::b
  /**
   * The demons of one type as a selection in ascending mesh order: count = typeCounts()[type], at(k) = the k-th of them
   * (RangeError unless k is a whole number in [0, count)). Unranked by a binary search over mesh numbers with closed-form
   * "how many members lie below mesh m" counts, so nothing is enumerated: O(log C(n, 2)) per at(k). RangeError for an
   * unknown type. The same frozen selection is returned for the same name.
   */
  group(type: DemonType): DemonSelection
  /**
   * The demons of one subtype in ascending mesh order (same contract as group). O(log C(n, 2)) per at(k) for every subtype
   * except 'cyclic-chrono' and 'cross-torque-chrono', which cost O(K log n log C(n, 2)) with K Torque cycles and build a
   * sorted copy of the Torque pair ids lazily on first use (O(n) once per numogram). RangeError for an unknown subtype.
   */
  subtype(subtype: DemonSubtype): DemonSelection
}
