// NAM-01 Feistel permutation with cycle-walking and its key schedule (07-RESEARCH Pattern 2, Appendix B).
// Independence: feistelBig / mixBig / keysBig below are BigInt implementations with explicit 32-bit masks that share no
// code with the module; the key-schedule and permutation vectors are the frozen Appendix B values.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { FEISTEL_KEY_DISCARD, FEISTEL_ROUNDS, feistelPermutation, feistelRoundKeys } from '../naming/feistel'
import { cyrb128 } from '../naming/prng'

const MASK = 0xffffffffn
const NUL = String.fromCharCode(0)
const hex = (n: number): string => n.toString(16).padStart(8, '0')
const hexKeys = (keys: readonly number[]): string => keys.map(hex).join(' ')
const parseKeys = (text: string): number[] => text.split(' ').map(h => parseInt(h, 16))

// ---- independent BigInt reference ----

function cyrb128Big(str: string): bigint[] {
  let h1 = 1779033703n
  let h2 = 3144134277n
  let h3 = 1013904242n
  let h4 = 2773480762n
  for (let i = 0; i < str.length; i++) {
    const k = BigInt(str.charCodeAt(i))
    h1 = h2 ^ (((h1 ^ k) * 597399067n) & MASK)
    h2 = h3 ^ (((h2 ^ k) * 2869860233n) & MASK)
    h3 = h4 ^ (((h3 ^ k) * 951274213n) & MASK)
    h4 = h1 ^ (((h4 ^ k) * 2716044179n) & MASK)
  }
  h1 = ((h3 ^ (h1 >> 18n)) * 597399067n) & MASK
  h2 = ((h4 ^ (h2 >> 22n)) * 2869860233n) & MASK
  h3 = ((h1 ^ (h3 >> 17n)) * 951274213n) & MASK
  h4 = ((h2 ^ (h4 >> 19n)) * 2716044179n) & MASK
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 & MASK, h2 & MASK, h3 & MASK, h4 & MASK]
}

function keysBig(seed: string, style: string, depth: number): bigint[] {
  let [a, b, c, d] = cyrb128Big(`${style}${NUL}${depth}${NUL}${seed}`) as [bigint, bigint, bigint, bigint]
  const next = (): bigint => {
    const t = (a + b + d) & MASK
    d = (d + 1n) & MASK
    a = b ^ (b >> 9n)
    b = (c + (c << 3n)) & MASK
    c = ((c << 21n) & MASK) | (c >> 11n)
    c = (c + t) & MASK
    return t
  }
  for (let i = 0; i < 12; i++) next()
  const keys: bigint[] = []
  for (let i = 0; i < 8; i++) keys.push(next())
  return keys
}

function mixBig(x: bigint, k: bigint): bigint {
  x = ((x ^ k) * 0x9e3779b1n) & MASK
  x ^= x >> 15n
  x = (x * 0x85ebca6bn) & MASK
  x ^= x >> 13n
  x = (x * 0xc2b2ae35n) & MASK
  x ^= x >> 16n
  return x
}

function feistelBig(size: number, keys: readonly bigint[], input: number): number {
  const n = BigInt(size)
  let bits = 0n
  while (2n ** bits < n) bits++
  if (bits % 2n === 1n) bits++
  const w = bits / 2n > 1n ? bits / 2n : 1n
  const half = 2n ** w
  let x = BigInt(input)
  do {
    let l = x / half
    let r = x % half
    for (const k of keys) {
      const f = mixBig(r, k) % half
      const nl = r
      r = l ^ f
      l = nl
    }
    x = l * half + r
  } while (x >= n)
  return Number(x)
}

// ---- frozen Appendix B vectors ----

const HOLLOW_HARSH_1 = 'd6d3f5fe 1b41a505 2e105384 58ff1b97 2f8c6cc0 9cf08eec 21d235d3 791a4d47'

// [label, seed, style, depth, cyrb128 state of style NUL depth NUL seed (or null: not pinned), keys]
const KEY_VECTORS: ReadonlyArray<readonly [string, string, string, number, string | null, string]> = [
  ['hollow-vector / harsh / 1', 'hollow-vector', 'harsh', 1, '4ffa4a1b 54f37863 5c3e51f8 456f970d', HOLLOW_HARSH_1],
  ['hollow-vector / harsh / 2', 'hollow-vector', 'harsh', 2, '213ad9ce 74f674c8 47fc89e3 3a6b83fa', '813fe7b0 d8b12f23 e4c03d17 31f84efd ad9e465e 84166ffb 1c23b449 2d4dab74'],
  ['ccrug / soft / 1', 'ccrug', 'soft', 1, null, '9de1c39d d95dca18 9bbe7ccc a1da4e22 c0e3c043 144b9ac9 7a6f4d03 788cee73'],
  ['(empty) / syllabic / 3', '', 'syllabic', 3, null, '252d9466 89ff6840 ec58211f 13bff1f9 944de641 b438e64b 1b4af6d4 da19bd38'],
]

// inputs 0..11 then size - 1, keys of ("hollow-vector", harsh, 1)
const PERMUTATION_VECTORS: ReadonlyArray<readonly [number, string]> = [
  [67, '28 40 6 21 47 37 59 66 51 43 0 5 50'],
  [72, '28 40 6 21 47 37 59 66 51 43 0 69 20'],
  [5360, '5052 3692 3789 5325 2485 3870 4860 1281 4029 1125 2840 4461 3669'],
  [405000, '378295 324245 222052 266053 140326 220745 194502 216170 272240 84336 248131 320662 47546'],
  [2278125000, '1925003766 1535761927 468969094 177878602 194569490 911573022 678072854 1352240051 1957881230 1998369582 297292292 880600972 1965057988'],
]

function evaluate(size: number, keys: readonly number[]): string {
  const p = feistelPermutation(size, keys)
  const inputs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, size - 1]
  return inputs.map(x => p(x)).join(' ')
}

describe('feistelRoundKeys', () => {
  it('freezes the round count and the key-schedule discard', () => {
    expect(FEISTEL_ROUNDS).toBe(8)
    expect(FEISTEL_KEY_DISCARD).toBe(12)
  })

  it.each(KEY_VECTORS)('matches the Appendix B key schedule: %s', (_label, seed, style, depth, state, keys) => {
    if (state !== null) expect(cyrb128(`${style}${NUL}${depth}${NUL}${seed}`).map(hex).join(' ')).toBe(state)
    const got = feistelRoundKeys(seed, style, depth)
    expect(got).toHaveLength(FEISTEL_ROUNDS)
    expect(hexKeys(got)).toBe(keys)
  })

  it('returns a frozen array', () => {
    expect(Object.isFrozen(feistelRoundKeys('ccrug', 'harsh', 1))).toBe(true)
  })

  it('separates style, depth and seed (distinct inputs give distinct schedules)', () => {
    const base = hexKeys(feistelRoundKeys('ccrug', 'harsh', 1))
    expect(hexKeys(feistelRoundKeys('ccrug', 'soft', 1))).not.toBe(base)
    expect(hexKeys(feistelRoundKeys('ccrug', 'harsh', 2))).not.toBe(base)
    expect(hexKeys(feistelRoundKeys('ccrugg', 'harsh', 1))).not.toBe(base)
  })

  it('equals an independent BigInt key schedule on 500 fixed-seed (seed, style, depth) triples', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 24 }), fc.constantFrom('harsh', 'soft', 'syllabic'), fc.integer({ min: 1, max: 5 }), (seed, style, depth) => {
        const mine = feistelRoundKeys(seed, style, depth)
        const ref = keysBig(seed, style, depth)
        return mine.length === ref.length && mine.every((k, i) => BigInt(k) === ref[i])
      }),
      { seed: 20261020, numRuns: 500 },
    )
  })
})

describe('feistelPermutation vectors', () => {
  it.each(PERMUTATION_VECTORS)('size %d matches Appendix B with the literal keys', (size, expected) => {
    expect(evaluate(size, parseKeys(HOLLOW_HARSH_1))).toBe(expected)
  })

  it.each(PERMUTATION_VECTORS)('size %d matches Appendix B with the scheduled keys of (hollow-vector, harsh, 1)', (size, expected) => {
    expect(evaluate(size, feistelRoundKeys('hollow-vector', 'harsh', 1))).toBe(expected)
  })
})

// Review IN-01: the permutation is only defined on [0, size). A start outside it used to enter the cycle-walk, which for some starts
// never meets a value below size (a hang), so the returned function refuses anything that is not a whole number of the domain.
describe('feistelPermutation refuses an input outside its domain', () => {
  it.each([1, 2, 3, 5, 7, 16, 17, 66, 67, 5360])('size %d: a value that is not a whole number of [0, size) is a RangeError, never a hang', size => {
    const p = feistelPermutation(size, feistelRoundKeys('hollow-vector', 'harsh', 1))
    let padded = 1
    while (padded < size) padded *= 4 // the padded domain of the network is a power of four (even bit count)
    const outside = [-1, size, size + 1, padded - 1, padded, 0.5, size - 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].filter(
      x => !(Number.isInteger(x) && x >= 0 && x < size), // at size 1 the padded domain has no value outside [0, 1) but -1 and 1
    )
    expect(outside.length).toBeGreaterThan(5)
    for (const x of outside) expect(() => p(x), String(x)).toThrow(RangeError)
  })

  it('still answers every whole number of the domain, at both ends', () => {
    const p = feistelPermutation(67, feistelRoundKeys('hollow-vector', 'harsh', 1))
    for (const x of [0, 1, 33, 66]) expect(p(x)).toBeGreaterThanOrEqual(0)
    expect(p(66)).toBeLessThan(67)
  })

  it('reads a non-number as outside the domain', () => {
    const p = feistelPermutation(67, feistelRoundKeys('hollow-vector', 'harsh', 1)) as (x: unknown) => number
    expect(() => p('3')).toThrow(RangeError)
    expect(() => p(undefined)).toThrow(RangeError)
  })
})

describe('feistelPermutation is a bijection', () => {
  it.each([1, 2, 3, 4, 5, 66, 67, 72, 3960, 5360, 65536, 1048576])('exhaustively on [0, %d)', size => {
    const p = feistelPermutation(size, feistelRoundKeys('hollow-vector', 'harsh', 1))
    const seen = new Uint8Array(size)
    let outOfRange = 0
    let repeated = 0
    for (let x = 0; x < size; x++) {
      const y = p(x)
      if (!(Number.isInteger(y) && y >= 0 && y < size)) outOfRange++
      else if (seen[y] === 1) repeated++
      else seen[y] = 1
    }
    let hit = 0
    for (let i = 0; i < size; i++) hit += seen[i]!
    expect({ outOfRange, repeated, hit }).toEqual({ outOfRange: 0, repeated: 0, hit: size })
  })

  it('is a bijection for other keys too (size 5360, two further schedules)', () => {
    for (const keys of [feistelRoundKeys('ccrug', 'soft', 2), feistelRoundKeys('', 'syllabic', 3)]) {
      const p = feistelPermutation(5360, keys)
      const seen = new Set<number>()
      for (let x = 0; x < 5360; x++) seen.add(p(x))
      expect(seen.size).toBe(5360)
    }
  })

  it('is deterministic: two permutations built from one schedule agree', () => {
    const keys = feistelRoundKeys('ccrug', 'harsh', 1)
    const a = feistelPermutation(405000, keys)
    const b = feistelPermutation(405000, keys)
    for (let x = 0; x < 1000; x++) expect(a(x * 400)).toBe(b(x * 400))
  })
})

describe('feistelPermutation against an independent BigInt implementation', () => {
  it.each([67, 5360, 405000, 34304000, 2278125000, 2744320000])('equals the BigInt Feistel on 2,000 fixed-seed inputs below %d', size => {
    const keys = feistelRoundKeys('hollow-vector', 'harsh', 1)
    const keysRef = keysBig('hollow-vector', 'harsh', 1)
    const p = feistelPermutation(size, keys)
    fc.assert(
      fc.property(fc.integer({ min: 0, max: size - 1 }), x => p(x) === feistelBig(size, keysRef, x)),
      { seed: 20261020, numRuns: 2000 },
    )
  })

  it('also agrees near the top of the 2^52 domain (sampled; BigInt reference)', () => {
    const size = 2 ** 52
    const keys = feistelRoundKeys('ccrug', 'soft', 3)
    const keysRef = keysBig('ccrug', 'soft', 3)
    const p = feistelPermutation(size, keys)
    for (const x of [0, 1, 2 ** 26, 2 ** 40 + 12345, size - 2, size - 1]) expect(p(x)).toBe(feistelBig(size, keysRef, x))
  })
})

describe('feistelPermutation argument checks', () => {
  it.each([0, 1.5, -1, 2 ** 52 + 1, NaN, Infinity])('throws RangeError for size %s', size => {
    expect(() => feistelPermutation(size, feistelRoundKeys('ccrug', 'harsh', 1))).toThrow(RangeError)
  })

  it('throws RangeError for a non-number size', () => {
    expect(() => feistelPermutation('5' as unknown as number, feistelRoundKeys('ccrug', 'harsh', 1))).toThrow(RangeError)
  })

  it('accepts the largest allowed size 2^52', () => {
    expect(() => feistelPermutation(2 ** 52, feistelRoundKeys('ccrug', 'harsh', 1))).not.toThrow()
  })
})
