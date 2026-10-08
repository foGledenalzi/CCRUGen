// Selection list ordering and cap (Phase 6 P5): O(k) order merge and a Canvas/headless-tier cap so select-all at n = 4000 stays cheap. Original CCRUG code (MIT, NOTICE section 1).
import type { RenderTier } from '../../engine/index'

/** [default] Entries the Selection panel lists above the SVG tier; the rest collapse into an `and {M} more selected` line. */
export const SELECTION_LIST_MAX = 200

/**
 * The Selection panel's display order after the selection changed: keys still selected keep their prior order
 * (`prev`), newly selected keys append in `keys` order, deselected keys drop. O(k) with two Sets, where the effect it
 * replaces ran `kept.includes(k)` per key (O(k^2), about 14,000 entries on select-all at n = 4000). Returns `prev`
 * itself when the merge equals it element-wise, so a React state setter given the result never re-renders in a loop.
 */
export function mergeSelectionOrder(prev: readonly string[], keys: readonly string[]): readonly string[] {
  const valid = new Set(keys)
  const kept = prev.filter(k => valid.has(k))
  const keptSet = new Set(kept)
  const appended = keys.filter(k => !keptSet.has(k))
  const next = appended.length === 0 ? kept : [...kept, ...appended]
  if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev
  return next
}

/**
 * The slice of `items` the Selection panel lists at `tier`, plus how many it leaves out. The SVG tier is never capped
 * (at most about 800 entries at base 200, the shipped behaviour); the Canvas and headless tiers show the first `max`.
 * Returns `items` itself when nothing is cut.
 */
export function capSelection<T>(
  items: readonly T[],
  tier: RenderTier,
  max: number = SELECTION_LIST_MAX,
): { readonly shown: readonly T[]; readonly hidden: number } {
  if (tier === 'svg' || items.length <= max) return { shown: items, hidden: 0 }
  return { shown: items.slice(0, max), hidden: items.length - max }
}
