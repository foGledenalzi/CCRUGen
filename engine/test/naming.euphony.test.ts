// NAM-02 euphony@1 (D-06): the optional smoothing pass over a raw join of two zone sounds. It is a frozen convenience, so this
// file pins it with a vector table and properties, never with the canonical demon names (the pass does not reproduce them).
// Independence: the inertness oracle below is written with regexes, a different mechanism from the char-code walk.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { EUPHONY_VERSION, smoothName, smoothingInert } from '../naming/euphony'

const SEED = 20261020
const CONSONANTS = 'bcdfghjklmnpqrstvwxz'
const VOWELS = 'aeiouy'
// the context-free fill vowel of each consonant, written out independently of the module (research Pattern 4)
const FILL: Readonly<Record<string, string>> = {
  b: 'u', c: 'a', d: 'i', f: 'a', g: 'u', h: 'a', j: 'u', k: 'u', l: 'a', m: 'u',
  n: 'a', p: 'a', q: 'u', r: 'a', s: 'a', t: 'a', v: 'a', w: 'a', x: 'i', z: 'a',
}

function cp(...codes: number[]): string {
  return String.fromCodePoint(...codes)
}

describe('EUPHONY_VERSION', () => {
  it('is 1', () => {
    expect(EUPHONY_VERSION).toBe(1)
  })
})

describe('smoothName vectors (research Appendix B)', () => {
  it.each([
    ['tnmnm', 'tnamnam'],
    ['kttdt', 'ktatdit'],
    ['skrzx', 'skurzax'],
    ['pbzx', 'pbuzxi'],
    ['mnmdt', 'mnamdit'],
    ['gleiaoung', 'gleiaoungu'],
    ['eiaounggl', 'eiaoungugla'],
    ['zxskr', 'zxiskur'],
    ['dtktt', 'dtaktat'],
    ['zxpb', 'zxipbu'],
    ['dtmnm', 'dtamnam'],
    ['mnmtn', 'mnamtan'],
  ])('%s -> %s', (raw, smoothed) => {
    expect(smoothName(raw)).toBe(smoothed)
  })

  it.each([
    ['abc-def'],
    ['tn mnm'],
    ['tn1'],
    ['n' + cp(0x303) + 'and' + cp(0xfa)],
    [cp(0x3a9, 0x3bc, 0xe9, 0x3b3, 0x3b1)],
    [cp(0x4e2d, 0x6587)],
    [cp(0x1f600)],
    ['tnmnm' + cp(0xe9)],
    [''],
  ])('leaves %j unchanged (not all ASCII letters)', raw => {
    expect(smoothName(raw)).toBe(raw)
  })
})

describe('smoothName rules', () => {
  it('copies vowels, short consonant runs and a name that already ends well', () => {
    for (const s of ['a', 'e', 'ba', 'ab', 'gle', 'tona', 'oxo', 'tt', 'ky', 'yk', 'kyk']) {
      // 'tt' ends in two identical consonants, which is allowed; none of these is changed
      expect(smoothName(s)).toBe(s)
    }
  })

  it('appends the fill vowel when the name ends in two different consonants', () => {
    expect(smoothName('gl')).toBe('gla')
    expect(smoothName('abgl')).toBe('abgla')
    expect(smoothName('GL')).toBe('GLA')
    expect(smoothName('gL')).toBe('gLA')
  })

  it('treats the end as a pair of identical consonants regardless of case', () => {
    expect(smoothName('tT')).toBe('tT')
    expect(smoothName('aTt')).toBe('aTt')
  })

  it('cuts long runs into chunks of two with a fill after each full chunk', () => {
    expect(smoothName('tttt')).toBe('ttatta')
    expect(smoothName('xyzzy')).toBe('xyzzy')
    expect(smoothName('bcdfg')).toBe('bcadfag')
  })

  it('uses the fill vowel of the LAST consonant of each chunk, for every consonant, in both cases', () => {
    for (const c of CONSONANTS) {
      // 's' + c is a full chunk (the run 's c s' has length 3), so the output is s, c, fill(c), s
      expect(smoothName('s' + c + 's')).toBe('s' + c + FILL[c] + 's')
      expect(smoothName('S' + c.toUpperCase() + 'S')).toBe('S' + c.toUpperCase() + (FILL[c] as string).toUpperCase() + 'S')
    }
  })

  it('gives the inserted vowel the case of the consonant before it', () => {
    expect(smoothName('TNMNM')).toBe('TNAMNAM')
    expect(smoothName('Tnmnm')).toBe('Tnamnam')
    expect(smoothName('tNmnm')).toBe('tNAmnam')
  })

  it('y is a vowel: it separates runs and has no fill', () => {
    expect(smoothName('tnyntn')).toBe('tnyntan')
    expect(smoothName('kyt')).toBe('kyt')
    expect(smoothName('bytnm')).toBe('bytnam')
  })

  it('has no collapse rule: three identical letters stay distinct from two', () => {
    expect(smoothName('kttt')).toBe('ktatta')
    expect(smoothName('ktt')).toBe('ktat')
    expect(smoothName('kttt')).not.toBe(smoothName('ktt'))
  })

  it('is linear: a very long consonant run is processed at once', () => {
    const n = 200000
    const out = smoothName('t'.repeat(n))
    expect(out.length).toBe(n + n / 2)
    expect(out.startsWith('ttattatta')).toBe(true)
  })
})

describe('smoothName properties', () => {
  const unit = fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom(...CONSONANTS.split('')) },
    { weight: 2, arbitrary: fc.constantFrom(...VOWELS.split('')) },
    { weight: 2, arbitrary: fc.constantFrom(...(CONSONANTS + VOWELS).toUpperCase().split('')) },
  )
  const asciiLetters = fc.array(unit, { maxLength: 24 }).map(a => a.join(''))
  const noAui = fc
    .array(
      fc.oneof(
        { weight: 6, arbitrary: fc.constantFrom(...(CONSONANTS + CONSONANTS.toUpperCase()).split('')) },
        { weight: 2, arbitrary: fc.constantFrom('e', 'o', 'y', 'E', 'O', 'Y') },
      ),
      { maxLength: 24 },
    )
    .map(a => a.join(''))

  it('is idempotent (20,000 ASCII-letter strings of length 0..24)', () => {
    fc.assert(
      fc.property(asciiLetters, x => {
        const once = smoothName(x)
        return smoothName(once) === once
      }),
      { seed: SEED, numRuns: 20000 },
    )
  })

  it('is insert-only: deleting a, u, i from the output restores an input that has none (so it is injective there)', () => {
    fc.assert(
      fc.property(noAui, x => smoothName(x).replace(/[aAuUiI]/g, '') === x),
      { seed: SEED, numRuns: 20000 },
    )
    fc.assert(
      fc.property(noAui, noAui, (x, y) => x === y || smoothName(x) !== smoothName(y)),
      { seed: SEED, numRuns: 20000 },
    )
  })

  it('only ever inserts a, u or i (in the case of the consonant before it), never deleting or changing a letter', () => {
    fc.assert(
      fc.property(asciiLetters, x => {
        const out = smoothName(x)
        // the input is a subsequence of the output, and the extra letters are exactly the fill vowels
        let i = 0
        let extra = ''
        for (const ch of out) {
          if (i < x.length && ch === x[i]) i++
          else extra += ch
        }
        return i === x.length && /^[auiAUI]*$/.test(extra)
      }),
      { seed: SEED, numRuns: 20000 },
    )
  })

  it('leaves no consonant run longer than 2 in any smoothed ASCII-letter output', () => {
    fc.assert(
      fc.property(asciiLetters, x => !/[^aeiouy]{3}/i.test(smoothName(x))),
      { seed: SEED, numRuns: 20000 },
    )
  })

  it('never ends in two different consonants', () => {
    fc.assert(
      fc.property(asciiLetters, x => {
        const out = smoothName(x)
        const m = /([^aeiouy])([^aeiouy])$/i.exec(out)
        return m === null || (m[1] as string).toLowerCase() === (m[2] as string).toLowerCase()
      }),
      { seed: SEED, numRuns: 20000 },
    )
  })

  it('is a no-op on any string with a character that is not an ASCII letter', () => {
    const odd = fc.constantFrom('-', ' ', '1', "'", cp(0xe9), cp(0x3a9), cp(0x4e2d), cp(0x1f600), cp(0x200c))
    fc.assert(
      fc.property(asciiLetters, odd, asciiLetters, (a, o, b) => {
        const s = a + o + b
        return smoothName(s) === s
      }),
      { seed: SEED, numRuns: 5000 },
    )
  })

  it('is deterministic', () => {
    fc.assert(
      fc.property(asciiLetters, x => smoothName(x) === smoothName(x)),
      { seed: SEED, numRuns: 2000 },
    )
  })
})

// An independent statement of the certificate condition (research Pattern 5, condition B), by regexes.
function inertOracle(sounds: readonly string[]): boolean {
  return sounds.every(
    s =>
      /^[A-Za-z]+$/.test(s) &&
      /[aeiouy]/i.test(s) &&
      !/[^aeiouy]{3}/i.test(s) &&
      !/^[^aeiouy]{2}/i.test(s) &&
      !/[^aeiouy]{2}$/i.test(s),
  )
}

describe('smoothingInert', () => {
  it('examples', () => {
    expect(smoothingInert([])).toBe(true)
    expect(smoothingInert(['tn', 'mnm'])).toBe(false)
    expect(smoothingInert(['lavedia', 'kin'])).toBe(true)
    expect(smoothingInert([''])).toBe(false)
    expect(smoothingInert(['tn'])).toBe(false) // no vowel
    expect(smoothingInert(['gle'])).toBe(false) // leading run of two
    expect(smoothingInert(['egl'])).toBe(false) // trailing run of two
    expect(smoothingInert(['ekkle'])).toBe(true) // an internal run of two is fine
    expect(smoothingInert(['ekkkle'])).toBe(false) // an internal run of three is not
    expect(smoothingInert(['ke', 'ak'])).toBe(true)
    expect(smoothingInert(['ke', 'a-k'])).toBe(false) // not all letters
    expect(smoothingInert(['ke', 'a' + cp(0xe9)])).toBe(false)
    expect(smoothingInert(['KE', 'Ak'])).toBe(true) // case-insensitive
    expect(smoothingInert(['yk'])).toBe(true) // y is a vowel
  })

  it('a table with one bad sound is not inert', () => {
    expect(smoothingInert(['ke', 'ak', 'tn', 'oa'])).toBe(false)
  })

  const unit = fc.oneof(
    { weight: 1, arbitrary: fc.constantFrom(...CONSONANTS.split('')) },
    { weight: 2, arbitrary: fc.constantFrom(...VOWELS.split('')) },
  )
  const sound = fc.array(unit, { minLength: 1, maxLength: 8 }).map(a => a.join(''))

  it('agrees with an independent regex statement of the condition (20,000 tables)', () => {
    let inert = 0
    fc.assert(
      fc.property(fc.array(fc.oneof(sound, fc.constantFrom('', 'A-b', 'Kk', 'ke' + cp(0xe9))), { maxLength: 3 }), table => {
        const got = smoothingInert(table)
        if (got) inert++
        return got === inertOracle(table)
      }),
      { seed: SEED, numRuns: 20000 },
    )
    expect(inert).toBeGreaterThan(1000) // the comparison is not vacuous
  })

  it('implies that smoothing changes neither join of two inert sounds (5,000 pairs)', () => {
    let checked = 0
    const pair = fc.tuple(sound, sound).filter(([x, y]) => smoothingInert([x, y]))
    fc.assert(
      fc.property(pair, ([x, y]) => {
        checked++
        return smoothName(x + y) === x + y && smoothName(y + x) === y + x
      }),
      { seed: SEED, numRuns: 5000 },
    )
    expect(checked).toBeGreaterThanOrEqual(5000)
  })

  it('is not an if-and-only-if: it is only sufficient, and a non-inert table can still be unchanged', () => {
    expect(smoothingInert(['tn'])).toBe(false)
    expect(smoothName('tn' + 'a')).toBe('tna') // this particular join happens to be fine
    expect(smoothName('tn' + 'mnm')).not.toBe('tn' + 'mnm') // and this one changes
  })
})
