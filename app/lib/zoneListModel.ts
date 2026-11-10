// The pure rules behind the Names panel zone list (Phase 7, plan 19; D-02, D-07, NAM-01, 07-UI-SPEC "Zone List", T-07-03f, T-07-17e).
// How a pasted list is split and planned (all or nothing), which row a navigation key leads to, what a typed Go to zone text means,
// and the small decisions the list component makes (commit, message, Tab stop, scroll once per pin, scroll after an undo). Nothing
// here reads the browser; every sentence comes from the copy module and every number is a named value. Original CCRUG code (MIT,
// NOTICE section 1).
import { parseNumeral, toNfc, validateSound, type TextProblem } from '../../engine/index'
import { zoneIssue } from './namingCopy'
import { ZONE_PAGE_STEP } from './namingLimits'

/** [default] Characters a Go to zone text may have: longer text is no zone (and the field's own limit is the same number). */
export const GOTO_MAX_LENGTH = 40

/** [default] Height (px) of the sticky header row of the zone list (UI-SPEC: 24px, Label role). */
export const ZONE_HEADER_HEIGHT_PX = 24

/** [default] Animation frames the list waits for a scrolled-to row to be rendered before it gives up focusing it. */
export const ZONE_FOCUS_RETRY_FRAMES = 12

// ----- bulk paste -----

const PASTE_SEPARATORS = /[,;\t\n\r ]+/

/**
 * The tokens of a pasted text: split on commas, semicolons, tabs, newlines and spaces, empty tokens dropped. One token is the same as
 * typing, so the caller treats only two or more as a bulk paste. A linear pass (the pattern has no nested repeat).
 */
export function splitPaste(text: string): string[] {
  return text.split(PASTE_SEPARATORS).filter(token => token.length > 0)
}

/** A bulk paste ready to apply, or the first token that cannot be a sound. */
export type PastePlan =
  | { readonly ok: true; readonly sounds: string[]; readonly used: number; readonly unused: number }
  | { readonly ok: false; readonly zone: number; readonly reason: TextProblem }

/**
 * The sounds a paste puts into zones `fromZone` onward, all or nothing (T-07-17e): every token that has a zone is checked in order,
 * and the first bad one refuses the whole paste and names its zone, with no sound carried out. Tokens past the last zone are counted
 * as unused and are not looked at. The planned sounds are the NFC, trimmed forms the engine would store.
 */
export function planPaste(tokens: readonly string[], fromZone: number, base: number): PastePlan {
  const room = Number.isInteger(fromZone) && fromZone >= 0 ? Math.max(0, base - fromZone) : 0
  const used = Math.min(tokens.length, room)
  const sounds: string[] = []
  for (let i = 0; i < used; i++) {
    const check = validateSound(tokens[i] as string)
    if (!check.ok) return { ok: false, zone: fromZone + i, reason: check.reason }
    sounds.push(check.text)
  }
  return { ok: true, sounds, used, unused: tokens.length - used }
}

// ----- keyboard -----

/**
 * The row a navigation key leads to from row `index` of `count` rows: one row for the arrows, ZONE_PAGE_STEP rows for Page Up and
 * Page Down (both clamped), the first and last row for Ctrl+Home and Ctrl+End. Plain Home and End keep moving the caret, so they
 * (and every other key) give null.
 */
export function nextRowIndex(index: number, key: string, ctrl: boolean, count: number): number | null {
  if (count <= 0) return null
  const last = count - 1
  switch (key) {
    case 'ArrowDown':
      return Math.min(index + 1, last)
    case 'ArrowUp':
      return Math.max(index - 1, 0)
    case 'PageDown':
      return Math.min(index + ZONE_PAGE_STEP, last)
    case 'PageUp':
      return Math.max(index - ZONE_PAGE_STEP, 0)
    case 'Home':
      return ctrl ? 0 : null
    case 'End':
      return ctrl ? last : null
    default:
      return null
  }
}

/** The one row whose controls are in the Tab order: the active row while it is rendered, else the first rendered row (the list always has a stop). */
export function tabStopZone(active: number, rendered: readonly number[]): number {
  if (rendered.includes(active)) return active
  return rendered.length > 0 ? (rendered[0] as number) : active
}

// ----- Go to zone -----

const PLAIN_DECIMAL = /^[0-9]{1,10}$/

/**
 * The zone a Go to zone text means, or null. The label exactly as shown for a zone wins; otherwise the text is a numeral of the base
 * (in range); otherwise a plain decimal (in range). The text is trimmed and a text longer than GOTO_MAX_LENGTH is no zone. The label
 * scan is one pass over the zones (at most the interactive ceiling) and runs on Enter only.
 */
export function resolveGoTo(text: string, base: number, zoneLabel: (zone: number) => string): number | null {
  const t = text.trim()
  if (t.length === 0 || t.length > GOTO_MAX_LENGTH) return null
  for (let zone = 0; zone < base; zone++) {
    if (zoneLabel(zone) === t) return zone
  }
  try {
    const value = parseNumeral(t, base)
    if (value < base) return value
  } catch {
    // not a numeral of this base: the decimal reading below
  }
  if (PLAIN_DECIMAL.test(t)) {
    const value = Number(t)
    if (value < base) return value
  }
  return null
}

// ----- sound fields and the list message -----

/** What committing a sound field does. */
export type SoundCommit =
  | { readonly kind: 'none' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'invalid'; readonly reason: TextProblem }
  | { readonly kind: 'commit'; readonly text: string }

/**
 * The decision behind Enter and blur in a sound field: nothing without a draft, nothing for text that equals the stored sound once
 * trimmed and put in NFC (so a no-change commit never locks a zone or makes a history entry), a refusal with the first failing rule
 * for an invalid draft, else the text to apply.
 */
export function soundCommitOf(draft: string | undefined, stored: string): SoundCommit {
  if (draft === undefined) return { kind: 'none' }
  const check = validateSound(draft)
  if (!check.ok) return { kind: 'invalid', reason: check.reason }
  return check.text === toNfc(stored) ? { kind: 'unchanged' } : { kind: 'commit', text: check.text }
}

/**
 * The one list-level message line: a note (a refused paste, an unknown zone) wins; otherwise the problem of the row the message
 * belongs to while that row is still invalid; otherwise the problem of the lowest invalid row; otherwise nothing. The row's
 * `Zone {label}: {reason}` form comes from the copy module.
 */
export function listMessageOf(
  note: string | null,
  messageZone: number | null,
  problems: ReadonlyMap<number, TextProblem>,
  zoneLabel: (zone: number) => string,
): string {
  if (note !== null) return note
  if (messageZone !== null) {
    const own = problems.get(messageZone)
    if (own !== undefined) return zoneIssue(zoneLabel(messageZone), own)
  }
  let lowest: number | null = null
  for (const zone of problems.keys()) {
    if (lowest === null || zone < lowest) lowest = zone
  }
  if (lowest === null) return ''
  return zoneIssue(zoneLabel(lowest), problems.get(lowest) as TextProblem)
}

// ----- scrolling -----

/** The zone to scroll to for a pin: the pinned zone when it is inside the base and not the one already scrolled to (once per pin), else null. */
export function pinScrollTarget(pinned: number | null, scrolled: number | null, base: number): number | null {
  if (pinned === null || pinned < 0 || pinned >= base) return null
  return pinned === scrolled ? null : pinned
}

/** The zone to scroll into view after an undo or redo: the single changed zone of a restore the list has not seen yet, else null. */
export function restoredScrollTarget(restored: { readonly tick: number; readonly zone: number | null }, seenTick: number): number | null {
  return restored.tick !== seenTick ? restored.zone : null
}
