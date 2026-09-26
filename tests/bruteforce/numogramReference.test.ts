// Self-test of the independent brute-force reference (D-09; ENG-01..ENG-04).
//
// The reference is only useful as an oracle if it is right, so it is proven here against hand literals taken from
// the research (PROJECT.md "Verified numogram math", PITFALLS 1-5, recomputed independently) and against the
// definitions restated in this file. Nothing here imports the engine, reads a file, or reuses an engine formula.
// Rows holding arrays are plain `for` loops (Vitest stringifies extra it.each arguments).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  REF_SUBTYPES,
  type RefStructure,
  type RefSubtype,
  refClassify,
  refDemons,
  refDigits,
  refDigitSumRoot,
  refStructure,
  refSubtypeCounts,
} from './numogramReference'

const torqueLengths = (s: RefStructure): number[] => s.cycles.filter((c) => c.kind === 'torque').map((c) => c.pairs.length)
const hasWarp = (s: RefStructure): boolean => s.cycles.some((c) => c.kind === 'warp')
const countsRow = (s: RefStructure): number[] => {
  const counts = refSubtypeCounts(s)
  return REF_SUBTYPES.map((name) => counts[name])
}
// Test-side iterated digit sum through the built-in radix conversion (a different mechanism from the reference).
function builtinRoot(value: number, base: number): number {
  let v = value
  while (v >= base) {
    let sum = 0
    for (const ch of v.toString(base)) sum += Number.parseInt(ch, 36)
    v = sum
  }
  return v
}

describe('REF_SUBTYPES', () => {
  it('lists the seven subtypes in the documented order', () => {
    expect([...REF_SUBTYPES]).toEqual([
      'cyclic-chrono',
      'cross-torque-chrono',
      'syzygetic-chrono',
      'plex-amphi',
      'warp-amphi',
      'chaotic-xeno',
      'syzygetic-xeno',
    ])
  })
})

describe('refDigits', () => {
  it('writes a value in a base, most significant digit first', () => {
    expect(refDigits(66, 12)).toEqual([5, 6])
    expect(refDigits(0, 10)).toEqual([0])
    expect(refDigits(0, 2)).toEqual([0])
    expect(refDigits(10, 12)).toEqual([10])
    expect(refDigits(45, 12)).toEqual([3, 9])
    expect(refDigits(255, 16)).toEqual([15, 15])
    expect(refDigits(3601, 60)).toEqual([1, 0, 1])
    expect(refDigits(1024, 2)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('refuses a negative or non-integer value and a base below 2', () => {
    expect(() => refDigits(-1, 10)).toThrow(Error)
    expect(() => refDigits(1.5, 10)).toThrow(Error)
    expect(() => refDigits(Number.NaN, 10)).toThrow(Error)
    expect(() => refDigits(5, 1)).toThrow(Error)
    expect(() => refDigits(5, 0)).toThrow(Error)
    expect(() => refDigits(5, 2.5)).toThrow(Error)
  })

  for (let base = 2; base <= 36; base++) {
    it(`agrees with Number.prototype.toString(${base}) on 200 fixed-seed values`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (value) => {
          const want = [...value.toString(base)].map((ch) => Number.parseInt(ch, 36))
          expect(refDigits(value, base)).toEqual(want)
        }),
        { seed: 20260930, numRuns: 200 },
      )
    })
  }
})

describe('refDigitSumRoot', () => {
  it('reduces by summing in-base digits until one digit is left; 0 stays 0', () => {
    for (let base = 2; base <= 60; base += 2) expect(refDigitSumRoot(0, base)).toBe(0)
    expect(refDigitSumRoot(10, 12)).toBe(10) // a single digit in base 12: no 1 + 0
    expect(refDigitSumRoot(66, 12)).toBe(11) // 5 + 6
    expect(refDigitSumRoot(12, 12)).toBe(1) // "10"
    expect(refDigitSumRoot(36, 10)).toBe(9) // 3 + 6, a positive multiple of n - 1 lands on n - 1, not 0
    expect(refDigitSumRoot(45, 10)).toBe(9)
    expect(refDigitSumRoot(6, 4)).toBe(3) // "12"
    expect(refDigitSumRoot(15, 8)).toBe(1) // "17" -> 8 -> "10" -> 1
  })

  it('in base 2 every positive value reduces to 1 (n - 1 = 1) and 0 stays 0', () => {
    for (let v = 1; v <= 300; v++) expect(refDigitSumRoot(v, 2)).toBe(1)
    expect(refDigitSumRoot(0, 2)).toBe(0)
  })

  it('a value below the base is returned unchanged', () => {
    for (let base = 2; base <= 40; base += 2) for (let v = 0; v < base; v++) expect(refDigitSumRoot(v, base)).toBe(v)
  })

  for (let base = 2; base <= 36; base++) {
    it(`equals the iterated toString(${base}) digit sum on 200 fixed-seed values`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (value) => {
          expect(refDigitSumRoot(value, base)).toBe(builtinRoot(value, base))
        }),
        { seed: 20260930, numRuns: 200 },
      )
    })
  }

  it('matches the residue characterisation (0 -> 0, else 1..n-1 congruent mod n - 1) for values 0..3000 in even bases 2..40', () => {
    for (let base = 2; base <= 40; base += 2) {
      const m = base - 1
      for (let v = 0; v <= 3000; v++) {
        const root = refDigitSumRoot(v, base)
        if (v === 0) expect(root).toBe(0)
        else {
          expect(root).toBeGreaterThanOrEqual(1)
          expect(root).toBeLessThanOrEqual(m)
          expect((root - v) % m === 0, `root ${root} of ${v} in base ${base}`).toBe(true)
        }
      }
    }
  })
})

describe('refStructure: validation', () => {
  it('throws an Error for odd, small, non-integer and non-finite bases', () => {
    for (const bad of [0, 1, 3, 5, 9, 11, -2, -10, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => refStructure(bad), String(bad)).toThrow(Error)
    }
  })
})

describe('refStructure: base 10', () => {
  const s = refStructure(10)
  it('has the five syzygy pairs summing to 9 and the current of hi::lo landing on hi - lo', () => {
    expect(s.base).toBe(10)
    expect(s.pairLo).toEqual([0, 1, 2, 3, 4])
    expect(s.partner).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
    expect(s.current).toEqual([9, 7, 5, 3, 1])
    expect(s.nextPair).toEqual([0, 2, 4, 3, 1])
  })
  it('has the cumulations 0, 1, 3, 6, 10, 15, 21, 28, 36, 45 and the gates 0, 1, 3, 6, 1, 6, 3, 1, 9, 9', () => {
    expect(s.cumulation).toEqual([0, 1, 3, 6, 10, 15, 21, 28, 36, 45])
    expect(s.gates).toEqual([0, 1, 3, 6, 1, 6, 3, 1, 9, 9])
  })
  it('has one Torque of three pairs, the Plex and one Warp, in canonical order', () => {
    expect(s.cycles).toEqual([
      { kind: 'torque', pairs: [1, 2, 4] },
      { kind: 'plex', pairs: [0] },
      { kind: 'warp', pairs: [3] },
    ])
    expect(s.cycleOfZone).toEqual([1, 0, 0, 2, 0, 0, 2, 0, 0, 1])
  })
})

describe('refStructure: base 12', () => {
  const s = refStructure(12)
  it('has the gates 0, 1, 3, 6, a, 4, a, 6, 3, 1, b, b written as values', () => {
    expect(s.gates).toEqual([0, 1, 3, 6, 10, 4, 10, 6, 3, 1, 11, 11])
    expect(s.cumulation).toEqual([0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66])
  })
  it('has one five-pair Torque and the Plex, and no Warp', () => {
    expect(s.pairLo).toEqual([0, 1, 2, 3, 4, 5])
    expect(s.current).toEqual([11, 9, 7, 5, 3, 1])
    expect(s.cycles).toEqual([
      { kind: 'torque', pairs: [1, 2, 4, 3, 5] },
      { kind: 'plex', pairs: [0] },
    ])
    expect(hasWarp(s)).toBe(false)
  })
})

describe('refStructure: bases 16 and 28', () => {
  it('base 16: Torques [1,2,4,7] and [3,6], the Plex and the Warp {5,10}', () => {
    expect(refStructure(16).cycles).toEqual([
      { kind: 'torque', pairs: [1, 2, 4, 7] },
      { kind: 'torque', pairs: [3, 6] },
      { kind: 'plex', pairs: [0] },
      { kind: 'warp', pairs: [5] },
    ])
  })
  it('base 28: Torques [1,2,4,8,11,5,10,7,13] and [3,6,12], the Plex and the Warp [9]', () => {
    expect(refStructure(28).cycles).toEqual([
      { kind: 'torque', pairs: [1, 2, 4, 8, 11, 5, 10, 7, 13] },
      { kind: 'torque', pairs: [3, 6, 12] },
      { kind: 'plex', pairs: [0] },
      { kind: 'warp', pairs: [9] },
    ])
  })
})

describe('refStructure: small bases', () => {
  it('base 2 has one pair {0,1}, only the Plex, gates 0, 1', () => {
    const s = refStructure(2)
    expect(s.pairLo).toEqual([0])
    expect(s.current).toEqual([1])
    expect(s.cycles).toEqual([{ kind: 'plex', pairs: [0] }])
    expect(s.gates).toEqual([0, 1])
  })
  it('base 4 has the Plex and the Warp {1,2}, no Torque', () => {
    const s = refStructure(4)
    expect(s.cycles).toEqual([
      { kind: 'plex', pairs: [0] },
      { kind: 'warp', pairs: [1] },
    ])
    expect(torqueLengths(s)).toEqual([])
  })
  it('base 6 has a two-pair Torque [1,2] and the Plex, no Warp', () => {
    const s = refStructure(6)
    expect(s.cycles).toEqual([
      { kind: 'torque', pairs: [1, 2] },
      { kind: 'plex', pairs: [0] },
    ])
  })
  const gateTables: Array<[number, number[]]> = [
    [2, [0, 1]],
    [4, [0, 1, 3, 3]],
    [6, [0, 1, 3, 1, 5, 5]],
    [8, [0, 1, 3, 6, 3, 1, 7, 7]],
  ]
  for (const [base, gates] of gateTables) {
    it(`base ${base} gate table is ${JSON.stringify(gates)}`, () => {
      expect(refStructure(base).gates).toEqual(gates)
    })
  }
})

describe('Torque lengths in pairs (research literals)', () => {
  const rows: Array<[number, number[]]> = [
    [2, []],
    [4, []],
    [6, [2]],
    [8, [3]],
    [10, [3]],
    [12, [5]],
    [14, [6]],
    [16, [4, 2]],
    [18, [4, 4]],
    [22, [6, 3]],
    [28, [9, 3]],
    [32, [5, 5, 5]],
    [36, [12, 3, 2]],
    [64, [6, 6, 6, 6, 3, 3]],
    [80, [39]],
    [82, [27, 9, 3]],
    [100, [15, 15, 5, 5, 5, 3]],
    [666, [36, 36, 36, 36, 36, 36, 36, 18, 18, 18, 12, 9, 3, 2]],
  ]
  for (const [base, lengths] of rows) {
    it(`base ${base}: ${JSON.stringify(lengths)}`, () => {
      expect(torqueLengths(refStructure(base))).toEqual(lengths)
    })
  }

  it('the Warp is present exactly at 4, 10, 16, 22, 28, 64, 82, 100 among those bases', () => {
    const withWarp = new Set([4, 10, 16, 22, 28, 64, 82, 100])
    for (const [base] of rows) expect(hasWarp(refStructure(base)), `base ${base}`).toBe(withWarp.has(base))
  })
})

describe('sweep of every even base 2..5000', () => {
  // Plain checks that collect problems: millions of expect() calls would be slow, one assertion at the end is not.
  it('cycles cover each pair once in canonical order and the Warp exists iff n = 3o + 1 with o odd', () => {
    const problems: string[] = []
    for (let n = 2; n <= 5000; n += 2) {
      const s = refStructure(n)
      const half = n / 2
      const seen = new Uint8Array(half)
      let total = 0
      let plexCount = 0
      for (const cycle of s.cycles) {
        if (cycle.pairs.length < 1) problems.push(`empty cycle at n = ${n}`)
        total += cycle.pairs.length
        const first = cycle.pairs[0] ?? -1
        for (const p of cycle.pairs) {
          if (seen[p] !== 0) problems.push(`pair ${p} twice at n = ${n}`)
          seen[p] = 1
          if (p < first) problems.push(`cycle at n = ${n} does not start at its smallest pair`)
        }
        if (cycle.kind === 'plex') plexCount++
      }
      if (total !== half) problems.push(`pairs covered ${total} of ${half} at n = ${n}`)
      if (plexCount !== 1) problems.push(`plex count ${plexCount} at n = ${n}`)
      if (s.cycles[s.cycleOfZone[0] ?? -1]?.kind !== 'plex') problems.push(`zone 0 is not in the plex at n = ${n}`)
      const oddThird = (n - 1) % 3 === 0 && ((n - 1) / 3) % 2 === 1
      if (hasWarp(s) !== oddThird) problems.push(`warp presence ${hasWarp(s)} at n = ${n}`)
      // Canonical order: length descending, then smallest pair ascending.
      for (let i = 1; i < s.cycles.length; i++) {
        const prev = s.cycles[i - 1]
        const cur = s.cycles[i]
        if (prev === undefined || cur === undefined) throw new Error('missing cycle')
        const ordered = prev.pairs.length > cur.pairs.length || (prev.pairs.length === cur.pairs.length && (prev.pairs[0] ?? 0) < (cur.pairs[0] ?? 0))
        if (!ordered) problems.push(`cycle order at n = ${n}, index ${i}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('each cycle follows the flow: next pair of pairs[i] is pairs[i + 1] and the last returns to the first (bases 2..600)', () => {
    const problems: string[] = []
    for (let n = 2; n <= 600; n += 2) {
      const s = refStructure(n)
      for (const cycle of s.cycles) {
        const len = cycle.pairs.length
        for (let i = 0; i < len; i++) {
          const here = cycle.pairs[i] ?? -1
          if (s.nextPair[here] !== cycle.pairs[(i + 1) % len]) problems.push(`flow broken at n = ${n}, pair ${here}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('every current is the zone hi - lo, always odd (hi + lo = n - 1 is odd), for every pair (bases 2..600)', () => {
    const problems: string[] = []
    for (let n = 2; n <= 600; n += 2) {
      const s = refStructure(n)
      if (s.pairLo.length !== n / 2) problems.push(`pair count at n = ${n}`)
      for (let p = 0; p < n / 2; p++) {
        const lo = p
        const hi = n - 1 - p
        if (s.pairLo[p] !== lo) problems.push(`pairLo[${p}] at n = ${n}`)
        if (s.partner[lo] !== hi || s.partner[hi] !== lo) problems.push(`partner of ${lo} at n = ${n}`)
        if (s.current[p] !== hi - lo) problems.push(`current[${p}] at n = ${n}`)
        if ((s.current[p] ?? 0) % 2 !== 1) problems.push(`even current at n = ${n}, pair ${p}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('gates: gate(0) = 0, gate(1) = 1, gate(n - 1) = n - 1 and no other gate is 0 in every even base 2..600; bases up to 36 equal the built-in iterated root', () => {
    const problems: string[] = []
    for (let n = 2; n <= 600; n += 2) {
      const s = refStructure(n)
      if (s.gates.length !== n) problems.push(`gate count at n = ${n}`)
      if (s.gates[0] !== 0 || s.gates[1] !== 1 || s.gates[n - 1] !== n - 1) problems.push(`fixed gates at n = ${n}`)
      for (let k = 1; k < n; k++) if ((s.gates[k] ?? 0) < 1) problems.push(`gate ${k} is 0 at n = ${n}`)
      if (n <= 36) {
        for (let k = 0; k < n; k++) {
          if (s.gates[k] !== builtinRoot(s.cumulation[k] ?? -1, n)) problems.push(`gate ${k} differs from the built-in root at n = ${n}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe('refSubtypeCounts (order: cyclic-chrono, cross-torque-chrono, syzygetic-chrono, plex-amphi, warp-amphi, chaotic-xeno, syzygetic-xeno)', () => {
  const rows: Array<[number, number[]]> = [
    [2, [0, 0, 0, 0, 0, 0, 1]],
    [4, [0, 0, 0, 0, 0, 4, 2]],
    [10, [12, 0, 3, 12, 12, 4, 2]],
    [12, [40, 0, 5, 20, 0, 0, 1]],
    [16, [28, 32, 6, 24, 24, 4, 2]],
    [28, [156, 108, 12, 48, 48, 4, 2]],
    [82, [1560, 1404, 39, 156, 156, 4, 2]],
  ]
  for (const [base, want] of rows) {
    it(`base ${base}: ${JSON.stringify(want)}`, () => {
      expect(countsRow(refStructure(base))).toEqual(want)
    })
  }

  it('base 10 is the CCRU split 12 + 3 chrono, 12 + 12 amphi, 4 + 2 xeno = 45 (not the guide 47)', () => {
    const counts: Record<RefSubtype, number> = refSubtypeCounts(refStructure(10))
    expect(counts['cyclic-chrono'] + counts['syzygetic-chrono']).toBe(15)
    expect(counts['plex-amphi'] + counts['warp-amphi']).toBe(24)
    expect(counts['chaotic-xeno'] + counts['syzygetic-xeno']).toBe(6)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(45)
  })

  it('the seven counts always sum to n(n-1)/2 and the syzygetic ones to n/2, in every even base 2..300', () => {
    for (let n = 2; n <= 300; n += 2) {
      const counts = refSubtypeCounts(refStructure(n))
      expect(Object.values(counts).reduce((a, b) => a + b, 0), `total at n = ${n}`).toBe((n * (n - 1)) / 2)
      expect(counts['syzygetic-chrono'] + counts['syzygetic-xeno'], `syzygetic at n = ${n}`).toBe(n / 2)
    }
  })

  it('the keys come back in REF_SUBTYPES order', () => {
    expect(Object.keys(refSubtypeCounts(refStructure(10)))).toEqual([...REF_SUBTYPES])
  })

  it('equals a count over the enumerated demons for every even base 2..200', () => {
    for (let n = 2; n <= 200; n += 2) {
      const s = refStructure(n)
      const tally: Record<string, number> = {}
      for (const name of REF_SUBTYPES) tally[name] = 0
      for (const d of refDemons(s)) tally[d.subtype] = (tally[d.subtype] ?? 0) + 1
      expect(refSubtypeCounts(s), `base ${n}`).toEqual(tally)
    }
  })
})

describe('refDemons', () => {
  it('has n(n-1)/2 demons: 1, 6, 45, 66, 378 for bases 2, 4, 10, 12, 28', () => {
    const rows: Array<[number, number]> = [
      [2, 1],
      [4, 6],
      [10, 45],
      [12, 66],
      [28, 378],
    ]
    for (const [base, count] of rows) expect(refDemons(refStructure(base)), `base ${base}`).toHaveLength(count)
  })

  it('lists a > b in lexicographic order with the mesh number as a running 0-based counter', () => {
    const demons = refDemons(refStructure(10))
    let mesh = 0
    for (let a = 1; a <= 9; a++) {
      for (let b = 0; b < a; b++) {
        expect(demons[mesh]).toMatchObject({ a, b, mesh })
        mesh++
      }
    }
    expect(demons).toHaveLength(mesh)
  })

  it('base 10 mesh numbers: 1::0 = 0, 2::1 = 2, 6::3 = 18, 9::8 = 44', () => {
    const demons = refDemons(refStructure(10))
    const meshOf = (a: number, b: number): number | undefined => demons.find((d) => d.a === a && d.b === b)?.mesh
    expect(meshOf(1, 0)).toBe(0)
    expect(meshOf(2, 1)).toBe(2)
    expect(meshOf(6, 3)).toBe(18)
    expect(meshOf(9, 8)).toBe(44)
    expect(demons[demons.length - 1]).toMatchObject({ a: 9, b: 8, mesh: 44 })
  })

  it('Numodemons (a + b = n) number n/2 - 1: 0, 1, 4, 5, 13, 40 for bases 2, 4, 10, 12, 28, 82', () => {
    const rows: Array<[number, number]> = [
      [2, 0],
      [4, 1],
      [10, 4],
      [12, 5],
      [28, 13],
      [82, 40],
    ]
    for (const [base, count] of rows) {
      const demons = refDemons(refStructure(base))
      expect(demons.filter((d) => d.numodemon).length, `base ${base}`).toBe(count)
      for (const d of demons) expect(d.numodemon).toBe(d.a + d.b === base)
    }
  })

  it('syzygetic is exactly a + b = n - 1, one per pair, and no demon has a == b', () => {
    for (const base of [2, 4, 10, 12, 16, 28]) {
      const demons = refDemons(refStructure(base))
      expect(demons.filter((d) => d.syzygetic)).toHaveLength(base / 2)
      for (const d of demons) {
        expect(d.syzygetic).toBe(d.a + d.b === base - 1)
        expect(d.a).toBeGreaterThan(d.b)
      }
    }
  })

  it('base 2 has the single syzygetic xenodemon 1::0 and no Numodemon', () => {
    expect(refDemons(refStructure(2))).toEqual([
      { a: 1, b: 0, mesh: 0, type: 'xeno', subtype: 'syzygetic-xeno', syzygetic: true, numodemon: false },
    ])
  })
})

describe('refClassify: base 10 by hand', () => {
  const s = refStructure(10)
  // Torque zones 1, 2, 4, 5, 7, 8; Plex zones 0, 9; Warp zones 3, 6.
  const rows: Array<[number, number, string, string]> = [
    [8, 1, 'chrono', 'syzygetic-chrono'],
    [7, 2, 'chrono', 'syzygetic-chrono'],
    [5, 4, 'chrono', 'syzygetic-chrono'],
    [4, 1, 'chrono', 'cyclic-chrono'],
    [8, 7, 'chrono', 'cyclic-chrono'],
    [2, 0, 'amphi', 'plex-amphi'],
    [9, 1, 'amphi', 'plex-amphi'],
    [3, 1, 'amphi', 'warp-amphi'],
    [8, 6, 'amphi', 'warp-amphi'],
    [9, 0, 'xeno', 'syzygetic-xeno'],
    [6, 3, 'xeno', 'syzygetic-xeno'],
    [3, 0, 'xeno', 'chaotic-xeno'],
    [9, 6, 'xeno', 'chaotic-xeno'],
    [9, 3, 'xeno', 'chaotic-xeno'],
    [6, 0, 'xeno', 'chaotic-xeno'],
  ]
  for (const [a, b, type, subtype] of rows) {
    it(`${a}::${b} is ${subtype}`, () => {
      expect(refClassify(s, a, b)).toMatchObject({ type, subtype, syzygetic: a + b === 9, numodemon: a + b === 10 })
    })
  }
  it('Numodemons are not syzygetic and flag numodemon (9::1 in base 10)', () => {
    expect(refClassify(s, 9, 1)).toMatchObject({ numodemon: true, syzygetic: false })
    expect(refClassify(s, 6, 4)).toMatchObject({ numodemon: true, syzygetic: false })
  })
  it('refuses zones outside 0..n-1 and a not greater than b', () => {
    expect(() => refClassify(s, 10, 3)).toThrow(Error)
    expect(() => refClassify(s, 3, 3)).toThrow(Error)
    expect(() => refClassify(s, 2, 5)).toThrow(Error)
    expect(() => refClassify(s, 4, -1)).toThrow(Error)
    expect(() => refClassify(s, 4.5, 1)).toThrow(Error)
  })
})

describe('refClassify: cross-Torque chronodemons (base 16 and 28)', () => {
  it('base 16: 3::1 links Torque [1,2,4,7] and Torque [3,6], so it is cross-torque-chrono; 2::1 is cyclic', () => {
    const s = refStructure(16)
    expect(refClassify(s, 3, 1)).toMatchObject({ type: 'chrono', subtype: 'cross-torque-chrono', syzygetic: false })
    expect(refClassify(s, 2, 1)).toMatchObject({ type: 'chrono', subtype: 'cyclic-chrono', syzygetic: false })
    expect(refClassify(s, 12, 3)).toMatchObject({ type: 'chrono', subtype: 'syzygetic-chrono', syzygetic: true })
    expect(refClassify(s, 6, 5)).toMatchObject({ type: 'amphi', subtype: 'warp-amphi' })
    expect(refClassify(s, 10, 5)).toMatchObject({ type: 'xeno', subtype: 'syzygetic-xeno' })
  })
  it('base 28: 6::1 crosses the Torques, 4::1 stays inside the nine-pair Torque', () => {
    const s = refStructure(28)
    expect(refClassify(s, 6, 1)).toMatchObject({ subtype: 'cross-torque-chrono' })
    expect(refClassify(s, 4, 1)).toMatchObject({ subtype: 'cyclic-chrono' })
  })
})
