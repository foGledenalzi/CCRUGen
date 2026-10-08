// The pure worker core (Phase 6 D-06): the same function runs in workers/numogram.worker.ts and as the no-Worker main-thread fallback. Lore-free; original CCRUG code (MIT, NOTICE section 1).
//
// One request in, one response out, nothing thrown. The summary, the text view and the demon facet counts are bounded
// (T-04-08, T-04-21) and safe at every base up to 2^26; the Canvas scene is built only up to the shipped interactive
// ceiling and never for a base-10 preset (T-06-01), so a huge typed base allocates no scene. Every typed array of a
// scene owns its buffer, and the transfer list names each buffer once (T-06-13).
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
  validateBase,
  type CanvasScene,
  type Numogram,
} from '../../../engine/index'
import { formatZoneLabel } from '../labelScheme'
import { isLayoutIdFor, isPresetLayoutId } from '../layoutIds'
import { numogramText } from '../numogramText'
import { summarize } from '../summary'
import { INTERACTIVE_MAX_N } from '../tierBounds'
import {
  WORKER_PROTOCOL,
  isWorkerRequest,
  resultKey,
  type FailureReason,
  type WorkerBuilt,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol'

export interface BuildOutput {
  readonly response: WorkerResponse
  readonly transfer: ArrayBuffer[]
}

/**
 * Whether a Canvas scene is built for this request: only when one is wanted, the base is within the shipped
 * interactive ceiling (data, read from the tier table) and the layout is not one of the base-10 authored layouts, which stay SVG.
 */
export function sceneWanted(req: Pick<WorkerRequest, 'base' | 'layout' | 'wantScene'>): boolean {
  return req.wantScene && req.base <= INTERACTIVE_MAX_N && !isPresetLayoutId(req.layout, req.base)
}

function buildScene(req: WorkerRequest, g: Numogram): CanvasScene {
  if (req.layout === 'pairGraph') {
    const pg = pairGraphLayout(g, { packer: req.packer })
    return buildPairScene(g, pg, routePairGraph(g, pg))
  }
  const layout = resolveLayout(g, req.layout, [], { packer: req.packer })
  return buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
}

/** Builds the response for a well-formed request. Throws a RangeError for a bad base or a layout not offered at the base. */
export function buildResult(req: WorkerRequest): WorkerBuilt {
  const check = validateBase(req.base)
  if (!check.ok) throw new RangeError(check.message)
  if (!isLayoutIdFor(req.layout, req.base)) {
    throw new RangeError(`buildResult: layout ${req.layout} is not offered at base ${req.base}`)
  }
  const g = createNumogram(req.base)
  const summary = summarize(g)
  const text = numogramText(g, z => formatZoneLabel(z, req.base, req.labels))
  const facetCounts = { total: g.demons.count, types: { ...g.demons.typeCounts() }, subtypes: { ...g.demons.counts() } }
  const scene = sceneWanted(req) ? buildScene(req, g) : null
  return {
    protocol: WORKER_PROTOCOL,
    type: 'built',
    id: req.id,
    key: resultKey(req.base, req.layout, req.packer, req.labels),
    base: req.base,
    layout: req.layout,
    packer: req.packer,
    labels: req.labels,
    summary,
    text,
    facetCounts,
    scene,
  }
}

/** Every typed-array buffer of the scene, each exactly once (a duplicate in a transfer list is a DataCloneError, P15). */
export function transferListFor(scene: CanvasScene | null): ArrayBuffer[] {
  if (scene === null) return []
  const views: ArrayBufferView[] = [
    scene.x,
    scene.y,
    scene.drawOrder,
    scene.syzygySeg,
    scene.currentCurves,
    scene.currentKind,
    scene.junctionX,
    scene.junctionY,
    scene.currentTo,
    scene.gateCurves,
    scene.gateLoop,
    scene.gateTo,
    scene.gateLabelX,
    scene.gateLabelY,
    scene.edgeSegStart,
    scene.edgeBox,
    scene.pickSegments,
  ]
  if (scene.px !== null) views.push(scene.px)
  if (scene.py !== null) views.push(scene.py)
  const buffers = new Set<ArrayBuffer>()
  for (const view of views) buffers.add(view.buffer as ArrayBuffer)
  return [...buffers]
}

// A field of untrusted data, or undefined when reading it throws (a hostile accessor can never escape the core).
function readField(data: unknown, key: string): unknown {
  try {
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[key] : undefined
  } catch {
    return undefined
  }
}

function failure(id: number, base: number, reason: FailureReason, message: string): BuildOutput {
  return { response: { protocol: WORKER_PROTOCOL, type: 'error', id, base, reason, message }, transfer: [] }
}

/** Answers one worker message. Never throws: every failure is an error response carrying the request id when it had one. */
export function handleRequest(data: unknown): BuildOutput {
  try {
    if (!isWorkerRequest(data)) {
      const rawId = readField(data, 'id')
      const rawBase = readField(data, 'base')
      return failure(
        typeof rawId === 'number' && Number.isInteger(rawId) ? rawId : -1,
        typeof rawBase === 'number' ? rawBase : -1,
        'build-failed',
        'malformed worker request',
      )
    }
    const check = validateBase(data.base)
    if (!check.ok) return failure(data.id, data.base, 'invalid-base', check.message)
    try {
      const response = buildResult(data)
      return { response, transfer: transferListFor(response.scene) }
    } catch (err) {
      return failure(data.id, data.base, 'build-failed', String(err instanceof Error ? err.message : err))
    }
  } catch (err) {
    return failure(-1, -1, 'build-failed', String(err instanceof Error ? err.message : err))
  }
}
