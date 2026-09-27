// Base-10 gates for the viewer (MIG-01, plan 02-10). Original CCRUG code (MIT, NOTICE section 1); the text is in lore.ts.
// Structure comes from the engine gates of createNumogram(10): the gate of zone k has cumulation T(k) and flows to the
// in-base digital root of T(k) (T(0) goes to 0). All n gates are emitted, Gt-00 included (policy locked in Phase 2: the
// engine emits every gate and the base-10 viewer keeps drawing what it draws today). Each name is written by the engine's
// own-base numeral formatter (D-04), so it reads Gt-00 ... Gt-45 here; description and detail are joined by origin zone
// from the lore module.
import { formatGateName } from '../../../engine/index'
import type { GateData } from '../../data/types'
import { GATE_LORE } from './lore'
import { BASE10 } from './numogram'

function buildGates(): GateData[] {
  const list: GateData[] = []
  // Viewer order: by origin zone, 0 first (Gt-00) to base - 1 last (Gt-45).
  for (let zone = 0; zone < BASE10.zoneCount; zone++) {
    const gate = BASE10.gate(zone)
    const lore = GATE_LORE[zone]
    if (lore === undefined) throw new Error('base-10 lore missing for gate ' + zone)
    list.push({
      name: formatGateName(gate.cumulation, BASE10.base),
      from: gate.from,
      to: gate.to,
      cum: gate.cumulation,
      desc: lore.desc,
      detail: lore.detail,
    })
  }
  return list
}

export const GATE_LIST: GateData[] = buildGates()
