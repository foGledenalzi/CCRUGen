// Tests for app/lib/demonSearch.ts (DEM-02): defensive mesh / a::b / name query parsing and zone-numeral parsing.
// Base 28 (378 demons), base 666 (221,445 demons, the phase's own headline example) and base 10 (named demons, read
// from the frozen oracle) cover the accepted forms; a fixed hostile-input list proves the parser never throws and
// never does unbounded work (T-05-07, T-05-08, T-05-09, T-05-10).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { DEFAULT_DEMON_SORT, rowSourceFor } from '../../app/lib/demonBrowser'
import {
  NAME_SEARCH_MAX_COUNT,
  SEARCH_MAX_LENGTH,
  clampQuery,
  emptyFilterMessage,
  parseDemonQuery,
  parseZoneNumeral,
  resolveDemonSearch,
  searchHitKey,
  searchMessage,
  type DemonQuery,
} from '../../app/lib/demonSearch'

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as { demons: { a: number; b: number; netSpan: string; kind: string; name: string }[] }

const g10 = createNumogram(10)
const g28 = createNumogram(28)
const g666 = createNumogram(666)

// Hostile / adversarial inputs (T-05-07, T-05-08): none of these may ever throw, at any base.
const HOSTILE_INPUTS: readonly string[] = [
  '__proto__',
  'constructor',
  '%00',
  '‮'.repeat(50),
  'a'.repeat(10000),
  '9'.repeat(10000),
]

describe('constants', () => {
  it('SEARCH_MAX_LENGTH is 64 and NAME_SEARCH_MAX_COUNT is 50,000', () => {
    expect(SEARCH_MAX_LENGTH).toBe(64)
    expect(NAME_SEARCH_MAX_COUNT).toBe(50_000)
  })
})

describe('clampQuery', () => {
  it('clamps to SEARCH_MAX_LENGTH characters', () => {
    expect(clampQuery('x'.repeat(200)).length).toBe(64)
    expect(clampQuery('short')).toBe('short')
  })
})

describe('parseZoneNumeral', () => {
  it('letter-base (<=36) digits, case-insensitive', () => {
    expect(parseZoneNumeral('c', 28)).toBe(12)
    expect(parseZoneNumeral('C', 28)).toBe(12)
    expect(parseZoneNumeral('z', 28)).toBeNull() // digit 35 not below base 28
    expect(parseZoneNumeral('', 28)).toBeNull()
    expect(parseZoneNumeral('-1', 28)).toBeNull()
  })

  it('a well-formed letter-base numeral whose value is not below the base is null', () => {
    expect(parseZoneNumeral('1c', 28)).toBeNull() // 40 >= 28
  })

  it('dotted decimal-group numerals above base 36', () => {
    expect(parseZoneNumeral('665', 666)).toBe(665)
    expect(parseZoneNumeral('666', 666)).toBeNull() // not below the base
    expect(parseZoneNumeral('1.5', 666)).toBeNull() // 671 >= 666
    expect(parseZoneNumeral('5', 666)).toBe(5)
    expect(parseZoneNumeral('abc', 666)).toBeNull()
  })

  it('never throws for hostile input', () => {
    for (const text of HOSTILE_INPUTS) {
      expect(() => parseZoneNumeral(text, 666)).not.toThrow()
      expect(() => parseZoneNumeral(text, 28)).not.toThrow()
    }
  })
})

describe('parseDemonQuery: mesh numbers', () => {
  it('a decimal mesh below the demon count parses as mesh', () => {
    expect(parseDemonQuery('108', g666)).toEqual({ kind: 'mesh', mesh: 108 })
    expect(parseDemonQuery('221444', g666)).toEqual({ kind: 'mesh', mesh: 221444 })
  })

  it('a decimal mesh at or above the demon count is not-found', () => {
    expect(parseDemonQuery('221445', g666)).toEqual({ kind: 'not-found' })
  })
})

describe('parseDemonQuery: a::b pairs', () => {
  it('parses either order, normalizing a > b', () => {
    expect(parseDemonQuery('15::3', g666)).toEqual({ kind: 'pair', a: 15, b: 3 })
    expect(parseDemonQuery('3::15', g666)).toEqual({ kind: 'pair', a: 15, b: 3 })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseDemonQuery(' 15 :: 3 ', g666)).toEqual({ kind: 'pair', a: 15, b: 3 })
  })

  it('a === b is not-found', () => {
    expect(parseDemonQuery('3::3', g666)).toEqual({ kind: 'not-found' })
  })

  it('a well-formed side at or above the base is not-found, not syntax', () => {
    expect(parseDemonQuery('700::3', g666)).toEqual({ kind: 'not-found' })
  })

  it('in-base numerals: base 28 letter-scheme digits, not decimal', () => {
    expect(parseDemonQuery('c::3', g28)).toEqual({ kind: 'pair', a: 12, b: 3 })
    // '12' in base 28's letter scheme is 1*28+2 = 30, which is >= 28 - not-found, not the decimal value 12
    expect(parseDemonQuery('12::3', g28)).toEqual({ kind: 'not-found' })
  })

  it('malformed a::b shapes are syntax errors', () => {
    const malformed = ['::', '1::', '::1', '1::2::3']
    for (const text of malformed) {
      expect(parseDemonQuery(text, g666)).toEqual({ kind: 'syntax' })
    }
  })
})

describe('parseDemonQuery: base-10 names', () => {
  it('an exact name match (case-insensitive) resolves to its mesh', () => {
    const lurgo = golden.demons.find(d => d.name === 'Lurgo')
    expect(lurgo).toBeDefined()
    expect(parseDemonQuery('lurgo', g10)).toEqual({ kind: 'name', mesh: 0 })
    expect(parseDemonQuery('LURGO', g10)).toEqual({ kind: 'name', mesh: 0 })
  })

  it('a prefix match resolves to the first name in mesh order starting with it', () => {
    const tukkamuMesh = golden.demons.findIndex(d => d.name === 'Tukkamu')
    const tukutuMesh = golden.demons.findIndex(d => d.name === 'Tukutu')
    expect(tukkamuMesh).toBe(11)
    expect(tukutuMesh).toBe(41)
    expect(parseDemonQuery('Tuk', g10)).toEqual({ kind: 'name', mesh: 11 })
  })

  it('an unmatched name is not-found at base 10 (a name table exists) but syntax where none exists', () => {
    expect(parseDemonQuery('xyz', g10)).toEqual({ kind: 'not-found' })
    expect(parseDemonQuery('xyz', g28)).toEqual({ kind: 'syntax' })
  })
})

describe('parseDemonQuery: empty input', () => {
  it('empty and whitespace-only input is empty, not syntax', () => {
    expect(parseDemonQuery('', g666)).toEqual({ kind: 'empty' })
    expect(parseDemonQuery('   ', g666)).toEqual({ kind: 'empty' })
  })
})

describe('parseDemonQuery: syntax errors', () => {
  it('shapes that are none of the accepted forms are syntax', () => {
    const cases = ['1e3', '0x10', '-5', '1.5', '９' /* full-width '9' */]
    for (const text of cases) {
      expect(parseDemonQuery(text, g666)).toEqual({ kind: 'syntax' })
    }
  })

  it('an oversized numeric-looking string is clamped to 64 characters and fails the 16-digit mesh gate', () => {
    const result = parseDemonQuery('1'.repeat(200), g666)
    expect(result).toEqual({ kind: 'syntax' })
  })
})

describe('parseDemonQuery: hostile input never throws', () => {
  it('never throws and always returns a well-formed DemonQuery', () => {
    const validKinds: readonly DemonQuery['kind'][] = ['empty', 'mesh', 'pair', 'name', 'not-found', 'syntax']
    for (const text of HOSTILE_INPUTS) {
      let result: DemonQuery | undefined
      expect(() => {
        result = parseDemonQuery(text, g666)
      }).not.toThrow()
      expect(result).toBeDefined()
      expect(validKinds).toContain((result as DemonQuery).kind)
    }
  })
})

// ── Task 2: resolution to a row and UI-SPEC status copy ─────────────────────

describe('resolveDemonSearch: found', () => {
  it('a mesh query resolves to its row under the active filter/sort', () => {
    const demon108 = g666.demons.at(108)
    const outcome = resolveDemonSearch('108', g666, demon108.subtype, DEFAULT_DEMON_SORT)
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.demon.mesh).toBe(108)
    const source = rowSourceFor(g666, demon108.subtype, 'mesh')
    expect(source.at(outcome.index).mesh).toBe(108)
  })

  it('an a::b query under no filter resolves to its ascending-mesh index', () => {
    const outcome = resolveDemonSearch('15::3', g666, null, DEFAULT_DEMON_SORT)
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.index).toBe(108)
  })

  it('descending direction flips the index', () => {
    const outcome = resolveDemonSearch('0', g28, null, { key: 'mesh', direction: 'desc' })
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.index).toBe(377)
  })

  it('a name query resolves to its row', () => {
    const outcome = resolveDemonSearch('lurgo', g10, null, DEFAULT_DEMON_SORT)
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.demon.mesh).toBe(0)
    expect(outcome.index).toBe(0)
  })
})

describe('resolveDemonSearch: outside-filter', () => {
  it('a demon that exists but fails the active filter is reported explicitly, never silently dropped', () => {
    const demon = g28.demons.ref(1, 0)
    expect(demon.type).not.toBe('chrono') // sanity: 1::0 is amphi at base 28, per the plan's worked example
    const outcome = resolveDemonSearch('1::0', g28, 'chrono', DEFAULT_DEMON_SORT)
    expect(outcome.kind).toBe('outside-filter')
    if (outcome.kind !== 'outside-filter') throw new Error('expected outside-filter')
    expect(outcome.demon.mesh).toBe(demon.mesh)
    expect(outcome.echo).toBe('1::0')
  })
})

describe('resolveDemonSearch: not-found / syntax / empty', () => {
  it('not-found carries the clipped echo', () => {
    const outcome = resolveDemonSearch('221445', g666, null, DEFAULT_DEMON_SORT)
    expect(outcome).toEqual({ kind: 'not-found', echo: '221445' })
  })

  it('syntax carries the clipped echo', () => {
    const outcome = resolveDemonSearch('1e3', g666, null, DEFAULT_DEMON_SORT)
    expect(outcome).toEqual({ kind: 'syntax', echo: '1e3' })
  })

  it('empty input resolves to empty', () => {
    expect(resolveDemonSearch('', g666, null, DEFAULT_DEMON_SORT)).toEqual({ kind: 'empty' })
  })

  it('a 100-character syntax input echoes at most 43 characters (40 + "...")', () => {
    const input = 'x'.repeat(50) + '!'.repeat(50) // not a valid mesh/pair/name shape
    const outcome = resolveDemonSearch(input, g666, null, DEFAULT_DEMON_SORT)
    expect(outcome.kind).toBe('syntax')
    if (outcome.kind !== 'syntax') throw new Error('expected syntax')
    expect(outcome.echo.length).toBe(43)
    expect(outcome.echo.endsWith('...')).toBe(true)
  })

  it('echoes a bidi or control character as U+FFFD, never as it was typed (WR-03)', () => {
    const RLO = String.fromCodePoint(0x202e)
    const FFFD = String.fromCodePoint(0xfffd)
    expect(resolveDemonSearch('1e' + RLO + '3', g666, null, DEFAULT_DEMON_SORT)).toEqual({ kind: 'syntax', echo: '1e' + FFFD + '3' })
    const hostile = resolveDemonSearch(RLO.repeat(50), g666, null, DEFAULT_DEMON_SORT)
    expect(hostile).toEqual({ kind: 'syntax', echo: FFFD.repeat(40) + '...' })
  })

  it('never throws for hostile input, at any filter', () => {
    for (const text of HOSTILE_INPUTS) {
      expect(() => resolveDemonSearch(text, g666, null, DEFAULT_DEMON_SORT)).not.toThrow()
      expect(() => resolveDemonSearch(text, g666, 'chrono', DEFAULT_DEMON_SORT)).not.toThrow()
    }
  })
})

describe('searchMessage', () => {
  it('not-found: exact UI-SPEC copy with curly quotes', () => {
    const message = searchMessage({ kind: 'not-found', echo: '221445' }, null, 221445)
    expect(message).toEqual({
      heading: 'No demon found for “221445”.',
      body: 'Search by mesh number (e.g. 42) or net-span (e.g. 12::3).',
    })
  })

  it('syntax: exact UI-SPEC copy with an ASCII apostrophe in "Couldn\'t" and an em dash', () => {
    const message = searchMessage({ kind: 'syntax', echo: '1e3' }, null, 221445)
    expect(message).toEqual({
      heading: "Couldn't parse “1e3” — try a mesh number (e.g. 108) or an a::b pair (e.g. 12::3).",
      body: '',
    })
    expect(message?.heading.includes("Couldn't")).toBe(true)
  })

  it('outside-filter: exact UI-SPEC copy with the unambiguous filter label', () => {
    const demon = g28.demons.ref(1, 0)
    const message = searchMessage({ kind: 'outside-filter', demon, echo: '1::0' }, 'chrono', 378)
    expect(message).toEqual({
      heading: '“1::0” is not in the Chrono filter.',
      body: 'Clear the Chrono filter to see all 378 demons.',
    })
  })

  it('found and empty produce no status message', () => {
    const demon = g666.demons.at(0)
    expect(searchMessage({ kind: 'found', demon, index: 0 }, null, 221445)).toBeNull()
    expect(searchMessage({ kind: 'empty' }, null, 221445)).toBeNull()
  })
})

describe('emptyFilterMessage', () => {
  it('exact UI-SPEC copy with the unambiguous filter label and a locale-formatted count', () => {
    const message = emptyFilterMessage('warp-amphi', 221445)
    expect(message).toEqual({
      heading: 'No demons match this filter',
      body: 'Clear the Warp amphi filter to see all 221,445 demons.',
    })
  })
})

// ── live names (plan 07-15, D-03, NAM-02, NAM-04, T-07-06c) ─────────────────────────────────────────────────────────────────
// An optional `nameOf` (the resolver's method) makes the name branch read the names the visitor sees, at any base, within the
// same NAME_SEARCH_MAX_COUNT cap. Without it every case above is unchanged. The canonical base-10 name is read from the frozen
// oracle by index; no name is typed here, and the generated names come from the engine's own naming.
import { createNameResolver, createNaming, setOverride, type Naming } from '../../engine/index'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'

type NameOf = (a: number, b: number) => string

const generatedNaming = (base: number): Naming => createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N })
const ccruNaming = (): Naming =>
  createNaming({ base: CCRU_NAMING_PRESET.base, interactiveMaxN: INTERACTIVE_MAX_N, source: 'ccru', preset: CCRU_NAMING_PRESET })
const nameOfOf = (naming: Naming): NameOf =>
  createNameResolver(naming, naming.source === 'ccru' ? CCRU_NAMING_PRESET : null).nameOf

describe('parseDemonQuery: live names', () => {
  const canonical0 = golden.demons[0]?.name as string
  const generated10 = nameOfOf(generatedNaming(10))
  const ccru10 = nameOfOf(ccruNaming())
  const generated28 = nameOfOf(generatedNaming(28))
  const nameAt28 = (mesh: number): string => {
    const [a, b] = g28.demons.netSpanOf(mesh)
    return generated28(a, b)
  }

  it('the canonical name stops matching once base 10 shows generated names, and matches again under the preset naming', () => {
    expect(canonical0).toBe(CCRU_NAMING_PRESET.names[0])
    expect(parseDemonQuery(canonical0, g10)).toEqual({ kind: 'name', mesh: 0 }) // the table path, unchanged
    expect(parseDemonQuery(canonical0, g10, generated10)).toEqual({ kind: 'not-found' })
    expect(parseDemonQuery(canonical0, g10, ccru10)).toEqual({ kind: 'name', mesh: 0 })
    expect(parseDemonQuery(canonical0.toLowerCase(), g10, ccru10)).toEqual({ kind: 'name', mesh: 0 })
  })

  it('a generated name at base 28 finds its mesh, exact and in any letter case, where there was no name table before', () => {
    expect(parseDemonQuery('xyz', g28)).toEqual({ kind: 'syntax' }) // no nameOf: unchanged
    const [a, b] = g28.demons.netSpanOf(100)
    const name = generated28(a, b)
    expect(name).toMatch(/^[a-z]+$/i)
    expect(parseDemonQuery(name, g28, generated28)).toEqual({ kind: 'name', mesh: 100 })
    expect(parseDemonQuery(name.toUpperCase(), g28, generated28)).toEqual({ kind: 'name', mesh: 100 })
    expect(parseDemonQuery(name.toLowerCase(), g28, generated28)).toEqual({ kind: 'name', mesh: 100 })
  })

  it('a prefix finds the lowest mesh whose name starts with it, and no match is not-found rather than syntax', () => {
    const prefix = nameAt28(250).slice(0, 2).toLowerCase()
    let expected = -1
    for (let mesh = 0; mesh < g28.demons.count && expected === -1; mesh++) {
      if (nameAt28(mesh).toLowerCase().startsWith(prefix)) expected = mesh
    }
    expect(expected).toBeGreaterThanOrEqual(0)
    expect(expected).toBeLessThanOrEqual(250)
    expect(parseDemonQuery(prefix, g28, generated28)).toEqual({ kind: 'name', mesh: expected })
    expect(parseDemonQuery('qqqqqqqqqqqq', g28, generated28)).toEqual({ kind: 'not-found' })
  })

  it('an exact name beats an earlier prefix match, and the lowest mesh wins among prefix matches', () => {
    const longer = setOverride(generatedNaming(28), 3, 'Zorbit', null)
    const both = nameOfOf(setOverride(longer, 9, 'Zorb', null))
    expect(parseDemonQuery('zorb', g28, both)).toEqual({ kind: 'name', mesh: 9 }) // mesh 3 starts with it, mesh 9 equals it
    expect(parseDemonQuery('zorbi', g28, both)).toEqual({ kind: 'name', mesh: 3 })
    const twoPrefixes = nameOfOf(setOverride(setOverride(generatedNaming(28), 3, 'Zorbit', null), 9, 'Zorbal', null))
    expect(parseDemonQuery('zorb', g28, twoPrefixes)).toEqual({ kind: 'name', mesh: 3 })
  })

  it('an override is searchable and the name it replaced is not', () => {
    const [a, b] = g28.demons.netSpanOf(5)
    const before = generated28(a, b)
    const renamed = nameOfOf(setOverride(generatedNaming(28), 5, 'Zorb', null))
    expect(parseDemonQuery('zorb', g28, generated28)).toEqual({ kind: 'not-found' })
    expect(parseDemonQuery('zorb', g28, renamed)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(before, g28, renamed)).not.toEqual({ kind: 'name', mesh: 5 })
  })

  it('mesh and pair queries read no names at all', () => {
    const never: NameOf = () => {
      throw new Error('nameOf must not be called')
    }
    expect(parseDemonQuery('42', g28, never)).toEqual({ kind: 'mesh', mesh: 42 })
    expect(parseDemonQuery('c::3', g28, never)).toEqual({ kind: 'pair', a: 12, b: 3 })
    expect(parseDemonQuery('', g28, never)).toEqual({ kind: 'empty' })
    expect(parseDemonQuery('1e3', g28, never)).toEqual({ kind: 'syntax' })
  })

  it('above NAME_SEARCH_MAX_COUNT a name query is syntax with or without nameOf, and nameOf is never called (T-07-06c)', () => {
    expect(g666.demons.count).toBeGreaterThan(NAME_SEARCH_MAX_COUNT)
    let calls = 0
    const counting: NameOf = () => {
      calls++
      return 'x'
    }
    expect(parseDemonQuery('abc', g666)).toEqual({ kind: 'syntax' })
    expect(parseDemonQuery('abc', g666, counting)).toEqual({ kind: 'syntax' })
    expect(calls).toBe(0)
  })

  it('reads names for every mesh within the cap, not only a first few', () => {
    const last = g28.demons.count - 1
    const name = nameAt28(last)
    expect(parseDemonQuery(name, g28, generated28)).toEqual({ kind: 'name', mesh: last })
  })

  it('a naming of another base is syntax, not a throw: only the engine RangeError is swallowed', () => {
    expect(parseDemonQuery('abc', g28, ccru10)).toEqual({ kind: 'syntax' })
    const broken: NameOf = () => {
      throw new TypeError('not a range problem')
    }
    expect(() => parseDemonQuery('abc', g28, broken)).toThrow(TypeError)
  })
})

describe('resolveDemonSearch: live names', () => {
  const generated28 = nameOfOf(generatedNaming(28))

  it('forwards nameOf: a generated name resolves to its row, and is a syntax error without it', () => {
    const [a, b] = g28.demons.netSpanOf(60)
    const name = generated28(a, b)
    const outcome = resolveDemonSearch(name, g28, null, DEFAULT_DEMON_SORT, generated28)
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.demon.mesh).toBe(60)
    expect(outcome.index).toBe(60)
    expect(resolveDemonSearch(name, g28, null, DEFAULT_DEMON_SORT)).toEqual({ kind: 'syntax', echo: name })
  })

  it('reports a live-name hit outside the active filter and an unknown name as not-found', () => {
    const [a, b] = g28.demons.netSpanOf(0)
    const name = generated28(a, b)
    const demon = g28.demons.at(0)
    const filtered = resolveDemonSearch(name, g28, demon.type === 'chrono' ? 'xeno' : 'chrono', DEFAULT_DEMON_SORT, generated28)
    expect(filtered.kind).toBe('outside-filter')
    expect(resolveDemonSearch('qqqqqqqqqqqq', g28, null, DEFAULT_DEMON_SORT, generated28)).toEqual({
      kind: 'not-found',
      echo: 'qqqqqqqqqqqq',
    })
  })

  it('the browser passes the live resolver name of the displayed base into the search (source: the query box needs a user)', () => {
    const source = readFileSync(fileURLToPath(new URL('../../app/components/demons/DemonBrowser.tsx', import.meta.url)), 'utf8')
    expect(source.match(/resolveDemonSearch\(query, g, filter, sort, nameOf\)/g)).toHaveLength(1)
    expect(source.match(/naming !== null && naming\.base === g\.base \? naming\.resolver\.nameOf : undefined/g)).toHaveLength(1)
    expect(source.match(/useNaming\(\)/g)).toHaveLength(1)
  })

  it('base 10 under the preset naming still resolves the canonical name to its row', () => {
    const canonical = (golden.demons[0]?.name as string).toLowerCase()
    const outcome = resolveDemonSearch(canonical, g10, null, DEFAULT_DEMON_SORT, nameOfOf(ccruNaming()))
    expect(outcome.kind).toBe('found')
    if (outcome.kind !== 'found') throw new Error('expected found')
    expect(outcome.demon.mesh).toBe(0)
  })
})

// ── names in any script (review WR-04, D-07) ────────────────────────────────────────────────────────────────────────────────
// A derived or renamed demon may carry letters of any script (and their combining marks), so the name branch must find it. The
// comparison is NFC and case-folded on both sides. Every non-ASCII string is built from code points, never typed.
describe('parseDemonQuery: names in any script (WR-04)', () => {
  const cp = (...codes: number[]): string => String.fromCodePoint(...codes)
  const renamed = (name: string, mesh = 5): NameOf => nameOfOf(setOverride(generatedNaming(28), mesh, name, null))

  const ntilde = cp(0xd1) // N with tilde
  const NONO = ntilde + 'o' + cp(0xf1) + 'o' // N-tilde o n-tilde o
  const nono = cp(0xf1) + 'o' + cp(0xf1) + 'o'
  const decomposedNono = 'n' + cp(0x303) + 'o' + 'n' + cp(0x303) + 'o'
  const DDD = cp(0x414, 0x434, 0x434) // Cyrillic, capital first
  const ddd = cp(0x434, 0x434, 0x434)

  it('finds a renamed Latin-with-accents demon by its lower-case, upper-case and decomposed spelling', () => {
    const nameOf = renamed(NONO)
    expect(parseDemonQuery(nono, g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(NONO.toUpperCase(), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(NONO, g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(decomposedNono, g28, nameOf)).toEqual({ kind: 'name', mesh: 5 }) // NFD typed, NFC stored
    expect(parseDemonQuery(nono.slice(0, 2), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 }) // a prefix
  })

  it('finds a renamed Cyrillic demon, exact and by prefix', () => {
    const nameOf = renamed(DDD)
    expect(parseDemonQuery(ddd, g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(ddd.slice(0, 2), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(DDD.toUpperCase(), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
  })

  it('finds a CJK name and a Devanagari name (a letter plus a vowel sign) by prefix', () => {
    const han = cp(0x4e2d, 0x6587, 0x540d)
    expect(parseDemonQuery(han, g28, renamed(han))).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(cp(0x4e2d), g28, renamed(han))).toEqual({ kind: 'name', mesh: 5 })
    const deva = cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947) // na ma sa virama ta e-sign
    expect(parseDemonQuery(deva, g28, renamed(deva))).toEqual({ kind: 'name', mesh: 5 })
    expect(parseDemonQuery(deva.slice(0, 3), g28, renamed(deva))).toEqual({ kind: 'name', mesh: 5 })
  })

  it('a capital Greek sigma ending a typed prefix matches the sigma inside the name (final-sigma folding)', () => {
    const odysseus = cp(0x39f, 0x3b4, 0x3c5, 0x3c3, 0x3c3, 0x3b5, 0x3c5, 0x3c2) // Odusseus, ending in a final sigma
    const nameOf = renamed(odysseus)
    expect(parseDemonQuery(cp(0x39f, 0x394, 0x3a5, 0x3a3), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 }) // capitals, last is SIGMA
    expect(parseDemonQuery(cp(0x3bf, 0x3b4, 0x3c5, 0x3c2), g28, nameOf)).toEqual({ kind: 'name', mesh: 5 }) // typed with a final sigma
    expect(parseDemonQuery(odysseus, g28, nameOf)).toEqual({ kind: 'name', mesh: 5 })
  })

  it('an unknown name in another script is not-found where a naming is given, and syntax where none is', () => {
    expect(parseDemonQuery(DDD, g28, generatedNaming28NameOf())).toEqual({ kind: 'not-found' })
    expect(parseDemonQuery(DDD, g28)).toEqual({ kind: 'syntax' }) // no name table at base 28 without a naming: as for an ASCII word
    expect(parseDemonQuery(DDD, g10)).toEqual({ kind: 'not-found' }) // base 10 has the CCRU table
  })

  it('shapes that are not a name stay syntax: digits and punctuation mixed in, a full-width digit, a bidi control, an emoji', () => {
    const nameOf = renamed(NONO)
    for (const text of [nono + '1', nono + '!', cp(0xff19), cp(0x202e) + nono, cp(0x1f600), nono + ' ' + nono, 'a_b']) {
      expect(parseDemonQuery(text, g28, nameOf), JSON.stringify(text)).toEqual({ kind: 'syntax' })
    }
  })

  it('resolves to a row through resolveDemonSearch, and an unknown non-ASCII name keeps the not-found copy', () => {
    const nameOf = renamed(NONO)
    const found = resolveDemonSearch(nono, g28, null, DEFAULT_DEMON_SORT, nameOf)
    expect(found.kind).toBe('found')
    if (found.kind !== 'found') throw new Error('expected found')
    expect(found.demon.mesh).toBe(5)
    const missing = resolveDemonSearch(DDD, g28, null, DEFAULT_DEMON_SORT, nameOf)
    expect(missing).toEqual({ kind: 'not-found', echo: DDD })
    expect(searchMessage(missing, null, g28.demons.count)?.heading).toBe(`No demon found for “${DDD}”.`)
    // a query that is neither a name, a number nor valid syntax keeps its message
    const syntax = resolveDemonSearch('1e3', g28, null, DEFAULT_DEMON_SORT, nameOf)
    expect(searchMessage(syntax, null, g28.demons.count)?.heading).toBe("Couldn't parse “1e3” — try a mesh number (e.g. 108) or an a::b pair (e.g. 12::3).")
  })

  it('the 64-character clamp and the 50,000-demon cap still hold', () => {
    const nameOf = renamed(NONO)
    expect(parseDemonQuery(NONO.repeat(40), g28, nameOf)).toEqual({ kind: 'syntax' }) // clamped to 64, longer than 32 letters
    let calls = 0
    const counting: NameOf = () => {
      calls++
      return NONO
    }
    expect(parseDemonQuery(NONO, g666, counting)).toEqual({ kind: 'syntax' })
    expect(calls).toBe(0)
  })
})

function generatedNaming28NameOf(): NameOf {
  return nameOfOf(generatedNaming(28))
}

// ── the identity of a search hit (review IN-17) ─────────────────────────────────────────────────────────────────────────────
// The browser reveals (scrolls to) a search hit when the HIT changes. Every naming change builds a new nameOf function and so a new
// outcome object, which used to count as a fresh hit and jumped the list back to it; searchHitKey names the hit itself.
describe('searchHitKey', () => {
  const generated = nameOfOf(generatedNaming(28))

  it('is the same for the same hit found through another naming (a rename of some other demon)', () => {
    const renamed = nameOfOf(setOverride(generatedNaming(28), 200, 'Zorb', null))
    const a = resolveDemonSearch('12', g28, null, DEFAULT_DEMON_SORT, generated)
    const b = resolveDemonSearch('12', g28, null, DEFAULT_DEMON_SORT, renamed)
    expect(a).not.toBe(b)
    expect(searchHitKey('12', a, null, DEFAULT_DEMON_SORT)).not.toBeNull()
    expect(searchHitKey('12', a, null, DEFAULT_DEMON_SORT)).toBe(searchHitKey('12', b, null, DEFAULT_DEMON_SORT))
  })

  it('differs when the query, the demon hit, the filter or the sort differs', () => {
    const at = (q: string, filter: Parameters<typeof resolveDemonSearch>[2] = null, sort = DEFAULT_DEMON_SORT) =>
      searchHitKey(q, resolveDemonSearch(q, g28, filter, sort, generated), filter, sort)
    const base = at('12')
    expect(at('13')).not.toBe(base)
    expect(at('12', null, { key: 'mesh', direction: 'desc' })).not.toBe(base)
    expect(at('12', null, { key: 'type', direction: 'asc' })).not.toBe(base)
    // the same demon by its mesh number and by its net-span is a different query text, so Enter-free retyping still reveals
    const [hi, lo] = g28.demons.netSpanOf(12)
    expect(at(`${hi.toString(36)}::${lo.toString(36)}`)).not.toBe(base)
  })

  it('a rename that moves the hit to another demon changes the key (the browser then reveals the new hit)', () => {
    const name5 = nameOfOf(setOverride(generatedNaming(28), 5, 'Zorb', null))
    const name9 = nameOfOf(setOverride(generatedNaming(28), 9, 'Zorb', null))
    const first = resolveDemonSearch('zorb', g28, null, DEFAULT_DEMON_SORT, name5)
    const second = resolveDemonSearch('zorb', g28, null, DEFAULT_DEMON_SORT, name9)
    expect(searchHitKey('zorb', first, null, DEFAULT_DEMON_SORT)).not.toBe(searchHitKey('zorb', second, null, DEFAULT_DEMON_SORT))
  })

  it('is null for every outcome that is not a hit in the list', () => {
    expect(searchHitKey('', resolveDemonSearch('', g28, null, DEFAULT_DEMON_SORT, generated), null, DEFAULT_DEMON_SORT)).toBeNull()
    expect(searchHitKey('9999', resolveDemonSearch('9999', g28, null, DEFAULT_DEMON_SORT, generated), null, DEFAULT_DEMON_SORT)).toBeNull()
    expect(searchHitKey('1e3', resolveDemonSearch('1e3', g28, null, DEFAULT_DEMON_SORT, generated), null, DEFAULT_DEMON_SORT)).toBeNull()
    const demon = g28.demons.at(3)
    expect(searchHitKey('3', { kind: 'outside-filter', demon, echo: '3' }, 'chrono', DEFAULT_DEMON_SORT)).toBeNull()
  })
})
