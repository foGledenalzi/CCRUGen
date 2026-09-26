// ENG-01, ENG-02, ENG-04 structural sweep (D-09): for EVERY even n from 2 to 2000 the engine's zones, pairs, currents,
// gates and cycles equal the independent definitions-only reference in tests/bruteforce (which imports nothing from the
// engine and shares none of its closed forms). One `expect` per block: mismatches are collected as short strings so a
// failure names the base and the item, and the sweep stays fast.
import { describe, expect, it } from 'vitest'
import { refStructure } from '../../tests/bruteforce/numogramReference'
import { clearNumogramCache, createNumogram } from '../index'

const MAX_MISMATCHES = 200

/** Compares one base against the reference and appends a short line to `mismatches` for every difference. */
function compareBase(n: number, mismatches: string[]): void {
  const want = refStructure(n)
  const g = createNumogram(n)
  const pairCount = n / 2

  const check = (what: string, got: unknown, expected: unknown): void => {
    if (got !== expected && mismatches.length < MAX_MISMATCHES) mismatches.push(`n=${n} ${what}: ${String(got)} != ${String(expected)}`)
  }
  const at = (list: readonly number[], index: number): number => {
    const value = list[index]
    if (value === undefined) throw new Error(`test: index ${index} outside the reference list`)
    return value
  }

  check('base', g.base, n)
  check('zoneCount', g.zoneCount, n)
  check('pairCount', g.pairCount, pairCount)

  // Zones: partner, pair id and region membership.
  for (let z = 0; z < n; z++) {
    const partner = at(want.partner, z)
    check(`partner(${z})`, g.partner(z), partner)
    check(`pairOf(${z})`, g.pairOf(z), Math.min(z, partner))
    check(`cycleOfZone(${z}).id`, g.cycleOfZone(z).id, at(want.cycleOfZone, z))
  }

  // Pairs: identity, current and the next pair.
  for (let p = 0; p < pairCount; p++) {
    const lo = at(want.pairLo, p)
    const hi = at(want.partner, lo)
    const info = g.pair(p)
    check(`pair(${p}).id`, info.id, p)
    check(`pair(${p}).lo`, info.lo, lo)
    check(`pair(${p}).hi`, info.hi, hi)
    check(`pair(${p}).odd`, info.odd, lo % 2 === 1 ? lo : hi)
    check(`pair(${p}).even`, info.even, lo % 2 === 1 ? hi : lo)
    const cur = g.current(p)
    check(`current(${p}).to`, cur.to, at(want.current, p))
    check(`current(${p}).hi`, cur.hi, hi)
    check(`current(${p}).lo`, cur.lo, lo)
    check(`nextPair(${p})`, g.nextPair(p), at(want.nextPair, p))
    check(`cycleOfPair(${p}).id`, g.cycleOfPair(p).id, at(want.cycleOfZone, p))
  }

  // Gates: every zone, the cumulation as a running sum and the in-base digital root.
  for (let k = 0; k < n; k++) {
    const gate = g.gate(k)
    check(`gate(${k}).from`, gate.from, k)
    check(`gate(${k}).to`, gate.to, at(want.gates, k))
    check(`gate(${k}).cumulation`, gate.cumulation, at(want.cumulation, k))
  }

  // Cycles: count, canonical order, kind, pairs, lengths and the zone walk.
  const wantTorques = want.cycles.filter(c => c.kind === 'torque').length
  check('cycleCount', g.cycleCount, want.cycles.length)
  check('cycles.length', g.cycles.length, want.cycles.length)
  check('torqueCount', g.torqueCount, wantTorques)
  check('torques.length', g.torques.length, wantTorques)
  let pairsSeen = 0
  for (let i = 0; i < want.cycles.length; i++) {
    const ref = want.cycles[i]
    const cycle = g.cycles[i]
    if (ref === undefined || cycle === undefined) {
      mismatches.push(`n=${n} cycle ${i}: missing`)
      continue
    }
    const length = ref.pairs.length
    pairsSeen += cycle.lengthInPairs
    check(`cycle ${i} id`, cycle.id, i)
    check(`cycle ${i} kind`, cycle.kind, ref.kind)
    check(`cycle ${i} lengthInPairs`, cycle.lengthInPairs, length)
    check(`cycle ${i} zoneCount`, cycle.zoneCount, 2 * length)
    check(`cycle ${i} firstPair`, cycle.firstPair, at(ref.pairs, 0))
    check(`cycle ${i} torqueIndex`, cycle.torqueIndex, ref.kind === 'torque' ? i : -1)
    check(`cycleAt(${i}).id`, g.cycleAt(i).id, i)
    const pairs = cycle.pairs()
    check(`cycle ${i} pairs().length`, pairs.length, length)
    const zones = cycle.zones()
    check(`cycle ${i} zones().length`, zones.length, 2 * length)
    for (let j = 0; j < length; j++) {
      const lo = at(ref.pairs, j)
      const hi = n - 1 - lo
      const odd = lo % 2 === 1 ? lo : hi
      const even = lo % 2 === 1 ? hi : lo
      check(`cycle ${i} pairs()[${j}]`, pairs[j], lo)
      check(`cycle ${i} pairAt(${j})`, cycle.pairAt(j), lo)
      check(`cycle ${i} zones()[${2 * j}]`, zones[2 * j], odd)
      check(`cycle ${i} zones()[${2 * j + 1}]`, zones[2 * j + 1], even)
      check(`cycle ${i} zoneAt(${2 * j})`, cycle.zoneAt(2 * j), odd)
      check(`cycle ${i} zoneAt(${2 * j + 1})`, cycle.zoneAt(2 * j + 1), even)
    }
  }
  check('sum of lengthInPairs', pairsSeen, pairCount)

  // Warp exists exactly when n = 3o + 1 with o odd, and then it is the fixed pair {o, 2o}.
  const warpExpected = (n - 1) % 3 === 0 && ((n - 1) / 3) % 2 === 1
  check('warp present', g.warp !== null, warpExpected)
  if (warpExpected && g.warp !== null) {
    check('warp.firstPair', g.warp.firstPair, (n - 1) / 3)
    check('warp.lengthInPairs', g.warp.lengthInPairs, 1)
  }
  check('plex.firstPair', g.plex.firstPair, 0)
  check('plex.kind', g.plex.kind, 'plex')
}

function sweep(from: number, to: number): { covered: number; mismatches: string[] } {
  clearNumogramCache()
  const mismatches: string[] = []
  let covered = 0
  for (let n = from; n <= to; n += 2) {
    compareBase(n, mismatches)
    covered++
  }
  return { covered, mismatches }
}

describe('engine structure equals the independent reference for every even n up to 2000', () => {
  it('n in [2, 500]', () => {
    const { covered, mismatches } = sweep(2, 500)
    expect(covered).toBe(250)
    expect(mismatches.slice(0, 20)).toEqual([])
  })

  it('n in [502, 1000]', () => {
    const { covered, mismatches } = sweep(502, 1000)
    expect(covered).toBe(250)
    expect(mismatches.slice(0, 20)).toEqual([])
  })

  it('n in [1002, 1500]', () => {
    const { covered, mismatches } = sweep(1002, 1500)
    expect(covered).toBe(250)
    expect(mismatches.slice(0, 20)).toEqual([])
  })

  it('n in [1502, 2000]', () => {
    const { covered, mismatches } = sweep(1502, 2000)
    expect(covered).toBe(250)
    expect(mismatches.slice(0, 20)).toEqual([])
  })
})
