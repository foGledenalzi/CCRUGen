// app/lib/tierBounds.ts refuses to load a tier table that has no interactive ceiling (Phase 6 review IN-05). The engine's
// interactiveCeiling returns Infinity for such a table (documented and tested there); in the app that would turn every tier
// decision into "never above the ceiling", so a regenerated or hand-edited table that dropped the field must fail at module
// load instead of shipping. The table is replaced through vi.doMock on the JSON file, so the real table is never edited.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import tierTableJson from '../../engine/scene/tier-table.json'

const JSON_PATH = '../../engine/scene/tier-table.json'

function mockBoundaries(mutate: (boundaries: Record<string, unknown>) => void): void {
  const boundaries: Record<string, unknown> = JSON.parse(JSON.stringify(tierTableJson.boundaries))
  mutate(boundaries)
  vi.doMock(JSON_PATH, () => ({ default: { ...tierTableJson, boundaries } }))
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock(JSON_PATH)
  vi.resetModules()
})

describe('tierBounds with a table that has no interactive ceiling (IN-05)', () => {
  it('control: the shipped table loads and its ceiling is finite', async () => {
    const m = await import('../../app/lib/tierBounds')
    expect(Number.isFinite(m.INTERACTIVE_MAX_N)).toBe(true)
    expect(m.INTERACTIVE_MAX_N).toBe(tierTableJson.boundaries.interactiveMaxN.n)
  })

  it('throws at load when neither canvasMaxN nor interactiveMaxN is set', async () => {
    mockBoundaries(b => {
      b.canvasMaxN = null
      delete b.interactiveMaxN
    })
    await expect(import('../../app/lib/tierBounds')).rejects.toThrow('tier table has no interactive ceiling')
  })

  it('throws when interactiveMaxN is absent and canvasMaxN is null (the shipped canvasMaxN)', async () => {
    expect(tierTableJson.boundaries.canvasMaxN).toBeNull()
    mockBoundaries(b => {
      delete b.interactiveMaxN
    })
    await expect(import('../../app/lib/tierBounds')).rejects.toThrow(/interactive ceiling/)
  })

  it('loads when only a measured canvasMaxN supplies the ceiling', async () => {
    mockBoundaries(b => {
      delete b.interactiveMaxN
      b.canvasMaxN = { n: 3000, basedOn: 'sw-6x', rule: 'test' }
    })
    const m = await import('../../app/lib/tierBounds')
    expect(m.INTERACTIVE_MAX_N).toBe(3000)
  })
})
