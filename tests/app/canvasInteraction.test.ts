// Tests for app/lib/canvas/interaction.ts (Phase 6 D-09, REN-02): the pointer state machine of the Canvas tier and the
// wheel zoom factor. The reducer takes plain event objects (there is no DOM in the node test environment), so every
// rule is driven here with literal events: mouse click slop 3 px, touch tap and pan 8 px, pinch about the midpoint,
// pointercancel dropping the gesture, and non-finite coordinates leaving the state alone (T-06-17).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  CLICK_SLOP_PX,
  INITIAL_POINTER_STATE,
  TOUCH_SLOP_PX,
  reducePointer,
  wheelZoomFactor,
  type PointerAction,
  type PointerInput,
  type PointerState,
} from '../../app/lib/canvas/interaction'

type Partial_ = Partial<PointerInput>

function ev(type: PointerInput['type'], p: Partial_ = {}): PointerInput {
  return {
    type,
    pointerId: 1,
    pointerType: 'mouse',
    x: 0,
    y: 0,
    button: 0,
    altKey: false,
    shiftKey: false,
    overTarget: false,
    ...p,
  }
}

const mouse = (type: PointerInput['type'], x: number, y: number, p: Partial_ = {}): PointerInput =>
  ev(type, { pointerType: 'mouse', pointerId: 1, x, y, ...p })
const touch = (type: PointerInput['type'], id: number, x: number, y: number, p: Partial_ = {}): PointerInput =>
  ev(type, { pointerType: 'touch', pointerId: id, x, y, ...p })
const pen = (type: PointerInput['type'], x: number, y: number, p: Partial_ = {}): PointerInput =>
  ev(type, { pointerType: 'pen', pointerId: 7, x, y, ...p })

interface Run {
  readonly state: PointerState
  readonly actions: readonly PointerAction[]
  /** The actions of each event, in order. */
  readonly each: readonly (readonly PointerAction[])[]
}

/** Feeds the events one by one; collects every action. */
function run(events: readonly PointerInput[], from: PointerState = INITIAL_POINTER_STATE): Run {
  let state = from
  const each: (readonly PointerAction[])[] = []
  for (const e of events) {
    const out = reducePointer(state, e)
    state = out.state
    each.push(out.actions)
  }
  return { state, actions: each.flat(), each }
}

const kinds = (actions: readonly PointerAction[]): string[] => actions.map(a => a.kind)

const IDLE = INITIAL_POINTER_STATE

describe('constants', () => {
  it('uses the UI-SPEC slops: 3 px for a mouse click, 8 px for a touch tap or pan', () => {
    expect(CLICK_SLOP_PX).toBe(3)
    expect(TOUCH_SLOP_PX).toBe(8)
  })

  it('starts idle with nothing tracked', () => {
    expect(IDLE.mode).toBe('idle')
    expect(IDLE.pointers.size).toBe(0)
    expect(IDLE.gesture).toBe(false)
  })
})

describe('mouse press on a target', () => {
  it('a release within 3 px is a click at the release point', () => {
    const r = run([mouse('down', 10, 10, { overTarget: true }), mouse('move', 11, 11), mouse('up', 12, 10)])
    expect(r.actions).toEqual([{ kind: 'click', x: 12, y: 10 }])
    expect(r.state).toEqual(IDLE)
  })

  it('exactly 3 px away still clicks; a 4 px move before the release does not', () => {
    const edge = run([mouse('down', 10, 10, { overTarget: true }), mouse('up', 13, 10)])
    expect(edge.actions).toEqual([{ kind: 'click', x: 13, y: 10 }])
    const drag = run([mouse('down', 10, 10, { overTarget: true }), mouse('move', 14, 10), mouse('up', 14, 10)])
    expect(drag.actions).toEqual([])
    expect(drag.state).toEqual(IDLE)
  })

  it('a drag that began on a target is ignored: no pan, no rubber band, no hover', () => {
    const r = run([
      mouse('down', 10, 10, { overTarget: true }),
      mouse('move', 40, 40),
      mouse('move', 80, 90),
      mouse('up', 80, 90),
    ])
    expect(r.actions).toEqual([])
  })

  it('a press does not capture the mouse, and a plain press emits nothing at the press itself', () => {
    expect(run([mouse('down', 10, 10, { overTarget: true })]).actions).toEqual([])
  })
})

describe('mouse press on empty space', () => {
  it('starts the rubber band and emits nothing for the moves', () => {
    const r = run([mouse('down', 20, 30), mouse('move', 60, 70), mouse('move', 90, 95)])
    expect(r.each[0]).toEqual([{ kind: 'rubberStart', x: 20, y: 30, additive: false }])
    expect(r.each[1]).toEqual([])
    expect(r.each[2]).toEqual([])
    expect(r.state.mode).toBe('rubber')
  })

  it('Shift makes the rubber band additive', () => {
    const r = run([mouse('down', 20, 30, { shiftKey: true })])
    expect(r.actions).toEqual([{ kind: 'rubberStart', x: 20, y: 30, additive: true }])
  })

  it('a release that dragged emits nothing; a release within the slop is a click (the click that clears)', () => {
    const dragged = run([mouse('down', 20, 30), mouse('move', 60, 70), mouse('up', 60, 70)])
    expect(dragged.actions).toEqual([{ kind: 'rubberStart', x: 20, y: 30, additive: false }])
    expect(dragged.state).toEqual(IDLE)
    const still = run([mouse('down', 20, 30), mouse('up', 21, 31)])
    expect(still.actions).toEqual([
      { kind: 'rubberStart', x: 20, y: 30, additive: false },
      { kind: 'click', x: 21, y: 31 },
    ])
    expect(still.state).toEqual(IDLE)
  })
})

describe('mouse pan (middle button, or Alt with the primary button)', () => {
  it('the middle button captures, starts a gesture, pans by the delta from the previous point and ends on release', () => {
    const r = run([
      mouse('down', 100, 100, { button: 1 }),
      mouse('move', 103, 98),
      mouse('move', 110, 98),
      mouse('up', 110, 98, { button: 1 }),
    ])
    expect(r.each[0]).toEqual([{ kind: 'capture', pointerId: 1 }, { kind: 'gestureStart' }])
    expect(r.each[1]).toEqual([{ kind: 'pan', dx: 3, dy: -2 }])
    expect(r.each[2]).toEqual([{ kind: 'pan', dx: 7, dy: 0 }])
    expect(r.each[3]).toEqual([{ kind: 'gestureEnd' }])
    expect(r.state).toEqual(IDLE)
  })

  it('Alt with button 0 pans the same way, and it pans from the very first pixel', () => {
    const r = run([mouse('down', 5, 5, { altKey: true }), mouse('move', 6, 5), mouse('up', 6, 5, { altKey: true })])
    expect(r.actions).toEqual([
      { kind: 'capture', pointerId: 1 },
      { kind: 'gestureStart' },
      { kind: 'pan', dx: 1, dy: 0 },
      { kind: 'gestureEnd' },
    ])
  })

  it('a move that did not move emits no pan', () => {
    const r = run([mouse('down', 5, 5, { button: 1 }), mouse('move', 5, 5)])
    expect(r.each[1]).toEqual([])
  })

  it('a pan never emits a click or a rubber band', () => {
    const r = run([mouse('down', 5, 5, { button: 1 }), mouse('up', 5, 5, { button: 1 })])
    expect(kinds(r.actions)).toEqual(['capture', 'gestureStart', 'gestureEnd'])
  })

  it('other buttons (for example the context-menu button) are ignored', () => {
    const out = reducePointer(IDLE, mouse('down', 5, 5, { button: 2 }))
    expect(out.state).toBe(IDLE)
    expect(out.actions).toEqual([])
  })
})

describe('mouse and pen hover', () => {
  it('a move while idle is a hover at that point, a leave while idle ends it', () => {
    const r = run([mouse('move', 40, 50), mouse('move', 41, 52), mouse('leave', 41, 52)])
    expect(r.actions).toEqual([
      { kind: 'hover', x: 40, y: 50 },
      { kind: 'hover', x: 41, y: 52 },
      { kind: 'hoverEnd' },
    ])
    expect(r.state).toEqual(IDLE)
  })

  it('a pen hovers like a mouse and captures when it presses', () => {
    expect(run([pen('move', 4, 5)]).actions).toEqual([{ kind: 'hover', x: 4, y: 5 }])
    const press = run([pen('down', 4, 5, { overTarget: true })])
    expect(press.actions).toEqual([{ kind: 'capture', pointerId: 7 }])
    const click = run([pen('down', 4, 5, { overTarget: true }), pen('up', 5, 6)])
    expect(click.actions).toEqual([{ kind: 'capture', pointerId: 7 }, { kind: 'click', x: 5, y: 6 }])
    const rubber = run([pen('down', 4, 5)])
    expect(rubber.actions).toEqual([
      { kind: 'capture', pointerId: 7 },
      { kind: 'rubberStart', x: 4, y: 5, additive: false },
    ])
  })

  it('there is no hover while a pan or a pinch is active', () => {
    const panning = run([mouse('down', 5, 5, { button: 1 })]).state
    expect(reducePointer(panning, mouse('move', 50, 50, { pointerId: 9 })).actions).toEqual([])
    expect(reducePointer(panning, mouse('leave', 50, 50, { pointerId: 9 })).actions).toEqual([])
    const pinching = run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)]).state
    expect(reducePointer(pinching, mouse('move', 50, 50, { pointerId: 9 })).actions).toEqual([])
  })

  it('there is no hover while a button is held on a target or on empty space', () => {
    const onTarget = run([mouse('down', 5, 5, { overTarget: true })]).state
    expect(reducePointer(onTarget, mouse('move', 6, 6)).actions).toEqual([])
    const rubber = run([mouse('down', 5, 5)]).state
    expect(reducePointer(rubber, mouse('move', 6, 6)).actions).toEqual([])
  })

  it('touch never hovers', () => {
    expect(run([touch('move', 1, 4, 5)]).actions).toEqual([])
    expect(run([touch('leave', 1, 4, 5)]).actions).toEqual([])
  })

  it('a mouse that leaves the canvas during an uncaptured press ends the press without a click', () => {
    const onTarget = run([mouse('down', 5, 5, { overTarget: true }), mouse('leave', 200, 5)])
    expect(onTarget.each[1]).toEqual([{ kind: 'hoverEnd' }])
    expect(onTarget.state).toEqual(IDLE)
    const rubber = run([mouse('down', 5, 5), mouse('leave', 200, 5)])
    expect(rubber.each[1]).toEqual([{ kind: 'hoverEnd' }])
    expect(rubber.state).toEqual(IDLE)
  })

  it('a leave during a captured pan changes nothing', () => {
    const panning = run([mouse('down', 5, 5, { button: 1 })]).state
    const out = reducePointer(panning, mouse('leave', 200, 5))
    expect(out.state).toBe(panning)
    expect(out.actions).toEqual([])
  })
})

describe('touch tap and one-finger pan', () => {
  it('a press captures, and a release within 8 px is a tap at the release point', () => {
    const r = run([touch('down', 1, 50, 50), touch('move', 1, 53, 51), touch('up', 1, 55, 50)])
    expect(r.each[0]).toEqual([{ kind: 'capture', pointerId: 1 }])
    expect(r.each[1]).toEqual([])
    expect(r.each[2]).toEqual([{ kind: 'tap', x: 55, y: 50 }])
    expect(r.state).toEqual(IDLE)
  })

  it('exactly 8 px away is still a tap', () => {
    const r = run([touch('down', 1, 50, 50), touch('move', 1, 58, 50), touch('up', 1, 58, 50)])
    expect(r.actions).toEqual([{ kind: 'capture', pointerId: 1 }, { kind: 'tap', x: 58, y: 50 }])
  })

  it('moving 9 px from the start starts a gesture and pans; the release ends it with no tap', () => {
    const r = run([touch('down', 1, 50, 50), touch('move', 1, 59, 50), touch('up', 1, 59, 50)])
    expect(r.each[1]).toEqual([{ kind: 'gestureStart' }, { kind: 'pan', dx: 9, dy: 0 }])
    expect(r.each[2]).toEqual([{ kind: 'gestureEnd' }])
    expect(r.state).toEqual(IDLE)
    expect(kinds(r.actions)).not.toContain('tap')
  })

  it('the first pan carries the whole distance since the press, later pans the delta from the previous point', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('move', 1, 104, 100),
      touch('move', 1, 109, 100),
      touch('move', 1, 112, 95),
      touch('move', 1, 112, 95),
    ])
    expect(r.each[1]).toEqual([])
    expect(r.each[2]).toEqual([{ kind: 'gestureStart' }, { kind: 'pan', dx: 9, dy: 0 }])
    expect(r.each[3]).toEqual([{ kind: 'pan', dx: 3, dy: -5 }])
    expect(r.each[4]).toEqual([])
    const pans = r.actions.filter((a): a is Extract<PointerAction, { kind: 'pan' }> => a.kind === 'pan')
    expect(pans.reduce((s, a) => s + a.dx, 0)).toBe(112 - 100)
    expect(pans.reduce((s, a) => s + a.dy, 0)).toBe(95 - 100)
  })

  it('a touch that wandered past the slop and came back is still a pan, not a tap', () => {
    const r = run([
      touch('down', 1, 50, 50),
      touch('move', 1, 70, 50),
      touch('move', 1, 51, 50),
      touch('up', 1, 51, 50),
    ])
    expect(kinds(r.actions)).not.toContain('tap')
    expect(r.actions[r.actions.length - 1]).toEqual({ kind: 'gestureEnd' })
  })

  it('uses a diagonal distance for the slop', () => {
    // 6 px right and 6 px down is about 8.49 px: past the slop
    const r = run([touch('down', 1, 0, 0), touch('move', 1, 6, 6)])
    expect(r.each[1][0]).toEqual({ kind: 'gestureStart' })
    // 5 px right and 5 px down is about 7.07 px: inside it
    const inside = run([touch('down', 1, 0, 0), touch('move', 1, 5, 5), touch('up', 1, 5, 5)])
    expect(inside.actions[inside.actions.length - 1]).toEqual({ kind: 'tap', x: 5, y: 5 })
  })
})

describe('two touches pinch', () => {
  it('the second touch captures and starts the gesture (once)', () => {
    const r = run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)])
    expect(r.each[1]).toEqual([{ kind: 'capture', pointerId: 2 }, { kind: 'gestureStart' }])
    expect(r.state.mode).toBe('pinch')
    expect(r.state.gesture).toBe(true)
    // the first touch had already become a pan: no second gestureStart
    const panned = run([touch('down', 1, 100, 100), touch('move', 1, 130, 100), touch('down', 2, 200, 100)])
    expect(panned.each[2]).toEqual([{ kind: 'capture', pointerId: 2 }])
    expect(panned.state.mode).toBe('pinch')
  })

  it('moving the points from distance 60 to 120 zooms by 2 in total about the midpoint', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('move', 1, 70, 100),
      touch('move', 2, 190, 100),
    ])
    const zooms = r.actions.filter((a): a is Extract<PointerAction, { kind: 'zoom' }> => a.kind === 'zoom')
    expect(zooms).toHaveLength(2)
    expect(Math.abs(zooms.reduce((p, a) => p * a.factor, 1) - 2)).toBeLessThan(1e-9)
    // the midpoint started at (130, 100); after the first finger moved it is (115, 100)
    expect(zooms[0]).toEqual({ kind: 'zoom', factor: 1.5, x: 130, y: 100 })
    expect(zooms[1]?.x).toBe(115)
    expect(zooms[1]?.y).toBe(100)
    expect(zooms[1]?.factor).toBeCloseTo(4 / 3, 12)
  })

  it('a symmetric spread has a net pan of zero: the midpoint returns to where it began', () => {
    const r = run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)])
    // a pointer event moves one finger at a time, so the midpoint drifts and comes back:
    // finger 1 100 -> 70 moves it left, finger 2 160 -> 190 moves it back
    const moved = run(
      [touch('move', 1, 70, 100), touch('move', 2, 190, 100)],
      r.state,
    )
    const pans = moved.actions.filter((a): a is Extract<PointerAction, { kind: 'pan' }> => a.kind === 'pan')
    expect(pans.reduce((s, a) => s + a.dx, 0)).toBe(0)
    expect(pans.reduce((s, a) => s + a.dy, 0)).toBe(0)
  })

  it('pans by the midpoint delta, and zoom comes first so the midpoint stays anchored', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('move', 1, 100, 140),
    ])
    // finger 1 moved down 40: distance sqrt(60^2 + 40^2), midpoint (130, 120)
    expect(r.each[2].map(a => a.kind)).toEqual(['zoom', 'pan'])
    expect(r.each[2][1]).toEqual({ kind: 'pan', dx: 0, dy: 20 })
  })

  it('property: the world point under the first midpoint ends under the last midpoint, scaled by the distance ratio', () => {
    // Apply the actions to a screen = t + world * s transform exactly as a consumer would.
    interface T { s: number; tx: number; ty: number }
    const apply = (t: T, actions: readonly PointerAction[]): T => {
      let { s, tx, ty } = t
      for (const a of actions) {
        if (a.kind === 'zoom') {
          s *= a.factor
          tx = a.x - (a.x - tx) * a.factor
          ty = a.y - (a.y - ty) * a.factor
        } else if (a.kind === 'pan') {
          tx += a.dx
          ty += a.dy
        }
      }
      return { s, tx, ty }
    }
    const coord = fc.integer({ min: 0, max: 300 })
    const step = fc.record({ finger: fc.constantFrom(1, 2), x: coord, y: coord })
    fc.assert(
      fc.property(coord, coord, coord, coord, fc.array(step, { minLength: 1, maxLength: 8 }), (ax, ay, bx, by, steps) => {
        const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
        const pos = { 1: { x: ax, y: ay }, 2: { x: bx, y: by } }
        fc.pre(dist(pos[1], pos[2]) >= 1)
        const d0 = dist(pos[1], pos[2])
        const m0 = { x: (pos[1].x + pos[2].x) / 2, y: (pos[1].y + pos[2].y) / 2 }
        let state = run([touch('down', 1, ax, ay), touch('down', 2, bx, by)]).state
        let t: T = { s: 1, tx: 0, ty: 0 }
        for (const st of steps) {
          pos[st.finger] = { x: st.x, y: st.y }
          fc.pre(dist(pos[1], pos[2]) >= 1)
          const out = reducePointer(state, touch('move', st.finger, st.x, st.y))
          state = out.state
          t = apply(t, out.actions)
        }
        const d1 = dist(pos[1], pos[2])
        const m1 = { x: (pos[1].x + pos[2].x) / 2, y: (pos[1].y + pos[2].y) / 2 }
        // the world point that was under m0 (identity transform: world = screen) is now at t + m0 * s
        expect(t.s).toBeCloseTo(d1 / d0, 6)
        expect(t.tx + m0.x * t.s).toBeCloseTo(m1.x, 6)
        expect(t.ty + m0.y * t.s).toBeCloseTo(m1.y, 6)
      }),
      { numRuns: 200 },
    )
  })

  it('never emits a zoom with a non-finite or non-positive factor, and recovers from coincident fingers', () => {
    // both fingers land on the same point: distance 0, no baseline yet
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 100, 100),
      touch('move', 2, 140, 100),
      touch('move', 2, 180, 100),
    ])
    const zooms = r.actions.filter((a): a is Extract<PointerAction, { kind: 'zoom' }> => a.kind === 'zoom')
    // the first separation only sets the baseline (distance 40); the next one zooms 80/40 = 2
    expect(zooms).toHaveLength(1)
    expect(zooms[0]?.factor).toBe(2)
    for (const a of zooms) {
      expect(Number.isFinite(a.factor) && a.factor > 0).toBe(true)
    }
  })

  it('fingers brought together to distance 0 do not break the zoom for the rest of the gesture', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 140, 100),
      touch('move', 2, 100, 100), // distance 0
      touch('move', 2, 180, 100), // back out: factor is relative to the last valid distance (40)
    ])
    const zooms = r.actions.filter((a): a is Extract<PointerAction, { kind: 'zoom' }> => a.kind === 'zoom')
    expect(zooms.every(a => Number.isFinite(a.factor) && a.factor > 0)).toBe(true)
    expect(zooms[zooms.length - 1]?.factor).toBeCloseTo(80 / 40, 12)
  })

  it('a third touch is ignored', () => {
    const pinching = run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)]).state
    const out = reducePointer(pinching, touch('down', 3, 10, 10))
    expect(out.state).toBe(pinching)
    expect(out.actions).toEqual([])
    expect(reducePointer(pinching, touch('move', 3, 20, 20)).actions).toEqual([])
    expect(reducePointer(pinching, touch('up', 3, 20, 20)).state).toBe(pinching)
  })

  it('a touch joins only another touch: a mouse or a second mouse is ignored while a pointer is down', () => {
    const touching = run([touch('down', 1, 100, 100)]).state
    expect(reducePointer(touching, mouse('down', 5, 5, { pointerId: 2 })).state).toBe(touching)
    const mousing = run([mouse('down', 5, 5, { overTarget: true })]).state
    expect(reducePointer(mousing, touch('down', 2, 100, 100)).state).toBe(mousing)
    expect(reducePointer(mousing, mouse('down', 50, 50, { pointerId: 2 })).state).toBe(mousing)
  })

  it('lifting one finger lets the other keep panning, with no new gestureStart, no jump and no tap', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('up', 2, 160, 100),
      touch('move', 1, 104, 100), // inside the slop again: nothing
      touch('move', 1, 120, 100), // past it: pans the whole way from where the finger was when the other lifted
      touch('up', 1, 120, 100),
    ])
    expect(r.each[2]).toEqual([])
    expect(r.each[3]).toEqual([])
    expect(r.each[4]).toEqual([{ kind: 'pan', dx: 20, dy: 0 }])
    expect(r.each[5]).toEqual([{ kind: 'gestureEnd' }])
    expect(r.state).toEqual(IDLE)
    expect(kinds(r.actions)).not.toContain('tap')
  })

  it('lifting both fingers without moving the second ends the gesture and never taps', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('up', 1, 100, 100),
      touch('up', 2, 160, 100),
    ])
    expect(r.each[2]).toEqual([])
    expect(r.each[3]).toEqual([{ kind: 'gestureEnd' }])
    expect(kinds(r.actions)).not.toContain('tap')
    expect(r.state).toEqual(IDLE)
  })

  it('putting a second finger down again continues the same gesture', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('up', 2, 160, 100),
      touch('down', 2, 170, 100),
    ])
    expect(r.each[3]).toEqual([{ kind: 'capture', pointerId: 2 }])
    expect(r.state.mode).toBe('pinch')
  })
})

describe('pointercancel', () => {
  it('cancelling every pointer of a pinch ends the gesture and returns to idle', () => {
    const r = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('cancel', 1, 100, 100),
      touch('cancel', 2, 160, 100),
    ])
    expect(r.each[2]).toEqual([])
    expect(r.each[3]).toEqual([{ kind: 'gestureEnd' }])
    expect(r.state).toEqual(IDLE)
  })

  it('cancelling a pan ends the gesture and returns to idle', () => {
    const touchPan = run([touch('down', 1, 50, 50), touch('move', 1, 80, 50), touch('cancel', 1, 80, 50)])
    expect(touchPan.each[2]).toEqual([{ kind: 'gestureEnd' }])
    expect(touchPan.state).toEqual(IDLE)
    const mousePan = run([mouse('down', 5, 5, { button: 1 }), mouse('cancel', 5, 5)])
    expect(mousePan.each[1]).toEqual([{ kind: 'gestureEnd' }])
    expect(mousePan.state).toEqual(IDLE)
  })

  it('a cancel during a touch press emits no tap and no gesture', () => {
    const r = run([touch('down', 1, 50, 50), touch('cancel', 1, 50, 50)])
    expect(r.each[1]).toEqual([])
    expect(r.state).toEqual(IDLE)
  })

  it('a cancel of a mouse press or rubber band drops it without a click', () => {
    const press = run([mouse('down', 5, 5, { overTarget: true }), mouse('cancel', 5, 5)])
    expect(press.each[1]).toEqual([])
    expect(press.state).toEqual(IDLE)
    const rubber = run([mouse('down', 5, 5), mouse('cancel', 5, 5)])
    expect(rubber.each[1]).toEqual([])
    expect(rubber.state).toEqual(IDLE)
  })

  it('a cancel of a pointer that is not tracked changes nothing', () => {
    const out = reducePointer(IDLE, touch('cancel', 4, 0, 0))
    expect(out.state).toBe(IDLE)
    expect(out.actions).toEqual([])
  })

  it('is processed even when its coordinates are not usable, so no pointer can get stuck', () => {
    const pressed = run([touch('down', 1, 50, 50), touch('move', 1, 80, 50)]).state
    const out = reducePointer(pressed, touch('cancel', 1, NaN, NaN))
    expect(out.state).toEqual(IDLE)
    expect(out.actions).toEqual([{ kind: 'gestureEnd' }])
  })
})

describe('a pointer that goes down twice', () => {
  it('ends the earlier press first, then starts the new one', () => {
    const r = run([mouse('down', 5, 5, { button: 1 }), mouse('down', 20, 20, { overTarget: true })])
    expect(r.each[1]).toEqual([{ kind: 'gestureEnd' }])
    expect(r.state.mode).toBe('press')
    const again = run([mouse('down', 5, 5), mouse('down', 20, 20)])
    expect(again.each[1]).toEqual([{ kind: 'rubberStart', x: 20, y: 20, additive: false }])
  })
})

describe('non-finite input (T-06-17)', () => {
  const bad = [NaN, Infinity, -Infinity]

  it('a down, move or up with a non-finite coordinate changes nothing and emits nothing', () => {
    const states = [
      IDLE,
      run([mouse('down', 5, 5, { overTarget: true })]).state,
      run([mouse('down', 5, 5)]).state,
      run([mouse('down', 5, 5, { button: 1 })]).state,
      run([touch('down', 1, 50, 50)]).state,
      run([touch('down', 1, 50, 50), touch('move', 1, 80, 50)]).state,
      run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)]).state,
    ]
    for (const state of states) {
      for (const v of bad) {
        for (const type of ['down', 'move', 'up'] as const) {
          for (const pointerType of ['mouse', 'touch'] as const) {
            for (const [x, y] of [[v, 10], [10, v], [v, v]] as const) {
              const out = reducePointer(state, ev(type, { pointerType, pointerId: 1, x, y }))
              expect(out.state).toBe(state)
              expect(out.actions).toEqual([])
            }
          }
        }
      }
    }
  })

  it('a non-finite pointer id is ignored', () => {
    for (const type of ['down', 'move', 'up', 'cancel', 'leave'] as const) {
      const out = reducePointer(IDLE, ev(type, { pointerId: NaN, x: 1, y: 1 }))
      expect(out.state).toBe(IDLE)
      expect(out.actions).toEqual([])
    }
  })

  it('a bad event in the middle of a gesture does not corrupt the rest of it', () => {
    const clean = run([touch('down', 1, 100, 100), touch('down', 2, 160, 100), touch('move', 1, 70, 100), touch('move', 2, 190, 100)])
    const dirty = run([
      touch('down', 1, 100, 100),
      touch('down', 2, 160, 100),
      touch('move', 1, NaN, 100),
      touch('move', 1, 70, 100),
      touch('move', 2, Infinity, 5),
      touch('move', 2, 190, 100),
    ])
    expect(dirty.actions).toEqual(clean.actions)
    expect(dirty.state).toEqual(clean.state)
  })
})

describe('purity', () => {
  it('never mutates the state or its map, and returns a new state when something changed', () => {
    const states: PointerState[] = [
      IDLE,
      run([mouse('down', 5, 5, { overTarget: true })]).state,
      run([mouse('down', 5, 5, { button: 1 })]).state,
      run([touch('down', 1, 50, 50)]).state,
      run([touch('down', 1, 100, 100), touch('down', 2, 160, 100)]).state,
    ]
    const inputs: PointerInput[] = [
      mouse('move', 9, 9),
      mouse('up', 9, 9),
      mouse('down', 30, 30, { pointerId: 3 }),
      touch('down', 3, 5, 5),
      touch('move', 1, 70, 70),
      touch('move', 2, 190, 100),
      touch('up', 1, 70, 70),
      touch('up', 2, 190, 100),
      touch('cancel', 1, 0, 0),
      mouse('leave', 9, 9),
    ]
    for (const state of states) {
      const before = JSON.stringify([state.mode, [...state.pointers], state.pinchDistance, state.pinchMidX, state.pinchMidY, state.gesture])
      for (const input of inputs) {
        reducePointer(state, input)
        const after = JSON.stringify([state.mode, [...state.pointers], state.pinchDistance, state.pinchMidX, state.pinchMidY, state.gesture])
        expect(after).toBe(before)
      }
    }
  })

  it('the shared initial state is never changed by a whole run', () => {
    run([mouse('down', 5, 5), mouse('move', 9, 9), mouse('up', 9, 9), touch('down', 1, 1, 1), touch('down', 2, 9, 9)])
    expect(IDLE.mode).toBe('idle')
    expect(IDLE.pointers.size).toBe(0)
    expect(IDLE.gesture).toBe(false)
  })
})

describe('properties over arbitrary event streams', () => {
  const eventArb: fc.Arbitrary<PointerInput> = fc.record({
    type: fc.constantFrom('down', 'move', 'up', 'cancel', 'leave'),
    pointerId: fc.integer({ min: 1, max: 3 }),
    pointerType: fc.constantFrom('mouse', 'pen', 'touch'),
    x: fc.oneof(fc.integer({ min: -50, max: 400 }), fc.constant(NaN), fc.constant(Infinity)),
    y: fc.oneof(fc.integer({ min: -50, max: 400 }), fc.constant(NaN), fc.constant(-Infinity)),
    button: fc.constantFrom(0, 0, 0, 1, 2),
    altKey: fc.boolean(),
    shiftKey: fc.boolean(),
    overTarget: fc.boolean(),
  })

  it('every action carries finite numbers, every zoom factor is positive, and gestures balance', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 60 }), events => {
        let state = IDLE
        let open = false
        for (const e of events) {
          const out = reducePointer(state, e)
          state = out.state
          for (const a of out.actions) {
            for (const v of Object.values(a)) {
              if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
            }
            if (a.kind === 'zoom') expect(a.factor).toBeGreaterThan(0)
            if (a.kind === 'gestureStart') {
              expect(open).toBe(false)
              open = true
            }
            if (a.kind === 'gestureEnd') {
              expect(open).toBe(true)
              open = false
            }
          }
          // the gesture flag in the state always agrees with the actions emitted so far
          expect(state.gesture).toBe(open)
          if (state.mode === 'idle') {
            expect(state.pointers.size).toBe(0)
            expect(open).toBe(false)
          }
          expect(state.pointers.size).toBeLessThanOrEqual(2)
        }
      }),
      { numRuns: 500 },
    )
  })

  it('a stream ending with a cancel of every pointer always lands idle with no open gesture', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 40 }), events => {
        let state = IDLE
        for (const e of events) state = reducePointer(state, e).state
        for (const id of [1, 2, 3]) state = reducePointer(state, ev('cancel', { pointerId: id })).state
        expect(state.mode).toBe('idle')
        expect(state.pointers.size).toBe(0)
        expect(state.gesture).toBe(false)
      }),
      { numRuns: 300 },
    )
  })
})

describe('wheelZoomFactor', () => {
  it('is the existing exp(-step x 0.0015) with the step clamped to +-100', () => {
    expect(wheelZoomFactor(-100, 0)).toBe(Math.exp(0.15))
    expect(wheelZoomFactor(100, 0)).toBe(Math.exp(-0.15))
    expect(wheelZoomFactor(-1000, 0)).toBe(wheelZoomFactor(-100, 0))
    expect(wheelZoomFactor(1000, 0)).toBe(wheelZoomFactor(100, 0))
    expect(wheelZoomFactor(0, 0)).toBe(1)
    expect(wheelZoomFactor(-40, 0)).toBe(Math.exp(40 * 0.0015))
  })

  it('normalizes line and page deltas first (line x16, page x120)', () => {
    expect(wheelZoomFactor(-1, 1)).toBe(Math.exp(16 * 0.0015))
    expect(wheelZoomFactor(1, 2)).toBe(Math.exp(-100 * 0.0015))
    expect(wheelZoomFactor(-1, 2)).toBe(Math.exp(100 * 0.0015))
    expect(wheelZoomFactor(10, 1)).toBe(wheelZoomFactor(160, 0))
    expect(wheelZoomFactor(10, 3)).toBe(wheelZoomFactor(10, 0))
  })

  it('scrolling up (negative delta) zooms in, scrolling down zooms out', () => {
    expect(wheelZoomFactor(-10, 0)).toBeGreaterThan(1)
    expect(wheelZoomFactor(10, 0)).toBeLessThan(1)
  })

  it('never returns a non-finite or non-positive factor', () => {
    expect(wheelZoomFactor(NaN, 0)).toBe(1)
    expect(wheelZoomFactor(Infinity, 0)).toBe(Math.exp(-100 * 0.0015))
    expect(wheelZoomFactor(-Infinity, 0)).toBe(Math.exp(100 * 0.0015))
    fc.assert(
      fc.property(fc.double({ noNaN: false }), fc.constantFrom(0, 1, 2, 3), (dy, mode) => {
        const f = wheelZoomFactor(dy, mode)
        expect(Number.isFinite(f) && f > 0).toBe(true)
        expect(f).toBeGreaterThanOrEqual(Math.exp(-100 * 0.0015))
        expect(f).toBeLessThanOrEqual(Math.exp(100 * 0.0015))
      }),
    )
  })

  it('is monotonic: a larger upward scroll never zooms in less', () => {
    fc.assert(
      fc.property(fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true }), (a, b) => {
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        expect(wheelZoomFactor(lo, 0)).toBeGreaterThanOrEqual(wheelZoomFactor(hi, 0))
      }),
    )
  })
})
