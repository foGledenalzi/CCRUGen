import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_LORE,
  DEMON_NAMES,
  GATE_LORE,
  PLANET_SYMBOL,
  SYZYGY_LORE,
  ZONE_CLR,
  ZONE_META,
  ZONE_PARTICLE,
} from '../../app/presets/base10/lore'
import { createNumogram } from '../../engine/index'
import { LORE_HEADER } from '../../scripts/check-repo.mjs'

// MIG-01 / D-06 / D-07: the base-10 lore lives in one typed module keyed by numeric engine ids. This file proves
//   (1) the header the licence guard expects is on line 1,
//   (2) the key sets are EXACTLY the engine's base-10 ids (nothing missing, nothing orphaned),
//   (3) the joins the viewer relies on are consistent (a syzygy's demon is its syzygetic demon, a zone's lemurs
//       are its demons),
//   (4) the names agree with the frozen numeric oracle.
// The text of the lore is third-party CCRU-derived material: it was moved unchanged (proved equal to the pre-move
// app/data files field by field while both existed, see the 02-07 summary) and is never edited.

const g = createNumogram(10)

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as {
  currents: { name: string; pair: [number, number] }[]
  demons: { a: number; b: number; name: string }[]
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)
const zoneIds = range(g.zoneCount)
const pairIds = range(g.pairCount)
const meshIds = range(g.demons.count).map((m) => g.demons.at(m).mesh)

const CANONICAL = /^(0|[1-9]\d*)$/

/** Keys of a table that are not canonical non-negative integer strings, the missing ids and the orphaned keys. */
function keyProblems(table: object, ids: readonly number[]): { bad: string[]; missing: number[]; orphans: number[] } {
  const keys = Object.keys(table)
  const bad = keys.filter((k) => !CANONICAL.test(k))
  const present = new Set(keys.filter((k) => CANONICAL.test(k)).map(Number))
  const wanted = new Set(ids)
  return {
    bad,
    missing: ids.filter((id) => !present.has(id)),
    orphans: [...present].filter((id) => !wanted.has(id)).sort((x, y) => x - y),
  }
}

const NONE = { bad: [], missing: [], orphans: [] }

describe('the keyProblems check itself (so coverage cannot pass vacuously)', () => {
  it('reports a missing id, an orphaned key and a non-canonical key', () => {
    expect(keyProblems({ 0: 'a', 2: 'b' }, [0, 1])).toEqual({ bad: [], missing: [1], orphans: [2] })
    expect(keyProblems({ '01': 'a', 1: 'b' }, [0, 1])).toEqual({ bad: ['01'], missing: [0], orphans: [] })
    expect(keyProblems({ '1.5': 'a', '-1': 'b', x: 'c' }, [1]).bad.sort()).toEqual(['-1', '1.5', 'x'])
    expect(keyProblems({ 0: 'a', 1: 'b' }, [0, 1])).toEqual(NONE)
  })
})

describe('engine ids of createNumogram(10)', () => {
  it('are zones 0..9, pair ids 0..4 and mesh numbers 0..44', () => {
    expect(zoneIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(pairIds).toEqual([0, 1, 2, 3, 4])
    expect(g.demons.count).toBe(45)
    expect(meshIds).toEqual(range(45))
  })
})

describe('lore module header', () => {
  it('line 1 is exactly the licence header the check-repo guard expects', () => {
    const text = readFileSync(fileURLToPath(new URL('../../app/presets/base10/lore.ts', import.meta.url)), 'utf8')
    expect(text.split(/\r?\n/, 1)[0]).toBe(LORE_HEADER)
    expect(LORE_HEADER).toBe('// CCRU-derived lore. Not covered by the MIT license; see NOTICE.')
  })
})

describe('coverage: every engine base-10 id has lore and no lore entry is orphaned', () => {
  it.each([
    ['ZONE_CLR', ZONE_CLR, zoneIds],
    ['ZONE_PARTICLE', ZONE_PARTICLE, zoneIds],
    ['PLANET_SYMBOL', PLANET_SYMBOL, zoneIds],
    ['ZONE_META', ZONE_META, zoneIds],
    ['GATE_LORE', GATE_LORE, zoneIds],
    ['SYZYGY_LORE', SYZYGY_LORE, pairIds],
    ['CURRENT_LORE', CURRENT_LORE, pairIds],
    ['DEMON_NAMES', DEMON_NAMES, meshIds],
  ] as const)('%s has exactly the engine ids, all canonical integer keys', (_name, table, ids) => {
    expect(keyProblems(table, ids)).toEqual(NONE)
  })

  it('has non-empty strings in the string-valued tables', () => {
    for (const table of [ZONE_CLR, ZONE_PARTICLE, PLANET_SYMBOL, DEMON_NAMES]) {
      for (const [id, text] of Object.entries(table)) {
        expect(typeof text, `id ${id}`).toBe('string')
        expect(text.trim().length, `id ${id}`).toBeGreaterThan(0)
      }
    }
  })

  it('has non-empty name, desc, detail and demon fields in the syzygy, current and gate lore', () => {
    const nonEmpty = (label: string, id: string, text: unknown) => {
      expect(typeof text, `${label} ${id}`).toBe('string')
      expect((text as string).trim().length, `${label} ${id}`).toBeGreaterThan(0)
    }
    for (const [id, s] of Object.entries(SYZYGY_LORE)) {
      nonEmpty('syzygy demon', id, s.demon)
      nonEmpty('syzygy desc', id, s.desc)
    }
    for (const [id, c] of Object.entries(CURRENT_LORE)) {
      nonEmpty('current name', id, c.name)
      nonEmpty('current desc', id, c.desc)
    }
    for (const [id, gate] of Object.entries(GATE_LORE)) {
      nonEmpty('gate desc', id, gate.desc)
      nonEmpty('gate detail', id, gate.detail)
    }
  })

  it('types every ZoneMeta field (string fields may legitimately be empty, the lore is never edited)', () => {
    for (const [id, meta] of Object.entries(ZONE_META)) {
      for (const field of ['planet', 'planetFull', 'desc', 'spinal', 'meshTag', 'door', 'lemurian', 'centauri'] as const) {
        expect(typeof meta[field], `zone ${id} ${field}`).toBe('string')
      }
      expect(Number.isInteger(meta.phaseCount), `zone ${id} phaseCount`).toBe(true)
      expect(Array.isArray(meta.lemurs), `zone ${id} lemurs`).toBe(true)
      for (const lemur of meta.lemurs) expect(typeof lemur, `zone ${id} lemur`).toBe('string')
    }
  })
})

describe('consistency of the joins', () => {
  it('a syzygy demon is the demon of its syzygetic mesh number (hi::lo)', () => {
    for (const p of pairIds) {
      const mesh = g.demons.meshOf(g.pair(p).hi, p)
      expect(g.demons.at(mesh).syzygetic).toBe(true)
      expect(SYZYGY_LORE[p].demon, `pair ${p}`).toBe(DEMON_NAMES[mesh])
    }
  })

  it('a current is named by the pair it flows out of: the lore name of pair p is the golden name', () => {
    for (const p of pairIds) expect(CURRENT_LORE[p].name).toBe(golden.currents.find((c) => c.pair[0] === p)?.name)
  })

  it("each zone's lemurs list is the demons z::b (b < z) with the names of DEMON_NAMES", () => {
    for (const z of zoneIds) {
      const expected = range(z).map((b) => `${z}::${b} ${DEMON_NAMES[g.demons.meshOf(z, b)]}`)
      expect(ZONE_META[z].lemurs, `zone ${z}`).toEqual(expected)
    }
  })
})

describe('agreement with the frozen numeric oracle (base10.golden.json)', () => {
  it('has 45 golden demons in mesh order and DEMON_NAMES[m] is the name of golden demon m', () => {
    expect(golden.demons).toHaveLength(45)
    for (let m = 0; m < 45; m++) {
      const d = golden.demons[m]
      expect(g.demons.meshOf(d.a, d.b), `golden demon ${m}`).toBe(m)
      expect(DEMON_NAMES[m], `mesh ${m}`).toBe(d.name)
    }
  })

  it('CURRENT_LORE[pair].name equals the golden current name for all five currents', () => {
    expect(golden.currents).toHaveLength(5)
    for (const c of golden.currents) expect(CURRENT_LORE[c.pair[0]].name, `current ${c.name}`).toBe(c.name)
  })
})
