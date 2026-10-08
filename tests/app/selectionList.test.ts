// Selection list ordering and cap (Phase 6 P5, plan 06-09, T-06-09): the order merge is O(k) (a Set, not
// `kept.includes` per key) and the Canvas/headless tiers list at most SELECTION_LIST_MAX entries, so select-all at
// n = 4000 (about 14,000 entries) cannot blow up the Selection panel. The SVG tier is unchanged.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { SELECTION_LIST_MAX, capSelection, mergeSelectionOrder } from '../../app/lib/selectionList'

/** The pre-06-09 InfoDisplay effect body, kept here as the O(k^2) reference the new function must agree with. */
function referenceMerge(prev: readonly string[], keys: readonly string[]): readonly string[] {
  const valid = new Set(keys)
  const kept = prev.filter(k => valid.has(k))
  const appended = keys.filter(k => !kept.includes(k))
  const next = [...kept, ...appended]
  if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev
  return next
}

describe('SELECTION_LIST_MAX', () => {
  it('is 200', () => {
    expect(SELECTION_LIST_MAX).toBe(200)
  })
})

describe('mergeSelectionOrder', () => {
  it('keeps the prior order and appends new keys in their own order', () => {
    expect(mergeSelectionOrder(['a', 'b', 'c'], ['c', 'd', 'a'])).toEqual(['a', 'c', 'd'])
  })

  it('drops keys that are no longer selected', () => {
    expect(mergeSelectionOrder(['a', 'b', 'c'], ['b'])).toEqual(['b'])
    expect(mergeSelectionOrder(['a', 'b', 'c'], [])).toEqual([])
  })

  it('starts from the key order when there is no prior order', () => {
    expect(mergeSelectionOrder([], ['z', 'y', 'x'])).toEqual(['z', 'y', 'x'])
  })

  it('returns the SAME array reference when the merge equals prev element-wise', () => {
    const prev = ['a', 'b', 'c']
    expect(mergeSelectionOrder(prev, ['c', 'b', 'a'])).toBe(prev)
    expect(mergeSelectionOrder(prev, ['a', 'b', 'c'])).toBe(prev)
    const empty: string[] = []
    expect(mergeSelectionOrder(empty, [])).toBe(empty)
  })

  it('returns a new array when the content differs', () => {
    const prev = ['a', 'b']
    const next = mergeSelectionOrder(prev, ['a', 'b', 'c'])
    expect(next).not.toBe(prev)
    expect(next).toEqual(['a', 'b', 'c'])
  })

  it('completes over 20,000 keys with the expected order', () => {
    const keys = Array.from({ length: 20_000 }, (_, i) => `zone:${i}`)
    // prior order is the reverse of the first half, so kept keys keep THAT order and the rest append after them
    const prev = keys.slice(0, 10_000).reverse()
    const out = mergeSelectionOrder(prev, keys)
    expect(out).toHaveLength(20_000)
    expect(out.slice(0, 10_000)).toEqual(prev)
    expect(out.slice(10_000)).toEqual(keys.slice(10_000))
  })

  it('stays linear: 200,000 keys would take minutes through an O(k^2) pass', () => {
    const keys = Array.from({ length: 200_000 }, (_, i) => `edge:${i}`)
    const prev = keys.filter((_, i) => i % 2 === 0)
    const out = mergeSelectionOrder(prev, keys)
    expect(out).toHaveLength(200_000)
    expect(out.slice(0, prev.length)).toEqual(prev)
  })

  it('agrees with the O(k^2) reference on random prev/keys samples of up to 300 keys', () => {
    const key = fc.integer({ min: 0, max: 400 }).map(n => `k${n}`)
    fc.assert(
      fc.property(
        fc.array(key, { maxLength: 300 }),
        fc.array(key, { maxLength: 300 }),
        (prev, keys) => {
          const got = mergeSelectionOrder(prev, keys)
          const want = referenceMerge(prev, keys)
          expect([...got]).toEqual([...want])
          // identity is part of the contract: an unchanged merge hands back prev itself
          expect(got === prev).toBe(want === prev)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('capSelection', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => i)

  it('does not cap at the SVG tier', () => {
    const r = capSelection(items(900), 'svg')
    expect(r.shown).toHaveLength(900)
    expect(r.hidden).toBe(0)
  })

  it('caps at the Canvas tier to SELECTION_LIST_MAX and counts the rest', () => {
    const r = capSelection(items(900), 'canvas')
    expect(r.shown).toHaveLength(SELECTION_LIST_MAX)
    expect(r.shown).toEqual(items(900).slice(0, SELECTION_LIST_MAX))
    expect(r.hidden).toBe(900 - SELECTION_LIST_MAX)
    expect(r.hidden).toBe(700)
  })

  it('caps the headless tier the same way', () => {
    const r = capSelection(items(900), 'headless')
    expect(r.shown).toHaveLength(200)
    expect(r.hidden).toBe(700)
  })

  it('hides nothing when the list fits', () => {
    for (const tier of ['svg', 'canvas', 'headless'] as const) {
      const exact = capSelection(items(SELECTION_LIST_MAX), tier)
      expect(exact.shown).toHaveLength(SELECTION_LIST_MAX)
      expect(exact.hidden).toBe(0)
      const small = capSelection(items(3), tier)
      expect(small.shown).toEqual([0, 1, 2])
      expect(small.hidden).toBe(0)
    }
    expect(capSelection([], 'canvas')).toEqual({ shown: [], hidden: 0 })
  })

  it('keeps the whole array (same reference) when nothing is cut, and honours an explicit max', () => {
    const list = items(5)
    expect(capSelection(list, 'canvas').shown).toBe(list)
    const r = capSelection(items(10), 'canvas', 4)
    expect(r.shown).toEqual([0, 1, 2, 3])
    expect(r.hidden).toBe(6)
  })

  it('handles the select-all size at n = 4000 (about 14,000 entries)', () => {
    const r = capSelection(items(14_000), 'canvas')
    expect(r.shown).toHaveLength(SELECTION_LIST_MAX)
    expect(r.hidden).toBe(14_000 - SELECTION_LIST_MAX)
  })
})
