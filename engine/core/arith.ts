// In-base arithmetic primitives (ENG-01). Pitfall 1: the digital root is taken in the numogram's own base, never as a
// decimal digit sum, and never as a bare modulus (which maps a multiple of base - 1 to 0 instead of base - 1).

// k(k+1) <= Number.MAX_SAFE_INTEGER holds for every k up to this bound, so T(k) is computed exactly.
// (It is a conservative ceiling, far above the 2^26 zone limit of any numogram.)
const MAX_TRIANGULAR_INDEX = 94906264

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

/** The k-th triangular number T(k) = k(k+1)/2 (a gate's cumulation), exact. RangeError unless 0 <= k <= 94906264. */
export function triangular(k: number): number {
  if (!Number.isSafeInteger(k) || k < 0 || k > MAX_TRIANGULAR_INDEX) {
    throw new RangeError(`Invalid index ${show(k)}: T(k) needs a whole number from 0 to ${MAX_TRIANGULAR_INDEX}`)
  }
  return (k * (k + 1)) / 2
}

/**
 * The digital root of value in the given base: 0 for 0, otherwise the single digit 1..base-1 that repeated in-base digit
 * sums converge to, computed in closed form as ((value - 1) % (base - 1)) + 1.
 * RangeError unless value is a non-negative safe integer and base a whole number of at least 2.
 */
export function digitalRoot(value: number, base: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid value ${show(value)}: the digital root needs a non-negative safe integer`)
  }
  if (!Number.isSafeInteger(base) || base < 2) {
    throw new RangeError(`Invalid base ${show(base)}: the digital root needs a whole base of at least 2`)
  }
  return value === 0 ? 0 : ((value - 1) % (base - 1)) + 1
}
