// NAM-01 generator names-gen@1: prefix-code tree with a Feistel permutation per depth class, locks and the spare stream
// (07-RESEARCH Pattern 2). The banks are DRAFTS until plan 07-06's sign-off, so this file pins STRUCTURE only: bank shape,
// distinctness, prefix stability, locks. No sound-table digest and no exact generated sound string is pinned here.
// Independence: the parser below recovers (depth, permuted index) from a sound by greedy matching over the bank union,
// a different mechanism from the generator's mixed-radix decode.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MAX_BASE } from '../core/base'
import { STYLE_IDS, SYLLABLE_BANKS, DEFAULT_STYLE, isStyleId, type StyleId } from '../naming/banks'
import { feistelPermutation, feistelRoundKeys } from '../naming/feistel'
import { DEFAULT_SEED, GENERATOR_ID, GENERATOR_MAX_DEPTH, createGenerator, generateSounds } from '../naming/generate'

const HOLLOW = 'hollow-vector'
const TWO_POW_26 = 2 ** 26
const LETTERS = /^[a-z]+$/

function sizes(style: StyleId): number[] {
  const { internal, leaf } = SYLLABLE_BANKS[style]
  const out: number[] = []
  for (let d = 1; d <= GENERATOR_MAX_DEPTH; d++) out.push(internal.length ** (d - 1) * leaf.length)
  return out
}

const UNION = new Map<StyleId, Array<{ s: string; isLeaf: boolean; i: number }>>()

/** Greedy parse over the bank union (prefix-free, so at most one syllable matches at any position). */
function parse(style: StyleId, sound: string): { depth: number; index: number } {
  const { internal, leaf } = SYLLABLE_BANKS[style]
  if (!UNION.has(style)) {
    UNION.set(style, [...internal.map((s, i) => ({ s, isLeaf: false, i })), ...leaf.map((s, i) => ({ s, isLeaf: true, i }))])
  }
  const all = UNION.get(style)!
  const parts: Array<{ isLeaf: boolean; i: number }> = []
  let rest = sound
  while (rest.length > 0) {
    const hit = all.filter(a => rest.startsWith(a.s))
    if (hit.length !== 1) throw new Error(`no unique syllable at "${rest}" of "${sound}"`)
    parts.push(hit[0]!)
    rest = rest.slice(hit[0]!.s.length)
  }
  if (parts.length < 1) throw new Error('empty sound')
  parts.forEach((p, k) => {
    if (p.isLeaf !== (k === parts.length - 1)) throw new Error(`role mismatch at syllable ${k} of "${sound}"`)
  })
  // r' = leafIndex + L * (i_{d-2} + I * (i_{d-3} + I * (... + I * i_0)))
  let high = 0
  for (let k = 0; k < parts.length - 1; k++) high = high * internal.length + parts[k]!.i
  return { depth: parts.length, index: parts[parts.length - 1]!.i + leaf.length * high }
}

describe('banks', () => {
  it('lists the three styles with harsh as the default', () => {
    expect([...STYLE_IDS]).toEqual(['harsh', 'soft', 'syllabic'])
    expect(DEFAULT_STYLE).toBe('harsh')
    for (const s of STYLE_IDS) expect(isStyleId(s)).toBe(true)
    for (const v of ['', 'Harsh', 'loud', 4, null, undefined, {}]) expect(isStyleId(v)).toBe(false)
  })

  it.each([
    ['harsh', 80, 67],
    ['soft', 60, 66],
    ['syllabic', 64, 78],
  ] as const)('%s has %d internal and %d leaf syllables of plain a-z letters, no duplicates, disjoint roles', (style, nInternal, nLeaf) => {
    const { internal, leaf } = SYLLABLE_BANKS[style]
    expect(internal).toHaveLength(nInternal)
    expect(leaf).toHaveLength(nLeaf)
    for (const s of [...internal, ...leaf]) expect(LETTERS.test(s)).toBe(true)
    expect(new Set(internal).size).toBe(internal.length)
    expect(new Set(leaf).size).toBe(leaf.length)
    const leafSet = new Set(leaf)
    expect(internal.filter(s => leafSet.has(s))).toEqual([])
  })

  it.each(STYLE_IDS)('%s: the union of internal and leaf syllables is prefix-free', style => {
    const { internal, leaf } = SYLLABLE_BANKS[style]
    const sorted = [...internal, ...leaf].sort() // default sort compares UTF-16 code units
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.startsWith(sorted[i - 1]!)).toBe(false)
  })

  it('the banks and their lists are frozen', () => {
    expect(Object.isFrozen(SYLLABLE_BANKS)).toBe(true)
    for (const s of STYLE_IDS) {
      expect(Object.isFrozen(SYLLABLE_BANKS[s])).toBe(true)
      expect(Object.isFrozen(SYLLABLE_BANKS[s].internal)).toBe(true)
      expect(Object.isFrozen(SYLLABLE_BANKS[s].leaf)).toBe(true)
    }
  })
})

describe('createGenerator', () => {
  it('names its frozen generator id, default seed and depth', () => {
    expect(GENERATOR_ID).toBe('names-gen@1')
    expect(DEFAULT_SEED).toBe('ccrug')
    expect(GENERATOR_MAX_DEPTH).toBe(5)
  })

  it.each(STYLE_IDS)('%s: limit is the sum of the depth-class sizes and exceeds twice the base ceiling', style => {
    const gen = createGenerator(DEFAULT_SEED, style)
    const { internal, leaf } = SYLLABLE_BANKS[style]
    let total = 0n
    for (let d = 1; d <= GENERATOR_MAX_DEPTH; d++) total += BigInt(internal.length) ** BigInt(d - 1) * BigInt(leaf.length)
    expect(BigInt(gen.limit)).toBe(total)
    expect(gen.limit).toBeGreaterThan(2 * MAX_BASE)
    expect(gen.seed).toBe(DEFAULT_SEED)
    expect(gen.style).toBe(style)
  })

  it('returns a frozen generator and rejects an unknown style', () => {
    expect(Object.isFrozen(createGenerator('x', 'harsh'))).toBe(true)
    expect(() => createGenerator('x', 'loud' as unknown as StyleId)).toThrow(RangeError)
  })

  it.each(STYLE_IDS)('%s: soundAt is exhaustively distinct for zones [0, 300000) at two seeds', style => {
    for (const seed of [DEFAULT_SEED, HOLLOW]) {
      const gen = createGenerator(seed, style)
      const seen = new Set<string>()
      for (let z = 0; z < 300000; z++) seen.add(gen.soundAt(z))
      expect(seen.size).toBe(300000)
    }
  }, 30_000)

  it.each(STYLE_IDS)('%s: an independent parser recovers the depth class and the permuted index of 2,000 fixed-seed zones in [0, 2^26)', style => {
    const gen = createGenerator(HOLLOW, style)
    const classSizes = sizes(style)
    const offsets: number[] = []
    let acc = 0
    for (const s of classSizes) {
      offsets.push(acc)
      acc += s
    }
    const perms = classSizes.map((s, k) => feistelPermutation(s, feistelRoundKeys(HOLLOW, style, k + 1)))
    const check = (z: number): boolean => {
      let d = 1
      while (d < GENERATOR_MAX_DEPTH && z >= offsets[d]!) d++
      const parsed = parse(style, gen.soundAt(z))
      return parsed.depth === d && parsed.index === perms[d - 1]!(z - offsets[d - 1]!)
    }
    expect(check(TWO_POW_26 - 1)).toBe(true)
    expect(check(0)).toBe(true)
    fc.assert(
      fc.property(fc.integer({ min: 0, max: TWO_POW_26 - 1 }), check),
      { seed: 20261020, numRuns: 2000 },
    )
  })

  it.each(STYLE_IDS)('%s: zones across every depth-class boundary parse to the right depth', style => {
    const gen = createGenerator(DEFAULT_SEED, style)
    const classSizes = sizes(style)
    let boundary = 0
    for (let k = 0; k < classSizes.length; k++) {
      if (k > 0) {
        expect(parse(style, gen.soundAt(boundary - 1)).depth).toBe(k)
        expect(parse(style, gen.soundAt(boundary)).depth).toBe(k + 1)
      }
      boundary += classSizes[k]!
    }
    expect(boundary).toBe(gen.limit)
    expect(parse(style, gen.soundAt(gen.limit - 1)).depth).toBe(GENERATOR_MAX_DEPTH)
  })

  it('prefix stability: the first zones read the same in a table of any base', () => {
    for (const style of STYLE_IDS) {
      const gen = createGenerator(HOLLOW, style)
      for (const base of [10, 28, 64, 666, 4000]) {
        const table = generateSounds(gen, base)
        for (let z = 0; z < 12; z++) expect(table[z]).toBe(gen.soundAt(z))
      }
    }
  })

  it('depends on the seed and the style', () => {
    const a = createGenerator('one', 'harsh')
    const b = createGenerator('two', 'harsh')
    const c = createGenerator('one', 'soft')
    const first = (g: { soundAt(z: number): string }) => Array.from({ length: 20 }, (_, z) => g.soundAt(z)).join()
    expect(first(a)).not.toBe(first(b))
    expect(first(a)).not.toBe(first(c))
    expect(first(a)).toBe(first(createGenerator('one', 'harsh')))
  })

  it.each([
    ['harsh', 15],
    ['soft', 11],
    ['syllabic', 11],
  ] as const)('%s: the longest sound at the maximum depth is %d letters, inside the 16-letter sound cap', (style, longest) => {
    const { internal, leaf } = SYLLABLE_BANKS[style]
    const maxLen = (xs: readonly string[]) => xs.reduce((m, s) => Math.max(m, s.length), 0)
    expect(maxLen(internal) * (GENERATOR_MAX_DEPTH - 1) + maxLen(leaf)).toBe(longest)
    expect(longest).toBeLessThanOrEqual(16)
    const gen = createGenerator(HOLLOW, style)
    let observed = 0
    for (let z = gen.limit - 1; z > gen.limit - 5000; z--) observed = Math.max(observed, gen.soundAt(z).length)
    expect(observed).toBeLessThanOrEqual(longest)
    expect(observed).toBeGreaterThan(longest - 4)
  })

  it('is lazy: zones near 2^26 are available directly, without a table, and stay distinct', () => {
    const gen = createGenerator('lazy', 'harsh')
    const seen = new Set<string>()
    for (let i = 0; i < 20000; i++) seen.add(gen.soundAt(TWO_POW_26 - 1 - i))
    expect(seen.size).toBe(20000)
  })

  it.each(STYLE_IDS)('%s: normalises the seed to NFC and trims it', style => {
    const nfd = ' ' + 'e' + String.fromCodePoint(0x301) + ' '
    const nfc = String.fromCodePoint(0xe9)
    const a = createGenerator(nfd, style)
    const b = createGenerator(nfc, style)
    expect(a.seed).toBe(nfc)
    for (let z = 0; z < 100; z++) expect(a.soundAt(z)).toBe(b.soundAt(z))
  })

  it.each([-1, 1.5, NaN, Infinity])('soundAt throws RangeError for %s', z => {
    expect(() => createGenerator('x', 'harsh').soundAt(z)).toThrow(RangeError)
  })

  it.each(STYLE_IDS)('%s: soundAt throws RangeError at limit and accepts limit - 1', style => {
    const gen = createGenerator('x', style)
    expect(() => gen.soundAt(gen.limit)).toThrow(RangeError)
    expect(() => gen.soundAt(gen.limit - 1)).not.toThrow()
  })

  it('returns the same sound for -0 as for 0', () => {
    const gen = createGenerator('x', 'harsh')
    expect(gen.soundAt(-0)).toBe(gen.soundAt(0))
  })
})

describe('generateSounds', () => {
  it('throws RangeError for an invalid base', () => {
    const gen = createGenerator('x', 'harsh')
    for (const base of [0, 3, -2, 2.5, NaN, MAX_BASE + 2]) expect(() => generateSounds(gen, base)).toThrow(RangeError)
  })

  it.each(STYLE_IDS)('%s: an unlocked table has base distinct entries at bases 2, 10, 666 and 4000', style => {
    const gen = createGenerator(DEFAULT_SEED, style)
    for (const base of [2, 10, 666, 4000]) {
      const table = generateSounds(gen, base)
      expect(table).toHaveLength(base)
      expect(new Set(table).size).toBe(base)
    }
  })

  it('keeps every locked zone and replaces a colliding unlocked zone with the next spare zone', () => {
    const gen = createGenerator(HOLLOW, 'harsh')
    const base = 28
    // zone 5 is locked to the sound zone 3 would generate; zone 6 is locked to the first spare, so spare 0 is skipped
    const locked = new Map<number, string>([
      [5, gen.soundAt(3)],
      [6, gen.soundAt(base)],
    ])
    const table = generateSounds(gen, base, locked)
    expect(table[5]).toBe(gen.soundAt(3))
    expect(table[6]).toBe(gen.soundAt(base))
    expect(table[3]).toBe(gen.soundAt(base + 1))
    expect(new Set(table).size).toBe(base)
    for (let z = 0; z < base; z++) if (z !== 3 && z !== 5 && z !== 6) expect(table[z]).toBe(gen.soundAt(z))
  })

  it('a typed sound that no zone generates changes nothing but its own row', () => {
    const gen = createGenerator(HOLLOW, 'soft')
    const table = generateSounds(gen, 10, new Map([[4, 'xyzzy']]))
    expect(table[4]).toBe('xyzzy')
    for (let z = 0; z < 10; z++) if (z !== 4) expect(table[z]).toBe(gen.soundAt(z))
  })

  it('uses the spare stream in zone order and skips spares that are themselves locked', () => {
    const gen = createGenerator('spares', 'syllabic')
    const base = 12
    const locked = new Map<number, string>([
      [0, gen.soundAt(7)],
      [1, gen.soundAt(8)],
      [2, gen.soundAt(base + 1)],
    ])
    const table = generateSounds(gen, base, locked)
    expect(table[7]).toBe(gen.soundAt(base))
    expect(table[8]).toBe(gen.soundAt(base + 2))
    expect(new Set(table).size).toBe(base)
  })

  it('ignores a lock outside the table (it neither enters the table nor reserves its sound)', () => {
    const gen = createGenerator('outside', 'harsh')
    const table = generateSounds(gen, 10, new Map([[10, gen.soundAt(3)], [-1, gen.soundAt(4)], [2.5, gen.soundAt(5)]]))
    expect(table).toEqual(generateSounds(gen, 10))
  })

  it.each([28, 666])('property: base %d, up to 40 random locks keep their sounds and the table stays distinct', base => {
    const gen = createGenerator(HOLLOW, 'harsh')
    const source = fc.oneof(
      fc.integer({ min: 0, max: base + 10 }).map(w => gen.soundAt(w)),
      fc.integer({ min: 0, max: 5000 }).map(w => gen.soundAt(w)),
      fc.stringMatching(/^[a-z]{1,4}$/),
    )
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: base - 1 }), source), { maxLength: 40 }), pairs => {
        const locked = new Map<number, string>()
        const used = new Set<string>()
        for (const [zone, sound] of pairs) {
          if (locked.has(zone) || used.has(sound)) continue // distinct zones, distinct locked sounds
          locked.set(zone, sound)
          used.add(sound)
        }
        const table = generateSounds(gen, base, locked)
        if (table.length !== base) return false
        for (const [zone, sound] of locked) if (table[zone] !== sound) return false
        if (new Set(table).size !== base) return false
        // an unlocked zone keeps its own sound, or (when a lock holds it) takes the next unused spare in zone order
        const spares: string[] = []
        for (let j = 0; spares.length < 100 && j < 200; j++) {
          const s = gen.soundAt(base + j)
          if (!used.has(s)) spares.push(s)
        }
        let next = 0
        for (let z = 0; z < base; z++) {
          if (locked.has(z)) continue
          const own = gen.soundAt(z)
          if (!used.has(own)) {
            if (table[z] !== own) return false
          } else if (table[z] !== spares[next++]) return false
        }
        return true
      }),
      { seed: 20261020, numRuns: 500 },
    )
  })

  it('the base is respected at the 2^26 ceiling for a single lookup path (no table is built by soundAt)', () => {
    const gen = createGenerator('ceiling', 'soft')
    expect(gen.soundAt(MAX_BASE - 1)).toMatch(LETTERS)
    expect(gen.soundAt(MAX_BASE + 5)).toMatch(LETTERS)
  })
})

describe('determinism', () => {
  it('two generators with the same seed and style produce the same table', () => {
    for (const style of STYLE_IDS) {
      const a = generateSounds(createGenerator(HOLLOW, style), 666)
      const b = generateSounds(createGenerator(HOLLOW, style), 666)
      expect(a).toEqual(b)
    }
  })
})
