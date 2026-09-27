// Base-10 syzygies for the viewer (MIG-01, plan 02-08). Original CCRUG code (MIT, NOTICE section 1); the text is in lore.ts.
// Structure (a = low zone, b = high zone) comes from the engine pairs of createNumogram(10); demon name and description
// are joined by pair id from the lore module.
import type { SyzygyData } from '../../data/types'
import { SYZYGY_LORE } from './lore'
import { BASE10 } from './numogram'

function buildSyzygies(): SyzygyData[] {
  const list: SyzygyData[] = []
  // Upstream panel order: pair ids descending (4::5 first, 0::9 last).
  for (let id = BASE10.pairCount - 1; id >= 0; id--) {
    const pair = BASE10.pair(id)
    const lore = SYZYGY_LORE[id]
    if (lore === undefined) throw new Error('base-10 lore missing for syzygy ' + id)
    list.push({ a: pair.lo, b: pair.hi, demon: lore.demon, desc: lore.desc })
  }
  return list
}

export const SYZYGIES: SyzygyData[] = buildSyzygies()
