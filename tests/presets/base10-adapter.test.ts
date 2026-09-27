import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURRENTS as SEAM_CURRENTS, LEGACY_CURRENTS } from '../../app/data/currents'
import { SYZYGIES as SEAM_SYZYGIES } from '../../app/data/syzygies'
import { CURRENTS, legacyCurrentFrom } from '../../app/presets/base10/currents'
import { CURRENT_LORE, DEMON_NAMES, SYZYGY_LORE } from '../../app/presets/base10/lore'
import { BASE10 } from '../../app/presets/base10/numogram'
import { SYZYGIES } from '../../app/presets/base10/syzygies'

// MIG-01 / D-01 / D-02: the base-10 adapter derives the viewer's data shapes from the engine (createNumogram(10))
// joined with the lore by id. Swap 1 (plan 02-08): syzygies. Swap 2 (plan 02-09): currents. The frozen numeric oracle
// (base10.golden.json, never regenerated) and the definitions below, not the adapter, say what the values must be.

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url)), 'utf8'),
) as { pairs: [number, number][]; currents: { name: string; pair: [number, number]; from: number; to: number }[] }

// U+2212 MINUS SIGN, built from its code point so this file holds no escape sequence.
const MINUS = String.fromCharCode(0x2212)
const codePoints = (s: string): number[] => Array.from(s).map((ch) => ch.codePointAt(0) as number)

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

})

describe('currents', () => {
  // Viewer order: Surge, Hold, Sink (the Torque cycle in flow order), then Warp, then Plex = pair ids 1, 2, 4, 3, 0.
  const PAIR_IDS = [1, 2, 4, 3, 0]

  it('deep-equal the hand-authored data still present in this commit, every label character included', () => {
    expect(CURRENTS).toStrictEqual(LEGACY_CURRENTS)
    CURRENTS.forEach((c, i) => {
      expect(codePoints(c.label), `label ${i}`).toEqual(codePoints(LEGACY_CURRENTS[i]?.label ?? ''))
    })
  })

  it('are the five currents of the frozen oracle (name, from, to), in the same order', () => {
    expect(golden.currents).toHaveLength(5)
    expect(CURRENTS.map((c) => ({ name: c.name, from: c.from, to: c.to }))).toEqual(
      golden.currents.map((c) => ({ name: c.name, from: c.from, to: c.to })),
    )
  })

  it('come from the engine: Torque pairs in flow order, then the Warp pair, then the Plex pair', () => {
    const order = [
      ...BASE10.torques.flatMap((c) => Array.from(c.pairs())),
      ...(BASE10.warp === null ? [] : [BASE10.warp.firstPair]),
      BASE10.plex.firstPair,
    ]
    expect(order).toEqual(PAIR_IDS)
    expect(CURRENTS).toHaveLength(BASE10.pairCount)
    CURRENTS.forEach((c, i) => {
      const pair = BASE10.pair(PAIR_IDS[i] as number)
      const cur = BASE10.current(pair.id)
      expect(c.to, c.name).toBe(cur.to)
      expect(c.to, c.name).toBe(pair.hi - pair.lo)
      expect([pair.lo, pair.hi], c.name).toContain(c.from)
    })
  })

  it('label every current as hi, U+2212 minus, lo, =, to in base-10 numerals (8, 1, 7 for Surge), never the ASCII hyphen', () => {
    const expected = [[8, 1, 7], [7, 2, 5], [5, 4, 1], [6, 3, 3], [9, 0, 9]].map(([h, l, t]) => `${h}${MINUS}${l}=${t}`)
    expect(CURRENTS.map((c) => c.label)).toEqual(expected)
    for (const c of CURRENTS) {
      expect(c.label, c.name).not.toContain('-')
      expect(codePoints(c.label).filter((cp) => cp === 0x2212), c.name).toHaveLength(1)
    }
  })

  it('keep the exact key order name, from, to, label, desc that the consumers were written against', () => {
    for (const c of CURRENTS) expect(Object.keys(c)).toEqual(['name', 'from', 'to', 'label', 'desc'])
  })

  it('carry the lore of their own pair id (name and description joined by pair id)', () => {
    CURRENTS.forEach((c, i) => {
      const lore = CURRENT_LORE[PAIR_IDS[i] as number]
      expect(c.name).toBe(lore?.name)
      expect(c.desc).toBe(lore?.desc)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.desc.length).toBeGreaterThan(0)
    })
  })

  it('legacyCurrentFrom is the upstream drawing convention: the even member of the pair, the Plex pair drawn at 9', () => {
    expect(PAIR_IDS.map(legacyCurrentFrom)).toEqual([8, 2, 4, 6, 9])
    expect(legacyCurrentFrom(1)).toBe(8)
    expect(legacyCurrentFrom(2)).toBe(2)
    expect(legacyCurrentFrom(4)).toBe(4)
    expect(legacyCurrentFrom(3)).toBe(6)
    expect(legacyCurrentFrom(0)).toBe(9)
    CURRENTS.forEach((c, i) => expect(c.from, c.name).toBe(legacyCurrentFrom(PAIR_IDS[i] as number)))
  })

  it('are the very array the app/data seam exports (the consumers keep their import)', () => {
    expect(SEAM_CURRENTS).toBe(CURRENTS)
  })
})

describe('adapter files (NOTICE section 1: original MIT code) hold no CCRU lore text', () => {
  it('no file in app/presets/base10 other than lore.ts contains a syzygy or current name, demon name or description', () => {
    const dir = fileURLToPath(new URL('../../app/presets/base10/', import.meta.url))
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'lore.ts')
    expect(files).toContain('syzygies.ts')
    expect(files).toContain('currents.ts')
    expect(files).toContain('numogram.ts')
    const lore = Object.values(SYZYGY_LORE).flatMap((l) => [l.demon, l.desc])
    expect(lore.length).toBe(10)
    // Current names are one short word each (comments may legitimately say Warp or Plex), so a quoted literal is what
    // counts as hard-coded lore; the descriptions are prose and must not appear at all.
    const currentLore = Object.values(CURRENT_LORE)
    expect(currentLore.length).toBe(5)
    for (const f of files) {
      const text = readFileSync(dir + f, 'utf8')
      for (const s of lore) expect(text, `${f} contains lore text`).not.toContain(s)
      for (const l of currentLore) {
        expect(text, `${f} contains a current description`).not.toContain(l.desc)
        expect(text, `${f} hard-codes the current name ${l.name}`).not.toContain(`'${l.name}'`)
        expect(text, `${f} hard-codes the current name ${l.name}`).not.toContain(`"${l.name}"`)
      }
    }
  })
})
