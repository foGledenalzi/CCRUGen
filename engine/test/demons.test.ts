// The virtual demon space (ENG-03, D-14): mesh <-> net-span in O(1) that stays exact at the 2^26 ceiling, the
// type/subtype classifier with the explicit cross-Torque chronodemon, closed-form counts, incident and Numodemon
// iterators. The sweeps against the independent reference are in demons.sweep.test.ts; the ceiling checks are in
// ceiling.test.ts. Fixed seeds throughout (D-10).
import fc from 'fast-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as engine from '../index'
import { clearNumogramCache, createNumogram, DEMON_SUBTYPES, DEMON_TYPES, meshOf, netSpanOf } from '../index'
import type { DemonRef, DemonSubtype } from '../index'

const CAP = 2 ** 26
const COUNT_AT_CAP = 2251799780130816 // C(2^26, 2)
const LAST_MESH = 2251799780130815 // (2^26 - 1)::(2^26 - 2)

const countsOf = (base: number): number[] => {
  const counts = createNumogram(base).demons.counts()
  return DEMON_SUBTYPES.map(s => counts[s])
}
const sum = (list: readonly number[]): number => list.reduce((x, y) => x + y, 0)

/** The exact inverse of the mesh formula by BigInt bisection: independent of the engine's float estimate (test code only). */
function exactNetSpan(m: number): [number, number] {
  const M = BigInt(m)
  let lo = 1n
  let hi = 1n << 27n
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n
    if ((mid * (mid - 1n)) / 2n <= M) lo = mid
    else hi = mid - 1n
  }
  return [Number(lo), Number(M - (lo * (lo - 1n)) / 2n)]
}

beforeEach(() => {
  clearNumogramCache()
})

describe('meshOf and netSpanOf (standalone)', () => {
  it('map the literals of the math: 1::0 = 0, 2::1 = 2, 6::3 = 18, 9::8 = 44', () => {
    expect(meshOf(1, 0)).toBe(0)
    expect(meshOf(2, 1)).toBe(2)
    expect(meshOf(6, 3)).toBe(18)
    expect(meshOf(9, 8)).toBe(44)
    expect(meshOf(8, 9)).toBe(44) // order-normalizing
    expect(netSpanOf(44)).toEqual([9, 8])
    expect(netSpanOf(0)).toEqual([1, 0])
  })

  it('is exact at the very last mesh of base 2^26 (8 * mesh + 1 no longer fits in 2^53 there)', () => {
    expect(8 * LAST_MESH + 1).toBeGreaterThan(2 ** 53) // the reason a bare float square root cannot be trusted
    expect(meshOf(CAP - 1, CAP - 2)).toBe(LAST_MESH)
    expect(netSpanOf(LAST_MESH)).toEqual([67108863, 67108862])
    expect(netSpanOf(LAST_MESH - 1)).toEqual([67108863, 67108861])
    expect(netSpanOf(LAST_MESH - (CAP - 2))).toEqual([CAP - 1, 0]) // first demon of the last row
    expect(netSpanOf(LAST_MESH - (CAP - 1))).toEqual([CAP - 2, CAP - 3]) // last demon of the row before
    expect(meshOf(CAP - 1, 0)).toBe(LAST_MESH - (CAP - 2))
  })

  it('is one below the demon count at the last mesh and refuses the count itself', () => {
    expect(LAST_MESH + 1).toBe(COUNT_AT_CAP)
    expect(() => netSpanOf(COUNT_AT_CAP)).toThrow(RangeError)
  })

  it('is right at every triangular boundary: the first and last demon of each row a = 1..3000', () => {
    for (let a = 1; a <= 3000; a++) {
      const first = (a * (a - 1)) / 2
      expect(netSpanOf(first)).toEqual([a, 0])
      expect(netSpanOf(first + a - 1)).toEqual([a, a - 1])
      expect(meshOf(a, 0)).toBe(first)
      expect(meshOf(a, a - 1)).toBe(first + a - 1)
    }
  })

  it('is right around every power of two and near the 2^53 crossing of 8 * mesh + 1 (about a = 47453133)', () => {
    const rows = new Set<number>()
    for (let k = 1; k <= 26; k++) for (const d of [-2, -1, 0, 1]) rows.add(2 ** k + d)
    for (let a = 47_453_120; a <= 47_453_145; a++) rows.add(a)
    for (let a = CAP - 64; a < CAP; a++) rows.add(a)
    let checked = 0
    for (const a of rows) {
      if (a < 1 || a > CAP - 1) continue
      for (const b of new Set([0, 1, 2, Math.floor(a / 2), a - 3, a - 2, a - 1])) {
        if (b < 0 || b >= a) continue
        const m = meshOf(a, b)
        expect(netSpanOf(m), `${a}::${b}`).toEqual([a, b])
        expect(exactNetSpan(m), `${a}::${b} by BigInt`).toEqual([a, b])
        checked++
      }
    }
    expect(checked).toBeGreaterThan(400)
  })

  it('walks the first 300,000 meshes one by one and crosses the row boundaries near the top exactly', () => {
    let a = 1
    let b = 0
    for (let m = 0; m < 300_000; m++) {
      const got = netSpanOf(m)
      if (got[0] !== a || got[1] !== b) expect(got, `mesh ${m}`).toEqual([a, b])
      b++
      if (b === a) {
        a++
        b = 0
      }
    }
    // Every row start within 6 meshes, for the last 40 rows and for the rows around the 2^53 crossing of 8 * mesh + 1.
    const rows: number[] = []
    for (let row = CAP - 40; row < CAP; row++) rows.push(row)
    for (let row = 47_453_100; row <= 47_453_160; row++) rows.push(row)
    let crossed = 0
    for (const row of rows) {
      const start = (row * (row - 1)) / 2
      for (let m = Math.max(0, start - 6); m <= start + 6; m++) {
        expect(netSpanOf(m), `mesh ${m}`).toEqual(exactNetSpan(m))
        crossed++
      }
    }
    expect(crossed).toBe(rows.length * 13)
  })

  // On V8 the bare estimate floor((1 + sqrt(8m + 1)) / 2) happens to be exact for every row of every base up to 2^26
  // (checked by brute force over all 2^26 - 1 rows at both ends of the row, and rounding is monotone), so the integer
  // correction loops never fire there. They are what makes the result exact on ANY runtime whose square root is a step
  // or two off, so this test forces that case: Math.sqrt is replaced by a wrong one and the answers must not change.
  it('stays exact when the float square root is wrong by up to 40 rows (the integer loops, not the estimate, decide)', () => {
    const rows = [1, 2, 3, 4, 5, 10, 100, 65_536, 2 ** 24, 47_453_132, 47_453_133, 47_453_134, 2 ** 25, CAP - 2, CAP - 1]
    const meshes: number[] = []
    for (const a of rows) {
      const first = (a * (a - 1)) / 2
      for (const m of [first - 1, first, first + 1, first + a - 2, first + a - 1, first + a]) {
        if (m >= 0 && m < COUNT_AT_CAP) meshes.push(m)
      }
    }
    const expected = meshes.map(exactNetSpan)
    const realSqrt = Math.sqrt
    const runs = new Map<number, (readonly [number, number])[]>()
    for (const delta of [-80, -3, -1.5, -0.6, 0.6, 1.5, 3, 80]) {
      const spy = vi.spyOn(Math, 'sqrt').mockImplementation(x => realSqrt(x) + delta)
      try {
        runs.set(delta, meshes.map(m => netSpanOf(m)))
      } finally {
        spy.mockRestore()
      }
    }
    expect(Math.sqrt).toBe(realSqrt) // restored
    expect(runs.size).toBe(8)
    for (const [delta, got] of runs) expect(got, `sqrt off by ${delta}`).toEqual(expected)
  })

  it('round-trips netSpanOf(meshOf(a, b)) for a > b < 2^26 (fixed seed 20261003)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: CAP - 1 }).chain(a => fc.tuple(fc.constant(a), fc.integer({ min: 0, max: a - 1 }))),
        ([a, b]) => {
          const m = meshOf(a, b)
          expect(m).toBeGreaterThanOrEqual(0)
          expect(m).toBeLessThan(COUNT_AT_CAP)
          expect(netSpanOf(m)).toEqual([a, b])
        },
      ),
      { seed: 20261003, numRuns: 10_000 },
    )
  })

  it('round-trips meshOf(...netSpanOf(m)) and agrees with a BigInt bisection for 0 <= m < 2251799780130816 (fixed seed 20261004)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: COUNT_AT_CAP - 1 }), m => {
        const [a, b] = netSpanOf(m)
        expect(a).toBeGreaterThan(b)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(meshOf(a, b)).toBe(m)
        expect([a, b]).toEqual(exactNetSpan(m))
      }),
      { seed: 20261004, numRuns: 10_000 },
    )
  })

  it('throws RangeError for equal zones, negatives, fractions, zones at or above 2^26 and meshes outside the space', () => {
    expect(() => meshOf(3, 3)).toThrow(RangeError)
    expect(() => meshOf(-1, 0)).toThrow(RangeError)
    expect(() => meshOf(1.5, 0)).toThrow(RangeError)
    expect(() => meshOf(0, 2.5)).toThrow(RangeError)
    expect(() => meshOf(67108864, 0)).toThrow(RangeError)
    expect(() => netSpanOf(-1)).toThrow(RangeError)
    expect(() => netSpanOf(0.5)).toThrow(RangeError)
    expect(() => netSpanOf(2251799780130816)).toThrow(RangeError)
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 60]) {
      expect(() => meshOf(bad, 0), `meshOf(${bad}, 0)`).toThrow(RangeError)
      expect(() => meshOf(1, bad), `meshOf(1, ${bad})`).toThrow(RangeError)
      expect(() => netSpanOf(bad), `netSpanOf(${bad})`).toThrow(RangeError)
    }
    for (const bad of ['3', null, undefined, {}, 10n] as unknown[]) {
      expect(() => meshOf(bad as number, 0)).toThrow(RangeError)
      expect(() => netSpanOf(bad as number)).toThrow(RangeError)
    }
  })

  it('never returns a negative zero', () => {
    expect(Object.is(meshOf(-0, 1), 0)).toBe(true)
    expect(Object.is(netSpanOf(-0)[1], 0)).toBe(true)
    const d = createNumogram(10).demons.ref(-0, 1)
    expect(Object.is(d.b, 0)).toBe(true)
    expect(Object.is(d.mesh, 0)).toBe(true)
  })

  it('exports meshOf and netSpanOf from the barrel but not createDemonSpace', () => {
    expect(typeof engine.meshOf).toBe('function')
    expect(typeof engine.netSpanOf).toBe('function')
    expect('createDemonSpace' in engine).toBe(false)
  })
})

describe('base 10 demon space', () => {
  const g = createNumogram(10)
  const demons = g.demons

  it('is lazy, cached per numogram and frozen', () => {
    expect(g.demons).toBe(demons)
    expect(Object.isFrozen(demons)).toBe(true)
    expect(demons.base).toBe(10)
    expect(createNumogram(12).demons).not.toBe(demons)
  })

  it('has 45 demons and 4 Numodemons', () => {
    expect(demons.count).toBe(45)
    expect(demons.numodemonCount).toBe(4)
  })

  it('classifies the named demons', () => {
    const named: [number, number, number, DemonSubtype][] = [
      [0, 1, 0, 'plex-amphi'],
      [14, 5, 4, 'syzygetic-chrono'],
      [18, 6, 3, 'syzygetic-xeno'],
      [36, 9, 0, 'syzygetic-xeno'],
      [44, 9, 8, 'plex-amphi'],
    ]
    for (const [mesh, a, b, subtype] of named) {
      const d = demons.at(mesh)
      expect(d.mesh).toBe(mesh)
      expect([d.a, d.b], `mesh ${mesh}`).toEqual([a, b])
      expect(d.subtype, `mesh ${mesh}`).toBe(subtype)
    }
  })

  it('reports counts() as [12, 0, 3, 12, 12, 4, 2] in DEMON_SUBTYPES order and typeCounts() as 15 / 24 / 6', () => {
    expect(Object.keys(demons.counts())).toEqual([...DEMON_SUBTYPES])
    expect(countsOf(10)).toEqual([12, 0, 3, 12, 12, 4, 2])
    expect(demons.counts()).toEqual({
      'cyclic-chrono': 12,
      'cross-torque-chrono': 0,
      'syzygetic-chrono': 3,
      'plex-amphi': 12,
      'warp-amphi': 12,
      'chaotic-xeno': 4,
      'syzygetic-xeno': 2,
    })
    expect(Object.keys(demons.typeCounts())).toEqual([...DEMON_TYPES])
    expect(demons.typeCounts()).toEqual({ chrono: 15, amphi: 24, xeno: 6 })
  })

  it('memoizes frozen count objects', () => {
    expect(demons.counts()).toBe(demons.counts())
    expect(demons.typeCounts()).toBe(demons.typeCounts())
    expect(Object.isFrozen(demons.counts())).toBe(true)
    expect(Object.isFrozen(demons.typeCounts())).toBe(true)
  })

  it('lists the four Numodemons 9::1, 8::2, 7::3, 6::4 (b ascending) and flags them', () => {
    const list = Array.from(demons.numodemons())
    expect(list.map(d => [d.a, d.b])).toEqual([[9, 1], [8, 2], [7, 3], [6, 4]])
    expect(list.every(d => d.numodemon && !d.syzygetic)).toBe(true)
    expect(list).toHaveLength(demons.numodemonCount)
    // all other demons are not Numodemons
    let numodemons = 0
    for (let m = 0; m < demons.count; m++) if (demons.at(m).numodemon) numodemons++
    expect(numodemons).toBe(4)
  })

  it('lists the 9 demons incident to zone 0 with the other zone running 1..9, and re-iterates', () => {
    const list = Array.from(demons.incident(0))
    expect(list.map(d => d.a)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(list.every(d => d.b === 0)).toBe(true)
    const iterable = demons.incident(5)
    const other = (d: DemonRef): number => (d.a === 5 ? d.b : d.a)
    expect(Array.from(iterable).map(other)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9])
    expect(Array.from(iterable).map(other)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9]) // a second pass works
  })

  it('ref(a, b) is order-normalizing and equals at(meshOf(...))', () => {
    expect(demons.ref(3, 8)).toEqual(demons.at(meshOf(8, 3)))
    expect(demons.ref(8, 3)).toEqual(demons.at(meshOf(8, 3)))
    expect(demons.ref(8, 3).a).toBe(8)
  })

  it('reports the cycle ids of both zones, equal to g.cycleOfZone(z).id, and the mesh, for all 45 demons', () => {
    let seen = 0
    for (let m = 0; m < demons.count; m++) {
      const d = demons.at(m)
      expect(d.mesh).toBe(m)
      expect(d.cycleA, `mesh ${m}`).toBe(g.cycleOfZone(d.a).id)
      expect(d.cycleB, `mesh ${m}`).toBe(g.cycleOfZone(d.b).id)
      expect(d.syzygetic).toBe(d.a + d.b === 9)
      expect(meshOf(d.a, d.b)).toBe(m)
      seen++
    }
    expect(seen).toBe(45)
  })

  it('returns frozen demon values', () => {
    expect(Object.isFrozen(demons.at(0))).toBe(true)
    expect(Object.isFrozen(demons.ref(4, 2))).toBe(true)
    expect(Object.isFrozen(demons.netSpanOf(5))).toBe(true)
  })

  it('has the same meshOf and netSpanOf as the standalone functions, plus base range checks', () => {
    expect(demons.meshOf(9, 8)).toBe(44)
    expect(demons.meshOf(8, 9)).toBe(44)
    expect(demons.netSpanOf(44)).toEqual([9, 8])
    expect(() => demons.meshOf(10, 0)).toThrow(RangeError)
    expect(() => demons.meshOf(3, 3)).toThrow(RangeError)
    expect(() => demons.netSpanOf(45)).toThrow(RangeError)
    expect(() => demons.netSpanOf(-1)).toThrow(RangeError)
  })

  it('throws RangeError for meshes and zones outside the base, before iterating', () => {
    expect(() => demons.at(45)).toThrow(RangeError)
    expect(() => demons.at(-1)).toThrow(RangeError)
    expect(() => demons.at(1.5)).toThrow(RangeError)
    expect(() => demons.ref(10, 0)).toThrow(RangeError)
    expect(() => demons.ref(3, 3)).toThrow(RangeError)
    expect(() => demons.ref(-1, 2)).toThrow(RangeError)
    expect(() => demons.incident(10)).toThrow(RangeError) // eager: the call throws, not the first next()
    expect(() => demons.incident(-1)).toThrow(RangeError)
    expect(() => demons.incident(0.5)).toThrow(RangeError)
  })
})

describe('base 2 demon space', () => {
  const demons = createNumogram(2).demons
  it('has one demon, 1::0, a syzygetic xenodemon, and no Numodemon', () => {
    expect(demons.count).toBe(1)
    expect(demons.numodemonCount).toBe(0)
    const d = demons.at(0)
    expect([d.a, d.b, d.mesh]).toEqual([1, 0, 0])
    expect(d.subtype).toBe('syzygetic-xeno')
    expect(d.type).toBe('xeno')
    expect(d.syzygetic).toBe(true)
    expect(d.numodemon).toBe(false)
    expect(Array.from(demons.numodemons())).toEqual([])
    expect(countsOf(2)).toEqual([0, 0, 0, 0, 0, 0, 1])
    expect(demons.typeCounts()).toEqual({ chrono: 0, amphi: 0, xeno: 1 })
  })
})

describe('closed-form counts for the verified bases', () => {
  const verified: [number, number[]][] = [
    [2, [0, 0, 0, 0, 0, 0, 1]],
    [4, [0, 0, 0, 0, 0, 4, 2]],
    [10, [12, 0, 3, 12, 12, 4, 2]],
    [12, [40, 0, 5, 20, 0, 0, 1]],
    [16, [28, 32, 6, 24, 24, 4, 2]],
    [28, [156, 108, 12, 48, 48, 4, 2]],
    [82, [1560, 1404, 39, 156, 156, 4, 2]],
  ]
  for (const [base, vector] of verified) {
    it(`base ${base} counts ${JSON.stringify(vector)} and they sum to C(n, 2)`, () => {
      expect(countsOf(base)).toEqual(vector)
      expect(sum(vector)).toBe((base * (base - 1)) / 2)
      expect(createNumogram(base).demons.count).toBe((base * (base - 1)) / 2)
    })
  }

  it('base 28 has 378 demons, 108 of them cross-Torque chronodemons', () => {
    expect(countsOf(28)).toEqual([156, 108, 12, 48, 48, 4, 2])
    const demons = createNumogram(28).demons
    expect(demons.count).toBe(378)
    expect(demons.counts()['cross-torque-chrono']).toBe(108)
  })

  it('base 28: two zones in different Torque cycles make a cross-Torque chronodemon, the same cycle a cyclic one', () => {
    const g = createNumogram(28)
    const [first, second] = g.torques
    if (first === undefined || second === undefined) throw new Error('base 28 has two Torque cycles')
    const inFirst = first.zoneAt(0)
    const alsoInFirst = first.zoneAt(2)
    const partnerInFirst = first.zoneAt(1)
    const inSecond = second.zoneAt(0)
    const cross = g.demons.ref(inFirst, inSecond)
    expect(cross.subtype).toBe('cross-torque-chrono')
    expect(cross.type).toBe('chrono')
    expect(cross.syzygetic).toBe(false)
    expect(cross.cycleA === cross.cycleB).toBe(false)
    expect(g.demons.ref(inFirst, alsoInFirst).subtype).toBe('cyclic-chrono')
    expect(g.demons.ref(inFirst, partnerInFirst).subtype).toBe('syzygetic-chrono')
    expect(g.demons.ref(inFirst, partnerInFirst).syzygetic).toBe(true)
  })

  it('counts always sum to the demon count and the type counts equal the subtype sums, for every even n up to 130', () => {
    for (let n = 2; n <= 130; n += 2) {
      const d = createNumogram(n).demons
      const c = d.counts()
      const total = sum(DEMON_SUBTYPES.map(s => c[s]))
      expect(total, `base ${n}`).toBe(d.count)
      const t = d.typeCounts()
      expect(t.chrono, `base ${n} chrono`).toBe(c['cyclic-chrono'] + c['cross-torque-chrono'] + c['syzygetic-chrono'])
      expect(t.amphi, `base ${n} amphi`).toBe(c['plex-amphi'] + c['warp-amphi'])
      expect(t.xeno, `base ${n} xeno`).toBe(c['chaotic-xeno'] + c['syzygetic-xeno'])
      expect(d.numodemonCount, `base ${n}`).toBe(n / 2 - 1)
    }
  })
})
