// NAM-03 the versioned naming file `ccrug.naming/1` (plan 07-08, 07-RESEARCH Pattern 6). Part 1: the constants and the
// deterministic serializer. Part 2: the all-or-nothing, never-throwing, prototype-safe reader (Pitfalls 10 and 17), the typed
// issues behind every import error, and the export -> import identity.
// Everything here is built from definitions and neutral made-up texts: no CCRU sound or name appears, and no generated sound is
// pinned (the banks have their own signed-off vectors in naming.vectors.test.ts). The CCRU preset is a SYNTHETIC test preset.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { STYLE_IDS } from '../naming/banks'
import { createNaming } from '../naming/derive'
import { editSound, setOverride, toggleLock } from '../naming/edit'
import { GENERATOR_ID, createGenerator, generateSounds } from '../naming/generate'
import { PRNG_ALGO } from '../naming/prng'
import {
  ISSUES_MAX,
  META_MAX_LENGTH,
  NAMING_IMPORT_MAX_BYTES,
  NAMING_MAX_OVERRIDES,
  SCHEMA_ID,
  SCHEMA_PREFIX,
  UNKNOWN_KEYS_MAX,
  serializeNaming,
} from '../naming/schema'
import { normalizeSeed } from '../naming/text'
import { JOIN_ORDERS } from '../naming/types'
import type { Naming, NamingPreset, Smoothing } from '../naming/types'
import { validateNamingJson } from '../naming/validate'
import type { NamingImport, ValidateNamingOptions } from '../naming/validate'
import * as engine from '../index'

const CEILING = 4000

const n28 = (): Naming => createNaming({ base: 28, interactiveMaxN: CEILING })

/** A letters-only name for index k, distinct for distinct k (lowercase, so it never equals a capitalised generated name). */
function letters(k: number): string {
  return `q${String.fromCharCode(97 + (k % 26))}${String.fromCharCode(97 + (Math.floor(k / 26) % 26))}${String.fromCharCode(97 + (Math.floor(k / 676) % 26))}`
}

describe('schema constants', () => {
  it('names the version and the data caps', () => {
    expect(SCHEMA_ID).toBe('ccrug.naming/1')
    expect(SCHEMA_PREFIX).toBe('ccrug.naming/')
    expect(SCHEMA_ID.startsWith(SCHEMA_PREFIX)).toBe(true)
    expect(NAMING_IMPORT_MAX_BYTES).toBe(8388608)
    expect(NAMING_MAX_OVERRIDES).toBe(250000)
    expect(META_MAX_LENGTH).toBe(200)
    expect(ISSUES_MAX).toBe(5)
    expect(UNKNOWN_KEYS_MAX).toBe(5)
  })
})

describe('serializeNaming', () => {
  it('writes a dense naming with the keys in the fixed order and the generator block first-class', () => {
    const n = n28()
    const obj = JSON.parse(serializeNaming(n)) as Record<string, unknown>
    expect(Object.keys(obj)).toEqual(['schema', 'base', 'source', 'generator', 'join', 'zones', 'locks', 'overrides'])
    expect(obj.schema).toBe('ccrug.naming/1')
    expect(obj.base).toBe(28)
    expect(obj.source).toBe('generated')
    const generator = obj.generator as Record<string, unknown>
    expect(Object.keys(generator)).toEqual(['prng', 'gen', 'seed', 'style'])
    expect(generator).toEqual({ prng: PRNG_ALGO, gen: GENERATOR_ID, seed: n.seed, style: n.style })
    const join = obj.join as Record<string, unknown>
    expect(Object.keys(join)).toEqual(['order', 'smoothing'])
    expect(join).toEqual({ order: n.join, smoothing: n.smoothing })
    expect(obj.zones).toEqual([...(n.sounds as readonly string[])])
    expect(obj.locks).toEqual([])
    expect(obj.overrides).toEqual({})
    expect('meta' in obj).toBe(false)
  })

  it('writes the meta block last when there is one, and omits it when there is none', () => {
    const n: Naming = { ...n28(), meta: { title: 'A title', notes: 'Some notes' } }
    const obj = JSON.parse(serializeNaming(n)) as Record<string, unknown>
    expect(Object.keys(obj)).toEqual(['schema', 'base', 'source', 'generator', 'join', 'zones', 'locks', 'overrides', 'meta'])
    expect(obj.meta).toEqual({ title: 'A title', notes: 'Some notes' })
    expect(Object.keys(obj.meta as object)).toEqual(['title', 'notes'])
  })

  it('is deterministic: the same naming gives identical bytes, and there is no timestamp', () => {
    const n = n28()
    const a = serializeNaming(n)
    const b = serializeNaming(n)
    expect(a).toBe(b)
    expect(serializeNaming(n, { pretty: true })).toBe(serializeNaming(n, { pretty: true }))
    expect(a).not.toMatch(/\b(date|time|stamp|created|modified)/i)
    // an equal naming built separately gives the same bytes too
    expect(serializeNaming(n28())).toBe(a)
  })

  it('writes override keys ascending whatever the insertion order', () => {
    let n = n28()
    for (const mesh of [300, 5, 44]) n = setOverride(n, mesh, letters(mesh), null)
    expect([...n.overrides.keys()]).toEqual([300, 5, 44]) // insertion order is not ascending
    const text = serializeNaming(n)
    const obj = JSON.parse(text) as { overrides: Record<string, string> }
    expect(Object.keys(obj.overrides)).toEqual(['5', '44', '300'])
    expect(text.indexOf('"5":')).toBeLessThan(text.indexOf('"44":'))
    expect(text.indexOf('"44":')).toBeLessThan(text.indexOf('"300":'))
  })

  it('writes override keys ascending even above 2^32, where an object keeps insertion order for its keys', () => {
    // a base this large is only reachable with a huge ceiling; the meshes below are not array-index keys, so only an explicit
    // sort puts them in ascending order in the text
    const base = 100000
    const big = createNaming({ base, interactiveMaxN: 200000 })
    const high = 4500000000
    const low = 4400000000
    expect(high).toBeLessThan((base * (base - 1)) / 2)
    const n: Naming = { ...big, overrides: new Map([[high, 'Hia'], [low, 'Loa'], [7, 'Sev']]) }
    const text = serializeNaming(n)
    expect(text.indexOf('"7":')).toBeLessThan(text.indexOf(`"${low}":`))
    expect(text.indexOf(`"${low}":`)).toBeLessThan(text.indexOf(`"${high}":`))
  })

  it('writes locks sorted ascending and leaves the naming untouched', () => {
    let n = n28()
    for (const z of [20, 3, 11, 0]) n = toggleLock(n, z)
    const before = [...n.locks]
    const obj = JSON.parse(serializeNaming(n)) as { locks: number[] }
    expect(obj.locks).toEqual([0, 3, 11, 20])
    expect([...n.locks]).toEqual(before) // the Set was not sorted in place
  })

  it('keeps typed sounds, locks and overrides together in the file', () => {
    let n = editSound(n28(), 2, 'Bq')
    n = setOverride(n, 44, 'Zed', null)
    const obj = JSON.parse(serializeNaming(n)) as { zones: string[]; locks: number[]; overrides: Record<string, string> }
    expect(obj.zones[2]).toBe('Bq')
    expect(obj.locks).toEqual([2])
    expect(obj.overrides).toEqual({ '44': 'Zed' })
  })

  it('writes a seed-only naming without zones, locks and overrides', () => {
    const n = createNaming({ base: 4002, interactiveMaxN: CEILING })
    expect(n.sounds).toBeNull()
    const text = serializeNaming(n)
    const obj = JSON.parse(text) as Record<string, unknown>
    expect(Object.keys(obj)).toEqual(['schema', 'base', 'source', 'generator', 'join'])
    expect(obj.base).toBe(4002)
    expect(text.length).toBeLessThan(400)
  })

  it('pretty output is the compact JSON re-indented with two spaces and a final newline', () => {
    let n = n28()
    n = toggleLock(n, 4)
    n = setOverride(n, 9, 'Zed', null)
    const compact = serializeNaming(n)
    const pretty = serializeNaming(n, { pretty: true })
    expect(pretty).toBe(JSON.stringify(JSON.parse(compact), null, 2) + '\n')
    expect(pretty.endsWith('}\n')).toBe(true)
    expect(compact.endsWith('\n')).toBe(false)
    expect(compact).not.toContain('\n')
    expect(serializeNaming(n, { pretty: false })).toBe(compact)
  })

  it('a base-4000 naming with 400 locks and 1000 overrides stays under 60,000 bytes compact', () => {
    let n = createNaming({ base: 4000, interactiveMaxN: CEILING })
    for (let z = 0; z < 400; z++) n = toggleLock(n, z * 10)
    for (let i = 0; i < 1000; i++) n = setOverride(n, 7 * i + 3, letters(i), null)
    expect(n.locks.size).toBe(400)
    expect(n.overrides.size).toBe(1000)
    const text = serializeNaming(n)
    expect(text.length).toBeLessThan(60000)
    expect(text.length).toBeGreaterThan(40000) // the zones are really there
  })
})

// ---------------------------------------------------------------------------------------------------------------------------
// validateNamingJson
// ---------------------------------------------------------------------------------------------------------------------------

type Doc = Record<string, unknown>

const SYNTHETIC: NamingPreset = {
  id: 'ccru',
  base: 10,
  sounds: ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh', 'qi', 'qj'],
  names: { 0: 'Alpha', 44: 'Omega' },
}

const opts = (over: Partial<ValidateNamingOptions> = {}): ValidateNamingOptions => ({
  base: 28,
  interactiveMaxN: CEILING,
  preset: null,
  ...over,
})

/** The file of a naming as a mutable object. */
const docOf = (n: Naming = n28()): Doc => JSON.parse(serializeNaming(n)) as Doc
const sub = (d: Doc, key: string): Doc => d[key] as Doc
const run = (d: Doc | string, over?: Partial<ValidateNamingOptions>): NamingImport =>
  validateNamingJson(typeof d === 'string' ? d : JSON.stringify(d), opts(over))

function refusal(res: NamingImport) {
  if (res.ok) throw new Error(`expected a refusal, got a naming at base ${res.naming.base}`)
  return res
}
function acceptance(res: NamingImport) {
  if (!res.ok) throw new Error(`expected success, got ${JSON.stringify(res.issues)}`)
  return res
}
const kinds = (res: NamingImport): string[] => refusal(res).issues.map(i => i.kind)

/** The file text with top-level fields replaced by raw JSON text, so a hostile key such as __proto__ stays an own key once parsed. */
function withRawFields(fields: ReadonlyArray<readonly [string, string]>, d: Doc = docOf()): string {
  const copy: Doc = { ...d }
  for (const [name] of fields) delete copy[name]
  return `${JSON.stringify(copy).slice(0, -1)}${fields.map(([name, raw]) => `,"${name}":${raw}`).join('')}}`
}
const withRawField = (name: string, rawJson: string, d?: Doc): string => withRawFields([[name, rawJson]], d)

/** A naming as plain data, so two namings compare with toEqual (locks sorted, overrides as sorted entries). */
function plain(n: Naming) {
  return {
    base: n.base,
    source: n.source,
    seed: n.seed,
    style: n.style,
    join: n.join,
    smoothing: n.smoothing,
    sounds: n.sounds === null ? null : [...n.sounds],
    locks: [...n.locks].sort((a, b) => a - b),
    overrides: [...n.overrides].sort((a, b) => a[0] - b[0]),
    meta: n.meta,
  }
}

const protoNames = (): string => Object.getOwnPropertyNames(Object.prototype).sort().join(',')

describe('validateNamingJson: export -> import is the identity', () => {
  const LETTER_RANGES: ReadonlyArray<readonly [number, number]> = [
    [97, 122], // Latin
    [65, 90],
    [0x3b1, 0x3c9], // Greek
    [0x430, 0x44f], // Cyrillic
    [0x3041, 0x3093], // Hiragana
    [0x4e00, 0x4e40], // CJK
  ]
  const letterArb = fc.oneof(
    ...LETTER_RANGES.map(([lo, hi]) => fc.integer({ min: lo, max: hi }).map(c => String.fromCodePoint(c))),
    fc.constantFrom('कि', 'का'), // Devanagari letter + vowel sign (a letter with a mark)
  )
  const soundArb = fc.array(letterArb, { minLength: 1, maxLength: 5 }).map(a => a.join(''))
  const nameArb = fc.array(letterArb, { minLength: 1, maxLength: 10 }).map(a => a.join(''))
  const seedArb = fc
    .oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ unit: 'binary', minLength: 1, maxLength: 12 }))
    .filter(s => normalizeSeed(s) !== null)

  function namingArb(base: number): fc.Arbitrary<Naming> {
    const meshes = (base * (base - 1)) / 2
    return fc
      .record({
        seed: seedArb,
        style: fc.constantFrom(...STYLE_IDS),
        join: fc.constantFrom(...JOIN_ORDERS),
        smoothing: fc.constantFrom<Smoothing>(0, 1),
        typed: fc.array(fc.tuple(fc.integer({ min: 0, max: base - 1 }), soundArb), { maxLength: 10 }),
        toggled: fc.array(fc.integer({ min: 0, max: base - 1 }), { maxLength: 8 }),
        named: fc.array(fc.tuple(fc.integer({ min: 0, max: meshes - 1 }), nameArb), { maxLength: 10 }),
        meta: fc.option(fc.record({ title: fc.string({ maxLength: 40 }), notes: fc.string({ maxLength: 40 }) }), { nil: null }),
      })
      .map(r => {
        let n = createNaming({ base, interactiveMaxN: CEILING, seed: r.seed, style: r.style, join: r.join, smoothing: r.smoothing })
        for (const [zone, sound] of r.typed) n = editSound(n, zone, sound)
        for (const zone of r.toggled) n = toggleLock(n, zone)
        for (const [mesh, name] of r.named) n = setOverride(n, mesh, name, null)
        return { ...n, meta: r.meta }
      })
  }

  function expectIdentity(n: Naming, over: Partial<ValidateNamingOptions>): void {
    const o = opts({ base: n.base, ...over })
    for (const text of [serializeNaming(n), serializeNaming(n, { pretty: true })]) {
      const res = acceptance(validateNamingJson(text, o))
      expect(plain(res.naming)).toEqual(plain(n))
      expect(res.unknownKeys).toEqual([])
      expect(res.unknownKeyCount).toBe(0)
      expect(res.naming.locks).toBeInstanceOf(Set)
      expect(res.naming.overrides).toBeInstanceOf(Map)
      expect(Object.isFrozen(res.naming)).toBe(true)
    }
  }

  it('holds for 300 random namings at base 28 (random seeds, styles, joins, smoothing, typed sounds, locks, overrides, meta)', () => {
    fc.assert(
      fc.property(namingArb(28), n => {
        expectIdentity(n, {})
      }),
      { seed: 20261109, numRuns: 300 },
    )
  })

  it('holds for 50 random namings at base 666', () => {
    fc.assert(
      fc.property(namingArb(666), n => {
        expectIdentity(n, {})
      }),
      { seed: 20261110, numRuns: 50 },
    )
  })

  it('holds for seed-only namings at base 4002 with the ceiling at 4000', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom(...STYLE_IDS), fc.constantFrom(...JOIN_ORDERS), fc.constantFrom<Smoothing>(0, 1), (seed, style, join, smoothing) => {
        const n = createNaming({ base: 4002, interactiveMaxN: CEILING, seed, style, join, smoothing })
        expect(n.sounds).toBeNull()
        expectIdentity(n, {})
        const res = acceptance(validateNamingJson(serializeNaming(n), opts({ base: 4002 })))
        expect(res.naming.sounds).toBeNull()
        expect(res.naming.locks.size).toBe(0)
        expect(res.naming.overrides.size).toBe(0)
      }),
      { seed: 20261111, numRuns: 50 },
    )
  })

  it('holds for a ccru naming with a synthetic preset (edited sound, lock, override)', () => {
    let n = createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC })
    n = editSound(n, 2, 'Zq')
    n = setOverride(n, 5, 'Zed', SYNTHETIC)
    expect(n.source).toBe('ccru')
    expectIdentity(n, { preset: SYNTHETIC })
  })

  it('holds at a base on the ceiling and keeps override meshes above 2^32 (an object would not order them)', () => {
    const edge = createNaming({ base: CEILING, interactiveMaxN: CEILING })
    expect(edge.sounds).not.toBeNull()
    expectIdentity(edge, {})
    const big = createNaming({ base: 100000, interactiveMaxN: 200000 })
    const n: Naming = { ...big, overrides: new Map([[4500000000, 'Hia'], [4400000000, 'Loa'], [7, 'Sev']]) }
    expectIdentity(n, { interactiveMaxN: 200000 })
  })

  it('export, import, export gives the same bytes', () => {
    let n = n28()
    n = toggleLock(n, 6)
    n = setOverride(n, 100, 'Zed', null)
    const text = serializeNaming(n)
    expect(serializeNaming(acceptance(run(text)).naming)).toBe(text)
  })
})

describe('validateNamingJson: not a names file', () => {
  it('refuses text over the size cap before parsing', () => {
    const res = refusal(validateNamingJson('x'.repeat(100), opts({ maxBytes: 50 })))
    expect(res.issues).toEqual([{ kind: 'too-large', maxBytes: 50 }])
    expect(res.issueCount).toBe(1)
    expect(res.offerSeed).toBeNull()
  })

  it('the cap is inclusive: a file of exactly maxBytes is read, one more is too large', () => {
    const text = serializeNaming(n28())
    expect(validateNamingJson(text, opts({ maxBytes: text.length })).ok).toBe(true)
    expect(kinds(validateNamingJson(text, opts({ maxBytes: text.length - 1 })))).toEqual(['too-large'])
  })

  it('the default cap is NAMING_IMPORT_MAX_BYTES', () => {
    const res = refusal(validateNamingJson('a'.repeat(NAMING_IMPORT_MAX_BYTES + 1), opts()))
    expect(res.issues).toEqual([{ kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES }])
    // under the cap the text is parsed (and is simply not JSON)
    expect(kinds(validateNamingJson('a'.repeat(NAMING_IMPORT_MAX_BYTES), opts()))).toEqual(['not-json'])
  })

  it.each(['not json', '', '{', '{"a":1,}', "{'a':1}", 'undefined', '{"schema":"ccrug.naming/1"'])('%j is not json', text => {
    const res = refusal(validateNamingJson(text, opts()))
    expect(res.issues).toEqual([{ kind: 'not-json' }])
    expect(res.issueCount).toBe(1)
    expect(res.offerSeed).toBeNull()
  })

  it.each(['[]', '42', 'null', '"text"', 'true', '{}', '[{"schema":"ccrug.naming/1"}]', '{"schema":3}', '{"schema":"other/1"}', '{"schema":"ccrug.naming"}', '{"schema":null}'])(
    '%j is not a names file',
    text => {
      const res = refusal(validateNamingJson(text, opts()))
      expect(res.issues).toEqual([{ kind: 'not-names-file' }])
      expect(res.issueCount).toBe(1)
    },
  )

  it('a value that is not text never throws and is not a names file', () => {
    for (const v of [undefined, null, 42, {}, [], true]) {
      const res = refusal(validateNamingJson(v as unknown as string, opts()))
      expect(res.issues).toEqual([{ kind: 'not-names-file' }])
    }
  })
})

describe('validateNamingJson: unknown format versions', () => {
  it('another ccrug.naming version carries its suffix', () => {
    const d = docOf()
    d.schema = 'ccrug.naming/2'
    expect(refusal(run(d)).issues).toEqual([{ kind: 'unknown-version', version: '2' }])
    d.schema = 'ccrug.naming/'
    expect(refusal(run(d)).issues).toEqual([{ kind: 'unknown-version', version: '' }])
    d.schema = `ccrug.naming/${'9'.repeat(500)}`
    const res = refusal(run(d))
    expect(res.issues).toHaveLength(1)
    const issue = res.issues[0] as { kind: string; version: string }
    expect(issue.kind).toBe('unknown-version')
    expect(issue.version.length).toBeLessThanOrEqual(40)
    expect(issue.version.startsWith('9999')).toBe(true)
  })

  it('an unknown generator id is refused as an unknown version carrying that id', () => {
    const d = docOf()
    sub(d, 'generator').gen = 'names-gen@2'
    expect(refusal(run(d)).issues).toEqual([{ kind: 'unknown-version', version: 'names-gen@2' }])
    const e = docOf()
    sub(e, 'generator').prng = 'sfc32-cyrb128@2'
    expect(refusal(run(e)).issues).toEqual([{ kind: 'unknown-version', version: 'sfc32-cyrb128@2' }])
  })

  it('a join.smoothing above the euphony version is an unknown version euphony@{v}', () => {
    for (const v of [2, 7, 100]) {
      const d = docOf()
      sub(d, 'join').smoothing = v
      expect(refusal(run(d)).issues).toEqual([{ kind: 'unknown-version', version: `euphony@${v}` }])
    }
  })

  it('any other non-0/1 smoothing is a bad field', () => {
    for (const v of [-1, 1.5, '1', true, null, [], {}, 0.5]) {
      const d = docOf()
      sub(d, 'join').smoothing = v
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'join.smoothing' }])
    }
    const missing = docOf()
    delete sub(missing, 'join').smoothing
    expect(refusal(run(missing)).issues).toEqual([{ kind: 'bad-field', path: 'join.smoothing' }])
  })

  it('an unknown version is refused alone: nothing else about the file is reported', () => {
    const d = docOf()
    sub(d, 'generator').gen = 'names-gen@2'
    d.zones = ['only', 'one']
    d.locks = 'bad'
    expect(refusal(run(d)).issues).toEqual([{ kind: 'unknown-version', version: 'names-gen@2' }])
  })

  it('a missing or non-string generator id is a bad field, not an unknown version', () => {
    const d = docOf()
    delete sub(d, 'generator').prng
    sub(d, 'generator').gen = 5
    expect(refusal(run(d)).issues).toEqual([
      { kind: 'bad-field', path: 'generator.prng' },
      { kind: 'bad-field', path: 'generator.gen' },
    ])
  })
})

describe('validateNamingJson: base', () => {
  it.each([['x'], [27], [0], [-2], [1.5], [null], [undefined], [2 ** 27], [Number.MAX_SAFE_INTEGER], [true], [[28]]])('base %j is a bad field', base => {
    const d = docOf()
    d.base = base
    if (base === undefined) delete d.base
    const res = refusal(run(d))
    expect(res.issues).toEqual([{ kind: 'bad-field', path: 'base' }])
    expect(res.offerSeed).toBeNull()
  })

  it('a file for another base is refused with the file base and a seed offer', () => {
    const other = createNaming({ base: 28, interactiveMaxN: CEILING, seed: 'hollow-vector', style: 'soft', join: 'lo-hi', smoothing: 1 })
    const res = refusal(validateNamingJson(serializeNaming(other), opts({ base: 30 })))
    expect(res.issues).toEqual([{ kind: 'wrong-base', fileBase: 28 }])
    expect(res.issueCount).toBe(1)
    expect(res.offerSeed).toEqual({ seed: 'hollow-vector', style: 'soft', join: 'lo-hi', smoothing: 1 })
  })

  it('the seed offer reads a seed-only file and a ccru file as well', () => {
    const seedOnly = createNaming({ base: 4002, interactiveMaxN: CEILING, seed: 'sv' })
    expect(refusal(validateNamingJson(serializeNaming(seedOnly), opts({ base: 28 }))).offerSeed).toEqual({
      seed: 'sv',
      style: seedOnly.style,
      join: 'hi-lo',
      smoothing: 0,
    })
    const ccru = createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC })
    const res = refusal(validateNamingJson(serializeNaming(ccru), opts({ base: 28 })))
    expect(res.issues).toEqual([{ kind: 'wrong-base', fileBase: 10 }])
    expect(res.offerSeed).not.toBeNull()
  })

  it('the seed offer is normalised like a seed (NFC, trimmed)', () => {
    const d = docOf()
    d.base = 30
    sub(d, 'generator').seed = '  café  '
    expect(refusal(run(d)).offerSeed).toEqual({ seed: 'café', style: 'harsh', join: 'hi-lo', smoothing: 0 })
  })

  it('there is no offer when the file carries no valid seed record', () => {
    const cases: Array<(g: Doc, j: Doc) => void> = [
      g => { g.seed = '' },
      g => { g.seed = 'x'.repeat(65) },
      g => { g.seed = 'a\nb' },
      g => { g.seed = 7 },
      g => { delete g.seed },
      g => { g.style = 'loud' },
      g => { delete g.style },
      g => { g.gen = 'names-gen@2' },
      g => { g.prng = 'other@1' },
      (_g, j) => { j.order = 'sideways' },
      (_g, j) => { j.smoothing = 2 },
      (_g, j) => { j.smoothing = '1' },
    ]
    for (const mutate of cases) {
      const d = docOf()
      d.base = 30
      mutate(sub(d, 'generator'), sub(d, 'join'))
      const res = refusal(run(d))
      expect(res.issues).toEqual([{ kind: 'wrong-base', fileBase: 30 }])
      expect(res.offerSeed).toBeNull()
    }
    const noBlocks = docOf()
    noBlocks.base = 30
    delete noBlocks.generator
    delete noBlocks.join
    expect(refusal(run(noBlocks)).offerSeed).toBeNull()
  })

  it('a wrong-base file is refused alone, whatever else is wrong with it', () => {
    const d = docOf()
    d.base = 30
    d.zones = 'nonsense'
    d.locks = 'nonsense'
    expect(refusal(run(d)).issues).toEqual([{ kind: 'wrong-base', fileBase: 30 }])
  })
})

describe('validateNamingJson: seed-only bases', () => {
  const seedOnlyOpts = { base: 4002 }

  it('a seed-only file is accepted at a seed-only base', () => {
    const d = docOf(createNaming({ base: 4002, interactiveMaxN: CEILING }))
    const res = acceptance(run(d, seedOnlyOpts))
    expect(res.naming.base).toBe(4002)
    expect(res.naming.sounds).toBeNull()
  })

  it.each(['zones', 'locks', 'overrides'])('a file with %s is refused at a seed-only base', key => {
    const d = docOf(createNaming({ base: 4002, interactiveMaxN: CEILING }))
    d[key] = key === 'overrides' ? {} : []
    const res = refusal(run(d, seedOnlyOpts))
    expect(res.issues).toEqual([{ kind: 'seed-only-base' }])
    expect(res.issueCount).toBe(1)
  })

  it('a file with all three is refused once', () => {
    const d = docOf(createNaming({ base: 4002, interactiveMaxN: CEILING }))
    d.zones = ['aa']
    d.locks = [1]
    d.overrides = { '1': 'Zed' }
    expect(refusal(run(d, seedOnlyOpts)).issues).toEqual([{ kind: 'seed-only-base' }])
  })

  it('a dense file for a seed-only base is refused', () => {
    const dense = docOf(createNaming({ base: 4002, interactiveMaxN: 10000 }))
    expect(dense.zones).toBeDefined()
    expect(refusal(run(dense, seedOnlyOpts)).issues).toEqual([{ kind: 'seed-only-base' }])
  })

  it('the ceiling itself is editable: a dense file at base === interactiveMaxN is accepted', () => {
    const edge = createNaming({ base: 4000, interactiveMaxN: 4000 })
    const res = acceptance(validateNamingJson(serializeNaming(edge), opts({ base: 4000, interactiveMaxN: 4000 })))
    expect(res.naming.sounds).toHaveLength(4000)
  })

  it('a dense file one zone pair over the ceiling is refused', () => {
    const over = createNaming({ base: 4002, interactiveMaxN: 4002 })
    expect(kinds(validateNamingJson(serializeNaming(over), opts({ base: 4002, interactiveMaxN: 4000 })))).toEqual(['seed-only-base'])
  })
})

describe('validateNamingJson: generator, source, join', () => {
  it('a missing or non-object generator or join block is a bad field', () => {
    for (const key of ['generator', 'join']) {
      for (const v of [undefined, null, 'x', 5, [], true]) {
        const d = docOf()
        if (v === undefined) delete d[key]
        else d[key] = v
        expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: key }])
      }
    }
  })

  it('a bad seed or style is a bad field', () => {
    for (const seed of ['', '   ', 'x'.repeat(65), 'a\u0000b', 'a b', 5, null, ['a']]) {
      const d = docOf()
      sub(d, 'generator').seed = seed
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'generator.seed' }])
    }
    for (const style of ['loud', '', 5, null, 'HARSH']) {
      const d = docOf()
      sub(d, 'generator').style = style
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'generator.style' }])
    }
  })

  it('a seed with a lone surrogate or a bidi control is a bad field (WR-02, WR-03), and gives no seed offer', () => {
    const lone = 'a' + String.fromCharCode(0xd800) // valid JSON once escaped: "a\ud800"
    for (const seed of [lone, 'ab' + String.fromCharCode(0x202e) + 'cd', String.fromCharCode(0x2066) + 'x']) {
      const d = docOf()
      sub(d, 'generator').seed = seed
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'generator.seed' }])
      const other = docOf()
      other.base = 30
      sub(other, 'generator').seed = seed
      expect(refusal(run(other)).offerSeed).toBeNull()
    }
  })

  it('every known style and both join orders are accepted; the seed is normalised', () => {
    for (const style of STYLE_IDS) {
      for (const order of JOIN_ORDERS) {
        const d = docOf()
        sub(d, 'generator').style = style
        sub(d, 'join').order = order
        const res = acceptance(run(d))
        expect(res.naming.style).toBe(style)
        expect(res.naming.join).toBe(order)
      }
    }
    const d = docOf()
    sub(d, 'generator').seed = '  hollow-vector  '
    expect(acceptance(run(d)).naming.seed).toBe('hollow-vector')
  })

  it('a bad join order is a bad field', () => {
    for (const order of ['sideways', '', 5, null]) {
      const d = docOf()
      sub(d, 'join').order = order
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'join.order' }])
    }
  })

  it('smoothing 0 and 1 are both accepted (and -0 reads as 0)', () => {
    for (const s of [0, 1]) {
      const d = docOf()
      sub(d, 'join').smoothing = s
      expect(acceptance(run(d)).naming.smoothing).toBe(s)
    }
    const text = withRawField('join', '{"order":"hi-lo","smoothing":-0}')
    expect(Object.is(acceptance(run(text)).naming.smoothing, 0)).toBe(true)
  })

  it('source must be generated, or ccru with a preset for this base', () => {
    for (const v of ['other', 'CCRU', 3, null, undefined, ['generated']]) {
      const d = docOf()
      if (v === undefined) delete d.source
      else d.source = v
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'source' }])
    }
    const ccru = docOf()
    ccru.source = 'ccru'
    expect(refusal(run(ccru)).issues).toEqual([{ kind: 'bad-field', path: 'source' }]) // base 28, no preset
    expect(refusal(run(ccru, { preset: SYNTHETIC })).issues).toEqual([{ kind: 'bad-field', path: 'source' }]) // a preset for base 10
  })

  it('source ccru at base 10 with no zones takes the preset sounds', () => {
    const d = docOf(createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC }))
    delete d.zones
    delete d.locks
    const res = acceptance(run(d, { base: 10, preset: SYNTHETIC }))
    expect(res.naming.source).toBe('ccru')
    expect(res.naming.sounds).toEqual(SYNTHETIC.sounds)
    expect(res.naming.sounds).not.toBe(SYNTHETIC.sounds) // a copy: the preset is never shared as the naming's own table
  })

  it('source ccru with zones keeps the zones: they are authoritative', () => {
    const n = editSound(createNaming({ base: 10, interactiveMaxN: CEILING, source: 'ccru', preset: SYNTHETIC }), 3, 'Zq')
    const res = acceptance(run(serializeNaming(n), { base: 10, preset: SYNTHETIC }))
    expect(res.naming.sounds?.[3]).toBe('Zq')
    expect(res.naming.locks.has(3)).toBe(true)
  })
})

describe('validateNamingJson: zones and locks', () => {
  it('zones must be an array with one entry per zone', () => {
    for (const zones of [(docOf().zones as unknown[]).slice(0, 27), [...(docOf().zones as unknown[]), 'extra'], [], 'abc', {}, 5, null]) {
      const d = docOf()
      d.zones = zones
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'zones' }])
    }
  })

  it('collects a bad-sound with the first failing reason for each bad sound', () => {
    const d = docOf()
    const zones = d.zones as unknown[]
    zones[3] = 'g1'
    zones[5] = ''
    zones[7] = 'a b'
    const res = refusal(run(d))
    expect(res.issues).toEqual([
      { kind: 'bad-sound', zone: 3, reason: 'digit' },
      { kind: 'bad-sound', zone: 5, reason: 'empty' },
      { kind: 'bad-sound', zone: 7, reason: 'space' },
    ])
    expect(res.issueCount).toBe(3)
  })

  it('reports reasons other and long, and non-text entries as other', () => {
    const d = docOf()
    const zones = d.zones as unknown[]
    zones[0] = 'ab‮cd' // a bidi override is a format character
    zones[1] = 'a‌b' // ZWNJ
    zones[2] = 'x'.repeat(17)
    zones[3] = 42
    zones[4] = null
    const res = refusal(run(d))
    expect(res.issues).toEqual([
      { kind: 'bad-sound', zone: 0, reason: 'other' },
      { kind: 'bad-sound', zone: 1, reason: 'other' },
      { kind: 'bad-sound', zone: 2, reason: 'long' },
      { kind: 'bad-sound', zone: 3, reason: 'other' },
      { kind: 'bad-sound', zone: 4, reason: 'other' },
    ])
  })

  it('refuses a multi-million-letter sound and name as long (the work is bounded by the limit, see naming.text.test.ts WR-01)', () => {
    const d = docOf()
    ;(d.zones as unknown[])[4] = 'a'.repeat(8_000_000)
    d.overrides = { '7': 'b'.repeat(100_000) }
    const started = Date.now() // logged only: timings are never asserted (T-05-38)
    const res = refusal(run(d))
    console.info(`validateNamingJson on an 8 MB sound: ${Date.now() - started} ms`)
    expect(res.issues).toEqual([
      { kind: 'bad-sound', zone: 4, reason: 'long' },
      { kind: 'bad-override-name', mesh: 7, reason: 'long' },
    ])
  })

  it('keeps 5 issues and counts all 9 bad sounds', () => {
    const d = docOf()
    const zones = d.zones as unknown[]
    for (const z of [1, 4, 6, 8, 10, 12, 14, 16, 18]) zones[z] = 'x1'
    const res = refusal(run(d))
    expect(res.issues).toHaveLength(ISSUES_MAX)
    expect(res.issueCount).toBe(9)
    expect(res.issues.map(i => (i as { zone: number }).zone)).toEqual([1, 4, 6, 8, 10])
  })

  it('accepts sounds in any script, NFC-normalised and trimmed', () => {
    const d = docOf()
    const zones = d.zones as unknown[]
    zones[0] = '  αβ  '
    zones[1] = 'é' // e + combining acute
    zones[2] = 'कि'
    const res = acceptance(run(d))
    expect(res.naming.sounds?.[0]).toBe('αβ')
    expect(res.naming.sounds?.[1]).toBe('é')
    expect(res.naming.sounds?.[2]).toBe('कि')
  })

  it('issues are collected across rules in rule order and counted exactly', () => {
    const d = docOf()
    sub(d, 'generator').style = 'loud'
    ;(d.zones as unknown[])[2] = 'a1'
    d.locks = [99]
    d.overrides = { '999': 'Zed', '3': 'a b' }
    d.meta = { title: 'x'.repeat(201) }
    const res = refusal(run(d))
    expect(res.issueCount).toBe(6)
    expect(res.issues).toEqual([
      { kind: 'bad-field', path: 'generator.style' },
      { kind: 'bad-sound', zone: 2, reason: 'digit' },
      { kind: 'bad-field', path: 'locks' },
      { kind: 'bad-override-name', mesh: 3, reason: 'space' }, // an object lists its integer keys ascending: 3 before 999
      { kind: 'bad-override-key', key: '999' },
    ])
  })

  it.each([[[-1]], [[28]], [[1.5]], [[3, 3]], [['a']], [[null]], ['x'], [{}], [5], [null]])('locks %j is a bad field', locks => {
    const d = docOf()
    d.locks = locks
    expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'locks' }])
  })

  it('locks without zones is a bad field', () => {
    const d = docOf()
    delete d.zones
    d.locks = [1]
    expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'locks' }])
  })

  it('accepts locks in any order, including the first and last zone and an empty list', () => {
    const d = docOf()
    d.locks = [27, 0, 13]
    const res = acceptance(run(d))
    expect([...res.naming.locks].sort((a, b) => a - b)).toEqual([0, 13, 27])
    d.locks = []
    expect(acceptance(run(d)).naming.locks.size).toBe(0)
  })

  it('a file without zones at an editable base is regenerated from its seed', () => {
    const d = docOf()
    sub(d, 'generator').seed = 'hollow-vector'
    sub(d, 'generator').style = 'syllabic'
    delete d.zones
    delete d.locks
    const res = acceptance(run(d))
    expect(res.naming.sounds).toEqual(generateSounds(createGenerator('hollow-vector', 'syllabic'), 28))
  })
})

describe('validateNamingJson: overrides', () => {
  it.each(['044', '-1', '1e3', '378', '', ' 5', '5 ', '0x10', '1.5', '+5', '١٢', '5\n', '99999999', '12345678901234567'])(
    'the key %j is refused as an override key',
    key => {
      const d = docOf()
      d.overrides = { [key]: 'Zed' }
      const res = refusal(run(d))
      expect(res.issues).toEqual([{ kind: 'bad-override-key', key }])
    },
  )

  it('accepts the first and the last mesh number of the base, and nothing above it', () => {
    const d = docOf()
    d.overrides = { '0': 'Low', '377': 'High' }
    const res = acceptance(run(d))
    expect([...res.naming.overrides]).toEqual([[0, 'Low'], [377, 'High']])
    d.overrides = { '378': 'Past' }
    expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-override-key', key: '378' }])
  })

  it('clips a long key in the issue to at most 40 characters', () => {
    const d = docOf()
    d.overrides = { ['1'.repeat(100)]: 'Zed' }
    const res = refusal(run(d))
    const issue = res.issues[0] as { kind: string; key: string }
    expect(issue.kind).toBe('bad-override-key')
    expect(issue.key.length).toBeLessThanOrEqual(40)
    expect(issue.key.startsWith('1111')).toBe(true)
  })

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'prototype', '__defineGetter__'])(
    'the prototype key %s is refused, never assigned, and Object.prototype is unchanged',
    key => {
      const before = protoNames()
      const text = withRawField('overrides', `{"${key}":{"polluted":"yes"},"5":"Zed"}`)
      const res = refusal(run(text))
      expect(res.issues).toEqual([{ kind: 'bad-override-key', key }])
      const named = withRawField('overrides', `{"${key}":"Zed"}`)
      expect(refusal(run(named)).issues).toEqual([{ kind: 'bad-override-key', key }])
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
      expect(protoNames()).toBe(before)
      expect(Object.getPrototypeOf({})).toBe(Object.prototype)
    },
  )

  it('prototype keys elsewhere in the file are unknown keys, listed and harmless', () => {
    const before = protoNames()
    const generator = `{"prng":"${PRNG_ALGO}","gen":"${GENERATOR_ID}","seed":"s","style":"harsh","__proto__":{"polluted":1}}`
    const text = withRawFields([['__proto__', '{"polluted":"yes"}'], ['generator', generator]])
    const res = acceptance(run(text))
    expect(res.unknownKeys).toContain('__proto__')
    expect(res.unknownKeys).toContain('generator.__proto__')
    expect(res.unknownKeyCount).toBe(2)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(protoNames()).toBe(before)
    expect(Object.getPrototypeOf(res.naming)).toBe(Object.prototype)
    expect(res.naming.overrides).toBeInstanceOf(Map)
  })

  it('the accepted overrides are a Map, so a lookup of a prototype name is empty', () => {
    const d = docOf()
    d.overrides = { '5': 'Zed' }
    const res = acceptance(run(d))
    expect(res.naming.overrides).toBeInstanceOf(Map)
    expect(res.naming.overrides.get(5)).toBe('Zed')
    expect(res.naming.overrides.size).toBe(1)
  })

  it('reads own properties only: a polluted Object.prototype adds no locks, overrides or meta to a file that has none', () => {
    const d = docOf()
    delete d.locks
    delete d.overrides
    const text = JSON.stringify(d)
    const before = protoNames()
    const polluted = Object.prototype as Record<string, unknown>
    const names = ['locks', 'overrides', 'meta', 'zones'] as const
    for (const name of names) {
      Object.defineProperty(Object.prototype, name, {
        value: name === 'overrides' ? { '1': 'Pol' } : name === 'meta' ? { title: 'P' } : name === 'locks' ? [1, 2] : ['x'],
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
    let res: NamingImport
    try {
      res = run(text)
    } finally {
      for (const name of names) delete polluted[name]
    }
    expect(protoNames()).toBe(before)
    const ok = acceptance(res)
    expect(ok.naming.locks.size).toBe(0)
    expect(ok.naming.overrides.size).toBe(0)
    expect(ok.naming.meta).toBeNull()
    expect(ok.naming.sounds).toHaveLength(28)
  })

  it('refuses a bad value with its mesh number and reason', () => {
    const d = docOf()
    d.overrides = { '44': 'Na me', '45': '', '46': 'ab1', '47': 'x'.repeat(33), '48': 5, '49': null, '50': ['a'], '51': { a: 1 }, '52': 'ab‮cd' }
    const res = refusal(run(d))
    expect(res.issueCount).toBe(9)
    expect(res.issues).toEqual([
      { kind: 'bad-override-name', mesh: 44, reason: 'space' },
      { kind: 'bad-override-name', mesh: 45, reason: 'empty' },
      { kind: 'bad-override-name', mesh: 46, reason: 'digit' },
      { kind: 'bad-override-name', mesh: 47, reason: 'long' },
      { kind: 'bad-override-name', mesh: 48, reason: 'other' },
    ])
  })

  it('a name of exactly 32 characters is accepted, trimmed and NFC-normalised', () => {
    const d = docOf()
    d.overrides = { '1': 'x'.repeat(32), '2': '  Zed  ', '3': 'é' }
    const res = acceptance(run(d))
    expect(res.naming.overrides.get(1)).toBe('x'.repeat(32))
    expect(res.naming.overrides.get(2)).toBe('Zed')
    expect(res.naming.overrides.get(3)).toBe('é')
  })

  it('overrides must be a plain object', () => {
    for (const v of [[], 'x', 5, null, true, [['5', 'Zed']]]) {
      const d = docOf()
      d.overrides = v
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'overrides' }])
    }
  })

  it('more than NAMING_MAX_OVERRIDES entries is a bad field; exactly that many is accepted', () => {
    const base = createNaming({ base: CEILING, interactiveMaxN: CEILING })
    const d = docOf(base)
    const overrides: Record<string, string> = {}
    for (let i = 0; i < NAMING_MAX_OVERRIDES; i++) overrides[String(i)] = 'Zed'
    d.overrides = overrides
    const exact = acceptance(run(d, { base: CEILING }))
    expect(exact.naming.overrides.size).toBe(NAMING_MAX_OVERRIDES)
    overrides[String(NAMING_MAX_OVERRIDES)] = 'Zed'
    const res = refusal(run(d, { base: CEILING }))
    expect(res.issues).toEqual([{ kind: 'bad-field', path: 'overrides' }])
    expect(res.issueCount).toBe(1)
  })
})

describe('validateNamingJson: meta', () => {
  it('meta is optional and null when absent', () => {
    expect(acceptance(run(docOf())).naming.meta).toBeNull()
  })

  it('an empty meta object is a meta with empty texts; a one-field meta fills the other with an empty text', () => {
    const d = docOf()
    d.meta = {}
    expect(acceptance(run(d)).naming.meta).toEqual({ title: '', notes: '' })
    d.meta = { title: 'T' }
    expect(acceptance(run(d)).naming.meta).toEqual({ title: 'T', notes: '' })
  })

  it('texts up to META_MAX_LENGTH are accepted, longer ones are bad fields', () => {
    const d = docOf()
    d.meta = { title: 'x'.repeat(META_MAX_LENGTH), notes: 'y'.repeat(META_MAX_LENGTH) }
    expect(acceptance(run(d)).naming.meta?.title).toHaveLength(META_MAX_LENGTH)
    d.meta = { title: 'x'.repeat(META_MAX_LENGTH + 1), notes: 'y'.repeat(META_MAX_LENGTH + 1) }
    expect(refusal(run(d)).issues).toEqual([
      { kind: 'bad-field', path: 'meta.title' },
      { kind: 'bad-field', path: 'meta.notes' },
    ])
  })

  it('a title or notes that is not text is a bad field', () => {
    for (const v of [5, null, true, ['a'], { a: 1 }]) {
      const d = docOf()
      d.meta = { title: v }
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'meta.title' }])
      d.meta = { notes: v }
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'meta.notes' }])
    }
  })

  it('meta that is not an object is a bad field', () => {
    for (const v of ['x', 5, [], null, true]) {
      const d = docOf()
      d.meta = v
      expect(refusal(run(d)).issues).toEqual([{ kind: 'bad-field', path: 'meta' }])
    }
  })

  it('a 100,000-deep nested array as meta.notes is refused as a bad field and does not throw', () => {
    const deep = '['.repeat(100000) + ']'.repeat(100000)
    const text = withRawField('meta', `{"title":"t","notes":${deep}}`)
    let res: NamingImport | undefined
    expect(() => {
      res = run(text)
    }).not.toThrow()
    expect((res as NamingImport).ok).toBe(false)
    expect(refusal(res as NamingImport).issues).toEqual([{ kind: 'bad-field', path: 'meta.notes' }])
  })

  it('deep nesting anywhere else never makes the validator recurse: unknown keys are only listed', () => {
    const deepArray = '['.repeat(100000) + ']'.repeat(100000)
    const deepObject = '{"a":'.repeat(50000) + '1' + '}'.repeat(50000)
    for (const raw of [deepArray, deepObject]) {
      const res = acceptance(run(withRawField('extra', raw)))
      expect(res.unknownKeys).toEqual(['extra'])
    }
    expect(kinds(run(withRawField('zones', deepArray)))).toEqual(['bad-field'])
    expect(kinds(run(withRawField('overrides', deepObject)))).toEqual(['bad-override-key'])
  })
})

describe('validateNamingJson: unknown keys', () => {
  it('lists unknown keys as dotted paths and does not block', () => {
    const d = docOf()
    d.extra = 1
    sub(d, 'generator').x = 1
    sub(d, 'join').y = 1
    d.meta = { title: 'T', z: 1 }
    const res = acceptance(run(d))
    expect(res.unknownKeys).toEqual(['extra', 'generator.x', 'join.y', 'meta.z'])
    expect(res.unknownKeyCount).toBe(4)
    expect(plain(res.naming).meta).toEqual({ title: 'T', notes: '' })
  })

  it('keeps UNKNOWN_KEYS_MAX paths and counts all of them', () => {
    const d = docOf()
    for (const k of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) d[k] = k
    const res = acceptance(run(d))
    expect(res.unknownKeys).toHaveLength(UNKNOWN_KEYS_MAX)
    expect(res.unknownKeyCount).toBe(7)
    expect(res.unknownKeys).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })

  it('a very long unknown key is clipped in the list', () => {
    const d = docOf()
    d['k'.repeat(1000)] = 1
    const res = acceptance(run(d))
    expect(res.unknownKeys).toHaveLength(1)
    expect((res.unknownKeys[0] as string).length).toBeLessThanOrEqual(40)
  })

  it('none of the known keys is reported', () => {
    const d = docOf()
    d.meta = { title: 'T', notes: 'N' }
    const res = acceptance(run(d))
    expect(res.unknownKeys).toEqual([])
    expect(res.unknownKeyCount).toBe(0)
  })

  it('unknown keys are not reported for a refused file', () => {
    const d = docOf()
    d.extra = 1
    d.locks = 'bad'
    const res = refusal(run(d))
    expect(res).not.toHaveProperty('unknownKeys')
  })
})

describe('validateNamingJson: never throws', () => {
  function checkShape(res: NamingImport, o: ValidateNamingOptions): void {
    if (res.ok) {
      expect(res.naming.base).toBe(o.base)
      expect(res.unknownKeys.length).toBeLessThanOrEqual(UNKNOWN_KEYS_MAX)
      expect(res.unknownKeyCount).toBeGreaterThanOrEqual(res.unknownKeys.length)
      // import, export, import is stable
      const again = acceptance(validateNamingJson(serializeNaming(res.naming), o))
      expect(plain(again.naming)).toEqual(plain(res.naming))
    } else {
      expect(res.issues.length).toBeGreaterThanOrEqual(1)
      expect(res.issues.length).toBeLessThanOrEqual(ISSUES_MAX)
      expect(res.issueCount).toBeGreaterThanOrEqual(res.issues.length)
      if (res.issueCount <= ISSUES_MAX) expect(res.issueCount).toBe(res.issues.length)
      if (res.offerSeed !== null) expect(res.issues[0]?.kind).toBe('wrong-base')
    }
  }

  it('returns a typed result for 2000 random JSON values', () => {
    const o = opts()
    fc.assert(
      fc.property(fc.json(), text => {
        checkShape(validateNamingJson(text, o), o)
      }),
      { seed: 20261112, numRuns: 2000 },
    )
  })

  it('returns a typed result for 2000 random strings', () => {
    const o = opts()
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string({ unit: 'binary' })), text => {
        checkShape(validateNamingJson(text, o), o)
      }),
      { seed: 20261113, numRuns: 2000 },
    )
  })

  it('returns a typed result when one field of a valid file is replaced or deleted (1500 runs)', () => {
    let seeded = toggleLock(n28(), 4)
    seeded = setOverride(seeded, 44, 'Zed', null)
    seeded = { ...seeded, meta: { title: 'T', notes: 'N' } }
    const paths = [
      'schema', 'base', 'source', 'generator', 'join', 'zones', 'locks', 'overrides', 'meta',
      'generator.seed', 'generator.style', 'generator.prng', 'generator.gen', 'join.order', 'join.smoothing',
      'meta.title', 'meta.notes', 'zones.0', 'zones.5', 'zones.27', 'locks.0', 'overrides.44',
    ]
    const o = opts()
    fc.assert(
      fc.property(fc.constantFrom(...paths), fc.jsonValue(), fc.boolean(), (path, value, remove) => {
        const d = docOf(seeded)
        const keys = path.split('.')
        let cur: unknown = d
        for (const k of keys.slice(0, -1)) cur = (cur as Doc)[k]
        const last = keys[keys.length - 1] as string
        if (remove) delete (cur as Doc)[last]
        else (cur as Doc)[last] = value
        checkShape(validateNamingJson(JSON.stringify(d), o), o)
      }),
      { seed: 20261114, numRuns: 1500 },
    )
  })

  it('answers with a typed result whatever the options (an odd base, a ceiling of zero or below, no preset)', () => {
    const text = serializeNaming(n28())
    expect(validateNamingJson(text, { base: 28, interactiveMaxN: CEILING, preset: null }).ok).toBe(true)
    for (const o of [opts({ base: 27 }), opts({ base: Number.NaN }), opts({ interactiveMaxN: 0 }), opts({ interactiveMaxN: -1 })]) {
      expect(typeof validateNamingJson(text, o).ok).toBe('boolean')
    }
    expect(refusal(validateNamingJson(text, opts({ interactiveMaxN: 0 }))).issues).toEqual([{ kind: 'seed-only-base' }])
  })
})

describe('the barrel', () => {
  it('re-exports the schema and the validator through engine/index', () => {
    expect(engine.SCHEMA_ID).toBe('ccrug.naming/1')
    expect(engine.serializeNaming).toBe(serializeNaming)
    expect(engine.validateNamingJson).toBe(validateNamingJson)
    expect(engine.NAMING_IMPORT_MAX_BYTES).toBe(NAMING_IMPORT_MAX_BYTES)
  })
})
