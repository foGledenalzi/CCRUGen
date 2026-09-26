// ENG-04 (input half) and D-12: base validation. validateBase reports why without throwing, assertBase throws RangeError.
// Every value below is derived from the definition of an admissible base: a whole, positive, even number up to 2^26.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as engine from '../index'
import { MAX_BASE, assertBase, validateBase } from '../core/base'
import type { BaseProblem } from '../core/base'
import { DEMON_SUBTYPES, DEMON_TYPES } from '../core/types'

const NULL_PROTO = Object.create(null) as unknown
const THROWING_TOSTRING = {
  toString(): string {
    throw new Error('toString must never reach the caller')
  },
}

describe('MAX_BASE', () => {
  it('is 2^26, the safe ceiling', () => {
    expect(MAX_BASE).toBe(67108864)
    expect(MAX_BASE).toBe(2 ** 26)
  })
})

describe('validateBase accepts', () => {
  it.each([2, 4, 6, 8, 10, 12, 36, 60, 100, 1000, 65536, 67108862, 67108864])('base %d', n => {
    expect(validateBase(n)).toEqual({ ok: true, base: n })
  })

  it('every even integer from 2 to 20000 (exhaustive) and a fixed-seed sample up to 2^26', () => {
    for (let n = 2; n <= 20000; n += 2) {
      const check = validateBase(n)
      if (!check.ok || check.base !== n) throw new Error(`validateBase(${n}) should be ok`)
    }
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_BASE / 2 }), half => {
        const check = validateBase(half * 2)
        return check.ok && check.base === half * 2
      }),
      { seed: 20260930, numRuns: 2000 },
    )
  })
})

describe('validateBase rejects with the reason and never throws', () => {
  const table: Array<[string, unknown, BaseProblem]> = [
    ['NaN', NaN, 'not-a-number'],
    ["the string '10'", '10', 'not-a-number'],
    ['the empty string', '', 'not-a-number'],
    ['the bigint 10n', 10n, 'not-a-number'],
    ['null', null, 'not-a-number'],
    ['undefined', undefined, 'not-a-number'],
    ['an object', {}, 'not-a-number'],
    ['an array', [10], 'not-a-number'],
    ['a boxed Number', new Number(10), 'not-a-number'],
    ['an object without a prototype', NULL_PROTO, 'not-a-number'],
    ['an object whose toString throws', THROWING_TOSTRING, 'not-a-number'],
    ['a symbol', Symbol('base'), 'not-a-number'],
    ['a function', () => 10, 'not-a-number'],
    ['true', true, 'not-a-number'],
    ['Infinity', Infinity, 'infinite'],
    ['-Infinity', -Infinity, 'infinite'],
    ['10.5', 10.5, 'not-integer'],
    ['0.5', 0.5, 'not-integer'],
    ['-2.5', -2.5, 'not-integer'],
    ['0', 0, 'zero'],
    ['-0', -0, 'zero'],
    ['-4', -4, 'negative'],
    ['-3', -3, 'negative'],
    ['-1', -1, 'negative'],
    ['1', 1, 'odd'],
    ['3', 3, 'odd'],
    ['11', 11, 'odd'],
    ['9007199254740991', Number.MAX_SAFE_INTEGER, 'odd'],
    ['67108865', 67108865, 'odd'],
    ['67108866', 67108866, 'too-large'],
    ['2^27', 2 ** 27, 'too-large'],
    ['1e308', 1e308, 'too-large'],
  ]

  // Plain loops, not it.each: vitest formats extra it.each arguments with toString, which the hostile values here forbid.
  for (const [name, value, reason] of table) {
    it(`${name} -> ${reason}`, () => {
      const check = validateBase(value)
      expect(check.ok).toBe(false)
      if (check.ok) return
      expect(check.reason).toBe(reason)
      expect(check.message.startsWith('Invalid base ')).toBe(true)
    })
  }

  it('precedence: a negative odd number is negative, a negative fraction is not-integer', () => {
    expect(validateBase(-3)).toMatchObject({ ok: false, reason: 'negative' })
    expect(validateBase(-2.5)).toMatchObject({ ok: false, reason: 'not-integer' })
  })
})

describe('validateBase messages say why', () => {
  const messages: Array<[string, unknown, string]> = [
    ['NaN', NaN, 'Invalid base NaN: the base must be a number'],
    ['a string', 'ten', 'Invalid base "ten": the base must be a number'],
    ['null', null, 'Invalid base null: the base must be a number'],
    ['undefined', undefined, 'Invalid base undefined: the base must be a number'],
    ['a bigint', 10n, 'Invalid base 10: the base must be a number'],
    ['no prototype', NULL_PROTO, 'Invalid base <object>: the base must be a number'],
    ['throwing toString', THROWING_TOSTRING, 'Invalid base <object>: the base must be a number'],
    ['Infinity', Infinity, 'Invalid base Infinity: the base must be finite'],
    ['-Infinity', -Infinity, 'Invalid base -Infinity: the base must be finite'],
    ['10.5', 10.5, 'Invalid base 10.5: the base must be a whole number'],
    ['0', 0, 'Invalid base 0: a numogram needs at least 2 zones'],
    ['-0', -0, 'Invalid base 0: a numogram needs at least 2 zones'],
    ['-4', -4, 'Invalid base -4: the base must be positive'],
    ['11', 11, 'Invalid base 11: odd bases have a self-paired zone, so no numogram exists'],
    ['67108866', 67108866, 'Invalid base 67108866: above the safe ceiling 2^26 = 67108864'],
    ['1e308', 1e308, 'Invalid base 1e+308: above the safe ceiling 2^26 = 67108864'],
  ]

  for (const [name, value, message] of messages) {
    it(name, () => {
      const check = validateBase(value)
      expect(check.ok).toBe(false)
      if (!check.ok) expect(check.message).toBe(message)
    })
  }

  it('never throws for a fixed-seed stream of arbitrary values', () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        const check = validateBase(value)
        return check.ok ? typeof value === 'number' && value === check.base : check.message.startsWith('Invalid base ')
      }),
      { seed: 20260931, numRuns: 2000 },
    )
  })
})

describe('assertBase', () => {
  it('returns undefined for a valid base', () => {
    expect(assertBase(10)).toBeUndefined()
    expect(assertBase(2)).toBeUndefined()
    expect(assertBase(MAX_BASE)).toBeUndefined()
  })

  const rejected: Array<[string, unknown]> = [
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['10.5', 10.5],
    ['0', 0],
    ['-4', -4],
    ['7', 7],
    ['67108866', 67108866],
    ["the string '10'", '10'],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
    ['an object without a prototype', NULL_PROTO],
    ['an object whose toString throws', THROWING_TOSTRING],
    ['the bigint 10n', 10n],
  ]

  for (const [name, value] of rejected) {
    it(`throws a RangeError carrying the validateBase message for ${name}`, () => {
      const check = validateBase(value)
      expect(check.ok).toBe(false)
      expect(() => assertBase(value)).toThrow(RangeError)
      if (!check.ok) expect(() => assertBase(value)).toThrow(check.message)
    })
  }

  it('the thrown message starts with Invalid base and names the reason', () => {
    let caught: unknown
    try {
      assertBase(7)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(RangeError)
    expect((caught as RangeError).message).toBe('Invalid base 7: odd bases have a self-paired zone, so no numogram exists')
  })
})

describe('type contracts', () => {
  it('lists the three demon types and the seven subtypes, cross-torque chronodemons explicit', () => {
    expect([...DEMON_TYPES]).toEqual(['chrono', 'amphi', 'xeno'])
    expect([...DEMON_SUBTYPES]).toEqual([
      'cyclic-chrono',
      'cross-torque-chrono',
      'syzygetic-chrono',
      'plex-amphi',
      'warp-amphi',
      'chaotic-xeno',
      'syzygetic-xeno',
    ])
  })
})

describe('public barrel', () => {
  it('re-exports the base API and the demon constants by relative path', () => {
    expect(engine.MAX_BASE).toBe(MAX_BASE)
    expect(engine.validateBase).toBe(validateBase)
    expect(engine.assertBase).toBe(assertBase)
    expect(engine.DEMON_TYPES).toBe(DEMON_TYPES)
    expect(engine.DEMON_SUBTYPES).toBe(DEMON_SUBTYPES)
  })
})
