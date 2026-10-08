// Tests for app/lib/canvas/diagramModel.ts (REN-02, 06-10): the pure glue behind CanvasDiagram. Every decision the
// component makes about picking filters, pick-to-HoverInfo, keyboard context, target text, callout placement and colour,
// the aria-label, the live-region repeat toggle and the frame is asserted here with real engine scenes and views, so the
// component itself only wires DOM events to these functions. Expectations are derived from the engine, the view and the
// transform in this file, never copied from the module under test.
import { describe, expect, it } from 'vitest'
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
} from '../../engine/index'
import type { CanvasScene, Numogram } from '../../engine/index'
import type { Demon, HoverInfo, Layer } from '../../app/data/types'
import {
  CALLOUT_OFFSET_PX,
  PENDING_GRACE_MS,
  WHEEL_COMMIT_DELAY_MS,
  calloutColor,
  calloutPosition,
  canvasAriaLabel,
  frameOf,
  gestureMapping,
  hoverInfoOf,
  keyboardContextFor,
  liveText,
  pickFilterFor,
  ringInfo,
  targetAnchor,
  targetOfInfo,
  targetTextFor,
  type FilterArgs,
} from '../../app/lib/canvas/diagramModel'
import { buildSceneIndex, PALETTE, type SceneIndex } from '../../app/lib/canvas/draw'
import { announcementFor, focusKeyOf, type RingTarget } from '../../app/lib/canvas/keyboardModel'
import type { PickHit } from '../../app/lib/canvas/pickIndex'
import {
  IDENTITY_TRANSFORM,
  canvasFootprint,
  onScreenRadius,
  toScreen,
  zoomMax,
  type CanvasTransform,
} from '../../app/lib/canvas/viewTransform'
import { REGION_CLR } from '../../app/lib/constants'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../../app/lib/labelScheme'
import { buildNumogramView, type NumogramView } from '../../app/lib/numogramView'
import { regionLabel, ZONE_DIMMED, ZONE_HIDDEN, ZONE_NORMAL } from '../../app/lib/regions'
import { LABEL_MIN_RADIUS_PX } from '../../app/lib/tierBounds'

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Fx {
  readonly g: Numogram
  readonly view: NumogramView
  readonly scene: CanvasScene
  readonly index: SceneIndex
  readonly labels: readonly string[]
}

const cache = new Map<string, Fx>()

function finish(g: Numogram, scene: CanvasScene): Fx {
  const view = buildNumogramView(g)
  return { g, view, scene, index: buildSceneIndex(scene, view), labels: zoneLabelsFor(g.base, DEFAULT_LABEL_SCHEME) }
}

function zoneFx(base: number): Fx {
  const key = `z:${base}`
  let fx = cache.get(key)
  if (fx === undefined) {
    const g = createNumogram(base)
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    fx = finish(g, buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout)))
    cache.set(key, fx)
  }
  return fx
}

function pairFx(base: number): Fx {
  const key = `p:${base}`
  let fx = cache.get(key)
  if (fx === undefined) {
    const g = createNumogram(base)
    const layout = pairGraphLayout(g, { packer: 'shelf' })
    fx = finish(g, buildPairScene(g, layout, routePairGraph(g, layout)))
    cache.set(key, fx)
  }
  return fx
}

const ALL_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['syzygies', 'currents', 'gates'])
const NO_ZONES: ReadonlySet<number> = new Set<number>()

function args(fx: Fx, over: Partial<FilterArgs> = {}): FilterArgs {
  return {
    scene: fx.scene,
    view: fx.view,
    index: fx.index,
    layers: ALL_LAYERS,
    zoneStates: null,
    tcActive: false,
    gateMode: 'on',
    hlZones: NO_ZONES,
    ...over,
  }
}

/** zone states with the given zones muted and the given zones isolate-dimmed */
function states(count: number, muted: readonly number[], dimmed: readonly number[] = []): Uint8Array {
  const out = new Uint8Array(count).fill(ZONE_NORMAL)
  for (const z of muted) out[z] = ZONE_HIDDEN
  for (const z of dimmed) out[z] = ZONE_DIMMED
  return out
}

/** The first pair id whose syzygy is (or is not) part of a Torque cycle, from the view's own Time Circuit data. */
function pairWhere(fx: Fx, torque: boolean): number {
  for (let q = 0; q < fx.index.pairLo.length; q++) {
    if ((fx.index.torqueSyzygy[q] === 1) === torque) return q
  }
  throw new Error(`no ${torque ? 'torque' : 'non-torque'} pair at base ${fx.g.base}`)
}

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('diagramModel constants', () => {
  it('names the callout offset, the wheel commit delay and the pending grace period', () => {
    expect(CALLOUT_OFFSET_PX).toBe(12)
    expect(WHEEL_COMMIT_DELAY_MS).toBe(120)
    expect(PENDING_GRACE_MS).toBe(150)
  })
})

// ── pickFilterFor ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('pickFilterFor: zones', () => {
  const fx = zoneFx(28)

  it('with no zone states every zone is allowed', () => {
    const f = pickFilterFor(args(fx))
    for (let z = 0; z < fx.g.zoneCount; z++) expect(f.zoneAllowed(z)).toBe(true)
  })

  it('is false exactly for muted (ZONE_HIDDEN) zones, and an isolate-dimmed zone stays pickable', () => {
    const f = pickFilterFor(args(fx, { zoneStates: states(28, [6, 11], [9]) }))
    for (let z = 0; z < 28; z++) expect(f.zoneAllowed(z)).toBe(z !== 6 && z !== 11)
    expect(f.zoneAllowed(9)).toBe(true)
  })
})

describe('pickFilterFor: syzygies', () => {
  const fx = zoneFx(28)
  const torquePair = pairWhere(fx, true)
  const plainPair = pairWhere(fx, false)

  it('is a candidate when the layer is on, nothing is muted and the Time Circuit is off', () => {
    const f = pickFilterFor(args(fx))
    for (let q = 0; q < fx.index.pairLo.length; q++) expect(f.edgeAllowed('syzygy', q)).toBe(true)
  })

  it("is not a candidate when 'syzygies' is not in the layers", () => {
    const f = pickFilterFor(args(fx, { layers: new Set<Layer>(['currents', 'gates']) }))
    expect(f.edgeAllowed('syzygy', torquePair)).toBe(false)
    expect(f.edgeAllowed('current', torquePair)).toBe(true)
  })

  it('is not a candidate when either end is muted', () => {
    const q = fx.index.pairOfZone[6] as number
    const lo = fx.index.pairLo[q] as number
    const hi = fx.index.pairHi[q] as number
    for (const muted of [lo, hi]) {
      const f = pickFilterFor(args(fx, { zoneStates: states(28, [muted]) }))
      expect(f.edgeAllowed('syzygy', q)).toBe(false)
    }
    const other = plainPair === q ? torquePair : plainPair
    const f = pickFilterFor(args(fx, { zoneStates: states(28, [lo]) }))
    expect(f.edgeAllowed('syzygy', other)).toBe(true)
  })

  it('while the Time Circuit is active only Torque syzygies are candidates', () => {
    const f = pickFilterFor(args(fx, { tcActive: true }))
    expect(f.edgeAllowed('syzygy', torquePair)).toBe(true)
    expect(f.edgeAllowed('syzygy', plainPair)).toBe(false)
  })

  it('an out-of-range pair id is never a candidate', () => {
    const f = pickFilterFor(args(fx))
    expect(f.edgeAllowed('syzygy', -1)).toBe(false)
    expect(f.edgeAllowed('syzygy', fx.index.pairLo.length)).toBe(false)
  })
})

describe('pickFilterFor: currents', () => {
  const fx = zoneFx(28)

  it('follows the currents layer, mutes (from, partner and destination) and the Time Circuit', () => {
    const q = fx.index.pairOfZone[6] as number
    const torquePair = pairWhere(fx, true)
    const plainPair = pairWhere(fx, false)
    expect(pickFilterFor(args(fx)).edgeAllowed('current', q)).toBe(true)
    expect(pickFilterFor(args(fx, { layers: new Set<Layer>(['syzygies']) })).edgeAllowed('current', q)).toBe(false)
    // each of the three zones a current touches hides it
    const lo = fx.index.pairLo[q] as number
    const hi = fx.index.pairHi[q] as number
    const dest = fx.scene.currentTo[q] as number
    for (const z of new Set([lo, hi, dest])) {
      expect(pickFilterFor(args(fx, { zoneStates: states(28, [z]) })).edgeAllowed('current', q)).toBe(false)
    }
    const tc = pickFilterFor(args(fx, { tcActive: true }))
    expect(tc.edgeAllowed('current', torquePair)).toBe(true)
    expect(tc.edgeAllowed('current', plainPair)).toBe(false)
  })
})

describe('pickFilterFor: gates (D-04, on demand)', () => {
  const fx = zoneFx(28)
  const z = 5
  const gateTo = (fx.index.gateByZone[z] as { to: number }).to

  it("is false when 'gates' is not in the layers or while the Time Circuit is active", () => {
    expect(pickFilterFor(args(fx, { layers: new Set<Layer>(['syzygies', 'currents']) })).edgeAllowed('gate', z)).toBe(false)
    expect(pickFilterFor(args(fx, { tcActive: true })).edgeAllowed('gate', z)).toBe(false)
  })

  it("is true for every zone when the gate mode is 'on' or 'thin'", () => {
    for (const gateMode of ['on', 'thin'] as const) {
      const f = pickFilterFor(args(fx, { gateMode }))
      for (let zone = 0; zone < 28; zone++) expect(f.edgeAllowed('gate', zone)).toBe(true)
    }
  })

  it("with the gate mode 'off' is true only for zones in hlZones", () => {
    const f = pickFilterFor(args(fx, { gateMode: 'off', hlZones: new Set([z]) }))
    expect(f.edgeAllowed('gate', z)).toBe(true)
    expect(f.edgeAllowed('gate', z + 1)).toBe(false)
    expect(pickFilterFor(args(fx, { gateMode: 'off' })).edgeAllowed('gate', z)).toBe(false)
  })

  it('a gate with a muted origin or destination is never a candidate', () => {
    expect(pickFilterFor(args(fx, { zoneStates: states(28, [z]) })).edgeAllowed('gate', z)).toBe(false)
    if (gateTo !== z) {
      expect(pickFilterFor(args(fx, { zoneStates: states(28, [gateTo]) })).edgeAllowed('gate', z)).toBe(false)
    }
  })
})

// ── hoverInfoOf ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('hoverInfoOf', () => {
  const fx = zoneFx(28)
  const hit = (kind: PickHit['kind'], id: number): PickHit => ({ kind, id, distancePx: 0 })

  it('a zone hit is a zone info', () => {
    expect(hoverInfoOf(hit('zone', 5), fx.index, fx.scene, null)).toEqual({ type: 'zone', zone: 5 })
  })

  it('syzygy and current hits join the view entry by pair id, not by view-array index', () => {
    for (let q = 0; q < fx.index.pairLo.length; q++) {
      const syz = hoverInfoOf(hit('syzygy', q), fx.index, fx.scene, null)
      const expectedSyz = fx.view.syzygies.find(s => fx.g.pairOf(s.a) === q)
      expect(syz).toEqual({ type: 'syzygy', data: expectedSyz })
      const cur = hoverInfoOf(hit('current', q), fx.index, fx.scene, null)
      const expectedCur = fx.view.currents.find(c => fx.g.pairOf(c.from) === q)
      expect(cur).toEqual({ type: 'current', data: expectedCur })
    }
  })

  it('a gate hit joins the view entry by origin zone', () => {
    for (let z = 0; z < 28; z++) {
      const info = hoverInfoOf(hit('gate', z), fx.index, fx.scene, null)
      expect(info).toEqual({ type: 'gate', gate: fx.view.gates.find(gt => gt.from === z) })
    }
  })

  it('a pair hit on the pair graph is the pair syzygy', () => {
    const pf = pairFx(28)
    for (let q = 0; q < pf.index.pairLo.length; q++) {
      const info = hoverInfoOf(hit('pair', q), pf.index, pf.scene, null)
      expect(info).toEqual({ type: 'syzygy', data: pf.view.syzygies.find(s => pf.g.pairOf(s.a) === q) })
    }
  })

  it('a chord hit is the focus chord at that index; without chords, or out of range, it is null', () => {
    const chords: Demon[] = [
      { a: 1, b: 2, name: 'one', kind: 'chrono' },
      { a: 3, b: 4, name: 'two', kind: 'xeno' },
    ]
    expect(hoverInfoOf(hit('chord', 1), fx.index, fx.scene, chords)).toEqual({ type: 'demon', demon: chords[1] })
    expect(hoverInfoOf(hit('chord', 0), fx.index, fx.scene, null)).toBeNull()
    expect(hoverInfoOf(hit('chord', 2), fx.index, fx.scene, chords)).toBeNull()
    expect(hoverInfoOf(hit('chord', -1), fx.index, fx.scene, chords)).toBeNull()
  })

  it('an id the scene does not have is null rather than a throw', () => {
    expect(hoverInfoOf(hit('syzygy', 999), fx.index, fx.scene, null)).toBeNull()
    expect(hoverInfoOf(hit('current', -3), fx.index, fx.scene, null)).toBeNull()
    expect(hoverInfoOf(hit('gate', 28), fx.index, fx.scene, null)).toBeNull()
  })
})

// ── keyboardContextFor ───────────────────────────────────────────────────────────────────────────────────────────────

describe('keyboardContextFor', () => {
  const fx = zoneFx(28)

  it('zone mode: the order is every zone, and a muted zone is left out', () => {
    const all = keyboardContextFor(args(fx))
    expect(all.mode).toBe('zones')
    expect(all.order).toEqual(Array.from({ length: 28 }, (_, z) => z))
    const muted = keyboardContextFor(args(fx, { zoneStates: states(28, [6]) }))
    expect(muted.order).toHaveLength(27)
    expect(muted.order).not.toContain(6)
    expect(muted.order).toContain(7)
  })

  it('an isolate-dimmed zone stays in the order', () => {
    const ctx = keyboardContextFor(args(fx, { zoneStates: states(28, [], [9]) }))
    expect(ctx.order).toContain(9)
  })

  it("gates are keyboard-reachable while the gate mode is 'off' (the layer is on), but not during the Time Circuit", () => {
    const off = keyboardContextFor(args(fx, { gateMode: 'off', zoneStates: states(28, [6]) }))
    for (const z of off.order) {
      const gateTo = (fx.index.gateByZone[z] as { to: number }).to
      expect(off.hasGate(z)).toBe(gateTo !== 6)
    }
    const tc = keyboardContextFor(args(fx, { gateMode: 'off', tcActive: true }))
    for (const z of tc.order) expect(tc.hasGate(z)).toBe(false)
    const noLayer = keyboardContextFor(args(fx, { layers: new Set<Layer>(['syzygies', 'currents']) }))
    expect(noLayer.hasGate(3)).toBe(false)
  })

  it('a syzygy or current stop exists only when its layer is on and neither end is muted, and follows the Time Circuit', () => {
    const q = fx.index.pairOfZone[6] as number
    const partner = (fx.index.pairLo[q] === 6 ? fx.index.pairHi[q] : fx.index.pairLo[q]) as number
    const ctx = keyboardContextFor(args(fx, { zoneStates: states(28, [6]) }))
    expect(ctx.hasSyzygy(partner)).toBe(false)
    expect(ctx.order).toContain(partner)
    const layersOff = keyboardContextFor(args(fx, { layers: new Set<Layer>(['gates']) }))
    expect(layersOff.hasSyzygy(2)).toBe(false)
    expect(layersOff.hasCurrent(2)).toBe(false)
    const plainPair = pairWhere(fx, false)
    const lo = fx.index.pairLo[plainPair] as number
    const tc = keyboardContextFor(args(fx, { tcActive: true }))
    expect(tc.hasSyzygy(lo)).toBe(false)
    expect(tc.hasCurrent(lo)).toBe(false)
    const torqueLo = fx.index.pairLo[pairWhere(fx, true)] as number
    expect(tc.hasSyzygy(torqueLo)).toBe(true)
    expect(tc.hasCurrent(torqueLo)).toBe(true)
  })

  it('pair mode: the order is the pair ids whose two zones are both visible', () => {
    const pf = pairFx(28)
    const all = keyboardContextFor(args(pf))
    expect(all.mode).toBe('pairs')
    expect(all.order).toEqual(Array.from({ length: pf.index.pairLo.length }, (_, q) => q))
    const q6 = pf.index.pairOfZone[6] as number
    const muted = keyboardContextFor(args(pf, { zoneStates: states(28, [6]) }))
    expect(muted.order).not.toContain(q6)
    expect(muted.order).toHaveLength(pf.index.pairLo.length - 1)
  })
})

// ── targetTextFor, ringInfo, targetOfInfo ────────────────────────────────────────────────────────────────────────────

describe('targetTextFor', () => {
  const fx = zoneFx(28)
  const text = targetTextFor(fx.view, fx.labels, fx.index, fx.scene, new Set([4]))

  it('joins syzygy, current and gate entries to a zone by pair id and origin zone', () => {
    for (let z = 0; z < 28; z++) {
      const q = fx.g.pairOf(z)
      const syz = fx.view.syzygies.find(s => fx.g.pairOf(s.a) === q)
      expect(text.syzygyOf(z)).toEqual(syz === undefined ? null : { a: syz.a, b: syz.b })
      const cur = fx.view.currents.find(c => fx.g.pairOf(c.from) === q)
      expect(text.currentOf(z)).toEqual(cur === undefined ? null : { name: cur.name, label: cur.label })
      const gate = fx.view.gates.find(gt => gt.from === z)
      expect(text.gateOf(z)).toEqual(gate === undefined ? null : { name: gate.name, from: gate.from, to: gate.to })
    }
  })

  it('names a pair by its members and reports the selection', () => {
    for (let q = 0; q < 14; q++) expect(text.pairOf(q)).toEqual({ lo: fx.g.pair(q).lo, hi: fx.g.pair(q).hi })
    expect(text.isSelected(4)).toBe(true)
    expect(text.isSelected(5)).toBe(false)
  })

  it('feeds the keyboard model: zone text with the region, selected only when selected', () => {
    const plain = announcementFor({ kind: 'zone', zone: 5 }, text)
    expect(plain).toBe(`Zone ${fx.labels[5]}, ${regionLabel(fx.view.zoneRegion[5] as never)}`)
    expect(announcementFor({ kind: 'zone', zone: 4 }, text)).toBe(
      `Zone ${fx.labels[4]}, ${regionLabel(fx.view.zoneRegion[4] as never)}, selected`,
    )
  })

  it('feeds the keyboard model: the focus key grammar of the SVG tier', () => {
    const syz = fx.view.syzygies.find(s => fx.g.pairOf(s.a) === fx.g.pairOf(3)) as { a: number; b: number }
    expect(focusKeyOf({ kind: 'syzygy', zone: 3 }, text)).toBe(`syzygy:${syz.a}:${syz.b}`)
    expect(focusKeyOf({ kind: 'zone', zone: 3 }, text)).toBe('zone:3')
    expect(focusKeyOf({ kind: 'pair', pair: 2 }, text)).toBe('pair:2')
    const gate = fx.view.gates.find(gt => gt.from === 3) as { name: string }
    expect(focusKeyOf({ kind: 'gate', zone: 3 }, text)).toBe(`gate:${gate.name}`)
  })
})

describe('ringInfo and targetOfInfo', () => {
  const fx = zoneFx(28)

  it('ringInfo names the HoverInfo of each target kind', () => {
    expect(ringInfo({ kind: 'zone', zone: 7 }, fx.index, fx.scene)).toEqual({ type: 'zone', zone: 7 })
    const syz = ringInfo({ kind: 'syzygy', zone: 7 }, fx.index, fx.scene)
    expect(syz).toEqual({ type: 'syzygy', data: fx.view.syzygies.find(s => fx.g.pairOf(s.a) === fx.g.pairOf(7)) })
    const cur = ringInfo({ kind: 'current', zone: 7 }, fx.index, fx.scene)
    expect(cur).toEqual({ type: 'current', data: fx.view.currents.find(c => fx.g.pairOf(c.from) === fx.g.pairOf(7)) })
    expect(ringInfo({ kind: 'gate', zone: 7 }, fx.index, fx.scene)).toEqual({
      type: 'gate',
      gate: fx.view.gates.find(gt => gt.from === 7),
    })
  })

  it('targetOfInfo inverts ringInfo for every zone: zone and gate exactly, syzygy and current to a zone of the same pair', () => {
    for (let z = 0; z < 28; z++) {
      const zoneTarget: RingTarget = { kind: 'zone', zone: z }
      expect(targetOfInfo(ringInfo(zoneTarget, fx.index, fx.scene), fx.index, fx.scene)).toEqual(zoneTarget)
      const gateTarget: RingTarget = { kind: 'gate', zone: z }
      expect(targetOfInfo(ringInfo(gateTarget, fx.index, fx.scene), fx.index, fx.scene)).toEqual(gateTarget)
      for (const kind of ['syzygy', 'current'] as const) {
        const target: RingTarget = { kind, zone: z }
        const info = ringInfo(target, fx.index, fx.scene)
        const back = targetOfInfo(info, fx.index, fx.scene)
        expect(back).not.toBeNull()
        expect(back?.kind).toBe(kind)
        // pair members share one entry, so the owner zone is any member of the pair, and the info is the same
        expect(fx.g.pairOf((back as { zone: number }).zone)).toBe(fx.g.pairOf(z))
        expect(ringInfo(back as RingTarget, fx.index, fx.scene)).toEqual(info)
      }
    }
  })

  it('a demon info has no ring target', () => {
    const info: HoverInfo = { type: 'demon', demon: { a: 1, b: 2, name: 'x', kind: 'chrono' } }
    expect(targetOfInfo(info, fx.index, fx.scene)).toBeNull()
  })

  it('an out-of-range zone has no ring target', () => {
    expect(targetOfInfo({ type: 'zone', zone: 99 }, fx.index, fx.scene)).toBeNull()
    expect(targetOfInfo({ type: 'zone', zone: -1 }, fx.index, fx.scene)).toBeNull()
  })

  it('on the pair graph every zone-bound info maps to its pair', () => {
    const pf = pairFx(28)
    const q = pf.g.pairOf(9)
    expect(targetOfInfo({ type: 'zone', zone: 9 }, pf.index, pf.scene)).toEqual({ kind: 'pair', pair: q })
    const syz = ringInfo({ kind: 'pair', pair: q }, pf.index, pf.scene)
    expect(syz.type).toBe('syzygy')
    expect(targetOfInfo(syz, pf.index, pf.scene)).toEqual({ kind: 'pair', pair: q })
    const cur = pf.view.currents.find(c => pf.g.pairOf(c.from) === q) as { from: number }
    expect(targetOfInfo({ type: 'current', data: cur as never }, pf.index, pf.scene)).toEqual({ kind: 'pair', pair: q })
  })
})

// ── targetAnchor ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('targetAnchor', () => {
  const fx = zoneFx(28)

  it('a zone anchors at its centre with the node radius', () => {
    const a = targetAnchor({ kind: 'zone', zone: 5 }, fx.scene, fx.index)
    expect(a).toEqual({ x: fx.scene.x[5], y: fx.scene.y[5], radius: fx.scene.nodeRadius })
  })

  it('a syzygy anchors at the midpoint of its segment', () => {
    const q = fx.g.pairOf(5)
    const s = fx.scene.syzygySeg
    const a = targetAnchor({ kind: 'syzygy', zone: 5 }, fx.scene, fx.index)
    expect(a?.x).toBeCloseTo(((s[4 * q] as number) + (s[4 * q + 2] as number)) / 2, 9)
    expect(a?.y).toBeCloseTo(((s[4 * q + 1] as number) + (s[4 * q + 3] as number)) / 2, 9)
    expect(a?.radius).toBe(0)
  })

  it('a current anchors at its junction and a gate at its label', () => {
    const q = fx.g.pairOf(5)
    const cur = targetAnchor({ kind: 'current', zone: 5 }, fx.scene, fx.index)
    expect(cur).toEqual({ x: fx.scene.junctionX[q], y: fx.scene.junctionY[q], radius: 0 })
    const gate = targetAnchor({ kind: 'gate', zone: 5 }, fx.scene, fx.index)
    expect(Number.isFinite(gate?.x)).toBe(true)
    expect(Number.isFinite(gate?.y)).toBe(true)
  })

  it('a pair pill anchors at its centre with half the pill width', () => {
    const pf = pairFx(28)
    const a = targetAnchor({ kind: 'pair', pair: 3 }, pf.scene, pf.index)
    expect(a).toEqual({ x: (pf.scene.px as Float64Array)[3], y: (pf.scene.py as Float64Array)[3], radius: pf.scene.pillWidth / 2 })
  })

  it('a target the scene does not have is null and every anchor is finite', () => {
    expect(targetAnchor({ kind: 'zone', zone: 99 }, fx.scene, fx.index)).toBeNull()
    expect(targetAnchor({ kind: 'pair', pair: 99 }, pairFx(28).scene, pairFx(28).index)).toBeNull()
    for (let z = 0; z < 28; z++) {
      for (const kind of ['zone', 'syzygy', 'current', 'gate'] as const) {
        const a = targetAnchor({ kind, zone: z }, fx.scene, fx.index)
        expect(a).not.toBeNull()
        expect(Number.isFinite(a?.x)).toBe(true)
        expect(Number.isFinite(a?.y)).toBe(true)
      }
    }
  })
})

// ── calloutPosition and calloutColor ─────────────────────────────────────────────────────────────────────────────────

describe('calloutPosition', () => {
  it('sits 12 px right of and below the anchor when it fits', () => {
    expect(calloutPosition(100, 100, 80, 16, 580, 580)).toEqual({ x: 112, y: 112 })
  })

  it('flips to the opposite side at the right and bottom edges', () => {
    expect(calloutPosition(560, 100, 80, 16, 580, 580)).toEqual({ x: 560 - 12 - 80, y: 112 })
    expect(calloutPosition(100, 570, 80, 16, 580, 580)).toEqual({ x: 112, y: 570 - 12 - 16 })
    expect(calloutPosition(560, 570, 80, 16, 580, 580)).toEqual({ x: 468, y: 542 })
  })

  it('a chip that exactly fits does not flip', () => {
    expect(calloutPosition(488, 100, 80, 16, 580, 580)).toEqual({ x: 500, y: 112 })
  })

  it('is never negative, even when the chip is wider than the window', () => {
    const p = calloutPosition(5, 5, 600, 700, 580, 580)
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
  })

  it('a non-finite anchor gives a finite position', () => {
    const p = calloutPosition(NaN, Infinity, 80, 16, 580, 580)
    expect(Number.isFinite(p.x)).toBe(true)
    expect(Number.isFinite(p.y)).toBe(true)
  })
})

describe('calloutColor', () => {
  const fx = zoneFx(28)

  it('zones use their zone colour, edges the identity colours', () => {
    expect(calloutColor({ kind: 'zone', zone: 5 }, fx.view)).toBe(fx.view.zoneColors[5])
    expect(calloutColor({ kind: 'zone', zone: 5 }, fx.view)).toBe(REGION_CLR[fx.g.cycleOfZone(5).kind])
    expect(calloutColor({ kind: 'syzygy', zone: 5 }, fx.view)).toBe('#e8e8e8')
    expect(calloutColor({ kind: 'current', zone: 5 }, fx.view)).toBe('#22ee66')
    expect(calloutColor({ kind: 'gate', zone: 5 }, fx.view)).toBe('#cc44ff')
    expect(PALETTE.syzygy).toBe('#e8e8e8')
  })

  it('a pair uses the colour of its lower zone', () => {
    const pf = pairFx(28)
    for (let q = 0; q < 14; q++) {
      expect(calloutColor({ kind: 'pair', pair: q }, pf.view)).toBe(pf.view.zoneColors[pf.g.pair(q).lo])
    }
  })
})

// ── canvasAriaLabel ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('canvasAriaLabel', () => {
  it('zone layouts name the base, the zone count and the key model', () => {
    expect(canvasAriaLabel(zoneFx(202).scene)).toBe(
      "Numogram, base 202, 202 zones. Arrow keys move between zones, Tab steps through a zone's syzygy, current and gate, Enter selects.",
    )
  })

  it('the pair graph keeps the SVG tier string with the pair count', () => {
    expect(canvasAriaLabel(pairFx(64).scene)).toBe(
      'Numogram pair graph, base 64, 32 syzygies. Arrow keys move between pairs, Enter selects.',
    )
  })
})

// ── liveText ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('liveText', () => {
  const ZWSP = String.fromCodePoint(0x200b)

  it('a different text passes through unchanged', () => {
    expect(liveText('Zone 4, Torque', 'Zone 5, Torque')).toBe('Zone 5, Torque')
    expect(liveText('', 'Zone 5, Torque')).toBe('Zone 5, Torque')
  })

  it('the same text appends U+200B, and again removes it (it alternates)', () => {
    const first = liveText('Zone 5, Torque', 'Zone 5, Torque')
    expect(first).toBe(`Zone 5, Torque${ZWSP}`)
    const second = liveText(first, 'Zone 5, Torque')
    expect(second).toBe('Zone 5, Torque')
    expect(liveText(second, 'Zone 5, Torque')).toBe(`Zone 5, Torque${ZWSP}`)
  })

  it('a different text after a toggled one drops the toggle', () => {
    expect(liveText(`Zone 5, Torque${ZWSP}`, 'Zone 6, Warp')).toBe('Zone 6, Warp')
  })

  it('the zero-width character is exactly one code point 0x200b', () => {
    expect(ZWSP.codePointAt(0)).toBe(0x200b)
    expect(liveText('a', 'a')).toHaveLength(2)
  })
})

// ── frameOf ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('frameOf', () => {
  it('a zone scene is its own width, height and node radius', () => {
    const { scene } = zoneFx(28)
    expect(frameOf(scene)).toEqual({ width: scene.width, height: scene.height, nodeRadius: scene.nodeRadius })
  })

  it('a pair scene uses the pill half height as the node radius', () => {
    const { scene } = pairFx(28)
    expect(frameOf(scene)).toEqual({ width: scene.width, height: scene.height, nodeRadius: scene.pillHeight / 2 })
  })

  it('zoomMax lets the pair graph at base 4000 reach pill labels', () => {
    const { scene } = pairFx(4000)
    const frame = frameOf(scene)
    const zoom = zoomMax(frame, 580, 704)
    const t: CanvasTransform = { zoom, tx: 0, ty: 0 }
    expect(onScreenRadius(t, frame, 580, 704)).toBeGreaterThanOrEqual(LABEL_MIN_RADIUS_PX)
  })

  it('the footprint of a frame is the window the component sizes its canvases to', () => {
    const { scene } = zoneFx(202)
    const { cssWidth, cssHeight } = canvasFootprint(frameOf(scene), 1280, 800)
    expect(cssWidth).toBe(580)
    expect(cssHeight).toBeGreaterThan(0)
  })
})

// ── gestureMapping ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('gestureMapping (the CSS transform that stretches the cached bitmap during a gesture)', () => {
  const fx = zoneFx(202)
  const frame = frameOf(fx.scene)
  const { cssWidth: w, cssHeight: h } = canvasFootprint(frame, 1280, 800)

  it('is the identity when the live view is the committed one', () => {
    expect(gestureMapping(IDENTITY_TRANSFORM, IDENTITY_TRANSFORM, w, h)).toEqual({ k: 1, tx: 0, ty: 0 })
    const t: CanvasTransform = { zoom: 2.5, tx: 31, ty: -17 }
    expect(gestureMapping(t, t, w, h)).toEqual({ k: 1, tx: 0, ty: 0 })
  })

  it('maps every point of the committed bitmap to where the live transform puts it', () => {
    const committed: CanvasTransform = { zoom: 1.5, tx: 12, ty: -8 }
    const live: CanvasTransform = { zoom: 3.2, tx: -40, ty: 25 }
    const m = gestureMapping(committed, live, w, h)
    for (const [wx, wy] of [[0, 0], [fx.scene.width, fx.scene.height], [fx.scene.centerX, fx.scene.centerY], [37, 91]] as const) {
      const c = toScreen(committed, frame, w, h, wx, wy)
      const l = toScreen(live, frame, w, h, wx, wy)
      expect(m.k * c.x + m.tx).toBeCloseTo(l.x, 6)
      expect(m.k * c.y + m.ty).toBeCloseTo(l.y, 6)
    }
  })

  it('a pure pan is a translation with scale 1', () => {
    const m = gestureMapping(IDENTITY_TRANSFORM, { zoom: 1, tx: 14, ty: -6 }, w, h)
    expect(m).toEqual({ k: 1, tx: 14, ty: -6 })
  })

  it('a non-finite or non-positive zoom ratio is the identity, never NaN', () => {
    expect(gestureMapping({ zoom: 0, tx: 0, ty: 0 }, IDENTITY_TRANSFORM, w, h)).toEqual({ k: 1, tx: 0, ty: 0 })
    expect(gestureMapping(IDENTITY_TRANSFORM, { zoom: NaN, tx: 0, ty: 0 }, w, h)).toEqual({ k: 1, tx: 0, ty: 0 })
  })
})
