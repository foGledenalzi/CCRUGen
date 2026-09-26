// Guards the frozen base-10 numeric oracle (FND-02, D-13, D-15).
//
// Two kinds of test live here:
//  1. oracle equality: deriveBase10Oracle() (untouched app/data/*) must equal the frozen JSON;
//  2. definitional regressions: facts checked against the numogram DEFINITIONS written in this file
//     (triangular numbers, digital root in base n, syzygies summing to n-1, currents landing on |a-b|,
//     regions as current cycles, demon classification), never against app/data and never against
//     the local, gitignored reference sources.
//
// The frozen JSON is never regenerated: `vitest -u` does not apply to it and the capture script refuses
// to overwrite it. If this file fails, fix the code that drifted, not the JSON.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type Base10Oracle, deriveBase10Oracle, type Pair } from './deriveBase10'

const FIXTURE = fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url))
const raw = readFileSync(FIXTURE)
const golden = JSON.parse(raw.toString('utf8')) as Base10Oracle

// Definitions (base 10). The digital root is the numogram's own, never a decimal digit sum.
const n = 10
const T = (k: number): number => (k * (k + 1)) / 2
const digitalRoot = (t: number): number => (t === 0 ? 0 : ((t - 1) % (n - 1)) + 1)

type Cycle = Pair[]

const pairKey = (p: Pair): string => `${p[0]}:${p[1]}`

function pairContaining(pairs: Pair[], zone: number): Pair {
  const found = pairs.find((p) => p[0] === zone || p[1] === zone)
  if (found === undefined) throw new Error(`no syzygy pair contains zone ${zone}`)
  return found
}

/** The current out of a syzygy pair lands on |a - b|; the next pair is the one containing that zone. */
function nextPair(pairs: Pair[], p: Pair): Pair {
  return pairContaining(pairs, Math.abs(p[0] - p[1]))
}

/** Cycles of the functional graph pair -> next pair, each rotated to start at its smallest pair. */
function currentCycles(pairs: Pair[]): Cycle[] {
  const done = new Set<string>()
  const cycles: Cycle[] = []
  for (const start of pairs) {
    const walk: Pair[] = []
    let cur = start
    while (!done.has(pairKey(cur)) && !walk.some((w) => pairKey(w) === pairKey(cur))) {
      walk.push(cur)
      cur = nextPair(pairs, cur)
    }
    const at = walk.findIndex((w) => pairKey(w) === pairKey(cur))
    if (at >= 0) {
      const cycle = walk.slice(at)
      const lows = cycle.map((p) => p[0])
      const first = lows.indexOf(Math.min(...lows))
      cycles.push([...cycle.slice(first), ...cycle.slice(0, first)])
    }
    for (const w of walk) done.add(pairKey(w))
  }
  return cycles.sort((x, y) => Math.min(...x.flat()) - Math.min(...y.flat()))
}

type RegionName = 'plex' | 'torque' | 'warp'

/** Region of each cycle: the one containing zone 0 is the plex, a 3-cycle is a torque, the rest are warps. */
function regionOfCycle(cycle: Cycle): RegionName {
  if (cycle.flat().includes(0)) return 'plex'
  return cycle.length === 3 ? 'torque' : 'warp'
}

const cycles = currentCycles(golden.pairs)
const regionByZone = new Map<number, RegionName>()
for (const cycle of cycles) for (const zone of cycle.flat()) regionByZone.set(zone, regionOfCycle(cycle))
const torqueCycle = cycles.find((c) => regionOfCycle(c) === 'torque') ?? []
const tcZones = new Set(torqueCycle.flat())

const regionOf = (zone: number): RegionName => {
  const region = regionByZone.get(zone)
  if (region === undefined) throw new Error(`zone ${zone} is in no cycle`)
  return region
}

describe('fixture file', () => {
  it('is LF only and ends with a newline', () => {
    expect(raw.includes(13)).toBe(false)
    expect(raw[raw.length - 1]).toBe(10)
  })
})

describe('oracle equality', () => {
  const { planetary: gp, ...gRest } = golden
  const { planetary: dp, ...dRest } = deriveBase10Oracle()

  it('the untouched app data derives exactly the frozen JSON (everything but planetary positions)', () => {
    expect(dRest).toEqual(gRest)
  })

  it('planetary constants are exact', () => {
    expect(dp.cx).toBe(gp.cx)
    expect(dp.cy).toBe(gp.cy)
    expect(dp.radius).toEqual(gp.radius)
    expect(dp.defaultAngle).toEqual(gp.defaultAngle)
    expect(dp.size).toEqual(gp.size)
  })

  it('planetary positions at the default angles match within 1e-9', () => {
    expect(Object.keys(dp.positionsAtDefaultAngle)).toEqual(Object.keys(gp.positionsAtDefaultAngle))
    for (const key of Object.keys(gp.positionsAtDefaultAngle)) {
      const z = Number(key)
      const want = gp.positionsAtDefaultAngle[z]
      const got = dp.positionsAtDefaultAngle[z]
      if (want === undefined || got === undefined) throw new Error(`zone ${z} missing`)
      expect(got.x).toBeCloseTo(want.x, 9)
      expect(got.y).toBeCloseTo(want.y, 9)
    }
  })
})

describe('gates', () => {
  it('there is one gate per zone 0..9', () => {
    expect(golden.gates).toHaveLength(10)
  })

  for (let k = 0; k <= 9; k++) {
    it(`zone ${k}: gate ${k} goes to the digital root of T(${k}) = ${T(k)}`, () => {
      const gates = golden.gates.filter((g) => g.from === k)
      expect(gates).toHaveLength(1)
      const gate = gates[0]
      if (gate === undefined) throw new Error(`no gate from zone ${k}`)
      expect(gate.cum).toBe(T(k))
      expect(gate.to).toBe(digitalRoot(T(k)))
      expect(gate.name).toBe(`Gt-${String(T(k)).padStart(2, '0')}`)
    })
  }

  it('Gt-15 is 5 -> 6', () => {
    const gate = golden.gates.find((g) => g.name === 'Gt-15')
    expect(gate).toEqual({ name: 'Gt-15', from: 5, to: 6, cum: 15 })
    expect({ from: gate?.from, to: gate?.to, cum: gate?.cum }).toEqual({ from: 5, to: 6, cum: 15 })
  })

  it('Gt-03 is 2 -> 3', () => {
    const gate = golden.gates.find((g) => g.name === 'Gt-03')
    expect(gate).toEqual({ name: 'Gt-03', from: 2, to: 3, cum: 3 })
    expect({ from: gate?.from, to: gate?.to, cum: gate?.cum }).toEqual({ from: 2, to: 3, cum: 3 })
  })
})

describe('syzygies and currents', () => {
  it('there are five pairs, each summing to n - 1 = 9, with the smaller zone first', () => {
    expect(golden.pairs).toHaveLength(5)
    for (const [a, b] of golden.pairs) {
      expect(a + b).toBe(n - 1)
      expect(a).toBeLessThan(b)
    }
  })

  it('the pairs cover zones 0..9 exactly once', () => {
    const zones = golden.pairs.flat().sort((a, b) => a - b)
    expect(zones).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('there are five currents, one per pair', () => {
    expect(golden.currents).toHaveLength(5)
    expect(golden.currents.map((c) => pairKey(c.pair)).sort()).toEqual(golden.pairs.map(pairKey).sort())
  })

  it('each current starts in its pair and lands on |a - b|', () => {
    for (const c of golden.currents) {
      expect(c.pair).toContain(c.from)
      expect(c.to).toBe(Math.abs(c.pair[0] - c.pair[1]))
    }
  })
})

describe('regions as current cycles', () => {
  it('following pair -> pair containing |a - b| gives exactly three cycles that use every pair once', () => {
    expect(cycles).toHaveLength(3)
    expect(cycles.flat()).toHaveLength(5)
  })

  it('the cycles are [(0,9)], [(3,6)] and one 3-cycle of (1,8), (2,7), (4,5)', () => {
    const withPlex = cycles.find((c) => c.flat().includes(0))
    const three = cycles.find((c) => c.length === 3)
    const rest = cycles.find((c) => !c.flat().includes(0) && c.length !== 3)
    expect(withPlex).toEqual([[0, 9]])
    expect(rest).toEqual([[3, 6]])
    expect(three).toEqual([
      [1, 8],
      [2, 7],
      [4, 5],
    ])
  })

  it('zoneRegion maps the plex cycle to plex, the 3-cycle to torque and the other cycle to warp', () => {
    for (let z = 0; z <= 9; z++) expect(golden.zoneRegion[z]).toBe(regionOf(z))
    expect(golden.zoneCount).toBe(10)
  })

  it('regions lists the zones of each region in ascending order', () => {
    expect(golden.regions).toEqual({ plex: [0, 9], torque: [1, 2, 4, 5, 7, 8], warp: [3, 6] })
  })
})

describe('demons', () => {
  const pairsOfZones: Pair[] = []
  for (let a = 1; a <= 9; a++) for (let b = 0; b < a; b++) pairsOfZones.push([a, b])

  const definitionalKind = (a: number, b: number): string =>
    a + b === n - 1 ? 'syzygy' : tcZones.has(a) && tcZones.has(b) ? 'chrono' : !tcZones.has(a) && !tcZones.has(b) ? 'xeno' : 'amphi'

  it('there are 45 = 10 * 9 / 2 demons', () => {
    expect(golden.demonCount).toBe(45)
    expect(golden.demons).toHaveLength(45)
    expect(pairsOfZones).toHaveLength((n * (n - 1)) / 2)
  })

  it('every unordered pair of zones appears exactly once with a > b', () => {
    const seen = golden.demons.map((d) => `${d.a}:${d.b}`)
    expect(new Set(seen).size).toBe(45)
    expect([...seen].sort()).toEqual(pairsOfZones.map(([a, b]) => `${a}:${b}`).sort())
    for (const d of golden.demons) expect(d.a).toBeGreaterThan(d.b)
  })

  it('every demon has its net-span mesh number a::b and a real name', () => {
    for (const d of golden.demons) {
      expect(d.netSpan).toBe(`${d.a}::${d.b}`)
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.name).not.toBe('?')
    }
  })

  it('each kind equals the classification from the Time Circuit zones', () => {
    for (const d of golden.demons) expect(d.kind, `${d.a}::${d.b}`).toBe(definitionalKind(d.a, d.b))
  })

  it('the Time Circuit zones are the zones of the 3-cycle', () => {
    expect([...tcZones].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 7, 8])
  })

  it('the correct subtype split holds: chrono 12 + 3, amphi 12 plex + 12 warp, xeno 4 + 2', () => {
    const chrono = pairsOfZones.filter(([a, b]) => tcZones.has(a) && tcZones.has(b))
    const xeno = pairsOfZones.filter(([a, b]) => !tcZones.has(a) && !tcZones.has(b))
    const amphi = pairsOfZones.filter(([a, b]) => tcZones.has(a) !== tcZones.has(b))
    const syz = (ps: Pair[]) => ps.filter(([a, b]) => a + b === n - 1).length
    const outside = ([a, b]: Pair): number => (tcZones.has(a) ? b : a)

    expect(chrono).toHaveLength(15)
    expect(chrono.length - syz(chrono)).toBe(12)
    expect(syz(chrono)).toBe(3)

    expect(xeno).toHaveLength(6)
    expect(xeno.length - syz(xeno)).toBe(4)
    expect(syz(xeno)).toBe(2)

    expect(amphi).toHaveLength(24)
    expect(amphi.filter((p) => regionOf(outside(p)) === 'plex')).toHaveLength(12)
    expect(amphi.filter((p) => regionOf(outside(p)) === 'warp')).toHaveLength(12)
    expect(syz(amphi)).toBe(0)

    expect(chrono.length + xeno.length + amphi.length).toBe(45)
  })

  it('the recorded counts equal the definitional counts', () => {
    expect(golden.kinds).toEqual({ amphi: 24, chrono: 12, syzygy: 5, xeno: 4 })
    expect(golden.syzygeticBy).toEqual({ chrono: 3, xeno: 2 })
    expect(golden.amphiBy).toEqual({ plex: 12, warp: 12 })
  })
})

describe('time circuit', () => {
  it('tc.zones equals the torque region', () => {
    expect(golden.tc.zones).toEqual(golden.regions.torque)
  })

  it('tc.syzygies are the pairs of the 3-cycle', () => {
    const byKey = (a: Pair, b: Pair) => pairKey(a).localeCompare(pairKey(b))
    expect([...golden.tc.syzygies].sort(byKey)).toEqual([...torqueCycle].sort(byKey))
  })

  it('tc.currents are Hold, Sink and Surge, the currents that start inside the Time Circuit', () => {
    expect(golden.tc.currents).toEqual(['Hold', 'Sink', 'Surge'])
    const inside = golden.currents.filter((c) => tcZones.has(c.from)).map((c) => c.name).sort()
    expect(inside).toEqual(golden.tc.currents)
  })

  it('tc.edges are the three time-circuit syzygies plus the three time-circuit currents', () => {
    const undirected = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)
    const want = [
      ...golden.tc.syzygies.map(([a, b]) => undirected(a, b)),
      ...golden.currents.filter((c) => tcZones.has(c.from)).map((c) => undirected(c.from, c.to)),
    ].sort()
    expect(golden.tc.edges.map(([a, b]) => undirected(a, b)).sort()).toEqual(want)
  })
})

describe('planetary', () => {
  const { cx, cy, radius, defaultAngle, positionsAtDefaultAngle } = golden.planetary

  it('zone 0 sits at the centre (400, 400)', () => {
    expect(cx).toBe(400)
    expect(cy).toBe(400)
    expect(positionsAtDefaultAngle[0]).toEqual({ x: 400, y: 400 })
  })

  it('every position matches cx + cos((angle - 90) * PI / 180) * r within 1e-9', () => {
    for (let z = 0; z <= 9; z++) {
      const r = radius[z]
      const angle = defaultAngle[z]
      const pos = positionsAtDefaultAngle[z]
      if (r === undefined || angle === undefined || pos === undefined) throw new Error(`zone ${z} missing`)
      const a = ((angle - 90) * Math.PI) / 180
      expect(pos.x).toBeCloseTo(cx + Math.cos(a) * r, 9)
      expect(pos.y).toBeCloseTo(cy + Math.sin(a) * r, 9)
    }
  })
})
