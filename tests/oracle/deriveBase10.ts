// Derives the frozen base-10 numeric oracle from the untouched upstream data.
// Records what the viewer shows today; never "fix" values here.
//
// App-side helper: it imports app code by relative path so that engine/ never imports app/.
// Nothing in the derivation depends on the date, the timezone or the locale.

import { ALL_DEMONS, TC } from '../../app/data/demons'
import { CURRENTS } from '../../app/data/currents'
import { GATE_LIST } from '../../app/data/gates'
import {
  CENTER,
  P_LABYRINTH,
  P_LADDER,
  P_ORIGINAL,
  PLANETARY_CX,
  PLANETARY_CY,
  PLANETARY_DEFAULT_ANGLE,
  PLANETARY_RADIUS,
  PLANETARY_SIZE,
} from '../../app/data/positions'
import { SYZYGIES } from '../../app/data/syzygies'
import type { Layout, Pos, Region } from '../../app/data/types'
import { ZONE_REGION } from '../../app/data/zones'
import { TC_CURRENTS, TC_EDGES, TC_SYZYGIES } from '../../app/lib/constants'
import { computePlanetaryPositions } from '../../app/lib/planetary'

export type Pair = [number, number]

export interface OracleCurrent {
  name: string
  pair: Pair
  from: number
  to: number
}

export interface OracleGate {
  name: string
  from: number
  to: number
  cum: number
}

export interface OracleDemon {
  a: number
  b: number
  netSpan: string
  kind: string
  name: string
}

export interface Base10Oracle {
  schema: 1
  base: 10
  source: string
  zoneCount: number
  pairs: Pair[]
  currents: OracleCurrent[]
  gates: OracleGate[]
  zoneRegion: Record<number, Region>
  regions: { plex: number[]; torque: number[]; warp: number[] }
  tc: { zones: number[]; edges: Pair[]; currents: string[]; syzygies: Pair[] }
  demons: OracleDemon[]
  demonCount: number
  kinds: Record<string, number>
  syzygeticBy: Record<string, number>
  amphiBy: Record<string, number>
  layouts: {
    original: Record<number, Pos>
    labyrinth: Record<number, Pos>
    ladder: Record<number, Pos>
  }
  center: Record<Layout, Pos>
  planetary: {
    cx: number
    cy: number
    radius: Record<number, number>
    defaultAngle: Record<number, number>
    size: Record<number, number>
    positionsAtDefaultAngle: Record<number, Pos>
  }
}

const sortedPair = (a: number, b: number): Pair => (a < b ? [a, b] : [b, a])

const copyPositions = (src: Record<number, Pos>): Record<number, Pos> => {
  const out: Record<number, Pos> = {}
  for (const key of Object.keys(src)) {
    const z = Number(key)
    const p = src[z]
    if (p === undefined) throw new Error(`position missing for zone ${z}`)
    out[z] = { x: p.x, y: p.y }
  }
  return out
}

/** Counts, with keys inserted in alphabetical order so the JSON text is stable. */
const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> => {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out: Record<string, number> = {}
  for (const k of Array.from(counts.keys()).sort()) out[k] = counts.get(k) ?? 0
  return out
}

const numeric = (a: number, b: number): number => a - b

export function deriveBase10Oracle(): Base10Oracle {
  const pairs: Pair[] = SYZYGIES.map((s) => sortedPair(s.a, s.b))

  const currents: OracleCurrent[] = CURRENTS.map((c) => {
    const pair = pairs.find((p) => p[0] === c.from || p[1] === c.from)
    if (pair === undefined) throw new Error(`zone ${c.from} is in no syzygy pair`)
    return { name: c.name, pair: [pair[0], pair[1]], from: c.from, to: c.to }
  })

  const gates: OracleGate[] = GATE_LIST.map((g) => ({ name: g.name, from: g.from, to: g.to, cum: g.cum }))

  const zoneCount = Object.keys(ZONE_REGION).length
  const zoneRegion: Record<number, Region> = { ...ZONE_REGION }

  const regions: { plex: number[]; torque: number[]; warp: number[] } = { plex: [], torque: [], warp: [] }
  for (let z = 0; z <= 9; z++) {
    const region = ZONE_REGION[z]
    if (region === undefined) throw new Error(`zone ${z} has no region`)
    regions[region].push(z)
  }

  const tc = {
    zones: Array.from(TC).sort(numeric),
    edges: TC_EDGES.map((e): Pair => [e[0], e[1]]),
    currents: Array.from(TC_CURRENTS).sort(),
    syzygies: TC_SYZYGIES.map((e): Pair => [e[0], e[1]]),
  }

  const demons: OracleDemon[] = ALL_DEMONS.map((d) => ({
    a: d.a,
    b: d.b,
    netSpan: `${d.a}::${d.b}`,
    kind: d.kind,
    name: d.name,
  }))

  const kinds = countBy(ALL_DEMONS, (d) => d.kind)

  const syzygeticBy = countBy(
    ALL_DEMONS.filter((d) => d.kind === 'syzygy'),
    (d) => (TC.has(d.a) && TC.has(d.b) ? 'chrono' : !TC.has(d.a) && !TC.has(d.b) ? 'xeno' : 'mixed'),
  )

  const amphiBy = countBy(
    ALL_DEMONS.filter((d) => d.kind === 'amphi'),
    (d) => {
      const outside = TC.has(d.a) ? d.b : d.a
      const region = ZONE_REGION[outside]
      if (region === undefined) throw new Error(`zone ${outside} has no region`)
      return region
    },
  )

  const positionsAtDefaultAngle = computePlanetaryPositions(PLANETARY_DEFAULT_ANGLE)

  return {
    schema: 1,
    base: 10,
    source: 'app/data/* and app/lib/{planetary,constants}.ts at upstream commit 7c38ad9 (untouched viewer)',
    zoneCount,
    pairs,
    currents,
    gates,
    zoneRegion,
    regions,
    tc,
    demons,
    demonCount: ALL_DEMONS.length,
    kinds,
    syzygeticBy,
    amphiBy,
    layouts: {
      original: copyPositions(P_ORIGINAL),
      labyrinth: copyPositions(P_LABYRINTH),
      ladder: copyPositions(P_LADDER),
    },
    center: {
      labyrinth: { x: CENTER.labyrinth.x, y: CENTER.labyrinth.y },
      ladder: { x: CENTER.ladder.x, y: CENTER.ladder.y },
      original: { x: CENTER.original.x, y: CENTER.original.y },
      planetary: { x: CENTER.planetary.x, y: CENTER.planetary.y },
    },
    planetary: {
      cx: PLANETARY_CX,
      cy: PLANETARY_CY,
      radius: { ...PLANETARY_RADIUS },
      defaultAngle: { ...PLANETARY_DEFAULT_ANGLE },
      size: { ...PLANETARY_SIZE },
      positionsAtDefaultAngle: copyPositions(positionsAtDefaultAngle),
    },
  }
}
