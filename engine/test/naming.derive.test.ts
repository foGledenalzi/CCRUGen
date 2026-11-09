// NAM-02 name derivation and layering (plan 07-05, 07-RESEARCH Pattern 3): the read-time resolution of a demon's name,
// override > preset > derived rule, keyed by the decimal mesh number, lazy and O(1) above the interactive ceiling.
// The CCRU preset is only an argument here: this file uses a SYNTHETIC preset (made-up sounds and names) and never quotes a
// canonical demon name or the CCRU zone-sound table. The banks are drafts until plan 07-06's sign-off, so no exact generated
// sound string and no sound-table digest is pinned: every expectation is built from the generator or from definitions.
import { describe, expect, it } from 'vitest'
import { MAX_BASE } from '../core/base'
import { meshOf, netSpanOf } from '../core/demons'
import { DEFAULT_STYLE } from '../naming/banks'
import { deriveName, createNaming, createNameResolver } from '../naming/derive'
import { smoothName } from '../naming/euphony'
import { DEFAULT_SEED, createGenerator, generateSounds } from '../naming/generate'
import { JOIN_ORDERS, isJoinOrder, type JoinOrder, type Naming, type NamingPreset, type Smoothing } from '../naming/types'

const CEILING = 4000
const SMOOTHINGS: readonly Smoothing[] = [0, 1]

// Ten made-up sounds and two made-up names, at base 10. Nothing here is CCRU lore.
const SYNTHETIC: NamingPreset = {
  id: 'ccru',
  base: 10,
  sounds: ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh', 'qi', 'qj'],
  names: { 0: 'Alpha', 44: 'Omega' },
}

function withOverrides(n: Naming, entries: ReadonlyArray<readonly [number, string]>): Naming {
  return { ...n, overrides: new Map(entries) }
}

describe('JoinOrder', () => {
  it('lists the two orders, high-then-low first, and guards unknown values', () => {
    expect([...JOIN_ORDERS]).toEqual(['hi-lo', 'lo-hi'])
    expect(Object.isFrozen(JOIN_ORDERS)).toBe(true)
    expect(isJoinOrder('hi-lo')).toBe(true)
    expect(isJoinOrder('lo-hi')).toBe(true)
    for (const bad of ['', 'HI-LO', 'hi', 0, null, undefined, {}, ['hi-lo']]) expect(isJoinOrder(bad)).toBe(false)
  })
})

describe('deriveName', () => {
  it.each<[string, string, JoinOrder, Smoothing, string]>([
    ['dk', 'pdd', 'hi-lo', 0, 'Dkpdd'],
    ['dk', 'pdd', 'lo-hi', 0, 'Pdddk'],
    ['dk', 'pdd', 'hi-lo', 1, 'Dkupdid'],
    ['bgg', 'nd', 'hi-lo', 1, 'Bgugnad'],
    ['DK', 'pdd', 'hi-lo', 0, 'DKpdd'], // a sound typed in capitals keeps its case; only the first letter is forced up
    ['dk', 'PDD', 'lo-hi', 0, 'PDDdk'],
  ])('joins %s and %s (%s, smoothing %i) into %s', (hi, lo, join, smoothing, expected) => {
    expect(deriveName(hi, lo, join, smoothing)).toBe(expected)
  })

  it('capitalises the first letter of a non-Latin script and applies NFC to the join', () => {
    expect(deriveName('ωx', 'βy', 'hi-lo', 0)).toBe('Ωxβy')
    // e + combining acute (NFD) joins to the single precomposed letter
    expect(deriveName('é', 'k', 'hi-lo', 0)).toBe('Ék')
  })

  it('smooths before capitalising: smoothing 1 equals upperFirst of smoothName of the raw join', () => {
    expect(deriveName('bgg', 'nd', 'hi-lo', 1)).toBe(smoothName('bggnd').replace(/^./, c => c.toUpperCase()))
    // a non-ASCII name is untouched by smoothing (script-safe no-op)
    expect(deriveName('ωx', 'βy', 'hi-lo', 1)).toBe(deriveName('ωx', 'βy', 'hi-lo', 0))
  })
})

describe('createNaming', () => {
  it('builds the default generated naming from the generator (base 28)', () => {
    const n = createNaming({ base: 28, interactiveMaxN: CEILING })
    expect(n.base).toBe(28)
    expect(n.source).toBe('generated')
    expect(n.seed).toBe(DEFAULT_SEED)
    expect(n.style).toBe(DEFAULT_STYLE)
    expect(n.join).toBe('hi-lo')
    expect(n.smoothing).toBe(0)
    expect(n.sounds).toEqual(generateSounds(createGenerator(DEFAULT_SEED, DEFAULT_STYLE), 28))
    expect(new Set(n.sounds).size).toBe(28)
    expect(n.locks.size).toBe(0)
    expect(n.overrides.size).toBe(0)
    expect(n.meta).toBeNull()
  })

  it('freezes the naming and its sound table', () => {
    const n = createNaming({ base: 28, interactiveMaxN: CEILING })
    expect(Object.isFrozen(n)).toBe(true)
    expect(Object.isFrozen(n.sounds)).toBe(true)
  })

  it('normalises the seed and honours every option', () => {
    const n = createNaming({ base: 12, interactiveMaxN: CEILING, seed: '  hollow-vector \n', style: 'soft', join: 'lo-hi', smoothing: 1 })
    expect(n.seed).toBe('hollow-vector')
    expect(n.style).toBe('soft')
    expect(n.join).toBe('lo-hi')
    expect(n.smoothing).toBe(1)
    expect(n.sounds).toEqual(generateSounds(createGenerator('hollow-vector', 'soft'), 12))
  })

  it('has no dense table above the interactive ceiling: seed-only is decided by the base alone', () => {
    expect(createNaming({ base: 102, interactiveMaxN: 100 }).sounds).toBeNull()
    expect(createNaming({ base: 100, interactiveMaxN: 100 }).sounds).not.toBeNull()
    expect(createNaming({ base: MAX_BASE, interactiveMaxN: CEILING }).sounds).toBeNull()
  })

  it('copies the preset sounds for source ccru', () => {
    const n = createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC })
    expect(n.source).toBe('ccru')
    expect(n.sounds).toEqual([...SYNTHETIC.sounds])
    expect(n.sounds).not.toBe(SYNTHETIC.sounds)
    expect(Object.isFrozen(n.sounds)).toBe(true)
  })

  it('refuses source ccru without a matching preset', () => {
    expect(() => createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru' })).toThrow(RangeError)
    expect(() => createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: null })).toThrow(RangeError)
    expect(() => createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: { ...SYNTHETIC, base: 12 } })).toThrow(RangeError)
    expect(() => createNaming({ base: 12, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC })).toThrow(RangeError)
  })

  it('refuses an invalid base, seed, style, join and smoothing with a RangeError', () => {
    expect(() => createNaming({ base: 9, interactiveMaxN: CEILING })).toThrow(RangeError)
    expect(() => createNaming({ base: 0, interactiveMaxN: CEILING })).toThrow(RangeError)
    expect(() => createNaming({ base: MAX_BASE + 2, interactiveMaxN: CEILING })).toThrow(RangeError)
    expect(() => createNaming({ base: 28, interactiveMaxN: CEILING, seed: '' })).toThrow(RangeError)
    expect(() => createNaming({ base: 28, interactiveMaxN: CEILING, seed: 'a'.repeat(65) })).toThrow(RangeError)
    expect(() => createNaming({ base: 28, interactiveMaxN: CEILING, style: 'loud' as never })).toThrow(RangeError)
    // a seed-only naming validates too (no generator is built for it until a name is read)
    expect(() => createNaming({ base: 6000, interactiveMaxN: CEILING, style: 'loud' as never })).toThrow(RangeError)
    expect(() => createNaming({ base: 28, interactiveMaxN: CEILING, join: 'up' as never })).toThrow(RangeError)
    expect(() => createNaming({ base: 28, interactiveMaxN: CEILING, smoothing: 2 as never })).toThrow(RangeError)
  })
})

describe('createNameResolver: rule names are a pure function of the generator', () => {
  it('nameOf equals deriveName over generateSounds for every demon at base 28, both orders and both smoothings', () => {
    const base = 28
    for (const join of JOIN_ORDERS) {
      for (const smoothing of SMOOTHINGS) {
        const n = createNaming({ base, interactiveMaxN: CEILING, join, smoothing })
        const sounds = generateSounds(createGenerator(DEFAULT_SEED, DEFAULT_STYLE), base)
        const r = createNameResolver(n, null)
        for (let a = 1; a < base; a++) {
          for (let b = 0; b < a; b++) {
            const expected = deriveName(sounds[a]!, sounds[b]!, join, smoothing)
            expect(r.nameOf(a, b)).toBe(expected)
            expect(r.nameOf(b, a)).toBe(expected)
          }
        }
      }
    }
  })

  it('nameOf equals deriveName for every one of the 221,445 demons at base 666 (both orders, smoothing 0)', () => {
    const base = 666
    const sounds = generateSounds(createGenerator(DEFAULT_SEED, DEFAULT_STYLE), base)
    for (const join of JOIN_ORDERS) {
      const r = createNameResolver(createNaming({ base, interactiveMaxN: CEILING, join }), null)
      let mismatches = 0
      for (let a = 1; a < base; a++) {
        for (let b = 0; b < a; b++) {
          if (r.nameOf(a, b) !== deriveName(sounds[a]!, sounds[b]!, join, 0)) mismatches++
        }
      }
      expect(mismatches).toBe(0)
    }
  })

  it('soundOf reads the dense table; ruleNameOf ignores the naming smoothing, overrides and preset', () => {
    const n = withOverrides(createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC, smoothing: 1 }), [[44, 'Zed']])
    const r = createNameResolver(n, SYNTHETIC)
    for (let z = 0; z < 10; z++) expect(r.soundOf(z)).toBe(SYNTHETIC.sounds[z])
    // the rule name for 9::8 under either smoothing is the derived one, whatever the layers say
    expect(r.ruleNameOf(9, 8, 0)).toBe(deriveName('qj', 'qi', 'hi-lo', 0))
    expect(r.ruleNameOf(8, 9, 1)).toBe(deriveName('qj', 'qi', 'hi-lo', 1))
    expect(r.nameOf(9, 8)).toBe('Zed')
  })

  it('exposes the base', () => {
    expect(createNameResolver(createNaming({ base: 28, interactiveMaxN: CEILING }), null).base).toBe(28)
  })

  it('returns a frozen resolver', () => {
    expect(Object.isFrozen(createNameResolver(createNaming({ base: 28, interactiveMaxN: CEILING }), null))).toBe(true)
  })
})

describe('createNameResolver: layering override > preset > rule', () => {
  const ccru = createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC })

  it('uses the preset name under source ccru (mesh 44 is 9::8)', () => {
    expect(meshOf(9, 8)).toBe(44)
    const r = createNameResolver(ccru, SYNTHETIC)
    expect(r.nameOf(9, 8)).toBe('Omega')
    expect(r.nameOf(8, 9)).toBe('Omega')
    expect(r.presetNameOf(9, 8)).toBe('Omega')
    expect(r.stateOf(9, 8)).toBe('preset')
    expect(r.nameOf(1, 0)).toBe('Alpha') // mesh 0
  })

  it('lets a user override beat the preset', () => {
    const r = createNameResolver(withOverrides(ccru, [[44, 'Zed']]), SYNTHETIC)
    expect(r.nameOf(9, 8)).toBe('Zed')
    expect(r.stateOf(9, 8)).toBe('overridden')
    expect(r.presetNameOf(9, 8)).toBe('Omega') // the layer is still there to reset to
  })

  it('derives a demon the preset does not name, state generated', () => {
    const r = createNameResolver(ccru, SYNTHETIC)
    expect(r.presetNameOf(2, 0)).toBeNull()
    expect(r.nameOf(2, 0)).toBe(deriveName('qc', 'qa', 'hi-lo', 0))
    expect(r.stateOf(2, 0)).toBe('generated')
  })

  it('ignores the preset when the source is generated', () => {
    const generated = createNaming({ base: 10, interactiveMaxN: CEILING })
    const r = createNameResolver(generated, SYNTHETIC)
    expect(r.presetNameOf(9, 8)).toBeNull()
    expect(r.stateOf(9, 8)).toBe('generated')
    expect(r.nameOf(9, 8)).not.toBe('Omega')
  })

  it('ignores a preset for another base or a null preset', () => {
    expect(createNameResolver(ccru, null).presetNameOf(9, 8)).toBeNull()
    expect(createNameResolver(ccru, { ...SYNTHETIC, base: 12 }).presetNameOf(9, 8)).toBeNull()
    expect(createNameResolver(ccru, null).nameOf(9, 8)).toBe(deriveName('qj', 'qi', 'hi-lo', 0))
  })

  it('layers an override over a generated demon too', () => {
    const r = createNameResolver(withOverrides(createNaming({ base: 10, interactiveMaxN: CEILING }), [[3, 'Zed']]), null)
    expect(meshOf(3, 0)).toBe(3)
    expect(r.nameOf(3, 0)).toBe('Zed')
    expect(r.nameOf(0, 3)).toBe('Zed')
    expect(r.stateOf(3, 0)).toBe('overridden')
  })
})

describe('override key = decimal mesh number', () => {
  it('an override under meshOf(12, 3) = 69 changes that demon in both orders and nothing else at base 28', () => {
    expect(meshOf(12, 3)).toBe(69)
    const plain = createNaming({ base: 28, interactiveMaxN: CEILING })
    const edited = withOverrides(plain, [[69, 'Zed']])
    const before = createNameResolver(plain, null)
    const after = createNameResolver(edited, null)
    expect(after.nameOf(12, 3)).toBe('Zed')
    expect(after.nameOf(3, 12)).toBe('Zed')
    let changed = 0
    let same = 0
    for (let a = 1; a < 28; a++) {
      for (let b = 0; b < a; b++) {
        if (after.nameOf(a, b) === before.nameOf(a, b)) same++
        else changed++
      }
    }
    expect(changed).toBe(1)
    expect(same).toBe(377)
  })

  it('the key is the same demon at every base (the id depends on the two zones only)', () => {
    for (const base of [28, 40, 666]) {
      const n = withOverrides(createNaming({ base, interactiveMaxN: CEILING }), [[meshOf(12, 3), 'Zed']])
      expect(createNameResolver(n, null).nameOf(12, 3)).toBe('Zed')
    }
    expect(netSpanOf(69)).toEqual([12, 3])
  })
})

describe('seed-only resolution above the ceiling', () => {
  it('resolves names lazily at base 2^26 in O(1)', () => {
    const base = MAX_BASE
    const naming = createNaming({ base, interactiveMaxN: CEILING })
    expect(naming.sounds).toBeNull()
    const gen = createGenerator(DEFAULT_SEED, DEFAULT_STYLE)
    let best = Infinity
    let name = ''
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now()
      const r = createNameResolver(naming, null)
      name = r.nameOf(base - 1, base - 2)
      best = Math.min(best, performance.now() - t0)
    }
    expect(name.length).toBeGreaterThan(0)
    expect(name[0]).toBe(name[0]!.toUpperCase())
    expect(best).toBeLessThan(50)
    const r = createNameResolver(naming, null)
    expect(r.soundOf(base - 1)).toBe(gen.soundAt(base - 1))
    expect(name).toBe(deriveName(gen.soundAt(base - 1), gen.soundAt(base - 2), 'hi-lo', 0))
    expect(r.stateOf(base - 1, base - 2)).toBe('generated')
  })

  it('agrees with the dense table of a smaller base for the same zones (prefix stability)', () => {
    const dense = createNameResolver(createNaming({ base: 3000, interactiveMaxN: CEILING }), null)
    const lazy = createNameResolver(createNaming({ base: 3000, interactiveMaxN: 100 }), null)
    for (const [a, b] of [[2999, 0], [1500, 1499], [64, 3], [2000, 1999]] as const) expect(lazy.nameOf(a, b)).toBe(dense.nameOf(a, b))
  })
})

describe('range checks', () => {
  const n = createNaming({ base: 28, interactiveMaxN: CEILING })
  const r = createNameResolver(n, null)

  it('soundOf throws a RangeError for a zone outside [0, base) and for a non-integer', () => {
    expect(() => r.soundOf(-1)).toThrow(RangeError)
    expect(() => r.soundOf(28)).toThrow(RangeError)
    expect(() => r.soundOf(1.5)).toThrow(RangeError)
    expect(() => r.soundOf(Number.NaN)).toThrow(RangeError)
  })

  it('nameOf throws for a === b, a zone outside the base (even if the mesh number would be valid) and a non-integer', () => {
    expect(() => r.nameOf(3, 3)).toThrow(RangeError)
    expect(() => r.nameOf(-1, 2)).toThrow(RangeError)
    expect(() => r.nameOf(28, 2)).toThrow(RangeError)
    expect(() => r.nameOf(2, 28)).toThrow(RangeError)
    expect(() => r.nameOf(1.5, 0)).toThrow(RangeError)
    expect(() => r.ruleNameOf(3, 3, 0)).toThrow(RangeError)
    expect(() => r.presetNameOf(28, 0)).toThrow(RangeError)
    expect(() => r.stateOf(0, 0)).toThrow(RangeError)
  })

  it('a stored override for a demon outside the base is never read (zone check comes first)', () => {
    const stale = createNameResolver(withOverrides(n, [[meshOf(30, 2), 'Zed']]), null)
    expect(() => stale.nameOf(30, 2)).toThrow(RangeError)
  })
})

describe('purity of the contract types', () => {
  it('has no preset table or lore in the engine: createNameResolver reads only its argument', () => {
    const n = createNaming({ base: 10, interactiveMaxN: CEILING })
    // with no preset passed, base 10 derives like any other base (no canonical names exist in the engine)
    const r = createNameResolver(n, null)
    const sounds = n.sounds as readonly string[]
    for (let a = 1; a < 10; a++) {
      for (let b = 0; b < a; b++) {
        expect(r.nameOf(a, b)).toBe(deriveName(sounds[a]!, sounds[b]!, 'hi-lo', 0))
        expect(r.stateOf(a, b)).toBe('generated')
      }
    }
  })
})
