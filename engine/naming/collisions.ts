// Name collisions (NAM-03, D-12, plan 07-10, 07-RESEARCH Pattern 5): exact counts, a bounded list; the engine has no clock, the app
// supplies shouldYield.
//
// A collision is two or more demons whose final names are equal after NFC (case-sensitive). Concatenation is not injective for
// typed tables, so the report must be computed, and it must never freeze the page. Two routes, one answer:
//   - The certificate (generated tables, instant): if every sound is lowercase ASCII, distinct and prefix-free, the raw join of two
//     sounds determines both of them in either order, and capitalising the first letter is injective on lowercase ASCII, so no two
//     derived names are equal. Smoothing keeps that true when no sound contains a, u or i (the pass is insert-only and only ever
//     inserts those three letters) or when it is inert (changes no join). Collisions can then only involve overrides, and they
//     are found in O(overrides x sound lengths) by looking each override text up as a join.
//   - The scan (any other table: typed or imported sounds, or the preset layer of a ccru naming): one generic pass over the same
//     nameOf the UI shows, partitioned by the first UTF-16 unit of the final name (equal names share it), a 29-bit hash plus the
//     23-bit mesh number packed in one double, a typed-array sort per partition, equal hashes verified against the real strings.
//     Hash equality only nominates candidates; the groups are confirmed by exact string equality. It is a job that can yield and
//     resume (no clock here): the app passes shouldYield and calls step again until it returns the report.
//
// Bounded exception to the engine's no-O(n^2) rule (CLAUDE.md): the scan allocates one Float64Array and one Uint16Array with one
// entry per demon (n(n-1)/2 entries: 523,776 at the app's limit of 1024, at most 8,386,560 at COLLISION_SCAN_MAX_N = 4096, about
// 84 MB), so createCollisionJob refuses a scan above COLLISION_SCAN_MAX_N with a RangeError. The certificate allocates nothing per
// demon and has no cap. The app's own scan limit (NAMING_COLLISION_SCAN_MAX_N, 1024) must stay at or below COLLISION_SCAN_MAX_N.
//
// The report keeps exact counts and a bounded list: at most COLLISION_GROUPS_MAX groups ordered by their lowest mesh number, each
// with its exact size and its lowest COLLISION_GROUP_MESHES_MAX mesh numbers, so an all-equal table cannot allocate millions of groups.

import { netSpanOf } from '../core/demons'
import { createNameResolver } from './derive'
import { smoothingInert } from './euphony'
import { toNfc } from './text'
import type { NameResolver, Naming, NamingPreset, Smoothing } from './types'

/** The most groups a report lists (the counts stay exact beyond it). */
export const COLLISION_GROUPS_MAX = 2000
/** The most mesh numbers a group lists (its size stays exact beyond it). */
export const COLLISION_GROUP_MESHES_MAX = 16
/** The scan path refuses larger bases (RangeError); 4096 * 4095 / 2 = 8,386,560 < 2^23, so a mesh number fits the 23-bit packed index. */
export const COLLISION_SCAN_MAX_N = 4096

/** The mesh number of a scan fits below this: 2^23 = 8,388,608. A key is hash29 * LOCAL_INDEX_LIMIT + mesh, exact below 2^52. */
const LOCAL_INDEX_LIMIT = 8388608
const PARTITIONS = 65536 // one per UTF-16 unit
const FILL_CHECK_EVERY = 512 // demons between two shouldYield checks while names are computed
const PLACE_CHECK_EVERY = 65536 // swap steps between two checks while entries move to their partition
// A string whose UTF-16 units are all below U+0300 has no combining mark and nothing that composes, so it is already in NFC; the
// engine test pins this for every such unit and pair. Only the rest is normalised, which keeps the per-demon cost of the scan down.
const FIRST_COMBINING_MARK = 0x300

/** The final name as compared: NFC, with the common all-plain case returned as it is. */
function nfcName(name: string): string {
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) >= FIRST_COMBINING_MARK) return toNfc(name)
  }
  return name
}

export interface CollisionGroup {
  /** The shared final name (NFC). */
  readonly name: string
  /** How many demons carry it (at least 2, exact). */
  readonly size: number
  /** The lowest COLLISION_GROUP_MESHES_MAX mesh numbers of those demons, ascending. */
  readonly meshes: readonly number[]
}

export interface CollisionReport {
  /** How many distinct names are shared by two or more demons (exact). */
  readonly groups: number
  /** How many demons carry a shared name, over all groups (exact). */
  readonly demons: number
  /** The groups ordered by lowest mesh number, at most COLLISION_GROUPS_MAX of them. */
  readonly list: readonly CollisionGroup[]
}

export interface CollisionJob {
  /** True when the answer comes from the certificate (no scan); false for the partitioned scan. */
  readonly certified: boolean
  /**
   * Does some work and returns the report when finished, or null when it stopped at a yield point (call again). shouldYield is
   * asked every few hundred demons and between partitions; every call makes progress even if it always says yes. After the report
   * is returned every further call returns that same report.
   */
  step(shouldYield: () => boolean): CollisionReport | null
}

const LOWER_ASCII = /^[a-z]+$/
const FILL_VOWEL = /[aui]/
const FILL_VOWELS = /[aui]/g

/**
 * True only when no two demons of this table can have equal derived names (the certificate): every sound lowercase ASCII, the set
 * distinct and prefix-free (sorted, no sound is a prefix of its successor; this also catches duplicates), and for smoothing 1
 * either no sound has a fill vowel (a, u, i) or smoothing is inert. Sufficient, not necessary; O(n log n).
 */
export function provablyUnique(sounds: readonly string[], smoothing: Smoothing): boolean {
  for (const sound of sounds) {
    if (!LOWER_ASCII.test(sound)) return false
  }
  const sorted = sounds.slice().sort() // the default sort is code-unit order, which is plain order for ASCII
  for (let i = 0; i + 1 < sorted.length; i++) {
    if ((sorted[i + 1] as string).startsWith(sorted[i] as string)) return false
  }
  return smoothing === 0 || sounds.every(sound => !FILL_VOWEL.test(sound)) || smoothingInert(sounds)
}

/**
 * Whether the derived names of this naming are provably distinct, so collisions can only involve overrides: a dense table that
 * passes provablyUnique and no preset layer in play (a ccru naming with a preset of its base has canonical names that must be
 * scanned). The preset counts exactly as it does in the resolver: only while naming.source is ccru and it is for naming.base.
 */
export function canCertify(naming: Naming, preset: NamingPreset | null): boolean {
  if (naming.sounds === null) return false
  if (naming.source === 'ccru' && preset !== null && preset.base === naming.base) return false
  return provablyUnique(naming.sounds, naming.smoothing)
}

/** Groups kept so far: exact counts, and at most COLLISION_GROUPS_MAX lists with the lowest first meshes. */
interface Accumulator {
  groups: number
  demons: number
  kept: CollisionGroup[]
  /** The largest lowest mesh a new group may have and still belong to the final list (Infinity until the list first fills). */
  cutoff: number
}

function byLowestMesh(x: CollisionGroup, y: CollisionGroup): number {
  return (x.meshes[0] as number) - (y.meshes[0] as number)
}

function newAccumulator(): Accumulator {
  return { groups: 0, demons: 0, kept: [], cutoff: Infinity }
}

/** `meshes` is owned by the accumulator from here on: ascending, at most COLLISION_GROUP_MESHES_MAX long. */
function addGroup(acc: Accumulator, name: string, size: number, meshes: number[]): void {
  acc.groups++
  acc.demons += size
  if ((meshes[0] as number) > acc.cutoff) return // cannot be among the lowest COLLISION_GROUPS_MAX groups
  acc.kept.push(Object.freeze({ name, size, meshes: Object.freeze(meshes) }))
  if (acc.kept.length >= 2 * COLLISION_GROUPS_MAX) {
    acc.kept.sort(byLowestMesh)
    acc.kept.length = COLLISION_GROUPS_MAX
    acc.cutoff = ((acc.kept[COLLISION_GROUPS_MAX - 1] as CollisionGroup).meshes[0]) as number
  }
}

function finish(acc: Accumulator): CollisionReport {
  acc.kept.sort(byLowestMesh)
  const list = acc.kept.slice(0, COLLISION_GROUPS_MAX)
  return Object.freeze({ groups: acc.groups, demons: acc.demons, list: Object.freeze(list) })
}

const EMPTY_REPORT: CollisionReport = Object.freeze({ groups: 0, demons: 0, list: Object.freeze([]) as readonly CollisionGroup[] })

// ---- certified path ---------------------------------------------------------------------------------------------------------

/**
 * The report of a certified naming: no two derived names are equal, so a group is either two or more overrides with the same text,
 * or those plus the one non-overridden demon whose derived name equals that text (found by reading the text as a join).
 */
function certifiedReport(naming: Naming, preset: NamingPreset | null, sounds: readonly string[]): CollisionReport {
  const base = naming.base
  const count = (base * (base - 1)) / 2
  const byText = new Map<string, number[]>()
  for (const [mesh, raw] of naming.overrides) {
    if (!Number.isInteger(mesh) || mesh < 0 || mesh >= count) continue // the resolver never reads an override outside the table
    const text = toNfc(raw)
    const list = byText.get(text)
    if (list === undefined) byText.set(text, [mesh])
    else list.push(mesh)
  }
  if (byText.size === 0) return EMPTY_REPORT

  const resolver = createNameResolver(naming, preset)
  const soundIndex = new Map<string, number>()
  const lengths = new Set<number>()
  for (let zone = 0; zone < sounds.length; zone++) {
    soundIndex.set(sounds[zone] as string, zone)
    lengths.add((sounds[zone] as string).length)
  }
  const hiFirst = naming.join === 'hi-lo'

  // the non-overridden demon whose derived name is `text`, or -1
  const derivedDemonOf = (text: string): number => {
    const first = text.charCodeAt(0)
    if (!(first >= 65 && first <= 90)) return -1 // a derived name of a certified table starts with a capital A-Z
    const lowered = String.fromCharCode(first + 32) + text.slice(1)
    const candidates = [lowered]
    if (naming.smoothing === 1) {
      const stripped = lowered.replace(FILL_VOWELS, '') // smoothing only inserts a, u or i
      if (stripped !== lowered) candidates.push(stripped)
    }
    for (const raw of candidates) {
      for (const length of lengths) {
        if (length >= raw.length) continue
        const zp = soundIndex.get(raw.slice(0, length))
        if (zp === undefined) continue
        const zq = soundIndex.get(raw.slice(length))
        if (zq === undefined || zq === zp) continue
        if (hiFirst ? zp < zq : zp > zq) continue // the first sound belongs to the higher zone (hi-lo) or the lower one (lo-hi)
        const a = zp > zq ? zp : zq
        const b = zp > zq ? zq : zp
        const mesh = (a * (a - 1)) / 2 + b
        if (naming.overrides.has(mesh)) continue
        if (nfcName(resolver.nameOf(a, b)) === text) return mesh // the exact confirmation
      }
    }
    return -1
  }

  const acc = newAccumulator()
  for (const [text, overridden] of byText) {
    const derived = derivedDemonOf(text)
    const size = overridden.length + (derived >= 0 ? 1 : 0)
    if (size < 2) continue
    const all = derived >= 0 ? [...overridden, derived] : overridden
    all.sort((x, y) => x - y)
    addGroup(acc, text, size, all.length > COLLISION_GROUP_MESHES_MAX ? all.slice(0, COLLISION_GROUP_MESHES_MAX) : all)
  }
  return finish(acc)
}

function certifiedJob(naming: Naming, preset: NamingPreset | null, sounds: readonly string[]): CollisionJob {
  let report: CollisionReport | null = null
  return Object.freeze({
    certified: true,
    step: (): CollisionReport => (report ??= certifiedReport(naming, preset, sounds)),
  })
}

// ---- scan path --------------------------------------------------------------------------------------------------------------

/** A 29-bit hash of the UTF-16 units of a name: FNV-1a, a murmur-style finaliser, then the top 29 bits. */
function hash29(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 3 // unsigned shift: 0 .. 2^29 - 1
}

// the phases of a scan, in order
const PHASE_FILL = 0
const PHASE_PLACE = 1
const PHASE_WALK = 2
const PHASE_DONE = 3

function scanJob(naming: Naming, preset: NamingPreset | null): CollisionJob {
  const base = naming.base
  const count = (base * (base - 1)) / 2
  // Unreachable while base <= COLLISION_SCAN_MAX_N is enforced by the caller (8,386,560 < 2^23); kept so a mesh number can never
  // overflow the packed key if that cap is ever raised.
  if (count >= LOCAL_INDEX_LIMIT) throw new RangeError('The collision scan is limited to 2^23 demons')

  const resolver: NameResolver = createNameResolver(naming, preset)
  let keys = new Float64Array(count) // hash29 * LOCAL_INDEX_LIMIT + mesh, one per demon
  let parts = new Uint16Array(count) // the first UTF-16 unit of the demon's final name
  const counts = new Uint32Array(PARTITIONS)
  const begins = new Uint32Array(PARTITIONS)
  const acc = newAccumulator()
  let report: CollisionReport | null = null

  let phase = PHASE_FILL
  // fill: the next demon, mesh = filled, zones a > b in ascending mesh order
  let filled = 0
  let a = 1
  let b = 0
  // place: the first not-yet-final slot of every partition, the partition being completed, a work counter
  let next: Uint32Array | null = null
  let placing = 0
  let work = 0
  // walk: the partition being sorted and checked
  let walking = 0

  // Phase A: the name, hash and partition of every demon, in mesh order. Returns false when it stopped to yield.
  const fill = (shouldYield: () => boolean): boolean => {
    while (filled < count) {
      const stop = Math.min(count, filled + FILL_CHECK_EVERY)
      for (; filled < stop; filled++) {
        const name = nfcName(resolver.nameOf(a, b))
        const unit = name.length > 0 ? name.charCodeAt(0) : 0
        keys[filled] = hash29(name) * LOCAL_INDEX_LIMIT + filled
        parts[filled] = unit
        counts[unit] = (counts[unit] as number) + 1
        if (++b === a) {
          a++
          b = 0
        }
      }
      if (filled < count && shouldYield()) return false
    }
    return true
  }

  // Phase A2: move every entry into the contiguous range of its partition, in place (counting sort by cycle leaders), so the one
  // key array and the one partition array are all the memory the scan ever holds. All state lives in `next`, `placing` and `work`.
  const place = (shouldYield: () => boolean): boolean => {
    if (next === null) {
      next = new Uint32Array(PARTITIONS)
      let offset = 0
      for (let p = 0; p < PARTITIONS; p++) {
        begins[p] = offset
        next[p] = offset
        offset += counts[p] as number
      }
    }
    const cursor = next
    while (placing < PARTITIONS) {
      const end = (begins[placing] as number) + (counts[placing] as number)
      while ((cursor[placing] as number) < end) {
        const i = cursor[placing] as number
        const q = parts[i] as number
        if (q === placing) {
          cursor[placing] = i + 1
        } else {
          const j = cursor[q] as number
          cursor[q] = j + 1
          const key = keys[i] as number
          keys[i] = keys[j] as number
          keys[j] = key
          parts[i] = parts[j] as number
          parts[j] = q
        }
        if ((++work & (PLACE_CHECK_EVERY - 1)) === 0 && shouldYield()) return false
      }
      placing++
    }
    return true
  }

  // Phase B and C for one partition: sort its keys, then every run of equal hashes is verified against the real names.
  const checkPartition = (p: number): void => {
    const size = counts[p] as number
    if (size < 2) return
    const begin = begins[p] as number
    const slice = keys.subarray(begin, begin + size)
    slice.sort() // typed arrays sort numerically: by hash, then by mesh number
    let i = 0
    while (i < size) {
      const h = Math.floor((slice[i] as number) / LOCAL_INDEX_LIMIT)
      let j = i + 1
      while (j < size && Math.floor((slice[j] as number) / LOCAL_INDEX_LIMIT) === h) j++
      if (j - i >= 2) verifyRun(slice, i, j, h)
      i = j
    }
  }

  // Candidates with one hash: recompute the real names and group the exactly equal ones. Meshes ascend within a run.
  const verifyRun = (slice: Float64Array, from: number, to: number, h: number): void => {
    const byName = new Map<string, { size: number; meshes: number[] }>()
    for (let k = from; k < to; k++) {
      const mesh = (slice[k] as number) - h * LOCAL_INDEX_LIMIT
      const [x, y] = netSpanOf(mesh)
      const name = nfcName(resolver.nameOf(x, y))
      const entry = byName.get(name)
      if (entry === undefined) byName.set(name, { size: 1, meshes: [mesh] })
      else {
        entry.size++
        if (entry.meshes.length < COLLISION_GROUP_MESHES_MAX) entry.meshes.push(mesh)
      }
    }
    for (const [name, entry] of byName) {
      if (entry.size >= 2) addGroup(acc, name, entry.size, entry.meshes)
    }
  }

  const step = (shouldYield: () => boolean): CollisionReport | null => {
    if (report !== null) return report
    if (phase === PHASE_FILL) {
      if (!fill(shouldYield)) return null
      phase = PHASE_PLACE
      if (shouldYield()) return null
    }
    if (phase === PHASE_PLACE) {
      if (!place(shouldYield)) return null
      parts = new Uint16Array(0) // the partition ids are no longer needed once every entry is in its range
      phase = PHASE_WALK
      if (shouldYield()) return null
    }
    if (phase === PHASE_WALK) {
      while (walking < PARTITIONS) {
        const p = walking++
        if ((counts[p] as number) < 2) continue
        checkPartition(p)
        if (walking < PARTITIONS && shouldYield()) return null
      }
      phase = PHASE_DONE
      keys = new Float64Array(0)
      report = finish(acc)
    }
    return report
  }

  return Object.freeze({ certified: false, step })
}

// ---- entry points -----------------------------------------------------------------------------------------------------------

/**
 * A job that finds the collisions of a naming: the certificate when canCertify (one step, no cap), else the resumable partitioned
 * scan. RangeError for a seed-only naming (no table to read), for a table that is not one sound per zone, and for a scan above
 * COLLISION_SCAN_MAX_N zones.
 */
export function createCollisionJob(naming: Naming, preset: NamingPreset | null): CollisionJob {
  const sounds = naming.sounds
  if (sounds === null) throw new RangeError(`Base ${naming.base} is seed-only: there is no table to check for collisions`)
  if (sounds.length !== naming.base) throw new RangeError(`The table has ${sounds.length} sounds for base ${naming.base}`)
  if (canCertify(naming, preset)) return certifiedJob(naming, preset, sounds)
  if (naming.base > COLLISION_SCAN_MAX_N) {
    throw new RangeError(`A collision scan is limited to ${COLLISION_SCAN_MAX_N} zones and this table needs one at base ${naming.base}`)
  }
  return scanJob(naming, preset)
}

/** The collision report of a naming, run to completion (createCollisionJob, then step until it finishes). */
export function findCollisions(naming: Naming, preset: NamingPreset | null): CollisionReport {
  const job = createCollisionJob(naming, preset)
  const never = (): boolean => false
  let report = job.step(never)
  while (report === null) report = job.step(never)
  return report
}
