// Engine routes -> the viewer's GateRender/CurrentRender records (procedural layouts). Keyed by the view's own names
// so the renderer, selection and panels share one identity. Original CCRUG code (MIT, NOTICE section 1).
import { routeCurrents, routeGates } from '../../engine/index'
import type { CurrentRoutes, GateRoutes, Layout as EngineLayout } from '../../engine/index'
import type { CurrentRender, GateRender, Pos } from '../data/types'
import type { NumogramView } from './numogramView'

export interface EngineRenderData {
  readonly gates: Record<string, GateRender>
  readonly currents: Record<string, CurrentRender>
  readonly gateRoutes: GateRoutes
  readonly currentRoutes: CurrentRoutes
}

/** `layout` with fresh x/y typed arrays built from `pos` (a tween frame); every other field is the same reference. */
export function frameLayout(layout: EngineLayout, pos: Record<number, Pos>): EngineLayout {
  const n = layout.x.length
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let z = 0; z < n; z++) {
    const p = pos[z]
    x[z] = p?.x ?? 0
    y[z] = p?.y ?? 0
  }
  return { ...layout, x, y }
}

/**
 * `view`'s gates and currents rendered against `layout`'s engine routes, keyed by the view's own names (not zone
 * or pair index) so selection and panels share identity with the renderer. `opts` lets a tween reuse a prior route's
 * bulge/junction orientation so a mid-tween frame does not flip sides (D-09).
 */
export function engineRenderData(
  view: NumogramView,
  layout: EngineLayout,
  opts: { gateOrientation?: Int8Array; currentOrientation?: Int8Array } = {},
): EngineRenderData {
  const g = view.g
  const gateRoutes = routeGates(g, layout, opts.gateOrientation ? { orientation: opts.gateOrientation } : {})
  const currentRoutes = routeCurrents(g, layout, opts.currentOrientation ? { orientation: opts.currentOrientation } : {})

  const gates: Record<string, GateRender> = {}
  for (let z = 0; z < view.gates.length; z++) {
    const gate = view.gates[z]
    if (gate === undefined) continue
    const d = gateRoutes.d[z] ?? ''
    const mid: Pos = { x: gateRoutes.labelX[z] ?? 0, y: gateRoutes.labelY[z] ?? 0 }
    gates[gate.name] = gateRoutes.loop[z] === 1 ? { type: 'loop', loop: d, mid } : { type: 'single', path: d, mid }
  }

  const currents: Record<string, CurrentRender> = {}
  for (const c of view.currents) {
    const q = g.pairOf(c.from)
    currents[c.name] = {
      type: 'yshape',
      legA: currentRoutes.legA[q] ?? '',
      legB: currentRoutes.legB[q] ?? '',
      stem: currentRoutes.stem[q] ?? '',
      junction: { x: currentRoutes.junctionX[q] ?? 0, y: currentRoutes.junctionY[q] ?? 0 },
    }
  }

  return { gates, currents, gateRoutes, currentRoutes }
}
