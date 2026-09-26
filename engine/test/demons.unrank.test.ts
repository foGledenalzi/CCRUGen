// ENG-03 (filtered access): g.demons.group(type) and g.demons.subtype(subtype) unrank the k-th demon of a type or subtype in
// ascending mesh order without enumerating demons, proven against the independent definitions-only reference
// (tests/bruteforce/numogramReference.ts, D-09, imported by relative path from this test only).
//   - base 10 and base 28 by hand-checkable literals and by the reference
//   - every even n from 2 to 64: for each of the 3 types and 7 subtypes, count equals typeCounts()/counts() and EVERY k equals
//     the k-th reference demon of that selector
//   - every even n from 66 to 300, and n = 666 and 1024: fixed-seed sampled ranks (plus the first and the last) equal the
//     reference (seeds 20261007 and 20261008, D-10)
//   - invalid ranks and invalid selector names are refused with a RangeError
// Blocks collect short mismatch strings and assert once per block (never one expect per demon). If a test here fails, the
// ENGINE is wrong, not the reference.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { refDemons, refStructure } from '../../tests/bruteforce/numogramReference'
import type { RefDemon } from '../../tests/bruteforce/numogramReference'
import { createNumogram, DEMON_SUBTYPES, DEMON_TYPES } from '../index'
import type { DemonSelection, DemonSpace, DemonSubtype, DemonType } from '../index'

type Selector = DemonType | DemonSubtype

const SELECTORS: readonly Selector[] = [...DEMON_TYPES, ...DEMON_SUBTYPES]
const MAX_NOTES = 20

const isType = (selector: Selector): selector is DemonType => (DEMON_TYPES as readonly string[]).includes(selector)

/** The engine selection for a type or a subtype name. */
function select(space: DemonSpace, selector: Selector): DemonSelection {
  return isType(selector) ? space.group(selector) : space.subtype(selector)
}

/** The reference demons of one selector, in the reference's enumeration order (= ascending mesh order). */
const membersOf = (all: readonly RefDemon[], selector: Selector): RefDemon[] =>
  all.filter(r => (isType(selector) ? r.type : r.subtype) === selector)

/** The closed-form count the selection must report. */
const expectedCount = (space: DemonSpace, selector: Selector): number =>
  isType(selector) ? space.typeCounts()[selector] : space.counts()[selector]

const span = (d: { readonly a: number; readonly b: number }): string => `${d.a}::${d.b}`

/** Every even n from lo to hi. */
function evenBases(lo: number, hi: number): number[] {
  const list: number[] = []
  for (let n = lo; n <= hi; n += 2) list.push(n)
  return list
}

/**
 * Compares the engine selection with the reference members for the given ranks (every rank when `ranks` is omitted).
 * Returns the number of ranks compared; pushes short notes on any mismatch.
 */
function checkSelection(
  n: number,
  space: DemonSpace,
  selector: Selector,
  members: readonly RefDemon[],
  notes: string[],
  ranks?: readonly number[],
): number {
  const note = (message: string): void => {
    if (notes.length < MAX_NOTES) notes.push(`n=${n} ${selector}: ${message}`)
  }
  const selection = select(space, selector)
  if (selection.count !== members.length) note(`count ${selection.count} vs reference ${members.length}`)
  if (selection.count !== expectedCount(space, selector)) note(`count ${selection.count} vs counts() ${expectedCount(space, selector)}`)
  if (members.length === 0) {
    try {
      selection.at(0)
      note('an empty selection returned a demon for at(0)')
    } catch (error) {
      if (!(error instanceof RangeError)) note(`an empty selection threw ${String(error)} for at(0), not a RangeError`)
    }
  }
  const list = ranks ?? Array.from({ length: members.length }, (_, k) => k)
  for (const k of list) {
    const r = members[k]
    if (r === undefined) {
      note(`k=${k} has no reference member`)
      continue
    }
    const d = selection.at(k)
    if (d.a !== r.a || d.b !== r.b || d.mesh !== r.mesh || d.type !== r.type || d.subtype !== r.subtype) {
      note(`k=${k} is ${span(d)} (mesh ${d.mesh}, ${d.type}/${d.subtype}), reference ${span(r)} (mesh ${r.mesh}, ${r.type}/${r.subtype})`)
    }
  }
  return list.length
}

describe('unranking by type and subtype: hand-checked bases', () => {
  const g10 = createNumogram(10)
  const s10 = g10.demons
  const all10 = refDemons(refStructure(10))

  it('base 10: group(chrono) has 15 members, the first is 2::1, and they are the reference chronodemons in mesh order', () => {
    const chrono = s10.group('chrono')
    expect(chrono.count).toBe(15)
    expect(span(chrono.at(0))).toBe('2::1')
    expect(chrono.at(0)).toMatchObject({ type: 'chrono', subtype: 'cyclic-chrono', mesh: 2 })
    const expected = all10.filter(r => r.type === 'chrono').map(span)
    expect(Array.from({ length: chrono.count }, (_, k) => span(chrono.at(k)))).toEqual(expected)
    expect(expected).toHaveLength(15)
  })

  it('base 10: the small subtypes list the demons written out from the definitions', () => {
    const list = (selection: DemonSelection): string[] => Array.from({ length: selection.count }, (_, k) => span(selection.at(k)))
    expect(list(s10.subtype('syzygetic-chrono'))).toEqual(['5::4', '7::2', '8::1'])
    expect(list(s10.subtype('syzygetic-xeno'))).toEqual(['6::3', '9::0'])
    expect(list(s10.subtype('chaotic-xeno'))).toEqual(['3::0', '6::0', '9::3', '9::6'])
    expect(s10.subtype('cyclic-chrono').count).toBe(12)
    expect(s10.subtype('plex-amphi').count).toBe(12)
    expect(s10.subtype('warp-amphi').count).toBe(12)
    expect(s10.group('amphi').count).toBe(24)
    expect(s10.group('xeno').count).toBe(6)
  })

  it('base 10: cross-torque-chrono is empty (one Torque cycle is not enough) and at(0) throws RangeError', () => {
    const cross = s10.subtype('cross-torque-chrono')
    expect(cross.count).toBe(0)
    expect(() => cross.at(0)).toThrow(RangeError)
  })

  it('base 28: cross-torque-chrono has 108 members and they are the reference cross-Torque demons in mesh order', () => {
    const space = createNumogram(28).demons
    const cross = space.subtype('cross-torque-chrono')
    expect(cross.count).toBe(108)
    const expected = refDemons(refStructure(28)).filter(r => r.subtype === 'cross-torque-chrono')
    expect(expected).toHaveLength(108)
    const notes: string[] = []
    checkSelection(28, space, 'cross-torque-chrono', expected, notes)
    expect(notes).toEqual([])
    expect(cross.at(0)).toMatchObject({ type: 'chrono', subtype: 'cross-torque-chrono' })
    // the first cross-Torque demon pairs zones of two different Torque cycles: its cycle ids differ
    expect(cross.at(0).cycleA).not.toBe(cross.at(0).cycleB)
  })
})

/** The first rank, the last rank and `params.numRuns` ranks of a selection of `count` members drawn from a fixed seed (none when empty). */
function sampledRanks(count: number, params: { readonly seed: number; readonly numRuns: number }): number[] {
  if (count <= 0) return []
  const drawn = fc.sample(fc.noBias(fc.integer({ min: 0, max: count - 1 })), params) // uniform, not biased to the edges
  return [...new Set([0, count - 1, ...drawn])]
}

describe('unranking: selections are frozen, memoized and strict about names and ranks', () => {
  it('returns the same frozen selection object for the same name and refuses unknown or crossed names', () => {
    const space = createNumogram(16).demons
    expect(space.group('chrono')).toBe(space.group('chrono'))
    expect(space.subtype('warp-amphi')).toBe(space.subtype('warp-amphi'))
    expect(Object.isFrozen(space.group('amphi'))).toBe(true)
    expect(Object.isFrozen(space.subtype('chaotic-xeno'))).toBe(true)
    expect(space.group('chrono')).not.toBe(space.group('xeno'))
    for (const bad of ['', 'CHRONO', 'chronodemon', 'toString', 'constructor', '__proto__', 'hasOwnProperty', 'cyclic-chrono']) {
      expect(() => space.group(bad as DemonType)).toThrow(RangeError)
    }
    for (const bad of ['', 'chrono', 'amphi', 'xeno', 'cyclic', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(() => space.subtype(bad as DemonSubtype)).toThrow(RangeError)
    }
    for (const bad of [undefined, null, 1, {}, ['chrono']]) {
      expect(() => space.group(bad as never)).toThrow(RangeError)
      expect(() => space.subtype(bad as never)).toThrow(RangeError)
    }
  })

  for (const n of [2, 4, 10, 12, 28, 82]) {
    it(`base ${n}: at(-1), at(count), at(0.5) and other bad ranks throw RangeError for every selector, valid ranks never do`, () => {
      const space = createNumogram(n).demons
      for (const selector of SELECTORS) {
        const selection = select(space, selector)
        const bad: unknown[] = [-1, selection.count, selection.count + 1, 0.5, selection.count - 0.5, NaN, Infinity, -Infinity, 2 ** 53, '0', null, undefined]
        for (const k of bad) {
          expect(() => selection.at(k as number), `${selector}.at(${String(k)})`).toThrow(RangeError)
        }
        if (selection.count > 0) {
          expect(() => selection.at(0)).not.toThrow()
          expect(() => selection.at(selection.count - 1)).not.toThrow()
          expect(selection.at(-0).mesh).toBe(selection.at(0).mesh)
        }
      }
    })
  }

  it('members come out strictly ascending by mesh and every demon is frozen and belongs to its selector (base 30)', () => {
    const space = createNumogram(30).demons
    for (const selector of SELECTORS) {
      const selection = select(space, selector)
      let previous = -1
      for (let k = 0; k < selection.count; k++) {
        const d = selection.at(k)
        expect(d.mesh, `${selector} k=${k}`).toBeGreaterThan(previous)
        expect((isType(selector) ? d.type : d.subtype) === selector, `${selector} k=${k}`).toBe(true)
        previous = d.mesh
      }
      if (selection.count > 0) expect(Object.isFrozen(selection.at(0))).toBe(true)
    }
  })
})

describe('unranking vs the reference: every rank of every type and subtype for every even n up to 64', () => {
  for (const [lo, hi] of [[2, 32], [34, 64]] as const) {
    it(
      `every member of every selector of every even n in [${lo}, ${hi}] equals the reference's filtered enumeration`,
      () => {
        const notes: string[] = []
        let ranksChecked = 0
        let selectorsChecked = 0
        for (const n of evenBases(lo, hi)) {
          const all = refDemons(refStructure(n))
          const space = createNumogram(n).demons
          for (const selector of SELECTORS) {
            ranksChecked += checkSelection(n, space, selector, membersOf(all, selector), notes)
            selectorsChecked++
          }
          // the type selectors partition the demons and so do the subtype selectors
          const sumOf = (names: readonly Selector[]): number => names.reduce((sum, s) => sum + select(space, s).count, 0)
          if (sumOf(DEMON_TYPES) !== space.count) notes.push(`n=${n}: the three type counts do not sum to ${space.count}`)
          if (sumOf(DEMON_SUBTYPES) !== space.count) notes.push(`n=${n}: the seven subtype counts do not sum to ${space.count}`)
        }
        expect(notes).toEqual([])
        expect(selectorsChecked).toBe(evenBases(lo, hi).length * 10)
        // every demon appears once under its type and once under its subtype
        const demons = evenBases(lo, hi).reduce((sum, n) => sum + (n * (n - 1)) / 2, 0)
        expect(ranksChecked).toBe(2 * demons)
      },
      60_000,
    )
  }
})

describe('unranking vs the reference: fixed-seed samples for every even n from 66 to 300', () => {
  for (const [lo, hi] of [[66, 180], [182, 300]] as const) {
    it(
      `10 sampled ranks (plus the first and the last) of every selector of every even n in [${lo}, ${hi}] equal the reference`,
      () => {
        const notes: string[] = []
        let ranksChecked = 0
        let selectorsChecked = 0
        for (const n of evenBases(lo, hi)) {
          const all = refDemons(refStructure(n)) // dropped again before the next base
          const space = createNumogram(n).demons
          for (const selector of SELECTORS) {
            const members = membersOf(all, selector)
            ranksChecked += checkSelection(n, space, selector, members, notes, sampledRanks(members.length, { seed: 20261007, numRuns: 10 }))
            selectorsChecked++
          }
        }
        expect(notes).toEqual([])
        expect(selectorsChecked).toBe(evenBases(lo, hi).length * 10)
        expect(ranksChecked).toBeGreaterThan(selectorsChecked * 2) // every non-empty selector was sampled
      },
      60_000,
    )
  }
})

describe('unranking vs the reference at bases 666 and 1024', () => {
  for (const [n, torqueCycles] of [[666, 14], [1024, 54]] as const) {
    it(
      `base ${n} (${torqueCycles} Torque cycles): 50 sampled ranks per selector equal the reference and consecutive ranks ascend`,
      () => {
        const structure = refStructure(n)
        expect(structure.cycles.filter(c => c.kind === 'torque')).toHaveLength(torqueCycles)
        const all = refDemons(structure)
        const space = createNumogram(n).demons
        const notes: string[] = []
        let checked = 0
        for (const selector of SELECTORS) {
          const members = membersOf(all, selector)
          const ranks = sampledRanks(members.length, { seed: 20261008, numRuns: 50 })
          if (ranks.length < Math.min(members.length, 40)) notes.push(`n=${n} ${selector}: only ${ranks.length} distinct ranks were sampled`)
          checked += checkSelection(n, space, selector, members, notes, ranks)
          // strict ascent between neighbours, for 20 sampled ranks
          const selection = select(space, selector)
          for (const k of sampledRanks(selection.count - 1, { seed: 20261008, numRuns: 20 })) {
            const here = selection.at(k)
            const next = selection.at(k + 1)
            if (!(here.mesh < next.mesh)) notes.push(`n=${n} ${selector}: at(${k}).mesh ${here.mesh} is not below at(${k + 1}).mesh ${next.mesh}`)
          }
        }
        expect(notes).toEqual([])
        expect(checked).toBeGreaterThan(SELECTORS.length * 20) // sampling ran (per-selector sample sizes are noted above)
        // both cross-Torque and cyclic chronodemons exist here, so the per-cycle counting really ran
        expect(space.subtype('cross-torque-chrono').count).toBeGreaterThan(0)
        expect(space.subtype('cyclic-chrono').count).toBeGreaterThan(0)
      },
      60_000,
    )
  }
})

/** The number of members of a selection whose mesh number is below m, by binary search over ranks using only at(). */
function rankOf(selection: DemonSelection, m: number): number {
  let lo = 0
  let hi = selection.count
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (selection.at(mid).mesh < m) lo = mid + 1
    else hi = mid
  }
  return lo
}

const TYPE_OF: Readonly<Record<DemonSubtype, DemonType>> = {
  'cyclic-chrono': 'chrono',
  'cross-torque-chrono': 'chrono',
  'syzygetic-chrono': 'chrono',
  'plex-amphi': 'amphi',
  'warp-amphi': 'amphi',
  'chaotic-xeno': 'xeno',
  'syzygetic-xeno': 'xeno',
}

describe('unranking at larger bases without a reference enumeration: the selections partition the mesh axis', () => {
  // Below any mesh number m every demon lies in exactly one type and exactly one subtype, so the ranks of m in the three
  // types sum to m, the ranks in the seven subtypes sum to m, and each type's rank is the sum of its subtypes' ranks. The
  // ranks are found by searching with at() only. A wrong count anywhere shifts a rank and breaks these sums.
  // cyclic-chrono and cross-torque-chrono cost O(K log n) per step, so they are included only up to n = 4096.
  const sampledBases = fc
    .sample(fc.noBias(fc.integer({ min: 513, max: 2 ** 19 })), { seed: 20261009, numRuns: 8 })
    .map(half => 2 * half)
  const cases: Array<[number, boolean]> = [
    ...([1026, 2048, 4096] as const).map((n): [number, boolean] => [n, true]),
    ...sampledBases.map((n): [number, boolean] => [n, false]),
  ]
  for (const [n, withCycleSubtypes] of cases) {
    it(
      `base ${n}: ranks of 10 sampled meshes sum to the mesh in the types${withCycleSubtypes ? ', the subtypes and per type' : ' and per type over the array-free subtypes'}`,
      () => {
        const space = createNumogram(n).demons
        const notes: string[] = []
        const meshes = [
          ...new Set([0, 1, space.count - 1, space.count - 2, ...fc.sample(fc.noBias(fc.integer({ min: 0, max: space.count - 1 })), { seed: 20261009, numRuns: 10 })]),
        ]
        const subtypes = DEMON_SUBTYPES.filter(s => withCycleSubtypes || (s !== 'cyclic-chrono' && s !== 'cross-torque-chrono'))
        for (const m of meshes) {
          const typeRank = {} as Record<DemonType, number>
          let typeTotal = 0
          for (const type of DEMON_TYPES) {
            typeRank[type] = rankOf(space.group(type), m)
            typeTotal += typeRank[type]
          }
          if (typeTotal !== m) notes.push(`n=${n} mesh ${m}: the type ranks sum to ${typeTotal}`)
          const subtypeRank = {} as Record<DemonSubtype, number>
          const perType: Record<DemonType, number> = { chrono: 0, amphi: 0, xeno: 0 }
          for (const subtype of subtypes) {
            subtypeRank[subtype] = rankOf(space.subtype(subtype), m)
            perType[TYPE_OF[subtype]] += subtypeRank[subtype]
          }
          if (withCycleSubtypes) {
            const subtypeTotal = subtypes.reduce((sum, s) => sum + subtypeRank[s], 0)
            if (subtypeTotal !== m) notes.push(`n=${n} mesh ${m}: the subtype ranks sum to ${subtypeTotal}`)
            for (const type of DEMON_TYPES) {
              if (perType[type] !== typeRank[type]) notes.push(`n=${n} mesh ${m}: ${type} rank ${typeRank[type]} but its subtypes sum to ${perType[type]}`)
            }
          } else {
            // without the two cycle subtypes the chrono rank still bounds the syzygetic part, and amphi and xeno are complete
            for (const type of ['amphi', 'xeno'] as const) {
              if (perType[type] !== typeRank[type]) notes.push(`n=${n} mesh ${m}: ${type} rank ${typeRank[type]} but its subtypes sum to ${perType[type]}`)
            }
            if (perType.chrono > typeRank.chrono) notes.push(`n=${n} mesh ${m}: syzygetic-chrono rank exceeds the chrono rank`)
          }
          // the demon at m is the member of its own type and subtype with exactly that rank
          if (m < space.count) {
            const d = space.at(m)
            if (space.group(d.type).at(typeRank[d.type]).mesh !== m) notes.push(`n=${n} mesh ${m}: at(rank) of its type is another demon`)
            if (subtypes.includes(d.subtype) && space.subtype(d.subtype).at(subtypeRank[d.subtype]).mesh !== m) {
              notes.push(`n=${n} mesh ${m}: at(rank) of its subtype is another demon`)
            }
          }
        }
        expect(notes).toEqual([])
      },
      60_000,
    )
  }
})
