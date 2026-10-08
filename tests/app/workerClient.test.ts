// REN-03 (Phase 6 D-06, D-07; T-06-03, T-06-21, T-06-01c): the latest-wins worker client. Everything runs against a
// hand-written fake worker and an on-demand scheduler, so the tests decide the order in which replies and scheduled
// fallback jobs happen. No real Worker is ever constructed here (createNumogramWorker is exercised by the static checks
// and by the production build, not in node).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { handleRequest } from '../../app/lib/worker/buildResult'
import {
  WORKER_PROTOCOL,
  type BuildRequest,
  type WorkerFailed,
  type WorkerRequest,
  type WorkerResponse,
} from '../../app/lib/worker/protocol'
import { WorkerClient, type WorkerClientOptions, type WorkerLike } from '../../app/lib/worker/workerClient'

// An arbitrary ceiling for the fallback tests; the app passes INTERACTIVE_MAX_N (checked in the last describe).
const FALLBACK_MAX = 200

function req(base = 28): BuildRequest {
  return { base, layout: 'ring', packer: 'shelf', labels: { mode: 'digits' }, wantScene: true }
}

/** A reply with the envelope the client guards on; the client never reads the rest of a real WorkerBuilt. */
function reply(id: number, base = 28): WorkerResponse {
  return { protocol: WORKER_PROTOCOL, type: 'built', id, key: `k${id}`, base } as unknown as WorkerResponse
}

class FakeWorker implements WorkerLike {
  readonly posted: WorkerRequest[] = []
  terminated = 0
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null

  postMessage(message: unknown): void {
    this.posted.push(message as WorkerRequest)
  }

  terminate(): void {
    this.terminated++
  }

  /** Delivers a message to the page as the browser would. */
  deliver(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }

  /** Fires the worker's error event. */
  crash(): void {
    this.onerror?.({ type: 'error' } as ErrorEvent)
  }
}

interface Delivery {
  readonly tag: string
  readonly resp: WorkerResponse
  /** `client.latest` at the moment the callback ran. */
  readonly latest: number
}

function rig(overrides: Partial<WorkerClientOptions> = {}) {
  const worker = new FakeWorker()
  const jobs: Array<() => void> = []
  const stats = { made: 0 }
  const fallbackCalls: WorkerRequest[] = []
  const client = new WorkerClient({
    makeWorker: () => {
      stats.made++
      return worker
    },
    fallback: r => {
      fallbackCalls.push(r)
      return reply(r.id, r.base)
    },
    fallbackMaxBase: FALLBACK_MAX,
    schedule: job => {
      jobs.push(job)
    },
    ...overrides,
  })
  const deliveries: Delivery[] = []
  const cb =
    (tag: string) =>
    (resp: WorkerResponse): void => {
      deliveries.push({ tag, resp, latest: client.latest })
    }
  const flush = (): void => {
    for (let guard = 0; jobs.length > 0 && guard < 1000; guard++) (jobs.shift() as () => void)()
  }
  return { client, worker, stats, fallbackCalls, deliveries, cb, flush, queuedJobs: () => jobs.length }
}

const tags = (ds: readonly Delivery[]): string[] => ds.map(d => d.tag)

describe('WorkerClient: creation', () => {
  it('creates the worker lazily on the first request and never again', () => {
    const r = rig()
    expect(r.stats.made).toBe(0)
    r.client.request(req(), r.cb('a'))
    expect(r.stats.made).toBe(1)
    r.client.request(req(30), r.cb('b'))
    r.client.request(req(32), r.cb('c'))
    r.worker.deliver(reply(1))
    r.worker.deliver(reply(3))
    r.client.request(req(34), r.cb('d'))
    expect(r.stats.made).toBe(1)
  })

  it('numbers requests monotonically and wraps the request in the protocol envelope', () => {
    const r = rig()
    expect(r.client.latest).toBe(0)
    expect(r.client.request(req(), r.cb('a'))).toBe(1)
    expect(r.client.request(req(30), r.cb('b'))).toBe(2)
    expect(r.client.latest).toBe(2)
    expect(r.worker.posted).toEqual([{ protocol: WORKER_PROTOCOL, type: 'build', id: 1, ...req() }])
  })

  it('does not create a worker for dispose alone', () => {
    const r = rig()
    r.client.dispose()
    expect(r.stats.made).toBe(0)
    expect(r.worker.terminated).toBe(0)
  })
})

describe('WorkerClient: latest wins, one in flight and one pending (D-07, T-06-21)', () => {
  it('request A then B while A is in flight: only A is posted, A is discarded, B is posted then delivered once', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    expect(r.worker.posted.map(m => m.id)).toEqual([1])

    r.worker.deliver(reply(1, 28))
    expect(r.deliveries).toEqual([])
    expect(r.worker.posted.map(m => m.id)).toEqual([1, 2])

    r.worker.deliver(reply(2, 30))
    expect(tags(r.deliveries)).toEqual(['B'])
    expect(r.deliveries[0]?.resp.id).toBe(2)
    expect(r.deliveries[0]?.latest).toBe(2)

    r.worker.deliver(reply(2, 30))
    expect(r.deliveries).toHaveLength(1)
  })

  it('A, B, C rapidly: B is replaced in the pending slot, never posted and never called; only C is delivered', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    r.client.request(req(32), r.cb('C'))
    expect(r.worker.posted.map(m => m.id)).toEqual([1])

    r.worker.deliver(reply(1))
    expect(r.worker.posted.map(m => m.id)).toEqual([1, 3])
    r.worker.deliver(reply(3, 32))

    expect(tags(r.deliveries)).toEqual(['C'])
    expect(r.worker.posted.map(m => m.base)).toEqual([28, 32])
  })

  it('a single request is delivered when its reply arrives', () => {
    const r = rig()
    r.client.request(req(), r.cb('A'))
    r.worker.deliver(reply(1))
    expect(tags(r.deliveries)).toEqual(['A'])
  })

  it('the queue never grows: a long burst leaves one message in the worker and posts only the last one afterwards', () => {
    const r = rig()
    for (let i = 0; i < 50; i++) r.client.request(req(28 + 2 * i), r.cb(`q${i}`))
    expect(r.worker.posted).toHaveLength(1)
    r.worker.deliver(reply(1))
    expect(r.worker.posted).toHaveLength(2)
    expect(r.worker.posted[1]?.id).toBe(50)
    r.worker.deliver(reply(50, 126))
    expect(tags(r.deliveries)).toEqual(['q49'])
    expect(r.worker.posted).toHaveLength(2)
  })

  it('a reply with an id that is not the in-flight id is ignored and leaves the slot unchanged', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    r.worker.deliver(reply(2, 30)) // B's id while A is in flight
    r.worker.deliver(reply(99))
    r.worker.deliver(reply(0))
    r.worker.deliver(reply(-1))
    expect(r.deliveries).toEqual([])
    expect(r.worker.posted.map(m => m.id)).toEqual([1])

    r.worker.deliver(reply(1))
    expect(r.worker.posted.map(m => m.id)).toEqual([1, 2])
    r.worker.deliver(reply(2, 30))
    expect(tags(r.deliveries)).toEqual(['B'])
  })

  it('replies that fail the response guard are ignored', () => {
    const r = rig()
    r.client.request(req(), r.cb('A'))
    for (const bad of [
      null,
      undefined,
      42,
      'x',
      [],
      {},
      { protocol: 'other/1', type: 'built', id: 1, base: 28 },
      { protocol: WORKER_PROTOCOL, type: 'weird', id: 1, base: 28 },
      { protocol: WORKER_PROTOCOL, type: 'built', id: '1', base: 28 },
      { protocol: WORKER_PROTOCOL, type: 'built', id: 1.5, base: 28 },
      { protocol: WORKER_PROTOCOL, type: 'built', id: 1, base: '28' },
    ]) {
      r.worker.deliver(bad)
    }
    expect(r.deliveries).toEqual([])
    r.worker.deliver(reply(1))
    expect(tags(r.deliveries)).toEqual(['A'])
  })

  it('an error response for the latest request is delivered like a result', () => {
    const r = rig()
    r.client.request(req(), r.cb('A'))
    const failed: WorkerFailed = {
      protocol: WORKER_PROTOCOL,
      type: 'error',
      id: 1,
      base: 28,
      reason: 'build-failed',
      message: 'boom',
    }
    r.worker.deliver(failed)
    expect(r.deliveries[0]?.resp).toEqual(failed)
  })
})

describe('WorkerClient.supersede (a synchronous commit, D-07)', () => {
  it('discards the in-flight reply, raises latest by one and drops the pending request', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    expect(r.client.latest).toBe(2)

    r.client.supersede()
    expect(r.client.latest).toBe(3)

    r.worker.deliver(reply(1))
    expect(r.deliveries).toEqual([])
    expect(r.worker.posted.map(m => m.id)).toEqual([1]) // B was dropped, not posted
  })

  it('a request made after supersede is delivered; the superseded one is not', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.supersede()
    r.client.request(req(30), r.cb('B'))
    expect(r.client.latest).toBe(3)
    r.worker.deliver(reply(1))
    expect(r.worker.posted.map(m => m.id)).toEqual([1, 3])
    r.worker.deliver(reply(3, 30))
    expect(tags(r.deliveries)).toEqual(['B'])
  })

  it('supersede with nothing in flight only raises latest', () => {
    const r = rig()
    r.client.supersede()
    expect(r.client.latest).toBe(1)
    expect(r.stats.made).toBe(0)
  })

  it('a superseded fallback job does not deliver', () => {
    const r = rig({ makeWorker: () => null })
    r.client.request(req(), r.cb('A'))
    r.client.supersede()
    r.flush()
    expect(r.deliveries).toEqual([])
    expect(r.fallbackCalls).toEqual([])
  })
})

describe('WorkerClient: main-thread fallback (T-06-01c)', () => {
  for (const [name, makeWorker] of [
    ['makeWorker returns null', (): WorkerLike | null => null],
    [
      'makeWorker throws',
      (): WorkerLike | null => {
        throw new Error('Worker is not available')
      },
    ],
  ] as const) {
    it(`${name}: every request runs the fallback through the scheduler, and nothing runs before the scheduled job`, () => {
      const r = rig({ makeWorker })
      r.client.request(req(28), r.cb('A'))
      expect(r.queuedJobs()).toBe(1)
      expect(r.fallbackCalls).toEqual([])
      expect(r.deliveries).toEqual([])
      r.flush()
      expect(tags(r.deliveries)).toEqual(['A'])
      expect(r.fallbackCalls.map(m => m.id)).toEqual([1])

      r.client.request(req(30), r.cb('B'))
      r.flush()
      expect(tags(r.deliveries)).toEqual(['A', 'B'])
    })
  }

  it('delivers the fallback response only if the id is still latest when the scheduled job runs', () => {
    const r = rig({ makeWorker: () => null })
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    r.flush()
    expect(tags(r.deliveries)).toEqual(['B'])
    expect(r.fallbackCalls.map(m => m.id)).toEqual([2]) // A's job was skipped before it did any work
  })

  it('a fallback whose answer is for another id is not delivered', () => {
    const r = rig({ makeWorker: () => null, fallback: () => reply(77) })
    r.client.request(req(28), r.cb('A'))
    r.flush()
    expect(r.deliveries).toEqual([])
  })

  it('above fallbackMaxBase the callback gets a no-worker error with the request id and base; fallback is never called for it', () => {
    const r = rig({ makeWorker: () => null })
    r.client.request(req(FALLBACK_MAX + 2), r.cb('big'))
    r.flush()
    expect(r.fallbackCalls).toEqual([])
    expect(r.deliveries).toHaveLength(1)
    const resp = r.deliveries[0]?.resp as WorkerFailed
    expect(resp).toMatchObject({
      protocol: WORKER_PROTOCOL,
      type: 'error',
      reason: 'no-worker',
      id: 1,
      base: FALLBACK_MAX + 2,
    })
    expect(resp.message.length).toBeGreaterThan(0)
  })

  it('the ceiling is inclusive: exactly fallbackMaxBase still runs the fallback', () => {
    const r = rig({ makeWorker: () => null })
    r.client.request(req(FALLBACK_MAX), r.cb('edge'))
    r.flush()
    expect(r.fallbackCalls.map(m => m.base)).toEqual([FALLBACK_MAX])
    expect(r.deliveries[0]?.resp.type).toBe('built')
  })

  it('a throwing fallback becomes a build-failed error instead of a lost request', () => {
    const r = rig({
      makeWorker: () => null,
      fallback: () => {
        throw new Error('exploded')
      },
    })
    r.client.request(req(28), r.cb('A'))
    r.flush()
    expect(r.deliveries[0]?.resp).toMatchObject({ type: 'error', reason: 'build-failed', id: 1, message: 'exploded' })
  })

  it('a fallback job scheduled before dispose delivers nothing afterwards', () => {
    const r = rig({ makeWorker: () => null })
    r.client.request(req(28), r.cb('A'))
    r.client.dispose()
    r.flush()
    expect(r.deliveries).toEqual([])
    expect(r.fallbackCalls).toEqual([])
  })

  it('runs through the real core: a built response up to the ceiling, a no-worker refusal above it', () => {
    const r = rig({
      makeWorker: () => null,
      fallback: m => handleRequest(m).response,
      fallbackMaxBase: INTERACTIVE_MAX_N,
    })
    r.client.request({ ...req(28), wantScene: false }, r.cb('small'))
    r.flush()
    expect(r.deliveries[0]?.resp).toMatchObject({ type: 'built', id: 1, base: 28 })

    r.client.request({ ...req(INTERACTIVE_MAX_N + 2), wantScene: false }, r.cb('big'))
    r.flush()
    expect(r.deliveries[1]?.resp).toMatchObject({ type: 'error', reason: 'no-worker', id: 2, base: INTERACTIVE_MAX_N + 2 })
  })
})

describe('WorkerClient: worker errors (P18)', () => {
  it('marks the client dead, terminates once, re-runs the in-flight request through the fallback and uses the fallback afterwards', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.worker.crash()
    expect(r.worker.terminated).toBe(1)
    expect(r.deliveries).toEqual([])
    r.flush()
    expect(tags(r.deliveries)).toEqual(['A'])
    expect(r.fallbackCalls.map(m => m.id)).toEqual([1])

    r.client.request(req(30), r.cb('B'))
    r.flush()
    expect(tags(r.deliveries)).toEqual(['A', 'B'])
    expect(r.worker.posted.map(m => m.id)).toEqual([1]) // nothing new went to the dead worker
    expect(r.stats.made).toBe(1)
  })

  it('re-runs only what is still latest: A is stale after B, so only the pending B runs', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    r.worker.crash()
    r.flush()
    expect(tags(r.deliveries)).toEqual(['B'])
    expect(r.fallbackCalls.map(m => m.id)).toEqual([2])
  })

  it('a superseded in-flight request is not re-run after the crash', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.supersede()
    r.worker.crash()
    r.flush()
    expect(r.deliveries).toEqual([])
    expect(r.fallbackCalls).toEqual([])
  })

  it('refuses above the ceiling after the crash as well', () => {
    const r = rig()
    r.client.request(req(FALLBACK_MAX + 2), r.cb('big'))
    r.worker.crash()
    r.flush()
    expect(r.deliveries[0]?.resp).toMatchObject({ type: 'error', reason: 'no-worker', id: 1 })
  })

  it('a second error and a late reply after the crash change nothing', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.worker.crash()
    r.worker.crash()
    r.worker.deliver(reply(1))
    expect(r.worker.terminated).toBe(1)
    expect(r.deliveries).toEqual([])
    r.flush()
    expect(tags(r.deliveries)).toEqual(['A'])
  })

  it('a worker that throws from postMessage is treated as dead and the request still gets an answer', () => {
    const r = rig()
    r.worker.postMessage = () => {
      throw new Error('DataCloneError')
    }
    r.client.request(req(28), r.cb('A'))
    expect(r.worker.terminated).toBe(1)
    r.flush()
    expect(tags(r.deliveries)).toEqual(['A'])
    expect(r.stats.made).toBe(1)
  })
})

describe('WorkerClient.dispose', () => {
  it('terminates the worker once, is idempotent, and afterwards ignores replies and never posts', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.request(req(30), r.cb('B'))
    r.client.dispose()
    r.client.dispose()
    expect(r.worker.terminated).toBe(1)

    r.worker.deliver(reply(1))
    r.worker.deliver(reply(2, 30))
    expect(r.deliveries).toEqual([])

    const id = r.client.request(req(32), r.cb('C'))
    expect(id).toBeGreaterThan(2)
    expect(r.worker.posted.map(m => m.id)).toEqual([1])
    r.flush()
    expect(r.deliveries).toEqual([])
    expect(r.stats.made).toBe(1)
  })

  it('a client that disposed before any request stays inert', () => {
    const r = rig()
    r.client.dispose()
    r.client.request(req(28), r.cb('A'))
    r.flush()
    expect(r.stats.made).toBe(0)
    expect(r.deliveries).toEqual([])
    expect(r.fallbackCalls).toEqual([])
  })

  it('supersede after dispose is harmless', () => {
    const r = rig()
    r.client.request(req(28), r.cb('A'))
    r.client.dispose()
    r.client.supersede()
    expect(r.worker.terminated).toBe(1)
  })
})

describe('WorkerClient with a loopback worker running the real core', () => {
  it('answers a build request with the matching id through the shape guard', () => {
    const worker = new FakeWorker()
    worker.postMessage = message => {
      const { response } = handleRequest(message)
      queueMicrotask(() => worker.deliver(response))
    }
    const r = rig({ makeWorker: () => worker })
    r.client.request({ ...req(28), wantScene: false }, r.cb('A'))
    return Promise.resolve().then(() => {
      expect(r.deliveries).toHaveLength(1)
      expect(r.deliveries[0]?.resp).toMatchObject({ type: 'built', id: 1, base: 28 })
    })
  })
})

describe('WorkerClient: event sequences (T-06-03, T-06-21)', () => {
  type Ev =
    | { op: 'request'; base: number }
    | { op: 'supersede' }
    | { op: 'answer' }
    | { op: 'stray'; id: number }
    | { op: 'crash' }
    | { op: 'flush' }
    | { op: 'dispose' }

  const evArb: fc.Arbitrary<Ev> = fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom(4, 10, 28, 100, 202, 4000).map((base): Ev => ({ op: 'request', base })) },
    { weight: 2, arbitrary: fc.constant<Ev>({ op: 'supersede' }) },
    { weight: 6, arbitrary: fc.constant<Ev>({ op: 'answer' }) },
    { weight: 3, arbitrary: fc.integer({ min: -1, max: 40 }).map((id): Ev => ({ op: 'stray', id })) },
    { weight: 1, arbitrary: fc.constant<Ev>({ op: 'crash' }) },
    { weight: 3, arbitrary: fc.constant<Ev>({ op: 'flush' }) },
    { weight: 1, arbitrary: fc.constant<Ev>({ op: 'dispose' }) },
  )

  it('every delivered response is the latest request at delivery time, each request is answered at most once, and the worker holds one message', () => {
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 60 }), events => {
        const r = rig()
        const replied = new Set<number>()
        const idOfTag = new Map<string, number>()
        let requests = 0
        let crashedAt = -1
        let disposedAt = -1

        for (const ev of events) {
          switch (ev.op) {
            case 'request': {
              const tag = `r${requests++}`
              idOfTag.set(tag, r.client.request(req(ev.base), r.cb(tag)))
              break
            }
            case 'supersede':
              r.client.supersede()
              break
            case 'answer': {
              const last = r.worker.posted[r.worker.posted.length - 1]
              if (last !== undefined) {
                replied.add(last.id)
                r.worker.deliver(reply(last.id, last.base))
              }
              break
            }
            case 'stray':
              replied.add(ev.id)
              r.worker.deliver(reply(ev.id, 10))
              break
            case 'crash':
              // A worker that was never created cannot crash: the event then reaches no handler.
              if (crashedAt < 0 && r.stats.made > 0) crashedAt = r.worker.posted.length
              r.worker.crash()
              break
            case 'flush':
              r.flush()
              break
            case 'dispose':
              if (disposedAt < 0) disposedAt = r.deliveries.length
              r.client.dispose()
              break
          }
          // At most one message is ever unanswered in the worker (a new one is posted only after a reply to the last).
          const posted = r.worker.posted
          for (let i = 0; i < posted.length - 1; i++) expect(replied.has((posted[i] as WorkerRequest).id)).toBe(true)
        }
        r.flush()

        const seen = new Set<string>()
        for (const d of r.deliveries) {
          expect(d.resp.id).toBe(d.latest)
          expect(d.resp.id).toBe(idOfTag.get(d.tag))
          expect(seen.has(d.tag)).toBe(false)
          seen.add(d.tag)
        }
        const ids = r.worker.posted.map(m => m.id)
        expect(ids).toEqual([...ids].sort((a, b) => a - b))
        expect(new Set(ids).size).toBe(ids.length)
        expect(r.worker.terminated).toBeLessThanOrEqual(1)
        expect(r.stats.made).toBeLessThanOrEqual(1)
        if (crashedAt >= 0) expect(r.worker.posted.length).toBe(crashedAt)
        if (disposedAt >= 0) expect(r.deliveries.length).toBe(disposedAt)
      }),
      { numRuns: 400 },
    )
  })
})
