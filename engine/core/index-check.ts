// The one shared argument check of the engine: every accessor of numogram.ts and demons.ts validates a whole-number index
// through it, so they all report the same message and all return a plain +0 for a caller's -0 (IN-01). Pure and
// dependency-free, so any engine module can import it without a cycle.

/** A number as shown in an error message; anything else by its type, so the message never calls a caller's toString. */
function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

/**
 * Returns value when it is a whole number in [0, limit); otherwise a RangeError that names the argument and the range.
 * The result is never -0 (a caller's -0 is the index 0), so no field built from it can be a negative zero.
 */
export function checkIndex(name: string, value: unknown, limit: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`Invalid ${name} ${show(value)}: expected a whole number from 0 to ${limit - 1}`)
  }
  return value === 0 ? 0 : value // -0 becomes +0
}
