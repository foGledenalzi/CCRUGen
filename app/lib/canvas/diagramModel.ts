// Pure glue for CanvasDiagram (Phase 6 D-08, D-09): pick filters, pick-to-HoverInfo, keyboard context, callout placement and the live-region repeat toggle. Original CCRUG code (MIT, NOTICE section 1).
//
// CanvasDiagram is a thin DOM shell: it turns events into calls on the pure modules (pickIndex, keyboardModel, interaction,
// viewTransform, draw). Everything it has to DECIDE lives here so it is unit-tested without a DOM: which edges are
// candidates for a pick (the same rule the draw module uses for what is drawn, D-04), how a pick becomes the SVG tier's
// HoverInfo, which zones and stops the keyboard ring may visit, where the callout chip sits, and how the live region
// repeats a string. Edges are joined to the view by pair id (g.pairOf) and origin zone, never by view-array index
// (research Pattern 4). Nothing here reads the DOM, the clock or a global.

import type { CanvasScene } from '../../../engine/index'
import type { Demon, HoverInfo, Layer } from '../../data/types'
import type { NumogramView } from '../numogramView'
import { ZONE_HIDDEN } from '../regions'
import { PALETTE, type SceneIndex } from './draw'
import type { KeyboardContext, RingTarget, TargetText } from './keyboardModel'
import type { PickFilter, PickHit } from './pickIndex'
import { IDENTITY_TRANSFORM, type CanvasFrame, type CanvasTransform } from './viewTransform'

export const CALLOUT_OFFSET_PX = 12 // named exception: the demon matrix tooltip's x + 12, y + 12 (checker recommendation 4)
export const WHEEL_COMMIT_DELAY_MS = 120 // re-raster after a wheel burst (research Pattern 5)
export const PENDING_GRACE_MS = 150 // UI-SPEC [default]: results faster than this never show the computing state

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b) // the live-region repeat toggle (never typed as an escape)
const NEUTRAL_COLOR = '#9ca3af' // a callout colour when the view has no entry for the element (gray-400, UI-SPEC neutral)

export interface FilterArgs {
  readonly scene: CanvasScene
  readonly view: NumogramView
  readonly index: SceneIndex
  readonly layers: ReadonlySet<Layer>
  /** Per zone: ZONE_HIDDEN (muted), ZONE_DIMMED or ZONE_NORMAL; null = no isolate or mute filter. */
  readonly zoneStates: Uint8Array | null
  readonly tcActive: boolean
  readonly gateMode: 'on' | 'thin' | 'off'
  /** Zones highlighted right now (hover, pin, ring, selection, region): their own gate is drawn on demand. */
  readonly hlZones: ReadonlySet<number>
}

// ── Which elements exist, are drawn and may be reached ───────────────────────────────────────────────────────────────

function visible(states: Uint8Array | null, zone: number): boolean {
  return states === null || states[zone] !== ZONE_HIDDEN
}

function validPair(a: FilterArgs, q: number): boolean {
  return Number.isInteger(q) && q >= 0 && q < a.index.pairLo.length
}

/** The syzygy of pair q exists on its layer, neither end is muted and the Time Circuit (if on) includes it. */
function syzygyShown(a: FilterArgs, q: number): boolean {
  if (!validPair(a, q) || !a.layers.has('syzygies') || a.index.syzygyByPair[q] === undefined) return false
  if (!visible(a.zoneStates, a.index.pairLo[q] as number) || !visible(a.zoneStates, a.index.pairHi[q] as number)) return false
  return !a.tcActive || a.index.torqueSyzygy[q] === 1
}

/** The current of pair q exists on its layer, none of its three zones (members and destination) is muted, Time Circuit permitting. */
function currentShown(a: FilterArgs, q: number): boolean {
  if (!validPair(a, q) || !a.layers.has('currents') || a.index.currentByPair[q] === undefined) return false
  const zones = [a.index.pairLo[q] as number, a.index.pairHi[q] as number, a.scene.currentTo[q] as number]
  if (!zones.every(z => visible(a.zoneStates, z))) return false
  return !a.tcActive || a.index.torqueCurrent[q] === 1
}

/** The gate out of zone z exists on its layer, neither end is muted and the Time Circuit is off (it draws no gates). */
function gateShown(a: FilterArgs, z: number): boolean {
  if (!Number.isInteger(z) || z < 0 || z >= a.index.gateByZone.length) return false
  const gate = a.index.gateByZone[z]
  if (gate === undefined || !a.layers.has('gates') || a.tcActive) return false
  return visible(a.zoneStates, z) && visible(a.zoneStates, gate.to)
}

/**
 * What a pick may land on (D-04, D-09). Muted zones and the edges that touch them are never candidates; isolate-dimmed
 * ones are. An edge is a candidate only when its layer is on and it is drawn: a gate is drawn ambiently at the gate modes
 * 'on' and 'thin', and at 'off' only for a highlighted zone (its own gate, on demand), so every gate stays reachable
 * without ever being a ghost target.
 */
export function pickFilterFor(a: FilterArgs): PickFilter {
  return {
    zoneAllowed: (zone: number): boolean => visible(a.zoneStates, zone),
    edgeAllowed: (kind: 'syzygy' | 'current' | 'gate', id: number): boolean => {
      if (kind === 'syzygy') return syzygyShown(a, id)
      if (kind === 'current') return currentShown(a, id)
      return gateShown(a, id) && (a.gateMode !== 'off' || a.hlZones.has(id))
    },
  }
}

/**
 * The SVG tier's HoverInfo for a pick. Syzygy, current and pair hits carry the pair id and gate hits the origin zone, so
 * they join the view by id; a chord hit is an index into the focus chords. An id the scene or the chords do not have
 * gives null.
 */
export function hoverInfoOf(
  hit: PickHit,
  index: SceneIndex,
  scene: CanvasScene,
  focusChords: readonly Demon[] | null,
): HoverInfo | null {
  switch (hit.kind) {
    case 'zone':
      return Number.isInteger(hit.id) && hit.id >= 0 && hit.id < scene.x.length ? { type: 'zone', zone: hit.id } : null
    case 'pair':
    case 'syzygy': {
      const data = index.syzygyByPair[hit.id]
      return data === undefined ? null : { type: 'syzygy', data }
    }
    case 'current': {
      const data = index.currentByPair[hit.id]
      return data === undefined ? null : { type: 'current', data }
    }
    case 'gate': {
      const gate = index.gateByZone[hit.id]
      return gate === undefined ? null : { type: 'gate', gate }
    }
    case 'chord': {
      const demon = focusChords?.[hit.id]
      return demon === undefined ? null : { type: 'demon', demon }
    }
  }
}

// ── Keyboard ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The keyboard model's view of the diagram: the visible zones (or pairs) in order, and which stops a zone has. Gates are
 * keyboard-reachable whenever the Gates layer is on and the Time Circuit is off, whatever the gate mode, because keyboard
 * focus counts as hover and so draws the focused zone's own gate on demand (D-04, D-08). hlZones plays no part here.
 */
export function keyboardContextFor(a: FilterArgs): KeyboardContext {
  const order: number[] = []
  if (a.scene.kind === 'zones') {
    for (let z = 0; z < a.scene.x.length; z++) if (visible(a.zoneStates, z)) order.push(z)
  } else {
    for (let q = 0; q < a.index.pairLo.length; q++) {
      if (visible(a.zoneStates, a.index.pairLo[q] as number) && visible(a.zoneStates, a.index.pairHi[q] as number)) order.push(q)
    }
  }
  const pairOf = (zone: number): number => a.index.pairOfZone[zone] ?? -1
  return {
    mode: a.scene.kind,
    order,
    hasSyzygy: (zone: number): boolean => syzygyShown(a, pairOf(zone)),
    hasCurrent: (zone: number): boolean => currentShown(a, pairOf(zone)),
    hasGate: (zone: number): boolean => gateShown(a, zone),
  }
}

/**
 * Everything the keyboard model needs to name a target, built from the view and the selection. The scene is accepted so
 * every caller passes the same (view, index, scene) triple; the joins themselves go through the index.
 */
export function targetTextFor(
  view: NumogramView,
  zoneLabels: readonly string[],
  index: SceneIndex,
  scene: CanvasScene,
  selZones: ReadonlySet<number>,
  zoneSounds: readonly string[] | null = null,
): TargetText {
  const pairOf = (zone: number): number => index.pairOfZone[zone] ?? -1
  return {
    zoneLabels,
    zoneSounds,
    zoneRegion: view.zoneRegion,
    syzygyOf: (zone: number) => index.syzygyByPair[pairOf(zone)] ?? null,
    currentOf: (zone: number) => index.currentByPair[pairOf(zone)] ?? null,
    gateOf: (zone: number) => index.gateByZone[zone] ?? null,
    pairOf: (q: number) => ({ lo: index.pairLo[q] as number, hi: index.pairHi[q] as number }),
    isSelected: (zone: number) => selZones.has(zone),
  }
}

const CHORD_CALLOUT_SEP = ` ${String.fromCodePoint(0xb7)} ` // the matrix text style: a middle dot between net-span and name

/**
 * The text of a demon chord's hover callout (Phase 7, plan 07-14, NAM-02). Without a naming it is the chord's own name,
 * as before. With one it is the net-span in the diagram's own labels, then the LIVE name of the pair from the naming, so
 * a rename shows at once and the baked legacy name is never shown at render time; the net-span comes first so that
 * nothing disappears at a base whose names differ from the preset. A naming that does not cover the chord's zones (a
 * stale base during a switch) raises a RangeError, which falls back to the chord's own name; any other error is a bug and
 * propagates.
 */
export function chordCalloutText(
  chord: { readonly a: number; readonly b: number; readonly name: string; readonly kind?: string },
  zoneLabels: readonly string[],
  nameOf: ((a: number, b: number) => string) | null,
): string {
  if (nameOf === null) return chord.name
  let live: string
  try {
    live = nameOf(chord.a, chord.b)
  } catch (error) {
    if (error instanceof RangeError) return chord.name
    throw error
  }
  return `${zoneLabels[chord.a]}::${zoneLabels[chord.b]}${CHORD_CALLOUT_SEP}${live}`
}

/**
 * The HoverInfo of a ring target (keyboard focus counts as hover). A target whose element the view does not have
 * degrades to the zone's own info, so the callback always gets something to highlight.
 */
export function ringInfo(target: RingTarget, index: SceneIndex, scene: CanvasScene): HoverInfo {
  if (target.kind === 'zone') return { type: 'zone', zone: target.zone }
  if (target.kind === 'pair') {
    const data = index.syzygyByPair[target.pair]
    return data === undefined ? { type: 'zone', zone: index.pairLo[target.pair] ?? 0 } : { type: 'syzygy', data }
  }
  const zone = Math.min(Math.max(target.zone, 0), Math.max(scene.x.length - 1, 0))
  const q = index.pairOfZone[zone] ?? -1
  if (target.kind === 'syzygy') {
    const data = index.syzygyByPair[q]
    if (data !== undefined) return { type: 'syzygy', data }
  } else if (target.kind === 'current') {
    const data = index.currentByPair[q]
    if (data !== undefined) return { type: 'current', data }
  } else {
    const gate = index.gateByZone[zone]
    if (gate !== undefined) return { type: 'gate', gate }
  }
  return { type: 'zone', zone: target.zone }
}

/**
 * The ring target a pinned (or hovered) HoverInfo names, so the callout can describe it. A syzygy or current belongs to
 * a pair whose two members share one entry, so the owner zone it returns is the entry's own (a for a syzygy, from for a
 * current). On the pair graph every zone-bound info maps to its pair and a gate has no target. A demon info has none.
 */
export function targetOfInfo(info: HoverInfo, index: SceneIndex, scene: CanvasScene): RingTarget | null {
  const inRange = (zone: number): boolean => Number.isInteger(zone) && zone >= 0 && zone < scene.x.length
  const pairTarget = (zone: number): RingTarget | null => {
    const q = inRange(zone) ? (index.pairOfZone[zone] ?? -1) : -1
    return q >= 0 ? { kind: 'pair', pair: q } : null
  }
  const pairs = scene.kind === 'pairs'
  switch (info.type) {
    case 'zone':
      if (!inRange(info.zone)) return null
      return pairs ? pairTarget(info.zone) : { kind: 'zone', zone: info.zone }
    case 'syzygy':
      if (!inRange(info.data.a)) return null
      return pairs ? pairTarget(info.data.a) : { kind: 'syzygy', zone: info.data.a }
    case 'current':
      if (!inRange(info.data.from)) return null
      return pairs ? pairTarget(info.data.from) : { kind: 'current', zone: info.data.from }
    case 'gate':
      return pairs || !inRange(info.gate.from) ? null : { kind: 'gate', zone: info.gate.from }
    case 'demon':
      return null
  }
}

/**
 * Where a ring target sits in world units, and the radius to keep inside the window around it: the zone centre and node
 * radius, the midpoint of a syzygy segment, a current's junction, a gate's label point (else its curve midpoint, else its
 * zone) and a pair pill's centre with half its width. Null when the scene has no such target. Every number is finite.
 */
export function targetAnchor(
  target: RingTarget,
  scene: CanvasScene,
  index: SceneIndex,
): { readonly x: number; readonly y: number; readonly radius: number } | null {
  const finite = (...v: number[]): boolean => v.every(Number.isFinite)
  if (target.kind === 'pair') {
    const x = scene.px?.[target.pair]
    const y = scene.py?.[target.pair]
    return x !== undefined && y !== undefined && finite(x, y) ? { x, y, radius: scene.pillWidth / 2 } : null
  }
  const zx = scene.x[target.zone]
  const zy = scene.y[target.zone]
  if (zx === undefined || zy === undefined || !finite(zx, zy)) return null
  const q = index.pairOfZone[target.zone] ?? -1
  if (target.kind === 'syzygy') {
    const s = scene.syzygySeg
    const x0 = s[4 * q]
    const y0 = s[4 * q + 1]
    const x1 = s[4 * q + 2]
    const y1 = s[4 * q + 3]
    if (q >= 0 && x0 !== undefined && y0 !== undefined && x1 !== undefined && y1 !== undefined && finite(x0, y0, x1, y1)) {
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, radius: 0 }
    }
  } else if (target.kind === 'current') {
    const jx = scene.junctionX[q]
    const jy = scene.junctionY[q]
    if (q >= 0 && jx !== undefined && jy !== undefined && finite(jx, jy)) return { x: jx, y: jy, radius: 0 }
  } else if (target.kind === 'gate') {
    const lx = scene.gateLabelX[target.zone]
    const ly = scene.gateLabelY[target.zone]
    if (lx !== undefined && ly !== undefined && finite(lx, ly)) return { x: lx, y: ly, radius: 0 }
    const c = scene.gateCurves
    const o = 6 * target.zone
    const x0 = c[o]
    const cx = c[o + 2]
    const x1 = c[o + 4]
    const y0 = c[o + 1]
    const cy = c[o + 3]
    const y1 = c[o + 5]
    if (x0 !== undefined && cx !== undefined && x1 !== undefined && y0 !== undefined && cy !== undefined && y1 !== undefined && finite(x0, cx, x1, y0, cy, y1)) {
      return { x: (x0 + 2 * cx + x1) / 4, y: (y0 + 2 * cy + y1) / 4, radius: 0 }
    }
  }
  // an edge the scene cannot place falls back to its owner zone
  return { x: zx, y: zy, radius: target.kind === 'zone' ? scene.nodeRadius : 0 }
}

// ── Callout, aria-label, live region, frame ──────────────────────────────────────────────────────────────────────────

/**
 * The top-left of the callout chip: CALLOUT_OFFSET_PX right of and below the anchor, flipped to the opposite side when
 * the chip would leave the window, and never negative. A non-finite anchor counts as the window origin.
 */
export function calloutPosition(
  anchorX: number,
  anchorY: number,
  chipW: number,
  chipH: number,
  cssW: number,
  cssH: number,
): { x: number; y: number } {
  const ax = Number.isFinite(anchorX) ? anchorX : 0
  const ay = Number.isFinite(anchorY) ? anchorY : 0
  let x = ax + CALLOUT_OFFSET_PX
  let y = ay + CALLOUT_OFFSET_PX
  if (x + chipW > cssW) x = ax - CALLOUT_OFFSET_PX - chipW
  if (y + chipH > cssH) y = ay - CALLOUT_OFFSET_PX - chipH
  return { x: Math.max(0, x), y: Math.max(0, y) }
}

/** The identity colour of a target: the zone's own colour, the layer colours for edges, a pair's lower zone for a pill. */
export function calloutColor(target: RingTarget, view: NumogramView): string {
  switch (target.kind) {
    case 'zone':
      return view.zoneColors[target.zone] ?? NEUTRAL_COLOR
    case 'syzygy':
      return PALETTE.syzygy
    case 'current':
      return PALETTE.current
    case 'gate':
      return PALETTE.gate
    case 'pair':
      // the engine's pair id is the lower member of the pair
      return view.zoneColors[target.pair] ?? NEUTRAL_COLOR
  }
}

/** The overlay canvas's aria-label (UI-SPEC Copywriting): the zone-layout key model, or the SVG tier's pair graph string. */
export function canvasAriaLabel(scene: CanvasScene): string {
  if (scene.kind === 'pairs') {
    return `Numogram pair graph, base ${scene.base}, ${scene.currentTo.length} syzygies. Arrow keys move between pairs, Enter selects.`
  }
  return `Numogram, base ${scene.base}, ${scene.x.length} zones. Arrow keys move between zones, Tab steps through a zone's syzygy, current and gate, Enter selects.`
}

/**
 * The text to put in the live region. `previous` is what the region holds now. A different text passes through; the
 * same text again would not be announced, so a zero-width space is appended, and removed on the next repeat.
 */
export function liveText(previous: string, next: string): string {
  const held = previous.endsWith(ZERO_WIDTH_SPACE) ? previous.slice(0, -ZERO_WIDTH_SPACE.length) : previous
  if (held !== next) return next
  return previous.endsWith(ZERO_WIDTH_SPACE) ? next : `${next}${ZERO_WIDTH_SPACE}`
}

/** The frame every transform, zoom limit and level-of-detail radius uses; a pair scene's node radius is the pill half height. */
export function frameOf(scene: CanvasScene): CanvasFrame {
  return { width: scene.width, height: scene.height, nodeRadius: scene.kind === 'pairs' ? scene.pillHeight / 2 : scene.nodeRadius }
}

/** The committed view and the scene key it belongs to: the one piece of transform state CanvasDiagram keeps in React state. */
export interface CommittedBox {
  readonly key: string
  readonly t: CanvasTransform
}

/** The transform the layer bitmaps are drawn at for `sceneKey`: the stored one when it belongs to this scene, else the identity. */
export function committedFor(box: CommittedBox, sceneKey: string): CanvasTransform {
  return box.key === sceneKey ? box.t : IDENTITY_TRANSFORM
}

/**
 * The stored box once the scene key is `sceneKey` (Phase 6 review WR-02). A key change drops whatever was committed for the
 * previous scene: keeping it would bring a stale zoom back to life when the user returns to that key (scene A zoomed, scene
 * B, scene A again), while the live view was reset to the identity, so the old raster would be squeezed onto a blank window.
 * The same key keeps the box as it is (the same object, so React bails out of the state update).
 */
export function boxForScene(prev: CommittedBox, sceneKey: string): CommittedBox {
  return prev.key === sceneKey ? prev : { key: sceneKey, t: IDENTITY_TRANSFORM }
}

/**
 * The CSS transform (`translate(tx px, ty px) scale(k)`, origin at the top-left) that makes the bitmap drawn at the
 * committed transform look like the live one: screen_live = k x screen_committed + (tx, ty) for every world point. The
 * identity when the two agree or a zoom is not a usable positive number.
 */
export function gestureMapping(
  committed: CanvasTransform,
  live: CanvasTransform,
  cssW: number,
  cssH: number,
): { readonly k: number; readonly tx: number; readonly ty: number } {
  const k = live.zoom / committed.zoom
  if (!Number.isFinite(k) || k <= 0) return { k: 1, tx: 0, ty: 0 }
  const tx = (cssW / 2) * (1 - k) + live.tx - k * committed.tx
  const ty = (cssH / 2) * (1 - k) + live.ty - k * committed.ty
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return { k: 1, tx: 0, ty: 0 }
  // + 0 turns a -0 into 0
  return { k, tx: tx + 0, ty: ty + 0 }
}
