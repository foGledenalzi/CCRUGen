// Tests for app/lib/viewLayouts.ts (UI-06, D-09, T-04-25, T-04-26). Base-10 presets must be the authored tables
// themselves (identity, not just equal structure); every procedural/pair-graph target must resolve for any base with
// finite geometry.
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Pos } from '../../app/data/types'
import { CENTER, DRAW_ORDER, FRAME_HEIGHT, P_LABYRINTH, P_LADDER, P_ORIGINAL, REGION_LABELS } from '../../app/presets/base10/layout-tables'
import { layoutTarget, tweenPositions } from '../../app/lib/viewLayouts'

const PP: Record<number, Pos> = {
  0: { x: 400, y: 400 }, 1: { x: 345, y: 379 }, 2: { x: 320, y: 344 }, 3: { x: 306, y: 305 }, 4: { x: 293, y: 272 },
  5: { x: 470, y: 260 }, 6: { x: 496, y: 278 }, 7: { x: 528, y: 328 }, 8: { x: 512, y: 373 }, 9: { x: 760, y: 400 },
}

describe('layoutTarget: base-10 presets return the authored tables', () => {
  const g = createNumogram(10)

  it('original', () => {
    const t = layoutTarget(g, 'original', 'shelf', PP)
    expect(t.pos).toBe(P_ORIGINAL)
    expect(t.ctr).toEqual(CENTER.original)
    expect(t.width).toBe(800)
    expect(t.height).toBe(940)
    expect(t.nodeRadius).toBe(21)
    expect(t.labelSize).toBe(17)
    expect(t.strokeScale).toBe(1)
    expect(t.drawOrder).toEqual([6, 3, 2, 7, 5, 4, 1, 8, 9, 0])
    expect(t.regionLabels).toBe(REGION_LABELS.original)
    expect(t.routingStyle).toBe('default')
    expect(t.preset).toBe(true)
    expect(t.pairGraph).toBe(false)
    expect(t.layout).toBeNull()
  })

  it('labyrinth', () => {
    const t = layoutTarget(g, 'labyrinth', 'shelf', PP)
    expect(t.pos).toBe(P_LABYRINTH)
    expect(t.height).toBe(880)
    expect(t.drawOrder).toEqual([6, 3, 8, 7, 1, 2, 4, 5, 9, 0])
    expect(t.routingStyle).toBe('default')
  })

  it('ladder', () => {
    const t = layoutTarget(g, 'ladder', 'shelf', PP)
    expect(t.pos).toBe(P_LADDER)
    expect(t.height).toBe(870)
    expect(t.routingStyle).toBe('ladder')
    expect(t.drawOrder).toEqual([4, 5, 3, 6, 2, 7, 1, 8, 0, 9])
  })

  it('planetary', () => {
    const t = layoutTarget(g, 'planetary', 'shelf', PP)
    expect(t.pos).toBe(PP)
    expect(t.height).toBe(FRAME_HEIGHT.planetary)
    expect(t.drawOrder).toBeNull()
    expect(t.routingStyle).toBe('planetary')
    expect(t.preset).toBe(true)
    expect(t.pairGraph).toBe(false)
    expect(t.layout).toBeNull()
  })
})

describe('layoutTarget: procedural layouts (engine) at base 10', () => {
  it('ring is not a preset and its positions come from the engine layout', () => {
    const g = createNumogram(10)
    const t = layoutTarget(g, 'ring', 'shelf', PP)
    expect(t.preset).toBe(false)
    expect(t.pairGraph).toBe(false)
    expect(t.layout).not.toBeNull()
    const layout = t.layout
    if (layout === null) throw new Error('expected a layout')
    for (let z = 0; z < 10; z++) {
      expect(t.pos[z]).toEqual({ x: layout.x[z], y: layout.y[z] })
    }
  })
})

describe('layoutTarget: base 28 (no presets)', () => {
  const g = createNumogram(28)

  it.each(['ring', 'spiral', 'ladder'] as const)('%s: 28 finite positions, drawOrder length 28, width >= 800', id => {
    const t = layoutTarget(g, id, 'shelf', PP)
    expect(t.preset).toBe(false)
    expect(Object.keys(t.pos)).toHaveLength(28)
    for (let z = 0; z < 28; z++) {
      const p = t.pos[z]
      expect(p).toBeDefined()
      expect(Number.isFinite(p?.x)).toBe(true)
      expect(Number.isFinite(p?.y)).toBe(true)
    }
    expect(t.drawOrder).toHaveLength(28)
    expect(t.width).toBeGreaterThanOrEqual(800)
  })

  it('pairGraph: layout.id is pairGraph, and a pair\'s lo and hi share one node position', () => {
    const t = layoutTarget(g, 'pairGraph', 'shelf', PP)
    expect(t.pairGraph).toBe(true)
    expect(t.layout?.id).toBe('pairGraph')
    for (let z = 0; z < 28; z++) {
      const lo = Math.min(z, 27 - z)
      const hi = 27 - lo
      expect(t.pos[lo]).toEqual(t.pos[hi])
    }
  })
})

describe('layoutTarget: base 64 packer choice affects ring composition', () => {
  it('shelf vs spiral: keys differ and at least one coordinate differs', () => {
    const g = createNumogram(64)
    const shelf = layoutTarget(g, 'ring', 'shelf', PP)
    const spiral = layoutTarget(g, 'ring', 'spiral', PP)
    expect(shelf.key).not.toBe(spiral.key)
    let anyDifferent = false
    for (let z = 0; z < 64; z++) {
      const a = shelf.pos[z]
      const b = spiral.pos[z]
      if (a === undefined || b === undefined) continue
      if (a.x !== b.x || a.y !== b.y) {
        anyDifferent = true
        break
      }
    }
    expect(anyDifferent).toBe(true)
  })
})

describe('tweenPositions', () => {
  const A: Record<number, Pos> = { 0: { x: 0, y: 0 }, 1: { x: 10, y: 20 } }
  const B: Record<number, Pos> = { 0: { x: 100, y: 200 }, 1: { x: 30, y: 40 } }

  it('e=0 equals A, e=1 equals B, e=0.5 is the midpoint', () => {
    expect(tweenPositions(A, B, 2, 0)).toEqual(A)
    expect(tweenPositions(A, B, 2, 1)).toEqual(B)
    expect(tweenPositions(A, B, 2, 0.5)).toEqual({ 0: { x: 50, y: 100 }, 1: { x: 20, y: 30 } })
  })
})
