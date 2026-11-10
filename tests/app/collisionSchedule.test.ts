// The scheduling of the collision report (Phase 7, plan 20; D-12, NAM-03, 07-RESEARCH Pattern 5, T-07-06d, T-07-11b): which route a
// naming takes (the certificate, the cancellable main-thread scan, or none), and the pure sliced runner that drives an engine job in
// short steps with an injected clock and scheduler. Every case is derived from the rules and the engine's own answers: no canonical
// CCRU sound or name appears here (the CCRU preset is used only as "a naming whose names must be scanned"), the bases are plain
// numbers, and the fake jobs know nothing about names. No JSX, no DOM: the browser schedule is only checked for the two ways it
// defers a function.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COLLISION_SCAN_MAX_N,
  canCertify,
  createCollisionJob,
  createNaming,
  findCollisions,
  type CollisionJob,
  type CollisionReport,
  type Naming,
} from '../../engine/index'
import { browserSchedule, collisionPlan, runSlicedJob, type SliceDeps } from '../../app/lib/collisionSchedule'
import { COLLISION_SLICE_MS, NAMING_COLLISION_SCAN_MAX_N, collisionScanLimit } from '../../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'

const SCHEDULE_SOURCE = fileURLToPath(new URL('../../app/lib/collisionSchedule.ts', import.meta.url))
const BASE = 28

function generated(base = BASE): Naming {
  return createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N })
}

/** The same naming with one sound copied onto another zone: two zones now share a sound, so the table is not provably unique. */
function withDuplicateSound(base = BASE): Naming {
  const naming = generated(base)
  const sounds = [...(naming.sounds ?? [])]
  sounds[1] = sounds[0] as string
  return { ...naming, sounds }
}

// ── collisionPlan ──────────────────────────────────────────────────────────

describe('collisionPlan', () => {
  it('a generated table is certified, whatever the limit', () => {
    const naming = generated()
    expect(canCertify(naming, null)).toBe(true)
    expect(collisionPlan(naming, null, NAMING_COLLISION_SCAN_MAX_N)).toBe('certify')
    expect(collisionPlan(naming, null, 1)).toBe('certify')
    expect(collisionPlan(naming, null, 0)).toBe('certify')
  })

  it('a generated table is certified above the limit and above the engine scan cap (the certificate has no cap)', () => {
    const big = createNaming({ base: COLLISION_SCAN_MAX_N + 2, interactiveMaxN: COLLISION_SCAN_MAX_N + 10 })
    expect(big.sounds).not.toBeNull()
    expect(canCertify(big, null)).toBe(true)
    expect(collisionPlan(big, null, NAMING_COLLISION_SCAN_MAX_N)).toBe('certify')
  })

  it('a table that cannot be certified is scanned up to and including the limit, and skipped above it', () => {
    const naming = withDuplicateSound()
    expect(canCertify(naming, null)).toBe(false)
    expect(collisionPlan(naming, null, BASE)).toBe('scan')
    expect(collisionPlan(naming, null, BASE + 100)).toBe('scan')
    expect(collisionPlan(naming, null, BASE - 1)).toBe('skip')
    expect(collisionPlan(naming, null, 2)).toBe('skip')
  })

  it('a naming under a preset layer must be scanned (the preset names are not covered by the certificate)', () => {
    const ccru = createNaming({
      base: CCRU_NAMING_PRESET.base,
      interactiveMaxN: INTERACTIVE_MAX_N,
      source: 'ccru',
      preset: CCRU_NAMING_PRESET,
    })
    expect(canCertify(ccru, CCRU_NAMING_PRESET)).toBe(false)
    expect(collisionPlan(ccru, CCRU_NAMING_PRESET, NAMING_COLLISION_SCAN_MAX_N)).toBe('scan')
    expect(collisionPlan(ccru, CCRU_NAMING_PRESET, CCRU_NAMING_PRESET.base - 1)).toBe('skip')
  })

  it('a seed-only naming (no table) is never scanned, even when the limit is enormous', () => {
    const seedOnly = createNaming({ base: INTERACTIVE_MAX_N + 2, interactiveMaxN: INTERACTIVE_MAX_N })
    expect(seedOnly.sounds).toBeNull()
    expect(collisionPlan(seedOnly, null, Number.MAX_SAFE_INTEGER)).toBe('skip')
    expect(() => createCollisionJob(seedOnly, null)).toThrow(RangeError)
  })

  it('a table whose length is not the base is never scanned (the engine would refuse it)', () => {
    const naming = withDuplicateSound()
    const short: Naming = { ...naming, sounds: (naming.sounds ?? []).slice(0, BASE - 1) }
    expect(() => createCollisionJob(short, null)).toThrow(RangeError)
    expect(collisionPlan(short, null, 10_000)).toBe('skip')
  })

  it('a scan above the engine cap is never planned, however high the limit is set', () => {
    const base = COLLISION_SCAN_MAX_N + 2
    // a raised ceiling gives this base a table (the app's own ceiling would make it seed-only)
    const naming = createNaming({ base, interactiveMaxN: base + 10 })
    expect(naming.sounds).not.toBeNull()
    const sounds = [...(naming.sounds ?? [])]
    sounds[1] = sounds[0] as string
    const typed: Naming = { ...naming, sounds }
    expect(canCertify(typed, null)).toBe(false)
    expect(collisionPlan(typed, null, 10_000_000)).toBe('skip')
    expect(() => createCollisionJob(typed, null)).toThrow(RangeError)
  })

  it('every planned route builds a job without throwing, and only the certified route is certified', () => {
    const cases: readonly [Naming, 'certify' | 'scan'][] = [
      [generated(), 'certify'],
      [withDuplicateSound(), 'scan'],
    ]
    for (const [naming, plan] of cases) {
      expect(collisionPlan(naming, null, NAMING_COLLISION_SCAN_MAX_N)).toBe(plan)
      expect(createCollisionJob(naming, null).certified).toBe(plan === 'certify')
    }
  })

  it('the app limit stays within the engine cap and the interactive ceiling', () => {
    expect(NAMING_COLLISION_SCAN_MAX_N).toBeLessThanOrEqual(COLLISION_SCAN_MAX_N)
    expect(collisionScanLimit()).toBeLessThanOrEqual(COLLISION_SCAN_MAX_N)
    expect(collisionScanLimit()).toBeLessThanOrEqual(INTERACTIVE_MAX_N)
    expect(collisionScanLimit()).toBeGreaterThan(0)
  })
})

// ── runSlicedJob ───────────────────────────────────────────────────────────

const REPORT: CollisionReport = Object.freeze({ groups: 3, demons: 7, list: Object.freeze([]) })

interface Rig {
  readonly clock: { t: number }
  readonly queue: (() => void)[]
  readonly deps: SliceDeps
  /** Runs the oldest scheduled slice. */
  runNext(): void
}

function rig(sliceMs = COLLISION_SLICE_MS): Rig {
  const clock = { t: 1000 }
  const queue: (() => void)[] = []
  const deps: SliceDeps = { schedule: fn => void queue.push(fn), now: () => clock.t, sliceMs }
  return {
    clock,
    queue,
    deps,
    runNext: () => {
      const fn = queue.shift()
      if (fn === undefined) throw new Error('no slice is scheduled')
      fn()
    },
  }
}

type Step = (shouldYield: () => boolean) => CollisionReport | null

/** A job that runs the given scripted steps in order and then keeps returning the last one's result. */
function scripted(steps: readonly Step[]): CollisionJob & { readonly calls: () => number } {
  let calls = 0
  return {
    certified: false,
    calls: () => calls,
    step(shouldYield) {
      const step = steps[Math.min(calls, steps.length - 1)] as Step
      calls++
      return step(shouldYield)
    },
  }
}

describe('runSlicedJob: scheduling', () => {
  it('schedules the first slice and does no work before it runs', () => {
    const r = rig()
    const job = scripted([() => REPORT])
    const done = vi.fn()
    runSlicedJob(job, r.deps, done)
    expect(r.queue).toHaveLength(1)
    expect(job.calls()).toBe(0)
    expect(done).not.toHaveBeenCalled()
  })

  it('reschedules one slice at a time while the job answers null, then reports the very same object once', () => {
    const r = rig()
    const job = scripted([() => null, () => null, () => null, () => REPORT])
    const done = vi.fn()
    runSlicedJob(job, r.deps, done)
    for (let i = 1; i <= 3; i++) {
      r.runNext()
      expect(job.calls()).toBe(i)
      expect(r.queue).toHaveLength(1)
      expect(done).not.toHaveBeenCalled()
    }
    r.runNext()
    expect(job.calls()).toBe(4)
    expect(r.queue).toHaveLength(0)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done.mock.calls[0]?.[0]).toBe(REPORT)
  })

  it('each slice gets its own deadline: the clock at the start of that slice plus sliceMs, and past it only strictly after', () => {
    const r = rig(8)
    const seen: boolean[][] = [[], []]
    const job = scripted([
      sy => {
        r.clock.t += 3
        seen[0]?.push(sy()) // 3 ms in
        r.clock.t += 5
        seen[0]?.push(sy()) // exactly 8 ms in: not yet past the deadline
        r.clock.t += 1
        seen[0]?.push(sy()) // 9 ms in
        return null
      },
      sy => {
        seen[1]?.push(sy()) // the clock moved a long way between the slices; this slice's own deadline starts here
        r.clock.t += 9
        seen[1]?.push(sy())
        return REPORT
      },
    ])
    runSlicedJob(job, r.deps, () => undefined)
    r.runNext()
    r.clock.t += 500
    r.runNext()
    expect(seen[0]).toEqual([false, false, true])
    expect(seen[1]).toEqual([false, true])
  })

  it('a slice length of zero yields as soon as any time has passed, and never before', () => {
    const r = rig(0)
    const seen: boolean[] = []
    const job = scripted([
      sy => {
        seen.push(sy())
        r.clock.t += 1
        seen.push(sy())
        return REPORT
      },
    ])
    runSlicedJob(job, r.deps, () => undefined)
    r.runNext()
    expect(seen).toEqual([false, true])
  })
})

describe('runSlicedJob: cancellation', () => {
  it('cancel before the first slice: the job is never stepped, nothing is reported and nothing more is scheduled', () => {
    const r = rig()
    const job = scripted([() => REPORT])
    const done = vi.fn()
    const handle = runSlicedJob(job, r.deps, done)
    handle.cancel()
    r.runNext()
    expect(job.calls()).toBe(0)
    expect(done).not.toHaveBeenCalled()
    expect(r.queue).toHaveLength(0)
  })

  it('cancel between slices: the slice already queued does nothing and schedules no successor', () => {
    const r = rig()
    const job = scripted([() => null, () => null, () => REPORT])
    const done = vi.fn()
    const handle = runSlicedJob(job, r.deps, done)
    r.runNext()
    expect(job.calls()).toBe(1)
    expect(r.queue).toHaveLength(1)
    handle.cancel()
    r.runNext()
    expect(job.calls()).toBe(1)
    expect(done).not.toHaveBeenCalled()
    expect(r.queue).toHaveLength(0)
  })

  it('a cancel that happens inside the step that finishes the job still suppresses the report', () => {
    const r = rig()
    const done = vi.fn()
    // eslint-disable-next-line prefer-const -- assigned after the job exists, read when the slice runs
    let handle: { cancel(): void } | undefined
    const job = scripted([
      () => {
        handle?.cancel()
        return REPORT
      },
    ])
    handle = runSlicedJob(job, r.deps, done)
    r.runNext()
    expect(job.calls()).toBe(1)
    expect(done).not.toHaveBeenCalled()
    expect(r.queue).toHaveLength(0)
  })

  it('a cancel that happens inside a step that yields schedules nothing more', () => {
    const r = rig()
    // eslint-disable-next-line prefer-const -- assigned after the job exists, read when the slice runs
    let handle: { cancel(): void } | undefined
    const job = scripted([
      () => {
        handle?.cancel()
        return null
      },
    ])
    handle = runSlicedJob(job, r.deps, () => undefined)
    r.runNext()
    expect(job.calls()).toBe(1)
    expect(r.queue).toHaveLength(0)
  })

  it('cancel is harmless after the report and when called twice', () => {
    const r = rig()
    const done = vi.fn()
    const handle = runSlicedJob(scripted([() => REPORT]), r.deps, done)
    r.runNext()
    handle.cancel()
    handle.cancel()
    expect(done).toHaveBeenCalledTimes(1)
    expect(r.queue).toHaveLength(0)
  })

  it('two runs are independent: cancelling one leaves the other running', () => {
    const r = rig()
    const doneA = vi.fn()
    const doneB = vi.fn()
    const a = runSlicedJob(scripted([() => REPORT]), r.deps, doneA)
    runSlicedJob(scripted([() => REPORT]), r.deps, doneB)
    a.cancel()
    r.runNext()
    r.runNext()
    expect(doneA).not.toHaveBeenCalled()
    expect(doneB).toHaveBeenCalledTimes(1)
  })
})

describe('runSlicedJob: the real engine jobs', () => {
  it('a certified job finishes in the first slice with the certified answer', () => {
    const r = rig()
    const naming = generated()
    const job = createCollisionJob(naming, null)
    expect(job.certified).toBe(true)
    const done = vi.fn()
    runSlicedJob(job, r.deps, done)
    r.runNext()
    expect(r.queue).toHaveLength(0)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done.mock.calls[0]?.[0]).toEqual({ groups: 0, demons: 0, list: [] })
  })

  it('a scan that yields at every check takes many slices and still returns the engine answer', () => {
    const naming = withDuplicateSound()
    const expected = findCollisions(naming, null)
    expect(expected.groups).toBeGreaterThan(0)
    const r = rig(COLLISION_SLICE_MS)
    // every clock read is a whole slice later than the one before, so shouldYield is true at every check
    const deps: SliceDeps = { ...r.deps, now: () => (r.clock.t += COLLISION_SLICE_MS + 1) }
    const job = createCollisionJob(naming, null)
    expect(job.certified).toBe(false)
    const done = vi.fn()
    runSlicedJob(job, deps, done)
    let slices = 0
    while (r.queue.length > 0) {
      r.runNext()
      slices++
      expect(slices).toBeLessThan(10_000)
    }
    expect(slices).toBeGreaterThan(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done.mock.calls[0]?.[0]).toEqual(expected)
  })

  it('a scan whose clock never advances is done in one slice with the same answer', () => {
    const naming = withDuplicateSound()
    const r = rig()
    const done = vi.fn()
    runSlicedJob(createCollisionJob(naming, null), r.deps, done)
    r.runNext()
    expect(r.queue).toHaveLength(0)
    expect(done.mock.calls[0]?.[0]).toEqual(findCollisions(naming, null))
  })

  it('a scan of a naming under the preset layer finishes and agrees with the engine', () => {
    const ccru = createNaming({
      base: CCRU_NAMING_PRESET.base,
      interactiveMaxN: INTERACTIVE_MAX_N,
      source: 'ccru',
      preset: CCRU_NAMING_PRESET,
    })
    expect(collisionPlan(ccru, CCRU_NAMING_PRESET, NAMING_COLLISION_SCAN_MAX_N)).toBe('scan')
    const r = rig()
    const done = vi.fn()
    runSlicedJob(createCollisionJob(ccru, CCRU_NAMING_PRESET), r.deps, done)
    while (r.queue.length > 0) r.runNext()
    expect(done.mock.calls[0]?.[0]).toEqual(findCollisions(ccru, CCRU_NAMING_PRESET))
  })
})

// ── browserSchedule ────────────────────────────────────────────────────────

describe('browserSchedule', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('runs the function later, once, and never inside the call', async () => {
    let calls = 0
    await new Promise<void>(resolve => {
      browserSchedule(() => {
        calls++
        resolve()
      })
      expect(calls).toBe(0)
    })
    expect(calls).toBe(1)
  })

  it('uses a message channel when there is one and closes its port (nothing is left open)', async () => {
    expect(typeof MessageChannel).toBe('function')
    const timer = vi.spyOn(globalThis, 'setTimeout')
    await new Promise<void>(resolve => browserSchedule(resolve))
    expect(timer.mock.calls.filter(call => call[1] === 0)).toHaveLength(0)
  })

  it('closes the channel port before it runs the function, so a finished slice leaves nothing open', async () => {
    const events: string[] = []
    class FakeChannel {
      port1: { onmessage: (() => void) | null; close: () => void } = { onmessage: null, close: () => void events.push('close') }
      port2 = {
        postMessage: (): void => {
          events.push('post')
          queueMicrotask(() => this.port1.onmessage?.())
        },
      }
    }
    vi.stubGlobal('MessageChannel', FakeChannel)
    await new Promise<void>(resolve =>
      browserSchedule(() => {
        events.push('run')
        resolve()
      }),
    )
    expect(events).toEqual(['post', 'close', 'run'])
  })

  it('falls back to a zero-delay timer where there is no MessageChannel', async () => {
    vi.stubGlobal('MessageChannel', undefined)
    const timer = vi.spyOn(globalThis, 'setTimeout')
    let calls = 0
    await new Promise<void>(resolve =>
      browserSchedule(() => {
        calls++
        resolve()
      }),
    )
    expect(calls).toBe(1)
    expect(timer.mock.calls.some(call => call[1] === 0)).toBe(true)
  })
})

// ── source ─────────────────────────────────────────────────────────────────

describe('collisionSchedule source', () => {
  const source = readFileSync(SCHEDULE_SOURCE, 'utf8')

  it('starts no worker and reads no wall clock (the engine has none, and the app injects its own)', () => {
    expect(source).not.toContain('new Worker')
    expect(source).not.toContain('Date.now')
    expect(source).not.toContain('performance')
  })
})
