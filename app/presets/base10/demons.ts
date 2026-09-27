// Base-10 demons for the viewer (MIG-01, plan 02-12). Original CCRUG code (MIT, NOTICE section 1); the names are in lore.ts.
// The 45 demons come from the engine's virtual demon space of createNumogram(10): mesh number 0 (1::0) up to 44 (9::8), in
// ascending order, each named by the lore module through its mesh number. This is a base-10 compatibility list, computed once
// at load; it is never a way to materialize the demons of another base (the generic engine keeps them virtual, and Phases 4
// and 5 replace this list with the engine-driven demon browser).
import type { DemonSubtype } from '../../../engine/index'
import type { Demon } from '../../data/types'
import { DEMON_NAMES } from './lore'
import { BASE10 } from './numogram'

/** The viewer's own demon classes: the five nine-sum demons are a class of their own next to chrono, amphi and xeno. */
export type LegacyDemonKind = 'syzygy' | 'chrono' | 'amphi' | 'xeno'

/**
 * The viewer's `kind` of a demon, from the engine's subtype. The pandemonium layer hides the 'syzygy' kind, so this mapping
 * decides which demons are drawn: the syzygetic demons (chrono and xeno, a + b = base - 1) are 'syzygy'; cyclic and
 * cross-Torque chronodemons are both 'chrono'; Plex and Warp amphidemons are 'amphi'; chaotic xenodemons are 'xeno'.
 */
export function legacyKind(subtype: DemonSubtype): LegacyDemonKind {
  switch (subtype) {
    case 'syzygetic-chrono':
    case 'syzygetic-xeno':
      return 'syzygy'
    case 'cyclic-chrono':
    case 'cross-torque-chrono':
      return 'chrono'
    case 'plex-amphi':
    case 'warp-amphi':
      return 'amphi'
    case 'chaotic-xeno':
      return 'xeno'
    default: {
      const unknown: never = subtype
      throw new Error('base-10 preset: unknown demon subtype ' + String(unknown))
    }
  }
}

function buildDemons(): Demon[] {
  const list: Demon[] = []
  for (let mesh = 0; mesh < BASE10.demons.count; mesh++) {
    const demon = BASE10.demons.at(mesh)
    const name = DEMON_NAMES[mesh]
    if (name === undefined) throw new Error('base-10 lore missing for demon mesh ' + mesh)
    list.push({ a: demon.a, b: demon.b, name, kind: legacyKind(demon.subtype) })
  }
  return list
}

export const ALL_DEMONS: Demon[] = buildDemons()
