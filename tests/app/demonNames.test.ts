// Tests for app/lib/demonBrowser.ts's base-10 name join (DEM-05). Reads the frozen numeric oracle
// (engine/test/fixtures/base10.golden.json) read-only, never written — the same pattern as
// tests/presets/base10-adapter.test.ts. Names come only from app/presets/base10/lore.ts's DEMON_NAMES by mesh id.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { demonName, demonNameTable, legacyDemon, netSpanLabel } from '../../app/lib/demonBrowser'
import { DEMON_NAMES } from '../../app/presets/base10/lore'
import { formatZoneLabel, DEFAULT_LABEL_SCHEME } from '../../app/lib/labelScheme'

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as {
  demons: { a: number; b: number; netSpan: string; kind: string; name: string }[]
}

describe('demonName / demonNameTable', () => {
  it('golden fixture has all 45 base-10 demons', () => {
    expect(golden.demons).toHaveLength(45)
  })

  it('demonName(10, mesh) equals the frozen oracle name for every one of the 45 demons', () => {
    const g10 = createNumogram(10)
    expect(golden.demons).toHaveLength(45)
    for (let mesh = 0; mesh < golden.demons.length; mesh++) {
      const entry = golden.demons[mesh]
      if (entry === undefined) throw new Error(`missing golden demon entry ${mesh}`)
      const d = g10.demons.at(mesh)
      const meshOfAB = g10.demons.meshOf(d.a, d.b)
      expect(meshOfAB).toBe(mesh)
      expect(demonName(10, mesh)).toBe(entry.name)
    }
  })

  it('legacyDemon(g10.demons.at(m), 10) deep-equals the oracle entry shape {a, b, name, kind}', () => {
    const g10 = createNumogram(10)
    for (let mesh = 0; mesh < golden.demons.length; mesh++) {
      const entry = golden.demons[mesh]
      if (entry === undefined) throw new Error(`missing golden demon entry ${mesh}`)
      const d = g10.demons.at(mesh)
      expect(legacyDemon(d, 10)).toEqual({ a: entry.a, b: entry.b, name: entry.name, kind: entry.kind })
    }
  })

  it('demonName is null at every base other than 10', () => {
    expect(demonName(28, 0)).toBeNull()
    expect(demonName(12, 5)).toBeNull()
    expect(demonName(666, 108)).toBeNull()
  })

  it('demonNameTable(10) is the lore module object itself (identity); demonNameTable at any other base is null', () => {
    expect(demonNameTable(10)).toBe(DEMON_NAMES)
    expect(demonNameTable(28)).toBeNull()
  })

  it('legacyDemon falls back to the net-span text at a base with no lore names', () => {
    const g28 = createNumogram(28)
    const d = g28.demons.ref(12, 3)
    expect(legacyDemon(d, 28)).toEqual({ a: 12, b: 3, name: 'c::3', kind: 'chrono' })
  })
})

describe('netSpanLabel', () => {
  it('joins two zone labels with ::, label-scheme aware', () => {
    const label = netSpanLabel(12, 3, z => formatZoneLabel(z, 28, DEFAULT_LABEL_SCHEME))
    expect(label).toBe('c::3')
  })
})
