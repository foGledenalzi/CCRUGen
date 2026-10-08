// Tests for app/lib/canvas/keyboardModel.ts (Phase 6 D-08, REN-02): the pure keyboard model of the one focusable
// Canvas-tier element. Arrow keys move between visible zones in zone-id order, Tab steps through the focused zone's
// syzygy, current and gate and then leaves, muted zones and absent edges are never a stop, and the focus-key and
// announcement strings are the SVG tier's own. The text fixture comes from the real base-28 view so the expected
// strings are not retyped from the model's own templates.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../../app/lib/labelScheme'
import { buildNumogramView } from '../../app/lib/numogramView'
import { regionLabel, type RegionId } from '../../app/lib/regions'
import {
  PAGE_STEP,
  activationAnnouncement,
  announcementFor,
  focusKeyOf,
  initialTarget,
  nextTarget,
  type KeyOutcome,
  type KeyboardContext,
  type RingTarget,
  type TargetText,
} from '../../app/lib/canvas/keyboardModel'

const BASE = 28
const g = createNumogram(BASE)
const view = buildNumogramView(g)
const labels = zoneLabelsFor(BASE, DEFAULT_LABEL_SCHEME)

const ALL_ZONES: readonly number[] = Object.freeze(Array.from({ length: g.zoneCount }, (_, z) => z))
const ALL_PAIRS: readonly number[] = Object.freeze(Array.from({ length: g.pairCount }, (_, q) => q))
const LAST_ZONE = ALL_ZONES.length - 1

interface EdgeFlags {
  readonly syzygy?: boolean
  readonly current?: boolean
  readonly gate?: boolean
}

function zonesCtx(order: readonly number[] = ALL_ZONES, edges: EdgeFlags = {}): KeyboardContext {
  const { syzygy = true, current = true, gate = true } = edges
  return {
    mode: 'zones',
    order,
    hasSyzygy: () => syzygy,
    hasCurrent: () => current,
    hasGate: () => gate,
  }
}

function pairsCtx(order: readonly number[] = ALL_PAIRS): KeyboardContext {
  return { mode: 'pairs', order, hasSyzygy: () => false, hasCurrent: () => false, hasGate: () => false }
}

const zone = (z: number): RingTarget => ({ kind: 'zone', zone: z })
const syzygy = (z: number): RingTarget => ({ kind: 'syzygy', zone: z })
const currentOf = (z: number): RingTarget => ({ kind: 'current', zone: z })
const gate = (z: number): RingTarget => ({ kind: 'gate', zone: z })
const pair = (q: number): RingTarget => ({ kind: 'pair', pair: q })
const move = (target: RingTarget): KeyOutcome => ({ kind: 'move', target })
const activate = (target: RingTarget): KeyOutcome => ({ kind: 'activate', target })
const LEAVE: KeyOutcome = { kind: 'leave' }
const IGNORE: KeyOutcome = { kind: 'ignore' }

/** All of the order without the muted zones. */
function without(order: readonly number[], ...muted: number[]): readonly number[] {
  return order.filter(z => !muted.includes(z))
}

describe('PAGE_STEP', () => {
  it('is the UI-SPEC jump of 10 zones', () => {
    expect(PAGE_STEP).toBe(10)
  })
})

describe('initialTarget', () => {
  it('is the first visible zone in zones mode and the first visible pair in pairs mode', () => {
    expect(initialTarget(zonesCtx())).toEqual(zone(0))
    expect(initialTarget(zonesCtx(without(ALL_ZONES, 0, 1)))).toEqual(zone(2))
    expect(initialTarget(pairsCtx())).toEqual(pair(0))
    expect(initialTarget(pairsCtx([5, 6, 7]))).toEqual(pair(5))
  })

  it('is null for an empty order', () => {
    expect(initialTarget(zonesCtx([]))).toBeNull()
    expect(initialTarget(pairsCtx([]))).toBeNull()
  })
})

describe('nextTarget: zones mode, arrows, Home, End', () => {
  const ctx = zonesCtx()

  it('ArrowRight and ArrowDown move to the next zone', () => {
    expect(nextTarget(zone(5), 'ArrowRight', false, ctx)).toEqual(move(zone(6)))
    expect(nextTarget(zone(5), 'ArrowDown', false, ctx)).toEqual(move(zone(6)))
  })

  it('ArrowLeft and ArrowUp move to the previous zone', () => {
    expect(nextTarget(zone(5), 'ArrowLeft', false, ctx)).toEqual(move(zone(4)))
    expect(nextTarget(zone(5), 'ArrowUp', false, ctx)).toEqual(move(zone(4)))
  })

  it('wraps at both ends', () => {
    expect(nextTarget(zone(LAST_ZONE), 'ArrowRight', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(zone(LAST_ZONE), 'ArrowDown', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(zone(0), 'ArrowLeft', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(zone(0), 'ArrowUp', false, ctx)).toEqual(move(zone(LAST_ZONE)))
  })

  it('Home and End jump to the first and last zone of the order', () => {
    expect(nextTarget(zone(9), 'Home', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(zone(9), 'End', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    const muted = zonesCtx(without(ALL_ZONES, 0, LAST_ZONE))
    expect(nextTarget(zone(9), 'Home', false, muted)).toEqual(move(zone(1)))
    expect(nextTarget(zone(9), 'End', false, muted)).toEqual(move(zone(LAST_ZONE - 1)))
  })

  it('a shifted arrow key behaves like the plain arrow key', () => {
    expect(nextTarget(zone(5), 'ArrowRight', true, ctx)).toEqual(move(zone(6)))
  })
})

describe('nextTarget: zones mode, Page Up and Page Down', () => {
  const ctx = zonesCtx()

  it('jump PAGE_STEP zones, clamped to the order, never wrapping', () => {
    expect(nextTarget(zone(3), 'PageDown', false, ctx)).toEqual(move(zone(3 + PAGE_STEP)))
    expect(nextTarget(zone(3), 'PageDown', false, ctx)).toEqual(move(zone(13)))
    expect(nextTarget(zone(25), 'PageDown', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(zone(LAST_ZONE), 'PageDown', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(zone(4), 'PageUp', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(zone(0), 'PageUp', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(zone(15), 'PageUp', false, ctx)).toEqual(move(zone(5)))
  })

  it('count positions in the order, not zone ids, when zones are muted', () => {
    const muted = zonesCtx(without(ALL_ZONES, 6))
    // order is [0..5, 7..27]; index 5 is zone 5 and index 15 is zone 16
    expect(nextTarget(zone(5), 'PageDown', false, muted)).toEqual(move(zone(16)))
    expect(nextTarget(zone(16), 'PageUp', false, muted)).toEqual(move(zone(5)))
  })
})

describe('nextTarget: muted zones', () => {
  it('a muted zone is skipped by the arrow keys in both directions', () => {
    const muted = zonesCtx(without(ALL_ZONES, 6))
    expect(nextTarget(zone(5), 'ArrowRight', false, muted)).toEqual(move(zone(7)))
    expect(nextTarget(zone(7), 'ArrowLeft', false, muted)).toEqual(move(zone(5)))
  })

  it('the wrap goes around muted end zones', () => {
    const muted = zonesCtx(without(ALL_ZONES, 0, LAST_ZONE))
    expect(nextTarget(zone(LAST_ZONE - 1), 'ArrowRight', false, muted)).toEqual(move(zone(1)))
    expect(nextTarget(zone(1), 'ArrowLeft', false, muted)).toEqual(move(zone(LAST_ZONE - 1)))
  })
})

describe('nextTarget: Tab through a zone\'s edges', () => {
  const all = zonesCtx()

  it('Tab steps syzygy, current, gate and then leaves', () => {
    expect(nextTarget(zone(5), 'Tab', false, all)).toEqual(move(syzygy(5)))
    expect(nextTarget(syzygy(5), 'Tab', false, all)).toEqual(move(currentOf(5)))
    expect(nextTarget(currentOf(5), 'Tab', false, all)).toEqual(move(gate(5)))
    expect(nextTarget(gate(5), 'Tab', false, all)).toEqual(LEAVE)
  })

  it('Tab skips an absent syzygy, current or gate', () => {
    const noSyzygy = zonesCtx(ALL_ZONES, { syzygy: false })
    expect(nextTarget(zone(5), 'Tab', false, noSyzygy)).toEqual(move(currentOf(5)))
    const noCurrent = zonesCtx(ALL_ZONES, { current: false })
    expect(nextTarget(zone(5), 'Tab', false, noCurrent)).toEqual(move(syzygy(5)))
    expect(nextTarget(syzygy(5), 'Tab', false, noCurrent)).toEqual(move(gate(5)))
    const noGate = zonesCtx(ALL_ZONES, { gate: false })
    expect(nextTarget(currentOf(5), 'Tab', false, noGate)).toEqual(LEAVE)
  })

  it('Tab leaves at once when the zone has no edge to step to', () => {
    const none = zonesCtx(ALL_ZONES, { syzygy: false, current: false, gate: false })
    expect(nextTarget(zone(5), 'Tab', false, none)).toEqual(LEAVE)
    const onlySyzygy = zonesCtx(ALL_ZONES, { current: false, gate: false })
    expect(nextTarget(syzygy(5), 'Tab', false, onlySyzygy)).toEqual(LEAVE)
  })

  it('asks the context about the ring\'s own zone', () => {
    const asked: number[] = []
    const ctx: KeyboardContext = {
      mode: 'zones',
      order: ALL_ZONES,
      hasSyzygy: z => {
        asked.push(z)
        return z === 9
      },
      hasCurrent: () => false,
      hasGate: () => false,
    }
    expect(nextTarget(zone(8), 'Tab', false, ctx)).toEqual(LEAVE)
    expect(nextTarget(zone(9), 'Tab', false, ctx)).toEqual(move(syzygy(9)))
    expect(asked).toEqual([8, 9])
  })
})

describe('nextTarget: Shift+Tab mirrors Tab', () => {
  const all = zonesCtx()

  it('steps back through gate, current, syzygy, zone and then leaves', () => {
    expect(nextTarget(gate(5), 'Tab', true, all)).toEqual(move(currentOf(5)))
    expect(nextTarget(currentOf(5), 'Tab', true, all)).toEqual(move(syzygy(5)))
    expect(nextTarget(syzygy(5), 'Tab', true, all)).toEqual(move(zone(5)))
    expect(nextTarget(zone(5), 'Tab', true, all)).toEqual(LEAVE)
  })

  it('skips an absent stop on the way back', () => {
    const noSyzygy = zonesCtx(ALL_ZONES, { syzygy: false })
    expect(nextTarget(currentOf(5), 'Tab', true, noSyzygy)).toEqual(move(zone(5)))
    const noCurrent = zonesCtx(ALL_ZONES, { current: false })
    expect(nextTarget(gate(5), 'Tab', true, noCurrent)).toEqual(move(syzygy(5)))
    const none = zonesCtx(ALL_ZONES, { syzygy: false, current: false })
    expect(nextTarget(gate(5), 'Tab', true, none)).toEqual(move(zone(5)))
  })
})

describe('nextTarget: a key pressed while the ring is on an edge', () => {
  const ctx = zonesCtx()

  it('an arrow key moves to the next or previous zone after the edge\'s owner, at zone level', () => {
    expect(nextTarget(syzygy(5), 'ArrowRight', false, ctx)).toEqual(move(zone(6)))
    expect(nextTarget(currentOf(5), 'ArrowDown', false, ctx)).toEqual(move(zone(6)))
    expect(nextTarget(gate(5), 'ArrowLeft', false, ctx)).toEqual(move(zone(4)))
    expect(nextTarget(syzygy(5), 'ArrowUp', false, ctx)).toEqual(move(zone(4)))
  })

  it('the next zone is the next visible one when the following zone is muted', () => {
    const muted = zonesCtx(without(ALL_ZONES, 6))
    expect(nextTarget(gate(5), 'ArrowRight', false, muted)).toEqual(move(zone(7)))
  })

  it('Home, End and the Page keys also return to zone level', () => {
    expect(nextTarget(currentOf(5), 'Home', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(currentOf(5), 'End', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(gate(5), 'PageDown', false, ctx)).toEqual(move(zone(15)))
    expect(nextTarget(syzygy(12), 'PageUp', false, ctx)).toEqual(move(zone(2)))
  })
})

describe('nextTarget: activation and zoom keys', () => {
  const ctx = zonesCtx()

  it('Enter and Space activate the current target, edge or zone', () => {
    expect(nextTarget(zone(5), 'Enter', false, ctx)).toEqual(activate(zone(5)))
    expect(nextTarget(zone(5), ' ', false, ctx)).toEqual(activate(zone(5)))
    expect(nextTarget(syzygy(5), 'Enter', false, ctx)).toEqual(activate(syzygy(5)))
    expect(nextTarget(currentOf(5), ' ', false, ctx)).toEqual(activate(currentOf(5)))
    expect(nextTarget(gate(5), 'Enter', false, ctx)).toEqual(activate(gate(5)))
  })

  it('plus and equals zoom in, minus and underscore zoom out, zero fits', () => {
    expect(nextTarget(zone(5), '+', false, ctx)).toEqual({ kind: 'zoom', action: 'in' })
    expect(nextTarget(zone(5), '=', false, ctx)).toEqual({ kind: 'zoom', action: 'in' })
    expect(nextTarget(zone(5), '-', false, ctx)).toEqual({ kind: 'zoom', action: 'out' })
    expect(nextTarget(zone(5), '_', false, ctx)).toEqual({ kind: 'zoom', action: 'out' })
    expect(nextTarget(zone(5), '0', false, ctx)).toEqual({ kind: 'zoom', action: 'fit' })
    expect(nextTarget(gate(5), '+', true, ctx)).toEqual({ kind: 'zoom', action: 'in' })
  })

  it('any other key is ignored, including Escape (the app uses it to clear the selection)', () => {
    expect(nextTarget(zone(5), 'a', false, ctx)).toEqual(IGNORE)
    expect(nextTarget(zone(5), 'Escape', false, ctx)).toEqual(IGNORE)
    expect(nextTarget(zone(5), 'F5', false, ctx)).toEqual(IGNORE)
    expect(nextTarget(zone(5), '', false, ctx)).toEqual(IGNORE)
  })
})

describe('nextTarget: pairs mode (pair graph)', () => {
  const ctx = pairsCtx()
  const lastPair = ALL_PAIRS.length - 1

  it('arrows, Home, End and the Page keys visit pairs in pair-id order', () => {
    expect(nextTarget(pair(3), 'ArrowRight', false, ctx)).toEqual(move(pair(4)))
    expect(nextTarget(pair(3), 'ArrowDown', false, ctx)).toEqual(move(pair(4)))
    expect(nextTarget(pair(3), 'ArrowLeft', false, ctx)).toEqual(move(pair(2)))
    expect(nextTarget(pair(3), 'ArrowUp', false, ctx)).toEqual(move(pair(2)))
    expect(nextTarget(pair(lastPair), 'ArrowRight', false, ctx)).toEqual(move(pair(0)))
    expect(nextTarget(pair(0), 'ArrowLeft', false, ctx)).toEqual(move(pair(lastPair)))
    expect(nextTarget(pair(3), 'Home', false, ctx)).toEqual(move(pair(0)))
    expect(nextTarget(pair(3), 'End', false, ctx)).toEqual(move(pair(lastPair)))
    expect(nextTarget(pair(1), 'PageDown', false, ctx)).toEqual(move(pair(1 + PAGE_STEP)))
    expect(nextTarget(pair(lastPair - 1), 'PageDown', false, ctx)).toEqual(move(pair(lastPair)))
    expect(nextTarget(pair(4), 'PageUp', false, ctx)).toEqual(move(pair(0)))
  })

  it('a muted pair is skipped', () => {
    const muted = pairsCtx(ALL_PAIRS.filter(q => q !== 4))
    expect(nextTarget(pair(3), 'ArrowRight', false, muted)).toEqual(move(pair(5)))
    expect(nextTarget(pair(5), 'ArrowLeft', false, muted)).toEqual(move(pair(3)))
  })

  it('Tab and Shift+Tab leave at once (no sub-stops)', () => {
    expect(nextTarget(pair(3), 'Tab', false, ctx)).toEqual(LEAVE)
    expect(nextTarget(pair(3), 'Tab', true, ctx)).toEqual(LEAVE)
  })

  it('Enter and Space activate the pair, zoom keys zoom', () => {
    expect(nextTarget(pair(3), 'Enter', false, ctx)).toEqual(activate(pair(3)))
    expect(nextTarget(pair(3), ' ', false, ctx)).toEqual(activate(pair(3)))
    expect(nextTarget(pair(3), '+', false, ctx)).toEqual({ kind: 'zoom', action: 'in' })
    expect(nextTarget(pair(3), '0', false, ctx)).toEqual({ kind: 'zoom', action: 'fit' })
    expect(nextTarget(pair(3), 'a', false, ctx)).toEqual(IGNORE)
  })
})

describe('nextTarget: an empty order', () => {
  it('Tab and Shift+Tab leave, every other key is ignored', () => {
    for (const ctx of [zonesCtx([]), pairsCtx([])]) {
      expect(nextTarget(null, 'Tab', false, ctx)).toEqual(LEAVE)
      expect(nextTarget(null, 'Tab', true, ctx)).toEqual(LEAVE)
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageDown', 'PageUp', 'Enter', ' ', '+', '-', '0', 'a']) {
        expect(nextTarget(null, key, false, ctx)).toEqual(IGNORE)
      }
    }
  })
})

describe('nextTarget: no ring yet, or a ring that is no longer in the order', () => {
  it('a null ring is treated as the initial target before the key applies', () => {
    const ctx = zonesCtx()
    expect(nextTarget(null, 'ArrowRight', false, ctx)).toEqual(move(zone(1)))
    expect(nextTarget(null, 'ArrowLeft', false, ctx)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(null, 'Home', false, ctx)).toEqual(move(zone(0)))
    expect(nextTarget(null, 'Enter', false, ctx)).toEqual(activate(zone(0)))
    expect(nextTarget(null, 'Tab', false, ctx)).toEqual(move(syzygy(0)))
    expect(nextTarget(null, 'Tab', true, ctx)).toEqual(LEAVE)
    expect(nextTarget(null, 'ArrowRight', false, pairsCtx())).toEqual(move(pair(1)))
  })

  it('a zone that was muted since is treated as the initial target before the key applies', () => {
    const muted = zonesCtx(without(ALL_ZONES, 6))
    expect(nextTarget(zone(6), 'ArrowRight', false, muted)).toEqual(move(zone(1)))
    expect(nextTarget(zone(6), 'ArrowLeft', false, muted)).toEqual(move(zone(LAST_ZONE)))
    expect(nextTarget(zone(6), 'Enter', false, muted)).toEqual(activate(zone(0)))
    expect(nextTarget(zone(6), 'Tab', false, muted)).toEqual(move(syzygy(0)))
  })

  it('an edge whose owner zone is no longer in the order is treated the same way', () => {
    const muted = zonesCtx(without(ALL_ZONES, 6))
    expect(nextTarget(gate(6), 'ArrowRight', false, muted)).toEqual(move(zone(1)))
    expect(nextTarget(syzygy(6), 'Tab', false, muted)).toEqual(move(syzygy(0)))
  })

  it('a ring of the wrong kind for the mode is treated as the initial target', () => {
    expect(nextTarget(pair(3), 'ArrowRight', false, zonesCtx())).toEqual(move(zone(1)))
    expect(nextTarget(zone(3), 'ArrowRight', false, pairsCtx())).toEqual(move(pair(1)))
    expect(nextTarget(gate(3), 'Enter', false, pairsCtx())).toEqual(activate(pair(0)))
    expect(nextTarget(pair(99), 'ArrowRight', false, pairsCtx())).toEqual(move(pair(1)))
  })
})

describe('nextTarget: purity', () => {
  it('does not mutate the order or the target it is given', () => {
    const order = Object.freeze([0, 2, 4, 6]) as readonly number[]
    const target = Object.freeze({ kind: 'zone', zone: 2 } as const) as RingTarget
    const ctx = zonesCtx(order)
    expect(() => {
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageDown', 'PageUp', 'Tab', 'Enter', '+']) {
        nextTarget(target, key, false, ctx)
        nextTarget(target, key, true, ctx)
      }
    }).not.toThrow()
    expect(order).toEqual([0, 2, 4, 6])
    expect(target).toEqual({ kind: 'zone', zone: 2 })
  })

  it('returns the same answer for the same input', () => {
    const ctx = zonesCtx()
    expect(nextTarget(zone(5), 'ArrowRight', false, ctx)).toEqual(nextTarget(zone(5), 'ArrowRight', false, ctx))
  })
})

describe('nextTarget: properties over arbitrary orders (T-06-18)', () => {
  const KEYS = [
    'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageDown', 'PageUp',
    'Tab', 'Enter', ' ', '+', '=', '-', '_', '0', 'a', 'Escape',
  ] as const

  const orderArb = fc
    .uniqueArray(fc.integer({ min: 0, max: 4000 }), { minLength: 0, maxLength: 60 })
    .map(a => a.slice().sort((x, y) => x - y))

  it('a move always lands on a member of the order, and Page keys never wrap', () => {
    fc.assert(
      fc.property(
        orderArb,
        fc.constantFrom('zones' as const, 'pairs' as const),
        fc.integer({ min: -5, max: 4005 }),
        fc.constantFrom(...KEYS),
        fc.boolean(),
        (order, mode, unit, key, shift) => {
          const ctx: KeyboardContext =
            mode === 'zones' ? zonesCtx(order) : { ...pairsCtx(order) }
          const target: RingTarget = mode === 'zones' ? zone(unit) : pair(unit)
          const out = nextTarget(target, key, shift, ctx)
          if (order.length === 0) {
            expect(out).toEqual(key === 'Tab' ? LEAVE : IGNORE)
            return
          }
          if (out.kind === 'move' || out.kind === 'activate') {
            const t = out.target
            const u = t.kind === 'pair' ? t.pair : t.zone
            expect(order).toContain(u)
          }
          if (out.kind === 'move' && (key === 'PageDown' || key === 'PageUp')) {
            const from = order.includes(unit) ? order.indexOf(unit) : 0
            const t = out.target
            const to = order.indexOf(t.kind === 'pair' ? t.pair : t.zone)
            if (key === 'PageDown') expect(to).toBe(Math.min(from + PAGE_STEP, order.length - 1))
            else expect(to).toBe(Math.max(from - PAGE_STEP, 0))
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('an arrow key steps exactly one position, wrapping', () => {
    fc.assert(
      fc.property(orderArb.filter(o => o.length > 0), fc.nat(), fc.boolean(), (order, pick, forward) => {
        const idx = pick % order.length
        const out = nextTarget(zone(order[idx]!), forward ? 'ArrowRight' : 'ArrowLeft', false, zonesCtx(order))
        const expected = order[(idx + (forward ? 1 : order.length - 1)) % order.length]!
        expect(out).toEqual(move(zone(expected)))
      }),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Text: focus keys and announcements, built from the real base-28 view
// ---------------------------------------------------------------------------------------------------------------------

function makeText(opts: { selected?: ReadonlySet<number>; zoneRegion?: readonly RegionId[] } = {}): TargetText {
  const selected = opts.selected ?? new Set<number>()
  return {
    zoneLabels: labels,
    zoneRegion: opts.zoneRegion ?? view.zoneRegion,
    syzygyOf: z => view.syzygies.find(s => s.a === z || s.b === z) ?? null,
    currentOf: z => view.currents.find(c => c.from === z || view.partner(c.from) === z) ?? null,
    gateOf: z => view.gates.find(gt => gt.from === z) ?? null,
    pairOf: q => g.pair(q),
    isSelected: z => selected.has(z),
  }
}

describe('focusKeyOf', () => {
  const text = makeText()

  it('uses the SVG tier\'s data-focus-key grammar', () => {
    expect(focusKeyOf(zone(15), text)).toBe('zone:15')
    expect(focusKeyOf(syzygy(13), text)).toBe('syzygy:13:14')
    expect(focusKeyOf(pair(3), text)).toBe('pair:3')
    const c = view.currents.find(cur => cur.from === 5 || view.partner(cur.from) === 5)!
    expect(focusKeyOf(currentOf(5), text)).toBe(`current:${c.name}`)
    const gt = view.gates.find(x => x.from === 5)!
    expect(focusKeyOf(gate(5), text)).toBe(`gate:${gt.name}`)
  })

  it('both members of a pair resolve to the same syzygy key', () => {
    expect(focusKeyOf(syzygy(14), text)).toBe('syzygy:13:14')
    expect(focusKeyOf(syzygy(13), text)).toBe(focusKeyOf(syzygy(14), text))
  })

  it('an edge that does not exist degrades to its owner zone\'s key', () => {
    const none: TargetText = { ...text, syzygyOf: () => null, currentOf: () => null, gateOf: () => null }
    expect(focusKeyOf(syzygy(5), none)).toBe('zone:5')
    expect(focusKeyOf(currentOf(5), none)).toBe('zone:5')
    expect(focusKeyOf(gate(5), none)).toBe('zone:5')
  })
})

describe('announcementFor', () => {
  it('names a zone by its label and region, and adds the selected suffix', () => {
    const text = makeText()
    expect(announcementFor(zone(12), text)).toBe(`Zone c, ${regionLabel(view.zoneRegion[12]!)}`)
    const selected = makeText({ selected: new Set([12]) })
    expect(announcementFor(zone(12), selected)).toBe(`Zone c, ${regionLabel(view.zoneRegion[12]!)}, selected`)
  })

  it('writes Zone c, Torque for a zone whose region is the plain Torque id', () => {
    const regions = view.zoneRegion.map(() => 'torque' as RegionId)
    expect(announcementFor(zone(12), makeText({ zoneRegion: regions }))).toBe('Zone c, Torque')
    expect(announcementFor(zone(12), makeText({ zoneRegion: regions, selected: new Set([12]) }))).toBe(
      'Zone c, Torque, selected',
    )
  })

  it('syzygy, current, gate and pair strings equal the SVG tier\'s aria-label templates', () => {
    const text = makeText()
    expect(announcementFor(syzygy(13), text)).toBe('Syzygy d::e')
    expect(announcementFor(syzygy(13), text)).toBe(`Syzygy ${labels[13]}::${labels[14]}`)

    const c = view.currents.find(cur => cur.from === 5 || view.partner(cur.from) === 5)!
    expect(announcementFor(currentOf(5), text)).toBe(`Current ${c.name}: ${c.label}`)

    const gt = view.gates.find(x => x.from === 5)!
    expect(announcementFor(gate(5), text)).toBe(`Gate ${gt.name}: zone ${labels[gt.from]} to zone ${labels[gt.to]}`)

    const { lo, hi } = g.pair(3)
    expect(announcementFor(pair(3), text)).toBe(`Syzygy ${labels[hi]}::${labels[lo]}`)
  })

  it('the pair string lists the higher zone first, the zone-layout string the lower first', () => {
    const text = makeText()
    const { lo, hi } = g.pair(6)
    expect(lo).toBeLessThan(hi)
    expect(announcementFor(pair(6), text)).toBe(`Syzygy ${labels[hi]}::${labels[lo]}`)
    expect(announcementFor(syzygy(lo), text)).toBe(`Syzygy ${labels[lo]}::${labels[hi]}`)
  })

  it('an edge that does not exist is announced as its owner zone', () => {
    const none: TargetText = { ...makeText(), syzygyOf: () => null, currentOf: () => null, gateOf: () => null }
    expect(announcementFor(gate(12), none)).toBe(announcementFor(zone(12), none))
  })
})

describe('activationAnnouncement', () => {
  const text = makeText()
  const zoneText = `Zone c, ${regionLabel(view.zoneRegion[12]!)}`

  it('a zone says whether it is now selected or not selected', () => {
    expect(activationAnnouncement(zone(12), text, true)).toBe(`${zoneText}, selected`)
    expect(activationAnnouncement(zone(12), text, false)).toBe(`${zoneText}, not selected`)
  })

  it('never doubles the suffix, whatever the selection set said before the toggle', () => {
    const wasSelected = makeText({ selected: new Set([12]) })
    expect(activationAnnouncement(zone(12), wasSelected, false)).toBe(`${zoneText}, not selected`)
    expect(activationAnnouncement(zone(12), wasSelected, true)).toBe(`${zoneText}, selected`)
  })

  it('an edge or a pair is pinned', () => {
    expect(activationAnnouncement(syzygy(13), text, true)).toBe('Syzygy d::e, pinned')
    expect(activationAnnouncement(currentOf(5), text, false)).toBe(`${announcementFor(currentOf(5), text)}, pinned`)
    expect(activationAnnouncement(gate(5), text, true)).toBe(`${announcementFor(gate(5), text)}, pinned`)
    expect(activationAnnouncement(pair(3), text, true)).toBe(`${announcementFor(pair(3), text)}, pinned`)
  })

  it('does not claim a pin for an edge that does not exist', () => {
    const none: TargetText = { ...text, gateOf: () => null }
    expect(activationAnnouncement(gate(12), none, true)).toBe(announcementFor(zone(12), none))
    expect(activationAnnouncement(gate(12), none, true)).not.toContain('pinned')
  })
})
