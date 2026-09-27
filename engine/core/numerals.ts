// Numerals in the numogram's own base (D-04, D-05): the formatter, its exact inverse, and the display names built on
// them. Digits come from repeated division, never from the built-in radix conversion or its parsing counterpart, so
// the tests can use that built-in as an independent oracle.
//
// Scheme (the contract Phase 4 consumes for zone labels beyond base 36):
//   - base 2..36: one character per digit from NUMERAL_DIGITS (lowercase), no separator ('ff', 'b', '56').
//   - base 37..2^26: each digit is written as its decimal value (no leading zeros inside a digit), digits joined by
//     NUMERAL_SEPARATOR ('1.0.1' is 3601 in base 60; a single-digit value is plain decimal, '59').
//   - minDigits left-pads with zero digits ('03' in base 10, '0.3' in base 60).
//   - parseNumeral accepts exactly what formatNumeral can write (plus extra leading zero digits where the grammar allows).
import { clipEcho, MAX_BASE } from './base'

export const NUMERAL_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
export const NUMERAL_SEPARATOR = '.'

const LETTER_BASE_LIMIT = 36 // NUMERAL_DIGITS.length: the largest base written with single characters
const MAX_MIN_DIGITS = 64 // the most digits formatNumeral writes (its padding limit) and therefore the most parseNumeral reads
const MAX_GROUP_CHARS = String(MAX_BASE - 1).length // 8: the widest decimal digit group (67108863)
// parseNumeral refuses longer text before reading any of it. A letter-base digit is one character; a dotted numeral is
// at most MAX_MIN_DIGITS groups of MAX_GROUP_CHARS characters plus the dots between them (575).
const MAX_LETTER_TEXT_LENGTH = MAX_MIN_DIGITS
const MAX_DOTTED_TEXT_LENGTH = MAX_MIN_DIGITS * MAX_GROUP_CHARS + (MAX_MIN_DIGITS - 1)
const TORQUE_LETTERS = 26

const CHAR_0 = 48
const CHAR_9 = 57
const CHAR_LOWER_A = 97
const CHAR_LOWER_Z = 122
const CHAR_DOT = 46

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

function checkBase(base: number): void {
  if (!Number.isSafeInteger(base) || base < 2 || base > MAX_BASE) {
    throw new RangeError(`Invalid numeral base ${show(base)}: must be a whole number from 2 to ${MAX_BASE}`)
  }
}

function checkValue(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid numeral value ${show(value)}: must be a non-negative safe integer`)
  }
}

function numeralError(text: string, base: number, why: string): RangeError {
  return new RangeError(`Invalid numeral ${JSON.stringify(clipEcho(text))} for base ${base}: ${why}`)
}

/** The digits of value in the base, most significant first ([0] for 0). Each digit is a number 0..base-1. */
export function digitsOf(value: number, base: number): number[] {
  checkBase(base)
  checkValue(value)
  if (value === 0) return [0]
  const digits: number[] = []
  let rest = value
  while (rest > 0) {
    const digit = rest % base
    digits.push(digit)
    rest = (rest - digit) / base // exact: the dividend is a multiple of base
  }
  return digits.reverse()
}

/** value written in the base (see the scheme above), left-padded with zero digits to at least minDigits digits. */
export function formatNumeral(value: number, base: number, minDigits = 1): string {
  if (!Number.isSafeInteger(minDigits) || minDigits < 1 || minDigits > MAX_MIN_DIGITS) {
    throw new RangeError(`Invalid minDigits ${show(minDigits)}: must be a whole number from 1 to ${MAX_MIN_DIGITS}`)
  }
  const digits = digitsOf(value, base) // also validates value and base
  const padded = digits.length >= minDigits ? digits : new Array<number>(minDigits - digits.length).fill(0).concat(digits)
  if (base > LETTER_BASE_LIMIT) return padded.join(NUMERAL_SEPARATOR)
  let text = ''
  for (const digit of padded) text += NUMERAL_DIGITS.charAt(digit)
  return text
}

// One step of reading a numeral: result * base + digit, refused above the largest safe integer. Exact: when the true
// value is at most 2^53 - 1 every intermediate is exact, and when it is larger the rounded value is at least 2^53.
function step(result: number, base: number, digit: number, text: string): number {
  const next = result * base + digit
  if (next > Number.MAX_SAFE_INTEGER) {
    throw numeralError(text, base, `the value is above the largest safe integer ${Number.MAX_SAFE_INTEGER}`)
  }
  return next
}

/**
 * Reads a numeral written by formatNumeral back into its value, for every padding formatNumeral accepts (up to 64
 * digits). RangeError for a non-string, an empty or over-long text (more than 64 characters up to base 36, more than
 * 575 characters or 64 digit groups above it), any character outside the grammar, a digit at or above the base, or a
 * value above Number.MAX_SAFE_INTEGER. One linear pass over at most 575 characters (no backtracking pattern).
 *  - base <= 36: characters of NUMERAL_DIGITS only (lowercase), leading '0' digits allowed.
 *  - base > 36: at most 64 groups separated by single dots, each group `0` or `[1-9][0-9]*` with a value below the
 *    base; no empty group, no leading or trailing dot.
 */
export function parseNumeral(text: string, base: number): number {
  checkBase(base)
  if (typeof text !== 'string') {
    throw new RangeError(`Invalid numeral ${show(text)} for base ${base}: the numeral must be a string`)
  }
  if (text.length === 0) throw numeralError(text, base, 'the numeral is empty')
  const maxLength = base <= LETTER_BASE_LIMIT ? MAX_LETTER_TEXT_LENGTH : MAX_DOTTED_TEXT_LENGTH
  if (text.length > maxLength) throw numeralError(text, base, `longer than ${maxLength} characters`)

  let result = 0
  if (base <= LETTER_BASE_LIMIT) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      let digit: number
      if (c >= CHAR_0 && c <= CHAR_9) digit = c - CHAR_0
      else if (c >= CHAR_LOWER_A && c <= CHAR_LOWER_Z) digit = c - CHAR_LOWER_A + 10
      else throw numeralError(text, base, `unexpected character ${JSON.stringify(text.charAt(i))}`)
      if (digit >= base) throw numeralError(text, base, `the digit ${JSON.stringify(text.charAt(i))} is not below the base`)
      result = step(result, base, digit, text)
    }
    return result
  }

  let group = 0 // value of the digit group being read
  let groupLength = 0 // characters in it
  let groups = 0 // digit groups started so far, the one being read included
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === CHAR_DOT) {
      if (groupLength === 0) throw numeralError(text, base, 'empty digit group')
      result = step(result, base, group, text)
      group = 0
      groupLength = 0
    } else if (c >= CHAR_0 && c <= CHAR_9) {
      if (groupLength === 0) {
        groups++
        if (groups > MAX_MIN_DIGITS) throw numeralError(text, base, `more than ${MAX_MIN_DIGITS} digit groups`)
      }
      if (groupLength === 1 && group === 0) throw numeralError(text, base, 'leading zero in a digit group')
      group = group * 10 + (c - CHAR_0)
      groupLength++
      if (group >= base) throw numeralError(text, base, `the digit ${group} is not below the base`)
    } else {
      throw numeralError(text, base, `unexpected character ${JSON.stringify(text.charAt(i))}`)
    }
  }
  if (groupLength === 0) throw numeralError(text, base, 'empty digit group')
  return step(result, base, group, text)
}

/** A net-span a::b with both zones written in the base ('b::3' in base 12). */
export function formatNetSpan(a: number, b: number, base: number): string {
  return `${formatNumeral(a, base)}::${formatNumeral(b, base)}`
}

/** A gate name from its cumulation T(zone), written in the base and padded to two digits ('Gt-56' for 66 in base 12). */
export function formatGateName(cumulation: number, base: number): string {
  return 'Gt-' + formatNumeral(cumulation, base, 2)
}

/** Display label of a Torque: 'A'..'Z' for indices 0..25, the decimal number index + 1 from 26 on. The index is the identity. */
export function torqueLabel(torqueIndex: number): string {
  if (!Number.isSafeInteger(torqueIndex) || torqueIndex < 0) {
    throw new RangeError(`Invalid Torque index ${show(torqueIndex)}: must be a non-negative safe integer`)
  }
  return torqueIndex < TORQUE_LETTERS ? String.fromCharCode(65 + torqueIndex) : String(torqueIndex + 1)
}
