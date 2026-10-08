// Schema test for the committed tier table (REN-01, D-11/D-12/D-14). Every assertion here is data-independent: it
// never pins a specific measured millisecond, memory or overlap number (that would break on the next re-measure on
// different hardware), only schema/invariant facts that must hold for any valid table. Mutation tests
// (structuredClone then one edit) exercise validateTierTable's rules directly, rather than asserting anything about
// this PC's speed (research Pitfall 10, D-14).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEVICE_PROFILES, MEASURED_SUITES, deriveBoundaries, interactiveCeiling, selectTier, validateTierTable } from '../scene/tiers'
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

  describe('the shipped interactive ceiling (Phase 6 D-01)', () => {
    it('is a data field basedOn the shipped profile, equal to the measured canvas target and inside the measured range', () => {
      const im = TIER_TABLE.boundaries.interactiveMaxN
      expect(im).toBeDefined()
      if (im === undefined) return
      expect(im.basedOn).toBe(TIER_TABLE.shippedProfile)
      expect(Number.isInteger(im.n)).toBe(true)
      expect(im.n).toBeGreaterThanOrEqual(TIER_TABLE.boundaries.svgRichMaxN.n)
      expect(im.n).toBe(TIER_TABLE.budgets.canvasTargetN)
      expect(im.rule.length).toBeGreaterThan(0)
      // canvasMaxN stays what the measurements derive (null: no ceiling found), so the ceiling is its own field.
      expect(TIER_TABLE.boundaries.canvasMaxN).toBeNull()
      expect(interactiveCeiling(TIER_TABLE)).toBe(im.n)
    })

    it('selectTier on the real table: svg, canvas up to the ceiling, headless above; no lean tier (D-03)', () => {
      const im = TIER_TABLE.boundaries.interactiveMaxN
      if (im === undefined) throw new Error('interactiveMaxN is missing from the shipped table')
      const rich = TIER_TABLE.boundaries.svgRichMaxN.n
      expect(selectTier(rich, TIER_TABLE)).toBe('svg')
      expect(selectTier(rich + 2, TIER_TABLE)).toBe('canvas')
      expect(selectTier(TIER_TABLE.boundaries.svgLeanMaxN.n + 2, TIER_TABLE)).toBe('canvas')
      expect(selectTier(im.n, TIER_TABLE)).toBe('canvas')
      expect(selectTier(im.n + 2, TIER_TABLE)).toBe('headless')
      expect(selectTier(2 ** 26, TIER_TABLE)).toBe('headless')
    })
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

    // ---- interactiveMaxN: one mutant per validator rule (T-06-07) ----

    it('interactiveMaxN deleted from a measured table', () => {
      const broken = brokenCopy(t => {
        delete (t.boundaries as { interactiveMaxN?: unknown }).interactiveMaxN
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'measured table: boundary interactiveMaxN is missing')).toBe(true)
    })

    it('interactiveMaxN basedOn a different profile than shippedProfile', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.interactiveMaxN as { basedOn: string } | undefined)!.basedOn = 'gpu'
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'boundary interactiveMaxN basedOn gpu')).toBe(true)
    })

    it('interactiveMaxN.n not an integer', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.interactiveMaxN as { n: number } | undefined)!.n = 4000.5
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'boundary interactiveMaxN.n must be a non-negative integer')).toBe(true)
    })

    it('interactiveMaxN with an empty rule', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.interactiveMaxN as { rule: string } | undefined)!.rule = ''
      })
      expect(hasProblemStartingWith(validateTierTable(broken), 'boundary interactiveMaxN.rule must be non-empty')).toBe(true)
    })

    it('interactiveMaxN below svgRichMaxN', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.interactiveMaxN as { n: number } | undefined)!.n = t.boundaries.svgRichMaxN.n - 100
      })
      const problems = validateTierTable(broken)
      expect(
        hasProblemStartingWith(
          problems,
          `boundary interactiveMaxN (${TIER_TABLE.boundaries.svgRichMaxN.n - 100}) is below svgRichMaxN (${TIER_TABLE.boundaries.svgRichMaxN.n})`,
        ),
      ).toBe(true)
    })

    it('interactiveMaxN above the largest measured canvas n', () => {
      const broken = brokenCopy(t => {
        ;(t.boundaries.interactiveMaxN as { n: number } | undefined)!.n += 2
      })
      const im = TIER_TABLE.boundaries.interactiveMaxN
      if (im === undefined) throw new Error('interactiveMaxN is missing from the shipped table')
      expect(
        hasProblemStartingWith(
          validateTierTable(broken),
          `measured table: boundary interactiveMaxN (${im.n + 2}) exceeds the largest measured canvas n (${im.n})`,
        ),
      ).toBe(true)
    })

    it('interactiveMaxN above a non-null canvasMaxN', () => {
      const im = TIER_TABLE.boundaries.interactiveMaxN
      if (im === undefined) throw new Error('interactiveMaxN is missing from the shipped table')
      const broken = brokenCopy(t => {
        ;(t.boundaries as { canvasMaxN: unknown }).canvasMaxN = { n: im.n - 1000, basedOn: 'sw-6x', rule: 'x' }
      })
      expect(
        validateTierTable(broken).some(p => p.includes(`boundary interactiveMaxN (${im.n}) exceeds canvasMaxN (${im.n - 1000})`)),
      ).toBe(true)
    })
  })
})
