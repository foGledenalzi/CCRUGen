// Pure drag and z-index reducers behind usePanelDrag (Phase 7 plan 07-03, 07-RESEARCH Pitfall 4 and the z-cap decision). The hook
// has no jsdom test, so every rule lives in app/lib/panelDrag.ts and is pinned here: the drag seeds from the DISPLAYED position
// (no jump), a panel is `moved` on the first mouse move and not on mouse down, a moved panel keeps its stored position while its
// slot stays reserved, and the z counter never passes 69 so no panel can cover the toolbar (74), the overlay (80) or the base
// picker dropdown (120).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  Z_BASE,
  Z_CAP,
  Z_RERANK_START,
  activate,
  displayedPositions,
  dragEnd,
  dragMove,
  dragStart,
  initialDragState,
  type DragState,
  type Point,
} from '../../app/lib/panelDrag'
import { STACK_PANEL_IDS, computeDesktopStack, type StackPanelId } from '../../app/lib/panelStack'

/** The guarantee in plain numbers: the zoom toolbar and the shortcuts button sit at z 74, so no panel may reach 70. Literal on purpose. */
const HARD_Z_LIMIT = 69

const MEASURED = { layers: 146, labels: 101, zones: 270, regions: 145, syz: 143, currents: 143, gates: 270, text: 30, info: 296.5 }
const ORACLE_STACK = computeDesktopStack(MEASURED, { selectionX: 942, vw: 1280 })!

/** Freeze every array-free level of a state so a reducer that writes into its input throws (ES modules are strict). */
function freezeState(s: DragState): DragState {
  for (const id of STACK_PANEL_IDS) Object.freeze(s.stored[id])
  Object.freeze(s.stored)
  Object.freeze(s.z)
  if (s.drag) Object.freeze(s.drag)
  return Object.freeze(s)
}

function zOrderExcluding(z: Readonly<Record<StackPanelId, number>>, skip: StackPanelId): StackPanelId[] {
  return STACK_PANEL_IDS.filter(id => id !== skip).sort((a, b) => z[a] - z[b])
}

describe('constants', () => {
  it('pins the z window: base 40, cap 69, re-rank restart 50', () => {
    expect(Z_BASE).toBe(40)
    expect(Z_CAP).toBe(HARD_Z_LIMIT)
    expect(Z_RERANK_START).toBe(50)
  })
})

describe('initialDragState', () => {
  const s = initialDragState()

  it('stores today\'s initial positions plus Names at 548, 116', () => {
    expect(s.stored).toEqual({
      layers: { x: 12, y: 64 },
      labels: { x: 12, y: 206 },
      zones: { x: 12, y: 352 },
      syz: { x: 12, y: 916 },
      regions: { x: 216, y: 64 },
      currents: { x: 216, y: 258 },
      gates: { x: 216, y: 516 },
      text: { x: 216, y: 760 },
      info: { x: 420, y: 64 },
      names: { x: 548, y: 116 },
    })
  })

  it('starts the z indexes where usePanelDrag does today, with Names above Text at 49, and the counter at 50', () => {
    expect(s.z).toEqual({
      layers: 40,
      labels: 41,
      regions: 42,
      zones: 43,
      currents: 44,
      syz: 45,
      gates: 46,
      info: 47,
      text: 48,
      names: 49,
    })
    expect(s.counter).toBe(50)
  })

  it('has nothing moved and no drag in progress', () => {
    expect(s.moved.size).toBe(0)
    expect(s.drag).toBeNull()
  })

  it('returns a fresh state each call', () => {
    const a = initialDragState()
    const b = initialDragState()
    expect(a).not.toBe(b)
    expect(a.stored).not.toBe(b.stored)
    expect(a.moved).not.toBe(b.moved)
  })
})

describe('activate', () => {
  it('bumps the panel to the counter and advances it', () => {
    const s = activate(initialDragState(), 'layers')
    expect(s.z.layers).toBe(50)
    expect(s.counter).toBe(51)
    // every other panel keeps its z
    for (const id of STACK_PANEL_IDS) if (id !== 'layers') expect(s.z[id], id).toBe(initialDragState().z[id])
  })

  it('does not touch positions, the moved set or a drag in progress', () => {
    const s0 = dragStart(initialDragState(), 'labels', 10, 10, { x: 12, y: 228 })
    const s1 = activate(s0, 'zones')
    expect(s1.stored).toEqual(s0.stored)
    expect(s1.moved).toEqual(s0.moved)
    expect(s1.drag).toEqual(s0.drag)
  })

  it('hands out 50 to 69 with no re-rank (20 activations), the 20th gets exactly 69', () => {
    let s = initialDragState()
    for (let i = 0; i < 20; i++) s = activate(s, STACK_PANEL_IDS[i % STACK_PANEL_IDS.length]!)
    expect(s.z[STACK_PANEL_IDS[19 % STACK_PANEL_IDS.length]!]).toBe(69)
    expect(s.counter).toBe(70)
    // 20 activations over ten panels: every panel was bumped twice, so every z is in 60..69 and nothing was re-ranked yet
    for (const id of STACK_PANEL_IDS) expect(s.z[id], id).toBeGreaterThanOrEqual(60)
  })

  it('re-ranks only when the counter would pass 69: the 21st activation compacts onto 40..49 and continues from 50', () => {
    let s = initialDragState()
    for (let i = 0; i < 20; i++) s = activate(s, STACK_PANEL_IDS[i % STACK_PANEL_IDS.length]!)
    const before = s
    const order = zOrderExcluding(before.z, 'syz')
    const next = activate(before, 'syz')
    expect(next.z.syz).toBe(Z_RERANK_START)
    expect(next.counter).toBe(51)
    // the nine others sit on distinct values inside 40..49 in their previous relative order
    expect(zOrderExcluding(next.z, 'syz')).toEqual(order)
    for (const id of order) {
      expect(next.z[id], id).toBeGreaterThanOrEqual(Z_BASE)
      expect(next.z[id], id).toBeLessThanOrEqual(49)
    }
    expect(new Set(order.map(id => next.z[id])).size).toBe(9)
  })

  it('80 activations cycling through all ten panels never pass 69, and the last panel activated is the highest', () => {
    let s = initialDragState()
    for (let i = 0; i < 80; i++) {
      const id = STACK_PANEL_IDS[i % STACK_PANEL_IDS.length]!
      s = activate(s, id)
      for (const other of STACK_PANEL_IDS) {
        expect(s.z[other], `step ${i} ${other}`).toBeLessThanOrEqual(69)
        expect(s.z[other], `step ${i} ${other}`).toBeGreaterThanOrEqual(40)
        if (other !== id) expect(s.z[other], `step ${i} ${other} under ${id}`).toBeLessThan(s.z[id])
      }
      expect(s.counter).toBeLessThanOrEqual(70)
    }
  })

  it('500 random activations: z stays in 40..69, stays distinct, the activated panel is on top, the others keep their relative order', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...STACK_PANEL_IDS), { minLength: 1, maxLength: 500 }), ids => {
        let s = initialDragState()
        for (const id of ids) {
          const before = zOrderExcluding(s.z, id)
          s = activate(s, id)
          const values = STACK_PANEL_IDS.map(k => s.z[k])
          if (values.some(v => v > 69 || v < 40)) return false
          if (new Set(values).size !== values.length) return false
          if (STACK_PANEL_IDS.some(k => k !== id && s.z[k] >= s.z[id])) return false
          const after = zOrderExcluding(s.z, id)
          if (after.some((k, i) => k !== before[i])) return false
        }
        return true
      }),
      { seed: 20261020, numRuns: 300 },
    )
  })

  it('never mutates its input', () => {
    const s = freezeState(initialDragState())
    expect(() => activate(s, 'names')).not.toThrow()
    let big = initialDragState()
    for (let i = 0; i < 20; i++) big = activate(big, STACK_PANEL_IDS[i % STACK_PANEL_IDS.length]!)
    freezeState(big)
    expect(() => activate(big, 'info')).not.toThrow()
    expect(big.counter).toBe(70)
  })
})

describe('dragStart and dragEnd (no jump)', () => {
  const DISPLAYED = { x: 12, y: 228 } // Labels as drawn by the derived stack; its stored initial y is 206

  it('mouse down alone moves nothing and marks nothing moved', () => {
    const s = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    expect(s.moved.size).toBe(0)
    expect(s.stored.labels).toEqual({ x: 12, y: 206 })
    expect(s.drag).toEqual({ id: 'labels', mx: 100, my: 200, ox: 12, oy: 228 })
  })

  it('raises the panel (it is the first activation, so z 50)', () => {
    const s = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    expect(s.z.labels).toBe(50)
    expect(s.counter).toBe(51)
  })

  it('mouse down then mouse up with no move leaves the panel displayed at its derived slot (no jump)', () => {
    const down = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    const up = dragEnd(down)
    expect(up.drag).toBeNull()
    expect(up.moved.size).toBe(0)
    const shown = displayedPositions(up, ORACLE_STACK)
    expect(shown.labels).toEqual(ORACLE_STACK.labels)
    expect(shown.labels).toEqual({ x: 12, y: 228 })
  })

  it('seeds from the displayed position, not the stored one: a 5 px move and a 60 px move equal the mouse delta', () => {
    const down = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    const five = dragMove(down, 105, 200)
    expect(five.stored.labels).toEqual({ x: 17, y: 228 })
    const sixty = dragMove(five, 160, 200)
    expect(sixty.stored.labels).toEqual({ x: 72, y: 228 })
    const both = dragMove(sixty, 160, 230)
    expect(both.stored.labels).toEqual({ x: 72, y: 258 })
  })

  it('marks the panel moved on the first mouse move, not on mouse down', () => {
    const down = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    expect(down.moved.has('labels')).toBe(false)
    const moved = dragMove(down, 101, 200)
    expect(moved.moved.has('labels')).toBe(true)
    expect([...moved.moved]).toEqual(['labels'])
  })

  it('a moved panel keeps its stored position after the drag ends', () => {
    let s = dragStart(initialDragState(), 'labels', 100, 200, DISPLAYED)
    s = dragMove(s, 140, 260)
    s = dragEnd(s)
    expect(s.drag).toBeNull()
    expect(s.moved.has('labels')).toBe(true)
    expect(s.stored.labels).toEqual({ x: 52, y: 288 })
    expect(displayedPositions(s, ORACLE_STACK).labels).toEqual({ x: 52, y: 288 })
  })

  it('dragging one panel never changes another panel\'s stored position or moved flag', () => {
    let s = dragStart(initialDragState(), 'zones', 50, 50, { x: 12, y: 347 })
    s = dragMove(s, 90, 70)
    const start = initialDragState()
    for (const id of STACK_PANEL_IDS) {
      if (id === 'zones') continue
      expect(s.stored[id], id).toEqual(start.stored[id])
      expect(s.moved.has(id), id).toBe(false)
    }
    expect(s.stored.zones).toEqual({ x: 52, y: 367 })
  })

  it('a second drag of an already moved panel seeds from where it is drawn (its stored position)', () => {
    let s = dragStart(initialDragState(), 'info', 10, 10, { x: 942, y: 64 })
    s = dragEnd(dragMove(s, 30, 40)) // stored info = {962, 94}
    const shown = displayedPositions(s, ORACLE_STACK).info
    expect(shown).toEqual({ x: 962, y: 94 })
    s = dragMove(dragStart(s, 'info', 200, 200, shown), 210, 190)
    expect(s.stored.info).toEqual({ x: 972, y: 84 })
  })

  it('a move with no drag in progress is a no-op and returns the same state', () => {
    const s = initialDragState()
    expect(dragMove(s, 500, 500)).toBe(s)
  })

  it('dragEnd without a drag returns the same state', () => {
    const s = initialDragState()
    expect(dragEnd(s)).toBe(s)
  })

  it('for every panel: stored after a move = seed + (mouse now - mouse at the start)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STACK_PANEL_IDS),
        fc.integer({ min: 0, max: 1600 }),
        fc.integer({ min: 0, max: 900 }),
        fc.integer({ min: 0, max: 1600 }),
        fc.integer({ min: 0, max: 900 }),
        fc.integer({ min: 0, max: 1600 }),
        fc.integer({ min: 0, max: 900 }),
        (id, mx, my, nx, ny, dx, dy) => {
          const seed: Point = { x: dx, y: dy }
          const s = dragMove(dragStart(initialDragState(), id, mx, my, seed), nx, ny)
          return s.stored[id].x === dx + nx - mx && s.stored[id].y === dy + ny - my && s.moved.has(id)
        },
      ),
      { seed: 20261020, numRuns: 500 },
    )
  })

  it('never mutate their input', () => {
    const s = freezeState(initialDragState())
    const down = freezeState(dragStart(s, 'text', 1, 2, { x: 216, y: 676 }))
    const moved = freezeState(dragMove(down, 9, 9))
    expect(() => dragEnd(moved)).not.toThrow()
    expect(() => dragMove(moved, 20, 20)).not.toThrow()
    expect(moved.moved.size).toBe(1)
    // the pre-move states are unchanged
    expect(down.moved.size).toBe(0)
    expect(down.stored.text).toEqual({ x: 216, y: 760 })
  })
})

describe('displayedPositions', () => {
  it('returns the derived slot for unmoved panels and the stored position for moved ones', () => {
    let s = dragStart(initialDragState(), 'gates', 0, 0, ORACLE_STACK.gates)
    s = dragEnd(dragMove(s, 25, 10))
    const shown = displayedPositions(s, ORACLE_STACK)
    expect(shown.gates).toEqual({ x: 241, y: 398 })
    for (const id of STACK_PANEL_IDS) if (id !== 'gates') expect(shown[id], id).toEqual(ORACLE_STACK[id])
  })

  it('returns the stored positions for every panel while the stack is not derived yet (null)', () => {
    const s = initialDragState()
    expect(displayedPositions(s, null)).toEqual(s.stored)
  })

  it('falls back to the stored position for a panel the derived map does not cover', () => {
    const s = initialDragState()
    const partial = { layers: { x: 12, y: 64 }, labels: { x: 12, y: 228 } }
    const shown = displayedPositions(s, partial)
    expect(shown.labels).toEqual({ x: 12, y: 228 })
    expect(shown.names).toEqual(s.stored.names)
    expect(shown.syz).toEqual(s.stored.syz)
  })

  it('covers all ten panels', () => {
    const shown = displayedPositions(initialDragState(), ORACLE_STACK)
    expect(Object.keys(shown).sort()).toEqual([...STACK_PANEL_IDS].sort())
  })

  it('a moved panel\'s slot stays reserved: the panels below it keep their derived slots', () => {
    // Labels is dragged away. The stack is derived from the measured heights alone (it takes no `moved` input), so Zones and
    // Syzygies stay exactly where the stack puts them, which is today's behaviour (a moved panel leaves its hole).
    let s = dragStart(initialDragState(), 'labels', 100, 200, ORACLE_STACK.labels)
    s = dragEnd(dragMove(s, 400, 300))
    const shown = displayedPositions(s, ORACLE_STACK)
    expect(shown.labels).toEqual({ x: 312, y: 328 })
    expect(shown.zones).toEqual(ORACLE_STACK.zones)
    expect(shown.syz).toEqual(ORACLE_STACK.syz)
    // and the same derived map comes out whether or not Labels was moved
    expect(computeDesktopStack(MEASURED, { selectionX: 942, vw: 1280 })!.zones).toEqual(shown.zones)
  })

  it('an unmoved panel follows a changed derived stack, a moved one does not', () => {
    let s = dragStart(initialDragState(), 'syz', 0, 0, ORACLE_STACK.syz)
    s = dragEnd(dragMove(s, 5, 5))
    const collapsedLayers = computeDesktopStack({ ...MEASURED, layers: 30 }, { selectionX: 942, vw: 1280 })!
    const shown = displayedPositions(s, collapsedLayers)
    expect(shown.labels).toEqual(collapsedLayers.labels)
    expect(shown.zones).toEqual(collapsedLayers.zones)
    expect(shown.syz).toEqual({ x: 17, y: 640 })
  })

  it('returns a fresh record and does not mutate its inputs', () => {
    const s = freezeState(initialDragState())
    const a = displayedPositions(s, ORACLE_STACK)
    const b = displayedPositions(s, ORACLE_STACK)
    expect(a).not.toBe(b)
    expect(a).not.toBe(s.stored)
    expect(a).toEqual(b)
  })
})
