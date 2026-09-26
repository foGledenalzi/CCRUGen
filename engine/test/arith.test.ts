// ENG-01 gate arithmetic: T(k) and the digital root in the numogram's own base (Pitfall 1).
// Independence: the oracle below sums the digits of the built-in radix conversion (a different mechanism from the
// engine's closed form), and the literal gate tables are computed by hand from the definition.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as engine from '../index'
import { digitalRoot, triangular } from '../core/arith'
import { formatNumeral } from '../core/numerals'

describe('triangular', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 3],
    [9, 45],
    [11, 66],
    [67108863, 2251799780130816],
  ])('T(%d) = %d', (k, expected) => {
    expect(triangular(k)).toBe(expected)
  })

  it('equals k(k+1)/2 computed in BigInt for a fixed-seed sample across the whole range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 94906264 }), k => {
        const exact = (BigInt(k) * BigInt(k + 1)) / 2n
        return BigInt(triangular(k)) === exact
      }),
      { seed: 20260932, numRuns: 2000 },
    )
  })

  it('keeps k(k+1) inside the safe-integer range up to its ceiling 94906264', () => {
    expect(BigInt(94906264) * BigInt(94906265) <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true)
    expect(triangular(94906264)).toBe(4503599520671980)
  })

  it.each([-1, 1.5, NaN, Infinity, -Infinity, 94906265, Number.MAX_SAFE_INTEGER, 2 ** 53])('rejects %s with RangeError', k => {
    expect(() => triangular(k)).toThrow(RangeError)
  })

  it('rejects a non-number with RangeError', () => {
    expect(() => triangular('3' as unknown as number)).toThrow(RangeError)
  })
})

describe('digitalRoot', () => {
  it.each([
    [0, 10, 0],
    [0, 2, 0],
    [36, 10, 9],
    [45, 10, 9],
    [28, 10, 1],
    [10, 12, 10],
    [1, 2, 1],
    [3, 2, 1],
    [66, 12, 11],
    [9, 10, 9],
    [10, 10, 1],
    [18, 10, 9],
  ])('digitalRoot(%d, %d) = %d', (value, base, expected) => {
    expect(digitalRoot(value, base)).toBe(expected)
  })

  it('base 2 collapses to 0 for 0 and 1 for everything else', () => {
    for (let v = 0; v < 200; v++) expect(digitalRoot(v, 2)).toBe(v === 0 ? 0 : 1)
  })

  // Gate tables: digitalRoot(T(k), n) for k = 0..n-1, worked by hand from the definition
  // (root = 0 for 0, else ((T - 1) mod (n - 1)) + 1).
  const gateTables: Array<[number, number[]]> = [
    [2, [0, 1]],
    [4, [0, 1, 3, 3]],
    [6, [0, 1, 3, 1, 5, 5]],
    [8, [0, 1, 3, 6, 3, 1, 7, 7]],
    [10, [0, 1, 3, 6, 1, 6, 3, 1, 9, 9]],
  ]
  it.each(gateTables)('gate table of base %d', (base, expected) => {
    const table = Array.from({ length: base }, (_, k) => digitalRoot(triangular(k), base))
    expect(table).toEqual(expected)
  })

  it('gate table of base 12, written in its own digits, ends 1, b, b', () => {
    const table = Array.from({ length: 12 }, (_, k) => formatNumeral(digitalRoot(triangular(k), 12), 12))
    expect(table.join(',')).toBe('0,1,3,6,a,4,a,6,3,1,b,b')
    expect(table).toEqual(['0', '1', '3', '6', 'a', '4', 'a', '6', '3', '1', 'b', 'b'])
  })

  it('the last gate of every base is its own zone: digitalRoot(T(n-1), n) = n - 1 for base 4..60', () => {
    // T(n-1) = n(n-1)/2 is a multiple of (n-1) when n is even, so the root is n - 1.
    for (let n = 4; n <= 60; n += 2) expect(digitalRoot(triangular(n - 1), n)).toBe(n - 1)
  })

  it('stays in 1..base-1 for every positive value (never 0, never above base - 1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 67108864 }), fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (base, value) => {
        const root = digitalRoot(value, base)
        return root >= 1 && root <= base - 1
      }),
      { seed: 20260933, numRuns: 2000 },
    )
  })

  // Test-side oracle: iterate the sum of the digits of v written in base b until a single digit is left.
  function iterated(value: number, base: number): number {
    let v = value
    while (v >= base) {
      let sum = 0
      for (const ch of v.toString(base)) sum += parseInt(ch, base)
      v = sum
    }
    return v
  }

  it('equals the iterated in-base digit sum for every base 2..36 (fixed seed)', () => {
    for (let b = 2; b <= 36; b++) {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), v => digitalRoot(v, b) === iterated(v, b)),
        { seed: 20260926, numRuns: 300 },
      )
    }
  })

  it('is NOT a decimal digit sum and NOT value mod (base - 1): base 12, value 66', () => {
    expect(digitalRoot(66, 12)).toBe(11)
    expect(66 % 11).toBe(0) // the plain modulus would wrongly give 0 here
    expect(digitalRoot(11, 12)).toBe(11)
    expect(11 % 11).toBe(0)
  })

  it.each([
    [-1, 10],
    [1.5, 10],
    [NaN, 10],
    [Infinity, 10],
    [2 ** 53, 10],
    [5, 1],
    [5, 0],
    [5, -2],
    [5, 10.5],
    [5, NaN],
    [5, Infinity],
  ])('rejects digitalRoot(%d, %d) with RangeError', (value, base) => {
    expect(() => digitalRoot(value, base)).toThrow(RangeError)
  })
})

describe('public barrel', () => {
  it('re-exports triangular and digitalRoot', () => {
    expect(engine.triangular).toBe(triangular)
    expect(engine.digitalRoot).toBe(digitalRoot)
  })
})
