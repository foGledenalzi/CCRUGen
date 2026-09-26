// The engine vs the frozen, definition-derived notable-bases fixture (engine/test/fixtures/derived/notable-bases.golden.json):
// full entries (bases 2..100) and compact digests (256, 666, 1000, 1024). The demon fields of the fixture are asserted in
// plan 02-05. If a test here fails, the ENGINE is wrong, not the fixture.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createNumogram, formatGateName, formatNumeral } from '../index'

interface FullEntry {
  base: number
  pairCount: number
  warp: boolean
  cycles: { kind: string; pairs: number[] }[]
  torqueLengths: number[]
  gates: number[]
}
interface DigestEntry {
  base: number
  warp: boolean
  torqueLengths: number[]
}
interface NotableFixture {
  bases: FullEntry[]
  digests: DigestEntry[]
}

// Read the frozen file, never write it.
const FIXTURE = fileURLToPath(new URL('./fixtures/derived/notable-bases.golden.json', import.meta.url))
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as NotableFixture

describe('engine vs the notable-bases fixture (full entries)', () => {
  it('holds 17 full entries and 4 digests', () => {
    expect(fixture.bases.map(e => e.base)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 28, 32, 36, 64, 80, 82, 100])
    expect(fixture.digests.map(e => e.base)).toEqual([256, 666, 1000, 1024])
  })

  for (const entry of fixture.bases) {
    it(`base ${entry.base}: pairs, Warp, cycles, Torque lengths and gates`, () => {
      const g = createNumogram(entry.base)
      expect(g.pairCount).toBe(entry.pairCount)
      expect(g.warp !== null).toBe(entry.warp)
      expect(g.cycles.map(c => ({ kind: c.kind, pairs: Array.from(c.pairs()) }))).toEqual(entry.cycles)
      expect(g.torques.map(c => c.lengthInPairs)).toEqual(entry.torqueLengths)
      expect(Array.from({ length: entry.base }, (_, k) => g.gate(k).to)).toEqual(entry.gates)
    })
  }

  it('pins the literals the guide names: 16 [4,2], 28 [9,3], 80 [39], 82 [27,9,3]', () => {
    expect(createNumogram(16).torques.map(c => c.lengthInPairs)).toEqual([4, 2])
    expect(createNumogram(28).torques.map(c => c.lengthInPairs)).toEqual([9, 3])
    expect(createNumogram(80).torques.map(c => c.lengthInPairs)).toEqual([39])
    expect(createNumogram(82).torques.map(c => c.lengthInPairs)).toEqual([27, 9, 3])
  })
})

describe('engine vs the notable-bases fixture (digests)', () => {
  for (const entry of fixture.digests) {
    it(`base ${entry.base}: Warp and Torque lengths`, () => {
      const g = createNumogram(entry.base)
      expect(g.warp !== null).toBe(entry.warp)
      expect(g.torques.map(c => c.lengthInPairs)).toEqual(entry.torqueLengths)
    })
  }
})

describe("the guide's base-12 example", () => {
  const g = createNumogram(12)

  it('writes the gates in base 12 as 0,1,3,6,a,4,a,6,3,1,b,b', () => {
    const written = Array.from({ length: 12 }, (_, k) => formatNumeral(g.gate(k).to, 12)).join(',')
    expect(written).toBe('0,1,3,6,a,4,a,6,3,1,b,b')
  })

  it("names zone 11's gate 'Gt-56' (5 + 6 = 11 = b)", () => {
    expect(g.gate(11).cumulation).toBe(66)
    expect(formatGateName(g.gate(11).cumulation, 12)).toBe('Gt-56')
    expect(g.gate(11).to).toBe(11)
  })

  it('has no Warp and one Torque cycle [1, 2, 4, 3, 5]', () => {
    expect(g.warp).toBeNull()
    expect(g.torqueCount).toBe(1)
    expect(Array.from(g.torques[0]?.pairs() ?? [])).toEqual([1, 2, 4, 3, 5])
  })
})
