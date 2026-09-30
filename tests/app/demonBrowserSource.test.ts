// Tests for app/lib/demonBrowser.ts's row sources, sort, rank-of-demon and window paging (DEM-02). Base 28 is
// exercised exhaustively (378 demons x 11 filters x 2 sort keys x 2 directions is cheap); base 666 and the 2^26
// demon count are used only to prove boundedness, never enumerated. Counting wrappers prove no selector call chain
// materializes more than a handful of demons (T-05-02, T-05-17).
import { describe, expect, it } from 'vitest'
import { createNumogram, DEMON_SUBTYPES, DEMON_TYPES, type DemonRef } from '../../engine/index'
import {
  BROWSER_WINDOW_ROWS,
  DEFAULT_DEMON_SORT,
  ROW_HEIGHT_PX,
  concatSources,
  filterContains,
  incidentSource,
  orderedSource,
  rankOf,
  rankOfMesh,
  rowSourceFor,
  singleSource,
  windowAt,
  windowCount,
  windowFor,
  type DemonFilter,
  type DemonRowSource,
  type DemonSort,
  type DemonSortKey,
  type SortDirection,
} from '../../app/lib/demonBrowser'

const FILTERS: readonly (DemonFilter | null)[] = [null, ...DEMON_TYPES, ...DEMON_SUBTYPES]
const SORT_KEYS: readonly DemonSortKey[] = ['mesh', 'type']
const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc']

function countingSource(source: DemonRowSource): { wrapped: DemonRowSource; calls: () => number } {
  let calls = 0
  return {
    wrapped: {
      count: source.count,
      at(k: number): DemonRef {
        calls++
        return source.at(k)
      },
    },
    calls: () => calls,
  }
}

describe('BROWSER_WINDOW_ROWS / ROW_HEIGHT_PX', () => {
  it('are the documented constants', () => {
    expect(BROWSER_WINDOW_ROWS).toBe(250_000)
    expect(ROW_HEIGHT_PX).toBe(22)
  })
})

describe('rowSourceFor (mesh key): identity with the engine selections', () => {
  it('null, a type and a subtype return the exact same object the engine returns', () => {
    const g28 = createNumogram(28)
    expect(rowSourceFor(g28, null, 'mesh')).toBe(g28.demons)
    expect(rowSourceFor(g28, 'chrono', 'mesh')).toBe(g28.demons.group('chrono'))
    expect(rowSourceFor(g28, 'cross-torque-chrono', 'mesh')).toBe(g28.demons.subtype('cross-torque-chrono'))
  })
})

describe('rowSourceFor (type key): grouped by subtype, subtypes in SUBTYPES_OF order', () => {
  it('null: the full 378-demon space sorted by (subtype order, mesh), matching a brute-force stable sort', () => {
    const g28 = createNumogram(28)
    const brute = Array.from({ length: g28.demons.count }, (_, m) => g28.demons.at(m)).sort((x, y) => {
      const byType = DEMON_SUBTYPES.indexOf(x.subtype) - DEMON_SUBTYPES.indexOf(y.subtype)
      return byType !== 0 ? byType : x.mesh - y.mesh
    })
    const source = rowSourceFor(g28, null, 'type')
    expect(source.count).toBe(378)
    for (let k = 0; k < source.count; k++) {
      expect(source.at(k)).toEqual(brute[k])
    }
  })

  it('a type: only that type\'s subtypes, in SUBTYPES_OF order', () => {
    const g28 = createNumogram(28)
    const source = rowSourceFor(g28, 'chrono', 'type')
    expect(source.count).toBe(276)
    for (let k = 0; k < source.count; k++) {
      const d = source.at(k)
      expect(d.type).toBe('chrono')
    }
    // subtype boundaries follow SUBTYPES_OF.chrono = [cyclic, cross-torque, syzygetic] order
    const cyclicCount = g28.demons.subtype('cyclic-chrono').count
    const crossCount = g28.demons.subtype('cross-torque-chrono').count
    expect(source.at(0).subtype).toBe('cyclic-chrono')
    expect(source.at(cyclicCount - 1).subtype).toBe('cyclic-chrono')
    expect(source.at(cyclicCount).subtype).toBe('cross-torque-chrono')
    expect(source.at(cyclicCount + crossCount).subtype).toBe('syzygetic-chrono')
  })

  it('a subtype: the same sequence as its mesh-key source (single-part concat degenerates to the selection itself)', () => {
    const g28 = createNumogram(28)
    const meshSource = rowSourceFor(g28, 'plex-amphi', 'mesh')
    const typeSource = rowSourceFor(g28, 'plex-amphi', 'type')
    expect(typeSource.count).toBe(meshSource.count)
    for (let k = 0; k < typeSource.count; k++) {
      expect(typeSource.at(k)).toEqual(meshSource.at(k))
    }
  })
})

describe('orderedSource', () => {
  it('desc reverses index arithmetic only; asc returns the same object', () => {
    const g28 = createNumogram(28)
    const s = g28.demons
    expect(orderedSource(s, 'asc')).toBe(s)
    const desc = orderedSource(s, 'desc')
    expect(desc.at(0)).toEqual(s.at(s.count - 1))
    expect(desc.at(s.count - 1)).toEqual(s.at(0))
  })
})

describe('concatSources', () => {
  it('throws RangeError for out-of-range or non-integer indices', () => {
    const g28 = createNumogram(28)
    const combined = concatSources(DEMON_SUBTYPES.map(s => g28.demons.subtype(s)))
    expect(() => combined.at(-1)).toThrow(RangeError)
    expect(() => combined.at(combined.count)).toThrow(RangeError)
    expect(() => combined.at(1.5)).toThrow(RangeError)
    expect(() => combined.at(NaN)).toThrow(RangeError)
  })

  it('makes exactly one underlying at() call per at(k), across 7 counting wrappers', () => {
    const g28 = createNumogram(28)
    const wrappers = DEMON_SUBTYPES.map(s => countingSource(g28.demons.subtype(s)))
    const combined = concatSources(wrappers.map(w => w.wrapped))
    for (const k of [0, 1, combined.count - 1, Math.floor(combined.count / 2)]) {
      combined.at(k)
    }
    const totalCalls = wrappers.reduce((sum, w) => sum + w.calls(), 0)
    expect(totalCalls).toBe(4)
  })
})

describe('incidentSource', () => {
  it('base 28, zone 12: count 27, matches g.demons.incident(12) element-for-element', () => {
    const g28 = createNumogram(28)
    const expected = [...g28.demons.incident(12)]
    const source = incidentSource(g28, 12)
    expect(source.count).toBe(27)
    for (let k = 0; k < source.count; k++) {
      expect(source.at(k)).toEqual(expected[k])
    }
    expect(`${source.at(0).a}::${source.at(0).b}`).toBe('12::0')
    expect(`${source.at(12).a}::${source.at(12).b}`).toBe('13::12')
  })
})

describe('singleSource', () => {
  it('count 1, at(0) is the given demon by identity, RangeError for k = 1', () => {
    const g28 = createNumogram(28)
    const d = g28.demons.ref(12, 3)
    const source = singleSource(d)
    expect(source.count).toBe(1)
    expect(source.at(0)).toBe(d)
    expect(() => source.at(1)).toThrow(RangeError)
  })
})

describe('rankOfMesh', () => {
  it('matches a linear scan for every demon of base 28, under the mesh source of each of the 11 filters', () => {
    const g28 = createNumogram(28)
    for (const filter of FILTERS) {
      const source = rowSourceFor(g28, filter, 'mesh')
      const linear = new Map<number, number>()
      for (let k = 0; k < source.count; k++) linear.set(source.at(k).mesh, k)
      for (let m = 0; m < g28.demons.count; m++) {
        const d = g28.demons.at(m)
        if (!filterContains(filter, d)) continue
        expect(rankOfMesh(source, d.mesh)).toBe(linear.get(d.mesh))
      }
    }
  })

  it('is null for a mesh not present in the source', () => {
    const g28 = createNumogram(28)
    const chronoSource = rowSourceFor(g28, 'chrono', 'mesh')
    const amphiOnly = g28.demons.subtype('plex-amphi').at(0)
    expect(rankOfMesh(chronoSource, amphiOnly.mesh)).toBeNull()
  })
})

describe('rankOf', () => {
  it('every one of the 378 demons x 11 filters x 2 sort keys x 2 directions round-trips or is null', () => {
    const g28 = createNumogram(28)
    for (let m = 0; m < g28.demons.count; m++) {
      const d = g28.demons.at(m)
      for (const filter of FILTERS) {
        const contains = filterContains(filter, d)
        for (const key of SORT_KEYS) {
          for (const direction of DIRECTIONS) {
            const sort: DemonSort = { key, direction }
            const r = rankOf(g28, filter, sort, d)
            if (!contains) {
              expect(r).toBeNull()
              continue
            }
            expect(r).not.toBeNull()
            const source = orderedSource(rowSourceFor(g28, filter, key), direction)
            expect(source.at(r as number)).toEqual(d)
          }
        }
      }
    }
  })

  it('base 666: rankOf under the cross-torque-chrono facet round-trips mesh 108', () => {
    const g666 = createNumogram(666)
    const d = g666.demons.at(108)
    const r = rankOf(g666, 'cross-torque-chrono', DEFAULT_DEMON_SORT, d)
    expect(r).not.toBeNull()
    expect(rowSourceFor(g666, 'cross-torque-chrono', 'mesh').at(r as number).mesh).toBe(108)
  })
})

describe('materialization guards (T-05-02)', () => {
  it('rankOfMesh over a counting wrapper of the full base-666 space makes at most 20 at() calls', () => {
    const g666 = createNumogram(666)
    const { wrapped, calls } = countingSource(g666.demons)
    const rank = rankOfMesh(wrapped, 108)
    expect(rank).toBe(108)
    expect(calls()).toBeLessThanOrEqual(20)
  })

  it('orderedSource(wrapper, "desc").at(5) makes exactly 1 underlying at() call', () => {
    const g666 = createNumogram(666)
    const { wrapped, calls } = countingSource(g666.demons)
    orderedSource(wrapped, 'desc').at(5)
    expect(calls()).toBe(1)
  })
})

describe('windowCount / windowAt / windowFor', () => {
  it('exact boundary examples from the plan', () => {
    expect(windowFor(45, 44)).toEqual({ start: 0, size: 45, count: 45 })
    expect(windowFor(221445, 221444)).toEqual({ start: 0, size: 221445, count: 221445 })
    expect(windowFor(523776, 400000)).toEqual({ start: 250000, size: 250000, count: 523776 })
    expect(windowFor(523776, 523775)).toEqual({ start: 500000, size: 23776, count: 523776 })
    expect(windowCount(523776)).toBe(3)
    expect(windowCount(0)).toBe(1)
    expect(windowAt(523776, 2)).toEqual({ start: 500000, size: 23776, count: 523776 })
  })

  it('windowAt clamps pages below 0 and above the last page', () => {
    expect(windowAt(523776, -5)).toEqual(windowAt(523776, 0))
    expect(windowAt(523776, 999)).toEqual(windowAt(523776, windowCount(523776) - 1))
  })

  it('at the base-2^26 demon count, the window start stays a safe integer multiple of 250,000', () => {
    const count = (67108864 * 67108863) / 2
    expect(count).toBe(2251799780130816)
    const w = windowFor(count, count - 1)
    expect(Number.isSafeInteger(w.start)).toBe(true)
    expect(w.start % BROWSER_WINDOW_ROWS).toBe(0)
    expect(w.size).toBeGreaterThan(0)
    expect(w.size).toBeLessThanOrEqual(BROWSER_WINDOW_ROWS)
  })
})
