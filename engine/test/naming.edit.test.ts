// NAM-01 / NAM-02 immutable edit operations (plan 07-05, 07-RESEARCH Pattern 8 "Store"): every edit returns a new frozen
// Naming that shares its unchanged parts by reference; locked zones survive regeneration; an override equal to what the rule
// or the preset would give is removed instead of stored. The CCRU preset is a SYNTHETIC test preset (made-up sounds and
// names), never the canonical table. The banks are drafts until plan 07-06's sign-off: no exact generated sound is pinned.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as engine from '../index'
import { meshOf } from '../core/demons'
import { DEFAULT_STYLE } from '../naming/banks'
import { createNameResolver, createNaming, deriveName } from '../naming/derive'
import {
  editSound,
  pasteSounds,
  resetOverride,
  setJoin,
  setOverride,
  setSeed,
  setSmoothing,
  setSource,
  setStyle,
  toggleLock,
} from '../naming/edit'
import { DEFAULT_SEED, createGenerator, generateSounds } from '../naming/generate'
import type { Naming, NamingPreset } from '../naming/types'

const CEILING = 4000
const HOLLOW = 'hollow-vector'

const SYNTHETIC: NamingPreset = {
  id: 'ccru',
  base: 10,
  sounds: ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh', 'qi', 'qj'],
  names: { 0: 'Alpha', 44: 'Omega' },
}

const n28 = (): Naming => createNaming({ base: 28, interactiveMaxN: CEILING })
const seedOnly = (): Naming => createNaming({ base: 6000, interactiveMaxN: CEILING })

/** A letters-only sound for index k, distinct for distinct k. */
function letters(k: number): string {
  return `x${String.fromCharCode(97 + (k % 26))}${String.fromCharCode(97 + (Math.floor(k / 26) % 26))}`
}

function snapshot(n: Naming): string {
  return JSON.stringify({ ...n, locks: [...n.locks], overrides: [...n.overrides] })
}

describe('editSound', () => {
  it('sets the sound (validated, NFC), locks the zone and shares the overrides Map by reference', () => {
    const n = n28()
    const n2 = editSound(n, 3, 'Gl')
    expect(n2).not.toBe(n)
    expect(n2.sounds![3]).toBe('Gl')
    expect(n2.locks.has(3)).toBe(true)
    expect(n2.locks.size).toBe(1)
    expect(n2.overrides).toBe(n.overrides)
    expect(Object.isFrozen(n2)).toBe(true)
    expect(Object.isFrozen(n2.sounds)).toBe(true)
    for (let z = 0; z < 28; z++) if (z !== 3) expect(n2.sounds![z]).toBe(n.sounds![z])
  })

  it('does not change its argument', () => {
    const n = n28()
    const before = snapshot(n)
    editSound(n, 3, 'Gl')
    expect(snapshot(n)).toBe(before)
    expect(n.locks.size).toBe(0)
  })

  it('normalises to NFC and trims', () => {
    expect(editSound(n28(), 5, ' é ').sounds![5]).toBe('é')
  })

  it('shares the locks Set when the zone is already locked', () => {
    const once = editSound(n28(), 3, 'Gl')
    const twice = editSound(once, 3, 'Zx')
    expect(twice.locks).toBe(once.locks)
    expect(twice.sounds![3]).toBe('Zx')
  })

  it('refuses an invalid sound, a zone outside the table and a non-string with a RangeError', () => {
    const n = n28()
    for (const bad of ['g1', '', '   ', 'a b', 'a-b', 'x'.repeat(17), 'a‌b']) expect(() => editSound(n, 3, bad)).toThrow(RangeError)
    expect(() => editSound(n, 3, 42 as never)).toThrow(RangeError)
    for (const z of [-1, 28, 1.5, Number.NaN]) expect(() => editSound(n, z, 'ok')).toThrow(RangeError)
  })

  it('refuses a seed-only naming', () => {
    expect(() => editSound(seedOnly(), 3, 'Gl')).toThrow(RangeError)
  })
})

describe('pasteSounds', () => {
  it('fills the zones from the start zone to the end of the table, locks them and reports how many it used', () => {
    const n = n28()
    const { naming, used } = pasteSounds(n, 26, ['aa', 'bb', 'cc'])
    expect(used).toBe(2)
    expect(naming.sounds![26]).toBe('aa')
    expect(naming.sounds![27]).toBe('bb')
    expect([...naming.locks].sort((x, y) => x - y)).toEqual([26, 27])
    expect(naming.overrides).toBe(n.overrides)
    for (let z = 0; z < 26; z++) expect(naming.sounds![z]).toBe(n.sounds![z])
  })

  it('uses the whole list when it fits', () => {
    const { naming, used } = pasteSounds(n28(), 0, ['aa', 'bb', 'cc'])
    expect(used).toBe(3)
    expect(naming.sounds!.slice(0, 3)).toEqual(['aa', 'bb', 'cc'])
  })

  it('returns the same naming for an empty list', () => {
    const n = n28()
    const result = pasteSounds(n, 4, [])
    expect(result.used).toBe(0)
    expect(result.naming).toBe(n)
  })

  it('validates the sounds it uses, all-or-nothing, and ignores the tail it drops', () => {
    const n = n28()
    expect(() => pasteSounds(n, 10, ['aa', 'g1'])).toThrow(RangeError)
    expect(pasteSounds(n, 26, ['aa', 'bb', 'c1d']).used).toBe(2)
    expect(n.locks.size).toBe(0)
  })

  it('refuses a start zone outside the table and a seed-only naming', () => {
    expect(() => pasteSounds(n28(), 28, ['aa'])).toThrow(RangeError)
    expect(() => pasteSounds(n28(), -1, ['aa'])).toThrow(RangeError)
    expect(() => pasteSounds(seedOnly(), 0, ['aa'])).toThrow(RangeError)
  })
})

describe('toggleLock', () => {
  it('toggles membership and shares the sounds and overrides by reference', () => {
    const n = n28()
    const on = toggleLock(n, 7)
    expect(on.locks.has(7)).toBe(true)
    expect(on.sounds).toBe(n.sounds)
    expect(on.overrides).toBe(n.overrides)
    const off = toggleLock(on, 7)
    expect(off.locks.has(7)).toBe(false)
    expect(off.sounds).toBe(n.sounds)
    expect(n.locks.size).toBe(0) // the argument is untouched
    expect(on.locks.size).toBe(1)
  })

  it('refuses a zone outside the table and a seed-only naming', () => {
    expect(() => toggleLock(n28(), 28)).toThrow(RangeError)
    expect(() => toggleLock(n28(), -1)).toThrow(RangeError)
    expect(() => toggleLock(seedOnly(), 1)).toThrow(RangeError)
  })
})

describe('setSeed and setStyle regenerate the unlocked zones and keep the locked ones', () => {
  it('setSeed: locked zones keep their sound, the rest equals generateSounds with the locked map, source becomes generated', () => {
    const n = editSound(editSound(n28(), 3, 'Gl'), 20, 'Zx')
    const n2 = setSeed(n, HOLLOW)
    expect(n2.seed).toBe(HOLLOW)
    expect(n2.source).toBe('generated')
    expect(n2.sounds![3]).toBe('Gl')
    expect(n2.sounds![20]).toBe('Zx')
    expect(n2.sounds).toEqual(generateSounds(createGenerator(HOLLOW, DEFAULT_STYLE), 28, new Map([[3, 'Gl'], [20, 'Zx']])))
    expect(n2.locks).toBe(n.locks)
    expect(n2.overrides).toBe(n.overrides)
    expect(n.seed).toBe(DEFAULT_SEED) // argument untouched
  })

  it('setSeed normalises the seed and refuses an empty, over-long or control-character seed', () => {
    expect(setSeed(n28(), '  hollow-vector\n').seed).toBe(HOLLOW)
    expect(() => setSeed(n28(), '')).toThrow(RangeError)
    expect(() => setSeed(n28(), '   ')).toThrow(RangeError)
    expect(() => setSeed(n28(), 'a'.repeat(65))).toThrow(RangeError)
    expect(() => setSeed(n28(), 'a\u0000b')).toThrow(RangeError)
    expect(() => setSeed(n28(), 7 as never)).toThrow(RangeError)
  })

  it('setStyle: same rule with the new style, and refuses an unknown style', () => {
    const n = editSound(n28(), 9, 'Gl')
    const n2 = setStyle(n, 'soft')
    expect(n2.style).toBe('soft')
    expect(n2.source).toBe('generated')
    expect(n2.sounds![9]).toBe('Gl')
    expect(n2.sounds).toEqual(generateSounds(createGenerator(DEFAULT_SEED, 'soft'), 28, new Map([[9, 'Gl']])))
    expect(() => setStyle(n, 'loud' as never)).toThrow(RangeError)
  })

  it.each([28, 666])('property: random lock sets at base %i survive setSeed and setStyle and the table stays distinct', base => {
    const gen = createGenerator(HOLLOW, DEFAULT_STYLE)
    const softGen = createGenerator(DEFAULT_SEED, 'soft')
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: base - 1 }), { maxLength: 40 }),
        fc.uniqueArray(fc.integer({ min: 0, max: base + 80 }), { minLength: 40, maxLength: 40 }),
        (zones, picks) => {
          // typed sounds: half are another zone's generated sound under the NEW seed or style (so the spare stream is exercised), half are plain
          const typedFor = (g: ReturnType<typeof createGenerator>): Map<number, string> => {
            const m = new Map<number, string>()
            const used = new Set<string>()
            zones.forEach((zone, k) => {
              const s = k % 2 === 0 ? g.soundAt(picks[k]!) : letters(picks[k]!)
              if (!used.has(s)) {
                used.add(s)
                m.set(zone, s)
              }
            })
            return m
          }
          for (const [apply, g] of [
            [(n: Naming) => setSeed(n, HOLLOW), gen],
            [(n: Naming) => setStyle(n, 'soft'), softGen],
          ] as const) {
            const typed = typedFor(g)
            let n = createNaming({ base, interactiveMaxN: CEILING })
            for (const [zone, sound] of typed) n = editSound(n, zone, sound)
            const after = apply(n)
            for (const [zone, sound] of typed) if (after.sounds![zone] !== sound) return false
            if (after.locks.size !== typed.size) return false
            if (new Set(after.sounds).size !== base) return false
            if (JSON.stringify(after.sounds) !== JSON.stringify(generateSounds(createGenerator(after.seed, after.style), base, typed))) return false
          }
          return true
        },
      ),
      { seed: 20261020, numRuns: 200 },
    )
  })
})

describe('setJoin and setSmoothing', () => {
  it('change only their field and share sounds, locks and overrides by reference', () => {
    const n = setOverride(toggleLock(n28(), 4), 69, 'Zed', null)
    const j = setJoin(n, 'lo-hi')
    expect(j.join).toBe('lo-hi')
    expect(j.sounds).toBe(n.sounds)
    expect(j.locks).toBe(n.locks)
    expect(j.overrides).toBe(n.overrides)
    expect({ ...j, join: 'hi-lo' }).toEqual(n)
    const s = setSmoothing(n, 1)
    expect(s.smoothing).toBe(1)
    expect(s.sounds).toBe(n.sounds)
    expect(s.locks).toBe(n.locks)
    expect(s.overrides).toBe(n.overrides)
    expect({ ...s, smoothing: 0 }).toEqual(n)
    expect(Object.isFrozen(j)).toBe(true)
  })

  it('refuse an unknown value', () => {
    expect(() => setJoin(n28(), 'up' as never)).toThrow(RangeError)
    expect(() => setSmoothing(n28(), 2 as never)).toThrow(RangeError)
    expect(() => setSmoothing(n28(), '1' as never)).toThrow(RangeError)
  })

  it('change the derived names', () => {
    const n = n28()
    const lh = createNameResolver(setJoin(n, 'lo-hi'), null)
    const hl = createNameResolver(n, null)
    expect(lh.nameOf(5, 2)).toBe(deriveName(n.sounds![2]!, n.sounds![5]!, 'hi-lo', 0))
    expect(lh.nameOf(5, 2)).not.toBe(hl.nameOf(5, 2))
  })
})

describe('setSource', () => {
  const ten = (): Naming => createNaming({ base: 10, interactiveMaxN: CEILING })

  it('ccru loads the preset sounds, clears the locks and keeps the overrides', () => {
    const n = setOverride(editSound(ten(), 2, 'Zx'), 1, 'Zed', null)
    const c = setSource(n, 'ccru', SYNTHETIC)
    expect(c.source).toBe('ccru')
    expect(c.sounds).toEqual([...SYNTHETIC.sounds])
    expect(c.sounds).not.toBe(SYNTHETIC.sounds)
    expect(c.locks.size).toBe(0)
    expect(c.overrides).toBe(n.overrides)
    expect(createNameResolver(c, SYNTHETIC).nameOf(9, 8)).toBe('Omega')
    expect(createNameResolver(c, SYNTHETIC).nameOf(2, 0)).toBe('Zed')
  })

  it('generated regenerates the unlocked zones and keeps the locked ones', () => {
    const c = editSound(setSource(ten(), 'ccru', SYNTHETIC), 2, 'Zx')
    const g = setSource(c, 'generated', SYNTHETIC)
    expect(g.source).toBe('generated')
    expect(g.sounds![2]).toBe('Zx')
    expect(g.sounds).toEqual(generateSounds(createGenerator(DEFAULT_SEED, DEFAULT_STYLE), 10, new Map([[2, 'Zx']])))
    expect(g.locks).toBe(c.locks)
    expect(g.overrides).toBe(c.overrides)
    expect(createNameResolver(g, SYNTHETIC).presetNameOf(9, 8)).toBeNull()
  })

  it('refuses ccru without a preset, with a preset for another base, with a short preset and on a seed-only naming', () => {
    expect(() => setSource(ten(), 'ccru', null)).toThrow(RangeError)
    expect(() => setSource(n28(), 'ccru', SYNTHETIC)).toThrow(RangeError)
    expect(() => setSource(ten(), 'ccru', { ...SYNTHETIC, sounds: ['qa'] })).toThrow(RangeError)
    expect(() => setSource(seedOnly(), 'ccru', { ...SYNTHETIC, base: 6000 })).toThrow(RangeError)
    expect(() => setSource(ten(), 'nope' as never, null)).toThrow(RangeError)
  })

  it('generated on a seed-only naming keeps it seed-only', () => {
    const s = setSource(seedOnly(), 'generated', null)
    expect(s.sounds).toBeNull()
    expect(s.source).toBe('generated')
  })
})

describe('setOverride and resetOverride', () => {
  it('stores the text under the mesh number, copies the Map and shares the sounds', () => {
    const n = n28()
    const n2 = setOverride(n, 69, 'Zed', null)
    expect(meshOf(12, 3)).toBe(69)
    expect(n2.overrides.get(69)).toBe('Zed')
    expect(n2.overrides.size).toBe(1)
    expect(n2.overrides).not.toBe(n.overrides)
    expect(n.overrides.size).toBe(0) // the argument is untouched
    expect(n2.sounds).toBe(n.sounds)
    expect(n2.locks).toBe(n.locks)
    expect(createNameResolver(n2, null).nameOf(3, 12)).toBe('Zed')
  })

  it('validates and normalises the name, and refuses an invalid one', () => {
    expect(setOverride(n28(), 69, '  Zed ', null).overrides.get(69)).toBe('Zed')
    expect(setOverride(n28(), 69, 'é', null).overrides.get(69)).toBe('é')
    for (const bad of ['Z1', '', 'a b', 'x'.repeat(33), 'a‮b']) expect(() => setOverride(n28(), 69, bad, null)).toThrow(RangeError)
    expect(() => setOverride(n28(), 69, 5 as never, null)).toThrow(RangeError)
  })

  it('refuses a mesh number outside the base and a seed-only naming', () => {
    const demons = (28 * 27) / 2
    for (const m of [-1, demons, 1.5, Number.NaN]) expect(() => setOverride(n28(), m, 'Zed', null)).toThrow(RangeError)
    expect(() => setOverride(n28(), demons - 1, 'Zed', null)).not.toThrow()
    expect(() => setOverride(seedOnly(), 69, 'Zed', null)).toThrow(RangeError)
  })

  it('removes the key instead of storing the exact rule name, under either smoothing', () => {
    for (const smoothing of [0, 1] as const) {
      const base = setSmoothing(n28(), smoothing)
      const rule = createNameResolver(base, null).ruleNameOf(12, 3, smoothing)
      const stored = setOverride(base, 69, 'Other', null)
      expect(stored.overrides.has(69)).toBe(true)
      const back = setOverride(stored, 69, rule, null)
      expect(back.overrides.has(69)).toBe(false)
      expect(back.overrides.size).toBe(0)
      expect(stored.overrides.has(69)).toBe(true) // the argument is untouched
      expect(back.sounds).toBe(stored.sounds)
    }
  })

  it('stores a name that differs from the rule name only in case (overrides are shown exactly as typed)', () => {
    const n = n28()
    const rule = createNameResolver(n, null).ruleNameOf(12, 3, 0)
    const lower = rule.toLowerCase()
    expect(lower).not.toBe(rule)
    expect(setOverride(n, 69, lower, null).overrides.get(69)).toBe(lower)
  })

  it('under source ccru, saving the preset name removes the override; elsewhere it is stored', () => {
    const c = setSource(createNaming({ base: 10, interactiveMaxN: CEILING }), 'ccru', SYNTHETIC)
    const edited = setOverride(c, 44, 'Zed', SYNTHETIC)
    expect(edited.overrides.get(44)).toBe('Zed')
    const back = setOverride(edited, 44, 'Omega', SYNTHETIC)
    expect(back.overrides.has(44)).toBe(false)
    // with source generated the preset is not a layer, so its name is just a typed name
    const g = createNaming({ base: 10, interactiveMaxN: CEILING })
    expect(setOverride(g, 44, 'Omega', SYNTHETIC).overrides.get(44)).toBe('Omega')
    // the rule name under source ccru is NOT what the demon shows, so it is stored (it overrides the preset)
    const rule = createNameResolver(c, SYNTHETIC).ruleNameOf(9, 8, 0)
    expect(setOverride(c, 44, rule, SYNTHETIC).overrides.get(44)).toBe(rule)
  })

  it('returns the argument itself when nothing changes', () => {
    const n = n28()
    const rule = createNameResolver(n, null).ruleNameOf(12, 3, 0)
    expect(setOverride(n, 69, rule, null)).toBe(n) // absent and equal to the rule
    const once = setOverride(n, 69, 'Zed', null)
    expect(setOverride(once, 69, 'Zed', null)).toBe(once) // already stored
    expect(resetOverride(n, 69)).toBe(n) // nothing to reset
  })

  it('resetOverride removes the key, copies the Map and shares the sounds', () => {
    const n = setOverride(setOverride(n28(), 69, 'Zed', null), 70, 'Yod', null)
    const r = resetOverride(n, 69)
    expect(r.overrides.has(69)).toBe(false)
    expect(r.overrides.get(70)).toBe('Yod')
    expect(r.overrides).not.toBe(n.overrides)
    expect(n.overrides.get(69)).toBe('Zed') // the argument is untouched
    expect(r.sounds).toBe(n.sounds)
    expect(r.locks).toBe(n.locks)
    expect(() => resetOverride(n, -1)).toThrow(RangeError)
    expect(() => resetOverride(n, (28 * 27) / 2)).toThrow(RangeError)
    expect(() => resetOverride(seedOnly(), 69)).toThrow(RangeError)
  })
})

describe('seed-only namings (above the ceiling)', () => {
  it('setSeed, setStyle, setJoin and setSmoothing work and keep the table absent', () => {
    const n = seedOnly()
    const a = setSeed(n, HOLLOW)
    expect(a.sounds).toBeNull()
    expect(a.seed).toBe(HOLLOW)
    const b = setStyle(a, 'soft')
    expect(b.sounds).toBeNull()
    expect(b.style).toBe('soft')
    expect(setJoin(b, 'lo-hi').sounds).toBeNull()
    expect(setSmoothing(b, 1).sounds).toBeNull()
    // the lazy names follow the new seed and style
    const gen = createGenerator(HOLLOW, 'soft')
    expect(createNameResolver(b, null).soundOf(5999)).toBe(gen.soundAt(5999))
  })

  it('editSound, pasteSounds, toggleLock, setOverride and resetOverride throw', () => {
    const n = seedOnly()
    expect(() => editSound(n, 1, 'aa')).toThrow(RangeError)
    expect(() => pasteSounds(n, 0, ['aa'])).toThrow(RangeError)
    expect(() => toggleLock(n, 1)).toThrow(RangeError)
    expect(() => setOverride(n, 1, 'Zed', null)).toThrow(RangeError)
    expect(() => resetOverride(n, 1)).toThrow(RangeError)
  })
})

describe('the engine barrel exports the naming module', () => {
  it('exposes the resolver, the text rules, euphony, the generator and the PRNG id', () => {
    expect(typeof engine.createNameResolver).toBe('function')
    expect(typeof engine.createNaming).toBe('function')
    expect(typeof engine.deriveName).toBe('function')
    expect(typeof engine.validateSound).toBe('function')
    expect(typeof engine.validateName).toBe('function')
    expect(typeof engine.smoothName).toBe('function')
    expect(typeof engine.editSound).toBe('function')
    expect(engine.DEFAULT_SEED).toBe(DEFAULT_SEED)
    expect(engine.PRNG_ALGO).toBe('sfc32-cyrb128@1')
    expect(engine.JOIN_ORDERS).toEqual(['hi-lo', 'lo-hi'])
    expect(engine.STYLE_IDS).toEqual(['harsh', 'soft', 'syllabic'])
  })

  it('does not disturb the existing engine exports', () => {
    expect(typeof engine.createNumogram).toBe('function')
    expect(typeof engine.meshOf).toBe('function')
    expect(typeof engine.resolveLayout).toBe('function')
    expect(engine.MAX_BASE).toBe(67108864)
  })
})
