// Schema test for the committed tier table (REN-01, D-11/D-12/D-14). Every assertion here is data-independent: it
// never pins a specific measured millisecond, memory or overlap number (that would break on the next re-measure on
// different hardware), only schema/invariant facts that must hold for any valid table. Mutation tests
// (structuredClone then one edit) exercise validateTierTable's rules directly, rather than asserting anything about
// this PC's speed (research Pitfall 10, D-14).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEVICE_PROFILES, MEASURED_SUITES, deriveBoundaries, validateTierTable } from '../scene/tiers'
import type { TierTable } from '../scene/tiers'
import { TIER_TABLE } from '../scene/tierTable'

const JSON_PATH = fileURLToPath(new URL('../scene/tier-table.json', import.meta.url))

/** A structuredClone of TIER_TABLE with one mutation applied; cast back to TierTable for validateTierTable. */
function brokenCopy(edit: (t: TierTable) => void): TierTable {
  const clone = structuredClone(TIER_TABLE)
  edit(clone)
  return clone
}

function hasProblemStartingWith(problems: readonly string[], prefix: string): boolean {
  return problems.some(p => p.startsWith(prefix))
}

describe('TIER_TABLE', () => {
  it('validates with no problems', () => {
    expect(validateTierTable(TIER_TABLE)).toEqual([])
  })

  it('conservative boundary source: every shipped boundary is sw-6x-based, the gpu row stays visible', () => {
    expect(TIER_TABLE.shippedProfile).toBe('sw-6x')
    expect(TIER_TABLE.boundaries.svgRichMaxN.basedOn).toBe('sw-6x')
    expect(TIER_TABLE.boundaries.svgLeanMaxN.basedOn).toBe('sw-6x')
    expect(TIER_TABLE.boundaries.layoutTweenMaxN.basedOn).toBe('sw-6x')
    if (TIER_TABLE.boundaries.canvasMaxN !== null) {
      expect(TIER_TABLE.boundaries.canvasMaxN.basedOn).toBe('sw-6x')
    }
    expect(TIER_TABLE.environments.gpu).toBeDefined()
    expect(TIER_TABLE.environments.gpu.raster).toBe('gpu')
  })

  it('records explicit tier= and WebGL decisions (D-12, D-13)', () => {
    expect(TIER_TABLE.tierOverrideParam).toEqual({ enabled: true, name: 'tier', values: ['svg', 'canvas', 'headless'] })
    expect(typeof TIER_TABLE.webglDecision.adopt).toBe('boolean')
    expect(TIER_TABLE.webglDecision.reason.length).toBeGreaterThan(0)
  })

  it('the stored svgRichMaxN, svgLeanMaxN, allChordsMaxN and canvasAreaLimitPx equal deriveBoundaries over its own rows', () => {
    // Genuinely data-independent: a self-consistency check against the table's own rows, not a pin on any
    // particular measured number (03-10 replaced the interim sw-6x-only rows with a real four-profile run; the
    // exact ms/overlap values on this machine are not asserted here -- engine/test/tiers.select.test.ts already
    // covers deriveBoundaries's arithmetic against small synthetic tables).
    const derived = deriveBoundaries({
      measurements: TIER_TABLE.measurements,
      chords: TIER_TABLE.chords,
      canvasProbes: TIER_TABLE.canvasProbes,
      budgets: TIER_TABLE.budgets,
      shippedProfile: TIER_TABLE.shippedProfile,
    })
    expect(TIER_TABLE.boundaries.svgRichMaxN.n).toBe(derived.svgRichMaxN)
    expect(TIER_TABLE.boundaries.svgLeanMaxN.n).toBe(derived.svgLeanMaxN)
    expect(TIER_TABLE.boundaries.allChordsMaxN.n).toBe(derived.allChordsMaxN)
    expect(TIER_TABLE.boundaries.canvasAreaLimitPx).toBe(derived.canvasAreaLimitPx)
  })

  it('holds measurement rows for every device profile across every measured suite (REN-01: not sw-6x-only)', () => {
    expect(TIER_TABLE.status).toBe('measured')
    for (const p of DEVICE_PROFILES) {
      for (const suite of MEASURED_SUITES) {
        expect(TIER_TABLE.measurements.some(m => m.profile === p && m.suite === suite)).toBe(true)
      }
    }
  })

  it('is LF-only JSON with a final newline that parses to the object the loader exports', () => {
    const raw = readFileSync(JSON_PATH, 'utf8')
    expect(raw.includes('\r')).toBe(false)
    expect(raw.endsWith('\n')).toBe(true)
    expect(JSON.parse(raw)).toEqual(TIER_TABLE)
  })

  describe('mutation tests: validateTierTable catches a broken copy', () => {
    it('shippedProfile changed to a non-conservative profile', () => {
      const broken = brokenCopy(t => {
        ;(t as { shippedProfile: string }).shippedProfile = 'gpu'
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'shippedProfile gpu')).toBe(true)
    })

    it('a boundary basedOn a different profile than shippedProfile', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.svgRichMaxN as { basedOn: string }).basedOn = 'gpu'
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'boundary svgRichMaxN basedOn gpu')).toBe(true)
    })

    it('the first two rows of a measured series swapped', () => {
      const broken = brokenCopy(t => {
        const rows = t.measurements as unknown as Array<{ profile: string; suite: string; n: number }>
        const richIndices = rows.reduce<number[]>((acc, r, i) => {
          if (r.profile === 'sw-6x' && r.suite === 'svg-rich') acc.push(i)
          return acc
        }, [])
        const i0 = richIndices[0]
        const i1 = richIndices[1]
        if (i0 === undefined || i1 === undefined) throw new Error('expected at least two svg-rich rows')
        const tmp = rows[i0]
        const other = rows[i1]
        if (tmp === undefined || other === undefined) throw new Error('expected rows at the swapped indices')
        rows[i0] = other
        rows[i1] = tmp
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'series sw-6x svg-rich is not strictly increasing')).toBe(true)
    })

    it('tierOverrideParam disabled', () => {
      const broken = brokenCopy(t => {
        ;(t.tierOverrideParam as { enabled: boolean }).enabled = false
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'tierOverrideParam must be enabled')).toBe(true)
    })

    it('an empty webglDecision.reason', () => {
      const broken = brokenCopy(t => {
        ;(t.webglDecision as { reason: string }).reason = ''
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'webglDecision.reason must be non-empty')).toBe(true)
    })

    it('canvasAreaLimitPx set to 0', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries as { canvasAreaLimitPx: number }).canvasAreaLimitPx = 0
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'canvasAreaLimitPx must be a positive integer')).toBe(true)
    })

    it("status 'measured' with a placeholder environment", () => {
      const broken = brokenCopy(t => {
        ;(t as { status: string }).status = 'measured'
        ;(t.environments.sw as { placeholder: boolean }).placeholder = true
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'measured table: environment sw is still a placeholder')).toBe(true)
    })

    it("status 'measured', every placeholder cleared, and a shifted svgRichMaxN", () => {
      const broken = brokenCopy(t => {
        ;(t as { status: string }).status = 'measured'
        for (const p of Object.keys(t.environments) as Array<keyof typeof t.environments>) {
          ;(t.environments[p] as { placeholder: boolean }).placeholder = false
        }
        ;(t.boundaries.svgRichMaxN as { n: number }).n = t.boundaries.svgRichMaxN.n + 2
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'measured table: boundary svgRichMaxN')).toBe(true)
    })

    it('an extra canvas probe marked ok above the area limit', () => {
      const broken = brokenCopy(t => {
        ;(t.canvasProbes as unknown as Array<{ width: number; height: number; ok: boolean }>).push({
          width: 20000,
          height: 20000,
          ok: true,
        })
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'canvas probe 20000x20000 contradicts canvasAreaLimitPx')).toBe(true)
    })
  })
})
