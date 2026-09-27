// Layout format and default-params contracts (Task 1, LAY-03): fmt never prints '-0' or a non-finite value; ceilQ
// keeps chord radii exact at 1/8 quanta; DEFAULT_LAYOUT_PARAMS is frozen data; the id tuples are exact.
import { describe, expect, it } from 'vitest'
import { ceilQ, fmt, QUANTUM, roundQ } from '../layout/format'
import { DEFAULT_LAYOUT_PARAMS } from '../layout/params'
import { CAPSULE_PLACEMENTS, LAYOUT_IDS, PACKERS } from '../layout/types'

describe('fmt', () => {
  it('formats to at most 2 decimals', () => {
    expect(fmt(3)).toBe('3')
    expect(fmt(2.5)).toBe('2.5')
    expect(fmt(1 / 3)).toBe('0.33')
    expect(fmt(-1 / 3)).toBe('-0.33')
    expect(fmt(123456.789)).toBe('123456.79')
  })

  it('never prints -0', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(-0)).toBe('0')
    expect(fmt(-0.004)).toBe('0')
  })

  it('throws RangeError on a non-finite value', () => {
    expect(() => fmt(NaN)).toThrow(RangeError)
    expect(() => fmt(Infinity)).toThrow(RangeError)
    expect(() => fmt(-Infinity)).toThrow(RangeError)
  })
})

describe('ceilQ / roundQ', () => {
  it('ceilQ rounds up to the nearest 1/8, absorbing the 1e-9 last-ulp slack', () => {
    expect(ceilQ(84.00000000000001)).toBe(84)
    expect(ceilQ(84.01)).toBe(84.125)
    expect(ceilQ(84)).toBe(84)
  })

  it('roundQ rounds to the nearest 1/8', () => {
    expect(roundQ(1.07)).toBe(1.125)
    expect(roundQ(1.06)).toBe(1)
  })

  it('QUANTUM is 8', () => {
    expect(QUANTUM).toBe(8)
  })
})

describe('DEFAULT_LAYOUT_PARAMS', () => {
  it('is frozen and matches the locked literal values', () => {
    expect(Object.isFrozen(DEFAULT_LAYOUT_PARAMS)).toBe(true)
    expect(DEFAULT_LAYOUT_PARAMS).toEqual({
      r: 21,
      s: 84,
      labelRatio: 0.8,
      glyphGap: 84,
      nestDelta: 1.5,
      nestMode: 'even',
      packer: 'spiral',
      capsuleGap: 84,
      capsulePlacement: 'beside',
      margin: 70,
      minWidth: 800,
      minHeight: 600,
      cap: 4096,
      strokeBaseWidth: 800,
    })
  })
})

describe('layout id tuples', () => {
  it('are exact', () => {
    expect(LAYOUT_IDS).toEqual(['ring', 'ladder', 'spiral'])
    expect(PACKERS).toEqual(['spiral', 'shelf'])
    expect(CAPSULE_PLACEMENTS).toEqual(['beside', 'above'])
  })
})
