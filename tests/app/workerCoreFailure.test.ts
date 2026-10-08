// REN-03 (Phase 6 D-06, T-06-08): an unexpected engine failure inside the worker core becomes an error response, never a
// throw into the worker shell. The engine is replaced here (a separate file, so the mock cannot touch workerCore.test.ts):
// createNumogram throws whatever the test chooses, everything else is the real engine.
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ thrown: null as unknown }))

vi.mock('../../engine/index', async importOriginal => {
  const real = await importOriginal<typeof import('../../engine/index')>()
  return {
    ...real,
    createNumogram: (base: number) => {
      if (state.thrown !== null) throw state.thrown
      return real.createNumogram(base)
    },
  }
})

import { handleRequest } from '../../app/lib/worker/buildResult'
import { WORKER_PROTOCOL, type WorkerRequest } from '../../app/lib/worker/protocol'

const REQUEST: WorkerRequest = {
  protocol: WORKER_PROTOCOL,
  type: 'build',
  id: 21,
  base: 28,
  layout: 'ring',
  packer: 'shelf',
  labels: { mode: 'digits' },
  wantScene: true,
}

describe('handleRequest when the engine throws', () => {
  it('reports an Error as build-failed carrying its message, the id and the base', () => {
    state.thrown = new Error('engine exploded')
    const out = handleRequest(REQUEST)
    state.thrown = null
    expect(out.response).toMatchObject({
      protocol: WORKER_PROTOCOL,
      type: 'error',
      id: 21,
      base: 28,
      reason: 'build-failed',
      message: 'engine exploded',
    })
    expect(out.transfer).toEqual([])
  })

  it('reports a thrown non-Error value as build-failed with its string form', () => {
    state.thrown = 'plain string failure'
    const out = handleRequest(REQUEST)
    state.thrown = null
    expect(out.response).toMatchObject({ type: 'error', reason: 'build-failed', message: 'plain string failure', id: 21 })
  })

  it('works again once the engine stops throwing', () => {
    expect(handleRequest(REQUEST).response.type).toBe('built')
  })
})
