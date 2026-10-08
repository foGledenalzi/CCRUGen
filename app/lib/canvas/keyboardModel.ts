// Canvas-tier keyboard model (Phase 6 D-08): one focusable canvas, arrows between zones, Tab through a zone's syzygy, current and gate. Pure; original CCRUG code (MIT, NOTICE section 1).
//
// The SVG tier is one flat roving order (zones, then syzygies, currents, gates). The Canvas tier has one Tab stop, so
// it is two-level: arrow keys move the ring between visible zones (zone-id order, wrapping), and Tab steps the ring
// through the focused zone's own syzygy, current and gate before it lets the browser move focus on (never a trap).
// The pair graph has one level only: arrows visit visible pairs in pair-id order and Tab leaves at once.
//
// Everything here is plain data in, plain data out: the component translates a DOM key event into `nextTarget`, applies
// the outcome, and uses `focusKeyOf` / `announcementFor` / `activationAnnouncement` for `data-focus-key` and the live
// region. The strings are the SVG tier's own aria-label templates and focus-key grammar, so both tiers read alike.
// Callers should not pass a key event that carries Ctrl, Meta or Alt (those are browser shortcuts, for example
// Ctrl+Plus page zoom); Shift only matters for Tab.
import { regionLabel, type RegionId } from '../regions'

/** Page Up / Page Down jump this many positions in the order (UI-SPEC default: the Canvas range reaches thousands of zones). */
export const PAGE_STEP = 10

export type RingTarget =
  | { readonly kind: 'zone'; readonly zone: number }
  | { readonly kind: 'syzygy'; readonly zone: number }
  | { readonly kind: 'current'; readonly zone: number }
  | { readonly kind: 'gate'; readonly zone: number }
  | { readonly kind: 'pair'; readonly pair: number }

export interface KeyboardContext {
  readonly mode: 'zones' | 'pairs'
  /** Visible zones (zones mode) or visible pair ids (pairs mode), ascending; muted ones are not in it. */
  readonly order: readonly number[]
  /** The zone's syzygy is drawn and not muted (layer on, both ends visible). */
  hasSyzygy(zone: number): boolean
  hasCurrent(zone: number): boolean
  hasGate(zone: number): boolean
}

export type KeyOutcome =
  | { readonly kind: 'move'; readonly target: RingTarget }
  | { readonly kind: 'activate'; readonly target: RingTarget }
  | { readonly kind: 'zoom'; readonly action: 'in' | 'out' | 'fit' }
  /** The ring stays; the caller must NOT preventDefault, so the browser moves focus on. */
  | { readonly kind: 'leave' }
  /** Not a key this model owns (or nothing to act on): the caller leaves the event alone. */
  | { readonly kind: 'ignore' }

const LEAVE: KeyOutcome = { kind: 'leave' }
const IGNORE: KeyOutcome = { kind: 'ignore' }

/** The first visible zone or pair as a ring target, or null when nothing is visible. */
export function initialTarget(ctx: KeyboardContext): RingTarget | null {
  const first = ctx.order[0]
  if (first === undefined) return null
  return ctx.mode === 'pairs' ? { kind: 'pair', pair: first } : { kind: 'zone', zone: first }
}

/** The zone (zones mode) or pair (pairs mode) a target belongs to, or null when the target is of the wrong kind for the mode. */
function unitOf(target: RingTarget, mode: KeyboardContext['mode']): number | null {
  if (mode === 'pairs') return target.kind === 'pair' ? target.pair : null
  return target.kind === 'pair' ? null : target.zone
}

/**
 * The target a key applies to: the ring as it is when its zone or pair is still in the order, otherwise (no ring yet,
 * a muted zone, a ring of the wrong kind for the mode) the initial target. The component re-seeds its ring with
 * `initialTarget` when the order changes, so this is the safety net, not the normal path.
 */
function startingTarget(current: RingTarget | null, ctx: KeyboardContext): RingTarget | null {
  if (current !== null) {
    const unit = unitOf(current, ctx.mode)
    if (unit !== null && ctx.order.includes(unit)) return current
  }
  return initialTarget(ctx)
}

function targetAt(ctx: KeyboardContext, index: number): RingTarget {
  const unit = ctx.order[index] as number
  return ctx.mode === 'pairs' ? { kind: 'pair', pair: unit } : { kind: 'zone', zone: unit }
}

type SubKind = 'syzygy' | 'current' | 'gate'
/** Tab order inside one zone: syzygy, then current, then gate. */
const SUB_STOPS: readonly SubKind[] = ['syzygy', 'current', 'gate']

function hasSubStop(kind: SubKind, zone: number, ctx: KeyboardContext): boolean {
  if (kind === 'syzygy') return ctx.hasSyzygy(zone)
  if (kind === 'current') return ctx.hasCurrent(zone)
  return ctx.hasGate(zone)
}

/** Tab (shift = false) steps forward through the zone's stops and then leaves; Shift+Tab steps back to the zone and then leaves. */
function tabOutcome(start: RingTarget, shift: boolean, ctx: KeyboardContext): KeyOutcome {
  // in pairs mode the starting target is always a pair (see startingTarget), so there are no sub-stops to visit
  if (start.kind === 'pair') return LEAVE
  const zone = start.zone
  // position inside the zone: -1 at zone level, else the index into SUB_STOPS
  const position = start.kind === 'zone' ? -1 : SUB_STOPS.indexOf(start.kind)
  if (!shift) {
    for (let i = position + 1; i < SUB_STOPS.length; i++) {
      const kind = SUB_STOPS[i] as SubKind
      if (hasSubStop(kind, zone, ctx)) return { kind: 'move', target: { kind, zone } }
    }
    return LEAVE
  }
  if (position === -1) return LEAVE
  for (let i = position - 1; i >= 0; i--) {
    const kind = SUB_STOPS[i] as SubKind
    if (hasSubStop(kind, zone, ctx)) return { kind: 'move', target: { kind, zone } }
  }
  return { kind: 'move', target: { kind: 'zone', zone } }
}

/**
 * What a key does with the ring at `current`. An arrow, Home, End or Page key always lands at zone (or pair) level, also
 * when the ring was on an edge. Positions are counted in `ctx.order`, so muted zones never count. A key that moves
 * nothing at an end (Page at the last position) still answers `move`, with the same target, because the key is the
 * model's: the caller prevents the default and may skip the repeat announcement.
 */
export function nextTarget(current: RingTarget | null, key: string, shiftKey: boolean, ctx: KeyboardContext): KeyOutcome {
  const count = ctx.order.length
  if (count === 0) return key === 'Tab' ? LEAVE : IGNORE
  const start = startingTarget(current, ctx)
  if (start === null) return key === 'Tab' ? LEAVE : IGNORE
  const unit = unitOf(start, ctx.mode) as number
  const index = ctx.order.indexOf(unit)

  switch (key) {
    case 'Tab':
      return tabOutcome(start, shiftKey, ctx)
    case 'ArrowRight':
    case 'ArrowDown':
      return { kind: 'move', target: targetAt(ctx, (index + 1) % count) }
    case 'ArrowLeft':
    case 'ArrowUp':
      return { kind: 'move', target: targetAt(ctx, (index - 1 + count) % count) }
    case 'Home':
      return { kind: 'move', target: targetAt(ctx, 0) }
    case 'End':
      return { kind: 'move', target: targetAt(ctx, count - 1) }
    case 'PageDown':
      return { kind: 'move', target: targetAt(ctx, Math.min(index + PAGE_STEP, count - 1)) }
    case 'PageUp':
      return { kind: 'move', target: targetAt(ctx, Math.max(index - PAGE_STEP, 0)) }
    case 'Enter':
    case ' ':
      return { kind: 'activate', target: start }
    case '+':
    case '=':
      return { kind: 'zoom', action: 'in' }
    case '-':
    case '_':
      return { kind: 'zoom', action: 'out' }
    case '0':
      return { kind: 'zoom', action: 'fit' }
    default:
      return IGNORE
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Text: focus keys and announcements
// ---------------------------------------------------------------------------------------------------------------------

/** What the model needs to name a target; the component builds it from the numogram view and the selection. */
export interface TargetText {
  readonly zoneLabels: readonly string[]
  readonly zoneRegion: readonly RegionId[]
  /** The view.syzygies entry of the zone's pair (both members of a pair answer with the same entry), or null. */
  syzygyOf(zone: number): { readonly a: number; readonly b: number } | null
  /** The view.currents entry of the zone's pair, or null. */
  currentOf(zone: number): { readonly name: string; readonly label: string } | null
  /** The view.gates entry whose origin is the zone, or null. */
  gateOf(zone: number): { readonly name: string; readonly from: number; readonly to: number } | null
  pairOf(q: number): { readonly lo: number; readonly hi: number }
  isSelected(zone: number): boolean
}

const SELECTED = ', selected'
const NOT_SELECTED = ', not selected'
const PINNED = ', pinned'

/** `Zone c, Torque`, with `, selected` appended only when asked for (the SVG node's own aria-label). */
function zoneText(zone: number, text: TargetText, withSelected: boolean): string {
  const region = regionLabel(text.zoneRegion[zone] as RegionId)
  return `Zone ${text.zoneLabels[zone]}, ${region}${withSelected ? SELECTED : ''}`
}

/** The key and the label of an edge target, or null when the zone has no such edge. Pair targets are handled by their callers. */
function edgeOf(target: RingTarget, text: TargetText): { readonly key: string; readonly label: string } | null {
  const labels = text.zoneLabels
  if (target.kind === 'syzygy') {
    const s = text.syzygyOf(target.zone)
    return s === null ? null : { key: `syzygy:${s.a}:${s.b}`, label: `Syzygy ${labels[s.a]}::${labels[s.b]}` }
  }
  if (target.kind === 'current') {
    const c = text.currentOf(target.zone)
    return c === null ? null : { key: `current:${c.name}`, label: `Current ${c.name}: ${c.label}` }
  }
  if (target.kind === 'gate') {
    const gt = text.gateOf(target.zone)
    return gt === null
      ? null
      : { key: `gate:${gt.name}`, label: `Gate ${gt.name}: zone ${labels[gt.from]} to zone ${labels[gt.to]}` }
  }
  return null
}

function pairLabel(q: number, text: TargetText): string {
  const { lo, hi } = text.pairOf(q)
  return `Syzygy ${text.zoneLabels[hi]}::${text.zoneLabels[lo]}`
}

/**
 * The `data-focus-key` of a target, in the SVG tier's grammar: `zone:15`, `syzygy:13:14`, `current:<name>`,
 * `gate:<name>`, `pair:3`. An edge the zone does not have degrades to the owner zone's key.
 */
export function focusKeyOf(target: RingTarget, text: TargetText): string {
  if (target.kind === 'zone') return `zone:${target.zone}`
  if (target.kind === 'pair') return `pair:${target.pair}`
  return edgeOf(target, text)?.key ?? `zone:${target.zone}`
}

/** What the live region says when the ring moves onto a target: the SVG tier's aria-label of the same element. */
export function announcementFor(target: RingTarget, text: TargetText): string {
  if (target.kind === 'zone') return zoneText(target.zone, text, text.isSelected(target.zone))
  if (target.kind === 'pair') return pairLabel(target.pair, text)
  const edge = edgeOf(target, text)
  return edge === null ? zoneText(target.zone, text, text.isSelected(target.zone)) : edge.label
}

/**
 * What the live region says after Enter or Space. A zone reports its selection state AFTER the toggle (`nowSelected`),
 * built without the selected suffix so it is never doubled; an edge or a pair is reported as pinned. An edge that does
 * not exist cannot have been pinned, so it falls back to the plain announcement of its owner zone.
 */
export function activationAnnouncement(target: RingTarget, text: TargetText, nowSelected: boolean): string {
  if (target.kind === 'zone') return `${zoneText(target.zone, text, false)}${nowSelected ? SELECTED : NOT_SELECTED}`
  if (target.kind === 'pair') return `${pairLabel(target.pair, text)}${PINNED}`
  const edge = edgeOf(target, text)
  return edge === null ? announcementFor(target, text) : `${edge.label}${PINNED}`
}
