// The engine's base-10 numogram equals the frozen numeric oracle engine/test/fixtures/base10.golden.json (captured once
// from the untouched viewer, never regenerated). If a test here fails, the ENGINE is wrong, not the JSON.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createNumogram, DEMON_SUBTYPES, formatGateName, formatNetSpan } from '../index'
import type { Cycle, DemonSubtype } from '../index'

interface Base10Golden {
  base: number
  zoneCount: number
  pairs: number[][]
  currents: { name: string; pair: number[]; from: number; to: number }[]
  gates: { name: string; from: number; to: number; cum: number }[]
  zoneRegion: Record<string, string>
  regions: Record<string, number[]>
  tc: { zones: number[]; edges: number[][]; currents: string[]; syzygies: number[][] }
  demons: { a: number; b: number; netSpan: string; kind: string; name: string }[]
  demonCount: number
  kinds: Record<string, number>
  syzygeticBy: Record<string, number>
  amphiBy: Record<string, number>
}

// Read the frozen file, never write it.
const FIXTURE = fileURLToPath(new URL('./fixtures/base10.golden.json', import.meta.url))
const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Base10Golden
const g = createNumogram(10)

const numeric = (a: number, b: number): number => a - b
const sortedPairs = (pairs: readonly (readonly number[])[]): number[][] =>
  pairs.map(p => [...p].sort(numeric)).sort((x, y) => numeric(x[0] ?? 0, y[0] ?? 0))

const zonesOfKind = (kind: string): number[] => {
  const zones: number[] = []
  for (const cycle of g.cycles) if (cycle.kind === kind) zones.push(...cycle.zones())
  return zones.sort(numeric)
}

describe('engine base 10 vs the frozen numeric oracle', () => {
  it('is the same base as the fixture', () => {
    expect(golden.base).toBe(10)
    expect(g.base).toBe(golden.base)
    expect(g.zoneCount).toBe(golden.zoneCount)
  })

  it('has the same set of syzygy pairs (the fixture lists them in data order)', () => {
    const engine = Array.from({ length: g.pairCount }, (_, id) => [g.pair(id).lo, g.pair(id).hi])
    expect(sortedPairs(engine)).toEqual(sortedPairs(golden.pairs))
  })

  it('flows every current to the fixture zone', () => {
    expect(golden.currents).toHaveLength(5)
    for (const current of golden.currents) {
      const id = current.pair[0] ?? -1 // the pair id is the low zone
      const engine = g.current(id)
      expect(engine.to, `${current.name} to`).toBe(current.to)
      expect([engine.lo, engine.hi], `${current.name} pair`).toEqual(current.pair)
    }
  })

  // The fixture's `from` is the viewer's drawing origin, which the engine does not store (CurrentInfo has pair, lo, hi
  // and to). It is the walk's even member: the Torque walk 1, 8, 7, 2, 5, 4 leaves each pair through its even member
  // (8 -> 7, 2 -> 5, 4 -> 1) and so does the Warp walk 3, 6 (6 -> 3). Only the Plex differs: the viewer draws its
  // self-loop at zone 9, the walk's odd member.
  it("reads each fixture current's from as the even member of its pair (the Plex is drawn at 9)", () => {
    for (const current of golden.currents) {
      const id = current.pair[0] ?? -1
      const isPlex = g.cycleOfPair(id).kind === 'plex'
      expect(current.from, current.name).toBe(isPlex ? g.pair(id).odd : g.pair(id).even)
    }
  })

  it('has the same gates: from, to, cumulation and the own-base name', () => {
    expect(golden.gates).toHaveLength(10)
    for (const gate of golden.gates) {
      const engine = g.gate(gate.from)
      expect(engine.to, `${gate.name} to`).toBe(gate.to)
      expect(engine.cumulation, `${gate.name} cum`).toBe(gate.cum)
      expect(formatGateName(engine.cumulation, 10), `${gate.name} name`).toBe(gate.name)
    }
  })

  it('Gt-15 is 5 -> 6', () => {
    expect(g.gate(5)).toEqual({ from: 5, to: 6, cumulation: 15 })
    expect(formatGateName(15, 10)).toBe('Gt-15')
  })

  it('Gt-03 is 2 -> 3', () => {
    expect(g.gate(2)).toEqual({ from: 2, to: 3, cumulation: 3 })
    expect(formatGateName(3, 10)).toBe('Gt-03')
  })

  it('has the same zone regions and region zone sets', () => {
    for (let z = 0; z < 10; z++) expect(g.cycleOfZone(z).kind, `zone ${z}`).toBe(golden.zoneRegion[String(z)])
    expect(zonesOfKind('plex')).toEqual(golden.regions['plex'])
    expect(zonesOfKind('torque')).toEqual(golden.regions['torque'])
    expect(zonesOfKind('warp')).toEqual(golden.regions['warp'])
  })

  it('has the same time circuit: zones, syzygies in flow order and the closed walk of edges', () => {
    expect(g.torqueCount).toBe(1)
    const torque: Cycle | undefined = g.torques[0]
    expect(torque).toBeDefined()
    if (torque === undefined) return
    expect(Array.from(torque.zones()).sort(numeric)).toEqual(golden.tc.zones)
    // syzygies: the Torque pairs in flow order as [lo, hi]
    const syzygies = Array.from(torque.pairs()).map(id => [g.pair(id).lo, g.pair(id).hi])
    expect(syzygies).toEqual(golden.tc.syzygies)
    // edges: consecutive walk zones, closing back to the first
    const walk = Array.from(torque.zones())
    const edges = walk.map((zone, i) => [zone, walk[(i + 1) % walk.length] ?? -1])
    expect(edges).toEqual(golden.tc.edges)
  })
})

// The viewer's own demon classification (a separate 'syzygy' kind next to chrono, amphi and xeno) reproduced from the
// engine's subtypes: syzygetic chrono and syzygetic xeno are the 5 syzygy demons (a + b = 9).
const VIEWER_KIND: Readonly<Record<DemonSubtype, string>> = {
  'cyclic-chrono': 'chrono',
  'cross-torque-chrono': 'chrono',
  'syzygetic-chrono': 'syzygy',
  'plex-amphi': 'amphi',
  'warp-amphi': 'amphi',
  'chaotic-xeno': 'xeno',
  'syzygetic-xeno': 'syzygy',
}

describe('engine base-10 demons vs the frozen numeric oracle', () => {
  const space = g.demons

  it('has the fixture demon count 45 and the Numodemon count 4', () => {
    expect(golden.demonCount).toBe(45)
    expect(golden.demons).toHaveLength(45)
    expect(space.count).toBe(golden.demonCount)
    expect(space.numodemonCount).toBe(4)
  })

  it("lists the fixture's demons (a, b) in the engine's mesh order and formats each net-span as the fixture does", () => {
    golden.demons.forEach((demon, mesh) => {
      const engine = space.at(mesh)
      expect([engine.a, engine.b], `mesh ${mesh}`).toEqual([demon.a, demon.b])
      expect(formatNetSpan(engine.a, engine.b, 10), `mesh ${mesh} net-span`).toBe(demon.netSpan)
      expect(space.meshOf(demon.a, demon.b), `mesh of ${demon.netSpan}`).toBe(mesh)
    })
  })

  it("maps subtypes to the viewer's kinds and reproduces every fixture demon's kind", () => {
    golden.demons.forEach((demon, mesh) => {
      const engine = space.at(mesh)
      expect(VIEWER_KIND[engine.subtype], `${demon.netSpan} is ${engine.subtype}`).toBe(demon.kind)
    })
  })

  it('tallies the 45 enumerated demons per subtype as 12 cyclic, 0 cross-Torque, 3 + 12 + 12, 4 chaotic and 2 syzygetic xeno', () => {
    const tally: Record<string, number> = {}
    for (let mesh = 0; mesh < space.count; mesh++) {
      const subtype = space.at(mesh).subtype
      tally[subtype] = (tally[subtype] ?? 0) + 1
    }
    expect(DEMON_SUBTYPES.map(subtype => tally[subtype] ?? 0)).toEqual([12, 0, 3, 12, 12, 4, 2])
    expect(space.counts()).toEqual(Object.fromEntries(DEMON_SUBTYPES.map(subtype => [subtype, tally[subtype] ?? 0])))
  })

  it('reproduces the fixture kinds { amphi 24, chrono 12, syzygy 5, xeno 4 }, syzygeticBy and amphiBy', () => {
    const counts = space.counts()
    const kinds: Record<string, number> = {}
    for (const subtype of DEMON_SUBTYPES) {
      const kind = VIEWER_KIND[subtype]
      kinds[kind] = (kinds[kind] ?? 0) + counts[subtype]
    }
    expect(kinds).toEqual(golden.kinds)
    expect(golden.kinds).toEqual({ amphi: 24, chrono: 12, syzygy: 5, xeno: 4 })
    expect({ chrono: counts['syzygetic-chrono'], xeno: counts['syzygetic-xeno'] }).toEqual(golden.syzygeticBy)
    expect({ plex: counts['plex-amphi'], warp: counts['warp-amphi'] }).toEqual(golden.amphiBy)
    expect(golden.syzygeticBy).toEqual({ chrono: 3, xeno: 2 })
    expect(golden.amphiBy).toEqual({ plex: 12, warp: 12 })
    // The viewer's chrono kind is cyclic plus cross-Torque; base 10 has no cross-Torque demon.
    expect(counts['cyclic-chrono'] + counts['cross-torque-chrono']).toBe(golden.kinds['chrono'])
    expect(counts['cross-torque-chrono']).toBe(0)
  })
})
