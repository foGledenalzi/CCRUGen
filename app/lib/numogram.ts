/**
 * Compute the digital-reduction (plex) expression for a cumulation value, in the numogram's own base (CLAUDE.md core
 * rule: digital root arithmetic is always in-base, never a decimal digit sum). Returns null if cum < base (a single
 * digit, no reduction needed). Only the first reduction step shows its digit breakdown; later steps show just the
 * running sum (the pre-existing, frozen-behaviour-baseline-captured shape at base 10 — see the plexExpr deviation
 * note in 04-09-SUMMARY.md).
 * Example: plexExpr(45, 10) => "4+5=9"
 *          plexExpr(28, 10) => "2+8=10=1"
 */
import { digitsOf, formatNumeral } from '../../engine/index'

export function plexExpr(cum: number, base: number): string | null {
  if (cum < base) return null
  let current = cum
  let expr = ''
  let first = true
  while (current >= base) {
    const digits = digitsOf(current, base)
    const sum = digits.reduce((acc, d) => acc + d, 0)
    if (first) {
      expr = `${digits.map(d => formatNumeral(d, base)).join('+')}=${formatNumeral(sum, base)}`
      first = false
    } else {
      expr += `=${formatNumeral(sum, base)}`
    }
    current = sum
  }
  return expr
}
