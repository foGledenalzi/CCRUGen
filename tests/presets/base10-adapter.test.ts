import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Region } from '../../app/data/types'
import { CURRENTS, legacyCurrentFrom } from '../../app/presets/base10/currents'
import { ALL_DEMONS, legacyKind, type LegacyDemonKind } from '../../app/presets/base10/demons'
import { GATE_LIST } from '../../app/presets/base10/gates'
import { CURRENT_LORE, DEMON_NAMES, GATE_LORE, SYZYGY_LORE, ZONE_META } from '../../app/presets/base10/lore'
import { BASE10 } from '../../app/presets/base10/numogram'
import { TC, TC_CURRENTS, TC_EDGES, TC_SYZYGIES, ZONE_REGION } from '../../app/presets/base10/regions'
import { SYZYGIES } from '../../app/presets/base10/syzygies'
import { DEMON_SUBTYPES, formatGateName, type DemonSubtype } from '../../engine/index'
import { refClassify, refDemons, refDigitSumRoot, refStructure } from '../bruteforce/numogramReference'

// MIG-01 / D-01 / D-02: the base-10 adapter derives the viewer's data shapes from the engine (createNumogram(10))
// joined with the lore by id. Swap 1 (plan 02-08): syzygies. Swap 2 (plan 02-09): currents. Swap 3 (plan 02-10): gates.
// Swap 4 (plan 02-11): regions and the Torque time-circuit constants. Swap 5 (plan 02-12): demons.
// The frozen numeric oracle (base10.golden.json, never regenerated) and the definitions below, not the adapter, say what
// the values must be.

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as {
  pairs: [number, number][]
  currents: { name: string; pair: [number, number]; from: number; to: number }[]
  gates: { name: string; from: number; to: number; cum: number }[]
  zoneRegion: Record<string, string>
  regions: { plex: number[]; torque: number[]; warp: number[] }
  tc: { zones: number[]; edges: [number, number][]; currents: string[]; syzygies: [number, number][] }
  demons: { a: number; b: number; netSpan: string; kind: string; name: string }[]
  demonCount: number
  kinds: Record<string, number>
}

// U+2212 MINUS SIGN, built from its code point so this file holds no escape sequence.
const MINUS = String.fromCharCode(0x2212)
const codePoints = (s: string): number[] => Array.from(s).map((ch) => ch.codePointAt(0) as number)

describe('the base-10 engine instance', () => {
  it('is createNumogram(10) with one Torque cycle and a Warp', () => {
    expect(BASE10.base).toBe(10)
    expect(BASE10.pairCount).toBe(5)
    expect(BASE10.torqueCount).toBe(1)
    expect(BASE10.warp).not.toBeNull()
  })
})

describe('syzygies', () => {
  it('are the five pairs of the frozen oracle, in the panel order (pair ids descending, a low, b high)', () => {
    const pairs = SYZYGIES.map((s) => [s.a, s.b])
    expect(pairs).toEqual([[4, 5], [3, 6], [2, 7], [1, 8], [0, 9]])
    expect(pairs).toEqual(golden.pairs)
  })

  it('come from the engine pairs: a = lo, b = hi, listed from the last pair id down to 0', () => {
    expect(SYZYGIES).toHaveLength(BASE10.pairCount)
    SYZYGIES.forEach((s, i) => {
      const pair = BASE10.pair(BASE10.pairCount - 1 - i)
      expect(s.a).toBe(pair.lo)
      expect(s.b).toBe(pair.hi)
      expect(s.a + s.b).toBe(BASE10.base - 1)
    })
  })

  it('keep the exact key order a, b, demon, desc that the consumers were written against', () => {
    for (const s of SYZYGIES) expect(Object.keys(s)).toEqual(['a', 'b', 'demon', 'desc'])
  })

  it('carry the lore of their own pair id (the demon is the syzygetic demon of the pair)', () => {
    for (const s of SYZYGIES) {
      expect(s.demon).toBe(SYZYGY_LORE[s.a]?.demon)
      expect(s.desc).toBe(SYZYGY_LORE[s.a]?.desc)
      expect(s.demon).toBe(DEMON_NAMES[BASE10.demons.meshOf(s.b, s.a)])
      expect(s.demon.length).toBeGreaterThan(0)
      expect(s.desc.length).toBeGreaterThan(0)
    }
  })

})

describe('currents', () => {
  // Viewer order: Surge, Hold, Sink (the Torque cycle in flow order), then Warp, then Plex = pair ids 1, 2, 4, 3, 0.
  const PAIR_IDS = [1, 2, 4, 3, 0]

  it('are the five currents of the frozen oracle (name, from, to), in the same order', () => {
    expect(golden.currents).toHaveLength(5)
    expect(CURRENTS.map((c) => ({ name: c.name, from: c.from, to: c.to }))).toEqual(
      golden.currents.map((c) => ({ name: c.name, from: c.from, to: c.to })),
    )
  })

  it('come from the engine: Torque pairs in flow order, then the Warp pair, then the Plex pair', () => {
    const order = [
      ...BASE10.torques.flatMap((c) => Array.from(c.pairs())),
      ...(BASE10.warp === null ? [] : [BASE10.warp.firstPair]),
      BASE10.plex.firstPair,
    ]
    expect(order).toEqual(PAIR_IDS)
    expect(CURRENTS).toHaveLength(BASE10.pairCount)
    CURRENTS.forEach((c, i) => {
      const pair = BASE10.pair(PAIR_IDS[i] as number)
      const cur = BASE10.current(pair.id)
      expect(c.to, c.name).toBe(cur.to)
      expect(c.to, c.name).toBe(pair.hi - pair.lo)
      expect([pair.lo, pair.hi], c.name).toContain(c.from)
    })
  })

  it('label every current as hi, U+2212 minus, lo, =, to in base-10 numerals (8, 1, 7 for Surge), never the ASCII hyphen', () => {
    const expected = [[8, 1, 7], [7, 2, 5], [5, 4, 1], [6, 3, 3], [9, 0, 9]].map(([h, l, t]) => `${h}${MINUS}${l}=${t}`)
    expect(CURRENTS.map((c) => c.label)).toEqual(expected)
    for (const c of CURRENTS) {
      expect(c.label, c.name).not.toContain('-')
      expect(codePoints(c.label).filter((cp) => cp === 0x2212), c.name).toHaveLength(1)
    }
  })

  it('keep the exact key order name, from, to, label, desc that the consumers were written against', () => {
    for (const c of CURRENTS) expect(Object.keys(c)).toEqual(['name', 'from', 'to', 'label', 'desc'])
  })

  it('carry the lore of their own pair id (name and description joined by pair id)', () => {
    CURRENTS.forEach((c, i) => {
      const lore = CURRENT_LORE[PAIR_IDS[i] as number]
      expect(c.name).toBe(lore?.name)
      expect(c.desc).toBe(lore?.desc)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.desc.length).toBeGreaterThan(0)
    })
  })

  it('legacyCurrentFrom is the upstream drawing convention: the even member of the pair, the Plex pair drawn at 9', () => {
    expect(PAIR_IDS.map(legacyCurrentFrom)).toEqual([8, 2, 4, 6, 9])
    expect(legacyCurrentFrom(1)).toBe(8)
    expect(legacyCurrentFrom(2)).toBe(2)
    expect(legacyCurrentFrom(4)).toBe(4)
    expect(legacyCurrentFrom(3)).toBe(6)
    expect(legacyCurrentFrom(0)).toBe(9)
    CURRENTS.forEach((c, i) => expect(c.from, c.name).toBe(legacyCurrentFrom(PAIR_IDS[i] as number)))
  })

})

describe('gates', () => {
  it('are the ten gates of the frozen oracle (name, from, to, cum), in the same order', () => {
    expect(golden.gates).toHaveLength(10)
    expect(GATE_LIST.map((g) => ({ name: g.name, from: g.from, to: g.to, cum: g.cum }))).toEqual(golden.gates)
  })

  it('emit all n gates in origin-zone order, Gt-00 (0 -> 0) included', () => {
    expect(GATE_LIST).toHaveLength(BASE10.zoneCount)
    expect(GATE_LIST).toHaveLength(10)
    expect(GATE_LIST[0]?.name).toBe('Gt-00')
    expect(GATE_LIST.map((g) => g.name)).toEqual([
      'Gt-00', 'Gt-01', 'Gt-03', 'Gt-06', 'Gt-10', 'Gt-15', 'Gt-21', 'Gt-28', 'Gt-36', 'Gt-45',
    ])
    GATE_LIST.forEach((g, zone) => expect(g.from, g.name).toBe(zone))
  })

  it('Gt-15 is 5 -> 6 in the viewer data (never the 16 the diagram once drew)', () => {
    const gate = GATE_LIST.find((g) => g.name === 'Gt-15')
    expect({ from: gate?.from, to: gate?.to, cum: gate?.cum }).toEqual({ from: 5, to: 6, cum: 15 })
  })

  it('Gt-03 is 2 -> 3 in the viewer data (never the 8 the diagram once drew)', () => {
    const gate = GATE_LIST.find((g) => g.name === 'Gt-03')
    expect({ from: gate?.from, to: gate?.to, cum: gate?.cum }).toEqual({ from: 2, to: 3, cum: 3 })
  })

  it('come from the engine gates: to = the in-base digital root of T(k) (T(0) -> 0), cum = T(k), names in own-base numerals', () => {
    let triangular = 0
    GATE_LIST.forEach((g, k) => {
      triangular += k // running sum 0, 1, 3, 6, ..., 45 = T(k), not the engine formula
      const engine = BASE10.gate(k)
      expect(g.from, g.name).toBe(engine.from)
      expect(g.to, g.name).toBe(engine.to)
      expect(g.cum, g.name).toBe(engine.cumulation)
      expect(g.cum, g.name).toBe(triangular)
      expect(g.to, g.name).toBe(refDigitSumRoot(triangular, BASE10.base))
      expect(g.name, g.name).toBe(formatGateName(engine.cumulation, 10))
    })
  })

  it('write every name with the engine formatter: Gt- and the cumulation as two in-base digits', () => {
    for (const g of GATE_LIST) expect(g.name).toMatch(/^Gt-\d\d$/)
    expect(GATE_LIST.map((g) => g.name)).toEqual(GATE_LIST.map((g) => 'Gt-' + String(g.cum).padStart(2, '0')))
  })

  it('keep the exact key order name, from, to, cum, desc, detail that the consumers were written against', () => {
    for (const g of GATE_LIST) expect(Object.keys(g)).toEqual(['name', 'from', 'to', 'cum', 'desc', 'detail'])
  })

  it('carry the lore of their own origin zone (desc and detail joined by origin zone)', () => {
    GATE_LIST.forEach((g, zone) => {
      const lore = GATE_LORE[zone]
      expect(g.desc, g.name).toBe(lore?.desc)
      expect(g.detail, g.name).toBe(lore?.detail)
      expect(g.desc.length, g.name).toBeGreaterThan(0)
      expect(g.detail.length, g.name).toBeGreaterThan(0)
    })
  })

})

describe('regions', () => {
  const ZONES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  // The independent reference (definitions only, tests/bruteforce): regions and the Torque cycle straight from the rules.
  const REF = refStructure(10)
  const refKind = (zone: number) => REF.cycles[REF.cycleOfZone[zone] as number]?.kind
  const refTorque = REF.cycles.filter((c) => c.kind === 'torque')

  it('ZONE_REGION is the frozen oracle zoneRegion: zones 0..9 to the exact Region strings', () => {
    expect(ZONE_REGION).toEqual(golden.zoneRegion)
    expect(Object.keys(ZONE_REGION)).toEqual(ZONES.map(String))
    expect(ZONES.map((z) => ZONE_REGION[z])).toEqual([
      'plex', 'torque', 'torque', 'warp', 'torque', 'torque', 'warp', 'torque', 'torque', 'plex',
    ])
  })

  it('ZONE_REGION comes from the engine cycles (the kind of each zone\'s cycle) and regroups into the oracle regions', () => {
    for (const z of ZONES) expect(ZONE_REGION[z], `zone ${z}`).toBe(BASE10.cycleOfZone(z).kind)
    const grouped: Record<Region, number[]> = { plex: [], torque: [], warp: [] }
    for (const z of ZONES) grouped[ZONE_REGION[z] as Region].push(z)
    expect(grouped).toEqual(golden.regions)
    expect(BASE10.torqueCount).toBe(1)
  })

  it('ZONE_REGION agrees with the independent definition-based reference, zone by zone', () => {
    for (const z of ZONES) expect(ZONE_REGION[z], `zone ${z}`).toBe(refKind(z))
  })

  it('TC is the set of Torque zones, in ascending insertion order (1, 2, 4, 5, 7, 8)', () => {
    expect(TC).toBeInstanceOf(Set)
    expect(Array.from(TC)).toEqual([1, 2, 4, 5, 7, 8])
    expect(Array.from(TC)).toEqual(golden.tc.zones)
    expect(Array.from(TC)).toEqual(ZONES.filter((z) => refKind(z) === 'torque'))
  })

  it('TC_EDGES is the closed Torque walk, odd member then even member of each pair in flow order', () => {
    expect(TC_EDGES).toEqual([[1, 8], [8, 7], [7, 2], [2, 5], [5, 4], [4, 1]])
    expect(TC_EDGES).toEqual(golden.tc.edges)
    // Rebuilt from the reference cycle (pair ids in flow order): the odd zone of each pair, then its even zone.
    const walk = refTorque.flatMap((c) =>
      c.pairs.flatMap((p) => {
        const partner = REF.partner[p] as number
        return p % 2 === 1 ? [p, partner] : [partner, p]
      }),
    )
    expect(walk).toHaveLength(2 * BASE10.torques[0]!.lengthInPairs)
    expect(TC_EDGES).toEqual(walk.map((z, i) => [z, walk[(i + 1) % walk.length]]))
    // Closed and connected: every edge starts where the previous one ended (the last one ends where the first starts).
    TC_EDGES.forEach((edge, i) => expect(edge[0]).toBe(TC_EDGES[(i + TC_EDGES.length - 1) % TC_EDGES.length]?.[1]))
  })

  it('TC_SYZYGIES are the Torque pairs as [low zone, high zone] in flow order', () => {
    expect(TC_SYZYGIES).toEqual([[1, 8], [2, 7], [4, 5]])
    expect(TC_SYZYGIES).toEqual(golden.tc.syzygies)
    for (const [lo, hi] of TC_SYZYGIES) expect(lo + hi).toBe(BASE10.base - 1)
    expect(TC_SYZYGIES).toEqual(refTorque.flatMap((c) => c.pairs.map((p) => [p, REF.partner[p]])))
  })

  it('TC_CURRENTS are the lore names of the Torque pairs in flow order (Surge, Hold, Sink)', () => {
    expect(TC_CURRENTS).toBeInstanceOf(Set)
    expect(Array.from(TC_CURRENTS)).toEqual(['Surge', 'Hold', 'Sink'])
    expect(Array.from(TC_CURRENTS).sort()).toEqual(golden.tc.currents)
    expect(Array.from(TC_CURRENTS)).toEqual(TC_SYZYGIES.map(([lo]) => CURRENT_LORE[lo]?.name))
    // each is a current of the viewer's list, drawn from a Torque zone
    for (const c of CURRENTS.filter((cur) => TC_CURRENTS.has(cur.name))) expect(TC.has(c.from), c.name).toBe(true)
  })

})

describe('demons', () => {
  // The independent reference (definitions only, tests/bruteforce): every demon a > b in enumeration order, classified from
  // the regions by the rules, never by the engine's demon code.
  const REF = refStructure(10)
  const REF_DEMONS = refDemons(REF)
  const isTorque = (zone: number) => REF.cycles[REF.cycleOfZone[zone] as number]?.kind === 'torque'
  const netSpan = (d: { a: number; b: number }) => `${d.a}::${d.b}`
  const tally = (items: string[]): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const item of items) out[item] = (out[item] ?? 0) + 1
    return out
  }

  // The viewer's own classification, kept exactly (T-02-45): nine-sum demons (the syzygetic ones) are their own kind
  // 'syzygy', otherwise both zones in the Torque is 'chrono' (cyclic and cross-Torque alike), neither is 'xeno', the rest 'amphi'.
  const EXPECTED_KIND: Record<DemonSubtype, LegacyDemonKind> = {
    'cyclic-chrono': 'chrono',
    'cross-torque-chrono': 'chrono',
    'syzygetic-chrono': 'syzygy',
    'plex-amphi': 'amphi',
    'warp-amphi': 'amphi',
    'chaotic-xeno': 'xeno',
    'syzygetic-xeno': 'syzygy',
  }
  // The same rule from the definitions, written the way the hand builder wrote it (zones and the Torque set, no subtypes).
  const definitionKind = (a: number, b: number): LegacyDemonKind =>
    a + b === REF.base - 1 ? 'syzygy' : isTorque(a) && isTorque(b) ? 'chrono' : !isTorque(a) && !isTorque(b) ? 'xeno' : 'amphi'

  it('are the 45 demons of the frozen oracle (a, b, net-span, kind, name), in the same order', () => {
    expect(golden.demonCount).toBe(45)
    expect(golden.demons).toHaveLength(45)
    expect(ALL_DEMONS).toHaveLength(45)
    expect(
      ALL_DEMONS.map((d) => ({ a: d.a, b: d.b, netSpan: netSpan(d), kind: d.kind, name: d.name })),
    ).toEqual(golden.demons)
  })

  it('come from the engine demon space in mesh order: entry m is the demon of mesh m, named by the lore of mesh m', () => {
    expect(BASE10.demons.count).toBe(45)
    expect(ALL_DEMONS).toHaveLength(BASE10.demons.count)
    ALL_DEMONS.forEach((d, m) => {
      const ref = BASE10.demons.at(m)
      expect(ref.mesh, netSpan(d)).toBe(m)
      expect([d.a, d.b], `mesh ${m}`).toEqual([ref.a, ref.b])
      expect((d.a * (d.a - 1)) / 2 + d.b, netSpan(d)).toBe(m) // mesh number by definition
      expect(d.a, netSpan(d)).toBeGreaterThan(d.b)
      expect(d.name, netSpan(d)).toBe(DEMON_NAMES[m])
    })
    // The enumeration order of the definition-based reference is the same order (a = 1..9, b = 0..a-1).
    expect(ALL_DEMONS.map((d) => [d.a, d.b])).toEqual(REF_DEMONS.map((d) => [d.a, d.b]))
  })

  it('keep the exact key order a, b, name, kind that the consumers were written against', () => {
    for (const d of ALL_DEMONS) expect(Object.keys(d)).toEqual(['a', 'b', 'name', 'kind'])
  })

  it('carry a lore name for every mesh number (no placeholder), joined right: each zone lemur list reads the same names', () => {
    for (const d of ALL_DEMONS) {
      expect(d.name.length, netSpan(d)).toBeGreaterThan(0)
      expect(d.name, netSpan(d)).not.toBe('?')
    }
    // A second, independent path to the names: the per-zone lemur lists of the lore module ('a::b Name', b ascending)
    // must equal the adapter's demons of that zone, so a mesh mis-join or a shifted name cannot pass.
    expect(ZONE_META[0]?.lemurs).toEqual([])
    for (let zone = 1; zone < BASE10.zoneCount; zone++) {
      expect(ZONE_META[zone]?.lemurs, `zone ${zone}`).toEqual(
        ALL_DEMONS.filter((d) => d.a === zone).map((d) => `${netSpan(d)} ${d.name}`),
      )
    }
  })

  it('count { amphi: 24, chrono: 12, syzygy: 5, xeno: 4 } by kind (the frozen oracle kinds)', () => {
    const kinds = tally(ALL_DEMONS.map((d) => d.kind))
    expect(kinds).toEqual({ amphi: 24, chrono: 12, syzygy: 5, xeno: 4 })
    expect(kinds).toEqual(golden.kinds)
  })

  it('split by engine subtype as 12+3 chrono (cyclic + syzygetic), 12+12 amphi (Plex + Warp) and 4+2 xeno (chaotic + syzygetic)', () => {
    // These counts are definitions of the base-10 numogram (the guide prose has them wrong), not viewer data.
    const counts = {
      'cyclic-chrono': 12,
      'cross-torque-chrono': 0,
      'syzygetic-chrono': 3,
      'plex-amphi': 12,
      'warp-amphi': 12,
      'chaotic-xeno': 4,
      'syzygetic-xeno': 2,
    }
    expect(BASE10.demons.counts()).toEqual(counts)
    expect(tally(ALL_DEMONS.map((_, m) => BASE10.demons.at(m).subtype))).toEqual(
      Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)),
    )
    // The viewer kinds are exactly those groups: chrono 12 = cyclic, syzygy 5 = 3 + 2, amphi 24 = 12 + 12, xeno 4 = chaotic.
    expect(ALL_DEMONS.filter((d) => d.kind === 'chrono')).toHaveLength(counts['cyclic-chrono'] + counts['cross-torque-chrono'])
    expect(ALL_DEMONS.filter((d) => d.kind === 'syzygy')).toHaveLength(counts['syzygetic-chrono'] + counts['syzygetic-xeno'])
    expect(ALL_DEMONS.filter((d) => d.kind === 'amphi')).toHaveLength(counts['plex-amphi'] + counts['warp-amphi'])
    expect(ALL_DEMONS.filter((d) => d.kind === 'xeno')).toHaveLength(counts['chaotic-xeno'])
  })

  it('kind syzygy is exactly the five nine-sum demons: 5::4, 7::2, 8::1 (syzygetic chrono) and 6::3, 9::0 (syzygetic xeno)', () => {
    const syzygy = ALL_DEMONS.filter((d) => d.kind === 'syzygy')
    expect(syzygy.map(netSpan)).toEqual(['5::4', '6::3', '7::2', '8::1', '9::0'])
    expect(ALL_DEMONS.filter((d) => d.a + d.b === BASE10.base - 1).map(netSpan)).toEqual(syzygy.map(netSpan))
    expect(syzygy.map((d) => BASE10.demons.ref(d.a, d.b).subtype)).toEqual([
      'syzygetic-chrono', 'syzygetic-xeno', 'syzygetic-chrono', 'syzygetic-chrono', 'syzygetic-xeno',
    ])
    expect(syzygy.map((d) => refClassify(REF, d.a, d.b).subtype)).toEqual([
      'syzygetic-chrono', 'syzygetic-xeno', 'syzygetic-chrono', 'syzygetic-chrono', 'syzygetic-xeno',
    ])
  })

  it('legacyKind maps all seven engine subtypes: syzygetic to syzygy, cyclic and cross-Torque to chrono, Plex and Warp to amphi, chaotic to xeno', () => {
    expect(DEMON_SUBTYPES).toHaveLength(7)
    expect(Object.keys(EXPECTED_KIND).sort()).toEqual([...DEMON_SUBTYPES].sort())
    for (const subtype of DEMON_SUBTYPES) expect(legacyKind(subtype), subtype).toBe(EXPECTED_KIND[subtype])
    expect(legacyKind('syzygetic-chrono')).toBe('syzygy')
    expect(legacyKind('syzygetic-xeno')).toBe('syzygy')
    expect(legacyKind('cyclic-chrono')).toBe('chrono')
    expect(legacyKind('cross-torque-chrono')).toBe('chrono') // no member at base 10, but the mapping is part of the contract
    expect(legacyKind('plex-amphi')).toBe('amphi')
    expect(legacyKind('warp-amphi')).toBe('amphi')
    expect(legacyKind('chaotic-xeno')).toBe('xeno')
  })

  it('every demon kind agrees with the independent reference (the rule from the definitions, and the reference subtype)', () => {
    expect(REF_DEMONS).toHaveLength(ALL_DEMONS.length)
    REF_DEMONS.forEach((ref, m) => {
      const d = ALL_DEMONS[m]
      expect(d?.kind, `${ref.a}::${ref.b}`).toBe(definitionKind(ref.a, ref.b))
      expect(d?.kind, `${ref.a}::${ref.b}`).toBe(EXPECTED_KIND[ref.subtype])
      expect(ref.mesh).toBe(m)
    })
  })

  it('feed the two viewer views as before: the pandemonium layer shows the 40 non-syzygy demons, each zone lists 9 demons', () => {
    expect(ALL_DEMONS.filter((d) => d.kind !== 'syzygy')).toHaveLength(40)
    for (let zone = 0; zone < BASE10.zoneCount; zone++) {
      expect(ALL_DEMONS.filter((d) => d.a === zone || d.b === zone), `zone ${zone}`).toHaveLength(BASE10.base - 1)
    }
  })

})

describe('the base-10 data seams are gone (MIG-02, plan 04-16)', () => {
  const APP_DATA_DIR = fileURLToPath(new URL('../../app/data/', import.meta.url))
  const DELETED_SEAMS = ['zones.ts', 'syzygies.ts', 'currents.ts', 'gates.ts', 'demons.ts', 'positions.ts']

  it('app/data/{zones,syzygies,currents,gates,demons,positions}.ts no longer exist; only types.ts remains', () => {
    for (const f of DELETED_SEAMS) expect(existsSync(APP_DATA_DIR + f), `app/data/${f}`).toBe(false)
    expect(existsSync(APP_DATA_DIR + 'types.ts')).toBe(true)
    expect(readdirSync(APP_DATA_DIR)).toEqual(['types.ts'])
  })

  it('app/lib/constants.ts no longer re-exports the Torque time-circuit constants', () => {
    const text = readFileSync(fileURLToPath(new URL('../../app/lib/constants.ts', import.meta.url)), 'utf8')
    expect(text).not.toContain('TC_EDGES')
    expect(text).not.toContain('TC_CURRENTS')
    expect(text).not.toContain('TC_SYZYGIES')
  })
})

// IN-08: app/data/*.ts and app/lib/constants.ts no longer need the CCRU header (only lore.ts carries it), so they are
// scanned like the adapter files: CCRU text pasted into any of them would make NOTICE wrong about which files are MIT.
describe('adapter and seam files (NOTICE section 1: original MIT code) hold no CCRU lore text', () => {
  const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url))
  const tsFilesIn = (dir: string, except: readonly string[] = []): string[] =>
    readdirSync(APP_DIR + dir)
      .filter((f) => f.endsWith('.ts') && !except.includes(f))
      .map((f) => dir + f)

  // lore.ts is the only allowed home of the lore, so it is not scanned. routes.ts (plan 04-04, NOTICE section 2 like
  // layout-tables.ts) legitimately compares a current's name against the literal upstream names 'Warp' and 'Plex' as
  // routing logic (which pair converges to its low zone), not decorative lore text, so its quoted literals are not a
  // "current name" hit; it is exempted from this MIT-focused scan the same way lore.ts is.
  const ADAPTER_FILES = tsFilesIn('presets/base10/', ['lore.ts', 'routes.ts'])
  const SEAM_FILES = [...tsFilesIn('data/'), 'lib/constants.ts']

  const lore = Object.values(SYZYGY_LORE).flatMap((l) => [l.demon, l.desc])
  // Current names are one short word each (comments may legitimately say Warp or Plex), so a quoted literal is what
  // counts as hard-coded lore; the descriptions are prose and must not appear at all.
  const currentLore = Object.values(CURRENT_LORE)
  // Gate lore is prose (a short title in desc, a sentence or two in detail): none of it may appear in a scanned file.
  const gateLore = Object.values(GATE_LORE).flatMap((l) => [l.desc, l.detail])
  // Demon names are lore too (one short word each): a quoted literal of any of the 45 is hard-coded lore.
  const demonNames = Object.values(DEMON_NAMES)
  // Zone prose (app/presets/base10/lore.ts is where it lives; the old app/data zones seam that used to re-export it
  // was deleted in plan 04-16); short fields like a planet name are not searched for.
  const zoneLore = Object.values(ZONE_META)
    .flatMap((z) => [z.desc, z.lemurian, z.centauri])
    .filter((s) => s.length >= 20)

  // lore.ts spells its strings as TypeScript literals: non-ASCII characters as unicode escapes and apostrophes escaped.
  // Text pasted from that source matches this form, not the runtime string, so both forms are searched for.
  const BACKSLASH = String.fromCharCode(92)
  const asSourceLiteral = (s: string): string =>
    s
      .split('')
      .map((ch) => {
        const code = ch.charCodeAt(0)
        if (ch === "'") return BACKSLASH + ch
        return code > 126 ? `${BACKSLASH}u${code.toString(16).padStart(4, '0')}` : ch
      })
      .join('')

  /** Every kind of CCRU lore that `text` contains, named; empty when the text is clean. */
  function loreHits(text: string): string[] {
    const hits: string[] = []
    const contains = (s: string): boolean => text.includes(s) || text.includes(asSourceLiteral(s))
    for (const name of demonNames) {
      if (text.includes(`'${name}'`) || text.includes(`"${name}"`)) hits.push(`the demon name ${name}`)
    }
    for (const s of lore) if (contains(s)) hits.push(`syzygy lore text ${JSON.stringify(s.slice(0, 30))}`)
    for (const s of gateLore) if (contains(s)) hits.push(`gate lore text ${JSON.stringify(s.slice(0, 30))}`)
    for (const s of zoneLore) if (contains(s)) hits.push(`zone lore text ${JSON.stringify(s.slice(0, 30))}`)
    for (const l of currentLore) {
      if (contains(l.desc)) hits.push(`the description of the current ${l.name}`)
      if (text.includes(`'${l.name}'`) || text.includes(`"${l.name}"`)) hits.push(`the current name ${l.name}`)
    }
    return hits
  }

  it('scans every adapter file and the remaining data/lib files (only lore.ts and routes.ts are exempt)', () => {
    for (const f of ['syzygies.ts', 'currents.ts', 'gates.ts', 'numogram.ts', 'regions.ts', 'demons.ts']) {
      expect(ADAPTER_FILES).toContain(`presets/base10/${f}`)
    }
    expect(ADAPTER_FILES).not.toContain('presets/base10/lore.ts')
    expect(ADAPTER_FILES).not.toContain('presets/base10/routes.ts')
    // The six base-10 data seams (zones, syzygies, currents, gates, demons, positions) were deleted in plan 04-16
    // (MIG-02): only types.ts remains under app/data/, plus app/lib/constants.ts.
    expect(SEAM_FILES).toEqual(['data/types.ts', 'lib/constants.ts'])
    expect(lore.length).toBe(10)
    expect(currentLore.length).toBe(5)
    expect(gateLore.length).toBe(20)
    expect(demonNames.length).toBe(45)
    expect(zoneLore.length).toBeGreaterThan(0)
  })

  it('no adapter file and no data seam contains a syzygy, current, gate or zone text, or a demon or current name', () => {
    for (const f of [...ADAPTER_FILES, ...SEAM_FILES]) {
      expect(loreHits(readFileSync(APP_DIR + f, 'utf8')), `app/${f} contains CCRU lore`).toEqual([])
    }
  })

  it('the scan does catch lore pasted into a file, as runtime text or as lore.ts spells it (negative control)', () => {
    const clean = "export { ZONE_META } from '../presets/base10/lore'\nexport const TWEEN_DURATION = 600\n"
    expect(loreHits(clean)).toEqual([])
    const pasted = (s: string): string => `${clean}export const X = '${s}'\n`
    for (const s of [lore[1], gateLore[1], gateLore[0], zoneLore[0], currentLore[2]?.desc] as string[]) {
      expect(loreHits(pasted(s)), s.slice(0, 30)).not.toEqual([])
      expect(loreHits(pasted(asSourceLiteral(s))), `source form of ${s.slice(0, 30)}`).not.toEqual([])
    }
    expect(loreHits(`${clean}const n = '${demonNames[0]}'`)).not.toEqual([])
    expect(loreHits(`${clean}const n = "${demonNames[44]}"`)).not.toEqual([])
    expect(loreHits(`${clean}const c = '${currentLore[3]?.name}'`)).not.toEqual([])
    // The lore module itself is what the scan is for: it must find every prose string in it, in the form it is spelled there.
    const inLore = loreHits(readFileSync(APP_DIR + 'presets/base10/lore.ts', 'utf8'))
    const count = (kind: string): number => inLore.filter((h) => h.startsWith(kind)).length
    expect(count('syzygy lore text')).toBe(lore.length)
    expect(count('gate lore text')).toBe(gateLore.length)
    expect(count('zone lore text')).toBe(zoneLore.length)
    expect(count('the description of the current')).toBe(currentLore.length)
    expect(count('the current name')).toBe(currentLore.length)
    expect(count('the demon name')).toBe(demonNames.length)
  })
})
