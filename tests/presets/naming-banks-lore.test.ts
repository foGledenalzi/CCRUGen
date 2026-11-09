// The generator's syllable banks must not reproduce a CCRU zone sound (plan 07-06, licensing decision: the CCRU lore is outside
// the MIT licence, NOTICE section 3). The ten zone sounds are read from the lore file by import and used for comparison only;
// this test never states them, and nothing under engine/ may import them (the engine stays lore-free).
import { describe, expect, it } from 'vitest'
import { ZONE_PARTICLE } from '../../app/presets/base10/lore'
import { SYLLABLE_BANKS, STYLE_IDS } from '../../engine/naming/banks'
import { createGenerator, generateSounds } from '../../engine/naming/generate'

const ZONE_SOUNDS: readonly string[] = Object.values(ZONE_PARTICLE).map(s => s.toLowerCase())

describe('the syllable banks and the CCRU zone sounds', () => {
  it('reads the ten zone sounds from the lore file', () => {
    expect(ZONE_SOUNDS).toHaveLength(10)
    expect(new Set(ZONE_SOUNDS).size).toBe(10)
    for (const s of ZONE_SOUNDS) expect(s).toMatch(/^[a-z]+$/)
  })

  it.each(STYLE_IDS)('%s: no internal or leaf syllable equals a zone sound', style => {
    const bank = SYLLABLE_BANKS[style]
    const hits = [...bank.internal, ...bank.leaf].filter(s => ZONE_SOUNDS.includes(s.toLowerCase()))
    expect(hits).toEqual([])
  })

  it.each(STYLE_IDS)('%s: no sound of depth 1 or 2 (every leaf, every internal + leaf) equals a zone sound', style => {
    const { internal, leaf } = SYLLABLE_BANKS[style]
    const hits: string[] = []
    for (const l of leaf) if (ZONE_SOUNDS.includes(l)) hits.push(l)
    for (const i of internal) for (const l of leaf) if (ZONE_SOUNDS.includes(i + l)) hits.push(i + l)
    expect(hits).toEqual([])
  })

  it.each(STYLE_IDS)('%s: no generated table equals a zone sound, at either seed, for bases 10, 28, 64, 666 and 4000', style => {
    for (const seed of ['ccrug', 'hollow-vector']) {
      const gen = createGenerator(seed, style)
      for (const base of [10, 28, 64, 666, 4000]) {
        const table = generateSounds(gen, base)
        const hits = table.filter(s => ZONE_SOUNDS.includes(s))
        expect(hits, `${style}/${seed}/${base}`).toEqual([])
      }
    }
  })
})
