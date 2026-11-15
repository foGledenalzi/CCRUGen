// A seeded permutation of [0, size) without a table (NAM-01): an 8-round balanced Feistel network on the smallest even bit
// count that holds the domain, with cycle-walking back into [0, size). Each round is invertible whatever the round function
// does, so the network is a bijection of the padded domain, and cycle-walking restricts a bijection to a subset, which is a
// bijection again (every cycle of the padded permutation that meets [0, size) returns into it, so the walk always ends).
//
// Exactness: the halves are below 2^26 and the whole domain below 2^52. The only arithmetic that is not a bit operation is the
// division and modulo of integers below 2^52 by an exact power of two, which IEEE-754 computes exactly; every hash step is
// Math.imul, ^ or >>>. No transcendental function, no clock, no platform randomness.

import { cyrb128, sfc32 } from './prng'

/** The key-schedule separator, built as data (never a typed escape). Seeds carry no control characters, so the split is unambiguous. */
const SEP = String.fromCharCode(0)

/** Rounds of the Feistel network: 6 already passes the chi-square checks; 8 adds margin for about a third more of the ~1 us per zone. */
export const FEISTEL_ROUNDS = 8

/** Outputs the key schedule discards before taking the round keys. */
export const FEISTEL_KEY_DISCARD = 12

/** The murmur3-style finalizer used as the round function: a uint32 from a half-block and a round key. */
function mix(x: number, k: number): number {
  x = Math.imul(x ^ k, 0x9e3779b1)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}

/** The FEISTEL_ROUNDS round keys of (seed, style, depth): sfc32 seeded by cyrb128(style NUL depth NUL seed), after discarding FEISTEL_KEY_DISCARD outputs. */
export function feistelRoundKeys(seed: string, style: string, depth: number): readonly number[] {
  const next = sfc32(...cyrb128(style + SEP + String(depth) + SEP + seed))
  for (let i = 0; i < FEISTEL_KEY_DISCARD; i++) next()
  const keys: number[] = []
  for (let i = 0; i < FEISTEL_ROUNDS; i++) keys.push(next())
  return Object.freeze(keys)
}

/**
 * The permutation of [0, size) defined by keys. RangeError unless size is a whole number from 1 to 2^52. The returned function
 * throws a RangeError for anything that is not a whole number of [0, size) (IN-01): a start outside the domain can sit on a cycle of
 * the padded network that never meets a value below size, so the cycle-walk would not end. The check is one comparison next to the
 * eight rounds.
 */
export function feistelPermutation(size: number, keys: readonly number[]): (x: number) => number {
  if (!Number.isInteger(size) || size < 1 || size > 2 ** 52) {
    throw new RangeError(`Invalid permutation size ${typeof size === 'number' ? String(size) : `<${typeof size}>`}: expected a whole number from 1 to 2^52`)
  }
  let bits = 0
  while (2 ** bits < size) bits++
  if (bits % 2 === 1) bits++
  const w = Math.max(1, bits / 2)
  const half = 2 ** w // halves are below 2^26 (domain below 2^52)
  const feistel = (x: number): number => {
    let l = Math.floor(x / half) // exact: the divisor is a power of two
    let r = x % half
    for (const k of keys) {
      const f = mix(r, k) % half
      const nl = r
      r = (l ^ f) >>> 0
      l = nl
    }
    return l * half + r
  }
  return x => {
    if (!(Number.isInteger(x) && x >= 0 && x < size)) {
      throw new RangeError(`Invalid permutation input ${typeof x === 'number' ? String(x) : `<${typeof x}>`}: expected a whole number in [0, ${size})`)
    }
    do {
      x = feistel(x)
    } while (x >= size)
    return x
  }
}
