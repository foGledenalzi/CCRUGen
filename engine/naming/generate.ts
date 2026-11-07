// The zone-sound generator names-gen@1 (NAM-01, D-04, D-05): distinct sounds BY CONSTRUCTION, for any base, lazily.
//
// A style's bank is a prefix-free set of syllables split into INTERNAL syllables (never last) and LEAF syllables (always last).
// A sound is d-1 internal syllables followed by one leaf, so depth class d holds I^(d-1) * L sounds. Zone z falls in one class,
// is permuted inside it by a seeded Feistel network (a table-free bijection), and is decoded by mixed radix. Consequences:
//   - sounds are pairwise distinct for every zone below `limit`, whatever the base (no retry loop anywhere);
//   - soundAt(z) does not depend on the base, so a larger table extends a smaller one (prefix stability) and seed-only names
//     above the interactive ceiling can be derived zone by zone in O(1);
//   - the sound set is a prefix code, so the raw join of two sounds determines both (generated tables never collide in names).
// Exactness: every class size is below 2^32 (the largest is 67 * 80^4), so the % and Math.floor of the mixed-radix decode act on
// doubles that are far below 2^53 and are exact.
//
// `@1` is frozen: a different bank, depth rule or permutation is a new generator id, never an edit of this one. Stored seed
// records mean names-gen@1 forever.

import { assertBase } from '../core/base'
import { checkIndex } from '../core/index-check'
import { SYLLABLE_BANKS, isStyleId, type StyleId } from './banks'
import { feistelPermutation, feistelRoundKeys } from './feistel'

export const GENERATOR_ID = 'names-gen@1'

/** The seed a fresh naming shows in the seed field (the app identity). */
export const DEFAULT_SEED = 'ccrug'

/** Deepest syllable class: depth 5 reaches past 2 * MAX_BASE zones in every style while the longest sound stays under 16 letters. */
export const GENERATOR_MAX_DEPTH = 5

export interface SoundGenerator {
  /** The NFC-normalised, trimmed seed the generator was built from. */
  readonly seed: string
  readonly style: StyleId
  /** Zones [0, limit) have a sound; limit is larger than twice the base ceiling. */
  readonly limit: number
  /** The sound of zone z, a plain a-z string, pairwise distinct over [0, limit). RangeError unless z is a whole number in [0, limit). */
  soundAt(zone: number): string
}

/** The sound generator for (seed, style). The seed is normalised to NFC and trimmed here, so every spelling of one text agrees. */
export function createGenerator(seed: string, style: StyleId): SoundGenerator {
  const claimed: unknown = style // a style from a URL or file arrives as an unchecked string
  if (!isStyleId(claimed)) {
    throw new RangeError(`Invalid style ${typeof claimed === 'string' ? JSON.stringify(claimed.slice(0, 40)) : `<${typeof claimed}>`}: expected one of the known styles`)
  }
  const normalised = seed.normalize('NFC').trim()
  const bank = SYLLABLE_BANKS[style]
  const nInternal = bank.internal.length
  const nLeaf = bank.leaf.length

  // classSizes[d - 1] = I^(d-1) * L; offsets[d - 1] = the first zone of depth class d
  const classSizes: number[] = []
  const offsets: number[] = []
  let limit = 0
  for (let d = 1, power = 1; d <= GENERATOR_MAX_DEPTH; d++, power *= nInternal) {
    offsets.push(limit)
    classSizes.push(power * nLeaf)
    limit += power * nLeaf
  }

  // per-depth permutations are built on first use (a table of 2^26 zones never needs the deeper classes eagerly)
  const permutations: Array<((x: number) => number) | undefined> = new Array(GENERATOR_MAX_DEPTH).fill(undefined)
  const permutationOf = (depth: number): ((x: number) => number) => {
    let p = permutations[depth - 1]
    if (p === undefined) {
      p = feistelPermutation(classSizes[depth - 1]!, feistelRoundKeys(normalised, style, depth))
      permutations[depth - 1] = p
    }
    return p
  }

  const soundAt = (zone: number): string => {
    const z = checkIndex('zone', zone, limit)
    let depth = 1
    while (depth < GENERATOR_MAX_DEPTH && z >= offsets[depth]!) depth++
    let r = permutationOf(depth)(z - offsets[depth - 1]!)
    const parts = new Array<string>(depth)
    parts[depth - 1] = bank.leaf[r % nLeaf]!
    r = Math.floor(r / nLeaf)
    for (let i = depth - 2; i >= 0; i--) {
      parts[i] = bank.internal[r % nInternal]!
      r = Math.floor(r / nInternal)
    }
    return parts.join('')
  }

  return Object.freeze({ seed: normalised, style, limit, soundAt })
}

/**
 * The sound table of a base: gen's sound for every unlocked zone and the locked sound for every locked one. RangeError unless
 * base is a valid numogram base. A lock outside [0, base) is ignored.
 *
 * Distinctness: generated sounds are pairwise distinct, so a repeat can only come from a locked (typed) sound that equals another
 * zone's generated sound. That zone takes the next spare soundAt(base + j) instead; spare indices lie outside [0, base), so a spare
 * never repeats a generated table sound, and only locked sounds are tested against. At most one spare per lock is consumed, so
 * every spare index stays below 2 * base < limit. Deterministic, O(base + locks), no retry over the table. When the locked sounds
 * are pairwise distinct the whole table is distinct; typed sounds that collide with each other are reported by the collision
 * report, not repaired here.
 */
export function generateSounds(gen: SoundGenerator, base: number, locked?: ReadonlyMap<number, string>): string[] {
  assertBase(base)
  const taken = new Set<string>()
  if (locked !== undefined) {
    for (const [zone, sound] of locked) {
      if (Number.isInteger(zone) && zone >= 0 && zone < base) taken.add(sound)
    }
  }
  let spare = base
  const out = new Array<string>(base)
  for (let z = 0; z < base; z++) {
    const fixed = locked?.get(z)
    if (fixed !== undefined) {
      out[z] = fixed
      continue
    }
    let s = gen.soundAt(z)
    while (taken.has(s)) s = gen.soundAt(spare++)
    out[z] = s
  }
  return out
}
