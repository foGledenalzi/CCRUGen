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

/**
 * The rows to render: the ones the scroll range picked, plus the row that has focus when the range left it out, in ascending order
 * (review WR-06). A focused field that scrolling unmounted would drop the focus to the page, where the global shortcuts are live, and
 * orphan its draft. A row that is not a row of the list (a stale focus) is never added.
 */
export function withFocusedRow(rows: readonly number[], focused: number | null, count: number): number[] {
  if (focused === null || !Number.isInteger(focused) || focused < 0 || focused >= count || rows.includes(focused)) return [...rows]
  return [...rows, focused].sort((a, b) => a - b)
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

// ----- the list state: drafts, refusals, the message -----

/**
 * What the list remembers between renders: the text typed into a field that is not committed yet (a row scrolled out of view
 * keeps its draft), the rows whose draft is refused and why, the row the message belongs to, and a note (a refused paste, an unknown
 * zone). Maps only ever hold the zones the visitor touched, so the state stays small at the interactive ceiling (T-07-02d).
 */
export interface ListState {
  readonly drafts: ReadonlyMap<number, string>
  readonly problems: ReadonlyMap<number, TextProblem>
  readonly messageZone: number | null
  readonly note: string | null
}

export const EMPTY_LIST_STATE: ListState = Object.freeze({ drafts: new Map(), problems: new Map(), messageZone: null, note: null })

function without<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  if (!map.has(key)) return map
  const next = new Map(map)
  next.delete(key)
  return next
}

function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  return new Map(map).set(key, value)
}

/**
 * A keystroke in the field of `zone`: the draft takes the text. A refusal already on show follows the draft, so it updates with the
 * new first failing rule and clears the moment the text is valid (or equals the stored sound) again. A note is dropped.
 */
export function typeInto(s: ListState, zone: number, text: string, stored: string): ListState {
  let problems = s.problems
  if (problems.has(zone)) {
    const again = soundCommitOf(text, stored)
    problems = again.kind === 'invalid' ? withEntry(problems, zone, again.reason) : without(problems, zone)
  }
  return { ...s, drafts: withEntry(s.drafts, zone, text), problems, note: null }
}

/** The row is settled (committed, unchanged, or reverted): its draft and refusal go, and so does a message that was about it, and any note. */
export function settleRow(s: ListState, zone: number): ListState {
  return {
    drafts: without(s.drafts, zone),
    problems: without(s.problems, zone),
    messageZone: s.messageZone === zone ? null : s.messageZone,
    note: null,
  }
}

/** A paste is about to overwrite `count` rows from `from`: their drafts and refusals go (the pasted sounds replace whatever was typed). */
export function settleRows(s: ListState, from: number, count: number): ListState {
  let next = s
  for (let zone = from; zone < from + count; zone++) next = settleRow(next, zone)
  return { ...next, note: null }
}

/** The draft of `zone` was refused for `reason`: it stays, the row is marked, and the message is about this row. */
export function refuseRow(s: ListState, zone: number, reason: TextProblem): ListState {
  return { ...s, problems: withEntry(s.problems, zone, reason), messageZone: zone, note: null }
}

/** The list-level note (a refused paste, an unknown zone), or null to drop it. */
export function withNote(s: ListState, note: string | null): ListState {
  return s.note === note ? s : { ...s, note }
}

/** True when Escape has something to undo in this row: an uncommitted draft or a refusal. */
export function hasRowEdit(s: ListState, zone: number): boolean {
  return s.drafts.has(zone) || s.problems.has(zone)
}
