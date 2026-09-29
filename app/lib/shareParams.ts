// The viewer's single URL codec (UI-02, D-13, D-21, todo 005). base is strict and user-visible when refused (D-06);
// every other field is lenient per field so a hand-edited link still loads. Replaces the dead URL canonicalizer that
// used to back the removed share-image route. Original CCRUG code (MIT, NOTICE section 1).
import type { Layer } from '../data/types'
import {
  createNumogram,
  validateBase,
  DEFAULT_LAYOUT_PARAMS,
  PACKERS,
  type BaseCheck,
  type Numogram,
  type Packer,
  type RenderTier,
} from '../../engine/index'
import { DEFAULT_LABEL_SCHEME, parseLabelScheme, type LabelScheme } from './labelScheme'
import { defaultLayoutFor, isLayoutIdFor, type ViewLayoutId } from './layoutIds'
import { parseRegionId, type RegionId } from './regions'
import { tierOverrideFrom } from './tierBounds'

/** The layers a URL carries when `layers=` is absent entirely (the upstream viewer's unchanged default). */
export const DEFAULT_LAYERS: readonly Layer[] = ['syzygies', 'currents', 'gates']

/** `base=` must be digits-only and no longer than this before it is even read as a number (T-04-13). */
export const BASE_PARAM_MAX_LENGTH = 16

/** The layer ids a `layers=` token may name; unknown tokens are dropped, not rejected (lenient-per-field). */
const ALLOWED_LAYERS = new Set<Layer>(['syzygies', 'currents', 'gates', 'pandemonium'])

/** The whole viewer state a URL search string carries (UI-02, D-13, D-21, todo 005). */
export interface ShareState {
  readonly base: number
  readonly layout: ViewLayoutId
  readonly layers: readonly Layer[]
  readonly selected: readonly number[]
  readonly region: RegionId | null
  readonly tc: boolean
  readonly particles: boolean
  readonly date: string
  readonly orbits: boolean
  readonly labels: LabelScheme
  readonly isolate: readonly RegionId[]
  readonly mute: readonly RegionId[]
  readonly packer: Packer
  readonly tier: RenderTier | null
}

/**
 * A refused `base=` value (D-06, the one strict/user-visible field): `check` is the engine's typed reason, or null
 * when the text was not even a plain decimal integer (malformed, too long, scientific notation, hex, trailing junk).
 */
export interface BaseRefusal {
  readonly raw: string
  readonly check: BaseCheck | null
}

export interface ParsedShare {
  readonly state: ShareState
  readonly baseRefusal: BaseRefusal | null
}

/** The state a fresh viewer starts from at `base` (default 10): the upstream 'original' preset at base 10, else 'ring'. */
export function defaultShareState(base = 10): ShareState {
  return {
    base,
    layout: defaultLayoutFor(base),
    layers: DEFAULT_LAYERS,
    selected: [],
    region: null,
    tc: false,
    particles: false,
    date: '',
    orbits: true,
    labels: DEFAULT_LABEL_SCHEME,
    isolate: [],
    mute: [],
    packer: DEFAULT_LAYOUT_PARAMS.packer,
    tier: null,
  }
}

const BASE_DIGITS_RE = /^[0-9]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ECHO = 40

/** text as it may echo in a refusal record: whole up to MAX_ECHO characters, else its first MAX_ECHO plus '...' (T-04-13). */
function clipRaw(text: string): string {
  return text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}...` : text
}

function parseBase(params: URLSearchParams): { base: number; baseRefusal: BaseRefusal | null } {
  const raw = params.get('base')
  if (raw === null) return { base: 10, baseRefusal: null }
  const trimmed = raw.trim()
  if (!BASE_DIGITS_RE.test(trimmed) || trimmed.length > BASE_PARAM_MAX_LENGTH) {
    return { base: 10, baseRefusal: { raw: clipRaw(trimmed), check: null } }
  }
  const check = validateBase(Number(trimmed))
  if (check.ok) return { base: check.base, baseRefusal: null }
  return { base: 10, baseRefusal: { raw: trimmed, check } }
}

function parseLayers(params: URLSearchParams): readonly Layer[] {
  const raw = params.get('layers')
  if (raw === null) return DEFAULT_LAYERS
  const seen = new Set<Layer>()
  const out: Layer[] = []
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    if (!ALLOWED_LAYERS.has(trimmed as Layer)) continue
    const layer = trimmed as Layer
    if (seen.has(layer)) continue
    seen.add(layer)
    out.push(layer)
  }
  return out
}

function parseSelected(params: URLSearchParams, base: number): readonly number[] {
  const raw = params.get('selected')
  if (raw === null || raw === '') return []
  const set = new Set<number>()
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    if (trimmed === '') continue
    const n = Number(trimmed)
    if (Number.isInteger(n) && n >= 0 && n < base) set.add(n)
  }
  return Array.from(set).sort((a, b) => a - b)
}

function parseRegionList(raw: string | null, g: Numogram): readonly RegionId[] {
  if (raw === null) return []
  const set = new Set<RegionId>()
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    if (trimmed === '') continue
    const id = parseRegionId(trimmed, g)
    if (id !== null) set.add(id)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function parseDate(raw: string | null): string {
  if (raw === null || !DATE_RE.test(raw)) return ''
  const parts = raw.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  const dt = new Date(`${raw}T12:00:00Z`)
  if (Number.isNaN(dt.getTime())) return ''
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return ''
  return raw
}

function parsePacker(raw: string | null): Packer {
  if (raw !== null && (PACKERS as readonly string[]).includes(raw)) return raw as Packer
  return DEFAULT_LAYOUT_PARAMS.packer
}

/**
 * Reads a URL search string (or an existing URLSearchParams) into a ShareState. Never throws: `base` is the one
 * strict field (D-06) — a refused value is reported in `baseRefusal` and the state falls back to base 10; every
 * other field is lenient per field, so a hand-edited or stale link still loads in full (D-21). Unknown keys are
 * ignored. `region`/`isolate`/`mute` only build a Numogram (`createNumogram`, cached) when one of them is present.
 */
export function parseShareParams(input: string | URLSearchParams): ParsedShare {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  const { base, baseRefusal } = parseBase(params)

  const rawLayout = params.get('layout')
  const layout: ViewLayoutId = rawLayout !== null && isLayoutIdFor(rawLayout, base) ? rawLayout : defaultLayoutFor(base)

  const layers = parseLayers(params)
  const selected = parseSelected(params, base)

  const rawRegion = params.get('region')
  const rawIsolate = params.get('isolate')
  const rawMute = params.get('mute')
  let region: RegionId | null = null
  let isolate: readonly RegionId[] = []
  let mute: readonly RegionId[] = []
  if (rawRegion !== null || rawIsolate !== null || rawMute !== null) {
    const g = createNumogram(base)
    if (rawRegion !== null) region = parseRegionId(rawRegion.trim(), g)
    isolate = parseRegionList(rawIsolate, g)
    mute = parseRegionList(rawMute, g)
  }

  const tc = params.get('tc') === '1'
  const particles = params.get('particles') === '1'
  const orbits = params.get('orbits') !== '0'
  const date = parseDate(params.get('date'))
  const labels = parseLabelScheme(params.get('labels'))
  const packer = parsePacker(params.get('packer'))
  const tier = tierOverrideFrom(params.get('tier'))

  return {
    state: { base, layout, layers, selected, region, tc, particles, date, orbits, labels, isolate, mute, packer, tier },
    baseRefusal,
  }
}
