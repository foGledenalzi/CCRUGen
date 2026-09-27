// Preset resolution through the registry (LAY-02, D-05): BASE10_LAYOUT_SPECS resolve through the same resolveLayout
// interface the procedural layouts use. Imports engine functions from the barrel (../../engine/index), which also
// proves engine/index.ts's `export * from './layout/index'` re-export.
import { describe, expect, it } from 'vitest'
import { createNumogram, ladderLayout, layoutIdsFor, resolveLayout } from '../../engine/index'
import { BASE10_LAYOUT_SPECS } from '../../app/presets/base10/layouts'

describe('resolveLayout with BASE10_LAYOUT_SPECS', () => {
  it('base 10 with no id defaults to the "original" preset', () => {
    const g10 = createNumogram(10)
    expect(resolveLayout(g10, undefined, BASE10_LAYOUT_SPECS).id).toBe('original')
  })

  it('the "ladder" preset wins over the procedural ladder at base 10 (D-04 exact reduction)', () => {
    const g10 = createNumogram(10)
    const resolved = resolveLayout(g10, 'ladder', BASE10_LAYOUT_SPECS)
    expect(resolved.drawOrder).toEqual(Int32Array.from([4, 5, 3, 6, 2, 7, 1, 8, 0, 9]))
    const procedural = ladderLayout(g10)
    expect(resolved.x).toEqual(procedural.x)
    expect(resolved.y).toEqual(procedural.y)
  })

  it('the "ring" id at base 10 (no matching preset) falls through to the procedural ring', () => {
    const g10 = createNumogram(10)
    expect(resolveLayout(g10, 'ring', BASE10_LAYOUT_SPECS).id).toBe('ring')
  })

  it('the "planetary" preset resolves with routingStyle "planetary"', () => {
    const g10 = createNumogram(10)
    expect(resolveLayout(g10, 'planetary', BASE10_LAYOUT_SPECS).routingStyle).toBe('planetary')
  })

  it('base 28 with "labyrinth" (a base-10-only preset) falls back to the procedural ring (D-05)', () => {
    const g28 = createNumogram(28)
    expect(resolveLayout(g28, 'labyrinth', BASE10_LAYOUT_SPECS).id).toBe('ring')
  })

  it('base 28 with no id also falls back to the procedural ring (D-05)', () => {
    const g28 = createNumogram(28)
    expect(resolveLayout(g28, undefined, BASE10_LAYOUT_SPECS).id).toBe('ring')
  })

  it('layoutIdsFor(g10, BASE10_LAYOUT_SPECS) lists the four presets then ring and spiral', () => {
    const g10 = createNumogram(10)
    expect(layoutIdsFor(g10, BASE10_LAYOUT_SPECS)).toEqual(['original', 'labyrinth', 'ladder', 'planetary', 'ring', 'spiral'])
  })
})
