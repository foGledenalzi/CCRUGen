// createNumogram (ENG-01, ENG-02, D-13, D-14): literals for bases 2, 4, 6, 10 and 12, argument validation, immutability
// and the bounded cache. The sweep against the independent reference lives in structure.sweep.test.ts.
import { beforeEach, describe, expect, it } from 'vitest'
import * as engine from '../index'
import { clearNumogramCache, createNumogram, NUMOGRAM_CACHE_LIMITS } from '../index'
import type { Cycle, Numogram } from '../index'
import { numogramInternals } from '../core/numogram'

const pairsOf = (c: Cycle): number[] => Array.from(c.pairs())
const zonesOf = (c: Cycle): number[] => Array.from(c.zones())
const gatesOf = (g: Numogram): number[] => Array.from({ length: g.base }, (_, k) => g.gate(k).to)

beforeEach(() => {
  clearNumogramCache()
})

describe('base 10 (the canonical numogram)', () => {
  const g = createNumogram(10)

  it('has 10 zones, 5 pairs and three regions', () => {
    expect(g.base).toBe(10)
    expect(g.zoneCount).toBe(10)
    expect(g.pairCount).toBe(5)
    expect(g.cycleCount).toBe(3)
    expect(g.torqueCount).toBe(1)
    expect(g.cycles).toHaveLength(3)
    expect(g.torques).toHaveLength(1)
    expect(g.storageBytes).toBeGreaterThan(0)
  })

  it('lists the cycles as Torque, Plex, Warp in canonical order', () => {
    expect(g.cycles.map(c => c.kind)).toEqual(['torque', 'plex', 'warp'])
    expect(g.cycles.map(pairsOf)).toEqual([[1, 2, 4], [0], [3]])
    expect(g.cycles.map(zonesOf)).toEqual([[1, 8, 7, 2, 5, 4], [9, 0], [3, 6]])
    expect(g.cycles.map(c => c.torqueIndex)).toEqual([0, -1, -1])
    expect(g.cycles.map(c => c.lengthInPairs)).toEqual([3, 1, 1])
    expect(g.cycles.map(c => c.zoneCount)).toEqual([6, 2, 2])
    expect(g.cycles.map(c => c.firstPair)).toEqual([1, 0, 3])
    expect(g.cycles.map(c => c.id)).toEqual([0, 1, 2])
  })

  it('exposes torques, plex and warp as views of the same cycles', () => {
    expect(g.torques.map(c => c.id)).toEqual([0])
    expect(g.plex.id).toBe(1)
    expect(g.plex.kind).toBe('plex')
    expect(g.warp?.id).toBe(2)
    expect(g.warp?.kind).toBe('warp')
    expect(g.cycles[1]).toBe(g.plex)
    expect(g.cycles[2]).toBe(g.warp)
  })

  it('walks the Torque cycle as 1, 8, 7, 2, 5, 4 by zoneAt and pairAt', () => {
    const torque = g.cycles[0]
    expect(torque).toBeDefined()
    if (torque === undefined) return
    expect(Array.from({ length: 6 }, (_, i) => torque.zoneAt(i))).toEqual([1, 8, 7, 2, 5, 4])
    expect(Array.from({ length: 3 }, (_, i) => torque.pairAt(i))).toEqual([1, 2, 4])
  })

  it('reports every zone region', () => {
    const kinds = Array.from({ length: 10 }, (_, z) => g.cycleOfZone(z).kind)
    expect(kinds).toEqual(['plex', 'torque', 'torque', 'warp', 'torque', 'torque', 'warp', 'torque', 'torque', 'plex'])
    expect(g.cycleOfPair(1).id).toBe(0)
    expect(g.cycleOfPair(0).id).toBe(1)
    expect(g.cycleOfPair(3).id).toBe(2)
  })

  it('pairs zones by partner and pairOf (lo + hi = 9)', () => {
    expect(Array.from({ length: 10 }, (_, z) => g.partner(z))).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
    expect(Array.from({ length: 10 }, (_, z) => g.pairOf(z))).toEqual([0, 1, 2, 3, 4, 4, 3, 2, 1, 0])
    expect(g.pair(1)).toEqual({ id: 1, lo: 1, hi: 8, odd: 1, even: 8 })
    expect(g.pair(0)).toEqual({ id: 0, lo: 0, hi: 9, odd: 9, even: 0 })
    expect(g.pair(4)).toEqual({ id: 4, lo: 4, hi: 5, odd: 5, even: 4 })
  })

  it('flows each current to hi - lo and each pair to the next pair', () => {
    expect(g.current(1)).toEqual({ pair: 1, lo: 1, hi: 8, to: 7 })
    expect(g.current(2).to).toBe(5)
    expect(g.current(4).to).toBe(1)
    expect(g.current(3).to).toBe(3)
    expect(g.current(0).to).toBe(9)
    expect(g.nextPair(1)).toBe(2)
    expect(g.nextPair(2)).toBe(4)
    expect(g.nextPair(4)).toBe(1)
    expect(g.nextPair(0)).toBe(0)
    expect(g.nextPair(3)).toBe(3)
  })

  it('computes the gates in the base itself (never a decimal digit sum)', () => {
    expect(gatesOf(g)).toEqual([0, 1, 3, 6, 1, 6, 3, 1, 9, 9])
    expect(g.gate(5)).toEqual({ from: 5, to: 6, cumulation: 15 }) // Gt-15
    expect(g.gate(2)).toEqual({ from: 2, to: 3, cumulation: 3 }) // Gt-03
    expect(g.gate(0)).toEqual({ from: 0, to: 0, cumulation: 0 })
  })
})

describe('other literal bases', () => {
  it('base 2: only the Plex', () => {
    const g = createNumogram(2)
    expect(g.pairCount).toBe(1)
    expect(g.cycleCount).toBe(1)
    expect(g.cycles.map(c => c.kind)).toEqual(['plex'])
    expect(g.cycles.map(pairsOf)).toEqual([[0]])
    expect(g.cycles.map(zonesOf)).toEqual([[1, 0]])
    expect(g.warp).toBeNull()
    expect(g.torqueCount).toBe(0)
    expect(g.torques).toEqual([])
    expect(gatesOf(g)).toEqual([0, 1])
  })

  it('base 4: Plex then Warp, no Torque', () => {
    const g = createNumogram(4)
    expect(g.cycles.map(c => c.kind)).toEqual(['plex', 'warp'])
    expect(g.cycles.map(pairsOf)).toEqual([[0], [1]])
    expect(g.warp?.firstPair).toBe(1)
    expect(g.torqueCount).toBe(0)
    expect(gatesOf(g)).toEqual([0, 1, 3, 3])
  })

  it('base 6: one Torque of two pairs and the Plex', () => {
    const g = createNumogram(6)
    expect(g.cycles.map(c => c.kind)).toEqual(['torque', 'plex'])
    expect(g.cycles.map(pairsOf)).toEqual([[1, 2], [0]])
    expect(g.warp).toBeNull()
    expect(g.torqueCount).toBe(1)
  })

  it('base 12: one Torque [1, 2, 4, 3, 5], the Plex, no Warp', () => {
    const g = createNumogram(12)
    expect(g.cycles.map(c => c.kind)).toEqual(['torque', 'plex'])
    expect(g.cycles.map(pairsOf)).toEqual([[1, 2, 4, 3, 5], [0]])
    expect(g.warp).toBeNull()
    expect(g.gate(11)).toEqual({ from: 11, to: 11, cumulation: 66 })
  })

  it('base 16: two Torques (lengths 4 and 2) plus the Plex', () => {
    const g = createNumogram(16)
    expect(g.torqueCount).toBe(2)
    expect(g.torques.map(c => c.lengthInPairs)).toEqual([4, 2])
    expect(g.torques.map(c => c.torqueIndex)).toEqual([0, 1])
    expect(g.torques.map(pairsOf)).toEqual([[1, 2, 4, 7], [3, 6]])
    expect(g.warp?.firstPair).toBe(5)
  })
})

describe('argument validation (RangeError)', () => {
  const badBases: readonly unknown[] = [11, 0, -2, 10.5, NaN, Infinity, 2 ** 26 + 2]
  for (const base of badBases) {
    it(`createNumogram(${String(base)}) throws RangeError`, () => {
      expect(() => createNumogram(base as number)).toThrow(RangeError)
    })
  }

  it('refuses a non-number base without allocating', () => {
    for (const bad of ['10', null, undefined, 10n, {}, [10]] as readonly unknown[]) {
      expect(() => createNumogram(bad as number)).toThrow(RangeError)
    }
  })

  it('checks every index argument on a base-10 numogram', () => {
    const g = createNumogram(10)
    expect(() => g.pair(5)).toThrow(RangeError)
    expect(() => g.pair(-1)).toThrow(RangeError)
    expect(() => g.partner(10)).toThrow(RangeError)
    expect(() => g.pairOf(10)).toThrow(RangeError)
    expect(() => g.gate(-1)).toThrow(RangeError)
    expect(() => g.gate(10)).toThrow(RangeError)
    expect(() => g.cycleAt(3)).toThrow(RangeError)
    expect(() => g.cycleAt(-1)).toThrow(RangeError)
    expect(() => g.cycleOfZone(1.5)).toThrow(RangeError)
    expect(() => g.cycleOfZone(NaN)).toThrow(RangeError)
    expect(() => g.cycleOfPair(5)).toThrow(RangeError)
    expect(() => g.current(5)).toThrow(RangeError)
    expect(() => g.nextPair(5)).toThrow(RangeError)
    const torque = g.cycles[0]
    expect(torque).toBeDefined()
    if (torque === undefined) return
    expect(() => torque.pairAt(3)).toThrow(RangeError)
    expect(() => torque.pairAt(-1)).toThrow(RangeError)
    expect(() => torque.zoneAt(6)).toThrow(RangeError)
    expect(() => torque.zoneAt(0.5)).toThrow(RangeError)
  })

  it('names the argument and the valid range in the message', () => {
    const g = createNumogram(10)
    expect(() => g.pair(5)).toThrow(/pair id 5.*0 to 4/)
    expect(() => g.gate(10)).toThrow(/zone 10.*0 to 9/)
  })
})

describe('immutability', () => {
  it('freezes the numogram, its cycle list and each cycle', () => {
    const g = createNumogram(10)
    expect(Object.isFrozen(g)).toBe(true)
    expect(Object.isFrozen(g.cycles)).toBe(true)
    expect(Object.isFrozen(g.torques)).toBe(true)
    expect(Object.isFrozen(g.cycles[0])).toBe(true)
    expect(Object.isFrozen(g.plex)).toBe(true)
    expect(Object.isFrozen(g.cycleAt(0))).toBe(true)
  })

  it('throws TypeError on assignment to a frozen numogram', () => {
    const g = createNumogram(10)
    expect(() => {
      ;(g as { base: number }).base = 12
    }).toThrow(TypeError)
    expect(() => {
      ;(g as unknown as { extra: number }).extra = 1
    }).toThrow(TypeError)
    expect(() => {
      ;(g.cycles as Cycle[]).push(g.plex)
    }).toThrow(TypeError)
    expect(g.base).toBe(10)
  })

  it('hands out copies from pairs() and zones()', () => {
    const g = createNumogram(10)
    const torque = g.cycleAt(0)
    const before = pairsOf(torque)
    const mutated = torque.pairs()
    mutated.fill(7)
    expect(pairsOf(torque)).toEqual(before)
    const zones = torque.zones()
    zones.fill(0)
    expect(zonesOf(torque)).toEqual([1, 8, 7, 2, 5, 4])
  })

  it('keeps the same walk after the cycle list is materialized (views compare by id)', () => {
    clearNumogramCache()
    const g = createNumogram(10)
    const early = g.cycleAt(0) // a view made before g.cycles exists
    const list = g.cycles
    expect(list[0]?.id).toBe(early.id)
    expect(zonesOf(early)).toEqual(zonesOf(list[0] as Cycle))
    expect(g.cycleAt(0)).toBe(list[0])
  })

  it('keeps the typed arrays internal: only the engine internals accessor sees them', () => {
    const g = createNumogram(10)
    const s = numogramInternals(g)
    expect(s.torqueCount).toBe(1)
    expect(s.plexId).toBe(1)
    expect(s.warpId).toBe(2)
    expect(Array.from(s.first)).toEqual([1, 0, 3])
    expect(Array.from(s.length)).toEqual([3, 1, 1])
    expect(Array.from(s.offset)).toEqual([0, 3, 4])
    expect(Array.from(s.flow)).toEqual([1, 2, 4, 0, 3])
    expect(Array.from(s.pairCycle)).toEqual([1, 0, 0, 2, 0])
    expect(() => numogramInternals({} as Numogram)).toThrow(Error)
    expect('numogramInternals' in engine).toBe(false)
    expect(Object.keys(g)).not.toContain('flow')
    expect(Reflect.ownKeys(g).map(String).join(',')).not.toMatch(/flow|pairCycle/)
  })
})

describe('bounded cache', () => {
  it('returns the same object for the same base and a new one after clearNumogramCache', () => {
    const a = createNumogram(10)
    expect(createNumogram(10)).toBe(a)
    clearNumogramCache()
    const b = createNumogram(10)
    expect(b).not.toBe(a)
    expect(createNumogram(10)).toBe(b)
  })

  it('keeps at most 4 entries: creating 10, 12, 14, 16, 18 in turn evicts 10 but not 18', () => {
    const ten = createNumogram(10)
    createNumogram(12)
    createNumogram(14)
    createNumogram(16)
    const eighteen = createNumogram(18)
    expect(createNumogram(18)).toBe(eighteen)
    expect(createNumogram(10)).not.toBe(ten)
  })

  it('is a least-recently-used cache: a hit protects the entry from eviction', () => {
    const ten = createNumogram(10)
    const twelve = createNumogram(12)
    createNumogram(14)
    createNumogram(16)
    expect(createNumogram(10)).toBe(ten) // hit: 10 becomes the most recent
    createNumogram(18) // evicts the oldest, which is now 12
    expect(createNumogram(10)).toBe(ten)
    expect(createNumogram(12)).not.toBe(twelve)
  })

  it('publishes its limits', () => {
    expect(NUMOGRAM_CACHE_LIMITS).toEqual({ entries: 4, zones: 67108864 })
    expect(Object.isFrozen(NUMOGRAM_CACHE_LIMITS)).toBe(true)
  })

  it('does not cache a refused base', () => {
    const ten = createNumogram(10)
    expect(() => createNumogram(11)).toThrow(RangeError)
    expect(createNumogram(10)).toBe(ten)
  })
})
