// Base-10 layout presets (LAY-02, D-05). Original CCRUG code (MIT, NOTICE section 1); the upstream-authored data it
// exposes lives in layout-tables.ts (not relicensed). Imports engine layout TYPES only, so no engine layout runtime
// enters the viewer bundle (research Pitfall 1).
import type { Layout as EngineLayout, LayoutSpec, RoutingStyle } from '../../../engine/layout/types'
import type { Numogram } from '../../../engine/core/types'
import type { Pos } from '../../data/types'
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
  PLANETARY_CX,
  PLANETARY_CY,
  PLANETARY_DEFAULT_ANGLE,
  PLANETARY_RADIUS,
  PLANETARY_SIZE,
  REGION_LABELS,
} from './layout-tables'

// Re-export of the nine upstream table constants: the same bindings imported above, forwarded so app/data/positions.ts
// can become a thin pass-through seam (D-05) without positions.ts touching layout-tables.ts directly.
export { P_ORIGINAL, P_LABYRINTH, P_LADDER, PLANETARY_CX, PLANETARY_CY, PLANETARY_RADIUS, PLANETARY_DEFAULT_ANGLE, PLANETARY_SIZE, CENTER }

function assertBase10(g: Numogram, id: string): void {
  if (g.base !== 10) throw new RangeError(`base-10 layout preset "${id}" supports base 10 only, got ${g.base}`)
}

function isBase10(g: Numogram): boolean {
  return g.base === 10
}

/** Shared shape for the three fixed-table layouts (original, labyrinth, ladder); planetary computes its own points. */
function buildFixed(id: 'original' | 'labyrinth' | 'ladder', table: Record<number, Pos>, routingStyle: RoutingStyle): EngineLayout {
  const x = new Float64Array(10)
  const y = new Float64Array(10)
  for (let z = 0; z < 10; z++) {
    const p = table[z]
    if (p === undefined) throw new Error(`base-10 layout preset "${id}": missing zone ${z}`)
    x[z] = p.x
    y[z] = p.y
  }
  return {
    id,
    base: 10,
    x,
    y,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT[id],
    center: { ...CENTER[id] },
    nodeRadius: NODE_RADIUS,
    nodeRadii: null,
    labelSize: LABEL_SIZE,
    strokeScale: 1,
    scale: 1,
    natural: { width: FRAME_WIDTH, height: FRAME_HEIGHT[id] },
    groups: [],
    zoneGroup: new Int32Array(10).fill(-1),
    drawOrder: Int32Array.from(DRAW_ORDER[id]),
    regionLabels: REGION_LABELS[id],
    routingStyle,
  }
}

function buildOriginal(g: Numogram): EngineLayout {
  assertBase10(g, 'original')
  return buildFixed('original', P_ORIGINAL, 'default')
}

function buildLabyrinth(g: Numogram): EngineLayout {
  assertBase10(g, 'labyrinth')
  return buildFixed('labyrinth', P_LABYRINTH, 'default')
}

function buildLadder(g: Numogram): EngineLayout {
  assertBase10(g, 'ladder')
  return buildFixed('ladder', P_LADDER, 'ladder')
}

/**
 * Planetary positions are computed inline from the angle/radius tables (the formula of app/lib/planetary.ts):
 * importing that module would create a cycle once app/data/positions.ts becomes a seam over this file.
 */
function buildPlanetary(g: Numogram): EngineLayout {
  assertBase10(g, 'planetary')
  const x = new Float64Array(10)
  const y = new Float64Array(10)
  const nodeRadii = new Float64Array(10)
  const zones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (const z of zones) {
    const angle = PLANETARY_DEFAULT_ANGLE[z]
    const radius = PLANETARY_RADIUS[z]
    const size = PLANETARY_SIZE[z]
    if (angle === undefined || radius === undefined || size === undefined) {
      throw new Error(`base-10 layout preset "planetary": missing zone ${z}`)
    }
    const a = ((angle - 90) * Math.PI) / 180
    x[z] = PLANETARY_CX + Math.cos(a) * radius
    y[z] = PLANETARY_CY + Math.sin(a) * radius
    nodeRadii[z] = size
  }
  const drawOrder = Int32Array.from([...zones].sort((za, zb) => (y[za] as number) - (y[zb] as number)))
  return {
    id: 'planetary',
    base: 10,
    x,
    y,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT.planetary,
    center: { ...CENTER.planetary },
    nodeRadius: NODE_RADIUS,
    nodeRadii,
    labelSize: LABEL_SIZE,
    strokeScale: 1,
    scale: 1,
    natural: { width: FRAME_WIDTH, height: FRAME_HEIGHT.planetary },
    groups: [],
    zoneGroup: new Int32Array(10).fill(-1),
    drawOrder,
    regionLabels: REGION_LABELS.planetary,
    routingStyle: 'planetary',
  }
}

export const BASE10_LAYOUT_SPECS: readonly LayoutSpec[] = [
  { id: 'original', label: 'Original', supports: isBase10, build: buildOriginal },
  { id: 'labyrinth', label: 'Labyrinth', supports: isBase10, build: buildLabyrinth },
  { id: 'ladder', label: 'Ladder', supports: isBase10, build: buildLadder },
  { id: 'planetary', label: 'Planetary', supports: isBase10, build: buildPlanetary },
]
