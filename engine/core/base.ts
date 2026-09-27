// Base validation (D-12, ENG-04). One ceiling constant, one pure check that reports why, one asserting wrapper.
// Every check runs before any allocation, so a hostile base (NaN, Infinity, 1e308, odd) never reaches an array.

/** 2 ** 26, the safe ceiling: T(k) and mesh arithmetic stay exact below 2^53 for every zone up to it (no BigInt path). */
export const MAX_BASE = 67108864

export type BaseProblem = 'not-a-number' | 'infinite' | 'not-integer' | 'zero' | 'negative' | 'odd' | 'too-large'

export type BaseCheck =
  | { readonly ok: true; readonly base: number }
  | { readonly ok: false; readonly reason: BaseProblem; readonly message: string }

/** Characters of a caller's text an error message may echo (IN-04): a huge argument must not become a huge message. */
export const MAX_ECHO = 40

/** text as it may appear in an error message: whole up to MAX_ECHO characters, else its first MAX_ECHO followed by '...'. */
export function clipEcho(text: string): string {
  return text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}...` : text
}

// A description of an arbitrary value that can never throw (Object.create(null), a throwing toString, a Proxy ...),
// bounded to MAX_ECHO characters of the value.
function describeValue(n: unknown): string {
  try {
    return typeof n === 'string' ? JSON.stringify(clipEcho(n)) : clipEcho(String(n))
  } catch {
    return `<${typeof n}>`
  }
}

function problem(reason: BaseProblem, message: string): BaseCheck {
  return { ok: false, reason, message }
}

/** Reports whether n is an admissible numogram base (an even integer from 2 to 2^26) and, if not, why. Never throws. */
export function validateBase(n: unknown): BaseCheck {
  if (typeof n !== 'number' || Number.isNaN(n)) {
    return problem('not-a-number', `Invalid base ${describeValue(n)}: the base must be a number`)
  }
  if (!Number.isFinite(n)) return problem('infinite', `Invalid base ${describeValue(n)}: the base must be finite`)
  if (!Number.isInteger(n)) return problem('not-integer', `Invalid base ${describeValue(n)}: the base must be a whole number`)
  if (n === 0) return problem('zero', 'Invalid base 0: a numogram needs at least 2 zones')
  if (n < 0) return problem('negative', `Invalid base ${describeValue(n)}: the base must be positive`)
  if (n % 2 !== 0) {
    return problem('odd', `Invalid base ${describeValue(n)}: odd bases have a self-paired zone, so no numogram exists`)
  }
  if (n > MAX_BASE) return problem('too-large', `Invalid base ${describeValue(n)}: above the safe ceiling 2^26 = ${MAX_BASE}`)
  return { ok: true, base: n }
}

/** Throws a RangeError (message from validateBase) unless n is an admissible base. */
export function assertBase(n: unknown): asserts n is number {
  const check = validateBase(n)
  if (!check.ok) throw new RangeError(check.message)
}
