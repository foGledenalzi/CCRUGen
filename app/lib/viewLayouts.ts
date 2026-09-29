// Layout targets for the viewer (LAY-01..04 in the live UI): base-10 presets return the authored tables unchanged,
// procedural layouts and the pair graph come from the engine with the user's packer (todo 005). Original CCRUG code
// (MIT, NOTICE section 1).
import { pairGraphLayout, resolveLayout } from '../../engine/index'
import type { Layout as EngineLayout, Numogram, Packer, RegionLabel, RoutingStyle } from '../../engine/index'
import type { Pos } from '../data/types'
import { isPresetLayoutId } from './layoutIds'
import type { ViewLayoutId } from './layoutIds'
import {
  CENTER,
  DRAW_ORDER,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  LABEL_SIZE,
  NODE_RADIUS,
  P_LADDER,
  P_LABYRINTH,
  P_ORIGINAL,
  REGION_LABELS,
} from '../presets/base10/layout-tables'

/** Rendered width of the projection svg (className w-[580px]), for on-screen label sizing. */
export const DIAGRAM_CSS_WIDTH = 580

export interface LayoutTarget {
  readonly key: string
  readonly base: number
  readonly id: ViewLayoutId
  readonly preset: boolean
  readonly pairGraph: boolean
  readonly pos: Record<number, Pos>
  readonly ctr: Pos
  readonly width: number
  readonly height: number
  readonly nodeRadius: number
  readonly labelSize: number
  readonly strokeScale: number
  readonly drawOrder: readonly number[] | null
  readonly regionLabels: readonly RegionLabel[]
  readonly routingStyle: RoutingStyle
  readonly layout: EngineLayout | null
}

/** A zone-indexed position record from parallel x/y typed arrays (engine layout output -> viewer record). */
export function toPosRecord(x: Float64Array, y: Float64Array): Record<number, Pos> {
  const pos: Record<number, Pos> = {}
  for (let z = 0; z < x.length; z++) {
    pos[z] = { x: x[z] ?? 0, y: y[z] ?? 0 }
  }
  return pos
}

/** Eased interpolation of two position records for zones 0..n-1: x = from.x + (to.x - from.x) * e, same for y. */
export function tweenPositions(from: Record<number, Pos>, to: Record<number, Pos>, n: number, e: number): Record<number, Pos> {
  const result: Record<number, Pos> = {}
  for (let z = 0; z < n; z++) {
    const f = from[z]
    const t = to[z]
    if (f === undefined || t === undefined) continue
    result[z] = { x: f.x + (t.x - f.x) * e, y: f.y + (t.y - f.y) * e }
  }
  return result
}

function presetTarget(g: Numogram, id: 'original' | 'labyrinth' | 'ladder', key: string): LayoutTarget {
  const table = id === 'original' ? P_ORIGINAL : id === 'labyrinth' ? P_LABYRINTH : P_LADDER
  return {
    key,
    base: g.base,
    id,
    preset: true,
    pairGraph: false,
    pos: table,
    ctr: CENTER[id],
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT[id],
    nodeRadius: NODE_RADIUS,
    labelSize: LABEL_SIZE,
    strokeScale: 1,
    drawOrder: DRAW_ORDER[id],
    regionLabels: REGION_LABELS[id],
    routingStyle: id === 'ladder' ? 'ladder' : 'default',
    layout: null,
  }
}

function planetaryTarget(g: Numogram, planetaryPos: Record<number, Pos>, key: string): LayoutTarget {
  return {
    key,
    base: g.base,
    id: 'planetary',
    preset: true,
    pairGraph: false,
    pos: planetaryPos,
    ctr: CENTER.planetary,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT.planetary,
    nodeRadius: NODE_RADIUS,
    labelSize: LABEL_SIZE,
    strokeScale: 1,
    drawOrder: null,
    regionLabels: REGION_LABELS.planetary,
    routingStyle: 'planetary',
    layout: null,
  }
}

function pairGraphTarget(g: Numogram, packer: Packer, key: string): LayoutTarget {
  const pg = pairGraphLayout(g, { packer })
  return {
    key,
    base: g.base,
    id: 'pairGraph',
    preset: false,
    pairGraph: true,
    pos: toPosRecord(pg.x, pg.y),
    ctr: pg.center,
    width: pg.width,
    height: pg.height,
    nodeRadius: pg.nodeRadius,
    labelSize: pg.labelSize,
    strokeScale: pg.strokeScale,
    drawOrder: Array.from(pg.drawOrder),
    regionLabels: pg.regionLabels,
    routingStyle: pg.routingStyle,
    layout: pg,
  }
}

function proceduralTarget(g: Numogram, id: ViewLayoutId, packer: Packer, key: string): LayoutTarget {
  const lay = resolveLayout(g, id, [], { packer })
  return {
    key,
    base: g.base,
    id,
    preset: false,
    pairGraph: false,
    pos: toPosRecord(lay.x, lay.y),
    ctr: lay.center,
    width: lay.width,
    height: lay.height,
    nodeRadius: lay.nodeRadius,
    labelSize: lay.labelSize,
    strokeScale: lay.strokeScale,
    drawOrder: Array.from(lay.drawOrder),
    regionLabels: lay.regionLabels,
    routingStyle: lay.routingStyle,
    layout: lay,
  }
}

/**
 * Everything the viewer needs to draw `id` at `g`'s base with `packer`: base-10 presets (original, labyrinth, ladder,
 * planetary) return the authored tables themselves, unchanged (byte-identical to the frozen goldens); the pair graph
 * and every procedural layout (ring, ladder, spiral at any other base) come from the engine with the user's chosen
 * packer (todo 005). `planetaryPos` is only read for the 'planetary' preset.
 */
export function layoutTarget(g: Numogram, id: ViewLayoutId, packer: Packer, planetaryPos: Record<number, Pos>): LayoutTarget {
  const key = `${g.base}:${id}:${packer}`
  if (isPresetLayoutId(id, g.base)) {
    if (id === 'planetary') return planetaryTarget(g, planetaryPos, key)
    if (id === 'original' || id === 'labyrinth' || id === 'ladder') return presetTarget(g, id, key)
  }
  if (id === 'pairGraph') return pairGraphTarget(g, packer, key)
  return proceduralTarget(g, id, packer, key)
}
