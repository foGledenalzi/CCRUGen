// ENG-03 (filtered access): g.demons.group(type) and g.demons.subtype(subtype) unrank the k-th demon of a type or subtype in
// ascending mesh order without enumerating demons, proven against the independent definitions-only reference
// (tests/bruteforce/numogramReference.ts, D-09, imported by relative path from this test only).
//   - base 10 and base 28 by hand-checkable literals and by the reference
//   - every even n from 2 to 64: for each of the 3 types and 7 subtypes, count equals typeCounts()/counts() and EVERY k equals
//     the k-th reference demon of that selector
//   - invalid ranks and invalid selector names are refused with a RangeError
// Blocks collect short mismatch strings and assert once per block (never one expect per demon). If a test here fails, the
// ENGINE is wrong, not the reference.
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
