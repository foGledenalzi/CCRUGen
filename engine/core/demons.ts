// The virtual demon space (ENG-03, D-14). A base-n numogram has n(n-1)/2 demons, one per unordered pair of zones
// a > b (the net-span a::b). Nothing here ever stores, lists or allocates per demon: a demon is an address (its mesh
// number) plus index math over the O(n) typed arrays of the numogram, and every count is a closed form.
//
// Mesh number (0-based): mesh(a::b) = a(a-1)/2 + b, so 1::0 = 0, 2::1 = 2, 6::3 = 18, 9::8 = 44. The last demon of the
// largest base 2^26 is (2^26-1)::(2^26-2) = 2251799780130815 and the demon count there is 2251799780130816 < 2^52.
//
// Classification of a > b (Torque = cycle id below torqueCount; cycle ids are in the numogram's canonical order):
//   both zones Torque   -> chrono: syzygetic when a + b = n - 1, else cyclic when both sit in the same Torque cycle,
//                          else cross-torque (an explicit subtype, never folded into cyclic)
//   exactly one Torque  -> amphi: plex-amphi if the other zone lies in the Plex, else warp-amphi
//   neither Torque      -> xeno: syzygetic when a + b = n - 1, else chaotic
// A Numodemon is a demon with a + b = n (there are n/2 - 1 of them).

import { MAX_BASE } from './base'
import type { NumogramInternals } from './numogram' // type only: no runtime import cycle with numogram.ts
import type { DemonRef, DemonSpace, DemonSubtype, DemonType, Numogram } from './types'

/** Number of demons of the largest base: C(2^26, 2) = 2^25 * (2^26 - 1), below 2^52, so every mesh number is an exact double. */
const MESH_LIMIT = (MAX_BASE * (MAX_BASE - 1)) / 2

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

/** Returns value when it is a whole number in [0, limit); otherwise a RangeError that names the argument and the range. */
function checkIndex(name: string, value: unknown, limit: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`Invalid ${name} ${show(value)}: expected a whole number from 0 to ${limit - 1}`)
  }
  return value === 0 ? 0 : value // -0 becomes +0, so no returned field is ever -0
}

function checkDistinct(a: number, b: number): void {
  if (a === b) throw new RangeError(`Invalid net-span ${a}::${b}: a demon needs two distinct zones`)
}

/**
 * The mesh number of the demon on zones a and b (order does not matter): a(a-1)/2 + b for a > b. RangeError unless both
 * are whole numbers below 2^26 and different. a(a-1) stays at or below 2^52, so the result is an exact double.
 */
export function meshOf(a: number, b: number): number {
  const x = checkIndex('zone', a, MAX_BASE)
  const y = checkIndex('zone', b, MAX_BASE)
  checkDistinct(x, y)
  return x > y ? (x * (x - 1)) / 2 + y : (y * (y - 1)) / 2 + x
}

/**
 * The larger zone a of the demon with mesh number m (0 <= m < MESH_LIMIT, not checked here): the largest a with
 * a(a-1)/2 <= m. Above m of about 2^50, 8m + 1 exceeds 2^53 and is not representable, so the float square root is only
 * an ESTIMATE (at most a step or two off); the two integer loops make it exact, because a stays at or below 2^26, so
 * a(a-1) and (a+1)a stay below 2^53 and every comparison with the integer m is exact. No BigInt, no exact isqrt.
 * The estimate is clamped to at least 1: the first loop only terminates for a >= 0 (a(a-1)/2 grows again below 0), so a
 * runtime whose Math.sqrt came out low can never send it into a runaway descent.
 */
function rowOf(m: number): number {
  let a = Math.max(1, Math.floor((1 + Math.sqrt(8 * m + 1)) / 2))
  while (a * (a - 1) / 2 > m) a--
  while ((a + 1) * a / 2 <= m) a++
  return a
}

/** The net-span [a, b] (a > b) of the demon with mesh number m. RangeError unless m is a whole number below C(2^26, 2). */
export function netSpanOf(mesh: number): readonly [number, number] {
  const m = checkIndex('mesh number', mesh, MESH_LIMIT)
  const a = rowOf(m)
  return Object.freeze([a, m - (a * (a - 1)) / 2] as const)
}

/** C(x, 2) = x(x-1)/2 for a whole number x; exactly +0 for x below 2 (x = 0 would give -0 and break equality checks). */
function choose2(x: number): number {
  return x < 2 ? 0 : (x * (x - 1)) / 2
}

/** The demon a::b (a > b, both already range-checked) of a numogram, classified from the typed arrays with no allocation but the result. */
function buildDemon(s: NumogramInternals, n1: number, a: number, b: number): DemonRef {
  const cycleA = s.pairCycle[a < n1 - a ? a : n1 - a] ?? 0
  const cycleB = s.pairCycle[b < n1 - b ? b : n1 - b] ?? 0
  const torqueA = cycleA < s.torqueCount
  const torqueB = cycleB < s.torqueCount
  const syzygetic = a + b === n1
  let type: DemonType
  let subtype: DemonSubtype
  if (torqueA && torqueB) {
    type = 'chrono'
    subtype = syzygetic ? 'syzygetic-chrono' : cycleA === cycleB ? 'cyclic-chrono' : 'cross-torque-chrono'
  } else if (torqueA || torqueB) {
    type = 'amphi'
    subtype = (torqueA ? cycleB : cycleA) === s.plexId ? 'plex-amphi' : 'warp-amphi'
  } else {
    type = 'xeno'
    subtype = syzygetic ? 'syzygetic-xeno' : 'chaotic-xeno'
  }
  return Object.freeze({
    a,
    b,
    mesh: (a * (a - 1)) / 2 + b,
    type,
    subtype,
    syzygetic,
    numodemon: a + b === n1 + 1,
    cycleA,
    cycleB,
  })
}

/**
 * Closed-form counts. With L_c the length in pairs of Torque cycle c, T = sum of 2 L_c the number of Torque zones,
 * W = 2 if a Warp exists else 0 and C(x, 2) = x(x-1)/2:
 *   cyclic chrono   = sum over Torque cycles of C(2 L_c, 2) - L_c   (same-cycle zone pairs minus the L_c syzygies)
 *   cross chrono    = C(T, 2) - sum C(2 L_c, 2)
 *   syzygetic chrono = T / 2                                        (the Torque pairs)
 *   plex amphi = 2 T, warp amphi = W T
 *   chaotic xeno = 4 with a Warp else 0, syzygetic xeno = 2 with a Warp else 1
 * Types: chrono = C(T, 2), amphi = T (n - T), xeno = C(n - T, 2). Everything stays below 2^52, so all sums are exact.
 * The only loop runs over the Torque cycles: O(number of Torque cycles), not O(n^2) and not O(demons).
 */
function closedForms(
  s: NumogramInternals,
  base: number,
): { subtypes: Readonly<Record<DemonSubtype, number>>; types: Readonly<Record<DemonType, number>> } {
  let torqueZones = 0
  let sameCycleZonePairs = 0 // sum of C(2 L_c, 2)
  let syzygiesInTorque = 0 // sum of L_c
  let cyclic = 0
  for (let c = 0; c < s.torqueCount; c++) {
    const pairs = s.length[c] ?? 0
    const zones = 2 * pairs
    const zonePairs = choose2(zones)
    torqueZones += zones
    syzygiesInTorque += pairs
    sameCycleZonePairs += zonePairs
    cyclic += zonePairs - pairs
  }
  const hasWarp = s.warpId >= 0
  const chrono = choose2(torqueZones)
  const others = base - torqueZones
  const subtypes = Object.freeze({
    'cyclic-chrono': cyclic,
    'cross-torque-chrono': chrono - sameCycleZonePairs,
    'syzygetic-chrono': syzygiesInTorque,
    'plex-amphi': 2 * torqueZones,
    'warp-amphi': hasWarp ? 2 * torqueZones : 0,
    'chaotic-xeno': hasWarp ? 4 : 0,
    'syzygetic-xeno': hasWarp ? 2 : 1,
  })
  const types = Object.freeze({
    chrono,
    amphi: torqueZones * others,
    xeno: choose2(others),
  })
  return { subtypes, types }
}

/** Every demon incident to `zone`, the other zone ascending. Lazy: one demon per step, never an array. */
function* incidentRun(s: NumogramInternals, base: number, zone: number): Generator<DemonRef, void, undefined> {
  for (let other = 0; other < base; other++) {
    if (other === zone) continue
    yield other < zone ? buildDemon(s, base - 1, zone, other) : buildDemon(s, base - 1, other, zone)
  }
}

/** The Numodemons (n - b)::b for b = 1 .. n/2 - 1, b ascending. Lazy. */
function* numodemonRun(s: NumogramInternals, base: number): Generator<DemonRef, void, undefined> {
  for (let b = 1; b < base / 2; b++) yield buildDemon(s, base - 1, base - b, b)
}

class DemonSpaceImpl implements DemonSpace {
  readonly base: number
  readonly count: number
  readonly numodemonCount: number
  readonly #s: NumogramInternals
  #forms: ReturnType<typeof closedForms> | null = null // memoized in a private field: it stays writable after the freeze

  constructor(base: number, s: NumogramInternals) {
    this.base = base
    this.count = (base * (base - 1)) / 2
    this.numodemonCount = base / 2 - 1
    this.#s = s
    Object.freeze(this)
  }

  meshOf(a: number, b: number): number {
    checkIndex('zone', a, this.base)
    checkIndex('zone', b, this.base)
    return meshOf(a, b)
  }

  netSpanOf(mesh: number): readonly [number, number] {
    checkIndex('mesh number', mesh, this.count)
    return netSpanOf(mesh)
  }

  at(mesh: number): DemonRef {
    const m = checkIndex('mesh number', mesh, this.count)
    const a = rowOf(m)
    return buildDemon(this.#s, this.base - 1, a, m - (a * (a - 1)) / 2)
  }

  ref(a: number, b: number): DemonRef {
    const x = checkIndex('zone', a, this.base)
    const y = checkIndex('zone', b, this.base)
    checkDistinct(x, y)
    return x > y ? buildDemon(this.#s, this.base - 1, x, y) : buildDemon(this.#s, this.base - 1, y, x)
  }

  #closedForms(): ReturnType<typeof closedForms> {
    return (this.#forms ??= closedForms(this.#s, this.base))
  }

  counts(): Readonly<Record<DemonSubtype, number>> {
    return this.#closedForms().subtypes
  }

  typeCounts(): Readonly<Record<DemonType, number>> {
    return this.#closedForms().types
  }

  incident(zone: number): Iterable<DemonRef> {
    const z = checkIndex('zone', zone, this.base) // eager: a bad zone throws here, not on the first step
    const s = this.#s
    const base = this.base
    return Object.freeze({ [Symbol.iterator]: () => incidentRun(s, base, z) })
  }

  numodemons(): Iterable<DemonRef> {
    const s = this.#s
    const base = this.base
    return Object.freeze({ [Symbol.iterator]: () => numodemonRun(s, base) })
  }
}

/** The lazy, virtual demon space of `g` (called once per numogram by its `demons` getter). Holds no per-demon data. */
export function createDemonSpace(g: Numogram, internals: NumogramInternals): DemonSpace {
  return new DemonSpaceImpl(g.base, internals)
}
