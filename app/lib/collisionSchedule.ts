// The scheduling of the collision report (Phase 7, plan 20; D-12, NAM-03, 07-RESEARCH Pattern 5, T-07-06d, T-07-11b): which route a
// naming takes and the pure runner that drives an engine job in short, cancellable slices on the main thread. The engine has no
// clock and starts no thread: it answers `step(shouldYield)` until it returns the report, and this module supplies the yield
// predicate from an injected clock and an injected scheduler, so a test drives it with fakes and the component with the browser's
// own. No worker is created here (the one worker of the app stays the numogram worker). Original CCRUG code (MIT, NOTICE section 1).
import {
  COLLISION_SCAN_MAX_N,
  canCertify,
  type CollisionJob,
  type CollisionReport,
  type Naming,
  type NamingPreset,
} from '../../engine/index'

/** How a naming's collisions are decided: by the certificate (instant), by a scan in slices, or not at all. */
export type CollisionPlan = 'certify' | 'scan' | 'skip'

/**
 * The route for `naming`. A table the certificate proves unique at any base is certified at once. Anything else is scanned, but only
 * up to `limit` zones (and never above the engine's own scan cap, so a planned scan can never raise its RangeError); above that the
 * answer is not computed. A naming with no table (seed-only) or with a table that is not one sound per zone has nothing the engine
 * can scan, so it is skipped too. The app decides here, before it asks the engine for a job (the engine refuses those with a RangeError).
 */
export function collisionPlan(naming: Naming, preset: NamingPreset | null, limit: number): CollisionPlan {
  const sounds = naming.sounds
  if (sounds === null || sounds.length !== naming.base) return 'skip'
  if (canCertify(naming, preset)) return 'certify'
  return naming.base <= Math.min(limit, COLLISION_SCAN_MAX_N) ? 'scan' : 'skip'
}

/** What the runner needs of its environment: a way to run a function later, a clock in milliseconds, and the length of one slice. */
export interface SliceDeps {
  /** Runs `fn` in a later task, so the page can paint and handle input between two slices. */
  readonly schedule: (fn: () => void) => void
  readonly now: () => number
  /** Milliseconds one slice may run before the job is asked to yield. */
  readonly sliceMs: number
}

/**
 * Drives `job` to its report in slices: every slice reads the clock once for its own deadline (`start + sliceMs`), steps the job with
 * a predicate that is true strictly after it, and schedules the next slice while the job is not finished. `onDone` is called once,
 * with the job's report. The first slice is scheduled, never run inside this call. After `cancel()` no slice steps the job, none is
 * scheduled and `onDone` is never called, even when the cancel happens inside the step that would have finished the job.
 */
export function runSlicedJob(job: CollisionJob, deps: SliceDeps, onDone: (report: CollisionReport) => void): { cancel(): void } {
  let cancelled = false

  function slice(): void {
    if (cancelled) return
    const deadline = deps.now() + deps.sliceMs
    const report = job.step(() => deps.now() > deadline)
    if (cancelled) return
    if (report === null) {
      deps.schedule(slice)
      return
    }
    onDone(report)
  }

  deps.schedule(slice)
  return {
    cancel(): void {
      cancelled = true
    },
  }
}

/**
 * The browser's scheduler: a message channel, which runs the function in the next task without the clamped delay a timer can have,
 * and a zero-delay timer where there is no message channel. The channel's port is closed once it has fired, so nothing stays open.
 */
export function browserSchedule(fn: () => void): void {
  if (typeof MessageChannel === 'undefined') {
    setTimeout(fn, 0)
    return
  }
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    fn()
  }
  channel.port2.postMessage(0)
}
