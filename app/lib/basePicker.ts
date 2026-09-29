// Base picker logic (UI-01, D-04..D-07): candidate evaluation through validateBase, refusal copy (UI-SPEC),
// stepping and summary lines. Pure; the component is app/components/numogram/BasePicker.tsx.
// Original CCRUG code (MIT, NOTICE section 1).
import { clipEcho, validateBase, MAX_BASE, type BaseCheck, type BaseProblem } from '../../engine/core/base'
import { splitAlphabet, validateAlphabet, type AlphabetCheck } from './customAlphabet'
import type { NumogramSummary } from './numogramView'

/** The base picker's notable-base chip strip, in this exact ascending order (D-07, user-amended UI-01 chip set). */
export const NOTABLE_BASES = [2, 4, 6, 8, 10, 12, 16, 22, 28, 64, 80, 82, 100, 1024] as const

/** The stepper's jump size (D-05): next/previous even base, no larger-jump modifier. */
export const BASE_STEP = 2

/** The base-picker slider's range (matches the notable-base chip ceiling). */
export const SLIDER_MIN = 2
export const SLIDER_MAX = 1024

/** How long a typed/dragged candidate previews before it is validated and committed (D-04). */
export const BASE_DEBOUNCE_MS = 200

/** Every reason a typed candidate can be refused: the engine's own reasons, plus text that never reached the engine. */
export type RefusalReason = BaseProblem | 'malformed'

/** What a typed/dragged base candidate resolves to: nothing yet, a commit, or a refusal with its exact message. */
export type CandidateResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ok'; readonly base: number }
  | { readonly kind: 'refused'; readonly reason: RefusalReason; readonly message: string }

// A whole number, optionally signed, optionally with a decimal part — deliberately narrower than Number()'s own
// parsing (excludes hex, scientific notation, leading '+'/whitespace tricks) so those shapes read as 'malformed'
// instead of silently becoming a different number than the visitor typed.
const CANDIDATE_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** The exact UI-SPEC refusal copy for reason, echoing raw (clipped) and the base the picker keeps showing (D-06). */
export function refusalMessage(reason: RefusalReason, raw: string, lastValid: number): string {
  const r = clipEcho(raw.trim())
  switch (reason) {
    case 'odd':
      return `Base ${r} is odd — numograms need an even base. Showing base ${lastValid}.`
    case 'too-large':
      return `Base ${r} is above the safe ceiling (2^26). Showing base ${lastValid}.`
    case 'not-integer':
      return `Base ${r} isn't a whole number. Showing base ${lastValid}.`
    case 'zero':
    case 'negative':
      return `Base ${r} is too small — a numogram needs at least 2 zones. Showing base ${lastValid}.`
    case 'not-a-number':
    case 'infinite':
    case 'malformed':
      return `'${r}' isn't a number. Showing base ${lastValid}.`
  }
}

/**
 * What a typed candidate (the picker's live text state) resolves to against lastValid, the base still shown while
 * refused (D-04, D-06): trimmed-empty previews nothing; a shape Number() would parse in a surprising way (hex,
 * scientific notation, ...) is 'malformed' before it ever reaches validateBase; everything else is validateBase's
 * own verdict, converted to a CandidateResult. Never throws.
 */
export function evaluateCandidate(text: string, lastValid: number): CandidateResult {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (!CANDIDATE_RE.test(trimmed)) {
    return { kind: 'refused', reason: 'malformed', message: refusalMessage('malformed', text, lastValid) }
  }
  const check = validateBase(Number(trimmed))
  if (check.ok) return { kind: 'ok', base: check.base }
  return { kind: 'refused', reason: check.reason, message: refusalMessage(check.reason, text, lastValid) }
}

/** refusalMessage for a URL's base= value (04-05's BaseRefusal: raw text plus the engine check, or null when malformed). */
export function refusalFromUrl(raw: string, check: BaseCheck | null, lastValid = 10): string {
  const reason: RefusalReason = check && !check.ok ? check.reason : 'malformed'
  return refusalMessage(reason, raw, lastValid)
}

/** The next/previous even base from the stepper (D-05), clamped to the engine's own admissible range. */
export function stepBase(base: number, direction: 1 | -1): number {
  return clamp(base + BASE_STEP * direction, SLIDER_MIN, MAX_BASE)
}

/** Where the slider thumb sits for base (clamped to the slider's own range; a base above it pins to the end). */
export function sliderPosition(base: number): number {
  return clamp(base, SLIDER_MIN, SLIDER_MAX)
}

// The Torque segment of the live summary: every listed length, or an ellipsis count past summarize's own display
// limit (SUMMARY_TORQUE_LIMIT in numogramView.ts) so a huge-cycle-count base never grows the summary unbounded.
function torquePart(s: NumogramSummary): string {
  if (s.torqueCount === 0) return 'Torque none'
  const lengths = s.torqueLengths.join(',')
  const hidden = s.torqueCount - s.torqueLengths.length
  return hidden > 0 ? `Torque [${lengths},…+${hidden}]` : `Torque [${lengths}]`
}

/** The picker's live one-line summary (D-02): zones, Warp yes/no, Torque cycle lengths, demon count. */
export function summaryLine(s: NumogramSummary): string {
  const zones = `${s.zoneCount.toLocaleString('en-US')} zones`
  const warp = `Warp ${s.hasWarp ? 'yes' : 'no'}`
  const demons = `${s.demonCount.toLocaleString('en-US')} demons`
  return [zones, warp, torquePart(s), demons].join(' · ')
}

/** The expanded dropdown's per-type demon breakdown (chrono/amphi/xeno), shown alongside the live summary. */
export function typeCountsLine(s: NumogramSummary): string {
  const { chrono, amphi, xeno } = s.typeCounts
  return `chrono ${chrono} · amphi ${amphi} · xeno ${xeno}`
}

/** A typed custom-alphabet candidate (D-12): the split characters plus their validity against base. Never throws. */
export function evaluateCustomAlphabet(text: string, base: number): { readonly chars: string[]; readonly check: AlphabetCheck } {
  const chars = splitAlphabet(text)
  return { chars, check: validateAlphabet(chars, base) }
}
