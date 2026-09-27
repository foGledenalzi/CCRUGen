// Base-10 currents for the viewer (MIG-01, plan 02-09). Original CCRUG code (MIT, NOTICE section 1); the text is in lore.ts.
// Structure comes from the engine pairs and currents of createNumogram(10): the order of the cycles, `to` (= hi - lo) and
// the in-base label `hi−lo=to`; name and description are joined by pair id from the lore module.
import { formatNumeral } from '../../../engine/index'
import type { CurrentData } from '../../data/types'
import { CURRENT_LORE } from './lore'
import { BASE10 } from './numogram'

// U+2212 MINUS SIGN (−), the character the viewer's current labels use; not the ASCII hyphen-minus.
const MINUS = '\u2212'

/**
 * The zone the upstream viewer draws a current from: the pair's even member, except the Plex pair (its low zone is 0),
 * which folds back into its high zone. This is the upstream drawing convention, not canonical numogram data. It is kept
 * here so the rendering stays byte-identical to the frozen goldens; Phase 4 replaces it with engine-driven routing.
 */
export function legacyCurrentFrom(pairId: number): number {
  const pair = BASE10.pair(pairId)
  return pair.lo === 0 ? pair.hi : pair.even
}

/** Pair ids in the viewer's order: the Torque cycles in canonical order (each in flow order), then the Warp, then the Plex. */
function currentPairIds(): number[] {
  return [
    ...BASE10.torques.flatMap((cycle) => Array.from(cycle.pairs())),
    ...(BASE10.warp === null ? [] : [BASE10.warp.firstPair]),
    BASE10.plex.firstPair,
  ]
}

function buildCurrents(): CurrentData[] {
  const base = BASE10.base
  return currentPairIds().map((pairId) => {
    const lore = CURRENT_LORE[pairId]
    if (lore === undefined) throw new Error('base-10 lore missing for current ' + pairId)
    const { lo, hi, to } = BASE10.current(pairId)
    const label = formatNumeral(hi, base) + MINUS + formatNumeral(lo, base) + '=' + formatNumeral(to, base)
    return { name: lore.name, from: legacyCurrentFrom(pairId), to, label, desc: lore.desc }
  })
}

export const CURRENTS: CurrentData[] = buildCurrents()
