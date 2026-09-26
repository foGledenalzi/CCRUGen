// Unranking of demon types and subtypes in ascending mesh order (ENG-03, D-13, D-14). group('chrono').at(k) is the k-th
// chronodemon by mesh number, found without enumerating demons: a binary search over mesh numbers driven by countBelow(m),
// the number of members of the selection whose mesh number is below m, which is a closed form.
//
// Why a closed form exists. A demon a::b (a > b) has mesh a(a-1)/2 + b, so the demons below mesh m = a(a-1)/2 + b are all
// demons of the rows a' < a (both zones below a) plus the demons (a, y) with y < b. For every selector the members inside
// "both zones below x" and "one zone fixed, the other below y" follow from how many zones below x are Torque, Plex or Warp
// (Plex = zones 0 and n - 1, Warp = the two zones of the fixed pair {o, n - 1 - o}, at most 4 non-Torque zones in all) and,
// for the two subtypes that care WHICH Torque cycle, from how many zones of each Torque cycle lie below x.
//
// Notation: n the base, n1 = n - 1, o the Warp's low zone (there is a Warp iff n1 is divisible by 3), C(x, 2) = x(x-1)/2,
// S_c the ascending pair ids of Torque cycle c (length L_c). Every value stays below 2^52 (n <= 2^26), so all sums, products
// and comparisons are exact doubles; nothing here needs BigInt.
//
//   plexBelow(x)     = (0 < x) + (n1 < x)                     Plex zones below x
//   warpBelow(x)     = (o < x) + (n1 - o < x)                 Warp zones below x (0 without a Warp)
//   torqueBelow(x)   = x - plexBelow(x) - warpBelow(x)
//   zonesBelow_c(x)  = #{s in S_c : s < x} + L_c - #{s in S_c : s <= n1 - x}   zones of Torque cycle c below x
//   syzBelow_c(x)    = L_c - #{s in S_c : s <= n1 - x}                          pairs of c whose high zone is below x
//
// Cost per at(k): about log2 C(n, 2) <= 51 steps of countBelow. countBelow is O(1) for the three types and five of the
// seven subtypes. cyclic-chrono and cross-torque-chrono add a sum over the K Torque cycles with two binary searches each,
// O(K log n) per step, over a sorted copy of the Torque pair ids that is built once per numogram on first use (O(n log n)
// worst case, a few hundred ms at 2^26, never touched by any other selector).

import type { NumogramInternals } from './numogram' // type only: no runtime import cycle with numogram.ts and demons.ts
import { DEMON_TYPES } from './types'
import type { DemonRef, DemonSelection, DemonSpace, DemonSubtype, DemonType } from './types'

type Selector = DemonType | DemonSubtype

/** The few numbers every count needs: the base, the typed arrays and where the Warp's two zones are (-1 without a Warp). */
interface Geometry {
  readonly n: number
  readonly s: NumogramInternals
  readonly warpLo: number
  readonly warpHi: number
}

function geometryOf(base: number, s: NumogramInternals): Geometry {
  const warpLo = s.warpId >= 0 ? (s.first[s.warpId] ?? 0) : -1
  return { n: base, s, warpLo, warpHi: warpLo >= 0 ? base - 1 - warpLo : -1 }
}

/** C(x, 2) for a whole number x; exactly +0 below 2 (never -0). */
function choose2(x: number): number {
  return x < 2 ? 0 : (x * (x - 1)) / 2
}

function plexBelow(g: Geometry, x: number): number {
  return (0 < x ? 1 : 0) + (g.n - 1 < x ? 1 : 0)
}

function warpBelow(g: Geometry, x: number): number {
  return g.warpLo < 0 ? 0 : (g.warpLo < x ? 1 : 0) + (g.warpHi < x ? 1 : 0)
}

function nonTorqueBelow(g: Geometry, x: number): number {
  return plexBelow(g, x) + warpBelow(g, x)
}

function torqueBelow(g: Geometry, x: number): number {
  return x - nonTorqueBelow(g, x)
}

// ---- the sorted Torque pairs (only cyclic-chrono and cross-torque-chrono ever build this) ----

/**
 * One copy per numogram, made on first use: the Torque part of `flow` (Torque cycles are ids 0 .. torqueCount - 1 and their
 * segments are contiguous from offset 0) with every cycle's own segment sorted ascending. Keyed by the numogram's internal
 * arrays, so it lives exactly as long as the numogram and needs no writable field on the frozen demon space.
 */
const sortedTorquePairs = new WeakMap<NumogramInternals, Int32Array>()

function sortedPairsOf(s: NumogramInternals): Int32Array {
  let sorted = sortedTorquePairs.get(s)
  if (sorted === undefined) {
    const torquePairs = s.offset[s.plexId] ?? 0 // the Plex is the first cycle after the Torque cycles
    sorted = s.flow.slice(0, torquePairs) // a copy: the numogram's own arrays are never written
    for (let c = 0; c < s.torqueCount; c++) {
      const start = s.offset[c] ?? 0
      sorted.subarray(start, start + (s.length[c] ?? 0)).sort() // typed arrays sort numerically
    }
    sortedTorquePairs.set(s, sorted)
  }
  return sorted
}

/** #{i in [start, end) : a[i] < v} for an ascending segment. */
function countLess(a: Int32Array, start: number, end: number, v: number): number {
  let lo = start
  let hi = end
  while (lo < hi) {
    const mid = (lo + hi) >>> 1 // indices stay below 2^25, so this is exact
    if ((a[mid] ?? 0) < v) lo = mid + 1
    else hi = mid
  }
  return lo - start
}

/** #{i in [start, end) : a[i] <= v} for an ascending segment. */
function countAtMost(a: Int32Array, start: number, end: number, v: number): number {
  let lo = start
  let hi = end
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((a[mid] ?? 0) <= v) lo = mid + 1
    else hi = mid
  }
  return lo - start
}

/** Zones of Torque cycle c below x: its low zones below x plus its high zones below x. Requires 0 <= x <= n - 1. */
function zonesBelow(g: Geometry, sorted: Int32Array, c: number, x: number): number {
  const start = g.s.offset[c] ?? 0
  const end = start + (g.s.length[c] ?? 0)
  return countLess(sorted, start, end, x) + (end - start) - countAtMost(sorted, start, end, g.n - 1 - x)
}

/** Syzygies of Torque cycle c with both zones below x, that is with the high zone below x. Requires 0 <= x <= n - 1. */
function syzygiesBelow(g: Geometry, sorted: Int32Array, c: number, x: number): number {
  const start = g.s.offset[c] ?? 0
  const end = start + (g.s.length[c] ?? 0)
  return end - start - countAtMost(sorted, start, end, g.n - 1 - x)
}

/**
 * Sum over the Torque cycles of C(zonesBelow_c(a), 2), minus syzBelow_c(a) when `minusSyzygies`: the pairs of zones below a
 * inside one Torque cycle (with the syzygies taken out for cyclic-chrono). O(K log n).
 */
function sameCycleWithin(g: Geometry, a: number, minusSyzygies: boolean): number {
  const sorted = sortedPairsOf(g.s)
  let sum = 0
  for (let c = 0; c < g.s.torqueCount; c++) {
    sum += choose2(zonesBelow(g, sorted, c, a))
    if (minusSyzygies) sum -= syzygiesBelow(g, sorted, c, a)
  }
  return sum
}

// ---- within(sel, a) and row(sel, a, b) ----

/** The members of `sel` with both zones below a (that is, in the rows a' < a). Requires 1 <= a <= n - 1. */
function within(g: Geometry, sel: Selector, a: number): number {
  const n = g.n
  switch (sel) {
    case 'chrono':
      return choose2(torqueBelow(g, a))
    case 'amphi':
      return torqueBelow(g, a) * nonTorqueBelow(g, a)
    case 'xeno':
      return choose2(nonTorqueBelow(g, a))
    case 'syzygetic-chrono':
      // pairs whose high zone n/2 .. n - 1 is below a, minus the Warp pair (the Plex's high zone n - 1 is never below a)
      return Math.max(0, a - n / 2) - (g.warpLo >= 0 && g.warpHi < a ? 1 : 0)
    case 'cyclic-chrono':
      return sameCycleWithin(g, a, true)
    case 'cross-torque-chrono':
      return choose2(torqueBelow(g, a)) - sameCycleWithin(g, a, false)
    case 'plex-amphi':
      return torqueBelow(g, a) * plexBelow(g, a)
    case 'warp-amphi':
      return torqueBelow(g, a) * warpBelow(g, a)
    case 'chaotic-xeno':
      return plexBelow(g, a) * warpBelow(g, a)
    case 'syzygetic-xeno':
      return g.warpLo >= 0 && g.warpHi < a ? 1 : 0 // the Warp pair; the Plex pair's high zone n - 1 is never below a
  }
}

/** The members (a, y) of `sel` with y < b, for the row a (b < a). Depends on the region of zone a. */
function row(g: Geometry, sel: Selector, a: number, b: number): number {
  const s = g.s
  const partner = g.n - 1 - a
  const cycle = s.pairCycle[a < partner ? a : partner] ?? 0
  const partnerBelow = partner < b ? 1 : 0
  if (cycle < s.torqueCount) {
    switch (sel) {
      case 'chrono':
        return torqueBelow(g, b)
      case 'amphi':
        return nonTorqueBelow(g, b)
      case 'syzygetic-chrono':
        return partnerBelow
      case 'cyclic-chrono':
        return zonesBelow(g, sortedPairsOf(s), cycle, b) - partnerBelow
      case 'cross-torque-chrono':
        return torqueBelow(g, b) - zonesBelow(g, sortedPairsOf(s), cycle, b)
      case 'plex-amphi':
        return plexBelow(g, b)
      case 'warp-amphi':
        return warpBelow(g, b)
      default:
        return 0 // xeno and its subtypes need two non-Torque zones
    }
  }
  if (cycle === s.plexId) {
    // a = n - 1, its partner is zone 0
    switch (sel) {
      case 'amphi':
      case 'plex-amphi':
        return torqueBelow(g, b)
      case 'xeno':
        return nonTorqueBelow(g, b)
      case 'syzygetic-xeno':
        return 0 < b ? 1 : 0
      case 'chaotic-xeno':
        return warpBelow(g, b)
      default:
        return 0
    }
  }
  // a is a zone of the Warp
  switch (sel) {
    case 'amphi':
    case 'warp-amphi':
      return torqueBelow(g, b)
    case 'xeno':
      return nonTorqueBelow(g, b)
    case 'syzygetic-xeno':
      return partnerBelow
    case 'chaotic-xeno':
      return plexBelow(g, b)
    default:
      return 0
  }
}

// ---- countBelow and the selection ----

/** What one selection needs: the demon space (mesh <-> net-span, at), the geometry, the selector and its total. */
interface Query {
  readonly space: DemonSpace
  readonly geometry: Geometry
  readonly selector: Selector
  readonly total: number
}

/** The number of members of the selection whose mesh number is below m, for whole m in [0, space.count]. */
function countBelow(q: Query, m: number): number {
  if (m >= q.space.count) return q.total
  const [a, b] = q.space.netSpanOf(m) // exact everywhere, including the 2^26 cap
  return within(q.geometry, q.selector, a) + row(q.geometry, q.selector, a, b)
}

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

const isType = (selector: Selector): selector is DemonType => (DEMON_TYPES as readonly string[]).includes(selector)

/** The k-th (0-based) member of the selection in ascending mesh order: the smallest mesh M with countBelow(M + 1) > k. */
function unrank(q: Query, k: number): DemonRef {
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= q.total) {
    throw new RangeError(`Invalid demon rank ${show(k)} for ${q.selector}: expected a whole number from 0 to ${q.total - 1}`)
  }
  let lo = 0
  let hi = q.space.count - 1 // countBelow(count) = total > k, so the answer is at most the last mesh number
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (countBelow(q, mid + 1) > k) hi = mid
    else lo = mid + 1
  }
  const demon = q.space.at(lo)
  if ((isType(q.selector) ? demon.type : demon.subtype) !== q.selector) throw new Error('internal: unrank')
  return demon
}

/**
 * The selection of one demon type or subtype of `space` (the demon space of the numogram whose typed arrays are
 * `internals`): count = the closed-form count, at(k) = the k-th member in ascending mesh order, RangeError outside
 * [0, count). The returned object is frozen; the caller (the demon space) memoizes it per name.
 */
export function createSelection(space: DemonSpace, internals: NumogramInternals, selector: DemonType | DemonSubtype): DemonSelection {
  const total = isType(selector) ? space.typeCounts()[selector] : space.counts()[selector]
  const query: Query = { space, geometry: geometryOf(space.base, internals), selector, total }
  return Object.freeze({
    count: total,
    at: (k: number): DemonRef => unrank(query, k),
  })
}
