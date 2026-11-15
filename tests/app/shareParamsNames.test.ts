// NAM-03 (D-13, T-07-07, T-07-02c): the URL carries only a preset or a seed. `names=ccru` (honoured at base 10 only) or
// `names=seed:<seed>` with the lenient companions `nstyle`, `njoin=lh` and `nsmooth=1`, each omitted at its default and
// never any sounds, locks or overrides. Parsing is total (hostile text falls back to no link without touching any other
// field), keeps the link above the interactive ceiling, and never builds a numogram. createNumogram is spied through
// vi.mock (as in shareParamsHeadless.test.ts), so "not built" is proven by call count. Everything is derived from the
// grammar, never from a CCRU sound or name.
import fc from 'fast-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../engine/index', async importOriginal => {
  const m = await importOriginal<typeof import('../../engine/index')>()
  return { ...m, createNumogram: vi.fn(m.createNumogram) }
})

import {
  DEFAULT_SEED,
  DEFAULT_STYLE,
  SEED_MAX_LENGTH,
  STYLE_IDS,
  createNumogram,
  normalizeSeed,
  type StyleId,
} from '../../engine/index'
import {
  CCRU_LINK_BASE,
  NAMES_PARAM_MAX_LENGTH,
  parseNamesLink,
  sameNamesLink,
  writeNamesLink,
  type NamesLink,
} from '../../app/lib/namesLink'
import { buildShareParams, defaultShareState, parseShareParams } from '../../app/lib/shareParams'
import { INTERACTIVE_MAX_N, tierFor } from '../../app/lib/tierBounds'

const spy = vi.mocked(createNumogram)

beforeEach(() => {
  spy.mockClear()
})

const MAX_SAFE_BASE = 67_108_864 // 2^26
const ABOVE_CEILING = INTERACTIVE_MAX_N + 2

function search(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(Object.entries(entries))
}

function seedLink(
  seed: string,
  over: Partial<Pick<Extract<NamesLink, { kind: 'seed' }>, 'style' | 'join' | 'smoothing'>> = {},
): NamesLink {
  return { kind: 'seed', seed, style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 0, ...over }
}

describe('constants', () => {
  it('CCRU_LINK_BASE is 10 (the only base with a CCRU preset, D-14)', () => {
    expect(CCRU_LINK_BASE).toBe(10)
  })

  it('the value bound leaves 13 characters of slack around a longest seed', () => {
    expect(NAMES_PARAM_MAX_LENGTH).toBe(SEED_MAX_LENGTH + 13)
  })
})

describe('parseNamesLink', () => {
  it('names=ccru is the preset link at base 10 and nothing at any other base', () => {
    expect(parseNamesLink(search({ names: 'ccru' }), 10)).toEqual({ kind: 'ccru' })
    expect(parseNamesLink(search({ names: 'ccru' }), 28)).toBeNull()
    expect(parseNamesLink(search({ names: 'ccru' }), 2)).toBeNull()
    expect(parseNamesLink(search({ names: 'ccru' }), ABOVE_CEILING)).toBeNull()
  })

  it('names=ccru ignores the seed companions', () => {
    const link = parseNamesLink(search({ names: 'ccru', nstyle: 'soft', njoin: 'lh', nsmooth: '1' }), 10)
    expect(link).toEqual({ kind: 'ccru' })
  })

  it('a bare seed takes the defaults: harsh, hi-lo, no smoothing', () => {
    expect(parseNamesLink(search({ names: 'seed:abc' }), 28)).toEqual({
      kind: 'seed',
      seed: 'abc',
      style: DEFAULT_STYLE,
      join: 'hi-lo',
      smoothing: 0,
    })
  })

  it('a seed link is valid at every base, including base 10', () => {
    for (const base of [2, 10, 28, INTERACTIVE_MAX_N, ABOVE_CEILING, MAX_SAFE_BASE]) {
      expect(parseNamesLink(search({ names: 'seed:abc' }), base)).toEqual(seedLink('abc'))
    }
  })

  it('reads the companions: nstyle, njoin=lh and nsmooth=1', () => {
    const link = parseNamesLink(search({ names: 'seed:abc', nstyle: 'soft', njoin: 'lh', nsmooth: '1' }), 28)
    expect(link).toEqual(seedLink('abc', { style: 'soft', join: 'lo-hi', smoothing: 1 }))
  })

  it('every known style is read back', () => {
    for (const style of STYLE_IDS) {
      expect(parseNamesLink(search({ names: 'seed:s', nstyle: style }), 28)).toEqual(seedLink('s', { style }))
    }
  })

  it('an unknown companion value falls back to its default without dropping the seed', () => {
    const link = parseNamesLink(search({ names: 'seed:abc', nstyle: 'bogus', njoin: 'x', nsmooth: '2' }), 28)
    expect(link).toEqual(seedLink('abc'))
    expect(parseNamesLink(search({ names: 'seed:abc', nstyle: '' }), 28)).toEqual(seedLink('abc'))
    expect(parseNamesLink(search({ names: 'seed:abc', nstyle: '__proto__' }), 28)).toEqual(seedLink('abc'))
    expect(parseNamesLink(search({ names: 'seed:abc', njoin: 'hl' }), 28)).toEqual(seedLink('abc'))
    expect(parseNamesLink(search({ names: 'seed:abc', nsmooth: 'true' }), 28)).toEqual(seedLink('abc'))
  })

  it('companions without names= give no link', () => {
    expect(parseNamesLink(search({ nstyle: 'soft', njoin: 'lh', nsmooth: '1' }), 28)).toBeNull()
    expect(parseNamesLink(new URLSearchParams(), 28)).toBeNull()
  })

  it('trims the value and the seed, and reads an NFD seed as NFC', () => {
    expect(parseNamesLink(search({ names: 'seed:  ab  ' }), 28)).toEqual(seedLink('ab'))
    expect(parseNamesLink(search({ names: '  seed:ab' }), 28)).toEqual(seedLink('ab'))
    expect(parseNamesLink(search({ names: ' ccru ' }), 10)).toEqual({ kind: 'ccru' })
    expect(parseNamesLink(search({ names: 'seed:é' }), 28)).toEqual(seedLink('é'))
  })

  it('keeps an inner space and punctuation in the seed', () => {
    expect(parseNamesLink(search({ names: 'seed:a b&c=d%e+f:g' }), 28)).toEqual(seedLink('a b&c=d%e+f:g'))
  })

  it('refuses an unknown prefix, a bare or empty seed, and a wrong case', () => {
    for (const raw of ['foo', 'seed', 'seed:', 'seed:   ', 'SEED:abc', 'CCRU', 'ccru:', 'ccruu', 'seed2:abc', '']) {
      expect(parseNamesLink(search({ names: raw }), 10), raw).toBeNull()
    }
  })

  it('refuses a seed of 65 UTF-16 units and accepts one of 64', () => {
    expect(parseNamesLink(search({ names: 'seed:' + 'a'.repeat(64) }), 28)).toEqual(seedLink('a'.repeat(64)))
    expect(parseNamesLink(search({ names: 'seed:' + 'a'.repeat(65) }), 28)).toBeNull()
    const grin = String.fromCodePoint(0x1f600)
    expect(parseNamesLink(search({ names: 'seed:' + grin.repeat(32) }), 28)).toEqual(seedLink(grin.repeat(32)))
    expect(parseNamesLink(search({ names: 'seed:' + grin.repeat(33) }), 28)).toBeNull()
  })

  it('bounds the raw value length before any processing (the bound is exact)', () => {
    // 'seed:' + padding + 'ab' with a total of exactly NAMES_PARAM_MAX_LENGTH characters is read; one more is not.
    const atBound = 'seed:' + ' '.repeat(NAMES_PARAM_MAX_LENGTH - 7) + 'ab'
    expect(atBound.length).toBe(NAMES_PARAM_MAX_LENGTH)
    expect(parseNamesLink(search({ names: atBound }), 28)).toEqual(seedLink('ab'))
    expect(parseNamesLink(search({ names: ' ' + atBound }), 28)).toBeNull()
    // The same for the preset: padding beyond the bound refuses it, a short pad does not.
    expect(parseNamesLink(search({ names: ' '.repeat(NAMES_PARAM_MAX_LENGTH) + 'ccru' }), 10)).toBeNull()
    expect(parseNamesLink(search({ names: ' '.repeat(8) + 'ccru' }), 10)).toEqual({ kind: 'ccru' })
    // A huge hostile value is simply refused.
    expect(parseNamesLink(search({ names: 'seed:' + 'x'.repeat(100_000) }), 28)).toBeNull()
  })

  it('refuses control characters and line or paragraph separators anywhere, even at the edge', () => {
    const hostiles = [
      'seed:a\u0000b', // NUL inside
      'seed:a\u0007', // BEL at the end
      'seed:\u0007a', // BEL at the start
      'seed:a\nb', // newline inside
      'seed:a\n', // newline at the end (a trim would hide it)
      'seed:a\r', // CR at the end
      'seed:a\t', // tab at the end
      'seed:a ', // LINE SEPARATOR at the end
      'seed:a b', // LINE SEPARATOR inside
      'seed:a ', // PARAGRAPH SEPARATOR at the end
      'seed:a\u0085', // NEL (a C1 control)
      ' seed:ab', // before the prefix
      'ccru\n',
      'ccru\u0000',
    ]
    for (const raw of hostiles) {
      expect(parseNamesLink(search({ names: raw }), 10), JSON.stringify(raw)).toBeNull()
    }
  })

  it('refuses a lone surrogate and a bidi control in a seed link (WR-02, WR-03)', () => {
    // URLSearchParams converts a lone surrogate to U+FFFD on the way in (it is a USVString), so the reader can only be handed
    // one by a stand-in with the same get(): that proves the parser's own guard. The sender side (a seed typed, pasted or
    // imported) is closed by normalizeSeed, whose tests are in engine/test/naming.text.test.ts.
    const standIn = (raw: string): URLSearchParams => ({ get: (k: string) => (k === 'names' ? raw : null) }) as unknown as URLSearchParams
    for (const raw of ['seed:a\ud800', 'seed:\udc00', 'seed:a\ud83d' + 'b']) {
      expect(parseNamesLink(standIn(raw), 28), JSON.stringify(raw)).toBeNull()
    }
    const bidi = [
      'seed:ab‮cd', // right-to-left override
      'seed:⁦x', // left-to-right isolate
      'seed:a‏b', // right-to-left mark
    ]
    for (const raw of bidi) {
      expect(parseNamesLink(search({ names: raw }), 28), JSON.stringify(raw)).toBeNull()
    }
    // a valid surrogate pair and a ZWNJ are fine
    expect(parseNamesLink(search({ names: 'seed:a' + String.fromCodePoint(0x1f600) }), 28)).toEqual(seedLink('a' + String.fromCodePoint(0x1f600)))
    expect(parseNamesLink(search({ names: 'seed:a‌b' }), 28)).toEqual(seedLink('a‌b'))
  })

  it('the same hostile text through a real query string (percent-encoded) is refused', () => {
    for (const q of ['?names=seed:a%00b', '?names=seed:a%E2%80%A8', '?names=seed:a%E2%80%A9', '?names=seed:a%0A', '?names=ccru%0A']) {
      expect(parseNamesLink(new URLSearchParams(q), 10), q).toBeNull()
    }
  })

  it('a prototype-key seed is plain data and never an object key', () => {
    for (const seed of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const link = parseNamesLink(search({ names: `seed:${seed}` }), 28)
      expect(link).toEqual(seedLink(seed))
      expect(Object.getPrototypeOf(link)).toBe(Object.prototype)
      expect(Object.keys(link as object).sort()).toEqual(['join', 'kind', 'seed', 'smoothing', 'style'])
    }
    expect(parseNamesLink(search({ names: '__proto__' }), 10)).toBeNull()
    expect(parseNamesLink(search({ names: 'constructor' }), 10)).toBeNull()
  })

  it('never throws on any input, including lone surrogates', () => {
    const odd = ['\ud800', 'seed:\ud800', 'seed:\udc00x', 'seed:' + '\ud83d'.repeat(40), '%', 'seed:%', 'seed:�']
    for (const raw of odd) {
      expect(() => parseNamesLink(search({ names: raw }), 28), JSON.stringify(raw)).not.toThrow()
    }
  })
})

describe('writeNamesLink', () => {
  it('writes nothing for no link', () => {
    const params = new URLSearchParams()
    writeNamesLink(params, null)
    expect(params.toString()).toBe('')
  })

  it('does not disturb params it does not own', () => {
    const params = new URLSearchParams('base=28')
    writeNamesLink(params, null)
    expect(params.toString()).toBe('base=28')
    writeNamesLink(params, seedLink('x'))
    expect(params.get('base')).toBe('28')
  })

  it('the preset link writes names=ccru and nothing else', () => {
    const params = new URLSearchParams()
    writeNamesLink(params, { kind: 'ccru' })
    expect(Array.from(params.entries())).toEqual([['names', 'ccru']])
  })

  it('a default seed link writes names=seed:<seed> only', () => {
    const params = new URLSearchParams()
    writeNamesLink(params, seedLink('abc'))
    expect(Array.from(params.entries())).toEqual([['names', 'seed:abc']])
  })

  it('writes each companion only when it is not its default', () => {
    const style = new URLSearchParams()
    writeNamesLink(style, seedLink('s', { style: 'syllabic' }))
    expect(Array.from(style.entries())).toEqual([
      ['names', 'seed:s'],
      ['nstyle', 'syllabic'],
    ])

    const join = new URLSearchParams()
    writeNamesLink(join, seedLink('s', { join: 'lo-hi' }))
    expect(Array.from(join.entries())).toEqual([
      ['names', 'seed:s'],
      ['njoin', 'lh'],
    ])

    const smooth = new URLSearchParams()
    writeNamesLink(smooth, seedLink('s', { smoothing: 1 }))
    expect(Array.from(smooth.entries())).toEqual([
      ['names', 'seed:s'],
      ['nsmooth', '1'],
    ])

    const all = new URLSearchParams()
    writeNamesLink(all, seedLink('s', { style: 'soft', join: 'lo-hi', smoothing: 1 }))
    expect(Array.from(all.entries()).map(([k]) => k)).toEqual(['names', 'nstyle', 'njoin', 'nsmooth'])
  })

  it('never writes sounds, locks or overrides', () => {
    const params = new URLSearchParams()
    writeNamesLink(params, seedLink('s', { style: 'soft', join: 'lo-hi', smoothing: 1 }))
    for (const key of params.keys()) expect(['names', 'nstyle', 'njoin', 'nsmooth']).toContain(key)
  })
})

describe('sameNamesLink', () => {
  it('compares two links by value and null by identity', () => {
    expect(sameNamesLink(null, null)).toBe(true)
    expect(sameNamesLink(null, { kind: 'ccru' })).toBe(false)
    expect(sameNamesLink({ kind: 'ccru' }, null)).toBe(false)
    expect(sameNamesLink({ kind: 'ccru' }, { kind: 'ccru' })).toBe(true)
    expect(sameNamesLink({ kind: 'ccru' }, seedLink('a'))).toBe(false)
    expect(sameNamesLink(seedLink('a'), { kind: 'ccru' })).toBe(false)
    expect(sameNamesLink(seedLink('a'), seedLink('a'))).toBe(true)
  })

  it('every field of a seed link matters', () => {
    const a = seedLink('a', { style: 'soft', join: 'lo-hi', smoothing: 1 })
    expect(sameNamesLink(a, seedLink('a', { style: 'soft', join: 'lo-hi', smoothing: 1 }))).toBe(true)
    expect(sameNamesLink(a, seedLink('b', { style: 'soft', join: 'lo-hi', smoothing: 1 }))).toBe(false)
    expect(sameNamesLink(a, seedLink('a', { style: 'harsh', join: 'lo-hi', smoothing: 1 }))).toBe(false)
    expect(sameNamesLink(a, seedLink('a', { style: 'soft', join: 'hi-lo', smoothing: 1 }))).toBe(false)
    expect(sameNamesLink(a, seedLink('a', { style: 'soft', join: 'lo-hi', smoothing: 0 }))).toBe(false)
  })
})

// ---- the round trip, over seeds that stress the query-string escaping ----

const SEED_PALETTE = [
  'a', 'Z', '7', ' ', '&', '=', '%', '+', ':', '?', '#', '/', '"', '\\', '_', '-', '.',
  'あ', '漢', 'न', 'é', String.fromCodePoint(0x1f600), String.fromCodePoint(0x1d11e),
]

/** A seed already in normal form, 1..64 UTF-16 units, built from escaping-hostile code points (emoji count as two units). */
function fitSeed(parts: readonly string[]): string {
  let out = ''
  for (const part of parts) {
    if (out.length + part.length > SEED_MAX_LENGTH) break
    out += part
  }
  return normalizeSeed(out) ?? 'x'
}

const seedArb = fc.array(fc.constantFrom(...SEED_PALETTE), { minLength: 1, maxLength: 64 }).map(fitSeed)

const styleArb: fc.Arbitrary<StyleId> = fc.constantFrom(...STYLE_IDS)

const linkArb: fc.Arbitrary<NamesLink> = fc.record({
  kind: fc.constant('seed' as const),
  seed: seedArb,
  style: styleArb,
  join: fc.constantFrom('hi-lo' as const, 'lo-hi' as const),
  smoothing: fc.constantFrom(0 as const, 1 as const),
})

describe('round trip', () => {
  it('parse(write(link)) deep-equals the link for 576 arbitrary seed links at base 28', () => {
    fc.assert(
      fc.property(linkArb, link => {
        const params = new URLSearchParams()
        writeNamesLink(params, link)
        // Through the serialized query string, as a real link travels.
        const wire = new URLSearchParams(params.toString())
        expect(parseNamesLink(wire, 28)).toEqual(link)
      }),
      { seed: 20261109, numRuns: 576 },
    )
  })

  it('the 64-unit extremes round trip (all ampersands, all percent signs, 32 emoji)', () => {
    for (const seed of ['&'.repeat(64), '%'.repeat(64), '='.repeat(64), '+'.repeat(64), String.fromCodePoint(0x1f600).repeat(32)]) {
      const link = seedLink(seed)
      const params = new URLSearchParams()
      writeNamesLink(params, link)
      expect(parseNamesLink(new URLSearchParams(params.toString()), 28)).toEqual(link)
    }
  })

  it('the preset link round trips at base 10', () => {
    const params = new URLSearchParams()
    writeNamesLink(params, { kind: 'ccru' })
    expect(parseNamesLink(new URLSearchParams(params.toString()), 10)).toEqual({ kind: 'ccru' })
  })
})

// ---- the codec: ShareState.names ----

describe('ShareState.names', () => {
  it('a fresh state has no names link, and a link without names= parses to null', () => {
    for (const base of [2, 10, 28, ABOVE_CEILING]) expect(defaultShareState(base).names).toBeNull()
    expect(parseShareParams('').state.names).toBeNull()
    expect(parseShareParams('?base=28&selected=3').state.names).toBeNull()
  })

  it('names= reads into the state, and the other fields are unaffected', () => {
    const { state } = parseShareParams('?base=28&names=seed%3Aabc&nstyle=soft&selected=3&tc=1')
    expect(state.names).toEqual(seedLink('abc', { style: 'soft' }))
    expect(state.base).toBe(28)
    expect(state.selected).toEqual([3])
    expect(state.tc).toBe(true)
  })

  it('names=ccru is kept at base 10 and dropped at every other base', () => {
    expect(parseShareParams('?names=ccru').state.names).toEqual({ kind: 'ccru' })
    expect(parseShareParams('?base=10&names=ccru').state.names).toEqual({ kind: 'ccru' })
    expect(parseShareParams('?base=28&names=ccru').state.names).toBeNull()
  })

  it('hostile names= falls back to no link without breaking any other field', () => {
    const hostile = [
      'names=seed%3Aa%00b',
      'names=seed%3Aa%E2%80%A8',
      'names=seed%3A' + 'a'.repeat(65),
      'names=bogus',
      'names=seed%3A' + 'x'.repeat(50_000),
    ]
    for (const names of hostile) {
      const { state, baseRefusal } = parseShareParams(`?base=28&selected=3&tc=1&labels=xeno&${names}`)
      expect(state.names, names.slice(0, 40)).toBeNull()
      expect(baseRefusal).toBeNull()
      expect(state.base).toBe(28)
      expect(state.selected).toEqual([3])
      expect(state.tc).toBe(true)
      expect(state.labels).toEqual({ mode: 'xeno' })
    }
  })

  it('buildShareParams writes the link, and a null link writes nothing (every existing URL is unchanged)', () => {
    const base = defaultShareState(28)
    expect(buildShareParams(base).toString()).toBe('base=28')
    const withSeed = { ...base, names: seedLink('abc', { style: 'soft', join: 'lo-hi', smoothing: 1 }) }
    const built = buildShareParams(withSeed)
    expect(built.get('names')).toBe('seed:abc')
    expect(built.get('nstyle')).toBe('soft')
    expect(built.get('njoin')).toBe('lh')
    expect(built.get('nsmooth')).toBe('1')
    const keys = Array.from(built.keys())
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)))
    expect(buildShareParams({ ...defaultShareState(10), names: { kind: 'ccru' } }).toString()).toBe('names=ccru')
  })

  it('a default-seed link is written (the session, not the codec, decides what is the default naming)', () => {
    const state = { ...defaultShareState(10), names: seedLink(DEFAULT_SEED) }
    expect(buildShareParams(state).get('names')).toBe(`seed:${DEFAULT_SEED}`)
  })

  it('parse(build(state)) keeps the link for a spread of bases', () => {
    for (const base of [2, 10, 28, 202]) {
      const state = { ...defaultShareState(base), names: seedLink('sigil', { style: 'syllabic', smoothing: 1 }) }
      expect(parseShareParams(buildShareParams(state)).state.names).toEqual(state.names)
    }
  })
})

describe('names= above the interactive ceiling (T-07-02c)', () => {
  it('the bases used here really are headless at their natural tier', () => {
    expect(tierFor(ABOVE_CEILING)).toBe('headless')
    expect(tierFor(MAX_SAFE_BASE)).toBe('headless')
  })

  it('keeps names=seed: one step above the ceiling and at 2^26, and never builds a numogram', () => {
    for (const base of [ABOVE_CEILING, MAX_SAFE_BASE]) {
      spy.mockClear()
      const { state } = parseShareParams(`?base=${base}&names=seed%3Ax&nstyle=soft&njoin=lh&nsmooth=1`)
      expect(state.base).toBe(base)
      expect(state.names).toEqual(seedLink('x', { style: 'soft', join: 'lo-hi', smoothing: 1 }))
      expect(spy).not.toHaveBeenCalled()
    }
  })

  it('region= still drops above the ceiling while names= survives in the same link', () => {
    const { state } = parseShareParams(`?base=${ABOVE_CEILING}&region=plex&names=seed%3Ax`)
    expect(state.region).toBeNull()
    expect(state.names).toEqual(seedLink('x'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('names= alone never builds a numogram at any base', () => {
    for (const base of [10, 28, INTERACTIVE_MAX_N]) {
      parseShareParams(`?base=${base}&names=seed%3Ax`)
    }
    expect(spy).not.toHaveBeenCalled()
  })
})
