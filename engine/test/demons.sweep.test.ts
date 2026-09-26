// ENG-03 proven against the independent, definitions-only reference (tests/bruteforce/numogramReference.ts, D-09):
//   - every even n from 2 to 300: EVERY demon (a, b, mesh, type, subtype, syzygetic, numodemon, both cycle ids) equals the
//     reference's full enumeration, meshOf/netSpanOf/ref agree with it, and the Numodemon and incident iterators match
//   - every even n from 2 to 2000: the closed-form counts equal the reference's O(n^2) brute-force counts
//   - twelve larger even bases sampled from a fixed seed (up to 2^20): closed-form invariants and 200 spot checks each
// Blocks collect short mismatch strings and assert once per block (never one expect per demon). The reference data of one
// base is dropped before the next is built. If a test here fails, the ENGINE is wrong, not the reference.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { refClassify, refDemons, refStructure, refSubtypeCounts } from '../../tests/bruteforce/numogramReference'
import type { RefDemon } from '../../tests/bruteforce/numogramReference'
import { createNumogram, DEMON_SUBTYPES, DEMON_TYPES } from '../index'
import type { DemonRef, DemonSubtype, DemonType } from '../index'

const MAX_NOTES = 20
const choose2 = (x: number): number => (x < 2 ? 0 : (x * (x - 1)) / 2)

/** Even bases lo, lo + 2, ..., hi. */
function evenBases(lo: number, hi: number): number[] {
  const list: number[] = []
  for (let n = lo; n <= hi; n += 2) list.push(n)
  return list
}

const typeOf = (subtype: DemonSubtype): DemonType =>
  subtype === 'cyclic-chrono' || subtype === 'cross-torque-chrono' || subtype === 'syzygetic-chrono'
    ? 'chrono'
    : subtype === 'plex-amphi' || subtype === 'warp-amphi'
      ? 'amphi'
      : 'xeno'

/** Sums per-subtype counts into per-type counts, the same way for the reference and the engine. */
function typeSums(by: Readonly<Record<string, number>>): Record<DemonType, number> {
  const sums: Record<DemonType, number> = { chrono: 0, amphi: 0, xeno: 0 }
  for (const subtype of DEMON_SUBTYPES) sums[typeOf(subtype)] += by[subtype] ?? 0
  return sums
}

/** Field-by-field comparison of an engine demon with the reference demon and the reference's cycle ids; '' when equal. */
function diff(d: DemonRef, r: RefDemon, cycleOfZone: readonly number[]): string {
  const bad: string[] = []
  if (d.a !== r.a) bad.push(`a ${d.a} vs ${r.a}`)
  if (d.b !== r.b) bad.push(`b ${d.b} vs ${r.b}`)
  if (d.mesh !== r.mesh) bad.push(`mesh ${d.mesh} vs ${r.mesh}`)
  if (d.type !== r.type) bad.push(`type ${d.type} vs ${r.type}`)
  if (d.subtype !== r.subtype) bad.push(`subtype ${d.subtype} vs ${r.subtype}`)
  if (d.syzygetic !== r.syzygetic) bad.push(`syzygetic ${d.syzygetic} vs ${r.syzygetic}`)
  if (d.numodemon !== r.numodemon) bad.push(`numodemon ${d.numodemon} vs ${r.numodemon}`)
  if (d.cycleA !== cycleOfZone[r.a]) bad.push(`cycleA ${d.cycleA} vs ${cycleOfZone[r.a]}`)
  if (d.cycleB !== cycleOfZone[r.b]) bad.push(`cycleB ${d.cycleB} vs ${cycleOfZone[r.b]}`)
  return bad.join(', ')
}

/** Everything about the demon space of base n that the full enumeration can check. Returns mismatch notes and the demon count. */
function checkEnumeration(n: number, notes: string[]): number {
  const note = (message: string): void => {
    if (notes.length < MAX_NOTES) notes.push(`n=${n}: ${message}`)
  }
  const s = refStructure(n)
  const all = refDemons(s)
  const space = createNumogram(n).demons

  if (space.count !== all.length) note(`count ${space.count} vs ${all.length}`)
  if (space.count !== choose2(n)) note(`count ${space.count} is not C(n, 2)`)

  const tally: Record<string, number> = {}
  for (const r of all) {
    tally[r.subtype] = (tally[r.subtype] ?? 0) + 1
    const d = space.at(r.mesh)
    const problem = diff(d, r, s.cycleOfZone)
    if (problem !== '') note(`mesh ${r.mesh} (${r.a}::${r.b}): ${problem}`)
    if (space.meshOf(r.a, r.b) !== r.mesh || space.meshOf(r.b, r.a) !== r.mesh) note(`meshOf ${r.a}::${r.b}`)
    const span = space.netSpanOf(r.mesh)
    if (span[0] !== r.a || span[1] !== r.b) note(`netSpanOf ${r.mesh} is ${span[0]}::${span[1]}, expected ${r.a}::${r.b}`)
    const swapped = space.ref(r.b, r.a) // ref normalizes the order of its arguments
    if (swapped.mesh !== r.mesh || swapped.subtype !== r.subtype) note(`ref(${r.b}, ${r.a}) is mesh ${swapped.mesh}`)
  }

  // counts() and typeCounts() equal the tallies of the enumeration.
  const counts = space.counts()
  for (const subtype of DEMON_SUBTYPES) {
    if (counts[subtype] !== (tally[subtype] ?? 0)) note(`counts ${subtype} ${counts[subtype]} vs ${tally[subtype] ?? 0}`)
  }
  const types = space.typeCounts()
  const expectedTypes = typeSums(tally)
  for (const type of DEMON_TYPES) {
    if (types[type] !== expectedTypes[type]) note(`typeCounts ${type} ${types[type]} vs ${expectedTypes[type]}`)
  }

  // Numodemons: the reference demons with a + b = n, b ascending (the iterator's order), n/2 - 1 of them.
  const numodemons = all.filter(r => r.numodemon).sort((x, y) => x.b - y.b)
  const walked = Array.from(space.numodemons())
  if (space.numodemonCount !== n / 2 - 1) note(`numodemonCount ${space.numodemonCount}`)
  if (numodemons.length !== n / 2 - 1) note(`reference has ${numodemons.length} Numodemons`)
  if (walked.length !== numodemons.length) note(`numodemons() yields ${walked.length}, expected ${numodemons.length}`)
  numodemons.forEach((r, i) => {
    const d = walked[i]
    const problem = d === undefined ? 'missing' : diff(d, r, s.cycleOfZone)
    if (problem !== '') note(`numodemons()[${i}] (${r.a}::${r.b}): ${problem}`)
  })

  // incident(z) for the first, middle and last zone: the reference demons that contain z, the other zone ascending.
  for (const z of new Set([0, n / 2, n - 1])) {
    const other = (r: RefDemon): number => (r.a === z ? r.b : r.a)
    const expected = all.filter(r => r.a === z || r.b === z).sort((x, y) => other(x) - other(y))
    const got = Array.from(space.incident(z))
    if (got.length !== n - 1 || expected.length !== n - 1) note(`incident(${z}) yields ${got.length}, reference ${expected.length}`)
    expected.forEach((r, i) => {
      const d = got[i]
      const problem = d === undefined ? 'missing' : diff(d, r, s.cycleOfZone)
      if (problem !== '') note(`incident(${z})[${i}] (${r.a}::${r.b}): ${problem}`)
    })
  }
  return all.length
}

describe('demon space vs the reference: full enumeration of every demon for every even n up to 300', () => {
  for (const [lo, hi] of [[2, 100], [102, 200], [202, 300]] as const) {
    it(
      `every demon of every even n in [${lo}, ${hi}] equals the reference (type, subtype, syzygy, Numodemon, cycles, mesh)`,
      () => {
        const notes: string[] = []
        let bases = 0
        let demons = 0
        let expectedDemons = 0
        for (const n of evenBases(lo, hi)) {
          demons += checkEnumeration(n, notes)
          expectedDemons += (n * (n - 1)) / 2
          bases++
        }
        expect(notes.slice(0, MAX_NOTES)).toEqual([])
        expect(bases).toBe(50) // an empty loop cannot pass
        expect(demons).toBe(expectedDemons)
      },
      60_000,
    )
  }
})

describe('demon counts vs the reference brute force for every even n up to 2000', () => {
  for (const [lo, hi] of [[2, 1000], [1002, 2000]] as const) {
    it(
      `closed-form counts equal the O(n^2) brute-force counts for every even n in [${lo}, ${hi}]`,
      () => {
        const notes: string[] = []
        let bases = 0
        for (const n of evenBases(lo, hi)) {
          const space = createNumogram(n).demons
          const brute = refSubtypeCounts(refStructure(n))
          const counts = space.counts()
          let total = 0
          for (const subtype of DEMON_SUBTYPES) {
            total += counts[subtype]
            if (counts[subtype] !== brute[subtype]) {
              if (notes.length < MAX_NOTES) notes.push(`n=${n} ${subtype}: ${counts[subtype]} vs brute force ${brute[subtype]}`)
            }
          }
          const types = space.typeCounts()
          const expectedTypes = typeSums(brute)
          for (const type of DEMON_TYPES) {
            if (types[type] !== expectedTypes[type] && notes.length < MAX_NOTES) {
              notes.push(`n=${n} ${type}: ${types[type]} vs brute force ${expectedTypes[type]}`)
            }
          }
          if (total !== (n * (n - 1)) / 2 && notes.length < MAX_NOTES) notes.push(`n=${n}: counts sum to ${total}, not C(n, 2)`)
          if (space.count !== (n * (n - 1)) / 2 && notes.length < MAX_NOTES) notes.push(`n=${n}: count ${space.count}`)
          if (space.numodemonCount !== n / 2 - 1 && notes.length < MAX_NOTES) notes.push(`n=${n}: numodemonCount ${space.numodemonCount}`)
          bases++
        }
        expect(notes.slice(0, MAX_NOTES)).toEqual([])
        expect(bases).toBe(500)
      },
      60_000,
    )
  }
})

// Twelve even bases from 1002 to 2^20, drawn with a fixed seed (D-10). Above 2000 there is no brute force: the closed
// forms are checked against invariants computed from the reference's regions, plus 200 sampled demons per base.
const SAMPLED_BASES = fc.sample(fc.integer({ min: 1001, max: 2 ** 19 }).map(h => 2 * h), { seed: 20261005, numRuns: 12 })

describe('demon space on larger sampled even bases (fixed seeds 20261005 and 20261006)', () => {
  it('samples twelve even bases inside [2002, 2^20] from the fixed seed', () => {
    expect(SAMPLED_BASES).toHaveLength(12)
    for (const n of SAMPLED_BASES) {
      expect(n % 2).toBe(0)
      expect(n).toBeGreaterThanOrEqual(2002)
      expect(n).toBeLessThanOrEqual(2 ** 20)
    }
    expect(new Set(SAMPLED_BASES).size).toBeGreaterThanOrEqual(8)
  })

  for (const n of SAMPLED_BASES) {
    it(`base ${n}: closed-form invariants hold and 200 sampled demons classify exactly as the reference`, () => {
      const s = refStructure(n)
      const g = createNumogram(n)
      const space = g.demons
      const counts = space.counts()
      const types = space.typeCounts()

      // T and the Torque lengths L come from the reference's regions (definitions), not from the engine.
      const torqueLengths = s.cycles.filter(c => c.kind === 'torque').map(c => c.pairs.length)
      const torqueZones = torqueLengths.reduce((sum, length) => sum + 2 * length, 0)
      const hasWarp = s.cycles.some(c => c.kind === 'warp')
      const sameCycleZonePairs = torqueLengths.reduce((sum, length) => sum + choose2(2 * length), 0)

      expect(space.count).toBe(choose2(n))
      expect(DEMON_SUBTYPES.reduce((sum, subtype) => sum + counts[subtype], 0)).toBe(choose2(n))
      expect(counts['syzygetic-chrono'] + counts['syzygetic-xeno']).toBe(n / 2)
      expect(counts['cyclic-chrono'] + counts['cross-torque-chrono'] + counts['syzygetic-chrono']).toBe(choose2(torqueZones))
      expect(counts['cross-torque-chrono']).toBe(choose2(torqueZones) - sameCycleZonePairs)
      expect(counts['plex-amphi']).toBe(2 * torqueZones)
      expect(counts['warp-amphi']).toBe(hasWarp ? 2 * torqueZones : 0)
      expect(counts['chaotic-xeno']).toBe(hasWarp ? 4 : 0)
      expect(counts['syzygetic-xeno']).toBe(hasWarp ? 2 : 1)
      expect(types).toEqual({ chrono: choose2(torqueZones), amphi: torqueZones * (n - torqueZones), xeno: choose2(n - torqueZones) })
      expect(space.numodemonCount).toBe(n / 2 - 1)

      // 200 sampled demons (fixed seed): the classification equals refClassify, and at/meshOf/netSpanOf agree with ref.
      const zone = fc.integer({ min: 0, max: n - 1 })
      const pairs = fc.sample(fc.tuple(zone, zone).filter(([a, b]) => a !== b), { seed: 20261006, numRuns: 200 })
      expect(pairs).toHaveLength(200)
      const notes: string[] = []
      for (const [x, y] of pairs) {
        const a = Math.max(x, y)
        const b = Math.min(x, y)
        const r = refClassify(s, a, b)
        const d = space.ref(x, y)
        const reference: RefDemon = { a, b, mesh: (a * (a - 1)) / 2 + b, ...r }
        const problem = diff(d, reference, s.cycleOfZone)
        if (problem !== '') notes.push(`${a}::${b}: ${problem}`)
        const viaMesh = space.at(d.mesh)
        if (diff(viaMesh, reference, s.cycleOfZone) !== '') notes.push(`at(${d.mesh}) differs from ref(${a}, ${b})`)
        const span = space.netSpanOf(d.mesh)
        if (span[0] !== a || span[1] !== b) notes.push(`netSpanOf(${d.mesh}) is ${span[0]}::${span[1]}`)
      }
      expect(notes.slice(0, MAX_NOTES)).toEqual([])
    })
  }
})
