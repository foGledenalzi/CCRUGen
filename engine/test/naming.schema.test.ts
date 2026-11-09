// NAM-03 the versioned naming file `ccrug.naming/1` (plan 07-08, 07-RESEARCH Pattern 6). Part 1: the constants and the
// deterministic serializer. Part 2 (below, added with the validator): the all-or-nothing, never-throwing, prototype-safe reader.
// Everything here is built from definitions and neutral made-up texts: no CCRU sound or name appears, and no generated sound is
// pinned (the banks have their own signed-off vectors in naming.vectors.test.ts).
import { describe, expect, it } from 'vitest'
import { createNaming } from '../naming/derive'
import { editSound, setOverride, toggleLock } from '../naming/edit'
import { GENERATOR_ID } from '../naming/generate'
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
import type { Naming } from '../naming/types'

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
