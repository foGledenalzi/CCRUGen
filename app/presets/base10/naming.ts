// Base-10 CCRU naming preset (NAM-04, Phase 7). Original CCRUG code (MIT, NOTICE section 1); the sounds and names are in lore.ts and
// are read by reference, never copied. The engine takes this object as an argument (Phase 2 D-06): it owns no preset table.
import type { NamingPreset } from '../../../engine/index'
import { DEMON_NAMES, ZONE_PARTICLE } from './lore'
import { BASE10 } from './numogram'

function buildSounds(): readonly string[] {
  const sounds: string[] = []
  for (let z = 0; z < BASE10.zoneCount; z++) {
    const sound = ZONE_PARTICLE[z]
    if (sound === undefined) throw new Error('base-10 lore missing a zone sound for zone ' + z)
    sounds.push(sound)
  }
  return Object.freeze(sounds)
}

/** The CCRU naming of base 10: one sound per zone in zone order, the canonical demon names keyed by mesh number (by reference). */
export const CCRU_NAMING_PRESET: NamingPreset = Object.freeze({
  id: 'ccru',
  base: BASE10.zoneCount,
  sounds: buildSounds(),
  names: DEMON_NAMES,
})
