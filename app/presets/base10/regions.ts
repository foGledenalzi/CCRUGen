// Base-10 region data for the viewer (MIG-01, plan 02-11). Original CCRUG code (MIT, NOTICE section 1); the text is in lore.ts.
// Derived from the engine's regions (Cycle[]) of createNumogram(10): every zone gets the kind of its cycle, and the Torque
// (time-circuit) constants come from the Torque cycle's pair and zone walk. The engine allows any number of Torque cycles;
// base 10 has exactly one (asserted in ./numogram), which is what the viewer's single-Torque shapes rely on. Phase 4 replaces
// these shapes with engine-driven regions.
import type { Region } from '../../data/types'
import { CURRENT_LORE } from './lore'
import { BASE10 } from './numogram'

const TORQUE = BASE10.torques[0]
if (TORQUE === undefined) throw new Error('base-10 preset: no Torque cycle')

/** Zone -> region kind, read from the cycle each zone belongs to (zones 0 .. n - 1, ascending). */
const buildZoneRegion = (): Record<number, Region> => {
  const out: Record<number, Region> = {}
  for (let zone = 0; zone < BASE10.zoneCount; zone++) out[zone] = BASE10.cycleOfZone(zone).kind
  return out
}

/** The Torque zones (every Torque cycle's zones), ascending. */
const buildTorqueZones = (): Set<number> => {
  const zones = BASE10.torques.flatMap((cycle) => Array.from(cycle.zones()))
  return new Set(zones.sort((a, b) => a - b))
}

/** The Torque cycle's walk as directed edges, closed: odd member then even member of each pair in flow order, back to the start. */
const buildTorqueEdges = (): [number, number][] => {
  const walk = Array.from(TORQUE.zones())
  return walk.map((zone, i): [number, number] => [zone, walk[(i + 1) % walk.length] as number])
}

/** The Torque pairs as [low zone, high zone], in flow order. */
const buildTorqueSyzygies = (): [number, number][] =>
  Array.from(TORQUE.pairs()).map((pairId): [number, number] => {
    const { lo, hi } = BASE10.pair(pairId)
    return [lo, hi]
  })

/** The names of the Torque pairs' currents (lore, by pair id), in flow order. */
const buildTorqueCurrents = (): Set<string> =>
  new Set(
    Array.from(TORQUE.pairs()).map((pairId) => {
      const lore = CURRENT_LORE[pairId]
      if (lore === undefined) throw new Error('base-10 lore missing for current ' + pairId)
      return lore.name
    }),
  )

export const ZONE_REGION: Record<number, Region> = buildZoneRegion()
export const TC: Set<number> = buildTorqueZones()
export const TC_EDGES: [number, number][] = buildTorqueEdges()
export const TC_SYZYGIES: [number, number][] = buildTorqueSyzygies()
export const TC_CURRENTS: Set<string> = buildTorqueCurrents()
