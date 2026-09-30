// Tests for app/lib/demonBrowser.ts's taxonomy and facet model (DEM-01, D-05). All counts must equal the engine's
// closed forms directly (g.demons.typeCounts()/counts()), never a re-derived loop over demons. Bases 2, 10, 28, 666
// and every even base 2..200 are exercised so the facet model is proven base-generic, not a base-28/base-10 special case.
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import {
  facetCount,
  facetModel,
  filterContains,
  filterLabel,
  isDemonFilter,
  kindColor,
  parentType,
} from '../../app/lib/demonBrowser'

describe('facetModel', () => {
  it('base 28, no active filter: top chips and empty sub row', () => {
    const g = createNumogram(28)
    const model = facetModel(g, null)
    expect(model.total).toBe(378)
    expect(model.top.map(c => c.id)).toEqual(['all', 'chrono', 'amphi', 'xeno'])
    expect(model.top.map(c => c.count)).toEqual([378, 276, 96, 6])
    expect(model.top.map(c => c.color)).toEqual(['#6b7280', '#00ccff', '#cc8833', '#cc3333'])
    expect(model.top.map(c => c.label)).toEqual(['All', 'Chrono', 'Amphi', 'Xeno'])
    expect(model.top.map(c => c.active)).toEqual([true, false, false, false])
    expect(model.top.every(c => c.disabled === false)).toBe(true)
    expect(model.sub).toEqual([])
  })

  it('base 28, chrono active: sub row is the three chrono subtype chips', () => {
    const g = createNumogram(28)
    const model = facetModel(g, 'chrono')
    expect(model.sub.map(c => c.id)).toEqual(['cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono'])
    expect(model.sub.map(c => c.label)).toEqual(['Cyclic', 'Cross-Torque', 'Syzygetic'])
    expect(model.sub.map(c => c.count)).toEqual([156, 108, 12])
    expect(model.sub.map(c => c.color)).toEqual(['#00ccff', '#00ccff', '#e8e8e8'])
    expect(model.top.find(c => c.id === 'chrono')?.active).toBe(true)
  })

  it('base 28, a chrono subtype active: sub row still follows the parent type, active only on that subtype', () => {
    const g = createNumogram(28)
    const model = facetModel(g, 'cross-torque-chrono')
    expect(model.sub.map(c => c.id)).toEqual(['cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono'])
    expect(model.sub.map(c => c.active)).toEqual([false, true, false])
  })

  it('base 28, amphi and xeno sub rows', () => {
    const g = createNumogram(28)
    expect(facetModel(g, 'amphi').sub.map(c => c.count)).toEqual([48, 48])
    const xenoSub = facetModel(g, 'xeno').sub
    expect(xenoSub.map(c => c.count)).toEqual([4, 2])
    expect(xenoSub.map(c => c.color)).toEqual(['#cc3333', '#e8e8e8'])
  })

  it('base 666: closed-form counts straight from the engine, cross-Torque chrono is the dominant subtype', () => {
    const g = createNumogram(666)
    const model = facetModel(g, null)
    expect(model.top.map(c => c.count)).toEqual([221445, 220116, 1328, 1])
    expect(facetModel(g, 'chrono').sub.map(c => c.count)).toEqual([19900, 199884, 332])
    const amphiSub = facetModel(g, 'amphi').sub
    expect(amphiSub.map(c => c.count)).toEqual([1328, 0])
    expect(amphiSub.find(c => c.id === 'warp-amphi')?.disabled).toBe(true)
    const xenoSub = facetModel(g, 'xeno').sub
    expect(xenoSub.map(c => c.count)).toEqual([0, 1])
    expect(xenoSub.find(c => c.id === 'chaotic-xeno')?.disabled).toBe(true)
  })

  it('base 10: matches the frozen 45-demon split, cross-torque-chrono disabled (single Torque cycle)', () => {
    const g = createNumogram(10)
    const model = facetModel(g, null)
    expect(model.top.map(c => c.count)).toEqual([45, 15, 24, 6])
    const chronoSub = facetModel(g, 'chrono').sub
    expect(chronoSub.map(c => c.count)).toEqual([12, 0, 3])
    expect(chronoSub.find(c => c.id === 'cross-torque-chrono')?.disabled).toBe(true)
    expect(facetModel(g, 'amphi').sub.map(c => c.count)).toEqual([12, 12])
    expect(facetModel(g, 'xeno').sub.map(c => c.count)).toEqual([4, 2])
  })

  it('base 2: the minimal even base, only one demon (a syzygetic xenodemon)', () => {
    const g = createNumogram(2)
    const model = facetModel(g, null)
    expect(model.top.map(c => c.count)).toEqual([1, 0, 0, 1])
    expect(model.top.find(c => c.id === 'chrono')?.disabled).toBe(true)
    expect(model.top.find(c => c.id === 'amphi')?.disabled).toBe(true)
    expect(model.top.find(c => c.id === 'all')?.disabled).toBe(false)
  })

  it('every even base 2..200: type counts sum to All, subtype counts sum to their type, all read from the engine directly', () => {
    for (let base = 2; base <= 200; base += 2) {
      const g = createNumogram(base)
      const model = facetModel(g, null)
      const typeCounts = g.demons.typeCounts()
      const subtypeCounts = g.demons.counts()
      const sumOfTypes = model.top.slice(1).reduce((sum, c) => sum + c.count, 0)
      expect(sumOfTypes).toBe(model.total)
      expect(model.total).toBe(g.demons.count)
      for (const chip of model.top.slice(1)) {
        expect(chip.count).toBe(typeCounts[chip.filter as keyof typeof typeCounts])
      }
      for (const type of ['chrono', 'amphi', 'xeno'] as const) {
        const sub = facetModel(g, type).sub
        const sumOfSub = sub.reduce((sum, c) => sum + c.count, 0)
        expect(sumOfSub).toBe(typeCounts[type])
        for (const chip of sub) {
          expect(chip.count).toBe(subtypeCounts[chip.filter as keyof typeof subtypeCounts])
        }
      }
    }
  })
})

describe('isDemonFilter', () => {
  it('true only for the 10 engine type/subtype names', () => {
    for (const name of ['chrono', 'amphi', 'xeno', 'cyclic-chrono', 'cross-torque-chrono', 'syzygetic-chrono', 'plex-amphi', 'warp-amphi', 'chaotic-xeno', 'syzygetic-xeno']) {
      expect(isDemonFilter(name)).toBe(true)
    }
  })

  it('false for empty, mismatched case, partial, and hostile property-key strings', () => {
    for (const bad of ['', 'Chrono', ' chrono', 'cyclic', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(isDemonFilter(bad)).toBe(false)
    }
  })
})

describe('parentType', () => {
  it('a subtype maps to its type; a type maps to itself', () => {
    expect(parentType('syzygetic-xeno')).toBe('xeno')
    expect(parentType('amphi')).toBe('amphi')
  })
})

describe('filterLabel', () => {
  it('null is All; a type is its TYPE_LABEL; a subtype is its unambiguous SUBTYPE_LABEL', () => {
    expect(filterLabel(null)).toBe('All')
    expect(filterLabel('amphi')).toBe('Amphi')
    expect(filterLabel('syzygetic-xeno')).toBe('Syzygetic xeno')
  })
})

describe('kindColor', () => {
  it('reduces every subtype through the four-bucket legacy kind palette, never the 3-value DemonType', () => {
    expect(kindColor('syzygetic-chrono')).toBe('#e8e8e8')
    expect(kindColor('cross-torque-chrono')).toBe('#00ccff')
    expect(kindColor('warp-amphi')).toBe('#cc8833')
    expect(kindColor('chaotic-xeno')).toBe('#cc3333')
  })
})

describe('facetCount / filterContains', () => {
  it('facetCount matches typeCounts/counts exactly; filterContains matches a DemonRef against a filter', () => {
    const g = createNumogram(28)
    expect(facetCount(g, null)).toBe(378)
    expect(facetCount(g, 'chrono')).toBe(276)
    expect(facetCount(g, 'cross-torque-chrono')).toBe(108)
    const d = g.demons.ref(12, 3)
    expect(filterContains(null, d)).toBe(true)
    expect(filterContains('chrono', d)).toBe(true)
    expect(filterContains('amphi', d)).toBe(false)
    expect(filterContains(d.subtype, d)).toBe(true)
  })
})
