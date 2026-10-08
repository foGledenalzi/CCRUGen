// Lore-free numogram summary (moved from numogramView.ts in Phase 6 so the worker bundle carries no base-10 lore, research P11). Original CCRUG code (MIT, NOTICE section 1).
import type { Numogram } from '../../engine/index'

export const SUMMARY_TORQUE_LIMIT = 12

export interface NumogramSummary {
  readonly base: number
  readonly zoneCount: number
  readonly hasWarp: boolean
  readonly torqueCount: number
  readonly torqueLengths: readonly number[]
  readonly demonCount: number
  readonly typeCounts: Readonly<{ chrono: number; amphi: number; xeno: number }>
}

/**
 * A cheap summary of `g`: safe at any base, including a huge one, because it reads at most SUMMARY_TORQUE_LIMIT
 * Torque cycles through `cycleAt` (never materializing `g.torques`/`g.cycles`) and the virtual demon space's O(1)
 * `count`/`typeCounts()` (T-04-08).
 */
export function summarize(g: Numogram): NumogramSummary {
  const torqueCount = g.torqueCount
  const limit = Math.min(torqueCount, SUMMARY_TORQUE_LIMIT)
  const torqueLengths: number[] = []
  for (let i = 0; i < limit; i++) torqueLengths.push(g.cycleAt(i).lengthInPairs)
  const typeCounts = g.demons.typeCounts()
  return {
    base: g.base,
    zoneCount: g.zoneCount,
    hasWarp: g.warp !== null,
    torqueCount,
    torqueLengths,
    demonCount: g.demons.count,
    typeCounts: { chrono: typeCounts.chrono, amphi: typeCounts.amphi, xeno: typeCounts.xeno },
  }
}
