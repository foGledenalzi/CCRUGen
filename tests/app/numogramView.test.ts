// Tests for app/lib/numogramView.ts (UI-01, MIG-02). Base 10 must be the preset objects themselves (identity, not
// just equal structure); every other base gets structural lists proven never to contain 'NaN' or 'undefined'.
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { ALL_DEMONS } from '../../app/presets/base10/demons'
import { CURRENTS } from '../../app/presets/base10/currents'
import { GATE_LIST } from '../../app/presets/base10/gates'
import { ZONE_CLR, ZONE_META } from '../../app/presets/base10/lore'
import { TC_CURRENTS, TC_EDGES, TC_SYZYGIES, ZONE_REGION } from '../../app/presets/base10/regions'
import { SYZYGIES } from '../../app/presets/base10/syzygies'
import { ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { SUMMARY_TORQUE_LIMIT, buildNumogramView, summarize } from '../../app/lib/numogramView'

describe('base 10: the view is the preset data itself', () => {
  const g = createNumogram(10)
  const view = buildNumogramView(g)

  it('lists are the very preset objects (identity)', () => {
    expect(view.syzygies).toBe(SYZYGIES)
    expect(view.currents).toBe(CURRENTS)
    expect(view.gates).toBe(GATE_LIST)
    expect(view.demons).toBe(ALL_DEMONS)
    expect(view.torqueEdges).toBe(TC_EDGES)
    expect(view.torqueCurrentNames).toBe(TC_CURRENTS)
    expect(view.torqueSyzygies).toBe(TC_SYZYGIES)
    expect(view.lore?.zoneMeta).toBe(ZONE_META)
  })

  it('zoneColors matches ZONE_CLR zone by zone', () => {
    for (let z = 0; z < 10; z++) expect(view.zoneColors[z]).toBe(ZONE_CLR[z])
  })

  it('zoneKind matches ZONE_REGION zone by zone', () => {
    for (let z = 0; z < 10; z++) expect(view.zoneKind[z]).toBe(ZONE_REGION[z])
  })

  it('torqueWalks is the closed walk with its first zone appended', () => {
    expect(view.torqueWalks).toEqual([[1, 8, 7, 2, 5, 4, 1]])
  })

  it('torqueZones has exactly 1, 2, 4, 5, 7, 8', () => {
    expect([...view.torqueZones].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 7, 8])
  })

  it('presetCurrentDest matches the legacy convention: Plex -> 0, Warp -> 3, else current.to', () => {
    for (const c of CURRENTS) {
      const expected = c.name === 'Warp' || c.name === 'Plex' ? Math.min(c.from, 9 - c.from) : c.to
      expect(view.presetCurrentDest(c)).toBe(expected)
    }
  })

  it('partner delegates to the engine', () => {
    expect(view.partner(1)).toBe(g.partner(1))
    expect(view.partner(0)).toBe(g.partner(0))
  })
})

describe('summarize', () => {
  it('base 10', () => {
    expect(summarize(createNumogram(10))).toEqual({
      base: 10,
      zoneCount: 10,
      hasWarp: true,
      torqueCount: 1,
      torqueLengths: [3],
      demonCount: 45,
      typeCounts: { chrono: 15, amphi: 24, xeno: 6 },
    })
  })

  it('base 28: torqueLengths [9, 3], hasWarp true, 378 demons', () => {
    const s = summarize(createNumogram(28))
    expect(s.torqueLengths).toEqual([9, 3])
    expect(s.hasWarp).toBe(true)
    expect(s.demonCount).toBe(378)
  })

  it('base 16: torqueLengths [4, 2]', () => {
    expect(summarize(createNumogram(16)).torqueLengths).toEqual([4, 2])
  })

  it('base 65536: at most SUMMARY_TORQUE_LIMIT torque lengths', () => {
    const g = createNumogram(65536)
    const s = summarize(g)
    expect(s.torqueLengths).toHaveLength(Math.min(g.torqueCount, SUMMARY_TORQUE_LIMIT))
  })
})

describe('base 28: a structural view', () => {
  const g = createNumogram(28)
  const view = buildNumogramView(g)

  it('14 syzygies, first a=13 b=14 (pair ids descending)', () => {
    expect(view.syzygies).toHaveLength(14)
    expect(view.syzygies[0]).toMatchObject({ a: 13, b: 14 })
  })

  it('14 currents', () => {
    expect(view.currents).toHaveLength(14)
  })

  it('28 gates, each gates[z].from === z', () => {
    expect(view.gates).toHaveLength(28)
    view.gates.forEach((gate, z) => expect(gate.from).toBe(z))
  })

  it('378 demons', () => {
    expect(view.demons).toHaveLength(378)
  })

  it('lore is null', () => {
    expect(view.lore).toBeNull()
  })

  it('every zoneColors entry is one of the three region colors', () => {
    const allowed = new Set(['#00ccff', '#44cc77', '#aa6633'])
    for (const color of view.zoneColors) expect(allowed.has(color)).toBe(true)
  })

  it('current labels contain the minus sign U+2212', () => {
    const minus = String.fromCodePoint(0x2212)
    for (const c of view.currents) expect(c.label.includes(minus)).toBe(true)
  })
})

describe('base 100: demons null (100 > allChordsMaxN)', () => {
  it('demons is null', () => {
    const g = createNumogram(100)
    expect(g.base).toBeGreaterThan(ALL_CHORDS_MAX_N)
    expect(buildNumogramView(g).demons).toBeNull()
  })
})

describe('sweep every even base 2..40', () => {
  for (let n = 2; n <= 40; n += 2) {
    it(`base ${n}: unique names, full pair coverage, in-range destinations, no NaN/undefined`, () => {
      const g = createNumogram(n)
      const view = buildNumogramView(g)

      const currentNames = view.currents.map(c => c.name)
      expect(new Set(currentNames).size).toBe(currentNames.length)

      const gateNames = view.gates.map(gt => gt.name)
      expect(new Set(gateNames).size).toBe(gateNames.length)

      const pairIds = view.currents.map(c => g.pairOf(c.from))
      expect(new Set(pairIds).size).toBe(pairIds.length)
      expect(pairIds).toHaveLength(g.pairCount)

      for (const c of view.currents) {
        const dest = view.presetCurrentDest(c)
        expect(dest).toBeGreaterThanOrEqual(0)
        expect(dest).toBeLessThan(n)
      }

      const torqueZoneCountSum = g.torques.reduce((sum, cycle) => sum + cycle.zoneCount, 0)
      expect(view.torqueEdges).toHaveLength(torqueZoneCountSum)

      const json = JSON.stringify({
        currents: view.currents,
        gates: view.gates,
        syzygies: view.syzygies,
        demons: view.demons,
        summary: view.summary,
      })
      expect(json).not.toContain('NaN')
      expect(json).not.toContain('undefined')
    })
  }
})
