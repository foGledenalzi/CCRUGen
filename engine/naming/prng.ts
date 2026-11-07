// The one source of randomness of the naming feature (NAM-01): the PRNG sfc32 seeded by the hash cyrb128.
// Integer only: every step is Math.imul, ^, >>>, | 0 or <<, with no float, no platform randomness and no clock, so a seed gives
// the same stream in every engine. `@1` is defined by this code and the frozen vectors in engine/test/naming.prng.test.ts (07-RESEARCH
// Appendix B), never by an upstream text: a change to anything here is a new algorithm id, not an edit.
// Callers NFC-normalise and trim seeds before hashing (createGenerator does); cyrb128 itself hashes the UTF-16 code units it is given.

export const PRNG_ALGO = 'sfc32-cyrb128@1'

/** Folds a string's UTF-16 code units into four unsigned 32-bit state words for sfc32. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** The small fast chaotic generator: a function returning the next unsigned 32-bit integer. */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  a |= 0
  b |= 0
  c |= 0
  d |= 0
  return () => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return t >>> 0
  }
}
