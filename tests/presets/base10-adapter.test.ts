import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEGACY_SYZYGIES, SYZYGIES as SEAM_SYZYGIES } from '../../app/data/syzygies'
import { DEMON_NAMES, SYZYGY_LORE } from '../../app/presets/base10/lore'
import { BASE10 } from '../../app/presets/base10/numogram'
import { SYZYGIES } from '../../app/presets/base10/syzygies'

// MIG-01 / D-01 / D-02: the base-10 adapter derives the viewer's data shapes from the engine (createNumogram(10))
// joined with the lore by id. Swap 1 (plan 02-08): syzygies. The frozen numeric oracle (base10.golden.json, never
// regenerated) and the definitions below, not the adapter, say what the values must be.

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as { pairs: [number, number][] }

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

  it('are the very array the app/data seam exports (the consumers keep their import)', () => {
    expect(SEAM_SYZYGIES).toBe(SYZYGIES)
  })

  it('equals the hand-authored data until it is deleted (plan 02-08 Task 2)', () => {
    expect(SYZYGIES).toEqual(LEGACY_SYZYGIES)
    expect(SYZYGIES.map((s) => Object.keys(s))).toEqual(LEGACY_SYZYGIES.map((s) => Object.keys(s)))
  })
})

describe('adapter files (NOTICE section 1: original MIT code) hold no CCRU lore text', () => {
  it('no file in app/presets/base10 other than lore.ts contains a syzygy demon name or description', () => {
    const dir = fileURLToPath(new URL('../../app/presets/base10/', import.meta.url))
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'lore.ts')
    expect(files).toContain('syzygies.ts')
    expect(files).toContain('numogram.ts')
    const lore = Object.values(SYZYGY_LORE).flatMap((l) => [l.demon, l.desc])
    expect(lore.length).toBe(10)
    for (const f of files) {
      const text = readFileSync(dir + f, 'utf8')
      for (const s of lore) expect(text, `${f} contains lore text`).not.toContain(s)
    }
  })
})
