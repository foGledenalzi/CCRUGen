// Latest-wins client for the numogram worker (Phase 6 REN-03, D-06, D-07): one long-lived worker, 1 in flight + 1 pending, stale ids discarded, main-thread fallback up to the ceiling. Original CCRUG code (MIT, NOTICE section 1).
//
// The client is plain TypeScript with an injected worker factory and scheduler, so a unit test drives it with a fake
// worker (no jsdom, no real Worker). Every request takes the next id; a reply reaches its callback only while its id is
// still the latest, so a superseded base never shows (T-06-03). The worker holds at most one job and the client keeps at
// most one waiting request, replaced by any newer one, so typing or dragging cannot queue unbounded work (T-06-21).
import { WORKER_PROTOCOL, isWorkerResponse, type BuildRequest, type WorkerRequest, type WorkerResponse } from './protocol'

/** The part of a Worker the client uses; a real Worker satisfies it and the tests supply a fake. */
export interface WorkerLike {
  postMessage(message: unknown, options?: { transfer?: Transferable[] }): void
  terminate(): void
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
}

export interface WorkerClientOptions {
  /** Creates the worker on the first request. `null` or a throw means there is no worker. */
  readonly makeWorker: () => WorkerLike | null
  /** The same pure core the worker runs, used on the main thread when there is no working worker. */
  readonly fallback: (req: WorkerRequest) => WorkerResponse
  /** The largest base the main thread may build (INTERACTIVE_MAX_N in the app); above it the reply is a no-worker error. */
  readonly fallbackMaxBase: number
  /** Runs a fallback job later. The app yields one frame so the computing status paints; tests run jobs on demand. */
  readonly schedule: (job: () => void) => void
}

interface Job {
  readonly msg: WorkerRequest
  readonly onResult: (resp: WorkerResponse) => void
}

export class WorkerClient {
  private latestId = 0
  private inFlight: Job | null = null
  private pending: Job | null = null
  private worker: WorkerLike | null = null
  private created = false
  private dead = false
  private disposed = false

  constructor(private readonly options: WorkerClientOptions) {}

  /** The id of the newest request (or supersede): only a reply carrying it is ever delivered. */
  get latest(): number {
    return this.latestId
  }

  /**
   * Asks for a build. The reply reaches `onResult` only if no newer request or supersede happened meanwhile; a request
   * replaced while it waits is never sent and never answered. Returns the request id.
   */
  request(req: BuildRequest, onResult: (resp: WorkerResponse) => void): number {
    const id = ++this.latestId
    if (this.disposed) return id
    const msg: WorkerRequest = { protocol: WORKER_PROTOCOL, type: 'build', id, ...req }
    if (!this.created) this.create()
    if (this.dead) this.runFallback({ msg, onResult })
    else if (this.inFlight === null) this.post({ msg, onResult })
    else this.pending = { msg, onResult }
    return id
  }

  /** A synchronous (SVG-tier) commit calls this: every outstanding reply becomes stale and the waiting request is dropped. */
  supersede(): void {
    this.latestId++
    this.pending = null
  }

  /** Terminates the worker and drops everything outstanding. Idempotent (StrictMode mounts, unmounts and remounts). */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.worker?.terminate()
    this.worker = null
    this.inFlight = null
    this.pending = null
  }

  // The worker is created here, on the first request, and never in an effect: React StrictMode would spawn it twice (P17).
  private create(): void {
    this.created = true
    try {
      const worker = this.options.makeWorker()
      if (worker === null) {
        this.dead = true
        return
      }
      worker.onmessage = e => this.onMessage(e)
      worker.onerror = () => this.onError()
      this.worker = worker
    } catch {
      this.dead = true
    }
  }

  private post(job: Job): void {
    const worker = this.worker
    try {
      if (worker === null) throw new Error('no worker')
      worker.postMessage(job.msg)
      this.inFlight = job
    } catch {
      // A message that cannot be sent leaves the worker unusable: answer this request on the main thread.
      this.kill()
      this.runFallback(job)
    }
  }

  private onMessage(e: MessageEvent): void {
    if (this.disposed || this.dead) return
    const data: unknown = e.data
    const job = this.inFlight
    if (!isWorkerResponse(data) || job === null || data.id !== job.msg.id) return
    this.inFlight = null
    if (data.id === this.latestId) job.onResult(data)
    const next = this.pending
    this.pending = null
    if (next !== null && next.msg.id === this.latestId) this.post(next)
  }

  // A script that fails to load or an uncaught error surfaces here after construction, not as an exception (P18).
  private onError(): void {
    if (this.disposed || this.dead) return
    const { inFlight, pending } = this.kill()
    if (inFlight !== null) this.runFallback(inFlight)
    if (pending !== null) this.runFallback(pending)
  }

  /** Marks the client dead, terminates the worker once and hands back what was outstanding. */
  private kill(): { inFlight: Job | null; pending: Job | null } {
    this.dead = true
    this.worker?.terminate()
    this.worker = null
    const outstanding = { inFlight: this.inFlight, pending: this.pending }
    this.inFlight = null
    this.pending = null
    return outstanding
  }

  // Main-thread path: the same core, but only up to the ceiling. A superseded job does no work at all.
  private runFallback(job: Job): void {
    const { msg, onResult } = job
    this.options.schedule(() => {
      if (this.disposed || msg.id !== this.latestId) return
      if (msg.base > this.options.fallbackMaxBase) {
        onResult({
          protocol: WORKER_PROTOCOL,
          type: 'error',
          id: msg.id,
          base: msg.base,
          reason: 'no-worker',
          message: 'no background worker',
        })
        return
      }
      let resp: WorkerResponse
      try {
        resp = this.options.fallback(msg)
      } catch (err) {
        resp = {
          protocol: WORKER_PROTOCOL,
          type: 'error',
          id: msg.id,
          base: msg.base,
          reason: 'build-failed',
          message: String(err instanceof Error ? err.message : err),
        }
      }
      if (resp.id === this.latestId) onResult(resp)
    })
  }
}

/** The ONLY place a Worker is constructed: the literal form webpack 5 bundles as a same-origin chunk (verified under Next 14.2.35 export, root and basePath). */
export function createNumogramWorker(): Worker {
  return new Worker(new URL('../../../workers/numogram.worker.ts', import.meta.url))
}
