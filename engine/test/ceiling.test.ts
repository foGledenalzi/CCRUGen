// ENG-05 (structural half) and ENG-04 (upper refusal), decision D-11: base 2^26 is built in O(n) typed arrays within an
// EXPLICIT time and memory ceiling, anything above it is refused, and storage stays linear in n.
//
// At 2^26 the pair map has about 1.29 million cycles, so nothing here may touch the cycle list or the Torque list of the
// 2^26 numogram (that would create 1.29 million view objects). Cycles are reached one at a time with cycleAt(id).
// Fixed seeds throughout (D-10); no clock or random value is ever asserted except the ceilings themselves.
import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram, NUMOGRAM_CACHE_LIMITS } from '../index'

// The explicit ceiling of D-11. Local measurement is about 0.6 s and about 271 MiB of array buffers (see the SUMMARY of
// plan 02-04); these limits leave headroom for a slower CI runner but still catch an O(n^2) or per-cycle-object regression.
const CEILING_MS = 20_000
const CEILING_ARRAYBUFFER_BYTES = 768 * 2 ** 20
const CEILING_HEAP_BYTES = 128 * 2 ** 20

const CAP = 2 ** 26
const MIB = 2 ** 20

/** A byte delta as a signed MiB figure for the report line (a delta can be negative when the collector frees earlier buffers). */
const signedMiB = (bytes: number): string => `${bytes < 0 ? '-' : '+'}${(Math.abs(bytes) / MIB).toFixed(1)}`

beforeEach(() => {
  clearNumogramCache()
})

/** The pair that holds zone `hi - lo` for pair `lo`: the definition of the next pair, written independently of the engine. */
function nextPairByDefinition(base: number, lo: number): number {
  const hi = base - 1 - lo
  const zone = hi - lo
  return Math.min(zone, base - 1 - zone)
}

/** Cycle count, total length and the histogram of cycle lengths, from a Uint8Array walk of the definition. */
function walkByDefinition(base: number): { count: number; total: number; histogram: Map<number, number> } {
  const pairCount = base / 2
  const seen = new Uint8Array(pairCount)
  const histogram = new Map<number, number>()
  let count = 0
  let total = 0
  for (let start = 0; start < pairCount; start++) {
    if (seen[start] !== 0) continue
    let length = 0
    let pair = start
    while (seen[pair] === 0) {
      seen[pair] = 1
      length++
      pair = nextPairByDefinition(base, pair)
    }
    count++
    total += length
    histogram.set(length, (histogram.get(length) ?? 0) + 1)
  }
  return { count, total, histogram }
}

const sortedEntries = (histogram: Map<number, number>): [number, number][] => [...histogram.entries()].sort((a, b) => a[0] - b[0])

describe('base 2^26 (the safe ceiling)', () => {
  it(
    'builds within the explicit time and memory ceilings and keeps every structural invariant',
    () => {
      clearNumogramCache()
      const before = process.memoryUsage()
      const started = performance.now()
      const g = createNumogram(CAP)
      const elapsedMs = performance.now() - started
      const after = process.memoryUsage()

      const arrayBufferGrowth = after.arrayBuffers - before.arrayBuffers
      const heapGrowth = after.heapUsed - before.heapUsed
      console.info(
        `[ceiling] base 2^26: ${Math.round(elapsedMs)} ms, arrayBuffers ${signedMiB(arrayBufferGrowth)} MiB, ` +
          `heapUsed ${signedMiB(heapGrowth)} MiB, storageBytes ${g.storageBytes}, cycles ${g.cycleCount}`,
      )

      // The explicit ceiling (D-11).
      expect(elapsedMs).toBeLessThan(CEILING_MS)
      expect(arrayBufferGrowth).toBeLessThan(CEILING_ARRAYBUFFER_BYTES)
      expect(heapGrowth).toBeLessThan(CEILING_HEAP_BYTES)
      expect(g.storageBytes).toBeLessThanOrEqual(8 * CAP)

      // Shape: 2^26 = 3 * 22369621 + 1 with 22369621 odd, so the Warp exists and is the fixed pair {o, 2o}.
      expect(g.base).toBe(CAP)
      expect(g.zoneCount).toBe(CAP)
      expect(g.pairCount).toBe(CAP / 2)
      expect(g.warp).not.toBeNull()
      expect(g.warp?.firstPair).toBe((CAP - 1) / 3)
      expect(g.warp?.lengthInPairs).toBe(1)
      expect(g.plex.firstPair).toBe(0)

      // The cycle count and the histogram of lengths equal a walk of the definition computed here.
      const walked = walkByDefinition(CAP)
      expect(g.cycleCount).toBe(walked.count)
      expect(g.torqueCount).toBe(walked.count - 2) // every cycle but the Plex and the Warp is a Torque cycle
      expect(walked.total).toBe(2 ** 25)
      const engineHistogram = new Map<number, number>()
      let engineTotal = 0
      for (let id = 0; id < g.cycleCount; id++) {
        const length = g.cycleAt(id).lengthInPairs // a view made and dropped: never the materialized list
        engineTotal += length
        engineHistogram.set(length, (engineHistogram.get(length) ?? 0) + 1)
      }
      expect(engineTotal).toBe(2 ** 25)
      expect(sortedEntries(engineHistogram)).toEqual(sortedEntries(walked.histogram))

      // 1000 sampled cycles: the stored flow order follows the next-pair map and closes on itself.
      fc.assert(
        fc.property(fc.integer({ min: 0, max: g.cycleCount - 1 }), id => {
          const cycle = g.cycleAt(id)
          const length = cycle.lengthInPairs
          expect(cycle.id).toBe(id)
          expect(cycle.firstPair).toBe(cycle.pairAt(0))
          for (let i = 0; i < length; i++) {
            expect(cycle.pairAt((i + 1) % length)).toBe(g.nextPair(cycle.pairAt(i)))
          }
        }),
        { seed: 20261001, numRuns: 1000 },
      )

      // 10,000 sampled pairs: nextPair is the definition and stays inside its cycle.
      fc.assert(
        fc.property(fc.integer({ min: 0, max: CAP / 2 - 1 }), p => {
          const next = g.nextPair(p)
          expect(next).toBe(nextPairByDefinition(CAP, p))
          expect(g.cycleOfPair(next).id).toBe(g.cycleOfPair(p).id)
        }),
        { seed: 20261002, numRuns: 10_000 },
      )

      // The demon space (ENG-03, T-02-21): virtual, so reading it allocates nothing that scales with n or n^2. The queries
      // below include 1000 at() calls on a fixed LCG walk; an O(n) buffer per call would show even next to a collection.
      const demonBytesBefore = process.memoryUsage().arrayBuffers
      const space = g.demons
      expect(space.base).toBe(CAP)
      expect(space.count).toBe(2251799780130816)
      expect(space.numodemonCount).toBe(33554431)
      const last = space.at(space.count - 1)
      expect([last.a, last.b, last.mesh]).toEqual([67108863, 67108862, 2251799780130815])
      expect(last.subtype).toBe('plex-amphi') // zone 2^26 - 1 is in the Plex, zone 2^26 - 2 lies on a Torque cycle
      expect(last.numodemon).toBe(false)
      const counts = space.counts()
      const types = space.typeCounts()
      let lcg = 123456789
      for (let i = 0; i < 1000; i++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0
        const m = lcg * 524288 + (lcg % 524288) // spreads over [0, 2^51) deterministically
        expect(space.at(m % space.count).mesh).toBe(m % space.count)
      }
      const plexPair = space.ref(CAP - 1, 0)
      expect(plexPair.subtype).toBe('syzygetic-xeno')
      expect(plexPair.type).toBe('xeno')
      expect(plexPair.syzygetic).toBe(true)
      const demonBytesGrowth = process.memoryUsage().arrayBuffers - demonBytesBefore
      expect(demonBytesGrowth).toBeLessThan(MIB)

      // Counts from the histogram of cycle lengths computed above (an independent path to T and the L_c): every cycle
      // except the Plex and the Warp is a Torque cycle of at least two pairs.
      expect(walked.histogram.get(1)).toBe(2)
      let torqueZones = 0
      let sameCycleZonePairs = 0
      let cyclic = 0
      for (const [length, cycleCount] of walked.histogram) {
        if (length < 2) continue
        const zones = 2 * length
        const zonePairs = (zones * (zones - 1)) / 2
        torqueZones += cycleCount * zones
        sameCycleZonePairs += cycleCount * zonePairs
        cyclic += cycleCount * (zonePairs - length)
      }
      const torquePairsTotal = torqueZones / 2
      expect(torqueZones).toBe(CAP - 4)
      const chronoTotal = (torqueZones * (torqueZones - 1)) / 2
      expect(counts['cyclic-chrono']).toBe(cyclic)
      expect(counts['cross-torque-chrono']).toBe(chronoTotal - sameCycleZonePairs)
      expect(counts['syzygetic-chrono']).toBe(torquePairsTotal)
      expect(counts['plex-amphi']).toBe(2 * torqueZones)
      expect(counts['warp-amphi']).toBe(2 * torqueZones)
      expect(counts['chaotic-xeno']).toBe(4)
      expect(counts['syzygetic-xeno']).toBe(2)
      const subtypeTotal = Object.values(counts).reduce((sum, value) => sum + value, 0)
      expect(subtypeTotal).toBe(space.count)
      expect(types.chrono + types.amphi + types.xeno).toBe(space.count)
      expect(types).toEqual({ chrono: chronoTotal, amphi: torqueZones * 4, xeno: 6 })

      // Hand-picked demons around the Plex ({0, 2^26 - 1}) and the Warp ({o, 2o}, o = (2^26 - 1) / 3).
      const o = (CAP - 1) / 3
      expect(space.ref(2 * o, o).subtype).toBe('syzygetic-xeno')
      expect(space.ref(o, 0).subtype).toBe('chaotic-xeno')
      expect(space.ref(CAP - 1, o).subtype).toBe('chaotic-xeno')
      expect(space.ref(o, 1).subtype).toBe('warp-amphi')
      expect(space.ref(CAP - 1, 1).subtype).toBe('plex-amphi')
      const firstNumodemon = space.numodemons()[Symbol.iterator]().next().value
      expect(firstNumodemon).toMatchObject({ a: CAP - 1, b: 1, numodemon: true }) // lazy: only the first step is taken
      expect(Array.from({ length: 3 }, (_, i) => space.at(i).b)).toEqual([0, 0, 1])

      // 2000 sampled demons (fixed seed): mesh <-> net-span round trip and the subtype re-derived from the cycle views.
      fc.assert(
        fc.property(fc.integer({ min: 0, max: space.count - 1 }), m => {
          const d = space.at(m)
          expect(d.mesh).toBe(m)
          expect(d.a).toBeGreaterThan(d.b)
          expect(d.a).toBeLessThan(CAP)
          expect(space.meshOf(d.b, d.a)).toBe(m)
          const ca = g.cycleOfZone(d.a)
          const cb = g.cycleOfZone(d.b)
          expect([d.cycleA, d.cycleB]).toEqual([ca.id, cb.id])
          const syzygy = d.a + d.b === CAP - 1
          const expected =
            ca.kind === 'torque' && cb.kind === 'torque'
              ? syzygy
                ? 'syzygetic-chrono'
                : ca.id === cb.id
                  ? 'cyclic-chrono'
                  : 'cross-torque-chrono'
              : ca.kind === 'torque' || cb.kind === 'torque'
                ? (ca.kind === 'torque' ? cb.kind : ca.kind) === 'plex'
                  ? 'plex-amphi'
                  : 'warp-amphi'
                : syzygy
                  ? 'syzygetic-xeno'
                  : 'chaotic-xeno'
          expect(d.subtype).toBe(expected)
        }),
        { seed: 20261007, numRuns: 2000 },
      )
      console.info(`[ceiling] base 2^26 demons: arrayBuffers ${signedMiB(demonBytesGrowth)} MiB for the demon queries`)

      clearNumogramCache()
    },
    120_000,
  )

  it('refuses 2^26 + 2 with a RangeError before allocating anything', () => {
    const before = process.memoryUsage().arrayBuffers
    expect(() => createNumogram(2 ** 26 + 2)).toThrow(RangeError)
    expect(() => createNumogram(2 ** 27)).toThrow(RangeError)
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(MIB)
  })

  // A base near the cap whose pair map is ONE huge cycle (pair 1 lies on a cycle of 2^25 - 3 pairs): the worst case for
  // the counting sort's temporary bucket array, which is sized by the longest cycle. Same ceilings as 2^26 itself.
  // The in-process arrayBuffers delta is only a lower bound here, because the collector may free the previous test's
  // 2^26 buffers while this one builds; measured on its own in a fresh process the peak is about 384 MiB.
  it(
    'stays inside the same ceilings when one cycle holds almost every pair (base 67108860)',
    () => {
      const base = 67_108_860
      clearNumogramCache()
      const before = process.memoryUsage()
      const started = performance.now()
      const g = createNumogram(base)
      const elapsedMs = performance.now() - started
      const after = process.memoryUsage()
      const arrayBufferGrowth = after.arrayBuffers - before.arrayBuffers
      const heapGrowth = after.heapUsed - before.heapUsed
      console.info(
        `[ceiling] base ${base} (one huge cycle): ${Math.round(elapsedMs)} ms, arrayBuffers ${signedMiB(arrayBufferGrowth)} MiB, ` +
          `heapUsed ${signedMiB(heapGrowth)} MiB, storageBytes ${g.storageBytes}, cycles ${g.cycleCount}`,
      )
      expect(elapsedMs).toBeLessThan(CEILING_MS)
      expect(arrayBufferGrowth).toBeLessThan(CEILING_ARRAYBUFFER_BYTES)
      expect(heapGrowth).toBeLessThan(CEILING_HEAP_BYTES)
      expect(g.storageBytes).toBeLessThanOrEqual(8 * CAP)

      expect(g.cycleCount).toBe(2)
      expect(g.torqueCount).toBe(1)
      expect(g.warp).toBeNull()
      const torque = g.cycleAt(0)
      expect(torque.kind).toBe('torque')
      expect(torque.firstPair).toBe(1)
      expect(torque.lengthInPairs).toBe(2 ** 25 - 3) // 33554429 = pairCount - 1: everything but the Plex
      expect(g.cycleAt(1).kind).toBe('plex')
      expect(torque.lengthInPairs + g.cycleAt(1).lengthInPairs).toBe(base / 2)
      fc.assert(
        fc.property(fc.integer({ min: 0, max: torque.lengthInPairs - 1 }), i => {
          expect(torque.pairAt((i + 1) % torque.lengthInPairs)).toBe(g.nextPair(torque.pairAt(i)))
          expect(torque.zoneAt(2 * i)).toBe(g.pair(torque.pairAt(i)).odd)
        }),
        { seed: 20261003, numRuns: 1000 },
      )
      clearNumogramCache()
    },
    120_000,
  )
})

describe('storage is linear in n (no O(n^2) structure)', () => {
  for (const exponent of [12, 14, 16, 18]) {
    it(`storageBytes / n is between 4 and 8 for n = 2^${exponent}`, () => {
      const n = 2 ** exponent
      const g = createNumogram(n)
      const bytesPerZone = g.storageBytes / n
      expect(bytesPerZone).toBeGreaterThanOrEqual(4)
      expect(bytesPerZone).toBeLessThanOrEqual(8)
    })
  }
})

describe('the cache is bounded in zones as well as in entries (2^26 zones)', () => {
  it('evicts the oldest entry when the zone budget is exceeded even though fewer than 4 entries are cached', () => {
    expect(NUMOGRAM_CACHE_LIMITS.zones).toBe(CAP)
    const big = 2 ** 25
    const a = createNumogram(big) // 2^25 zones
    const b = createNumogram(big - 2) // 2^26 - 2 zones cached in total: fits
    const c = createNumogram(big - 4) // would make 2^26 - 6 + 2^25: the oldest (a) must go
    expect(createNumogram(big - 2)).toBe(b)
    expect(createNumogram(big - 4)).toBe(c)
    const aAgain = createNumogram(big) // b is now the oldest and is evicted to make room
    expect(aAgain).not.toBe(a)
    expect(createNumogram(big)).toBe(aAgain)
    expect(createNumogram(big - 4)).toBe(c)
  })
})
