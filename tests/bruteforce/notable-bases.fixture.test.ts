// Guards the frozen notable-bases fixture (Phase 2, D-09, D-10).
//
// engine/test/fixtures/derived/notable-bases.golden.json was captured once from the independent, definitions-only
// reference in this folder and is sha256-frozen in its own manifest. This test checks the bytes, the manifest, and
// that recomputing every entry from the reference reproduces the file. The file is never regenerated: if this test
// fails, fix the code that drifted (or the reference, proven by numogramReference.test.ts), not the JSON.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, verifyManifestFile } from '../../scripts/golden-manifest.mjs'
import {
  REF_SUBTYPES,
  type RefKind,
  type RefStructure,
  type RefSubtype,
  refDemons,
  refStructure,
  refSubtypeCounts,
} from './numogramReference'

const FIXTURE_PATH = 'engine/test/fixtures/derived/notable-bases.golden.json'
const MANIFEST_PATH = 'engine/test/fixtures/derived/MANIFEST.json'

interface FullEntry {
  base: number
  pairCount: number
  warp: boolean
  cycles: Array<{ kind: RefKind; pairs: number[] }>
  torqueLengths: number[]
  gates: number[]
  demonCount: number
  numodemonCount: number
  subtypeCounts: Record<RefSubtype, number>
}
interface DigestEntry {
  base: number
  warp: boolean
  torqueLengths: number[]
  demonCount: number
  numodemonCount: number
  subtypeCounts: Record<RefSubtype, number>
}
interface Fixture {
  schema: number
  source: string
  bases: FullEntry[]
  digests: DigestEntry[]
}
interface Manifest {
  version: number
  strictDir: string | null
  sets: Array<{ set: string; date: string; reason: string; files: Record<string, string> }>
}

const raw = readFileSync(join(ROOT, FIXTURE_PATH))
const fixture = JSON.parse(raw.toString('utf8')) as Fixture

const FULL_BASES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 28, 32, 36, 64, 80, 82, 100]
const DIGEST_BASES = [256, 666, 1000, 1024]

const torqueLengths = (s: RefStructure): number[] => s.cycles.filter((c) => c.kind === 'torque').map((c) => c.pairs.length)
const hasWarp = (s: RefStructure): boolean => s.cycles.some((c) => c.kind === 'warp')
const sumOf = (counts: Record<RefSubtype, number>): number => REF_SUBTYPES.reduce((sum, name) => sum + counts[name], 0)
function entryFor<T extends { base: number }>(list: T[], base: number): T {
  const found = list.find((e) => e.base === base)
  if (found === undefined) throw new Error(`no entry for base ${base}`)
  return found
}

describe('fixture file', () => {
  it('is LF only and ends with a newline', () => {
    expect(raw.includes(13)).toBe(false)
    expect(raw[raw.length - 1]).toBe(10)
  })

  it('has schema 1, a provenance line and the planned base lists in order', () => {
    expect(Object.keys(fixture)).toEqual(['schema', 'source', 'bases', 'digests'])
    expect(fixture.schema).toBe(1)
    expect(fixture.source).toContain('tests/bruteforce/numogramReference.ts')
    expect(fixture.bases.map((e) => e.base)).toEqual(FULL_BASES)
    expect(fixture.digests.map((e) => e.base)).toEqual(DIGEST_BASES)
  })

  it('keeps each entry keys and the subtype keys in the documented order', () => {
    for (const e of fixture.bases) {
      expect(Object.keys(e), `base ${e.base}`).toEqual([
        'base',
        'pairCount',
        'warp',
        'cycles',
        'torqueLengths',
        'gates',
        'demonCount',
        'numodemonCount',
        'subtypeCounts',
      ])
      expect(Object.keys(e.subtypeCounts)).toEqual([...REF_SUBTYPES])
    }
    for (const e of fixture.digests) {
      expect(Object.keys(e), `digest ${e.base}`).toEqual(['base', 'warp', 'torqueLengths', 'demonCount', 'numodemonCount', 'subtypeCounts'])
      expect(Object.keys(e.subtypeCounts)).toEqual([...REF_SUBTYPES])
    }
  })
})

describe('manifest', () => {
  it('verifies: the frozen file is intact and nothing else sits in the strict directory', () => {
    expect(verifyManifestFile(MANIFEST_PATH)).toEqual([])
  })

  it('is a strict, single-set manifest with a written reason for exactly this fixture', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST_PATH), 'utf8')) as Manifest
    expect(manifest.version).toBe(1)
    expect(manifest.strictDir).toBe('engine/test/fixtures/derived')
    expect(manifest.sets).toHaveLength(1)
    const [set] = manifest.sets
    if (set === undefined) throw new Error('no set')
    expect(set.set).toMatch(/^\d{4}-\d{2}-\d{2}-notable-bases$/)
    expect(set.reason.trim().length).toBeGreaterThan(0)
    expect(Object.keys(set.files)).toEqual([FIXTURE_PATH])
  })
})

describe('recomputing from the reference reproduces the fixture', () => {
  for (const base of FULL_BASES) {
    it(`base ${base} (full entry)`, () => {
      const s = refStructure(base)
      const demons = refDemons(s)
      const expected: FullEntry = {
        base,
        pairCount: base / 2,
        warp: hasWarp(s),
        cycles: s.cycles.map((c) => ({ kind: c.kind, pairs: [...c.pairs] })),
        torqueLengths: torqueLengths(s),
        gates: [...s.gates],
        demonCount: demons.length,
        numodemonCount: demons.filter((d) => d.numodemon).length,
        subtypeCounts: refSubtypeCounts(s),
      }
      expect(entryFor(fixture.bases, base)).toEqual(expected)
    })
  }

  for (const base of DIGEST_BASES) {
    it(`base ${base} (digest)`, () => {
      const s = refStructure(base)
      const subtypeCounts = refSubtypeCounts(s)
      let numodemons = 0
      for (let a = 1; a < base; a++) for (let b = 0; b < a; b++) if (a + b === base) numodemons++
      const expected: DigestEntry = {
        base,
        warp: hasWarp(s),
        torqueLengths: torqueLengths(s),
        demonCount: sumOf(subtypeCounts),
        numodemonCount: numodemons,
        subtypeCounts,
      }
      expect(entryFor(fixture.digests, base)).toEqual(expected)
    })
  }
})

describe('spot literals (research facts, not read back from the reference)', () => {
  it('base 28: 378 demons of which 108 cross the two Torques', () => {
    const e = entryFor(fixture.bases, 28)
    expect(e.subtypeCounts['cross-torque-chrono']).toBe(108)
    expect(e.demonCount).toBe(378)
  })
  it('Torque lengths in pairs: base 82 [27, 9, 3], base 80 [39], base 16 [4, 2]', () => {
    expect(entryFor(fixture.bases, 82).torqueLengths).toEqual([27, 9, 3])
    expect(entryFor(fixture.bases, 80).torqueLengths).toEqual([39])
    expect(entryFor(fixture.bases, 16).torqueLengths).toEqual([4, 2])
  })
  it('base 12 gates 0, 1, 3, 6, a, 4, a, 6, 3, 1, b, b as values', () => {
    expect(entryFor(fixture.bases, 12).gates).toEqual([0, 1, 3, 6, 10, 4, 10, 6, 3, 1, 11, 11])
  })
  it('base 10 splits 12 + 3 chrono, 12 + 12 amphi, 4 + 2 xeno', () => {
    const c = entryFor(fixture.bases, 10).subtypeCounts
    expect([c['cyclic-chrono'], c['syzygetic-chrono'], c['plex-amphi'], c['warp-amphi'], c['chaotic-xeno'], c['syzygetic-xeno']]).toEqual([12, 3, 12, 12, 4, 2])
  })
  it('base 666 digest: 221445 demons, 14 Torque cycles, no Warp', () => {
    const e = entryFor(fixture.digests, 666)
    expect(e.demonCount).toBe(221445)
    expect(e.torqueLengths).toHaveLength(14)
    expect(e.warp).toBe(false)
  })
  it('every entry has n(n-1)/2 demons, n/2 - 1 Numodemons and n/2 syzygetic demons', () => {
    for (const e of [...fixture.bases, ...fixture.digests]) {
      expect(e.demonCount, `demons at ${e.base}`).toBe((e.base * (e.base - 1)) / 2)
      expect(e.numodemonCount, `numodemons at ${e.base}`).toBe(e.base / 2 - 1)
      expect(e.subtypeCounts['syzygetic-chrono'] + e.subtypeCounts['syzygetic-xeno'], `syzygetic at ${e.base}`).toBe(e.base / 2)
      expect(sumOf(e.subtypeCounts), `sum at ${e.base}`).toBe(e.demonCount)
    }
  })
})
