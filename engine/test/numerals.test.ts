// D-04 / D-05: numbers written in the numogram's own base, and read back. The built-in radix conversion is the
// independent oracle up to base 36 (the engine never uses it); beyond 36 the scheme is decimal digit groups joined by
// '.', checked by reconstructing the value from its digits. Seeds and run counts are literals (D-10).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as engine from '../index'
import { triangular, digitalRoot } from '../core/arith'
import { MAX_BASE } from '../core/base'
import {
  NUMERAL_DIGITS,
  NUMERAL_SEPARATOR,
  digitsOf,
  formatGateName,
  formatNetSpan,
  formatNumeral,
  parseNumeral,
  torqueLabel,
} from '../core/numerals'

const MAX_SAFE = Number.MAX_SAFE_INTEGER
const THROWING_TOSTRING = {
  toString(): string {
    throw new Error('toString must never reach the caller')
  },
}

describe('constants', () => {
  it('the digit alphabet is 0-9 then a-z, the group separator is a dot', () => {
    expect(NUMERAL_DIGITS).toBe('0123456789abcdefghijklmnopqrstuvwxyz')
    expect(NUMERAL_DIGITS.length).toBe(36)
    expect(NUMERAL_SEPARATOR).toBe('.')
  })
})

describe('digitsOf', () => {
  it('lists digits most significant first', () => {
    expect(digitsOf(66, 12)).toEqual([5, 6])
    expect(digitsOf(0, 7)).toEqual([0])
    expect(digitsOf(3601, 60)).toEqual([1, 0, 1])
    expect(digitsOf(255, 16)).toEqual([15, 15])
    expect(digitsOf(45, 10)).toEqual([4, 5])
    expect(digitsOf(MAX_BASE, MAX_BASE)).toEqual([1, 0])
  })

  it('reconstructs the value from its digits in every base 2..MAX_BASE (fixed seed 20260929)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: MAX_BASE }), fc.integer({ min: 0, max: MAX_SAFE }), (base, value) => {
        const digits = digitsOf(value, base)
        if (digits.some(d => !Number.isInteger(d) || d < 0 || d >= base)) return false
        if (value !== 0 && digits[0] === 0) return false // no leading zero
        let sum = 0
        let power = 1
        for (let i = digits.length - 1; i >= 0; i--) {
          sum += (digits[i] as number) * power
          power *= base
        }
        return sum === value
      }),
      { seed: 20260929, numRuns: 3000 },
    )
  })
})

describe('formatNumeral, bases 2..36 (independent oracle: the built-in radix conversion)', () => {
  it('matches the oracle for every base 2..36 (fixed seed 20260927)', () => {
    for (let base = 2; base <= 36; base++) {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: MAX_SAFE }), value => formatNumeral(value, base) === value.toString(base)),
        { seed: 20260927, numRuns: 200 },
      )
    }
  })

  it('left-pads with zeros to minDigits like the oracle does', () => {
    for (let base = 2; base <= 36; base++) {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100_000_000 }), fc.integer({ min: 1, max: 12 }), (value, min) => {
          return formatNumeral(value, base, min) === value.toString(base).padStart(min, '0')
        }),
        { seed: 20260927, numRuns: 50 },
      )
    }
  })

  it.each([
    [0, 2, '0'],
    [1, 2, '1'],
    [10, 2, '1010'],
    [35, 36, 'z'],
    [36, 36, '10'],
    [255, 16, 'ff'],
    [10, 12, 'a'],
    [11, 12, 'b'],
    [66, 12, '56'],
    [10, 7, '13'],
    [45, 10, '45'],
  ])('formatNumeral(%d, %d) = %s', (value, base, expected) => {
    expect(formatNumeral(value, base)).toBe(expected)
  })

  it('writes the largest safe integer in binary as 53 ones', () => {
    expect(formatNumeral(MAX_SAFE, 2)).toBe('1'.repeat(53))
  })
})

describe('formatNumeral, bases beyond 36 (decimal digit groups joined by a dot)', () => {
  it.each([
    [3601, 60, '1.0.1'],
    [59, 60, '59'],
    [0, 60, '0'],
    [60, 60, '1.0'],
    [1770, 60, '29.30'],
    [35, 37, '35'],
    [36, 37, '36'],
    [37, 37, '1.0'],
    [MAX_BASE - 1, MAX_BASE, '67108863'],
    [MAX_BASE, MAX_BASE, '1.0'],
  ])('formatNumeral(%d, %d) = %s', (value, base, expected) => {
    expect(formatNumeral(value, base)).toBe(expected)
  })

  it('pads with zero digits, not zero characters', () => {
    expect(formatNumeral(3, 60, 2)).toBe('0.3')
    expect(formatNumeral(3, 60, 4)).toBe('0.0.0.3')
    expect(formatNumeral(3, 10, 2)).toBe('03')
    expect(formatNumeral(59, 60, 1)).toBe('59')
    expect(formatNumeral(3601, 60, 2)).toBe('1.0.1')
  })

  it('is the digit list joined by the separator (fixed seed 20260929)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 37, max: MAX_BASE }), fc.integer({ min: 0, max: MAX_SAFE }), (base, value) => {
        return formatNumeral(value, base) === digitsOf(value, base).join(NUMERAL_SEPARATOR)
      }),
      { seed: 20260929, numRuns: 2000 },
    )
  })
})

describe('parseNumeral inverts formatNumeral', () => {
  it('round-trips for bases 2..MAX_BASE, values up to MAX_SAFE_INTEGER, padding 1..4 (fixed seed 20260928)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: MAX_BASE }),
        fc.integer({ min: 0, max: MAX_SAFE }),
        fc.integer({ min: 1, max: 4 }),
        (b, v, d) => parseNumeral(formatNumeral(v, b, d), b) === v,
      ),
      { seed: 20260928, numRuns: 5000 },
    )
  })

  it('round-trips the extremes in every base 2..70 and at the ceiling', () => {
    for (let b = 2; b <= 70; b++) {
      for (const v of [0, 1, b - 1, b, b + 1, MAX_SAFE - 1, MAX_SAFE]) {
        expect(parseNumeral(formatNumeral(v, b), b)).toBe(v)
      }
    }
    for (const v of [0, MAX_BASE - 1, MAX_BASE, MAX_SAFE]) expect(parseNumeral(formatNumeral(v, MAX_BASE), MAX_BASE)).toBe(v)
  })

  it('accepts leading zero digits where the grammar allows them', () => {
    expect(parseNumeral('03', 10)).toBe(3)
    expect(parseNumeral('0.3', 60)).toBe(3)
    expect(parseNumeral('0000', 2)).toBe(0)
    expect(parseNumeral('00ff', 16)).toBe(255)
    expect(parseNumeral('0.0.5', 60)).toBe(5)
  })

  it('reads odd bases too (numerals are not limited to numogram bases)', () => {
    expect(parseNumeral('13', 7)).toBe(10)
    expect(formatNumeral(10, 7)).toBe('13')
  })
})

describe('parseNumeral rejects with RangeError', () => {
  const rejected: Array<[string, number]> = [
    ['', 10],
    [' 1', 10],
    ['1 ', 10],
    ['\n1', 10],
    ['1\t', 10],
    ['-1', 10],
    ['+1', 10],
    ['1.0', 10],
    ['a', 10],
    ['A', 16],
    ['g', 16],
    ['1e3', 10],
    ['0x1f', 16],
    ['2', 2],
    ['9', 8],
    ['b', 11],
    ['٣', 10], // ARABIC-INDIC DIGIT THREE
    ['１', 10], // FULLWIDTH DIGIT ONE
    ['.', 60],
    ['1.', 60],
    ['.1', 60],
    ['1..1', 60],
    ['60', 60],
    ['1.60', 60],
    ['01', 60],
    ['1.05', 60],
    ['a', 60],
    ['1.a', 60],
    ['1.0e2', 60],
    ['1 .2', 60],
    ['67108864', MAX_BASE],
    ['1' + '0'.repeat(16), 10], // 1e16 is above MAX_SAFE_INTEGER
    ['9007199254740992', 10], // MAX_SAFE_INTEGER + 1
    ['1' + '0'.repeat(53), 2], // 2^53
    ['0'.repeat(65), 10], // 65 characters: over the length cap, although the value is 0
    ['0.'.repeat(33) + '0', 60], // 67 characters
  ]

  for (const [text, base] of rejected) {
    it(`${JSON.stringify(text.length > 30 ? `${text.slice(0, 27)}...` : text)} in base ${base}`, () => {
      expect(() => parseNumeral(text, base)).toThrow(RangeError)
    })
  }

  it('the message names the text, the base and the reason', () => {
    expect(() => parseNumeral('1 ', 10)).toThrow(/^Invalid numeral "1 " for base 10: /)
    expect(() => parseNumeral('60', 60)).toThrow(/^Invalid numeral "60" for base 60: /)
  })

  it('accepts exactly MAX_SAFE_INTEGER and refuses everything above it (fixed seed 20260934)', () => {
    expect(parseNumeral('9007199254740991', 10)).toBe(MAX_SAFE)
    expect(parseNumeral('1'.repeat(53), 2)).toBe(MAX_SAFE)
    const text = (value: bigint, base: number): string => {
      if (base <= 36) return value.toString(base)
      const groups: string[] = []
      let v = value
      const b = BigInt(base)
      while (v > 0n) {
        groups.unshift(String(v % b))
        v /= b
      }
      return groups.join('.')
    }
    fc.assert(
      fc.property(fc.integer({ min: 2, max: MAX_BASE }), fc.integer({ min: 1, max: 1000 }), (base, delta) => {
        try {
          parseNumeral(text(BigInt(MAX_SAFE) + BigInt(delta), base), base)
          return false
        } catch (e) {
          return e instanceof RangeError
        }
      }),
      { seed: 20260934, numRuns: 1000 },
    )
  })

  it('refuses a huge input quickly and with a bounded message', () => {
    const big = '9'.repeat(1_000_000)
    let caught: unknown
    try {
      parseNumeral(big, 10)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(RangeError)
    expect((caught as RangeError).message.length).toBeLessThan(300)
  })

  it('refuses non-string text without throwing anything but RangeError', () => {
    for (const bad of [null, undefined, 10, 10n, {}, [], THROWING_TOSTRING, Symbol('x')]) {
      expect(() => parseNumeral(bad as unknown as string, 10)).toThrow(RangeError)
    }
  })

  it.each([1, 0, -2, 10.5, NaN, Infinity, MAX_BASE + 1])('refuses the base %s', base => {
    expect(() => parseNumeral('1', base)).toThrow(RangeError)
  })
})

describe('formatNumeral and digitsOf validate their arguments', () => {
  it.each([-1, 1.5, NaN, Infinity, -Infinity, MAX_SAFE + 1, 2 ** 53])('refuses the value %s', value => {
    expect(() => formatNumeral(value, 10)).toThrow(RangeError)
    expect(() => digitsOf(value, 10)).toThrow(RangeError)
  })

  it.each([1, 0, -2, 10.5, NaN, Infinity, MAX_BASE + 1])('refuses the base %s', base => {
    expect(() => formatNumeral(5, base)).toThrow(RangeError)
    expect(() => digitsOf(5, base)).toThrow(RangeError)
  })

  it.each([0, -1, 65, 1.5, NaN, Infinity])('refuses minDigits %s', min => {
    expect(() => formatNumeral(5, 10, min)).toThrow(RangeError)
  })

  it('refuses non-numbers', () => {
    expect(() => formatNumeral('5' as unknown as number, 10)).toThrow(RangeError)
    expect(() => formatNumeral(5, '10' as unknown as number)).toThrow(RangeError)
  })

  it('accepts the smallest and largest admissible arguments', () => {
    expect(formatNumeral(0, 2)).toBe('0')
    expect(formatNumeral(5, 10, 64)).toBe('0'.repeat(63) + '5')
    expect(formatNumeral(MAX_SAFE, MAX_BASE)).toBe(digitsOf(MAX_SAFE, MAX_BASE).join('.'))
  })
})

describe('gate names and net-spans in the numogram’s own base (D-04)', () => {
  it('base 12: the gate of zone 11 is T(11) = 66 = 5*12 + 6, written Gt-56 (5 + 6 = 11)', () => {
    expect(triangular(11)).toBe(66)
    expect(formatGateName(66, 12)).toBe('Gt-56')
    expect(formatGateName(triangular(11), 12)).toBe('Gt-56')
  })

  it('net-spans are written in the base: 11::3 in base 12 reads b::3', () => {
    expect(formatNetSpan(11, 3, 12)).toBe('b::3')
    expect(formatNetSpan(45, 3, 10)).toBe('45::3')
    expect(formatNetSpan(59, 30, 60)).toBe('59::30')
    expect(formatNetSpan(61, 1, 60)).toBe('1.1::1')
  })

  it('base-10 gate names are unchanged: Gt-00, Gt-01, Gt-03, Gt-06, Gt-10, Gt-15, Gt-21, Gt-28, Gt-36, Gt-45', () => {
    const names = Array.from({ length: 10 }, (_, k) => formatGateName(triangular(k), 10))
    expect(names).toEqual(['Gt-00', 'Gt-01', 'Gt-03', 'Gt-06', 'Gt-10', 'Gt-15', 'Gt-21', 'Gt-28', 'Gt-36', 'Gt-45'])
  })

  it.each([
    [15, 10, 'Gt-15'],
    [3, 10, 'Gt-03'],
    [0, 10, 'Gt-00'],
    [1770, 60, 'Gt-29.30'],
    [0, 60, 'Gt-0.0'],
    [3, 2, 'Gt-11'],
    // T(2^26 - 1) = 2^51 - 2^25 = 33554431 * 2^26 + 33554432, worked by hand.
    [2251799780130816, MAX_BASE, 'Gt-33554431.33554432'],
  ])('formatGateName(%d, %d) = %s', (cumulation, base, expected) => {
    expect(formatGateName(cumulation, base)).toBe(expected)
  })

  it('the name shows the in-base digital root: digit sum of a gate name reduces to the gate target', () => {
    // b = 1 (mod b - 1), so the digit sum of any numeral has the same digital root as the number itself.
    for (let base = 2; base <= 60; base += 2) {
      for (let zone = 0; zone < base; zone++) {
        const cumulation = triangular(zone)
        const digitSum = digitsOf(cumulation, base).reduce((a, d) => a + d, 0)
        expect(digitalRoot(digitSum, base)).toBe(digitalRoot(cumulation, base))
      }
    }
  })
})

describe('torqueLabel (display only; the numeric torqueIndex is the identity)', () => {
  it('uses letters A..Z for 0..25', () => {
    for (let i = 0; i < 26; i++) expect(torqueLabel(i)).toBe(String.fromCharCode(65 + i))
    expect(torqueLabel(0)).toBe('A')
    expect(torqueLabel(25)).toBe('Z')
  })

  it('switches to the decimal number i + 1 from index 26 on', () => {
    expect(torqueLabel(26)).toBe('27')
    expect(torqueLabel(27)).toBe('28')
    expect(torqueLabel(177)).toBe('178')
    expect(torqueLabel(1000)).toBe('1001')
  })

  it.each([-1, 1.5, NaN, Infinity, MAX_SAFE + 1])('refuses %s with RangeError', i => {
    expect(() => torqueLabel(i)).toThrow(RangeError)
  })

  it('refuses a non-number with RangeError', () => {
    expect(() => torqueLabel('A' as unknown as number)).toThrow(RangeError)
  })
})

describe('public barrel', () => {
  it('re-exports the numeral API', () => {
    expect(engine.NUMERAL_DIGITS).toBe(NUMERAL_DIGITS)
    expect(engine.NUMERAL_SEPARATOR).toBe(NUMERAL_SEPARATOR)
    expect(engine.digitsOf).toBe(digitsOf)
    expect(engine.formatNumeral).toBe(formatNumeral)
    expect(engine.parseNumeral).toBe(parseNumeral)
    expect(engine.formatNetSpan).toBe(formatNetSpan)
    expect(engine.formatGateName).toBe(formatGateName)
    expect(engine.torqueLabel).toBe(torqueLabel)
  })
})
