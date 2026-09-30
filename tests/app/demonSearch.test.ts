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
