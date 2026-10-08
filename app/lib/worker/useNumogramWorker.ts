// Thin React hook over the latest-wins numogram worker client (Phase 6 REN-03, D-06, D-07). SSR-safe: nothing touches window or Worker at render time. The client is created on the first call and the Worker itself on the first request, never in an effect (StrictMode would spawn it twice, P17); unmount disposes the client, and the next request after a remount builds a fresh one. Original CCRUG code (MIT, NOTICE section 1).
import { useEffect, useMemo, useRef } from 'react'
import { INTERACTIVE_MAX_N } from '../tierBounds'
import { handleRequest } from './buildResult'
import type { BuildRequest, WorkerResponse } from './protocol'
import { WorkerClient, createNumogramWorker } from './workerClient'

export interface NumogramWorkerApi {
  /** Asks for a build; `onResult` runs only if no newer request or supersede happened first. Returns the request id. */
  request(req: BuildRequest, onResult: (resp: WorkerResponse) => void): number
  /** A synchronous commit calls this so a late worker result can never overwrite it. */
  supersede(): void
}

export function useNumogramWorker(): NumogramWorkerApi {
  const clientRef = useRef<WorkerClient | null>(null)

  // Cleanup only: the effect creates nothing (P17).
  useEffect(
    () => () => {
      clientRef.current?.dispose()
      clientRef.current = null
    },
    [],
  )

  return useMemo<NumogramWorkerApi>(() => {
    const getClient = (): WorkerClient => {
      let client = clientRef.current
      if (client === null) {
        client = new WorkerClient({
          makeWorker: () => (typeof Worker === 'undefined' ? null : createNumogramWorker()),
          fallback: req => handleRequest(req).response,
          fallbackMaxBase: INTERACTIVE_MAX_N,
          // One frame first, so the computing status paints before the main thread is blocked.
          schedule: job => {
            requestAnimationFrame(() => {
              setTimeout(job, 0)
            })
          },
        })
        clientRef.current = client
      }
      return client
    }
    return {
      request: (req, onResult) => getClient().request(req, onResult),
      supersede: () => getClient().supersede(),
    }
  }, [])
}
