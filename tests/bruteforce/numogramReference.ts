// Independent brute-force reference (D-09). Written from the numogram definitions only; imports nothing from engine/
// and shares no formula with it. Slow on purpose.
//
// Definitions used (and nothing else):
//  - Zones 0..n-1 for an even n >= 2. The syzygy of zone z is the zone z' with z + z' = n - 1. A pair is named by its
//    low zone, so the pair id and the pair index are the same number.
//  - The current of the pair hi::lo flows to the zone hi - lo; the next pair is the pair that contains that zone.
//  - Regions are the cycles of that pair -> pair map. Plex = the cycle containing zone 0. Warp = any other cycle of one
//    pair. Torque = every other cycle (several are normal).
//  - The cumulation of zone k is the running sum 0 + 1 + ... + k. The gate of zone k flows to the in-base digital root
//    of that cumulation, found by summing base-n digits again and again (0 stays 0).
//  - Demons are the unordered pairs a > b of zones, enumerated a = 1..n-1, b = 0..a-1; the mesh number is the running
//    count of that enumeration. Syzygetic iff a + b = n - 1, Numodemon iff a + b = n.
//
// No file access of any kind lives here, so the local sources folder can never be read from this module.

export type RefKind = 'plex' | 'warp' | 'torque'
export type RefType = 'chrono' | 'amphi' | 'xeno'
export type RefSubtype =
  | 'cyclic-chrono'
  | 'cross-torque-chrono'
  | 'syzygetic-chrono'
  | 'plex-amphi'
  | 'warp-amphi'
  | 'chaotic-xeno'
  | 'syzygetic-xeno'

/** The seven subtypes, in the fixed reporting order. */
export const REF_SUBTYPES: readonly RefSubtype[] = [
  'cyclic-chrono',
  'cross-torque-chrono',
  'syzygetic-chrono',
  'plex-amphi',
  'warp-amphi',
  'chaotic-xeno',
  'syzygetic-xeno',
]

/** One region: pair ids (low zones), rotated to start at the smallest, in flow order. */
export interface RefCycle {
  readonly kind: RefKind
  readonly pairs: readonly number[]
}

export interface RefStructure {
  readonly base: number
  /** By zone: its syzygy partner. */
  readonly partner: readonly number[]
  /** Pair index -> low zone, ascending (pair index === low zone). */
  readonly pairLo: readonly number[]
  /** By pair id: the zone hi - lo the current flows to. */
  readonly current: readonly number[]
  /** By pair id: the pair containing current[p]. */
  readonly nextPair: readonly number[]
  /** By zone k: the running sum 0 + 1 + ... + k. */
  readonly cumulation: readonly number[]
  /** By zone k: refDigitSumRoot(cumulation[k], base). */
  readonly gates: readonly number[]
  /** Canonical order: length in pairs descending, then smallest pair ascending. */
  readonly cycles: readonly RefCycle[]
  /** By zone: index into cycles. */
  readonly cycleOfZone: readonly number[]
}

export interface RefDemon {
  readonly a: number
  readonly b: number
  readonly mesh: number
  readonly type: RefType
  readonly subtype: RefSubtype
  readonly syzygetic: boolean
  readonly numodemon: boolean
}

function at<T>(list: ArrayLike<T>, index: number): T {
  const value = list[index]
  if (value === undefined) throw new Error(`reference: index ${index} is outside 0..${list.length - 1}`)
  return value
}

function checkBaseArg(base: number): void {
  if (typeof base !== 'number' || !Number.isInteger(base) || base < 2) {
    throw new Error(`reference: a digit base must be an integer of at least 2, got ${String(base)}`)
  }
}

/** Digits of a non-negative integer in a base by repeated division, most significant first; [0] for 0. */
export function refDigits(value: number, base: number): number[] {
  checkBaseArg(base)
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`reference: a value to write in a base must be a non-negative integer, got ${String(value)}`)
  }
  if (value === 0) return [0]
  const digits: number[] = []
  let rest = value
  while (rest > 0) {
    digits.push(rest % base)
    rest = (rest - (rest % base)) / base
  }
  return digits.reverse()
}

/** While the value has more than one digit in the base, replace it by the sum of its digits. 0 stays 0. */
export function refDigitSumRoot(value: number, base: number): number {
  checkBaseArg(base)
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`reference: a value to reduce must be a non-negative integer, got ${String(value)}`)
  }
  let v = value
  while (v >= base) {
    let sum = 0
    for (const digit of refDigits(v, base)) sum += digit
    v = sum
  }
  return v
}

const KIND_PLEX = 0
const KIND_WARP = 1
const KIND_TORQUE = 2
const KIND_CODE: Readonly<Record<RefKind, number>> = { plex: KIND_PLEX, warp: KIND_WARP, torque: KIND_TORQUE }

// Indexes into REF_SUBTYPES.
const S_CYCLIC = 0
const S_CROSS = 1
const S_SYZ_CHRONO = 2
const S_PLEX_AMPHI = 3
const S_WARP_AMPHI = 4
const S_CHAOTIC = 5
const S_SYZ_XENO = 6

const TYPE_OF_SUBTYPE: readonly RefType[] = ['chrono', 'chrono', 'chrono', 'amphi', 'amphi', 'xeno', 'xeno']

/**
 * The one classification rule, shared by refClassify and refSubtypeCounts.
 * Both zones Torque -> chrono (syzygetic, else cyclic when both sit in the same Torque, else cross-torque);
 * exactly one Torque -> amphi (by the region of the other zone); neither -> xeno (syzygetic, else chaotic).
 */
function subtypeIndex(kindA: number, kindB: number, cycleA: number, cycleB: number, syzygetic: boolean): number {
  const torqueA = kindA === KIND_TORQUE
  const torqueB = kindB === KIND_TORQUE
  if (torqueA && torqueB) {
    if (syzygetic) return S_SYZ_CHRONO
    return cycleA === cycleB ? S_CYCLIC : S_CROSS
  }
  if (torqueA || torqueB) {
    const other = torqueA ? kindB : kindA
    return other === KIND_PLEX ? S_PLEX_AMPHI : S_WARP_AMPHI
  }
  if (syzygetic) return S_SYZ_XENO
  // Plex and Warp are single pairs, so two zones of the same region are always a syzygy: a non-syzygetic xenodemon
  // inside one region cannot exist. Reaching this with equal kinds would be a bug, not a category.
  if (kindA === kindB) throw new Error('reference: a non-syzygetic xenodemon inside one region cannot exist')
  return S_CHAOTIC
}

/** Zones 0..n-1, syzygy pairs, currents, cumulations, gates and the cycles of the pair map for an even base. */
export function refStructure(base: number): RefStructure {
  if (typeof base !== 'number' || !Number.isInteger(base) || base < 2 || base % 2 !== 0) {
    throw new Error(`reference: a numogram base must be an even integer of at least 2, got ${String(base)}`)
  }
  const pairCount = base / 2

  // Pairs: each zone z below n/2 with its syzygy (the zone that sums with it to n - 1).
  const pairLo: number[] = []
  const partner: number[] = new Array<number>(base).fill(-1)
  const pairOfZone: number[] = new Array<number>(base).fill(-1)
  const current: number[] = []
  for (let lo = 0; lo < pairCount; lo++) {
    const hi = base - 1 - lo
    pairLo.push(lo)
    partner[lo] = hi
    partner[hi] = lo
    pairOfZone[lo] = lo
    pairOfZone[hi] = lo
    current.push(hi - lo)
  }
  const nextPair: number[] = current.map((zone) => at(pairOfZone, zone))

  // Cumulations as a running sum, gates as the iterated in-base digit sum.
  const cumulation: number[] = []
  const gates: number[] = []
  let running = 0
  for (let k = 0; k < base; k++) {
    running += k
    cumulation.push(running)
    gates.push(refDigitSumRoot(running, base))
  }

  // Cycles of the pair map by a general functional-graph walk (no assumption that the map is a permutation):
  // walk from an unvisited pair until a visited pair is reached; if it lies on the current walk, the tail from it
  // is a cycle.
  const state = new Int8Array(pairCount) // 0 unvisited, 1 on the current walk, 2 finished
  const walkIndex = new Int32Array(pairCount)
  const found: number[][] = []
  for (let start = 0; start < pairCount; start++) {
    if (state[start] !== 0) continue
    const walk: number[] = []
    let cur = start
    while (state[cur] === 0) {
      state[cur] = 1
      walkIndex[cur] = walk.length
      walk.push(cur)
      cur = at(nextPair, cur)
    }
    if (state[cur] === 1) {
      const tail = walk.slice(at(walkIndex, cur))
      let smallest = 0
      for (let i = 1; i < tail.length; i++) if (at(tail, i) < at(tail, smallest)) smallest = i
      found.push([...tail.slice(smallest), ...tail.slice(0, smallest)])
    }
    for (const p of walk) state[p] = 2
  }

  // Kinds by the definitions: the cycle holding zone 0 is the Plex, any other single-pair cycle is a Warp.
  const plexPair = at(pairOfZone, 0)
  const unsorted: RefCycle[] = found.map((pairs) => {
    if (pairs.includes(plexPair)) return { kind: 'plex', pairs }
    if (pairs.length === 1) return { kind: 'warp', pairs }
    return { kind: 'torque', pairs }
  })
  if (unsorted.filter((c) => c.kind === 'warp').length > 1) {
    throw new Error(`reference: base ${base} produced more than one Warp, which the definitions do not allow`)
  }
  const cycles = unsorted.sort((x, y) => y.pairs.length - x.pairs.length || at(x.pairs, 0) - at(y.pairs, 0))

  const cycleOfPair: number[] = new Array<number>(pairCount).fill(-1)
  cycles.forEach((cycle, index) => {
    for (const p of cycle.pairs) cycleOfPair[p] = index
  })
  const cycleOfZone: number[] = []
  for (let z = 0; z < base; z++) cycleOfZone.push(at(cycleOfPair, at(pairOfZone, z)))
  if (cycleOfZone.some((c) => c < 0)) throw new Error(`reference: base ${base} left a pair outside every cycle`)

  return { base, partner, pairLo, current, nextPair, cumulation, gates, cycles, cycleOfZone }
}

/** Type, subtype and the syzygetic / Numodemon flags of the demon a::b (a > b). */
export function refClassify(
  s: RefStructure,
  a: number,
  b: number,
): { type: RefType; subtype: RefSubtype; syzygetic: boolean; numodemon: boolean } {
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < 0 || a <= b || a >= s.base) {
    throw new Error(`reference: a demon needs integer zones with 0 <= b < a < ${s.base}, got ${String(a)}::${String(b)}`)
  }
  const cycleA = at(s.cycleOfZone, a)
  const cycleB = at(s.cycleOfZone, b)
  const index = subtypeIndex(
    KIND_CODE[at(s.cycles, cycleA).kind],
    KIND_CODE[at(s.cycles, cycleB).kind],
    cycleA,
    cycleB,
    a + b === s.base - 1,
  )
  return {
    type: at(TYPE_OF_SUBTYPE, index),
    subtype: at(REF_SUBTYPES, index),
    syzygetic: a + b === s.base - 1,
    numodemon: a + b === s.base,
  }
}

/** Every demon a > b in lexicographic order; the mesh number is the running counter (1::0 is 0). O(n^2) objects. */
export function refDemons(s: RefStructure): RefDemon[] {
  const demons: RefDemon[] = []
  let mesh = 0
  for (let a = 1; a < s.base; a++) {
    for (let b = 0; b < a; b++) {
      const c = refClassify(s, a, b)
      demons.push({ a, b, mesh, type: c.type, subtype: c.subtype, syzygetic: c.syzygetic, numodemon: c.numodemon })
      mesh++
    }
  }
  return demons
}

/** Demon counts per subtype by an O(n^2) double loop over a > b with the same rule as refClassify. */
export function refSubtypeCounts(s: RefStructure): Record<RefSubtype, number> {
  const n = s.base
  const kindOfZone = new Int32Array(n)
  const cycleOfZone = new Int32Array(n)
  for (let z = 0; z < n; z++) {
    const cycleIndex = at(s.cycleOfZone, z)
    cycleOfZone[z] = cycleIndex
    kindOfZone[z] = KIND_CODE[at(s.cycles, cycleIndex).kind]
  }
  const tally = new Int32Array(REF_SUBTYPES.length)
  for (let a = 1; a < n; a++) {
    const kindA = kindOfZone[a] ?? 0
    const cycleA = cycleOfZone[a] ?? 0
    for (let b = 0; b < a; b++) {
      const index = subtypeIndex(kindA, kindOfZone[b] ?? 0, cycleA, cycleOfZone[b] ?? 0, a + b === n - 1)
      tally[index] = (tally[index] ?? 0) + 1
    }
  }
  return {
    'cyclic-chrono': at(tally, S_CYCLIC),
    'cross-torque-chrono': at(tally, S_CROSS),
    'syzygetic-chrono': at(tally, S_SYZ_CHRONO),
    'plex-amphi': at(tally, S_PLEX_AMPHI),
    'warp-amphi': at(tally, S_WARP_AMPHI),
    'chaotic-xeno': at(tally, S_CHAOTIC),
    'syzygetic-xeno': at(tally, S_SYZ_XENO),
  }
}
