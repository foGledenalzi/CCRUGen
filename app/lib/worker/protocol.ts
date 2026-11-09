// Numogram worker message contract (Phase 6 REN-03, D-06): request ids, latest-wins keys, shape guards and the worker-outcome copy. Lore-free; original CCRUG code (MIT, NOTICE section 1).
import { PACKERS, type CanvasScene, type DemonSubtype, type DemonType, type Packer } from '../../../engine/index'
import { MAX_ALPHABET, isAlphabetPresetId } from '../customAlphabet'
import { labelSchemeKey, type LabelScheme } from '../labelScheme'
import { VIEW_LAYOUT_IDS, type ViewLayoutId } from '../layoutIds'
import type { NumogramSummary } from '../summary'

/** The protocol tag every message carries, so a stale or foreign message is rejected before it is read further. */
export const WORKER_PROTOCOL = 'ccrug-numogram-worker/1'

/** One build request: the numogram, its text and facet counts, and (when wanted and within the ceiling) the Canvas scene. */
export interface WorkerRequest {
  readonly protocol: typeof WORKER_PROTOCOL
  readonly type: 'build'
  readonly id: number
  readonly base: number
  readonly layout: ViewLayoutId
  readonly packer: Packer
  readonly labels: LabelScheme
  readonly wantScene: boolean
}

/** A request without its envelope: what a caller supplies and the client numbers. */
export type BuildRequest = Omit<WorkerRequest, 'protocol' | 'type' | 'id'>

/** Closed-form demon counts per type and subtype (plain objects, structured-clone safe). */
export interface DemonFacetCounts {
  readonly total: number
  readonly types: Readonly<Record<DemonType, number>>
  readonly subtypes: Readonly<Record<DemonSubtype, number>>
}

export interface WorkerBuilt {
  readonly protocol: typeof WORKER_PROTOCOL
  readonly type: 'built'
  readonly id: number
  readonly key: string
  readonly base: number
  readonly layout: ViewLayoutId
  readonly packer: Packer
  readonly labels: LabelScheme
  readonly summary: NumogramSummary
  readonly text: string
  readonly facetCounts: DemonFacetCounts
  readonly scene: CanvasScene | null
}

export type FailureReason = 'invalid-base' | 'build-failed' | 'no-worker'

export interface WorkerFailed {
  readonly protocol: typeof WORKER_PROTOCOL
  readonly type: 'error'
  readonly id: number
  readonly base: number
  readonly reason: FailureReason
  readonly message: string
}

export type WorkerResponse = WorkerBuilt | WorkerFailed

/** The latest-wins key of a result: everything that decides what the worker builds. */
export function resultKey(base: number, layout: ViewLayoutId, packer: Packer, labels: LabelScheme): string {
  return `${base}:${layout}:${packer}:${labelSchemeKey(labels)}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Exact membership against the caller-independent tuples; a caller's string is never used as an object key before it
// has passed one of these (T-06-08).
function isLabelScheme(v: unknown): v is LabelScheme {
  if (!isRecord(v)) return false
  const mode = v.mode
  // 'sounds' is accepted in the same commit as the union member: without it a Sounds toggle at a Canvas base is a
  // build-failed revert (07-RESEARCH Pitfall 5, T-07-14).
  if (mode === 'digits' || mode === 'xeno' || mode === 'sounds') return true
  if (mode === 'preset') return typeof v.preset === 'string' && isAlphabetPresetId(v.preset)
  if (mode === 'custom') {
    const chars = v.chars
    return Array.isArray(chars) && chars.length <= MAX_ALPHABET && chars.every(c => typeof c === 'string')
  }
  return false
}

/** Whether `v` is a well-formed build request. Total: a hostile object whose fields throw is simply not a request. */
export function isWorkerRequest(v: unknown): v is WorkerRequest {
  try {
    if (!isRecord(v)) return false
    const { protocol, type, id, base, layout, packer, labels, wantScene } = v
    return (
      protocol === WORKER_PROTOCOL &&
      type === 'build' &&
      typeof id === 'number' &&
      Number.isInteger(id) &&
      id >= 1 &&
      typeof base === 'number' &&
      typeof layout === 'string' &&
      (VIEW_LAYOUT_IDS as readonly string[]).includes(layout) &&
      typeof packer === 'string' &&
      (PACKERS as readonly string[]).includes(packer) &&
      isLabelScheme(labels) &&
      typeof wantScene === 'boolean'
    )
  } catch {
    return false
  }
}

/** Whether `v` has the envelope of a worker response (protocol, type, integer id, numeric base). Total. */
export function isWorkerResponse(v: unknown): v is WorkerResponse {
  try {
    if (!isRecord(v)) return false
    const { protocol, type, id, base } = v
    return (
      protocol === WORKER_PROTOCOL &&
      (type === 'built' || type === 'error') &&
      typeof id === 'number' &&
      Number.isInteger(id) &&
      typeof base === 'number'
    )
  } catch {
    return false
  }
}

/** UI copy for worker outcomes (UI-SPEC Copywriting Contract), shown in the picker's refusal slot. */
export function computeFailedMessage(base: number, lastValid: number): string {
  return `Couldn't compute base ${base}. Showing base ${lastValid}.`
}

export function noWorkerMessage(base: number, lastValid: number): string {
  return `Base ${base} needs a background worker, which this browser can't start. Showing base ${lastValid}.`
}
