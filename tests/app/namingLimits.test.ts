// The naming limits (plan 07-11, orchestrator decision 3): every number the Names feature uses is a named data value, and the
// collision scan limit is capped by the interactive ceiling that is read from the tier table, never typed. The tier table is replaced
// through vi.doMock on the JSON file (the tierBoundsCeiling.test.ts pattern), so the real table is never edited.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import tierTableJson from '../../engine/scene/tier-table.json'
import { COLLISION_SCAN_MAX_N, NAME_MAX_LENGTH, SEED_MAX_LENGTH, SOUND_MAX_LENGTH } from '../../engine/index'
import * as limits from '../../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'

const JSON_PATH = '../../engine/scene/tier-table.json'
const LIMITS_SOURCE = fileURLToPath(new URL('../../app/lib/namingLimits.ts', import.meta.url))

function mockCeiling(n: number): void {
  const boundaries: Record<string, unknown> = JSON.parse(JSON.stringify(tierTableJson.boundaries))
  boundaries.interactiveMaxN = { ...(boundaries.interactiveMaxN as Record<string, unknown>), n }
  vi.doMock(JSON_PATH, () => ({ default: { ...tierTableJson, boundaries } }))
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock(JSON_PATH)
  vi.resetModules()
})

describe('naming limits as data', () => {
  it('has the documented defaults', () => {
    expect(limits.NAMING_COLLISION_SCAN_MAX_N).toBe(1024)
    expect(limits.NAMING_AUTOSAVE_DEBOUNCE_MS).toBe(400)
    expect(limits.NAMING_STORAGE_PREFIX).toBe('ccrug.naming.v1.')
    expect(limits.NAMING_UNDO_OVERRIDE_LIMIT).toBe(5000)
    expect(limits.NAMING_UNDO_HEAVY_DEPTH).toBe(8)
    expect(limits.REROLL_SEED_LENGTH).toBe(8)
    expect(limits.COLLISION_LINES_STEP).toBe(20)
    expect(limits.COLLISION_JUMPS_SHOWN).toBe(4)
    expect(limits.NAME_TOOLTIP_GRAPHEMES).toBe(32)
    expect(limits.NAMES_PREVIEW_ROWS).toBe(3)
    expect(limits.ZONE_ROW_HEIGHT_PX).toBe(28)
    expect(limits.ZONE_LIST_OVERSCAN).toBe(8)
    expect(limits.ZONE_PAGE_STEP).toBe(10)
    expect(limits.COLLISION_SLICE_MS).toBe(8)
    expect(limits.NAMES_SCROLL_INSET_PX).toBe(12)
    expect(limits.SOUND_FIELD_MAX_INPUT).toBe(64)
  })

  it('every numeric limit is a positive integer', () => {
    const numbers = Object.entries(limits).filter(([, v]) => typeof v === 'number')
    expect(numbers.length).toBeGreaterThanOrEqual(15)
    for (const [name, value] of numbers) {
      expect(Number.isInteger(value), name).toBe(true)
      expect(value as number, name).toBeGreaterThan(0)
    }
  })

  it('keeps each limit consistent with the engine rule it guards', () => {
    expect(limits.REROLL_SEED_LENGTH).toBeLessThanOrEqual(SEED_MAX_LENGTH)
    // the sound field's maxLength cuts an absurd paste before validation, so it must admit every valid sound
    expect(limits.SOUND_FIELD_MAX_INPUT).toBeGreaterThan(SOUND_MAX_LENGTH)
    expect(limits.NAME_TOOLTIP_GRAPHEMES).toBe(NAME_MAX_LENGTH)
    expect(limits.NAMING_UNDO_HEAVY_DEPTH).toBeGreaterThanOrEqual(2)
    expect(limits.NAMING_STORAGE_PREFIX.endsWith('.')).toBe(true)
  })

  it('never types the interactive ceiling: the module source holds no 4000 and reads the ceiling through tierBounds', () => {
    const text = readFileSync(LIMITS_SOURCE, 'utf8')
    expect(text).not.toMatch(/\b4000\b/)
    expect(text).toContain("from './tierBounds'")
  })
})

describe('the collision scan limit (T-07-06b)', () => {
  it('is at most the interactive ceiling and at most the engine scan cap, so createCollisionJob never refuses it', () => {
    expect(limits.NAMING_COLLISION_SCAN_MAX_N).toBeLessThanOrEqual(INTERACTIVE_MAX_N)
    expect(limits.NAMING_COLLISION_SCAN_MAX_N).toBeLessThanOrEqual(COLLISION_SCAN_MAX_N)
  })

  it('collisionScanLimit() is the smaller of the constant and the ceiling (the shipped ceiling is above the constant)', () => {
    expect(INTERACTIVE_MAX_N).toBeGreaterThan(limits.NAMING_COLLISION_SCAN_MAX_N)
    expect(limits.collisionScanLimit()).toBe(limits.NAMING_COLLISION_SCAN_MAX_N)
  })

  it('with the tier table lowered to 512 the constant is unchanged and the panel uses 512', async () => {
    mockCeiling(512)
    const m = await import('../../app/lib/namingLimits')
    expect(m.NAMING_COLLISION_SCAN_MAX_N).toBe(1024)
    expect(m.collisionScanLimit()).toBe(512)
  })

  it('with the tier table raised the limit stays at the constant (the ceiling only ever lowers it)', async () => {
    mockCeiling(8000)
    const m = await import('../../app/lib/namingLimits')
    expect(m.collisionScanLimit()).toBe(1024)
  })

  it('with the tier table at exactly the constant the limit is the constant', async () => {
    mockCeiling(1024)
    const m = await import('../../app/lib/namingLimits')
    expect(m.collisionScanLimit()).toBe(1024)
  })
})
