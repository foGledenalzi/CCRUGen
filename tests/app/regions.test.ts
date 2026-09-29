// Tests for app/lib/regions.ts (UI-05, D-19..D-24). Thresholds and structure come from the engine, never a
// hard-coded base-10 zone list, so these tests exercise base 10, 28, 64 and 12 (no Warp).
import { describe, expect, it } from 'vitest'
import { createNumogram, torqueLabel } from '../../engine/index'
import {
  EMPTY_REGION_FILTER,
  ZONE_DIMMED,
  ZONE_HIDDEN,
  ZONE_NORMAL,
  elementState,
  isRegionId,
  parseRegionId,
  regionFilterActive,
  regionLabel,
  regionOfZone,
  regionRows,
  sanitizeRegionFilter,
  toggleIsolate,
  toggleMute,
  zoneStates,
  zonesOfRegion,
  type RegionFilter,
} from '../../app/lib/regions'

describe('regionRows', () => {
  it('base 10: torque, warp, plex rows with the expected labels and zones', () => {
    const g = createNumogram(10)
    const rows = regionRows(g)
    expect(rows.map(r => r.id)).toEqual(['torque', 'warp', 'plex'])
    expect(rows.map(r => r.label)).toEqual(['Torque', 'Warp', 'Plex'])
    const byId = new Map(rows.map(r => [r.id, r]))
    expect(byId.get('torque')?.zones).toEqual([1, 2, 4, 5, 7, 8])
    expect(byId.get('warp')?.zones).toEqual([3, 6])
    expect(byId.get('plex')?.zones).toEqual([0, 9])
  })

  it('base 28: two Torque rows labelled with torqueLabel, then warp, then plex; "torque" is also a valid umbrella id', () => {
    const g = createNumogram(28)
    const rows = regionRows(g)
    expect(rows.map(r => r.id)).toEqual(['torque:0', 'torque:1', 'warp', 'plex'])
    expect(rows.map(r => r.label)).toEqual([`Torque ${torqueLabel(0)}`, `Torque ${torqueLabel(1)}`, 'Warp', 'Plex'])
    expect(rows.slice(0, 2).map(r => r.lengthInPairs)).toEqual([9, 3])

    expect(isRegionId('torque', g)).toBe(true)
    const union = zonesOfRegion(g, 'torque')
    expect(union).toHaveLength(24)
    expect(union).toEqual([...union].sort((a, b) => a - b))
  })

  it('base 64: one row per Torque cycle, at least 6', () => {
    const g = createNumogram(64)
    const rows = regionRows(g)
    const torqueRows = rows.filter(r => r.id !== 'warp' && r.id !== 'plex')
    expect(torqueRows).toHaveLength(g.torqueCount)
    expect(g.torqueCount).toBeGreaterThanOrEqual(6)
  })

  it('base 12 has no Warp: "warp" is not a valid id and is absent from the rows', () => {
    const g = createNumogram(12)
    expect(g.warp).toBeNull()
    expect(isRegionId('warp', g)).toBe(false)
    expect(regionRows(g).map(r => r.id)).not.toContain('warp')
  })
})

describe('regionLabel (UI-07, keyboard/ARIA names)', () => {
  it('the umbrella and single-cycle forms, plus plex and warp', () => {
    expect(regionLabel('torque')).toBe('Torque')
    expect(regionLabel('torque:0')).toBe(`Torque ${torqueLabel(0)}`)
    expect(regionLabel('torque:0')).toBe('Torque A')
    expect(regionLabel('torque:26')).toBe(`Torque ${torqueLabel(26)}`)
    expect(regionLabel('torque:26')).toBe('Torque 27')
    expect(regionLabel('plex')).toBe('Plex')
    expect(regionLabel('warp')).toBe('Warp')
  })
})

describe('regionOfZone / isRegionId', () => {
  it('base 10: zone 5 is torque; "torque" is valid, "torque:0" is not (single-cycle base)', () => {
    const g = createNumogram(10)
    expect(regionOfZone(g, 5)).toBe('torque')
    expect(isRegionId('torque', g)).toBe(true)
    expect(isRegionId('torque:0', g)).toBe(false)
  })
})

describe('parseRegionId rejects malformed or hostile input', () => {
  const g10 = createNumogram(10)
  const g28 = createNumogram(28)

  it.each([
    ['torque:01', 10],
    ['torque:-1', 10],
    ['torque:1.5', 10],
    ['torque:99', 28],
    ['TORQUE', 10],
    ['__proto__', 10],
    ['constructor', 10],
    ['', 10],
  ] as const)('rejects %s at base %i', (value, base) => {
    const g = base === 10 ? g10 : g28
    expect(parseRegionId(value, g)).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(parseRegionId(null, g10)).toBeNull()
    expect(parseRegionId(undefined, g10)).toBeNull()
  })

  it('accepts a valid multi-cycle id', () => {
    expect(parseRegionId('torque:0', g28)).toBe('torque:0')
    expect(parseRegionId('torque:1', g28)).toBe('torque:1')
  })
})

describe('region filter: isolate, mute, sanitize, active', () => {
  it('toggleIsolate and toggleMute are independent and always return new objects', () => {
    const f1 = toggleIsolate(EMPTY_REGION_FILTER, 'plex')
    expect(f1).not.toBe(EMPTY_REGION_FILTER)
    expect(f1.isolate.has('plex')).toBe(true)
    expect(f1.mute.size).toBe(0)

    const f2 = toggleMute(f1, 'warp')
    expect(f2).not.toBe(f1)
    expect(f2.isolate.has('plex')).toBe(true)
    expect(f2.mute.has('warp')).toBe(true)

    const f3 = toggleIsolate(f2, 'plex')
    expect(f3).not.toBe(f2)
    expect(f3.isolate.has('plex')).toBe(false)
    expect(f3.mute.has('warp')).toBe(true)
  })

  it('sanitizeRegionFilter drops ids invalid for g', () => {
    const g10 = createNumogram(10)
    const f: RegionFilter = { isolate: new Set(['torque:0', 'plex']), mute: new Set(['warp']) }
    const sanitized = sanitizeRegionFilter(f, g10)
    expect([...sanitized.isolate]).toEqual(['plex'])
    expect([...sanitized.mute]).toEqual(['warp'])
  })

  it('regionFilterActive is false only for two empty sets', () => {
    expect(regionFilterActive(EMPTY_REGION_FILTER)).toBe(false)
    expect(regionFilterActive(toggleIsolate(EMPTY_REGION_FILTER, 'plex'))).toBe(true)
    expect(regionFilterActive(toggleMute(EMPTY_REGION_FILTER, 'plex'))).toBe(true)
  })
})

describe('zoneStates and elementState', () => {
  it('base 28, isolate torque:0: 2 on its own zones, 1 elsewhere', () => {
    const g = createNumogram(28)
    const f = toggleIsolate(EMPTY_REGION_FILTER, 'torque:0')
    const states = zoneStates(g, f)
    const torque0Zones = new Set(zonesOfRegion(g, 'torque:0'))
    for (let z = 0; z < g.zoneCount; z++) {
      expect(states[z]).toBe(torque0Zones.has(z) ? ZONE_NORMAL : ZONE_DIMMED)
    }
  })

  it('adding mute plex sets plex zones to 0 even while torque:0 is isolated', () => {
    const g = createNumogram(28)
    let f = toggleIsolate(EMPTY_REGION_FILTER, 'torque:0')
    f = toggleMute(f, 'plex')
    const states = zoneStates(g, f)
    for (const z of zonesOfRegion(g, 'plex')) expect(states[z]).toBe(ZONE_HIDDEN)
  })

  it('isolate and mute of the same region -> 0 (mute wins)', () => {
    const g = createNumogram(28)
    let f = toggleIsolate(EMPTY_REGION_FILTER, 'plex')
    f = toggleMute(f, 'plex')
    const states = zoneStates(g, f)
    for (const z of zonesOfRegion(g, 'plex')) expect(states[z]).toBe(ZONE_HIDDEN)
  })

  it('empty filter -> all zones normal', () => {
    const g = createNumogram(28)
    const states = zoneStates(g, EMPTY_REGION_FILTER)
    expect(Array.from(states)).toEqual(new Array(g.zoneCount).fill(ZONE_NORMAL))
  })

  it('elementState is the min state among the given zones', () => {
    const states = Uint8Array.from([2, 2, 1, 0, 2])
    expect(elementState(states, [0, 1])).toBe(2)
    expect(elementState(states, [0, 2])).toBe(1)
    expect(elementState(states, [0, 3])).toBe(0)
  })
})
