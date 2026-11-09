// The base-10 CCRU naming preset (NAM-04, plan 07-11, orchestrator decision 6). The preset is a thin adapter over lore.ts: the ten
// zone sounds and the 45 canonical names are read by reference (the names object is the very object lore.ts exports), never copied,
// so the CCRU lore stays in its one non-MIT file. This test reads the lore by import and never states a name or a sound itself.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CCRU_LINK_BASE } from '../../app/lib/namesLink'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'
import { DEMON_NAMES, ZONE_PARTICLE } from '../../app/presets/base10/lore'
import { BASE10 } from '../../app/presets/base10/numogram'
import { createNameResolver, createNaming, netSpanOf } from '../../engine/index'

const PRESET_DIR = fileURLToPath(new URL('../../app/presets/base10/', import.meta.url))

describe('CCRU_NAMING_PRESET', () => {
  it('is the ccru preset of base 10, with the base the link codec uses for names=ccru', () => {
    expect(CCRU_NAMING_PRESET.id).toBe('ccru')
    expect(CCRU_NAMING_PRESET.base).toBe(BASE10.zoneCount)
    expect(CCRU_NAMING_PRESET.base).toBe(CCRU_LINK_BASE)
  })

  it('reads the 45 canonical names by reference: the names object is lore.ts DEMON_NAMES itself', () => {
    expect(CCRU_NAMING_PRESET.names).toBe(DEMON_NAMES)
    expect(Object.keys(CCRU_NAMING_PRESET.names)).toHaveLength(BASE10.demons.count)
    expect(BASE10.demons.count).toBe(45)
  })

  it('holds the ten zone sounds of lore.ts in zone order, one per zone', () => {
    expect(CCRU_NAMING_PRESET.sounds).toHaveLength(10)
    expect(CCRU_NAMING_PRESET.sounds).toEqual(Object.values(ZONE_PARTICLE))
    for (let z = 0; z < BASE10.zoneCount; z++) expect(CCRU_NAMING_PRESET.sounds[z]).toBe(ZONE_PARTICLE[z])
  })

  it('is frozen, and so is its sounds array', () => {
    expect(Object.isFrozen(CCRU_NAMING_PRESET)).toBe(true)
    expect(Object.isFrozen(CCRU_NAMING_PRESET.sounds)).toBe(true)
    expect(() => {
      ;(CCRU_NAMING_PRESET.sounds as string[]).push('x')
    }).toThrow(TypeError)
    expect(() => {
      ;(CCRU_NAMING_PRESET as { base: number }).base = 12
    }).toThrow(TypeError)
  })

  it('createNaming with source ccru resolves all 45 demons to the canonical name, state preset, all distinct', () => {
    const naming = createNaming({ base: 10, interactiveMaxN: INTERACTIVE_MAX_N, source: 'ccru', preset: CCRU_NAMING_PRESET })
    const resolver = createNameResolver(naming, CCRU_NAMING_PRESET)
    const seen = new Set<string>()
    for (let mesh = 0; mesh < BASE10.demons.count; mesh++) {
      const [a, b] = netSpanOf(mesh)
      const name = resolver.nameOf(a, b)
      expect(name).toBe(DEMON_NAMES[mesh])
      expect(resolver.stateOf(a, b)).toBe('preset')
      expect(resolver.presetNameOf(a, b)).toBe(DEMON_NAMES[mesh])
      seen.add(name)
    }
    expect(seen.size).toBe(45)
    for (let z = 0; z < BASE10.zoneCount; z++) expect(resolver.soundOf(z)).toBe(ZONE_PARTICLE[z])
  })

  it('with source generated at base 10 the preset layer never applies (presetNameOf is null, state generated)', () => {
    const naming = createNaming({ base: 10, interactiveMaxN: INTERACTIVE_MAX_N, source: 'generated', preset: CCRU_NAMING_PRESET })
    const resolver = createNameResolver(naming, CCRU_NAMING_PRESET)
    for (let mesh = 0; mesh < BASE10.demons.count; mesh++) {
      const [a, b] = netSpanOf(mesh)
      expect(resolver.presetNameOf(a, b)).toBeNull()
      expect(resolver.stateOf(a, b)).toBe('generated')
    }
  })
})

describe('app/presets/base10/naming.ts source (the lore scanner reads it as an adapter file)', () => {
  const source = readFileSync(PRESET_DIR + 'naming.ts', 'utf8')

  it('is in the file list the lore scanner walks (every base10 ts file except lore.ts and routes.ts)', () => {
    const scanned = readdirSync(PRESET_DIR).filter(f => f.endsWith('.ts') && !['lore.ts', 'routes.ts'].includes(f))
    expect(scanned).toContain('naming.ts')
  })

  it('imports the lore and exports the names by reference', () => {
    expect(source.split("from './lore'")).toHaveLength(2)
    expect(source.split('names: DEMON_NAMES')).toHaveLength(2)
    expect(source).toContain('DEMON_NAMES')
    expect(source).toContain('ZONE_PARTICLE')
  })

  it('quotes no canonical name and no zone sound', () => {
    for (const text of [...Object.values(DEMON_NAMES), ...Object.values(ZONE_PARTICLE)]) {
      expect(source.includes(`'${text}'`), `single-quoted ${text}`).toBe(false)
      expect(source.includes(`"${text}"`), `double-quoted ${text}`).toBe(false)
    }
  })
})

describe('a gap in the lore is an error, never a silent hole', () => {
  afterEach(() => {
    vi.doUnmock('../../app/presets/base10/lore')
    vi.resetModules()
  })

  it('throws when lore.ts has no sound for a zone', async () => {
    vi.resetModules()
    vi.doMock('../../app/presets/base10/lore', async importOriginal => {
      const actual = await importOriginal<typeof import('../../app/presets/base10/lore')>()
      const zoneParticle: Record<number, string> = { ...actual.ZONE_PARTICLE }
      delete zoneParticle[3]
      return { ...actual, ZONE_PARTICLE: zoneParticle }
    })
    await expect(import('../../app/presets/base10/naming')).rejects.toThrow('base-10 lore missing a zone sound for zone 3')
  })
})
