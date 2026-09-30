// Demon UI state (DEM-03, D-03, D-07): shared focus, tabs, URL tokens, base-switch rule. Original CCRUG code (MIT, NOTICE section 1).
import type { DemonRef, Numogram } from '../../engine/index'
import type { Demon } from '../data/types'
import { facetCount, incidentSource, isDemonFilter, legacyDemon, type DemonFilter } from './demonBrowser'

// ── Tabs ─────────────────────────────────────────────────────────────────

export type DemonTab = 'browser' | 'focus' | 'matrix'
export const DEMON_TABS: readonly DemonTab[] = Object.freeze(['browser', 'focus', 'matrix'])
export const DEMON_TAB_LABEL: Readonly<Record<DemonTab, string>> = Object.freeze({
  browser: 'Browser',
  focus: 'Focus',
  matrix: 'Matrix',
})

// ── Focus model (D-03): shared by the diagram-to-browser and browser-to-diagram entry points ────────────────────

export type DemonFocus =
  | { readonly kind: 'zone'; readonly zone: number }
  | { readonly kind: 'demon'; readonly a: number; readonly b: number } // a > b always

/** `raw.trim().length` beyond this is rejected before any regex/number parsing (T-05-13 DoS bound). */
export const DEMON_PARAM_MAX_LENGTH = 40

/** The most chords a zone focus ever draws, at any base (T-05-26). */
export const FOCUS_CHORD_DRAW_MAX = 4096

export function zoneFocus(zone: number): DemonFocus {
  return { kind: 'zone', zone }
}

/** Normalizes a demon focus so `a > b` always holds, regardless of the caller's argument order. */
export function demonFocusOf(d: { readonly a: number; readonly b: number }): DemonFocus {
  return d.a > d.b ? { kind: 'demon', a: d.a, b: d.b } : { kind: 'demon', a: d.b, b: d.a }
}

export function sameFocus(x: DemonFocus | null, y: DemonFocus | null): boolean {
  if (x === null || y === null) return x === y
  if (x.kind !== y.kind) return false
  if (x.kind === 'zone') return y.kind === 'zone' && x.zone === y.zone
  return y.kind === 'demon' && x.a === y.a && x.b === y.b
}

/** `'z:<zone>'` for a zone focus, `'<a>::<b>'` for a demon focus — decimal integer identity (never a numeral). */
export function formatDemonFocus(f: DemonFocus): string {
  return f.kind === 'zone' ? `z:${f.zone}` : `${f.a}::${f.b}`
}

const ZONE_FOCUS_RE = /^z:(\d{1,10})$/
const DEMON_FOCUS_RE = /^(\d{1,10})::(\d{1,10})$/

/**
 * Parses a `demonFocus=` URL token (T-05-13): never throws, drops anything malformed, hostile, out-of-range at
 * `base`, or longer than DEMON_PARAM_MAX_LENGTH. `raw` is only ever matched against two anchored regexes and
 * converted with `Number` — it is never used as a property key and never reaches any engine call.
 */
export function parseDemonFocus(raw: string | null, base: number): DemonFocus | null {
  if (raw === null) return null
  const t = raw.trim()
  if (t.length === 0 || t.length > DEMON_PARAM_MAX_LENGTH) return null

  const zoneMatch = ZONE_FOCUS_RE.exec(t)
  if (zoneMatch !== null) {
    const zoneStr = zoneMatch[1]
    if (zoneStr === undefined) return null
    const zone = Number(zoneStr)
    return Number.isSafeInteger(zone) && zone < base ? zoneFocus(zone) : null
  }

  const demonMatch = DEMON_FOCUS_RE.exec(t)
  if (demonMatch !== null) {
    const aStr = demonMatch[1]
    const bStr = demonMatch[2]
    if (aStr === undefined || bStr === undefined) return null
    const a = Number(aStr)
    const b = Number(bStr)
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null
    if (a < 0 || a >= base || b < 0 || b >= base || a === b) return null
    return demonFocusOf({ a, b })
  }

  return null
}

/** Parses a `demonFilter=` URL token: trimmed exact membership against the engine's own type/subtype names (T-05-12). */
export function parseDemonFilter(raw: string | null): DemonFilter | null {
  if (raw === null) return null
  const t = raw.trim()
  return isDemonFilter(t) ? t : null
}

/** The zones a focus involves: `[]` for none, `[zone]` for a zone focus, `[a, b]` for a demon focus. */
export function focusZones(f: DemonFocus | null): readonly number[] {
  if (f === null) return []
  return f.kind === 'zone' ? [f.zone] : [f.a, f.b]
}

/** The engine's own ref for a demon focus; null for a zone focus or no focus. */
export function focusDemonRef(g: Numogram, f: DemonFocus | null): DemonRef | null {
  return f !== null && f.kind === 'demon' ? g.demons.ref(f.a, f.b) : null
}

export interface FocusDrawPlan {
  readonly total: number
  readonly stride: number
  readonly drawn: number
}

/**
 * How many chords a focus draws (T-05-26): a demon focus is always exactly one chord. A zone focus draws all
 * `base - 1` incident demons when that fits under FOCUS_CHORD_DRAW_MAX, else strides down to at most that many.
 */
export function focusDrawPlan(base: number, f: DemonFocus): FocusDrawPlan {
  if (f.kind === 'demon') return { total: 1, stride: 1, drawn: 1 }
  const total = base - 1
  const stride = Math.max(1, Math.ceil(total / FOCUS_CHORD_DRAW_MAX))
  const drawn = Math.ceil(total / stride)
  return { total, stride, drawn }
}

/**
 * The chords the main diagram draws for a focus (T-05-26): a demon focus is one legacy-demon entry; a zone focus
 * walks `incidentSource` with the draw plan's stride, so at most FOCUS_CHORD_DRAW_MAX entries are ever produced and
 * no zone's full incident set (up to 2^26 - 1 members) is ever enumerated.
 */
export function focusChordList(g: Numogram, f: DemonFocus): readonly Demon[] {
  if (f.kind === 'demon') {
    return [legacyDemon(g.demons.ref(f.a, f.b), g.base)]
  }
  const src = incidentSource(g, f.zone)
  const plan = focusDrawPlan(g.base, f)
  const out: Demon[] = []
  for (let k = 0; k < src.count; k += plan.stride) {
    out.push(legacyDemon(src.at(k), g.base))
  }
  return out
}

// ── Base-switch sanitation (UI-08 precedent, T-05-15) ────────────────────

export interface DemonSessionState {
  readonly filter: DemonFilter | null
  readonly focus: DemonFocus | null
}

/**
 * The demon session state after switching to `next` (T-05-15): the focus always clears (a zone id or demon pair may
 * not even exist at the new base), and the filter survives only when it still has at least one member there.
 */
export function demonsAfterBaseSwitch(prev: DemonSessionState, next: Numogram): DemonSessionState {
  const filter = prev.filter !== null && facetCount(next, prev.filter) > 0 ? prev.filter : null
  return { filter, focus: null }
}

/** Which demon tab a freshly-hydrated focus should open: a zone focus opens Focus; a demon focus is the pinned row in Browser. */
export function initialDemonTab(focus: DemonFocus | null): DemonTab {
  return focus !== null && focus.kind === 'zone' ? 'focus' : 'browser'
}
