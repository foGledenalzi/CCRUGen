// createNumogram(base): the eager, immutable, cached structure of one numogram (D-13, D-14).
//
// Everything is O(n) typed arrays with about 4.2 bytes per zone; no per-cycle JS object exists until a consumer asks for
// `cycles` (meant for small bases) or `cycleAt(id)` (a tiny frozen view). At the 2^26 cap the pair map has about 1.29
// million cycles, so materializing them eagerly is exactly what this module avoids.
//
// Definitions (PROJECT.md, ARCHITECTURE.md): zones 0..n-1, the pair id is the low zone lo, hi = n - 1 - lo. The current of
// the pair hi::lo flows to the zone hi - lo = n - 1 - 2 lo (always odd) and the next pair is the pair holding that zone.
// That map on pairs is a permutation; its cycles are the regions. Plex is the fixed pair {0, n - 1}; Warp is the other
// fixed pair (if any); every other cycle is a Torque cycle. A gate maps zone k to the in-base digital root of T(k).

import { digitalRoot, triangular } from './arith'
import { assertBase, MAX_BASE } from './base'
import { createDemonSpace } from './demons'
import type { Cycle, CurrentInfo, DemonSpace, GateInfo, Numogram, PairInfo, RegionKind } from './types'

/** The cache keeps at most `entries` numograms holding at most `zones` zones in total (2^26 = 67108864). */
export const NUMOGRAM_CACHE_LIMITS: Readonly<{ entries: 4; zones: 67108864 }> = Object.freeze({
  entries: 4,
  zones: MAX_BASE,
} as const)

/**
 * Internal typed-array view for sibling engine modules (demons.ts, unrank.ts). NOT exported from engine/index.ts.
 * The arrays are shared with the numogram: read them, never write them.
 * - flow: pair ids of every cycle back to back, each cycle rotated to its smallest pair, in flow order (length pairCount)
 * - pairCycle: cycle id of every pair (length pairCount)
 * - first / length / offset: per cycle, its smallest pair, its length in pairs and its start index in flow
 */
export interface NumogramInternals {
  readonly flow: Int32Array
  readonly pairCycle: Int32Array
  readonly first: Int32Array
  readonly length: Int32Array
  readonly offset: Int32Array
  readonly torqueCount: number
  readonly plexId: number
  readonly warpId: number
}

const internalsOf = new WeakMap<Numogram, NumogramInternals>()

/** The typed-array view of a numogram built by createNumogram; throws for any other object. */
export function numogramInternals(g: Numogram): NumogramInternals {
  const found = internalsOf.get(g)
  if (found === undefined) throw new Error('numogramInternals: the argument was not built by createNumogram')
  return found
}

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

/** Returns value when it is a whole number in [0, limit); otherwise a RangeError that names the argument and the range. */
function checkIndex(name: string, value: unknown, limit: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`Invalid ${name} ${show(value)}: expected a whole number from 0 to ${limit - 1}`)
  }
  return value
}

/** The zone at side 0 (the odd member of the pair) or side 1 (the even member) of the pair `pair`. */
function memberOf(pair: number, n1: number, side: number): number {
  const hi = n1 - pair
  const pairIsOdd = pair % 2 === 1
  return side === 0 ? (pairIsOdd ? pair : hi) : pairIsOdd ? hi : pair
}

/** One region as a frozen value object over the shared typed arrays. Compare views by `id`, never by identity. */
class CycleView implements Cycle {
  readonly id: number
  readonly kind: RegionKind
  readonly torqueIndex: number
  readonly lengthInPairs: number
  readonly zoneCount: number
  readonly firstPair: number
  readonly #flow: Int32Array
  readonly #offset: number
  readonly #n1: number

  constructor(id: number, s: NumogramInternals, n1: number) {
    const isTorque = id < s.torqueCount
    this.id = id
    this.kind = isTorque ? 'torque' : id === s.plexId ? 'plex' : 'warp'
    this.torqueIndex = isTorque ? id : -1
    this.lengthInPairs = s.length[id] ?? 0
    this.zoneCount = 2 * this.lengthInPairs
    this.firstPair = s.first[id] ?? 0
    this.#flow = s.flow
    this.#offset = s.offset[id] ?? 0
    this.#n1 = n1
    Object.freeze(this)
  }

  pairAt(i: number): number {
    checkIndex('pair position', i, this.lengthInPairs)
    return this.#flow[this.#offset + i] ?? 0
  }

  zoneAt(i: number): number {
    checkIndex('zone position', i, this.zoneCount)
    const pair = this.#flow[this.#offset + Math.floor(i / 2)] ?? 0
    return memberOf(pair, this.#n1, i % 2)
  }

  pairs(): Int32Array {
    return this.#flow.slice(this.#offset, this.#offset + this.lengthInPairs)
  }

  zones(): Int32Array {
    const out = new Int32Array(this.zoneCount)
    for (let j = 0; j < this.lengthInPairs; j++) {
      const pair = this.#flow[this.#offset + j] ?? 0
      out[2 * j] = memberOf(pair, this.#n1, 0)
      out[2 * j + 1] = memberOf(pair, this.#n1, 1)
    }
    return out
  }
}

/** The O(n) construction: cycles by one walk per cycle, canonical order by a stable counting sort (no comparison sort). */
function build(base: number): NumogramInternals {
  const pairCount = base / 2
  const n1 = base - 1

  // Discovery. Ascending p, so the first pair of each discovered cycle is its smallest (every smaller pair is seen).
  // flow[0..found) and pairCycle[0..found) hold (first pair, length) temporarily and are overwritten in step 4.
  const seen = new Uint8Array(pairCount)
  const flow = new Int32Array(pairCount)
  const pairCycle = new Int32Array(pairCount)
  let found = 0
  let maxLen = 0
  for (let p = 0; p < pairCount; p++) {
    if (seen[p] !== 0) continue
    let q = p
    let len = 0
    while (seen[q] === 0) {
      seen[q] = 1
      len++
      const d = n1 - 2 * q
      q = d < pairCount ? d : n1 - d
    }
    if (q !== p) throw new Error('internal: pair map is not a permutation')
    flow[found] = p
    pairCycle[found] = len
    found++
    if (len > maxLen) maxLen = len
  }

  // Stable counting sort by length, descending: ties keep discovery order, which is ascending first pair.
  const start = new Int32Array(maxLen + 1)
  for (let i = 0; i < found; i++) {
    const len = pairCycle[i] ?? 0
    start[len] = (start[len] ?? 0) + 1
  }
  let position = 0
  for (let len = maxLen; len >= 1; len--) {
    const count = start[len] ?? 0
    start[len] = position
    position += count
  }
  const first = new Int32Array(found)
  const length = new Int32Array(found)
  for (let i = 0; i < found; i++) {
    const len = pairCycle[i] ?? 0
    const slot = start[len] ?? 0
    start[len] = slot + 1
    first[slot] = flow[i] ?? 0
    length[slot] = len
  }

  // Lay every cycle out in flow order and record the cycle of each pair. All temporaries are consumed by now.
  const offset = new Int32Array(found)
  let written = 0
  for (let c = 0; c < found; c++) {
    offset[c] = written
    let q = first[c] ?? 0
    const len = length[c] ?? 0
    for (let j = 0; j < len; j++) {
      flow[written++] = q
      pairCycle[q] = c
      const d = n1 - 2 * q
      q = d < pairCount ? d : n1 - d
    }
  }

  // Length-1 cycles sort last, ascending: the Plex (pair 0) and then the Warp, if there is one.
  const lastFirst = first[found - 1] ?? 0
  const lastLength = length[found - 1] ?? 0
  const hasWarp = lastLength === 1 && lastFirst !== 0
  const warpId = hasWarp ? found - 1 : -1
  const plexId = hasWarp ? found - 2 : found - 1
  if (plexId < 0 || first[plexId] !== 0) throw new Error('internal: the Plex is not the fixed pair 0')
  const torqueCount = plexId
  for (let c = 0; c < torqueCount; c++) {
    if ((length[c] ?? 0) < 2) throw new Error('internal: a Torque cycle has fewer than two pairs')
  }

  return { flow, pairCycle, first, length, offset, torqueCount, plexId, warpId }
}

class NumogramImpl implements Numogram {
  readonly base: number
  readonly zoneCount: number
  readonly pairCount: number
  readonly cycleCount: number
  readonly torqueCount: number
  readonly plex: Cycle
  readonly warp: Cycle | null
  readonly storageBytes: number
  readonly #s: NumogramInternals
  #cycles: readonly Cycle[] | null = null // lazy caches live in private fields: they stay writable after the freeze
  #torques: readonly Cycle[] | null = null
  #demons: DemonSpace | null = null

  constructor(base: number, s: NumogramInternals) {
    this.base = base
    this.zoneCount = base
    this.pairCount = base / 2
    this.cycleCount = s.first.length
    this.torqueCount = s.torqueCount
    this.#s = s
    this.plex = new CycleView(s.plexId, s, base - 1)
    this.warp = s.warpId >= 0 ? new CycleView(s.warpId, s, base - 1) : null
    this.storageBytes =
      s.flow.byteLength + s.pairCycle.byteLength + s.first.byteLength + s.length.byteLength + s.offset.byteLength
    internalsOf.set(this, s)
    Object.freeze(this)
  }

  /** A view of cycle `id` (already range-checked): the shared Plex and Warp objects, else a new frozen view. */
  #viewOf(id: number): Cycle {
    if (id === this.#s.plexId) return this.plex
    if (id === this.#s.warpId && this.warp !== null) return this.warp
    return new CycleView(id, this.#s, this.base - 1)
  }

  /** Every cycle as a frozen array of frozen views, built once. O(cycleCount): meant for small bases, not for 2^26. */
  get cycles(): readonly Cycle[] {
    let list = this.#cycles
    if (list === null) {
      const views: Cycle[] = []
      for (let id = 0; id < this.cycleCount; id++) views.push(this.#viewOf(id))
      list = Object.freeze(views)
      this.#cycles = list
    }
    return list
  }

  get torques(): readonly Cycle[] {
    let list = this.#torques
    if (list === null) {
      list = Object.freeze(this.cycles.slice(0, this.torqueCount))
      this.#torques = list
    }
    return list
  }

  /** The virtual demon space (D-14), built on first use: it holds no per-demon data, so reading it costs O(1). */
  get demons(): DemonSpace {
    return (this.#demons ??= createDemonSpace(this, this.#s))
  }

  cycleAt(id: number): Cycle {
    checkIndex('cycle id', id, this.cycleCount)
    const list = this.#cycles
    if (list !== null) {
      const view = list[id]
      if (view === undefined) throw new Error('internal: cycle list is shorter than cycleCount')
      return view
    }
    return this.#viewOf(id)
  }

  partner(zone: number): number {
    checkIndex('zone', zone, this.zoneCount)
    return this.base - 1 - zone
  }

  pairOf(zone: number): number {
    checkIndex('zone', zone, this.zoneCount)
    return Math.min(zone, this.base - 1 - zone)
  }

  pair(id: number): PairInfo {
    checkIndex('pair id', id, this.pairCount)
    const hi = this.base - 1 - id
    const idIsOdd = id % 2 === 1
    return { id, lo: id, hi, odd: idIsOdd ? id : hi, even: idIsOdd ? hi : id }
  }

  current(pairId: number): CurrentInfo {
    checkIndex('pair id', pairId, this.pairCount)
    const n1 = this.base - 1
    return { pair: pairId, lo: pairId, hi: n1 - pairId, to: n1 - 2 * pairId }
  }

  nextPair(pairId: number): number {
    checkIndex('pair id', pairId, this.pairCount)
    const n1 = this.base - 1
    const d = n1 - 2 * pairId
    return d < this.pairCount ? d : n1 - d
  }

  gate(zone: number): GateInfo {
    checkIndex('zone', zone, this.zoneCount)
    return { from: zone, to: digitalRoot(triangular(zone), this.base), cumulation: triangular(zone) }
  }

  cycleOfPair(pairId: number): Cycle {
    checkIndex('pair id', pairId, this.pairCount)
    return this.cycleAt(this.#s.pairCycle[pairId] ?? 0)
  }

  cycleOfZone(zone: number): Cycle {
    checkIndex('zone', zone, this.zoneCount)
    return this.cycleOfPair(Math.min(zone, this.base - 1 - zone))
  }
}

// Bounded LRU: a Map iterates in insertion order, so the first key is the least recently used.
const cache = new Map<number, Numogram>()
let cachedZones = 0

/** Forgets every cached numogram (tests, and callers that want the memory back). */
export function clearNumogramCache(): void {
  cache.clear()
  cachedZones = 0
}

/**
 * The numogram of an even base from 2 to 2^26: one frozen object, cached per base (at most 4 entries and 2^26 zones in
 * total). RangeError for any other base, before anything is allocated. Cycles are Cycle[] in canonical order (length in
 * pairs descending, then smallest zone ascending: Torque cycles, then Plex, then Warp).
 */
export function createNumogram(base: number): Numogram {
  assertBase(base)
  const hit = cache.get(base)
  if (hit !== undefined) {
    cache.delete(base)
    cache.set(base, hit)
    return hit
  }
  // Make room first, so the peak memory of a huge build does not include entries that are about to be evicted.
  while (cache.size > 0 && (cache.size >= NUMOGRAM_CACHE_LIMITS.entries || cachedZones + base > NUMOGRAM_CACHE_LIMITS.zones)) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
    cachedZones -= oldest
  }
  const built = new NumogramImpl(base, build(base))
  cache.set(base, built)
  cachedZones += base
  return built
}
