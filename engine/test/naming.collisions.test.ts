// NAM-03 collision detection (plan 07-10, 07-RESEARCH Pattern 5, Pitfalls 11 and 21): exact counts of repeated final names, a bounded
// list, the O(n log n) certificate for generated tables and the resumable partitioned scan for everything else. The oracle is an
// independent brute force over every demon (Map name -> meshes through the same nameOf the UI shows). The CCRU preset is a SYNTHETIC
// test preset (made-up sounds and names) and no canonical name or zone sound is quoted: every expectation is built from definitions.
// The syllable banks are signed off at 07-06, but no exact generated string is pinned here either.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { STYLE_IDS, type StyleId } from '../naming/banks'
import * as barrel from '../naming/index'
import {
  COLLISION_GROUPS_MAX,
  COLLISION_GROUP_MESHES_MAX,
  COLLISION_SCAN_MAX_N,
  canCertify,
  createCollisionJob,
  findCollisions,
  provablyUnique,
  type CollisionGroup,
  type CollisionReport,
} from '../naming/collisions'
import { createNameResolver, createNaming } from '../naming/derive'
import { toNfc } from '../naming/text'
import type { JoinOrder, Naming, NamingPreset, Smoothing } from '../naming/types'

const CEILING = 4000
const SEED = 20261020
const JOINS: readonly JoinOrder[] = ['hi-lo', 'lo-hi']
const SMOOTHINGS: readonly Smoothing[] = [0, 1]
const E_ACUTE = String.fromCodePoint(0xe9) // a precomposed letter
const E_NFD = 'e' + String.fromCodePoint(0x301) // the same letter spelled with a combining mark
const E_CAPITAL = String.fromCodePoint(0xc9)
const E_CAPITAL_NFD = 'E' + String.fromCodePoint(0x301)

/** A naming whose table, join, smoothing and overrides are whatever the test says (the table is not validated). */
function typed(
  base: number,
  sounds: readonly string[],
  join: JoinOrder = 'hi-lo',
  smoothing: Smoothing = 0,
  overrides: ReadonlyMap<number, string> = new Map(),
): Naming {
  return { ...createNaming({ base, interactiveMaxN: Math.max(CEILING, base) }), sounds, join, smoothing, overrides }
}

/**
 * The same table as a ccru naming with a preset that names no demon: its names equal the generated ones, but canCertify is false
 * (preset names must be scanned), so this is the public way to force the full scan.
 */
function forceScan(naming: Naming, names: Readonly<Record<number, string>> = {}): { naming: Naming; preset: NamingPreset } {
  const preset: NamingPreset = { id: 'ccru', base: naming.base, sounds: naming.sounds as readonly string[], names }
  return { naming: { ...naming, source: 'ccru' }, preset }
}

/** The independent oracle: every demon a > b in ascending mesh order, final names compared after NFC, case-sensitive. */
function bruteForce(naming: Naming, preset: NamingPreset | null): CollisionReport {
  const resolver = createNameResolver(naming, preset)
  const byName = new Map<string, number[]>()
  for (let a = 1; a < naming.base; a++) {
    for (let b = 0; b < a; b++) {
      const name = toNfc(resolver.nameOf(a, b))
      const mesh = (a * (a - 1)) / 2 + b
      const list = byName.get(name)
      if (list === undefined) byName.set(name, [mesh])
      else list.push(mesh)
    }
  }
  const list: CollisionGroup[] = []
  let demons = 0
  for (const [name, meshes] of byName) {
    if (meshes.length < 2) continue
    demons += meshes.length
    list.push({ name, size: meshes.length, meshes: meshes.slice(0, COLLISION_GROUP_MESHES_MAX) })
  }
  list.sort((x, y) => (x.meshes[0] as number) - (y.meshes[0] as number))
  return { groups: list.length, demons, list: list.slice(0, COLLISION_GROUPS_MAX) }
}

function run(naming: Naming, preset: NamingPreset | null): CollisionReport {
  return findCollisions(naming, preset)
}

const NONE: CollisionReport = { groups: 0, demons: 0, list: [] }

/** a, b, ..., z, ba, bb, ... : letters only, so a generated override text stays a plausible name. */
function lettersOf(k: number): string {
  let s = ''
  let x = k
  do {
    s = String.fromCharCode(97 + (x % 26)) + s
    x = Math.floor(x / 26)
  } while (x > 0)
  return s
}

describe('constants and the barrel', () => {
  it('pins the bounds', () => {
    expect(COLLISION_GROUPS_MAX).toBe(2000)
    expect(COLLISION_GROUP_MESHES_MAX).toBe(16)
    expect(COLLISION_SCAN_MAX_N).toBe(4096)
    // every mesh number of a scan fits in the 23 bits of the packed key
    expect((COLLISION_SCAN_MAX_N * (COLLISION_SCAN_MAX_N - 1)) / 2).toBeLessThan(2 ** 23)
  })

  it('exports the collision API through the naming barrel', () => {
    expect(barrel.findCollisions).toBe(findCollisions)
    expect(barrel.createCollisionJob).toBe(createCollisionJob)
    expect(barrel.provablyUnique).toBe(provablyUnique)
    expect(barrel.canCertify).toBe(canCertify)
    expect(barrel.COLLISION_SCAN_MAX_N).toBe(COLLISION_SCAN_MAX_N)
    expect(barrel.COLLISION_GROUPS_MAX).toBe(COLLISION_GROUPS_MAX)
    expect(barrel.COLLISION_GROUP_MESHES_MAX).toBe(COLLISION_GROUP_MESHES_MAX)
  })
})

describe('provablyUnique', () => {
  it.each([28, 64, 300])('is true for the generated tables at base %i, every style, smoothing 0 and 1', base => {
    for (const style of STYLE_IDS) {
      const sounds = createNaming({ base, interactiveMaxN: CEILING, style }).sounds as readonly string[]
      expect(provablyUnique(sounds, 0)).toBe(true)
      expect(provablyUnique(sounds, 1)).toBe(true)
    }
  })

  it('rejects a duplicate, wherever the pair sorts', () => {
    expect(provablyUnique(['ab', 'cd', 'ab'], 0)).toBe(false)
    expect(provablyUnique(['zz', 'ab', 'cd', 'ab', 'yy'], 0)).toBe(false)
    expect(provablyUnique(['ab', 'ab'], 0)).toBe(false)
  })

  it('rejects a prefix pair (the raw join would not determine its parts)', () => {
    expect(provablyUnique(['gl', 'glo', 'xy'], 0)).toBe(false)
    expect(provablyUnique(['xy', 'glo', 'gl'], 0)).toBe(false)
    expect(provablyUnique(['kt', 'ktk', 'ktkb', 'xy'], 0)).toBe(false)
  })

  it('rejects a non-ASCII or upper-case sound', () => {
    expect(provablyUnique(['ab', E_ACUTE], 0)).toBe(false)
    expect(provablyUnique(['ab', 'Cd'], 0)).toBe(false)
    expect(provablyUnique(['ab', 'c d'], 0)).toBe(false)
    expect(provablyUnique(['ab', ''], 0)).toBe(false)
  })

  it('needs the smoothing condition for a table with fill vowels that is not inert', () => {
    expect(provablyUnique(['ta', 'kt', 'tkt'], 0)).toBe(true) // raw: distinct and prefix-free
    expect(provablyUnique(['ta', 'kt', 'tkt'], 1)).toBe(false) // a fill vowel occurs naturally and smoothing changes joins
  })

  it('accepts smoothing when no sound has a, u or i, or when smoothing is inert', () => {
    expect(provablyUnique(['tkt', 'kst', 'bdg'], 1)).toBe(true) // harsh-like: no fill vowel occurs
    expect(provablyUnique(['ta', 'ki', 'lo'], 1)).toBe(true) // inert: ASCII, vowel, runs <= 1
    expect(provablyUnique([], 1)).toBe(true)
  })
})

describe('canCertify', () => {
  const synthetic: NamingPreset = {
    id: 'ccru',
    base: 10,
    sounds: ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh', 'qi', 'qj'],
    names: { 0: 'Alpha' },
  }

  it('is true for a generated naming, with or without overrides', () => {
    const naming = createNaming({ base: 28, interactiveMaxN: CEILING })
    expect(canCertify(naming, null)).toBe(true)
    expect(canCertify({ ...naming, overrides: new Map([[3, 'Anything']]) }, null)).toBe(true)
    expect(canCertify({ ...naming, smoothing: 1 }, null)).toBe(true)
  })

  it('is false for a ccru naming with a preset of its base (preset names must be scanned)', () => {
    const naming = createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: synthetic })
    expect(provablyUnique(naming.sounds as readonly string[], 0)).toBe(true)
    expect(canCertify(naming, synthetic)).toBe(false)
    // the preset layer applies only for a preset of this base, as in the resolver
    expect(canCertify(naming, null)).toBe(true)
    expect(canCertify(naming, { ...synthetic, base: 12 })).toBe(true)
  })

  it('is false for a seed-only naming', () => {
    expect(createNaming({ base: CEILING + 2, interactiveMaxN: CEILING }).sounds).toBeNull()
    expect(canCertify(createNaming({ base: CEILING + 2, interactiveMaxN: CEILING }), null)).toBe(false)
  })

  it('is false for a typed table that is not lowercase ASCII, distinct and prefix-free', () => {
    expect(canCertify(typed(4, ['ab', E_ACUTE, 'cd', 'ef']), null)).toBe(false)
    expect(canCertify(typed(4, ['ab', 'Cd', 'ef', 'gh']), null)).toBe(false)
    expect(canCertify(typed(4, ['ab', 'cd', 'ab', 'gh']), null)).toBe(false)
    expect(canCertify(typed(4, ['ab', 'abc', 'ef', 'gh']), null)).toBe(false)
    expect(canCertify(typed(4, ['ab', 'cd', 'ef', 'gh']), null)).toBe(true)
  })
})

describe('the certified job (hand-checked table)', () => {
  // base 6, sounds b c d f g h (distinct, prefix-free, lowercase). hi-lo names, with meshes a(a-1)/2 + b:
  //   (1,0)=0 Cb, (2,0)=1 Db, (2,1)=2 Dc, (3,0)=3 Fb, (3,1)=4 Fc, (3,2)=5 Fd, (4,0..3)=6..9 Gb Gc Gd Gf, (5,0..4)=10..14 Hb Hc Hd Hf Hg
  const SOUNDS = ['b', 'c', 'd', 'f', 'g', 'h']
  const with_ = (overrides: ReadonlyArray<readonly [number, string]>, join: JoinOrder = 'hi-lo', smoothing: Smoothing = 0): Naming =>
    typed(6, SOUNDS, join, smoothing, new Map(overrides))

  it('reports nothing for a table with no overrides, in one step, without scanning', () => {
    const job = createCollisionJob(with_([]), null)
    expect(job.certified).toBe(true)
    expect(job.step(() => true)).toEqual(NONE)
  })

  it('finds an override that equals another demon derived name, and two equal overrides', () => {
    const naming = with_([
      [0, 'Db'], // the derived name of demon 1
      [2, 'Zed'],
      [5, 'Zed'],
      [8, 'Gd'], // its own derived name: one demon, no collision
    ])
    const expected: CollisionReport = {
      groups: 2,
      demons: 4,
      list: [
        { name: 'Db', size: 2, meshes: [0, 1] },
        { name: 'Zed', size: 2, meshes: [2, 5] },
      ],
    }
    expect(run(naming, null)).toEqual(expected)
    expect(bruteForce(naming, null)).toEqual(expected)
    const forced = forceScan(naming)
    expect(run(forced.naming, forced.preset)).toEqual(expected)
  })

  it('counts a derived demon together with several overrides', () => {
    const naming = with_([
      [0, 'Db'],
      [3, 'Db'],
    ])
    expect(run(naming, null)).toEqual({ groups: 1, demons: 3, list: [{ name: 'Db', size: 3, meshes: [0, 1, 3] }] })
  })

  it('ignores a derived name that belongs to an overridden demon', () => {
    // demon 1 (derived Db) is itself renamed, so the override of demon 0 collides with nothing
    expect(run(with_([[0, 'Db'], [1, 'Elsewhere']]), null)).toEqual(NONE)
  })

  it('finds a smoothed derived name (the inserted fill vowel)', () => {
    // smoothing 1: two consonants in a row get the closing fill vowel of the last one, so demon 1 (d + b) is Dbu
    const naming = with_([[0, 'Dbu']], 'hi-lo', 1)
    expect(createNameResolver(naming, null).nameOf(2, 0)).toBe('Dbu')
    expect(run(naming, null)).toEqual({ groups: 1, demons: 2, list: [{ name: 'Dbu', size: 2, meshes: [0, 1] }] })
    expect(run(naming, null)).toEqual(bruteForce(naming, null))
  })

  it('finds a collision in the lo-hi order', () => {
    // lo-hi names: (1,0) Bc, (2,0) Bd, (2,1) Cd ...
    const naming = with_([[0, 'Bd']], 'lo-hi')
    expect(createNameResolver(naming, null).nameOf(2, 0)).toBe('Bd')
    expect(run(naming, null)).toEqual({ groups: 1, demons: 2, list: [{ name: 'Bd', size: 2, meshes: [0, 1] }] })
  })

  it('ignores an override for a demon outside the table (stale mesh number), like the resolver does', () => {
    const naming = with_([[15, 'Db'], [99, 'Zed'], [98, 'Zed']]) // base 6 has meshes 0..14
    expect(run(naming, null)).toEqual(NONE)
    const forced = forceScan(naming)
    expect(run(forced.naming, forced.preset)).toEqual(NONE)
  })

  it('treats case as significant and compares after NFC', () => {
    expect(run(with_([[0, 'db']]), null)).toEqual(NONE) // lower-case d is not the derived Db
    // two spellings of one letter are one name
    const naming = typed(6, SOUNDS, 'hi-lo', 0, new Map([[0, E_CAPITAL + 'a'], [1, E_CAPITAL_NFD + 'a']]))
    expect(run(naming, null)).toEqual({ groups: 1, demons: 2, list: [{ name: E_CAPITAL + 'a', size: 2, meshes: [0, 1] }] })
  })
})

describe('the scan equals the brute force', () => {
  it('property: 200 typed tables from a tiny alphabet, random join, smoothing and overrides (including stale ones)', () => {
    const sounds = ['a', 'b', 'ab', 'ba', 'aa', E_ACUTE, E_NFD, 'A']
    const names = ['Aa', 'Ab', 'Ba', 'Aba', 'Aab', 'Abab', 'Xyz', E_CAPITAL + 'a', E_CAPITAL_NFD + 'a']
    const tables = fc.integer({ min: 2, max: 150 }).chain(half => {
      const base = half * 2
      const count = (base * (base - 1)) / 2
      return fc.record({
        base: fc.constant(base),
        sounds: fc.array(fc.constantFrom(...sounds), { minLength: base, maxLength: base }),
        join: fc.constantFrom(...JOINS),
        smoothing: fc.constantFrom(...SMOOTHINGS),
        overrides: fc.array(fc.tuple(fc.integer({ min: 0, max: count + 5 }), fc.constantFrom(...names)), { maxLength: 30 }),
      })
    })
    let withGroups = 0
    fc.assert(
      fc.property(tables, t => {
        const naming = typed(t.base, t.sounds, t.join, t.smoothing, new Map(t.overrides))
        expect(createCollisionJob(naming, null).certified).toBe(false)
        const got = run(naming, null)
        expect(got).toEqual(bruteForce(naming, null))
        if (got.groups > 0) withGroups++
      }),
      { seed: SEED, numRuns: 200 },
    )
    expect(withGroups).toBeGreaterThan(150) // the property is not vacuous
  })

  it('property: a ccru preset whose names collide with each other, with derived names and with overrides', () => {
    const sounds = ['a', 'b', 'ab', 'ba', 'aa', 'bb', 'abb', 'baa', 'bab', 'aab']
    const names = ['Alpha', 'Beta', 'Ba', 'Ab', 'Aa', 'Baa', 'Abb']
    fc.assert(
      fc.property(
        fc.record({
          sounds: fc.array(fc.constantFrom(...sounds), { minLength: 10, maxLength: 10 }),
          join: fc.constantFrom(...JOINS),
          smoothing: fc.constantFrom(...SMOOTHINGS),
          presetNames: fc.array(fc.tuple(fc.integer({ min: 0, max: 44 }), fc.constantFrom(...names)), { maxLength: 20 }),
          overrides: fc.array(fc.tuple(fc.integer({ min: 0, max: 44 }), fc.constantFrom(...names)), { maxLength: 10 }),
        }),
        t => {
          const preset: NamingPreset = { id: 'ccru', base: 10, sounds: t.sounds, names: Object.fromEntries(t.presetNames) }
          const naming: Naming = {
            ...createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset }),
            join: t.join,
            smoothing: t.smoothing,
            overrides: new Map(t.overrides),
          }
          expect(createCollisionJob(naming, preset).certified).toBe(false)
          expect(run(naming, preset)).toEqual(bruteForce(naming, preset))
        },
      ),
      { seed: SEED, numRuns: 100 },
    )
  })

  it('reports a preset name that equals another demon derived name and an override that equals a preset name', () => {
    const preset: NamingPreset = {
      id: 'ccru',
      base: 10,
      sounds: ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh', 'qi', 'qj'],
      names: { 0: 'Alpha', 44: 'Alpha', 5: 'Beta', 10: 'Qcqa' },
    }
    // hi-lo derived name of demon 1 = zone 2 then zone 0 = 'qc' + 'qa'
    const naming: Naming = {
      ...createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset }),
      overrides: new Map([[7, 'Beta']]),
    }
    expect(createNameResolver(naming, preset).nameOf(2, 0)).toBe('Qcqa')
    const got = run(naming, preset)
    expect(got).toEqual({
      groups: 3,
      demons: 6,
      list: [
        { name: 'Alpha', size: 2, meshes: [0, 44] },
        { name: 'Qcqa', size: 2, meshes: [1, 10] },
        { name: 'Beta', size: 2, meshes: [5, 7] },
      ],
    })
    expect(got).toEqual(bruteForce(naming, preset))
  })

  it('reports sounds whose joins differ only by NFC as the same name', () => {
    // zones: 0 precomposed, 1 decomposed, 2 x, 3 y. Demons 2::0 and 2::1 are 'x' + the same letter, and so are 3::0 and 3::1.
    const naming = typed(4, [E_ACUTE, E_NFD, 'x', 'y'])
    expect(run(naming, null)).toEqual({
      groups: 2,
      demons: 4,
      list: [
        { name: 'X' + E_ACUTE, size: 2, meshes: [1, 2] },
        { name: 'Y' + E_ACUTE, size: 2, meshes: [3, 4] },
      ],
    })
  })

  it('treats case as significant in the scan too (Ab and AB are different names)', () => {
    // zones: 0 'a', 1 'b', 2 'A', 3 'B', hi-lo, only demon 1::0 'ba' -> 'Ba' and 3::2 'BA'
    const naming = typed(4, ['a', 'b', 'A', 'B'])
    expect(run(naming, null)).toEqual(bruteForce(naming, null))
  })

  it('does not report hash false positives: 319,600 distinct names in one first-letter partition, 0 collisions', () => {
    // every sound is 'k' + three letters, so every name starts with K (one partition) and the 29-bit hash alone would
    // nominate dozens of equal-hash pairs; only the exact comparison of the real names may decide.
    const base = 800
    const sounds = Array.from({ length: base }, (_, z) => 'k' + lettersOf(z).padStart(3, 'a'))
    const naming = typed(base, sounds)
    expect(provablyUnique(sounds, 0)).toBe(true)
    const forced = forceScan(naming)
    expect(createCollisionJob(forced.naming, forced.preset).certified).toBe(false)
    expect(run(forced.naming, forced.preset)).toEqual(NONE)
    // and two real groups among them are still found
    const withTwo = forceScan({ ...naming, overrides: new Map([[5, 'Zed'], [90000, 'Zed'], [7, 'Quux'], [8, 'Quux'], [12345, 'Quux']]) })
    expect(run(withTwo.naming, withTwo.preset)).toEqual({
      groups: 2,
      demons: 5,
      list: [
        { name: 'Zed', size: 2, meshes: [5, 90000] },
        { name: 'Quux', size: 3, meshes: [7, 8, 12345] },
      ],
    })
  })
})

describe('the certificate equals the full scan', () => {
  it('property: generated tables at 28, 64 and 300, every style, join and smoothing, with 0..30 overrides', () => {
    const cases = fc.record({
      base: fc.constantFrom(28, 64, 300),
      style: fc.constantFrom<StyleId>(...STYLE_IDS),
      join: fc.constantFrom(...JOINS),
      smoothing: fc.constantFrom(...SMOOTHINGS),
      seed: fc.constantFrom('ccrug', 'hollow-vector'),
      ops: fc.array(fc.record({ mesh: fc.nat(), kind: fc.integer({ min: 0, max: 3 }), aux: fc.nat() }), { maxLength: 30 }),
    })
    let withGroups = 0
    fc.assert(
      fc.property(cases, c => {
        const base = createNaming({ base: c.base, interactiveMaxN: CEILING, seed: c.seed, style: c.style, join: c.join, smoothing: c.smoothing })
        const count = (c.base * (c.base - 1)) / 2
        const derived = createNameResolver(base, null)
        const derivedName = (mesh: number): string => {
          const a = Math.floor((1 + Math.sqrt(8 * mesh + 1)) / 2)
          return derived.ruleNameOf(a, mesh - (a * (a - 1)) / 2, c.smoothing)
        }
        const overrides = new Map<number, string>()
        const texts: string[] = []
        for (const op of c.ops) {
          const mesh = op.mesh % count
          let text: string
          if (op.kind === 0) text = derivedName(op.aux % count) // another demon's derived name (or its own)
          else if (op.kind === 1) text = texts.length > 0 ? (texts[op.aux % texts.length] as string) : 'Zq' // equal to an earlier override
          else if (op.kind === 2) text = 'Q' + lettersOf(op.aux) // most likely a name nobody has
          else text = derivedName(mesh) // its own derived name
          texts.push(text)
          overrides.set(mesh, text)
        }
        const naming: Naming = { ...base, overrides }
        const job = createCollisionJob(naming, null)
        expect(job.certified).toBe(true)
        const certified = job.step(() => true)
        const forced = forceScan(naming)
        expect(createCollisionJob(forced.naming, forced.preset).certified).toBe(false)
        const scanned = run(forced.naming, forced.preset)
        expect(certified).toEqual(scanned)
        expect(certified).toEqual(bruteForce(naming, null))
        if (scanned.groups > 0) withGroups++
      }),
      { seed: SEED, numRuns: 80 },
    )
    expect(withGroups).toBeGreaterThan(20)
  })
})

describe('bounded output with exact counts', () => {
  it('all 200 sounds equal: one group of 19,900 demons, 16 meshes listed', () => {
    const naming = typed(200, new Array<string>(200).fill('a'))
    const got = run(naming, null)
    expect(got.groups).toBe(1)
    expect(got.demons).toBe(19900)
    expect(got.list).toHaveLength(1)
    const group = got.list[0] as CollisionGroup
    expect(group.name).toBe('Aa')
    expect(group.size).toBe(19900)
    expect(group.meshes).toHaveLength(COLLISION_GROUP_MESHES_MAX)
    expect([...group.meshes]).toEqual(Array.from({ length: 16 }, (_, i) => i))
  })

  it('keeps the 2,000 groups with the lowest meshes of 2,475, in mesh order, on both paths', () => {
    // base 100: 4,950 demons, every one overridden in pairs (2k, 2k + 1) with a name whose first letter varies, so the
    // first-letter order of a partitioned scan differs from the mesh order of the report. Inserted in descending order.
    const pairs = 2475
    const overrides = new Map<number, string>()
    for (let k = pairs - 1; k >= 0; k--) {
      const name = String.fromCharCode(65 + ((k * 7) % 26)) + lettersOf(k)
      overrides.set(2 * k + 1, name)
      overrides.set(2 * k, name)
    }
    const base = createNaming({ base: 100, interactiveMaxN: CEILING })
    const naming: Naming = { ...base, overrides }
    const expected = bruteForce(naming, null)
    expect(expected.groups).toBe(pairs)
    expect(expected.demons).toBe(2 * pairs)
    expect(expected.list).toHaveLength(COLLISION_GROUPS_MAX)

    const certified = createCollisionJob(naming, null)
    expect(certified.certified).toBe(true)
    expect(certified.step(() => false)).toEqual(expected)
    const forced = forceScan(naming)
    expect(run(forced.naming, forced.preset)).toEqual(expected)

    const got = run(forced.naming, forced.preset)
    expect(got.list.map(g => g.meshes[0])).toEqual(Array.from({ length: COLLISION_GROUPS_MAX }, (_, i) => 2 * i))
  })
})

describe('the resumable job', () => {
  const sounds = ['a', 'b', 'ab', 'ba', 'aa', E_ACUTE, E_NFD, 'A']
  const table300 = Array.from({ length: 300 }, (_, z) => sounds[(z * 7 + (z >> 3)) % sounds.length] as string)

  it('yielding at every check gives the same report as running to completion, in more than one step', () => {
    const naming = typed(300, table300, 'hi-lo', 1, new Map([[40, 'Aab'], [41, 'Aab']]))
    const job = createCollisionJob(naming, null)
    expect(job.certified).toBe(false)
    let steps = 0
    let report: CollisionReport | null = null
    while (report === null) {
      report = job.step(() => true)
      steps++
      if (steps > 100000) throw new Error('the job does not make progress')
    }
    expect(steps).toBeGreaterThan(1)
    expect(report).toEqual(findCollisions(naming, null))
    expect(report).toEqual(bruteForce(naming, null))
    expect(job.step(() => true)).toBe(report) // finished: the same report every time
  })

  it('property: every yield pattern gives the same report', () => {
    const naming = typed(120, table300.slice(0, 120), 'lo-hi', 0, new Map([[5, 'Ba'], [6, 'Ba']]))
    const expected = bruteForce(naming, null)
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 0, max: 8 }), (every, offset) => {
        const job = createCollisionJob(naming, null)
        let calls = offset
        let report: CollisionReport | null = null
        let guard = 0
        while (report === null) {
          report = job.step(() => ++calls % every === 0)
          if (++guard > 100000) throw new Error('no progress')
        }
        expect(report).toEqual(expected)
      }),
      { seed: SEED, numRuns: 30 },
    )
  })

  it('a certified job is finished in its first step even when asked to yield', () => {
    const naming = createNaming({ base: 300, interactiveMaxN: CEILING })
    const job = createCollisionJob(naming, null)
    expect(job.certified).toBe(true)
    const first = job.step(() => true)
    expect(first).toEqual(NONE)
    expect(job.step(() => true)).toBe(first)
  })
})

describe('refusals', () => {
  it('createCollisionJob of a seed-only naming throws RangeError', () => {
    const seedOnly = createNaming({ base: CEILING + 2, interactiveMaxN: CEILING })
    expect(seedOnly.sounds).toBeNull()
    expect(() => createCollisionJob(seedOnly, null)).toThrow(RangeError)
    expect(() => findCollisions(seedOnly, null)).toThrow(RangeError)
  })

  it('refuses a scan above COLLISION_SCAN_MAX_N but still certifies a generated table there', () => {
    const base = COLLISION_SCAN_MAX_N + 2
    const generated = createNaming({ base, interactiveMaxN: base })
    expect(generated.sounds).not.toBeNull()
    const sounds = generated.sounds as readonly string[]
    // a typed table (a duplicate) cannot be certified, so it would need the scan
    const dup = sounds.slice()
    dup[0] = sounds[1] as string
    expect(() => createCollisionJob({ ...generated, sounds: dup }, null)).toThrow(RangeError)
    // a ccru naming with a preset must be scanned as well
    const forced = forceScan(generated)
    expect(() => createCollisionJob(forced.naming, forced.preset)).toThrow(RangeError)
    // the generated table gets its answer from the certificate, with no cap
    const job = createCollisionJob(generated, null)
    expect(job.certified).toBe(true)
    expect(job.step(() => false)).toEqual(NONE)
    // with a few overrides it is still instant and exact
    const withOverrides: Naming = { ...generated, overrides: new Map([[1, 'Same'], [4000000, 'Same']]) }
    expect(run(withOverrides, null)).toEqual({ groups: 1, demons: 2, list: [{ name: 'Same', size: 2, meshes: [1, 4000000] }] })
  })
})

describe('exhaustive: generated tables have no collisions, by the full scan and by the certificate', () => {
  const cases: Array<[number, StyleId, JoinOrder, Smoothing]> = []
  for (const base of [666, 1024]) {
    for (const style of STYLE_IDS) {
      for (const join of JOINS) for (const smoothing of SMOOTHINGS) cases.push([base, style, join, smoothing])
    }
  }

  it.each(cases)('base %i, %s, %s, smoothing %i: 0 collisions in the scan and in the certificate', (base, style, join, smoothing) => {
    const naming = createNaming({ base, interactiveMaxN: CEILING, style, join, smoothing })
    const forced = forceScan(naming)
    const scan = createCollisionJob(forced.naming, forced.preset)
    expect(scan.certified).toBe(false)
    let report: CollisionReport | null = null
    while (report === null) report = scan.step(() => false)
    expect(report).toEqual(NONE)
    const cert = createCollisionJob(naming, null)
    expect(cert.certified).toBe(true)
    expect(cert.step(() => false)).toEqual(NONE)
  })

  it('base 4000, harsh, raw, hi-lo: 0 collisions in the full scan of 7,998,000 demons', () => {
    const naming = createNaming({ base: 4000, interactiveMaxN: CEILING })
    expect(naming.style).toBe('harsh')
    expect(naming.join).toBe('hi-lo')
    expect(naming.smoothing).toBe(0)
    const forced = forceScan(naming)
    const scan = createCollisionJob(forced.naming, forced.preset)
    expect(scan.certified).toBe(false)
    let report: CollisionReport | null = null
    while (report === null) report = scan.step(() => false)
    expect(report).toEqual(NONE)
    expect(createCollisionJob(naming, null).step(() => false)).toEqual(NONE)
  }, 120_000)
})
