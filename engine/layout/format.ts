// Deterministic number formatting and 1/8 quantization (research Pitfall 15, Pitfall 2): fmt never prints '-0' or a
// non-finite value (threat T-03-01, mitigated here), and ceilQ/roundQ pin trig-derived world coordinates to the same
// 1/8 grid on every engine before any comparison, so a discrete decision never depends on the last bit of Math.sin.

export const QUANTUM = 8

/**
 * v rounded UP to the nearest 1/8, with 1e-9 of downward slack absorbing the last-ulp differences of Math.sin: at
 * m = 6 the raw chord radius is 84.00000000000001 on V8 (chordRadius(6, 84)) and R must be exactly 84 on every engine.
 */
export function ceilQ(v: number): number {
  return Math.ceil(v * QUANTUM - 1e-9) / QUANTUM
}

/** v rounded to the nearest 1/8. */
export function roundQ(v: number): number {
  return Math.round(v * QUANTUM) / QUANTUM
}

/**
 * v formatted to at most 2 decimals as a plain string: never locale-aware, never '-0', and throws RangeError on a
 * non-finite value so no NaN/Infinity can ever be printed into an SVG path or attribute (T-03-01).
 */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) throw new RangeError('fmt: not a finite number: ' + String(v))
  const r = Math.round(v * 100) / 100
  return String(r === 0 ? 0 : r)
}
